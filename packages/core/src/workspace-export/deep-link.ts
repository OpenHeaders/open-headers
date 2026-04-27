/**
 * Deep-link codec for workspace exports.
 *
 * The "Copy as deep link" export destination ships YAML inline in a
 * `#/import/inline/<payload>` workspace-intent hash. To stay under the
 * intent's `IMPORT_INLINE_PAYLOAD_MAX_BYTES` cap (32 KB), we gzip the
 * YAML and base64url-encode the result. The renderer reverses the
 * pipeline before handing the YAML to `parseWorkspaceExport`.
 *
 * **Decompression-bomb defense (design §4.4 + PR 4 §11)**: the decoder
 * accepts a `maxDecompressedBytes` ceiling and aborts mid-stream once
 * the chunked accumulator passes it. Independent of the 50 MB raw cap
 * on `parseWorkspaceExport` — bombs that expand into multi-GB plaintext
 * are stopped here, before bytes even reach the parser.
 *
 * Uses native `CompressionStream` / `DecompressionStream`, available in
 * Chromium 80+, Firefox 113+, Safari 16.4+, and Node 22+. No third-party
 * dependency.
 */

import { base64UrlToBytes, bytesToBase64Url } from './crypto';

/** Default decompression ceiling — well above any plausible legitimate
 *  workspace export, far below memory-pressure thresholds. */
export const DEFAULT_DEEP_LINK_MAX_DECOMPRESSED_BYTES = 4 * 1024 * 1024;

export interface EncodeDeepLinkOptions {
  /** Refuse to emit a payload larger than this (compressed bytes). */
  maxCompressedBytes?: number;
}

export interface DecodeDeepLinkOptions {
  /** Streaming gunzip ceiling — the decoder aborts past this byte count. */
  maxDecompressedBytes?: number;
}

export class DeepLinkPayloadTooLargeError extends Error {
  constructor(
    public readonly compressedBytes: number,
    public readonly limit: number,
  ) {
    super(`Compressed payload (${compressedBytes} bytes) exceeds limit (${limit} bytes).`);
    this.name = 'DeepLinkPayloadTooLargeError';
  }
}

export class DeepLinkDecompressionBombError extends Error {
  constructor(public readonly limit: number) {
    super(`Decompressed payload exceeds limit (${limit} bytes).`);
    this.name = 'DeepLinkDecompressionBombError';
  }
}

/**
 * Copy a Uint8Array into a fresh `ArrayBuffer`-backed view. TypeScript's
 * strict DOM types reject `SharedArrayBuffer`-backed Uint8Arrays as
 * `BlobPart`, and `globalThis.crypto.getRandomValues` widens to
 * `ArrayBufferLike` — so we re-host the bytes in an unambiguous
 * `ArrayBuffer` before handing them to `Blob`.
 */
function toBlobPart(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return copy as Uint8Array<ArrayBuffer>;
}

async function gzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toBlobPart(bytes)]).stream().pipeThrough(new CompressionStream('gzip'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

async function gunzipBytesBounded(compressed: Uint8Array, maxBytes: number): Promise<Uint8Array> {
  // Streaming gunzip with a per-chunk size accumulator. Aborts as soon
  // as a chunk pushes the accumulator past `maxBytes` so a malicious
  // gzip header that promises 4 GB never gets fully expanded.
  const decompressed = new Blob([toBlobPart(compressed)]).stream().pipeThrough(new DecompressionStream('gzip'));
  const reader = decompressed.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        // Cancel the underlying source so we don't keep pulling bytes.
        await reader.cancel().catch(() => undefined);
        throw new DeepLinkDecompressionBombError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * Encode YAML as base64url(gzip(YAML)). The result is what goes into
 * `#/import/inline/<payload>`. Caller is responsible for asserting the
 * encoded length fits the workspace-intent inline cap.
 */
export async function encodeWorkspaceExportDeepLink(yaml: string, opts: EncodeDeepLinkOptions = {}): Promise<string> {
  const compressed = await gzipBytes(new TextEncoder().encode(yaml));
  if (opts.maxCompressedBytes !== undefined && compressed.byteLength > opts.maxCompressedBytes) {
    throw new DeepLinkPayloadTooLargeError(compressed.byteLength, opts.maxCompressedBytes);
  }
  return bytesToBase64Url(compressed);
}

/**
 * Reverse the encode pipeline: base64url → gunzip (bounded) → utf-8.
 * Throws on bomb-cap overflow or on malformed input (invalid base64url
 * or invalid gzip header) — caller surfaces these as a hard error
 * banner in the import preview modal.
 */
export async function decodeWorkspaceExportDeepLink(
  payload: string,
  opts: DecodeDeepLinkOptions = {},
): Promise<string> {
  const maxBytes = opts.maxDecompressedBytes ?? DEFAULT_DEEP_LINK_MAX_DECOMPRESSED_BYTES;
  const compressed = base64UrlToBytes(payload);
  const decompressed = await gunzipBytesBounded(compressed, maxBytes);
  return new TextDecoder('utf-8', { fatal: true }).decode(decompressed);
}
