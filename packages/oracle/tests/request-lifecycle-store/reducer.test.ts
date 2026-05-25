/**
 * Pure reducer tests — invariants 3, 5, 6 each asserted by name.
 *
 * Invariants 1 + 2 are not the reducer's responsibility; they live in
 * the store's keyed map + per-tab partition + `forgetTab` (covered in
 * `store.test.ts`).
 */

import { describe, expect, it } from 'vitest';

import { reduce } from '../../src/request-lifecycle-store/reducer';
import { makeLifecycle } from './factories';

describe('reducer — invariant 3 (monotonic steady-phase advance)', () => {
  it('accepts forward advance pending → headers-received → completed', () => {
    let state = makeLifecycle();
    const r1 = reduce(state, {
      kind: 'phase',
      tabId: 1,
      requestId: 'req-1',
      patch: { phase: 'headers-received', statusCode: 200 },
    });
    expect(r1.kind).toBe('update');
    if (r1.kind !== 'update') return;
    state = r1.next;

    const r2 = reduce(state, {
      kind: 'phase',
      tabId: 1,
      requestId: 'req-1',
      patch: { phase: 'completed', completedAtMs: 2_000 },
    });
    expect(r2.kind).toBe('update');
    if (r2.kind !== 'update') return;
    expect(r2.next.phase).toBe('completed');
  });

  it('rejects retrograde advance completed → headers-received', () => {
    const state = makeLifecycle({ phase: 'completed', completedAtMs: 2_000, statusCode: 200 });
    const r = reduce(state, {
      kind: 'phase',
      tabId: 1,
      requestId: 'req-1',
      patch: { phase: 'headers-received' },
    });
    expect(r).toEqual({ kind: 'reject', reason: 'phase-retrograde' });
  });

  it('rejects terminal-to-terminal swap completed → failed', () => {
    const state = makeLifecycle({ phase: 'completed', completedAtMs: 2_000 });
    const r = reduce(state, {
      kind: 'phase',
      tabId: 1,
      requestId: 'req-1',
      patch: { phase: 'failed', error: { code: 'net::ERR_FAILED', reason: 'failed' } },
    });
    expect(r).toEqual({ kind: 'reject', reason: 'phase-terminal-swap' });
  });

  it('accepts same-phase patch (refinement without phase change)', () => {
    const state = makeLifecycle({ phase: 'headers-received', statusCode: 200 });
    const r = reduce(state, {
      kind: 'phase',
      tabId: 1,
      requestId: 'req-1',
      patch: { phase: 'headers-received', statusText: 'OK' },
    });
    expect(r.kind).toBe('update');
    if (r.kind !== 'update') return;
    expect(r.next.statusText).toBe('OK');
  });
});

describe('reducer — invariant 5 (monotonic information content)', () => {
  it('allows refining error.code from net::* to oh:*', () => {
    const state = makeLifecycle({
      phase: 'failed',
      error: { code: 'net::ERR_FAILED', reason: 'failed' },
    });
    // Same-phase patch with a refined error code.
    const r = reduce(state, {
      kind: 'phase',
      tabId: 1,
      requestId: 'req-1',
      patch: { error: { code: 'oh:cors-missing-acao', reason: 'missing-acao' } },
    });
    expect(r.kind).toBe('update');
    if (r.kind !== 'update') return;
    expect(r.next.error?.code).toBe('oh:cors-missing-acao');
  });

  it('rejects patch that would clear a previously-set field', () => {
    const state = makeLifecycle({ phase: 'headers-received', statusCode: 200 });
    // Construct the rejection-shaped patch using `as const`-style runtime
    // values; TypeScript optional fields are explicitly undefined here.
    const r = reduce(state, {
      kind: 'phase',
      tabId: 1,
      requestId: 'req-1',
      patch: { statusCode: undefined },
    });
    expect(r).toEqual({ kind: 'reject', reason: 'patch-disappearance' });
  });

  it('absent fields in patch are unchanged (trivially refining)', () => {
    const state = makeLifecycle({ phase: 'headers-received', statusCode: 200, statusText: 'OK' });
    const r = reduce(state, {
      kind: 'phase',
      tabId: 1,
      requestId: 'req-1',
      patch: { phase: 'completed', completedAtMs: 2_000 },
    });
    expect(r.kind).toBe('update');
    if (r.kind !== 'update') return;
    expect(r.next.statusCode).toBe(200);
    expect(r.next.statusText).toBe('OK');
  });
});

