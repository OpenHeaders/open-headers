/**
 * Pure helper: snapshot of console entries → ordered sequence of `'entry'`
 * updates. Replay shares the consumer's single reducer code path with live
 * updates, so the consumer never branches on replay vs live.
 *
 * Order is `ConsoleStore.snapshotTab` order — arrival order, oldest first.
 */

import type { ConsoleEntry, ConsoleStreamUpdate } from '@openheaders/core/console-stream';

export function snapshotToUpdates(tabId: number, snapshot: readonly ConsoleEntry[]): ConsoleStreamUpdate[] {
  const out: ConsoleStreamUpdate[] = [];
  for (const entry of snapshot) {
    out.push({ kind: 'entry', tabId, entry });
  }
  return out;
}
