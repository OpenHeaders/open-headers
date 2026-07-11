/**
 * Passphrase-derived vault cipher for the headless daemon (enterprise
 * Phase 6) — `node:crypto` only, no new dependency. A scrypt-derived
 * key encrypts sensitive slots (vault/oauth) in `storage.json` as
 * AES-256-GCM blobs:
 *
 *   aes-256-gcm$<iv-base64url>$<tag-base64url>$<ciphertext-base64url>
 *
 * KDF parameters live in a `vault-key.json` sidecar in the data dir —
 * self-describing (same idea as the password verifier format), so cost
 * parameters can be raised later without invalidating existing vaults —
 * together with a key-check blob that makes a wrong passphrase fail AT
 * UNLOCK: the daemon refuses to boot rather than running against slots
 * it would corrupt on write, and it never silently re-keys. Without a
 * configured passphrase the standing refuse-over-plaintext posture
 * holds (`noCipherYet`).
 *
 * Shared by the daemon entry and the sqlite-free CLI (the offline
 * mint / user / config commands open the same `storage.json`): both
 * unlock from the same env, and a CLI run without the passphrase simply
 * stays cipher-less — none of those commands touch sensitive slots.
 * Rotation (`ohd vault rotate`) re-encrypts the envelope's
 * `secrets` bucket wholesale under a fresh key, offline, single-writer.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SecretCipher } from '@openheaders/oracle/host-storage';
import type { DaemonConfig } from './config';
import { noCipherYet } from './no-cipher';

const SCHEME = 'aes-256-gcm';
const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
/** N·r·128 bytes plus headroom — node refuses the derivation when the work area exceeds `maxmem`. */
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
/** Known plaintext the key file's `check` blob encrypts — a wrong passphrase fails here, at unlock. */
const KEY_CHECK = 'openheaders-vault-key-check';

export const VAULT_KEY_FILE = 'vault-key.json';

interface VaultKeyFile {
  version: number;
  kdf: string;
  n: number;
  r: number;
  p: number;
  /** base64url KDF salt. */
  salt: string;
  /** Encrypted {@link KEY_CHECK} blob. */
  check: string;
}

function deriveKey(passphrase: string, salt: Buffer, n: number, r: number, p: number): Buffer {
  return scryptSync(passphrase, salt, KEY_LENGTH, { N: n, r, p, maxmem: SCRYPT_MAXMEM });
}

