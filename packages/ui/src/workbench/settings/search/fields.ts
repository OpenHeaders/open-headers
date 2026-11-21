/**
 * Searchable fields — the text of one setting the search matches
 * against, tokenized. The localization boundary of the search: labels,
 * descriptions and category names are read in BOTH the active locale
 * (what the user sees on screen) and English (the product's lingua
 * franca — docs, tags, keys), so queries keep working after a language
 * switch.
 *
 * A setting's own text is tokenized once per locale and kept: cutting
 * text into words is the costly step of a search pass, and a def's
 * text doesn't change under one translator. The kept tokens hang off
 * the translator and def objects themselves, so a newly loaded catalog
 * or a re-registered def starts fresh and nothing needs invalidating.
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

type OwnFields = Omit<SearchableFields, 'category'>;

const ownFieldsByLocale = new WeakMap<Translate, WeakMap<SettingDef, OwnFields>>();

function ownFields(def: SettingDef, translate: Translate): OwnFields {
  let byDef = ownFieldsByLocale.get(translate);
  if (!byDef) {
    byDef = new WeakMap();
    ownFieldsByLocale.set(translate, byDef);
  }
  let fields = byDef.get(def);
  if (!fields) {
    fields = {
      label: bilingualTokens(resolveLabel(def, translate), resolveLabel(def, translateEnglish)),
      tags: (def.tags ?? []).flatMap(tokenize),
      description: bilingualTokens(resolveDescription(def, translate), resolveDescription(def, translateEnglish)),
      key: tokenize(def.key),
    };
    byDef.set(def, fields);
  }
  return fields;
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
    ...ownFields(def, translate),
    category: [
      ...(categoryTokens.get(def.category) ?? []),
      ...tokenize(def.subcategory ?? ''),
      ...(def.subcategory ? (subcategoryTokens.get(`${def.category}/${def.subcategory}`) ?? []) : []),
    ],
  });
}
