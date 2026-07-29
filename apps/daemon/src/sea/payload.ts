/**
 * SEA payload unpacking — the single-binary build embeds file trees as
 * SEA assets: `native` (the better-sqlite3 package compiled for the
 * binary's Node ABI — a native addon cannot load from inside the blob,
 * only from disk), `web` (the built Workbench the daemon serves at
 * `/`), and `helper` (the platform's `oh-h3-helper` — spawned as a
 * child process, so it too must live on disk). This module unpacks
 * them on first use.
 *
 * Layout inside the blob: an `oh-payload.json` manifest (per-kind file
 * lists with sha-256 checksums) plus one asset per file under
 * `payload/<kind>/<relative path>`. `scripts/pack-sea.mjs` stages both.
 *
 * Unpack target: `<platform state dir>/sea/<buildKey>/<kind>` —
 * deliberately keyed by the build, not by `--data-dir`: the unpacked
 * tree is a machine-level artifact of the binary (like the binary
 * itself), so two daemons with different data dirs share one unpack
 * and an upgraded binary never loads a stale addon. The
 * `OH_DAEMON_UNPACK_DIR` environment variable overrides the base for
 * tests and constrained deployments.
 *
 * Unpacking is idempotent and crash-safe: files land in a `.tmp-<pid>`
 * sibling first, every byte is checksum-verified against the manifest,
 * and the completed dir is committed by rename + a marker file written
 * last — a crash mid-unpack leaves no marker, so the next run redoes
 * the work. Contents are identical across processes, so a concurrent
 * double-unpack converges regardless of which writer lands last.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { getAsset, isSea } from 'node:sea';
import { defaultDataDir } from '../config';

export type PayloadKind = 'native' | 'web' | 'helper';

export interface PayloadFileEntry {
  /** Relative path inside the kind's tree, `/`-separated. */
  path: string;
  /** Hex sha-256 of the file's bytes. */
  sha256: string;
  size: number;
}

export interface PayloadManifest {
  /** `<version>-<commit>` — the unpack dir's cache key. */
  buildKey: string;
  kinds: Partial<Record<PayloadKind, PayloadFileEntry[]>>;
}

export const PAYLOAD_MANIFEST_ASSET = 'oh-payload.json';

export function payloadAssetKey(kind: PayloadKind, relativePath: string): string {
  return `payload/${kind}/${relativePath}`;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** The marker content committing a kind dir — hash of its manifest slice. */
function kindStamp(entries: readonly PayloadFileEntry[]): string {
  return sha256Hex(new TextEncoder().encode(JSON.stringify(entries)));
}

export interface ExtractPayloadKindOptions {
  entries: readonly PayloadFileEntry[];
  /** Bytes of one payload file by its manifest-relative path. */
  readFile: (relativePath: string) => Uint8Array;
  /** The kind's final directory; `.ok` marker and `.tmp-*` land beside it. */
  targetDir: string;
}

/**
 * Materialize one payload kind on disk and return its directory.
 * Skips entirely when a marker from a previous run matches the
 * manifest; re-extracts otherwise (including after a mid-write crash).
 */
export function extractPayloadKind(options: ExtractPayloadKindOptions): string {
  const { entries, readFile, targetDir } = options;
  const marker = `${targetDir}.ok`;
  const stamp = kindStamp(entries);
  try {
    if (fs.readFileSync(marker, 'utf8') === stamp && fs.existsSync(targetDir)) return targetDir;
  } catch {
    // No marker — fall through to extraction.
  }

  const tmpDir = `${targetDir}.tmp-${process.pid}`;
  fs.rmSync(tmpDir, { recursive: true, force: true });
  for (const entry of entries) {
    if (entry.path.split('/').some((seg) => seg === '..' || seg === '')) {
      throw new Error(`payload entry escapes its tree: ${entry.path}`);
    }
    const bytes = readFile(entry.path);
    if (bytes.byteLength !== entry.size || sha256Hex(bytes) !== entry.sha256) {
      throw new Error(`payload file ${entry.path} does not match its manifest checksum`);
    }
    const dest = path.join(tmpDir, ...entry.path.split('/'));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, bytes);
  }
  fs.rmSync(marker, { force: true });
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.renameSync(tmpDir, targetDir);
  fs.writeFileSync(marker, stamp);
  return targetDir;
}

let manifestCache: PayloadManifest | null | undefined;

function readManifest(): PayloadManifest | null {
  if (manifestCache === undefined) {
    try {
      const raw = Buffer.from(getAsset(PAYLOAD_MANIFEST_ASSET)).toString('utf8');
      manifestCache = JSON.parse(raw) as PayloadManifest;
    } catch {
      manifestCache = null; // a blob without a payload — every kind absent
    }
  }
  return manifestCache;
}

function unpackBaseDir(buildKey: string): string {
  const override = process.env.OH_DAEMON_UNPACK_DIR;
  const base = override ?? path.join(defaultDataDir(process.platform, process.env, os.homedir()), 'sea');
  return path.join(base, buildKey);
}

/**
 * The on-disk directory of one payload kind, unpacking it first when
 * needed — or null outside a SEA binary, and null for a kind the pack
 * didn't stage (a web-less build serves nothing, as before).
 */
export function ensureSeaPayload(kind: PayloadKind): string | null {
  if (!isSea()) return null;
  const manifest = readManifest();
  const entries = manifest?.kinds[kind];
  if (manifest === null || entries === undefined || entries.length === 0) return null;
  return extractPayloadKind({
    entries,
    readFile: (relativePath) => new Uint8Array(getAsset(payloadAssetKey(kind, relativePath))),
    targetDir: path.join(unpackBaseDir(manifest.buildKey), kind),
  });
}
