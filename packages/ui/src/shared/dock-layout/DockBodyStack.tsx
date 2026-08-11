/**
 * DockBodyStack — keep-alive host for one dock's tool-window bodies.
 *
 * A dock renders the bodies of every window the user has activated at
 * least once and display-toggles to the active tab, instead of
 * mounting only the active body. Unmount-on-switch threw away panel
 * state (scroll positions, selections, loaded views) on every tab
 * change; bodies now get the same keep-alive contract as editor tabs
 * and the shell's single-surface mode. Mounting stays lazy — a window
 * that has never been activated renders nothing, preserving the
 * registry's dormant-until-opened behavior — and a window leaving the
 * dock (hidden, or dragged to another slot) leaves the stack, so state
 * resets only on explicit layout acts, never on tab switches or dock
 * close/reopen.
 */

import type React from 'react';
import { useRef } from 'react';
import type { DockSlot } from './types';

interface DockBodyStackProps<T extends string> {
  /** The dock's resident windows — stack membership is capped to these. */
  windows: readonly T[];
  active: T | null;
  slot: DockSlot;
  renderToolWindow: (id: T, slot: DockSlot) => React.ReactNode;
}

export function DockBodyStack<T extends string>({ windows, active, slot, renderToolWindow }: DockBodyStackProps<T>) {
  const warmed = useRef<Set<T>>(new Set());
  if (active !== null) warmed.current.add(active);
  for (const id of warmed.current) {
    if (!windows.includes(id)) warmed.current.delete(id);
  }
  return (
    <>
      {windows
        .filter((id) => warmed.current.has(id))
        .map((id) => (
          <div
            key={id}
            className={`rules-dock-keepalive${id === active ? '' : ' rules-dock-keepalive--hidden'}`}
            data-tool-window={id}
          >
            {renderToolWindow(id, slot)}
          </div>
        ))}
    </>
  );
}
