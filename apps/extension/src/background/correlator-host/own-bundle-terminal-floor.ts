/**
 * Own-bundle terminal floor — page-channel twin of the floor inside
 * `extension-traffic-lifecycles`.
 *
 * A load of the extension's own packaged asset never crosses the network
 * stack, so Chromium's webRequest delivers `onBeforeRequest`/`onSendHeaders`
 * and then goes silent — no headers-received, no completion, no error. On an
 * extension-origin page (workbench, panel rig) such loads DO carry the real
 * tabId (a dedicated worker's main script is the live case: Monaco's editor
 * and html workers), so they ride the ordinary tab-bound channel into the
 * heuristic correlator and would sit "(pending)" forever. The devtools HAR
 * join cannot rescue them — worker requests are invisible to
 * `chrome.devtools.network`.
 *
 * The browser's own panel resolves these as a status-less "Finished"; mirror
 * it by synthesizing the terminal at the send, status-less so the cell reads
 * the same. Page-issued bundle assets that the HAR join DOES see refine in
 * place afterwards (completed → completed with a status is a legal same-rank
 * patch), so flooring them too is convergent, not lossy.
 *
 * Scoped to the extension's OWN origin prefix: http(s) worker scripts cross
 * the wire and complete on their own, and other extensions' resources are
 * not this plane's business.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { WebRequestEvent } from '@openheaders/oracle/correlator-heuristic';
import { runtime } from '@utils/browser-api.js';

export interface OwnBundleTerminalFloorOptions {
  /** The webRequest adapter's tab-bound channel (the lifecycle pipeline's main feed). */
  readonly subscribe: (listener: (event: WebRequestEvent) => void) => () => void;
  /** Intake of the one `RequestLifecycleStore` every correlator feeds. */
  readonly apply: (update: RequestLifecycleUpdate) => void;
}

export interface OwnBundleTerminalFloor {
  /** Detach the channel listener. Tests / SW shutdown only. */
  dispose(): void;
}

export function startOwnBundleTerminalFloor(options: OwnBundleTerminalFloorOptions): OwnBundleTerminalFloor {
  const ownUrlPrefix = runtime.getURL('');
  const unsubscribe = options.subscribe((event) => {
    if (event.method_kind !== 'onSendHeaders') return;
    if (!event.url.startsWith(ownUrlPrefix)) return;
    options.apply({
      kind: 'phase',
      tabId: event.tabId,
      requestId: event.requestId,
      patch: { phase: 'completed', completedAtMs: event.timeStamp },
    });
  });
  return { dispose: unsubscribe };
}
