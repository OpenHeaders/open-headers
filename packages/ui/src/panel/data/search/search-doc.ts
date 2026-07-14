/**
 * Searchable-document model — the unit the search engine scans.
 *
 * Search covers more than network rows (Storage sections, Console
 * messages), and the scan runs in a Worker. Projecting every source to
 * a flat `SearchDoc` (id + label + plain-text sections) on the main
 * thread keeps the worker free of row/HAR knowledge AND keeps the wire
 * payload minimal: a doc is strings all the way down, so syncing one is
 * a cheap structured clone, and unchanged docs never re-ship (see
 * `SearchClient`'s version-diffed sync).
 *
 * `target` is the click routing payload: which thing to open when the
 * user activates a match from this document.
 */

import type { DomStorageArea } from '../storage/storage-inspector-host';

export type SearchSourceKind = 'network' | 'storage' | 'console';

export const ALL_SEARCH_SOURCES: ReadonlyArray<SearchSourceKind> = ['network', 'storage', 'console'];

/** Storage-section jump a storage match resolves to — mirrors the
 *  Storage panel's reveal vocabulary. */
export type StorageSearchReveal =
  | { kind: 'dom'; area: DomStorageArea }
  | { kind: 'cookies' }
  | { kind: 'idb'; database: string; store: string }
  | { kind: 'cache'; cache: string };

export type SearchTarget =
  | { kind: 'request'; requestId: string }
  | {
      kind: 'storage';
      reveal: StorageSearchReveal;
      /**
       * Row identity per doc line (`rowKeys[i]` addresses line `i + 1`),
       * interpreted by the reveal kind: the entry key (`dom`), the
       * site-jar cookie row key (`cookies`), the record's lossless wire
       * key (`idb`), or `method + ' ' + url` (`cache`). An empty string
       * marks a row that can't be addressed (e.g. a record without a
       * wire key) — the click falls back to the section reveal.
       */
      rowKeys: ReadonlyArray<string>;
    }
  | { kind: 'console' };

/**
 * Canonical section names of a network document.
 */
export const SECTION = {
  General: 'General',
  RequestHeaders: 'Request Headers',
  ResponseHeaders: 'Response Headers',
  QueryParams: 'Query Params',
  RequestBody: 'Request Body',
  Response: 'Response',
} as const;

export type SectionName = (typeof SECTION)[keyof typeof SECTION];

/**
 * Sections whose matches reference document coordinates the user can
 * navigate to (line + column inside a multi-line body). Headers, URL,
 * query params render as tables where only line has meaning.
 */
const LINE_COLUMN_SECTIONS: ReadonlySet<string> = new Set<string>([SECTION.RequestBody, SECTION.Response]);

/** True when `L:C` coordinates make sense for the given section. */
export function sectionHasLineColumn(section: string): boolean {
  return LINE_COLUMN_SECTIONS.has(section);
}

export interface SearchDocSection {
  name: string;
  text: string;
}

export interface SearchDoc {
  /** Globally unique, source-namespaced (`net:`, `st:`, `console`). */
  docId: string;
  source: SearchSourceKind;
  /** What to open when a match in this document is activated. */
  target: SearchTarget;
  /** Network row number; `null` for non-network documents. */
  displayId: number | null;
  filename: string;
  origin: string;
  /** Wall-clock ms the document's subject started/was captured at. */
  timestamp: number;
  sections: ReadonlyArray<SearchDocSection>;
}

/**
 * One document the client keeps in sync with the worker's cache: the
 * projection (`build`) runs only when `version` differs from what the
 * worker already holds (compared with `Object.is` — an unchanged
 * lifecycle reference or an equal snapshot string means "same doc").
 */
export interface SearchDocInput {
  docId: string;
  source: SearchSourceKind;
  version: unknown;
  build: () => SearchDoc;
}
