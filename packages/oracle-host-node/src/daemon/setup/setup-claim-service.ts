/**
 * Server claim — the first browser to reach an unclaimed server creates
 * the admin account (the front-door plan §4.2). The successor to the
 * gate that used to ask a stranger to paste `ohd show-token` output: a
 * browser never pastes a machine credential.
 *
 * One-shot by STATE, never by timer. The guard is `createDaemonUser`'s
 * `requireEmptyDirectory`, re-checked inside the user-store lock, so
 * two browsers racing one unclaimed server produce exactly one admin —
 * the loser reads what the winner committed and is refused. There is
 * no claim window to expire on a headless box nobody can reach in
 * time; the setup code (§4.3) is what a remote claim proves itself
 * with instead.
 *
 * The claim terminates exactly like a password login — a bound
 * `session`-kind ledger row, same TTL, same revocation surface — so the
 * SPA reuses its existing candidate → HELLO → persist path unchanged.
 *
 * Three things the claim does BESIDES creating a user, each load-bearing:
 *
 *   - **Owner on every workspace this host serves.** The directory is
 *     empty by construction, so no one else's workspace can exist; and
 *     without the grant the admin who just claimed the box would sign
 *     in locked out of the data on it.
 *   - **`daemon.admin` on the new user** (S2's functional role), or the
 *     admin can administer nothing.
 *   - **Revokes every unbound token (O3).** An unbound token resolves
 *     to the operator and therefore to full admin; leaving them alive
 *     past a claim is a standing backdoor around the admin just
 *     created. The response reports how many died so the SPA can say
 *     which devices need re-pairing.
 *
 * An SSO-configured daemon is never unclaimed (O4): configuring an IdP
 * is itself an act of administration on the box, and a password-bearing
 * claim there would mint exactly the local bypass credential the
 * OIDC/password mutual exclusion exists to prevent. Its first IdP login
 * is the admin instead.
 */

import {
  createDaemonUser,
  emitAuditEntry,
  grantWorkspaceRole,
  isDaemonDirectoryEmpty,
  listDaemonAuthTokens,
  mintDaemonAuthToken,
  revokeDaemonAuthToken,
  setDaemonUserDaemonAdmin,
  setDaemonUserPassword,
} from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import { SESSION_TTL_MS } from '../password/password-login-service';
import { hashPassword, PASSWORD_MIN_LENGTH } from '../password/password-verifier';
import { generateSetupCode, setupCodeMatches } from './setup-code';

const SCOPE = 'SetupClaim';

/** What the SPA needs to know to pick a screen — and nothing else (O1). */
export interface DaemonSetupMeta {
  /** No directory user has ever been admitted, and no IdP is configured. */
  readonly unclaimed: boolean;
  /** A claim from this deployment's non-loopback origins must carry the setup code. */
  readonly requiresCode: boolean;
}

export interface DaemonSetupClaimInput {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
  /** The first-boot code; unnecessary from loopback, mandatory from anywhere else. */
  readonly code?: string;
}

/** Wrong in a way the caller can see and fix — answered verbatim, never counted (O9). */
export type DaemonSetupClaimInvalidReason = 'display-name-required' | 'email-required' | 'password-too-short';

/** Anything that turns on server STATE — answered by one uniform refusal, counted (O9). */
export type DaemonSetupClaimRefusedReason =
  | 'already-claimed'
  | 'sso-configured'
  | 'bad-setup-code'
  | 'not-admitted'
  | 'no-daemon-identity';

export type DaemonSetupClaimResult =
  | {
      readonly ok: true;
      readonly secret: string;
      readonly userId: string;
      /** Unbound tokens the claim revoked (O3) — devices that must re-pair. */
      readonly revokedTokens: number;
    }
  | { readonly ok: false; readonly kind: 'invalid'; readonly reason: DaemonSetupClaimInvalidReason }
  | { readonly ok: false; readonly kind: 'refused'; readonly reason: DaemonSetupClaimRefusedReason };

export interface DaemonSetupClaimServiceOptions {
  /** An IdP is configured — this server is never unclaimed (O4). */
  readonly oidcConfigured: boolean;
  /** Workspaces this host serves; the claimed admin is made owner of each. */
  readonly listWorkspaceIds: () => readonly string[];
  /** Evict a revoked token's live sockets — same persist-before-evict order `tokens.revoke` uses. */
  readonly closePeersByTokenId: (tokenId: string) => void;
  /** The code left the manifest and the log: `null` once the server is claimed. */
  readonly onSetupCodeChange?: (code: string | null) => void;
  /** Test seam — defaults to {@link generateSetupCode}. */
  readonly generateCode?: () => string;
  /** Test seam — defaults to `Date.now()`. */
  readonly now?: () => number;
}

export interface DaemonSetupClaimService {
  /**
   * Mint this boot's setup code if the server is unclaimed, and report
   * it (or `null`) through `onSetupCodeChange`. Called once at boot;
   * returns what it reported so the caller can log it.
   */
  ensureSetupCode(): Promise<string | null>;
  meta(): Promise<DaemonSetupMeta>;
  /** `peerIsLoopback` decides whether the setup code is required (§4.3). */
  claim(input: DaemonSetupClaimInput, peerIsLoopback: boolean): Promise<DaemonSetupClaimResult>;
}

