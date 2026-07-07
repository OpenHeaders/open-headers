import { afterEach, beforeEach, describe, expect, it, type vi } from 'vitest';
import {
  __resetStorageCdpAccessForTests,
  registerStorageCdpAccess,
  type StorageCdpAccess,
} from '@/background/modules/storage-inspector/cdp-tier';
import { listStorageScopes } from '@/background/modules/storage-inspector/scopes';
import {
  clearDomStorage,
  clearDomStorageInPage,
  DOM_STORAGE_FULL_VALUE_MAX,
  DOM_STORAGE_MAX_ENTRIES,
  DOM_STORAGE_VALUE_PREVIEW_MAX,
  getDomStorageEntries,
  getDomStorageValue,
  readDomStorageInPage,
  readDomStorageValueInPage,
  removeDomStorageInPage,
  removeDomStorageItem,
  setDomStorageItem,
  writeDomStorageInPage,
} from '@/background/modules/storage-inspector/standard-plane';

const getAllFramesSpy = (): ReturnType<typeof vi.fn> =>
  chrome.webNavigation.getAllFrames as unknown as ReturnType<typeof vi.fn>;
const executeScriptSpy = (): ReturnType<typeof vi.fn> =>
  chrome.scripting.executeScript as unknown as ReturnType<typeof vi.fn>;

function frame(overrides: Partial<chrome.webNavigation.GetAllFrameResultDetails>) {
  return {
    frameId: 0,
    parentFrameId: -1,
    processId: 1,
    url: 'https://openheaders.io/',
    documentId: 'doc',
    documentLifecycle: 'active',
    errorOccurred: false,
    frameType: 'outermost_frame',
    ...overrides,
  } as chrome.webNavigation.GetAllFrameResultDetails;
}

beforeEach(() => {
  getAllFramesSpy().mockReset();
  executeScriptSpy().mockReset();
});

afterEach(() => {
  __resetStorageCdpAccessForTests();
});

describe('listStorageScopes', () => {
  it('collapses same-origin frames and puts the main frame first', async () => {
    getAllFramesSpy().mockResolvedValue([
      frame({ frameId: 3, url: 'https://cdn.openheaders.io/embed', frameType: 'sub_frame' }),
      frame({ frameId: 0, url: 'https://app.openheaders.io/dashboard' }),
      frame({ frameId: 7, url: 'https://app.openheaders.io/inner', frameType: 'sub_frame' }),
    ]);

    const { scopes } = await listStorageScopes(42);
    expect(scopes).not.toBeNull();
    expect(scopes?.map((s) => s.origin)).toEqual(['https://app.openheaders.io', 'https://cdn.openheaders.io']);
    // Same-origin sub-frame collapsed into the main-frame scope.
    expect(scopes?.[0]).toMatchObject({ frameId: 0, isMainFrame: true });
    expect(scopes?.[1]).toMatchObject({ frameId: 3, isMainFrame: false });
  });

  it('keeps the lowest frameId as the injection target for an iframe-only origin', async () => {
    getAllFramesSpy().mockResolvedValue([
      frame({ frameId: 0, url: 'https://openheaders.io/' }),
      frame({ frameId: 9, url: 'https://embed.openheaders.io/b', frameType: 'sub_frame' }),
      frame({ frameId: 4, url: 'https://embed.openheaders.io/a', frameType: 'sub_frame' }),
    ]);

    const { scopes } = await listStorageScopes(42);
    expect(scopes?.find((s) => s.origin === 'https://embed.openheaders.io')?.frameId).toBe(4);
  });

  it('drops non-http(s), errored, and unparsable frames', async () => {
    getAllFramesSpy().mockResolvedValue([
      frame({ frameId: 0, url: 'https://openheaders.io/' }),
      frame({ frameId: 1, url: 'about:blank', frameType: 'sub_frame' }),
      frame({ frameId: 2, url: 'chrome-extension://abc/page.html', frameType: 'sub_frame' }),
      frame({ frameId: 3, url: 'blob:https://openheaders.io/xyz', frameType: 'sub_frame' }),
      frame({ frameId: 4, url: 'https://dead.openheaders.io/', errorOccurred: true, frameType: 'sub_frame' }),
      frame({ frameId: 5, url: 'not a url', frameType: 'sub_frame' }),
    ]);

    const { scopes } = await listStorageScopes(42);
    expect(scopes?.map((s) => s.origin)).toEqual(['https://openheaders.io']);
  });

  it('returns null when frame enumeration fails', async () => {
    getAllFramesSpy().mockRejectedValue(new Error('no such tab'));
    expect((await listStorageScopes(42)).scopes).toBeNull();
  });
});

