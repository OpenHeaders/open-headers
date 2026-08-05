/**
 * Sealed-artifact framing + seal-key acquisition for the sessions
 * archive (AGENT_TRAFFIC_PLAN.md §11.4/§11.5, §9.5 confirmed).
 *
 * One container format serves both artifact kinds — content-addressed
 * blobs and sealed event logs:
 *
 *   magic(4) `OHS2` · version(1) · flags(1: bit0 brotli, bit1 aes-gcm)
 *   · headerLen(4 LE) · header JSON · [iv(12) · tag(16) when encrypted]
 *   · payload
 *
 * The header JSON is PLAINTEXT metadata (never secret): the artifact
 * kind, the decoded content's byte count and — for sealed logs — the
 * §11.4 trailer facts (event/request counts, the log's SHA-256). The
 * payload is compress-then-encrypt: brotli only when it actually
 * shrinks the content (try-keep-if-smaller), AES-256-GCM with a fresh
 * random nonce per artifact when a key is present. Identity and
 * integrity ride the PLAINTEXT digest — encryption never changes what
 * a blob is named, only what its bytes look like at rest (§11.5).
 *
 * Key posture (the §9.5 decision, 2026-08-05):
 *
 *   - The ACTIVE event log stays plaintext until seal — authenticated
 *     encryption cannot be crash-safely appended. The threat model is
 *     file-level exfiltration of the data dir (backups, cloud sync),
 *     not a compromised user account.
 *   - Desktop: a random 32-byte key, wrapped by the host's
 *     {@link SecretCipher} (Electron `safeStorage` — OS keychain) and
 *     stored wrapped inside the data dir ({@link
 *     loadOrCreateWrappedSealKey}).
 *   - Headless daemon (no safeStorage): a raw 0600 key file OUTSIDE
 *     the data dir ({@link loadOrCreateSealKeyFile}) — the config-dir
 *     path, so a data-dir exfiltration alone never carries the key.
 *     The same helper is the desktop's fallback when the OS keychain
 *     is unavailable (Linux without a keyring).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { brotliCompressSync, brotliDecompressSync, constants as zlibConstants } from 'node:zlib';

import type { SecretCipher } from '@openheaders/oracle/host-storage';

/** Archive root under the host's data dir (`<dataDir>/traffic-sessions`). */
export const TRAFFIC_SESSIONS_DIR_NAME = 'traffic-sessions';
/** The safeStorage-WRAPPED key blob (desktop; lives inside the archive
 *  root — ciphertext under the OS keychain). */
export const TRAFFIC_SEAL_WRAPPED_KEY_FILE = 'seal.key';
/** Raw key files, per host, under the shared `openheaders` CONFIG dir
 *  — outside every data dir by construction. */
export const TRAFFIC_SEAL_KEY_FILE_DESKTOP = 'desktop-traffic-seal.key';
export const TRAFFIC_SEAL_KEY_FILE_DAEMON = 'daemon-traffic-seal.key';

/**
 * Segments of the shared `openheaders` config directory — join with
 * the host's `path.join(...)`. Mirrors the CLI-config precedence
 * (`cliConfigPathSegments`): `$XDG_CONFIG_HOME` wins on every
 * platform, then `%APPDATA%` on Windows, then `~/.config`. Raw seal
 * key files live here because it is outside every data dir.
 */
export function trafficSealKeyConfigSegments(
  env: Readonly<Record<string, string | undefined>>,
  homedir: string,
  platform: string,
): readonly string[] {
  if (env.XDG_CONFIG_HOME !== undefined && env.XDG_CONFIG_HOME !== '') {
    return [env.XDG_CONFIG_HOME, 'openheaders'];
  }
  if (platform === 'win32' && env.APPDATA !== undefined && env.APPDATA !== '') {
    return [env.APPDATA, 'openheaders'];
  }
  return [homedir, '.config', 'openheaders'];
}

const MAGIC = Buffer.from('OHS2', 'ascii');
const FORMAT_VERSION = 1;
const FLAG_BROTLI = 0b0000_0001;
const FLAG_AES_GCM = 0b0000_0010;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
export const SEAL_KEY_LENGTH = 32;

/** Speed over ratio: session logs and bodies are written on live
 *  paths; brotli's large window still flattens header/URL repetition
 *  at this quality without stalling the process. */
const BROTLI_QUALITY = 5;

/** Plaintext facts the container self-describes. `counts` carries the
 *  §11.4 sealed-log trailer (events/requests + the log digest); blobs
 *  omit it. */
export interface SealedContainerHeader {
  readonly kind: 'blob' | 'session-log';
  /** Decoded (decompressed, decrypted) content byte count. */
  readonly contentBytes: number;
  /** SHA-256 hex of the decoded content — the integrity check and,
   *  for blobs, the CAS identity. */
  readonly contentSha256: string;
  readonly counts?: { readonly events: number; readonly requests: number };
}

export function sha256Hex(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function brotliTryCompress(content: Buffer): { payload: Buffer; compressed: boolean } {
  const compressed = brotliCompressSync(content, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
      [zlibConstants.BROTLI_PARAM_SIZE_HINT]: content.byteLength,
    },
  });
  return compressed.byteLength < content.byteLength
    ? { payload: compressed, compressed: true }
    : { payload: content, compressed: false };
}

