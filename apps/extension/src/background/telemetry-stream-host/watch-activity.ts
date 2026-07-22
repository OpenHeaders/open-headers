/**
 * Desktop watch-activity ledger — the popup indicator's data source.
 *
 * The three telemetry hosts (lifecycle, storage, console) raise a key
 * here when a desktop watch session opens and drop it on teardown; the
 * distinct-key count is published to `OH.desktopWatchActivity`, which
 * the popup's privacy pill reads reactively (chrome.storage is the
 * authoritative reactive plane for popup surfaces). Purely additive
 * bookkeeping: no host behavior rides on this ledger.
 *
 * Storage is optional on purpose — unit harnesses that start a host
 * without installing a host-storage adapter still count in memory and
 * simply skip the publish.
 */

import { getHostStorage, OH } from '@openheaders/core/storage';

const active = new Set<string>();
let lastPublished = -1;

function publish(): void {
  const sessions = active.size;
  if (sessions === lastPublished) return;
  lastPublished = sessions;
  const storage = getHostStorage();
  if (!storage) return;
  void storage.set(OH.desktopWatchActivity, { sessions }).catch(() => {
    // A failed write self-heals on the next session change.
    lastPublished = -1;
  });
}

/** Record one open watch session under a plane-qualified key. */
export function watchActivityRaise(key: string): void {
  active.add(key);
  publish();
}

/** Drop a session recorded by {@link watchActivityRaise}. Idempotent. */
export function watchActivityDrop(key: string): void {
  if (active.delete(key)) publish();
}

/** Publish the current (possibly empty) count — hosts call this once at
 *  install so a stale count from a killed SW is corrected on restart. */
export function watchActivitySync(): void {
  lastPublished = -1;
  publish();
}

export function __resetWatchActivityForTests(): void {
  active.clear();
  lastPublished = -1;
}
