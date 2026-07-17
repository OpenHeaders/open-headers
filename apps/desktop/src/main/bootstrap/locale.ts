/**
 * Main-process locale — the translator behind every native surface
 * (tray menu, application menu, update items, dialogs).
 *
 * Follows the settings picker, not the OS locale: `general.language`
 * lives inside the `oh.settings.user` blob the renderer writes through
 * the file-backed host storage, so main reads and subscribes to exactly
 * the key product-telemetry already rides. Menus install before the
 * storage backend exists (the window paints while the engine boots), so
 * the first paint uses the OS-resolved default and the subscription
 * re-runs every registered listener when the persisted setting lands or
 * changes — the same rebuild flow update-menu transitions use.
 */

import type { HostStorage } from '@openheaders/core/storage';
import { OH } from '@openheaders/core/storage';
import { DEFAULT_LOCALE, getTranslator, resolveLocale, type Translator } from '@openheaders/i18n';
import { app } from 'electron';

let translator: Translator = getTranslator(DEFAULT_LOCALE);

const localeChangeListeners = new Set<() => void>();

/** The current translator for native surfaces — read once per menu/dialog build, never per label. */
export function mainTranslator(): Translator {
  return translator;
}

/** Consumers register their rebuild; the module never imports them back. */
export function onLocaleChange(listener: () => void): void {
  localeChangeListeners.add(listener);
}

function readLanguageSetting(values: Record<string, unknown> | undefined): string {
  const setting = values?.['general.language'];
  return typeof setting === 'string' ? setting : 'auto';
}

function applyLanguageSetting(setting: string): void {
  const locale = resolveLocale(setting, [app.getLocale()]);
  if (locale === translator.locale) return;
  translator = getTranslator(locale);
  for (const listener of localeChangeListeners) listener();
}

/**
 * Resolve the pre-storage default from the OS locale. Runs inside
 * `whenReady` (Electron's `getLocale()` is empty before ready), before
 * the first menu build.
 */
export function initMainLocale(): void {
  translator = getTranslator(resolveLocale('auto', [app.getLocale()]));
}

/**
 * Bind the persisted setting once the host storage exists (called from
 * `installRpcHost`): apply the stored value, then follow changes live.
 */
export function installLocaleSubscription(storage: Pick<HostStorage, 'get' | 'subscribe'>): void {
  void storage.get(OH.settingsUser).then((values) => {
    applyLanguageSetting(readLanguageSetting(values));
  });
  storage.subscribe(OH.settingsUser, (next) => {
    applyLanguageSetting(readLanguageSetting(next));
  });
}
