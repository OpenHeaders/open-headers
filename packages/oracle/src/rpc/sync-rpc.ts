/**
 * Host-neutral RPC dispatcher for the sync + awareness wire channels.
 *
 * Covers the 22 channels that every host must expose to its renderer
 * for the per-workspace mirror plane to function:
 *
 *   - `oh.sync.apply`                       — write path
 *   - `oh.sync.snapshot*` (19 entity types) — per-workspace mirror seed
 *   - `oh.sync.snapshotExtensionWorkspaces` — global-scope mirror seed
 *   - `oh.awareness.publish`                — presence write
 *   - `oh.awareness.snapshot`               — presence seed
 *
 * Everything is read from the oracle's already-host-neutral exports —
 * this module owns no state, no chrome.* coupling, and no host-specific
 * transport. The extension's `runtime.onMessage` listener and the
 * desktop main's `ipcMain.handle` (Stage 2 commit 6) both delegate the
 * 22 types here, then route their host-specific RPCs (chrome.tabs,
 * chrome.identity, etc.) in their own dispatchers.
 *
 * Return contract:
 *   - `{ kind: 'sync', response }`   — caller resolves synchronously
 *   - `{ kind: 'async', promise }`   — caller awaits + responds
 *   - `null`                          — message type is not one of the
 *                                       22 sync/awareness channels;
 *                                       caller continues its own
 *                                       dispatcher chain
 */

import type {
  AwarenessPublishRequest,
  AwarenessPublishResponse,
  AwarenessState,
  SyncApplyRequest,
  SyncApplyResponse,
  SyncMutationBatchMessage,
  SyncMutationMessage,
} from '@openheaders/core/protocol';
import { SYNC_MUTATION_BATCH_TYPE, SYNC_MUTATION_TYPE } from '@openheaders/core/protocol';
import type {
  CoexistPayload,
  CoexistResult,
  DiscardBackupArchive,
  DiscardResult,
  ImportPayload,
  ImportResult,
  InverseEnvelopeContext,
  RestoreResult,
} from '@openheaders/core/sync';
import { isDiscardBackupArchiveShape } from '@openheaders/core/sync';
import {
  applyInboundMutationBatch,
  applyInboundMutationEnvelope,
} from '../sync/mutation-stream-bridge';
import { logger } from '@openheaders/core/utils';
import {
  listMutedActivityEntities,
  muteActivityEntity,
  unmuteActivityEntity,
} from '../sync/activity-mute-cache';
import { generateInverseMutation } from '../sync/activity-revert';
import { snapshotExtensionWorkspacePostStates } from '../sync/global-service';
import {
  applyCoexistPayload,
  applyDiscardRestoreArchive,
  applyImportPayload,
  collectLocalDataPresence,
  orchestrateCoexistToPeer,
  orchestrateDiscardWithBackup,
  orchestrateImportToPeer,
} from '../sync/mode-switch';
import { buildSnapshotForWorkspace } from '../sync/snapshot-builder';
import { applyWorkspaceSnapshot } from '../sync/snapshot-applier';
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  listWorkspaces,
} from '../workspace/extension-workspace-store';
import { getOrCreateWorkspaceService, releaseWorkspaceService } from '../sync/service';
import { requireActiveWorkspaceId } from '../sync';
import { getSyncPersistenceProvider } from '../sync/sync-persistence-provider';
import {
  applySyncRequest,
  getOracleForWorkspace,
  nextSwMutatorContextForWorkspace,
  publishAwareness,
  snapshotAwarenessPresence,
  snapshotCollectionPostStates,
  snapshotEnvironmentPostStates,
  snapshotFilesPostStates,
  snapshotFolderPostStates,
  snapshotLayoutStatePostStates,
  snapshotLiveVariablePostStates,
  snapshotLiveWorkflowPostStates,
  snapshotOAuthBundlePostStates,
  snapshotPauseMarkersPostStates,
  snapshotRequestCollectionPostStates,
  snapshotRequestFolderPostStates,
  snapshotRequestPostStates,
  snapshotRulePostStates,
  snapshotTemplateCollectionPostStates,
  snapshotTemplateFolderPostStates,
  snapshotTemplatePostStates,
  snapshotVaultPostStates,
  snapshotWorkspaceVariablesPostStates,
} from '../sync/service';

