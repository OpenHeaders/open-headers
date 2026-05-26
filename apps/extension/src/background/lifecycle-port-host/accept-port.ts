/**
 * Per-port acceptance: parse the port name, attach to the hub under
 * the parsed tabId, raise a panel-watching ref on tab-telemetry,
 * detach + release on disconnect. Idempotent on detach (the attachment
 * handle and tracker both guard re-entry).
 *
 * Panel-watching tracking lives here because the lifecycle port IS the
 * contract surface for "a UI is watching this tab". Webrequest event
 * ingestion (`tab-telemetry-source/projection.ts`) gates on
 * `isTracked(tabId)`; raising the ref on port connect is what allows
 * lifecycle data to flow at all. The HAR-source / nav-bridge ports do
 * NOT touch tracking — they are pure data plumbing that follows the
 * panel's lifetime, not independent watchers.
 */

import { parseLifecyclePortName, type RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
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
  const handle = hub.attach(tabId, sink);
  const tracker = attachPanelWatchingTracker(tabId, options.trackerDeps ?? defaultTrackerDeps);
  port.onDisconnect.addListener(() => {
    handle.detach();
    tracker.release();
  });
  return true;
}
