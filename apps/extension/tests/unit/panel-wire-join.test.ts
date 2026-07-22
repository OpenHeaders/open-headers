import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody, InspectorHarEntry } from '@openheaders/core/types';
import { getTranslator } from '@openheaders/i18n';
import type { SupersessionAnchor } from '@openheaders/ui/panel/data/request-state';
import { buildRowAnnotationMessages, classifyRowAnnotations } from '@openheaders/ui/panel/data/row-annotations';
import {
  computeWireJoin,
  EMPTY_WIRE_JOIN,
  mergeWireLayer,
  WIRE_JOIN_WINDOW_MS,
  WireJoinMerger,
} from '@openheaders/ui/panel/data/wire-join';
import {
  clearWireSeenRecords,
  getWireSeen,
  getWireSeenSnapshot,
  recordWireSeen,
} from '@openheaders/ui/panel/data/wire-seen-store';
import { beforeEach, describe, expect, it } from 'vitest';

const T0 = 1_750_000_000_000;

function makeHar(url: string): InspectorHarEntry {
  return {
    startedDateTime: new Date(T0).toISOString(),
    request: { method: 'GET', url, headers: [], queryString: [] },
    response: { status: 200, statusText: 'OK', headers: [], content: { size: 12, mimeType: 'text/html' } },
  } as InspectorHarEntry;
}

function makeRow(opts: Partial<RequestLifecycle> & { requestId: string }): RequestLifecycle {
  return {
    tabId: 7,
    url: 'https://app.openheaders.io/api/data',
    method: 'GET',
    resourceType: 'xhr',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: T0,
    hopStartedAtMs: T0,
    har: [],
    harBodyByHop: [],
    ...opts,
  };
}

function makeWireRow(opts: Partial<RequestLifecycle> & { requestId: string }): RequestLifecycle {
  return makeRow({ tabId: -59210, resourceType: 'other', ...opts });
}

describe('computeWireJoin', () => {
  it('joins on method + url within the window and maps both directions', () => {
    const browser = [makeRow({ requestId: 'b1' })];
    const wire = [makeWireRow({ requestId: 'w1', startedAtMs: T0 + 40 })];
    const join = computeWireJoin(browser, wire);
    expect(join.byBrowserId.get('b1')).toEqual([{ hopIndex: 0, wireRequestId: 'w1' }]);
    expect(join.byWireId.get('w1')).toEqual({ browserRequestId: 'b1', hopIndex: 0 });
  });

  it('never joins across method, url, or the timing window', () => {
    const browser = [
      makeRow({ requestId: 'b1' }),
      makeRow({ requestId: 'b2', url: 'https://app.openheaders.io/other' }),
    ];
    const wire = [
      makeWireRow({ requestId: 'w-method', method: 'POST' }),
      makeWireRow({ requestId: 'w-late', startedAtMs: T0 + WIRE_JOIN_WINDOW_MS + 1 }),
    ];
    expect(computeWireJoin(browser, wire)).toBe(EMPTY_WIRE_JOIN);
  });

  it('matches one-to-one, nearest start first', () => {
    const browser = [
      makeRow({ requestId: 'b1', startedAtMs: T0 }),
      makeRow({ requestId: 'b2', startedAtMs: T0 + 900 }),
    ];
    const wire = [
      makeWireRow({ requestId: 'w1', startedAtMs: T0 + 20 }),
      makeWireRow({ requestId: 'w2', startedAtMs: T0 + 950 }),
    ];
    const join = computeWireJoin(browser, wire);
    expect(join.byBrowserId.get('b1')?.[0]?.wireRequestId).toBe('w1');
    expect(join.byBrowserId.get('b2')?.[0]?.wireRequestId).toBe('w2');
    expect(join.byWireId.size).toBe(2);
  });

  it('joins per hop across a server redirect — one browser row, two wire exchanges', () => {
    const browser = [
      makeRow({
        requestId: 'b1',
        url: 'https://app.openheaders.io/final',
        redirectHopCount: 1,
        redirectHops: [
          {
            sourceUrl: 'https://app.openheaders.io/start',
            redirectUrl: 'https://app.openheaders.io/final',
            statusCode: 302,
            timestampMs: T0 + 100,
          },
        ],
      }),
    ];
    const wire = [
      makeWireRow({ requestId: 'w-start', url: 'https://app.openheaders.io/start', startedAtMs: T0 + 10 }),
      makeWireRow({ requestId: 'w-final', url: 'https://app.openheaders.io/final', startedAtMs: T0 + 120 }),
    ];
    const join = computeWireJoin(browser, wire);
    expect(join.byBrowserId.get('b1')).toEqual([
      { hopIndex: 0, wireRequestId: 'w-start' },
      { hopIndex: 1, wireRequestId: 'w-final' },
    ]);
  });

  it('keys a rule-rewritten wire exchange by its initial url', () => {
    const wire = [
      makeWireRow({
        requestId: 'w1',
        url: 'https://app.openheaders.io/rewritten',
        redirectHopCount: 1,
        redirectHops: [
          {
            sourceUrl: 'https://app.openheaders.io/api/data',
            redirectUrl: 'https://app.openheaders.io/rewritten',
            statusCode: 307,
            timestampMs: T0 + 5,
            internal: true,
          },
        ],
      }),
    ];
    const join = computeWireJoin([makeRow({ requestId: 'b1' })], wire);
    expect(join.byBrowserId.get('b1')?.[0]?.wireRequestId).toBe('w1');
  });

  it('excludes cache-served and non-http browser rows structurally', () => {
    const browser = [
      makeRow({ requestId: 'b-cache', fromCache: true }),
      makeRow({ requestId: 'b-data', url: 'data:text/plain,hi' }),
    ];
    const wire = [makeWireRow({ requestId: 'w1' }), makeWireRow({ requestId: 'w2', url: 'data:text/plain,hi' })];
    expect(computeWireJoin(browser, wire)).toBe(EMPTY_WIRE_JOIN);
  });
});

