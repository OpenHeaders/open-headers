/**
 * `bootstrapSyntheticIdentity` — the host-neutral pure helper that
 * produces the synthetic identity-row tuple every host materializes on
 * boot (the unified-oracle model §5.2).
 *
 * Pure of transport: it computes the rows and returns them; the caller
 * (each host's init wiring, U1.6 / U1.7) persists them through whatever
 * path applies (oracle mutators on the live SW, direct storage write on
 * fresh-install bootstrap, etc.). Same inputs → same row UUIDs by
 * construction: the synthetic-row ids derive deterministically from
 * `hostInstallId` via `./derive-uuid.ts`. This is the idempotency
 * commitment from §5.1 / §11 OQ1 — re-running after a partial-wipe
 * reproduces the same FK targets, so any data that survived reconnects.
 *
 * Bootstrap transactionality (§5.2 implementation note): callers should
 * persist the returned rows in one transaction. Both deterministic
 * UUIDs (User.id, Org.id) are pre-computed here so the User row's
 * `homeOrgId` FK is satisfied at commit even if Org is inserted later
 * in the same transaction.
 */

import type {
  DaemonAdmin,
  HostKind,
  Org,
  OrgMembership,
  Principal,
  Session,
  SyntheticIdentityRecord,
  User,
  UserIdentity,
} from '../types';
import type { PlatformKind } from '../utils/host-detect';
import { deriveSyntheticUuidV7, SYNTHETIC_SEEDS } from './derive-uuid';

/** Inputs to the bootstrap helper. */
export interface BootstrapSyntheticIdentityInput {
  /** Stable per-host identifier; see `./host-install-id.ts`. */
  hostInstallId: string;
  /**
   * Which kind of host process is running the bootstrap. Stamped onto
   * the `Org` row and never changes; classifies the host so a joined
   * peer can render the correct identity icon.
   */
  hostKind: HostKind;
  /**
   * Best-effort display name (OS username or equivalent). Defaults to
   * `'Local'` when the host can't read one cheaply — the user-visible
   * name updates on promotion (§5.4 step 1) without changing `User.id`.
   */
  displayName?: string;
  /**
   * Local-org name. Hosts pass a descriptive value (desktop → OS
   * hostname, extension → browser name, daemon → hostname); defaults to
   * `'Local'` only when the host can't read one (§5.2 row 'Org').
   */
  orgName?: string;
  /**
   * The host's operating system when it can determine its own (a
   * daemon/desktop reads its platform; a browser host omits it and
   * detection happens at render time instead). Stamped onto the `Org`
   * row so joiners can render the OS mark for a remote server.
   */
  hostOs?: PlatformKind;
  /**
   * Best-effort OS-derived email or `null` if unavailable
   * (§5.2 row 'UserIdentity').
   */
  email?: string | null;
  /**
   * ISO timestamp captured for `verifiedAt` / `createdAt`. Injected
   * rather than read from `Date.now()` so the helper stays a pure
   * function and tests can pin the value.
   */
  now: string;
}

/**
 * The synthetic-row tuple every host materializes at boot. Identical in
 * shape to the persisted `SyntheticIdentityRecord` (see
 * `../schemas/identity.ts`) — the alias documents call-site intent
 * (return-value of a pure helper) without diverging from the persisted
 * shape.
 */
export type BootstrapSyntheticIdentityResult = SyntheticIdentityRecord;

/**
 * Compute the synthetic identity-row tuple for a host. Deterministic in
 * `hostInstallId`; same input always yields the same row UUIDs. The
 * caller persists the result.
 */
export async function bootstrapSyntheticIdentity(
  input: BootstrapSyntheticIdentityInput,
): Promise<BootstrapSyntheticIdentityResult> {
  const { hostInstallId, now } = input;
  const displayName = input.displayName ?? 'Local';
  const orgName = input.orgName ?? 'Local';
  const email = input.email ?? null;

  const [userId, orgId, identityId, sessionId, membershipId, principalId, daemonAdminId] = await Promise.all([
    deriveSyntheticUuidV7(SYNTHETIC_SEEDS.user(hostInstallId)),
    deriveSyntheticUuidV7(SYNTHETIC_SEEDS.org(hostInstallId)),
    deriveSyntheticUuidV7(SYNTHETIC_SEEDS.userIdentity(hostInstallId)),
    deriveSyntheticUuidV7(SYNTHETIC_SEEDS.session(hostInstallId)),
    deriveSyntheticUuidV7(SYNTHETIC_SEEDS.membership(hostInstallId)),
    deriveSyntheticUuidV7(SYNTHETIC_SEEDS.principal(hostInstallId)),
    deriveSyntheticUuidV7(SYNTHETIC_SEEDS.daemonAdmin(hostInstallId)),
  ]);

  const user: User = {
    id: userId,
    displayName,
    homeOrgId: orgId,
    isStandalone: true,
  };

  const org: Org = {
    id: orgId,
    name: orgName,
    hostKind: input.hostKind,
    isPrivate: true,
    ...(input.hostOs ? { hostOs: input.hostOs } : {}),
  };

  const userIdentity: UserIdentity = {
    id: identityId,
    userId,
    kind: 'local',
    value: email,
    isPrimary: true,
    verifiedAt: now,
  };

  const session: Session = {
    id: sessionId,
    userId,
    source: 'local',
    createdAt: now,
    revokedAt: null,
  };

  const membership: OrgMembership = {
    id: membershipId,
    userId,
    orgId,
    primaryRole: 'owner',
    functionalRoles: [],
  };

  const principal: Principal = {
    id: principalId,
    userId,
    orgId,
  };

  const localAdmin: DaemonAdmin = {
    id: daemonAdminId,
    userId,
    isLocal: true,
  };

  return { user, org, userIdentity, session, membership, principal, localAdmin };
}
