/**
 * Per-port acceptance: parse the `oh-page:<tabId>` port name, attach
 * to the hub under the parsed tabId, detach on disconnect. Idempotent
 * on detach (the attachment handle guards re-entry).
 */

import { parsePagePortName } from '@openheaders/core/page-stream';
import type { PageStreamHub } from '@openheaders/oracle/page-stream-hub';
import { isExtensionOriginPort } from '../port-origin-gate';
import { createPortSink } from './port-sink';

export function acceptPagePort(hub: PageStreamHub, port: chrome.runtime.Port): boolean {
  const tabId = parsePagePortName(port.name);
  if (tabId === null) return false;
  if (!isExtensionOriginPort(port, 'PagePortHost')) return false;
  const sink = createPortSink(port);
  const handle = hub.attach(tabId, sink);
  port.onDisconnect.addListener(() => {
    handle.detach();
  });
  return true;
}
