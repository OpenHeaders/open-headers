import type { RequestRecord, TabTelemetrySnapshot as TelemetrySnapshot } from '@openheaders/core/types';
import { type PauseMarkers, resolvePauseState } from '@openheaders/core/utils';
import { compareBySortMode } from '@openheaders/ui/shared/table-shared';
import { type RuleVerdict, VERDICT_RANK } from '@openheaders/ui/shared/verdict';
import type { ActiveRule, SortMode, TableRecord } from './types';

export interface BuildThisPageRowsOptions {
  snapshot: TelemetrySnapshot;
  activeRules: ActiveRule[];
  visibleTypeSet: Set<string>;
  pauseMarkers: PauseMarkers;
  sortMode: SortMode;
  searchText: string;
}

export interface VerdictCounts {
  firing: number;
  silent: number;
  page: number;
  related: number;
}

export interface ThisPageRows {
  recordsByRuleId: Map<string, RequestRecord[]>;
  recordsFor: (id: string | undefined) => RequestRecord[];
  uniqueRequestCount: number;
  urlMatchCountMap: Map<string, number>;
  sortedFilteredRules: ActiveRule[];
  dataSource: TableRecord[];
  activeCount: number;
  verdictCounts: VerdictCounts;
}

// Highest evidence tier present in a record list, or 'none' when empty.
function dominantEvidenceOf(records: RequestRecord[]): RequestRecord['evidence'] | 'none' {
  let best: RequestRecord['evidence'] | 'none' = 'none';
  const rank: Record<RequestRecord['evidence'] | 'none', number> = {
    confirmed: 3,
    matched: 2,
    'matched-fallback': 1,
    silent: 0,
    none: 0,
  };
  for (const r of records) {
    if (rank[r.evidence] > rank[best]) best = r.evidence;
  }
  return best;
}

/**
 * Builds the This Page rows model: the merged per-rule telemetry, the
 * search-filtered/sorted rule list, the table dataSource, and the header
 * summary counts. Recomputed every render (as the inline block was) so the
 * view tracks live telemetry and filter state — no memoization is required
 * because callers pass the results straight into render output.
 */
