/**
 * `@openheaders/core/activity-monitor` — the activity monitor's model,
 * its pure folds and its formatters (the activity monitor plan §9).
 * Zero platform dependencies: the host owns every read, and nothing
 * here leaves the machine.
 */

export {
  type CpuCounterFold,
  type CpuCounterRead,
  type CpuCounterState,
  cpuRateBetween,
  foldCpuCounters,
  processIdentity,
} from './cpu-rate';
export {
  ACTIVITY_MONITOR_UNREADABLE,
  type CpuPercentConvention,
  cpuPercentConvention,
  cpuScaleTop,
  formatCpuPercent,
  formatMemory,
  formatSpan,
  formatStartTime,
  formatTimeUntil,
} from './format';
export {
  ACTIVITY_MONITOR_HISTORY_BASELINE_MAX_AGE_MS,
  ACTIVITY_MONITOR_HISTORY_BEAT_MS,
  ACTIVITY_MONITOR_HISTORY_DEPTH,
  ACTIVITY_MONITOR_HISTORY_SPAN_MS,
  type ActivityMonitorHistory,
  type ActivityMonitorHistoryRead,
  type ActivityMonitorSeriesSample,
  appendHistoryBeat,
  EMPTY_ACTIVITY_MONITOR_HISTORY,
  endedProcesses,
  historyBeatsSince,
  historyCursor,
  historySpanMs,
  mergeHistoryBeats,
  observeHistoryProcesses,
  processCpuSeries,
  seriesPeak,
  totalSeries,
} from './history';
export {
  ACTIVITY_MONITOR_PROCESS_KINDS,
  ACTIVITY_MONITOR_SERVICE_KINDS,
  type ActivityMonitorCursor,
  type ActivityMonitorEndedProcess,
  type ActivityMonitorHistoryBeat,
  type ActivityMonitorHistoryPoint,
  type ActivityMonitorMemoryKind,
  type ActivityMonitorPeer,
  type ActivityMonitorPlatform,
  type ActivityMonitorProcessKind,
  type ActivityMonitorProcessRow,
  type ActivityMonitorServiceKind,
  type ActivityMonitorServiceRow,
  type ActivityMonitorServiceState,
  type ActivityMonitorSnapshot,
  type ArrangedProcessRows,
  arrangeProcessRows,
  compareProcessOrder,
  countProcesses,
  sumReadable,
} from './model';
export {
  ACTIVITY_MONITOR_SORT_COLUMNS,
  type ActivityMonitorSort,
  type ActivityMonitorSortColumn,
  compareProcessRows,
  holdProcessOrder,
  nextProcessSort,
  sortedProcessIds,
} from './sort';
export { sparklinePath } from './sparkline';
