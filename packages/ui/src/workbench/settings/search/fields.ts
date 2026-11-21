/**
 * Searchable fields — the text of one setting the search matches
 * against, tokenized. The localization boundary of the search: labels,
 * descriptions and category names are read in BOTH the active locale
 * (what the user sees on screen) and English (the product's lingua
 * franca — docs, tags, keys), so queries keep working after a language
 * switch.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { categoryPathLabel, resolveDescription, resolveLabel, translateEnglish } from '../localize';
import { allCategories } from '../registry';
import type { SettingDef } from '../types';
import { bilingualTokens, tokenize } from './tokens';

export interface SearchableFields {
  label: readonly string[];
  tags: readonly string[];
  /** Category path, subcategory id and subcategory label. */
  category: readonly string[];
  description: readonly string[];
  key: readonly string[];
}

/**
 * Builds the reader for one search pass: category and subcategory names
 * are tokenized once here, then shared by every setting under them.
 */
export function createFieldReader(translate: Translate): (def: SettingDef) => SearchableFields {
  const categoryTokens = new Map<string, string[]>();
  const subcategoryTokens = new Map<string, string[]>();
  for (const category of allCategories()) {
    categoryTokens.set(
      category.id,
      bilingualTokens(categoryPathLabel(category, translate), categoryPathLabel(category, translateEnglish)),
    );
    for (const sub of category.subcategories ?? []) {
      subcategoryTokens.set(
        `${category.id}/${sub.id}`,
        bilingualTokens(resolveLabel(sub, translate), resolveLabel(sub, translateEnglish)),
      );
    }
  }

  return (def) => ({
    label: bilingualTokens(resolveLabel(def, translate), resolveLabel(def, translateEnglish)),
    tags: (def.tags ?? []).flatMap(tokenize),
    category: [
      ...(categoryTokens.get(def.category) ?? []),
      ...tokenize(def.subcategory ?? ''),
      ...(def.subcategory ? (subcategoryTokens.get(`${def.category}/${def.subcategory}`) ?? []) : []),
    ],
    description: bilingualTokens(resolveDescription(def, translate), resolveDescription(def, translateEnglish)),
    key: tokenize(def.key),
  });
}
