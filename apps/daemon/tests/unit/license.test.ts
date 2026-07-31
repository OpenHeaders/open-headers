/**
 * `ohd license install / status / remove` — the offline license
 * surface over the daemon's `license.key`. Exercises the real slot
 * against on-disk files with a dev signing ring; the compiled
 * production ring stays empty until the key ceremony, so unverifiable
 * artifacts land as `invalid`, never as a crash. Sqlite-free like
 * every CLI path.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ensureSyntheticIdentity } from '@openheaders/core/identity';
import {
  FREE_SEAT_LIMIT,
  generateLicenseSigningKeys,
  type License,
  type LicensedSnapshot,
  type LicenseKeyRing,
  signLicense,
} from '@openheaders/core/licensing';
import { setHostStorage } from '@openheaders/core/storage';
import { FileBackedHostStorage } from '@openheaders/oracle-host-node/host-storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  formatLicenseSnapshot,
  licenseInstall,
  licenseRemove,
  licenseStatus,
  resolveLicenseFilePath,
} from '../../src/cli/license';
import { addUser } from '../../src/cli/users';
import type { DaemonConfig } from '../../src/config';
import { noCipherYet } from '../../src/no-cipher';

const DAY = 86_400_000;
const KID = 'oh-lic-2026dev';

const tempDirs: string[] = [];

function makeConfig(overrides: Partial<DaemonConfig> = {}): DaemonConfig {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-license-cli-'));
  tempDirs.push(dataDir);
  return {
    dataDir,
    bindAddress: '127.0.0.1',
    bindPort: 8137,
    logLevel: 'info',
    trustedProxy: false,
    allowedHosts: [],
    allowInsecureLan: false,
    webRoot: null,
    oidc: null,
    vaultPassphrase: null,
    auditRetentionDays: 90,
    auditForwarding: null,
    licenseFile: null,
    licenseRefresh: true,
    personalSeats: true,
    systemProxy: null,
    configPath: path.join(dataDir, 'daemon.json'),
    ...overrides,
  };
}

let ring: LicenseKeyRing;
let sign: (claims: unknown) => Promise<string>;

function makeLicense(overrides: Partial<License> = {}): License {
  return {
    schemaVersion: 1,
    licenseId: 'lic-0001',
    licensee: { name: 'Ada Example', org: 'OpenHeaders', email: 'ada@openheaders.io' },
    seats: 25,
    entitlements: [],
    issuedAt: Date.now() - 30 * DAY,
    validUntil: Date.now() + 30 * DAY,
    graceDays: 21,
    kid: KID,
    ...overrides,
  };
}

async function writeKeyFile(dir: string, text: string): Promise<string> {
  const sourcePath = path.join(dir, 'incoming.key');
  fs.writeFileSync(sourcePath, text);
  return sourcePath;
}

beforeEach(async () => {
  const keys = await generateLicenseSigningKeys();
  ring = { [KID]: keys.publicKeyBase64Url };
  sign = (claims) => signLicense(claims, keys.privateKey);
});

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('resolveLicenseFilePath', () => {
  it('defaults beside the data dir and honors the licenseFile override', () => {
    const config = makeConfig();
    expect(resolveLicenseFilePath(config)).toBe(path.join(config.dataDir, 'license.key'));
    expect(resolveLicenseFilePath(makeConfig({ licenseFile: '/run/secrets/oh-license' }))).toBe(
      '/run/secrets/oh-license',
    );
  });
});

describe('license status / install / remove', () => {
  it('reports unlicensed on a fresh data dir', async () => {
    const config = makeConfig();
    expect(await licenseStatus(config)).toEqual({ status: 'unlicensed' });
    expect(formatLicenseSnapshot({ status: 'unlicensed' }, resolveLicenseFilePath(config))[0]).toContain('free tier');
  });

  it('installs a valid key file and reads it back', async () => {
    const config = makeConfig();
    const sourcePath = await writeKeyFile(config.dataDir, await sign(makeLicense()));
    const snapshot = await licenseInstall(config, sourcePath, { ring });
    expect(snapshot.status).toBe('licensed');
    expect(fs.readFileSync(resolveLicenseFilePath(config), 'utf8')).toMatch(/^oh-license\./);
    expect(await licenseStatus(config, { ring })).toMatchObject({ status: 'licensed', seats: 25 });
  });

  it('refuses a key signed by an untrusted kid (the empty production ring)', async () => {
    const config = makeConfig();
    const sourcePath = await writeKeyFile(config.dataDir, await sign(makeLicense()));
    // No ring seam: production verification against the compiled ring.
    await expect(licenseInstall(config, sourcePath)).rejects.toThrow(/does not trust/);
    expect(fs.existsSync(resolveLicenseFilePath(config))).toBe(false);
  });

  it('refuses garbage and a past-grace key', async () => {
    const config = makeConfig();
    await expect(licenseInstall(config, await writeKeyFile(config.dataDir, 'not a license'), { ring })).rejects.toThrow(
      /not a license/,
    );
    const stale = await sign(makeLicense({ validUntil: Date.now() - 60 * DAY }));
    await expect(licenseInstall(config, await writeKeyFile(config.dataDir, stale), { ring })).rejects.toThrow(
      /expired/,
    );
  });

  it('refuses an unreadable source path', async () => {
    const config = makeConfig();
    await expect(licenseInstall(config, path.join(config.dataDir, 'missing.key'), { ring })).rejects.toThrow(
      /cannot read/,
    );
  });

  it('remove deletes the file and reports whether one existed', async () => {
    const config = makeConfig();
    const sourcePath = await writeKeyFile(config.dataDir, await sign(makeLicense()));
    await licenseInstall(config, sourcePath, { ring });
    expect(await licenseRemove(config, { ring })).toBe(true);
    expect(fs.existsSync(resolveLicenseFilePath(config))).toBe(false);
    expect(await licenseRemove(config, { ring })).toBe(false);
  });

  it('formats grace and expired snapshots with their consequences', () => {
    const base: Omit<LicensedSnapshot, 'status'> = {
      licenseId: 'lic-0001',
      licensee: { name: 'Ada Example', org: 'OpenHeaders' },
      seats: 25,
      entitlements: [],
      validUntil: Date.UTC(2026, 6, 1),
      graceEndsAt: Date.UTC(2026, 6, 22),
    };
    expect(formatLicenseSnapshot({ status: 'grace', ...base }, '/x/license.key').join('\n')).toContain('grace ends');
    expect(formatLicenseSnapshot({ status: 'expired', ...base }, '/x/license.key').join('\n')).toContain('free limit');
  });
});

describe('offline seat gate (user add reads the same license file)', () => {
  it('refuses the user past the free limit on an unlicensed data dir', async () => {
    const config = makeConfig();
    setHostStorage(
      new FileBackedHostStorage({
        filePath: path.join(config.dataDir, 'storage.json'),
        secretCipher: noCipherYet,
      }),
    );
    await ensureSyntheticIdentity({ hostKind: 'daemon', now: '2026-07-09T00:00:00.000Z' });
    for (let i = 0; i < FREE_SEAT_LIMIT; i++) {
      await addUser(config, { displayName: `User ${i}`, email: `user${i}@openheaders.io` });
    }
    await expect(addUser(config, { displayName: 'One Too Many' })).rejects.toThrow(
      new RegExp(`seat limit reached \\(${FREE_SEAT_LIMIT} active`),
    );
  });
});
