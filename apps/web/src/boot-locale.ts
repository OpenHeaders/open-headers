/**
 * Locale for the web tab's pre-provider beats — the SSO-landing
 * transition overlay and the insecure-context notice render before
 * `SettingsProvider` mounts, so the persisted language picker is not
 * readable yet. Resolve `auto` against the browser's own preference
 * list instead; the settings locale takes over the moment the React
 * providers mount (`LocaleProvider` re-resolves from the store).
 */

import { getTranslator, resolveLocale, type Translator } from '@openheaders/i18n';

export function bootTranslator(): Translator {
  const preferences = typeof navigator !== 'undefined' ? navigator.languages : [];
  return getTranslator(resolveLocale('auto', preferences));
}
