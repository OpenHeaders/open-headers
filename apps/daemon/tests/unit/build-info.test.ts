import { describe, expect, it } from 'vitest';
import { type DaemonBuildInfo, formatBuildStamp, getBuildInfo } from '../../src/build-info';

describe('build-info', () => {
  it('answers null when running unbundled (no Vite define)', () => {
    expect(getBuildInfo()).toBeNull();
  });

  it('formats the stamp appended after a version string', () => {
    const info: DaemonBuildInfo = {
      version: '2026.7.0',
      commit: 'a3f9c21',
      commitFull: 'a3f9c21'.padEnd(40, '0'),
      build: 4523,
      date: '2026-07-09T14:23:00.000Z',
      channel: 'stable',
    };
    expect(formatBuildStamp(info)).toBe(' (commit a3f9c21 · build 4523 · 2026-07-09)');
  });

  it('omits the day when the build date is empty and the whole stamp when info is null', () => {
    const info: DaemonBuildInfo = {
      version: '2026.7.0',
      commit: 'a3f9c21',
      commitFull: 'a3f9c21'.padEnd(40, '0'),
      build: 0,
      date: '',
      channel: 'stable',
    };
    expect(formatBuildStamp(info)).toBe(' (commit a3f9c21 · build 0)');
    expect(formatBuildStamp(null)).toBe('');
  });
});
