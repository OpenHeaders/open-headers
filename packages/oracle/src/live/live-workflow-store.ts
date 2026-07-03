/**
 * Live Workflow Store — SW-side source of truth for the workflow
 * definitions that power `{{live.X}}` refresh (see
 * `docs/LIVE_VARIABLES_PLAN.md`).
 *
 * Writes route through the sync oracle (catalog factory →
 * MutationBatch → `oracle.apply`); the {@link LiveWorkflowCache} owns
 * `chrome.storage.local` persistence + drives the local mirror via
 * broadcast-driven re-projection.
 *
 * The store does NOT cascade-delete Live Variables when a workflow is
 * removed. Orphaned LVs surface `workflow-not-found` resolution errors
 * at resolve time so the user sees the broken binding and can rebind
 * the LV rather than silently losing the namespace entry.
 *
 * Storage:
 *   - definitions: `oh.ws.<id>.liveWorkflows` (cache-owned)
 *   (cache lives at `oh.ws.<id>.liveCache` — see `live-cache-store.ts`)
 */

import { LiveWorkflowSchema } from '@openheaders/core/schemas';
import type { MutationBatch, MutatorContext, SideEffectIntent } from '@openheaders/core/sync';
import type { LiveWorkflow, RefreshPolicy, WorkflowStep } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { logger } from '@openheaders/core/utils';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import {
  buildAddLiveWorkflowBatch,
  buildDeleteLiveWorkflowBatch,
  buildUpdateLiveWorkflowBatch,
} from '@openheaders/core/sync-builders/mutations/live-workflow-mutations';
import { LIVE_WORKFLOW_REGISTRATION } from '@openheaders/oracle/sync/entity-registry';
import type { LiveWorkflowCache } from '@openheaders/oracle/sync/caches/live-workflow-cache';
import {
  getActiveCacheForRegistration,
  getCacheForWorkspace,
  getOracleForCurrentWorkspace,
  nextSwMutatorContext,
} from '@openheaders/oracle/sync/service';
import { driftRecorder } from '@openheaders/oracle/sync/storage-drift';
import { requireActiveWorkspaceId } from '@openheaders/oracle/sync';

// ── In-memory state (scoped to the active workspace) ───────────────

let workflows: LiveWorkflow[] = [];
let loadedWorkspaceId: string | null = null;

// ── Change listeners ────────────────────────────────────────────────

type ChangeListener = () => void;
const changeListeners: Set<ChangeListener> = new Set();

export function onLiveWorkflowStoreChange(listener: ChangeListener): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function notifyChange(): void {
  for (const listener of changeListeners) listener();
}

// ── Reads ────────────────────────────────────────────────────────────

export function getLiveWorkflows(): LiveWorkflow[] {
  return workflows;
}

export function getLiveWorkflow(uid: string): LiveWorkflow | null {
  return workflows.find((w) => w.uid === uid) ?? null;
}

/**
 * Read a workflow scoped to an explicit workspace. Routes through the
 * per-workspace {@link LiveWorkflowCache} so non-Active workspaces (e.g.
 * a per-tab MWPT-FULL editing-scope) resolve their own definitions
 * rather than the runtime-Active workspace's. Returns null when no
 * service is materialized for the workspace OR no workflow with that
 * uid exists in it.
 */
export function getLiveWorkflowInWorkspace(uid: string, workspaceId: string): LiveWorkflow | null {
  const cache = getCacheForWorkspace<LiveWorkflowCache>(LIVE_WORKFLOW_REGISTRATION, workspaceId);
  if (!cache) return null;
  return cache.getLiveWorkflows().find((w) => w.uid === uid) ?? null;
}

/**
 * Snapshot every workflow in an explicit workspace via its
 * {@link LiveWorkflowCache}. Returns `[]` when no service is
 * materialized for the workspace. Callers (live-refresh scheduler,
 * chain adapter, dependency-graph resolver) use this when their
 * dispatch is keyed by an explicit workspaceId rather than the
 * runtime-Active one.
 */
export function getLiveWorkflowsForWorkspace(workspaceId: string): LiveWorkflow[] {
  const cache = getCacheForWorkspace<LiveWorkflowCache>(LIVE_WORKFLOW_REGISTRATION, workspaceId);
  return cache ? cache.getLiveWorkflows() : [];
}

// ── Writes ──────────────────────────────────────────────────────────

function assertLoaded(): string {
  if (!loadedWorkspaceId) {
    throw new Error('LiveWorkflowStore: mutation before hydration');
  }
  return loadedWorkspaceId;
}

/**
 * Default refresh policy for a brand-new workflow — manual-only until
 * the user picks a cadence.
 */
const DEFAULT_REFRESH: RefreshPolicy = { kind: 'manual' };

export interface CreateLiveWorkflowInput {
  name: string;
  description?: string;
  steps?: WorkflowStep[];
  refresh?: RefreshPolicy;
  enabled?: boolean;
}

