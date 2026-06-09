/**
 * HAR-only lifecycle synthesis — the canceled-while-queued fix.
 *
 * A failure-shaped HAR entry (the host's recorded `_error` verdict) that
 * spends the whole forward-race window un-joined describes a request
 * `webRequest` never saw. The correlator mints an `oh-har:` lifecycle
 * from the entry instead of dropping it, so the panel shows the host's
 * `(canceled)` row and the Resource Timing reconciliation stops
 * misreading the orphaned entry as a memory-cache hit.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { describe, expect, it, vi } from 'vitest';

import type { CorrelatorDiagnostics } from '../../src/correlator-heuristic/correlator';
import { HeuristicCorrelator } from '../../src/correlator-heuristic/correlator';
import type { WebRequestEvent, WebRequestEventSource } from '../../src/correlator-heuristic/events';
import type { HarEvent, HarEventSource } from '../../src/correlator-heuristic/har-events';
import { HAR_FAILURE_HOLD_MS, HAR_FORWARD_HOLD_MS } from '../../src/correlator-heuristic/late-arrival-constants';
import { RequestLifecycleStore } from '../../src/request-lifecycle-store';

/** In-memory webRequest source for tests. */
class TestWebRequestSource implements WebRequestEventSource {
  private readonly listeners = new Set<(event: WebRequestEvent) => void>();

  subscribe(listener: (event: WebRequestEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: WebRequestEvent): void {
    for (const fn of this.listeners) fn(event);
  }
}

/** In-memory HAR source for tests. */
class TestHarSource implements HarEventSource {
  private readonly listeners = new Set<(event: HarEvent) => void>();

  subscribe(listener: (event: HarEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: HarEvent): void {
    for (const fn of this.listeners) fn(event);
  }
}

const TAB = 7;
const URL_A = 'https://assets.openheaders.io/app.js';
const STARTED_AT_MS = 1_700_000_000_000;
const STARTED_AT_ISO = new Date(STARTED_AT_MS).toISOString();
const PAST_WINDOW_MS = STARTED_AT_MS + HAR_FORWARD_HOLD_MS + 1;

/** The shape Chrome delivers for a request canceled while renderer-queued. */
function canceledEntry(overrides?: Partial<InspectorHarEntry>): InspectorHarEntry {
  return {
    startedDateTime: STARTED_AT_ISO,
    time: 397.9,
    _resourceType: 'script',
    request: {
      method: 'GET',
      url: URL_A,
      headers: [
        { name: 'Referer', value: 'https://openheaders.io/' },
        { name: 'User-Agent', value: 'test-agent' },
      ],
      queryString: [],
    },
    response: {
      status: 0,
      statusText: '',
      headers: [],
      content: { size: 0, mimeType: 'x-unknown' },
      _transferSize: 0,
      _error: 'net::ERR_ABORTED',
    },
    timings: { blocked: 397.9, dns: -1, connect: -1, send: 0, wait: 0, receive: 0 },
    ...overrides,
  };
}

function setup(diagnostics?: CorrelatorDiagnostics) {
  const webRequest = new TestWebRequestSource();
  const har = new TestHarSource();
  const correlator = new HeuristicCorrelator({ webRequest, har }, diagnostics);
  correlator.attachTab(TAB);
  const updates: RequestLifecycleUpdate[] = [];
  correlator.subscribe((u) => updates.push(u));
  return { webRequest, har, correlator, updates };
}

describe('HeuristicCorrelator — HAR-only synthesis on expiry', () => {
  it('mints an oh-har lifecycle from a failure-shaped entry that expires un-joined', () => {
    const { har, correlator, updates } = setup();
    har.emit({ kind: 'har-entry', tabId: TAB, entry: canceledEntry() });
    expect(updates).toHaveLength(0);

    correlator.gcTick(PAST_WINDOW_MS);
    expect(updates.map((u) => u.kind)).toEqual(['started', 'phase', 'har-attached', 'phase']);

    const started = updates[0];
    if (started.kind !== 'started') throw new Error('expected started');
    expect(started.lifecycle.requestId).toMatch(/^oh-har:/);
    expect(started.lifecycle.url).toBe(URL_A);
    expect(started.lifecycle.resourceType).toBe('script');
    expect(started.lifecycle.startedAtMs).toBe(STARTED_AT_MS);

    const headersPatch = updates[1];
    if (headersPatch.kind !== 'phase') throw new Error('expected phase');
    expect(headersPatch.patch.requestHeadersProvisional).toBe(true);
    expect(headersPatch.patch.requestHeaders).toEqual([
      { name: 'Referer', value: 'https://openheaders.io/' },
      { name: 'User-Agent', value: 'test-agent' },
    ]);

    const terminal = updates[3];
    if (terminal.kind !== 'phase') throw new Error('expected phase');
    expect(terminal.patch.phase).toBe('failed');
    expect(terminal.patch.error).toEqual({ code: 'net::ERR_ABORTED', reason: 'net::ERR_ABORTED' });
    // Status 0 must NOT become a statusCode — the status cell's
    // `(canceled)` rendering requires no code.
    expect(terminal.patch.statusCode).toBeUndefined();
    expect(terminal.patch.completedAtMs).toBeCloseTo(STARTED_AT_MS + 397.9, 5);
    correlator.dispose();
  });

  it('failure entries ride the short fuse — synthesized at HAR_FAILURE_HOLD_MS, not the 5s default', () => {
    const { har, correlator, updates } = setup();
    har.emit({ kind: 'har-entry', tabId: TAB, entry: canceledEntry() });

    correlator.gcTick(STARTED_AT_MS + HAR_FAILURE_HOLD_MS - 100);
    expect(updates).toHaveLength(0);

    correlator.gcTick(STARTED_AT_MS + HAR_FAILURE_HOLD_MS + 1);
    expect(updates.some((u) => u.kind === 'started' && u.lifecycle.requestId.startsWith('oh-har:'))).toBe(true);
    correlator.dispose();
  });

  it('clean entries keep the default window — still held when the failure fuse has elapsed', () => {
    const onHarWaitingDrop = vi.fn();
    const { har, correlator } = setup({ onHarWaitingDrop });
    const entry = canceledEntry();
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: {
        ...entry,
        response: {
          status: 200,
          statusText: 'OK',
          headers: [],
          content: { size: 0, mimeType: 'text/plain' },
          _error: null,
        },
      },
    });

    correlator.gcTick(STARTED_AT_MS + HAR_FAILURE_HOLD_MS + 1);
    expect(onHarWaitingDrop).not.toHaveBeenCalled();

    correlator.gcTick(STARTED_AT_MS + HAR_FORWARD_HOLD_MS + 1);
    expect(onHarWaitingDrop).toHaveBeenCalledTimes(1);
    correlator.dispose();
  });

