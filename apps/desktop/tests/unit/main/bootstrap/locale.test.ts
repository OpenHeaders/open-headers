import type { HostStorage, StorageKey } from '@openheaders/core/storage';
import { OH } from '@openheaders/core/storage';
import { DEFAULT_LOCALE, getTranslator, PSEUDO_LOCALE } from '@openheaders/i18n';
import { describe, expect, it, vi } from 'vitest';
import { initMainLocale, installLocaleSubscription, mainTranslator, onLocaleChange } from '@/main/bootstrap/locale';

function makeStorage(settings: Record<string, unknown> | undefined) {
  const listeners: Array<(next: Record<string, unknown> | undefined) => void> = [];
  const storage: Pick<HostStorage, 'get' | 'subscribe'> = {
    get: async <T>(spec: StorageKey<T>) => (spec.key === OH.settingsUser.key ? settings : undefined) as T | undefined,
    subscribe: <T>(spec: StorageKey<T>, fn: (next: T | undefined) => void) => {
      listeners.push(fn as (next: Record<string, unknown> | undefined) => void);
      return () => undefined;
    },
  };
  const write = (next: Record<string, unknown> | undefined): void => {
    for (const fn of listeners) fn(next);
  };
  return { storage, write };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('main-process locale', () => {
  it('starts on the default locale and stays there when the OS locale resolves to English', () => {
    expect(mainTranslator().locale).toBe(DEFAULT_LOCALE);
    initMainLocale();
    // The electron mock reports 'en-US' — base-language match keeps 'en'.
    expect(mainTranslator().locale).toBe(DEFAULT_LOCALE);
  });

  it('applies the persisted setting once the storage read lands and notifies listeners', async () => {
    const notified = vi.fn();
    onLocaleChange(notified);
    const { storage } = makeStorage({ 'general.language': PSEUDO_LOCALE });
    installLocaleSubscription(storage);
    await settle();
    expect(mainTranslator().locale).toBe(PSEUDO_LOCALE);
    expect(notified).toHaveBeenCalledTimes(1);
  });

  it('follows live setting changes and skips rebuilds when the locale is unchanged', async () => {
    const notified = vi.fn();
    onLocaleChange(notified);
    const { storage, write } = makeStorage({ 'general.language': 'en' });
    installLocaleSubscription(storage);
    await settle();
    expect(mainTranslator().locale).toBe('en');

    write({ 'general.language': PSEUDO_LOCALE });
    expect(mainTranslator().locale).toBe(PSEUDO_LOCALE);
    const afterSwitch = notified.mock.calls.length;

    // A settings write that keeps the same language must not rebuild.
    write({ 'general.language': PSEUDO_LOCALE, 'telemetry.enabled': false });
    expect(notified.mock.calls.length).toBe(afterSwitch);

    // An absent dict means 'auto' — back to the OS-resolved default.
    write(undefined);
    expect(mainTranslator().locale).toBe(DEFAULT_LOCALE);
  });
});

describe('desktop tray labels (default locale)', () => {
  const t = getTranslator(DEFAULT_LOCALE);

  it('byte-matches the shipped tray strings', () => {
    expect(t('desktop.tray.open')).toBe('Open Open Headers');
    expect(t('desktop.tray.quit')).toBe('Quit');
    expect(t('desktop.menu.settings')).toBe('Settings…');
  });
});
