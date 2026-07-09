/**
 * Host-neutral RPC dispatcher for the sync + awareness wire channels.
 *
 * Covers the sync + awareness channels that every host must expose to
 * its renderer for the per-workspace mirror plane to function:
 *
 *   - `oh.sync.apply`                       — write path
 *   - `oh.sync.snapshot*` (per entity type) — per-workspace mirror seed
 *   - `oh.sync.snapshotExtensionWorkspaces` — global-scope mirror seed
 *   - `oh.awareness.publish`                — presence write
 *   - `oh.awareness.snapshot`               — presence seed
 *
 * Everything is read from the oracle's already-host-neutral exports —
 * this module owns no state, no chrome.* coupling, and no host-specific
 * transport. The extension's `runtime.onMessage` listener and the
 * desktop main's `ipcMain.handle` both delegate these types here, then
 * route their host-specific RPCs (chrome.tabs, chrome.identity, etc.)
 * in their own dispatchers.
 *
 * Return contract:
 *   - `{ kind: 'sync', response }`   — caller resolves synchronously
 *   - `{ kind: 'async', promise }`   — caller awaits + responds
 *   - `null`                          — message type is not a
 *                                       sync/awareness channel this
 *                                       dispatcher owns; caller
 *                                       continues its own dispatcher chain
 */

import { type Capability, emitAuditEntry, getIdentitySnapshot, hasCapability } from '@openheaders/core/identity';
import type {
  AwarenessPublishRequest,
  AwarenessPublishResponse,
  AwarenessState,
  SyncApplyRequest,
  SyncApplyResponse,
  SyncMutationBatchMessage,
  SyncMutationMessage,
} from '@openheaders/core/protocol';
import {
  SYNC_AWARENESS_PRESENCE_TYPE,
  SYNC_MUTATION_BATCH_TYPE,
  SYNC_MUTATION_TYPE,
  type SyncAwarenessPresenceMessage,
} from '@openheaders/core/protocol';
import type { InverseEnvelopeContext } from '@openheaders/core/sync';
import { resolveWorkspaceOrgId } from '@openheaders/core/sync';
import { logger } from '@openheaders/core/utils';
import { peekActiveWorkspaceId, requireActiveWorkspaceId } from '../sync';
import { listMutedActivityEntities, muteActivityEntity, unmuteActivityEntity } from '../sync/activity/activity-mute-cache';
import { generateInverseMutation } from '../sync/activity/activity-revert';
import { applyInboundAwarenessFrame } from '../sync/awareness/awareness-inbound';
import { snapshotExtensionWorkspacePostStates } from '../sync/global-service';
import { applyInboundMutationBatch, applyInboundMutationEnvelope } from '../sync/mutation-stream-bridge';
import {
  applySyncRequest,
  getAwarenessStoreForWorkspace,
  getOracleForWorkspace,
  nextSwMutatorContextForWorkspace,
  publishAwareness,
  snapshotAwarenessPresence,
  snapshotCollectionPostStates,
  snapshotEnvironmentPostStates,
  snapshotFilesPostStates,
  snapshotFolderPostStates,
  snapshotLayoutStatePostStates,
  snapshotLiveFallbackPriorityPostStates,
  snapshotLiveVariablePostStates,
  snapshotLiveWorkflowPostStates,
  snapshotOAuthBundlePostStates,
  snapshotPauseMarkersPostStates,
  snapshotRequestCollectionPostStates,
  snapshotRequestFolderPostStates,
  snapshotRequestPostStates,
  snapshotResponseExamplePostStates,
  snapshotRulePostStates,
  snapshotScriptPackagePostStates,
  snapshotTemplateCollectionPostStates,
  snapshotTemplateFolderPostStates,
  snapshotTemplatePostStates,
  snapshotVaultPostStates,
  snapshotWorkspaceVariablesPostStates,
} from '../sync/service';
import { getSyncPersistenceProvider } from '../sync/sync-persistence-provider';

export type SyncRpcResult = { kind: 'sync'; response: unknown } | { kind: 'async'; promise: Promise<unknown> };

/**
 * Surfaced when the host-neutral resolver denies a privileged RPC. The
 * outer message-handler / ipcMain caller catches this and surfaces a
 * uniform error to the renderer (rather than the dispatcher fabricating
 * a per-type permission-denied response shape).
 */
export class PermissionDeniedError extends Error {
  readonly capability: string;
  readonly reason: string;
  readonly workspaceId?: string;

  constructor(capability: string, reason: string, workspaceId?: string) {
    const where = workspaceId ? ` on ${workspaceId}` : '';
    super(`permission denied: ${capability}${where} (${reason})`);
    this.name = 'PermissionDeniedError';
    this.capability = capability;
    this.reason = reason;
    if (workspaceId !== undefined) this.workspaceId = workspaceId;
  }
}

