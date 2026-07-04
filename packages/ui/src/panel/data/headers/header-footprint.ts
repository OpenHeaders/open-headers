/**
 * Single-line summary of what rules did to this request's headers —
 * shown at the top of the Headers tab as a quick orientation chip
 * before the user starts scanning rows.
 *
 * Consumed alongside the inline per-row attribution badges, not as a
 * replacement: the badges say *which row was touched and how*, the
 * footprint says *how big the overall rule footprint is and where it
 * might have drifted*.
 */

import type { AnnotatedHeader } from './header-attribution';

export interface HeaderFootprint {
  /** Number of distinct rules that touched at least one header on
   *  this request (request side + response side, deduped by ruleUid). */
  ruleCount: number;
  /** The deduped rule uids behind `ruleCount` — lets the all-rule
   *  footprint (`rule-footprint.ts`) union header-attributed rules with
   *  the row's fire list without double-counting. */
  ruleUids: ReadonlySet<string>;
  /** Number of header rows attributed to a rule (added/modified/removed). */
  affectedRowCount: number;
  driftedRowCount: number;
  addedCount: number;
  modifiedCount: number;
  removedCount: number;
  ruleNames: readonly string[];
}

interface FootprintInputs {
  requestRows: readonly AnnotatedHeader[];
  responseRows: readonly AnnotatedHeader[];
  /** Set of row identities (use object reference or `direction|name|kind`)
   *  the consumer has computed as drifted. Pure helper has no access to
   *  the live rule registry, so the caller passes drift in. */
  driftedRows: ReadonlySet<AnnotatedHeader>;
}

export function computeHeaderFootprint(inputs: FootprintInputs): HeaderFootprint {
  const ruleUids = new Set<string>();
  const ruleNames = new Map<string, string>();
  let affectedRowCount = 0;
  let driftedRowCount = 0;
  let added = 0;
  let modified = 0;
  let removed = 0;

  const consider = (rows: readonly AnnotatedHeader[]): void => {
    for (const row of rows) {
      const a = row.attribution;
      if (a.kind === 'server' || a.kind === 'system') continue;
      affectedRowCount++;
      if (inputs.driftedRows.has(row)) driftedRowCount++;
      ruleUids.add(a.ctx.ruleUid);
      if (!ruleNames.has(a.ctx.ruleUid)) ruleNames.set(a.ctx.ruleUid, a.ctx.ruleName);
      if (a.kind === 'added') added++;
      else if (a.kind === 'modified') modified++;
      else if (a.kind === 'removed') removed++;
    }
  };
  consider(inputs.requestRows);
  consider(inputs.responseRows);

  return {
    ruleCount: ruleUids.size,
    ruleUids,
    affectedRowCount,
    driftedRowCount,
    addedCount: added,
    modifiedCount: modified,
    removedCount: removed,
    ruleNames: Array.from(ruleNames.values()),
  };
}

/** The header segment of the chip text (`N headers: X added · Y
 *  modified`), without the leading rule count — shared between the
 *  header-only formatter below and the all-rule formatter in
 *  `rule-footprint.ts`. Chip segments join with `|`; the kind
 *  breakdown stays INSIDE this segment behind a colon so the header
 *  detail reads as one group.
 *
 *  When a single kind covers every affected row (and nothing drifted),
 *  the count and the breakdown merge into one phrase (`1 header
 *  modified`, `2 headers added`) — `1 header: 1 modified` says the
 *  same thing twice. */
export function headerFootprintSegment(f: HeaderFootprint): string {
  const headerNoun = `${f.affectedRowCount} header${f.affectedRowCount === 1 ? '' : 's'}`;
  const kinds: Array<[string, number]> = [];
  if (f.addedCount > 0) kinds.push(['added', f.addedCount]);
  if (f.modifiedCount > 0) kinds.push(['modified', f.modifiedCount]);
  if (f.removedCount > 0) kinds.push(['removed', f.removedCount]);

  if (f.driftedRowCount === 0 && kinds.length === 1 && kinds[0][1] === f.affectedRowCount) {
    return `${headerNoun} ${kinds[0][0]}`;
  }
  const parts = kinds.map(([kind, count]) => `${count} ${kind}`);
  if (f.driftedRowCount > 0) parts.push(`${f.driftedRowCount} drifted`);
  return parts.length > 0 ? `${headerNoun}: ${parts.join(' · ')}` : headerNoun;
}

/** Short text summary for the footprint chip — empty string when no
 *  rules touched the request, so the view can hide the chip outright. */
export function formatHeaderFootprint(f: HeaderFootprint): string {
  if (f.ruleCount === 0) return '';
  return [`${f.ruleCount} rule${f.ruleCount === 1 ? '' : 's'}`, headerFootprintSegment(f)].join(' | ');
}
