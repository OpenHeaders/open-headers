/**
 * Redirect-hop row synthesis — the panel-local un-folding of a redirect
 * chain (one lifecycle, hops in `har[]`) into the per-hop rows the network
 * table renders. Pure: a lifecycle in, synthetic single-hop lifecycles out.
 */

import type { RedirectHop, RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import type { InspectorRowWithFires } from '@openheaders/ui/panel/data/inspector-row-projection';
import { waterfallSortValue } from '@openheaders/ui/panel/data/network-columns';
import {
  synthesizeRedirectHopLifecycle,
  synthesizeRedirectHopLifecycles,
} from '@openheaders/ui/panel/data/redirect-hop-rows';
import { describe, expect, it } from 'vitest';

function hopHar(url: string, status: number, startedDateTime: string, transferSize = 0): InspectorHarEntry {
  return {
    startedDateTime,
    time: 10,
    request: { method: 'GET', url, headers: [], queryString: [] },
    response: {
      status,
      statusText: status === 200 ? 'OK' : 'Found',
      headers: [],
      content: { size: 0, mimeType: '' },
      _transferSize: transferSize,
    },
  } as InspectorHarEntry;
}

function hop(sourceUrl: string, redirectUrl: string, statusCode: number): RedirectHop {
  return { sourceUrl, redirectUrl, statusCode, timestampMs: 50 };
}

function makeLifecycle(over: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 1,
    requestId: 'r1',
    url: 'https://openheaders.io/final',
    method: 'GET',
    resourceType: 'document',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1000,
    hopStartedAtMs: 1000,
    completedAtMs: 1100,
    statusCode: 200,
    har: [],
    harBodyByHop: [],
    ...over,
  };
}

describe('synthesizeRedirectHopLifecycle', () => {
  it('builds a terminal single-hop lifecycle from har[hop] + redirectHops[hop]', () => {
    const lc = makeLifecycle({
      requestId: '42.3',
      redirectHopCount: 1,
      redirectHops: [hop('https://openheaders.io/', 'https://openheaders.io/ro', 302)],
      har: [
        hopHar('https://openheaders.io/', 302, '2026-04-16T00:00:00.000Z', 792),
        hopHar('https://openheaders.io/ro', 200, '2026-04-16T00:00:00.100Z'),
      ],
    });
    const synth = synthesizeRedirectHopLifecycle(lc, 0);
    expect(synth).not.toBeNull();
    if (synth === null) throw new Error('expected a synthetic lifecycle');
    expect(synth.requestId).toBe('oh-redir:42.3#0');
    expect(synth.url).toBe('https://openheaders.io/');
    expect(synth.statusCode).toBe(302);
    expect(synth.redirectHopCount).toBe(0);
    expect(synth.redirectHops).toEqual([]);
    expect(synth.phase).toBe('completed');
    expect(synth.har).toHaveLength(1);
    expect(synth.har[0]?.response?.status).toBe(302);
    expect(synth.har[0]?.response?._transferSize).toBe(792);
    expect(synth.startedAtMs).toBe(Date.parse('2026-04-16T00:00:00.000Z'));
  });

  it('returns null when the hop HAR has not landed', () => {
    const lc = makeLifecycle({
      redirectHopCount: 1,
      redirectHops: [hop('https://openheaders.io/', 'https://openheaders.io/ro', 302)],
      har: [null, hopHar('https://openheaders.io/ro', 200, '2026-04-16T00:00:00.100Z')],
    });
    expect(synthesizeRedirectHopLifecycle(lc, 0)).toBeNull();
  });
});

