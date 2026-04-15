/**
 * useFocusRegion — region focus API for the shell.
 *
 * Single source of truth for the DOM↔region mapping. It:
 *
 *   1. OBSERVES focus changes — listens at the shell root for `focusin`
 *      (keyboard) and `click` in capture phase (mouse / touch).
 *
 *   2. IMPOSES focus — exposes `focusRegion(key)` which walks a per-region
 *      selector list and moves DOM focus into the first match, falling
 *      back to the region container (which carries tabIndex={-1}) when no
 *      descendant is focusable. The focusin listener then picks up the
 *      change and writes `focusedRegion`.
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
 *
 * SoC: all DOM querying lives here. The shell component (App.tsx) calls
 * `focusRegion('left')` without knowing anything about selectors or
 * raf timing. The workspace state machine (useWorkspaceLayout) knows
 * nothing about DOM focus at all.
 */

import { type RefObject, useCallback, useEffect, useMemo } from 'react';
import { ALL_DOCK_SLOTS } from '../tool-windows';
import type { DockSlot, FocusRegion } from '../types';

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
 * container itself (which carries tabIndex={-1} in App.tsx). Ordering
 * matters — we want the user to land on an interactive element if the
 * panel has one, and on a semantic anchor (like the currently-active
 * tab) otherwise.
 */
const REGION_FOCUS_SELECTORS: Record<Exclude<FocusRegion, null>, string> = {
  left: '[data-region="left"] input, [data-region="left"] [tabindex="0"], [data-region="left"] button',
  right: '[data-region="right"] button, [data-region="right"] [tabindex="0"], [data-region="right"] a',
  bottom: '[data-region="bottom"] [role="tab"], [data-region="bottom"] button, [data-region="bottom"] [tabindex="0"]',
  editor:
    '[data-region="editor"] .rules-tab.active, [data-region="editor"] .rules-tab, [data-region="editor"] input, [data-region="editor"] textarea, [data-region="editor"] button',
};

export interface UseFocusRegionOptions {
  /** Ref to the shell root. The hook listens at this element. */
  shellRef: RefObject<HTMLElement | null>;
  /** Called with the newly focused region, or null if focus left the shell. */
  setFocusedRegion: (region: FocusRegion) => void;
  /**
   * Called with the dock slot that currently owns focus, or null if focus
   * left every dock (editor, topbar, portal). Per-dock focus lights up a
   * single tool-window tab instead of every tab in the same region.
   */
  setFocusedDock?: (slot: DockSlot | null) => void;
}

export interface FocusRegionApi {
  /**
   * Imperatively move keyboard focus into the given region. Runs on the
   * next animation frame so React has a chance to commit any layout
   * changes (e.g. opening a collapsed pane) before we query the DOM.
   * Called with null is a no-op.
   */
  focusRegion: (region: FocusRegion) => void;
}

export function useFocusRegion({ shellRef, setFocusedRegion, setFocusedDock }: UseFocusRegionOptions): FocusRegionApi {
  useEffect(() => {
    const root = shellRef.current;
    if (!root) return;

    // Shared region-from-target helper. Returns null when the target is
    // outside the shell (portal content) or has no region ancestor.
    const regionFromTarget = (target: EventTarget | null): Exclude<FocusRegion, null> | null => {
      if (!(target instanceof HTMLElement)) return null;
      if (!root.contains(target)) return null;
      const regionEl = target.closest<HTMLElement>('[data-region]');
      if (!regionEl) return null;
      const key = regionEl.getAttribute('data-region');
      return isKnownRegion(key) ? key : null;
    };

    // Dock-from-target — walks up to the nearest [data-dock-slot] inside
    // the shell. Returns null when the target is in the editor, topbar,
    // an activity-bar group without a dock body, or a portal.
    const dockFromTarget = (target: EventTarget | null): DockSlot | null => {
      if (!(target instanceof HTMLElement)) return null;
      if (!root.contains(target)) return null;
      const el = target.closest<HTMLElement>('[data-dock-slot]');
      if (!el) return null;
      const key = el.getAttribute('data-dock-slot');
      return isDockSlot(key) ? key : null;
    };

    const commitFromTarget = (target: EventTarget | null) => {
      const region = regionFromTarget(target);
      if (!region) return;
      setFocusedRegion(region);
      if (setFocusedDock) {
        const slot = dockFromTarget(target);
        if (slot) setFocusedDock(slot);
        else if (region === 'editor') setFocusedDock(null);
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      commitFromTarget(event.target);
    };

    // Capture-phase click so stopPropagation in children doesn't swallow
    // the region update. Click (not pointerdown) so right-clicks and drag
    // gestures don't move focus.
    const handleClick = (event: MouseEvent) => {
      commitFromTarget(event.target);
    };

    const handleFocusOut = (event: FocusEvent) => {
      // If focus is leaving the shell entirely (e.g., user clicks another
      // browser tab's devtools pane), clear the accent so stale highlights
      // don't linger on return. We only clear when relatedTarget is null
      // AND outside the shell — Ant portals set relatedTarget to the
      // triggering element, which stays inside the shell.
      const next = event.relatedTarget as HTMLElement | null;
      if (!next) {
        setFocusedRegion(null);
        setFocusedDock?.(null);
        return;
      }
      if (!root.contains(next)) {
        setFocusedRegion(null);
        setFocusedDock?.(null);
      }
    };

    root.addEventListener('focusin', handleFocusIn);
    root.addEventListener('focusout', handleFocusOut);
    root.addEventListener('click', handleClick, true);
    return () => {
      root.removeEventListener('focusin', handleFocusIn);
      root.removeEventListener('focusout', handleFocusOut);
      root.removeEventListener('click', handleClick, true);
    };
  }, [shellRef, setFocusedRegion, setFocusedDock]);

  // ── Imperative API ──────────────────────────────────────────────

  const focusRegion = useCallback(
    (region: FocusRegion) => {
      if (!region) return;
      const root = shellRef.current;
      if (!root) return;
      // Defer to the next frame so React can commit any state changes
      // the caller made immediately before (e.g. opening the pane).
      requestAnimationFrame(() => {
        const selector = REGION_FOCUS_SELECTORS[region];
        const match = root.querySelector<HTMLElement>(selector);
        if (match) {
          match.focus();
          // The focusin listener will set focusedRegion — but only if the
          // focused element is actually inside a [data-region]. We also
          // proactively write it here so the state flips immediately
          // even when the focus target hasn't been parented yet (e.g.
          // Allotment still animating the pane open).
          setFocusedRegion(region);
          return;
        }
        // Last-resort fallback — focus the region container. The container
        // carries tabIndex={-1} in the shell markup so .focus() works.
        const container = root.querySelector<HTMLElement>(`[data-region="${region}"]`);
        if (container) {
          container.focus();
          setFocusedRegion(region);
        } else {
          // The region is collapsed and has no DOM — still update state
          // so the activity bar highlight is correct. Used when the
          // caller asks to focus a region whose panel the caller itself
          // just closed (in practice: never, since we always open first,
          // but defensive).
          setFocusedRegion(region);
        }
      });
    },
    [shellRef, setFocusedRegion],
  );

  return useMemo(() => ({ focusRegion }), [focusRegion]);
}