function encryptWithKey(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(SCHEME, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [SCHEME, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('$');
}

function decryptWithKey(key: Buffer, blob: string): string {
  const parts = blob.split('$');
  if (parts.length !== 4 || parts[0] !== SCHEME) {
    throw new Error(`vault blob is not ${SCHEME}-shaped`);
  }
  const iv = Buffer.from(parts[1], 'base64url');
  const tag = Buffer.from(parts[2], 'base64url');
  const ciphertext = Buffer.from(parts[3], 'base64url');
  if (iv.length !== IV_LENGTH || tag.length !== 16) {
    throw new Error(`vault blob is not ${SCHEME}-shaped`);
  }
  const decipher = createDecipheriv(SCHEME, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function readKeyFile(keyPath: string): VaultKeyFile | null {
  let text: string;
  try {
    text = fs.readFileSync(keyPath, 'utf8');
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${keyPath}: not a vault key file — refusing to re-key over it; restore it or remove it`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${keyPath}: not a vault key file — refusing to re-key over it; restore it or remove it`);
  }
  const record = parsed as Record<string, unknown>;
  if (
    record.version !== 1 ||
    record.kdf !== 'scrypt' ||
    typeof record.n !== 'number' ||
    typeof record.r !== 'number' ||
    typeof record.p !== 'number' ||
    typeof record.salt !== 'string' ||
    typeof record.check !== 'string'
  ) {
    throw new Error(`${keyPath}: not a vault key file — refusing to re-key over it; restore it or remove it`);
  }
  return {
    version: record.version,
    kdf: record.kdf,
    n: record.n,
    r: record.r,
    p: record.p,
    salt: record.salt,
    check: record.check,
  };
}

function writeFileAtomic(filePath: string, body: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, body, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, filePath);
}

function mintKeyFile(passphrase: string): { file: VaultKeyFile; key: Buffer } {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(passphrase, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  const file: VaultKeyFile = {
    version: 1,
    kdf: 'scrypt',
    n: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    salt: salt.toString('base64url'),
    check: encryptWithKey(key, KEY_CHECK),
  };
  return { file, key };
}

function verifyKeyFile(keyPath: string, file: VaultKeyFile, passphrase: string): Buffer {
  const key = deriveKey(passphrase, Buffer.from(file.salt, 'base64url'), file.n, file.r, file.p);
  let opened: string;
  try {
    opened = decryptWithKey(key, file.check);
  } catch {
    throw new Error(
      `vault passphrase does not match the existing vault key (${keyPath}) — ` +
        'refusing to run; the vault is never silently re-keyed. Fix the passphrase, ' +
        'or rotate it offline with the current one: ohd vault rotate',
    );
  }
  const expected = Buffer.from(KEY_CHECK, 'utf8');
  const actual = Buffer.from(opened, 'utf8');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error(`${keyPath}: key check decrypted to an unexpected value — the key file is corrupt`);
  }
  return key;
}

/**
 * Derive the vault key against the data dir's `vault-key.json`. A
 * missing key file is minted on first configured use (`create: true` —
 * the daemon/CLI unlock path) or refused (`create: false` — rotation,
 * which must never invent the key it claims to replace). A present one
 * verifies the passphrase via the key-check blob and throws on
 * mismatch.
 */
function unlockVaultKey(dataDir: string, passphrase: string, create: boolean): Buffer {
  const keyPath = path.join(dataDir, VAULT_KEY_FILE);
  const existing = readKeyFile(keyPath);
  if (existing !== null) return verifyKeyFile(keyPath, existing, passphrase);
  if (!create) {
    throw new Error(`no vault key exists at ${keyPath} — the vault has never been unlocked; nothing to rotate`);
  }
  const { file, key } = mintKeyFile(passphrase);
  writeFileAtomic(keyPath, JSON.stringify(file, null, 2));
  return key;
}

/** The configured cipher: unlocks (or mints) the vault key, then encrypts per-blob with fresh IVs. */
export function openVaultCipher(dataDir: string, passphrase: string): SecretCipher {
  const key = unlockVaultKey(dataDir, passphrase, true);
  return {
    isAvailable: () => true,
    encrypt: (plaintext) => encryptWithKey(key, plaintext),
    decrypt: (blob) => decryptWithKey(key, blob),
  };
}

/**
 * The cipher every `storage.json` consumer wires: the vault cipher when
 * a passphrase is configured, else the refusing default — sensitive
 * slots never downgrade to plaintext.
 */
export function resolveDaemonCipher(config: Pick<DaemonConfig, 'dataDir' | 'vaultPassphrase'>): SecretCipher {
  if (config.vaultPassphrase === null) return noCipherYet;
  return openVaultCipher(config.dataDir, config.vaultPassphrase);
}

export interface RotateVaultResult {
  /** How many sensitive slots were re-encrypted under the new key. */
  reencrypted: number;
}

/**
 * Offline key rotation: verify the old passphrase, mint a fresh
 * salt+key from the new one, re-encrypt every blob in the envelope's
 * `secrets` bucket, then replace `storage.json` and `vault-key.json`
 * (each write atomic). The caller holds the stopped-daemon
 * single-writer guard. A pre-rotation copy of `storage.json` is kept
 * at `storage.json.pre-rotate` for the crash window between the two
 * file replacements and removed on success — an interrupted rotation
 * is recovered by restoring it (the old key file is only replaced
 * last).
 */
export function rotateVaultKey(dataDir: string, oldPassphrase: string, newPassphrase: string): RotateVaultResult {
  const oldKey = unlockVaultKey(dataDir, oldPassphrase, false);
  const { file: newKeyFile, key: newKey } = mintKeyFile(newPassphrase);

  const storagePath = path.join(dataDir, 'storage.json');
  const backupPath = `${storagePath}.pre-rotate`;
  let envelopeText: string | null = null;
  try {
    envelopeText = fs.readFileSync(storagePath, 'utf8');
  } catch {
    envelopeText = null; // never-flushed data dir: only the key file rotates
  }

  let reencrypted = 0;
  if (envelopeText !== null) {
    const parsed: unknown = JSON.parse(envelopeText);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${storagePath}: expected a JSON object`);
    }
    const envelope = parsed as Record<string, unknown>;
    const secrets = envelope.secrets;
    if (secrets !== null && typeof secrets === 'object' && !Array.isArray(secrets)) {
      const next: Record<string, string> = {};
      for (const [slot, blob] of Object.entries(secrets)) {
        if (typeof blob !== 'string') continue;
        next[slot] = encryptWithKey(newKey, decryptWithKey(oldKey, blob));
        reencrypted += 1;
      }
      envelope.secrets = next;
    }
    fs.copyFileSync(storagePath, backupPath);
    fs.chmodSync(backupPath, 0o600);
    writeFileAtomic(storagePath, JSON.stringify(envelope, null, 2));
  }

  writeFileAtomic(path.join(dataDir, VAULT_KEY_FILE), JSON.stringify(newKeyFile, null, 2));
  if (envelopeText !== null) fs.rmSync(backupPath, { force: true });
  return { reencrypted };
}
