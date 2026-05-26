/**
 * Pure projection: derive the set of normalized URLs observed on a tab
 * from a `RequestLifecycleStore` snapshot. Replaces tab-telemetry's
 * `observedUrls` parallel state with a derivation off the canonical
 * data already in the store.
 *
 * Consumed by test-runner's session-end static-arbitration pass. Walks
 * every lifecycle's redirect chain (`redirectHops[*].sourceUrl` covers
 * every pre-redirect URL; `lifecycle.url` is the final hop) and
 * applies the same trackable-scheme + normalization gate the
 * projection used when recording URLs into the deleted set.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';

import { isTrackableUrl, normalizeUrlForTracking } from '../modules/url-utils';

export function deriveObservedUrls(lifecycles: readonly RequestLifecycle[]): ReadonlySet<string> {
  const urls = new Set<string>();
  for (const lifecycle of lifecycles) {
    addIfTrackable(urls, lifecycle.url);
    for (const hop of lifecycle.redirectHops) {
      addIfTrackable(urls, hop.sourceUrl);
    }
  }
  return urls;
}

function addIfTrackable(set: Set<string>, url: string): void {
  if (!isTrackableUrl(url)) return;
  set.add(normalizeUrlForTracking(url));
}
