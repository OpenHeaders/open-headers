/**
 * Pure helper: snapshot of merged fires → ordered sequence of `'fire'`
 * updates. Replay shares the consumer's single reducer code path with
 * live updates, so the consumer never branches on replay vs live.
 *
 * Order is `RuleFireStore.snapshotTab` order — arrival order, oldest
 * first.
 */

import type { MergedFire, RuleFireUpdate } from '@openheaders/core/rule-fire-stream';

export function snapshotToUpdates(tabId: number, snapshot: readonly MergedFire[]): RuleFireUpdate[] {
  const out: RuleFireUpdate[] = [];
  for (const entry of snapshot) {
    out.push({ kind: 'fire', tabId, record: entry.record, authoritative: entry.authoritative });
  }
  return out;
}
