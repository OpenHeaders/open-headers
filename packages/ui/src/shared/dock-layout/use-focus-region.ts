/**
 * useFocusRegion — region focus API for the tool-window shell.
 *
 * Single source of truth for the DOM-to-region mapping. It:
 *
 *   1. OBSERVES focus changes — listens via the shell event bus for
 *      `focusin` (keyboard) and `click` in capture phase (mouse/touch).
 *
 *   2. IMPOSES focus — exposes `focusRegion(key)` which walks a
 *      per-region selector list and moves DOM focus into the first
 *      match, falling back to the region container (which carries
 *      tabIndex={-1}) when no descendant is focusable.
 *
 * Recognized region keys (declared via `data-region` attributes):
 *
 *   data-region="left"    left Allotment pane content
 *   data-region="editor"  center editor area
 *   data-region="bottom"  bottom Allotment pane content
 *   data-region="right"   right Allotment pane content
 *
 * Ant Design renders dropdowns, modals, and tooltips into a portal at
 * document.body — those elements are NOT descendants of any region. We
 * treat focus landing there as "no region change" so the last real
 * region remains highlighted while the portal is open.
 */

import { type RefObject, useCallback, useMemo } from 'react';
import { ALL_DOCK_SLOTS, dockRegion } from './constants';
import { useShellClickCapture, useShellFocusIn, useShellFocusOut } from './shell-event-bus';
import type { DockSlot, FocusRegion } from './types';

const KNOWN_REGIONS: readonly FocusRegion[] = ['left', 'editor', 'bottom', 'right'] as const;

function isKnownRegion(value: string | null): value is Exclude<FocusRegion, null> {
  return value !== null && (KNOWN_REGIONS as readonly string[]).includes(value);
}

function isDockSlot(value: string | null): value is DockSlot {
  return value !== null && (ALL_DOCK_SLOTS as readonly string[]).includes(value);
}

/**
 * Per-region "preferred focus target" selector lists. The first match
 * wins; when every selector misses, the caller falls back to the region
 * container itself (which carries tabIndex={-1}). Ordering matters — we
 * want the user to land on an interactive element if the panel has one,
 * and on a semantic anchor (like the currently-active tab) otherwise.
 */
const REGION_FOCUS_SELECTORS: Record<Exclude<FocusRegion, null>, string> = {
  left: '[data-region="left"] input, [data-region="left"] [tabindex="0"], [data-region="left"] button',
  right: '[data-region="right"] button, [data-region="right"] [tabindex="0"], [data-region="right"] a',
  bottom: '[data-region="bottom"] [role="tab"], [data-region="bottom"] button, [data-region="bottom"] [tabindex="0"]',
  editor:
    '[data-region="editor"] .rules-tab.active, [data-region="editor"] .rules-tab, [data-region="editor"] input, [data-region="editor"] textarea, [data-region="editor"] button',
};

export interface UseFocusRegionOptions {
  shellRef: RefObject<HTMLElement | null>;
  setFocusedRegion: (region: FocusRegion) => void;
  setFocusedDock?: (slot: DockSlot | null) => void;
  /**
   * Optional function to schedule a callback on the next animation
   * frame. Used by the imperative `focusRegion()` method to defer DOM
   * focus until React has committed layout changes. When omitted, falls
   * back to bare `requestAnimationFrame`.
   */
  scheduleFrame?: (fn: () => void) => void;
}

export interface FocusRegionApi {
  focusRegion: (region: FocusRegion) => void;
  /**
   * Move DOM focus into `slot`'s dock body and commit the store to
   * match. Unlike {@link focusRegion} this never depends on the
   * focusin-commit chain: the store is set explicitly after the focus
   * lands, so callers outside a user gesture (the companion-reveal
   * broadcast) get the focused-dock highlight even when a window-front
   * focus restoration races the imposed focus. A panel that already
   * holds DOM focus (the terminal's xterm grabs it on attach) keeps
   * it — only the store is committed then.
   */
  focusDock: (slot: DockSlot) => void;
}

