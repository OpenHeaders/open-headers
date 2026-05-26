/**
 * Rule-fire port host — chrome adapter for `RuleFireHub`.
 *
 * Wires `chrome.runtime.onConnect` so panel / popup / future surfaces
 * can open `oh-fires:<tabId>` and receive `RuleFireWireMessage`
 * envelopes (a `ready` then the tab's fire replay + live updates).
 *
 * Sibling of `startLifecyclePortHost` / `startPagePortHost`. Engine-side
 * fire notifications into the hub (`notifyHeuristicFire`,
 * `notifyAuthoritativeFire`, `forgetTab`) are driven by the
 * `tab-telemetry-fires-bridge` module.
 */

import { logger } from '@utils/logger';
import type { RuleFireHub } from '@openheaders/oracle/rule-fire-hub';

import { acceptRuleFirePort } from './accept-port';

export {
  RULE_FIRE_PORT_PREFIX,
  parseRuleFirePortName,
  ruleFirePortName,
} from '@openheaders/oracle/rule-fire-hub';

export interface RuleFirePortHost {
  /** Detach the onConnect listener. Tests / SW shutdown only. */
  dispose(): void;
}

export interface RuleFirePortHostOptions {
  readonly hub: RuleFireHub;
}

export function startRuleFirePortHost(options: RuleFirePortHostOptions): RuleFirePortHost {
  const { hub } = options;
  if (!chrome?.runtime?.onConnect?.addListener) {
    logger.info('RuleFirePortHost', 'runtime.onConnect unavailable — rule-fire ports disabled');
    return { dispose: () => {} };
  }
  const listener = (port: chrome.runtime.Port): void => {
    acceptRuleFirePort(hub, port);
  };
  chrome.runtime.onConnect.addListener(listener);
  return {
    dispose: () => {
      try {
        chrome.runtime.onConnect.removeListener(listener);
      } catch {
        /* already gone — SW shutdown */
      }
    },
  };
}
