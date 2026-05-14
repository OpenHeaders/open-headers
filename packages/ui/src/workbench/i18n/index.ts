/**
 * i18n — reactive translation layer for the extension.
 *
 * Design goals:
 *
 *   1. Single source of truth. Dictionaries are plain object literals
 *      keyed by locale; the resolver returns the first hit in
 *      [requested, fallback] order. No runtime loading — every
 *      dictionary lives in the bundle so translations never race the
 *      first paint.
 *
 *   2. Reactive. `useT()` subscribes to the `general.language` setting
 *      via the settings store so switching locales triggers re-renders
 *      of every consuming component with no glue code.
 *
 *   3. Type-safe keys. `TranslationKey` is the union of every key in
 *      the English dictionary — passing an unknown key is a compile
 *      error. New keys must be added to `en` first.
 *
 *   4. Variable interpolation. `{var}` placeholders in a template are
 *      replaced by values from the optional `vars` arg.
 *
 * Adding a locale:
 *   1. Create a new dictionary file next to `en.ts`
 *   2. Export it as `Partial<Dictionary>` — missing keys fall back to
 *      English automatically.
 *   3. Import it in `dictionaries` below and add the locale to
 *      `SUPPORTED_LOCALES`.
 */

import { useSyncExternalStore } from 'react';
import { get as getSetting, subscribeKey } from '../settings/store';
import { en } from './locales/en';

export type Dictionary = typeof en;
export type TranslationKey = keyof Dictionary;

// ── Locale registry ──────────────────────────────────────────────────

export const SUPPORTED_LOCALES = ['en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const FALLBACK_LOCALE: Locale = 'en';

const dictionaries: Record<Locale, Partial<Dictionary>> = {
  en,
};

// ── Resolution ───────────────────────────────────────────────────────

/**
 * Resolve the active locale from the `general.language` setting. When
 * the user has chosen "auto" we walk `navigator.languages`, normalize
 * each entry to its base tag, and return the first one we ship a
 * dictionary for. Nothing matched → fallback.
 */
export function resolveLocale(): Locale {
  let raw: string;
  try {
    raw = getSetting('general.language');
  } catch {
    raw = 'auto';
  }
  if (raw !== 'auto' && (SUPPORTED_LOCALES as readonly string[]).includes(raw)) {
    return raw as Locale;
  }
  const navigatorLocales = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [];
  for (const candidate of navigatorLocales) {
    if (!candidate) continue;
    const base = candidate.toLowerCase().split('-')[0];
    if ((SUPPORTED_LOCALES as readonly string[]).includes(base)) {
      return base as Locale;
    }
  }
  return FALLBACK_LOCALE;
}

// ── Translation ──────────────────────────────────────────────────────

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    const value = vars[name];
    return value === undefined ? `{${name}}` : String(value);
  });
}

/**
 * Look up a key in the active locale, falling back to English when the
 * key is missing. `t` is synchronous and pure given a locale — perfect
 * for render-time use in useMemo bodies and JSX inline.
 */
export function t(locale: Locale, key: TranslationKey, vars?: Record<string, string | number>): string {
  const dict = dictionaries[locale];
  const fallback = dictionaries[FALLBACK_LOCALE];
  const template = dict[key] ?? fallback[key] ?? key;
  return interpolate(template, vars);
}

// ── React hook ───────────────────────────────────────────────────────

function subscribeLocale(fn: () => void): () => void {
  return subscribeKey('general.language', fn);
}

/**
 * React hook — returns a stable `t(key, vars?)` function that tracks
 * `general.language`. Components re-render automatically when the
 * setting changes.
 */
export function useT(): (key: TranslationKey, vars?: Record<string, string | number>) => string {
  const locale = useSyncExternalStore(subscribeLocale, resolveLocale, resolveLocale);
  return (key, vars) => t(locale, key, vars);
}

/** Read-only variant — the active locale, reactive. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, resolveLocale, resolveLocale);
}
