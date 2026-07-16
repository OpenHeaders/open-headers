/**
 * Seed nudges × locale — the two sticky baseline cards are standing
 * nudges, not historical records, so they follow the language plane:
 *   - the first push waits for the settings store, so a persisted
 *     locale can't lose the race against the mount effect (entries
 *     capture copy at push time; dedupe drops any re-push);
 *   - an in-session locale switch retires both cards and reissues
 *     them under the new locale;
 *   - re-mounts under the same locale leave the existing entries
 *     alone (no stacking, no timestamp churn).
 */

import { getTranslator } from '@openheaders/i18n';
import { LocaleContext } from '@openheaders/ui/context/LocaleContext';
import {
  __resetNotificationsForTests,
  __resetSeedNotificationsForTests,
  type NotificationEntry,
  useNotifications,
  useSeedNotifications,
} from '@openheaders/ui/shared/notifications';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import { __resetStoreForTests, configureSettingsStorage, initSettingsStore } from '@openheaders/ui/workbench/settings/store';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

class NoopDictStorage implements DictStorage {
  async load(_scope: SettingScope): Promise<Record<string, unknown>> {
    return {};
  }
  async save(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
}

const EN = { locale: 'en', direction: 'ltr' as const, t: getTranslator('en') };
const PSEUDO = { locale: 'pseudo', direction: 'ltr' as const, t: getTranslator('pseudo') };

let latest: readonly NotificationEntry[] = [];

function Seeds() {
  useSeedNotifications();
  latest = useNotifications();
  return null;
}

function Harness({ value }: { value: typeof EN }) {
  return (
    <LocaleContext.Provider value={value}>
      <Seeds />
    </LocaleContext.Provider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  latest = [];
  __resetStoreForTests();
  __resetNotificationsForTests();
  __resetSeedNotificationsForTests();
  configureSettingsStorage(new NoopDictStorage());
});

afterEach(() => {
  cleanup();
  __resetStoreForTests();
  __resetNotificationsForTests();
  __resetSeedNotificationsForTests();
});

describe('useSeedNotifications × locale', () => {
  it('holds the first push until the settings store is ready', async () => {
    render(<Harness value={EN} />);
    expect(latest).toHaveLength(0);

    await act(async () => {
      await initSettingsStore();
    });
    expect(latest).toHaveLength(2);
    expect(latest.map((e) => e.title)).toEqual([
      EN.t('shared.notifications.seed.star.title'),
      EN.t('shared.notifications.seed.website.title'),
    ]);
  });

  it('reissues both cards under the new locale on a live switch', async () => {
    await initSettingsStore();
    const { rerender } = render(<Harness value={EN} />);
    expect(latest.map((e) => e.title)).toEqual([
      EN.t('shared.notifications.seed.star.title'),
      EN.t('shared.notifications.seed.website.title'),
    ]);

    rerender(<Harness value={PSEUDO} />);
    expect(latest).toHaveLength(2);
    expect(latest.map((e) => e.title)).toEqual([
      PSEUDO.t('shared.notifications.seed.star.title'),
      PSEUDO.t('shared.notifications.seed.website.title'),
    ]);
    expect(latest[0]?.title).not.toBe(EN.t('shared.notifications.seed.star.title'));
  });

  it('keeps existing entries across re-mounts in the same locale', async () => {
    await initSettingsStore();
    const first = render(<Harness value={EN} />);
    const ids = latest.map((e) => e.id);
    first.unmount();

    render(<Harness value={EN} />);
    expect(latest).toHaveLength(2);
    expect(latest.map((e) => e.id)).toEqual(ids);
  });
});
