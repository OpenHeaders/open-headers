/**
 * Chrome runtime port → `JsContextHub` `Sink` adapter.
 *
 * Wraps a `chrome.runtime.Port` so the host-neutral hub can deliver
 * `JsContextsWireMessage` envelopes without knowing about chrome. Mirrors
 * `console-stream-port-host/port-sink.ts`.
 *
 * `postMessage` throw on a chrome port means the port is dead. Swallow — the
 * disconnect handler runs next and tears down the attachment.
 */

import type { JsContextsWireMessage, JsContextUpdate } from '@openheaders/core/js-contexts';
import type { Sink } from '@openheaders/oracle/js-context-hub';

export function createPortSink(port: chrome.runtime.Port): Sink {
  const post = (msg: JsContextsWireMessage): void => {
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
    deliverUpdate(update: JsContextUpdate): void {
      post({ kind: 'contexts-update', update });
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
