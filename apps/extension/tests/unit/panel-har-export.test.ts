import type { Page } from '@openheaders/core/page-stream';
import type { RedirectHop, RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry, InspectorHarLog, InspectorHarPage } from '@openheaders/core/types';
import { buildHar, sanitizeHarEntry, serializeHar, suggestHarFilename } from '@openheaders/ui/panel/data/har-export';
import { buildInspectorRows } from '@openheaders/ui/panel/data/inspector-facet';
import { attachFiresToRows, type InspectorRowWithFires } from '@openheaders/ui/panel/data/inspector-row-projection';
import { describe, expect, it, vi } from 'vitest';

function row(url: string, idx = 0, overrides: Partial<RequestLifecycle> = {}): InspectorRowWithFires {
  const startedAtMs = idx * 100;
  const har: InspectorHarEntry = {
    startedDateTime: `2026-04-16T00:00:${String(idx).padStart(2, '0')}.000Z`,
    request: { method: 'GET', url, headers: [], queryString: [] },
    response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'text/plain' } },
  } as InspectorHarEntry;
  const lc: RequestLifecycle = {
    tabId: 1,
    requestId: `r-${idx}-${url}`,
    url,
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs,
    hopStartedAtMs: startedAtMs,
    completedAtMs: startedAtMs + 50,
    statusCode: 200,
    har: [har],
    harBodyByHop: [],
    ...overrides,
  };
  return { lifecycle: lc, displayId: idx + 1, consolidatedRetryOf: [], fires: [] };
}

/** A 1-redirect lifecycle (301 → 200): final-hop row, two-hop `har`. */
function redirectLifecycleRow(): InspectorRowWithFires {
  const src = 'https://openheaders.io/a';
  const dest = 'https://openheaders.io/b';
  const hop0: InspectorHarEntry = {
    startedDateTime: '2026-04-16T00:00:00.000Z',
    request: { method: 'GET', url: src, headers: [], queryString: [] },
    response: { status: 301, statusText: 'Moved', headers: [], content: { size: 0, mimeType: '' } },
  } as InspectorHarEntry;
  const hop1: InspectorHarEntry = {
    startedDateTime: '2026-04-16T00:00:00.100Z',
    request: { method: 'GET', url: dest, headers: [], queryString: [] },
    response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: '' } },
  } as InspectorHarEntry;
  const hop: RedirectHop = { sourceUrl: src, redirectUrl: dest, statusCode: 301, timestampMs: 50 };
  const lc: RequestLifecycle = {
    tabId: 1,
    requestId: 'redir',
    url: dest,
    method: 'GET',
    resourceType: 'document',
    phase: 'completed',
    redirectHopCount: 1,
    redirectHops: [hop],
    startedAtMs: 0,
    hopStartedAtMs: 100,
    completedAtMs: 150,
    statusCode: 200,
    har: [hop0, hop1],
    harBodyByHop: [],
  };
  return { lifecycle: lc, displayId: 1, consolidatedRetryOf: [], fires: [] };
}

