/**
 * Response meta strip mappers — raw resource-timing entry → phase
 * ladder (with the TAO honest-degradation gate), HTTP version labels,
 * duration formatting, and the status-code docs corpus.
 */

import type { ResourceTimingEntry } from '@openheaders/core/resource-timing';
import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import {
  getStatusCodeInfoContent,
  hasStatusCodeInfo,
  statusCodeInfoCount,
} from '@openheaders/ui/shared/info-popover/data/http-status';
import {
  formatDurationRolled,
  formatPhaseMs,
  httpVersionLabel,
  mapEntryToTimingView,
  mapPhaseTimingsToView,
  serializedHeaderListBytes,
} from '@openheaders/ui/workbench/components/request-editor/response/response-meta';
import { describe, expect, it } from 'vitest';

function makeEntry(overrides: Partial<ResourceTimingEntry> = {}): ResourceTimingEntry {
  return {
    name: 'https://api.openheaders.io/v1/ping',
    initiatorType: 'fetch',
    nextHopProtocol: 'h2',
    startTime: 1000,
    duration: 200,
    workerStart: 0,
    redirectStart: 0,
    redirectEnd: 0,
    fetchStart: 1000,
    domainLookupStart: 0,
    domainLookupEnd: 0,
    connectStart: 0,
    connectEnd: 0,
    secureConnectionStart: 0,
    requestStart: 0,
    responseStart: 0,
    firstInterimResponseStart: 0,
    finalResponseHeadersStart: 0,
    responseEnd: 1200,
    transferSize: 0,
    encodedBodySize: 0,
    decodedBodySize: 0,
    deliveryType: '',
    responseStatus: 0,
    ...overrides,
  };
}

/** TAO-passing entry with every leg populated. */
function detailedEntry(): ResourceTimingEntry {
  return makeEntry({
    domainLookupStart: 1010,
    domainLookupEnd: 1020,
    connectStart: 1020,
    connectEnd: 1060,
    secureConnectionStart: 1040,
    requestStart: 1062,
    responseStart: 1150,
    responseEnd: 1200,
  });
}