export async function createLiveWorkflow(input: CreateLiveWorkflowInput): Promise<LiveWorkflow> {
  assertLoaded();
  const uid = generateUid();
  const folderName = toFolderName(input.name, uid);
  const created: LiveWorkflow = {
    schemaVersion: 5,
    uid,
    path: `live-workflows/${folderName}`,
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    steps: input.steps ?? [],
    refresh: input.refresh ?? DEFAULT_REFRESH,
    enabled: input.enabled ?? true,
  };
  await applyLiveWorkflowMutationOrThrow((ctx) => buildAddLiveWorkflowBatch(created, ctx), 'createLiveWorkflow');
  return created;
}

export type LiveWorkflowWriteResult =
  | { ok: true; workflow: LiveWorkflow }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message: string };

export async function updateLiveWorkflow(
  uid: string,
  updates: Partial<Omit<LiveWorkflow, 'uid' | 'path' | 'schemaVersion'>>,
): Promise<LiveWorkflowWriteResult> {
  assertLoaded();
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    return { ok: false, reason: 'other', message: 'sync service not initialized' };
  }
  const existing = workflows.find((w) => w.uid === uid);
  if (!existing) return { ok: false, reason: 'not-found' };

  const payload = buildUpdateLiveWorkflowBatch(uid, updates, ctx);
  if (payload.batch.mutations.length === 0) {
    return { ok: true, workflow: existing };
  }
  const result = await oracle.apply(payload.batch, payload.sideEffects);
  if (!result.ok) {
    return {
      ok: false,
      reason: 'other',
      message: result.failure?.detail ?? 'oracle rejected live-workflow batch',
    };
  }
  return { ok: true, workflow: { ...existing, ...updates } as LiveWorkflow };
}

export async function deleteLiveWorkflow(uid: string): Promise<boolean> {
  assertLoaded();
  if (!workflows.some((w) => w.uid === uid)) return false;
  await applyLiveWorkflowMutationOrThrow((ctx) => buildDeleteLiveWorkflowBatch(uid, ctx), 'deleteLiveWorkflow');
  return true;
}

// ── Sync engine plumbing ────────────────────────────────────────────

async function applyLiveWorkflowMutationOrThrow(
  factory: (ctx: MutatorContext) => { batch: MutationBatch; sideEffects: SideEffectIntent[] },
  op: string,
): Promise<void> {
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    throw new Error(`LiveWorkflowStore.${op}: sync service not initialized`);
  }
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  const result = await oracle.apply(batch, sideEffects);
  if (!result.ok) {
    throw new Error(
      `LiveWorkflowStore.${op}: oracle rejected batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}

// ── Hydration / workspace switch ────────────────────────────────────

async function readSnapshot(workspaceId: string): Promise<LiveWorkflow[]> {
  return hostStorage.getValidatedArray(wsKeys(workspaceId).liveWorkflows, LiveWorkflowSchema, {
    onError: driftRecorder({
      subsystem: 'live',
      storageKey: wsKeys(workspaceId).liveWorkflows.key,
      workspaceId,
    }),
  });
}

export async function hydrateFromStorage(): Promise<LiveWorkflow[]> {
  const workspaceId = requireActiveWorkspaceId();
  workflows = await readSnapshot(workspaceId);
  loadedWorkspaceId = workspaceId;
  logger.info('LiveWorkflowStore', `Hydrated ws=${workspaceId}: ${workflows.length} workflows`);
  return workflows;
}

export async function switchToWorkspace(workspaceId: string): Promise<void> {
  if (loadedWorkspaceId === workspaceId) return;
  workflows = await readSnapshot(workspaceId);
  loadedWorkspaceId = workspaceId;
  logger.info('LiveWorkflowStore', `Switched to ws=${workspaceId}: ${workflows.length} workflows`);
  notifyChange();
}

// ── Purge (workspace delete) ────────────────────────────────────────

export async function purgeLiveWorkflowsForWorkspace(workspaceId: string): Promise<void> {
  await hostStorage.remove(wsKeys(workspaceId).liveWorkflows);
  logger.info('LiveWorkflowStore', `Purged workflows for workspace ${workspaceId}`);
}

// ── Sync engine bridge ──────────────────────────────────────────────

let cacheUnsubscribe: (() => void) | null = null;

/**
 * Wire the local `workflows` array to the active workspace's
 * {@link LiveWorkflowCache}. Idempotent — the prior subscription is
 * dropped first. Call BEFORE {@link bridgeLiveVariableSyncEngine} so
 * parent (workflow) state is already in the oracle when bound LVs
 * seed.
 */
export async function bridgeLiveWorkflowSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<LiveWorkflowCache>(LIVE_WORKFLOW_REGISTRATION);
  if (!cache) return;
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
  cacheUnsubscribe = cache.onChange(() => {
    workflows = cache.getLiveWorkflows();
    notifyChange();
  });
  await cache.seedFromPersistedLiveWorkflows(workflows);
  workflows = cache.getLiveWorkflows();
}

// ── Test helpers ────────────────────────────────────────────────────

export function __resetForTests(): void {
  workflows = [];
  loadedWorkspaceId = null;
  changeListeners.clear();
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
}
