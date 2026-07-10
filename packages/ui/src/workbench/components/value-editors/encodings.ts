/**
 * Encoding codecs + heuristics for the value-type detectors — base64
 * (standard and url-safe alphabets) and %XX URL-encoding. Pure text
 * helpers; the detector registry in `detect.ts` builds on these.
 *
 * Base64 detection is heuristic by nature (any alphanumeric run is
 * charset-valid), so it demands real evidence before claiming a hit:
 * minimum length, alphabet-specific shape checks, strict UTF-8
 * decodability, and a printable result. A missed value costs nothing
 * (no edit icon); a false hit puts a useless icon on the rail.
 */

const BASE64_STD = /^[A-Za-z0-9+/]+={0,2}$/;
const BASE64_URL = /^[A-Za-z0-9_-]+$/;
const MIN_BASE64_LENGTH = 16;
// Control characters other than \t \n \r — a decode containing any is
// binary, not editable text.
function hasUnprintable(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x7f) return true;
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) return true;
  }
  return false;
}

export interface DecodedBase64 {
  decoded: string;
  /** `-_` alphabet (vs `+/`). Preserved on re-encode. */
  urlSafe: boolean;
  /** Whether the original carried `=` padding. Preserved on re-encode. */
  padded: boolean;
}

/** Attempts to read `value` as base64-encoded UTF-8 text. Returns null
 *  unless the value passes the shape heuristics AND decodes to clean
 *  printable text. */
export function tryDecodeBase64(value: string): DecodedBase64 | null {
  if (value.length < MIN_BASE64_LENGTH) return null;
  let urlSafe: boolean;
  if (BASE64_STD.test(value) && value.length % 4 === 0) {
    urlSafe = false;
  } else if (BASE64_URL.test(value) && /[-_]/.test(value)) {
    // The url-safe alphabet without its `-`/`_` marks is
    // indistinguishable from a plain word — require at least one.
    urlSafe = true;
  } else {
    return null;
  }
  const std = urlSafe ? value.replace(/-/g, '+').replace(/_/g, '/') : value;
  const paddedInput = std.padEnd(Math.ceil(std.length / 4) * 4, '=');
  let bytes: Uint8Array;
  try {
    const binary = atob(paddedInput);
    bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  if (!decoded || hasUnprintable(decoded)) return null;
  return { decoded, urlSafe, padded: value.includes('=') };
}

/** Re-encodes text to base64 in the same shape the original had —
 *  alphabet and padding both preserved so a round-trip is stable. */
export function encodeBase64(text: string, shape: { urlSafe: boolean; padded: boolean }): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  let encoded = btoa(binary);
  if (shape.urlSafe) encoded = encoded.replace(/\+/g, '-').replace(/\//g, '_');
  if (!shape.padded) encoded = encoded.replace(/=/g, '');
  return encoded;
}

/** Attempts to read `value` as a %XX URL-encoded component. Requires
 *  at least one escape sequence and a decode that actually changes the
 *  text. `+` is left alone — whether it means space is a form-encoding
 *  convention the field can't know. */
export function tryDecodeUrlComponent(value: string): string | null {
  if (!/%[0-9A-Fa-f]{2}/.test(value)) return null;
  try {
    const decoded = decodeURIComponent(value);
    return decoded !== value ? decoded : null;
  } catch {
    return null;
  }
}