  it('round-trips through the store as a failed lifecycle with the entry attached', () => {
    const { har, correlator } = setup();
    const onReject = vi.fn();
    const store = new RequestLifecycleStore({ onReject });
    correlator.subscribe((u) => store.apply(u));

    har.emit({ kind: 'har-entry', tabId: TAB, entry: canceledEntry() });
    correlator.gcTick(PAST_WINDOW_MS);

    const all = store.snapshotTab(TAB);
    expect(all).toHaveLength(1);
    const lc = all[0];
    expect(lc.phase).toBe('failed');
    expect(lc.error?.code).toBe('net::ERR_ABORTED');
    expect(lc.statusCode).toBeUndefined();
    expect(lc.har[0]?.response?.status).toBe(0);
    expect(lc.requestHeadersProvisional).toBe(true);
    expect(onReject).not.toHaveBeenCalled();
    correlator.dispose();
  });

  it('carries a real status code when the entry has one (200-then-abort)', () => {
    const { har, correlator, updates } = setup();
    const entry = canceledEntry();
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: {
        ...entry,
        response: {
          status: 200,
          statusText: 'OK',
          headers: [],
          content: { size: 0, mimeType: 'text/plain' },
          _error: 'net::ERR_ABORTED',
        },
      },
    });
    correlator.gcTick(PAST_WINDOW_MS);

