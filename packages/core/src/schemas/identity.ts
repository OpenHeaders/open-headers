/**
 * Identity-schema valibot validators — the universal rows materialized on
 * every host that runs the oracle (per UNIFIED_ORACLE_MODEL.md §5).
 *
 * Mode-1 / Mode-2-localhost hosts populate these rows with deterministic
 * synthetic singletons seeded from `host-install-id`; promotion to real
 * identity is an in-place row update (User.id never changes — ADR-3).
 *
 * This module owns the entity-level shapes only. The host-install-id
 * itself lives on `DaemonConfig` (see `./daemon-config.ts`).
 *
 * Phase U1 slice 1 lands the field surface. Bootstrap helpers, mint paths,
 * and resolver wiring are subsequent slices (U1.4+ and Phase U2).
 */

import * as v from 'valibot';
import { UuidV7Schema } from './common';

// ── Enums ──────────────────────────────────────────────────────────

/**
 * How a `UserIdentity` row was established.
 *
 *   email           — verified email address
 *   sso_subject     — IdP-issued subject (OIDC `sub`)
 *   api_token_label — opaque label paired with an issued API token
 *   local           — synthetic identity, OS-derived; present on every
 *                     host before real authentication has happened
 *                     (UNIFIED_ORACLE_MODEL.md §5.3)
 */
export const UserIdentityKindSchema = v.picklist(['email', 'sso_subject', 'api_token_label', 'local']);

/**
 * How a `Session` was authenticated.
 *
 *   password / sso / api_token — real authentication
 *   local                      — synthetic session, never authenticated;
 *                                minted deterministically alongside the
 *                                synthetic User. Revoked only at promotion
 *                                (UNIFIED_ORACLE_MODEL.md §5.2 / §5.4).
 */
export const SessionSourceSchema = v.picklist(['password', 'sso', 'api_token', 'local']);

/**
 * Org deployment mode. `single_org` covers every host below the multi-org
 * Mode-3 case; `multi_org` is only set on multi-tenant daemons.
 */
export const OrgDeploymentModeSchema = v.picklist(['single_org', 'multi_org']);

// ── Entities ───────────────────────────────────────────────────────

/**
 * `User` — one per app-instance identity. The synthetic local-user is
 * seeded deterministically from `host-install-id`; promotion flips
 * `isSynthetic` to `false` and updates `displayName` / attached
 * `UserIdentity` rows. `id` is the sentinel and NEVER changes
 * (ADR-3 / UNIFIED_ORACLE_MODEL.md §5.4 step 1).
 */
export const UserSchema = v.object({
  id: UuidV7Schema,
  displayName: v.string(),
  homeOrgId: UuidV7Schema,
  isSynthetic: v.boolean(),
});

/**
 * `Org` — tenancy boundary. The synthetic local-org is seeded
 * deterministically from `host-install-id` and is the `org_id` stamped on
 * every Mode-1 mutation envelope. Becomes the `org_id` filter at the
 * transport boundary (UNIFIED_ORACLE_MODEL.md §6.1 / §8.2).
 */
export const OrgSchema = v.object({
  id: UuidV7Schema,
  name: v.string(),
  deploymentMode: OrgDeploymentModeSchema,
  isSynthetic: v.boolean(),
});

/**
 * `UserIdentity` — one row per (User, IdP-or-local) pair. A real User can
 * accrue multiple rows (work email + personal email + SSO subject); the
 * synthetic `local` row is preserved post-promotion for audit
 * (UNIFIED_ORACLE_MODEL.md §5.4 step 2) but flagged non-primary.
 */
export const UserIdentitySchema = v.object({
  id: UuidV7Schema,
  userId: UuidV7Schema,
  kind: UserIdentityKindSchema,
  value: v.nullable(v.string()),
  isPrimary: v.boolean(),
  verifiedAt: v.string(),
});

/**
 * `Session` — one per authenticated channel. The synthetic local Session
 * is created at host bootstrap (deterministic id from `host-install-id`),
 * never expires, and is revoked only at promotion
 * (UNIFIED_ORACLE_MODEL.md §5.2 row 3 / §5.4 step 3).
 */
export const SessionSchema = v.object({
  id: UuidV7Schema,
  userId: UuidV7Schema,
  source: SessionSourceSchema,
  createdAt: v.string(),
  revokedAt: v.nullable(v.string()),
});
