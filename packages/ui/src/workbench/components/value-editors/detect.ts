/**
 * Value-type detection — classifies a field's raw value so callers can
 * offer the matching editor on the TemplateInput action rail. Shaped as
 * a detector registry: each detector inspects the value and returns its
 * typed descriptor or null; the first hit wins. Registered today: JWT,
 * data URIs, cookie strings, CSP directive lists, %XX URL-encoding,
 * Unix timestamps, hex text, JSON string literals, JSON values, base64
 * text. Order matters — a JWT is base64url-shaped, a hex string is
 * base64-charset-valid, and cookie values / data-URI payloads often
 * embed %XX escapes, so each must claim the value before the looser
 * detector sees it.
 */

import {
  tryDecodeBase64,
  tryDecodeCookieList,
  tryDecodeCspList,
  tryDecodeDataUri,
  tryDecodeHex,
  tryDecodeJsonString,
  tryDecodeJsonValue,
  tryDecodeTimestamp,
  tryDecodeUrlComponent,
} from './encodings';
import { isJWT } from './jwt';

export interface DetectedJWT {
  type: 'jwt';
  /** The bare token — any `Bearer ` prefix stripped. */
  token: string;
  /** Whatever preceded the token (e.g. `Bearer `), preserved so an
   *  edited token can be written back into the same shape. */
  prefix: string;
}

export interface DetectedUrlEncoded {
  type: 'url-encoded';
  decoded: string;
}

export interface DetectedBase64 {
  type: 'base64';
  decoded: string;
  /** Alphabet + padding shape of the original — preserved on re-encode. */
  urlSafe: boolean;
  padded: boolean;
  /** Whatever preceded the encoded run (e.g. `Basic `), preserved so a
   *  re-encoded value is written back into the same shape. */
  prefix: string;
}

export interface DetectedHex {
  type: 'hex';
  decoded: string;
  /** Digit case of the original — preserved on re-encode. */
  uppercase: boolean;
}

export interface DetectedTimestamp {
  type: 'timestamp';
  /** UTC ISO-8601 rendering of the epoch value. */
  iso: string;
  /** Seconds vs milliseconds resolution — preserved on re-encode. */
  unit: 's' | 'ms';
}

export interface DetectedJsonValue {
  type: 'json';
  /** Pretty-printed rendering for editing. */
  decoded: string;
  /** Original shape — compact stays compact on re-encode. */
  pretty: boolean;
}

export interface DetectedJsonString {
  type: 'json-string';
  /** The unescaped inner text of the string literal. */
  decoded: string;
}

export interface DetectedDataUri {
  type: 'data-uri';
  /** The payload as editable text. */
  decoded: string;
  /** MIME type + params between `data:` and the comma — preserved. */
  meta: string;
  /** Base64 payload (vs percent-encoded) — preserved. */
  base64: boolean;
}

export interface DetectedCookie {
  type: 'cookie';
  /** One `name=value` / attribute segment per line. */
  decoded: string;
}

export interface DetectedCsp {
  type: 'csp';
  /** One policy directive per line. */
  decoded: string;
}

export type DetectedValue =
  | DetectedJWT
  | DetectedDataUri
  | DetectedCookie
  | DetectedCsp
  | DetectedUrlEncoded
  | DetectedBase64
  | DetectedHex
  | DetectedTimestamp
  | DetectedJsonValue
  | DetectedJsonString;

type Detector = (value: string) => DetectedValue | null;

const BEARER_PREFIX = /^(\s*Bearer\s+)(.+)$/i;
const BASIC_PREFIX = /^(\s*Basic\s+)(.+)$/i;

function detectJWT(value: string): DetectedJWT | null {
  const match = value.match(BEARER_PREFIX);
  const prefix = match ? match[1] : '';
  const candidate = match ? match[2] : value;
  return isJWT(candidate) ? { type: 'jwt', token: candidate, prefix } : null;
}

function detectUrlEncoded(value: string): DetectedUrlEncoded | null {
  const decoded = tryDecodeUrlComponent(value);
  return decoded !== null ? { type: 'url-encoded', decoded } : null;
}

function detectTimestamp(value: string): DetectedTimestamp | null {
  const hit = tryDecodeTimestamp(value);
  return hit ? { type: 'timestamp', ...hit } : null;
}

function detectHex(value: string): DetectedHex | null {
  const hit = tryDecodeHex(value);
  return hit ? { type: 'hex', ...hit } : null;
}

function detectBase64(value: string): DetectedBase64 | null {
  const match = value.match(BASIC_PREFIX);
  const prefix = match ? match[1] : '';
  const candidate = match ? match[2] : value;
  const hit = tryDecodeBase64(candidate);
  return hit ? { type: 'base64', ...hit, prefix } : null;
}

function detectDataUri(value: string): DetectedDataUri | null {
  const hit = tryDecodeDataUri(value);
  return hit ? { type: 'data-uri', ...hit } : null;
}

function detectCookie(value: string): DetectedCookie | null {
  const decoded = tryDecodeCookieList(value);
  return decoded !== null ? { type: 'cookie', decoded } : null;
}

function detectCsp(value: string): DetectedCsp | null {
  const decoded = tryDecodeCspList(value);
  return decoded !== null ? { type: 'csp', decoded } : null;
}

function detectJsonString(value: string): DetectedJsonString | null {
  const decoded = tryDecodeJsonString(value);
  return decoded !== null ? { type: 'json-string', decoded } : null;
}

function detectJsonValue(value: string): DetectedJsonValue | null {
  const hit = tryDecodeJsonValue(value);
  return hit ? { type: 'json', ...hit } : null;
}

const DETECTORS: Detector[] = [
  detectJWT,
  detectDataUri,
  detectCsp,
  detectCookie,
  detectUrlEncoded,
  detectTimestamp,
  detectHex,
  detectJsonString,
  detectJsonValue,
  detectBase64,
];

/** Classifies `value`, returning the first detector hit or null when no
 *  known value type matches (including template values — a `{{ref}}`
 *  never passes any detector's shape check, so refs fall through
 *  naturally). */
export function detectValueType(value: string | undefined): DetectedValue | null {
  if (!value) return null;
  for (const detect of DETECTORS) {
    const hit = detect(value);
    if (hit) return hit;
  }
  return null;
}
