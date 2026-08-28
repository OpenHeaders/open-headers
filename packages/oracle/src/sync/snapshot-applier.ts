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
  type SyncGrpcRequestPostState,
  type SyncGrpcResponseExamplePostState,
  type SyncLayoutStatePostState,
  type SyncLiveFallbackPriorityPostState,
  type SyncLiveValuePostState,
  type SyncLiveVariablePostState,
  type SyncLiveWorkflowPostState,
  type SyncMqttRequestPostState,
  type SyncMqttResponseExamplePostState,
  type SyncOAuthBundlePostState,
  type SyncPauseMarkersPostState,
  type SyncRequestCollectionPostState,
  type SyncRequestFolderPostState,
  type SyncRequestPostState,
  type SyncResponseExamplePostState,
  type SyncRulePostState,
  type SyncScriptPackagePostState,
  type SyncSpecPostState,
  type SyncTemplateCollectionPostState,
  type SyncTemplateFolderPostState,
  type SyncTemplatePostState,
  type SyncTrustedRootsPostState,
  type SyncVaultPostState,
  type SyncWebSocketRequestPostState,
  type SyncWorkspaceRootsPostState,
  type SyncWorkspaceVariablesPostState,
  type SyncWsResponseExamplePostState,
  type WorkspaceSnapshot,
} from '@openheaders/core/protocol';
import {
  COLLECTION_ENTITY_TYPE,
  FOLDER_CHILDREN_PATH,
  FOLDER_ENTITY_TYPE,
  FOLDER_ITEMS_PATH,
  GRPC_REQUEST_ENTITY_TYPE,
  MQTT_REQUEST_ENTITY_TYPE,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  REQUEST_FOLDER_ENTITY_TYPE,
  RULE_ENTITY_TYPE,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_ENTITY_TYPE,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  WEBSOCKET_REQUEST_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { seedCollection } from '@openheaders/core/sync-builders/projections/collection-projection';
import { seedEnvironment } from '@openheaders/core/sync-builders/projections/env-projection';
import { seedFiles } from '@openheaders/core/sync-builders/projections/files-projection';
import { seedFolder } from '@openheaders/core/sync-builders/projections/folder-projection';
import { seedGrpcRequest } from '@openheaders/core/sync-builders/projections/grpc-request-projection';
import { seedGrpcResponseExample } from '@openheaders/core/sync-builders/projections/grpc-response-example-projection';
import { seedLayoutState } from '@openheaders/core/sync-builders/projections/layout-state-projection';
import { seedLiveFallbackPriority } from '@openheaders/core/sync-builders/projections/live-fallback-priority-projection';
import { seedLiveValues } from '@openheaders/core/sync-builders/projections/live-value-projection';
import { seedLiveVariable } from '@openheaders/core/sync-builders/projections/live-variable-projection';
import { seedLiveWorkflow } from '@openheaders/core/sync-builders/projections/live-workflow-projection';
import { seedMqttRequest } from '@openheaders/core/sync-builders/projections/mqtt-request-projection';
import { seedMqttResponseExample } from '@openheaders/core/sync-builders/projections/mqtt-response-example-projection';
import { seedOAuthBundle } from '@openheaders/core/sync-builders/projections/oauth-bundle-projection';
import { seedPauseMarkers } from '@openheaders/core/sync-builders/projections/pause-markers-projection';
import { seedRequestCollection } from '@openheaders/core/sync-builders/projections/request-collection-projection';
import { seedRequestFolder } from '@openheaders/core/sync-builders/projections/request-folder-projection';
import { seedRequest } from '@openheaders/core/sync-builders/projections/request-projection';
import { seedResponseExample } from '@openheaders/core/sync-builders/projections/response-example-projection';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import { seedScriptPackage } from '@openheaders/core/sync-builders/projections/script-package-projection';
import { seedSpec } from '@openheaders/core/sync-builders/projections/spec-projection';
import { seedTemplateCollection } from '@openheaders/core/sync-builders/projections/template-collection-projection';
import { seedTemplateFolder } from '@openheaders/core/sync-builders/projections/template-folder-projection';
import { seedTemplate } from '@openheaders/core/sync-builders/projections/template-projection';
import { seedTrustedRoots } from '@openheaders/core/sync-builders/projections/trusted-roots-projection';
import { seedVault } from '@openheaders/core/sync-builders/projections/vault-projection';
import { seedWebSocketRequest } from '@openheaders/core/sync-builders/projections/websocket-request-projection';
import { seedWorkspaceRoots } from '@openheaders/core/sync-builders/projections/workspace-roots-projection';
import { seedWorkspaceVariables } from '@openheaders/core/sync-builders/projections/workspace-variables-projection';
import { seedWsResponseExample } from '@openheaders/core/sync-builders/projections/ws-response-example-projection';

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
  await seedEach<SyncGrpcRequestPostState>('grpcRequests', snapshot.grpcRequests, (p, ctx) =>
    seedGrpcRequest(p.grpcRequest, ctx),
  );
  await seedEach<SyncWebSocketRequestPostState>('websocketRequests', snapshot.websocketRequests, (p, ctx) =>
    seedWebSocketRequest(p.websocketRequest, ctx),
  );
  await seedEach<SyncMqttRequestPostState>('mqttRequests', snapshot.mqttRequests, (p, ctx) =>
    seedMqttRequest(p.mqttRequest, ctx),
  );
  await seedEach<SyncSpecPostState>('specs', snapshot.specs, (p, ctx) => seedSpec(p.spec, ctx));
  await seedEach<SyncScriptPackagePostState>('scriptPackages', snapshot.scriptPackages, (p, ctx) =>
    seedScriptPackage(p.scriptPackage, ctx),
  );
  await seedEach<SyncResponseExamplePostState>('responseExamples', snapshot.responseExamples, (p, ctx) =>
    seedResponseExample(p.responseExample, ctx),
  );
  await seedEach<SyncGrpcResponseExamplePostState>('grpcResponseExamples', snapshot.grpcResponseExamples, (p, ctx) =>
    seedGrpcResponseExample(p.grpcResponseExample, ctx),
  );
  await seedEach<SyncWsResponseExamplePostState>('wsResponseExamples', snapshot.wsResponseExamples, (p, ctx) =>
    seedWsResponseExample(p.wsResponseExample, ctx),
  );
  await seedEach<SyncMqttResponseExamplePostState>('mqttResponseExamples', snapshot.mqttResponseExamples, (p, ctx) =>
    seedMqttResponseExample(p.mqttResponseExample, ctx),
  );
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
  await seedEach<SyncTrustedRootsPostState>('trustedRoots', snapshot.trustedRoots, (p, ctx) =>
    seedTrustedRoots(p.trustedRoots, ctx),
  );
  await seedEach<SyncWorkspaceRootsPostState>('workspaceRoots', snapshot.workspaceRoots, (p, ctx) =>
    seedWorkspaceRoots(p.workspaceRoots, ctx),
  );
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
  // The seeder reads both shapes: a 2026.8.4 sender's `markers` is
  // path-keyed (no `entries`) and seeds version-1 members the fold
  // migrates on read.
  await seedEach<SyncPauseMarkersPostState>('pauseMarkers', snapshot.pauseMarkers, (p, ctx) =>
    seedPauseMarkers(p, ctx),
  );
  await seedEach<SyncLayoutStatePostState>('layoutState', snapshot.layoutState, (p, ctx) =>
    seedLayoutState(p.layout, ctx),
  );
  await seedEach<SyncFilesPostState>('files', snapshot.files, (p, ctx) => seedFiles(p.refs, ctx));

  // Containment slots. The entity seeds above are slot-less — folders
  // and leaves are linked by their parent's `folders` / `items` sets,
  // and every container post-state carries those sets' `(itemId,
  // orderKey)` pairs. Replay them with the sender's keys so the
  // receiver's tree order is the sender's, not a re-seed from paths.
  await seedEach<ContainerSlots>('treeSlots', collectTreeSlots(snapshot), (p, ctx) => mintBatch(ctx, p.bodies));

  return { entitiesApplied, byType };
}

