/**
 * CDP pin tab-close cleanup — drops a closed tab from the attach
 * controller's pin overlay on `tab-forgotten`.
 *
 * The controller's other per-tab inputs self-clear when a tab closes: the
 * DevTools port disconnects (`notePortDisconnected`) and the active-tab
 * observer re-resolves (`noteActiveTab`). The explicit pin overlay has no
 * such source. Without this wire a pinned tab that is closed leaves its id
 * in the pin set — it lingers in the footer roster, and the next reconcile
 * re-derives it into the desired set, so the controller tries to attach a
 * dead tab and surfaces a spurious attach fault.
 *
 * Rides the cross-driver {@link TabLifecycleBus} — the same `tab-forgotten`
 * fanout the other drivers clear their per-tab state on — so the controller
 * stays effect-only over its injected inputs and names no chrome API.
 * `noteUnpinned` no-ops for an unpinned tab, so firing on every close is safe.
 */

import type { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import type { CdpAttachController } from './cdp-attach-controller';

export interface CdpPinTabCleanupOptions {
  readonly bus: Pick<TabLifecycleBus, 'subscribe'>;
  readonly controller: Pick<CdpAttachController, 'noteUnpinned'>;
}

/** Install the cleanup. Returns the unsubscribe handle. */
export function installCdpPinTabCleanup(options: CdpPinTabCleanupOptions): () => void {
  const { bus, controller } = options;
  return bus.subscribe((event) => {
    if (event.kind !== 'tab-forgotten') return;
    controller.noteUnpinned(event.tabId);
  });
}
