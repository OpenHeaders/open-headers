/**
 * Live Variable Store — SW-side source of truth for `{{live.<name>}}`
 * bindings (see `docs/LIVE_VARIABLES_PLAN.md`).
 *
 * A LiveVariable is a thin projection — a `(name, workflowUid, stepId,
 * captureName)` quad that exposes one workflow-step capture as a
 * workspace-wide namespace key. This store owns the definitions and
 * the manual-override state; extraction logic + the refresh schedule
 * live on the backing workflow (`live-workflow-store.ts`), and the
 * cached values live in `live-cache-store.ts`.
 *
 * Writes route through the sync oracle (catalog factory →
 * MutationBatch → `oracle.apply`); the {@link LiveVariableCache} owns
 * `chrome.storage.local` persistence + drives the local mirror via
 * broadcast-driven re-projection. Reads stay synchronous off the local
 * mirror.
 *
 * Deleting a workflow does NOT cascade into LV deletion — orphaned
 * LVs surface `workflow-not-found` resolution errors at resolve time
 * so the user sees the broken binding and can rebind rather than
 * silently losing the namespace entry.
 *
 * Storage: `oh.ws.<id>.liveVariables` (cache-owned).
 */

import { LiveVariableSchema } from '@openheaders/core/schemas';
import type { MutationBatch, MutatorContext, SideEffectIntent } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import { extensionStorage, wsKeys } from '@/shared/storage';
import {
  buildAddLiveVariableBatch,
  buildDeleteLiveVariableBatch,
  buildUpdateLiveVariableBatch,
} from '@/shared/sync/live-variable-mutations';
import { LIVE_VARIABLE_REGISTRATION } from '../sync/entity-registry';
import type { LiveVariableCache } from '../sync/live-variable-cache';
import { getActiveCacheForRegistration, getOracleForCurrentWorkspace, nextSwMutatorContext } from '../sync/service';
import { driftRecorder } from './storage-drift';
import { getActiveWorkspaceId } from './workspace-store';

// ── In-memory state (scoped to the active workspace) ───────────────

let variables: V5.LiveVariable[] = [];
let loadedWorkspaceId: string | null = null;

// ── Change listeners ────────────────────────────────────────────────

type ChangeListener = () => void;
const changeListeners: Set<ChangeListener> = new Set();

export function onLiveVariableStoreChange(listener: ChangeListener): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function notifyChange(): void {
  for (const listener of changeListeners) listener();
}

// ── Reads ────────────────────────────────────────────────────────────

export function getLiveVariables(): V5.LiveVariable[] {
  return variables;
}

export function getLiveVariable(uid: string): V5.LiveVariable | null {
  return variables.find((v) => v.uid === uid) ?? null;
}

export function getLiveVariableByName(name: string): V5.LiveVariable | null {
  return variables.find((v) => v.name === name) ?? null;
}

export function getLiveVariablesForWorkflow(workflowUid: string): V5.LiveVariable[] {
  return variables.filter((v) => v.workflowUid === workflowUid);
}

// ── Writes ──────────────────────────────────────────────────────────

function assertLoaded(): string {
  if (!loadedWorkspaceId) {
    throw new Error('LiveVariableStore: mutation before hydration');
  }
  return loadedWorkspaceId;
}

export interface CreateLiveVariableInput {
  name: string;
  workflowUid: string;
  stepId: string;
  captureName: string;
  description?: string;
  requireFreshOnRuleBuild?: boolean;
  enabled?: boolean;
}

export async function createLiveVariable(input: CreateLiveVariableInput): Promise<V5.LiveVariable> {
  assertLoaded();
  const uid = generateUid();
  const folderName = toFolderName(input.name, uid);
  const created: V5.LiveVariable = {
    schemaVersion: 5,
    uid,
    path: `live-variables/${folderName}`,
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    workflowUid: input.workflowUid,
    stepId: input.stepId,
    captureName: input.captureName,
    ...(input.requireFreshOnRuleBuild ? { requireFreshOnRuleBuild: true } : {}),
    enabled: input.enabled ?? true,
  };
  await applyLiveVariableMutationOrThrow((ctx) => buildAddLiveVariableBatch(created, ctx), 'createLiveVariable');
  return created;
}

/**
 * Outcome of a live-variable write. The legacy stale-draft branch is
 * retired in Phase B — convergence is per-(field) LWW at the oracle,
 * not a versioned compare-and-set.
 */
export type LiveVariableWriteResult =
  | { ok: true; variable: V5.LiveVariable }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message: string };

