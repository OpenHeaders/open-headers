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

describe('TrafficRetentionRing — failure-body carve-out (S3)', () => {
  const body = {
    method: 'GET',
    url: 'https://api.openheaders.io/users',
    startedDateTime: '2026-08-03T10:00:00.000Z',
    content: '{"error":"stack trace at renew.php:214"}',
    encoding: '',
  };

  function failureRecord(requestId: string) {
    const record = makeRecord(requestId, { phase: 'completed', statusCode: 500, statusText: 'Server Error' });
    record.failureBodyRequested = true;
    return record;
  }

  it('attaches only onto a live, stamped failure record', () => {
    const ring = new TrafficRetentionRing({ maxRecords: 10, maxBytes: 1_000_000 });
    // Unstamped failure — the retention plane never asked: refused.
    ring.upsert(makeRecord('unstamped', { phase: 'completed', statusCode: 500 }));
    expect(ring.attachFailureBody(1, 'unstamped', body)).toBe(false);
    // Stamped success — not a failure: refused.
    const success = makeRecord('success', { phase: 'completed', statusCode: 200 });
    success.failureBodyRequested = true;
    ring.upsert(success);
    expect(ring.attachFailureBody(1, 'success', body)).toBe(false);
    // Unknown identity: refused.
    expect(ring.attachFailureBody(1, 'ghost', body)).toBe(false);
    // Stamped failure: retained, once.
    ring.upsert(failureRecord('failed'));
    expect(ring.attachFailureBody(1, 'failed', body)).toBe(true);
    expect(ring.attachFailureBody(1, 'failed', body)).toBe(false);
  });

  it('surfaces the body only through the includeFailureBody projection option', () => {
    const ring = new TrafficRetentionRing({ maxRecords: 10, maxBytes: 1_000_000 });
    ring.upsert(failureRecord('failed'));
    ring.attachFailureBody(1, 'failed', body);
    expect(JSON.stringify(ring.snapshot())).not.toContain('stack trace');
    const [projected] = ring.snapshot({ includeFailureBody: true });
    expect(projected?.failureBody?.content).toContain('stack trace at renew.php:214');
    expect(projected?.failureBody?.truncated).toBe(false);
    expect(ring.projectOne(1, 'failed', { includeFailureBody: true })?.failureBody).toBeDefined();
    expect(ring.projectOne(1, 'ghost')).toBeNull();
  });

  it('counts the retained body against the byte ceiling', () => {
    const ring = new TrafficRetentionRing({ maxRecords: 10, maxBytes: 1_000_000 });
    ring.upsert(failureRecord('failed'));
    const before = ring.counters().byteSize;
    ring.attachFailureBody(1, 'failed', body);
    expect(ring.counters().byteSize).toBeGreaterThan(before + body.content.length);
  });

  it('replay reconciliation preserves the retained body and the request stamp', () => {
    const ring = new TrafficRetentionRing({ maxRecords: 10, maxBytes: 1_000_000 });
    ring.upsert(failureRecord('failed'));
    ring.attachFailureBody(1, 'failed', body);
    // A reconnect replay re-upserts the same identity WITHOUT the body.
    expect(ring.upsert(makeRecord('failed', { phase: 'completed', statusCode: 500 }))).toBe('updated');
    const [projected] = ring.snapshot({ includeFailureBody: true });
    expect(projected?.failureBody?.content).toContain('stack trace');
    // The carried stamp keeps a re-attach refused (already retained).
    expect(ring.attachFailureBody(1, 'failed', body)).toBe(false);
  });
});
