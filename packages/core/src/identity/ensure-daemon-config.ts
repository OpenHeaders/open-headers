/**
 * `ensureDaemonConfig` — host-neutral, idempotent guarantee that the
 * `DaemonConfig` row exists in this host's storage, materializing it on
 * first boot and returning the persisted shape on every subsequent boot.
 *
 * The function is the entry point to U1.4 (host-install-id minting +
 * persistence per the unified-oracle status log). It runs over the
 * `HostStorage` proxy, so the per-host transport (chrome.storage.local
 * on the extension SW, `FileBackedHostStorage` JSON on desktop main) is
 * already abstracted — no per-host plumbing needed beyond the host
 * installing its adapter at boot via `setHostStorage`.
 *
 * Idempotency: a second call returns the same record bit-identically.
 * Recovery: if `OH.daemonConfig` is somehow wiped while the deterministic
 * identity UUIDs derived from it still anchor live data, the *next*
 * `ensureDaemonConfig` will mint a fresh id — at which point orphan-data
 * adoption is out-of-scope for V5 (§11 OQ1: "storage wiped entirely →
 * treat as fresh install"). Surviving-`hostInstallId`-with-wiped-rows
 * recovery is handled by `bootstrapSyntheticIdentity` re-running, which
 * reproduces the same row UUIDs.
 */

import type { DaemonConfig } from '../types';
import { hostStorage } from '../storage/host-storage';
import { OH } from '../storage/keys';
import { mintHostInstallId } from './host-install-id';

/**
 * In-flight call dedup. `ensureDaemonConfig` is a get-then-set pair, so
 * two callers racing the first boot would each read an empty slot, mint
 * a *different* `hostInstallId`, and write — the loser's id silently
 * overwrites the winner's, and every deterministic synthetic UUID
 * derived from it diverges. Sharing one in-flight promise collapses
 * concurrent calls onto a single mint; the slot is cleared once settled
 * so a later call (e.g. after a host-storage swap) reads through fresh.
 */
let inFlight: Promise<DaemonConfig> | null = null;

/**
 * Read the persisted daemon config; mint + persist on first boot. Safe
 * to call multiple times — subsequent calls return the same record, and
 * concurrent calls share one mint.
 *
 * Requires `setHostStorage` to have been called by the host first.
 */
export function ensureDaemonConfig(): Promise<DaemonConfig> {
  if (inFlight) return inFlight;
  inFlight = (async (): Promise<DaemonConfig> => {
    try {
      const existing = await hostStorage.get(OH.daemonConfig);
      if (existing !== undefined) {
        return existing;
      }
      const fresh: DaemonConfig = { hostInstallId: mintHostInstallId() };
      await hostStorage.set(OH.daemonConfig, fresh);
      return fresh;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
