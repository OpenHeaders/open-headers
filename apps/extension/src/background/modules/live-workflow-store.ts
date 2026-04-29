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
import type {
  MutationBatch,
  MutatorContext,
  SideEffectIntent,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import { extensionStorage, wsKeys } from '@/shared/storage';
import {
  buildAddLiveWorkflowBatch,
  buildDeleteLiveWorkflowBatch,
  buildUpdateLiveWorkflowBatch,
} from '@/shared/sync/live-workflow-mutations';
import { getActiveLiveWorkflowCache } from '../sync/live-workflow-cache';
import { getOracleForCurrentWorkspace, nextSwMutatorContext } from '../sync/service';
import { driftRecorder } from './storage-drift';
import { getActiveWorkspaceId } from './workspace-store';

// ── In-memory state (scoped to the active workspace) ───────────────

let workflows: V5.LiveWorkflow[] = [];
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

export function getLiveWorkflows(): V5.LiveWorkflow[] {
  return workflows;
}

export function getLiveWorkflow(uid: string): V5.LiveWorkflow | null {
  return workflows.find((w) => w.uid === uid) ?? null;
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
const DEFAULT_REFRESH: V5.RefreshPolicy = { kind: 'manual' };

export interface CreateLiveWorkflowInput {
  name: string;
  description?: string;
  steps?: V5.WorkflowStep[];
  refresh?: V5.RefreshPolicy;
  enabled?: boolean;
}

export async function createLiveWorkflow(
  input: CreateLiveWorkflowInput,
): Promise<V5.LiveWorkflow> {
  assertLoaded();
  const uid = generateUid();
  const folderName = toFolderName(input.name, uid);
  const created: V5.LiveWorkflow = {
    schemaVersion: 5,
    uid,
    path: `live-workflows/${folderName}`,
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    steps: input.steps ?? [],
    refresh: input.refresh ?? DEFAULT_REFRESH,
    enabled: input.enabled ?? true,
  };
  await applyLiveWorkflowMutationOrThrow(
    (ctx) => buildAddLiveWorkflowBatch(created, ctx),
    'createLiveWorkflow',
  );
  return created;
}

export type LiveWorkflowWriteResult =
  | { ok: true; workflow: V5.LiveWorkflow }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message: string };

export async function updateLiveWorkflow(
  uid: string,
  updates: Partial<Omit<V5.LiveWorkflow, 'uid' | 'path' | 'schemaVersion'>>,
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
  return { ok: true, workflow: { ...existing, ...updates } as V5.LiveWorkflow };
}

export async function deleteLiveWorkflow(uid: string): Promise<boolean> {
  assertLoaded();
  if (!workflows.some((w) => w.uid === uid)) return false;
  await applyLiveWorkflowMutationOrThrow(
    (ctx) => buildDeleteLiveWorkflowBatch(uid, ctx),
    'deleteLiveWorkflow',
  );
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

async function readSnapshot(workspaceId: string): Promise<V5.LiveWorkflow[]> {
  return extensionStorage.getValidatedArray(wsKeys(workspaceId).liveWorkflows, LiveWorkflowSchema, {
    onError: driftRecorder({
      subsystem: 'live',
      storageKey: wsKeys(workspaceId).liveWorkflows.key,
      workspaceId,
    }),
  });
}

export async function hydrateFromStorage(): Promise<V5.LiveWorkflow[]> {
  const workspaceId = getActiveWorkspaceId();
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
  await extensionStorage.remove(wsKeys(workspaceId).liveWorkflows);
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
  const cache = getActiveLiveWorkflowCache();
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
