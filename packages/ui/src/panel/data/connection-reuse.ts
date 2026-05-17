/**
 * Connection-reuse detection.
 *
 * HAR exposes a `connection` field — Chrome populates it with a unique
 * id per TCP/QUIC connection. When two requests share that id, the
 * second one rode on the same connection as the first (HTTP/1.1
 * keep-alive, HTTP/2/3 multiplexing). Surfacing this in the Timing tab
 * explains why `connect` / `ssl` are 0 on later requests and helps the
 * user reason about connection-pool behavior.
 */

import type { InspectorRequest } from './types';

export interface ConnectionReuseInfo {
  reused: boolean;
  /** Connection id from HAR. Absent when the host didn't supply one. */
  connectionId: string | null;
  /** The earliest entry on this connection — what the connection was opened for. */
  openedBy: { url: string; timestamp: number } | null;
}

/**
 * Returns reuse info for the selected entry. `reused === false` when
 * this entry opened the connection itself (it's either the first on its
 * connection id, or no other entry shares its id). `openedBy` points to
 * the earliest entry sharing the connection — useful in the UI as
 * "reused from <opener URL>".
 */
export function computeConnectionReuse(
  selected: InspectorRequest,
  allEntries: readonly InspectorRequest[],
): ConnectionReuseInfo {
  const connectionId = selected.harEntry.connection ?? null;
  if (!connectionId) {
    return { reused: false, connectionId: null, openedBy: null };
  }

  let opener: InspectorRequest | null = null;
  for (const e of allEntries) {
    if (e.harEntry.connection !== connectionId) continue;
    if (opener == null || e.timestamp < opener.timestamp) opener = e;
  }
  if (!opener || opener.id === selected.id) {
    return { reused: false, connectionId, openedBy: null };
  }
  return {
    reused: true,
    connectionId,
    openedBy: { url: opener.url, timestamp: opener.timestamp },
  };
}
