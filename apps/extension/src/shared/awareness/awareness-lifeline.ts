/**
 * Renderer-side awareness lifeline.
 *
 * Opens a long-lived `chrome.runtime.Port` named
 * `oh.awareness.lifeline:<instanceId>` for the surface's lifetime.
 * The SW's `awareness-lifeline.ts` handler treats `port.onDisconnect`
 * as the canonical "this surface is gone" signal — connection-bound
 * liveness instead of the previous heartbeat-with-TTL polling scheme,
 * which flapped under Chrome's background-tab timer throttling.
 *
 * SW eviction is the only case the renderer side has to handle
 * actively: when MV3 evicts the SW, the port disconnects on the
 * renderer side too. We reconnect transparently so the SW's awareness
 * store rebuilds the row as soon as the next publish lands. The
 * `onReconnect` callback gives consumers a chance to re-publish
 * immediately rather than waiting for the next focus/dirty change.
 *
 * Same shape as the popup/sidepanel `presence(name)` plumbing — the
 * existing pattern in this codebase. For Mode 2/3 (standalone oracle
 * over WebSocket, see `.notes/oracle-arc.md`) the same shape carries
 * over: `WebSocket onclose` replaces `Port.onDisconnect`, identical
 * semantics.
 */

import { hostLogger as logger } from '@openheaders/core/logger';

const LIFELINE_PREFIX = 'oh.awareness.lifeline:' as const;

export interface AwarenessLifelineHandle {
  /** Tear down the port. Idempotent. */
  dispose(): void;
}

export interface OpenAwarenessLifelineOptions {
  instanceId: string;
  /**
   * Workspace the surface is currently editing or rendering for. Sent
   * to the SW as a `bind` message immediately after each connect so the
   * SW can refcount-acquire the workspace's `WorkspaceServiceState`
   * (design § 4.0.7). When `null`, no `bind` message is sent and the
   * lifeline stays liveness-only — used by surfaces that haven't
   * resolved their workspace yet (cold mount during workspace-store
   * bootstrap).
   *
   * When the workspaceId changes, the surface should dispose this
   * handle and open a fresh one (one port ↔ one workspace ref);
   * `IdentityContext` does this automatically by including the
   * workspaceId in the lifeline `useEffect` deps.
   */
  workspaceId?: string | null;
  /**
   * Called when the SW disconnected the port unexpectedly (typically
   * SW eviction) and the lifeline reconnected. Consumers re-publish
   * their current awareness state so the SW's freshly-rebuilt store
   * sees them immediately.
   */
  onReconnect?: () => void;
  /**
   * Cap reconnect attempts so a permanently-broken environment (no
   * runtime API, manifest issue) doesn't loop. Defaults to ~30 — well
   * past any realistic SW-restart burst.
   */
  maxReconnects?: number;
}

const DEFAULT_MAX_RECONNECTS = 30;
const RECONNECT_BACKOFF_MS = [50, 150, 500, 1500];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function openAwarenessLifeline(opts: OpenAwarenessLifelineOptions): AwarenessLifelineHandle {
  const { instanceId, workspaceId = null, onReconnect, maxReconnects = DEFAULT_MAX_RECONNECTS } = opts;
  const portName = `${LIFELINE_PREFIX}${instanceId}`;

  let disposed = false;
  let port: chrome.runtime.Port | null = null;
  let reconnectAttempt = 0;
  let firstConnect = true;

  const sendBind = (target: chrome.runtime.Port): void => {
    if (workspaceId == null) return;
    try {
      target.postMessage({ kind: 'bind', workspaceId });
    } catch (err) {
      logger.info('AwarenessLifeline', `bind postMessage failed: ${(err as Error).message}`);
    }
  };

  const connect = (): void => {
    if (disposed) return;
    try {
      port = chrome.runtime.connect({ name: portName });
    } catch (err) {
      logger.info('AwarenessLifeline', `connect failed: ${(err as Error).message}`);
      port = null;
      scheduleReconnect();
      return;
    }
    const reactivated = !firstConnect;
    firstConnect = false;
    reconnectAttempt = 0;

    // Send the bind message before any reconnect republish so the SW
    // re-acquires the workspace ref BEFORE awareness state replays
    // through the freshly-rebuilt store.
    sendBind(port);

    port.onDisconnect.addListener(() => {
      const lastError = chrome.runtime.lastError;
      port = null;
      if (disposed) return;
      if (lastError) {
        logger.info('AwarenessLifeline', `lifeline disconnected: ${lastError.message}`);
      }
      scheduleReconnect();
    });

    if (reactivated && onReconnect) {
      try {
        onReconnect();
      } catch (err) {
        logger.info('AwarenessLifeline', `onReconnect threw: ${(err as Error).message}`);
      }
    }
  };

  const scheduleReconnect = (): void => {
    if (disposed) return;
    if (reconnectAttempt >= maxReconnects) {
      logger.info('AwarenessLifeline', `giving up after ${reconnectAttempt} reconnect attempts`);
      return;
    }
    const wait = RECONNECT_BACKOFF_MS[Math.min(reconnectAttempt, RECONNECT_BACKOFF_MS.length - 1)];
    reconnectAttempt += 1;
    void delay(wait).then(connect);
  };

  connect();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      const local = port;
      port = null;
      if (!local) return;
      try {
        local.disconnect();
      } catch {
        // ignore — port may already be torn down
      }
    },
  };
}
