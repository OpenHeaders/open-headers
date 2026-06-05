/**
 * Per-port acceptance: parse the port name, raise a panel-watching ref
 * on tab-telemetry, then attach to the hub when the consumer sends its
 * `subscribe` message. Detach + release on disconnect. Idempotent on
 * detach (the attachment handle and tracker both guard re-entry).
 *
 * Subscribe handshake: the consumer opens the port, then sends one
 * `subscribe` to declare its watch session. Attach is deferred until that
 * message; a repeated `subscribe` re-attaches in place (detach +
 * re-attach), so the handshake is idempotent.
 *
 * Panel-watching tracking lives here because the lifecycle port IS the
 * contract surface for "a UI is watching this tab". Webrequest event
 * ingestion (`tab-telemetry-source/projection.ts`) gates on
 * `isTracked(tabId)`; raising the ref on port connect is what allows
 * lifecycle data to flow at all. It is tied to the port's lifetime, not
 * the subscribe message — a connected-but-not-yet-subscribed port is
 * already a watcher. The HAR-source / nav-bridge ports do NOT touch
 * tracking — they are pure data plumbing that follows the panel's
 * lifetime, not independent watchers.
 */

import {
  type LifecycleConsumerMessage,
  type LifecycleSource,
  parseLifecyclePortName,
} from '@openheaders/core/request-lifecycle';
import type { AttachmentHandle, RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import { startTracking, stopTracking } from '../modules/tab-telemetry';
import { attachPanelWatchingTracker, type PanelWatchingTrackerDeps } from './panel-watching-tracker';
import { createPortSink } from './port-sink';

/**
 * Per-tab provenance source for the "CDP-enhanced" badge. The
 * `TabSourceRouter` satisfies this directly — its `TabOwner` is the wire
 * `LifecycleSource`. Optional: hosts/tests without a router omit it and no
 * `source` frame is sent (the panel defaults to heuristic).
 */
export interface LifecycleProvenance {
  ownerOf(tabId: number): LifecycleSource;
  onOwnerChange(listener: (tabId: number, owner: LifecycleSource) => void): () => void;
}

const defaultTrackerDeps: PanelWatchingTrackerDeps = {
  start: startTracking,
  stop: stopTracking,
};

export interface AcceptLifecyclePortOptions {
  readonly trackerDeps?: PanelWatchingTrackerDeps;
  /**
   * Resolves once the watch-session floors have hydrated from storage.
   * Attach/clear wait on it so a cold-SW reconnect resolves the persisted
   * session floor rather than minting a fresh one. Defaults to resolved.
   */
  readonly ready?: Promise<void>;
  /** Per-tab CDP-vs-heuristic provenance for the badge. Omit to disable. */
  readonly provenance?: LifecycleProvenance;
}

export function acceptLifecyclePort(
  hub: RequestLifecycleHub,
  port: chrome.runtime.Port,
  options: AcceptLifecyclePortOptions = {},
): boolean {
  const tabId = parseLifecyclePortName(port.name);
  if (tabId === null) return false;
  const sink = createPortSink(port);
  const tracker = attachPanelWatchingTracker(tabId, options.trackerDeps ?? defaultTrackerDeps);
  const { ready, provenance } = options;

  // Provenance: post the current owner on (re)connect (driven off the
  // subscribe handshake, which the panel resends on every reconnect) and
  // again whenever this tab's owner flips. Posted directly on the port —
  // it is a chrome-side signal, not hub state, so it stays off the sink.
  const postSource = (source: LifecycleSource): void => {
    try {
      port.postMessage({ kind: 'source', tabId, source });
    } catch {
      /* port disconnected — onDisconnect will clean up */
    }
  };
  const unsubscribeProvenance = provenance?.onOwnerChange((changedTabId, owner) => {
    if (changedTabId === tabId) postSource(owner);
  });

  // Attach is deferred to the first `subscribe`; a repeated `subscribe`
  // re-attaches in place (detach + re-attach). When a hydration gate is
  // supplied, subscribe/clear wait on it so the session floor is
  // resolvable first (a cold-SW reconnect restores the persisted floor);
  // with no gate there is nothing to await, so they run synchronously.
  let handle: AttachmentHandle | null = null;
  let disconnected = false;
  const whenReady = (run: () => void): void => {
    if (ready) {
      void ready.then(() => {
        if (!disconnected) run();
      });
    } else {
      run();
    }
  };
  port.onMessage.addListener((msg: LifecycleConsumerMessage) => {
    if (msg?.kind === 'subscribe') {
      whenReady(() => {
        handle?.detach();
        handle = hub.attach(tabId, sink);
        if (provenance) postSource(provenance.ownerOf(tabId));
      });
      return;
    }
    if (msg?.kind === 'clear-session') {
      whenReady(() => hub.resetSession(tabId));
    }
  });
  port.onDisconnect.addListener(() => {
    disconnected = true;
    handle?.detach();
    tracker.release();
    unsubscribeProvenance?.();
  });
  return true;
}
