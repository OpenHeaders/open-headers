/**
 * Pure parsing for a serialized storage key (`Storage.getStorageKey`).
 *
 * A first-party key serializes as the origin with a trailing slash
 * (`https://openheaders.com/`). A partitioned key appends caret-delimited
 * components, each `^<digit><value>` — the `0` component carries the
 * top-level site the storage is partitioned under; the others (ancestor
 * chain bit, nonces) are opaque here. The parser is deliberately
 * tolerant: it never recomputes or validates a key, it only splits what
 * the browser reported so the scope bar can render partition evidence.
 */

export interface ParsedStorageKey {
  /** The key's own origin (no trailing slash). */
  origin: string;
  /** The key carries partition components beyond the plain origin. */
  partitioned: boolean;
  /** The `^0` component — the partitioning top-level site — when present. */
  topLevelSite: string | null;
  raw: string;
}

export function parseStorageKey(raw: string): ParsedStorageKey {
  const caret = raw.indexOf('^');
  const originPart = (caret === -1 ? raw : raw.slice(0, caret)).replace(/\/$/, '');
  if (caret === -1) {
    return { origin: originPart, partitioned: false, topLevelSite: null, raw };
  }
  let topLevelSite: string | null = null;
  for (const component of raw.slice(caret + 1).split('^')) {
    if (component.startsWith('0') && component.length > 1) {
      topLevelSite = component.slice(1);
      break;
    }
  }
  return { origin: originPart, partitioned: true, topLevelSite, raw };
}
