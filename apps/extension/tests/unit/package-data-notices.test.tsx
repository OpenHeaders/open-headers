// @vitest-environment jsdom
/**
 * What became of the data a move to the Windows package handed over, on
 * the Notifications timeline — over the `packageDataMove` capability only
 * a Windows package's start registers.
 *
 * A start that took the data in says so once, with what is to redo. Data
 * that was not brought over is said with the folder it is still in, on a
 * card with no dismissal: the host reports it at every start while it
 * holds. A host without the capability says nothing.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import {
  __resetNotificationsForTests,
  clearAllNotifications,
  useNotifications,
  usePackageDataNotices,
} from '@openheaders/ui/shared/notifications';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
} from '@openheaders/ui/workbench/settings/store';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
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

const CLASSIC_DIR = 'C:\\Users\\John Doe\\AppData\\Roaming\\OpenHeaders';

function useNoticesHarness() {
  usePackageDataNotices();
  return useNotifications();
}

beforeEach(() => {
  window.localStorage.clear();
  __resetStoreForTests();
  __resetNotificationsForTests();
  configureSettingsStorage(new NoopDictStorage());
});

afterEach(() => {
  cleanup();
  unregisterCapability('packageDataMove');
  __resetNotificationsForTests();
  __resetStoreForTests();
});

describe("a Windows package's start, on the Notifications timeline", () => {
  it('says nothing on a host that registers no such start', async () => {
    await initSettingsStore();
    const { result } = renderHook(useNoticesHarness);
    expect(result.current).toEqual([]);
  });

  it('says once that the app now runs as a package, with what is to redo', async () => {
    registerCapability('packageDataMove', () => ({ takenIn: true, leftAt: null }));
    await initSettingsStore();
    const { result, rerender } = renderHook(useNoticesHarness);

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0]).toMatchObject({
      severity: 'success',
      title: 'Now running as a Windows package',
      description: 'Pin the app to the taskbar again and update any MCP client command you pasted.',
    });
    expect(result.current[0]?.sticky).toBeUndefined();

    rerender();
    expect(result.current).toHaveLength(1);
  });

  it('says where the data still is when it was not brought over, on a card no one can clear', async () => {
    registerCapability('packageDataMove', () => ({ takenIn: false, leftAt: CLASSIC_DIR }));
    await initSettingsStore();
    const { result } = renderHook(useNoticesHarness);

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0]).toMatchObject({
      severity: 'warning',
      title: 'Your data was not brought over',
      description: `It is still in ${CLASSIC_DIR}.`,
      sticky: true,
    });

    act(() => clearAllNotifications());
    expect(result.current.map((entry) => entry.title)).toEqual(['Your data was not brought over']);
  });

  it('waits for the settings store, so the cards are written in the chosen language', async () => {
    registerCapability('packageDataMove', () => ({ takenIn: true, leftAt: null }));
    const { result } = renderHook(useNoticesHarness);
    expect(result.current).toEqual([]);

    await act(async () => {
      await initSettingsStore();
    });
    await waitFor(() => expect(result.current).toHaveLength(1));
  });
});
