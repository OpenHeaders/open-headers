/**
 * Activity Feed grouping — pure helper.
 *
 * The classifier can emit multiple kinds per envelope (structural row
 * + zero or more highlight rows). The panel renders them as one card,
 * keyed by `mutationId`. The order across groups follows the entries
 * array (which is HLC-sorted, newest first); the order WITHIN a group
 * is stable across renders so the card's chip ordering doesn't flicker
 * as new entries land.
 */

import type { ActivityEntry, ActivityEntryKind } from '@openheaders/core/sync';

export interface ActivityFeedGroup {
  mutationId: string;
  /** Newest in the bucket — drives sort + the card's "X ago" line. */
  primary: ActivityEntry;
  /** Every entry sharing the mutationId, deterministic order. */
  entries: readonly ActivityEntry[];
  /** Distinct kinds in deterministic order. */
  kinds: readonly ActivityEntryKind[];
  /** True iff every entry in the bucket is already marked read. */
  read: boolean;
}

// Deterministic kind ordering — structural row first, then highlights
// in the order they were declared in the enum. Keeps the card's chips
// stable irrespective of the order entries land in.
const KIND_ORDER: Record<ActivityEntryKind, number> = {
  'create-entity': 0,
  'edit-entity': 1,
  'delete-entity': 2,
  'supersede-local-edit': 3,
  'sensitive-field-rotation': 4,
  'permission-scope-expansion': 5,
  'agent-observe': 6,
};

export function groupActivityEntriesByMutation(entries: readonly ActivityEntry[]): ActivityFeedGroup[] {
  const buckets = new Map<string, ActivityEntry[]>();
  const order: string[] = [];
  for (const entry of entries) {
    let bucket = buckets.get(entry.mutationId);
    if (!bucket) {
      bucket = [];
      buckets.set(entry.mutationId, bucket);
      order.push(entry.mutationId);
    }
    bucket.push(entry);
  }

  const groups: ActivityFeedGroup[] = [];
  for (const mutationId of order) {
    const bucket = buckets.get(mutationId);
    if (!bucket || bucket.length === 0) continue;
    const sorted = [...bucket].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
    const seenKinds = new Set<ActivityEntryKind>();
    const kinds: ActivityEntryKind[] = [];
    for (const e of sorted) {
      if (seenKinds.has(e.kind)) continue;
      seenKinds.add(e.kind);
      kinds.push(e.kind);
    }
    groups.push({
      mutationId,
      // `entries` is already HLC-sorted newest-first by the caller, so
      // the FIRST entry encountered for this mutationId is the newest.
      // Use it as the group's primary (drives the "X ago" line).
      primary: bucket[0],
      entries: sorted,
      kinds,
      read: sorted.every((e) => e.read),
    });
  }
  return groups;
}
