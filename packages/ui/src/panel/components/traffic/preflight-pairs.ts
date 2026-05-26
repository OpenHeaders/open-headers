/**
 * Preflight pair derivation.
 *
 * The browser emits CORS preflight OPTIONS requests as standalone
 * lifecycles. The traffic list renders these specially:
 *
 *   - The preflight row shows Method `OPTIONS`, Type `preflight`,
 *     Initiator "Preflight" linking to the actual request.
 *   - The actual (CORS) request row shows Method as
 *     "<METHOD> + Preflight" with the "Preflight" text linking back
 *     to the preflight entry.
 *
 * Lifecycles don't embed cross-references, so the pairing is derived
 * here: pair each preflight with the nearest subsequent non-OPTIONS
 * lifecycle on the same URL. Bucket by URL → sort by `startedAtMs`
 * with `displayId` as tiebreak → forward-scan for the parent.
 */

import { currentHarEntry, type InspectorRowWithFires } from '../../data/inspector-row-projection';

export type PreflightRole =
  | { kind: 'none' }
  | { kind: 'preflight'; peerId: string }
  | { kind: 'parent'; peerId: string };

export type PreflightIndex = ReadonlyMap<string, PreflightRole>;

function isPreflight(row: InspectorRowWithFires): boolean {
  const lc = row.lifecycle;
  const rt = (lc.resourceType ?? '').toLowerCase();
  if (rt === 'preflight') return true;
  // Defensive fallback — some browsers/engines surface OPTIONS without
  // the `_resourceType: preflight` annotation. Treat as preflight only
  // when it also carries the Access-Control-Request-Method header on
  // the request side (the canonical CORS preflight signature).
  if (lc.method.toUpperCase() !== 'OPTIONS') return false;
  const headers = currentHarEntry(lc)?.request?.headers ?? [];
  return headers.some((h) => h.name.toLowerCase() === 'access-control-request-method');
}

export function derivePreflightPairs(rows: readonly InspectorRowWithFires[]): PreflightIndex {
  const byUrl = new Map<string, InspectorRowWithFires[]>();
  for (const r of rows) {
    let bucket = byUrl.get(r.lifecycle.url);
    if (!bucket) {
      bucket = [];
      byUrl.set(r.lifecycle.url, bucket);
    }
    bucket.push(r);
  }
  // Sort each bucket by wire-execution time. Preflight OPTIONS always
  // dispatches before its parent on the wire. `displayId` is the stable
  // arrival-order tiebreak (1-indexed, monotonic from the inspector facet).
  for (const bucket of byUrl.values()) {
    bucket.sort((a, b) => a.lifecycle.startedAtMs - b.lifecycle.startedAtMs || a.displayId - b.displayId);
  }

  const out = new Map<string, PreflightRole>();
  const claimed = new Set<string>();

  for (const bucket of byUrl.values()) {
    for (let i = 0; i < bucket.length; i++) {
      const pre = bucket[i];
      if (!isPreflight(pre)) continue;
      const preId = pre.lifecycle.requestId;
      if (claimed.has(preId)) continue;
      let parent: InspectorRowWithFires | undefined;
      for (let j = i + 1; j < bucket.length; j++) {
        const cand = bucket[j];
        if (claimed.has(cand.lifecycle.requestId)) continue;
        if (cand.lifecycle.method.toUpperCase() === 'OPTIONS') continue;
        parent = cand;
        break;
      }
      if (!parent) continue;
      const parentId = parent.lifecycle.requestId;
      out.set(preId, { kind: 'preflight', peerId: parentId });
      out.set(parentId, { kind: 'parent', peerId: preId });
      claimed.add(preId);
      claimed.add(parentId);
    }
  }
  return out;
}

export function getRole(index: PreflightIndex, id: string): PreflightRole {
  return index.get(id) ?? { kind: 'none' };
}
