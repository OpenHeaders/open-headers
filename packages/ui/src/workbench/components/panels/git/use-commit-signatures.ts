/**
 * useCommitSignatures — which of the log's commits are signed and what
 * git makes of each signature (`oh.workspaceTree.commitSignatures`):
 * the GPG Signature column. Asked only while the column shows, in one
 * read for the commits not asked about yet. A commit never changes, so
 * an answer is kept for the session — the check is the slow part (git
 * looks a key up per signed commit), which is why it never rides the
 * log's own read. A host that cannot answer is not asked again; the
 * column then stays empty.
 */

import { hostBridge, type WorkspaceTreeCommitSignatureWire } from '@openheaders/core/bridge';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

export type CommitSignature = WorkspaceTreeCommitSignatureWire;

/** By workspace and commit: its signature, or null for a commit that has none. Replaced whole when answers land. */
let answers: ReadonlyMap<string, CommitSignature | null> = new Map();
/** Asked about — answered or not. */
const asked = new Set<string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Commits kept — past it the oldest answers go. */
const KEPT_COMMITS = 4096;
/** The host's own cap on one read. */
const ASKED_AT_ONCE = 500;

const commitKey = (workspaceId: string, sha: string): string => `${workspaceId}:${sha}`;

async function read(workspaceId: string, shas: readonly string[]): Promise<void> {
  try {
    const result = await hostBridge.call('oh.workspaceTree.commitSignatures', { workspaceId, shas: [...shas] });
    if (!result?.ok) return;
    const signed = new Map(result.signatures.map((signature) => [signature.sha, signature]));
    const next = new Map(answers);
    for (const sha of shas) next.set(commitKey(workspaceId, sha), signed.get(sha) ?? null);
    for (const oldest of next.keys()) {
      if (next.size <= KEPT_COMMITS) break;
      next.delete(oldest);
    }
    answers = next;
    for (const listener of listeners) listener();
  } catch {
    // The column stays empty.
  }
}

/** Forget every answer — a test starts from none. */
export function resetCommitSignatures(): void {
  answers = new Map();
  asked.clear();
}

/** The signed commits among `shas`, by sha — filled as the host answers, empty while the column is off. */
export function useCommitSignatures(
  workspaceId: string,
  shas: readonly string[],
  enabled: boolean,
): ReadonlyMap<string, CommitSignature> {
  const known = useSyncExternalStore(subscribe, () => answers);

  useEffect(() => {
    if (!enabled) return;
    const unasked = shas.filter((sha) => !asked.has(commitKey(workspaceId, sha)));
    for (let at = 0; at < unasked.length; at += ASKED_AT_ONCE) {
      const batch = unasked.slice(at, at + ASKED_AT_ONCE);
      for (const sha of batch) asked.add(commitKey(workspaceId, sha));
      void read(workspaceId, batch);
    }
  }, [workspaceId, shas, enabled]);

  return useMemo(() => {
    const signed = new Map<string, CommitSignature>();
    if (!enabled) return signed;
    for (const sha of shas) {
      const signature = known.get(commitKey(workspaceId, sha));
      if (signature != null) signed.set(sha, signature);
    }
    return signed;
  }, [workspaceId, shas, enabled, known]);
}
