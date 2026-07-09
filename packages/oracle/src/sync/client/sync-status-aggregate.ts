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
 * the back-end — but a disabled record that still BINDS joined Orgs
 * contributes a synthetic yellow candidate: its local workspaces exist
 * and aren't syncing, which is a warning, not a healthy green.
 *
 * A host that is ALSO a server (desktop, daemon) contributes its own
 * server role — bind lifecycle + peer set — as the BASELINE slot
 * ({@link reportBaselineSyncStatus}): one more worst-of candidate, so a
 * failed bind (red) outranks healthy client wires and a client re-pair
 * (red) outranks an idle server, instead of the two racing the `sync`
 * subsystem latest-wins.
 *
 * The slots themselves are also observable per backend
 * ({@link getBackendSyncStatusSnapshot} / {@link subscribeBackendSyncStatus})
 * — the feed behind the connections-list row dots, broadcast as
 * `backendSyncStatusUpdated`.
 */

import { getBackends } from '@openheaders/core/backends';
import { getOrgBackendBindings } from '@openheaders/core/identity';
import type { BackendSyncStatusSnapshot } from '@openheaders/core/types';
import type { SyncStatusEntry } from './sync-status-reporter';

const RANK: Record<SyncStatusEntry['state'], number> = { green: 0, yellow: 1, red: 2 };

/**
 * Host seam for the aggregate roll-up. The host maps the chosen entry
 * onto its `sync` Status subsystem; `null` means zero slots, no
 * synthetic candidates, no baseline — the local engine IS the back-end, and the host
 * supplies its own tier-zero copy ("Running in this browser" / "Running
 * in this app"). Installing the sink replays the current roll-up so a
 * publish that fired before boot wiring isn't lost.
 */
export type SyncStatusRollupSink = (entry: SyncStatusEntry | null) => void;

let rollupSink: SyncStatusRollupSink | null = null;

export function setSyncStatusRollupSink(sink: SyncStatusRollupSink | null): void {
  rollupSink = sink;
  if (sink) publish();
}

interface Slot {
  entry: SyncStatusEntry;
  seq: number;
}

const slots = new Map<string, Slot>();
let baseline: Slot | null = null;
let seqCounter = 0;
const slotSubscribers = new Set<(snapshot: BackendSyncStatusSnapshot) => void>();

/** Install a backend's latest entry (wire-level or handshake-phase). */
export function reportBackendSyncStatus(backendId: string, entry: SyncStatusEntry): void {
  slots.set(backendId, { entry, seq: ++seqCounter });
  publish();
}

/**
 * Install/update the host's baseline slot — the server-role entry of a
 * host that is both server and client (the desktop's bind-lifecycle +
 * peer-set reporter). Joins the worst-of roll-up exactly like a backend
 * slot (latest-wins on rank ties) but never appears in the per-backend
 * snapshot — row dots are backend rows. A host that never reports one
 * (extension, web) keeps the null → tier-zero sink behavior.
 */
export function reportBaselineSyncStatus(entry: SyncStatusEntry): void {
  baseline = { entry, seq: ++seqCounter };
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

/** The per-backend slots as they stand — the row-dot feed's payload. */
export function getBackendSyncStatusSnapshot(): BackendSyncStatusSnapshot {
  const snapshot: BackendSyncStatusSnapshot = {};
  for (const [backendId, slot] of slots) {
    snapshot[backendId] = {
      state: slot.entry.state,
      message: slot.entry.message,
      ...(slot.entry.context ? { context: slot.entry.context } : {}),
    };
  }
  return snapshot;
}

/**
 * Subscribe to per-backend slot changes (report or drop). The bootstrap
 * wires this to the `backendSyncStatusUpdated` broadcast, same idiom as
 * the Status store's `statusUpdated`. Returns an unsubscribe.
 */
export function subscribeBackendSyncStatus(fn: (snapshot: BackendSyncStatusSnapshot) => void): () => void {
  slotSubscribers.add(fn);
  return () => {
    slotSubscribers.delete(fn);
  };
}

/**
 * Synthetic pill candidates for backends that are DISABLED but still
 * BOUND (joined Orgs whose local workspaces silently stopped syncing).
 * A wire-less record contributes no slot, so without these the pill
 * would read green "Running in this browser" while joined data goes
 * stale. Yellow, seq 0 — any live report of equal rank wins the tie.
 * Roll-up only: the per-backend snapshot stays pure wire truth, and the
 * row dot already renders a disabled record as "Off".
 */
function disabledBoundCandidates(): Slot[] {
  const boundBackendIds = new Set(getOrgBackendBindings().values());
  const candidates: Slot[] = [];
  for (const record of getBackends()) {
    if (record.enabled || !boundBackendIds.has(record.id)) continue;
    const label = record.label.trim() || record.url;
    candidates.push({
      entry: {
        state: 'yellow',
        message: `${label} is off — its workspaces aren't syncing`,
        context: { reason: 'backend-off', backendId: record.id },
      },
      seq: 0,
    });
  }
  return candidates;
}

function publish(): void {
  const perBackend = getBackendSyncStatusSnapshot();
  for (const fn of [...slotSubscribers]) fn(perBackend);
  let chosen: Slot | null = null;
  const candidates = [...slots.values(), ...disabledBoundCandidates()];
  if (baseline) candidates.push(baseline);
  for (const slot of candidates) {
    if (
      !chosen ||
      RANK[slot.entry.state] > RANK[chosen.entry.state] ||
      (RANK[slot.entry.state] === RANK[chosen.entry.state] && slot.seq > chosen.seq)
    ) {
      chosen = slot;
    }
  }
  rollupSink?.(chosen ? chosen.entry : null);
}

/** Test-only — drop every slot between cases. */
export function __resetSyncStatusAggregateForTests(): void {
  slots.clear();
  baseline = null;
  seqCounter = 0;
  slotSubscribers.clear();
}
