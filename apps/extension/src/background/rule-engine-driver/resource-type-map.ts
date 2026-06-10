/**
 * Resource-type vocabulary seam — lifecycle `resourceType` →
 * `TrackedResourceType` (the webRequest vocabulary the rule-engine
 * driver and tab-telemetry speak).
 *
 * The lifecycle deliberately carries per-correlator vocabularies: the
 * heuristic path emits webRequest types (`main_frame`, `xmlhttprequest`)
 * while the CDP path emits lowercased CDP types (`document`, `xhr`,
 * `fetch`) — the richer CDP set is parity-faithful for the panel's Type
 * column (fetch ≠ xhr), so it is NOT normalized at the source. This
 * module is the single translation point at the driver boundary.
 *
 * `document` is the one frame-sensitive case: CDP reports both top-level
 * navigations and iframe documents as `Document`, while webRequest splits
 * them into `main_frame` / `sub_frame` — the split tab-telemetry's
 * commit-gated chain buffer keys on. The caller resolves the issuing
 * frame against the main-frame registry; an unproven document maps to
 * `sub_frame` (immediate record) so a fire is never stranded waiting for
 * a commit that cannot arrive.
 */

import type { TrackedResourceType } from '@/types/browser';

const TRACKED: ReadonlySet<string> = new Set<TrackedResourceType>([
  'main_frame',
  'sub_frame',
  'xmlhttprequest',
  'script',
  'stylesheet',
  'image',
  'font',
  'media',
  'websocket',
  'ping',
  'other',
]);

/**
 * CDP-only vocabulary (lowercased) → webRequest. Types webRequest never
 * surfaces (`preflight`, `manifest`, `signedexchange`, …) fold to
 * `other`, matching what the heuristic path would have reported.
 */
const CDP_TO_TRACKED: Readonly<Record<string, TrackedResourceType>> = {
  xhr: 'xmlhttprequest',
  fetch: 'xmlhttprequest',
  eventsource: 'xmlhttprequest',
};

export function toTrackedResourceType(resourceType: string, isMainFrameDocument: boolean): TrackedResourceType {
  if (resourceType === 'document') return isMainFrameDocument ? 'main_frame' : 'sub_frame';
  if (TRACKED.has(resourceType)) return resourceType as TrackedResourceType;
  return CDP_TO_TRACKED[resourceType] ?? 'other';
}