describe('reducer — invariant 6 (redirect is the sole retrograde transition)', () => {
  it('appends a hop, resets phase to pending, increments hop count, updates url', () => {
    const state = makeLifecycle({ phase: 'headers-received', statusCode: 301 });
    const r = reduce(state, {
      kind: 'redirect',
      tabId: 1,
      requestId: 'req-1',
      hop: {
        sourceUrl: 'https://api.openheaders.io/users',
        redirectUrl: 'https://api.openheaders.io/v2/users',
        statusCode: 301,
        timestampMs: 1_500,
      },
      nextUrl: 'https://api.openheaders.io/v2/users',
    });
    expect(r.kind).toBe('update');
    if (r.kind !== 'update') return;
    expect(r.next.phase).toBe('pending');
    expect(r.next.redirectHopCount).toBe(1);
    expect(r.next.redirectHops).toHaveLength(1);
    expect(r.next.url).toBe('https://api.openheaders.io/v2/users');
    expect(r.next.hopStartedAtMs).toBe(1_500);
    // Per-hop fields reset (the load-bearing carve-out from invariant 5).
    expect(r.next.statusCode).toBeUndefined();
  });

  it('rejects redirect arriving from a terminal phase', () => {
    const state = makeLifecycle({ phase: 'completed', completedAtMs: 2_000 });
    const r = reduce(state, {
      kind: 'redirect',
      tabId: 1,
      requestId: 'req-1',
      hop: {
        sourceUrl: 'https://api.openheaders.io/users',
        redirectUrl: 'https://api.openheaders.io/v2/users',
        statusCode: 301,
        timestampMs: 1_500,
      },
      nextUrl: 'https://api.openheaders.io/v2/users',
    });
    expect(r).toEqual({ kind: 'reject', reason: 'redirect-from-terminal' });
  });

  it('rejects redirect on unknown request', () => {
    const r = reduce(undefined, {
      kind: 'redirect',
      tabId: 1,
      requestId: 'req-missing',
      hop: {
        sourceUrl: 'https://api.openheaders.io/users',
        redirectUrl: 'https://api.openheaders.io/v2/users',
        statusCode: 301,
        timestampMs: 1_500,
      },
      nextUrl: 'https://api.openheaders.io/v2/users',
    });
    expect(r).toEqual({ kind: 'reject', reason: 'unknown-request' });
  });
});

describe('reducer — insert / delete / noop semantics', () => {
  it('inserts on started for a fresh key', () => {
    const lifecycle = makeLifecycle();
    const r = reduce(undefined, { kind: 'started', lifecycle });
    expect(r).toEqual({ kind: 'insert', next: lifecycle });
  });

  it('rejects duplicate started for an existing key', () => {
    const lifecycle = makeLifecycle();
    const r = reduce(lifecycle, { kind: 'started', lifecycle });
    expect(r).toEqual({ kind: 'reject', reason: 'duplicate-started' });
  });

  it('produces delete on gone for a known key', () => {
    const r = reduce(makeLifecycle(), { kind: 'gone', tabId: 1, requestId: 'req-1' });
    expect(r).toEqual({ kind: 'delete' });
  });

  it('produces noop on gone for an unknown key', () => {
    const r = reduce(undefined, { kind: 'gone', tabId: 1, requestId: 'req-1' });
    expect(r).toEqual({ kind: 'noop' });
  });

  it('rejects phase patch on an unknown key', () => {
    const r = reduce(undefined, {
      kind: 'phase',
      tabId: 1,
      requestId: 'req-1',
      patch: { phase: 'completed' },
    });
    expect(r).toEqual({ kind: 'reject', reason: 'unknown-request' });
  });
});

describe('reducer — har / body attachment', () => {
  it('inserts har entry at the given hop index', () => {
    const state = makeLifecycle();
    const r = reduce(state, {
      kind: 'har-attached',
      tabId: 1,
      requestId: 'req-1',
      hopIndex: 0,
      har: { startedDateTime: '2026-05-25T00:00:00.000Z' },
    });
    expect(r.kind).toBe('update');
    if (r.kind !== 'update') return;
    expect(r.next.har.size).toBe(1);
    expect(r.next.har.has(0)).toBe(true);
  });
});
