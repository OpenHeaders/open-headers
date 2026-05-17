import { parseServerTiming } from '@openheaders/ui/panel/data/server-timing';
import { describe, expect, it } from 'vitest';

const SERVER_TIMING = 'Server-Timing';

describe('parseServerTiming', () => {
  it('returns [] when no headers are present', () => {
    expect(parseServerTiming(undefined)).toEqual([]);
    expect(parseServerTiming([])).toEqual([]);
  });

  it('parses a simple single-metric header', () => {
    const out = parseServerTiming([{ name: SERVER_TIMING, value: 'db;dur=53' }]);
    expect(out).toEqual([{ name: 'db', duration: 53, description: null }]);
  });

  it('parses multiple comma-separated metrics in one header', () => {
    const out = parseServerTiming([{ name: SERVER_TIMING, value: 'db;dur=53, render;dur=12' }]);
    expect(out.map((m) => [m.name, m.duration])).toEqual([
      ['db', 53],
      ['render', 12],
    ]);
  });

  it('parses descriptions including quoted commas and semicolons', () => {
    const out = parseServerTiming([{ name: SERVER_TIMING, value: 'cache;desc="hit, fast";dur=2' }]);
    expect(out).toEqual([{ name: 'cache', duration: 2, description: 'hit, fast' }]);
  });

  it('aggregates metrics across multiple Server-Timing headers', () => {
    const out = parseServerTiming([
      { name: SERVER_TIMING, value: 'db;dur=53' },
      { name: SERVER_TIMING, value: 'render;dur=12' },
    ]);
    expect(out.map((m) => m.name)).toEqual(['db', 'render']);
  });

  it('preserves metric name even when dur is absent', () => {
    const out = parseServerTiming([{ name: SERVER_TIMING, value: 'phase1' }]);
    expect(out).toEqual([{ name: 'phase1', duration: null, description: null }]);
  });

  it('is case-insensitive on header name', () => {
    expect(parseServerTiming([{ name: 'server-timing', value: 'db;dur=1' }])).toHaveLength(1);
    expect(parseServerTiming([{ name: 'SERVER-TIMING', value: 'db;dur=1' }])).toHaveLength(1);
  });

  it('ignores non-Server-Timing headers', () => {
    expect(parseServerTiming([{ name: 'X-Other', value: 'db;dur=1' }])).toEqual([]);
  });
});
