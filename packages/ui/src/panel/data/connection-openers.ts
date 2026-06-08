/**
 * Connection-opener index — maps a physical connection id to the request that
 * opened it (the one that paid DNS / TCP / TLS). A later request on the same
 * socket reuses it and shows no setup phases; this index lets the Waterfall
 * popover attribute that reuse to its opener ("opened by <name>").
 *
 * Best-effort by nature: the opener may be absent from the capture (the socket
 * was warmed before recording, or HTTP/2-coalesced from another host), or a row
 * may carry no connection id (cache hits / id `0`). Those reused rows simply
 * show the reuse note without attribution.
 *
 * Pure, no IO; built over the full row set so the opener resolves even when it
 * is scrolled out or filtered from view.
 */

import { currentHarEntry, type InspectorRowWithFires } from './inspector-row-projection';

export interface ConnectionOpener {
  /** Discovery-order id (the Request # column) of the opening request. */
  readonly displayId: number;
  /** The opener's URL — the consumer formats its display name. */
  readonly url: string;
}

/** A HAR entry whose timings show a real connection setup (DNS / TCP / TLS) —
 *  i.e. this request opened the socket rather than riding an open one. */
function paidConnectionSetup(row: InspectorRowWithFires): boolean {
  const t = currentHarEntry(row.lifecycle)?.timings;
  if (!t) return false;
  return (t.dns ?? -1) > 0 || (t.connect ?? -1) > 0 || (t.ssl ?? -1) > 0;
}

/**
 * Index every physical connection to the earliest request that opened it.
 * Keyed by HAR `_connectionId`; skips rows with no connection id (`0` / cache)
 * and rows that reused a socket (no setup phases).
 */
export function buildConnectionOpenerIndex(
  rows: readonly InspectorRowWithFires[],
): ReadonlyMap<string, ConnectionOpener> {
  const byConn = new Map<string, ConnectionOpener>();
  for (const row of rows) {
    const connId = currentHarEntry(row.lifecycle)?._connectionId;
    if (!connId || connId === '0') continue;
    if (!paidConnectionSetup(row)) continue;
    const existing = byConn.get(connId);
    if (existing === undefined || row.displayId < existing.displayId) {
      byConn.set(connId, { displayId: row.displayId, url: row.lifecycle.url });
    }
  }
  return byConn;
}

/**
 * The opener of a row's connection, or `undefined` when the row IS the opener,
 * carries no connection id, or its opener is not in the capture.
 */
export function connectionOpenerFor(
  row: InspectorRowWithFires,
  index: ReadonlyMap<string, ConnectionOpener>,
): ConnectionOpener | undefined {
  const connId = currentHarEntry(row.lifecycle)?._connectionId;
  if (!connId) return undefined;
  const opener = index.get(connId);
  if (opener === undefined || opener.displayId === row.displayId) return undefined;
  return opener;
}
