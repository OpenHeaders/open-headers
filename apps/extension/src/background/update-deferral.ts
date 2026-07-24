/**
 * Deferred-update host — keeps a downloaded extension update from
 * applying while a DevTools session is open.
 *
 * By default Chrome applies a downloaded update as soon as the MV3
 * service worker goes idle — which happens constantly — killing every
 * extension page in the process. An open Open Headers panel becomes a
 * dead white frame (and some Chrome versions destabilize the whole
 * DevTools window) until DevTools is closed and reopened. Registering
 * an `runtime.onUpdateAvailable` listener flips that behavior: Chrome
 * then holds the update until the extension reloads itself.
 *
 * Policy: track open DevTools sessions via their
 * `devtools-har-source:<tabId>` ports (one per DevTools window, opened
 * eagerly by the devtools_page and redialed across SW evictions). While
 * any session is connected, a pending update waits. When the last
 * session disconnects — or none was open to begin with — the reload
 * fires after a short grace. The grace absorbs the windows where "zero
 * ports" does not mean "no DevTools open": an SW-eviction reconnect
 * gap, and a fresh SW boot before the devtools pages have redialed.
 *
 * The pending flag survives SW eviction in `chrome.storage.session`,
 * because `onUpdateAvailable` fires once per downloaded update, not
 * once per SW life. That area is destroyed by the reload itself, so no
 * stale flag can re-trigger after the new version boots.
 *
 * Eval-time wiring: the `onUpdateAvailable` registration must be
 * synchronous at SW top level so the event can wake an evicted worker.
 */

import { parseHarSourcePortName } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { getBrowserAPI } from '@/types/browser';

const PENDING_KEY = 'update.pendingReload';

/** Long enough for a devtools_page to redial across an SW restart. */
export const UPDATE_RELOAD_GRACE_MS = 10_000;

export interface UpdateDeferralHost {
  /** Detach the chrome listeners. Tests / SW shutdown only. */
  dispose(): void;
}

export interface UpdateDeferralOptions {
  /** Applies the deferred update. Defaults to `runtime.reload()`. */
  readonly reload?: () => void;
  /** Quiet window required before reloading. Defaults to {@link UPDATE_RELOAD_GRACE_MS}. */
  readonly graceMs?: number;
}

function getSessionStorage(): chrome.storage.StorageArea | null {
  if (typeof chrome === 'undefined' || !chrome.storage?.session) return null;
  return chrome.storage.session;
}

export function startUpdateDeferral(options: UpdateDeferralOptions = {}): UpdateDeferralHost {
  const api = getBrowserAPI();
  const { reload = () => api.runtime.reload(), graceMs = UPDATE_RELOAD_GRACE_MS } = options;

  const onUpdateAvailable = api.runtime?.onUpdateAvailable;
  const onConnect = api.runtime?.onConnect;
  if (!onUpdateAvailable?.addListener || !onConnect?.addListener) {
    logger.info('UpdateDeferral', 'runtime update/connect events unavailable — update deferral disabled');
    return { dispose: () => {} };
  }

  const openSessions = new Set<chrome.runtime.Port>();
  let pending = false;
  let reloadTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const cancelTimer = (): void => {
    if (reloadTimer !== null) clearTimeout(reloadTimer);
    reloadTimer = null;
  };

  const reconcile = (): void => {
    if (disposed || !pending || openSessions.size > 0) {
      cancelTimer();
      return;
    }
    if (reloadTimer !== null) return;
    reloadTimer = setTimeout(() => {
      reloadTimer = null;
      if (disposed || !pending || openSessions.size > 0) return;
      logger.info('UpdateDeferral', 'no DevTools session open — applying deferred update');
      reload();
    }, graceMs);
  };

  const updateListener = (details: chrome.runtime.UpdateAvailableDetails): void => {
    pending = true;
    logger.info('UpdateDeferral', 'update downloaded — deferring while DevTools sessions are open', {
      version: details?.version,
      openSessions: openSessions.size,
    });
    void getSessionStorage()?.set({ [PENDING_KEY]: true });
    reconcile();
  };

  const connectListener = (port: chrome.runtime.Port): void => {
    if (parseHarSourcePortName(port.name) === null) return;
    openSessions.add(port);
    cancelTimer();
    port.onDisconnect.addListener(() => {
      openSessions.delete(port);
      reconcile();
    });
  };

  onUpdateAvailable.addListener(updateListener);
  onConnect.addListener(connectListener);

  // A pending update noted by a previous SW life: rearm the deferral.
  // The grace window covers the boot race where the devtools pages have
  // not redialed their ports yet.
  void getSessionStorage()
    ?.get(PENDING_KEY)
    .then((items) => {
      if (disposed || !items?.[PENDING_KEY]) return;
      pending = true;
      reconcile();
    });

  return {
    dispose: () => {
      disposed = true;
      cancelTimer();
      try {
        onUpdateAvailable.removeListener(updateListener);
        onConnect.removeListener(connectListener);
      } catch {
        /* already gone — SW shutdown */
      }
    },
  };
}