export function createDaemonSetupClaimService(options: DaemonSetupClaimServiceOptions): DaemonSetupClaimService {
  const generateCode = options.generateCode ?? generateSetupCode;
  const now = options.now ?? Date.now;
  let setupCode: string | null = null;

  const refuse = (reason: DaemonSetupClaimRefusedReason): DaemonSetupClaimResult => {
    logger.warn(SCOPE, `claim refused: ${reason}`);
    return { ok: false, kind: 'refused', reason };
  };

  /** Unclaimed = an empty directory on a daemon with no IdP (O4). */
  async function unclaimed(): Promise<boolean> {
    if (options.oidcConfigured) return false;
    return isDaemonDirectoryEmpty();
  }

  return {
    async ensureSetupCode(): Promise<string | null> {
      setupCode = (await unclaimed()) ? generateCode() : null;
      options.onSetupCodeChange?.(setupCode);
      return setupCode;
    },

    async meta(): Promise<DaemonSetupMeta> {
      const open = await unclaimed();
      // `requiresCode` describes the remote path, so it stays true for
      // as long as the claim is open — a loopback browser simply never
      // reaches the check. A claimed server answers false to both.
      return { unclaimed: open, requiresCode: open && setupCode !== null };
    },

    async claim(input: DaemonSetupClaimInput, peerIsLoopback: boolean): Promise<DaemonSetupClaimResult> {
      const displayName = input.displayName.trim();
      const email = input.email.trim();
      if (!displayName) return { ok: false, kind: 'invalid', reason: 'display-name-required' };
      if (!email) return { ok: false, kind: 'invalid', reason: 'email-required' };
      if (input.password.length < PASSWORD_MIN_LENGTH) {
        return { ok: false, kind: 'invalid', reason: 'password-too-short' };
      }
      if (options.oidcConfigured) return refuse('sso-configured');
      // Advisory — the authoritative empty-directory check runs inside
      // the store lock below. Here it spares a claimed server the
      // scrypt derivation a probe would otherwise cost it.
      if (!(await isDaemonDirectoryEmpty())) return refuse('already-claimed');
      if (!peerIsLoopback && !setupCodeMatches(input.code, setupCode)) return refuse('bad-setup-code');

      const created = await createDaemonUser({ displayName, email, requireEmptyDirectory: true });
      if (!created.ok) {
        if (created.reason === 'directory-not-empty') return refuse('already-claimed');
        if (created.reason === 'no-daemon-identity') return refuse('no-daemon-identity');
        // The seat gate and the duplicate-email check cannot fire on an
        // empty directory (O10) — if one ever does, the operator gets
        // the real reason here and the caller still gets the uniform
        // refusal.
        logger.warn(SCOPE, `claim could not admit the first user: ${created.reason}`);
        return refuse('not-admitted');
      }
      const { user, principal, membership } = created.record;

      const passwordSet = await setDaemonUserPassword(user.id, await hashPassword(input.password));
      if (!passwordSet.ok) {
        // Unreachable — the record was created microseconds ago and
        // cannot be missing or deactivated. Loud rather than silent: a
        // passwordless admin cannot sign back in.
        logger.error(SCOPE, `claimed admin ${user.id} could not be given a password: ${passwordSet.reason}`);
      }

      for (const workspaceId of options.listWorkspaceIds()) {
        await grantWorkspaceRole({ principalId: principal.id, workspaceId, role: 'owner' });
      }

      const admin = await setDaemonUserDaemonAdmin(user.id, true);
      if (!admin.ok) {
        logger.error(SCOPE, `claimed admin ${user.id} could not be given daemon.admin: ${admin.reason}`);
      }

      const revokedTokens = await revokeUnboundTokens(user.id, membership.orgId, options.closePeersByTokenId);

      const minted = await mintDaemonAuthToken({
        label: `password:${email}`,
        userId: user.id,
        kind: 'session',
        expiresAt: now() + SESSION_TTL_MS,
      });
      // The claim is over: no further code is honoured, and the
      // manifest's unclaimed block goes with it.
      setupCode = null;
      options.onSetupCodeChange?.(null);
      logger.info(
        SCOPE,
        `server claimed by ${email} (user=${user.id}), ${revokedTokens} unbound token(s) revoked, session ${minted.record.id} minted`,
      );
      return { ok: true, secret: minted.secret, userId: user.id, revokedTokens };
    },
  };
}

/**
 * O3 — every unbound token dies with the claim. Persist the revoke
 * BEFORE evicting the socket, the ordering `tokens.revoke` established:
 * a peer racing the eviction re-reads an already-revoked ledger instead
 * of slipping a fresh connection past a not-yet-written revoke. Each
 * revocation is stamped with the same `daemon.admin` allow row an
 * administrative act over the peer plane would carry.
 */
async function revokeUnboundTokens(
  actorUserId: string,
  orgId: string,
  closePeersByTokenId: (tokenId: string) => void,
): Promise<number> {
  let revoked = 0;
  for (const token of await listDaemonAuthTokens()) {
    if (token.userId !== undefined || token.revokedAt !== null) continue;
    await revokeDaemonAuthToken(token.id);
    closePeersByTokenId(token.id);
    emitAuditEntry({ actorUserId, capability: 'daemon.admin', decision: { allow: true }, orgId });
    revoked += 1;
  }
  return revoked;
}
