/**
 * useFocusedToolWindow — which tool window the footer should describe
 * under the "Focused tool" footer scope.
 *
 * The focus store tracks the focused dock; the focused tool is that
 * dock's active window. The value is STICKY: clicking into the editor
 * clears the focused dock, but the footer keeps describing the tool
 * the user last worked in rather than snapping back. It falls back to
 * `network` when the remembered window is no longer front-most in any
 * dock (hidden, or its dock switched to another tab without a focus
 * event).
 *
 * Subscribe where the value is rendered (the status bar) — the focus
 * store lives outside React precisely so focus clicks don't re-render
 * the panel tree.
 */

import type { DockSlot } from '@openheaders/ui/shared/dock-layout';
import { useEffect, useState } from 'react';
import { useFocusedDock } from './stores/focus-store';
import type { PanelToolWindowId } from './tool-windows';

/** The slice of the dock-layout API the focused-tool lookup reads —
 *  `PanelToolLayoutApi` satisfies it structurally. */
export interface FocusedToolLayout {
  state: { docks: Readonly<Record<DockSlot, { active: PanelToolWindowId | null }>> };
  dockOf: (id: PanelToolWindowId) => DockSlot | null;
}

export function useFocusedToolWindow(tl: FocusedToolLayout): PanelToolWindowId {
  const dock = useFocusedDock();
  const active = dock !== null ? tl.state.docks[dock].active : null;
  const [sticky, setSticky] = useState<PanelToolWindowId>('network');
  useEffect(() => {
    if (active !== null) setSticky(active);
  }, [active]);
  const resolved = active ?? sticky;
  const slot = tl.dockOf(resolved);
  return slot !== null && tl.state.docks[slot].active === resolved ? resolved : 'network';
}
