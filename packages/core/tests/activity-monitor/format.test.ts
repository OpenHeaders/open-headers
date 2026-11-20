/**
 * The figures as text (the activity monitor plan §6, law 6; §7, fork
 * 8): "CPU %" per core on macOS and Linux and as a share of the machine
 * on Windows; what could not be read is a dash, never zero. The
 * platform is an argument, so both conventions run on every OS.
 */

import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_MONITOR_UNREADABLE,
  cpuPercentConvention,
  formatCpuPercent,
  formatMemory,
  formatStartTime,
} from '../../src/activity-monitor/format';

describe('formatCpuPercent', () => {
  it('counts per core on macOS and Linux — a process can pass 100 %', () => {
    expect(cpuPercentConvention('darwin')).toBe('per-core');
    expect(cpuPercentConvention('linux')).toBe('per-core');
    expect(formatCpuPercent(0.402, 'darwin', 10)).toBe('40.2%');
    expect(formatCpuPercent(3.917, 'linux', 8)).toBe('391.7%');
  });

  it('counts a share of the whole machine on Windows', () => {
    expect(cpuPercentConvention('win32')).toBe('machine-share');
    expect(formatCpuPercent(0.402, 'win32', 10)).toBe('4.0%');
    expect(formatCpuPercent(8, 'win32', 8)).toBe('100.0%');
  });

  it('reads a dash for a rate that could not be read, and 0.0% for a true zero', () => {
    expect(formatCpuPercent(null, 'darwin', 10)).toBe(ACTIVITY_MONITOR_UNREADABLE);
    expect(formatCpuPercent(null, 'win32', 10)).toBe(ACTIVITY_MONITOR_UNREADABLE);
    expect(formatCpuPercent(0, 'darwin', 10)).toBe('0.0%');
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