export type SyncRpcResult =
  | { kind: 'sync'; response: unknown }
  | { kind: 'async'; promise: Promise<unknown> };

const SYNC_SNAPSHOT_DISPATCH: Record<string, (workspaceId?: string) => { entries: unknown[] }> = {
  'oh.sync.snapshotRules': (ws) => ({ entries: snapshotRulePostStates(ws) }),
  'oh.sync.snapshotEnvironments': (ws) => ({ entries: snapshotEnvironmentPostStates(ws) }),
  'oh.sync.snapshotCollections': (ws) => ({ entries: snapshotCollectionPostStates(ws) }),
  'oh.sync.snapshotWorkspaceVariables': (ws) => ({ entries: snapshotWorkspaceVariablesPostStates(ws) }),
  'oh.sync.snapshotVault': (ws) => ({ entries: snapshotVaultPostStates(ws) }),
  'oh.sync.snapshotFolders': (ws) => ({ entries: snapshotFolderPostStates(ws) }),
  'oh.sync.snapshotRequests': (ws) => ({ entries: snapshotRequestPostStates(ws) }),
  'oh.sync.snapshotRequestCollections': (ws) => ({ entries: snapshotRequestCollectionPostStates(ws) }),
  'oh.sync.snapshotRequestFolders': (ws) => ({ entries: snapshotRequestFolderPostStates(ws) }),
  'oh.sync.snapshotTemplates': (ws) => ({ entries: snapshotTemplatePostStates(ws) }),
  'oh.sync.snapshotTemplateCollections': (ws) => ({ entries: snapshotTemplateCollectionPostStates(ws) }),
  'oh.sync.snapshotTemplateFolders': (ws) => ({ entries: snapshotTemplateFolderPostStates(ws) }),
  'oh.sync.snapshotLiveVariables': (ws) => ({ entries: snapshotLiveVariablePostStates(ws) }),
  'oh.sync.snapshotLiveWorkflows': (ws) => ({ entries: snapshotLiveWorkflowPostStates(ws) }),
  'oh.sync.snapshotOAuthBundle': (ws) => ({ entries: snapshotOAuthBundlePostStates(ws) }),
  'oh.sync.snapshotPauseMarkers': (ws) => ({ entries: snapshotPauseMarkersPostStates(ws) }),
  'oh.sync.snapshotLayoutState': (ws) => ({ entries: snapshotLayoutStatePostStates(ws) }),
  'oh.sync.snapshotFiles': (ws) => ({ entries: snapshotFilesPostStates(ws) }),
};

/**
 * Dispatch a sync/awareness message. Returns `null` when `message.type`
 * is not one of the 22 channels this dispatcher owns; the caller routes
 * those onward through its host-specific message chain.
 */
