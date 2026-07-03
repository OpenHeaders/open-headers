/**
 * Repeat-URL statistics for the Timing tab.
 *
 * When the user is looking at request #N to URL X, it's often valuable
 * to know "is this typical, or unusually slow?" We compute min/median/max
 * across every lifecycle to the same URL in the current session and
 * surface whether the selected one is the slowest / fastest of the bunch.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { currentHarEntry } from '../inspector-row-projection';

export interface RepeatStats {
  /** Total occurrences of this URL in the current session, including the selected one. */
  count: number;
  /** Per-lifecycle durations (ms), sorted ascending. */
  durations: readonly number[];
  fastestMs: number;
  medianMs: number;
  slowestMs: number;
  /** ms of the lifecycle the user is currently inspecting. */
  selectedMs: number;
  /** True when the selected lifecycle's duration equals the slowest of the set. */
  selectedIsSlowest: boolean;
  /** True when the selected lifecycle's duration equals the fastest of the set. */
  selectedIsFastest: boolean;
  /** Per-lifecycle cache status tally. */
  cacheCounts: {
    miss: number;
    memory: number;
    disk: number;
    serviceWorker: number;
  };
}

function durationOf(lc: RequestLifecycle): number {
  if (lc.completedAtMs == null) return 0;
  const d = lc.completedAtMs - lc.startedAtMs;
  return d > 0 ? d : 0;
}

function cacheSource(lc: RequestLifecycle): 'memory' | 'disk' | 'service-worker' | null {
  const har = currentHarEntry(lc);
  if (har?.response?._fetchedViaServiceWorker) return 'service-worker';
  const raw = har?._fromCache;
  if (raw === 'memory' || raw === 'disk') return raw;
  if (har?._servedFromCache) return 'memory';
  return null;
}

/**
 * Computes repeat-URL stats for the selected lifecycle against the
 * supplied list. Returns `null` when the URL only occurs once (no
 * comparison set) so the view can hide the section entirely.
 */
export function computeRepeatStats(selected: RequestLifecycle, all: readonly RequestLifecycle[]): RepeatStats | null {
  const same: RequestLifecycle[] = [];
  for (const lc of all) {
    if (lc.url === selected.url && lc.method === selected.method) same.push(lc);
  }
  if (same.length < 2) return null;

  const durations = same
    .map(durationOf)
    .filter((d) => d > 0)
    .sort((a, b) => a - b);
  if (durations.length === 0) return null;

  const fastestMs = durations[0];
  const slowestMs = durations[durations.length - 1];
  const medianMs =
    durations.length % 2 === 1
      ? durations[(durations.length - 1) / 2]
      : (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2;
  const selectedMs = durationOf(selected);

  const cacheCounts = { miss: 0, memory: 0, disk: 0, serviceWorker: 0 };
  for (const lc of same) {
    const src = cacheSource(lc);
    if (src === 'memory') cacheCounts.memory++;
    else if (src === 'disk') cacheCounts.disk++;
    else if (src === 'service-worker') cacheCounts.serviceWorker++;
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
