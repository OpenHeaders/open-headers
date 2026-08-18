/**
 * Content-addressed blob store shared across ALL capture sessions
 * (the agent-traffic plan §11.4) — the WARC-revisit / git-object answer
 * to "archiving the same site daily repeats the data".
 *
 * One rule: identity is the SHA-256 of the DECODED content — the
 * plaintext digest doubles as the integrity checksum, and encryption
 * or compression never changes what a blob is named. A payload is
 * written once (`wx` exclusive-create on a temp name + rename:
 * idempotent, safe under concurrent sessions — losers of the race
 * simply keep the winner's artifact) and referenced by digest from
 * every session that observes it; thirty daily sessions of one site
 * store its unchanged bundles ONCE.
 *
 * Layout: `<dir>/<aa>/<sha256>` where `aa` is the digest's first two
 * hex chars (the git fan-out, keeps directory listings sane). Each
 * file is an OHS2 container (seal.ts): try-keep-if-smaller brotli —
 * skipped for already-compressed MIME types — then AES-256-GCM when
 * the archive holds a seal key.
 *
 * GC is the ARCHIVE's job (reachability by manifest union, never
 * refcounts); the store only knows how to put, get, list and remove.
 */

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

import { openContainer, sealContainer, sha256Hex } from './seal';

/** How an event log names an out-of-line payload (§11.4 `bodyRef`). */
export interface TrafficBlobRef {
  readonly sha256: string;
  /** Decoded content bytes. */
  readonly bytes: number;
  readonly mime?: string;
}

export interface TrafficBlobPutResult extends TrafficBlobRef {
  /** Whether THIS put wrote the artifact (false = deduplicated). */
  readonly wrote: boolean;
  /** Bytes the artifact occupies on disk (0 when deduplicated). */
  readonly storedBytes: number;
}

/** MIME families whose payloads arrive already entropy-coded — brotli
 *  would burn CPU to grow them. */
const ALREADY_COMPRESSED = /^(image|video|audio)\/|\/(zip|gzip|x-gzip|x-brotli|pdf|octet-stream)|\+zip$/i;

export interface TrafficBlobStore {
  /** Store one decoded payload; dedup by plaintext digest. */
  put(content: Buffer, mime?: string): Promise<TrafficBlobPutResult>;
  /** Read one payload back by digest. `null` = absent. Throws on a
   *  corrupt or key-less-encrypted artifact — decay is never silent. */
  get(sha256: string): Promise<Buffer | null>;
  /** Every digest currently on disk. */
  list(): Promise<string[]>;
  /** Remove one artifact (GC). Missing is fine — idempotent. */
  remove(sha256: string): Promise<void>;
  /** Total on-disk bytes of every artifact (retention accounting). */
  totalBytes(): Promise<number>;
}

const DIGEST_SHAPE = /^[0-9a-f]{64}$/;

export function createTrafficBlobStore(options: { dir: string; sealKey: Buffer | null }): TrafficBlobStore {
  /** Digests with a write in flight — a second put of the same payload
   *  awaits the first instead of racing it on disk. */
  const inFlight = new Map<string, Promise<TrafficBlobPutResult>>();

  function blobPath(sha256: string): string {
    return path.join(options.dir, sha256.slice(0, 2), sha256);
  }

  async function writeOnce(sha256: string, content: Buffer, mime?: string): Promise<TrafficBlobPutResult> {
    const ref: TrafficBlobRef = { sha256, bytes: content.byteLength, ...(mime !== undefined ? { mime } : {}) };
    const filePath = blobPath(sha256);
    try {
      await fsp.access(filePath, fs.constants.F_OK);
      return { ...ref, wrote: false, storedBytes: 0 };
    } catch {
      // Absent — this put writes it.
    }
    const framed = sealContainer(
      content,
      { kind: 'blob', contentBytes: content.byteLength, contentSha256: sha256 },
      options.sealKey,
      { alreadyCompressed: mime !== undefined && ALREADY_COMPRESSED.test(mime) },
    );
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    try {
      await fsp.writeFile(tmp, framed, { flag: 'wx' });
      await fsp.rename(tmp, filePath);
      return { ...ref, wrote: true, storedBytes: framed.byteLength };
    } catch {
      // A concurrent writer (another session, another process) won the
      // race — their artifact decodes to the same content by identity.
      await fsp.rm(tmp, { force: true });
      return { ...ref, wrote: false, storedBytes: 0 };
    }
  }

  return {
    async put(content, mime) {
      const sha256 = sha256Hex(content);
      const pending = inFlight.get(sha256);
      if (pending !== undefined) {
        const settled = await pending;
        return { ...settled, wrote: false, storedBytes: 0 };
      }
      const write = writeOnce(sha256, content, mime).finally(() => inFlight.delete(sha256));
      inFlight.set(sha256, write);
      return write;
    },
    async get(sha256) {
      if (!DIGEST_SHAPE.test(sha256)) return null;
      let framed: Buffer;
      try {
        framed = await fsp.readFile(blobPath(sha256));
      } catch {
        return null;
      }
      return openContainer(framed, options.sealKey).content;
    },
    async list() {
      let fanout: string[];
      try {
        fanout = await fsp.readdir(options.dir);
      } catch {
        return [];
      }
      const digests: string[] = [];
      for (const shard of fanout) {
        if (!/^[0-9a-f]{2}$/.test(shard)) continue;
        try {
          for (const name of await fsp.readdir(path.join(options.dir, shard))) {
            if (DIGEST_SHAPE.test(name)) digests.push(name);
          }
        } catch {
          // Shard vanished mid-listing (concurrent GC) — nothing to list.
        }
      }
      return digests;
    },
    async remove(sha256) {
      if (!DIGEST_SHAPE.test(sha256)) return;
      await fsp.rm(blobPath(sha256), { force: true });
    },
    async totalBytes() {
      let total = 0;
      for (const digest of await this.list()) {
        try {
          total += (await fsp.stat(blobPath(digest))).size;
        } catch {
          // Removed mid-scan — count what remains.
        }
      }
      return total;
    },
  };
}
