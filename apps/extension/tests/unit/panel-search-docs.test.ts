/**
 * Search source-doc providers — the Console projection and the Storage
 * enumeration that feed the search engine's non-network sources.
 *
 * Console: one doc, one message per line, version token = the doc text
 * (append-only buffer ⇒ equal text skips the worker re-ship).
 * Storage: main-frame scope over the host seam — DOM areas, cookie
 * jar, IndexedDB record previews, Cache Storage entry lists — degrading
 * to [] when the seam or tab is unavailable.
 */

import type { ConsoleEntry } from '@openheaders/core/console-stream';
import { type HostNavigation, setHostNavigation } from '@openheaders/core/navigation';
import {
  __resetCookieJarCacheForTests,
  type SiteJarCookie,
  setSiteCookieJarFetcher,
} from '@openheaders/ui/panel/data/cookies/cookie-jar-cache';
import { consoleDocInputs } from '@openheaders/ui/panel/data/search/console-search-docs';
import { enumerateStorageDocs } from '@openheaders/ui/panel/data/search/storage-search-docs';
import type { StorageInspectorHost } from '@openheaders/ui/panel/data/storage/storage-inspector-host';
import { setStorageInspectorHost } from '@openheaders/ui/panel/data/storage/storage-inspector-host';
import { afterEach, describe, expect, it } from 'vitest';

function consoleEntry(overrides: Partial<ConsoleEntry> = {}): ConsoleEntry {
  return {
    source: 'console-api',
    level: 'log',
    args: [{ type: 'string', text: 'hello world' }],
    timestamp: 1000,
    ...overrides,
  };
}

describe('consoleDocInputs', () => {
  it('returns no docs for an empty buffer', () => {
    expect(consoleDocInputs([])).toEqual([]);
  });

  it('projects one doc with one message per line, level and location included', () => {
    const inputs = consoleDocInputs([
      consoleEntry({ args: [{ type: 'string', text: 'boot ok' }] }),
      consoleEntry({
        level: 'error',
        args: [{ type: 'string', text: 'fetch failed' }],
        url: 'https://openheaders.io/app.js',
        lineNumber: 41,
        timestamp: 2000,
      }),
    ]);
    expect(inputs).toHaveLength(1);
    const doc = inputs[0].build();
    expect(doc.source).toBe('console');
    expect(doc.target).toEqual({ kind: 'console' });
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0].text.split('\n')).toEqual([
      '[log] boot ok',
      '[error] fetch failed @ https://openheaders.io/app.js:42',
    ]);
    expect(doc.timestamp).toBe(2000);
  });

  it('mints Object.is-equal version tokens for identical buffers', () => {
    const entries = [consoleEntry()];
    const a = consoleDocInputs(entries)[0];
    const b = consoleDocInputs([...entries])[0];
    expect(Object.is(a.version, b.version)).toBe(true);
  });
});

function makeStorageHost(): StorageInspectorHost {
  return {
    listScopes: async () => [
      { frameId: 0, origin: 'https://openheaders.io', url: 'https://openheaders.io/', isMainFrame: true },
      { frameId: 7, origin: 'https://ads.openheaders.io', url: 'https://ads.openheaders.io/', isMainFrame: false },
    ],
    readDomStorage: async (_tab, _frame, area) =>
      area === 'local'
        ? { entries: [{ key: 'theme', value: 'dark', valueLength: 4 }], truncated: false }
        : { entries: [], truncated: false },
    readDomStorageValue: async () => null,
    writeDomStorage: async () => false,
    renameDomStorage: async () => ({ ok: false }),
    removeDomStorage: async () => false,
    clearDomStorage: async () => false,
    listIndexedDb: async () => [
      {
        name: 'app-db',
        version: 1,
        objectStores: [{ name: 'sessions', autoIncrement: false, indexNames: [] }],
      },
    ],
    readIndexedDbRecords: async () => ({
      records: [{ keyPreview: '"s1"', primaryKeyPreview: '"s1"', valuePreview: '{token: "abc"}' }],
      truncated: false,
    }),
    readIndexedDbRecordDocument: async () => null,
    writeIndexedDbRecord: async () => ({ ok: false }),
    deleteIndexedDbRecord: async () => false,
    clearIndexedDbStore: async () => false,
    deleteIndexedDbDatabase: async () => false,
    listCaches: async () => [{ name: 'v1-assets' }],
    readCacheEntries: async () => ({
      entries: [{ url: 'https://openheaders.io/logo.svg', method: 'GET' }],
      truncated: false,
    }),
    readCacheEntryDocument: async () => null,
    readQuota: async () => null,
    clearSiteData: async () => false,
    setQuotaOverride: async () => false,
    deleteCache: async () => false,
    deleteCacheEntry: async () => false,
    subscribeStorageInvalidations: () => () => {},
  };
}