describe('synthesizeRedirectHopLifecycles', () => {
  it('yields nothing for a non-redirect lifecycle', () => {
    const lc = makeLifecycle({
      redirectHopCount: 0,
      har: [hopHar('https://openheaders.io/x', 200, '2026-04-16T00:00:00.000Z')],
    });
    expect(synthesizeRedirectHopLifecycles(lc)).toEqual([]);
  });

  it('yields one synthetic row for a single redirect (302)', () => {
    const lc = makeLifecycle({
      redirectHopCount: 1,
      redirectHops: [hop('https://openheaders.io/', 'https://openheaders.io/ro', 302)],
      har: [
        hopHar('https://openheaders.io/', 302, '2026-04-16T00:00:00.000Z'),
        hopHar('https://openheaders.io/ro', 200, '2026-04-16T00:00:00.100Z'),
      ],
    });
    const out = synthesizeRedirectHopLifecycles(lc);
    expect(out).toHaveLength(1);
    expect(out[0].statusCode).toBe(302);
    expect(out[0].url).toBe('https://openheaders.io/');
  });

  it('yields two synthetic rows in hop order for a 2-redirect chain', () => {
    const lc = makeLifecycle({
      redirectHopCount: 2,
      redirectHops: [
        hop('https://openheaders.io/', 'https://openheaders.io/x', 301),
        hop('https://openheaders.io/x', 'https://openheaders.io/y', 302),
      ],
      har: [
        hopHar('https://openheaders.io/', 301, '2026-04-16T00:00:00.000Z'),
        hopHar('https://openheaders.io/x', 302, '2026-04-16T00:00:00.050Z'),
        hopHar('https://openheaders.io/y', 200, '2026-04-16T00:00:00.100Z'),
      ],
    });
    const out = synthesizeRedirectHopLifecycles(lc);
    expect(out.map((l) => l.statusCode)).toEqual([301, 302]);
    expect(out.map((l) => l.url)).toEqual(['https://openheaders.io/', 'https://openheaders.io/x']);
  });

  it('skips a hop whose HAR is null', () => {
    const lc = makeLifecycle({
      redirectHopCount: 2,
      redirectHops: [
        hop('https://openheaders.io/', 'https://openheaders.io/x', 301),
        hop('https://openheaders.io/x', 'https://openheaders.io/y', 302),
      ],
      har: [
        null,
        hopHar('https://openheaders.io/x', 302, '2026-04-16T00:00:00.050Z'),
        hopHar('https://openheaders.io/y', 200, '2026-04-16T00:00:00.100Z'),
      ],
    });
    const out = synthesizeRedirectHopLifecycles(lc);
    expect(out).toHaveLength(1);
    expect(out[0].statusCode).toBe(302);
  });
});

describe('redirect-hop start-time sort order', () => {
  const asRow = (lc: RequestLifecycle): InspectorRowWithFires =>
    ({ lifecycle: lc, displayId: 1, consolidatedRetryOf: [], fires: [] }) as InspectorRowWithFires;

  it('sorts the 3xx redirect row before its committed final hop (start time)', () => {
    // Real lifecycle: starts at the chain root but its CURRENT hop (the 200)
    // began later; `hopStartedAtMs` carries that. Epoch values match the HAR
    // startedDateTime strings so the synth row and the real row sort on one scale.
    const rootMs = Date.parse('2026-04-16T00:00:49.103Z');
    const finalMs = Date.parse('2026-04-16T00:00:49.235Z');
    const real = makeLifecycle({
      requestId: 'doc',
      url: 'https://openheaders.io/ro',
      redirectHopCount: 1,
      redirectHops: [hop('https://openheaders.io/', 'https://openheaders.io/ro', 302)],
      startedAtMs: rootMs,
      hopStartedAtMs: finalMs,
      har: [
        hopHar('https://openheaders.io/', 302, '2026-04-16T00:00:49.103Z'),
        hopHar('https://openheaders.io/ro', 200, '2026-04-16T00:00:49.235Z'),
      ],
    });
    const synth302 = synthesizeRedirectHopLifecycle(real, 0);
    if (synth302 === null) throw new Error('expected a synthetic 302 row');

    const redirectStart = waterfallSortValue(asRow(synth302), 'startTime');
    const finalStart = waterfallSortValue(asRow(real), 'startTime');
    // The 302 must sort earlier — it must not tie at / follow the final hop.
    expect(redirectStart).toBeLessThan(finalStart);
  });
});
