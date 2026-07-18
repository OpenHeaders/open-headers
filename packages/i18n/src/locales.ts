/**
 * Locale registry + `auto` resolution.
 *
 * Adding a language means adding a `LocaleDef` here and a catalog under
 * `catalogs/<code>/` — nothing else. The settings picker, the antd
 * locale map, and the parity tests all derive from this list.
 */

import type { LocaleDef } from './types';

export const DEFAULT_LOCALE = 'en';

/** Dev/QA aid — accented, expanded English. Never auto-resolved. */
export const PSEUDO_LOCALE = 'pseudo';

export const LOCALES: readonly LocaleDef[] = [
  { code: 'en', englishName: 'English', nativeName: 'English', direction: 'ltr' },
  { code: 'fr', englishName: 'French', nativeName: 'Français', direction: 'ltr' },
  { code: 'es', englishName: 'Spanish', nativeName: 'Español', direction: 'ltr' },
  { code: PSEUDO_LOCALE, englishName: 'Pseudo (UI test)', nativeName: '⟦Þšéûðö⟧', direction: 'ltr', synthetic: true },
];

export const LOCALE_CODES: readonly string[] = LOCALES.map((l) => l.code);

export function getLocaleDef(code: string): LocaleDef | undefined {
  return LOCALES.find((l) => l.code === code);
}

/**
 * Resolve the persisted language setting to a concrete locale code.
 *
 * `auto` walks the caller's preference list (`navigator.languages` on
 * browser surfaces, the OS locale on desktop): exact match first, then
 * base-language match (`en-GB` → `en`), skipping synthetic locales.
 * An explicit setting wins verbatim when it names a known locale;
 * anything unknown falls back to the default.
 */
export function resolveLocale(setting: string, preferences: readonly string[] = []): string {
  if (setting !== 'auto') {
    return getLocaleDef(setting) ? setting : DEFAULT_LOCALE;
  }
  const selectable = LOCALES.filter((l) => !l.synthetic);
  for (const pref of preferences) {
    const exact = selectable.find((l) => l.code.toLowerCase() === pref.toLowerCase());
    if (exact) return exact.code;
    const base = pref.split('-')[0].toLowerCase();
    const baseMatch = selectable.find((l) => l.code.toLowerCase() === base);
    if (baseMatch) return baseMatch.code;
  }
  return DEFAULT_LOCALE;
}
