// @vitest-environment jsdom
/**
 * Storage tool window — the scope bar's Add button. Adding is a named
 * button beside the section's Clear: "Add item" on the DOM areas (it
 * opens the grid's add row), "Add cookie" on a writable jar — there on
 * an empty jar too, where Clear is not — and no button at all on the
 * sections that take no new row.
 */

import type { HostNavigation } from '@openheaders/core/navigation';
import { setHostNavigation } from '@openheaders/core/navigation';
import { StoragePanel } from '@openheaders/ui/panel/components/storage/StoragePanel';
import {
  __resetCookieJarCacheForTests,
  setCookieJarFetcher,
  setCookieJarWriter,
} from '@openheaders/ui/panel/data/cookies/cookie-jar-cache';
import type { StorageInspectorHost } from '@openheaders/ui/panel/host-storage-inspector';
import { setStorageInspectorHost } from '@openheaders/ui/panel/host-storage-inspector';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

const NAV: HostNavigation = {
  switchViewMode: () => Promise.resolve({ opened: false }),
  currentWindowId: () => Promise.resolve(undefined),
  activeTabUrl: () => Promise.resolve(undefined),
  openUrl: () => {},
  openShortcutSettings: () => {},
  getActiveTab: () => Promise.resolve(null),
  observeActiveTabContext: () => () => {},
  inspectedTabId: () => 42,
  reloadInspectedTab: () => {},
  getInspectedHar: () => Promise.resolve(null),
  openResource: () => {},
};

const SCOPE = { frameId: 0, origin: 'https://openheaders.io', url: 'https://openheaders.io/', isMainFrame: true };

function installHost(): void {
  const host: StorageInspectorHost = {
    listScopes: vi.fn(() => Promise.resolve([{ ...SCOPE }])),
    readDomStorage: vi.fn(() =>
      Promise.resolve({ entries: [{ key: 'theme', value: 'dark', valueLength: 4 }], truncated: false }),
    ),
    readDomStorageValue: vi.fn(() => Promise.resolve(null)),
    writeDomStorage: vi.fn(() => Promise.resolve(true)),
    renameDomStorage: vi.fn(() => Promise.resolve({ ok: true })),
    removeDomStorage: vi.fn(() => Promise.resolve(true)),
    clearDomStorage: vi.fn(() => Promise.resolve(true)),
    listIndexedDb: vi.fn(() => Promise.resolve([])),
    readIndexedDbRecords: vi.fn(() => Promise.resolve({ records: [], truncated: false })),
    readIndexedDbRecordDocument: vi.fn(() => Promise.resolve(null)),
    writeIndexedDbRecord: vi.fn(() => Promise.resolve({ ok: true })),
    deleteIndexedDbRecord: vi.fn(() => Promise.resolve(true)),
    clearIndexedDbStore: vi.fn(() => Promise.resolve(true)),
    deleteIndexedDbDatabase: vi.fn(() => Promise.resolve(true)),
    listCaches: vi.fn(() => Promise.resolve([])),
    readCacheEntries: vi.fn(() => Promise.resolve({ entries: [], truncated: false })),
    readCacheEntryDocument: vi.fn(() => Promise.resolve(null)),
    readQuota: vi.fn(() => Promise.resolve({ usage: 4096, quota: 120_000_000, breakdown: [] })),
    clearSiteData: vi.fn(() => Promise.resolve(true)),
    setQuotaOverride: vi.fn(() => Promise.resolve(true)),
    deleteCache: vi.fn(() => Promise.resolve(true)),
    deleteCacheEntry: vi.fn(() => Promise.resolve(true)),
    subscribeStorageInvalidations: () => () => {},
  };
  setStorageInspectorHost(host);
}

async function flush(ms = 1): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function renderPanel(): Promise<void> {
  render(
    <StoragePanel
      onHide={vi.fn()}
      onOpenIdbRecord={vi.fn()}
      onOpenDomEntry={vi.fn()}
      onOpenCookie={vi.fn()}
      onOpenCacheEntry={vi.fn()}
      reveal={null}
      onRevealConsumed={vi.fn()}
    />,
  );
  await flush();
  await flush();
}

async function openSection(name: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name }));
  await flush();
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
  setHostNavigation(NAV);
  __resetCookieJarCacheForTests();
  installHost();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  __resetCookieJarCacheForTests();
});

describe('Storage scope bar — Add', () => {
  it('names the gesture on a DOM area and opens the add row', async () => {
    await renderPanel();

    expect(screen.queryByLabelText('New entry key')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    expect(screen.getByLabelText('New entry key')).toBeTruthy();
  });

  it('keeps Add item on session storage', async () => {
    await renderPanel();
    await openSection('Session storage');

    expect(screen.getByRole('button', { name: 'Add item' })).toBeTruthy();
  });

  it('offers Add cookie on a writable jar — an empty one too, where Clear is not', async () => {
    setCookieJarFetcher(() => Promise.resolve([]));
    setCookieJarWriter({
      set: vi.fn().mockResolvedValue({ cookie: null }),
      remove: vi.fn().mockResolvedValue(false),
      clearSite: vi.fn().mockResolvedValue(true),
    });
    await renderPanel();
    await openSection('Cookies');

    expect(screen.getByText('No cookies for https://openheaders.io.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add cookie' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear cookies' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add item' })).toBeNull();
  });

  it('hides Add cookie on a jar the host cannot write', async () => {
    setCookieJarFetcher(() => Promise.resolve([]));
    await renderPanel();
    await openSection('Cookies');

    expect(screen.getByText('No cookies for https://openheaders.io.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add cookie' })).toBeNull();
  });

  it.each(['IndexedDB', 'Cache Storage', 'Usage'])('has no add button on %s', async (section) => {
    await renderPanel();
    await openSection(section);

    expect(screen.queryByRole('button', { name: /^Add / })).toBeNull();
  });
});
