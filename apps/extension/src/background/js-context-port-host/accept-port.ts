/**
 * Per-port acceptance: parse the port name, attach to the hub under the
 * parsed tabId, detach on disconnect. Idempotent on detach (the attachment
 * handle guards re-entry). Mirror of `console-stream-port-host/accept-port.ts`.
 */

import { parseJsContextsPortName } from '@openheaders/core/js-contexts';
import type { JsContextHub } from '@openheaders/oracle/js-context-hub';

import { createPortSink } from './port-sink';

export function acceptJsContextsPort(hub: JsContextHub, port: chrome.runtime.Port): boolean {
  const tabId = parseJsContextsPortName(port.name);
  if (tabId === null) return false;
  const sink = createPortSink(port);
  const handle = hub.attach(tabId, sink);
  port.onDisconnect.addListener(() => {
    handle.detach();
  });
  return true;
}
