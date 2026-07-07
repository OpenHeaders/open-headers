import { beforeEach, describe, expect, it, type vi } from 'vitest';
import { listStorageScopes } from '@/background/modules/storage-inspector/scopes';
import {
  DOM_STORAGE_MAX_ENTRIES,
  DOM_STORAGE_VALUE_PREVIEW_MAX,
  getDomStorageEntries,
  readDomStorageInPage,
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
