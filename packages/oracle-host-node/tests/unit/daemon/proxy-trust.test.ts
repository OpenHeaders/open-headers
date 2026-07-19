/**
 * Proxy trust-plane laws (PROXY_SECURITY.md §2/§5/§6) — the CA mints
 * once per machine and persists ONLY through the sealed sensitive slot
 * (a cipher-less host refuses, never plaintext); public projections and
 * RPC results carry no key material; leaves are short-lived, signed by
 * the CA, correctly SAN'd; install writes the what-we-changed row
 * BEFORE the store command; System-keychain operations ride the
 * elevated seam and a denial reports `elevationRequired` without
 * retry; status re-probes on every call (never a cached flag) and
 * flags foreign fingerprints as mismatch; teardown removes exactly the
 * recorded rows, drops each only on verified removal, is idempotent
 * over already-gone certs, and releases the sealed CA only when every
 * row is verifiably clean.
 */

import 'reflect-metadata';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { hostStorage, OH, setHostStorage } from '@openheaders/core/storage';
import type { SecretCipher } from '@openheaders/oracle/host-storage';
import * as x509 from '@peculiar/x509';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  certFingerprints,
  ensureProxyCa,
  mintLeafCertificate,
  PROXY_CA_COMMON_NAME,
  proxyCaPublicInfo,
  readProxyCa,
} from '../../../src/daemon/proxy/ca-store';
import type { ExecFn, ExecResult } from '../../../src/daemon/proxy/exec';
import { createProxyTrustService, type ProxyTrustService } from '../../../src/daemon/proxy/proxy-trust';
import { listTrustChanges } from '../../../src/daemon/proxy/trust-record';
import { FileBackedHostStorage } from '../../../src/host-storage';

const b64Cipher: SecretCipher = {
  isAvailable: () => true,
  encrypt: (plaintext) => Buffer.from(plaintext, 'utf8').toString('base64'),
  decrypt: (blob) => Buffer.from(blob, 'base64').toString('utf8'),
};

const deadCipher: SecretCipher = {
  isAvailable: () => false,
  encrypt: () => {
    throw new Error('unreachable');
  },
  decrypt: () => {
    throw new Error('unreachable');
  },
};

interface ExecCall {
  cmd: string;
  args: string[];
}

interface ExecFake {
  exec: ExecFn;
  calls: ExecCall[];
  when(match: (call: ExecCall) => boolean, result: Partial<ExecResult>): void;
}

/** Rule-based exec fake — everything succeeds silently unless a rule matches. */
function createExecFake(): ExecFake {
  const calls: ExecCall[] = [];
  const rules: Array<{ match: (call: ExecCall) => boolean; result: Partial<ExecResult> }> = [];
  const exec: ExecFn = async (cmd, args) => {
    const call = { cmd, args: [...args] };
    calls.push(call);
    const rule = rules.find((r) => r.match(call));
    return { code: 0, stdout: '', stderr: '', ...(rule?.result ?? {}) };
  };
  return { exec, calls, when: (match, result) => rules.push({ match, result }) };
}

let dir: string;
let storageFile: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'oh-proxy-trust-'));
  storageFile = path.join(dir, 'host-storage.json');
  setHostStorage(new FileBackedHostStorage({ filePath: storageFile, secretCipher: b64Cipher }));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function diskEnvelope(): Promise<{ values: Record<string, unknown>; secrets: Record<string, string> }> {
  return JSON.parse(await readFile(storageFile, 'utf8'));
}