    const terminal = updates.at(-1);
    if (terminal?.kind !== 'phase') throw new Error('expected phase');
    expect(terminal.patch.statusCode).toBe(200);
    expect(terminal.patch.statusText).toBe('OK');
    expect(terminal.patch.error?.code).toBe('net::ERR_ABORTED');
    correlator.dispose();
  });

  it('does NOT synthesize a clean entry — non-failure expiries keep the drop semantics', () => {
    const onHarWaitingDrop = vi.fn();
    const { har, correlator, updates } = setup({ onHarWaitingDrop });
    const entry = canceledEntry();
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: {
        ...entry,
        response: {
          status: 200,
          statusText: 'OK',
          headers: [],
          content: { size: 0, mimeType: 'text/plain' },
          _error: null,
        },
      },
    });
    correlator.gcTick(PAST_WINDOW_MS);

    expect(updates).toHaveLength(0);
    expect(onHarWaitingDrop).toHaveBeenCalledTimes(1);
    expect(onHarWaitingDrop.mock.calls[0][0]).toMatchObject({ tabId: TAB, reason: 'expired' });
    correlator.dispose();
  });

  it('never synthesizes when the failure HAR joins a real lifecycle', () => {
    const { webRequest, har, correlator, updates } = setup();
    webRequest.emit({
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: 'wr-9',
      url: URL_A,
      method: 'GET',
      type: 'script',
      timeStamp: STARTED_AT_MS,
    });
    har.emit({ kind: 'har-entry', tabId: TAB, entry: canceledEntry() });
    correlator.gcTick(PAST_WINDOW_MS);

    const harAttached = updates.filter((u) => u.kind === 'har-attached');
    expect(harAttached).toHaveLength(1);
    expect(harAttached[0]?.kind === 'har-attached' && harAttached[0].requestId).toBe('wr-9');
    expect(updates.some((u) => u.kind === 'started' && u.lifecycle.requestId.startsWith('oh-har:'))).toBe(false);
    correlator.dispose();
  });

  it('forward race still wins: a late onBeforeRequest drains the held entry, no synthesis', () => {
    const { webRequest, har, correlator, updates } = setup();
    har.emit({ kind: 'har-entry', tabId: TAB, entry: canceledEntry() });
    webRequest.emit({
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: 'wr-late',
      url: URL_A,
      method: 'GET',
      type: 'script',
      timeStamp: STARTED_AT_MS + 50,
    });
    correlator.gcTick(PAST_WINDOW_MS);

    const harAttached = updates.filter((u) => u.kind === 'har-attached');
    expect(harAttached).toHaveLength(1);
    expect(harAttached[0]?.kind === 'har-attached' && harAttached[0].requestId).toBe('wr-late');
    expect(updates.some((u) => u.kind === 'started' && u.lifecycle.requestId.startsWith('oh-har:'))).toBe(false);
    correlator.dispose();
  });

  it('attaches a late body to the synthesized lifecycle via the body-join map', () => {
    const { har, correlator, updates } = setup();
    har.emit({ kind: 'har-entry', tabId: TAB, entry: canceledEntry() });
    correlator.gcTick(PAST_WINDOW_MS);
    const started = updates.find((u) => u.kind === 'started');
    if (started?.kind !== 'started') throw new Error('expected started');

    har.emit({
      kind: 'har-body',
      tabId: TAB,
      body: { method: 'GET', url: URL_A, startedDateTime: STARTED_AT_ISO, content: '', encoding: '' },
    });
    const body = updates.find((u) => u.kind === 'body-attached');
    expect(body?.kind === 'body-attached' && body.requestId).toBe(started.lifecycle.requestId);
    correlator.dispose();
  });

  it('mints distinct ids for sibling synthesized entries', () => {
    const { har, correlator, updates } = setup();
    har.emit({ kind: 'har-entry', tabId: TAB, entry: canceledEntry() });
    har.emit({
      kind: 'har-entry',
      tabId: TAB,
      entry: canceledEntry({ request: { method: 'GET', url: `${URL_A}?v=2`, headers: [], queryString: [] } }),
    });
    correlator.gcTick(PAST_WINDOW_MS);

    const ids = updates.filter((u) => u.kind === 'started').map((u) => u.kind === 'started' && u.lifecycle.requestId);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    correlator.dispose();
  });

  it('does not synthesize for a detached tab — detach clears the held buffer', () => {
    const { har, correlator, updates } = setup();
    har.emit({ kind: 'har-entry', tabId: TAB, entry: canceledEntry() });
    correlator.detachTab(TAB);
    correlator.gcTick(PAST_WINDOW_MS);
    expect(updates).toHaveLength(0);
    correlator.dispose();
  });
});
