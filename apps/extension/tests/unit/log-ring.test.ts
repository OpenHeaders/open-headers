import { describe, expect, it } from 'vitest';
import { DEFAULT_CAPACITY, LogRing } from '@/shared/observability/ring';
import type { LogEntry } from '@/shared/observability/types';

function makeEntry(i: number, overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: 1000 + i,
    subsystem: 'rule-engine',
    op: 'test',
    level: 'info',
    message: `entry-${i}`,
    context: {},
    ...overrides,
  };
}

describe('LogRing', () => {
  it('records entries in insertion order', () => {
    const ring = new LogRing(5);
    ring.record(makeEntry(1));
    ring.record(makeEntry(2));
    ring.record(makeEntry(3));
    expect(ring.getAll().map((e) => e.message)).toEqual(['entry-1', 'entry-2', 'entry-3']);
    expect(ring.size()).toBe(3);
  });

  it('drops oldest entries when capacity is exceeded', () => {
    const ring = new LogRing(3);
    for (let i = 1; i <= 5; i++) ring.record(makeEntry(i));
    expect(ring.getAll().map((e) => e.message)).toEqual(['entry-3', 'entry-4', 'entry-5']);
    expect(ring.size()).toBe(3);
  });

  it('clear() empties the buffer but keeps capacity', () => {
    const ring = new LogRing(3);
    ring.record(makeEntry(1));
    ring.clear();
    expect(ring.size()).toBe(0);
    // Still enforces capacity after clear.
    for (let i = 1; i <= 4; i++) ring.record(makeEntry(i));
    expect(ring.size()).toBe(3);
  });

  it('hydrate() replaces the buffer, truncating oversize snapshots', () => {
    const ring = new LogRing(3);
    ring.hydrate([makeEntry(1), makeEntry(2), makeEntry(3), makeEntry(4), makeEntry(5)]);
    expect(ring.size()).toBe(3);
    expect(ring.getAll().map((e) => e.message)).toEqual(['entry-3', 'entry-4', 'entry-5']);
  });

  it('hydrate() accepts empty snapshots', () => {
    const ring = new LogRing(3);
    ring.record(makeEntry(1));
    ring.hydrate([]);
    expect(ring.size()).toBe(0);
  });

  it('snapshot() is detached — mutating it does not affect the ring', () => {
    const ring = new LogRing(3);
    ring.record(makeEntry(1));
    const snap = ring.snapshot();
    snap.push(makeEntry(99));
    expect(ring.size()).toBe(1);
  });

  it('getAll() is a read-only view of the current entries', () => {
    const ring = new LogRing(3);
    ring.record(makeEntry(1));
    const view = ring.getAll();
    expect(view).toHaveLength(1);
    ring.record(makeEntry(2));
    // Fresh read reflects the new state — but existing `view` was a
    // snapshot taken earlier.
    expect(ring.getAll()).toHaveLength(2);
  });

  it('rejects non-positive capacities', () => {
    expect(() => new LogRing(0)).toThrow();
    expect(() => new LogRing(-1)).toThrow();
  });

  it('default capacity matches DEFAULT_CAPACITY', () => {
    const ring = new LogRing();
    for (let i = 0; i < DEFAULT_CAPACITY + 10; i++) ring.record(makeEntry(i));
    expect(ring.size()).toBe(DEFAULT_CAPACITY);
  });
});
