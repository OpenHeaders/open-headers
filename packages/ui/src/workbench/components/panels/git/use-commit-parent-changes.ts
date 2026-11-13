/**
 * useCommitParentChanges — a merge's files: what the commit holds
 * differently from each of its parents, and what differs from every one
 * (`oh.workspaceTree.commitParentChanges`). The log's entry lists no
 * files for a merge, so the pane asks when one is selected — lazily,
 * once per commit: a commit never changes, so an answer is kept for the
 * session and a merge seen before lists on its first paint.
 *
 * Answers `undefined` while the read is out, `null` when there is no
 * commit to ask about or the host cannot answer (the pane then lists the
 * entry's own files, as before).
 */

import { hostBridge, type WorkspaceTreeCommitParentChangesWire } from '@openheaders/core/bridge';
import { useEffect, useState, useSyncExternalStore } from 'react';

export type CommitParentChanges = Omit<Extract<WorkspaceTreeCommitParentChangesWire, { ok: true }>, 'ok'>;

/** By workspace and commit. */
const answers = new Map<string, CommitParentChanges>();
const asking = new Map<string, Promise<boolean>>();
/** Counts the answers that have landed — what a mounted pane re-reads on. */
let landed = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Commits kept — past it the oldest answer goes. */
const KEPT_COMMITS = 256;

const commitKey = (workspaceId: string, sha: string): string => `${workspaceId}:${sha}`;

async function read(workspaceId: string, sha: string): Promise<boolean> {
  try {
    const result = await hostBridge.call('oh.workspaceTree.commitParentChanges', { workspaceId, sha });
    if (!result?.ok) return false;
    if (answers.size >= KEPT_COMMITS) {
      const [oldest] = answers.keys();
      answers.delete(oldest);
    }
    answers.set(commitKey(workspaceId, sha), { parents: result.parents, merged: result.merged });
    landed += 1;
    for (const listener of listeners) listener();
    return true;
  } catch {
    return false;
  }
}

/** One read per commit, however many panes ask. */
function ask(workspaceId: string, sha: string): Promise<boolean> {
  const key = commitKey(workspaceId, sha);
  const pending = asking.get(key);
  if (pending !== undefined) return pending;
  const started = read(workspaceId, sha).finally(() => asking.delete(key));
  asking.set(key, started);
  return started;
}

/** Forget every answer — a test starts from none. */
export function resetCommitParentChanges(): void {
  answers.clear();
  asking.clear();
  landed = 0;
}

export function useCommitParentChanges(
  workspaceId: string | undefined,
  sha: string | null,
): CommitParentChanges | null | undefined {
  useSyncExternalStore(subscribe, () => landed);
  const [refused, setRefused] = useState<string | null>(null);
  const key = workspaceId !== undefined && sha !== null ? commitKey(workspaceId, sha) : null;

  useEffect(() => {
    if (workspaceId === undefined || sha === null || key === null || answers.has(key)) return;
    let mounted = true;
    void ask(workspaceId, sha).then((answered) => {
      if (!answered && mounted) setRefused(key);
    });
    return () => {
      mounted = false;
    };
  }, [workspaceId, sha, key]);

  if (key === null) return null;
  return answers.get(key) ?? (refused === key ? null : undefined);
}
