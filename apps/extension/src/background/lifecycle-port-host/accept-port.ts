/**
 * Per-port acceptance: parse the port name, raise a panel-watching ref
 * on tab-telemetry, then attach to the hub when the consumer sends its
 * `subscribe` message. Detach + release on disconnect. Idempotent on
 * detach (the attachment handle and tracker both guard re-entry).
 *
 * Subscribe handshake: the consumer opens the port, then sends one
 * `subscribe` declaring the replay floor it wants. Attach is deferred
 * until that message so the consumer controls which slice of history is
 * replayed; a later `subscribe` re-scopes (detach + re-attach), which is
 * how the panel toggles between "session only" and "all background
 * history" without reconnecting.
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

import { type LifecycleSubscribeMessage, parseLifecyclePortName } from '@openheaders/core/request-lifecycle';
import type { AttachmentHandle, RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import { startTracking, stopTracking } from '../modules/tab-telemetry';
import { attachPanelWatchingTracker, type PanelWatchingTrackerDeps } from './panel-watching-tracker';
import { createPortSink } from './port-sink';

const defaultTrackerDeps: PanelWatchingTrackerDeps = {
  start: startTracking,
  stop: stopTracking,
};

export interface AcceptLifecyclePortOptions {
  readonly trackerDeps?: PanelWatchingTrackerDeps;
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

  // Attach is deferred to the first `subscribe`; a later `subscribe`
  // re-scopes the replay (detach + re-attach) so the panel can switch
  // between session-only and full history in place.
  let handle: AttachmentHandle | null = null;
  port.onMessage.addListener((msg: LifecycleSubscribeMessage) => {
    if (msg?.kind !== 'subscribe') return;
    handle?.detach();
    handle = hub.attach(tabId, sink, { sinceMs: msg.sinceMs });
  });
  port.onDisconnect.addListener(() => {
    handle?.detach();
    tracker.release();
  });
  return true;
}
