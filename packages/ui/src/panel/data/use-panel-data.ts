/**
 * `usePanelData` — the panel's single data-projection hook.
 *
 * A thin `useMemo` wrapper over the pure `projectPanelData` projector. The
 * memo dependency list is what bounds how often the full recompute runs;
 * the notify-scheduler (see `snapshot-publisher.ts` / `notify-scheduler.ts`)
 * bounds how often those dependencies change per frame during a live
 * capture. All projection logic — and the tests around it — live in
 * `./panel-data-projection`, which stays React-free so the replay harness
 * can drive it directly and a future incremental path can test against it.
 *
 * App.tsx composes this with `useLifecycleClient` / `usePageClient` /
 * `useFireClient`.
 */

import { useMemo } from 'react';

import { projectPanelData, type UsePanelDataInput, type UsePanelDataResult } from './panel-data-projection';

export type { UsePanelDataInput, UsePanelDataResult } from './panel-data-projection';

export function usePanelData(input: UsePanelDataInput): UsePanelDataResult {
  const { lifecycle, page, fire, opts, navClearFloorMs = -1, recordingWindows, resourceTiming } = input;

  // Each client store hands out an identity-stable snapshot that changes
  // reference only on a real mutation, so memoizing on the snapshot
  // objects reruns the projection once per batched notify, not once per
  // wire frame.
  return useMemo(
    () => projectPanelData({ lifecycle, page, fire, opts, navClearFloorMs, recordingWindows, resourceTiming }),
    [lifecycle, page, fire, opts, navClearFloorMs, recordingWindows, resourceTiming],
  );
}
