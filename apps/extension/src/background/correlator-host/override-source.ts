/**
 * Chrome adapter for the heuristic correlator's {@link OverrideEventSource}
 * seam — the standing background end of the page-relayed override channel.
 *
 * A response/request-body rule modifies the bytes the page sees in page
 * context; the injection wrapper relays both sides over the fire bridge
 * (`window.postMessage` → `fire-bridge-content` → the `tabResponseOverride`
 * message handler), which calls {@link push} here. The heuristic correlator
 * subscribes (wired in `lifecycle-host`) and joins each event to its webRequest
 * lifecycle by `(url, method, start)`.
 *
 * A module singleton — the same shared-state shape as `recordReportedFire`
 * (tab-telemetry): the message handler (producer) and the correlator
 * (consumer) reach the one instance without threading it through the pipeline
 * handles. One SW context, one source.
 */

import type { OverrideEvent, OverrideEventSource } from '@openheaders/oracle/correlator-heuristic';

class ChromeOverrideEventSource implements OverrideEventSource {
  private readonly listeners = new Set<(event: OverrideEvent) => void>();

  subscribe(listener: (event: OverrideEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Fan a page-relayed override to the subscribed correlator. */
  push(event: OverrideEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

/** The one source instance — produced into by the message handler, consumed by
 *  the heuristic correlator. */
export const overrideEventSource = new ChromeOverrideEventSource();
