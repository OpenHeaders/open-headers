/**
 * `oh daemon license install / status / remove` — the offline license
 * management path (LICENSING_PLAN.md §3.3). Thin CLI plumbing over the
 * same license slot the spine runs, pointed at the same file, so the
 * CLI can never disagree with the daemon about what a key means.
 *
 * No stopped-daemon guard, deliberately: `license.key` is not
 * `storage.json` — writes are atomic (tmp + rename) and a RUNNING
 * daemon's slot watches the file, so an install/remove here takes
 * effect live without a restart. sqlite-free by construction (the slot
 * is fs + pure core verification), so `cli.js` keeps loading on hosts
 * where the native module failed to build.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { LicenseKeyRing, LicenseSnapshot } from '@openheaders/core/licensing';
import { setLicenseSnapshotProvider } from '@openheaders/core/licensing';
import { installLicenseSlot, type LicenseSlotHandle } from '@openheaders/oracle-host-node/daemon/license-slot';
import type { DaemonConfig } from '../config';

/** The one location contract, shared with `daemon-run`'s spine boot. */
export function resolveLicenseFilePath(config: DaemonConfig): string {
  return config.licenseFile ?? path.join(config.dataDir, 'license.key');
}

/** Test seam — production always verifies against the compiled ring. */
export interface LicenseCliOptions {
  ring?: LicenseKeyRing;
}

async function withSlot<T>(
  config: DaemonConfig,
  options: LicenseCliOptions,
  action: (slot: LicenseSlotHandle) => Promise<T>,
): Promise<T> {
  const slot = await installLicenseSlot({
    filePath: resolveLicenseFilePath(config),
    broadcast: () => undefined,
    ...(options.ring ? { ring: options.ring } : {}),
  });
  try {
    return await action(slot);
  } finally {
    slot.dispose();
  }
}

export function licenseStatus(config: DaemonConfig, options: LicenseCliOptions = {}): Promise<LicenseSnapshot> {
  return withSlot(config, options, async (slot) => slot.getSnapshot());
}

export async function licenseInstall(
  config: DaemonConfig,
  sourcePath: string,
  options: LicenseCliOptions = {},
): Promise<LicenseSnapshot> {
  let text: string;
  try {
    text = await fs.readFile(sourcePath, 'utf8');
  } catch {
    throw new Error(`cannot read license file '${sourcePath}'.`);
  }
  return withSlot(config, options, async (slot) => {
    const result = await slot.install(text);
    if (!result.ok) throw new Error(`${result.error}.`);
    return result.snapshot;
  });
}

/** Returns false when no license file existed. */
export function licenseRemove(config: DaemonConfig, options: LicenseCliOptions = {}): Promise<boolean> {
  return withSlot(config, options, async (slot) => {
    const hadLicense = slot.getSnapshot().status !== 'unlicensed';
    await slot.remove();
    return hadLicense;
  });
}

/**
 * Install the seat-gate provider for one offline command (`user add`)
 * from the same file the daemon would read. Returns the uninstaller —
 * callers pair it with the command in try/finally.
 */
export async function withLicenseSeatProvider(
  config: DaemonConfig,
  options: LicenseCliOptions = {},
): Promise<() => void> {
  const snapshot = await licenseStatus(config, options);
  setLicenseSnapshotProvider(() => snapshot);
  return () => setLicenseSnapshotProvider(null);
}

export function formatLicenseSnapshot(snapshot: LicenseSnapshot, filePath: string): string[] {
  switch (snapshot.status) {
    case 'unlicensed':
      return ['No license installed — free tier (up to 10 active users per daemon).', `  file: ${filePath} (absent)`];
    case 'invalid':
      return [
        `License file is not usable (${snapshot.reason}) — the free tier applies.`,
        `  file: ${filePath}`,
        'Install a fresh key with: oh daemon license install <file>',
      ];
    default: {
      const licensee = `${snapshot.licensee.name}${snapshot.licensee.org ? ` — ${snapshot.licensee.org}` : ''}`;
      const lines = [
        `License ${snapshot.licenseId}: ${snapshot.status}${snapshot.offline ? ' (offline delivery)' : ''}`,
        `  licensee: ${licensee}`,
        `  seats: ${snapshot.seats}`,
        `  valid until: ${new Date(snapshot.validUntil).toISOString()}`,
        `  file: ${filePath}`,
      ];
      if (snapshot.status === 'grace') {
        lines.push(`  grace ends: ${new Date(snapshot.graceEndsAt).toISOString()} — renew before then`);
      }
      if (snapshot.status === 'expired') {
        lines.push('  grace has ended — new user creation follows the free limit (10); existing users are unaffected');
      }
      return lines;
    }
  }
}
