/**
 * License artifact composition — the signing side of the wire format
 * documented in `verify.ts`. Lives in the shipped module (not test
 * code) because it is the ONE composer every issuer shares: the
 * enterprise signing script, the control-plane Worker, and the dev/test
 * signers all mint through here, so the signed bytes can never drift
 * from what `verifyLicense` checks. No key material lives in this
 * module — callers bring their own `CryptoKey`.
 */

import { decodeBase64Url, encodeBase64Url } from './encoding';
import { LICENSE_PREFIX } from './verify';

/**
 * Generate a fresh Ed25519 pair for license signing. Production runs
 * this at the key ceremony (private half stays offline); tests mint
 * throwaway pairs per signer.
 */
export async function generateLicenseSigningKeys(): Promise<{
  privateKey: CryptoKey;
  /** Ring-entry encoding of the public half — base64url raw 32 bytes. */
  publicKeyBase64Url: string;
}> {
  const generated = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  if (!('privateKey' in generated)) throw new Error('Ed25519 generateKey did not return a key pair');
  const publicKeyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', generated.publicKey));
  return { privateKey: generated.privateKey, publicKeyBase64Url: encodeBase64Url(publicKeyBytes) };
}

/**
 * Serialize a signing key for storage — base64url-encoded PKCS#8, one
 * line. The one at-rest format every key holder shares: the ceremony's
 * offline file, the control-plane secret, and the enterprise script's
 * key file all round-trip through this pair.
 */
export async function exportLicenseSigningKey(privateKey: CryptoKey): Promise<string> {
  return encodeBase64Url(new Uint8Array(await crypto.subtle.exportKey('pkcs8', privateKey)));
}

/** Load a signing key serialized by {@link exportLicenseSigningKey}. */
export async function importLicenseSigningKey(base64Url: string): Promise<CryptoKey> {
  const bytes = decodeBase64Url(base64Url.trim());
  if (bytes === null) throw new Error('license signing key is not valid base64url');
  return crypto.subtle.importKey('pkcs8', bytes, { name: 'Ed25519' }, true, ['sign']);
}

/**
 * Derive the ring-entry encoding of a signing key's public half —
 * base64url raw 32 bytes, same as `generateLicenseSigningKeys` returns.
 * Lets issuers self-verify what they mint without carrying the public
 * key separately (an Ed25519 private JWK embeds it as `x`).
 */
export async function publicKeyFromSigningKey(privateKey: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', privateKey);
  if (typeof jwk.x !== 'string' || jwk.x.length === 0) {
    throw new Error('signing key JWK carries no public half');
  }
  return jwk.x;
}

/**
 * Compose + sign one license artifact. `claims` is deliberately
 * `unknown`: issuers sign well-formed `License` objects, tests also
 * mint schema-drifted payloads to prove the verifier refuses them.
 */
export async function signLicense(claims: unknown, privateKey: CryptoKey): Promise<string> {
  const payloadSegment = encodeBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign('Ed25519', privateKey, new TextEncoder().encode(payloadSegment));
  return `${LICENSE_PREFIX}.${payloadSegment}.${encodeBase64Url(new Uint8Array(signature))}`;
}
