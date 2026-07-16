/**
 * Memory-cache HAR-only lifecycle synthesis.
 *
 * A renderer memory-cache hit fires no webRequest events, so its devtools
 * entry (self-identifying: `_fromCache: 'memory'`) has no lifecycle to
 * join — and a held one can mis-attach to a later same-URL wire request
 * (probe-proven). The correlator mints an `oh-har:` lifecycle from the
 * entry eagerly and never offers it to the FIFO join or the waiting
 * buffer.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';

import { HeuristicCorrelator } from '../../src/correlator-heuristic/correlator';
import type { WebRequestEvent, WebRequestEventSource } from '../../src/correlator-heuristic/events';
import type { HarEvent, HarEventSource } from '../../src/correlator-heuristic/har-events';
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

const TAB = 11;
const URL_A = 'https://assets.openheaders.io/logo.gif';
const STARTED_AT_MS = 1_700_000_000_000;
const STARTED_AT_ISO = new Date(STARTED_AT_MS).toISOString();

/** The shape Chrome delivers for a renderer memory-cache hit. */
function memoryCacheEntry(overrides?: Partial<InspectorHarEntry>): InspectorHarEntry {
  return {
    startedDateTime: STARTED_AT_ISO,
    time: 0,
    _resourceType: 'image',
    _fromCache: 'memory',
    request: {
      method: 'GET',
      url: URL_A,
      headers: [
        { name: 'Referer', value: 'https://openheaders.io/' },
        { name: 'Accept', value: 'image/*' },
      ],
      queryString: [],
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: [{ name: 'Content-Type', value: 'image/gif' }],
      content: { size: 252, mimeType: 'image/gif' },
      _transferSize: 0,
    },
    ...overrides,
  };
}

/** A wire-crossing entry for the same URL (no cache markers). */
function wireEntry(): InspectorHarEntry {
  const entry = memoryCacheEntry({ startedDateTime: new Date(STARTED_AT_MS + 500).toISOString() });
  const { _fromCache: _drop, ...rest } = entry;
  return { ...rest, response: { ...entry.response!, _transferSize: 252 } };
}

function setup() {
  const webRequest = new TestWebRequestSource();
  const har = new TestHarSource();
  const correlator = new HeuristicCorrelator({ webRequest, har });
  correlator.attachTab(TAB);
  const updates: RequestLifecycleUpdate[] = [];
  correlator.subscribe((u) => updates.push(u));
  return { webRequest, har, correlator, updates };
}

