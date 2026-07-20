import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the settings store before importing badge-manager so the
// `showBadgeWhenDisconnected` read in the disconnected branch resolves
// to the default instead of throwing. Individual tests override the
// mock via vi.mocked(get).mockImplementationOnce(...) when they want a
// specific setting value. The module subscribes to `general.language`
// at load time — capture the listener so the locale-switch test can
// fire it.
const { localeListeners } = vi.hoisted(() => ({ localeListeners: [] as Array<() => void> }));
vi.mock('@openheaders/ui/workbench/settings/store', () => ({
  get: vi.fn((key: string) => {
    switch (key) {
      case 'backend.showBadgeWhenDisconnected':
        return true;
      case 'general.language':
        return 'en';
      default:
        return undefined;
    }
  }),
  subscribeKey: vi.fn((key: string, fn: () => void) => {
    if (key === 'general.language') localeListeners.push(fn);
    return () => {};
  }),
}));

// The disconnected branch consults the backend registry (a badge only
// makes sense when there IS an enabled back-end to be disconnected
// from) — pin an enabled, auto-connecting primary record.
vi.mock('@openheaders/core/backends', () => ({
  getBackends: vi.fn(() => [
    {
      id: 'backend-1',
      label: '',
      url: 'ws://127.0.0.1:8137',
      authToken: '',
      autoConnect: true,
      enabled: true,
      addedAt: '2026-07-01T00:00:00.000Z',
      lastConnectedAt: null,
    },
  ]),
}));

import { get } from '@openheaders/ui/workbench/settings/store';
import type { BadgeUpdateInput } from '@/background/modules/badge-manager';
import { resetBadgeState, updateExtensionBadge } from '@/background/modules/badge-manager';

