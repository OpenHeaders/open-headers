/**
 * Per-port acceptance: parse the port name, attach to the hub under the
 * parsed tabId, detach on disconnect. Idempotent on detach (the attachment
 * handle guards re-entry). Mirror of `rule-fire-port-host/accept-port.ts`.
 */

import { parseConsoleStreamPortName } from '@openheaders/core/console-stream';
import type { ConsoleStreamHub } from '@openheaders/oracle/console-stream-hub';

import { isExtensionOriginPort } from '../port-origin-gate';
import { createPortSink } from './port-sink';

export function acceptConsoleStreamPort(hub: ConsoleStreamHub, port: chrome.runtime.Port): boolean {
  const tabId = parseConsoleStreamPortName(port.name);
  if (tabId === null) return false;
  if (!isExtensionOriginPort(port, 'ConsoleStreamPortHost')) return false;
  const sink = createPortSink(port);
  const handle = hub.attach(tabId, sink);
  port.onDisconnect.addListener(() => {
    handle.detach();
  });
  return true;
}