export function dispatchSyncRpc(message: Record<string, unknown>): SyncRpcResult | null {
  const type = message.type;
  if (typeof type !== 'string') return null;

  if (type === SYNC_MUTATION_TYPE) {
    const msg = message as unknown as SyncMutationMessage;
    const promise = applyInboundMutationEnvelope(msg.envelope).then(() => ({ ok: true }) as const);
    return { kind: 'async', promise };
  }

  if (type === SYNC_MUTATION_BATCH_TYPE) {
    const msg = message as unknown as SyncMutationBatchMessage;
    const promise = applyInboundMutationBatch(msg.batch).then(() => ({ ok: true }) as const);
    return { kind: 'async', promise };
  }

  if (type === 'oh.sync.apply') {
    const request = message as unknown as SyncApplyRequest;
    const promise = applySyncRequest(request).catch((err: Error): SyncApplyResponse => {
      logger.info('SyncRpc', `oh.sync.apply rejected: ${err.message}`);
      // Transport-level error surfaces through the same SyncApplyResponse
      // shape — callers don't need a parallel error branch.
      // `schema-rejected` is the broadest "couldn't apply" status; the
      // detail carries the human-readable cause.
      return {
        ok: false,
        outcomes: [],
        failure: { mutationId: '', status: 'schema-rejected', detail: err.message },
      };
    });
    return { kind: 'async', promise };
  }

  if (type === 'oh.sync.snapshotExtensionWorkspaces') {
    return { kind: 'sync', response: { entries: snapshotExtensionWorkspacePostStates() } };
  }

  const snapshotHandler = SYNC_SNAPSHOT_DISPATCH[type];
  if (snapshotHandler) {
    const wsArg = typeof message.workspaceId === 'string' ? message.workspaceId : undefined;
    return { kind: 'sync', response: snapshotHandler(wsArg) };
  }

  if (type === 'oh.sync.listActivity') {
    const ws = typeof message.workspaceId === 'string' ? message.workspaceId : null;
    if (!ws) return { kind: 'sync', response: { entries: [] } };
    const log = getSyncPersistenceProvider().createActivityLog?.();
    if (!log) return { kind: 'sync', response: { entries: [] } };
    const limit = typeof message.limit === 'number' ? message.limit : 100;
    const sinceHlcKey = typeof message.sinceHlcKey === 'string' ? message.sinceHlcKey : undefined;
    const unreadOnly = message.unreadOnly === true;
    const promise = log
      .list(ws, { limit, sinceHlcKey, unreadOnly })
      .then((entries) => ({ entries }))
      .catch((err: Error) => {
        logger.info('SyncRpc', `oh.sync.listActivity failed: ${err.message}`);
        return { entries: [] };
      });
    return { kind: 'async', promise };
  }

  if (type === 'oh.sync.markActivityRead') {
    const ws = typeof message.workspaceId === 'string' ? message.workspaceId : null;
    const ids = Array.isArray(message.ids) ? (message.ids.filter((x) => typeof x === 'string') as string[]) : [];
    if (!ws || ids.length === 0) return { kind: 'sync', response: { ok: true } };
    const log = getSyncPersistenceProvider().createActivityLog?.();
    if (!log) return { kind: 'sync', response: { ok: true } };
    const promise = log
      .markRead(ws, ids)
      .then(() => ({ ok: true }) as const)
      .catch((err: Error) => {
        logger.info('SyncRpc', `oh.sync.markActivityRead failed: ${err.message}`);
        return { ok: true } as const;
      });
    return { kind: 'async', promise };
  }

  if (type === 'oh.sync.listActivityMutes') {
    const ws = typeof message.workspaceId === 'string' ? message.workspaceId : null;
    if (!ws) return { kind: 'sync', response: { mutes: [] } };
    const promise = listMutedActivityEntities(ws)
      .then((mutes) => ({ mutes }))
      .catch((err: Error) => {
        logger.info('SyncRpc', `oh.sync.listActivityMutes failed: ${err.message}`);
        return { mutes: [] };
      });
    return { kind: 'async', promise };
  }

  if (type === 'oh.sync.muteActivityEntity') {
    const ws = typeof message.workspaceId === 'string' ? message.workspaceId : null;
    const entityType = typeof message.entityType === 'string' ? message.entityType : null;
    const entityId = typeof message.entityId === 'string' ? message.entityId : null;
    if (!ws || !entityType || !entityId) {
      // Caller passed a malformed payload; degrade to a no-op so the
      // bridge contract stays satisfied. The renderer hook treats the
      // returned entry as the new canonical state, so we synthesize a
      // placeholder that the cache will overwrite if/when a real mute
      // lands.
      return {
        kind: 'sync',
        response: { ok: true as const, entry: { workspaceId: '', entityType: '', entityId: '', mutedAt: 0 } },
      };
    }
    const promise = muteActivityEntity(ws, entityType, entityId)
      .then((entry) => ({ ok: true as const, entry }))
      .catch((err: Error) => {
        logger.info('SyncRpc', `oh.sync.muteActivityEntity failed: ${err.message}`);
        return {
          ok: true as const,
          entry: { workspaceId: ws, entityType, entityId, mutedAt: Date.now() },
        };
      });
    return { kind: 'async', promise };
  }

  if (type === 'oh.sync.revertActivity') {
    const result = dispatchRevertActivity(message);
    return { kind: 'async', promise: result };
  }

  if (type === 'oh.sync.getDataPresence') {
    try {
      const workspaces = collectLocalDataPresence({
        workspaces: listWorkspaces().map((ws) => ({ id: ws.id, name: ws.name })),
        getOracle: (workspaceId) => getOracleForWorkspace(workspaceId),
      });
      return { kind: 'sync', response: { workspaces } };
    } catch (err) {
      // The workspace store throws before bootstrap; downgrading to an
      // empty list lets the caller treat this host as empty and fall
      // through to the silent commit branch.
      logger.info('SyncRpc', `oh.sync.getDataPresence failed: ${(err as Error).message}`);
      return { kind: 'sync', response: { workspaces: [] } };
    }
  }

  if (type === 'oh.sync.applyCoexistImport') {
    const payload = message as unknown as { workspaces?: unknown };
    return { kind: 'async', promise: dispatchApplyCoexistImport(payload) };
  }

  if (type === 'oh.sync.executeCoexistToPeer') {
    return { kind: 'async', promise: dispatchExecuteCoexistToPeer() };
  }

  if (type === 'oh.sync.applyImport') {
    const payload = message as unknown as { workspaces?: unknown };
    return { kind: 'async', promise: dispatchApplyImport(payload) };
  }

  if (type === 'oh.sync.executeImportToPeer') {
    return { kind: 'async', promise: dispatchExecuteImportToPeer() };
  }

  if (type === 'oh.sync.executeDiscardWithBackup') {
    return { kind: 'async', promise: dispatchExecuteDiscardWithBackup() };
  }

  if (type === 'oh.sync.applyDiscardRestore') {
    return { kind: 'async', promise: dispatchApplyDiscardRestore(message) };
  }

  if (type === 'oh.sync.unmuteActivityEntity') {
    const ws = typeof message.workspaceId === 'string' ? message.workspaceId : null;
    const entityType = typeof message.entityType === 'string' ? message.entityType : null;
    const entityId = typeof message.entityId === 'string' ? message.entityId : null;
    if (!ws || !entityType || !entityId) return { kind: 'sync', response: { ok: true } };
    const promise = unmuteActivityEntity(ws, entityType, entityId)
      .then(() => ({ ok: true }) as const)
      .catch((err: Error) => {
        logger.info('SyncRpc', `oh.sync.unmuteActivityEntity failed: ${err.message}`);
        return { ok: true } as const;
      });
    return { kind: 'async', promise };
  }

  if (type === 'oh.awareness.publish') {
    const request = message as unknown as AwarenessPublishRequest;
    try {
      const response: AwarenessPublishResponse = publishAwareness(request);
      return { kind: 'sync', response };
    } catch (err) {
      logger.info('SyncRpc', `oh.awareness.publish rejected: ${(err as Error).message}`);
      // Match message-handler's defensive fallback: presence reads
      // are best-effort, so any throw degrades to an empty list rather
      // than tearing down the call chain.
      return { kind: 'sync', response: { ok: true, presence: [] as AwarenessState[] } };
    }
  }

  if (type === 'oh.awareness.snapshot') {
    return {
      kind: 'sync',
      response: {
        workspaceId: requireActiveWorkspaceId(),
        presence: snapshotAwarenessPresence(),
      },
    };
  }

  return null;
}