/**
 * Renderer→SW capability gate (UNIFIED_ORACLE_MODEL.md §5.8).
 *
 * Every renderer-originated message type in the table below maps to a
 * capability + a workspaceId extractor. `gateDispatch` consults
 * {@link getIdentitySnapshot} via {@link hasCapability}, emits an audit
 * entry on every decision (allow or deny), and throws
 * {@link PermissionDeniedError} on deny so the outer message-handler /
 * `ipcMain.handle` surfaces a uniform error frame.
 *
 * Peer-driven entry points (`SYNC_MUTATION_TYPE`, `SYNC_MUTATION_BATCH_TYPE`,
 * `SYNC_AWARENESS_PRESENCE_TYPE`) deliberately skip this gate — those ride
 * the SW→peer handshake gate + per-envelope mutation forwarder gate
 * (U2.3, sync-mutation-forwarder.ts + sync-mutation-receiver.ts).
 */
interface GateRule {
  readonly capability: Capability;
  /**
   * Resolve the workspaceId to gate against. Return `null` for
   * workspace-id-less capabilities (`workspace.list`, `daemon.admin`).
   * Return `undefined` to skip the check (handler will degrade
   * gracefully — e.g. snapshot reads with no workspaceId and no active
   * workspace return an empty list).
   */
  readonly resolveWorkspaceId: (message: Record<string, unknown>) => string | null | undefined;
}

const WORKSPACE_ID_FROM_MESSAGE: GateRule['resolveWorkspaceId'] = (msg) => {
  const ws = msg.workspaceId;
  if (typeof ws === 'string' && ws.length > 0) return ws;
  return peekActiveWorkspaceId() ?? undefined;
};

const APPLY_WORKSPACE_ID: GateRule['resolveWorkspaceId'] = (msg) => {
  const request = msg as unknown as SyncApplyRequest;
  return request.batch?.mutations?.[0]?.workspaceId;
};

const NO_WORKSPACE: GateRule['resolveWorkspaceId'] = () => null;

const GATE_RULES: ReadonlyMap<string, GateRule> = new Map<string, GateRule>([
  // Canonical write entry point.
  ['oh.sync.apply', { capability: 'workspace.write', resolveWorkspaceId: APPLY_WORKSPACE_ID }],

  // Per-workspace snapshot reads (the 20 entity types).
  ...(
    [
      'oh.sync.snapshotRules',
      'oh.sync.snapshotEnvironments',
      'oh.sync.snapshotCollections',
      'oh.sync.snapshotWorkspaceVariables',
      'oh.sync.snapshotVault',
      'oh.sync.snapshotFolders',
      'oh.sync.snapshotRequests',
      'oh.sync.snapshotRequestCollections',
      'oh.sync.snapshotRequestFolders',
      'oh.sync.snapshotTemplates',
      'oh.sync.snapshotTemplateCollections',
      'oh.sync.snapshotTemplateFolders',
      'oh.sync.snapshotLiveVariables',
      'oh.sync.snapshotLiveWorkflows',
      'oh.sync.snapshotScriptPackages',
      'oh.sync.snapshotResponseExamples',
      'oh.sync.snapshotOAuthBundle',
      'oh.sync.snapshotPauseMarkers',
      'oh.sync.snapshotLayoutState',
      'oh.sync.snapshotFallbackPriority',
      'oh.sync.snapshotFiles',
    ] as const
  ).map((t) => [t, { capability: 'workspace.read', resolveWorkspaceId: WORKSPACE_ID_FROM_MESSAGE }] as const),

  // Workspace metadata list — "which workspaces exist on this host".
  // Allow for any installed snapshot; per-workspace visibility enforced
  // downstream via `workspace.read` on each snapshot read.
  ['oh.sync.snapshotExtensionWorkspaces', { capability: 'workspace.list', resolveWorkspaceId: NO_WORKSPACE }],

  // Activity-log reads + writes (per-workspace).
  ['oh.sync.listActivity', { capability: 'workspace.read', resolveWorkspaceId: WORKSPACE_ID_FROM_MESSAGE }],
  ['oh.sync.listActivityMutes', { capability: 'workspace.read', resolveWorkspaceId: WORKSPACE_ID_FROM_MESSAGE }],
  ['oh.sync.markActivityRead', { capability: 'workspace.write', resolveWorkspaceId: WORKSPACE_ID_FROM_MESSAGE }],
  ['oh.sync.muteActivityEntity', { capability: 'workspace.write', resolveWorkspaceId: WORKSPACE_ID_FROM_MESSAGE }],
  ['oh.sync.unmuteActivityEntity', { capability: 'workspace.write', resolveWorkspaceId: WORKSPACE_ID_FROM_MESSAGE }],
  ['oh.sync.revertActivity', { capability: 'workspace.write', resolveWorkspaceId: WORKSPACE_ID_FROM_MESSAGE }],

  // Awareness — presence-plane reads. Bounded; `workspace.read` suffices
  // since presence carries no privileged content.
  ['oh.awareness.publish', { capability: 'workspace.read', resolveWorkspaceId: WORKSPACE_ID_FROM_MESSAGE }],
  ['oh.awareness.snapshot', { capability: 'workspace.read', resolveWorkspaceId: WORKSPACE_ID_FROM_MESSAGE }],
]);

