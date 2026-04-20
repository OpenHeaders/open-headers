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
 * Deleting a workflow does NOT cascade into LV deletion — orphaned
 * LVs surface `workflow-not-found` resolution errors at resolve time
 * (Phase E) so the user sees the broken binding and can rebind rather
 * than silently losing the namespace entry.
 *
 * Storage: `oh.ws.<id>.liveVariables`.
 */

import { LiveVariableSchema } from '@openheaders/core/schemas';
import type { V5 } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import { entityLockName, withLock } from '@/shared/coordination/with-lock';
import { extensionStorage, wsKeys } from '@/shared/storage';
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

/**
 * LVs bound to a given workflow. Used by the scheduler + resolver to
 * reference-count a workflow (auto-pause when no enabled LV references
 * it) and to narrow DNR rebuilds when a cache entry changes.
 */
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

export function createLiveVariable(input: CreateLiveVariableInput): V5.LiveVariable {
  const uid = generateUid();
  const folderName = toFolderName(input.name, uid);
  const created: V5.LiveVariable = {
    schemaVersion: 5,
    version: 1,
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
  variables = [...variables, created];
  void persist();
  return created;
}

export type LiveVariableWriteResult =
  | { ok: true; version: number; variable: V5.LiveVariable }
  | { ok: false; reason: 'stale-draft'; serverVersion: number; serverVariable: V5.LiveVariable }
  | { ok: false; reason: 'not-found' };

export interface UpdateLiveVariableOptions {
  /** Version the client loaded. Omit to opt out of stale-draft detection. */
  expectedVersion?: number;
}

export async function updateLiveVariable(
  uid: string,
  updates: Partial<Omit<V5.LiveVariable, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
  options: UpdateLiveVariableOptions = {},
): Promise<LiveVariableWriteResult> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'live-variable-def', uid),
    async () => {
      const index = variables.findIndex((v) => v.uid === uid);
      if (index === -1) return { ok: false, reason: 'not-found' } as LiveVariableWriteResult;
      const existing = variables[index];
      if (options.expectedVersion !== undefined && options.expectedVersion !== existing.version) {
        return {
          ok: false,
          reason: 'stale-draft',
          serverVersion: existing.version,
          serverVariable: existing,
        } as LiveVariableWriteResult;
      }
      const nextVersion = existing.version + 1;
      const updated = { ...existing, ...updates, version: nextVersion } as V5.LiveVariable;
      variables = [...variables.slice(0, index), updated, ...variables.slice(index + 1)];
      await persist();
      return { ok: true, version: nextVersion, variable: updated } as LiveVariableWriteResult;
    },
    { op: 'live-variable-update' },
  );
}

export async function deleteLiveVariable(uid: string): Promise<boolean> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'live-variable-def', uid),
    async () => {
      const before = variables.length;
      variables = variables.filter((v) => v.uid !== uid);
      if (variables.length === before) return false;
      await persist();
      return true;
    },
    { op: 'live-variable-delete' },
  );
}

/**
 * Set or clear a manual-override on an LV. Thin wrapper over
 * `updateLiveVariable` that keeps the override's shape coherent —
 * `value` required when setting, clears both `value` and `until`
 * when the caller passes `null`.
 */
export async function setLiveVariableOverride(
  uid: string,
  override: V5.LiveVariableOverride | null,
  options: UpdateLiveVariableOptions = {},
): Promise<LiveVariableWriteResult> {
  return updateLiveVariable(uid, { manualOverride: override ?? undefined }, options);
}

// ── Persistence ─────────────────────────────────────────────────────

async function persist(): Promise<void> {
  const workspaceId = assertLoaded();
  await extensionStorage.set(wsKeys(workspaceId).liveVariables, variables);
  logger.debug('LiveVariableStore', `Persisted ${variables.length} variables (ws=${workspaceId})`);
  notifyChange();
}

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

// ── Test helpers ────────────────────────────────────────────────────

export function __resetForTests(): void {
  variables = [];
  loadedWorkspaceId = null;
  changeListeners.clear();
}
