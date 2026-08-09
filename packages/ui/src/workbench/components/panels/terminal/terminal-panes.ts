/**
 * terminal-panes — the terminal panel's split layout, riding the
 * shared pane-tabs machinery (pane-tabs-store owns the tree/reconcile
 * logic; this module owns the terminal binding: the registry adapter
 * and the module singleton). The registry (terminal-instance.ts) owns
 * tab IDENTITIES and their xterm/pty pairs; the pane store owns WHERE
 * each tab lives. Split layout survives dock hide/show (module state)
 * and deliberately does NOT persist across app restarts — the editor
 * tab session has the same contract.
 */

import {
  createPaneTabsStore,
  type PaneTabRef,
  type PaneTabsNode,
  type SplitDirection,
  type WorkbenchPaneTabs,
} from '../pane-tabs/pane-tabs-store';
import { getWorkbenchTerminalTabs } from './terminal-instance';

export { oppositeDirectionOf, parentOrientationOf } from '../pane-tabs/pane-tabs-store';
export type { SplitDirection };

/** A leaf item — just the tab's identity; the registry owns the rest. */
export type TerminalPaneRef = PaneTabRef;
export type TerminalPaneNode = PaneTabsNode;
export type TerminalPaneLeafId = string;
export type WorkbenchTerminalPanes = WorkbenchPaneTabs;

let store: WorkbenchTerminalPanes | null = null;

/**
 * The singleton terminal pane store, created on first call and bound to
 * the terminal tab registry. Null on hosts without the `terminal`
 * capability (mirrors the registry).
 */
export function getWorkbenchTerminalPanes(): WorkbenchTerminalPanes | null {
  const registry = getWorkbenchTerminalTabs();
  if (!registry) return null;
  store ??= createPaneTabsStore(registry);
  return store;
}
