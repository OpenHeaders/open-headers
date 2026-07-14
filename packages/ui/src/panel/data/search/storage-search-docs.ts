/**
 * Storage → SearchDoc enumeration.
 *
 * Search's Storage source covers what the Storage tool window can
 * enumerate for the inspected tab's MAIN frame: DOM storage entries
 * (both areas), the site cookie jar, IndexedDB record previews (first
 * page per store), and Cache Storage entry lists. Each section becomes
 * one flat doc — one entry per line — so a match's line number is the
 * entry's position, and the target's parallel `rowKeys` array gives the
 * matched entry's addressable identity so a click can open THAT row's
 * document, not just reveal the section.
 *
 * Values ride the same preview caps the Storage grids use (clipped DOM
 * values, host-side record previews, request-metadata-only cache
 * entries) — search v1 deliberately opens no new data planes.
 *
 * Version tokens are the docs' own text: the jar/DOM/IDB reads mint
 * fresh objects per RPC, so reference identity can't dedupe them, but
 * equal text `Object.is`-compares true and skips the worker re-ship.
 */

import { hostNavigation } from '@openheaders/core/navigation';
import { fetchSiteJarCookiesOnce, jarCookieRowKey } from '../cookies/cookie-jar-cache';
import type { DomStorageArea } from '../storage/storage-inspector-host';
import { getStorageInspectorHost } from '../storage/storage-inspector-host';
import type { SearchDoc, SearchDocInput, StorageSearchReveal } from './search-doc';

/** First-page caps per container — matches the grids' preview reads. */
const IDB_RECORDS_PAGE = 50;
const CACHE_ENTRIES_PAGE = 100;

/** One enumerated row: its searchable line + its addressable identity
 *  (see `SearchTarget`'s `rowKeys` contract for the per-kind format). */
interface StorageDocLine {
  line: string;
  rowKey: string;
}

function storageDoc(
  docId: string,
  filename: string,
  origin: string,
  reveal: StorageSearchReveal,
  sectionName: string,
  lines: ReadonlyArray<StorageDocLine>,
): SearchDocInput {
  const text = lines.map((l) => l.line).join('\n');
  const doc: SearchDoc = {
    docId,
    source: 'storage',
    target: { kind: 'storage', reveal, rowKeys: lines.map((l) => l.rowKey) },
    displayId: null,
    filename,
    origin,
    timestamp: 0,
    sections: [{ name: sectionName, text }],
  };
  return { docId, source: 'storage', version: text, build: () => doc };
}

const DOM_AREA_LABEL: Record<DomStorageArea, string> = {
  local: 'Local storage',
  session: 'Session storage',
};

/**
 * Enumerate the storage docs for the inspected tab's main frame.
 * Resolves `[]` when the host seam or the tab is unavailable —
 * search degrades to the other sources, never throws.
 */
export async function enumerateStorageDocs(): Promise<SearchDocInput[]> {
  const host = getStorageInspectorHost();
  const tabId = hostNavigation.inspectedTabId();
  if (!host || tabId == null) return [];

  const scopes = await host.listScopes(tabId);
  const scope = scopes?.find((s) => s.isMainFrame) ?? scopes?.[0];
  if (!scope) return [];
  const { frameId, origin, url } = scope;

  const docs: SearchDocInput[] = [];

  const [local, session, cookies, databases, caches] = await Promise.all([
    host.readDomStorage(tabId, frameId, 'local'),
    host.readDomStorage(tabId, frameId, 'session'),
    fetchSiteJarCookiesOnce(url),
    host.listIndexedDb(tabId, frameId),
    host.listCaches(tabId, frameId),
  ]);

  for (const area of ['local', 'session'] as const) {
    const snapshot = area === 'local' ? local : session;
    if (!snapshot || snapshot.entries.length === 0) continue;
    docs.push(
      storageDoc(
        `st:dom:${area}`,
        DOM_AREA_LABEL[area],
        origin,
        { kind: 'dom', area },
        'Entries',
        snapshot.entries.map((e) => ({ line: `${e.key}: ${e.value}`, rowKey: e.key })),
      ),
    );
  }

  if (cookies && cookies.length > 0) {
    docs.push(
      storageDoc(
        'st:cookies',
        'Cookies',
        origin,
        { kind: 'cookies' },
        'Cookies',
        cookies.map((c) => ({ line: `${c.name}=${c.value} ${c.domain}${c.path}`, rowKey: jarCookieRowKey(c) })),
      ),
    );
  }

  if (databases && databases.length > 0) {
    const reads: Promise<void>[] = [];
    for (const db of databases) {
      for (const store of db.objectStores) {
        reads.push(
          host.readIndexedDbRecords(tabId, frameId, db.name, store.name, 0, IDB_RECORDS_PAGE).then((page) => {
            if (!page || page.records.length === 0) return;
            docs.push(
              storageDoc(
                `st:idb:${db.name}/${store.name}`,
                `${db.name} › ${store.name}`,
                origin,
                { kind: 'idb', database: db.name, store: store.name },
                'Records',
                page.records.map((r) => ({
                  line: `${r.primaryKeyPreview}: ${r.valuePreview}`,
                  rowKey: r.primaryKeyWire ?? '',
                })),
              ),
            );
          }),
        );
      }
    }
    await Promise.all(reads);
  }

  if (caches && caches.length > 0) {
    await Promise.all(
      caches.map((cache) =>
        host.readCacheEntries(tabId, frameId, cache.name, 0, CACHE_ENTRIES_PAGE).then((page) => {
          if (!page || page.entries.length === 0) return;
          docs.push(
            storageDoc(
              `st:cache:${cache.name}`,
              cache.name,
              origin,
              { kind: 'cache', cache: cache.name },
              'Entries',
              page.entries.map((e) => ({
                line: `${e.method} ${e.url}${e.headersPreview ? ` ${e.headersPreview}` : ''}`,
                rowKey: `${e.method} ${e.url}`,
              })),
            ),
          );
        }),
      ),
    );
  }

  return docs;
}