describe('readDomStorageInPage (injected reader)', () => {
  function fakeStorage(items: Record<string, string>): Storage {
    const keys = Object.keys(items);
    return {
      length: keys.length,
      key: (i: number) => keys[i] ?? null,
      getItem: (k: string) => items[k] ?? null,
    } as Storage;
  }

  // Manual window stub — `vi.unstubAllGlobals()` would also tear down the
  // `chrome` global the suite setup stubbed for every other test here.
  function withWindowStorage(local: Storage, run: () => void): void {
    const g = globalThis as { window?: unknown };
    const prev = g.window;
    g.window = { localStorage: local, sessionStorage: fakeStorage({}) };
    try {
      run();
    } finally {
      if (prev === undefined) delete g.window;
      else g.window = prev;
    }
  }

  it('reads entries and reports full value lengths without clipping small values', () => {
    withWindowStorage(fakeStorage({ theme: 'dark', token: 'abc' }), () => {
      const res = readDomStorageInPage('local', 100, 100);
      expect(res.truncated).toBe(false);
      expect(res.entries).toEqual([
        { key: 'theme', value: 'dark', valueLength: 4 },
        { key: 'token', value: 'abc', valueLength: 3 },
      ]);
    });
  });

  it('clips oversized values and flags them, keeping the full length', () => {
    withWindowStorage(fakeStorage({ big: 'x'.repeat(50) }), () => {
      const res = readDomStorageInPage('local', 100, 10);
      expect(res.entries[0]).toMatchObject({ key: 'big', value: 'x'.repeat(10), valueLength: 50, clipped: true });
    });
  });

  it('truncates past the entry cap', () => {
    withWindowStorage(fakeStorage({ a: '1', b: '2', c: '3' }), () => {
      const res = readDomStorageInPage('local', 2, 100);
      expect(res.entries).toHaveLength(2);
      expect(res.truncated).toBe(true);
    });
  });
});

describe('storage-key stamping (CDP tier)', () => {
  const FRAMES = [
    frame({ frameId: 0, url: 'https://app.openheaders.io/dashboard' }),
    frame({ frameId: 3, url: 'https://cdn.openheaders.io/embed', frameType: 'sub_frame' }),
  ];
  const TREE = {
    frameTree: {
      frame: { id: 'F-MAIN', url: 'https://app.openheaders.io/dashboard' },
      childFrames: [{ frame: { id: 'F-CDN', url: 'https://cdn.openheaders.io/embed' } }],
    },
  };
  const KEYS: Record<string, string> = {
    'F-MAIN': 'https://app.openheaders.io/',
    'F-CDN': 'https://cdn.openheaders.io/^0https://app.openheaders.io',
  };

  function fakeAccess(overrides: Partial<StorageCdpAccess> = {}): StorageCdpAccess {
    return {
      isAttached: () => true,
      send: (_tabId, method, params) => {
        if (method === 'Page.getFrameTree') return Promise.resolve(TREE);
        if (method === 'Storage.getStorageKey') {
          return Promise.resolve({ storageKey: KEYS[params?.frameId as string] });
        }
        return Promise.reject(new Error(`unexpected ${method}`));
      },
      ...overrides,
    };
  }

  it('stamps each scope with its storage key when the tab is attached', async () => {
    getAllFramesSpy().mockResolvedValue(FRAMES);
    registerStorageCdpAccess(fakeAccess());

    const { scopes } = await listStorageScopes(42);
    expect(scopes?.map((s) => s.storageKey)).toEqual([
      'https://app.openheaders.io/',
      'https://cdn.openheaders.io/^0https://app.openheaders.io',
    ]);
  });

  it('leaves scopes unstamped when the tab is not attached', async () => {
    getAllFramesSpy().mockResolvedValue(FRAMES);
    registerStorageCdpAccess(fakeAccess({ isAttached: () => false }));

    const { scopes } = await listStorageScopes(42);
    expect(scopes?.every((s) => s.storageKey === undefined)).toBe(true);
  });

  it('leaves scopes unstamped when the frame tree is unavailable', async () => {
    getAllFramesSpy().mockResolvedValue(FRAMES);
    registerStorageCdpAccess(fakeAccess({ send: () => Promise.reject(new Error('detached')) }));

    const { scopes } = await listStorageScopes(42);
    expect(scopes).toHaveLength(2);
    expect(scopes?.every((s) => s.storageKey === undefined)).toBe(true);
  });

  it('leaves only the failing scope unstamped on a per-frame command error', async () => {
    getAllFramesSpy().mockResolvedValue(FRAMES);
    registerStorageCdpAccess(
      fakeAccess({
        send: (_tabId, method, params) => {
          if (method === 'Page.getFrameTree') return Promise.resolve(TREE);
          if (params?.frameId === 'F-CDN') return Promise.reject(new Error('frame gone'));
          return Promise.resolve({ storageKey: KEYS[params?.frameId as string] });
        },
      }),
    );

    const { scopes } = await listStorageScopes(42);
    expect(scopes?.find((s) => s.origin === 'https://app.openheaders.io')?.storageKey).toBe(
      'https://app.openheaders.io/',
    );
    expect(scopes?.find((s) => s.origin === 'https://cdn.openheaders.io')?.storageKey).toBeUndefined();
  });

  it('is a no-op without a registered access seam', async () => {
    getAllFramesSpy().mockResolvedValue(FRAMES);
    const { scopes } = await listStorageScopes(42);
    expect(scopes?.every((s) => s.storageKey === undefined)).toBe(true);
  });
});

