/**
 * Lifecycle port host — chrome adapter for `RequestLifecycleHub`.
 *
 * Wires `chrome.runtime.onConnect` so panel / popup / future surfaces
 * can open `oh-lifecycle:<tabId>` and receive `LifecycleWireMessage`
 * envelopes (a `ready` then the tab's lifecycle replay + live updates).
 * Acceptance also raises the panel-watching ref on `tab-telemetry` so
 * webrequest ingestion stays live while a panel is connected.
 */

import type { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import { logger } from '@utils/logger';
import { acceptLifecyclePort, type LifecycleBodyFetcher, type LifecycleProvenance } from './accept-port';

export type { LifecycleBodyFetcher, LifecycleProvenance } from './accept-port';

export {
  createPersistentWatchSessionFloors,
  type PersistentWatchSessionFloors,
} from './watch-session-floors-storage';

export interface LifecyclePortHost {
  /** Detach the onConnect listener. Tests / SW shutdown only. */
  dispose(): void;
}

export interface LifecyclePortHostOptions {
  readonly hub: RequestLifecycleHub;
  /** Hydration gate for the watch-session floors; forwarded to each port. */
  readonly ready?: Promise<void>;
  /** Per-tab CDP-vs-heuristic provenance for the "CDP-enhanced" badge. */
  readonly provenance?: LifecycleProvenance;
  /** On-demand response-body fetch for the `request-body` pull message. */
  readonly bodyFetcher?: LifecycleBodyFetcher;
}

export function startLifecyclePortHost(options: LifecyclePortHostOptions): LifecyclePortHost {
  const { hub, ready, provenance, bodyFetcher } = options;
  if (!chrome?.runtime?.onConnect?.addListener) {
    logger.info('LifecyclePortHost', 'runtime.onConnect unavailable — lifecycle ports disabled');
    return { dispose: () => {} };
  }
  const listener = (port: chrome.runtime.Port): void => {
    acceptLifecyclePort(hub, port, { ready, provenance, bodyFetcher });
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
