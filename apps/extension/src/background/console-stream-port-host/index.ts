/**
 * Console-stream port host — chrome adapter for `ConsoleStreamHub`.
 *
 * Wires `chrome.runtime.onConnect` so the panel / future surfaces can open
 * `oh-console:<tabId>` and receive `ConsoleStreamWireMessage` envelopes (a
 * `ready` then the tab's console replay + live entry updates).
 *
 * Sibling of `startRuleFirePortHost` / `startPagePortHost`. Engine-side console
 * capture into the hub (`recordEntry`, `forgetTab`) is driven by the chrome
 * debugger source's `subscribeConsole` seam + the `TabLifecycleBus`, wired in
 * `lifecycle-pipeline.ts`.
 */

import type { ConsoleStreamHub } from '@openheaders/oracle/console-stream-hub';
import { logger } from '@utils/logger';

import { acceptConsoleStreamPort } from './accept-port';

export interface ConsoleStreamPortHost {
  /** Detach the onConnect listener. Tests / SW shutdown only. */
  dispose(): void;
}

export interface ConsoleStreamPortHostOptions {
  readonly hub: ConsoleStreamHub;
}

export function startConsoleStreamPortHost(options: ConsoleStreamPortHostOptions): ConsoleStreamPortHost {
  const { hub } = options;
  if (!chrome?.runtime?.onConnect?.addListener) {
    logger.info('ConsoleStreamPortHost', 'runtime.onConnect unavailable — console ports disabled');
    return { dispose: () => {} };
  }
  const listener = (port: chrome.runtime.Port): void => {
    acceptConsoleStreamPort(hub, port);
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
