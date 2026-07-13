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

import { hostStorage } from '../storage/host-storage';
import { OH } from '../storage/keys';
import type { HostKind, SyntheticIdentityRecord } from '../types';
import type { PlatformKind } from '../utils/host-detect';
import { bootstrapSyntheticIdentity } from './bootstrap';
import { ensureDaemonConfig } from './ensure-daemon-config';

/**
 * Bootstrap inputs threaded through to `bootstrapSyntheticIdentity`.
 * `hostKind` is required — every host knows which kind it is; the rest
 * are best-effort and consulted on the first boot only.
 */
export interface EnsureSyntheticIdentityInput {
  /**
   * Which kind of host process is calling. Stamped onto the `Org` row at
   * bootstrap; never changes.
   */
  hostKind: HostKind;
  /**
   * Best-effort display name (OS username). Only consulted on the first
   * boot — subsequent boots return the persisted record verbatim and the
   * display name updates only via promotion (§5.4 step 1).
   */
  displayName?: string;
  /**
   * Best-effort descriptive local-org name (hostname / browser name).
   * First-boot only; defaults to `'Local'` when unavailable.
   */
  orgName?: string;
  /**
   * The host's own operating system, when it can determine it (daemon /
   * desktop; browser hosts omit it). Unlike the first-boot-only fields
   * this one is machine-derived, so it is re-stamped on EVERY boot — a
   * daemon migrated to a different distro reports the new one.
   */
  hostOs?: PlatformKind;
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
export async function ensureSyntheticIdentity(input: EnsureSyntheticIdentityInput): Promise<SyntheticIdentityRecord> {
  const config = await ensureDaemonConfig();
  const existing = await hostStorage.get(OH.syntheticIdentity);
  if (existing !== undefined) {
    // `hostOs` is machine-derived, not user-authored — keep it fresh on
    // every boot rather than freezing the first boot's reading.
    if (input.hostOs && existing.org.hostOs !== input.hostOs) {
      const patched: SyntheticIdentityRecord = {
        ...existing,
        org: { ...existing.org, hostOs: input.hostOs },
      };
      await hostStorage.set(OH.syntheticIdentity, patched);
      return patched;
    }
    return existing;
  }
  const fresh = await bootstrapSyntheticIdentity({
    hostInstallId: config.hostInstallId,
    hostKind: input.hostKind,
    displayName: input.displayName,
    orgName: input.orgName,
    hostOs: input.hostOs,
    email: input.email,
    now: input.now ?? new Date().toISOString(),
  });
  await hostStorage.set(OH.syntheticIdentity, fresh);
  return fresh;
}
