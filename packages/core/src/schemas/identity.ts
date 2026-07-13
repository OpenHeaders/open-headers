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
import { PLATFORM_KINDS } from '../utils/host-detect';
import { isValidOrgLogoDataUri, ORG_LOGO_MAX_DATA_URI_LENGTH } from '../utils/org-logo';
import { UuidV7Schema } from './common';
import { DaemonAdminSchema, OrgMembershipSchema, PrincipalSchema } from './identity-acl';

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
 * The kind of host process that minted an `Org`. Stamped once at
 * bootstrap and never changes (V5 fresh-start — no migration). It
 * classifies the host *process*, not the Org's membership: whether an
 * Org reads as personal or team is a separate, derived `OrgScopeKind`
 * fact (see `../identity/org-catalogue.ts`).
 *
 *   browser — a browser extension's service worker
 *   desktop — the desktop app's main process
 *   daemon  — a headless standalone daemon
 */
export const HostKindSchema = v.picklist(['browser', 'desktop', 'daemon']);

// ── Entities ───────────────────────────────────────────────────────

/**
 * `User` — one per app-instance identity. The standalone local-user is
 * seeded deterministically from `host-install-id` at bootstrap with no
 * remote identity attached; the connect event (UNIFIED_ORACLE_MODEL.md
 * §5.4 step 1) flips `isStandalone` to `false` and updates `displayName`
 * / attached `UserIdentity` rows when the user connects to a real
 * backend. `id` is the sentinel and NEVER changes (ADR-3).
 *
 * Brand-aligned vocabulary: this product positions "no account, no
 * sign-in" as a feature — a standalone user isn't a placeholder or a
 * lesser tier, it's the default and intended starting state.
 */
export const UserSchema = v.object({
  id: UuidV7Schema,
  displayName: v.string(),
  homeOrgId: UuidV7Schema,
  /** True until the user connects to a real backend that attaches a verified identity. */
  isStandalone: v.boolean(),
});

/**
 * `Org` — tenancy boundary. The private home Org is seeded
 * deterministically from `host-install-id` and is the `org_id` stamped on
 * every standalone-mode mutation envelope. Becomes the `org_id` filter
 * at the transport boundary (UNIFIED_ORACLE_MODEL.md §6.1 / §8.2).
 *
 * Every Org is multi-org-capable — there is no static single-vs-multi
 * mode flag. Whether an Org reads as "personal" or "team" is derived at
 * view time from identity state (home-org vs. not), not stamped here.
 *
 * `hostKind` records which kind of host process minted the Org — it is
 * the one host-classification fact that *cannot* be derived after the
 * fact, so it is stamped at bootstrap and travels with the row when the
 * Org is joined. It drives the identity-label icon.
 *
 * `isPrivate` records whether the Org has no backend hosting it — true
 * for a freshly-bootstrapped home Org (stays on this device, nothing
 * else can see it); false the moment a backend (the user's own daemon,
 * a LAN/WAN server, etc.) connects. A joined Org is **never** private
 * by definition — anything that crossed a wire is no longer "stays on
 * this device" — so `recordJoinedOrg` stamps `isPrivate: false` at the
 * receiver boundary regardless of what the sender sent.
 *
 * `hostOs` records the minting host's operating system when the host
 * can determine it (a daemon reads its own platform; browsers cannot
 * see a remote peer's OS). Machine-derived, so the host re-stamps it
 * on every boot; travels with the row so joiners can render the OS
 * mark for a server they never touch.
 *
 * `logo` is an optional custom brand mark set by the Org's owner — a
 * validated base64 `data:` URI ({@link isValidOrgLogoDataUri}: format
 * allow-list, byte cap, inert-SVG rules). Validated HERE so a peer's
 * WELCOME can never fold an oversized or active-content payload into
 * local storage. When present it wins over every derived glyph.
 */
export const OrgSchema = v.object({
  id: UuidV7Schema,
  name: v.string(),
  hostKind: HostKindSchema,
  /** True iff no backend hosts this Org — i.e. it stays on this device. */
  isPrivate: v.boolean(),
  hostOs: v.optional(v.picklist(PLATFORM_KINDS)),
  logo: v.optional(
    v.pipe(v.string(), v.maxLength(ORG_LOGO_MAX_DATA_URI_LENGTH), v.check(isValidOrgLogoDataUri, 'invalid Org logo')),
  ),
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

// ── Persistence shape for the synthetic-identity bootstrap tuple ───

/**
 * The full row tuple every host materializes at boot
 * (UNIFIED_ORACLE_MODEL.md §5.2 — User + Org + UserIdentity + Session +
 * OrgMembership + Principal + LocalAdmin). Composed from the per-entity
 * schemas so a single boundary parse validates the whole record.
 *
 * Persisted as one blob under `OH.syntheticIdentity` (see
 * `../storage/keys.ts`) — one storage write satisfies the §5.2
 * "single transaction" implementation note on hosts whose backend
 * doesn't natively offer multi-row transactionality.
 *
 * Per-workspace `WorkspaceRoleAssignment` rows ride their own slot
 * (U1.8) and are not part of this record.
 */
export const SyntheticIdentityRecordSchema = v.object({
  user: UserSchema,
  org: OrgSchema,
  userIdentity: UserIdentitySchema,
  session: SessionSchema,
  membership: OrgMembershipSchema,
  principal: PrincipalSchema,
  localAdmin: DaemonAdminSchema,
});
