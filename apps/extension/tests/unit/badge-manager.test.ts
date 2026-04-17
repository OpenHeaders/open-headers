import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the settings store before importing badge-manager so the
// `showBadgeWhenDisconnected` read in the disconnected branch resolves
// to the default instead of throwing. Individual tests override the
// mock via vi.mocked(get).mockImplementationOnce(...) when they want a
// specific setting value.
vi.mock('@/rules/settings/store', () => ({
  get: vi.fn((key: string) => {
    switch (key) {
      case 'desktop.connection.showBadgeWhenDisconnected':
        return true;
      case 'desktop.connection.autoConnect':
        return true;
      default:
        return undefined;
    }
  }),
}));

import type { BadgeUpdateInput } from '@/background/modules/badge-manager';
import { resetBadgeState, updateExtensionBadge } from '@/background/modules/badge-manager';
import type { IRecordingService } from '@/types/recording';

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
    recordingService: null,
    reconnectAttempts: 0,
    matchedRuleCount: 0,
    configuredRuleCount: 0,
    ...overrides,
  };
}

function makeRecordingService(overrides: Partial<IRecordingService> = {}): IRecordingService {
  return {
    isRecording: vi.fn().mockReturnValue(false),
    getRecordingState: vi.fn().mockReturnValue({}),
    startRecording: vi.fn().mockResolvedValue({ id: 'rec-001' }),
    stopRecording: vi.fn().mockResolvedValue(null),
    cleanupTab: vi.fn(),
    handleNavigation: vi.fn().mockResolvedValue(undefined),
    addEvent: vi.fn(),
    handleContentScriptReady: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as IRecordingService;
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

  // ── Recording active skips badge update ──

  describe('recording active skips badge update', () => {
    it('skips badge update when a tab is recording', async () => {
      const action = getActionMock();
      const recordingService = makeRecordingService({
        isRecording: vi.fn().mockReturnValue(true),
      });

      (chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementation(
        (_q: chrome.tabs.QueryInfo, cb: (tabs: chrome.tabs.Tab[]) => void) =>
          cb([
            {
              id: 42,
              index: 0,
              pinned: false,
              highlighted: false,
              windowId: 1,
              active: true,
              incognito: false,
              selected: false,
              discarded: false,
              autoDiscardable: true,
              groupId: -1,
            } as chrome.tabs.Tab,
          ]),
      );

      await updateExtensionBadge(makeInput({ recordingService, matchedRuleCount: 5, configuredRuleCount: 5 }));

      expect(action.setBadgeText).not.toHaveBeenCalled();
      expect(action.setBadgeBackgroundColor).not.toHaveBeenCalled();
      expect(action.setTitle).not.toHaveBeenCalled();
    });

    it('does not skip badge update when recording service exists but no tab is recording', async () => {
      const action = getActionMock();
      const recordingService = makeRecordingService({
        isRecording: vi.fn().mockReturnValue(false),
      });

      (chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementation(
        (_q: chrome.tabs.QueryInfo, cb: (tabs: chrome.tabs.Tab[]) => void) =>
          cb([
            {
              id: 42,
              index: 0,
              pinned: false,
              highlighted: false,
              windowId: 1,
              active: true,
              incognito: false,
              selected: false,
              discarded: false,
              autoDiscardable: true,
              groupId: -1,
            } as chrome.tabs.Tab,
          ]),
      );

      await updateExtensionBadge(makeInput({ recordingService, matchedRuleCount: 3, configuredRuleCount: 3 }));

      expect(action.setBadgeText).toHaveBeenCalledWith({ text: '3' }, expect.any(Function));
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
