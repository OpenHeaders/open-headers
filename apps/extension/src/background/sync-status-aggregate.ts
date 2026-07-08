/**
 * Per-backend sync-status aggregation — the roll-up between the
 * N-connection plane and the single `sync` Status subsystem the UI
 * reads (MULTI_BACKEND_PLAN.md §3, last paragraph).
 *
 * Each connection contributes one slot, written by both of its
 * reporters — the wire-level entry from the connection manager and the
 * handshake-phase override from the per-connection FSM bridge. Within a
 * slot the most recent write wins, exactly the temporal semantics the
 * two reporters had against the singleton subsystem. Across slots the
 * worst state wins the pill (red > yellow > green); ties go to the most
 * recently reported so a single backend behaves byte-identically to the
 * pre-manager wiring. Zero slots means no enabled backend — the SW is
 * the back-end.
 */

import { report as reportStatus } from '@openheaders/ui/shared/status';
import type { SyncStatusEntry } from './sync-status-reporter';

const RANK: Record<SyncStatusEntry['state'], number> = { green: 0, yellow: 1, red: 2 };

interface Slot {
  entry: SyncStatusEntry;
  seq: number;
}

const slots = new Map<string, Slot>();
let seqCounter = 0;

/** Install a backend's latest entry (wire-level or handshake-phase). */
export function reportBackendSyncStatus(backendId: string, entry: SyncStatusEntry): void {
  slots.set(backendId, { entry, seq: ++seqCounter });
  publish();
}

/** Remove a torn-down backend's slot (its record was removed/disabled). */
export function dropBackendSyncStatus(backendId: string): void {
  slots.delete(backendId);
  publish();
}

/** Re-publish the current aggregate (e.g. after a reconcile pass). */
export function refreshSyncStatusAggregate(): void {
  publish();
}

function publish(): void {
  let chosen: Slot | null = null;
  for (const slot of slots.values()) {
    if (
      !chosen ||
      RANK[slot.entry.state] > RANK[chosen.entry.state] ||
      (RANK[slot.entry.state] === RANK[chosen.entry.state] && slot.seq > chosen.seq)
    ) {
      chosen = slot;
    }
  }
  if (!chosen) {
    reportStatus({ subsystem: 'sync', state: 'green', message: 'Running in this browser' });
    return;
  }
  reportStatus({
    subsystem: 'sync',
    state: chosen.entry.state,
    message: chosen.entry.message,
    context: chosen.entry.context,
  });
}

/** Test-only — drop every slot between cases. */
export function __resetSyncStatusAggregateForTests(): void {
  slots.clear();
  seqCounter = 0;
}
