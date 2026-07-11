/**
 * JWT re-signing — HMAC (HS256/HS384/HS512) via WebCrypto.
 *
 * Async by nature, so it lives OUTSIDE the sync codec spine: the JWT
 * editor modal awaits it when the user supplies a secret, while the
 * compact and document paths keep carrying the original signature.
 * Asymmetric algorithms are out of scope — they need key management
 * that doesn't belong in a value editor.
 */

import { errorMessage, type JsonObject } from '@openheaders/core/types';
import { encodeJWTSigningInput } from './jwt';

export type HmacJwtAlgorithm = 'HS256' | 'HS384' | 'HS512';

const HMAC_HASHES: Record<HmacJwtAlgorithm, string> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512',
};

/** The header's `alg` when it names an HMAC algorithm this module can
 *  sign with, null otherwise (missing, non-string, or non-HMAC). */
export function signableJwtAlgorithm(header: JsonObject): HmacJwtAlgorithm | null {
  const alg = header?.alg;
  return typeof alg === 'string' && alg in HMAC_HASHES ? (alg as HmacJwtAlgorithm) : null;
}

function base64UrlFromBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Signs the encoded `header.payload` with the secret, using the HMAC
 *  algorithm the header's own `alg` names. Throws when the header
 *  names anything else (the caller gates on `signableJwtAlgorithm`)
 *  or when the secret is empty (WebCrypto rejects zero-length keys). */
export async function signJWT(header: JsonObject, payload: JsonObject, secret: string): Promise<string> {
  const algorithm = signableJwtAlgorithm(header);
  if (!algorithm) {
    throw new Error('Failed to sign JWT: header alg must be one of HS256, HS384, HS512');
  }
  try {
    const signingInput = encodeJWTSigningInput(header, payload);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: HMAC_HASHES[algorithm] },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
    return `${signingInput}.${base64UrlFromBytes(new Uint8Array(signature))}`;
  } catch (error) {
    throw new Error(`Failed to sign JWT: ${errorMessage(error)}`);
  }
}
