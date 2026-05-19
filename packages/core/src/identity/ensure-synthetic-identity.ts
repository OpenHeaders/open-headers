/**
 * `ensureSyntheticIdentity` — the single host-neutral entry point that
 * every host calls once at boot to materialize the synthetic identity-row
 * tuple (UNIFIED_ORACLE_MODEL.md §5.2 / U1.6 + U1.7).
 *
 * Composition:
 *
 *   1. `ensureDaemonConfig` — guarantees `OH.daemonConfig.hostInstallId`
 *      exists (mints on first boot).
 *   2. Read `OH.syntheticIdentity` — return verbatim when present
 *      (idempotent across boots; deterministic in `hostInstallId` so
 *      re-running after a partial wipe reproduces the same FK targets
 *      per §11 OQ1).
 *   3. Otherwise: `bootstrapSyntheticIdentity` → write the tuple back as
 *      a single blob → return.
 *
 * Pure of host transport: routes through the `HostStorage` proxy, so
 * extension SW (chrome.storage) and desktop main (FileBackedHostStorage)
 * share one code path. Hosts wire `setHostStorage` *before* calling this.
 */

import type { SyntheticIdentityRecord } from '../types';
import { hostStorage } from '../storage/host-storage';
import { OH } from '../storage/keys';
import { bootstrapSyntheticIdentity } from './bootstrap';
import { ensureDaemonConfig } from './ensure-daemon-config';

/**
 * Optional bootstrap inputs threaded through to `bootstrapSyntheticIdentity`.
 * Defaults keep the helper a one-line call (`await ensureSyntheticIdentity()`)
 * for the common case where the host has no OS-derived display name /
 * email to surface.
 */
export interface EnsureSyntheticIdentityInput {
  /**
   * Best-effort display name (OS username). Only consulted on the first
   * boot — subsequent boots return the persisted record verbatim and the
   * display name updates only via promotion (§5.4 step 1).
   */
  displayName?: string;
  /** Local-org name; defaults to `'Local'`. First-boot only. */
  orgName?: string;
  /** Best-effort OS-derived email or `null`. First-boot only. */
  email?: string | null;
  /**
   * ISO timestamp captured for `verifiedAt` / `createdAt` on first
   * boot. Defaults to `new Date().toISOString()`; injected by tests
   * that pin the value.
   */
  now?: string;
}

/**
 * Read the persisted synthetic-identity record; mint + persist it on
 * first boot. Safe to call multiple times — subsequent calls return the
 * persisted record bit-identically.
 *
 * Requires `setHostStorage` to have been called by the host first.
 */
export async function ensureSyntheticIdentity(
  input: EnsureSyntheticIdentityInput = {},
): Promise<SyntheticIdentityRecord> {
  const config = await ensureDaemonConfig();
  const existing = await hostStorage.get(OH.syntheticIdentity);
  if (existing !== undefined) {
    return existing;
  }
  const fresh = await bootstrapSyntheticIdentity({
    hostInstallId: config.hostInstallId,
    displayName: input.displayName,
    orgName: input.orgName,
    email: input.email,
    now: input.now ?? new Date().toISOString(),
  });
  await hostStorage.set(OH.syntheticIdentity, fresh);
  return fresh;
}