function mockLanguageSetting(language: string): void {
  vi.mocked(get).mockImplementation((key: string) => {
    switch (key) {
      case 'backend.showBadgeWhenDisconnected':
        return true;
      case 'general.language':
        return language;
      default:
        return false;
    }
  });
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function getActionMock() {
  return chrome.action as unknown as {
    setBadgeText: ReturnType<typeof vi.fn>;
    setBadgeBackgroundColor: ReturnType<typeof vi.fn>;
    setTitle: ReturnType<typeof vi.fn>;
  };
}

/**
 * Build an input payload with sensible defaults. Badge number is driven
 * by `matchedRuleCount` (count of currently-active rules that matched a
 * request on this page). `configuredRuleCount` feeds the tooltip only.
 */
function makeInput(overrides: Partial<BadgeUpdateInput> = {}): BadgeUpdateInput {
  return {
    connected: true,
    isPaused: false,
    reconnectAttempts: 0,
    matchedRuleCount: 0,
    configuredRuleCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
//  Tests
// ---------------------------------------------------------------------------

describe('updateExtensionBadge', () => {
  beforeEach(() => {
    resetBadgeState();
    vi.clearAllMocks();
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementation(
      (_q: chrome.tabs.QueryInfo, cb: (tabs: chrome.tabs.Tab[]) => void) => cb([]),
    );
  });

  // ── Priority: paused > disconnected > active > none ──

  describe('badge state priority', () => {
    it('shows paused badge when paused, even when disconnected with matches', async () => {
      const action = getActionMock();
      await updateExtensionBadge(
        makeInput({
          connected: false,
          isPaused: true,
          reconnectAttempts: 10,
          matchedRuleCount: 5,
          configuredRuleCount: 5,
        }),
      );

      expect(action.setBadgeText).toHaveBeenCalledWith({ text: '\u2212' }, expect.any(Function));
      expect(action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#8c8c8c' }, expect.any(Function));
    });

    it('shows disconnected badge over the match count once past threshold', async () => {
      const action = getActionMock();
      await updateExtensionBadge(
        makeInput({ connected: false, reconnectAttempts: 3, matchedRuleCount: 3, configuredRuleCount: 3 }),
      );

      expect(action.setBadgeText).toHaveBeenCalledWith({ text: '!' }, expect.any(Function));
      expect(action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#c23b22' }, expect.any(Function));
      expect(action.setTitle).toHaveBeenCalledWith({
        title: 'Open Headers - Disconnected\nCannot reach the desktop app',
      });
    });

    it('shows paused badge when paused and connected', async () => {
      const action = getActionMock();
      await updateExtensionBadge(makeInput({ isPaused: true, matchedRuleCount: 5, configuredRuleCount: 5 }));

      expect(action.setBadgeText).toHaveBeenCalledWith({ text: '\u2212' }, expect.any(Function));
      expect(action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#8c8c8c' }, expect.any(Function));
      expect(action.setTitle).toHaveBeenCalledWith({
        title: 'Open Headers - Paused\nRules execution is paused',
      });
    });

    it('shows active badge when rules have matched on this page', async () => {
      const action = getActionMock();
      await updateExtensionBadge(makeInput({ matchedRuleCount: 3, configuredRuleCount: 7 }));

      expect(action.setBadgeText).toHaveBeenCalledWith({ text: '3' }, expect.any(Function));
      expect(action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#E8E8E8' }, expect.any(Function));
      expect(action.setTitle).toHaveBeenCalledWith({
        title: 'Open Headers - Active\n3 of your 7 rules matched requests on this page',
      });
    });

    it('clears badge when no rules have matched', async () => {
      const action = getActionMock();
      await updateExtensionBadge(makeInput({ matchedRuleCount: 0, configuredRuleCount: 5 }));

      expect(action.setBadgeText).toHaveBeenCalledWith({ text: '' });
      expect(action.setTitle).toHaveBeenCalledWith({ title: 'Open Headers' });
    });
  });

  // ── Match count display ──

  describe('matched-rule count display', () => {
    it('shows "1" with singular tooltip when a single rule matched', async () => {
      const action = getActionMock();
      await updateExtensionBadge(makeInput({ matchedRuleCount: 1, configuredRuleCount: 1 }));

      expect(action.setBadgeText).toHaveBeenCalledWith({ text: '1' }, expect.any(Function));
      expect(action.setTitle).toHaveBeenCalledWith({
        title: 'Open Headers - Active\n1 of your 1 rule matched requests on this page',
      });
    });

    it('shows the raw count with no cap — 50', async () => {
      const action = getActionMock();
      await updateExtensionBadge(makeInput({ matchedRuleCount: 50, configuredRuleCount: 80 }));

      expect(action.setBadgeText).toHaveBeenCalledWith({ text: '50' }, expect.any(Function));
    });

    it('shows the raw count with no cap — 150', async () => {
      const action = getActionMock();
      await updateExtensionBadge(makeInput({ matchedRuleCount: 150, configuredRuleCount: 200 }));

      expect(action.setBadgeText).toHaveBeenCalledWith({ text: '150' }, expect.any(Function));
    });
  });

  // ── Disconnected badge ──

  describe('disconnected badge', () => {
    it('stays empty when disconnected with no matches before threshold', async () => {
      const action = getActionMock();
      await updateExtensionBadge(
        makeInput({ connected: false, reconnectAttempts: 0, matchedRuleCount: 0, configuredRuleCount: 0 }),
      );

      expect(action.setBadgeText).toHaveBeenCalledWith({ text: '' });
    });

    it('shows disconnected indicator past the reconnect threshold', async () => {
      const action = getActionMock();
      await updateExtensionBadge(
        makeInput({ connected: false, reconnectAttempts: 10, matchedRuleCount: 3, configuredRuleCount: 3 }),
      );

      expect(action.setBadgeText).toHaveBeenCalledWith({ text: '!' }, expect.any(Function));
    });
  });

  // ── State deduplication ──

  describe('state deduplication', () => {
    it('does not re-update badge when called twice with same state', async () => {
      const action = getActionMock();

      await updateExtensionBadge(makeInput({ matchedRuleCount: 5, configuredRuleCount: 5 }));
      expect(action.setBadgeText).toHaveBeenCalledTimes(1);

      await updateExtensionBadge(makeInput({ matchedRuleCount: 5, configuredRuleCount: 5 }));
      expect(action.setBadgeText).toHaveBeenCalledTimes(1);
    });

    it('updates badge when matched-rule count changes between calls', async () => {
      const action = getActionMock();

      await updateExtensionBadge(makeInput({ matchedRuleCount: 5, configuredRuleCount: 10 }));
      expect(action.setBadgeText).toHaveBeenCalledTimes(1);

      await updateExtensionBadge(makeInput({ matchedRuleCount: 7, configuredRuleCount: 10 }));
      expect(action.setBadgeText).toHaveBeenCalledTimes(2);
    });
  });

  // ── Locale switch ──

  describe('locale switch', () => {
    it('re-titles the badge when the language setting changes, despite unchanged badge state', async () => {
      const action = getActionMock();
      expect(localeListeners).toHaveLength(1);

      await updateExtensionBadge(makeInput({ matchedRuleCount: 3, configuredRuleCount: 7 }));
      expect(action.setTitle).toHaveBeenCalledTimes(1);

      // Same state key — the repaint guard alone would skip this.
      localeListeners[0]();
      expect(action.setTitle).toHaveBeenCalledTimes(2);
      expect(action.setTitle).toHaveBeenLastCalledWith({
        title: 'Open Headers - Active\n3 of your 7 rules matched requests on this page',
      });
    });

    it('is a no-op when the language changes before any badge update', () => {
      const action = getActionMock();

      localeListeners[0]();
      expect(action.setTitle).not.toHaveBeenCalled();
    });
  });

  // ── Static locale slice (SW cannot dynamic-import) ──

  describe('static locale slice', () => {
    it('renders the French badge tooltip from the statically bundled slice', async () => {
      const action = getActionMock();
      mockLanguageSetting('fr');

      await updateExtensionBadge(makeInput({ matchedRuleCount: 3, configuredRuleCount: 7 }));
      expect(action.setTitle).toHaveBeenCalledWith({
        title: 'Open Headers - Actif\n3 de vos 7 règles ont correspondu à des requêtes sur cette page',
      });

      mockLanguageSetting('en');
    });

    it('renders the Simplified Chinese badge tooltip from the statically bundled slice', async () => {
      const action = getActionMock();
      mockLanguageSetting('zh-CN');

      await updateExtensionBadge(makeInput({ matchedRuleCount: 3, configuredRuleCount: 7 }));
      expect(action.setTitle).toHaveBeenCalledWith({
        title: 'Open Headers - 活动\n你的 7 条规则 中有 3 条在此页面上匹配了请求',
      });

      mockLanguageSetting('en');
    });

    it('re-titles into French when the language setting switches after an English paint', async () => {
      const action = getActionMock();

      await updateExtensionBadge(makeInput({ isPaused: true }));
      expect(action.setTitle).toHaveBeenLastCalledWith({
        title: 'Open Headers - Paused\nRules execution is paused',
      });

      mockLanguageSetting('fr');
      localeListeners[0]();
      await Promise.resolve();
      expect(action.setTitle).toHaveBeenLastCalledWith({
        title: "Open Headers - Suspendu\nL'exécution des règles est suspendue",
      });

      mockLanguageSetting('en');
    });
  });

  // ── resetBadgeState ──

  describe('resetBadgeState', () => {
    it('allows badge to be updated again after reset', async () => {
      const action = getActionMock();

      await updateExtensionBadge(makeInput({ matchedRuleCount: 5, configuredRuleCount: 5 }));
      expect(action.setBadgeText).toHaveBeenCalledTimes(1);

      await updateExtensionBadge(makeInput({ matchedRuleCount: 5, configuredRuleCount: 5 }));
      expect(action.setBadgeText).toHaveBeenCalledTimes(1);

      resetBadgeState();

      await updateExtensionBadge(makeInput({ matchedRuleCount: 5, configuredRuleCount: 5 }));
      expect(action.setBadgeText).toHaveBeenCalledTimes(2);
    });
  });
});
