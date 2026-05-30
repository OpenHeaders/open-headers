/**
 * Consumer side of the C5 snapshot bootstrap.
 *
 * Given a {@link WorkspaceSnapshot} blob received over the wire,
 * re-materialize every entity into the local oracle by routing the
 * existing `seed*` builders through {@link applySyncRequest}. The
 * apply path is the same one mutation-streaming uses (C7-C10),
 * keeping cache + log + broadcast invariants identical between
 * "applied from peer" and "synthesized from snapshot".
 *
 * **Scope of this slice.** This is the structural plumbing: parse
 * the blob, walk each entity-type array, emit seed batches, await
 * apply. It is sufficient for the cold-receiver case (receiver has
 * no prior state — the snapshot IS the state).
 *
 * **Deferred — HLC watermark coherence.** The synthetic seed
 * envelopes carry HLCs from the receiver's local clock; folding the
 * resulting log gives `{ receiverNode: someHlc }`, NOT the snapshot's
 * `takenAtHlc`. Cold-receiver case is correct because the receiver
 * sends its own state vector in the post-apply STATE_VECTOR / SYNCED
 * exchange and the peer streams everything since then. The watermark
 * issue surfaces only if a non-cold receiver were ever given a
 * snapshot (out of scope for v1) or if there's interleaving with a
 * pending-out queue (C13-C16). Track this with the C13-C16 reconnect
 * design.
 *
 * **Sensitivity.** If the blob was sent across a trust boundary,
 * the sensitive arrays were stripped by
 * {@link redactSensitiveSnapshotKeys} at send. The consumer treats
 * empty `vault` / `oauthBundles` as "not present in this transport";
 * a local-loopback restore that legitimately carries them applies
 * them through the same seed path.
 */
import {
  MIN_SNAPSHOT_SCHEMA_VERSION,
  SNAPSHOT_SCHEMA_VERSION,
  type SyncCollectionPostState,
  type SyncEnvironmentPostState,
  type SyncFilesPostState,
  type SyncFolderPostState,
  type SyncLayoutStatePostState,
  type SyncLiveFallbackPriorityPostState,
  type SyncLiveValuePostState,
  type SyncLiveVariablePostState,
  type SyncLiveWorkflowPostState,
  type SyncOAuthBundlePostState,
  type SyncPauseMarkersPostState,
  type SyncRequestCollectionPostState,
  type SyncRequestFolderPostState,
  type SyncRequestPostState,
  type SyncRulePostState,
  type SyncTemplateCollectionPostState,
  type SyncTemplateFolderPostState,
  type SyncTemplatePostState,
  type SyncVaultPostState,
  type SyncWorkspaceVariablesPostState,
  type WorkspaceSnapshot,
} from '@openheaders/core/protocol';
import type { MutatorContext } from '@openheaders/core/sync';
import { seedCollection } from '@openheaders/core/sync-builders/collection-projection';
import { seedEnvironment } from '@openheaders/core/sync-builders/env-projection';
import { seedFiles } from '@openheaders/core/sync-builders/files-projection';
import { seedFolder } from '@openheaders/core/sync-builders/folder-projection';
import { seedLayoutState } from '@openheaders/core/sync-builders/layout-state-projection';
import { seedLiveFallbackPriority } from '@openheaders/core/sync-builders/live-fallback-priority-projection';
import { seedLiveValues } from '@openheaders/core/sync-builders/live-value-projection';
import { seedLiveVariable } from '@openheaders/core/sync-builders/live-variable-projection';
import { seedLiveWorkflow } from '@openheaders/core/sync-builders/live-workflow-projection';
import { seedOAuthBundle } from '@openheaders/core/sync-builders/oauth-bundle-projection';
import { seedPauseMarkers } from '@openheaders/core/sync-builders/pause-markers-projection';
import { seedRequestCollection } from '@openheaders/core/sync-builders/request-collection-projection';
import { seedRequestFolder } from '@openheaders/core/sync-builders/request-folder-projection';
import { seedRequest } from '@openheaders/core/sync-builders/request-projection';
import { seedRule } from '@openheaders/core/sync-builders/rule-projection';
import { seedTemplateCollection } from '@openheaders/core/sync-builders/template-collection-projection';
import { seedTemplateFolder } from '@openheaders/core/sync-builders/template-folder-projection';
import { seedTemplate } from '@openheaders/core/sync-builders/template-projection';
import { seedVault } from '@openheaders/core/sync-builders/vault-projection';
import { seedWorkspaceVariables } from '@openheaders/core/sync-builders/workspace-variables-projection';

import { applySyncRequest } from './service';

export interface ApplySnapshotOptions {
  /**
   * Yields a fresh {@link MutatorContext} for each entity. Caller
   * controls the `nodeId` stamped onto every synthetic seed envelope
   * (the receiver's local writer identity) plus the HLC source. The
   * factory is invoked per-entity so the wall clock can advance
   * between entries — preserving the per-entity HLC monotonicity the
   * sync engine relies on.
   */
  makeContext: () => MutatorContext;
}

export interface ApplySnapshotResult {
  entitiesApplied: number;
  /** Per-entity-type apply counts; useful for diagnostics + telemetry. */
  byType: Record<string, number>;
}

