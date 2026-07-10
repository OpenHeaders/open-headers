/**
 * Translate a single lifecycle-port lifetime into a tab-telemetry
 * tracking ref-count slot.
 *
 * One `attachPanelWatchingTracker` call per accepted lifecycle port: it
 * adds a uniquely-named reason to `tab-telemetry`'s per-tab `Set<reason>`
 * on connect and removes it on `release()`. The reason carries the tabId
 * (for debuggability) plus a monotonic sequence (so multiple panels
 * watching the same tab — docked devtools + popout, panel + popup — each
 * hold their own slot rather than colliding on a shared key).
 *
 * Stacks cleanly with the other ref-count holders already in the
 * system: `tab-listeners.ts`'s `'active-tab'` reason and any future
 * other reasons. The tab stays tracked while ANY reason is
 * present; tracking releases only when the last holder calls stop.
 */

export interface PanelWatchingTracker {
  release(): void;
}

export interface PanelWatchingTrackerDeps {
  readonly start: (tabId: number, reason: string) => void;
  readonly stop: (tabId: number, reason: string) => void;
}

let seq = 0;

export function attachPanelWatchingTracker(tabId: number, deps: PanelWatchingTrackerDeps): PanelWatchingTracker {
  const reason = `panel-watching:${tabId}:${++seq}`;
  deps.start(tabId, reason);
  let released = false;
  return {
    release(): void {
      if (released) return;
      released = true;
      deps.stop(tabId, reason);
    },
  };
}

export const __internalsForTests = {
  resetSeq(): void {
    seq = 0;
  },
};
