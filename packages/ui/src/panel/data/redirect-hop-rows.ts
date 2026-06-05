/**
 * Redirect-hop row synthesis — the panel-local un-folding of a redirect
 * chain into the per-hop rows the network table renders.
 *
 * Invariant 4 keeps one `RequestLifecycle` per request including its
 * redirects: the hops live in `lifecycle.har[]` / `lifecycle.redirectHops[]`
 * and the lifecycle's "current" cursor (`redirectHopCount`) points at the
 * final hop. The store never splits. But the table shows each hop as its
 * own row — a `302` "document / Redirect" row, then the `200` "document"
 * row — so the view must un-fold the chain.
 *
 * This mirrors the synthetic-lifecycle idiom of `memory-cache-rows.ts`:
 * each intermediate hop becomes a self-contained terminal lifecycle whose
 * single HAR shell is that hop's existing `har[hop]` entry, with a distinct
 * `oh-redir:` requestId. The real lifecycle stays as the final-hop row (its
 * `currentHarEntry` already resolves to the final hop), so every downstream
 * `currentHarEntry` consumer and the selection model are unchanged — each
 * row's lifecycle has exactly one hop.
 *
 * Synthetic ids never leak: HAR entries carry no id field, and selection is
 * requestId-keyed, so a redirect-hop row selects and inspects like any other.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';

/** `oh-redir:` requestId prefix — disjoint from chrome's numeric ids. */
const SYNTHETIC_ID_PREFIX = 'oh-redir:';

/**
 * Synthesize the terminal lifecycle for a single redirect hop of `lc`.
 *
 * `hop` indexes the redirect chain (`0 .. redirectHopCount - 1`); the hop's
 * HAR shell is `lc.har[hop]` and its 3xx metadata is `lc.redirectHops[hop]`.
 * The row's URL is the URL that produced the 3xx (`sourceUrl`), matching the
 * host's redirect-row URL. Returns `null` when either side of the hop is
 * absent (a hop whose HAR has not landed) so the caller can skip it.
 */
export function synthesizeRedirectHopLifecycle(lc: RequestLifecycle, hop: number): RequestLifecycle | null {
  const har = lc.har[hop];
  const redirect = lc.redirectHops[hop];
  if (har == null || redirect == null) return null;

  const parsed = Date.parse(har.startedDateTime);
  const startedAtMs = Number.isNaN(parsed) ? lc.startedAtMs : parsed;
  const duration = typeof har.time === 'number' && har.time > 0 ? har.time : 0;

  return {
    tabId: lc.tabId,
    requestId: `${SYNTHETIC_ID_PREFIX}${lc.requestId}#${hop}`,
    url: redirect.sourceUrl,
    method: lc.method,
    resourceType: lc.resourceType,
    initiator: lc.initiator,
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs,
    hopStartedAtMs: startedAtMs,
    completedAtMs: startedAtMs + duration,
    statusCode: redirect.statusCode,
    statusText: har.response?.statusText,
    fromCache: false,
    har: [har],
    harBodyByHop: [],
  };
}

/**
 * Synthesize the terminal lifecycle for every redirect hop of `lc`, in hop
 * order. A non-redirect lifecycle yields `[]`; hops whose HAR has not landed
 * are skipped. The real lifecycle (the final hop) is NOT included — the
 * caller pairs these with it.
 */
export function synthesizeRedirectHopLifecycles(lc: RequestLifecycle): RequestLifecycle[] {
  if (lc.redirectHopCount <= 0) return [];
  const out: RequestLifecycle[] = [];
  for (let hop = 0; hop < lc.redirectHopCount; hop++) {
    const synth = synthesizeRedirectHopLifecycle(lc, hop);
    if (synth !== null) out.push(synth);
  }
  return out;
}
