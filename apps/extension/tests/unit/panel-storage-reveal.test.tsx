// @vitest-environment jsdom
/**
 * Storage tool window — reveals into the Cookies section. Two gestures
 * land here: an editor tab's "Reveal in Storage" (its document is the
 * active row — the section switches AND that row comes into view) and a
 * header row's "Show in Storage" (the jar rows that header names are
 * highlighted, none opened, the first one brought into view, until the
 * scope bar's chip clears them).
 */

import type { HostNavigation } from '@openheaders/core/navigation';
import { setHostNavigation } from '@openheaders/core/navigation';
import { StoragePanel, type StorageRevealRequest } from '@openheaders/ui/panel/components/storage/StoragePanel';
import { jarCookieToKey } from '@openheaders/ui/panel/data/cookies/cookie-edit';
import {
  __resetCookieJarCacheForTests,
  type JarCookie,
  jarCookieRowKey,
  setCookieJarFetcher,
} from '@openheaders/ui/panel/data/cookies/cookie-jar-cache';
import { cookieTabId } from '@openheaders/ui/panel/data/inspector-tab';
import type { StorageInspectorHost } from '@openheaders/ui/panel/host-storage-inspector';
import { setStorageInspectorHost } from '@openheaders/ui/panel/host-storage-inspector';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const scrolled: Element[] = [];

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
  // jsdom has no layout — record which element a reveal brought into view.
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element): void {
    scrolled.push(this);
  };
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
    readDomStorage: vi.fn(() => Promise.resolve({ entries: [], truncated: false })),
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

function makeCookie(over: Partial<JarCookie> = {}): JarCookie {
  return {
    name: 'session',
    value: 'abc123',
    domain: 'openheaders.io',
    path: '/',
    hostOnly: true,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    session: true,
    ...over,
  };
}

const SESSION = makeCookie();
const THEME = makeCookie({ name: 'theme', value: 'dark' });
const TZ = makeCookie({ name: 'tz', value: 'Europe%2FMadrid' });

async function flush(ms = 20): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const onOpenCookie = vi.fn();

/** The panel shell's half of the seam: a reveal is handed down once and
 *  dropped as soon as the panel reports it consumed. */
function RevealHarness({ initial, activeTabId }: { initial: StorageRevealRequest; activeTabId?: string }) {
  const [reveal, setReveal] = useState<StorageRevealRequest | null>(initial);
  return (
    <StoragePanel
      onHide={vi.fn()}
      onOpenIdbRecord={vi.fn()}
      onOpenDomEntry={vi.fn()}
      onOpenCookie={onOpenCookie}
      onOpenCacheEntry={vi.fn()}
      reveal={reveal}
      onRevealConsumed={() => setReveal(null)}
      activeStorageTabId={activeTabId ?? null}
    />
  );
}

async function renderReveal(initial: StorageRevealRequest, activeTabId?: string): Promise<void> {
  render(<RevealHarness initial={initial} activeTabId={activeTabId} />);
  for (let i = 0; i < 6; i++) await flush();
}

function rowOf(name: string): HTMLElement {
  return screen.getByText(name).closest('.dt-storage-row') as HTMLElement;
}

beforeEach(() => {
  vi.useFakeTimers();
  setHostNavigation(NAV);
  __resetCookieJarCacheForTests();
  installHost();
  setCookieJarFetcher(() => Promise.resolve([SESSION, THEME, TZ]));
  scrolled.length = 0;
  onOpenCookie.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  __resetCookieJarCacheForTests();
});

describe('an editor tab reveals its cookie', () => {
  it('switches to Cookies and brings the tab’s own row into view', async () => {
    await renderReveal({ kind: 'cookies' }, cookieTabId(jarCookieToKey(THEME)));

    const row = rowOf('theme');
    expect(row.className).toContain('dt-storage-row--active');
    expect(scrolled).toEqual([row]);
  });

  it('scrolls nowhere when no row is the active document', async () => {
    await renderReveal({ kind: 'cookies' });

    expect(screen.getByText('theme')).toBeTruthy();
    expect(scrolled).toEqual([]);
  });
});

describe('a header row shows its cookies', () => {
  const highlight = { rows: [jarCookieRowKey(THEME), jarCookieRowKey(TZ)], origin: SCOPE.origin };

  it('marks the named rows, opens none, and brings the first into view', async () => {
    await renderReveal({ kind: 'cookies', highlight });

    expect(rowOf('theme').className).toContain('dt-storage-row--highlighted');
    expect(rowOf('tz').className).toContain('dt-storage-row--highlighted');
    expect(rowOf('session').className).not.toContain('dt-storage-row--highlighted');
    expect(rowOf('theme').getAttribute('aria-selected')).toBe('false');
    expect(onOpenCookie).not.toHaveBeenCalled();
    expect(scrolled).toEqual([rowOf('theme')]);
  });

  it('counts them in the scope bar, and the chip clears the highlight', async () => {
    await renderReveal({ kind: 'cookies', highlight });

    fireEvent.click(screen.getByRole('button', { name: /Highlighted: 2/ }));

    expect(rowOf('theme').className).not.toContain('dt-storage-row--highlighted');
    expect(screen.queryByRole('button', { name: /Highlighted/ })).toBeNull();
  });

  it('counts only the rows this scope holds', async () => {
    const elsewhere = jarCookieRowKey(makeCookie({ name: 'other', domain: 'docs.openheaders.io' }));
    await renderReveal({ kind: 'cookies', highlight: { rows: [jarCookieRowKey(THEME), elsewhere], origin: '' } });

    expect(screen.getByRole('button', { name: /Highlighted: 1/ })).toBeTruthy();
  });
});
