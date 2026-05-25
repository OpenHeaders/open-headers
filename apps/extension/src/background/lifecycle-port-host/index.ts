/**
 * Lifecycle port host — chrome adapter for `RequestLifecycleHub`.
 *
 * Wires `chrome.runtime.onConnect` so panel / popup / future surfaces
 * can open `oh-lifecycle:<tabId>` and receive `LifecycleWireMessage`
 * envelopes (a `ready` then the tab's lifecycle replay + live updates).
 *
 * Coexists with the legacy `setupDevtoolsInspectorPorts` pipe; the two
 * use different port-name prefixes and own different state. W-b retires
 * the legacy pipe after consumers migrate (P1-P6) and the legacy
 * webRequest listeners go away (RM-b).
 */

import { logger } from '@utils/logger';
import type { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import { acceptLifecyclePort } from './accept-port';

export { LIFECYCLE_PORT_PREFIX, lifecyclePortName, parseLifecyclePortName } from './port-name';

export interface LifecyclePortHost {
  /** Detach the onConnect listener. Tests / SW shutdown only. */
  dispose(): void;
}

export interface LifecyclePortHostOptions {
  readonly hub: RequestLifecycleHub;
}

export function startLifecyclePortHost(options: LifecyclePortHostOptions): LifecyclePortHost {
  const { hub } = options;
  if (!chrome?.runtime?.onConnect?.addListener) {
    logger.info('LifecyclePortHost', 'runtime.onConnect unavailable — lifecycle ports disabled');
    return { dispose: () => {} };
  }
  const listener = (port: chrome.runtime.Port): void => {
    acceptLifecyclePort(hub, port);
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
