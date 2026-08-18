/**
 * `devtools-port-presence` — translates raw `devtools-har-source:<tabId>`
 * port connect/disconnect into "this tab has a live DevTools window /
 * lost it", the first input of {@link CdpAttachController}.
 *
 * The fifth cohabiting consumer of that port (siblings read `har`,
 * `nav`/`nav-timing`, `resource-timing`, and `session`); this one reads no
 * frames at all — only the connect/disconnect signal. DevTools-open is a
 * port connect, DevTools-close / tab-close / SW-evict is its disconnect.
 *
 * Ref-counted per tab: `onConnected` fires only on the 0→1 edge and
 * `onDisconnected` only on the 1→0 edge, so a brief overlap (an SW-wake
 * reconnect racing the old port's disconnect, or two DevTools windows) is
 * a single sustained presence — the controller's input stays a clean set
 * membership and never flaps the CDP attachment.
 *
 * The chrome plumbing lives here so the controller stays effect-only over
 * its injected inputs (it names no chrome API). Mirrors
 * `devtools-session-coordinator`'s onConnect idiom.
 *
 * Inert when `chrome.runtime.onConnect` is absent: construction logs and
 * the callbacks never fire.
 */

import { parseHarSourcePortName } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { getBrowserAPI } from '@/types/browser';
import { isExtensionOriginPort } from '../port-origin-gate';

export interface DevtoolsPortPresence {
  /** Detach the onConnect listener. Tests / SW shutdown only. */
  dispose(): void;
}

export interface DevtoolsPortPresenceOptions {
  /** A tab gained its first live DevTools port (0→1). */
  onConnected(tabId: number): void;
  /** A tab lost its last live DevTools port (1→0). */
  onDisconnected(tabId: number): void;
}

export function startDevtoolsPortPresence(options: DevtoolsPortPresenceOptions): DevtoolsPortPresence {
  const onConnect = getBrowserAPI().runtime?.onConnect;
  if (!onConnect?.addListener) {
    logger.info('DevtoolsPortPresence', 'runtime.onConnect unavailable — CDP port presence disabled');
    return { dispose: () => {} };
  }

  const counts = new Map<number, number>();

  const listener = (port: chrome.runtime.Port): void => {
    const tabId = parseHarSourcePortName(port.name);
    if (tabId === null) return;
    if (!isExtensionOriginPort(port, 'DevtoolsPortPresence')) return;
    const next = (counts.get(tabId) ?? 0) + 1;
    counts.set(tabId, next);
    if (next === 1) options.onConnected(tabId);
    port.onDisconnect.addListener(() => {
      const remaining = (counts.get(tabId) ?? 1) - 1;
      if (remaining <= 0) {
        counts.delete(tabId);
        options.onDisconnected(tabId);
      } else {
        counts.set(tabId, remaining);
      }
    });
  };

  onConnect.addListener(listener);
  return {
    dispose: () => {
      try {
        onConnect.removeListener(listener);
      } catch {
        /* already gone — SW shutdown */
      }
    },
  };
}
