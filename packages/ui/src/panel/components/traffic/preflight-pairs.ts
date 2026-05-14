/**
 * Preflight pair derivation.
 *
 * Chrome emits CORS preflight OPTIONS requests as standalone HAR entries
 * with `_resourceType === 'preflight'`. The native Network tab renders
 * these specially:
 *
 *   - The preflight row shows Method `OPTIONS`, Type `preflight`,
 *     Initiator "Preflight" linking to the actual request.
 *   - The actual (CORS) request row shows Method as "<METHOD> + Preflight"
 *     with the "Preflight" text linking back to the preflight entry.
 *
 * Since the HAR entries don't embed cross-references, we derive the
 * pairing here: pair each preflight entry with the nearest subsequent
 * non-OPTIONS entry on the same URL (typically within a few hundred
 * milliseconds, but we don't bound it — if two preflights fire for the
 * same URL in quick succession, each pairs with its own child by
 * arrival order).
 */

import type { InspectorRequest } from '../../data/types';

export type PreflightRole =
  | { kind: 'none' }
  | { kind: 'preflight'; peerId: string }
  | { kind: 'parent'; peerId: string };

export type PreflightIndex = ReadonlyMap<string, PreflightRole>;

function isPreflight(entry: InspectorRequest): boolean {
  const rt = (entry.resourceType ?? '').toLowerCase();
  if (rt === 'preflight') return true;
  // Defensive fallback — some browsers/engines surface OPTIONS without
  // the `_resourceType: preflight` annotation. Treat as preflight only
  // when it also carries the Access-Control-Request-Method header on
  // the request side (the canonical CORS preflight signature).
  if (entry.method.toUpperCase() !== 'OPTIONS') return false;
  const headers = entry.harEntry.request?.headers ?? [];
  return headers.some((h) => h.name.toLowerCase() === 'access-control-request-method');
}

export function derivePreflightPairs(entries: readonly InspectorRequest[]): PreflightIndex {
  // Bucket entries by URL so pairing stays O(n). We then walk entries
  // in arrival order: each preflight looks ahead in its URL bucket for
  // the next non-OPTIONS entry that hasn't already been claimed.
  const byUrl = new Map<string, InspectorRequest[]>();
  for (const e of entries) {
    let bucket = byUrl.get(e.url);
    if (!bucket) {
      bucket = [];
      byUrl.set(e.url, bucket);
    }
    bucket.push(e);
  }
  // Ensure each bucket is in arrival order.
  for (const bucket of byUrl.values()) {
    bucket.sort((a, b) => a.arrivalIndex - b.arrivalIndex);
  }

  const out = new Map<string, PreflightRole>();
  const claimed = new Set<string>();

  for (const bucket of byUrl.values()) {
    for (let i = 0; i < bucket.length; i++) {
      const pre = bucket[i];
      if (!isPreflight(pre)) continue;
      if (claimed.has(pre.id)) continue;
      // Find the next non-OPTIONS same-URL entry after this one.
      let parent: InspectorRequest | undefined;
      for (let j = i + 1; j < bucket.length; j++) {
        const cand = bucket[j];
        if (claimed.has(cand.id)) continue;
        if (cand.method.toUpperCase() === 'OPTIONS') continue;
        parent = cand;
        break;
      }
      if (!parent) continue;
      out.set(pre.id, { kind: 'preflight', peerId: parent.id });
      out.set(parent.id, { kind: 'parent', peerId: pre.id });
      claimed.add(pre.id);
      claimed.add(parent.id);
    }
  }
  return out;
}

export function getRole(index: PreflightIndex, id: string): PreflightRole {
  return index.get(id) ?? { kind: 'none' };
}