/**
 * Resolve an `oh.sync.revertActivity` request to a structured response.
 *
 * The renderer carries the {@link InverseEnvelopeContext} the F2
 * classifier embedded on the structural activity entry; this handler:
 *   1. validates the payload shape,
 *   2. resolves the workspace's oracle + a fresh `MutatorContext`,
 *   3. asks {@link generateInverseMutation} for an apply-ready batch
 *      or a structured refusal,
 *   4. routes the batch through {@link applySyncRequest} so it gets
 *      HLC-stamped + broadcast + persisted like any local mutation.
 *
 * The local emit is not in the wire-side seen set, so the revert itself
 * does not enter the activity feed — the user sees the entity update
 * back to its pre-inbound state without a phantom "you reverted X"
 * row appearing in the feed.
 */
async function dispatchRevertActivity(
  message: Record<string, unknown>,
): Promise<{ ok: true; mutationId: string } | { ok: false; reason: string }> {
  const ws = typeof message.workspaceId === 'string' ? message.workspaceId : null;
  const entityType = typeof message.entityType === 'string' ? message.entityType : null;
  const entityId = typeof message.entityId === 'string' ? message.entityId : null;
  const inverse = message.inverse as InverseEnvelopeContext | undefined;
  if (!ws || !entityType || !entityId || !inverse || typeof inverse !== 'object') {
    return { ok: false, reason: 'malformed-payload' };
  }

  const oracle = getOracleForWorkspace(ws);
  if (!oracle) return { ok: false, reason: 'no-oracle-for-workspace' };

  const ctx = nextSwMutatorContextForWorkspace(ws);
  if (!ctx) return { ok: false, reason: 'no-oracle-for-workspace' };

  const generated = generateInverseMutation({ entityType, entityId, inverse, oracle, ctx });
  if (!generated.ok) return { ok: false, reason: generated.reason };

  try {
    const response = await applySyncRequest({ type: 'oh.sync.apply', batch: generated.batch, sideEffects: [] });
    if (!response.ok) {
      const detail = response.failure?.detail ?? response.failure?.status ?? 'apply-failed';
      logger.info('SyncRpc', `oh.sync.revertActivity apply rejected: ${detail}`);
      return { ok: false, reason: detail };
    }
    return { ok: true, mutationId: generated.batch.mutations[0].mutationId };
  } catch (err) {
    const detail = (err as Error).message;
    logger.info('SyncRpc', `oh.sync.revertActivity apply threw: ${detail}`);
    return { ok: false, reason: detail };
  }
}

