/**
 * JWT Bearer request signing (RFC 7519 / 7515) — mints and signs a
 * fresh compact JWT per send from locally held key material, for the
 * API class that refuses static tokens (short-lived self-signed JWTs:
 * app installations, push-provider tokens, admin APIs).
 *
 * Pure WebCrypto like the other signers, on both runtimes: HMAC for
 * HS*, RSASSA-PKCS1-v1_5 for RS*, RSA-PSS for PS*, and ECDSA
 * P-256/384/521 for ES* — WebCrypto's raw `r‖s` ECDSA output is
 * already the JOSE signature format. Private keys arrive as PEM (or
 * bare base64 DER): PKCS#8 imports natively; PKCS#1 RSA and SEC1 EC
 * bodies are wrapped into PKCS#8 with a mechanical DER prefix — no
 * ASN.1 parsing. The parser ignores ALL whitespace, so a
 * newline-stripped paste still imports. Encrypted keys are refused by
 * name.
 *
 * The protected header is `{ typ: 'JWT', …user headers, alg }` — the
 * user's extra headers (`kid` is the real use case) merge over `typ`
 * but never `alg`: a header naming a different algorithm than the one
 * that signed can never verify. When `expiresInSeconds` is set the
 * claims are stamped `iat`/`exp` at sign time — payload-set claims
 * always win; absent = the payload rides verbatim.
 *
 * Callers sign at EXECUTE time like the other schemes; the clock
 * (`timestampSec`) is injected so tests can pin claims.
 */

import { decodeBase64Bytes, encodeBase64Bytes } from '../utils/base64';

export const JWT_ALGORITHMS = [
  'HS256',
  'HS384',
  'HS512',
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
  'ES256',
  'ES384',
  'ES512',
] as const;

export type JwtAlgorithm = (typeof JWT_ALGORITHMS)[number];

export function isJwtAlgorithm(value: string | undefined): value is JwtAlgorithm {
  return value !== undefined && (JWT_ALGORITHMS as readonly string[]).includes(value);
}

export interface JwtCredentials {
  algorithm: JwtAlgorithm;
  /** HS family — the HMAC secret. */
  secret: string;
  /** The secret is base64-encoded key material; decode before keying. */
  secretBase64?: boolean;
  /** RS / PS / ES families — the PEM (or bare base64 DER) private key. */
  privateKey: string;
  /** Claims JSON text — empty signs `{}`. */
  payload: string;
  /** Extra protected-header JSON text (`kid`, …). */
  headers?: string;
  /** Scheme ahead of the token in the Authorization header. Absent =
   *  `Bearer`; explicitly empty = the bare token. */
  headerPrefix?: string;
  /** Where the token rides — the Authorization header or a `token`
   *  query param. */
  addTo: 'header' | 'query';
  /** Stamp `iat` = now and `exp` = now + lifetime into the claims at
   *  sign time (payload-set claims win). Absent = no injection. */
  expiresInSeconds?: number;
}

export interface JwtSignInput {
  /** Unix seconds — injected so tests can pin the stamped claims. */
  timestampSec: number;
}

/** Either `headers` or `queryParams` is populated, never both — the
 *  caller applies whichever without narrowing on the config. */
export interface JwtSignResult {
  headers: Array<{ key: string; value: string }>;
  /** Pairs to append to the URL's query (values NOT yet encoded). */
  queryParams: Array<{ key: string; value: string }>;
}

export async function signJwtBearer(credentials: JwtCredentials, input: JwtSignInput): Promise<JwtSignResult> {
  const userHeaders = parseJsonObject(credentials.headers, 'JWT headers');
  const userClaims = parseJsonObject(credentials.payload, 'JWT payload');

  const header: Record<string, unknown> = { typ: 'JWT', ...userHeaders, alg: credentials.algorithm };
  const claims: Record<string, unknown> =
    credentials.expiresInSeconds === undefined
      ? userClaims
      : { iat: input.timestampSec, exp: input.timestampSec + credentials.expiresInSeconds, ...userClaims };

  const encoder = new TextEncoder();
  const signingInput = `${base64Url(encoder.encode(JSON.stringify(header)))}.${base64Url(
    encoder.encode(JSON.stringify(claims)),
  )}`;
  const signature = await sign(credentials, encoder.encode(signingInput));
  const jwt = `${signingInput}.${base64Url(signature)}`;

  if (credentials.addTo === 'query') {
    return { headers: [], queryParams: [{ key: 'token', value: jwt }] };
  }
  const prefix = credentials.headerPrefix ?? 'Bearer';
  return {
    headers: [{ key: 'Authorization', value: prefix === '' ? jwt : `${prefix} ${jwt}` }],
    queryParams: [],
  };
}

