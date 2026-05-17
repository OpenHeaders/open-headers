/**
 * Repeat-URL statistics for the Timing tab.
 *
 * When the user is looking at request #N to URL X, it's often valuable
 * to know "is this typical, or unusually slow?" Chrome can't answer that
 * without manual sorting/filtering. We have all entries in scope, so we
 * compute min/median/max across every request to the same URL in the
 * current session and surface whether the selected one is the slowest /
 * fastest of the bunch.
 */

import type { InspectorRequest } from './types';

export interface RepeatStats {
  /** Total occurrences of this URL in the current session, including the selected one. */
  count: number;
  /** Per-request durations (ms), sorted ascending. */
  durations: readonly number[];
  fastestMs: number;
  medianMs: number;
  slowestMs: number;
  /** ms of the entry the user is currently inspecting. */
  selectedMs: number;
  /** True when the selected entry's duration equals the slowest of the set. */
  selectedIsSlowest: boolean;
  /** True when the selected entry's duration equals the fastest of the set. */
  selectedIsFastest: boolean;
  /** Per-entry cache status tally — surfaces "all 3 hits were cache misses". */
  cacheCounts: {
    miss: number;
    memory: number;
    disk: number;
    serviceWorker: number;
  };
}

function isCacheMemory(entry: InspectorRequest): boolean {
  return entry.harEntry._fromCache === 'memory';
}

function isCacheDisk(entry: InspectorRequest): boolean {
  return entry.harEntry._fromCache === 'disk';
}

function isCacheServiceWorker(entry: InspectorRequest): boolean {
  return entry.harEntry._fromCache === 'service-worker';
}

/**
 * Computes repeat-URL stats for the selected entry against the supplied
 * entries list. Returns `null` when the URL only occurs once (no
 * comparison set) so the view can hide the section entirely.
 */
export function computeRepeatStats(
  selected: InspectorRequest,
  allEntries: readonly InspectorRequest[],
): RepeatStats | null {
  const same: InspectorRequest[] = [];
  for (const e of allEntries) {
    if (e.url === selected.url && e.method === selected.method) same.push(e);
  }
  if (same.length < 2) return null;

  const durations = same
    .map((e) => e.duration ?? 0)
    .filter((d) => d > 0)
    .sort((a, b) => a - b);
  if (durations.length === 0) return null;

  const fastestMs = durations[0];
  const slowestMs = durations[durations.length - 1];
  const medianMs =
    durations.length % 2 === 1
      ? durations[(durations.length - 1) / 2]
      : (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2;
  const selectedMs = selected.duration ?? 0;

  const cacheCounts = { miss: 0, memory: 0, disk: 0, serviceWorker: 0 };
  for (const e of same) {
    if (isCacheMemory(e)) cacheCounts.memory++;
    else if (isCacheDisk(e)) cacheCounts.disk++;
    else if (isCacheServiceWorker(e)) cacheCounts.serviceWorker++;
    else cacheCounts.miss++;
  }

  return {
    count: same.length,
    durations,
    fastestMs,
    medianMs,
    slowestMs,
    selectedMs,
    selectedIsSlowest: selectedMs > 0 && selectedMs >= slowestMs,
    selectedIsFastest: selectedMs > 0 && selectedMs <= fastestMs,
    cacheCounts,
  };
}
