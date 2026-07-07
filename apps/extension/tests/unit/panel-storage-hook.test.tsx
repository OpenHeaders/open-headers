// @vitest-environment jsdom
/**
 * useStorageInspector poll-loop stability. Every scope re-list returns a
 * FRESH array from the RPC; the hook must compare it structurally and
 * keep the previous state object when nothing changed. Regression guard
 * for the live bug where each re-list minted new scope identities, which
 * minted a new read callback, which re-fired the grid-reset and
 * poll-restart effects — an infinite "entries ↔ Loading…" flash with the
 * poll interval never reaching its scope tick.
 */

import type { HostNavigation } from '@openheaders/core/navigation';
import { setHostNavigation } from '@openheaders/core/navigation';
import {
  __resetCookieJarCacheForTests,
  __seedCookieJarForTests,
  getJarCookiesForUrl,
} from '@openheaders/ui/panel/data/cookies/cookie-jar-cache';
import { type StorageSection, useStorageInspector } from '@openheaders/ui/panel/data/storage/use-storage-inspector';
import type { StorageInspectorHost } from '@openheaders/ui/panel/host-storage-inspector';
import { setStorageInspectorHost } from '@openheaders/ui/panel/host-storage-inspector';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

function installHost() {
  // Fresh array + fresh scope objects on every call — exactly what the
  // wire produces; the hook owns deduplication.
  const listScopes = vi.fn(() => Promise.resolve([{ ...SCOPE }]));
  const readDomStorage = vi.fn(() =>
    Promise.resolve({ entries: [{ key: 'theme', value: 'dark', valueLength: 4 }], truncated: false }),
  );
  const host: StorageInspectorHost = {
    listScopes,
    readDomStorage,
    readDomStorageValue: vi.fn(() => Promise.resolve(null)),
    writeDomStorage: vi.fn(() => Promise.resolve(true)),
    removeDomStorage: vi.fn(() => Promise.resolve(true)),
    clearDomStorage: vi.fn(() => Promise.resolve(true)),
  };
  setStorageInspectorHost(host);
  return { listScopes, readDomStorage };
}

async function flush(ms = 1): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  setHostNavigation(NAV);
  __resetCookieJarCacheForTests();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  __resetCookieJarCacheForTests();
});

describe('useStorageInspector poll stability', () => {
  it('settles after mount instead of re-listing scopes in a loop', async () => {
    const { listScopes } = installHost();
    const { result } = renderHook(() => useStorageInspector('local'));

    await flush();
    await flush();
    expect(result.current.snapshot).not.toBeNull();
    expect(result.current.loading).toBe(false);

    // Let effect/microtask cycles play out well past mount — an identity
    // loop re-lists on every cycle; a settled hook re-lists exactly once
    // more (the poll restarts when the first selection lands) and then
    // waits for the interval.
    await flush(500);
    expect(listScopes).toHaveBeenCalledTimes(2);
  });

  it('keeps the snapshot rendered across an unchanged scope re-list', async () => {
    const { listScopes, readDomStorage } = installHost();
    const { result } = renderHook(() => useStorageInspector('local'));

    await flush();
    await flush();
    const readsBefore = readDomStorage.mock.calls.length;

    // Five entry ticks = one scope re-list tick (2s × 5), on top of the
    // two settled mount calls.
    await flush(10_000);

    expect(listScopes).toHaveBeenCalledTimes(3);
    // One read per tick — not the storm the reset loop produced.
    expect(readDomStorage.mock.calls.length).toBe(readsBefore + 5);
    expect(result.current.loading).toBe(false);
    expect(result.current.snapshot?.entries).toEqual([{ key: 'theme', value: 'dark', valueLength: 4 }]);
  });
});

describe('useStorageInspector cookies section', () => {
  const COOKIE = {
    name: 'sid',
    value: 'abc',
    domain: 'openheaders.io',
    path: '/',
    hostOnly: true,
    httpOnly: false,
    secure: true,
    session: true,
  };

  it('parks the DOM plane — no entry reads while cookies is the active section', async () => {
    const { listScopes, readDomStorage } = installHost();
    renderHook(() => useStorageInspector('cookies'));

    await flush();
    await flush();
    await flush(10_000);

    expect(listScopes).toHaveBeenCalled();
    expect(readDomStorage).not.toHaveBeenCalled();
  });

  it('invalidates the jar cache for the selected scope URL on each poll tick', async () => {
    installHost();
    renderHook(() => useStorageInspector('cookies'));

    await flush();
    await flush();
    __seedCookieJarForTests(SCOPE.url, [COOKIE]);
    expect(getJarCookiesForUrl(SCOPE.url)).toEqual([COOKIE]);

    // One entry tick — the cookies section's tick clears the jar entry so
    // the next lookup refetches (invalidation, not a data push).
    await flush(2000);
    expect(getJarCookiesForUrl(SCOPE.url)).toBeNull();
  });

  it('does not blank or storm when switching between DOM and cookies sections', async () => {
    const { readDomStorage } = installHost();
    const { result, rerender } = renderHook(
      ({ section }: { section: StorageSection }) => useStorageInspector(section),
      {
        initialProps: { section: 'local' as StorageSection },
      },
    );

    await flush();
    await flush();
    expect(result.current.snapshot).not.toBeNull();
    const readsBefore = readDomStorage.mock.calls.length;

    rerender({ section: 'cookies' });
    await flush(4000);
    expect(readDomStorage.mock.calls.length).toBe(readsBefore);

    rerender({ section: 'local' });
    await flush();
    await flush();
    expect(result.current.snapshot?.entries).toEqual([{ key: 'theme', value: 'dark', valueLength: 4 }]);
    expect(result.current.loading).toBe(false);
  });
});
