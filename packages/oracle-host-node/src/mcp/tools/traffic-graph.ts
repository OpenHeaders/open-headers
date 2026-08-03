/**
 * `traffic_graph`'s structure report, computed host-side over redacted
 * projections (AGENT_TRAFFIC_PLAN.md §5, slice S5). Like the diff, the
 * point is to never hand the agent an edge dump: the host resolves
 * redirect chains, joins initiator chains, walks the waterfall's
 * critical path and clusters failures — the agent gets chains, clusters
 * and counts.
 *
 * Two structural facts this module leans on:
 *
 *   - **Redirect hops fold into ONE record** (the lifecycle spine's
 *     law): one requestId = one graph node regardless of hop count, so
 *     double-counting across hops is impossible by construction. The
 *     per-hop URLs survive in the record's bounded `redirectTrail`.
 *   - **The initiator join is approximate by construction.** A record's
 *     `initiator` is a URL string joined against other records' URLs —
 *     several records can share a URL (the earliest not-later-started
 *     match wins), and the heuristic correlator only carries an origin,
 *     which joins nothing. The tool description says so out loud
 *     rather than pretending precision.
 *
 * Everything compared or reported here is already redacted/normalized
 * at the projection boundary — marker equality is value equality, and
 * the initiator join works on markers exactly like the diff does.
 */

import type { TrafficRecordProjection } from '@openheaders/core/traffic';

/** The failure vocabulary shared with `traffic_failures` — clustering
 *  and the failure list must classify identically. */
export type TrafficFailureKind = 'network-error' | 'http-5xx' | 'http-4xx';

/** An HTTP error status or a request that never completed. */
export function isFailureProjection(record: TrafficRecordProjection): boolean {
  return record.phase === 'failed' || (record.statusCode !== undefined && record.statusCode >= 400);
}

export function trafficFailureKind(record: TrafficRecordProjection): TrafficFailureKind {
  return record.phase === 'failed' ? 'network-error' : (record.statusCode ?? 0) >= 500 ? 'http-5xx' : 'http-4xx';
}

/** One resolved redirect chain — a single record's hop trail plus its
 *  final stop; `truncated` when the retained trail is shorter than the
 *  honest hop count. */
export interface TrafficRedirectChain {
  readonly requestId: string;
  readonly method: string;
  readonly hops: readonly { readonly url: string; readonly statusCode?: number }[];
  readonly finalUrl: string;
  readonly finalStatusCode?: number;
  readonly hopCount: number;
  readonly truncated: boolean;
  readonly startedAtMs: number;
}

/** One initiator chain, root → leaf. `urls` and `requestIds` run in
 *  parallel; every node is a record in the window. */
export interface TrafficInitiatorChain {
  readonly urls: readonly string[];
  readonly requestIds: readonly string[];
  readonly depth: number;
}

export interface TrafficCriticalPathNode {
  readonly requestId: string;
  readonly url: string;
  readonly startedAtMs: number;
  readonly completedAtMs?: number;
  readonly durationMs?: number;
}

/** The waterfall's critical path: the initiator chain ending at the
 *  LAST request to complete in the window, with the window span. */
export interface TrafficCriticalPath {
  readonly chain: readonly TrafficCriticalPathNode[];
  readonly windowStartedAtMs: number;
  readonly windowEndedAtMs: number;
  readonly windowSpanMs: number;
}

/** One failure cluster — N failing records folded to one endpoint. */
export interface TrafficFailureCluster {
  readonly failureKind: TrafficFailureKind;
  /** origin + pathname; a variable-shaped last segment (numeric id,
   *  uuid, token, redaction marker) folds to `*`. Query never counts. */
  readonly path: string;
  readonly count: number;
  readonly statusCodes: readonly number[];
  readonly errorCodes: readonly string[];
  readonly sampleRequestIds: readonly string[];
  readonly firstStartedAtMs: number;
  readonly lastStartedAtMs: number;
}

export interface TrafficGraphReport {
  readonly redirectChains: readonly TrafficRedirectChain[];
  readonly initiatorChains: readonly TrafficInitiatorChain[];
  readonly criticalPath: TrafficCriticalPath | null;
  readonly failureClusters: readonly TrafficFailureCluster[];
}

/** Depth bound on initiator walks — a join cycle (two records naming
 *  each other's URL) must terminate, and a deeper chain than this is
 *  noise, not signal. */
const MAX_CHAIN_DEPTH = 10;

