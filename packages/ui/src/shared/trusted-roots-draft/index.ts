/**
 * Trusted-roots draft registry — the renderer-side carrier for the
 * Trusted Certificates tab's UNSAVED trust list (the Trusted Roots
 * plan's draft-aware dial). Draft = local, Save = peers: while the tab
 * is dirty the editor publishes its PEM list here, and the workbench
 * Send / Connect wrappers stamp it onto the run frame the way an
 * unsaved request body already travels — so a root under test dials
 * from THIS device before it reaches any peer.
 *
 * Lives outside React (the focus-store idiom): one list per workspace,
 * consumers subscribe per workspace via `useSyncExternalStore`. Never
 * synced, never persisted, never exported — the editor clears it on
 * Save, discard, and unmount.
 */

import { useSyncExternalStore } from 'react';

const drafts = new Map<string, readonly string[]>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((pem, i) => pem === b[i]);
}

/**
 * Publish the workspace's unsaved list (`null` clears it). An empty
 * list is a live draft that withholds every saved root — distinct
 * from no draft. Identical content publishes nothing.
 */
export function publishTrustedRootsDraft(workspaceId: string, pems: readonly string[] | null): void {
  const current = drafts.get(workspaceId);
  if (pems === null) {
    if (current === undefined) return;
    drafts.delete(workspaceId);
    emit();
    return;
  }
  if (current !== undefined && sameList(current, pems)) return;
  drafts.set(workspaceId, [...pems]);
  emit();
}

/** The workspace's live draft, or `undefined` when the tab is clean or closed. */
export function getTrustedRootsDraft(workspaceId: string | null): readonly string[] | undefined {
  return workspaceId === null ? undefined : drafts.get(workspaceId);
}

export function useTrustedRootsDraft(workspaceId: string | null): readonly string[] | undefined {
  return useSyncExternalStore(
    subscribe,
    () => getTrustedRootsDraft(workspaceId),
    () => getTrustedRootsDraft(workspaceId),
  );
}

/**
 * Stamp the workspace's live draft onto a run frame — the one place
 * the four executor channels pick it up. No draft ⇒ the frame is
 * returned untouched and the host dials with the workspace list.
 */
export function withTrustedRootsDraft<T extends object>(
  input: T,
  workspaceId: string | null,
): T & { trustedRootsDraft?: string[] } {
  const draft = getTrustedRootsDraft(workspaceId);
  return draft === undefined ? input : { ...input, trustedRootsDraft: [...draft] };
}

export function __resetTrustedRootsDraftsForTests(): void {
  drafts.clear();
  listeners.clear();
}
