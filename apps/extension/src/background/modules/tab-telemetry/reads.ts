/**
 * Snapshot reads — projections of a tab's telemetry state,
 * shallow-copied so callers can mutate safely.
 */

import type { RequestRecord, TabTelemetrySnapshot } from '@openheaders/core/types';
import { tabs } from './state';

/**
 * Build an empty snapshot. Returned as a fresh object (not a shared frozen
 * singleton) so callers that shallow-mutate the response — e.g. pushing
 * into `fires` during unit tests — don't have to know whether they hit
 * the tracked or untracked path.
 */
function emptySnapshot(): TabTelemetrySnapshot {
  return { counters: {}, fires: [], byRule: {}, uniqueRequestCount: 0 };
}

/**
 * Full telemetry snapshot for a tab. Arrays and objects are shallow copies,
 * safe for the caller to mutate without affecting internal state.
 */
export function getTabSnapshot(tabId: number): TabTelemetrySnapshot {
  const state = tabs.get(tabId);
  if (!state) return emptySnapshot();

  const counters: Record<string, number> = {};
  for (const [uid, count] of state.counters) counters[uid] = count;

  const byRule: Record<string, RequestRecord[]> = {};
  const uniqueUrls = new Set<string>();
  for (const [uid, urlMap] of state.uniquesByRule) {
    const records: RequestRecord[] = [];
    for (const [normalized, record] of urlMap) {
      records.push(record);
      uniqueUrls.add(normalized);
    }
    byRule[uid] = records;
  }

  return {
    counters,
    fires: [...state.fires],
    byRule,
    uniqueRequestCount: uniqueUrls.size,
  };
}
