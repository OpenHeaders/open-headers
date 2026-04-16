/**
 * useFocusRegion — workspace-specific wrapper around the shared hook.
 *
 * Injects the coalesced `scheduleFrame` helper from frame-scheduler so
 * that imperative focus calls (cycleRegion, keyboard shortcuts) all
 * share a single rAF per frame.
 */

import { scheduleFrame } from '@utils/frame-scheduler';
import type { RefObject } from 'react';
import type { DockSlot, FocusRegion, FocusRegionApi } from '@/shared/dock-layout';
import { useFocusRegion as useSharedFocusRegion } from '@/shared/dock-layout';

export type { FocusRegionApi } from '@/shared/dock-layout';

export interface UseFocusRegionOptions {
  shellRef: RefObject<HTMLElement | null>;
  setFocusedRegion: (region: FocusRegion) => void;
  setFocusedDock?: (slot: DockSlot | null) => void;
}

export function useFocusRegion({ shellRef, setFocusedRegion, setFocusedDock }: UseFocusRegionOptions): FocusRegionApi {
  return useSharedFocusRegion({
    shellRef,
    setFocusedRegion,
    setFocusedDock,
    scheduleFrame,
  });
}