describe('HeuristicCorrelator — memory-cache HAR-only synthesis', () => {
  it('mints an oh-har lifecycle eagerly — no join window, no gc tick needed', () => {
    const { har, correlator, updates } = setup();
    har.emit({ kind: 'har-entry', tabId: TAB, entry: memoryCacheEntry() });

    expect(updates.map((u) => u.kind)).toEqual(['started', 'phase', 'har-attached', 'phase']);
    const started = updates[0];
    if (started.kind !== 'started') throw new Error('expected started');
    expect(started.lifecycle.requestId).toMatch(/^oh-har:/);
    expect(started.lifecycle.url).toBe(URL_A);
    expect(started.lifecycle.resourceType).toBe('image');

    const attached = updates[2];
    if (attached.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(attached.har._ohHeaderCapture).toEqual({ request: 'raw', response: 'effective' });
    expect(attached.har._ohEntrySource).toBe('devtools');

    const terminal = updates[3];
    if (terminal.kind !== 'phase') throw new Error('expected phase');
    expect(terminal.patch.phase).toBe('completed');
    expect(terminal.patch.fromCache).toBe(true);
    expect(terminal.patch.statusCode).toBe(200);
    correlator.dispose();
  });

  it('never mis-joins a later same-URL wire request — both rows keep their own entries', () => {
    const { webRequest, har, correlator, updates } = setup();
    // The memory-cache entry arrives first (no FIFO record exists).
    har.emit({ kind: 'har-entry', tabId: TAB, entry: memoryCacheEntry() });
    // A real same-URL wire request follows inside what would have been
    // the entry's hold window…
    webRequest.emit({
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: 'wr-1',
      url: URL_A,
      method: 'GET',
      type: 'image',
      timeStamp: STARTED_AT_MS + 500,
    });
    // …and its own devtools entry lands.
    har.emit({ kind: 'har-entry', tabId: TAB, entry: wireEntry() });

    const attached = updates.filter((u) => u.kind === 'har-attached');
    expect(attached).toHaveLength(2);
    const byRequest = new Map(attached.map((u) => (u.kind === 'har-attached' ? [u.requestId, u.har] : ['', {}])));
    const wireHar = byRequest.get('wr-1') as InspectorHarEntry;
    expect(wireHar.response?._transferSize).toBe(252);
    expect(wireHar._fromCache).toBeUndefined();
    const memId = [...byRequest.keys()].find((id) => id.startsWith('oh-har:'));
    expect(memId).toBeDefined();
    expect((byRequest.get(memId as string) as InspectorHarEntry)._fromCache).toBe('memory');
    correlator.dispose();
  });

  it('disk-cache entries keep the FIFO join — webRequest fires for those', () => {
    const { webRequest, har, correlator, updates } = setup();
    webRequest.emit({
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: 'wr-disk',
      url: URL_A,
      method: 'GET',
      type: 'image',
      timeStamp: STARTED_AT_MS,
    });
    har.emit({ kind: 'har-entry', tabId: TAB, entry: memoryCacheEntry({ _fromCache: 'disk' }) });

    const attached = updates.filter((u) => u.kind === 'har-attached');
    expect(attached).toHaveLength(1);
    expect(attached[0]?.kind === 'har-attached' && attached[0].requestId).toBe('wr-disk');
    expect(updates.some((u) => u.kind === 'started' && u.lifecycle.requestId.startsWith('oh-har:'))).toBe(false);
    correlator.dispose();
  });

  it('round-trips through the store as a completed cache lifecycle with full headers', () => {
    const { har, correlator } = setup();
    const store = new RequestLifecycleStore();
    correlator.subscribe((u) => store.apply(u));
    har.emit({ kind: 'har-entry', tabId: TAB, entry: memoryCacheEntry() });

    const all = store.snapshotTab(TAB);
    expect(all).toHaveLength(1);
    const lc = all[0];
    expect(lc.phase).toBe('completed');
    expect(lc.fromCache).toBe(true);
    expect(lc.statusCode).toBe(200);
    expect(lc.har[0]?._fromCache).toBe('memory');
    expect(lc.har[0]?.request?.headers).toHaveLength(2);
    expect(lc.requestHeadersProvisional).toBe(true);
    correlator.dispose();
  });

  it('attaches a late body to the minted lifecycle via the body-join map', () => {
    const { har, correlator, updates } = setup();
    har.emit({ kind: 'har-entry', tabId: TAB, entry: memoryCacheEntry() });
    const started = updates.find((u) => u.kind === 'started');
    if (started?.kind !== 'started') throw new Error('expected started');

    har.emit({
      kind: 'har-body',
      tabId: TAB,
      body: { method: 'GET', url: URL_A, startedDateTime: STARTED_AT_ISO, content: 'GIF89a', encoding: '' },
    });
    const body = updates.find((u) => u.kind === 'body-attached');
    expect(body?.kind === 'body-attached' && body.requestId).toBe(started.lifecycle.requestId);
    correlator.dispose();
  });

  it('ignores entries for a detached tab', () => {
    const { har, correlator, updates } = setup();
    correlator.detachTab(TAB);
    har.emit({ kind: 'har-entry', tabId: TAB, entry: memoryCacheEntry() });
    expect(updates).toHaveLength(0);
    correlator.dispose();
  });
});

describe('HeuristicCorrelator — join-only HAR posture', () => {
  function setupJoinOnly() {
    const webRequest = new TestWebRequestSource();
    const har = new TestHarSource();
    const correlator = new HeuristicCorrelator({ webRequest, har, harPosture: 'join-only' });
    correlator.attachTab(TAB);
    const updates: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => updates.push(u));
    return { webRequest, har, correlator, updates };
  }

  it('drops memory-cache entries instead of minting — the primary correlator owns those', () => {
    const { har, correlator, updates } = setupJoinOnly();
    har.emit({ kind: 'har-entry', tabId: TAB, entry: memoryCacheEntry() });
    expect(updates).toHaveLength(0);
    correlator.dispose();
  });

  it('never synthesizes from an expired failure-shaped entry', () => {
    const { har, correlator, updates } = setupJoinOnly();
    const base = memoryCacheEntry();
    const { _fromCache: _drop, ...failureShaped } = {
      ...base,
      response: { ...base.response!, status: 0, _error: 'net::ERR_ABORTED' },
    };
    har.emit({ kind: 'har-entry', tabId: TAB, entry: failureShaped });
    correlator.gcTick(STARTED_AT_MS + 60_000);
    expect(updates.some((u) => u.kind === 'started')).toBe(false);
    correlator.dispose();
  });

  it('still joins entries to its own webRequest-minted rows', () => {
    const { webRequest, har, correlator, updates } = setupJoinOnly();
    webRequest.emit({
      method_kind: 'onBeforeRequest',
      tabId: TAB,
      requestId: 'wr-join',
      url: URL_A,
      method: 'GET',
      type: 'image',
      timeStamp: STARTED_AT_MS + 500,
    });
    har.emit({ kind: 'har-entry', tabId: TAB, entry: wireEntry() });
    const attached = updates.filter((u) => u.kind === 'har-attached');
    expect(attached).toHaveLength(1);
    expect(attached[0]?.kind === 'har-attached' && attached[0].requestId).toBe('wr-join');
    correlator.dispose();
  });
});
