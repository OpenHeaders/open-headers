/**
 * GitConsolePane — the Console tab's self-sufficient pane wrapper:
 * fetches the engine's git-command audit feed on mount and refetches
 * on `workspaceTreeGitStatus` frames (every frame follows a pass that
 * may have run git), rendering the read-only ConsoleView over the
 * workspace's view state — the Soft-Wrap pref and the Clear All mark
 * (the host ring stays whole; the mark hides what was already seen).
 */

import { hostBridge, type WorkspaceTreeGitConsoleRowWire } from '@openheaders/core/bridge';
import type React from 'react';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import ConsoleView from './ConsoleView';
import {
  consoleClearMarkFor,
  getGitConsoleClearMark,
  getGitConsolePrefs,
  patchGitConsolePrefs,
  setGitConsoleClearMark,
  subscribeGitConsolePrefs,
  visibleConsoleRows,
} from './git-console-view-state';

export interface GitConsolePaneProps {
  workspaceId: string;
}

const GitConsolePane: React.FC<GitConsolePaneProps> = ({ workspaceId }) => {
  const [rows, setRows] = useState<WorkspaceTreeGitConsoleRowWire[]>([]);
  const [clearMark, setClearMark] = useState(() => getGitConsoleClearMark(workspaceId));
  const prefs = useSyncExternalStore(
    (listener) => subscribeGitConsolePrefs(workspaceId, listener),
    () => getGitConsolePrefs(workspaceId),
  );

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

  const visible = visibleConsoleRows(rows, clearMark);

  const clear = (): void => {
    const mark = consoleClearMarkFor(rows);
    setGitConsoleClearMark(workspaceId, mark);
    setClearMark(mark);
  };

  return (
    <ConsoleView
      rows={visible}
      softWrap={prefs.softWrap}
      onToggleSoftWrap={() => patchGitConsolePrefs(workspaceId, { softWrap: !prefs.softWrap })}
      onClear={clear}
    />
  );
};

export default GitConsolePane;