function gateDispatch(message: Record<string, unknown>): void {
  const type = message.type;
  if (typeof type !== 'string') return;
  const rule = GATE_RULES.get(type);
  if (!rule) return;

  const workspaceId = rule.resolveWorkspaceId(message);
  if (workspaceId === undefined) {
    // No workspace context resolvable; handler will degrade (empty
    // list / no-op / throw on its own require). Skip the gate rather
    // than synthesize a deny that doesn't reflect a real privilege
    // decision.
    return;
  }

  const snapshot = getIdentitySnapshot();
  const ctx = workspaceId === null ? {} : { workspaceId };
  const decision = hasCapability(snapshot, rule.capability, ctx);
  emitAuditEntry({
    actorUserId: snapshot?.user.id ?? 'unknown',
    capability: rule.capability,
    ...(workspaceId ? { workspaceId } : {}),
    decision,
  });
  if (!decision.allow) {
    throw new PermissionDeniedError(rule.capability, decision.reason ?? 'denied', workspaceId ?? undefined);
  }
}

/**
 * Re-stamp `orgId` on a renderer-originated `oh.sync.apply` batch from
 * the host's authoritative workspace→Org resolver (UNIFIED_ORACLE_MODEL.md
 * §6.1 / §8.2).
 *
 * The renderer mints envelopes through `createRendererContextHandle`,
 * which reads `resolveWorkspaceOrgId` — but the workspace→Org resolver is
 * installed only in the SW / desktop main, never in a renderer realm. A
 * renderer mint therefore always stamps the `pre-bootstrap` sentinel,
 * which no authorized Org set contains, so every renderer-originated
 * envelope would be dropped at the transport org filter. `orgId` is a
 * denormalized routing field the host owns; stamping the authoritative
 * value here — before the batch is ever persisted or forwarded —
 * completes the mint rather than rewriting history.
 *
 * Only `oh.sync.apply` (renderer→host) reaches this path. Peer-inbound
 * envelopes ride {@link applyInboundMutationBatch}, so their historical
 * Org context is left untouched.
 */
export function restampApplyOrgIds(request: SyncApplyRequest): SyncApplyRequest {
  if (request.batch.mutations.length === 0) return request;
  return {
    ...request,
    batch: {
      ...request.batch,
      mutations: request.batch.mutations.map((env) => ({
        ...env,
        orgId: resolveWorkspaceOrgId(env.workspaceId),
      })),
    },
  };
}

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
  'oh.sync.snapshotScriptPackages': (ws) => ({ entries: snapshotScriptPackagePostStates(ws) }),
  'oh.sync.snapshotResponseExamples': (ws) => ({ entries: snapshotResponseExamplePostStates(ws) }),
  'oh.sync.snapshotLiveWorkflows': (ws) => ({ entries: snapshotLiveWorkflowPostStates(ws) }),
  'oh.sync.snapshotOAuthBundle': (ws) => ({ entries: snapshotOAuthBundlePostStates(ws) }),
  'oh.sync.snapshotPauseMarkers': (ws) => ({ entries: snapshotPauseMarkersPostStates(ws) }),
  'oh.sync.snapshotLayoutState': (ws) => ({ entries: snapshotLayoutStatePostStates(ws) }),
  'oh.sync.snapshotFallbackPriority': (ws) => ({ entries: snapshotLiveFallbackPriorityPostStates(ws) }),
  'oh.sync.snapshotFiles': (ws) => ({ entries: snapshotFilesPostStates(ws) }),
};

/**
 * Dispatch a sync/awareness message. Returns `null` when `message.type`
 * is not a channel this dispatcher owns; the caller routes those onward
 * through its host-specific message chain.
 */
export function dispatchSyncRpc(message: Record<string, unknown>): SyncRpcResult | null {
  const type = message.type;
  if (typeof type !== 'string') return null;

  gateDispatch(message);

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

  if (type === SYNC_AWARENESS_PRESENCE_TYPE) {
    const msg = message as unknown as SyncAwarenessPresenceMessage;
    applyInboundAwarenessFrame(msg, { resolveStore: getAwarenessStoreForWorkspace });
    return { kind: 'sync', response: { ok: true } };
  }

  if (type === 'oh.sync.apply') {
    const request = restampApplyOrgIds(message as unknown as SyncApplyRequest);
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
