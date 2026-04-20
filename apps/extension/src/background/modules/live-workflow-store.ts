/**
 * Live Workflow Store — SW-side source of truth for the workflow
 * definitions that power `{{live.X}}` refresh (see
 * `docs/LIVE_VARIABLES_PLAN.md`).
 *
 * Shape mirrors `request-store.ts`: a flat in-memory list hydrated
 * per-active-workspace, mutated through `withLock` + Phase 10 version
 * counters. The workflow owns the ordered step list + refresh policy;
 * its extracted values live in the separate `live-cache-store.ts` keyed
 * by `(workflowUid, environmentId)` so definition edits never clobber
 * cached captures.
 *
 * The store does NOT cascade-delete Live Variables when a workflow is
 * removed. Orphaned LVs surface `workflow-not-found` resolution errors
 * at resolve time (Phase E) so the user sees the broken binding and can
 * rebind the LV rather than silently losing the namespace entry.
 *
 * Storage:
 *   - definitions: `oh.ws.<id>.liveWorkflows`
 *   (cache lives at `oh.ws.<id>.liveCache` — see `live-cache-store.ts`)
 */

import { LiveWorkflowSchema } from '@openheaders/core/schemas';
import type { V5 } from '@openheaders/core/types';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import { entityLockName, withLock } from '@/shared/coordination/with-lock';
import { extensionStorage, wsKeys } from '@/shared/storage';
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
 * the user picks a cadence. Matches the request-editor convention of
 * starting from a conservative default rather than picking an auto
 * schedule the user didn't intend.
 */
const DEFAULT_REFRESH: V5.RefreshPolicy = { kind: 'manual' };

export interface CreateLiveWorkflowInput {
  name: string;
  description?: string;
  steps?: V5.WorkflowStep[];
  refresh?: V5.RefreshPolicy;
  enabled?: boolean;
}

/**
 * Seed a brand-new workflow in memory + persist. Callers without a
 * step list get an empty steps array and a `manual` refresh policy —
 * the editor fills both in before the workflow can actually run.
 */
export function createLiveWorkflow(input: CreateLiveWorkflowInput): V5.LiveWorkflow {
  const uid = generateUid();
  const folderName = toFolderName(input.name, uid);
  const created: V5.LiveWorkflow = {
    schemaVersion: 5,
    version: 1,
    uid,
    path: `live-workflows/${folderName}`,
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    steps: input.steps ?? [],
    refresh: input.refresh ?? DEFAULT_REFRESH,
    enabled: input.enabled ?? true,
  };
  workflows = [...workflows, created];
  void persist();
  return created;
}

export type LiveWorkflowWriteResult =
  | { ok: true; version: number; workflow: V5.LiveWorkflow }
  | { ok: false; reason: 'stale-draft'; serverVersion: number; serverWorkflow: V5.LiveWorkflow }
  | { ok: false; reason: 'not-found' };

export interface UpdateLiveWorkflowOptions {
  /** Version the client loaded. Omit to opt out of stale-draft detection. */
  expectedVersion?: number;
}

export async function updateLiveWorkflow(
  uid: string,
  updates: Partial<Omit<V5.LiveWorkflow, 'uid' | 'path' | 'schemaVersion' | 'version'>>,
  options: UpdateLiveWorkflowOptions = {},
): Promise<LiveWorkflowWriteResult> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'live-workflow-def', uid),
    async () => {
      const index = workflows.findIndex((w) => w.uid === uid);
      if (index === -1) return { ok: false, reason: 'not-found' } as LiveWorkflowWriteResult;
      const existing = workflows[index];
      if (options.expectedVersion !== undefined && options.expectedVersion !== existing.version) {
        return {
          ok: false,
          reason: 'stale-draft',
          serverVersion: existing.version,
          serverWorkflow: existing,
        } as LiveWorkflowWriteResult;
      }
      const nextVersion = existing.version + 1;
      const updated = { ...existing, ...updates, version: nextVersion } as V5.LiveWorkflow;
      workflows = [...workflows.slice(0, index), updated, ...workflows.slice(index + 1)];
      await persist();
      return { ok: true, version: nextVersion, workflow: updated } as LiveWorkflowWriteResult;
    },
    { op: 'live-workflow-update' },
  );
}

export async function deleteLiveWorkflow(uid: string): Promise<boolean> {
  const workspaceId = assertLoaded();
  return withLock(
    entityLockName(workspaceId, 'live-workflow-def', uid),
    async () => {
      const before = workflows.length;
      workflows = workflows.filter((w) => w.uid !== uid);
      if (workflows.length === before) return false;
      await persist();
      return true;
    },
    { op: 'live-workflow-delete' },
  );
}

// ── Persistence ─────────────────────────────────────────────────────

async function persist(): Promise<void> {
  const workspaceId = assertLoaded();
  await extensionStorage.set(wsKeys(workspaceId).liveWorkflows, workflows);
  logger.debug('LiveWorkflowStore', `Persisted ${workflows.length} workflows (ws=${workspaceId})`);
  notifyChange();
}

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

// ── Test helpers ────────────────────────────────────────────────────

export function __resetForTests(): void {
  workflows = [];
  loadedWorkspaceId = null;
  changeListeners.clear();
}