/**
 * Validate the snapshot's envelope schema version and re-materialize
 * each entity into the workspace oracle named by
 * `snapshot.workspaceId`. Throws on schema-version skew so the caller
 * can fall back to delta-stream replay rather than corrupting local
 * state with a partially-understood blob.
 */
export async function applyWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
  options: ApplySnapshotOptions,
): Promise<ApplySnapshotResult> {
  if (snapshot.schemaVersion < MIN_SNAPSHOT_SCHEMA_VERSION || snapshot.schemaVersion > SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(
      `applyWorkspaceSnapshot: schemaVersion ${snapshot.schemaVersion} outside supported range [${MIN_SNAPSHOT_SCHEMA_VERSION}, ${SNAPSHOT_SCHEMA_VERSION}]`,
    );
  }

  const byType: Record<string, number> = {};
  let entitiesApplied = 0;

  async function seedEach<T>(
    label: string,
    items: readonly T[],
    builder: (item: T, ctx: MutatorContext) => import('@openheaders/core/sync').MutationBatch,
  ): Promise<void> {
    if (items.length === 0) return;
    for (const item of items) {
      const ctx = options.makeContext();
      const batch = builder(item, ctx);
      await applySyncRequest({ type: 'oh.sync.apply', batch, sideEffects: [], applyOrigin: 'inbound' });
    }
    byType[label] = items.length;
    entitiesApplied += items.length;
  }

  // Order matters only weakly here: parents before children eases the
  // post-apply broadcast (fewer "parent yet to seed" deferrals in
  // folder caches), but apply itself is convergent regardless.
  await seedEach<SyncCollectionPostState>('collections', snapshot.collections, (p, ctx) =>
    seedCollection(p.collection, ctx),
  );
  await seedEach<SyncEnvironmentPostState>('environments', snapshot.environments, (p, ctx) =>
    seedEnvironment(p.environment, ctx),
  );
  await seedEach<SyncFolderPostState>('folders', snapshot.folders, (p, ctx) => seedFolder(p.folder, ctx));
  await seedEach<SyncRulePostState>('rules', snapshot.rules, (p, ctx) => seedRule(p.rule, ctx));
  await seedEach<SyncRequestCollectionPostState>('requestCollections', snapshot.requestCollections, (p, ctx) =>
    seedRequestCollection(p.collection, ctx),
  );
  await seedEach<SyncRequestFolderPostState>('requestFolders', snapshot.requestFolders, (p, ctx) =>
    seedRequestFolder(p.folder, ctx),
  );
  await seedEach<SyncRequestPostState>('requests', snapshot.requests, (p, ctx) => seedRequest(p.request, ctx));
  await seedEach<SyncTemplateCollectionPostState>('templateCollections', snapshot.templateCollections, (p, ctx) =>
    seedTemplateCollection(p.collection, ctx),
  );
  await seedEach<SyncTemplateFolderPostState>('templateFolders', snapshot.templateFolders, (p, ctx) =>
    seedTemplateFolder(p.folder, ctx),
  );
  await seedEach<SyncTemplatePostState>('templates', snapshot.templates, (p, ctx) => seedTemplate(p.template, ctx));
  await seedEach<SyncLiveVariablePostState>('liveVariables', snapshot.liveVariables, (p, ctx) =>
    seedLiveVariable(p.liveVariable, ctx),
  );
  await seedEach<SyncLiveWorkflowPostState>('liveWorkflows', snapshot.liveWorkflows, (p, ctx) =>
    seedLiveWorkflow(p.workflow, ctx),
  );
  await seedEach<SyncLiveValuePostState>('liveValues', snapshot.liveValues, (p, ctx) =>
    seedLiveValues({ schemaVersion: 5, values: p.values }, ctx),
  );
  await seedEach<SyncLiveFallbackPriorityPostState>('liveFallbackPriority', snapshot.liveFallbackPriority, (p, ctx) =>
    seedLiveFallbackPriority({ schemaVersion: 5, members: p.members }, ctx),
  );

  // Singletons — exactly one item per array when populated.
  await seedEach<SyncWorkspaceVariablesPostState>('workspaceVariables', snapshot.workspaceVariables, (p, ctx) =>
    seedWorkspaceVariables(p.workspaceVariables, ctx),
  );
  await seedEach<SyncVaultPostState>('vault', snapshot.vault, (p, ctx) => seedVault(p.vault, ctx));
  await seedEach<SyncOAuthBundlePostState>('oauthBundles', snapshot.oauthBundles, (p, ctx) =>
    seedOAuthBundle(
      {
        // Post-state does not carry schemaVersion (§sync-bridge.ts); seed uses the workspace-baseline.
        schemaVersion: 5,
        tokens: p.tokens,
        configs: p.configs,
        refreshErrors: p.refreshErrors,
      },
      ctx,
    ),
  );
  await seedEach<SyncPauseMarkersPostState>('pauseMarkers', snapshot.pauseMarkers, (p, ctx) =>
    seedPauseMarkers(p.markers, ctx),
  );
  await seedEach<SyncLayoutStatePostState>('layoutState', snapshot.layoutState, (p, ctx) =>
    seedLayoutState(p.layout, ctx),
  );
  await seedEach<SyncFilesPostState>('files', snapshot.files, (p, ctx) => seedFiles(p.refs, ctx));

  return { entitiesApplied, byType };
}
