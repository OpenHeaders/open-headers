/**
 * Proxy trust plane — persisted shapes for the host capture plane's CA
 * lifecycle (PROXY_SECURITY.md §2, §6).
 *
 * `ProxyCaRecordSchema` is the sealed CA slot: the private key rides a
 * `sensitive: true` storage slot and never leaves the host process —
 * never through the renderer, never in an RPC response, never in logs.
 * Public material (subject, validity, fingerprints) is always derived
 * from `certPem` at consume time, never cached as truth.
 *
 * `ProxyTrustChangeSchema` is one row of the durable "what we changed"
 * record: exactly which trust stores the CA was installed into, so
 * teardown can undo exactly that — idempotent, crash-safe, and
 * assertable clean by a later e2e (§2.5).
 */

import * as v from 'valibot';

/** Trust stores the proxy plane knows how to change. macOS first; the
 *  Windows/Linux system-store and per-user NSS cells join in their
 *  platform passes. */
export const ProxyTrustStoreIdSchema = v.picklist(['macos-login-keychain', 'macos-system-keychain', 'nss-firefox']);

export const ProxyCaRecordSchema = v.object({
  version: v.literal(1),
  /** PEM of the self-signed CA certificate — the public artifact. */
  certPem: v.pipe(v.string(), v.minLength(1)),
  /** Base64 PKCS#8 of the CA private key. Sealed at rest by the slot's
   *  cipher; host-process-only by law. */
  privateKeyPkcs8B64: v.pipe(v.string(), v.minLength(1)),
  createdAt: v.number(),
});

export const ProxyTrustChangeSchema = v.object({
  store: ProxyTrustStoreIdSchema,
  /** The concrete store instance: keychain path or NSS profile dir. */
  ref: v.pipe(v.string(), v.minLength(1)),
  /** Hex SHA-256 of the installed CA cert (DER) — the identity probes
   *  compare against (tamper visibility, §5). */
  fingerprintSha256: v.pipe(v.string(), v.minLength(1)),
  /** Hex SHA-1 of the DER — what `security delete-certificate -Z` keys
   *  removal by. Recorded, never used for identity decisions. */
  fingerprintSha1: v.pipe(v.string(), v.minLength(1)),
  at: v.number(),
});
