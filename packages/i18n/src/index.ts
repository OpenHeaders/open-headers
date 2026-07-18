/**
 * @openheaders/i18n — locale registry, message catalogs, translation
 * runtime, pseudo-locale. Platform-free and framework-free: the React
 * provider lives in @openheaders/ui, the Electron main-process consumer
 * in the desktop app. See docs/I18N_PLAN.md.
 */

export { getCatalog, getTranslator, isCatalogLoaded, loadCatalog } from './catalog-registry';
export { en, type MessageKey } from './catalogs/en';
export { GLOSSARY, isGlossaryTerm } from './glossary';
export { DEFAULT_LOCALE, getLocaleDef, LOCALE_CODES, LOCALES, PSEUDO_LOCALE, resolveLocale } from './locales';
export { pseudoizeCatalog, pseudoizeString } from './pseudo';
export {
  createTranslator,
  formatMessage,
  getDateTimeFormat,
  getNumberFormat,
  getPluralRules,
  getRelativeTimeFormat,
  type MissingKeyHandler,
  type PluralForms,
  plural,
  setMissingKeyHandler,
  type Translator,
} from './runtime';
export type { Catalog, LocaleDef, LocaleDirection, Message, MessageArgs, MessageArgValue, MessageFn } from './types';
