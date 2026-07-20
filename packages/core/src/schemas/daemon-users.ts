/**
 * `DaemonUserRecord` — one daemon-local user in the daemon's directory
 * (`OH.daemonUsers`, Daemon Phase 5 / `UNIFIED_ORACLE_MODEL.md` §5.6:
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

export const DaemonUserRecordSchema = v.object({
  user: UserSchema,
  userIdentity: UserIdentitySchema,
  membership: OrgMembershipSchema,
  principal: PrincipalSchema,
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
   * Git commit-author email override (GIT_PLAN.md §11.5): the address
   * daemon-minted commits attribute this user's work to, so commits
   * link to the user's hosting-platform profile. Absent → the identity
   * email, then the synthetic noreply address. The author NAME is
   * always `user.displayName` — attribution never drifts from the
   * directory.
   */
  gitEmail: v.optional(v.pipe(v.string(), v.minLength(1))),
});
