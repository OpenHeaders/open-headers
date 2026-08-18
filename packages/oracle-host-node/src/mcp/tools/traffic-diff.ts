/**
 * `traffic_diff`'s structural delta, computed host-side over redacted
 * projections (the agent-traffic plan §5, slice S4). The whole point is
 * to never hand the agent two row dumps: requests are paired by
 * method+path, and only the DIFFERENCES cross the wire — status
 * divergence, header presence/value changes, and the request-set
 * remainder each side fired alone.
 *
 * The marker algebra IS the comparison plane (STATUS findings 9/17):
 * redaction replaces equal secret values with equal stable markers, so
 * comparing projected header values compares the underlying secrets
 * without this module ever seeing one — "the failing and the working
 * request sent the SAME token" and "…DIFFERENT tokens" are both
 * provable from markers alone. `resourceType` and every other compared
 * field arrive already normalized/redacted; nothing here reaches
 * around the projection boundary.
 */

import type { TrafficRecordProjection } from '@openheaders/core/traffic';

/** Pairing key: method + origin + pathname. Query strings deliberately
 *  do not participate — tags and cache busters would shatter the very
 *  pairs the diff exists to compare. */
export function trafficDiffPairKey(record: TrafficRecordProjection): string {
  return `${record.method} ${urlPath(record.url)}`;
}

