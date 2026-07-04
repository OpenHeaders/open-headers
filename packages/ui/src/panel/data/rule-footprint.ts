/**
 * All-rule footprint for the Headers tab's summary chip — extends the
 * header-only footprint with every rule that fired on the request
 * (redirect, block, delay, response, …), the same population the
 * Matched Rules panel lists. Header rows announce themselves inline
 * via attribution badges, but a redirect or delay leaves no header
 * trace — without this the chip under-reports and the only sign of the
 * rule is the row's fire dot. The chip doubles as the discoverable
 * entry point to the Matched Rules tool window.
 */

import type { Rule } from '@openheaders/core/types';
import { type HeaderFootprint, headerFootprintSegment } from './headers/header-footprint';
import type { RulesByUid } from './rule-create/use-rules-lookup';
import type { InspectorFire } from './types';

export interface RuleFootprint {
  /** Distinct rules on this request — fires ∪ header-attributed. */
  ruleCount: number;
  /** Fired non-header rule types with per-type counts, in fire order.
   *  Header rules are covered by the header bits instead. */
  typeCounts: ReadonlyArray<readonly [string, number]>;
  header: HeaderFootprint;
  ruleNames: readonly string[];
  /** Live rules that would fire on the next identical request but are
   *  not in the fire snapshot (see `future-matches.ts`). */
  futureCount: number;
}

/** Chip wording per rule type — lowercase because the labels sit
 *  mid-sentence ("2 rules | 1 redirect | …"). */
const TYPE_LABEL: Record<Rule['type'], string> = {
  header: 'header',
  redirect: 'redirect',
  block: 'block',
  delay: 'delay',
  response: 'response',
  'request-body': 'request body',
  'query-param': 'query params',
  inject: 'inject',
  ws: 'websocket',
  sse: 'sse',
  auth: 'auth',
};

interface RuleFootprintInputs {
  fires: readonly InspectorFire[];
  /** Live rule registry — preferred over the fire's frozen snapshot for
   *  type/name so a renamed rule reads current. */
  rulesByUid: RulesByUid;
  header: HeaderFootprint;
  /** Would-match-next-time projection count; defaults to 0 for callers
   *  that don't compute it. */
  futureCount?: number;
}

export function computeRuleFootprint({ fires, rulesByUid, header, futureCount = 0 }: RuleFootprintInputs): RuleFootprint {
  const seen = new Set<string>();
  const names: string[] = [];
  const typeCounts = new Map<string, number>();

  for (const fire of fires) {
    if (seen.has(fire.ruleUid)) continue;
    seen.add(fire.ruleUid);
    const live = rulesByUid.get(fire.ruleUid);
    const type = live?.type ?? fire.ruleSnapshot?.type;
    names.push(live?.name ?? fire.ruleSnapshot?.name ?? fire.ruleUid);
    if (type && type !== 'header') {
      const label = TYPE_LABEL[type];
      typeCounts.set(label, (typeCounts.get(label) ?? 0) + 1);
    }
  }

  // Header-attributed rules the fire list somehow missed (defensive —
  // attribution normally derives from the same fires) still count.
  let ruleCount = seen.size;
  for (const uid of header.ruleUids) {
    if (!seen.has(uid)) ruleCount++;
  }
  for (const name of header.ruleNames) {
    if (!names.includes(name)) names.push(name);
  }

  return { ruleCount, typeCounts: Array.from(typeCounts.entries()), header, ruleNames: names, futureCount };
}

/** Chip text — empty string when no rule touched (or would touch) the
 *  request, so the view hides the chip outright. Segments (total, each
 *  fired type, the header group, the future projection) join with `|`;
 *  the header kind breakdown stays inside its segment (`3 headers:
 *  1 added · 2 modified`). The future segment leads with `+` — it is a
 *  projection, not a counted fire. */
export function formatRuleFootprint(f: RuleFootprint): string {
  const segments: string[] = [];
  if (f.ruleCount > 0) {
    segments.push(`${f.ruleCount} rule${f.ruleCount === 1 ? '' : 's'}`);
    for (const [label, count] of f.typeCounts) {
      segments.push(`${count} ${label}`);
    }
    if (f.header.affectedRowCount > 0) segments.push(headerFootprintSegment(f.header));
  }
  if (f.futureCount > 0) segments.push(`+${f.futureCount} future`);
  return segments.join(' | ');
}