describe('ca-store', () => {
  it('mints once per machine and seals the record — key material only in the secrets bucket', async () => {
    const first = await ensureProxyCa();
    const second = await ensureProxyCa();
    expect(certFingerprints(second.certPem).sha256).toBe(certFingerprints(first.certPem).sha256);

    const envelope = await diskEnvelope();
    expect(envelope.secrets['oh.proxyCa']).toBeTypeOf('string');
    expect('oh.proxyCa' in envelope.values).toBe(false);
    expect(await readFile(storageFile, 'utf8')).not.toContain('PRIVATE KEY');
  });

  it('refuses to mint on a cipher-less host — the key is never persisted in plaintext', async () => {
    setHostStorage(new FileBackedHostStorage({ filePath: storageFile, secretCipher: deadCipher }));
    await expect(ensureProxyCa()).rejects.toThrow(/cipher unavailable/);
    expect(await readProxyCa()).toBeNull();
  });

  it('the public projection carries no key material and derives from the cert', async () => {
    const ca = await ensureProxyCa();
    const info = proxyCaPublicInfo(ca);
    expect(Object.keys(info).sort()).toEqual([
      'createdAt',
      'fingerprintSha256',
      'notAfterIso',
      'notBeforeIso',
      'subject',
    ]);
    expect(info.subject).toContain(PROXY_CA_COMMON_NAME);
    expect(info.fingerprintSha256).toBe(certFingerprints(ca.certPem).sha256);
  });

  it('leaves are CA-signed, short-lived, and SAN both DNS names and IP literals', async () => {
    const ca = await ensureProxyCa();
    const leaf = await mintLeafCertificate(ca, ['api.openheaders.io', '127.0.0.1']);
    const leafCert = new x509.X509Certificate(leaf.certPem);
    const caCert = new x509.X509Certificate(ca.certPem);
    expect(await leafCert.verify({ publicKey: caCert })).toBe(true);
    expect(leafCert.issuer).toBe(caCert.subject);
    const validityDays = (leafCert.notAfter.getTime() - leafCert.notBefore.getTime()) / 86_400_000;
    expect(validityDays).toBeLessThan(9);
    const san = leafCert.getExtension(x509.SubjectAlternativeNameExtension);
    const names = san?.names.toJSON() ?? [];
    expect(names).toContainEqual({ type: 'dns', value: 'api.openheaders.io' });
    expect(names).toContainEqual({ type: 'ip', value: '127.0.0.1' });
  });
});

