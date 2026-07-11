/**
 * License artifact composition — the signing side of the wire format
 * documented in `verify.ts`. Lives in the shipped module (not test
 * code) because it is the ONE composer every issuer shares: the
 * enterprise signing script, the control-plane Worker, and the dev/test
 * signers all mint through here, so the signed bytes can never drift
 * from what `verifyLicense` checks. No key material lives in this
 * module — callers bring their own `CryptoKey`.
 */

import { encodeBase64Url } from './encoding';
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
 * Compose + sign one license artifact. `claims` is deliberately
 * `unknown`: issuers sign well-formed `License` objects, tests also
 * mint schema-drifted payloads to prove the verifier refuses them.
 */
export async function signLicense(claims: unknown, privateKey: CryptoKey): Promise<string> {
  const payloadSegment = encodeBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign('Ed25519', privateKey, new TextEncoder().encode(payloadSegment));
  return `${LICENSE_PREFIX}.${payloadSegment}.${encodeBase64Url(new Uint8Array(signature))}`;
}
