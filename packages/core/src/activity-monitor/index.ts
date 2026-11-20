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
  foldCpuCounters,
  processIdentity,
} from './cpu-rate';
export {
  ACTIVITY_MONITOR_UNREADABLE,
  type CpuPercentConvention,
  cpuPercentConvention,
  formatCpuPercent,
  formatMemory,
  formatStartTime,
  formatTimeUntil,
} from './format';
export {
  ACTIVITY_MONITOR_PROCESS_KINDS,
  ACTIVITY_MONITOR_SERVICE_KINDS,
  type ActivityMonitorCursor,
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
  sumReadable,
} from './model';
