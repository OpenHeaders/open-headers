/**
 * useNarrowLayout — option-A narrow mode: below the single-surface
 * threshold the shell shows ONE surface at a time (the editor or one
 * tool region), with the activity bars as the switcher.
 *
 * The controller never mutates the persisted dock layout. It keeps a
 * view-local "preferred surface" and derives the effective one against
 * the live dock state (`resolveSingleSurface`), so re-widening the
 * panel restores exactly the layout the user last persisted. User
 * gestures move the preference:
 *
 *   - activating a tool window (activity bar, reveal seams) → that
 *     window's region becomes the surface
 *   - opening an editor document (request select, storage/rule
 *     documents) → the editor becomes the surface
 *   - the last editor tab closing → back to the first region with
 *     content
 *
 * Gesture observation happens by decorating the DockLayoutApi's
 * activation methods — every caller (activity bars, toolbar toggles,
 * the App's reveal helpers) already routes through them, so no other
 * call site needs narrow-awareness.
 */

import type { DockLayoutApi } from '@openheaders/ui/shared/dock-layout';
import { dockRegion } from '@openheaders/ui/shared/dock-layout';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initialSingleSurface, resolveSingleSurface, type SingleSurface } from './single-surface';

export interface NarrowLayoutApi<T extends string> {
  /** The decorated layout API — hand this to every consumer (shell,
   *  toolbar, status bar) in place of the raw one. Pass-through except
   *  that activation methods also update the narrow surface. */
  tl: DockLayoutApi<T>;
  /** The surface the shell should render exclusively — null when the
   *  panel is wide enough for the normal multi-column layout. */
  surface: SingleSurface | null;
  /** Note an explicit "show me the document" gesture (e.g. selecting a
   *  request whose tab is already open — no tab-count change to observe). */
  showEditor: () => void;
}

interface UseNarrowLayoutOptions<T extends string> {
  tl: DockLayoutApi<T>;
  /** True below the single-surface width threshold. */
  narrow: boolean;
  /** Open editor-tab count — drives the open/close transitions. */
  tabCount: number;
}

export function useNarrowLayout<T extends string>({
  tl,
  narrow,
  tabCount,
}: UseNarrowLayoutOptions<T>): NarrowLayoutApi<T> {
  const [preferred, setPreferred] = useState<SingleSurface>(() => initialSingleSurface(tabCount > 0, tl.state));

  // Rising edge of narrow: land on the document if one is open, else
  // the first region with content. (While wide, the preference is
  // dormant — no need to track anything.)
  const wasNarrowRef = useRef(narrow);
  const tlRef = useRef(tl);
  tlRef.current = tl;
  // biome-ignore lint/correctness/useExhaustiveDependencies: tabCount is read at edge time only — solely the narrow edge triggers
  useEffect(() => {
    if (narrow && !wasNarrowRef.current) {
      setPreferred(initialSingleSurface(tabCount > 0, tlRef.current.state));
    }
    wasNarrowRef.current = narrow;
  }, [narrow]);

  // Tab-count transitions while narrow: a new document pulls the editor
  // forward; the last one closing falls back to a region with content.
  const prevTabCountRef = useRef(tabCount);
  useEffect(() => {
    const prev = prevTabCountRef.current;
    prevTabCountRef.current = tabCount;
    if (!narrow) return;
    if (tabCount > prev) setPreferred('editor');
    else if (tabCount === 0 && prev > 0) setPreferred(initialSingleSurface(false, tlRef.current.state));
  }, [tabCount, narrow]);

  const showEditor = useCallback(() => setPreferred('editor'), []);

  const decorated = useMemo<DockLayoutApi<T>>(() => {
    const surfaceOf = (id: T): SingleSurface | null => {
      const slot = tlRef.current.dockOf(id);
      return slot === null ? null : dockRegion(slot);
    };
    return {
      ...tl,
      activateWindow: (id) => {
        tl.activateWindow(id);
        const s = surfaceOf(id);
        if (s !== null) setPreferred(s);
      },
      toggleWindow: (id) => {
        const slot = tl.dockOf(id);
        const wasActive = slot !== null && tl.state.docks[slot].active === id;
        tl.toggleWindow(id);
        // Activation pulls its region forward; deactivation lets the
        // resolver fall back if the region just emptied.
        if (!wasActive) {
          const s = surfaceOf(id);
          if (s !== null) setPreferred(s);
        }
      },
      restoreWindow: (id, target) => {
        tl.restoreWindow(id, target);
        if (target !== undefined) setPreferred(dockRegion(target));
      },
      toggleRegion: (region) => {
        const wasOpen = tl.isRegionOpen(region);
        tl.toggleRegion(region);
        setPreferred(wasOpen && region === preferred ? 'editor' : region);
      },
    };
  }, [tl, preferred]);

  const surface = narrow ? resolveSingleSurface(preferred, tl.state) : null;

  return useMemo<NarrowLayoutApi<T>>(() => ({ tl: decorated, surface, showEditor }), [decorated, surface, showEditor]);
}