describe('mapEntryToTimingView', () => {
  it('degrades to total-only when TAO withheld the legs', () => {
    const view = mapEntryToTimingView(makeEntry());
    expect(view).toEqual({ kind: 'total-only', totalMs: 200 });
  });

  it('maps a TAO-passing entry to the full ladder', () => {
    const view = mapEntryToTimingView(detailedEntry());
    expect(view.kind).toBe('detailed');
    if (view.kind !== 'detailed') return;
    expect(view.totalMs).toBe(200);
    const byKey = new Map(view.phases.map((p) => [p.key, p]));
    expect(byKey.get('stalled')).toMatchObject({ startMs: 0, durationMs: 10 });
    expect(byKey.get('dns')).toMatchObject({ startMs: 10, durationMs: 10 });
    // TCP runs connectStart → secureConnectionStart; TLS takes the rest.
    expect(byKey.get('connect')).toMatchObject({ startMs: 20, durationMs: 20 });
    expect(byKey.get('tls')).toMatchObject({ startMs: 40, durationMs: 20 });
    expect(byKey.get('waiting')).toMatchObject({ startMs: 62, durationMs: 88 });
    expect(byKey.get('download')).toMatchObject({ startMs: 150, durationMs: 50 });
    expect(byKey.has('redirect')).toBe(false);
  });

  it('includes a redirect phase when the chain had one', () => {
    const view = mapEntryToTimingView(
      makeEntry({
        redirectStart: 1000,
        redirectEnd: 1030,
        fetchStart: 1030,
        requestStart: 1032,
        responseStart: 1100,
        responseEnd: 1200,
      }),
    );
    expect(view.kind).toBe('detailed');
    if (view.kind !== 'detailed') return;
    expect(view.phases[0]).toMatchObject({ key: 'redirect', startMs: 0, durationMs: 30 });
  });

  it('renders reused-connection legs as zero-width, never negative', () => {
    // dns/connect collapse onto fetchStart on a reused socket.
    const view = mapEntryToTimingView(
      makeEntry({
        domainLookupStart: 1000,
        domainLookupEnd: 1000,
        connectStart: 1000,
        connectEnd: 1000,
        requestStart: 1001,
        responseStart: 1100,
      }),
    );
    expect(view.kind).toBe('detailed');
    if (view.kind !== 'detailed') return;
    for (const phase of view.phases) {
      expect(phase.durationMs).toBeGreaterThanOrEqual(0);
      expect(phase.startMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('skips TLS for plain-HTTP connections', () => {
    const view = mapEntryToTimingView(
      makeEntry({
        domainLookupStart: 1005,
        domainLookupEnd: 1010,
        connectStart: 1010,
        connectEnd: 1030,
        requestStart: 1032,
        responseStart: 1100,
      }),
    );
    expect(view.kind).toBe('detailed');
    if (view.kind !== 'detailed') return;
    const byKey = new Map(view.phases.map((p) => [p.key, p]));
    expect(byKey.has('tls')).toBe(false);
    expect(byKey.get('connect')).toMatchObject({ startMs: 10, durationMs: 20 });
  });

  it('falls back to responseEnd - startTime when duration is missing', () => {
    const view = mapEntryToTimingView(makeEntry({ duration: 0 }));
    expect(view.totalMs).toBe(200);
  });
});

describe('mapPhaseTimingsToView', () => {
  it('maps the node marks to a sequential ladder — waiting then download', () => {
    const view = mapPhaseTimingsToView({ waitingMs: 88, downloadMs: 50 });
    expect(view.kind).toBe('detailed');
    if (view.kind !== 'detailed') return;
    expect(view.totalMs).toBe(138);
    expect(view.phases).toEqual([
      expect.objectContaining({ key: 'waiting', startMs: 0, durationMs: 88 }),
      expect.objectContaining({ key: 'download', startMs: 88, durationMs: 50 }),
    ]);
  });

  it('leads with the redirect leg when the chain had hops', () => {
    const view = mapPhaseTimingsToView({ redirectMs: 30, waitingMs: 60, downloadMs: 10 });
    expect(view.kind).toBe('detailed');
    if (view.kind !== 'detailed') return;
    expect(view.totalMs).toBe(100);
    expect(view.phases[0]).toMatchObject({ key: 'redirect', startMs: 0, durationMs: 30 });
    expect(view.phases[1]).toMatchObject({ key: 'waiting', startMs: 30, durationMs: 60 });
    expect(view.phases[2]).toMatchObject({ key: 'download', startMs: 90, durationMs: 10 });
  });

  it('clamps stray negative marks to zero-width, never negative', () => {
    const view = mapPhaseTimingsToView({ redirectMs: -1, waitingMs: 5, downloadMs: -2 });
    expect(view.kind).toBe('detailed');
    if (view.kind !== 'detailed') return;
    for (const phase of view.phases) {
      expect(phase.durationMs).toBeGreaterThanOrEqual(0);
      expect(phase.startMs).toBeGreaterThanOrEqual(0);
    }
    expect(view.totalMs).toBe(5);
  });
});

describe('httpVersionLabel', () => {
  it('maps ALPN ids to friendly labels', () => {
    expect(httpVersionLabel('h2')).toBe('HTTP/2');
    expect(httpVersionLabel('h3')).toBe('HTTP/3');
    expect(httpVersionLabel('http/1.1')).toBe('HTTP/1.1');
  });

  it('returns null when the platform withheld the protocol', () => {
    expect(httpVersionLabel('')).toBeNull();
  });

  it('passes unknown ids through verbatim', () => {
    expect(httpVersionLabel('spdy/3.1')).toBe('spdy/3.1');
  });
});

describe('formatPhaseMs', () => {
  it('keeps sub-millisecond values visible', () => {
    expect(formatPhaseMs(0)).toBe('0 ms');
    expect(formatPhaseMs(0.4)).toBe('<1 ms');
    expect(formatPhaseMs(3.14)).toBe('3.1 ms');
    expect(formatPhaseMs(88)).toBe('88 ms');
    expect(formatPhaseMs(1234.6)).toBe('1235 ms');
  });
});

describe('formatDurationRolled', () => {
  it('rolls wall-clock durations up through ms / s / m / h units', () => {
    expect(formatDurationRolled(-5)).toBe('0 ms');
    expect(formatDurationRolled(734)).toBe('734 ms');
    expect(formatDurationRolled(1360)).toBe('1.4 s');
    expect(formatDurationRolled(59_940)).toBe('59.9 s');
    expect(formatDurationRolled(63_500)).toBe('1 m 3.5 s');
    expect(formatDurationRolled(104_642)).toBe('1 m 44.6 s');
    expect(formatDurationRolled(3_723_000)).toBe('1 h 2 m 3 s');
  });
});

describe('serializedHeaderListBytes', () => {
  it('sums key: value CRLF lines as UTF-8', () => {
    expect(
      serializedHeaderListBytes([
        { key: 'content-type', value: 'application/json' },
        { key: 'x-debug', value: 'on' },
      ]),
    ).toBe(45);
    expect(serializedHeaderListBytes([])).toBe(0);
  });
});

describe('getStatusCodeInfoContent', () => {
  const t = getTranslator(DEFAULT_LOCALE);

  it('returns curated copy for known codes', () => {
    const content = getStatusCodeInfoContent(t, 404, 'Not Found');
    expect(content.title).toBe('404 Not Found');
    expect(content.kicker).toContain('4xx');
    expect(content.summary).toContain('No resource exists');
  });

  it('supplies the canonical phrase when the server sent none', () => {
    expect(getStatusCodeInfoContent(t, 204, '').title).toBe('204 No Content');
  });

  it('surfaces a non-canonical server reason phrase', () => {
    const content = getStatusCodeInfoContent(t, 200, 'Everything Fine');
    expect(content.title).toBe('200 OK');
    expect(String(content.description)).toContain('"Everything Fine"');
  });

  it('falls back to the range meaning for uncurated codes', () => {
    const content = getStatusCodeInfoContent(t, 299, 'Custom');
    expect(content.title).toBe('299 Custom');
    expect(content.kicker).toContain('2xx');
    expect(hasStatusCodeInfo(299)).toBe(false);
  });

  it('handles codes outside the standard ranges honestly', () => {
    expect(getStatusCodeInfoContent(t, 999, '').kicker).toContain('Non-standard');
  });

  it('covers every code the rule editor offers', () => {
    expect(statusCodeInfoCount()).toBeGreaterThanOrEqual(60);
  });
});
