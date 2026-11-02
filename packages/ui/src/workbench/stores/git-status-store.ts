/**
 * git-status-store — the per-workspace git posture every workbench
 * surface reads from ONE place: whether a workspace-tree (git) binding
 * exists and where its root is, the latest `gitStatus` frame (branch,
 * head, upstream, ahead/behind, force-push hold…) and the ref list
 * (`listRefs` — local / remote / tag names with their shas). Hydrates
 * lazily on hosts registering `workspaceGit` — the binding list once,
 * then each workspace's status + refs on first read — and folds every
 * `workspaceTreeGitStatus` frame afterwards (refs refetch on a frame;
 * nothing polls). Hosts without the capability stay empty, so the
 * extension and web workbenches never show git chrome.
 *
 * Snapshots are immutable objects swapped on change, so
 * `useSyncExternalStore` readers re-render only when their workspace
 * moved.
 */

import { hostBridge, type WorkspaceTreeGitStatusWire, type WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { hasCapability } from '@openheaders/core/capabilities';
import { useSyncExternalStore } from 'react';

export interface WorkspaceGitSnapshot {
  /** A directory binding exists for the workspace (false while unknown). */
  bound: boolean;
  /** The binding's root directory; null while unbound or unknown. */
  rootDir: string | null;
  /** The latest status frame; null until the first read lands or while unbound. */
  status: WorkspaceTreeGitStatusWire | null;
  /** `listRefs` rows; empty until read or while unbound. */
  refs: readonly WorkspaceTreeRefWire[];
  /** The checked-out branch per `listRefs`; null when detached, unborn or unread. */
  current: string | null;
}

export const EMPTY_GIT_SNAPSHOT: WorkspaceGitSnapshot = {
  bound: false,
  rootDir: null,
  status: null,
  refs: [],
  current: null,
};

const snapshots = new Map<string, WorkspaceGitSnapshot>();
const listeners = new Set<() => void>();
const statusHydrated = new Set<string>();
let listHydrate: Promise<void> | null = null;
let frameSubscribed = false;

function notify(): void {
  for (const listener of listeners) listener();
}

function snapshotOf(workspaceId: string): WorkspaceGitSnapshot {
  return snapshots.get(workspaceId) ?? EMPTY_GIT_SNAPSHOT;
}

function patch(workspaceId: string, next: Partial<WorkspaceGitSnapshot>): void {
  const prev = snapshotOf(workspaceId);
  const merged: WorkspaceGitSnapshot = { ...prev, ...next };
  if (
    merged.bound === prev.bound &&
    merged.rootDir === prev.rootDir &&
    merged.status === prev.status &&
    merged.refs === prev.refs &&
    merged.current === prev.current
  ) {
    return;
  }
  snapshots.set(workspaceId, merged);
  notify();
}

function clearBinding(workspaceId: string): void {
  statusHydrated.delete(workspaceId);
  patch(workspaceId, { bound: false, rootDir: null, status: null, refs: [], current: null });
}

async function refetchRefs(workspaceId: string): Promise<void> {
  try {
    const result = await hostBridge.call('oh.workspaceTree.listRefs', { workspaceId });
    if (result.ok) patch(workspaceId, { refs: result.refs, current: result.current });
    else patch(workspaceId, { refs: [], current: null });
  } catch {
    patch(workspaceId, { refs: [], current: null });
  }
}

async function hydrateStatus(workspaceId: string): Promise<void> {
  try {
    const status = await hostBridge.call('oh.workspaceTree.gitStatus', { workspaceId });
    if (!status.bound) {
      clearBinding(workspaceId);
      return;
    }
    patch(workspaceId, { bound: true, status });
    await refetchRefs(workspaceId);
  } catch {
    // Host without the verb table — the workspace reads as unbound.
    clearBinding(workspaceId);
  }
}

/** The binding list once — every bound workspace's root, nothing else. */
function hydrateList(): Promise<void> {
  if (listHydrate !== null) return listHydrate;
  listHydrate = hostBridge
    .call('oh.workspaceTree.list')
    .then((list) => {
      for (const row of list.bindings) patch(row.workspaceId, { bound: true, rootDir: row.rootDir });
    })
    .catch(() => {
      // Host without the verb table — everything stays unbound.
    });
  return listHydrate;
}

function subscribeFrames(): void {
  if (frameSubscribed) return;
  frameSubscribed = true;
  hostBridge.subscribe('workspaceTreeGitStatus', (payload) => {
    if (!payload.status.bound) {
      clearBinding(payload.workspaceId);
      return;
    }
    patch(payload.workspaceId, { bound: true, status: payload.status });
    statusHydrated.add(payload.workspaceId);
    void refetchRefs(payload.workspaceId);
  });
}

/** First read of a workspace: the binding list, then its status + refs when bound. */
function ensureHydrated(workspaceId: string): void {
  if (!hasCapability('workspaceGit')) return;
  subscribeFrames();
  void hydrateList().then(() => {
    if (statusHydrated.has(workspaceId) || !snapshotOf(workspaceId).bound) return;
    statusHydrated.add(workspaceId);
    void hydrateStatus(workspaceId);
  });
}

export function getWorkspaceGitSnapshot(workspaceId: string): WorkspaceGitSnapshot {
  return snapshotOf(workspaceId);
}

/** Observe every workspace's git posture; the listener runs on any change. */
export function subscribeWorkspaceGit(workspaceId: string, listener: () => void): () => void {
  ensureHydrated(workspaceId);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * A fresh binding made by a form (bind / adopt) lands as a status
 * frame from the host; a surface that wants the posture before the
 * frame (the forms' `onBound`) asks for an explicit re-read.
 */
export function refreshWorkspaceGit(workspaceId: string): void {
  if (!hasCapability('workspaceGit')) return;
  subscribeFrames();
  listHydrate = null;
  void hydrateList().then(() => {
    if (!snapshotOf(workspaceId).bound) {
      clearBinding(workspaceId);
      return;
    }
    statusHydrated.add(workspaceId);
    void hydrateStatus(workspaceId);
  });
}

/** The workspace's git snapshot; `EMPTY_GIT_SNAPSHOT` for null ids and unbound workspaces. */
export function useWorkspaceGitSnapshot(workspaceId: string | null): WorkspaceGitSnapshot {
  return useSyncExternalStore(
    (listener) => (workspaceId !== null ? subscribeWorkspaceGit(workspaceId, listener) : () => undefined),
    () => (workspaceId !== null ? snapshotOf(workspaceId) : EMPTY_GIT_SNAPSHOT),
  );
}

/** Test seam — forget every snapshot and hydration mark. */
export function resetWorkspaceGitStoreForTests(): void {
  snapshots.clear();
  statusHydrated.clear();
  listHydrate = null;
  frameSubscribed = false;
}
