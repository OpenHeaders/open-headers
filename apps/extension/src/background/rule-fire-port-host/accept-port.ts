/**
 * Per-port acceptance: parse the port name, attach to the hub under the
 * parsed tabId, detach on disconnect. Idempotent on detach (the
 * attachment handle guards re-entry).
 */

import { parseRuleFirePortName, type RuleFireHub } from '@openheaders/oracle/rule-fire-hub';

import { createPortSink } from './port-sink';

export function acceptRuleFirePort(hub: RuleFireHub, port: chrome.runtime.Port): boolean {
  const tabId = parseRuleFirePortName(port.name);
  if (tabId === null) return false;
  const sink = createPortSink(port);
  const handle = hub.attach(tabId, sink);
  port.onDisconnect.addListener(() => {
    handle.detach();
  });
  return true;
}
