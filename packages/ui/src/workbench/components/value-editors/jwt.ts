/**
 * JWT codec — decode / re-encode without verification, plus the
 * detection and display helpers the JWT value editor builds on.
 *
 * Re-signing after an edit is intentionally absent: the editor carries
 * the original signature over unchanged and surfaces a "signature no
 * longer valid" warning instead.
 */

import { errorMessage, type JsonObject } from '@openheaders/core/types';

function base64UrlDecode(segment: string): string {
  return atob(segment.replace(/-/g, '+').replace(/_/g, '/'));
}

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export interface DecodedJWT {
  header: JsonObject;
  payload: JsonObject;
  signature: string;
}

/** Decodes a JWT without verifying the signature. Throws on any
 *  structural problem (wrong segment count, non-JSON header/payload). */
export function decodeJWT(token: string): DecodedJWT {
  if (!token) {
    throw new Error('Failed to decode JWT: Invalid token');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Failed to decode JWT: Invalid JWT format');
  }

  try {
    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return { header, payload, signature: parts[2] };
  } catch (error) {
    throw new Error(`Failed to decode JWT: ${errorMessage(error)}`);
  }
}

/** Re-assembles a token from edited header/payload, carrying the
 *  original signature over verbatim (empty when none is supplied). */
export function encodeJWT(header: JsonObject, payload: JsonObject, signature = ''): string {
  try {
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  } catch (error) {
    throw new Error(`Failed to encode JWT: ${errorMessage(error)}`);
  }
}

/** Structural JWT check: three dot-separated segments whose first two
 *  decode to JSON, with a header carrying `alg` or `typ: 'JWT'`. */
export function isJWT(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const parts = value.split('.');
  if (parts.length !== 3) {
    return false;
  }

  try {
    const header = JSON.parse(base64UrlDecode(parts[0]));
    JSON.parse(base64UrlDecode(parts[1]));
    return header && typeof header === 'object' && (header.alg || header.typ === 'JWT');
  } catch {
    return false;
  }
}

export function formatJSON(obj: JsonObject): string {
  return JSON.stringify(obj, null, 2);
}

/** Parses editor JSON, converting the parse error into a readable one. */
export function validateJSON(jsonString: string): JsonObject {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Invalid JSON: ${errorMessage(error)}`);
  }
}

export interface JWTExpirationInfo {
  hasExpiration: boolean;
  isExpired?: boolean;
  expiresAt?: Date;
  expiresIn?: number;
}

/** Reads the `exp` claim (seconds since epoch) into display-ready
 *  expiration facts. */
export function getJWTExpiration(payload: JsonObject): JWTExpirationInfo {
  if (!payload?.exp) {
    return { hasExpiration: false };
  }

  const exp = (payload.exp as number) * 1000;
  const now = Date.now();

  return {
    hasExpiration: true,
    isExpired: exp < now,
    expiresAt: new Date(exp),
    expiresIn: exp - now,
  };
}

/** RFC 7519 registered claims plus the common custom ones — used for
 *  the claim tags under the payload editor. */
export const JWT_CLAIM_DESCRIPTIONS: Record<string, string> = {
  iss: 'Issuer',
  sub: 'Subject',
  aud: 'Audience',
  exp: 'Expiration Time',
  nbf: 'Not Before',
  iat: 'Issued At',
  jti: 'JWT ID',
  email: 'Email',
  name: 'Name',
  role: 'Role',
  scope: 'Scope',
  permissions: 'Permissions',
};
