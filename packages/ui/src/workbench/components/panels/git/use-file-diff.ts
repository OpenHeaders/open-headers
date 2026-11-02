/**
 * useFileDiff — one commit-file diff fetch + the modal's open state,
 * shared by the log view, the compare pane and the Push window (all
 * open the same DiffModal from a changed-files tree). An optional base
 * commit moves the old side from the first parent to that commit's
 * blob — the Push window's range read.
 */

import { hostBridge, type WorkspaceTreeFileDiffPairWire } from '@openheaders/core/bridge';
import { useState } from 'react';

export interface FileDiffApi {
  diff: WorkspaceTreeFileDiffPairWire | null;
  /** Path currently loading; null when idle. */
  loadingPath: string | null;
  open: (sha: string, path: string, base?: string) => Promise<void>;
  close: () => void;
  /** Typed failure of the last open attempt (`detail ?? reason`). */
  error: string | null;
}

export function useFileDiff(workspaceId: string): FileDiffApi {
  const [diff, setDiff] = useState<WorkspaceTreeFileDiffPairWire | null>(null);
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = async (sha: string, path: string, base?: string): Promise<void> => {
    setLoadingPath(path);
    setError(null);
    try {
      const result = await hostBridge.call('oh.workspaceTree.fileDiff', {
        workspaceId,
        sha,
        path,
        ...(base !== undefined ? { base } : {}),
      });
      if (result.ok) setDiff(result.diff);
      else setError(result.detail ?? result.reason);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingPath(null);
    }
  };

  return { diff, loadingPath, open, close: () => setDiff(null), error };
}
