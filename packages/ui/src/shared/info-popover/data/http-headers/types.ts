/**
 * Per-category HTTP-header documentation entries. Kept separate from
 * `InfoPopoverContent` so adding fields here doesn't ripple to every
 * existing entry — the `getHeaderInfoContent` builder in `./index`
 * does the mapping.
 *
 * Each category file under this directory exports a tuple array
 * `[lowercase-name, HeaderInfoEntry][]` which the index merges into
 * the master `HEADER_INFO` map.
 */

export type HeaderDirection = 'request' | 'response' | 'both';

export type HeaderCategory =
  | 'CORS'
  | 'Caching'
  | 'Security'
  | 'Cookies'
  | 'Content'
  | 'Auth'
  | 'Tracing'
  | 'Client Hints'
  | 'Fetch metadata'
  | 'Routing'
  | 'Connection'
  | 'Privacy'
  | 'Performance'
  | 'Server identification'
  | 'Proxy';

export interface HeaderInfoEntry {
  display: string;
  direction: HeaderDirection;
  category: HeaderCategory;
  summary: string;
  body?: ReadonlyArray<string>;
  directives?: ReadonlyArray<{ key: string; desc: string }>;
  commonValues?: ReadonlyArray<{ value: string; desc: string }>;
}

/** Per-category entries: lowercase name → entry. */
export type HeaderInfoEntries = ReadonlyArray<readonly [string, HeaderInfoEntry]>;

/** Direction the row knows — narrower than `HeaderDirection` because
 *  rows are always either request or response, never `both`. */
export type RowDirection = 'request' | 'response';
