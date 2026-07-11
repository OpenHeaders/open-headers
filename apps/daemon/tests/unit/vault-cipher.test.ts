/**
 * Vault cipher — passphrase unlock against the `vault-key.json`
 * sidecar, AES-256-GCM blob round-trips, the wrong-key refusal (never
 * silently re-key), the unconfigured refuse-over-plaintext default,
 * and offline key rotation over a real `storage.json` envelope.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { openVaultCipher, resolveDaemonCipher, rotateVaultKey, VAULT_KEY_FILE } from '../../src/vault-cipher';

const tempDirs: string[] = [];

function makeDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-daemon-vault-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('openVaultCipher', () => {
  it('mints a self-describing key file on first unlock and round-trips', () => {
    const dataDir = makeDataDir();
    const cipher = openVaultCipher(dataDir, 'correct horse battery staple');
    expect(cipher.isAvailable()).toBe(true);

    const keyPath = path.join(dataDir, VAULT_KEY_FILE);
    const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    expect(keyFile).toMatchObject({ version: 1, kdf: 'scrypt' });
    expect(typeof keyFile.n).toBe('number');
    expect(typeof keyFile.salt).toBe('string');
    expect(keyFile.check).toMatch(/^aes-256-gcm\$/);
    expect(fs.statSync(keyPath).mode & 0o777).toBe(0o600);

    const blob = cipher.encrypt('{"vault":"s3cret ✓"}');
    expect(blob).toMatch(/^aes-256-gcm\$/);
    expect(blob.split('$')).toHaveLength(4);
    expect(cipher.decrypt(blob)).toBe('{"vault":"s3cret ✓"}');
  });

  it('uses a fresh IV per encryption', () => {
    const cipher = openVaultCipher(makeDataDir(), 'pass');
    expect(cipher.encrypt('same')).not.toBe(cipher.encrypt('same'));
  });

  it('reuses the existing key file across unlocks', () => {
    const dataDir = makeDataDir();
    const blob = openVaultCipher(dataDir, 'pass').encrypt('durable');
    expect(openVaultCipher(dataDir, 'pass').decrypt(blob)).toBe('durable');
  });

  it('refuses a wrong passphrase at unlock instead of re-keying', () => {
    const dataDir = makeDataDir();
    openVaultCipher(dataDir, 'right');
    const before = fs.readFileSync(path.join(dataDir, VAULT_KEY_FILE), 'utf8');
    expect(() => openVaultCipher(dataDir, 'wrong')).toThrow(/does not match the existing vault key/);
    expect(fs.readFileSync(path.join(dataDir, VAULT_KEY_FILE), 'utf8')).toBe(before);
  });

  it('refuses a tampered or foreign blob', () => {
    const cipher = openVaultCipher(makeDataDir(), 'pass');
    const blob = cipher.encrypt('payload');
    const parts = blob.split('$');
    const tampered = [parts[0], parts[1], parts[2], `${parts[3].slice(0, -2)}AA`].join('$');
    expect(() => cipher.decrypt(tampered)).toThrow();
    expect(() => cipher.decrypt('not-a-blob')).toThrow(/aes-256-gcm-shaped/);
  });

  it('refuses a malformed key file instead of overwriting it', () => {
    const dataDir = makeDataDir();
    fs.writeFileSync(path.join(dataDir, VAULT_KEY_FILE), '{"version":9}');
    expect(() => openVaultCipher(dataDir, 'pass')).toThrow(/not a vault key file/);
  });
});

describe('resolveDaemonCipher', () => {
  it('keeps the refusing default when no passphrase is configured', () => {
    const cipher = resolveDaemonCipher({ dataDir: makeDataDir(), vaultPassphrase: null });
    expect(cipher.isAvailable()).toBe(false);
    expect(() => cipher.encrypt('x')).toThrow(/not configured/);
    expect(fs.existsSync(path.join(tempDirs[tempDirs.length - 1], VAULT_KEY_FILE))).toBe(false);
  });

  it('unlocks the vault cipher when a passphrase is configured', () => {
    const dataDir = makeDataDir();
    const cipher = resolveDaemonCipher({ dataDir, vaultPassphrase: 'pass' });
    expect(cipher.isAvailable()).toBe(true);
    expect(cipher.decrypt(cipher.encrypt('x'))).toBe('x');
  });
});

describe('rotateVaultKey', () => {
  function seedStorage(dataDir: string, secrets: Record<string, string>): string {
    const storagePath = path.join(dataDir, 'storage.json');
    fs.writeFileSync(
      storagePath,
      JSON.stringify({ schemaVersion: 1, values: { 'oh.settings.user': { plain: true } }, secrets }, null, 2),
    );
    return storagePath;
  }

  it('re-encrypts every secret under the new key and leaves plain values alone', () => {
    const dataDir = makeDataDir();
    const oldCipher = openVaultCipher(dataDir, 'old-pass');
    const storagePath = seedStorage(dataDir, {
      'oh.vault.entries': oldCipher.encrypt('"vault-payload"'),
      'oh.oauth.tokens': oldCipher.encrypt('"oauth-payload"'),
    });

    const result = rotateVaultKey(dataDir, 'old-pass', 'new-pass');
    expect(result.reencrypted).toBe(2);

    const envelope = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
    expect(envelope.values).toEqual({ 'oh.settings.user': { plain: true } });
    const newCipher = openVaultCipher(dataDir, 'new-pass');
    expect(newCipher.decrypt(envelope.secrets['oh.vault.entries'])).toBe('"vault-payload"');
    expect(newCipher.decrypt(envelope.secrets['oh.oauth.tokens'])).toBe('"oauth-payload"');
    expect(() => openVaultCipher(dataDir, 'old-pass')).toThrow(/does not match/);
    expect(fs.existsSync(`${storagePath}.pre-rotate`)).toBe(false);
  });

  it('refuses a wrong current passphrase and touches nothing', () => {
    const dataDir = makeDataDir();
    const oldCipher = openVaultCipher(dataDir, 'old-pass');
    const storagePath = seedStorage(dataDir, { 'oh.vault.entries': oldCipher.encrypt('"payload"') });
    const storageBefore = fs.readFileSync(storagePath, 'utf8');
    const keyBefore = fs.readFileSync(path.join(dataDir, VAULT_KEY_FILE), 'utf8');

    expect(() => rotateVaultKey(dataDir, 'wrong', 'new-pass')).toThrow(/does not match/);
    expect(fs.readFileSync(storagePath, 'utf8')).toBe(storageBefore);
    expect(fs.readFileSync(path.join(dataDir, VAULT_KEY_FILE), 'utf8')).toBe(keyBefore);
  });

  it('refuses when no vault key exists yet', () => {
    expect(() => rotateVaultKey(makeDataDir(), 'old', 'new')).toThrow(/never been unlocked/);
  });

  it('rotates the key file alone when storage.json has never been flushed', () => {
    const dataDir = makeDataDir();
    openVaultCipher(dataDir, 'old-pass');
    const result = rotateVaultKey(dataDir, 'old-pass', 'new-pass');
    expect(result.reencrypted).toBe(0);
    expect(openVaultCipher(dataDir, 'new-pass').isAvailable()).toBe(true);
  });
});