describe('buildHar', () => {
  it('emits a valid HAR 1.2 envelope with the provided rows', () => {
    const rows = [row('https://api.openheaders.io/a'), row('https://api.openheaders.io/b', 1)];
    const doc = buildHar(rows);
    expect(doc.log.version).toBe('1.2');
    expect(doc.log.creator.name).toBe('Open Headers DevTools');
    expect(doc.log.pages).toEqual([]);
    expect(doc.log.entries).toHaveLength(2);
    expect(doc.log.entries[0].request?.url).toBe('https://api.openheaders.io/a');
  });

  it('produces an empty entries array when no rows are given', () => {
    const doc = buildHar([]);
    expect(doc.log.entries).toEqual([]);
  });

  it('emits entries ordered by HAR startedDateTime (the host entry order)', () => {
    // The host export is startedDateTime-ascending (NetworkLog insertion =
    // issue-time order). The exporter sorts by each entry's startedDateTime
    // regardless of the array order it received. idx drives startedDateTime.
    const a = row('https://openheaders.io/a', 2);
    const b = row('https://openheaders.io/b', 0);
    const c = row('https://openheaders.io/c', 1);
    const doc = buildHar([a, b, c]);
    expect(doc.log.entries.map((e) => e.request?.url)).toEqual([
      'https://openheaders.io/b',
      'https://openheaders.io/c',
      'https://openheaders.io/a',
    ]);
  });

  it('breaks a startedDateTime tie by discovery rank (displayId)', () => {
    // Two entries sharing a millisecond resolve to discovery order — the
    // host's sub-ms insertion order — not the array order received.
    const x = { ...row('https://openheaders.io/x', 0), displayId: 5 };
    const y = { ...row('https://openheaders.io/y', 0), displayId: 2 };
    const doc = buildHar([x, y]);
    expect(doc.log.entries.map((e) => e.request?.url)).toEqual([
      'https://openheaders.io/y',
      'https://openheaders.io/x',
    ]);
  });

  it('omits rows whose lifecycle has no HAR shell yet (pending placeholders)', () => {
    const ok = row('https://api.openheaders.io/a');
    const pendingPlaceholder = row('https://blocked.openheaders.io/b', 1, {
      phase: 'pending',
      har: [],
      statusCode: undefined,
    });
    const doc = buildHar([ok, pendingPlaceholder]);
    expect(doc.log.entries).toHaveLength(1);
    expect(doc.log.entries[0].request?.url).toBe('https://api.openheaders.io/a');
  });

  it('exports one entry per row — a real redirect-final row carries only its current hop', () => {
    // Redirect chains are un-folded into per-hop rows upstream
    // (`buildInspectorRows`); the real lifecycle is the final-hop row, so on
    // its own it exports just the destination (200), not the 301 leg.
    const r = redirectLifecycleRow();
    const doc = buildHar([r]);
    expect(doc.log.entries).toHaveLength(1);
    expect(doc.log.entries[0].response?.status).toBe(200);
  });

  it('exports both legs once when the redirect chain is expanded into rows', () => {
    // The full panel path: a redirect lifecycle → [301 synthetic, 200 real]
    // rows → buildHar emits each row's current hop, so both legs appear once.
    const lc = redirectLifecycleRow().lifecycle;
    const rows = attachFiresToRows(buildInspectorRows([lc]), []).rows;
    const doc = buildHar(rows);
    expect(doc.log.entries).toHaveLength(2);
    expect(doc.log.entries[0].response?.status).toBe(301);
    expect(doc.log.entries[1].response?.status).toBe(200);
  });

  it('emits referenced pages with pageref on each entry', () => {
    const pageStartedAtMs = 0;
    const pages: Page[] = [
      { id: 'page-1', startedAtMs: pageStartedAtMs, url: 'https://openheaders.io/', dclMs: 100, loadMs: 200 },
    ];
    const r = row('https://openheaders.io/a', 1);
    const doc = buildHar([r], pages);
    expect(doc.log.pages).toHaveLength(1);
    expect(doc.log.pages[0].id).toBe('page-1');
    expect(doc.log.entries[0].pageref).toBe('page-1');
  });

  it('re-anchors a page to its document network start (heuristic: subtracts the navStart leg)', () => {
    // Heuristic page feed: page is navStart-anchored at 1000; the document's
    // network start (hopNetworkStartMs) is 1006 — 6ms later. The host anchors
    // the page block to the network start, so the exported block shifts by 6ms.
    const pages: Page[] = [
      { id: 'page-1', startedAtMs: 1000, url: 'https://openheaders.io/', dclMs: 100, loadMs: 200 },
    ];
    const doc = row('https://openheaders.io/', 0, {
      resourceType: 'document',
      startedAtMs: 1000,
      hopStartedAtMs: 1003,
      hopNetworkStartMs: 1006,
    });
    const out = buildHar([doc], pages);
    expect(out.log.pages[0].startedDateTime).toBe(new Date(1006).toISOString());
    expect(out.log.pages[0].pageTimings.onContentLoad).toBe(94);
    expect(out.log.pages[0].pageTimings.onLoad).toBe(194);
  });

  it('leaves a CDP page block unchanged (page start already equals the doc network start)', () => {
    // CDP page feed: page start already equals the doc network start (2006), so
    // the leg is 0 and the projection is a precise no-op (byte-identical).
    const pages: Page[] = [{ id: 'page-2', startedAtMs: 2006, url: 'https://openheaders.io/', dclMs: 94, loadMs: 194 }];
    const doc = row('https://openheaders.io/', 0, {
      resourceType: 'document',
      startedAtMs: 2000,
      hopStartedAtMs: 2003,
      hopNetworkStartMs: 2006,
    });
    const out = buildHar([doc], pages);
    expect(out.log.pages[0].startedDateTime).toBe(new Date(2006).toISOString());
    expect(out.log.pages[0].pageTimings.onContentLoad).toBe(94);
    expect(out.log.pages[0].pageTimings.onLoad).toBe(194);
  });

  it('stamps the page ref on the document request that starts just before its page', () => {
    // The page's start is the document request's queue-adjusted start, so that
    // defining request begins marginally earlier — it must still bind to page-1.
    const pages: Page[] = [{ id: 'page-1', startedAtMs: 5, url: 'https://openheaders.io/', dclMs: 100, loadMs: 200 }];
    const doc = row('https://openheaders.io/', 0, { resourceType: 'document', startedAtMs: 0 });
    const out = buildHar([doc], pages);
    expect(out.log.pages).toHaveLength(1);
    expect(out.log.entries[0].pageref).toBe('page-1');
  });
});

