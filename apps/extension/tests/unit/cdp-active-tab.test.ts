/**
 * `cdp-active-tab` — the "current attachable tab" feed for the `active` /
 * `both` scope modes. Drives the captured `tabs` / `windows` listeners and
 * the `tabs.query` callback to prove the no-thrash filter:
 *   - only an *attachable* current tab is ever pushed;
 *   - focus passing through a `chrome://` / new-tab page keeps the prior
 *     tab (no detach/re-attach flutter);
 *   - the held tab is cleared (`null`) when it closes with no attachable
 *     tab in its place, or when it itself navigates to a non-attachable URL.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { tabsMock, windowsMock, setCurrentTabs } = vi.hoisted(() => {
  function makeEvent<A extends unknown[]>() {
    const listeners = new Set<(...a: A) => void>();
    return {
      addListener: (l: (...a: A) => void): void => void listeners.add(l),
      removeListener: (l: (...a: A) => void): void => void listeners.delete(l),
      emit: (...a: A): void => {
        for (const l of [...listeners]) l(...a);
      },
    };
  }
  let current: chrome.tabs.Tab[] = [];
  return {
    setCurrentTabs: (t: chrome.tabs.Tab[]): void => {
      current = t;
    },
    tabsMock: {
      query: (_opts: chrome.tabs.QueryInfo, cb: (t: chrome.tabs.Tab[]) => void): void => cb(current),
      onActivated: makeEvent<[]>(),
      onUpdated: makeEvent<[number, chrome.tabs.OnUpdatedInfo, chrome.tabs.Tab]>(),
      onRemoved: makeEvent<[number]>(),
    },
    windowsMock: {
      WINDOW_ID_NONE: -1,
      onFocusChanged: makeEvent<[number]>(),
    },
  };
});

vi.mock('@utils/browser-api.js', () => ({ tabs: tabsMock, windows: windowsMock }));
vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { startCdpActiveTab } from '@/background/correlator-host/cdp-active-tab';

function tab(id: number, url: string): chrome.tabs.Tab {
  return { id, url, active: true } as chrome.tabs.Tab;
}

const HTTP_5 = tab(5, 'https://openheaders.io/');
const HTTP_6 = tab(6, 'https://app.openheaders.io/');
const NEW_TAB = tab(99, 'chrome://newtab/');

describe('startCdpActiveTab', () => {
  let onActiveTab: ReturnType<typeof vi.fn<(tabId: number | null) => void>>;

  beforeEach(() => {
    onActiveTab = vi.fn<(tabId: number | null) => void>();
    setCurrentTabs([]);
  });

  it('seeds with the current attachable tab on start', () => {
    setCurrentTabs([HTTP_5]);
    startCdpActiveTab({ onActiveTab });
    expect(onActiveTab).toHaveBeenCalledWith(5);
  });

  it('does not push (no-thrash) when focus moves to a chrome:// tab', () => {
    setCurrentTabs([HTTP_5]);
    startCdpActiveTab({ onActiveTab });
    onActiveTab.mockClear();

    setCurrentTabs([NEW_TAB]);
    tabsMock.onActivated.emit();
    // The prior attachable tab is kept — nothing new pushed.
    expect(onActiveTab).not.toHaveBeenCalled();
  });

  it('follows focus to another attachable tab', () => {
    setCurrentTabs([HTTP_5]);
    startCdpActiveTab({ onActiveTab });
    onActiveTab.mockClear();

    setCurrentTabs([HTTP_6]);
    tabsMock.onActivated.emit();
    expect(onActiveTab).toHaveBeenCalledWith(6);
  });

  it('follows window focus changes (≠ WINDOW_ID_NONE)', () => {
    setCurrentTabs([HTTP_5]);
    startCdpActiveTab({ onActiveTab });
    onActiveTab.mockClear();

    setCurrentTabs([HTTP_6]);
    windowsMock.onFocusChanged.emit(7);
    expect(onActiveTab).toHaveBeenCalledWith(6);
  });

  it('ignores a WINDOW_ID_NONE focus change (focus left the browser)', () => {
    setCurrentTabs([HTTP_5]);
    startCdpActiveTab({ onActiveTab });
    onActiveTab.mockClear();

    setCurrentTabs([HTTP_6]);
    windowsMock.onFocusChanged.emit(windowsMock.WINDOW_ID_NONE);
    expect(onActiveTab).not.toHaveBeenCalled();
  });

  it('clears (null) when the held tab closes and no attachable tab takes its place', () => {
    setCurrentTabs([HTTP_5]);
    startCdpActiveTab({ onActiveTab });
    onActiveTab.mockClear();

    setCurrentTabs([NEW_TAB]); // only a new-tab page remains
    tabsMock.onRemoved.emit(5);
    expect(onActiveTab).toHaveBeenCalledWith(null);
  });

  it('moves to the new current tab when the held tab closes and an attachable tab is active', () => {
    setCurrentTabs([HTTP_5]);
    startCdpActiveTab({ onActiveTab });
    onActiveTab.mockClear();

    setCurrentTabs([HTTP_6]);
    tabsMock.onRemoved.emit(5);
    expect(onActiveTab).toHaveBeenCalledWith(6);
  });

  it('ignores the close of a tab that is not the held one', () => {
    setCurrentTabs([HTTP_5]);
    startCdpActiveTab({ onActiveTab });
    onActiveTab.mockClear();

    tabsMock.onRemoved.emit(123);
    expect(onActiveTab).not.toHaveBeenCalled();
  });

  it('clears (null) when the held active tab navigates to a non-attachable URL', () => {
    setCurrentTabs([HTTP_5]);
    startCdpActiveTab({ onActiveTab });
    onActiveTab.mockClear();

    tabsMock.onUpdated.emit(5, { url: 'chrome://settings/' }, tab(5, 'chrome://settings/'));
    expect(onActiveTab).toHaveBeenCalledWith(null);
  });

  it('pushes when the active tab navigates to an attachable URL', () => {
    setCurrentTabs([]);
    startCdpActiveTab({ onActiveTab });
    onActiveTab.mockClear();

    tabsMock.onUpdated.emit(7, { url: 'https://openheaders.io/api' }, tab(7, 'https://openheaders.io/api'));
    expect(onActiveTab).toHaveBeenCalledWith(7);
  });

  it('stops pushing after dispose', () => {
    setCurrentTabs([HTTP_5]);
    const handle = startCdpActiveTab({ onActiveTab });
    onActiveTab.mockClear();

    handle.dispose();
    setCurrentTabs([HTTP_6]);
    tabsMock.onActivated.emit();
    expect(onActiveTab).not.toHaveBeenCalled();
  });
});
