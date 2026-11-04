/**
 * GitConsolePane — the Console tab's self-sufficient pane wrapper:
 * fetches the engine's git-command audit feed on mount and refetches
 * on `workspaceTreeGitStatus` frames (every frame follows a pass that
 * may have run git), rendering the read-only ConsoleView over the
 * workspace's view state — the gutter prefs, the Clear All mark (the
 * host ring stays whole; the mark hides what was already seen) and
 * the session's clicked-open option runs — in the terminal's face.
 */

import { hostBridge, type WorkspaceTreeGitConsoleRowWire } from '@openheaders/core/bridge';
import type React from 'react';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import ConsoleView from './ConsoleView';
import {
  consoleClearMarkFor,
  getGitConsoleClearMark,
  getGitConsolePrefs,
  type GitConsolePrefs,
  patchGitConsolePrefs,
  setGitConsoleClearMark,
  subscribeGitConsolePrefs,
  visibleConsoleRows,
} from './git-console-view-state';
import { useConsoleFont } from './use-console-font';

export interface GitConsolePaneProps {
  workspaceId: string;
}

const NONE: ReadonlySet<number> = new Set();

const GitConsolePane: React.FC<GitConsolePaneProps> = ({ workspaceId }) => {
  const [rows, setRows] = useState<WorkspaceTreeGitConsoleRowWire[]>([]);
  const [clearMark, setClearMark] = useState(() => getGitConsoleClearMark(workspaceId));
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(NONE);
  const prefs = useSyncExternalStore(
    (listener) => subscribeGitConsolePrefs(workspaceId, listener),
    () => getGitConsolePrefs(workspaceId),
  );
  const font = useConsoleFont();

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

  const toggleExpanded = (seq: number): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(seq)) next.add(seq);
      return next;
    });
  };

  // Folding again folds every row the viewer had opened.
  const togglePref = (key: keyof GitConsolePrefs): void => {
    const next = !prefs[key];
    if (key === 'foldOptions' && next) setExpanded(NONE);
    patchGitConsolePrefs(workspaceId, { [key]: next });
  };

  return (
    <ConsoleView
      rows={visible}
      prefs={prefs}
      font={font}
      expanded={expanded}
      onToggleExpanded={toggleExpanded}
      onTogglePref={togglePref}
      onClear={clear}
    />
  );
};

export default GitConsolePane;