describe('buildHar host-HAR reconciliation (CDP mode)', () => {
  // A document row bound to page-1, so the export references that page.
  function docRowOnPage(): InspectorRowWithFires {
    return row('https://openheaders.io/', 0, { resourceType: 'document', startedAtMs: 0 });
  }
  const page1: Page = { id: 'page-1', startedAtMs: 5, url: 'https://openheaders.io/', dclMs: 100, loadMs: 200 };

  function hostPage(overrides: Partial<InspectorHarPage> = {}): InspectorHarPage {
    return {
      id: 'page-1',
      startedDateTime: '2026-04-16T00:00:00.123Z',
      title: 'https://openheaders.io/',
      // Distinctive sub-ms floats CDP synthesis would never compute from dclMs/loadMs.
      pageTimings: { onContentLoad: 696.9859999990149, onLoad: 1622.4739999997837 },
      ...overrides,
    };
  }

  it('adopts the host page block verbatim for a referenced page', () => {
    const host = hostPage();
    const hostHar: InspectorHarLog = { entries: [], pages: [host] };
    const out = buildHar([docRowOnPage()], [page1], false, undefined, hostHar);
    expect(out.log.pages).toEqual([host]);
    expect(out.log.pages[0]).toBe(host);
  });

  it('falls back to the CDP page projection when the host HAR has no matching page', () => {
    // Host saw entries but reported no page block for this ref — keep CDP synth.
    const hostHar: InspectorHarLog = { entries: [], pages: [hostPage({ id: 'page-OTHER' })] };
    const out = buildHar([docRowOnPage()], [page1], false, undefined, hostHar);
    expect(out.log.pages).toHaveLength(1);
    expect(out.log.pages[0].id).toBe('page-1');
    // CDP-projected timings (page's own dcl/load), not the host floats.
    expect(out.log.pages[0].pageTimings).toEqual({ onContentLoad: 100, onLoad: 200 });
  });

  it('swaps a row to its host entry verbatim when method+url+start match', () => {
    const r = row('https://openheaders.io/api', 0);
    const hostEntry: InspectorHarEntry = {
      startedDateTime: '2026-04-16T00:00:00.000Z',
      request: {
        method: 'GET',
        url: 'https://openheaders.io/api',
        // On-the-wire header order the CDP synth row lacks — the parity payload.
        headers: [
          { name: 'X-Wire-Order', value: '1' },
          { name: 'Accept', value: '*/*' },
        ],
        queryString: [],
      },
      response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'text/plain' } },
    } as InspectorHarEntry;
    const hostHar: InspectorHarLog = { entries: [hostEntry], pages: [] };
    const out = buildHar([r], [], false, undefined, hostHar);
    expect(out.log.entries[0].request?.headers).toEqual(hostEntry.request?.headers);
  });

  it('keeps the CDP-synthesized entry for a row the host HAR never saw', () => {
    const r = row('https://openheaders.io/oopif', 0);
    const hostHar: InspectorHarLog = {
      entries: [
        {
          startedDateTime: '2026-04-16T00:00:00.000Z',
          request: { method: 'GET', url: 'https://openheaders.io/other', headers: [], queryString: [] },
          response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'text/plain' } },
        } as InspectorHarEntry,
      ],
      pages: [],
    };
    const out = buildHar([r], [], false, undefined, hostHar);
    expect(out.log.entries[0].request?.url).toBe('https://openheaders.io/oopif');
  });

  it('leaves both entries and page block as CDP synthesis in heuristic mode (no host HAR)', () => {
    const out = buildHar([docRowOnPage()], [page1]);
    expect(out.log.pages[0].pageTimings).toEqual({ onContentLoad: 100, onLoad: 200 });
  });

  it('emits matched host entries in the host order, not our issue-time sort', () => {
    // Host groups entries by page load (later nav first here); our own sort is
    // issue-time ascending. The CDP export must follow the host order.
    const a = row('https://openheaders.io/a', 2); // startedDateTime ...02 (later)
    const b = row('https://openheaders.io/b', 0); // startedDateTime ...00 (earlier)
    const hostA: InspectorHarEntry = {
      startedDateTime: '2026-04-16T00:00:02.000Z',
      pageref: 'page_2',
      request: { method: 'GET', url: 'https://openheaders.io/a', headers: [], queryString: [] },
      response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'text/plain' } },
    } as InspectorHarEntry;
    const hostB: InspectorHarEntry = {
      startedDateTime: '2026-04-16T00:00:00.000Z',
      pageref: 'page_1',
      request: { method: 'GET', url: 'https://openheaders.io/b', headers: [], queryString: [] },
      response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'text/plain' } },
    } as InspectorHarEntry;
    // Host order = [a (later), b (earlier)].
    const out = buildHar([a, b], [], false, undefined, { entries: [hostA, hostB], pages: [] });
    expect(out.log.entries.map((e) => e.request?.url)).toEqual([
      'https://openheaders.io/a',
      'https://openheaders.io/b',
    ]);
  });

  it('keeps the host pageref on a matched entry instead of recomputing it', () => {
    // The host's own page binding is authoritative; our resolvePageref heuristic
    // would mis-bin a request that starts marginally before its own page.
    const r = row('https://openheaders.io/x', 0);
    const hostEntry: InspectorHarEntry = {
      startedDateTime: '2026-04-16T00:00:00.000Z',
      pageref: 'page_2',
      request: { method: 'GET', url: 'https://openheaders.io/x', headers: [], queryString: [] },
      response: { status: 200, statusText: 'OK', headers: [], content: { size: 0, mimeType: 'text/plain' } },
    } as InspectorHarEntry;
    const hostP2 = hostPage({ id: 'page_2' });
    // Our page-stream knows both pages; resolvePageref alone would pick page_1.
    const ourPages: Page[] = [
      { id: 'page_1', startedAtMs: 0, url: 'https://openheaders.io/', dclMs: 10, loadMs: 20 },
      { id: 'page_2', startedAtMs: 100, url: 'https://openheaders.io/', dclMs: 10, loadMs: 20 },
    ];
    const out = buildHar([r], ourPages, false, undefined, {
      entries: [hostEntry],
      pages: [hostPage({ id: 'page_1' }), hostP2],
    });
    expect(out.log.entries[0].pageref).toBe('page_2');
    // Only page_2 is referenced, and it is adopted verbatim from the host block.
    expect(out.log.pages).toEqual([hostP2]);
  });
});

