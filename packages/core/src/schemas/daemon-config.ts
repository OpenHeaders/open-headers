/**
 * `DaemonConfig` — per-host configuration record. Owned by every
 * daemon-shaped thing (extension SW, desktop main, future standalone
 * daemon binary) per UNIFIED_ORACLE_MODEL.md §2.2.
 *
 * `hostInstallId` is the seed for the deterministic synthetic identity
 * UUIDs: minted once at first boot, persisted to the host's storage
 * (chrome.storage.local on the extension SW; SQLite on desktop main),
 * never regenerated except on reinstall (UNIFIED_ORACLE_MODEL.md §5.1
 * + §11 OQ1). Surviving `hostInstallId` is the recovery key for
 * orphan-data adoption after storage corruption.
 *
 * The schema starts intentionally narrow — additional config fields
 * (bind address, audit retention, etc.) land in later slices.
 */

import * as v from 'valibot';

export const DaemonConfigSchema = v.object({
  hostInstallId: v.pipe(v.string(), v.minLength(1)),
});
