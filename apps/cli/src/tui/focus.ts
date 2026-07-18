/**
 * Focus ring: which pane owns the keys. Tab/Shift+Tab cycle the pane
 * order and digits jump directly (TUI_DESIGN.md §2 — the workbench's
 * alt+N family with the modifier dropped). A modal stack captures
 * focus wholesale: while any modal is open pane movement is inert and
 * `active` answers the top modal, so overlays compose (help over
 * palette) and Esc pops innermost-first.
 */

export interface FocusRing {
  readonly panes: readonly string[];
  readonly focusedPane: string;
  /** Top of the modal stack, or null when no modal is open. */
  readonly modal: string | null;
  /** Who gets the keys right now: the top modal if any, else the focused pane. */
  readonly active: string;
  next(): void;
  previous(): void;
  focusPane(id: string): boolean;
  /** 1-based, matching the pane digits in titles. */
  focusDigit(digit: number): boolean;
  pushModal(id: string): void;
  popModal(): string | null;
  /** Re-declare the pane order (layout collapse); focus survives when its pane does. */
  setPanes(panes: readonly string[]): void;
}

export function createFocusRing(initialPanes: readonly string[]): FocusRing {
  if (initialPanes.length === 0) throw new Error('focus ring needs at least one pane');
  let panes: readonly string[] = [...initialPanes];
  let focused = panes[0];
  const modals: string[] = [];

  function move(step: number): void {
    if (modals.length > 0) return;
    const index = panes.indexOf(focused);
    focused = panes[(index + step + panes.length) % panes.length];
  }

  return {
    get panes() {
      return panes;
    },
    get focusedPane() {
      return focused;
    },
    get modal() {
      return modals.length > 0 ? modals[modals.length - 1] : null;
    },
    get active() {
      return modals.length > 0 ? modals[modals.length - 1] : focused;
    },
    next() {
      move(1);
    },
    previous() {
      move(-1);
    },
    focusPane(id: string): boolean {
      if (modals.length > 0 || !panes.includes(id)) return false;
      focused = id;
      return true;
    },
    focusDigit(digit: number): boolean {
      if (modals.length > 0 || !Number.isInteger(digit)) return false;
      const pane = panes[digit - 1];
      if (pane === undefined) return false;
      focused = pane;
      return true;
    },
    pushModal(id: string): void {
      modals.push(id);
    },
    popModal(): string | null {
      return modals.pop() ?? null;
    },
    setPanes(next: readonly string[]): void {
      if (next.length === 0) throw new Error('focus ring needs at least one pane');
      panes = [...next];
      if (!panes.includes(focused)) focused = panes[0];
    },
  };
}
