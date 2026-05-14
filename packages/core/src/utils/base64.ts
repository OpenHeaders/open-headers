/**
 * Platform-safe base64.
 *
 * Prefers the Web primitives (`btoa` / `atob`, present in browsers and
 * in Node 16+) and falls back to Node's `Buffer` otherwise. The Node
 * global is reached through `globalThis` with a local structural type
 * so `@openheaders/core` stays free of any platform type dependency.
 */

interface NodeBufferLike {
  toString(encoding: string): string;
}
interface NodeBufferCtor {
  from(input: string, encoding: string): NodeBufferLike;
  from(input: Uint8Array): NodeBufferLike;
}

const nodeBuffer = (globalThis as { Buffer?: NodeBufferCtor }).Buffer;

/** Standard base64 of a UTF-8 string. */
export function encodeBase64(input: string): string {
  if (typeof btoa === 'function') return btoa(input);
  if (nodeBuffer) return nodeBuffer.from(input, 'utf-8').toString('base64');
  throw new Error('No base64 encoder available in this environment');
}

/** Standard base64 of raw bytes. */
export function encodeBase64Bytes(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }
  if (nodeBuffer) return nodeBuffer.from(bytes).toString('base64');
  throw new Error('No base64 encoder available in this environment');
}

/** Decode standard base64 to a UTF-8 string; returns `null` on malformed input. */
export function decodeBase64(value: string): string | null {
  try {
    if (typeof atob === 'function') return atob(value);
    if (nodeBuffer) return nodeBuffer.from(value, 'base64').toString('utf8');
    return null;
  } catch {
    return null;
  }
}