function urlPath(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`;
  } catch {
    const cut = raw.split('#')[0] ?? raw;
    return cut.split('?')[0] ?? cut;
  }
}

/** One side of a matched pair — identity plus the verdict facts the
 *  agent needs to follow up with traffic_get. */
export interface TrafficDiffPairSide {
  readonly requestId: string;
  readonly url: string;
  readonly phase: TrafficRecordProjection['phase'];
  readonly statusCode?: number;
  readonly error?: { readonly code: string; readonly reason: string };
  readonly bodyBytes?: number;
}

/** Presence/value delta over one header plane of a pair. Values are
 *  projected (markers for secrets) — equality means value equality. */
export interface TrafficHeaderDelta {
  /** Both sides captured a header set and no name or value differs. */
  readonly identical: boolean;
  readonly onlyInA: readonly string[];
  readonly onlyInB: readonly string[];
  readonly valueChanged: readonly { readonly name: string; readonly a: string; readonly b: string }[];
  /** A side (or both) never captured this header set — the delta is
   *  unknowable there, reported honestly instead of as "identical". */
  readonly unavailable?: 'a' | 'b' | 'both';
}

export interface TrafficDiffPair {
  readonly method: string;
  readonly path: string;
  readonly a: TrafficDiffPairSide;
  readonly b: TrafficDiffPairSide;
  readonly statusDiverges: boolean;
  readonly requestHeaders: TrafficHeaderDelta;
  readonly responseHeaders: TrafficHeaderDelta;
}

/** Compact remainder row — requests one side fired and the other never
 *  did (per pairing key, with the per-key overflow count). */
export interface TrafficDiffRemainder {
  readonly method: string;
  readonly path: string;
  readonly count: number;
}

export interface TrafficDiffReport {
  readonly comparedPairs: number;
  readonly divergentStatusPairs: number;
  /** Pairs whose REQUEST headers are provably identical (marker-equal)
   *  — the origin session's negative result, first-class. */
  readonly identicalRequestHeaderPairs: number;
  /** Pairs with any difference (status or either header plane). */
  readonly differingPairs: readonly TrafficDiffPair[];
  /** Pairs with no detectable difference, folded per key. */
  readonly identicalPairs: readonly TrafficDiffRemainder[];
  readonly onlyInA: readonly TrafficDiffRemainder[];
  readonly onlyInB: readonly TrafficDiffRemainder[];
}

type HeaderSet = ReadonlyArray<{ readonly name: string; readonly value: string }>;

/** Fold a header list into name → sorted values (case-insensitive
 *  names, multiset values — order never counts as a difference). */
function headerMap(headers: HeaderSet): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const header of headers) {
    const name = header.name.toLowerCase();
    const values = map.get(name);
    if (values === undefined) map.set(name, [header.value]);
    else values.push(header.value);
  }
  for (const values of map.values()) values.sort();
  return map;
}

function diffHeaders(a: HeaderSet | undefined, b: HeaderSet | undefined): TrafficHeaderDelta {
  if (a === undefined || b === undefined) {
    const unavailable = a === undefined && b === undefined ? 'both' : a === undefined ? 'a' : 'b';
    return { identical: false, onlyInA: [], onlyInB: [], valueChanged: [], unavailable };
  }
  const mapA = headerMap(a);
  const mapB = headerMap(b);
  const onlyInA: string[] = [];
  const onlyInB: string[] = [];
  const valueChanged: { name: string; a: string; b: string }[] = [];
  for (const [name, valuesA] of mapA) {
    const valuesB = mapB.get(name);
    if (valuesB === undefined) {
      onlyInA.push(name);
      continue;
    }
    if (valuesA.length !== valuesB.length || valuesA.some((value, i) => value !== valuesB[i])) {
      valueChanged.push({ name, a: valuesA.join(', '), b: valuesB.join(', ') });
    }
  }
  for (const name of mapB.keys()) {
    if (!mapA.has(name)) onlyInB.push(name);
  }
  onlyInA.sort();
  onlyInB.sort();
  valueChanged.sort((x, y) => (x.name < y.name ? -1 : 1));
  return {
    identical: onlyInA.length === 0 && onlyInB.length === 0 && valueChanged.length === 0,
    onlyInA,
    onlyInB,
    valueChanged,
  };
}

function pairSide(record: TrafficRecordProjection): TrafficDiffPairSide {
  return {
    requestId: record.requestId,
    url: record.url,
    phase: record.phase,
    ...(record.statusCode !== undefined ? { statusCode: record.statusCode } : {}),
    ...(record.error !== undefined ? { error: record.error } : {}),
    ...(record.bodyBytes !== undefined ? { bodyBytes: record.bodyBytes } : {}),
  };
}

function statusDiverges(a: TrafficRecordProjection, b: TrafficRecordProjection): boolean {
  return a.statusCode !== b.statusCode || (a.phase === 'failed') !== (b.phase === 'failed');
}

function groupByKey(rows: readonly TrafficRecordProjection[]): Map<string, TrafficRecordProjection[]> {
  const groups = new Map<string, TrafficRecordProjection[]>();
  for (const row of rows) {
    const key = trafficDiffPairKey(row);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [row]);
    else group.push(row);
  }
  for (const group of groups.values()) group.sort((x, y) => x.startedAtMs - y.startedAtMs);
  return groups;
}

function remainder(key: string, count: number): TrafficDiffRemainder {
  const space = key.indexOf(' ');
  return { method: key.slice(0, space), path: key.slice(space + 1), count };
}

/**
 * Pair the two row sets by method+path (nth occurrence against nth,
 * oldest first) and reduce every pair to its delta. Single pass per
 * side; the report carries differences and honest counts, never rows.
 */
export function computeTrafficDiff(
  rowsA: readonly TrafficRecordProjection[],
  rowsB: readonly TrafficRecordProjection[],
): TrafficDiffReport {
  const groupsA = groupByKey(rowsA);
  const groupsB = groupByKey(rowsB);
  const differingPairs: TrafficDiffPair[] = [];
  const identicalByKey = new Map<string, number>();
  const onlyInA: TrafficDiffRemainder[] = [];
  const onlyInB: TrafficDiffRemainder[] = [];
  let comparedPairs = 0;
  let divergentStatusPairs = 0;
  let identicalRequestHeaderPairs = 0;

  for (const [key, listA] of groupsA) {
    const listB = groupsB.get(key);
    if (listB === undefined) {
      onlyInA.push(remainder(key, listA.length));
      continue;
    }
    const paired = Math.min(listA.length, listB.length);
    for (let i = 0; i < paired; i++) {
      const a = listA[i] as TrafficRecordProjection;
      const b = listB[i] as TrafficRecordProjection;
      comparedPairs++;
      const requestHeaders = diffHeaders(a.requestHeaders, b.requestHeaders);
      const responseHeaders = diffHeaders(a.responseHeaders, b.responseHeaders);
      const diverges = statusDiverges(a, b);
      if (diverges) divergentStatusPairs++;
      if (requestHeaders.identical) identicalRequestHeaderPairs++;
      // A plane BOTH sides never captured is unknowable, not different.
      const differs =
        diverges ||
        (!requestHeaders.identical && requestHeaders.unavailable !== 'both') ||
        (!responseHeaders.identical && responseHeaders.unavailable !== 'both');
      if (differs) {
        differingPairs.push({
          method: a.method,
          path: urlPath(a.url),
          a: pairSide(a),
          b: pairSide(b),
          statusDiverges: diverges,
          requestHeaders,
          responseHeaders,
        });
      } else {
        identicalByKey.set(key, (identicalByKey.get(key) ?? 0) + 1);
      }
    }
    if (listA.length > paired) onlyInA.push(remainder(key, listA.length - paired));
    if (listB.length > paired) onlyInB.push(remainder(key, listB.length - paired));
  }
  for (const [key, listB] of groupsB) {
    if (!groupsA.has(key)) onlyInB.push(remainder(key, listB.length));
  }

  return {
    comparedPairs,
    divergentStatusPairs,
    identicalRequestHeaderPairs,
    differingPairs,
    identicalPairs: [...identicalByKey].map(([key, count]) => remainder(key, count)),
    onlyInA,
    onlyInB,
  };
}