describe('serializeHar', () => {
  it('round-trips through JSON.parse', () => {
    const rows = [row('https://api.openheaders.io/x')];
    const json = serializeHar(rows);
    const parsed = JSON.parse(json);
    expect(parsed.log.version).toBe('1.2');
    expect(parsed.log.entries).toHaveLength(1);
  });

  it('uses 2-space indentation', () => {
    const json = serializeHar([]);
    expect(json).toContain('\n  "log"');
  });
});

describe('internal-field strip (`_rawTiming`)', () => {
  function rawTimedRow(): InspectorRowWithFires {
    const r = row('https://api.openheaders.io/raw');
    const har = r.lifecycle.har[0];
    if (har == null) throw new Error('expected har');
    har._rawTiming = { issuedSec: 100, requestTimeSec: 100.001, sendStart: 1, sendEnd: 2, receiveHeadersEnd: 5 };
    return r;
  }

  it('a synthesized entry exports without its raw block (heuristic mode)', () => {
    const doc = buildHar([rawTimedRow()]);
    expect(doc.log.entries[0]).not.toHaveProperty('_rawTiming');
  });

  it('a synth-only row in CDP mode (no host match) exports without its raw block', () => {
    const doc = buildHar([rawTimedRow()], [], false, undefined, { entries: [], pages: [] });
    expect(doc.log.entries).toHaveLength(1);
    expect(doc.log.entries[0]).not.toHaveProperty('_rawTiming');
  });

  it('the sanitized export strips it too', () => {
    const doc = buildHar([rawTimedRow()], [], true);
    expect(doc.log.entries[0]).not.toHaveProperty('_rawTiming');
  });

  it('the in-memory entry is untouched (strip copies, never mutates)', () => {
    const r = rawTimedRow();
    buildHar([r]);
    expect(r.lifecycle.har[0]?._rawTiming).toBeDefined();
  });

  it('the header capture stamp (`_ohHeaderCapture`) is stripped too', () => {
    const r = row('https://api.openheaders.io/capture');
    const har = r.lifecycle.har[0];
    if (har == null) throw new Error('expected har');
    har._ohHeaderCapture = { request: 'effective', response: 'effective' };
    const doc = buildHar([r]);
    expect(doc.log.entries[0]).not.toHaveProperty('_ohHeaderCapture');
    expect(r.lifecycle.har[0]?._ohHeaderCapture).toBeDefined();
  });

  it('the producer provenance stamp (`_ohEntrySource`) is stripped too', () => {
    const r = row('https://api.openheaders.io/provenance');
    const har = r.lifecycle.har[0];
    if (har == null) throw new Error('expected har');
    har._ohEntrySource = 'webrequest-partial';
    const doc = buildHar([r]);
    expect(doc.log.entries[0]).not.toHaveProperty('_ohEntrySource');
    expect(r.lifecycle.har[0]?._ohEntrySource).toBeDefined();
  });
});

