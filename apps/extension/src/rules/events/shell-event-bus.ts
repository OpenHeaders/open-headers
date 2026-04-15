/**
 * shell-event-bus — single place that owns document-level event listeners
 * for the workspace shell.
 *
 * Why this exists: before this bus, `useFocusRegion` attached its own
 * capture-phase click listener at the shell root and `useWorkspaceShortcuts`
 * attached its own keydown listener at the window. Every feature that wanted
 * to observe a global event added another `addEventListener` scattered
 * across hooks, with no enforced ordering and no single place to reason
 * about "what happens on click." Bugs where one listener wrote React state
 * mid-dispatch and broke controlled inputs (antd <Radio.Group>) were
 * structurally possible because the listener sites weren't centralized.
 *
 * The bus attaches exactly one listener per event type on the shell root
 * (click in capture phase, focusin, focusout) and one keydown listener on
 * the window. Consumers subscribe via React hooks; their callbacks run in
 * subscription order. If you're tempted to call `setState` inside one of
 * these subscribers for ambient UI state (focus accents, hover tracking,
 * etc.), write to an external store instead — re-rendering the form tree
 * from a click-capture handler is what broke antd radios in the first
 * place. See `stores/focus-region-store.ts` for the pattern.
 *
 * Keydown stays at the window, not the shell root. Some browsers only
 * dispatch keydown to the focused element's ancestors, and the shell root
 * isn't always an ancestor of portal content (command palette, dropdowns)
 * or the browser chrome's own focus target.
 */

import { createContext, useContext, useEffect } from 'react';

type Unsubscribe = () => void;

export interface ShellEventBus {
  onClickCapture(fn: (event: MouseEvent) => void): Unsubscribe;
  onFocusIn(fn: (event: FocusEvent) => void): Unsubscribe;
  onFocusOut(fn: (event: FocusEvent) => void): Unsubscribe;
  onKeyDown(fn: (event: KeyboardEvent) => void): Unsubscribe;
}

export interface ShellEventBusHandle {
  bus: ShellEventBus;
  /** Attach the bus to a shell root. Returns a cleanup that detaches. */
  attach(root: HTMLElement | null): Unsubscribe;
}

export function createShellEventBus(): ShellEventBusHandle {
  const clickListeners = new Set<(e: MouseEvent) => void>();
  const focusInListeners = new Set<(e: FocusEvent) => void>();
  const focusOutListeners = new Set<(e: FocusEvent) => void>();
  const keyDownListeners = new Set<(e: KeyboardEvent) => void>();

  const bus: ShellEventBus = {
    onClickCapture(fn) {
      clickListeners.add(fn);
      return () => {
        clickListeners.delete(fn);
      };
    },
    onFocusIn(fn) {
      focusInListeners.add(fn);
      return () => {
        focusInListeners.delete(fn);
      };
    },
    onFocusOut(fn) {
      focusOutListeners.add(fn);
      return () => {
        focusOutListeners.delete(fn);
      };
    },
    onKeyDown(fn) {
      keyDownListeners.add(fn);
      return () => {
        keyDownListeners.delete(fn);
      };
    },
  };

  function attach(root: HTMLElement | null): Unsubscribe {
    if (!root) return () => {};

    const handleClick = (event: MouseEvent) => {
      for (const fn of clickListeners) fn(event);
    };
    const handleFocusIn = (event: FocusEvent) => {
      for (const fn of focusInListeners) fn(event);
    };
    const handleFocusOut = (event: FocusEvent) => {
      for (const fn of focusOutListeners) fn(event);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const fn of keyDownListeners) fn(event);
    };

    root.addEventListener('click', handleClick, true);
    root.addEventListener('focusin', handleFocusIn);
    root.addEventListener('focusout', handleFocusOut);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      root.removeEventListener('click', handleClick, true);
      root.removeEventListener('focusin', handleFocusIn);
      root.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }

  return { bus, attach };
}

export const ShellEventBusContext = createContext<ShellEventBus | null>(null);

function useShellEventBus(): ShellEventBus {
  const bus = useContext(ShellEventBusContext);
  if (!bus) {
    throw new Error('useShellEventBus must be used inside <ShellEventBusContext.Provider>');
  }
  return bus;
}

export function useShellClickCapture(fn: (event: MouseEvent) => void): void {
  const bus = useShellEventBus();
  useEffect(() => bus.onClickCapture(fn), [bus, fn]);
}

export function useShellFocusIn(fn: (event: FocusEvent) => void): void {
  const bus = useShellEventBus();
  useEffect(() => bus.onFocusIn(fn), [bus, fn]);
}

export function useShellFocusOut(fn: (event: FocusEvent) => void): void {
  const bus = useShellEventBus();
  useEffect(() => bus.onFocusOut(fn), [bus, fn]);
}

export function useShellKeyDown(fn: (event: KeyboardEvent) => void): void {
  const bus = useShellEventBus();
  useEffect(() => bus.onKeyDown(fn), [bus, fn]);
}
