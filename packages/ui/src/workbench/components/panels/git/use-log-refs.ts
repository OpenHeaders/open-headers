/**
 * useLogRefs — the refs one log tab shows beside its rows
 * (`oh.workspaceTree.listRefs`): the rail's tree, the labels on the
 * rows, the checked-out branch. Read when the tab mounts and again on
 * every frame of the repo (`workspaceTreeGitStatus`); reads overlap and
 * the newest one's answer is the tab's. `read` holds false until the
 * first answer — a scope cannot tell an unborn branch from a missing
 * one before it.
 */

import { hostBridge, type WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { useCallback, useEffect, useState } from 'react';
import { useNewestRead } from './use-newest-read';

export interface LogRefs {
  refs: WorkspaceTreeRefWire[];
  /** The checked-out branch; null when detached, unborn or unread. */
  current: string | null;
  /** The host has answered once. */
  read: boolean;
  /** Read again — settles when the answer is in, and never rejects. */
  reload: () => Promise<void>;
}

const NO_REFS: WorkspaceTreeRefWire[] = [];

export function useLogRefs(workspaceId: string): LogRefs {
  const beginRead = useNewestRead();
  const [held, setHeld] = useState<{ refs: WorkspaceTreeRefWire[]; current: string | null; read: boolean }>({
    refs: NO_REFS,
    current: null,
    read: false,
  });

  const reload = useCallback(async (): Promise<void> => {
    const superseded = beginRead();
    try {
      const result = await hostBridge.call('oh.workspaceTree.listRefs', { workspaceId });
      if (superseded()) return;
      setHeld(
        result.ok
          ? { refs: result.refs, current: result.current, read: true }
          : { refs: NO_REFS, current: null, read: true },
      );
    } catch {
      if (!superseded()) setHeld({ refs: NO_REFS, current: null, read: true });
    }
  }, [beginRead, workspaceId]);

  useEffect(() => {
    void reload();
    return hostBridge.subscribe('workspaceTreeGitStatus', (payload) => {
      if (payload.workspaceId === workspaceId) void reload();
    });
  }, [workspaceId, reload]);

  return { ...held, reload };
}
