/**
 * Redirect-target → source pairing.
 *
 * A 3xx response in the panel is represented as its own row carrying the
 * `Location` header in `harEntry.response.redirectURL`. The browser then
 * issues a follow-up request to that URL; that follow-up is a separate
 * row, but Chrome's Network panel pairs the two by showing the source's
 * status code (e.g. `301`) as a clickable link in the follow-up's
 * Initiator column. Clicking jumps back to the source row.
 *
 * We mirror that pairing here. For every entry that has a prior entry
 * whose `response.redirectURL` matches its URL, we map the follower to
 * the source. When both rows carry a `chromeRequestId`, we additionally
 * require them to match — Chrome reuses the requestId across a redirect
 * chain, so this disambiguates unrelated requests that happen to share
 * a URL (e.g. polling).
 */

import type { InspectorRequest } from '../../data/types';

export type RedirectIndex = ReadonlyMap<string, { sourceId: string; sourceStatus: number }>;

function redirectTargetUrl(entry: InspectorRequest): string | null {
  const url = entry.harEntry.response?.redirectURL;
  return typeof url === 'string' && url ? url : null;
}

function isRedirectStatus(status: number | undefined): status is number {
  return typeof status === 'number' && status >= 300 && status < 400;
}

export function deriveRedirectPairs(entries: readonly InspectorRequest[]): RedirectIndex {
  // Bucket prospective sources by their `redirectURL`, so each follower
  // lookup is O(1). Sort each bucket by timestamp so the nearest prior
  // source wins when the same URL is redirected to repeatedly.
  const byTargetUrl = new Map<string, InspectorRequest[]>();
  for (const e of entries) {
    if (!isRedirectStatus(e.statusCode)) continue;
    const target = redirectTargetUrl(e);
    if (!target) continue;
    let bucket = byTargetUrl.get(target);
    if (!bucket) {
      bucket = [];
      byTargetUrl.set(target, bucket);
    }
    bucket.push(e);
  }
  for (const bucket of byTargetUrl.values()) {
    bucket.sort((a, b) => a.timestamp - b.timestamp || a.arrivalIndex - b.arrivalIndex);
  }

  const out = new Map<string, { sourceId: string; sourceStatus: number }>();
  for (const follower of entries) {
    const bucket = byTargetUrl.get(follower.url);
    if (!bucket) continue;
    // Walk back from the most recent source; pick the latest one that
    // started before this follower. Chrome reuses the requestId across
    // a chain, so when both sides carry one we require them to match.
    for (let i = bucket.length - 1; i >= 0; i--) {
      const candidate = bucket[i];
      if (candidate.id === follower.id) continue;
      if (candidate.timestamp > follower.timestamp) continue;
      if (
        candidate.chromeRequestId &&
        follower.chromeRequestId &&
        candidate.chromeRequestId !== follower.chromeRequestId
      ) {
        continue;
      }
      out.set(follower.id, { sourceId: candidate.id, sourceStatus: candidate.statusCode as number });
      break;
    }
  }
  return out;
}
