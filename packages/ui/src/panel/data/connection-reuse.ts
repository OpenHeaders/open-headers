/**
 * Connection-reuse detection.
 *
 * HAR exposes a `connection` field — Chrome populates it with a unique
 * id per TCP/QUIC connection. When two lifecycles share that id, the
 * second one rode on the same connection as the first (HTTP/1.1
 * keep-alive, HTTP/2/3 multiplexing). Surfacing this in the Timing tab
 * explains why `connect` / `ssl` are 0 on later requests and helps the
 * user reason about connection-pool behavior.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { currentHarEntry } from './inspector-row-projection';

export interface ConnectionReuseInfo {
  reused: boolean;
  /** Connection id from HAR. Absent when the host didn't supply one. */
  connectionId: string | null;
  /** The earliest lifecycle on this connection — what it was opened for. */
  openedBy: { url: string; startedAtMs: number } | null;
}

/**
 * Returns reuse info for the selected lifecycle. `reused === false` when
 * this lifecycle opened the connection itself (it's either the first on
 * its connection id, or no other lifecycle shares its id). `openedBy`
 * points to the earliest lifecycle sharing the connection — useful in the
 * UI as "reused from <opener URL>".
 */
export function computeConnectionReuse(
  selected: RequestLifecycle,
  all: readonly RequestLifecycle[],
): ConnectionReuseInfo {
  const connectionId = currentHarEntry(selected)?.connection ?? null;
  if (!connectionId) {
    return { reused: false, connectionId: null, openedBy: null };
  }

  let opener: RequestLifecycle | null = null;
  for (const lc of all) {
    if (currentHarEntry(lc)?.connection !== connectionId) continue;
    if (opener == null || lc.startedAtMs < opener.startedAtMs) opener = lc;
  }
  if (!opener || opener.requestId === selected.requestId) {
    return { reused: false, connectionId, openedBy: null };
  }
  return {
    reused: true,
    connectionId,
    openedBy: { url: opener.url, startedAtMs: opener.startedAtMs },
  };
}