export async function updateLiveVariable(
  uid: string,
  updates: Partial<Omit<V5.LiveVariable, 'uid' | 'path' | 'schemaVersion'>>,
): Promise<LiveVariableWriteResult> {
  assertLoaded();
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    return { ok: false, reason: 'other', message: 'sync service not initialized' };
  }
  const existing = variables.find((v) => v.uid === uid);
  if (!existing) return { ok: false, reason: 'not-found' };

  const payload = buildUpdateLiveVariableBatch(uid, updates, ctx);
  if (payload.batch.mutations.length === 0) {
    return { ok: true, variable: existing };
  }
  const result = await oracle.apply(payload.batch, payload.sideEffects);
  if (!result.ok) {
    return {
      ok: false,
      reason: 'other',
      message: result.failure?.detail ?? 'oracle rejected live-variable batch',
    };
  }
  return { ok: true, variable: { ...existing, ...updates } as V5.LiveVariable };
}

export async function deleteLiveVariable(uid: string): Promise<boolean> {
  assertLoaded();
  if (!variables.some((v) => v.uid === uid)) return false;
  await applyLiveVariableMutationOrThrow((ctx) => buildDeleteLiveVariableBatch(uid, ctx), 'deleteLiveVariable');
  return true;
}

/**
 * Set or clear a manual-override on an LV. Thin wrapper over
 * `updateLiveVariable` that keeps the override's shape coherent.
 */
export async function setLiveVariableOverride(
  uid: string,
  override: V5.LiveVariableOverride | null,
): Promise<LiveVariableWriteResult> {
  return updateLiveVariable(uid, { manualOverride: override ?? undefined });
}

// ── Sync engine plumbing ────────────────────────────────────────────

async function applyLiveVariableMutationOrThrow(
  factory: (ctx: MutatorContext) => { batch: MutationBatch; sideEffects: SideEffectIntent[] },
  op: string,
): Promise<void> {
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    throw new Error(`LiveVariableStore.${op}: sync service not initialized`);
  }
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  const result = await oracle.apply(batch, sideEffects);
  if (!result.ok) {
    throw new Error(
      `LiveVariableStore.${op}: oracle rejected batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}

// ── Hydration / workspace switch ────────────────────────────────────

async function readSnapshot(workspaceId: string): Promise<V5.LiveVariable[]> {
  return extensionStorage.getValidatedArray(wsKeys(workspaceId).liveVariables, LiveVariableSchema, {
    onError: driftRecorder({
      subsystem: 'live',
      storageKey: wsKeys(workspaceId).liveVariables.key,
      workspaceId,
    }),
  });
}

export async function hydrateFromStorage(): Promise<V5.LiveVariable[]> {
  const workspaceId = getActiveWorkspaceId();
  variables = await readSnapshot(workspaceId);
  loadedWorkspaceId = workspaceId;
  logger.info('LiveVariableStore', `Hydrated ws=${workspaceId}: ${variables.length} variables`);
  return variables;
}

export async function switchToWorkspace(workspaceId: string): Promise<void> {
  if (loadedWorkspaceId === workspaceId) return;
  variables = await readSnapshot(workspaceId);
  loadedWorkspaceId = workspaceId;
  logger.info('LiveVariableStore', `Switched to ws=${workspaceId}: ${variables.length} variables`);
  notifyChange();
}

// ── Purge (workspace delete) ────────────────────────────────────────

export async function purgeLiveVariablesForWorkspace(workspaceId: string): Promise<void> {
  await extensionStorage.remove(wsKeys(workspaceId).liveVariables);
  logger.info('LiveVariableStore', `Purged variables for workspace ${workspaceId}`);
}

// ── Sync engine bridge ──────────────────────────────────────────────

let cacheUnsubscribe: (() => void) | null = null;

/**
 * Wire the local `variables` array to the active workspace's
 * {@link LiveVariableCache}. Idempotent — the prior subscription is
 * dropped first.
 */
export async function bridgeLiveVariableSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<LiveVariableCache>(LIVE_VARIABLE_REGISTRATION);
  if (!cache) return;
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
  cacheUnsubscribe = cache.onChange(() => {
    variables = cache.getLiveVariables();
    notifyChange();
  });
  await cache.seedFromPersistedLiveVariables(variables);
  variables = cache.getLiveVariables();
}

// ── Test helpers ────────────────────────────────────────────────────

export function __resetForTests(): void {
  variables = [];
  loadedWorkspaceId = null;
  changeListeners.clear();
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
}
