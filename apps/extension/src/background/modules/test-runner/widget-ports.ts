/**
 * Widget port subscription.
 *
 * The in-page widget connects via `chrome.runtime.connect({ name })` on
 * mount. We listen for that connection here, post a snapshot of the
 * run's current `liveFireCount`, and remember the port so the
 * telemetry subscriber and finish path can post deltas / the terminal
 * payload to it. Also holds the lifecycle-store reference the finish
 * path's static arbitration reads.
 *
 * Why a port and not `tabs.sendMessage`: the widget mounts AFTER the
 * fires that need to be displayed have already been promoted by
 * `tab-telemetry.onPageCommit`. A push-based design loses those early
 * fires because no listener exists yet. With a port, the widget signals
 * "I'm ready" by connecting, and the snapshot we post in response is
 * guaranteed (by the port's FIFO ordering) to land before any subsequent
 * delta — so the user sees an accurate count from the moment the widget
 * renders.
 */

import type { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import { logger } from '@utils/logger';
import { type PortMessage, parseTestRunPortName } from '../test-run-widget';
import { type ActiveRun, activeRuns } from './run-registry';

export function broadcastToRunPorts(run: ActiveRun, message: PortMessage): void {
  for (const port of run.ports) {
    try {
      port.postMessage(message);
    } catch {
      // Disconnected port — `onDisconnect` will remove it from the set.
    }
  }
}

/**
 * Register the `runtime.onConnect` handler that accepts widget ports.
 * Idempotent: safe to call multiple times. Called once at extension
 * startup from `background.ts`.
 */
let portsSetupDone = false;
export let lifecycleStoreRef: RequestLifecycleStore | null = null;

export interface SetupTestRunnerPortsOptions {
  readonly lifecycleStore: RequestLifecycleStore;
}

export function setupTestRunnerPorts(options: SetupTestRunnerPortsOptions): void {
  lifecycleStoreRef = options.lifecycleStore;
  if (portsSetupDone) return;
  portsSetupDone = true;
  if (!chrome?.runtime?.onConnect?.addListener) {
    logger.info('TestRunner', 'runtime.onConnect unavailable — widget ports disabled');
    return;
  }
  chrome.runtime.onConnect.addListener((port) => {
    const runId = parseTestRunPortName(port.name);
    if (!runId) return; // Not one of ours.
    const run = activeRuns.get(runId);
    if (!run) {
      // Stale connect — run has already finished. Closing the port
      // signals to the widget that there's nothing to subscribe to.
      try {
        port.disconnect();
      } catch {
        // No-op
      }
      return;
    }

    run.ports.add(port);
    run.everHadPort = true;
    port.onDisconnect.addListener(() => {
      run.ports.delete(port);
    });

    // Snapshot of current state — the widget will draw the right fire
    // count from the moment its first render runs, even if many fires
    // were promoted before it mounted.
    try {
      port.postMessage({ type: 'snapshot', fires: run.liveFireCount, phase: 'capturing' });
    } catch {
      run.ports.delete(port);
    }
  });
}
