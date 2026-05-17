/**
 * Cascade summary + per-node subtree weights.
 *
 * For a root request and a function that yields each node's downstream
 * children, this walks the cascade once and produces:
 *
 *   - A flat summary (request count, transferred bytes, cumulative ms,
 *     failed count, third-party bytes, per-host breakdown) used by the
 *     sticky header at the top of the Initiator tab.
 *   - A `Map<requestId, SubtreeStats>` used to (a) render per-row
 *     subtree badges and (b) sort siblings by subtree weight when the
 *     user picks "largest first".
 *
 * The walk is O(N) once per render of the tree, deduped by URL via the
 * same cycle guard the view uses for display. We don't recompute in the
 * leaf — the view consumes the precomputed map.
 */

import { isCascadeFailure } from './initiator-row-meta';
import type { InspectorRequest } from './types';

export interface SubtreeStats {
  /** Descendants of this node (excludes the node itself). */
  count: number;
  /** Transferred bytes across descendants. */
  bytes: number;
  /** Cumulative duration in ms across descendants. */
  ms: number;
  /** Failed/blocked descendants. */
  failures: number;
}

export interface CascadeSummary {
  requestCount: number;
  transferredBytes: number;
  cumulativeMs: number;
  failedCount: number;
  /** Bytes transferred for requests whose origin ≠ pageOrigin. */
  thirdPartyBytes: number;
  /** host → aggregate stats for descendants on that host. */
  byHost: ReadonlyMap<string, SubtreeStats>;
  /** Per-node descendant aggregates — keyed by `InspectorRequest.id`. */
  subtreeStats: ReadonlyMap<string, SubtreeStats>;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin || null;
  } catch {
    return null;
  }
}

function pickSizeBytes(entry: InspectorRequest): number {
  const r = entry.harEntry.response;
  if (!r) return 0;
  if (typeof r.bodySize === 'number' && r.bodySize > 0) return r.bodySize;
  if (typeof r.content?.size === 'number' && r.content.size > 0) return r.content.size;
  if (typeof entry.responseSize === 'number' && entry.responseSize > 0) return entry.responseSize;
  return 0;
}


const EMPTY: SubtreeStats = { count: 0, bytes: 0, ms: 0, failures: 0 };

export function computeCascadeSummary(
  root: InspectorRequest,
  getChildren: (url: string) => readonly InspectorRequest[],
  pageOrigin: string | null,
): CascadeSummary {
  const subtreeStats = new Map<string, SubtreeStats>();
  const byHost = new Map<string, SubtreeStats>();
  let requestCount = 0;
  let transferredBytes = 0;
  let cumulativeMs = 0;
  let failedCount = 0;
  let thirdPartyBytes = 0;

  function recordGlobal(entry: InspectorRequest, bytes: number, ms: number, failure: number) {
    requestCount++;
    transferredBytes += bytes;
    cumulativeMs += ms;
    failedCount += failure;
    if (pageOrigin && originOf(entry.url) !== pageOrigin) {
      thirdPartyBytes += bytes;
    }
    const host = hostOf(entry.url);
    if (host) {
      const existing = byHost.get(host) ?? { count: 0, bytes: 0, ms: 0, failures: 0 };
      existing.count++;
      existing.bytes += bytes;
      existing.ms += ms;
      existing.failures += failure;
      byHost.set(host, existing);
    }
  }

  /**
   * Returns the subtree stats *of this node* — i.e. its descendants,
   * not including itself. `seen` carries the ancestor URL set so we
   * cycle-guard the same way the view does.
   */
  function walk(req: InspectorRequest, isRoot: boolean, seen: ReadonlySet<string>): SubtreeStats {
    if (seen.has(req.url)) return EMPTY;
    const nextSeen = new Set(seen);
    nextSeen.add(req.url);

    if (!isRoot) {
      const bytes = pickSizeBytes(req);
      const ms = req.duration ?? 0;
      const failure = isCascadeFailure(req) ? 1 : 0;
      recordGlobal(req, bytes, ms, failure);
    }

    const children = getChildren(req.url);
    let subCount = 0;
    let subBytes = 0;
    let subMs = 0;
    let subFailures = 0;
    for (const child of children) {
      // Cycle child — the chain renders it as a leaf with no recursion;
      // mirror that by skipping its contribution to subtree stats too.
      if (nextSeen.has(child.url)) continue;
      const childSub = walk(child, false, nextSeen);
      const childBytes = pickSizeBytes(child);
      const childMs = child.duration ?? 0;
      const childFailure = isCascadeFailure(child) ? 1 : 0;
      subCount += 1 + childSub.count;
      subBytes += childBytes + childSub.bytes;
      subMs += childMs + childSub.ms;
      subFailures += childFailure + childSub.failures;
    }
    const stats: SubtreeStats = { count: subCount, bytes: subBytes, ms: subMs, failures: subFailures };
    subtreeStats.set(req.id, stats);
    return stats;
  }

  walk(root, true, new Set());

  return {
    requestCount,
    transferredBytes,
    cumulativeMs,
    failedCount,
    thirdPartyBytes,
    byHost,
    subtreeStats,
  };
}
