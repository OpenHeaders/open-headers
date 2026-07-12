/**
 * Catalog + translator lookup per locale.
 *
 * English and pseudo are the only locales today; both resolve
 * synchronously (pseudo derives from English on first use). When real
 * locales land (Phase I) this registry grows the per-locale lazy-chunk
 * loading — the call sites won't change.
 */

import { en } from './catalogs/en';
import { DEFAULT_LOCALE, PSEUDO_LOCALE } from './locales';
import { pseudoizeCatalog } from './pseudo';
import { createTranslator, type Translator } from './runtime';
import type { Catalog } from './types';

let pseudoCatalog: Catalog | undefined;

export function getCatalog(locale: string): Catalog {
  if (locale === PSEUDO_LOCALE) {
    pseudoCatalog ??= pseudoizeCatalog(en);
    return pseudoCatalog;
  }
  // Every non-pseudo locale renders English until translated catalogs exist.
  return en;
}

const translators = new Map<string, Translator>();

export function getTranslator(locale: string): Translator {
  let translator = translators.get(locale);
  if (!translator) {
    const catalog = getCatalog(locale);
    translator = createTranslator(locale, catalog, getCatalog(DEFAULT_LOCALE));
    translators.set(locale, translator);
  }
  return translator;
}