/**
 * Frame one artifact: try-keep-if-smaller brotli, then AES-256-GCM
 * when a key is present. `alreadyCompressed` skips the brotli attempt
 * (already-compressed MIME types — recompressing wastes the write path
 * for nothing).
 */
export function sealContainer(
  content: Buffer,
  header: SealedContainerHeader,
  key: Buffer | null,
  options?: { alreadyCompressed?: boolean },
): Buffer {
  const { payload, compressed } =
    options?.alreadyCompressed === true ? { payload: content, compressed: false } : brotliTryCompress(content);
  let flags = compressed ? FLAG_BROTLI : 0;
  const headerJson = Buffer.from(JSON.stringify(header), 'utf8');
  const headerLen = Buffer.alloc(4);
  headerLen.writeUInt32LE(headerJson.byteLength);
  const prefix = Buffer.concat([MAGIC, Buffer.from([FORMAT_VERSION, 0]), headerLen, headerJson]);
  if (key === null) {
    prefix[5] = flags;
    return Buffer.concat([prefix, payload]);
  }
  flags |= FLAG_AES_GCM;
  prefix[5] = flags;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  return Buffer.concat([prefix, iv, cipher.getAuthTag(), ciphertext]);
}

export interface OpenedContainer {
  readonly header: SealedContainerHeader;
  readonly content: Buffer;
  readonly encrypted: boolean;
}

/**
 * Unframe one artifact: decrypt (GCM tag verifies), decompress, then
 * verify the decoded content against the header's digest — a corrupt
 * or tampered artifact throws, never returns garbage.
 */
export function openContainer(framed: Buffer, key: Buffer | null): OpenedContainer {
  if (framed.byteLength < 10 || !framed.subarray(0, 4).equals(MAGIC)) {
    throw new Error('not an OHS2 sealed container');
  }
  if (framed[4] !== FORMAT_VERSION) throw new Error(`unknown sealed-container version ${framed[4]}`);
  const flags = framed[5] ?? 0;
  const headerLen = framed.readUInt32LE(6);
  const headerEnd = 10 + headerLen;
  const header = JSON.parse(framed.subarray(10, headerEnd).toString('utf8')) as SealedContainerHeader;
  let payload: Buffer;
  const encrypted = (flags & FLAG_AES_GCM) !== 0;
  if (encrypted) {
    if (key === null) throw new Error('container is encrypted and no seal key is available');
    const iv = framed.subarray(headerEnd, headerEnd + IV_LENGTH);
    const tag = framed.subarray(headerEnd + IV_LENGTH, headerEnd + IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    payload = Buffer.concat([decipher.update(framed.subarray(headerEnd + IV_LENGTH + TAG_LENGTH)), decipher.final()]);
  } else {
    payload = framed.subarray(headerEnd);
  }
  const content = (flags & FLAG_BROTLI) !== 0 ? brotliDecompressSync(payload) : payload;
  if (sha256Hex(content) !== header.contentSha256) {
    throw new Error('sealed container content does not match its digest');
  }
  return { header, content, encrypted };
}

function writeKeyFileAtomic(filePath: string, body: Buffer | string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, body, { mode: 0o600 });
  fs.renameSync(tmp, filePath);
}

/**
 * Raw key file (base64, 0600, directory 0700) — the headless daemon's
 * posture and the desktop's no-keychain fallback. The path MUST sit
 * outside the data dir (the caller owns the placement — see the module
 * header). Returns `null` only when the file cannot be created or is
 * unreadable garbage — the caller records sessions with an honest
 * `encrypted: false` stamp rather than refusing to record.
 */
export function loadOrCreateSealKeyFile(filePath: string): Buffer | null {
  try {
    const existing = Buffer.from(fs.readFileSync(filePath, 'utf8').trim(), 'base64');
    if (existing.byteLength === SEAL_KEY_LENGTH) return existing;
    return null;
  } catch {
    // Fall through to mint.
  }
  try {
    const key = randomBytes(SEAL_KEY_LENGTH);
    writeKeyFileAtomic(filePath, `${key.toString('base64')}\n`);
    return key;
  } catch {
    return null;
  }
}

/**
 * SecretCipher-wrapped key file — the §11.5 "app-held
 * safeStorage-wrapped key". The wrapped blob may live INSIDE the data
 * dir: it is ciphertext under the OS keychain, so a data-dir
 * exfiltration carries nothing usable. When the cipher is unavailable
 * (Linux without a keyring) the caller falls back to
 * {@link loadOrCreateSealKeyFile} at a path outside the data dir.
 */
export function loadOrCreateWrappedSealKey(filePath: string, cipher: SecretCipher): Buffer | null {
  if (!cipher.isAvailable()) return null;
  try {
    const key = Buffer.from(cipher.decrypt(fs.readFileSync(filePath, 'utf8').trim()), 'base64');
    if (key.byteLength === SEAL_KEY_LENGTH) return key;
    return null;
  } catch {
    // Fall through to mint.
  }
  try {
    const key = randomBytes(SEAL_KEY_LENGTH);
    writeKeyFileAtomic(filePath, `${cipher.encrypt(key.toString('base64'))}\n`);
    return key;
  } catch {
    return null;
  }
}