export function buildThisPageRows({
  snapshot,
  activeRules,
  visibleTypeSet,
  pauseMarkers,
  sortMode,
  searchText,
}: BuildThisPageRowsOptions): ThisPageRows {
  // Look up per-rule telemetry from the snapshot. Records are stored LRU
  // (oldest first) by the backend; we reverse per-rule here so the popup
  // and the nested table both render newest-first without repeating the
  // reversal at every render site.
  //
  // Render-time filter: drop records whose resource type isn't in the
  // `visibleResourceTypes` allowlist. The background records everything
  // so flipping a type back on reveals the hidden fires instantly, with
  // no page reload. Fires that arrive while a type is hidden are still
  // collected — they become visible the moment the type is re-enabled.
  //
  // Silent records (subresources that matched but were cache-served, so
  // no action ran) live on `ActiveRule.silentRecords` — NOT in the
  // telemetry snapshot. Merge them here with `evidence: 'silent'` so
  // the per-rule sub-table surfaces "the rule would have fired on
  // these resources" alongside the rule's real fires, and
  // `fireCountFor` includes them in the header "X requests" total.
  const recordsByRuleId = new Map<string, RequestRecord[]>();
  for (const [uid, recs] of Object.entries(snapshot.byRule)) {
    const filtered = recs.filter((r) => visibleTypeSet.has(r.resourceType || 'other'));
    recordsByRuleId.set(uid, filtered.reverse());
  }
  for (const rule of activeRules) {
    const silents = rule.silentRecords;
    if (!silents || silents.length === 0) continue;
    const silentRecords: RequestRecord[] = silents
      .filter((s) => visibleTypeSet.has(s.resourceType || 'other'))
      .map((s) => ({
        ruleUid: rule.id,
        url: s.url,
        pattern: s.pattern,
        resourceType: s.resourceType,
        t: s.t,
        evidence: 'silent' as const,
      }));
    if (silentRecords.length === 0) continue;
    const existing = recordsByRuleId.get(rule.id) ?? [];
    // Merge newest-first. Telemetry records arrive already reversed
    // (newest-first) from the reduction above; silent records go
    // last so real fires render on top.
    recordsByRuleId.set(rule.id, [...existing, ...silentRecords.reverse()]);
  }
  const recordsFor = (id: string | undefined): RequestRecord[] => (id ? (recordsByRuleId.get(id) ?? []) : []);
  const fireCountFor = (id: string | undefined): number => (id ? (recordsByRuleId.get(id)?.length ?? 0) : 0);

  // Page-wide unique-URL count — the "N requests" figure in the header.
  // Computed from the merged fire+silent records so cached-subresource
  // matches are reflected (telemetry's own uniqueRequestCount only
  // covers webRequest fires, which is why cache-heavy pages used to
  // show "0 requests" despite having silent matches).
  const uniqueRequestCount = (() => {
    const unique = new Set<string>();
    for (const recs of recordsByRuleId.values()) {
      for (const r of recs) unique.add(r.url);
    }
    return unique.size;
  })();

  // Track how each rule matches the search: by rule properties, by URL, or both
  const urlMatchCountMap = new Map<string, number>();
  const filteredRules = searchText
    ? activeRules.filter((r) => {
        const q = searchText.toLowerCase();
        const matchesByRule = r.name.toLowerCase().includes(q) || (r.summary || '').toLowerCase().includes(q);
        const records = recordsFor(r.id);
        const matchingUrlCount = records.filter((m) => m.url.toLowerCase().includes(q)).length;
        if (matchingUrlCount > 0 && r.id) urlMatchCountMap.set(r.id, matchingUrlCount);
        return matchesByRule || matchingUrlCount > 0;
      })
    : activeRules;

  // Sort: rules with URL matches first (most relevant), then by name
  const sortedFilteredRules = searchText
    ? [...filteredRules].sort((a, b) => {
        const aUrlMatches = urlMatchCountMap.get(a.id || '') || 0;
        const bUrlMatches = urlMatchCountMap.get(b.id || '') || 0;
        if (aUrlMatches > 0 && bUrlMatches === 0) return -1;
        if (aUrlMatches === 0 && bUrlMatches > 0) return 1;
        return 0;
      })
    : filteredRules;

  const dataSource: TableRecord[] = sortedFilteredRules
    .map((rule, index) => {
      const isEnabled = rule.isEnabled !== false;
      const groupPaused = resolvePauseState(rule.path ?? '', pauseMarkers);
      const statusRank = isEnabled && !groupPaused ? 0 : isEnabled && groupPaused ? 1 : 2;
      const records = recordsFor(rule.id);
      let dominantShadow: { uid: string; name: string } | undefined;
      let shadowedCount = 0;
      for (const r of records) {
        if (r.shadowedBy) {
          shadowedCount += 1;
          if (!dominantShadow) dominantShadow = r.shadowedBy;
        }
      }
      // If we have a telemetry counter for this rule, the ground-truth
      // verdict is `firing` — override whatever the background reported.
      // This bridges the tiny window between a webRequest fire landing
      // in telemetry and the popup's next getActiveRulesForTab call;
      // without it the row would briefly flicker as `page` while the
      // fire was already counted. `recordsByRuleId` includes merged
      // silent records, so we check the raw telemetry `byRule` map
      // instead — only real fires (not silent observations) should
      // promote the verdict to `firing`.
      const telemetryFireCount = snapshot.byRule[rule.id]?.length ?? 0;
      const effectiveVerdict: RuleVerdict = telemetryFireCount > 0 ? 'firing' : (rule.verdict ?? 'page');
      return {
        ...rule,
        verdict: effectiveVerdict,
        key: (rule.id || index) as string | number,
        statusRank,
        verdictRank: VERDICT_RANK[effectiveVerdict],
        fireCount: fireCountFor(rule.id),
        records,
        dominantEvidence: dominantEvidenceOf(records),
        dominantShadow,
        shadowedCount,
      };
    })
    .sort((a, b) => compareBySortMode(a, b, sortMode));

  const activeCount = activeRules.filter(
    (r) => r.isEnabled !== false && !resolvePauseState(r.path ?? '', pauseMarkers),
  ).length;

  // Per-verdict counts for the header summary. `firing` is the ground
  // truth count (telemetry has a counter). `silent` and `page` come
  // from the background; `related` collapses into the "also on this
  // domain" hint.
  const verdictCounts = dataSource.reduce(
    (acc, rec) => {
      if (rec.isEnabled === false || resolvePauseState(rec.path ?? '', pauseMarkers)) return acc;
      const state = rec.verdict ?? 'page';
      if (state === 'firing') acc.firing++;
      else if (state === 'silent') acc.silent++;
      else if (state === 'page') acc.page++;
      else if (state === 'related') acc.related++;
      return acc;
    },
    { firing: 0, silent: 0, page: 0, related: 0 },
  );

  return {
    recordsByRuleId,
    recordsFor,
    uniqueRequestCount,
    urlMatchCountMap,
    sortedFilteredRules,
    dataSource,
    activeCount,
    verdictCounts,
  };
}
