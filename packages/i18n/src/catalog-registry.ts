/**
 * Catalog + translator lookup per locale.
 *
 * English and pseudo resolve synchronously (pseudo derives from English
 * on first use). Real locales are code-split: `loadCatalog` pulls the
 * locale's chunk on demand and `getCatalog` serves English until the
 * chunk arrives. `createTranslator`'s per-key fallback keeps every key
 * renderable during the load tick and while a locale's catalog is still
 * partially translated.
 */

import { en } from './catalogs/en';
import { DEFAULT_LOCALE, PSEUDO_LOCALE } from './locales';
import { pseudoizeCatalog } from './pseudo';
import { createTranslator, type Translator } from './runtime';
import type { Catalog } from './types';

/**
 * One dynamic-import loader per translated locale. Bundlers emit each
 * catalog as its own lazy chunk; the arrows never run at module
 * evaluation, so surfaces that never call `loadCatalog` (the extension
 * service worker renders English) never fetch one.
 */
const loaders: Readonly<Record<string, () => Promise<Catalog>>> = {
  fr: async () => (await import('./catalogs/fr')).fr,
};

let pseudoCatalog: Catalog | undefined;
const loadedCatalogs = new Map<string, Catalog>();
const pendingLoads = new Map<string, Promise<void>>();
const translators = new Map<string, Translator>();

export function getCatalog(locale: string): Catalog {
  if (locale === PSEUDO_LOCALE) {
    pseudoCatalog ??= pseudoizeCatalog(en);
    return pseudoCatalog;
  }
  // Until a locale's chunk is loaded — or when no catalog exists for
  // it — English renders.
  return loadedCatalogs.get(locale) ?? en;
}

/** Whether `getCatalog(locale)` already serves its final catalog. */
export function isCatalogLoaded(locale: string): boolean {
  return loaders[locale] === undefined || loadedCatalogs.has(locale);
}

/**
 * Pull `locale`'s catalog chunk. Resolves immediately for locales
 * without a loader (English, pseudo, unknown); concurrent calls share
 * one in-flight import. On failure the promise rejects, the English
 * fallback stays in place, and a later call retries.
 */
export function loadCatalog(locale: string): Promise<void> {
  const loader = loaders[locale];
  if (loader === undefined || loadedCatalogs.has(locale)) return Promise.resolve();
  let pending = pendingLoads.get(locale);
  if (pending === undefined) {
    pending = loader().then((catalog) => {
      loadedCatalogs.set(locale, catalog);
      translators.delete(locale);
      pendingLoads.delete(locale);
    });
    pending.catch(() => pendingLoads.delete(locale));
    pendingLoads.set(locale, pending);
  }
  return pending;
}

export function getTranslator(locale: string): Translator {
  let translator = translators.get(locale);
  if (!translator) {
    const catalog = getCatalog(locale);
    translator = createTranslator(locale, catalog, getCatalog(DEFAULT_LOCALE));
    translators.set(locale, translator);
  }
  return translator;
}
