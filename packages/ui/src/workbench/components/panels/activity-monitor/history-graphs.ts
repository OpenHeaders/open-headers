/**
 * The history as the panel draws it (the activity monitor plan §8): one
 * path per process row and two for the header's line, each across the
 * history there is — full from its first beats, an hour once the ring
 * holds one. Built once per
 * beat — the history's identity changes every fifteen seconds, not on
 * the two-second pull — so a figure changing in place redraws no graph.
 */

import {
  type ActivityMonitorHistoryBeat,
  historySpanMs,
  processCpuSeries,
  seriesPeak,
  sparklinePath,
  totalSeries,
} from '@openheaders/core/activity-monitor';

export const ROW_GRAPH = { width: 100, height: 14 };
export const SUMMARY_GRAPH = { width: 120, height: 16 };

export interface ProcessGraph {
  path: string;
  /** The highest rate the hour holds for the process; null when it holds none. */
  peak: number | null;
}

export interface HistoryGraphs {
  /** The time every graph spans — the history there is, up to the hour; 0 before the first beat. */
  spanMs: number;
  cpuTotal: string;
  memoryTotal: string;
  /** By process identity — every process with a point in the hour, running or ended. */
  processes: ReadonlyMap<string, ProcessGraph>;
}

/**
 * `cpuTop` is the ONE top of scale every CPU graph shares (the plan §7,
 * fork 8). Memory has no such figure: its line runs from zero to the
 * hour's own highest total.
 */
export function buildHistoryGraphs(history: readonly ActivityMonitorHistoryBeat[], cpuTop: number): HistoryGraphs {
  const processes = new Map<string, ProcessGraph>();
  for (const beat of history) {
    for (const id of Object.keys(beat.points)) {
      if (processes.has(id)) continue;
      const series = processCpuSeries(history, id);
      processes.set(id, {
        path: sparklinePath(series, ROW_GRAPH.width, ROW_GRAPH.height, cpuTop),
        peak: seriesPeak(series),
      });
    }
  }
  const memory = totalSeries(history, 'memoryBytes');
  return {
    spanMs: historySpanMs(history),
    cpuTotal: sparklinePath(totalSeries(history, 'cpuRate'), SUMMARY_GRAPH.width, SUMMARY_GRAPH.height, cpuTop),
    memoryTotal: sparklinePath(memory, SUMMARY_GRAPH.width, SUMMARY_GRAPH.height, seriesPeak(memory) ?? 0),
    processes,
  };
}