describe('sanitizeHarEntry / sanitized export', () => {
  function entryWithCredentials(): InspectorHarEntry {
    return {
      startedDateTime: '2026-04-16T00:00:00.000Z',
      request: {
        method: 'GET',
        url: 'https://openheaders.io/',
        headers: [
          { name: 'Accept', value: '*/*' },
          { name: 'Cookie', value: 'sid=secret' },
          { name: 'Authorization', value: 'Bearer t0ken' },
        ],
        queryString: [],
        cookies: [{ name: 'sid', value: 'secret' }],
      },
      response: {
        status: 200,
        statusText: 'OK',
        headers: [
          { name: 'Content-Type', value: 'text/html' },
          { name: 'Set-Cookie', value: 'sid=secret' },
        ],
        cookies: [{ name: 'sid', value: 'secret' }],
        content: { size: 0, mimeType: 'text/html' },
      },
    } as InspectorHarEntry;
  }

  it('empties cookies and drops cookie/authorization/set-cookie headers (case-insensitive)', () => {
    const out = sanitizeHarEntry(entryWithCredentials());
    expect(out.request?.cookies).toEqual([]);
    expect(out.response?.cookies).toEqual([]);
    expect(out.request?.headers.map((h) => h.name)).toEqual(['Accept']);
    expect(out.response?.headers.map((h) => h.name)).toEqual(['Content-Type']);
  });

  it('does not mutate the source entry', () => {
    const entry = entryWithCredentials();
    sanitizeHarEntry(entry);
    expect(entry.request?.cookies).toHaveLength(1);
    expect(entry.request?.headers).toHaveLength(3);
  });

  it('buildHar keeps credentials by default and strips them when sanitize is set', () => {
    const r = row('https://openheaders.io/', 0, {
      har: [entryWithCredentials()],
    });
    const full = buildHar([r]).log.entries[0];
    expect(full.request?.cookies).toHaveLength(1);
    expect(full.request?.headers.some((h) => h.name.toLowerCase() === 'authorization')).toBe(true);

    const clean = buildHar([r], [], true).log.entries[0];
    expect(clean.request?.cookies).toEqual([]);
    expect(clean.request?.headers.some((h) => h.name.toLowerCase() === 'authorization')).toBe(false);
  });
});

