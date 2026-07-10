/**
 * `DaemonAuthToken` — one long-lived peer access credential the desktop
 * daemon recognizes (U3.2, `UNIFIED_ORACLE_MODEL.md` §4.2 +
 * `DATA_PLANE_TOPOLOGIES.md` §11.4 Phase D LAN solo).
 *
 * Only the hash of the secret survives in storage. The raw secret is
 * returned exactly once at mint time so the admin can copy it; from
 * then on, the validator constant-time-compares an inbound secret's
 * hash against the persisted hash.
 *
 * Tokens are independent per device: an admin generates one per peer
 * they want to admit (or one per role, depending on policy). Revoke is
 * a soft delete (`revokedAt` timestamp) so audit history stays intact.
 */

import * as v from 'valibot';

export const DaemonAuthTokenSchema = v.object({
  /** UUIDv7 identifier — the public handle for revoke / list operations. */
  id: v.pipe(v.string(), v.minLength(1)),
  /** Hex-encoded SHA-256 of the raw secret. */
  tokenHash: v.pipe(v.string(), v.minLength(1)),
  /** Optional admin-supplied label (e.g. "alice's phone", "CI runner"). */
  label: v.optional(v.string()),
  /**
   * The daemon-local user this token authenticates (`OH.daemonUsers`).
   * Absent on unbound tokens (every pre-team mint, plain `show-token`) —
   * those resolve to the daemon operator's own user at admission time,
   * so the solo tier's behavior is unchanged.
   */
  userId: v.optional(v.string()),
  /**
   * ms-since-epoch after which validation refuses this token. Absent =
   * never expires (every operator-minted token). OIDC-minted session
   * tokens carry one so an SSO session cannot outlive its configured
   * lifetime without re-authenticating against the IdP.
   */
  expiresAt: v.optional(v.pipe(v.number(), v.integer())),
  /** ms-since-epoch of mint. */
  createdAt: v.pipe(v.number(), v.integer()),
  /** ms-since-epoch of the most recent successful HELLO validation; null until first use. */
  lastUsedAt: v.union([v.pipe(v.number(), v.integer()), v.null()]),
  /** ms-since-epoch of revoke; null while active. */
  revokedAt: v.union([v.pipe(v.number(), v.integer()), v.null()]),
});