const SAMPLE_REQUEST_IDS = 3;

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_SEGMENT = /^(?=.*\d)[A-Za-z0-9_-]{16,}$/;
const MARKER_SEGMENT = /^\[redacted:[0-9a-f]{8}\]$/;

function isVariableSegment(segment: string): boolean {
  return (
    /^\d+$/.test(segment) || UUID_SEGMENT.test(segment) || TOKEN_SEGMENT.test(segment) || MARKER_SEGMENT.test(segment)
  );
}

/** origin + pathname with a variable-shaped last segment folded to `*`
 *  — `/api/users/123` and `/api/users/456` are one endpoint. */
function clusterPath(raw: string): string {
  let base: string;
  try {
    const url = new URL(raw);
    base = `${url.origin}${url.pathname}`;
  } catch {
    const cut = raw.split('#')[0] ?? raw;
    base = cut.split('?')[0] ?? cut;
  }
  const slash = base.lastIndexOf('/');
  if (slash < 0) return base;
  const last = base.slice(slash + 1);
  return last.length > 0 && isVariableSegment(last) ? `${base.slice(0, slash)}/*` : base;
}

/** Resolve each record's initiator to a parent RECORD: the latest
 *  record sharing the initiator's URL that did not start later, else
 *  the earliest — approximate by construction, never a self-join. */
function resolveParents(rows: readonly TrafficRecordProjection[]): Map<string, TrafficRecordProjection> {
  const byUrl = new Map<string, TrafficRecordProjection[]>();
  for (const row of rows) {
    const group = byUrl.get(row.url);
    if (group === undefined) byUrl.set(row.url, [row]);
    else group.push(row);
  }
  for (const group of byUrl.values()) group.sort((a, b) => a.startedAtMs - b.startedAtMs);

  const parents = new Map<string, TrafficRecordProjection>();
  for (const row of rows) {
    if (row.initiator === undefined) continue;
    const candidates = byUrl.get(row.initiator);
    if (candidates === undefined) continue;
    let parent: TrafficRecordProjection | undefined;
    for (const candidate of candidates) {
      if (candidate.requestId === row.requestId) continue;
      if (candidate.startedAtMs <= row.startedAtMs) parent = candidate;
      else break;
    }
    parent ??= candidates.find((candidate) => candidate.requestId !== row.requestId);
    if (parent !== undefined) parents.set(row.requestId, parent);
  }
  return parents;
}

/** Walk root-ward from `leaf` through the parent join, bounded and
 *  cycle-guarded; returns the chain root → leaf. */
function chainTo(
  leaf: TrafficRecordProjection,
  parents: Map<string, TrafficRecordProjection>,
): TrafficRecordProjection[] {
  const chain: TrafficRecordProjection[] = [leaf];
  const seen = new Set<string>([leaf.requestId]);
  let cursor = leaf;
  while (chain.length < MAX_CHAIN_DEPTH) {
    const parent = parents.get(cursor.requestId);
    if (parent === undefined || seen.has(parent.requestId)) break;
    chain.push(parent);
    seen.add(parent.requestId);
    cursor = parent;
  }
  return chain.reverse();
}

function redirectChains(rows: readonly TrafficRecordProjection[]): TrafficRedirectChain[] {
  const chains: TrafficRedirectChain[] = [];
  for (const row of rows) {
    if (row.redirectHopCount === 0) continue;
    const hops = row.redirectTrail ?? [];
    chains.push({
      requestId: row.requestId,
      method: row.method,
      hops: hops.map((hop) => ({
        url: hop.url,
        ...(hop.statusCode !== undefined ? { statusCode: hop.statusCode } : {}),
      })),
      finalUrl: row.url,
      ...(row.statusCode !== undefined ? { finalStatusCode: row.statusCode } : {}),
      hopCount: row.redirectHopCount,
      truncated: hops.length < row.redirectHopCount,
      startedAtMs: row.startedAtMs,
    });
  }
  chains.sort((a, b) => a.startedAtMs - b.startedAtMs);
  return chains;
}

