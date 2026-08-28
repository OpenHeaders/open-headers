/**
 * Host-minted Activity Feed entries.
 *
 * The classifier only sees envelopes that arrived over the wire; some
 * feed-worthy events are the host's OWN reconciliation — the tree slot
 * reconciler rehoming an orphaned child to its collection root. Those
 * rows are minted directly (the `agent-observe` precedent) and handed
 * to whichever installer owns the activity log on this host through
 * this one seam: the extension SW and the Node hosts register their
 * `land` path (mute filter → subscribers → log append) at boot; a host
 * without a sink drops the entry with a log line.
 */

import type { ActivityEntry } from '@openheaders/core/sync';
import { logger } from '@openheaders/core/utils';

export type HostActivityEntrySink = (entry: ActivityEntry) => void;

let sink: HostActivityEntrySink | null = null;

export function setHostActivityEntrySink(next: HostActivityEntrySink | null): void {
  sink = next;
}

export function recordHostActivityEntry(entry: ActivityEntry): void {
  if (!sink) {
    logger.info('SyncActivity', `no host activity sink installed; ${entry.kind} entry for ${entry.entityId} dropped`);
    return;
  }
  sink(entry);
}
