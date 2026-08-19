/**
 * Desktop-app suggestion — the standing Suggestions card pitching the
 * companion desktop app to browser hosts.
 *
 * Pins the gates that keep the card honest:
 *   - hosts without the `companionReveal` capability (the desktop shell
 *     IS the companion) never push;
 *   - a native-messaging presence probe reporting an install retires
 *     the nudge for good without ever showing it;
 *   - the download action resolves the platform installer (website
 *     install section as fallback), retires the card, and persists the
 *     done flag so it never returns.
 */

import { type HostBridge, setHostBridge } from '@openheaders/core/bridge';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import {
  __resetDesktopAppSuggestionForTests,
  __resetNotificationsForTests,
  useDesktopAppSuggestion,
  useSuggestions,
} from '@openheaders/ui/shared/notifications';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import { __resetStoreForTests, configureSettingsStorage, initSettingsStore } from '@openheaders/ui/workbench/settings/store';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DONE_FLAG = 'oh.desktopAppNudgeDone';

class NoopDictStorage implements DictStorage {
  async load(_scope: SettingScope): Promise<Record<string, unknown>> {
    return {};
  }
  async save(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
}

function installBridge(): void {
  const bridge: HostBridge = {
    async call(type, ..._args) {
      if (type === 'getBackendSyncStatusSnapshot') return { snapshot: {} } as never;
      throw new Error(`unexpected rpc ${String(type)}`);
    },
    broadcast: () => {},
    subscribe: () => () => {},
    presence: () => () => {},
  };
  setHostBridge(bridge);
}

function useSuggestionHarness() {
  useDesktopAppSuggestion();
  return useSuggestions();
}

describe('useDesktopAppSuggestion', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    __resetStoreForTests();
    __resetNotificationsForTests();
    __resetDesktopAppSuggestionForTests();
    configureSettingsStorage(new NoopDictStorage());
    installBridge();
    // The update-feed fetch is single-flight per page load; rejecting
    // keeps the action on the website-fallback path deterministically.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    await initSettingsStore();
  });

  afterEach(() => {
    cleanup();
    unregisterCapability('companionReveal');
    unregisterCapability('nmHostPresence');
    unregisterCapability('openExternalUrl');
    vi.unstubAllGlobals();
    __resetNotificationsForTests();
    __resetDesktopAppSuggestionForTests();
    __resetStoreForTests();
  });

  it('pushes nothing on hosts without the companionReveal capability', async () => {
    const { result } = renderHook(useSuggestionHarness);
    await act(async () => {});
    expect(result.current).toHaveLength(0);
    expect(window.localStorage.getItem(DONE_FLAG)).toBeNull();
  });

  it('pushes one info suggestion with the download follow-through on companion-less browser hosts', async () => {
    registerCapability('companionReveal', async () => ({ ok: true }));
    const { result } = renderHook(useSuggestionHarness);

    await waitFor(() => expect(result.current).toHaveLength(1));
    const suggestion = result.current[0];
    expect(suggestion).toMatchObject({ severity: 'info', title: 'One Unified User Experience', sticky: true });
    expect(suggestion?.actions).toHaveLength(1);
    expect(suggestion?.actions?.[0]).toMatchObject({ label: 'Download the desktop app', variant: 'link' });
  });

  it('retires for good without showing when the presence probe reports an install', async () => {
    registerCapability('companionReveal', async () => ({ ok: true }));
    registerCapability('nmHostPresence', async () => ({ present: true, anchored: true }));
    const { result } = renderHook(useSuggestionHarness);

    await waitFor(() => expect(window.localStorage.getItem(DONE_FLAG)).toBe('1'));
    expect(result.current).toHaveLength(0);
  });

  it('download action opens the installer target, dismisses the card, and persists the done flag', async () => {
    registerCapability('companionReveal', async () => ({ ok: true }));
    const openUrl = vi.fn(async () => ({ ok: true }));
    registerCapability('openExternalUrl', openUrl);
    const { result } = renderHook(useSuggestionHarness);
    await waitFor(() => expect(result.current).toHaveLength(1));

    act(() => result.current[0]?.actions?.[0]?.run());
    await waitFor(() => expect(openUrl).toHaveBeenCalledWith('https://openheaders.com/#install-desktop'));
    expect(result.current).toHaveLength(0);
    expect(window.localStorage.getItem(DONE_FLAG)).toBe('1');
  });
});
