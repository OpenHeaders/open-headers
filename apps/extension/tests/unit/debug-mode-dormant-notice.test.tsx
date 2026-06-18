/**
 * DebugModeDormantNotice — the surface-agnostic "never-silent" dormancy chip.
 *
 * Renders "Tab out of scope" only when Debug mode is on, a realizable
 * debug-tier rule exists, and the surface's tab is OUTSIDE the live CDP
 * roster. The tab is resolved from `tabSource`: the panel inspects a fixed
 * tab (`inspected`), the popup / side panel follow the active tab (`active`).
 * Pins both tab-source paths plus every silencing gate.
 */

import '@openheaders/ui/workbench/settings/schema/inspection';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { type HostNavigation, setHostNavigation } from '@openheaders/core/navigation';
import type { CdpRosterTab } from '@openheaders/core/types';
import { DebugModeDormantNotice, type DebugModeTabSource } from '@openheaders/ui/shared/debug-mode';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
  set,
} from '@openheaders/ui/workbench/settings/store';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const NOTICE_TEXT = 'Tab out of scope';

const { mockCall, mockSubscribe } = vi.hoisted(() => ({
  mockCall: vi.fn(),
  mockSubscribe: vi.fn(),
}));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: { call: mockCall, subscribe: mockSubscribe, broadcast: vi.fn(), presence: vi.fn() },
  };
});

class NoopDictStorage implements DictStorage {
  async load(_scope: SettingScope): Promise<Record<string, unknown>> {
    return {};
  }
  async save(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
}

function rosterTab(tabId: number): CdpRosterTab {
  return { tabId, windowId: 1, index: 0, title: '', url: 'https://app.openheaders.io', pinned: false };
}

/** The live `cdp` Status roster the SW reports back; an empty list ⇒ out of scope. */
function installRoster(tabIds: number[]): void {
  mockCall.mockResolvedValue({ snapshot: { cdp: { context: { tabs: tabIds.map(rosterTab) } } } });
}

/** Resolve the same id for both the inspected (panel) and active (popup) paths. */
function installNavigation(tabId: number | null): void {
  const nav: HostNavigation = {
    switchViewMode: () => Promise.resolve({ opened: false }),
    currentWindowId: () => Promise.resolve(undefined),
    activeTabUrl: () => Promise.resolve(undefined),
    openUrl: () => {},
    openShortcutSettings: () => {},
    getActiveTab: () => Promise.resolve(tabId == null ? null : { id: tabId }),
    observeActiveTabContext: () => () => {},
    inspectedTabId: () => tabId,
    reloadInspectedTab: () => {},
    getInspectedHar: () => Promise.resolve(null),
    openResource: () => {},
  };
  setHostNavigation(nav);
}

beforeEach(async () => {
  __resetStoreForTests();
  configureSettingsStorage(new NoopDictStorage());
  await initSettingsStore();
  set('inspection.cdpEnabled', true);
  mockCall.mockReset();
  mockSubscribe.mockReset();
  mockSubscribe.mockReturnValue(() => {});
  installRoster([]);
  installNavigation(7);
  registerCapability('cdpInspection', () => true);
});

afterEach(() => {
  cleanup();
  unregisterCapability('cdpInspection');
  __resetStoreForTests();
  vi.restoreAllMocks();
});

describe('DebugModeDormantNotice', () => {
  // Both surfaces' tab-source paths: the panel inspects a fixed tab, the popup
  // / side panel follow the active tab — the membership decision must hold for
  // each.
  describe.each<DebugModeTabSource>(['inspected', 'active'])('tabSource=%s', (tabSource) => {
    it('shows the out-of-scope chip when Debug mode is on but the tab is absent from the roster', async () => {
      installRoster([]);
      installNavigation(7);
      render(<DebugModeDormantNotice tabSource={tabSource} hasRealizableRule />);
      expect(await screen.findByText(NOTICE_TEXT)).toBeTruthy();
    });

    it('stays silent when the tab is in the roster (in scope)', async () => {
      installRoster([7]);
      installNavigation(7);
      render(<DebugModeDormantNotice tabSource={tabSource} hasRealizableRule />);
      await waitFor(() => expect(mockCall).toHaveBeenCalledWith('getStatusSnapshot'));
      await waitFor(() => expect(screen.queryByText(NOTICE_TEXT)).toBeNull());
    });
  });

  it('stays silent on a host without the cdpInspection capability', async () => {
    unregisterCapability('cdpInspection');
    render(<DebugModeDormantNotice tabSource="active" hasRealizableRule />);
    await waitFor(() => expect(mockCall).toHaveBeenCalledWith('getStatusSnapshot'));
    expect(screen.queryByText(NOTICE_TEXT)).toBeNull();
  });

  it('stays silent while the master switch is off', async () => {
    set('inspection.cdpEnabled', false);
    render(<DebugModeDormantNotice tabSource="active" hasRealizableRule />);
    await waitFor(() => expect(mockCall).toHaveBeenCalledWith('getStatusSnapshot'));
    expect(screen.queryByText(NOTICE_TEXT)).toBeNull();
  });

  it('stays silent when no realizable debug-tier rule exists', async () => {
    render(<DebugModeDormantNotice tabSource="active" hasRealizableRule={false} />);
    await waitFor(() => expect(mockCall).toHaveBeenCalledWith('getStatusSnapshot'));
    expect(screen.queryByText(NOTICE_TEXT)).toBeNull();
  });

  it('stays silent when the surface resolves no tab', async () => {
    installNavigation(null);
    render(<DebugModeDormantNotice tabSource="active" hasRealizableRule />);
    await waitFor(() => expect(mockCall).toHaveBeenCalledWith('getStatusSnapshot'));
    expect(screen.queryByText(NOTICE_TEXT)).toBeNull();
  });
});