describe('proxy-trust service', () => {
  let fake: ExecFake;
  let elevated: ExecFake;

  function service(): ProxyTrustService {
    return createProxyTrustService({
      exec: fake.exec,
      execElevated: elevated.exec,
      homedir: dir,
      platform: 'darwin',
      tmpdir: dir,
    });
  }

  /** Make the keychain probes answer "our cert, trusted" for `sha256`. */
  function probeAnswersTrusted(sha256: string): void {
    fake.when((c) => c.cmd === 'security' && c.args[0] === 'find-certificate', {
      stdout: `SHA-256 hash: ${sha256.toUpperCase()}\n`,
    });
    fake.when((c) => c.cmd === 'security' && c.args[0] === 'dump-trust-settings', {
      stdout: `Number of trusted certs = 1\nCert 1: ${PROXY_CA_COMMON_NAME}\n`,
    });
  }

  beforeEach(() => {
    fake = createExecFake();
    elevated = createExecFake();
  });

  it('login-keychain install records the row, runs add-trusted-cert unelevated, and reports per store', async () => {
    const result = await service().install(['macos-login-keychain']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.results).toHaveLength(1);
    expect(result.results[0].ok).toBe(true);
    expect(result.results[0].ref).toBe(path.join(dir, 'Library', 'Keychains', 'login.keychain-db'));

    const install = fake.calls.find((c) => c.cmd === 'security' && c.args[0] === 'add-trusted-cert');
    expect(install).toBeDefined();
    expect(install?.args).not.toContain('-d');
    expect(elevated.calls).toHaveLength(0);

    const changes = await listTrustChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0].store).toBe('macos-login-keychain');
    expect(changes[0].fingerprintSha256).toBe(result.ca.fingerprintSha256);
  });

  it('System-keychain install rides the elevated seam with -d; a denial reports elevationRequired and stops', async () => {
    elevated.when((c) => c.args[0] === 'add-trusted-cert', {
      code: 1,
      stderr: 'security: SecTrustSettingsSetTrustSettings: User canceled the operation.',
    });
    // The probe that follows the refusal finds nothing — the row retracts.
    fake.when((c) => c.args[0] === 'find-certificate', { stdout: '' });
    const result = await service().install(['macos-system-keychain']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.results[0].ok).toBe(false);
    expect(result.results[0].elevationRequired).toBe(true);
    const attempted = elevated.calls.find((c) => c.args[0] === 'add-trusted-cert');
    expect(attempted?.args).toContain('-d');
    expect(await listTrustChanges()).toHaveLength(0);
  });

  it('a failed install whose probe still finds our cert keeps the row for teardown to chase', async () => {
    const ca = await ensureProxyCa();
    fake.when((c) => c.args[0] === 'add-trusted-cert', { code: 1, stderr: 'boom' });
    probeAnswersTrusted(certFingerprints(ca.certPem).sha256);
    const result = await service().install(['macos-login-keychain']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.results[0].ok).toBe(false);
    expect(await listTrustChanges()).toHaveLength(1);
  });

  it('nss-firefox installs into every discovered profile via certutil and reports honestly when none exist', async () => {
    const none = await service().install(['nss-firefox']);
    expect(none.ok).toBe(true);
    if (!none.ok) return;
    expect(none.results[0].ok).toBe(false);
    expect(none.results[0].error).toContain('no Firefox profiles');

    const profile = path.join(dir, 'Library', 'Application Support', 'Firefox', 'Profiles', 'abc.default');
    await mkdir(profile, { recursive: true });
    await writeFile(path.join(profile, 'cert9.db'), '');
    const result = await service().install(['nss-firefox']);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.results).toEqual([{ store: 'nss-firefox', ref: profile, ok: true }]);
    const add = fake.calls.find((c) => c.cmd === 'certutil' && c.args[0] === '-A');
    expect(add?.args).toContain(`sql:${profile}`);
    expect(add?.args).toContain('C,,');
  });

  it('status re-probes live on every call — trusted, then absent after the store changes underneath', async () => {
    const ca = await ensureProxyCa();
    const svc = service();
    await svc.install(['macos-login-keychain']);
    probeAnswersTrusted(certFingerprints(ca.certPem).sha256);
    const trusted = await svc.status();
    const login = trusted.stores.find((s) => s.store === 'macos-login-keychain');
    expect(login?.state).toBe('trusted');
    expect(trusted.ca?.fingerprintSha256).toBe(certFingerprints(ca.certPem).sha256);

    fake = createExecFake();
    const rebuilt = service();
    const after = await rebuilt.status();
    expect(after.stores.find((s) => s.store === 'macos-login-keychain')?.state).toBe('absent');
    expect(after.changes).toHaveLength(1);
  });

  it('a foreign fingerprint under our name reads mismatch, never trusted', async () => {
    await ensureProxyCa();
    fake.when((c) => c.args[0] === 'find-certificate', { stdout: `SHA-256 hash: ${'ab'.repeat(32)}\n` });
    const status = await service().status();
    const login = status.stores.find((s) => s.store === 'macos-login-keychain');
    expect(login?.state).toBe('mismatch');
  });

  it('teardown undoes exactly the recorded rows, drops them on verified removal, and releases the CA only then', async () => {
    const svc = service();
    const installed = await svc.install(['macos-login-keychain']);
    expect(installed.ok).toBe(true);
    // Removal succeeds and the follow-up probe finds nothing.
    fake.when((c) => c.args[0] === 'find-certificate', { stdout: '' });
    const removed = await svc.remove(true);
    expect(removed.ok).toBe(true);
    expect(removed.results).toEqual([
      { store: 'macos-login-keychain', ref: path.join(dir, 'Library', 'Keychains', 'login.keychain-db'), ok: true },
    ]);
    expect(fake.calls.some((c) => c.args[0] === 'remove-trusted-cert')).toBe(true);
    expect(fake.calls.some((c) => c.args[0] === 'delete-certificate')).toBe(true);
    expect(await listTrustChanges()).toHaveLength(0);
    expect(await readProxyCa()).toBeNull();
  });

  it('an already-gone cert reads as removed (idempotent teardown)', async () => {
    const svc = service();
    await svc.install(['macos-login-keychain']);
    fake.when((c) => c.args[0] === 'delete-certificate', {
      code: 1,
      stderr: 'security: Unable to delete certificate matching "ABCD"',
    });
    fake.when((c) => c.args[0] === 'find-certificate', { stdout: '' });
    const removed = await svc.remove();
    expect(removed.ok).toBe(true);
    expect(await listTrustChanges()).toHaveLength(0);
  });

  it('a store still trusting the cert after removal keeps its row and fails honestly', async () => {
    const ca = await ensureProxyCa();
    const svc = service();
    await svc.install(['macos-login-keychain']);
    probeAnswersTrusted(certFingerprints(ca.certPem).sha256);
    const removed = await svc.remove(true);
    expect(removed.ok).toBe(false);
    expect(removed.results[0].error).toContain('still trusts');
    expect(await listTrustChanges()).toHaveLength(1);
    // The CA must survive — its cert is what the retry needs.
    expect(await readProxyCa()).not.toBeNull();
    expect(await hostStorage.get(OH.proxyCa)).toBeDefined();
  });

  it('install refuses an empty store list — consent must name stores', async () => {
    const result = await service().install([]);
    expect(result.ok).toBe(false);
  });
});
