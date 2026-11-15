/**
 * useHeadTreeFiles — the files of the checked-out commit's tree
 * (`oh.workspaceTree.treeFiles`), read when asked: the Paths chip asks
 * as its Select… field opens (the names a typed path completes from)
 * and the tree picker as it mounts. Each ask reads again — a commit
 * between two openings changes the answer — and only the newest ask's
 * answer is taken. An answer is its workspace's alone.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { useCallback, useState } from 'react';
import { useNewestRead } from '../use-newest-read';

export interface HeadTreeFiles {
  paths: string[];
  /** The tree holds more files than one read lists. */
  truncated: boolean;
}

export interface HeadTreeFilesRead {
  /** The newest answer; null until one lands. */
  listing: HeadTreeFiles | null;
  /** Why the newest read gave no listing; null while it has not failed. */
  failure: string | null;
  ask: () => void;
}

interface Answer {
  workspaceId: string;
  listing: HeadTreeFiles | null;
  failure: string | null;
}

export function useHeadTreeFiles(workspaceId: string): HeadTreeFilesRead {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const beginRead = useNewestRead();

  const ask = useCallback((): void => {
    const superseded = beginRead();
    const land = (listing: HeadTreeFiles | null, failure: string | null): void => {
      if (!superseded()) setAnswer({ workspaceId, listing, failure });
    };
    hostBridge
      .call('oh.workspaceTree.treeFiles', { workspaceId })
      .then((result) => {
        if (result?.ok) land({ paths: result.paths, truncated: result.truncated }, null);
        else land(null, result?.reason ?? 'list-failed');
      })
      .catch((err: Error) => land(null, err.message));
  }, [beginRead, workspaceId]);

  const own = answer !== null && answer.workspaceId === workspaceId ? answer : null;
  return { listing: own?.listing ?? null, failure: own?.failure ?? null, ask };
}
