/**
 * License slot — file lifecycle (absent / present / installed /
 * removed / externally swapped), refusal paths that must never touch
 * the installed file, and the licensed→grace boundary re-evaluation.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { License, LicenseKeyRing, LicenseSnapshot } from '@openheaders/core/licensing';
import { generateLicenseSigningKeys, signLicense } from '@openheaders/core/licensing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installLicenseSlot, type LicenseSlotHandle } from '../../../src/daemon/license-slot';

const DAY = 86_400_000;
const KID = 'oh-lic-2026dev';

let dir: string;
let filePath: string;
let signer: { ring: LicenseKeyRing; sign(claims: unknown): Promise<string> };
let slots: LicenseSlotHandle[];

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

async function makeSlot(
  options: { broadcast?: (s: LicenseSnapshot) => void; now?: () => number } = {},
): Promise<LicenseSlotHandle> {
  const slot = await installLicenseSlot({
    filePath,
    broadcast: options.broadcast ?? (() => undefined),
    ring: signer.ring,
    ...(options.now ? { now: options.now } : {}),
  });
  slots.push(slot);
  return slot;
}

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-license-slot-'));
  filePath = path.join(dir, 'license.key');
  const keys = await generateLicenseSigningKeys();
  signer = {
    ring: { [KID]: keys.publicKeyBase64Url },
    sign: (claims) => signLicense(claims, keys.privateKey),
  };
  slots = [];
});

afterEach(() => {
  for (const slot of slots) slot.dispose();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('installLicenseSlot — boot', () => {
  it('is unlicensed when the file is absent', async () => {
    const slot = await makeSlot();
    expect(slot.getSnapshot()).toEqual({ status: 'unlicensed' });
  });

  it('loads and verifies an existing file', async () => {
    fs.writeFileSync(filePath, await signer.sign(makeLicense()));
    const slot = await makeSlot();
    expect(slot.getSnapshot().status).toBe('licensed');
  });

  it('reports a present-but-untrusted file as invalid', async () => {
    fs.writeFileSync(filePath, await signer.sign(makeLicense({ kid: 'oh-lic-2031x' })));
    const slot = await makeSlot();
    expect(slot.getSnapshot()).toEqual({ status: 'invalid', reason: 'unknown-kid' });
  });
});

describe('installLicenseSlot — install / remove', () => {
  it('installs a valid license: persists the file and broadcasts once', async () => {
    const seen: LicenseSnapshot[] = [];
    const slot = await makeSlot({ broadcast: (s) => seen.push(s) });
    const result = await slot.install(await signer.sign(makeLicense()));
    expect(result.ok).toBe(true);
    expect(slot.getSnapshot().status).toBe('licensed');
    expect(seen).toHaveLength(1);
    expect(fs.readFileSync(filePath, 'utf8')).toMatch(/^oh-license\./);
  });

  it('accepts an in-grace license (slightly stale enterprise file)', async () => {
    const slot = await makeSlot();
    const result = await slot.install(await signer.sign(makeLicense({ validUntil: Date.now() - DAY })));
    expect(result.ok).toBe(true);
    expect(slot.getSnapshot().status).toBe('grace');
  });

  it('refuses garbage without touching the installed file', async () => {
    fs.writeFileSync(filePath, await signer.sign(makeLicense()));
    const slot = await makeSlot();
    const before = fs.readFileSync(filePath, 'utf8');
    const result = await slot.install('not a license at all');
    expect(result).toEqual({ ok: false, error: expect.stringContaining('not a license') });
    expect(fs.readFileSync(filePath, 'utf8')).toBe(before);
    expect(slot.getSnapshot().status).toBe('licensed');
  });

  it('refuses a personal-seat artifact as the daemon license', async () => {
    const slot = await makeSlot();
    const result = await slot.install(await signer.sign(makeLicense({ kind: 'personal-seat', seats: 1 })));
    expect(result).toEqual({ ok: false, error: expect.stringContaining('personal-seat') });
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('refuses a past-grace license', async () => {
    const slot = await makeSlot();
    const result = await slot.install(await signer.sign(makeLicense({ validUntil: Date.now() - 60 * DAY })));
    expect(result).toEqual({ ok: false, error: expect.stringContaining('expired') });
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('removes: deletes the file and reverts to unlicensed', async () => {
    const seen: LicenseSnapshot[] = [];
    const slot = await makeSlot({ broadcast: (s) => seen.push(s) });
    await slot.install(await signer.sign(makeLicense()));
    const result = await slot.remove();
    expect(result.snapshot).toEqual({ status: 'unlicensed' });
    expect(fs.existsSync(filePath)).toBe(false);
    expect(seen.map((s) => s.status)).toEqual(['licensed', 'unlicensed']);
  });

  it('remove is idempotent when no file exists', async () => {
    const slot = await makeSlot();
    await expect(slot.remove()).resolves.toEqual({ ok: true, snapshot: { status: 'unlicensed' } });
  });

  it('getInstalledText returns the compact artifact, and null when absent', async () => {
    const slot = await makeSlot();
    await expect(slot.getInstalledText()).resolves.toBeNull();
    const text = await signer.sign(makeLicense());
    await slot.install(text);
    await expect(slot.getInstalledText()).resolves.toBe(text);
    await slot.remove();
    await expect(slot.getInstalledText()).resolves.toBeNull();
  });
});

describe('installLicenseSlot — external changes', () => {
  it('reload picks up a file swapped behind its back', async () => {
    const slot = await makeSlot();
    expect(slot.getSnapshot()).toEqual({ status: 'unlicensed' });
    fs.writeFileSync(filePath, await signer.sign(makeLicense({ seats: 50 })));
    const snapshot = await slot.reload();
    expect(snapshot.status).toBe('licensed');
    if (snapshot.status !== 'licensed') return;
    expect(snapshot.seats).toBe(50);
  });

  it('the watcher picks up an external write without an RPC', async () => {
    const seen: LicenseSnapshot[] = [];
    const slot = await makeSlot({ broadcast: (s) => seen.push(s) });
    fs.writeFileSync(filePath, await signer.sign(makeLicense()));
    await vi.waitFor(() => expect(slot.getSnapshot().status).toBe('licensed'), { timeout: 3000 });
    expect(seen.map((s) => s.status)).toEqual(['licensed']);
  });
});

describe('installLicenseSlot — boundary re-evaluation', () => {
  it('crosses licensed → grace at validUntil without a restart', async () => {
    fs.writeFileSync(filePath, await signer.sign(makeLicense({ validUntil: Date.now() + 120 })));
    const seen: LicenseSnapshot[] = [];
    const slot = await makeSlot({ broadcast: (s) => seen.push(s) });
    expect(slot.getSnapshot().status).toBe('licensed');
    await vi.waitFor(() => expect(slot.getSnapshot().status).toBe('grace'), { timeout: 3000 });
    expect(seen.map((s) => s.status)).toEqual(['grace']);
  });
});
