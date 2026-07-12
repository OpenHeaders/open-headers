/**
 * JS-contexts port host — chrome adapter for `JsContextHub`.
 *
 * Wires `chrome.runtime.onConnect` so the panel can open `oh-contexts:<tabId>`
 * and receive `JsContextsWireMessage` envelopes (a `ready` then the tab's
 * live-set replay + updates).
 *
 * Sibling of `startConsoleStreamPortHost`. Engine-side ingestion into the hub
 * is driven by the chrome debugger source's `subscribeContexts` seam + the
 * `TabLifecycleBus`, wired in `lifecycle-pipeline.ts`.
 */

import type { JsContextHub } from '@openheaders/oracle/js-context-hub';
import { logger } from '@utils/logger';

import { acceptJsContextsPort } from './accept-port';

export interface JsContextPortHost {
  /** Detach the onConnect listener. Tests / SW shutdown only. */
  dispose(): void;
}

export interface JsContextPortHostOptions {
  readonly hub: JsContextHub;
}

export function startJsContextPortHost(options: JsContextPortHostOptions): JsContextPortHost {
  const { hub } = options;
  if (!chrome?.runtime?.onConnect?.addListener) {
    logger.info('JsContextPortHost', 'runtime.onConnect unavailable — contexts ports disabled');
    return { dispose: () => {} };
  }
  const listener = (port: chrome.runtime.Port): void => {
    acceptJsContextsPort(hub, port);
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
