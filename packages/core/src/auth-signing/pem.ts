/**
 * PEM private-key import for the WebCrypto signers (JWT Bearer, OAuth1
 * RSA-*): PKCS#8 (`BEGIN PRIVATE KEY`) imports verbatim; PKCS#1
 * (`BEGIN RSA PRIVATE KEY`) and SEC1 (`BEGIN EC PRIVATE KEY`) bodies
 * are wrapped into a PKCS#8 PrivateKeyInfo with a mechanical DER
 * prefix — no ASN.1 parsing. Whitespace anywhere is ignored, so a
 * newline-stripped paste still imports; armor-less input is taken as
 * bare base64 PKCS#8 DER. A PKCS#8 body whose algorithm is
 * id-RSASSA-PSS (the shape `openssl genpkey -algorithm RSA-PSS` and
 * RFC 9421's test key carry) is re-wrapped under rsaEncryption — the
 * inner key is the same RSAPrivateKey, and WebCrypto imports only the
 * rsaEncryption identifier. Encrypted keys are refused by name.
 */

import { decodeBase64Bytes } from '../utils/base64';

/**
 * PEM (or bare base64 DER) → PKCS#8 DER. `curve` names the EC curve a
 * SEC1 body wraps with — `null` for RSA-only callers, turning an EC
 * key into an honest refusal. Exported so tests can pin the wrapping
 * against real keys.
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
  if (label === null || label === 'PRIVATE KEY') return rsaPssToRsaEncryption(body) ?? body;
  if (label === 'RSA PRIVATE KEY') return wrapPkcs8(RSA_ALGORITHM_IDENTIFIER, body);
  if (label === 'EC PRIVATE KEY') {
    if (curve === null) throw new Error('The selected algorithm needs an RSA private key, not an EC key');
    return wrapPkcs8(ecAlgorithmIdentifier(curve), body);
  }
  throw new Error(`Unsupported private key type "${label}"`);
}

// id-RSASSA-PSS (1.2.840.113549.1.1.10) — the OID a PSS-flavored
// PKCS#8 names; its parameters vary, so only the OID is matched.
const RSA_PSS_OID = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0a]);

/**
 * A PKCS#8 PrivateKeyInfo whose AlgorithmIdentifier is id-RSASSA-PSS,
 * re-wrapped under rsaEncryption; `null` for any other body (left
 * verbatim). Walks the three top-level elements — version, algorithm,
 * the OCTET STRING key — with the mechanical TLV reader.
 */
function rsaPssToRsaEncryption(body: Uint8Array): Uint8Array | null {
  const outer = readTlv(body, 0);
  if (outer === null || outer.tag !== 0x30) return null;
  const version = readTlv(body, outer.contentStart);
  if (version === null || version.tag !== 0x02) return null;
  const algorithm = readTlv(body, version.end);
  if (algorithm === null || algorithm.tag !== 0x30) return null;
  const oid = body.subarray(algorithm.contentStart, algorithm.contentStart + RSA_PSS_OID.length);
  if (oid.length !== RSA_PSS_OID.length || !oid.every((b, i) => b === RSA_PSS_OID[i])) return null;
  const key = readTlv(body, algorithm.end);
  if (key === null || key.tag !== 0x04) return null;
  return wrapPkcs8(RSA_ALGORITHM_IDENTIFIER, body.subarray(key.contentStart, key.end));
}

/** One DER TLV at `offset`: its tag, where its content starts and
 *  where the element ends. `null` when the bytes run out. */
function readTlv(bytes: Uint8Array, offset: number): { tag: number; contentStart: number; end: number } | null {
  if (offset + 2 > bytes.length) return null;
  const tag = bytes[offset];
  let length = bytes[offset + 1];
  let contentStart = offset + 2;
  if (length & 0x80) {
    const count = length & 0x7f;
    if (count === 0 || count > 4 || contentStart + count > bytes.length) return null;
    length = 0;
    for (let i = 0; i < count; i++) length = (length << 8) | bytes[contentStart + i];
    contentStart += count;
  }
  const end = contentStart + length;
  return end > bytes.length ? null : { tag, contentStart, end };
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
