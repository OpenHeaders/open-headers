/**
 * Upstream initiator chain — parent resolution per hop.
 *
 * The parent URL comes from the HAR `_initiator` once a hop has landed, and
 * falls back to the lifecycle's own `initiator` URL while the row is still
 * in flight (no HAR yet) — so the "Request initiator chain" renders for
 * in-flight `(unknown)` rows, matching the host.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { computeUpstreamChain } from '@openheaders/ui/panel/data/initiator/upstream-chain';
import { describe, expect, it } from 'vitest';
import { makeLifecycle } from '../__factories__/lifecycle';

const PARENT = 'https://openheaders.io/ro';
const CHILD = 'https://openheaders.io/app/page.js';

/** A URL → lifecycle lookup over a fixed set, like the App-side closure. */
function lookupOver(rows: readonly RequestLifecycle[]): (url: string) => RequestLifecycle | null {
  const byUrl = new Map(rows.map((r) => [r.url, r]));
  return (url) => byUrl.get(url) ?? null;
}

describe('computeUpstreamChain — parent resolution', () => {
  it('walks the HAR `_initiator` for a landed hop (root first)', () => {
    const parent = makeLifecycle({ url: PARENT });
    const child = makeLifecycle({ url: CHILD, harOverrides: { initiator: { url: PARENT } } });
    const chain = computeUpstreamChain(child, lookupOver([parent, child]));
    expect(chain.map((e) => e.url)).toEqual([PARENT, CHILD]);
  });

  it('falls back to the lifecycle initiator URL while in flight (no HAR)', () => {
    const parent = makeLifecycle({ url: PARENT });
    // In-flight: HAR hop is null, but the request-start initiator URL is known.
    const child = makeLifecycle({ url: CHILD, initiator: PARENT, har: [null] });
    const chain = computeUpstreamChain(child, lookupOver([parent, child]));
    expect(chain.map((e) => e.url)).toEqual([PARENT, CHILD]);
    expect(chain[1]?.lifecycle?.url).toBe(CHILD);
  });

  it('includes a URL-only parent entry when the in-flight parent is not tracked', () => {
    const child = makeLifecycle({ url: CHILD, initiator: PARENT, har: [null] });
    const chain = computeUpstreamChain(child, lookupOver([child]));
    expect(chain.map((e) => e.url)).toEqual([PARENT, CHILD]);
    expect(chain[0]?.lifecycle).toBeNull();
  });

  it('returns just the row when in-flight with no initiator (nothing to chain)', () => {
    const child = makeLifecycle({ url: CHILD, har: [null] });
    const chain = computeUpstreamChain(child, lookupOver([child]));
    expect(chain.map((e) => e.url)).toEqual([CHILD]);
  });

  it('expands a redirected ancestor into all its hop URLs (host redirect chain)', () => {
    const ROOT = 'https://openheaders.io/';
    const RO = 'https://openheaders.io/ro';
    // The navigation openheaders.io/ → 302 → openheaders.io/ro is ONE lifecycle
    // with two hops; a top-level navigation has no initiator, so the chain stops
    // at the root hop.
    const nav = makeLifecycle({
      url: RO,
      redirectHopCount: 1,
      redirectHops: [{ sourceUrl: ROOT, redirectUrl: RO, statusCode: 302, timestampMs: 1 }],
      har: [null],
    });
    const child = makeLifecycle({ url: CHILD, initiator: RO, har: [null] });
    const chain = computeUpstreamChain(child, lookupOver([nav, child]));
    // Root-first, every redirect hop present: openheaders.io/ → /ro → page.js.
    expect(chain.map((e) => e.url)).toEqual([ROOT, RO, CHILD]);
    // The redirect source is URL-only; the current nav URL maps to its lifecycle.
    expect(chain[0]?.lifecycle).toBeNull();
    expect(chain[1]?.lifecycle?.url).toBe(RO);
  });
});