describe('injected writers', () => {
  function mutableStorage(items: Record<string, string>): Storage {
    return {
      get length() {
        return Object.keys(items).length;
      },
      key: (i: number) => Object.keys(items)[i] ?? null,
      getItem: (k: string) => items[k] ?? null,
      setItem: (k: string, v: string) => {
        items[k] = v;
      },
      removeItem: (k: string) => {
        delete items[k];
      },
      clear: () => {
        for (const k of Object.keys(items)) delete items[k];
      },
    } as Storage;
  }

  function withWindowAreas(local: Storage, session: Storage, run: () => void): void {
    const g = globalThis as { window?: unknown };
    const prev = g.window;
    g.window = { localStorage: local, sessionStorage: session };
    try {
      run();
    } finally {
      if (prev === undefined) delete g.window;
      else g.window = prev;
    }
  }

  it('writeDomStorageInPage sets the entry on the requested area', () => {
    const local: Record<string, string> = {};
    const session: Record<string, string> = {};
    withWindowAreas(mutableStorage(local), mutableStorage(session), () => {
      expect(writeDomStorageInPage('session', 'theme', 'dark')).toEqual({ ok: true });
      expect(session).toEqual({ theme: 'dark' });
      expect(local).toEqual({});
    });
  });

  it('writeDomStorageInPage reports a quota failure as ok: false', () => {
    const throwing = {
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
    } as unknown as Storage;
    withWindowAreas(throwing, mutableStorage({}), () => {
      expect(writeDomStorageInPage('local', 'big', 'x')).toEqual({ ok: false });
    });
  });

  it('removeDomStorageInPage deletes the key; clearDomStorageInPage empties the area', () => {
    const local: Record<string, string> = { a: '1', b: '2' };
    withWindowAreas(mutableStorage(local), mutableStorage({}), () => {
      expect(removeDomStorageInPage('local', 'a')).toEqual({ ok: true });
      expect(local).toEqual({ b: '2' });
      expect(clearDomStorageInPage('local')).toEqual({ ok: true });
      expect(local).toEqual({});
    });
  });

  it('readDomStorageValueInPage returns the full value under the ceiling', () => {
    withWindowAreas(mutableStorage({ big: 'x'.repeat(50) }), mutableStorage({}), () => {
      expect(readDomStorageValueInPage('local', 'big', 100)).toEqual({ value: 'x'.repeat(50) });
    });
  });

  it('readDomStorageValueInPage gates a value past the ceiling with tooLarge', () => {
    withWindowAreas(mutableStorage({ big: 'x'.repeat(50) }), mutableStorage({}), () => {
      expect(readDomStorageValueInPage('local', 'big', 10)).toEqual({ value: null, tooLarge: true });
    });
  });

  it('readDomStorageValueInPage returns null (no tooLarge) for a missing key', () => {
    withWindowAreas(mutableStorage({}), mutableStorage({}), () => {
      expect(readDomStorageValueInPage('local', 'gone', 10)).toEqual({ value: null });
    });
  });
});