function initiatorChains(
  rows: readonly TrafficRecordProjection[],
  parents: Map<string, TrafficRecordProjection>,
): TrafficInitiatorChain[] {
  const isParent = new Set<string>();
  for (const parent of parents.values()) isParent.add(parent.requestId);
  const chains: TrafficInitiatorChain[] = [];
  for (const row of rows) {
    // One chain per LEAF that actually joined somewhere — inner nodes
    // appear inside their leaves' chains, never as chains of their own.
    if (isParent.has(row.requestId) || !parents.has(row.requestId)) continue;
    const chain = chainTo(row, parents);
    chains.push({
      urls: chain.map((node) => node.url),
      requestIds: chain.map((node) => node.requestId),
      depth: chain.length,
    });
  }
  // Deepest first — under a cap, the structural chains beat the
  // two-node ones; started-at breaks ties deterministically.
  chains.sort((a, b) => b.depth - a.depth);
  return chains;
}

function criticalPath(
  rows: readonly TrafficRecordProjection[],
  parents: Map<string, TrafficRecordProjection>,
): TrafficCriticalPath | null {
  let last: TrafficRecordProjection | undefined;
  for (const row of rows) {
    if (row.completedAtMs === undefined) continue;
    if (last?.completedAtMs === undefined || row.completedAtMs > last.completedAtMs) last = row;
  }
  if (last?.completedAtMs === undefined) return null;
  let windowStart = Number.POSITIVE_INFINITY;
  for (const row of rows) windowStart = Math.min(windowStart, row.startedAtMs);
  return {
    chain: chainTo(last, parents).map((node) => ({
      requestId: node.requestId,
      url: node.url,
      startedAtMs: node.startedAtMs,
      ...(node.completedAtMs !== undefined
        ? { completedAtMs: node.completedAtMs, durationMs: Math.round(node.completedAtMs - node.startedAtMs) }
        : {}),
    })),
    windowStartedAtMs: windowStart,
    windowEndedAtMs: last.completedAtMs,
    windowSpanMs: Math.round(last.completedAtMs - windowStart),
  };
}

function failureClusters(rows: readonly TrafficRecordProjection[]): TrafficFailureCluster[] {
  interface Accumulator {
    failureKind: TrafficFailureKind;
    path: string;
    count: number;
    statusCodes: Set<number>;
    errorCodes: Set<string>;
    sampleRequestIds: string[];
    firstStartedAtMs: number;
    lastStartedAtMs: number;
  }
  const clusters = new Map<string, Accumulator>();
  for (const row of rows) {
    if (!isFailureProjection(row)) continue;
    const kind = trafficFailureKind(row);
    const path = clusterPath(row.url);
    const key = `${kind} ${path}`;
    let cluster = clusters.get(key);
    if (cluster === undefined) {
      cluster = {
        failureKind: kind,
        path,
        count: 0,
        statusCodes: new Set(),
        errorCodes: new Set(),
        sampleRequestIds: [],
        firstStartedAtMs: row.startedAtMs,
        lastStartedAtMs: row.startedAtMs,
      };
      clusters.set(key, cluster);
    }
    cluster.count++;
    if (row.statusCode !== undefined) cluster.statusCodes.add(row.statusCode);
    if (row.error !== undefined) cluster.errorCodes.add(row.error.code);
    if (cluster.sampleRequestIds.length < SAMPLE_REQUEST_IDS) cluster.sampleRequestIds.push(row.requestId);
    cluster.firstStartedAtMs = Math.min(cluster.firstStartedAtMs, row.startedAtMs);
    cluster.lastStartedAtMs = Math.max(cluster.lastStartedAtMs, row.startedAtMs);
  }
  const out = [...clusters.values()].map((cluster) => ({
    failureKind: cluster.failureKind,
    path: cluster.path,
    count: cluster.count,
    statusCodes: [...cluster.statusCodes].sort((a, b) => a - b),
    errorCodes: [...cluster.errorCodes].sort(),
    sampleRequestIds: cluster.sampleRequestIds,
    firstStartedAtMs: cluster.firstStartedAtMs,
    lastStartedAtMs: cluster.lastStartedAtMs,
  }));
  // Biggest cluster first — "these 14 failures are one endpoint" is
  // the headline; path breaks ties deterministically.
  out.sort((a, b) => b.count - a.count || (a.path < b.path ? -1 : 1));
  return out;
}

/**
 * Reduce one window of projections to its structure. Pure and uncapped
 * — the tool layer slices each list with honest totals, mirroring the
 * diff's capped-report idiom.
 */
export function computeTrafficGraph(rows: readonly TrafficRecordProjection[]): TrafficGraphReport {
  const parents = resolveParents(rows);
  return {
    redirectChains: redirectChains(rows),
    initiatorChains: initiatorChains(rows, parents),
    criticalPath: criticalPath(rows, parents),
    failureClusters: failureClusters(rows),
  };
}
