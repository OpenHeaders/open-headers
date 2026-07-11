/**
 * base64url (RFC 4648 §5, unpadded) over raw bytes — the encoding of
 * both segments of the license wire format. Self-contained on
 * `btoa`/`atob` (present in every runtime we ship to, Node 22 included)
 * rather than `utils/base64`, whose decoder is UTF-8-string-oriented
 * and would mangle binary signature bytes.
 */

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode unpadded base64url to raw bytes; returns `null` on malformed input. */
export function decodeBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!BASE64URL_PATTERN.test(text)) return null;
  const std = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = std + '='.repeat((4 - (std.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const out = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}
