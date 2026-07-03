/**
 * Cascade summary + per-node subtree weights.
 *
 * For a root lifecycle and a function that yields each node's
 * downstream children, this walks the cascade once and produces:
 *
 *   - A flat summary (request count, transferred bytes, cumulative ms,
 *     failed count, third-party bytes, per-host breakdown) used by the
 *     sticky header at the top of the Initiator tab.
 *   - A `Map<requestId, SubtreeStats>` used to (a) render per-row
 *     subtree badges and (b) sort siblings by subtree weight when the
 *     user picks "largest first".
 *
 * Walk is O(N) once per render of the tree, deduped by URL via the
 * same cycle guard the view uses for display.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { isCascadeFailure } from '../initiator-row-meta';
import { currentHarEntry, lifecycleTransferredBytes } from '../inspector-row-projection';

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
  /** Per-node descendant aggregates — keyed by `lifecycle.requestId`. */
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

function pickSizeBytes(lc: RequestLifecycle): number {
  const t = lifecycleTransferredBytes(lc);
  if (t != null && t > 0) return t;
  const cs = currentHarEntry(lc)?.response?.content?.size;
  return typeof cs === 'number' && cs > 0 ? cs : 0;
}

function pickDurationMs(lc: RequestLifecycle): number {
  const harTime = currentHarEntry(lc)?.time;
  if (typeof harTime === 'number' && harTime > 0) return harTime;
  if (lc.completedAtMs != null) {
    const d = lc.completedAtMs - lc.startedAtMs;
    if (d > 0) return d;
  }
  return 0;
}

const EMPTY: SubtreeStats = { count: 0, bytes: 0, ms: 0, failures: 0 };

export function computeCascadeSummary(
  root: RequestLifecycle,
  getChildren: (url: string) => readonly RequestLifecycle[],
  pageOrigin: string | null,
): CascadeSummary {
  const subtreeStats = new Map<string, SubtreeStats>();
  const byHost = new Map<string, SubtreeStats>();
  let requestCount = 0;
  let transferredBytes = 0;
  let cumulativeMs = 0;
  let failedCount = 0;
  let thirdPartyBytes = 0;

  function recordGlobal(lc: RequestLifecycle, bytes: number, ms: number, failure: number) {
    requestCount++;
    transferredBytes += bytes;
    cumulativeMs += ms;
    failedCount += failure;
    if (pageOrigin && originOf(lc.url) !== pageOrigin) {
      thirdPartyBytes += bytes;
    }
    const host = hostOf(lc.url);
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
   * Returns this node's subtree stats — descendants only, not the node
   * itself. `seen` carries the ancestor URL set so we cycle-guard the
   * same way the view does.
   */
  function walk(lc: RequestLifecycle, isRoot: boolean, seen: ReadonlySet<string>): SubtreeStats {
    if (seen.has(lc.url)) return EMPTY;
    const nextSeen = new Set(seen);
    nextSeen.add(lc.url);

    if (!isRoot) {
      const bytes = pickSizeBytes(lc);
      const ms = pickDurationMs(lc);
      const failure = isCascadeFailure(lc) ? 1 : 0;
      recordGlobal(lc, bytes, ms, failure);
    }

    const children = getChildren(lc.url);
    let subCount = 0;
    let subBytes = 0;
    let subMs = 0;
    let subFailures = 0;
    for (const child of children) {
      if (nextSeen.has(child.url)) continue;
      const childSub = walk(child, false, nextSeen);
      const childBytes = pickSizeBytes(child);
      const childMs = pickDurationMs(child);
      const childFailure = isCascadeFailure(child) ? 1 : 0;
      subCount += 1 + childSub.count;
      subBytes += childBytes + childSub.bytes;
      subMs += childMs + childSub.ms;
      subFailures += childFailure + childSub.failures;
    }
    const stats: SubtreeStats = { count: subCount, bytes: subBytes, ms: subMs, failures: subFailures };
    subtreeStats.set(lc.requestId, stats);
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