describe('write wrappers', () => {
  it('setDomStorageItem targets the frame and forwards key + value', async () => {
    executeScriptSpy().mockResolvedValue([{ result: { ok: true } }]);
    const res = await setDomStorageItem(42, 7, 'session', 'theme', 'dark');
    expect(res).toEqual({ ok: true });
    const call = executeScriptSpy().mock.calls[0][0];
    expect(call.target).toEqual({ tabId: 42, frameIds: [7] });
    expect(call.args).toEqual(['session', 'theme', 'dark']);
  });

  it('setDomStorageItem is ok: false when injection fails or reports failure', async () => {
    executeScriptSpy().mockRejectedValue(new Error('No frame with id 7'));
    expect(await setDomStorageItem(42, 7, 'local', 'k', 'v')).toEqual({ ok: false });

    executeScriptSpy().mockResolvedValue([{ result: { ok: false } }]);
    expect(await setDomStorageItem(42, 0, 'local', 'k', 'v')).toEqual({ ok: false });
  });

  it('removeDomStorageItem and clearDomStorage forward their args', async () => {
    executeScriptSpy().mockResolvedValue([{ result: { ok: true } }]);
    expect(await removeDomStorageItem(42, 3, 'local', 'a')).toEqual({ ok: true });
    expect(executeScriptSpy().mock.calls[0][0].args).toEqual(['local', 'a']);

    executeScriptSpy().mockClear();
    executeScriptSpy().mockResolvedValue([{ result: { ok: true } }]);
    expect(await clearDomStorage(42, 3, 'session')).toEqual({ ok: true });
    expect(executeScriptSpy().mock.calls[0][0].args).toEqual(['session']);
  });

  it('getDomStorageValue forwards the key with the full-value ceiling', async () => {
    executeScriptSpy().mockResolvedValue([{ result: { value: 'v' } }]);
    const res = await getDomStorageValue(42, 0, 'local', 'k');
    expect(res).toEqual({ value: 'v' });
    expect(executeScriptSpy().mock.calls[0][0].args).toEqual(['local', 'k', DOM_STORAGE_FULL_VALUE_MAX]);
  });

  it('getDomStorageValue surfaces tooLarge and injection failure distinctly', async () => {
    executeScriptSpy().mockResolvedValue([{ result: { value: null, tooLarge: true } }]);
    expect(await getDomStorageValue(42, 0, 'local', 'big')).toEqual({ value: null, tooLarge: true });

    executeScriptSpy().mockRejectedValue(new Error('gone'));
    expect(await getDomStorageValue(42, 0, 'local', 'k')).toEqual({ value: null });
  });
});

describe('getDomStorageEntries', () => {
  it('targets the requested frame and forwards the caps', async () => {
    executeScriptSpy().mockResolvedValue([{ result: { entries: [], truncated: false } }]);

    const res = await getDomStorageEntries(42, 7, 'session');
    expect(res.entries).toEqual([]);
    const call = executeScriptSpy().mock.calls[0][0];
    expect(call.target).toEqual({ tabId: 42, frameIds: [7] });
    expect(call.args).toEqual(['session', DOM_STORAGE_MAX_ENTRIES, DOM_STORAGE_VALUE_PREVIEW_MAX]);
  });

  it('coerces an unknown area to local', async () => {
    executeScriptSpy().mockResolvedValue([{ result: { entries: [], truncated: false } }]);
    await getDomStorageEntries(42, 0, 'weird' as never);
    expect(executeScriptSpy().mock.calls[0][0].args[0]).toBe('local');
  });

  it('returns null entries when injection fails or yields no result', async () => {
    executeScriptSpy().mockRejectedValue(new Error('No frame with id 7'));
    expect((await getDomStorageEntries(42, 7, 'local')).entries).toBeNull();

    executeScriptSpy().mockResolvedValue([{ result: null }]);
    expect((await getDomStorageEntries(42, 7, 'local')).entries).toBeNull();
  });

  it('surfaces the truncated flag only when set', async () => {
    executeScriptSpy().mockResolvedValue([
      { result: { entries: [{ key: 'a', value: '1', valueLength: 1 }], truncated: true } },
    ]);
    const res = await getDomStorageEntries(42, 0, 'local');
    expect(res.truncated).toBe(true);
    expect(res.entries).toHaveLength(1);
  });
});
