/**
 * The activity monitor's figures as text (the activity monitor plan §6,
 * law 6): what could not be read reads as a dash, never as zero.
 */

import type { ActivityMonitorPlatform } from './model';

export const ACTIVITY_MONITOR_UNREADABLE = '—';

/**
 * How "CPU %" is counted (the plan §7, fork 8): per core where the
 * system's own monitor counts it so — a process can pass 100 % — and as
 * a share of the whole machine where it does not.
 */
export type CpuPercentConvention = 'per-core' | 'machine-share';

export function cpuPercentConvention(platform: ActivityMonitorPlatform): CpuPercentConvention {
  return platform === 'win32' ? 'machine-share' : 'per-core';
}

export function formatCpuPercent(
  cpuRate: number | null,
  platform: ActivityMonitorPlatform,
  logicalCores: number,
): string {
  if (cpuRate === null) return ACTIVITY_MONITOR_UNREADABLE;
  const percent =
    cpuPercentConvention(platform) === 'machine-share' ? (cpuRate * 100) / Math.max(1, logicalCores) : cpuRate * 100;
  return `${percent.toFixed(1)}%`;
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
