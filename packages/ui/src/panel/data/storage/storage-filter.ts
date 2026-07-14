/**
 * Row-match rules for the Storage tool window's filter — one predicate
 * application per storage kind, shared between the section bodies
 * (which rows to render) and the nav rail's match-count badges, so the
 * badge numbers and the visible rows can never drift.
 */

import type { SiteJarCookie } from '../cookies/cookie-jar-cache';
import type { TextPredicate } from '../text-match';
import type { CacheEntry, CacheSummary, DomStorageEntry, IdbDatabase, IdbRecord } from './storage-inspector-host';

export function domEntryMatches(entry: DomStorageEntry, p: TextPredicate): boolean {
  return p.test(entry.key) || p.test(entry.value);
}

export function cookieMatches(cookie: SiteJarCookie, p: TextPredicate): boolean {
  return p.test(cookie.name) || p.test(cookie.value) || p.test(cookie.domain);
}

/** A store row stays visible when its own name or its database's name matches. */
export function idbStoreMatches(
  db: IdbDatabase,
  store: IdbDatabase['objectStores'][number],
  p: TextPredicate,
): boolean {
  return p.test(store.name) || p.test(db.name);
}

export function idbRecordMatches(record: IdbRecord, p: TextPredicate): boolean {
  return p.test(record.keyPreview) || p.test(record.valuePreview);
}

export function cacheMatches(cache: CacheSummary, p: TextPredicate): boolean {
  return p.test(cache.name);
}

export function cacheEntryMatches(entry: CacheEntry, p: TextPredicate): boolean {
  return p.test(entry.url) || p.test(entry.method) || (entry.headersPreview ? p.test(entry.headersPreview) : false);
}

export function countIdbStoreMatches(databases: ReadonlyArray<IdbDatabase>, p: TextPredicate): number {
  let count = 0;
  for (const db of databases) {
    for (const store of db.objectStores) {
      if (idbStoreMatches(db, store, p)) count++;
    }
  }
  return count;
}
