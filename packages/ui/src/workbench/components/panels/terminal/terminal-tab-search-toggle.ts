/**
 * terminal-tab-search-toggle — one-slot registry connecting the
 * workspace `tab-search` shortcut (⌘⇧A) to the FOCUSED terminal
 * pane's search dropdown. The focused pane's header cluster registers
 * its toggle on mount/focus change; App's `onTabSearch` handler
 * invokes it when the Terminal tool window is the focused dock's
 * active panel (the same region arbitration as `mod+t`), falling
 * through to the editor's tab search otherwise. Module-level for the
 * same reason as the registry/panes stores: no prop-drilling through
 * the dock's tool-window indirection.
 */

let toggle: (() => void) | null = null;

/** Called by the focused pane's cluster; pass null on unmount/blur. */
export function registerTerminalTabSearchToggle(fn: (() => void) | null): void {
  toggle = fn;
}

/** Invoke the focused pane's search toggle. False when none is live
 *  (panel hidden) — the caller falls through to the editor search. */
export function toggleTerminalTabSearch(): boolean {
  if (!toggle) return false;
  toggle();
  return true;
}
