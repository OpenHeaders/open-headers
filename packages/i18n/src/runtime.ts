/**
 * Translation runtime — a map lookup plus optional interpolation.
 *
 * No ICU parsing, no async, no framework coupling. Catalogs are flat
 * key → message maps; plurals are authored as function messages using
 * the `plural()` helper over `Intl.PluralRules`. All `Intl` formatter
 * instances are cached per (locale, options).
 */

import type { Catalog, MessageArgs } from './types';

// ── Interpolation ────────────────────────────────────────────────────

const PLACEHOLDER = /\{(\w+)\}/g;

/** Replace `{name}` placeholders; unknown names are left verbatim. */
export function formatMessage(template: string, args?: MessageArgs): string {
  if (!args) return template;
  return template.replace(PLACEHOLDER, (token, name: string) => {
    const value = args[name];
    return value === undefined ? token : String(value);
  });
}

// ── Translator ───────────────────────────────────────────────────────

export interface Translator {
  (key: string, args?: MessageArgs): string;
  readonly locale: string;
}

export type MissingKeyHandler = (key: string, locale: string) => void;

let onMissingKey: MissingKeyHandler | undefined;

/**
 * Install a dev-time hook for catalog misses (fallback hit or key
 * absent everywhere). Production leaves this unset — a miss then
 * renders the English message, or the key itself as a last resort,
 * and never throws.
 */
export function setMissingKeyHandler(handler: MissingKeyHandler | undefined): void {
  onMissingKey = handler;
}

/**
 * Build the `t()` function for one locale. `fallback` is the source
 * (English) catalog; for English itself pass the same object twice —
 * the identity check skips the double lookup.
 */
export function createTranslator(locale: string, catalog: Catalog, fallback: Catalog): Translator {
  const t = (key: string, args?: MessageArgs): string => {
    let message = catalog[key];
    if (message === undefined && catalog !== fallback) {
      message = fallback[key];
      if (message !== undefined) onMissingKey?.(key, locale);
    }
    if (message === undefined) {
      onMissingKey?.(key, locale);
      return key;
    }
    if (typeof message === 'function') return message(args ?? {}, locale);
    return formatMessage(message, args);
  };
  return Object.assign(t, { locale }) as Translator;
}

// ── Intl formatter caches ────────────────────────────────────────────

function cacheKey(locale: string, options?: object): string {
  if (!options) return locale;
  const entries = Object.entries(options).sort(([a], [b]) => (a < b ? -1 : 1));
  return `${locale}|${JSON.stringify(entries)}`;
}

const pluralRulesCache = new Map<string, Intl.PluralRules>();
const numberFormatCache = new Map<string, Intl.NumberFormat>();
const dateTimeFormatCache = new Map<string, Intl.DateTimeFormat>();
const relativeTimeFormatCache = new Map<string, Intl.RelativeTimeFormat>();

/** Pseudo has no CLDR data — every `Intl` constructor maps it to English. */
function intlLocale(locale: string): string {
  return locale === 'pseudo' ? 'en' : locale;
}

export function getPluralRules(locale: string, options?: Intl.PluralRulesOptions): Intl.PluralRules {
  const key = cacheKey(locale, options);
  let rules = pluralRulesCache.get(key);
  if (!rules) {
    rules = new Intl.PluralRules(intlLocale(locale), options);
    pluralRulesCache.set(key, rules);
  }
  return rules;
}

export function getNumberFormat(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = cacheKey(locale, options);
  let format = numberFormatCache.get(key);
  if (!format) {
    format = new Intl.NumberFormat(intlLocale(locale), options);
    numberFormatCache.set(key, format);
  }
  return format;
}

export function getDateTimeFormat(locale: string, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = cacheKey(locale, options);
  let format = dateTimeFormatCache.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(intlLocale(locale), options);
    dateTimeFormatCache.set(key, format);
  }
  return format;
}

export function getRelativeTimeFormat(
  locale: string,
  options?: Intl.RelativeTimeFormatOptions,
): Intl.RelativeTimeFormat {
  const key = cacheKey(locale, options);
  let format = relativeTimeFormatCache.get(key);
  if (!format) {
    format = new Intl.RelativeTimeFormat(intlLocale(locale), options);
    relativeTimeFormatCache.set(key, format);
  }
  return format;
}

// ── Plural authoring helper ──────────────────────────────────────────

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/**
 * Pick the CLDR plural form for `count` in `locale` and interpolate
 * `{count}` into it. Function messages compose it:
 *
 *   ({ count }, locale) => plural(locale, Number(count), { one: '{count} rule', other: '{count} rules' })
 */
export function plural(locale: string, count: number, forms: PluralForms): string {
  const rule = getPluralRules(locale).select(count);
  const template = forms[rule] ?? forms.other;
  return formatMessage(template, { count });
}
