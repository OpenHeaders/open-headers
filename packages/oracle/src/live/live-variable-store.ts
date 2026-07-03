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

import { liveVariablesToPublishOnRun } from '@openheaders/core/live';
import { LiveVariableSchema } from '@openheaders/core/schemas';
import type { MutationBatch, MutatorContext, SideEffectIntent } from '@openheaders/core/sync';
import {
  buildAddLiveVariableBatch,
  buildDeleteLiveVariableBatch,
  buildUpdateLiveVariableBatch,
} from '@openheaders/core/sync-builders/mutations/live-variable-mutations';
import type { LiveVariable, LiveVariableOverride } from '@openheaders/core/types';
import { generateUid, logger, toFolderName } from '@openheaders/core/utils';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { requireActiveWorkspaceId } from '@openheaders/oracle/sync';
import { LIVE_VARIABLE_REGISTRATION } from '@openheaders/oracle/sync/entity-registry';
import type { LiveVariableCache } from '@openheaders/oracle/sync/live-variable-cache';
import {
  getActiveCacheForRegistration,
  getCacheForWorkspace,
  getOracleForCurrentWorkspace,
  getOracleForWorkspace,
  nextSwMutatorContext,
  nextSwMutatorContextForWorkspace,
} from '@openheaders/oracle/sync/service';
import { driftRecorder } from '@openheaders/oracle/sync/storage-drift';

// ── In-memory state (scoped to the active workspace) ───────────────

let variables: LiveVariable[] = [];
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

export function getLiveVariables(): LiveVariable[] {
  return variables;
}

export function getLiveVariable(uid: string): LiveVariable | null {
  return variables.find((v) => v.uid === uid) ?? null;
}

export function getLiveVariableByName(name: string): LiveVariable | null {
  return variables.find((v) => v.name === name) ?? null;
}

export function getLiveVariablesForWorkflow(workflowUid: string): LiveVariable[] {
  return variables.filter((v) => v.workflowUid === workflowUid);
}

/**
 * Snapshot every live variable in an explicit workspace via its
 * {@link LiveVariableCache}. Returns `[]` when no service is
 * materialized for the workspace. SW-internal consumers operating on a
 * non-Active workspace (live-refresh scheduler, chain adapter, resolver
 * live-registry build) read through here instead of {@link
 * getLiveVariables}, which is Active-bound by design (renderer/popup).
 */
export function getLiveVariablesForWorkspace(workspaceId: string): LiveVariable[] {
  const cache = getCacheForWorkspace<LiveVariableCache>(LIVE_VARIABLE_REGISTRATION, workspaceId);
  return cache ? cache.getLiveVariables() : [];
}

/**
 * Filter a non-Active workspace's live variables down to those bound to
 * a specific workflow uid. Same shape as {@link
 * getLiveVariablesForWorkflow} but reads the per-workspace cache rather
 * than the Active-bound in-memory mirror.
 */
export function getLiveVariablesForWorkflowInWorkspace(workflowUid: string, workspaceId: string): LiveVariable[] {
  return getLiveVariablesForWorkspace(workspaceId).filter((v) => v.workflowUid === workflowUid);
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

export async function createLiveVariable(input: CreateLiveVariableInput): Promise<LiveVariable> {
  assertLoaded();
  const uid = generateUid();
  const folderName = toFolderName(input.name, uid);
  const created: LiveVariable = {
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
  | { ok: true; variable: LiveVariable }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message: string };

export async function updateLiveVariable(
  uid: string,
  updates: Partial<Omit<LiveVariable, 'uid' | 'path' | 'schemaVersion'>>,
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
  return { ok: true, variable: { ...existing, ...updates } as LiveVariable };
}

export async function deleteLiveVariable(uid: string): Promise<boolean> {
  assertLoaded();
  if (!variables.some((v) => v.uid === uid)) return false;
  await applyLiveVariableMutationOrThrow((ctx) => buildDeleteLiveVariableBatch(uid, ctx), 'deleteLiveVariable');
  return true;
}

/**
 * Apply the pure {@link liveVariablesToPublishOnRun} rule — publish every
 * draft binding the run produced a value for — so the workflow's refresh
 * (manual OR auto) is what brings a binding live: "produced by the
 * trigger", no separate publish gesture. The decision lives in core
 * (testable in isolation); this is the thin imperative shell that applies
 * it through the sync oracle.
 *
 * Per-workspace by construction: the chain runs against the dispatch's
 * workspace, which may not be the runtime-Active one, so this routes the
 * mutation through that workspace's oracle rather than the Active mirror.
 */
export async function publishLiveVariablesProducedByRun(
  workspaceId: string,
  workflowUid: string,
  stepCaptures: Record<string, Record<string, string>>,
): Promise<void> {
  const oracle = getOracleForWorkspace(workspaceId);
  const ctx = nextSwMutatorContextForWorkspace(workspaceId, { surfaceId: 'sw' });
  if (!oracle || !ctx) return;
  const bound = getLiveVariablesForWorkflowInWorkspace(workflowUid, workspaceId);
  for (const uid of liveVariablesToPublishOnRun(bound, stepCaptures)) {
    const payload = buildUpdateLiveVariableBatch(uid, { published: true }, ctx);
    if (payload.batch.mutations.length === 0) continue;
    await oracle.apply(payload.batch, payload.sideEffects);
  }
}

/**
 * Set or clear a manual-override on an LV. Thin wrapper over
 * `updateLiveVariable` that keeps the override's shape coherent.
 */
export async function setLiveVariableOverride(
  uid: string,
  override: LiveVariableOverride | null,
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

async function readSnapshot(workspaceId: string): Promise<LiveVariable[]> {
  return hostStorage.getValidatedArray(wsKeys(workspaceId).liveVariables, LiveVariableSchema, {
    onError: driftRecorder({
      subsystem: 'live',
      storageKey: wsKeys(workspaceId).liveVariables.key,
      workspaceId,
    }),
  });
}

export async function hydrateFromStorage(): Promise<LiveVariable[]> {
  const workspaceId = requireActiveWorkspaceId();
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
  await hostStorage.remove(wsKeys(workspaceId).liveVariables);
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
