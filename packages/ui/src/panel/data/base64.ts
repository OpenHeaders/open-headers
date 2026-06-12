/**
 * Base64 helpers shared by the body and message-stream viewers.
 */

/** Decode a base64 string to raw bytes. Throws on malformed input. */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Decoded byte length of a base64 payload, without decoding it. Three
 * bytes per four characters, minus the `=` padding.
 */
export function base64ByteLength(b64: string): number {
  if (b64.length === 0) return 0;
  let padding = 0;
  if (b64.endsWith('==')) padding = 2;
  else if (b64.endsWith('=')) padding = 1;
  return Math.floor((b64.length / 4) * 3) - padding;
}
