/**
 * Lifecycle → tab-telemetry projection. Forwards the parts of each
 * `RequestLifecycleUpdate` that tab-telemetry still needs: phase-driven
 * delivery-mode back-fill and main-frame error promotion. URL discovery
 * is derived directly from the store snapshot by consumers (see
 * `deriveObservedUrls` / `mainFrameRequestIdsMatchingCommit`).
 *
 * Tab-telemetry ingestion is gated by `isTracked(tabId)` inside the
 * tab-telemetry module itself; we still pre-check here to avoid work
 * on untracked tabs.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';

import { isMainFrame } from '../correlator-host/main-frame-registry';
import { isTracked as isTabTracked, onMainFrameError, updateRequestDeliveryMode } from '../modules/tab-telemetry';
import { isMainFrameNavigation } from './main-frame-chain';

export interface ProjectionOptions {
  readonly store: RequestLifecycleStore;
}

export function project(update: RequestLifecycleUpdate, options: ProjectionOptions): void {
  if (update.kind !== 'phase') return;
  projectPhase(update, options);
}

function projectPhase(
  update: Extract<RequestLifecycleUpdate, { kind: 'phase' }>,
  options: ProjectionOptions,
): void {
  const { tabId, requestId, patch } = update;
  if (tabId === -1 || !isTabTracked(tabId)) return;

  if (patch.fromCache !== undefined) {
    updateRequestDeliveryMode(tabId, requestId, patch.fromCache ? 'cached' : 'network');
  }

  if (patch.phase === 'failed') {
    const lifecycle = options.store.get(tabId, requestId);
    // Promote the buffered fire of a failed navigation — incl. CDP-owned
    // tabs, where the lifecycle is tagged `document` (resolve the main-frame
    // split via the registry, as the fire's buffering did).
    if (lifecycle && isMainFrameNavigation(lifecycle, (lc) => isMainFrame(lc.tabId, lc.frameId))) {
      onMainFrameError(tabId, requestId);
    }
  }
}
