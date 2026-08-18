/**
 * Wire-seen record — the historical half of the wire-join
 * (the observability plan Phase 6). While a browser-tab view computes
 * joins, it records which wire exchanges were also witnessed on a
 * browser tab; the Wire source view annotates its rows from this record
 * and offers the jump back to the tab source.
 *
 * This is attribution of COMPLETED observations — a historical fact
 * ("this wire exchange matched that browser row when both were live"),
 * never live state, and never written onto a lifecycle. Process-wide
 * module state on purpose (the terminal panel's survive-unmount
 * posture): the tab view and the wire view never mount together, so the
 * record is exactly what carries the association across the source
 * switch. Bounded FIFO — observability data is ring-buffer posture.
 */

export interface WireSeenRecord {
  readonly nodeId: string;
  readonly tabId: number;
  readonly browserRequestId: string;
  /** Tab display title when the recording surface knew it. */
  readonly label: string | null;
}

/** Bound on retained associations — matches the spirit of the panel's
 *  other ring bounds; the oldest association is the least inspectable. */
export const MAX_WIRE_SEEN_RECORDS = 5_000;

const records = new Map<string, WireSeenRecord>();
const listeners = new Set<() => void>();
let version = 0;
let snapshot: ReadonlyMap<string, WireSeenRecord> = new Map();
let snapshotVersion = -1;

function notify(): void {
  version += 1;
  for (const listener of listeners) listener();
}

/** Record one wire exchange's browser association. A labelled record is
 *  never downgraded by a label-less one for the same association (the
 *  detail editor tab records without a tab title; the panel with one). */
export function recordWireSeen(wireRequestId: string, record: WireSeenRecord): void {
  const prev = records.get(wireRequestId);
  if (
    prev &&
    prev.nodeId === record.nodeId &&
    prev.tabId === record.tabId &&
    prev.browserRequestId === record.browserRequestId &&
    (record.label === null || prev.label === record.label)
  ) {
    return;
  }
  const next: WireSeenRecord =
    prev && record.label === null && prev.browserRequestId === record.browserRequestId
      ? { ...record, label: prev.label }
      : record;
  // Re-insert so iteration order stays recency-ordered for the FIFO bound.
  records.delete(wireRequestId);
  records.set(wireRequestId, next);
  if (records.size > MAX_WIRE_SEEN_RECORDS) {
    const oldest = records.keys().next().value;
    if (oldest !== undefined) records.delete(oldest);
  }
  notify();
}

export function getWireSeen(wireRequestId: string): WireSeenRecord | null {
  return records.get(wireRequestId) ?? null;
}

export function subscribeWireSeen(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Stable snapshot for `useSyncExternalStore` — same map identity until
 *  a record actually lands. */
export function getWireSeenSnapshot(): ReadonlyMap<string, WireSeenRecord> {
  if (snapshotVersion !== version) {
    snapshot = new Map(records);
    snapshotVersion = version;
  }
  return snapshot;
}

/** Test seam. */
export function clearWireSeenRecords(): void {
  if (records.size === 0) return;
  records.clear();
  notify();
}
