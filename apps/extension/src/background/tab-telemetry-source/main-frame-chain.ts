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
 *
 * `isMainFrameDocument` resolves the one frame-sensitive case the same
 * way the fire was buffered (see {@link isMainFrameNavigation}); the
 * caller wires it to the main-frame registry.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';

import { normalizeUrlForTracking } from '../modules/url-utils';

export function mainFrameRequestIdsMatchingCommit(
  lifecycles: readonly RequestLifecycle[],
  committedUrl: string,
  isMainFrameDocument: (lifecycle: RequestLifecycle) => boolean,
): ReadonlySet<string> {
  const normalized = normalizeUrlForTracking(committedUrl);
  if (isExtensionUrl(normalized)) return new Set();

  const matches = new Set<string>();
  for (const lifecycle of lifecycles) {
    if (!isMainFrameNavigation(lifecycle, isMainFrameDocument)) continue;
    if (chainContains(lifecycle, normalized)) matches.add(lifecycle.requestId);
  }
  return matches;
}

/**
 * A main-frame navigation in EITHER correlator vocabulary. The heuristic
 * (webRequest) path tags it `main_frame`; the CDP path tags every
 * document — top-level AND iframe — `document`, so the main-frame split
 * is resolved against the tab's main-frame id exactly as the rule-engine
 * driver resolved it when it buffered the fire (`toTrackedResourceType`).
 * Without the CDP branch a CDP-owned tab's navigation fire is buffered
 * (driver maps document → main_frame) but never promoted (raw type is
 * `document`), so the request silently loses its rule attribution.
 *
 * Shared by the commit-promotion path above and the failed-navigation
 * promotion in the lifecycle projection — both must classify a CDP
 * navigation the same way the buffering side did. The caller injects the
 * main-frame resolver so this stays pure.
 */
export function isMainFrameNavigation(
  lifecycle: RequestLifecycle,
  isMainFrameDocument: (lifecycle: RequestLifecycle) => boolean,
): boolean {
  if (lifecycle.resourceType === 'main_frame') return true;
  if (lifecycle.resourceType === 'document') return isMainFrameDocument(lifecycle);
  return false;
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