function makeNavigation(inspectedTab: number | null): HostNavigation {
  return {
    switchViewMode: async () => ({ opened: false }),
    currentWindowId: async () => undefined,
    activeTabUrl: async () => undefined,
    openUrl: () => {},
    openShortcutSettings: () => {},
    getActiveTab: async () => null,
    observeActiveTabContext: () => () => {},
    inspectedTabId: () => inspectedTab,
    reloadInspectedTab: () => {},
    getInspectedHar: async () => null,
    openResource: () => {},
  };
}

describe('enumerateStorageDocs', () => {
  afterEach(() => {
    setHostNavigation(makeNavigation(null));
    setSiteCookieJarFetcher(null);
    __resetCookieJarCacheForTests();
  });

  it('resolves [] when no tab is inspected', async () => {
    setStorageInspectorHost(makeStorageHost());
    setHostNavigation(makeNavigation(null));
    expect(await enumerateStorageDocs()).toEqual([]);
  });

  it('enumerates main-frame DOM storage, cookies, IndexedDB and Cache Storage docs', async () => {
    setStorageInspectorHost(makeStorageHost());
    setHostNavigation(makeNavigation(12));
    const cookie: SiteJarCookie = {
      name: 'session',
      value: 'abc123',
      domain: 'openheaders.io',
      path: '/',
      hostOnly: true,
      httpOnly: true,
      secure: true,
      session: true,
      sendable: true,
    };
    setSiteCookieJarFetcher(async () => [cookie]);

    const inputs = await enumerateStorageDocs();
    const byId = new Map(inputs.map((i) => [i.docId, i.build()]));

    expect([...byId.keys()].sort()).toEqual([
      'st:cache:v1-assets',
      'st:cookies',
      'st:dom:local',
      'st:idb:app-db/sessions',
    ]);

    expect(byId.get('st:dom:local')?.sections[0].text).toBe('theme: dark');
    expect(byId.get('st:dom:local')?.target).toEqual({ kind: 'storage', reveal: { kind: 'dom', area: 'local' } });

    expect(byId.get('st:cookies')?.sections[0].text).toBe('session=abc123 openheaders.io/');

    expect(byId.get('st:idb:app-db/sessions')?.sections[0].text).toBe('"s1": {token: "abc"}');
    expect(byId.get('st:idb:app-db/sessions')?.target).toEqual({
      kind: 'storage',
      reveal: { kind: 'idb', database: 'app-db', store: 'sessions' },
    });

    expect(byId.get('st:cache:v1-assets')?.sections[0].text).toBe('GET https://openheaders.io/logo.svg');
    expect(byId.get('st:cache:v1-assets')?.target).toEqual({
      kind: 'storage',
      reveal: { kind: 'cache', cache: 'v1-assets' },
    });

    // Empty session storage yielded no doc; every doc is a storage doc.
    expect(inputs.every((i) => i.source === 'storage')).toBe(true);
  });
});
