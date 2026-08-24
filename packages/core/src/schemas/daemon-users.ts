/**
 * `DaemonUserRecord` — one daemon-local user in the daemon's directory
 * (`OH.daemonUsers`, Daemon Phase 5 / the unified-oracle model §5.6:
 * "OrgMemberships live on the daemons, not the app-instance").
 *
 * Each record reuses the universal §5 identity rows verbatim — User +
 * UserIdentity + OrgMembership + Principal, all anchored in the daemon's
 * own Org — so the capability resolver consumes daemon users through the
 * exact shapes it already resolves. The daemon's own operator identity
 * stays in `OH.syntheticIdentity` and is NOT duplicated here.
 *
 * Deactivation is record-level (`deactivatedAt`), not a field on the
 * universal User row: it is a daemon-directory fact ("this daemon no
 * longer admits this user"), and it must survive without touching the
 * schema every host's synthetic bootstrap validates against.
 */

import * as v from 'valibot';
import { UserIdentitySchema, UserSchema } from './identity';
import { OrgMembershipSchema, PrincipalSchema } from './identity-acl';

/**
 * What kind of principal a directory record embodies (the
 * access-foundation plan §6):
 *
 *   - `user`    — a human: may log in, holds a seat.
 *   - `service` — a machine identity (built at the epic's F3 slice):
 *                 holds WRA grants and bound tokens, has NO login and
 *                 NO operator powers, consumes no human seat.
 */
export const DaemonPrincipalKindSchema = v.picklist(['user', 'service']);

export const DaemonUserRecordSchema = v.object({
  user: UserSchema,
  userIdentity: UserIdentitySchema,
  membership: OrgMembershipSchema,
  principal: PrincipalSchema,
  /**
   * Principal kind — absent on every pre-vocabulary record, and absent
   * MUST read as `user` (no migration pass: real directories exist on
   * dev machines). Read through `daemonUserPrincipalKind`; login-shaped
   * paths must allow `user` explicitly rather than exclude `service`,
   * so a future kind degrades to no-login (deny-by-default) instead of
   * inheriting a human's powers.
   */
  kind: v.optional(DaemonPrincipalKindSchema),
  /** ms-since-epoch of directory admission. */
  createdAt: v.pipe(v.number(), v.integer()),
  /** ms-since-epoch of deactivation; null while active. */
  deactivatedAt: v.union([v.pipe(v.number(), v.integer()), v.null()]),
  /**
   * Opaque password verifier for the daemon's local password login
   * (enterprise Phase 3). Host-computed (scrypt on the Node host) and
   * host-verified — core only stores the string. Absent = no password
   * credential; admin projections never carry it over the wire.
   */
  passwordVerifier: v.optional(v.pipe(v.string(), v.minLength(1))),
  /**
   * Seat provenance, set at admission and never reshuffled: absent =
   * pool seat (every pre-personal record); `personal` = the user was
   * admitted past the pool limit by their own personal-seat license.
   * The signed artifact is stored so the refresh agent can renew it
   * beside the daemon's own; live validity is always derived by
   * verifying it at consume time, never cached here. An admin
   * absorbing the seat into the pool clears the field.
   */
  admission: v.optional(
    v.object({
      kind: v.literal('personal'),
      licenseId: v.pipe(v.string(), v.minLength(1)),
      licenseKey: v.pipe(v.string(), v.minLength(1)),
    }),
  ),
  /**
   * Git commit-author email override (the git-sync plan §11.5): the address
   * daemon-minted commits attribute this user's work to, so commits
   * link to the user's hosting-platform profile. Absent → the identity
   * email, then the synthetic noreply address. The author NAME is
   * always `user.displayName` — attribution never drifts from the
   * directory.
   */
  gitEmail: v.optional(v.pipe(v.string(), v.minLength(1))),
});