/**
 * Resolve an `oh.sync.applyCoexistImport` request — target-side of M3.
 *
 * The payload is opaque on the wire; this handler validates the
 * `workspaces` array shape, then defers to {@link applyCoexistPayload}.
 * The applier mints a fresh UUIDv7 per source workspace via
 * {@link createWorkspace}, retargets the wire-supplied snapshot at the
 * new id, and replays through {@link applyWorkspaceSnapshot} under the
 * per-workspace service.
 */
async function dispatchApplyCoexistImport(raw: { workspaces?: unknown }): Promise<CoexistResult> {
  const payload: CoexistPayload = {
    workspaces: Array.isArray(raw.workspaces)
      ? (raw.workspaces as CoexistPayload['workspaces'])
      : [],
  };

  return applyCoexistPayload(payload, {
    createWorkspace: async ({ name }) => {
      const ws = await createWorkspace({ name });
      return { id: ws.id, name: ws.name };
    },
    applySnapshot: async (snapshot) => {
      // Mirror background.ts's snapshot-apply dance: acquire the
      // per-workspace service, await hydration, replay through the same
      // mutator-context factory the cold-receiver bootstrap uses, then
      // release. The freshly-created workspace's oracle hasn't been
      // touched, so this is the first writer to its mutation log.
      const svc = getOrCreateWorkspaceService(snapshot.workspaceId);
      try {
        await svc.hydrated;
        return await applyWorkspaceSnapshot(snapshot, { makeContext: () => svc.context.next() });
      } finally {
        releaseWorkspaceService(snapshot.workspaceId);
      }
    },
  });
}

/**
 * Resolve an `oh.sync.executeCoexistToPeer` request — source-side of M3.
 *
 * Wires the local user-content workspaces into the host-installed peer
 * pusher (extension SW registers one over `wsRequest`; desktop main
 * doesn't yet). The orchestrator handles all the routing — this thin
 * shim just injects the production collection seams.
 */
async function dispatchExecuteCoexistToPeer(): Promise<CoexistResult> {
  return orchestrateCoexistToPeer({
    workspaces: listWorkspaces().map((ws) => ({ id: ws.id, name: ws.name })),
    getOracle: (workspaceId) => getOracleForWorkspace(workspaceId),
    buildSnapshot: (workspaceId) => buildSnapshotForWorkspace(workspaceId),
  });
}

/**
 * Resolve an `oh.sync.applyImport` request — target-side of M4.
 *
 * Replays the wire payload into the EXISTING target workspaces with
 * matching ids; per-leaf HLC compare (§11.7) decides field-by-field
 * winners. Source workspaces whose id doesn't already exist on this
 * host are reported as `ignored` and skipped (v1 — no rename, no
 * Coexist fallthrough). The pre-apply id-intersection is computed under
 * the target's already-hydrated oracle so the conflict count reflects
 * the user's view at confirmation time, not the post-merge union.
 */