describe('suggestHarFilename', () => {
  it('falls back to "network" when no rows are available', () => {
    expect(suggestHarFilename([])).toMatch(/^network-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.har$/);
  });

  it('uses the first parseable hostname', () => {
    vi.setSystemTime(new Date('2026-04-16T19:35:00.000Z'));
    const name = suggestHarFilename([row('https://api.openheaders.io/y')]);
    expect(name).toMatch(/^api\.openheaders\.io-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.har$/);
    vi.useRealTimers();
  });

  it('skips unparseable urls to find a host', () => {
    const name = suggestHarFilename([row('not-a-url'), row('https://app.openheaders.io/x', 1)]);
    expect(name).toMatch(/^app\.openheaders\.io-/);
  });
});

describe('message-stream export dialect (`_webSocketMessages` / `_eventSourceMessages`)', () => {
  function wsRow(messages: RequestLifecycle['messages']): InspectorRowWithFires {
    return row('wss://api.openheaders.io/socket', 0, {
      resourceType: 'websocket',
      statusCode: 101,
      messages,
    });
  }

  it('synthesizes _webSocketMessages in the host dialect (wall seconds, opcode, data)', () => {
    const doc = buildHar([
      wsRow([
        { kind: 'ws', type: 'send', atMs: 1_700_000_000_500, opcode: 1, mask: true, data: 'hello' },
        { kind: 'ws', type: 'receive', atMs: 1_700_000_001_000, opcode: 2, mask: false, data: '3q2+7w==' },
        { kind: 'ws', type: 'error', atMs: 1_700_000_001_500, opcode: -1, mask: false, data: 'Invalid frame' },
      ]),
    ]);
    expect(doc.log.entries).toHaveLength(1);
    expect(doc.log.entries[0]?._webSocketMessages).toEqual([
      { type: 'send', time: 1_700_000_000.5, opcode: 1, data: 'hello' },
      { type: 'receive', time: 1_700_000_001, opcode: 2, data: '3q2+7w==' },
      { type: 'error', time: 1_700_000_001.5, opcode: -1, data: 'Invalid frame' },
    ]);
    expect(doc.log.entries[0]?._eventSourceMessages).toBeUndefined();
  });

  it('emits an empty _webSocketMessages array on a frameless websocket row, like the host', () => {
    const doc = buildHar([wsRow(undefined)]);
    expect(doc.log.entries[0]?._webSocketMessages).toEqual([]);
  });

  it('synthesizes _eventSourceMessages from sse messages, omitting data when sanitized', () => {
    const sseRow = row('https://api.openheaders.io/stream', 1, {
      resourceType: 'eventsource',
      messages: [
        { kind: 'sse', atMs: 1_700_000_002_000, eventName: 'tick', eventId: '1', data: '{"seq":1}' },
        { kind: 'sse', atMs: 1_700_000_003_000, eventName: 'message', eventId: '2', data: '{"seq":2}' },
      ],
    });
    const plain = buildHar([sseRow]);
    expect(plain.log.entries[0]?._eventSourceMessages).toEqual([
      { time: 1_700_000_002, eventName: 'tick', eventId: '1', data: '{"seq":1}' },
      { time: 1_700_000_003, eventName: 'message', eventId: '2', data: '{"seq":2}' },
    ]);
    expect(plain.log.entries[0]?._webSocketMessages).toBeUndefined();

    const sanitized = buildHar([sseRow], [], true);
    expect(sanitized.log.entries[0]?._eventSourceMessages).toEqual([
      { time: 1_700_000_002, eventName: 'tick', eventId: '1' },
      { time: 1_700_000_003, eventName: 'message', eventId: '2' },
    ]);
  });

  it('plain rows without messages stay undecorated', () => {
    const doc = buildHar([row('https://api.openheaders.io/users')]);
    expect(doc.log.entries[0]?._webSocketMessages).toBeUndefined();
    expect(doc.log.entries[0]?._eventSourceMessages).toBeUndefined();
  });

  it('decorates synth-only rows appended in CDP (host-authoritative) mode', () => {
    const hostHar: InspectorHarLog = { entries: [], pages: [] };
    const doc = buildHar(
      [wsRow([{ kind: 'ws', type: 'send', atMs: 1_700_000_000_500, opcode: 1, mask: true, data: 'hi' }])],
      [],
      false,
      undefined,
      hostHar,
    );
    expect(doc.log.entries).toHaveLength(1);
    expect(doc.log.entries[0]?._webSocketMessages).toEqual([
      { type: 'send', time: 1_700_000_000.5, opcode: 1, data: 'hi' },
    ]);
  });
});
