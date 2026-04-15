/**
 * Settings search — ranks registered defs against a user query.
 *
 * The index rebuilds on every call because registration is cheap and
 * the def count is small (hundreds, not thousands). Scoring is a
 * simple token-overlap heuristic weighted by field:
 *
 *   label         3
 *   tags          2
 *   category/sub  2
 *   description   1
 *   key           1
 *
 * Filter tokens `@modified` / `@experimental` / `@deprecated` filter
 * the result set before scoring. Empty query returns all defs sorted
 * by category order + label.
 */

import { allCategories, allDefs } from './registry';
import { isModified } from './store';
import type { SettingDef } from './types';

const FILTER_MODIFIED = '@modified';
const FILTER_EXPERIMENTAL = '@experimental';
const FILTER_DEPRECATED = '@deprecated';

function normalize(input: string): string {
  return input.toLowerCase();
}

function tokens(input: string): string[] {
  return normalize(input)
    .split(/[\s,.\-_/]+/)
    .filter((t) => t.length > 0);
}

function scoreDef(def: SettingDef, queryTokens: string[], categoryLabel: string): number {
  if (queryTokens.length === 0) return 0;
  const labelTokens = tokens(def.label);
  const tagTokens = (def.tags ?? []).flatMap(tokens);
  const descTokens = tokens(def.description);
  const keyTokens = tokens(def.key);
  const catTokens = [...tokens(categoryLabel), ...tokens(def.subcategory ?? '')];

  let score = 0;
  for (const qt of queryTokens) {
    for (const lt of labelTokens) if (lt === qt || lt.startsWith(qt)) score += 3;
    for (const tt of tagTokens) if (tt === qt || tt.startsWith(qt)) score += 2;
    for (const ct of catTokens) if (ct === qt || ct.startsWith(qt)) score += 2;
    for (const dt of descTokens) if (dt.includes(qt)) score += 1;
    for (const kt of keyTokens) if (kt.includes(qt)) score += 1;
  }
  return score;
}

export interface SettingsSearchResult {
  def: SettingDef;
  score: number;
}

export function searchSettings(query: string): SettingsSearchResult[] {
  const trimmed = query.trim();
  const filters = {
    modified: false,
    experimental: false,
    deprecated: false,
  };

  const queryWithoutFilters = trimmed
    .split(/\s+/)
    .filter((token) => {
      const lower = token.toLowerCase();
      if (lower === FILTER_MODIFIED) {
        filters.modified = true;
        return false;
      }
      if (lower === FILTER_EXPERIMENTAL) {
        filters.experimental = true;
        return false;
      }
      if (lower === FILTER_DEPRECATED) {
        filters.deprecated = true;
        return false;
      }
      return true;
    })
    .join(' ');

  const qTokens = tokens(queryWithoutFilters);
  const catMap = new Map(allCategories().map((c) => [c.id, c.label] as const));

  const filtered = allDefs().filter((def) => {
    if (filters.modified && !isModified(def.key)) return false;
    if (filters.experimental && !def.experimental) return false;
    if (filters.deprecated && !def.deprecated) return false;
    return true;
  });

  // No textual query: return all filtered defs with score 0 so the
  // shell can still render them in category order.
  if (qTokens.length === 0) {
    return filtered.map((def) => ({ def, score: 0 }));
  }

  const scored: SettingsSearchResult[] = [];
  for (const def of filtered) {
    const catLabel = catMap.get(def.category) ?? '';
    const score = scoreDef(def, qTokens, catLabel);
    if (score > 0) scored.push({ def, score });
  }
  scored.sort((a, b) => b.score - a.score || a.def.label.localeCompare(b.def.label));
  return scored;
}