async function dispatchApplyImport(raw: { workspaces?: unknown }): Promise<ImportResult> {
  const payload: ImportPayload = {
    workspaces: Array.isArray(raw.workspaces)
      ? (raw.workspaces as ImportPayload['workspaces'])
      : [],
  };

  return applyImportPayload(payload, {
    lookupWorkspace: (workspaceId) => {
      const ws = getWorkspace(workspaceId);
      return ws ? { id: ws.id, name: ws.name } : null;
    },
    listEntityIds: (workspaceId) => {
      const oracle = getOracleForWorkspace(workspaceId);
      if (!oracle) return [];
      // Project the full materialized view down to `(type, id)` so the
      // applier's conflict-diff doesn't pay the cost of carrying field
      // bodies it never inspects. The oracle returns one row per live
      // entity; the applier filters to user-content types.
      return oracle.materializeAll().map((ent) => ({ type: ent.type, id: ent.id }));
    },
    applySnapshot: async (snapshot) => {
      // Same per-workspace service dance as the cold-receiver bootstrap
      // and Coexist's applier — acquire the EXISTING service for this
      // workspace, await hydration, replay through the same mutator-
      // context factory. Unlike Coexist this workspace already has a
      // mutation log; the seed batches HLC-merge against it.
      const svc = getOrCreateWorkspaceService(snapshot.workspaceId);
      try {
        await svc.hydrated;
        return await applyWorkspaceSnapshot(snapshot, { makeContext: () => svc.context.next() });
      } finally {
        releaseWorkspaceService(snapshot.workspaceId);
      }
    },
  });
}

/**
 * Resolve an `oh.sync.executeImportToPeer` request — source-side of M4.
 *
 * Symmetric mirror of {@link dispatchExecuteCoexistToPeer}; the
 * orchestrator owns the no-pusher / no-source / push-failure routing.
 * Only the channel differs (and via that, the registered pusher).
 */
async function dispatchExecuteImportToPeer(): Promise<ImportResult> {
  return orchestrateImportToPeer({
    workspaces: listWorkspaces().map((ws) => ({ id: ws.id, name: ws.name })),
    getOracle: (workspaceId) => getOracleForWorkspace(workspaceId),
    buildSnapshot: (workspaceId) => buildSnapshotForWorkspace(workspaceId),
  });
}

/**
 * Resolve an `oh.sync.executeDiscardWithBackup` request — local-only,
 * source-side of M5.
 *
 * No payload crosses the wire. The orchestrator runs the
 * collect → write-archive → delete-workspaces sequence under the host-
 * installed {@link BackupWriter}; this shim just injects the production
 * deps (workspace list, snapshot builder, delete path, clock). The
 * orchestrator owns all routing — backup-writer-unavailable, no-source-
 * data, backup-failed, delete-failed.
 */
async function dispatchExecuteDiscardWithBackup(): Promise<DiscardResult> {
  return orchestrateDiscardWithBackup({
    workspaces: listWorkspaces().map((ws) => ({ id: ws.id, name: ws.name })),
    buildSnapshot: (workspaceId) => buildSnapshotForWorkspace(workspaceId),
    deleteWorkspace: (workspaceId) => deleteWorkspace(workspaceId),
    now: () => new Date().toISOString(),
  });
}

/**
 * Resolve an `oh.sync.applyDiscardRestore` request — local-only,
 * source-side of M6.
 *
 * The renderer ships the parsed archive verbatim. This dispatcher
 * validates the shape (a hand-edited or unrelated JSON file would
 * otherwise tear down the applier mid-mint), then defers to
 * {@link applyDiscardRestoreArchive} with production deps: mint via
 * {@link createWorkspace}, replay via the per-workspace service +
 * {@link applyWorkspaceSnapshot} pair Coexist already uses.
 */
async function dispatchApplyDiscardRestore(raw: Record<string, unknown>): Promise<RestoreResult> {
  if (!isDiscardBackupArchiveShape(raw)) {
    return {
      ok: false,
      reason: 'invalid-archive',
      detail: 'archive failed shape validation',
    };
  }
  const archive: DiscardBackupArchive = raw;

  return applyDiscardRestoreArchive(archive, {
    createWorkspace: async ({ name }) => {
      const ws = await createWorkspace({ name });
      return { id: ws.id, name: ws.name };
    },
    applySnapshot: async (snapshot) => {
      // Same per-workspace service dance as Coexist's applier: the
      // freshly-minted workspace hasn't been touched, so this is the
      // first writer to its mutation log.
      const svc = getOrCreateWorkspaceService(snapshot.workspaceId);
      try {
        await svc.hydrated;
        return await applyWorkspaceSnapshot(snapshot, { makeContext: () => svc.context.next() });
      } finally {
        releaseWorkspaceService(snapshot.workspaceId);
      }
    },
  });
}
