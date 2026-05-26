/**
 * Pure projection: given a tab's lifecycle snapshot and a committed URL,
 * return the set of main-frame requestIds whose navigation chain led to
 * that URL. Replaces tab-telemetry's `mainFrameChains` parallel state.
 *
 * The chain of a main-frame lifecycle is `{lifecycle.url} ∪
 * {hop.sourceUrl for hop in redirectHops}` — the final URL plus every
 * pre-redirect origin, normalized. Match iff the normalized committed
 * URL appears anywhere in that set.
 *
 * Extension-URL commits (chrome-extension://, moz-extension://, etc.)
 * are intermediate hops — the user-visible destination is whatever the
 * extension page navigates to next. We return an empty set so the
 * caller's promotion loop is a no-op while the page-state reset
 * proceeds normally.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';

import { normalizeUrlForTracking } from '../modules/url-utils';

export function mainFrameRequestIdsMatchingCommit(
  lifecycles: readonly RequestLifecycle[],
  committedUrl: string,
): ReadonlySet<string> {
  const normalized = normalizeUrlForTracking(committedUrl);
  if (isExtensionUrl(normalized)) return new Set();

  const matches = new Set<string>();
  for (const lifecycle of lifecycles) {
    if (lifecycle.resourceType !== 'main_frame') continue;
    if (chainContains(lifecycle, normalized)) matches.add(lifecycle.requestId);
  }
  return matches;
}

function chainContains(lifecycle: RequestLifecycle, normalized: string): boolean {
  if (normalizeUrlForTracking(lifecycle.url) === normalized) return true;
  for (const hop of lifecycle.redirectHops) {
    if (normalizeUrlForTracking(hop.sourceUrl) === normalized) return true;
  }
  return false;
}

function isExtensionUrl(url: string): boolean {
  return (
    url.startsWith('chrome-extension://') ||
    url.startsWith('extension://') ||
    url.startsWith('moz-extension://') ||
    url.startsWith('safari-web-extension://')
  );
}
