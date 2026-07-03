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
    affectedRowCount,
    driftedRowCount,
    addedCount: added,
    modifiedCount: modified,
    removedCount: removed,
    ruleNames: Array.from(ruleNames.values()),
  };
}

/** Short text summary for the footprint chip — empty string when no
 *  rules touched the request, so the view can hide the chip outright. */
export function formatHeaderFootprint(f: HeaderFootprint): string {
  if (f.ruleCount === 0) return '';
  const bits: string[] = [];
  bits.push(`${f.ruleCount} rule${f.ruleCount === 1 ? '' : 's'}`);
  bits.push(`${f.affectedRowCount} header${f.affectedRowCount === 1 ? '' : 's'}`);
  const breakdown: string[] = [];
  if (f.addedCount > 0) breakdown.push(`${f.addedCount} added`);
  if (f.modifiedCount > 0) breakdown.push(`${f.modifiedCount} modified`);
  if (f.removedCount > 0) breakdown.push(`${f.removedCount} removed`);
  if (breakdown.length > 0) bits.push(breakdown.join(' · '));
  if (f.driftedRowCount > 0) bits.push(`${f.driftedRowCount} drifted`);
  return bits.join(' · ');
}
