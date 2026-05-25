/**
 * Chrome runtime port → `PageStreamHub` `Sink` adapter.
 *
 * Wraps a `chrome.runtime.Port` so the host-neutral hub can deliver
 * `PageWireMessage` envelopes without knowing about chrome. Mirrors
 * `lifecycle-port-host/port-sink.ts`.
 */

import type { PageStreamUpdate, PageWireMessage } from '@openheaders/core/page-stream';
import type { Sink } from '@openheaders/oracle/page-stream-hub';

export function createPortSink(port: chrome.runtime.Port): Sink {
  const post = (msg: PageWireMessage): void => {
    try {
      port.postMessage(msg);
    } catch {
      /* port disconnected — onDisconnect will clean up */
    }
  };
  return {
    deliverReady(tabId: number): void {
      post({ kind: 'ready', tabId });
    },
    deliverUpdate(update: PageStreamUpdate): void {
      post({ kind: 'page-update', update });
    },
    close(): void {
      try {
        port.disconnect();
      } catch {
        /* already gone */
      }
    },
  };
}