describe('mergeWireLayer', () => {
  const matches = [{ hopIndex: 0, wireRequestId: 'w1' }];

  it('fills only empty har/body slots from the wire final hop', () => {
    const body: InspectorHarBody = { content: 'wire-body', encoding: '' } as InspectorHarBody;
    const wire = makeWireRow({
      requestId: 'w1',
      har: [makeHar('https://app.openheaders.io/api/data')],
      harBodyByHop: [body],
    });
    const browser = makeRow({ requestId: 'b1' });
    const merged = mergeWireLayer(browser, matches, new Map([['w1', wire]]));
    expect(merged).not.toBe(browser);
    expect(merged.har[0]).toBe(wire.har[0]);
    expect(merged.harBodyByHop[0]).toBe(body);
  });

  it('never overwrites a browser-layer HAR and returns the same object when nothing to add', () => {
    const ownHar = makeHar('https://app.openheaders.io/api/data');
    const wire = makeWireRow({ requestId: 'w1', har: [makeHar('https://app.openheaders.io/api/data')] });
    const browser = makeRow({ requestId: 'b1', har: [ownHar] });
    const merged = mergeWireLayer(browser, matches, new Map([['w1', wire]]));
    expect(merged).toBe(browser);
    expect(merged.har[0]).toBe(ownHar);
  });
});

describe('WireJoinMerger', () => {
  it('keeps merged-row identity until an input actually changes', () => {
    const merger = new WireJoinMerger();
    const matches = [{ hopIndex: 0, wireRequestId: 'w1' }];
    const wire = makeWireRow({ requestId: 'w1', har: [makeHar('https://app.openheaders.io/api/data')] });
    const browser = makeRow({ requestId: 'b1' });
    const byId = new Map([['w1', wire]]);
    const first = merger.merge(browser, matches, byId);
    expect(merger.merge(browser, matches, byId)).toBe(first);
    const wireNext = { ...wire, harBodyByHop: [{ content: 'late', encoding: '' } as InspectorHarBody] };
    const second = merger.merge(browser, matches, new Map([['w1', wireNext]]));
    expect(second).not.toBe(first);
    expect(second.harBodyByHop[0]).toBe(wireNext.harBodyByHop[0]);
  });
});

describe('wire-seen record', () => {
  beforeEach(() => clearWireSeenRecords());

  it('records associations and never downgrades a labelled record', () => {
    recordWireSeen('w1', { nodeId: 'n1', tabId: 5, browserRequestId: 'b1', label: 'Dashboard' });
    recordWireSeen('w1', { nodeId: 'n1', tabId: 5, browserRequestId: 'b1', label: null });
    expect(getWireSeen('w1')?.label).toBe('Dashboard');
  });

  it('keeps the snapshot identity until a record actually lands', () => {
    recordWireSeen('w1', { nodeId: 'n1', tabId: 5, browserRequestId: 'b1', label: null });
    const snap = getWireSeenSnapshot();
    recordWireSeen('w1', { nodeId: 'n1', tabId: 5, browserRequestId: 'b1', label: null });
    expect(getWireSeenSnapshot()).toBe(snap);
    recordWireSeen('w2', { nodeId: 'n1', tabId: 5, browserRequestId: 'b2', label: null });
    expect(getWireSeenSnapshot()).not.toBe(snap);
  });
});

describe('wire-join annotations', () => {
  const anchor: SupersessionAnchor = { latestNavStartedAtMs: -1 };
  const messages = buildRowAnnotationMessages(getTranslator('en'));

  it('annotates a joined browser row with wire-joined provenance', () => {
    const row = makeRow({ requestId: 'b1' });
    const annotations = classifyRowAnnotations(row, {
      anchor,
      source: 'heuristic',
      wireJoinedIds: new Set(['b1']),
    });
    expect(annotations.some((a) => a.message === 'wire-joined')).toBe(true);
  });

  it('annotates a seen wire row with the witnessing tab in the copy', () => {
    const row = makeWireRow({ requestId: 'w1' });
    const annotations = classifyRowAnnotations(row, {
      anchor,
      source: 'proxy',
      wireSeenLabels: new Map([['w1', 'Dashboard']]),
    });
    const seen = annotations.find((a) => a.message === 'wire-seen');
    expect(seen).toBeDefined();
    expect(messages.detail(seen ?? annotations[0])).toContain('Dashboard');
  });
});
