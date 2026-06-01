/**
 * Chrome runtime port → hub `Sink` adapter.
 *
 * Wraps a `chrome.runtime.Port` so the host-neutral
 * `RequestLifecycleHub` can deliver `LifecycleWireMessage` envelopes
 * without knowing about chrome.
 *
 * `postMessage` failure handling: a throw on a chrome port is, in
 * practice, only raised when the port is dead. We swallow it — the
 * disconnect handler runs next and tears down the attachment.
 */

import type { LifecycleWireMessage, RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { Sink } from '@openheaders/oracle/request-lifecycle-hub';

export function createPortSink(port: chrome.runtime.Port): Sink {
  const post = (msg: LifecycleWireMessage): void => {
    try {
      port.postMessage(msg);
    } catch {
      /* port disconnected — onDisconnect will clean up */
    }
  };
  return {
    deliverReady(tabId: number, watermarkMs: number): void {
      post({ kind: 'ready', tabId, watermarkMs });
    },
    deliverUpdate(update: RequestLifecycleUpdate): void {
      post({ kind: 'lifecycle-update', update });
    },
    deliverTabCleared(tabId: number): void {
      post({ kind: 'tab-cleared', tabId });
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
