/**
 * Chrome runtime port → `RuleFireHub` `Sink` adapter.
 *
 * Wraps a `chrome.runtime.Port` so the host-neutral hub can deliver
 * `RuleFireWireMessage` envelopes without knowing about chrome. Mirrors
 * `lifecycle-port-host/port-sink.ts`.
 *
 * `postMessage` throw on a chrome port means the port is dead. Swallow —
 * the disconnect handler runs next and tears down the attachment.
 */

import type { RuleFireUpdate, RuleFireWireMessage } from '@openheaders/core/rule-fire-stream';
import type { Sink } from '@openheaders/oracle/rule-fire-hub';

export function createPortSink(port: chrome.runtime.Port): Sink {
  const post = (msg: RuleFireWireMessage): void => {
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
    deliverUpdate(update: RuleFireUpdate): void {
      post({ kind: 'fire-update', update });
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
