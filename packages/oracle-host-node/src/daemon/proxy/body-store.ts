/**
 * Captured-body plane for the proxy partition (`OBSERVABILITY_PLAN.md`
 * §6 capture contract): bodies stay OUT of the lifecycle rows and are
 * fetched lazily on inspect — the lifeline's `request-body` pull answers
 * from this store with an ordinary `body-attached` update.
 *
 *  - {@link BoundedBodyBuffer} is the wire-path tee: appends are a
 *    bounded copy, never an await — over-cap chunks stop accumulating
 *    (fidelity degrades to a truncated capture), forwarding is untouched.
 *  - {@link ProxyBodyStore} retains per-hop response bodies under a
 *    total-byte LRU bound; an evicted body answers `null` and the pull
 *    is silently unanswerable (the wire contract allows it).
 *  - Content-encoding decode (gzip/deflate/br) happens lazily at resolve
 *    time, never on the capture path; an undecodable or truncated-
 *    encoded body serves the raw bytes as base64 rather than lying.
 */

import * as zlib from 'node:zlib';
import type { InspectorHarBody } from '@openheaders/core/types';

/** Per-body tee cap, each direction — beyond it the capture truncates. */
export const PROXY_BODY_CAPTURE_CAP_BYTES = 512 * 1024;

/** Total out-of-row body retention — least-recently-used bodies evict. */
export const PROXY_BODY_STORE_CAP_BYTES = 32 * 1024 * 1024;

/**
 * Read-ahead bound for judging body-gated rules (the GraphQL filter) —
 * the CDP plane's inline-`postData` bound: a larger request body is
 * never inspected, so a filtered rule does not fire on it.
 */
export const PROXY_BODY_GATE_CAP_BYTES = 64 * 1024;

/** A teed body: the retained prefix plus whether the wire had more. */
export interface CapturedBody {
  readonly bytes: Buffer;
  /** Total bytes observed on the wire (≥ `bytes.length` when truncated). */
  readonly totalBytes: number;
  readonly truncated: boolean;
}

/** Wire-path tee — bounded appends, cheap, synchronous. */
export class BoundedBodyBuffer {
  private readonly chunks: Buffer[] = [];
  private retained = 0;
  private total = 0;

  constructor(private readonly capBytes: number) {}

  push(chunk: Buffer): void {
    this.total += chunk.length;
    if (this.retained >= this.capBytes) return;
    const room = this.capBytes - this.retained;
    const kept = chunk.length <= room ? chunk : chunk.subarray(0, room);
    this.chunks.push(Buffer.from(kept));
    this.retained += kept.length;
  }

  snapshot(): CapturedBody {
    return {
      bytes: Buffer.concat(this.chunks),
      totalBytes: this.total,
      truncated: this.total > this.retained,
    };
  }
}

/** One retained response body plus the identity facts the HAR-body wire shape carries. */
export interface RetainedBody {
  readonly method: string;
  readonly url: string;
  readonly startedAtMs: number;
  readonly body: CapturedBody;
  /** The response's `Content-Encoding` value, lower-cased; `undefined` = identity. */
  readonly contentEncoding?: string;
}

/** The retention seam the capture mapper writes through. */
export interface ProxyBodyRetainer {
  retain(requestId: string, hopIndex: number, entry: RetainedBody): void;
}

const bodyKey = (requestId: string, hopIndex: number): string => `${requestId}#${hopIndex}`;

/** Decode a content-encoded capture; `null` = encoding unknown or corrupt. */
export function decodeContentEncoding(bytes: Buffer, encoding: string): Buffer | null {
  try {
    if (encoding === 'gzip' || encoding === 'x-gzip') return zlib.gunzipSync(bytes);
    if (encoding === 'deflate') return zlib.inflateSync(bytes);
    if (encoding === 'br') return zlib.brotliDecompressSync(bytes);
  } catch {
    return null;
  }
  return null;
}

const utf8Strict = new TextDecoder('utf-8', { fatal: true });

/** UTF-8-valid bytes serve as text (`encoding: ''`); anything else as base64. */
export function shapeBodyContent(bytes: Buffer): { content: string; encoding: '' | 'base64' } {
  try {
    return { content: utf8Strict.decode(bytes), encoding: '' };
  } catch {
    return { content: bytes.toString('base64'), encoding: 'base64' };
  }
}

export class ProxyBodyStore implements ProxyBodyRetainer {
  /** Insertion order = recency order (re-inserted on read). */
  private readonly entries = new Map<string, RetainedBody>();
  private retainedBytes = 0;

  constructor(private readonly capBytes: number = PROXY_BODY_STORE_CAP_BYTES) {}

  retain(requestId: string, hopIndex: number, entry: RetainedBody): void {
    const key = bodyKey(requestId, hopIndex);
    const prior = this.entries.get(key);
    if (prior !== undefined) {
      this.entries.delete(key);
      this.retainedBytes -= prior.body.bytes.length;
    }
    // A single body over the whole store cap is unretainable, not a purge
    // of everything else.
    if (entry.body.bytes.length > this.capBytes) return;
    this.entries.set(key, entry);
    this.retainedBytes += entry.body.bytes.length;
    for (const [oldest, value] of this.entries) {
      if (this.retainedBytes <= this.capBytes) break;
      this.entries.delete(oldest);
      this.retainedBytes -= value.body.bytes.length;
    }
  }

  /**
   * Shape the retained body into the HAR-body wire form, decoding the
   * content-encoding lazily. `null` = never captured or already evicted.
   * A truncated encoded capture cannot decode; it serves raw base64 so
   * the viewer still gets honest bytes rather than nothing.
   */
  resolve(requestId: string, hopIndex: number): InspectorHarBody | null {
    const key = bodyKey(requestId, hopIndex);
    const entry = this.entries.get(key);
    if (entry === undefined) return null;
    // LRU touch.
    this.entries.delete(key);
    this.entries.set(key, entry);

    let bytes = entry.body.bytes;
    if (entry.contentEncoding !== undefined && entry.contentEncoding !== 'identity') {
      const decoded = entry.body.truncated ? null : decodeContentEncoding(bytes, entry.contentEncoding);
      if (decoded !== null) bytes = decoded;
    }
    const { content, encoding } = shapeBodyContent(bytes);
    return {
      method: entry.method,
      url: entry.url,
      startedDateTime: new Date(entry.startedAtMs).toISOString(),
      content,
      encoding,
    };
  }

  clear(): void {
    this.entries.clear();
    this.retainedBytes = 0;
  }
}