interface ContainerSlots {
  bodies: MutationBody[];
}

interface ContainerTree {
  containers: ReadonlyArray<{ type: string; uid: string; setOrderKeys: SetOrderKeys }>;
  leafTypeOf: ReadonlyMap<string, string>;
}

type SetOrderKeys = Record<string, Array<{ itemId: string; orderKey: string }>>;

/** One slot batch per container that carries live `folders` / `items` slots. */
function collectTreeSlots(snapshot: WorkspaceSnapshot): ContainerSlots[] {
  const leafTypes = (...groups: Array<[string, ReadonlyArray<{ uid: string }>]>): ReadonlyMap<string, string> => {
    const out = new Map<string, string>();
    for (const [type, entities] of groups) for (const entity of entities) out.set(entity.uid, type);
    return out;
  };
  const trees: ContainerTree[] = [
    {
      containers: [
        ...snapshot.collections.map((p) => ({
          type: COLLECTION_ENTITY_TYPE,
          uid: p.collection.uid,
          setOrderKeys: p.setOrderKeys,
        })),
        ...snapshot.folders.map((p) => ({ type: FOLDER_ENTITY_TYPE, uid: p.folder.uid, setOrderKeys: p.setOrderKeys })),
      ],
      leafTypeOf: leafTypes([RULE_ENTITY_TYPE, snapshot.rules.map((p) => p.rule)]),
    },
    {
      containers: [
        ...snapshot.requestCollections.map((p) => ({
          type: REQUEST_COLLECTION_ENTITY_TYPE,
          uid: p.collection.uid,
          setOrderKeys: p.setOrderKeys,
        })),
        ...snapshot.requestFolders.map((p) => ({
          type: REQUEST_FOLDER_ENTITY_TYPE,
          uid: p.folder.uid,
          setOrderKeys: p.setOrderKeys,
        })),
      ],
      leafTypeOf: leafTypes(
        [REQUEST_ENTITY_TYPE, snapshot.requests.map((p) => p.request)],
        [GRPC_REQUEST_ENTITY_TYPE, snapshot.grpcRequests.map((p) => p.grpcRequest)],
        [WEBSOCKET_REQUEST_ENTITY_TYPE, snapshot.websocketRequests.map((p) => p.websocketRequest)],
        [MQTT_REQUEST_ENTITY_TYPE, snapshot.mqttRequests.map((p) => p.mqttRequest)],
      ),
    },
    {
      containers: [
        ...snapshot.templateCollections.map((p) => ({
          type: TEMPLATE_COLLECTION_ENTITY_TYPE,
          uid: p.collection.uid,
          setOrderKeys: p.setOrderKeys,
        })),
        ...snapshot.templateFolders.map((p) => ({
          type: TEMPLATE_FOLDER_ENTITY_TYPE,
          uid: p.folder.uid,
          setOrderKeys: p.setOrderKeys,
        })),
      ],
      leafTypeOf: leafTypes([TEMPLATE_ENTITY_TYPE, snapshot.templates.map((p) => p.template)]),
    },
  ];

  const out: ContainerSlots[] = [];
  for (const tree of trees) {
    for (const container of tree.containers) {
      const bodies: MutationBody[] = [];
      for (const slot of container.setOrderKeys[FOLDER_CHILDREN_PATH] ?? []) {
        bodies.push({
          kind: 'addToSet',
          type: container.type,
          id: container.uid,
          path: FOLDER_CHILDREN_PATH,
          itemId: slot.itemId,
          item: { uid: slot.itemId },
          orderKey: slot.orderKey,
        });
      }
      for (const slot of container.setOrderKeys[FOLDER_ITEMS_PATH] ?? []) {
        const type = tree.leafTypeOf.get(slot.itemId);
        if (type === undefined) continue;
        bodies.push({
          kind: 'addToSet',
          type: container.type,
          id: container.uid,
          path: FOLDER_ITEMS_PATH,
          itemId: slot.itemId,
          item: { uid: slot.itemId, type },
          orderKey: slot.orderKey,
        });
      }
      if (bodies.length > 0) out.push({ bodies });
    }
  }
  return out;
}
