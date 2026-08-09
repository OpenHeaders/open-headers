/**
 * GitConsolePane — the Console tab's self-sufficient pane wrapper:
 * fetches the engine's git-command audit feed on mount and refetches
 * on `workspaceTreeGitStatus` frames (every frame follows a pass that
 * may have run git), rendering the read-only ConsoleView.
 */

import { hostBridge, type WorkspaceTreeGitConsoleRowWire } from '@openheaders/core/bridge';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import ConsoleView from './ConsoleView';

export interface GitConsolePaneProps {
  workspaceId: string;
}

const GitConsolePane: React.FC<GitConsolePaneProps> = ({ workspaceId }) => {
  const [rows, setRows] = useState<WorkspaceTreeGitConsoleRowWire[]>([]);

  const load = useCallback(async (): Promise<void> => {
    try {
      const result = await hostBridge.call('oh.workspaceTree.gitConsole', { workspaceId });
      setRows(result.ok ? result.rows : []);
    } catch {
      setRows([]);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return hostBridge.subscribe('workspaceTreeGitStatus', (payload) => {
      if (payload.workspaceId !== workspaceId) return;
      void load();
    });
  }, [workspaceId, load]);

  return <ConsoleView rows={rows} />;
};

export default GitConsolePane;
