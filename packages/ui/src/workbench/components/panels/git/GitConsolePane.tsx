/**
 * GitConsolePane — the Console tab's self-sufficient pane wrapper:
 * fetches the engine's git-command audit feed on mount and reads it
 * again whenever the host says the feed gained rows
 * (`workspaceTreeGitConsole` — every command the feed lists, the
 * background ones and those that moved no status included), and on
 * `workspaceTreeGitStatus` frames (all a host older than that signal
 * sends), rendering the read-only ConsoleView over the workspace's
 * view state — the gutter prefs, the Clear All mark and the session's
 * clicked-open option runs — in the terminal's face. Clear All hides
 * everything the host ran up to the press: it reads the feed first,
 * so a row the pane had not drawn yet is not left behind (the host
 * ring stays whole; the mark is the id of its newest row then).
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

  /** Read the feed as the host holds it now; null when the host did not answer with one (the pane then shows none). */
  const load = useCallback(async (): Promise<WorkspaceTreeGitConsoleRowWire[] | null> => {
    let next: WorkspaceTreeGitConsoleRowWire[] | null = null;
    try {
      const result = await hostBridge.call('oh.workspaceTree.gitConsole', { workspaceId });
      if (result.ok) next = result.rows;
    } catch {
      // No feed to show.
    }
    setRows(next ?? []);
    return next;
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

  useEffect(() => {
    return hostBridge.subscribe('workspaceTreeGitConsole', (payload) => {
      if (payload.workspaceId !== workspaceId) return;
      void load();
    });
  }, [workspaceId, load]);

  const visible = visibleConsoleRows(rows, clearMark);

  const clear = async (): Promise<void> => {
    // The host's newest row, not the pane's: what ran before the press and was not drawn yet goes with the rest.
    // A read the host did not answer leaves the mark on what the pane held.
    const mark = consoleClearMarkFor((await load()) ?? rows);
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
      onClear={() => void clear()}
    />
  );
};

export default GitConsolePane;
