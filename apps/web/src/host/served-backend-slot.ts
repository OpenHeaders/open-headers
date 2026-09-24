/**
 * The served tab's one per-backend `sync` slot — what the Sync page's
 * "Synced with" row and every per-backend reader ask for through
 * `getBackendSyncStatusSnapshot` / `backendSyncStatusUpdated`. The
 * extension's worker keeps one slot per `OH.backends` record; this tab
 * has exactly one backend, the daemon that served it, filed under the
 * fixed {@link WEB_DAEMON_BACKEND_ID}. The wire writes it beside the
 * aggregate `sync` subsystem it already reports, so the row and the
 * status popover never disagree.
 */

import type { BackendSyncStatus, BackendSyncStatusSnapshot } from '@openheaders/core/types';
import { WEB_DAEMON_BACKEND_ID } from './web-backend-id';
import { broadcastLocal } from './web-broadcast';

let slot: BackendSyncStatus | null = null;

/** The snapshot as the per-backend readers expect it — empty until the wire has spoken. */
export function getServedBackendSnapshot(): BackendSyncStatusSnapshot {
  return slot === null ? {} : { [WEB_DAEMON_BACKEND_ID]: slot };
}

/** Record the wire's state for the served backend and tell every subscribed reader. */
export function reportServedBackendSlot(next: BackendSyncStatus): void {
  slot = next;
  broadcastLocal('backendSyncStatusUpdated', getServedBackendSnapshot());
}

/** Test seam — the tab never forgets its one backend. */
export function __resetServedBackendSlotForTests(): void {
  slot = null;
}
