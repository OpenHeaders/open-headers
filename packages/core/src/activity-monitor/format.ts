/**
 * The activity monitor's figures as text (the activity monitor plan §6,
 * law 6): what could not be read reads as a dash, never as zero.
 */

export const ACTIVITY_MONITOR_UNREADABLE = '—';

/**
 * The whole machine as a CPU rate (the plan §7, fork 8): every core
 * busy. "CPU %" is a share of it on every system — 100 % is the whole
 * machine, never one core — and it is the top of every CPU graph: one
 * scale for every graph, never a scale per row.
 */
export function cpuScaleTop(logicalCores: number): number {
  return Math.max(1, logicalCores);
}

export function formatCpuPercent(cpuRate: number | null, logicalCores: number): string {
  if (cpuRate === null) return ACTIVITY_MONITOR_UNREADABLE;
  return `${((cpuRate * 100) / cpuScaleTop(logicalCores)).toFixed(1)}%`;
}

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

export function formatMemory(bytes: number | null): string {
  if (bytes === null) return ACTIVITY_MONITOR_UNREADABLE;
  if (bytes < MB) return `${Math.round(bytes / KB)} KB`;
  if (bytes < GB) return `${Math.round(bytes / MB)} MB`;
  return `${(bytes / GB).toFixed(2)} GB`;
}

interface StartTimeFormatters {
  day: Intl.DateTimeFormat;
  time: Intl.DateTimeFormat;
  date: Intl.DateTimeFormat;
}

const startTimeFormatters = new Map<string, StartTimeFormatters>();

function startTimeFormattersFor(locale: string | undefined, timeZone: string | undefined): StartTimeFormatters {
  const key = `${locale ?? ''}|${timeZone ?? ''}`;
  let formatters = startTimeFormatters.get(key);
  if (formatters === undefined) {
    formatters = {
      day: new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }),
      time: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }),
      date: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone }),
    };
    startTimeFormatters.set(key, formatters);
  }
  return formatters;
}

/**
 * When a process started: the time of day while that day is still
 * today, the date once it is not — a tray app runs for days, and a bare
 * "09:00" from yesterday would read as this morning.
 */
export function formatStartTime(startedAt: number, now: number, locale?: string, timeZone?: string): string {
  const formatters = startTimeFormattersFor(locale, timeZone);
  return formatters.day.format(startedAt) === formatters.day.format(now)
    ? formatters.time.format(startedAt)
    : formatters.date.format(startedAt);
}

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const SPAN_UNIT_MS = { second: SECOND_MS, minute: MINUTE_MS, hour: HOUR_MS, day: DAY_MS };

const spanFormatters = new Map<string, Intl.NumberFormat>();

/**
 * A length of time in the locale's short words ("6 hr"), rounded DOWN —
 * an hour and fifty minutes of uptime is not yet two hours: seconds
 * under a minute, minutes under two hours, hours under two days, days
 * beyond.
 */
export function formatSpan(ms: number, locale?: string): string {
  const span = Math.max(0, ms);
  const unit = span < MINUTE_MS ? 'second' : span < 2 * HOUR_MS ? 'minute' : span < 2 * DAY_MS ? 'hour' : 'day';
  const key = `${locale ?? ''}|${unit}`;
  let formatter = spanFormatters.get(key);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short' });
    spanFormatters.set(key, formatter);
  }
  return formatter.format(Math.floor(span / SPAN_UNIT_MS[unit]));
}

const timeUntilFormatters = new Map<string, Intl.RelativeTimeFormat>();

/**
 * How long until an instant, in the locale's own words ("in 42 sec."):
 * seconds under a minute, minutes under an hour, hours under two days,
 * days beyond. An instant already passed reads as zero seconds — a
 * refresh that is due is about to run, never "ago".
 */
export function formatTimeUntil(at: number, now: number, locale?: string): string {
  const key = locale ?? '';
  let formatter = timeUntilFormatters.get(key);
  if (formatter === undefined) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'always', style: 'short' });
    timeUntilFormatters.set(key, formatter);
  }
  const ahead = Math.max(0, at - now);
  if (ahead < MINUTE_MS) return formatter.format(Math.round(ahead / SECOND_MS), 'second');
  if (ahead < HOUR_MS) return formatter.format(Math.round(ahead / MINUTE_MS), 'minute');
  if (ahead < 2 * DAY_MS) return formatter.format(Math.round(ahead / HOUR_MS), 'hour');
  return formatter.format(Math.round(ahead / DAY_MS), 'day');
}