export function useFocusRegion({
  shellRef,
  setFocusedRegion,
  setFocusedDock,
  scheduleFrame: schedule,
}: UseFocusRegionOptions): FocusRegionApi {
  const raf = schedule ?? ((fn: () => void) => requestAnimationFrame(fn));

  const regionFromTarget = useCallback(
    (target: EventTarget | null): Exclude<FocusRegion, null> | null => {
      const root = shellRef.current;
      if (!root || !(target instanceof HTMLElement)) return null;
      if (!root.contains(target)) return null;
      const regionEl = target.closest<HTMLElement>('[data-region]');
      if (!regionEl) return null;
      const key = regionEl.getAttribute('data-region');
      return isKnownRegion(key) ? key : null;
    },
    [shellRef],
  );

  const dockFromTarget = useCallback(
    (target: EventTarget | null): DockSlot | null => {
      const root = shellRef.current;
      if (!root || !(target instanceof HTMLElement)) return null;
      if (!root.contains(target)) return null;
      const el = target.closest<HTMLElement>('[data-dock-slot]');
      if (!el) return null;
      const key = el.getAttribute('data-dock-slot');
      return isDockSlot(key) ? key : null;
    },
    [shellRef],
  );

  const commitFromTarget = useCallback(
    (target: EventTarget | null) => {
      // Elements inside a `data-focus-skip` subtree are meta-actions
      // (Hide, Options, …) — they apply TO the panel rather than
      // indicating "user is working inside it". Skip the focus commit
      // so clicking Hide on panel B while panel A is focused keeps
      // A's focused state intact. Parallels the existing `data-region`
      // and `data-dock-slot` attribute contracts in this hook.
      if (target instanceof HTMLElement && target.closest('[data-focus-skip]')) {
        return;
      }
      const region = regionFromTarget(target);
      if (!region) return;
      setFocusedRegion(region);
      if (setFocusedDock) {
        const slot = dockFromTarget(target);
        if (slot) setFocusedDock(slot);
        else if (region === 'editor') setFocusedDock(null);
      }
    },
    [regionFromTarget, dockFromTarget, setFocusedRegion, setFocusedDock],
  );

  useShellClickCapture(useCallback((event: MouseEvent) => commitFromTarget(event.target), [commitFromTarget]));

  useShellFocusIn(useCallback((event: FocusEvent) => commitFromTarget(event.target), [commitFromTarget]));

  useShellFocusOut(
    useCallback(
      (event: FocusEvent) => {
        const root = shellRef.current;
        const next = event.relatedTarget as HTMLElement | null;
        if (!next) {
          setFocusedRegion(null);
          setFocusedDock?.(null);
          return;
        }
        if (root && !root.contains(next)) {
          setFocusedRegion(null);
          setFocusedDock?.(null);
        }
      },
      [shellRef, setFocusedRegion, setFocusedDock],
    ),
  );

  const focusDock = useCallback(
    (slot: DockSlot) => {
      const root = shellRef.current;
      if (!root) return;
      raf(() => {
        // The dock BODY, not the tab strip — both carry the slot attr.
        const body = root.querySelector<HTMLElement>(`[data-dock-slot="${slot}"]:not([role="tablist"])`);
        if (!body) return;
        if (!body.contains(document.activeElement)) body.focus({ preventScroll: true });
        setFocusedRegion(dockRegion(slot));
        setFocusedDock?.(slot);
      });
    },
    [shellRef, setFocusedRegion, setFocusedDock, raf],
  );

  const focusRegion = useCallback(
    (region: FocusRegion) => {
      if (!region) return;
      const root = shellRef.current;
      if (!root) return;
      raf(() => {
        const selector = REGION_FOCUS_SELECTORS[region];
        const match = root.querySelector<HTMLElement>(selector);
        if (match) {
          match.focus();
          setFocusedRegion(region);
          return;
        }
        const container = root.querySelector<HTMLElement>(`[data-region="${region}"]`);
        if (container) {
          container.focus();
          setFocusedRegion(region);
        } else {
          setFocusedRegion(region);
        }
      });
    },
    [shellRef, setFocusedRegion, raf],
  );

  return useMemo(() => ({ focusRegion, focusDock }), [focusRegion, focusDock]);
}
