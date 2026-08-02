/**
 * `TrafficRetentionRing` law pins (AGENT_TRAFFIC_PLAN.md §3, slice S1):
 * dual bounds (count + bytes, byte ceiling trips first when tripped),
 * FIFO eviction, monotonic eviction (no replay resurrection), in-place
 * updates that never re-order, growth-triggered eviction, oversize
 * refusal, and the projection boundary (bodies stripped, resource types
 * normalized).
 */

import { describe, expect, it } from 'vitest';

import { recordFromLifecycle } from '../../src/traffic-retention/record';
import { TrafficRetentionRing } from '../../src/traffic-retention/store';
import { makeHarEntry, makeLifecycle, padding } from './factories';

function makeRecord(requestId: string, overrides: Parameters<typeof makeLifecycle>[0] = {}) {
  return recordFromLifecycle(makeLifecycle({ requestId, ...overrides }), 'heuristic');
}

describe('TrafficRetentionRing — count bound + FIFO order', () => {
  it('evicts oldest-admitted first once the count bound trips', () => {
    const ring = new TrafficRetentionRing({ maxRecords: 3, maxBytes: 1_000_000 });
    for (const id of ['a', 'b', 'c', 'd', 'e']) ring.upsert(makeRecord(id));
    expect(ring.snapshot().map((r) => r.requestId)).toEqual(['c', 'd', 'e']);
    expect(ring.counters().recordCount).toBe(3);
    expect(ring.counters().evictedCount).toBe(2);
  });

  it('an in-place update keeps the record FIFO position and never duplicates', () => {
    const ring = new TrafficRetentionRing({ maxRecords: 3, maxBytes: 1_000_000 });
    for (const id of ['a', 'b', 'c']) ring.upsert(makeRecord(id));
    expect(ring.upsert(makeRecord('a', { method: 'POST' }))).toBe('updated');
    // 'a' is still oldest — the next admission evicts it, not 'b'.
    ring.upsert(makeRecord('d'));
    expect(ring.snapshot().map((r) => r.requestId)).toEqual(['b', 'c', 'd']);
  });
});

describe('TrafficRetentionRing — byte bound', () => {
  it('the byte ceiling trips before the count bound on fat records', () => {
    const fatBytes = 2_000;
    const probe = makeRecord('probe', { initiator: padding(fatBytes) });
    const ring = new TrafficRetentionRing({ maxRecords: 100, maxBytes: 3 * fatBytes });
    for (const id of ['a', 'b', 'c', 'd']) ring.upsert(makeRecord(id, { initiator: padding(fatBytes) }));
    const counters = ring.counters();
    expect(counters.recordCount).toBeLessThan(4);
    expect(counters.evictedCount).toBeGreaterThan(0);
    expect(counters.byteSize).toBeLessThanOrEqual(3 * fatBytes);
    expect(counters.recordCount + counters.evictedCount).toBe(4);
    // Sanity: the padding really dominates the record size.
    expect(JSON.stringify(probe).length).toBeGreaterThan(fatBytes);
  });

  it('a record that GROWS past the ceiling triggers eviction on update', () => {
    const ring = new TrafficRetentionRing({ maxRecords: 100, maxBytes: 2_500 });
    ring.upsert(makeRecord('a'));
    ring.upsert(makeRecord('b'));
    expect(ring.counters().evictedCount).toBe(0);
    // Pad 'b' so the total lands 100 bytes over the ceiling — the ring
    // must evict 'a' (oldest), after which 'b' alone fits again.
    const overflowPad = 2_500 - ring.counters().byteSize + 100;
    ring.update(1, 'b', (record) => {
      record.responseHeaders = [{ name: 'X-Fat', value: padding(overflowPad) }];
    });
    expect(ring.has(1, 'a')).toBe(false);
    expect(ring.has(1, 'b')).toBe(true);
    expect(ring.counters().evictedCount).toBe(1);
    expect(ring.counters().byteSize).toBeLessThanOrEqual(2_500);
  });

  it('a single record larger than the whole ceiling is refused, not admitted over budget', () => {
    const ring = new TrafficRetentionRing({ maxRecords: 100, maxBytes: 500 });
    const outcome = ring.upsert(makeRecord('huge', { initiator: padding(5_000) }));
    expect(outcome).toBe('refused-oversize');
    expect(ring.counters().recordCount).toBe(0);
    expect(ring.counters().evictedCount).toBe(1);
  });
});

describe('TrafficRetentionRing — eviction is monotonic', () => {
  it('an evicted identity is refused on re-admission (replay must not resurrect)', () => {
    const ring = new TrafficRetentionRing({ maxRecords: 1, maxBytes: 1_000_000 });
    ring.upsert(makeRecord('a'));
    ring.upsert(makeRecord('b'));
    expect(ring.has(1, 'a')).toBe(false);
    expect(ring.upsert(makeRecord('a'))).toBe('refused-evicted');
    expect(ring.snapshot().map((r) => r.requestId)).toEqual(['b']);
  });

  it('updates for an evicted identity are silently ignored', () => {
    const ring = new TrafficRetentionRing({ maxRecords: 1, maxBytes: 1_000_000 });
    ring.upsert(makeRecord('a'));
    ring.upsert(makeRecord('b'));
    ring.update(1, 'a', (record) => {
      record.statusCode = 500;
    });
    expect(ring.snapshot().map((r) => r.requestId)).toEqual(['b']);
  });
});

describe('TrafficRetentionRing — projection boundary', () => {
  it('projects size facts and headers but never a body byte', () => {
    const ring = new TrafficRetentionRing({ maxRecords: 10, maxBytes: 1_000_000 });
    const lifecycle = makeLifecycle({
      requestId: 'with-har',
      har: [makeHarEntry({ size: 512, transferSize: 640, bodyText: 'OH-SECRET-BODY-MUST-NOT-BE-RETAINED' })],
    });
    ring.upsert(recordFromLifecycle(lifecycle, 'heuristic'));
    const [projection] = ring.snapshot();
    expect(projection?.bodyBytes).toBe(512);
    expect(projection?.transferBytes).toBe(640);
    expect(projection?.statusCode).toBe(200);
    expect(projection?.mimeType).toBe('application/json');
    expect(JSON.stringify(projection)).not.toContain('OH-SECRET-BODY');
  });

  it('normalizes the per-correlator resourceType vocabulary', () => {
    const ring = new TrafficRetentionRing({ maxRecords: 10, maxBytes: 1_000_000 });
    ring.upsert(makeRecord('wr', { resourceType: 'xmlhttprequest' }));
    ring.upsert(makeRecord('cdp', { resourceType: 'Document' }));
    ring.upsert(makeRecord('unknown', { resourceType: 'someday-new-token' }));
    expect(ring.snapshot().map((r) => r.resourceType)).toEqual(['xhr', 'document', 'other']);
  });
});
