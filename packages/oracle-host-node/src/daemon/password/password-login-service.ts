/**
 * Local password login (enterprise Phase 3) — the daemon's third mint
 * path, for directory users on deployments without an OIDC provider.
 * Terminates exactly like SSO: a successful verify mints a bound
 * {@link mintDaemonAuthToken} `session`-kind ledger row; everything
 * downstream (HELLO admission, per-frame RBAC, revocation surface)
 * consumes the token as if the operator had paired the user by hand.
 * No parallel credential store: the verifier is a field on the
 * directory record, operator-set over the admin plane.
 *
 * Refusal reasons stay server-side — the HTTP layer answers a uniform
 * failure whatever the cause, so the endpoint enumerates neither
 * emails nor password state. Two guessing defenses ride the attempt:
 *
 *   - the per-peer admission limiter (the 401 is a counted failure on
 *     the `password` route, like a pairing-code guess);
 *   - a per-account lockout on the existing limiter vocabulary, keyed
 *     by the attempted email — a distributed guess against one account
 *     locks the ACCOUNT, not just each address.
 *
 * Every refusal burns a real scrypt derivation (against the account's
 * verifier or a decoy), so response timing does not reveal whether the
 * email exists or holds a password.
 */

import {
  findDaemonUserByEmail,
  listDaemonUsers,
  type MintDaemonAuthTokenResult,
  mintDaemonAuthToken,
} from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import { createPeerRateLimiter, type PeerRateLimiter } from '../rate-limiter';
import { hashPassword, verifyPassword } from './password-verifier';

const SCOPE = 'PasswordLogin';

const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60_000;

/** Per-account lockout: 5 failures in 10 minutes block the account for 15. */
const ACCOUNT_LOCKOUT = { maxFailures: 5, windowMs: 10 * 60_000, blockMs: 15 * 60_000 } as const;

export type PasswordLoginFailureReason =
  | 'account-locked'
  | 'unknown-user'
  | 'user-deactivated'
  | 'no-password'
  | 'bad-password';

export type PasswordLoginResult =
  | { readonly ok: true; readonly secret: string; readonly userId: string }
  | { readonly ok: false; readonly reason: PasswordLoginFailureReason };

export interface PasswordLoginServiceDeps {
  now?: () => number;
  mintToken?: typeof mintDaemonAuthToken;
  findUserByEmail?: typeof findDaemonUserByEmail;
  listUsers?: typeof listDaemonUsers;
  verify?: typeof verifyPassword;
}

export interface DaemonPasswordLoginService {
  /**
   * Is password login usable on this daemon — does any ACTIVE directory
   * user hold a password? The gate probes this to decide whether to
   * render the form; the login route itself answers uniformly either way.
   */
  enabled(): Promise<boolean>;
  login(email: string, password: string): Promise<PasswordLoginResult>;
}

export function createDaemonPasswordLoginService(deps: PasswordLoginServiceDeps = {}): DaemonPasswordLoginService {
  const now = deps.now ?? Date.now;
  const mintToken = deps.mintToken ?? mintDaemonAuthToken;
  const findUserByEmail = deps.findUserByEmail ?? findDaemonUserByEmail;
  const listUsers = deps.listUsers ?? listDaemonUsers;
  const verify = deps.verify ?? verifyPassword;

  const accountLimiter: PeerRateLimiter = createPeerRateLimiter({ ...ACCOUNT_LOCKOUT, now });
  // Decoy verifier for refusals with nothing real to check — keeps the
  // scrypt cost on every path so timing can't enumerate accounts.
  const decoyVerifier: Promise<string> = hashPassword(`decoy:${now()}`);

  async function refuse(
    key: string,
    password: string,
    reason: PasswordLoginFailureReason,
    verifierToBurn?: string,
  ): Promise<PasswordLoginResult> {
    await verify(password, verifierToBurn ?? (await decoyVerifier));
    accountLimiter.recordFailure(key);
    logger.warn(SCOPE, `password login refused: ${reason}`);
    return { ok: false, reason };
  }

  return {
    async enabled(): Promise<boolean> {
      const users = await listUsers();
      return users.some((r) => r.deactivatedAt === null && r.passwordVerifier !== undefined);
    },

    async login(email: string, password: string): Promise<PasswordLoginResult> {
      const normalized = email.trim().toLowerCase();
      if (!normalized || !password) return { ok: false, reason: 'bad-password' };
      if (accountLimiter.isBlocked(normalized)) {
        logger.warn(SCOPE, 'password login refused: account-locked');
        return { ok: false, reason: 'account-locked' };
      }
      const record = await findUserByEmail(normalized);
      if (!record) return refuse(normalized, password, 'unknown-user');
      if (record.deactivatedAt !== null) return refuse(normalized, password, 'user-deactivated');
      if (record.passwordVerifier === undefined) return refuse(normalized, password, 'no-password');
      if (!(await verify(password, record.passwordVerifier))) {
        accountLimiter.recordFailure(normalized);
        logger.warn(SCOPE, `password login refused: bad-password (user=${record.user.id})`);
        return { ok: false, reason: 'bad-password' };
      }
      const minted: MintDaemonAuthTokenResult = await mintToken({
        label: `password:${record.userIdentity.value ?? normalized}`,
        userId: record.user.id,
        kind: 'session',
        expiresAt: now() + SESSION_TTL_MS,
      });
      logger.info(SCOPE, `password login minted session token ${minted.record.id} for user=${record.user.id}`);
      return { ok: true, secret: minted.secret, userId: record.user.id };
    },
  };
}
