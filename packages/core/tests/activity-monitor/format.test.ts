/**
 * The figures as text (the activity monitor plan §6, law 6; §7, fork
 * 8): "CPU %" as a share of the whole machine on every system; what
 * could not be read is a dash, never zero.
 */

import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_MONITOR_UNREADABLE,
  cpuScaleTop,
  formatCpuPercent,
  formatMemory,
  formatSpan,
  formatStartTime,
  formatTimeUntil,
} from '../../src/activity-monitor/format';

describe('formatCpuPercent', () => {
  it('counts a share of the whole machine — one full core of ten is 10 %, never 100 %', () => {
    expect(formatCpuPercent(1, 10)).toBe('10.0%');
    expect(formatCpuPercent(0.402, 10)).toBe('4.0%');
    expect(formatCpuPercent(3.917, 8)).toBe('49.0%');
  });

  it('reads 100 % only when every core is busy', () => {
    expect(formatCpuPercent(8, 8)).toBe('100.0%');
    expect(formatCpuPercent(64, 64)).toBe('100.0%');
  });

  it('reads a dash for a rate that could not be read, and 0.0% for a true zero', () => {
    expect(formatCpuPercent(null, 10)).toBe(ACTIVITY_MONITOR_UNREADABLE);
    expect(formatCpuPercent(0, 10)).toBe('0.0%');
  });

  it('counts a machine that reports no core as one', () => {
    expect(formatCpuPercent(0.5, 0)).toBe('50.0%');
  });
});

describe('cpuScaleTop', () => {
  it('tops every graph at the whole machine — what 100 % is', () => {
    expect(cpuScaleTop(8)).toBe(8);
    expect(cpuScaleTop(64)).toBe(64);
  });

  it('is never under one core', () => {
    expect(cpuScaleTop(0)).toBe(1);
  });
});

describe('formatSpan', () => {
  it('reads seconds under a minute, minutes under two hours, hours under two days, days beyond', () => {
    expect(formatSpan(42_000, 'en')).toBe('42 sec');
    expect(formatSpan(60 * 60_000, 'en')).toBe('60 min');
    expect(formatSpan(6 * 3_600_000, 'en')).toBe('6 hr');
    expect(formatSpan(4 * 86_400_000, 'en')).toBe('4 days');
  });

  it('rounds down — an hour and fifty-nine minutes is not yet two hours', () => {
    expect(formatSpan(119 * 60_000 + 59_000, 'en')).toBe('119 min');
    expect(formatSpan(2 * 3_600_000, 'en')).toBe('2 hr');
  });

  it('speaks the locale it is given', () => {
    expect(formatSpan(6 * 3_600_000, 'de')).toBe('6 Std.');
  });
});

describe('formatMemory', () => {
  it('reads whole megabytes, and gigabytes to two places', () => {
    expect(formatMemory(218 * 1024 * 1024)).toBe('218 MB');
    expect(formatMemory(1.01 * 1024 * 1024 * 1024)).toBe('1.01 GB');
    expect(formatMemory(512 * 1024)).toBe('512 KB');
  });

  it('reads a dash for memory that could not be read', () => {
    expect(formatMemory(null)).toBe(ACTIVITY_MONITOR_UNREADABLE);
  });
});

describe('formatStartTime', () => {
  const NOW = Date.UTC(2026, 10, 20, 15, 0);

  it('reads the time of day for a process started today', () => {
    expect(formatStartTime(Date.UTC(2026, 10, 20, 14, 55), NOW, 'en', 'UTC')).toBe('14:55');
    expect(formatStartTime(Date.UTC(2026, 10, 20, 9, 0), NOW, 'en', 'UTC')).toBe('09:00');
  });

  it('reads the date for a process started on an earlier day', () => {
    expect(formatStartTime(Date.UTC(2026, 10, 19, 9, 0), NOW, 'en', 'UTC')).toBe('Nov 19');
  });

  it('decides "today" in the given time zone', () => {
    // 23:30 UTC on the 19th is already the 20th in Bucharest.
    expect(formatStartTime(Date.UTC(2026, 10, 19, 23, 30), NOW, 'en', 'Europe/Bucharest')).toBe('01:30');
    expect(formatStartTime(Date.UTC(2026, 10, 19, 23, 30), NOW, 'en', 'UTC')).toBe('Nov 19');
  });
});

describe('formatTimeUntil', () => {
  const NOW = Date.UTC(2026, 10, 20, 15, 0, 0);

  it('reads seconds under a minute, minutes under an hour, hours under two days, days beyond', () => {
    expect(formatTimeUntil(NOW + 42_000, NOW, 'en')).toBe('in 42 sec.');
    expect(formatTimeUntil(NOW + 5 * 60_000, NOW, 'en')).toBe('in 5 min.');
    expect(formatTimeUntil(NOW + 3 * 3_600_000, NOW, 'en')).toBe('in 3 hr.');
    expect(formatTimeUntil(NOW + 4 * 86_400_000, NOW, 'en')).toBe('in 4 days');
  });

  it('reads an instant already passed as zero seconds ahead, never as "ago"', () => {
    expect(formatTimeUntil(NOW - 5_000, NOW, 'en')).toBe('in 0 sec.');
  });

  it('speaks the locale it is given', () => {
    expect(formatTimeUntil(NOW + 42_000, NOW, 'de')).toBe('in 42 Sek.');
  });
});