function parseJsonObject(text: string | undefined, what: string): Record<string, unknown> {
  const trimmed = text?.trim() ?? '';
  if (trimmed === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    throw new Error(`${what} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${what} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

// ── Signing families ───────────────────────────────────────────────

const HASH_BY_BITS: Record<'256' | '384' | '512', 'SHA-256' | 'SHA-384' | 'SHA-512'> = {
  '256': 'SHA-256',
  '384': 'SHA-384',
  '512': 'SHA-512',
};

const CURVE_BY_BITS: Record<'256' | '384' | '512', 'P-256' | 'P-384' | 'P-521'> = {
  '256': 'P-256',
  '384': 'P-384',
  '512': 'P-521',
};

async function sign(credentials: JwtCredentials, data: Uint8Array): Promise<Uint8Array> {
  const family = credentials.algorithm.slice(0, 2) as 'HS' | 'RS' | 'PS' | 'ES';
  const bits = credentials.algorithm.slice(2) as '256' | '384' | '512';
  const hash = HASH_BY_BITS[bits];

  if (family === 'HS') {
    let keyBytes: Uint8Array;
    if (credentials.secretBase64 === true) {
      const decoded = decodeBase64Bytes(credentials.secret);
      if (decoded === null) throw new Error('The secret is not valid base64');
      keyBytes = decoded;
    } else {
      keyBytes = new TextEncoder().encode(credentials.secret);
    }
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes as Uint8Array<ArrayBuffer>,
      { name: 'HMAC', hash },
      false,
      ['sign'],
    );
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, data as Uint8Array<ArrayBuffer>));
  }

  const der = pemToPkcs8(credentials.privateKey, family === 'ES' ? CURVE_BY_BITS[bits] : null);
  if (family === 'ES') {
    const key = await crypto.subtle.importKey(
      'pkcs8',
      der as Uint8Array<ArrayBuffer>,
      { name: 'ECDSA', namedCurve: CURVE_BY_BITS[bits] },
      false,
      ['sign'],
    );
    // WebCrypto ECDSA emits the raw fixed-width r‖s pair — exactly the
    // JOSE signature format (a DER-emitting signer would need
    // re-encoding here).
    return new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash }, key, data as Uint8Array<ArrayBuffer>));
  }
  const name = family === 'PS' ? 'RSA-PSS' : 'RSASSA-PKCS1-v1_5';
  const key = await crypto.subtle.importKey('pkcs8', der as Uint8Array<ArrayBuffer>, { name, hash }, false, ['sign']);
  // RFC 7518 §3.5 — the PSS salt is as long as the hash output.
  const params = family === 'PS' ? { name, saltLength: Number(bits) / 8 } : { name };
  return new Uint8Array(await crypto.subtle.sign(params, key, data as Uint8Array<ArrayBuffer>));
}

function base64Url(bytes: Uint8Array): string {
  return encodeBase64Bytes(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── PEM → PKCS#8 DER ───────────────────────────────────────────────

/**
 * Accepts PKCS#8 (`BEGIN PRIVATE KEY`) verbatim, wraps PKCS#1
 * (`BEGIN RSA PRIVATE KEY`) and SEC1 (`BEGIN EC PRIVATE KEY`) bodies
 * into a PKCS#8 PrivateKeyInfo, and takes armor-less input as bare
 * base64 PKCS#8 DER. Whitespace anywhere is ignored. Exported so
 * tests can pin the wrapping against real keys.
 */
export function pemToPkcs8(pem: string, curve: 'P-256' | 'P-384' | 'P-521' | null): Uint8Array {
  if (/BEGIN ENCRYPTED PRIVATE KEY/.test(pem) || /Proc-Type:\s*4,\s*ENCRYPTED/i.test(pem)) {
    throw new Error('Encrypted private keys are not supported — decrypt the key first');
  }
  const block = /-----BEGIN ([A-Z0-9 ]+)-----([^-]+)-----END \1-----/.exec(pem);
  const label = block ? block[1] : null;
  const body = decodeBase64Bytes((block ? block[2] : pem).replace(/\s+/g, ''));
  if (body === null || body.length === 0) {
    throw new Error('The private key is not valid PEM or base64 DER');
  }
  if (label === null || label === 'PRIVATE KEY') return body;
  if (label === 'RSA PRIVATE KEY') return wrapPkcs8(RSA_ALGORITHM_IDENTIFIER, body);
  if (label === 'EC PRIVATE KEY') {
    if (curve === null) throw new Error('An EC private key needs an ES algorithm');
    return wrapPkcs8(ecAlgorithmIdentifier(curve), body);
  }
  throw new Error(`Unsupported private key type "${label}"`);
}

// AlgorithmIdentifier SEQUENCEs, pre-encoded:
// rsaEncryption (1.2.840.113549.1.1.1) with NULL params.
const RSA_ALGORITHM_IDENTIFIER = new Uint8Array([
  0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
]);
// id-ecPublicKey (1.2.840.10045.2.1) with the named-curve OID params.
const EC_CURVE_OIDS: Record<'P-256' | 'P-384' | 'P-521', Uint8Array> = {
  'P-256': new Uint8Array([0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]),
  'P-384': new Uint8Array([0x06, 0x05, 0x2b, 0x81, 0x04, 0x00, 0x22]),
  'P-521': new Uint8Array([0x06, 0x05, 0x2b, 0x81, 0x04, 0x00, 0x23]),
};

function ecAlgorithmIdentifier(curve: 'P-256' | 'P-384' | 'P-521'): Uint8Array {
  const idEcPublicKey = new Uint8Array([0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]);
  return derSequence([idEcPublicKey, EC_CURVE_OIDS[curve]]);
}

/** PrivateKeyInfo ::= SEQUENCE { version 0, algorithm, OCTET STRING key }. */
function wrapPkcs8(algorithmIdentifier: Uint8Array, keyDer: Uint8Array): Uint8Array {
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const key = derTagged(0x04, keyDer);
  return derSequence([version, algorithmIdentifier, key]);
}

function derSequence(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const content = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    content.set(p, offset);
    offset += p.length;
  }
  return derTagged(0x30, content);
}

function derTagged(tag: number, content: Uint8Array): Uint8Array {
  const length = derLength(content.length);
  const out = new Uint8Array(1 + length.length + content.length);
  out[0] = tag;
  out.set(length, 1);
  out.set(content, 1 + length.length);
  return out;
}

function derLength(n: number): Uint8Array {
  if (n < 0x80) return new Uint8Array([n]);
  const bytes: number[] = [];
  let rest = n;
  while (rest > 0) {
    bytes.unshift(rest & 0xff);
    rest >>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}
