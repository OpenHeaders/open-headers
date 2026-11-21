/**
 * Settings search — ranks registered defs against a user query.
 *
 * One pass per call, split by concern:
 *
 *   query.ts   raw input → filter tokens + text terms
 *   fields.ts  one setting → its searchable text, tokenized
 *   score.ts   fields × terms → rank (every term must match)
 *   group.ts   matched settings → display groups
 *
 * The fields are read on every call rather than indexed: the def count
 * is small (hundreds, not thousands) and a pass costs a few
 * milliseconds — the cost of a search is rendering its results, which
 * the results pane bounds.
 *
 * Filter tokens `@modified` / `@deprecated` narrow the set before
 * scoring. A query with no text terms returns every (filtered) def
 * with score 0, in registration order.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { resolveLabel, translateEnglish } from '../localize';
import { allDefs } from '../registry';
import { isModified } from '../store';
import type { SettingDef } from '../types';
import { createFieldReader } from './fields';
import { parseSearchQuery } from './query';
import { scoreFields } from './score';

export { type CategoryGroup, groupByCategory, takeRows } from './group';

export interface SettingsSearchResult {
  def: SettingDef;
  score: number;
}

export function searchSettings(query: string, translate: Translate = translateEnglish): SettingsSearchResult[] {
  const { terms, modifiedOnly, deprecatedOnly } = parseSearchQuery(query);

  const candidates = allDefs().filter((def) => {
    if (modifiedOnly && !isModified(def.key)) return false;
    if (deprecatedOnly && !def.deprecated) return false;
    return true;
  });

  if (terms.length === 0) return candidates.map((def) => ({ def, score: 0 }));

  const readFields = createFieldReader(translate);
  const ranked: (SettingsSearchResult & { label: string })[] = [];
  for (const def of candidates) {
    const score = scoreFields(readFields(def), terms);
    if (score > 0) ranked.push({ def, score, label: resolveLabel(def, translate) });
  }
  ranked.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  return ranked.map(({ def, score }) => ({ def, score }));
}
