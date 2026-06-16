/**
 * Chrome runtime port → `ConsoleStreamHub` `Sink` adapter.
 *
 * Wraps a `chrome.runtime.Port` so the host-neutral hub can deliver
 * `ConsoleStreamWireMessage` envelopes without knowing about chrome. Mirrors
 * `rule-fire-port-host/port-sink.ts`.
 *
 * `postMessage` throw on a chrome port means the port is dead. Swallow — the
 * disconnect handler runs next and tears down the attachment.
 */

import type { ConsoleStreamUpdate, ConsoleStreamWireMessage } from '@openheaders/core/console-stream';
import type { Sink } from '@openheaders/oracle/console-stream-hub';

export function createPortSink(port: chrome.runtime.Port): Sink {
  const post = (msg: ConsoleStreamWireMessage): void => {
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
    deliverUpdate(update: ConsoleStreamUpdate): void {
      post({ kind: 'console-update', update });
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
