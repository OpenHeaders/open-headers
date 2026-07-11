/**
 * Compact codec — the single decode/encode spine behind every editor
 * that edits a detected value as ONE decoded text: the inline
 * `CompactValueEditor`, the encoded-value modal, and the panel's
 * value-document tab. `decoded` is the seed text (JWTs edit
 * payload-only — header and signature carry over verbatim), `encode`
 * re-encodes an edit back into the field's shape with the detected
 * prefix carried (`Bearer `, `Basic `, data-URI meta), and null from
 * `encode` means the text can't encode for the value type — Save stays
 * disabled on it. Pure: no React, no Monaco.
 */

import type { DetectedValue } from './detect';
import {
  encodeBase64,
  encodeCookieList,
  encodeCspList,
  encodeDataUri,
  encodeHex,
  encodeJsonString,
  encodeJsonValue,
  encodeTimestamp,
} from './encodings';
import {
  encodeAcceptList,
  encodeAuthParams,
  encodeCacheControl,
  encodeContentDisposition,
  encodeHsts,
  encodeHttpDate,
  encodeLinkHeader,
  encodeQueryString,
} from './header-values';
import { decodeJWT, encodeJWT, formatJSON, validateJSON } from './jwt';

/** Editor titles per detected type — the JWT title reflects the
 *  payload-only edit these single-text editors perform (the two-pane
 *  header/payload split belongs to the JWT modal). */
export const COMPACT_VALUE_TITLES: Record<DetectedValue['type'], string> = {
  jwt: 'JWT payload',
  'url-encoded': 'URL-encoded value',
  base64: 'Base64 value',
  hex: 'Hex-encoded value',
  timestamp: 'Unix timestamp',
  json: 'JSON value',
  'json-string': 'Quoted string',
  'data-uri': 'Data URI',
  cookie: 'Cookie value',
  csp: 'Content Security Policy',
  'http-date': 'HTTP date',
  'query-string': 'Query string',
  'cache-control': 'Cache-Control',
  hsts: 'Strict-Transport-Security',
  'content-disposition': 'Content-Disposition',
  link: 'Link header',
  'auth-params': 'Authorization parameters',
  'accept-list': 'Accept list',
};

/** The decoded seed text for a single-text edit — JWTs seed the
 *  formatted payload, epoch/date types their ISO rendering. */
export function compactDecodedText(detected: DetectedValue): string {
  if (detected.type === 'jwt') return formatJSON(decodeJWT(detected.token).payload);
  return detected.type === 'timestamp' || detected.type === 'http-date' ? detected.iso : detected.decoded;
}

/**
 * Re-encode edited decoded text back into the detected value's shape.
 * Preview AND save go through this, so what a preview shows is exactly
 * what lands in the field — prefix included. Null means the text can't
 * encode (e.g. an unparsable date, a non-object JWT payload).
 */
export function encodeDetectedValue(detected: DetectedValue, text: string): string | null {
  switch (detected.type) {
    case 'jwt': {
      // Payload-only edit: header and signature carry over verbatim,
      // unsigned (same write-back the JWT modal does).
      try {
        const payload = validateJSON(text);
        if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null;
        const { header, signature } = decodeJWT(detected.token);
        return `${detected.prefix}${encodeJWT(header, payload, signature)}`;
      } catch {
        return null;
      }
    }
    case 'base64':
      return `${detected.prefix}${encodeBase64(text, detected)}`;
    case 'hex':
      return encodeHex(text, detected);
    case 'timestamp':
      return encodeTimestamp(text, detected);
    case 'json':
      return encodeJsonValue(text, detected);
    case 'json-string':
      return encodeJsonString(text);
    case 'data-uri':
      return encodeDataUri(text, detected);
    case 'cookie':
      return encodeCookieList(text);
    case 'csp':
      return encodeCspList(text);
    case 'http-date':
      return encodeHttpDate(text);
    case 'query-string':
      return encodeQueryString(text);
    case 'cache-control':
      return encodeCacheControl(text);
    case 'hsts':
      return encodeHsts(text);
    case 'content-disposition':
      return encodeContentDisposition(text);
    case 'link':
      return encodeLinkHeader(text);
    case 'auth-params':
      return encodeAuthParams(text, detected);
    case 'accept-list':
      return encodeAcceptList(text);
    default:
      return encodeURIComponent(text);
  }
}
