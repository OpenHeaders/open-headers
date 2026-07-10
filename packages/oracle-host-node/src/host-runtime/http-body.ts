/**
 * Bounded request-body reader for the daemon's small-payload HTTP
 * surfaces (pairing confirm, OIDC claim). Both bounds are hard:
 *
 *   - size — these routes carry at most a few hundred bytes of JSON or
 *     form data; anything past `maxBytes` is hostile or broken.
 *   - time — a peer that opens the request and trickles (or never
 *     sends) the body would otherwise hold the socket for as long as
 *     Node's server-wide `requestTimeout` allows. The deadline covers
 *     the whole read, not per-chunk, so a slow-loris drip can't reset
 *     it.
 *
 * Either violation destroys the socket and rejects; callers already
 * treat a rejected read as an empty body and refuse the request.
 */

import type { IncomingMessage } from 'node:http';

const DEFAULT_MAX_BYTES = 4096;
const DEFAULT_TIMEOUT_MS = 10_000;

export interface ReadRawBodyOptions {
  readonly maxBytes?: number;
  readonly timeoutMs?: number;
}

export function readRawBody(req: IncomingMessage, options: ReadRawBodyOptions = {}): Promise<string> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    const deadline = setTimeout(() => {
      req.destroy();
      reject(new Error('request body read timed out'));
    }, timeoutMs);
    deadline.unref();
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        clearTimeout(deadline);
        req.destroy();
        reject(new Error('request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      clearTimeout(deadline);
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    req.on('error', (err) => {
      clearTimeout(deadline);
      reject(err);
    });
  });
}
