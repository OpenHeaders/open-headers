/**
 * useUpdatedNotification — the post-update "Updated to X" timeline
 * entry for store-updated hosts (no in-app updater):
 *   - announces once when the recorded last-run version differs from
 *     the build version, with "See what's new" only when the host
 *     bundles notes;
 *   - stays quiet on fresh installs (no recorded prior version) and
 *     on unchanged versions;
 *   - defers entirely to AppUpdateToast on hosts that register
 *     `getAppUpdate`, leaving the shared latch untouched;
 *   - holds the push (and the latch) until the settings store is
 *     ready, so entry copy never bakes in the default locale.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { getTranslator } from '@openheaders/i18n';
import { LocaleContext } from '@openheaders/ui/context/LocaleContext';
import { setBuildInfo } from '@openheaders/ui/shared/build-info';
import {
  __resetNotificationsForTests,
  type NotificationEntry,
  useNotifications,
  useUpdatedNotification,
} from '@openheaders/ui/shared/notifications';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
} from '@openheaders/ui/workbench/settings/store';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
const LAST_RUN_VERSION_KEY = 'oh.lastRunVersion';

let latest: readonly NotificationEntry[] = [];

function Probe({ onOpenWhatsNew }: { onOpenWhatsNew?: () => void }) {
  useUpdatedNotification(onOpenWhatsNew);
  latest = useNotifications();
  return null;
}

function Harness({ onOpenWhatsNew }: { onOpenWhatsNew?: () => void }) {
  return (
    <LocaleContext.Provider value={EN}>
      <Probe onOpenWhatsNew={onOpenWhatsNew} />
    </LocaleContext.Provider>
  );
}

function setVersion(version: string) {
  setBuildInfo({ version, commit: '0000000', build: 1, date: '', channel: 'stable' });
}

beforeEach(() => {
  window.localStorage.clear();
  latest = [];
  __resetStoreForTests();
  __resetNotificationsForTests();
  configureSettingsStorage(new NoopDictStorage());
  setVersion('2026.7.27');
});

afterEach(() => {
  cleanup();
  unregisterCapability('getWhatsNew');
  unregisterCapability('getAppUpdate');
  setVersion('0.0.0');
  __resetStoreForTests();
  __resetNotificationsForTests();
});

describe('useUpdatedNotification', () => {
  it('stays quiet on a fresh install and records the version', async () => {
    await initSettingsStore();
    render(<Harness />);
    expect(latest).toHaveLength(0);
    expect(window.localStorage.getItem(LAST_RUN_VERSION_KEY)).toBe('2026.7.27');
  });

  it('announces a version change with a See-whats-new action when notes are bundled', async () => {
    window.localStorage.setItem(LAST_RUN_VERSION_KEY, '2026.7.26');
    registerCapability('getWhatsNew', () => '## Fixes');
    const openWhatsNew = vi.fn();
    await initSettingsStore();
    render(<Harness onOpenWhatsNew={openWhatsNew} />);

    expect(latest).toHaveLength(1);
    expect(latest[0]?.title).toBe(EN.t('shared.notifications.toast.updatedTo', { version: '2026.7.27' }));
    expect(latest[0]?.actions).toHaveLength(1);
    expect(latest[0]?.actions?.[0]?.label).toBe(EN.t('shared.notifications.toast.seeWhatsNew'));
    latest[0]?.actions?.[0]?.run();
    expect(openWhatsNew).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(LAST_RUN_VERSION_KEY)).toBe('2026.7.27');
  });

  it('announces without an action when the build bundles no notes', async () => {
    window.localStorage.setItem(LAST_RUN_VERSION_KEY, '2026.7.26');
    await initSettingsStore();
    render(<Harness onOpenWhatsNew={() => {}} />);

    expect(latest).toHaveLength(1);
    expect(latest[0]?.actions).toHaveLength(0);
  });

  it('defers to the in-app updater host without touching the latch', async () => {
    window.localStorage.setItem(LAST_RUN_VERSION_KEY, '2026.7.26');
    registerCapability('getAppUpdate', async () => null);
    await initSettingsStore();
    render(<Harness />);

    expect(latest).toHaveLength(0);
    expect(window.localStorage.getItem(LAST_RUN_VERSION_KEY)).toBe('2026.7.26');
  });

  it('stays quiet when the version has not changed', async () => {
    window.localStorage.setItem(LAST_RUN_VERSION_KEY, '2026.7.27');
    await initSettingsStore();
    render(<Harness />);
    expect(latest).toHaveLength(0);
  });

  it('holds the announcement and the latch until settings are ready', async () => {
    window.localStorage.setItem(LAST_RUN_VERSION_KEY, '2026.7.26');
    render(<Harness />);
    expect(latest).toHaveLength(0);
    expect(window.localStorage.getItem(LAST_RUN_VERSION_KEY)).toBe('2026.7.26');

    await act(async () => {
      await initSettingsStore();
    });
    expect(latest).toHaveLength(1);
  });
});
