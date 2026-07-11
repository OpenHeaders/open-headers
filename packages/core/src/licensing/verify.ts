/**
 * `verifyLicense` — the one verification path (`LICENSING_PLAN.md` §3).
 *
 * Wire format (decided slice 1): a compact three-segment string,
 *
 *   oh-license.<base64url(claims JSON)>.<base64url(Ed25519 signature)>
 *
 * The signature is computed over the ASCII bytes of the base64url
 * payload *segment* (JWS-style), never over re-serialized JSON — no
 * canonicalization step exists to get wrong. Whitespace anywhere in the
 * text is stripped before parsing, so the same artifact works as a
 * pasteable one-liner and as a line-wrapped file.
 *
 * Pure function of (text, now, ring): WebCrypto Ed25519, no I/O, no
 * clock reads — runs identically in Electron main, daemon Node, and any
 * browser context. Hosts own file loading, "no license present"
 * (`unlicensed`), and what to do with the result; the verifier only
 * judges the text it was handed.
 */

import * as v from 'valibot';
import { decodeBase64Url } from './encoding';
import { LICENSE_PUBLIC_KEYS, type LicenseKeyRing } from './keys';
import { LicenseSchema } from './schema';
import type { VerifyResult } from './types';

/** First segment of every license artifact. */
export const LICENSE_PREFIX = 'oh-license';

const ED25519_SIGNATURE_BYTES = 64;
const ED25519_PUBLIC_KEY_BYTES = 32;
const MS_PER_DAY = 86_400_000;

export async function verifyLicense(
  text: string,
  now: Date,
  ring: LicenseKeyRing = LICENSE_PUBLIC_KEYS,
): Promise<VerifyResult> {
  const compact = text.replace(/\s+/g, '');
  const segments = compact.split('.');
  if (segments.length !== 3 || segments[0] !== LICENSE_PREFIX) {
    return { status: 'invalid', reason: 'malformed' };
  }
  const [, payloadSegment, signatureSegment] = segments;

  const payloadBytes = decodeBase64Url(payloadSegment);
  const signature = decodeBase64Url(signatureSegment);
  if (payloadBytes === null || signature === null || signature.length !== ED25519_SIGNATURE_BYTES) {
    return { status: 'invalid', reason: 'malformed' };
  }

  let claims: unknown;
  try {
    claims = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return { status: 'invalid', reason: 'malformed' };
  }

  const parsed = v.safeParse(LicenseSchema, claims);
  if (!parsed.success) return { status: 'invalid', reason: 'schema-mismatch' };
  const license = parsed.output;

  const ringEntry = ring[license.kid];
  const publicKeyBytes = ringEntry === undefined ? null : decodeBase64Url(ringEntry);
  if (publicKeyBytes === null || publicKeyBytes.length !== ED25519_PUBLIC_KEY_BYTES) {
    return { status: 'invalid', reason: 'unknown-kid' };
  }

  let signatureValid = false;
  try {
    const publicKey = await crypto.subtle.importKey('raw', publicKeyBytes, { name: 'Ed25519' }, false, ['verify']);
    signatureValid = await crypto.subtle.verify(
      'Ed25519',
      publicKey,
      signature,
      new TextEncoder().encode(payloadSegment),
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) return { status: 'invalid', reason: 'bad-signature' };

  const nowMs = now.getTime();
  const graceEndsAt = license.validUntil + license.graceDays * MS_PER_DAY;
  const status = nowMs <= license.validUntil ? 'licensed' : nowMs <= graceEndsAt ? 'grace' : 'expired';
  return { status, license, graceEndsAt };
}
