/**
 * Public-key ring — `kid` → base64url-encoded raw 32-byte Ed25519
 * public key.
 *
 * Empty until the production key ceremony (the private key is generated
 * offline when the control plane / first enterprise issuance lands, and
 * only the public half is committed here). Rotation = add the new
 * `kid`, keep the old one until every license signed with it has
 * lapsed; no flag days. Private keys never enter this repo's history —
 * tests and dev hosts inject their own ring into `verifyLicense`.
 */

export type LicenseKeyRing = Readonly<Record<string, string>>;

export const LICENSE_PUBLIC_KEYS: LicenseKeyRing = Object.freeze({});
