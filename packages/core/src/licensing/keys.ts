/**
 * Public-key ring — `kid` → base64url-encoded raw 32-byte Ed25519
 * public key.
 *
 * Only public halves live here; private keys are generated offline at
 * the key ceremony and never enter this repo's history. Rotation = add
 * the new `kid`, keep the old one until every license signed with it
 * has lapsed; no flag days. Tests and dev hosts inject their own ring
 * into `verifyLicense`.
 */

export type LicenseKeyRing = Readonly<Record<string, string>>;

export const LICENSE_PUBLIC_KEYS: LicenseKeyRing = Object.freeze({
  'oh-lic-2026a': '1xhllrXFZondb5mxrPXs41HT6dpse_RTETGwaHAy7dc',
});
