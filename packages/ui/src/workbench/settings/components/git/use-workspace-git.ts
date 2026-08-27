/**
 * useWorkspaceGit — the one status spine under every Git settings page
 * and the Server Admin git card: the workspace's folder binding (from
 * `oh.workspaceTree.list`), its git status (hydrated once per binding,
 * then pushed live by the Node host after every pass that can move
 * `git status`), and the two refresh verbs the gesture sections call
 * after a mutation. The transport is the caller's seam — local
 * `hostBridge.call` on the desktop, the gated dispatch wire on the
 * admin console.
 */

import { hostBridge, type WorkspaceTreeGitStatusWire } from '@openheaders/core/bridge';
import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceTreeTransport } from '../../../components/git/transport';

export interface WorkspaceGitBinding {
  workspaceId: string;
  rootDir: string;
  issues: Array<{ path: string; message: string }>;
}

export interface WorkspaceGit {
  call: WorkspaceTreeTransport;
  workspaceId: string | null;
  binding: WorkspaceGitBinding | null;
  gitStatus: WorkspaceTreeGitStatusWire | null;
  /** Re-read the bindings list (after bind / unbind / pull / merge). */
  refresh: () => Promise<void>;
  /** Re-read the git status (after any repo mutation). */
  refreshGitStatus: () => Promise<void>;
}

export function useWorkspaceGit(call: WorkspaceTreeTransport, workspaceId: string | null): WorkspaceGit {
  const [bindings, setBindings] = useState<WorkspaceGitBinding[]>([]);
  const [gitStatus, setGitStatus] = useState<WorkspaceTreeGitStatusWire | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const result = await call('oh.workspaceTree.list');
      setBindings(result.bindings);
    } catch {
      setBindings([]);
    }
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const binding = bindings.find((row) => row.workspaceId === workspaceId) ?? null;

  const refreshGitStatus = useCallback(async (): Promise<void> => {
    if (workspaceId === null) {
      setGitStatus(null);
      return;
    }
    try {
      setGitStatus(await call('oh.workspaceTree.gitStatus', { workspaceId }));
    } catch {
      setGitStatus(null);
    }
  }, [workspaceId, call]);

  useEffect(() => {
    if (binding !== null) void refreshGitStatus();
    else setGitStatus(null);
  }, [binding, refreshGitStatus]);

  useEffect(() => {
    if (workspaceId === null) return;
    return hostBridge.subscribe('workspaceTreeGitStatus', (payload) => {
      if (payload.workspaceId !== workspaceId) return;
      setGitStatus(payload.status.bound ? payload.status : null);
    });
  }, [workspaceId]);

  return { call, workspaceId, binding, gitStatus, refresh, refreshGitStatus };
}
