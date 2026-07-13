/**
 * OIDC login flow engine (Phase 5 slice 3) — authorization-code flow
 * with PKCE against the configured provider, terminating in a bound
 * {@link DaemonAuthToken}: OIDC is just another way to mint a session
 * credential; everything downstream (HELLO admission, per-frame RBAC,
 * MCP gates) consumes the token exactly as if the operator had paired
 * the user by hand.
 *
 * Three stores, all in-memory and TTL-bounded (same posture as the
 * pairing service's pending pairs — a daemon restart mid-login just
 * restarts the login):
 *
 *   - pending logins, keyed by `state`: nonce + PKCE verifier +
 *     redirect URI + login-binding hash minted at `/auth/oidc/start`,
 *     consumed one-shot by the callback. A state the store doesn't hold
 *     is a forged or replayed callback. The binding nonce travels back
 *     as an HttpOnly cookie and must return with the callback — it
 *     proves the browser completing the flow is the one that started
 *     it, closing the login-CSRF / session-fixation gap a bare
 *     code+state pair leaves open.
 *   - provider discovery, cached after the first successful fetch
 *     (cleared on failure so a transient issuer outage retries).
 *   - claim codes, keyed by a fresh secret: the callback redirect hands
 *     the SPA `#oidc=<code>`, never the session token itself — the
 *     token would otherwise land in browser history and proxy logs.
 *     One-shot, 60-second TTL.
 *
 * The ID token is verified with jose against the provider's JWKS
 * (signature, `iss`, `aud`, `exp`) plus the flow's own `nonce`; the
 * verified `email` claim is the join key into the daemon-local user
 * directory. No directory record ⇒ refused unless `autoProvision` is
 * on, in which case the user is created with ZERO workspace grants —
 * RBAC deny-by-default makes a fresh SSO user harmless until granted.
 *
 * With `claimMappings` configured, every completed login also folds the
 * token's group/role claims into workspace grants (`claims-mapping.ts`
 * + the core `idp`-origin WRA reconcile): the IdP is authoritative for
 * the grants it maps, manual operator grants stay sticky.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  type CreateDaemonUserResult,
  createDaemonUser,
  emitAuditEntry,
  findDaemonUserByEmail,
  type MintDaemonAuthTokenResult,
  mintDaemonAuthToken,
  reconcileIdpWorkspaceRoles,
} from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import type { DaemonUserRecord } from '@openheaders/core/types';
import { getWorkspace } from '@openheaders/oracle/workspace/extension-workspace-store';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { desiredGrantsFromClaims, extractClaimValues } from './claims-mapping';
import type { DaemonOidcConfig } from './oidc-config';

const SCOPE = 'OidcLogin';

const DEFAULT_SCOPES: readonly string[] = ['openid', 'email', 'profile'];
const DEFAULT_SESSION_TTL_DAYS = 30;
export const PENDING_LOGIN_TTL_MS = 10 * 60_000;
const PENDING_LOGIN_CAP = 200;
const CLAIM_TTL_MS = 60_000;

/** The discovery-document fields the flow consumes. */
export interface OidcProviderMetadata {
  readonly issuer: string;
  readonly authorizationEndpoint: string;
  readonly tokenEndpoint: string;
  readonly jwksUri: string;
}

/** The ID-token claims the directory join + grant mapping consume. */
export interface OidcIdTokenClaims {
  readonly nonce?: string;
  readonly email?: string;
  readonly emailVerified?: boolean;
  readonly name?: string;
  /**
   * Values found at the configured `claimMappings.claimPath` — the
   * verified group/role claims the grant mapping folds over. Absent
   * when no mapping is configured (or the claim is missing, which the
   * fold treats as "no mapped grants").
   */
  readonly mappingValues?: readonly string[];
}

export type OidcLoginFailureReason =
  | 'provider-unavailable'
  | 'state-mismatch'
  | 'exchange-failed'
  | 'invalid-id-token'
  | 'nonce-mismatch'
  | 'no-email'
  | 'email-unverified'
  | 'unknown-user'
  | 'user-deactivated'
  | 'provision-failed'
  | 'seat-limit-reached'
  | 'personal-seats-disabled'
  | 'personal-license-invalid'
  | 'personal-license-identity-mismatch'
  | 'personal-license-no-identity';

export type OidcCompleteResult =
  | { readonly ok: true; readonly claimCode: string; readonly userId: string; readonly email: string }
  | { readonly ok: false; readonly reason: OidcLoginFailureReason };

export type OidcBeginResult =
  | { readonly ok: true; readonly authorizationUrl: string; readonly bindingNonce: string }
  | { readonly ok: false; readonly reason: 'provider-unavailable' | 'too-many-pending' };

export interface OidcServiceDeps {
  /** Outbound HTTP to the issuer (discovery + code exchange). Test seam. */
  fetchImpl?: typeof fetch;
  now?: () => number;
  mintToken?: typeof mintDaemonAuthToken;
  findUserByEmail?: typeof findDaemonUserByEmail;
  createUser?: typeof createDaemonUser;
  /** Grant-mapping seams — default to the live WRA reconcile + audit + workspace store. */
  reconcileGrants?: typeof reconcileIdpWorkspaceRoles;
  emitAudit?: typeof emitAuditEntry;
  workspaceExists?: (workspaceId: string) => boolean;
  /**
   * Grant-time workspace offer to the user's already-connected sockets
   * (the shared re-fan-out seam — same function the manual admin grant
   * rides). Absent = no live offer; peers converge on reconnect.
   */
  offerGrantedWorkspaces?: (userId: string, workspaceIds: readonly string[]) => Promise<number>;
  /**
   * ID-token verification seam. The default verifies signature + `iss` +
   * `aud` + `exp` against the provider's remote JWKS via jose; unit rows
   * substitute a claims decoder so they don't stand up a signing issuer.
   */
  verifyIdToken?: (idToken: string, metadata: OidcProviderMetadata, clientId: string) => Promise<OidcIdTokenClaims>;
}

export interface DaemonOidcService {
  /** Human-readable provider name for the gate's SSO button. */
  providerLabel(): string;
  /**
   * Mint state/nonce/PKCE plus a login-binding nonce and build the
   * authorization redirect. The binding nonce goes back to the browser
   * as an HttpOnly cookie; only its hash is stored. A personal-seat
   * key pasted at the seat-limit refusal rides along in the pending
   * login and reaches the gate at auto-provision.
   */
  beginLogin(externalOrigin: string, options?: { personalLicense?: string }): Promise<OidcBeginResult>;
  /**
   * One-shot callback completion: binding check, exchange, verify,
   * join, mint. `bindingNonce` is the cookie the completing browser
   * presented — absent or wrong, the callback dies exactly like a
   * forged state.
   */
  completeLogin(params: { code: string; state: string; bindingNonce: string }): Promise<OidcCompleteResult>;
  /** One-shot claim-code → session-token swap for the SPA. */
  claimToken(claimCode: string): { secret: string } | null;
  dispose(): void;
}

interface PendingLogin {
  readonly nonce: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
  /** SHA-256 of the login-binding cookie nonce — never the nonce itself. */
  readonly bindingHash: Buffer;
  /** Personal-seat key pasted at the refusal; handed to the seat gate at auto-provision. */
  readonly personalLicense?: string;
  readonly createdAt: number;
}

interface PendingClaim {
  readonly secret: string;
  readonly createdAt: number;
}

function base64Url(bytes: Buffer): string {
  return bytes.toString('base64url');
}

function randomToken(): string {
  return base64Url(randomBytes(32));
}

function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function bindingHashOf(nonce: string): Buffer {
  return createHash('sha256').update(nonce).digest();
}

export function redirectUriFor(externalOrigin: string): string {
  return `${externalOrigin.replace(/\/$/, '')}/auth/oidc/callback`;
}

function parseDiscovery(raw: unknown): OidcProviderMetadata | null {
  if (raw === null || typeof raw !== 'object') return null;
  const doc = raw as Record<string, unknown>;
  const issuer = doc.issuer;
  const authorizationEndpoint = doc.authorization_endpoint;
  const tokenEndpoint = doc.token_endpoint;
  const jwksUri = doc.jwks_uri;
  if (
    typeof issuer !== 'string' ||
    typeof authorizationEndpoint !== 'string' ||
    typeof tokenEndpoint !== 'string' ||
    typeof jwksUri !== 'string'
  ) {
    return null;
  }
  return { issuer, authorizationEndpoint, tokenEndpoint, jwksUri };
}

export function createDaemonOidcService(config: DaemonOidcConfig, deps: OidcServiceDeps = {}): DaemonOidcService {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;
  const mintToken = deps.mintToken ?? mintDaemonAuthToken;
  const findUserByEmail = deps.findUserByEmail ?? findDaemonUserByEmail;
  const createUser = deps.createUser ?? createDaemonUser;
  const reconcileGrants = deps.reconcileGrants ?? reconcileIdpWorkspaceRoles;
  const emitAudit = deps.emitAudit ?? emitAuditEntry;
  const workspaceExists = deps.workspaceExists ?? ((workspaceId: string) => Boolean(getWorkspace(workspaceId)));
  const offerGrantedWorkspaces = deps.offerGrantedWorkspaces;

  const scopes = (() => {
    const requested = config.scopes && config.scopes.length > 0 ? [...config.scopes] : [...DEFAULT_SCOPES];
    // `openid` makes the response an ID token; `email` is the directory
    // join key. Neither is optional whatever the config lists.
    for (const required of ['openid', 'email']) {
      if (!requested.includes(required)) requested.push(required);
    }
    return requested;
  })();
  const sessionTtlMs = Math.max(1, config.sessionTtlDays ?? DEFAULT_SESSION_TTL_DAYS) * 24 * 60 * 60_000;

  const pendingLogins = new Map<string, PendingLogin>();
  const pendingClaims = new Map<string, PendingClaim>();
  let discoveryPromise: Promise<OidcProviderMetadata> | null = null;
  let remoteJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  function prune(): void {
    const cutoffLogins = now() - PENDING_LOGIN_TTL_MS;
    for (const [state, entry] of pendingLogins) {
      if (entry.createdAt < cutoffLogins) pendingLogins.delete(state);
    }
    const cutoffClaims = now() - CLAIM_TTL_MS;
    for (const [code, entry] of pendingClaims) {
      if (entry.createdAt < cutoffClaims) pendingClaims.delete(code);
    }
  }

  async function discover(): Promise<OidcProviderMetadata> {
    if (discoveryPromise) return discoveryPromise;
    const url = `${config.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
    discoveryPromise = (async () => {
      const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`discovery ${url} answered ${response.status}`);
      const metadata = parseDiscovery(await response.json());
      if (!metadata) throw new Error(`discovery ${url} returned an incomplete document`);
      return metadata;
    })();
    try {
      return await discoveryPromise;
    } catch (err) {
      // Clear so the next login retries a transient issuer outage.
      discoveryPromise = null;
      throw err;
    }
  }

  const verifyIdToken =
    deps.verifyIdToken ??
    (async (idToken: string, metadata: OidcProviderMetadata, clientId: string): Promise<OidcIdTokenClaims> => {
      remoteJwks ??= createRemoteJWKSet(new URL(metadata.jwksUri));
      const { payload } = await jwtVerify(idToken, remoteJwks, {
        issuer: metadata.issuer,
        audience: clientId,
      });
      const claimPath = config.claimMappings?.claimPath;
      return {
        nonce: typeof payload.nonce === 'string' ? payload.nonce : undefined,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        emailVerified: typeof payload.email_verified === 'boolean' ? payload.email_verified : undefined,
        name: typeof payload.name === 'string' ? payload.name : undefined,
        ...(claimPath ? { mappingValues: extractClaimValues(payload as Record<string, unknown>, claimPath) } : {}),
      };
    });

  async function resolveDirectoryUser(
    claims: OidcIdTokenClaims,
    personalLicense: string | undefined,
  ): Promise<{ ok: true; record: DaemonUserRecord } | { ok: false; reason: OidcLoginFailureReason }> {
    const email = claims.email?.trim();
    if (!email) return { ok: false, reason: 'no-email' };
    // A provider that attests `email_verified: false` is telling us the
    // address is unproven — refusing beats binding a session to it.
    // Providers that omit the claim entirely pass (many enterprise IdPs
    // only issue verified addresses and skip the flag).
    if (claims.emailVerified === false) return { ok: false, reason: 'email-unverified' };
    const existing = await findUserByEmail(email);
    if (existing) {
      if (existing.deactivatedAt !== null) return { ok: false, reason: 'user-deactivated' };
      return { ok: true, record: existing };
    }
    if (!config.autoProvision) return { ok: false, reason: 'unknown-user' };
    const created: CreateDaemonUserResult = await createUser({
      displayName: claims.name?.trim() || email,
      email,
      ...(personalLicense ? { personalLicense } : {}),
    });
    if (!created.ok) {
      logger.warn(SCOPE, `auto-provision refused for ${email}: ${created.reason}`);
      // The seat gate's refusals keep their own reasons — the login
      // page renders the purchase/redeem path for the seat wall and a
      // specific message per personal-seat refusal instead of a generic
      // provisioning failure. The gate already emitted the audit row.
      switch (created.reason) {
        case 'seat-limit-reached':
        case 'personal-seats-disabled':
        case 'personal-license-invalid':
        case 'personal-license-identity-mismatch':
        case 'personal-license-no-identity':
          return { ok: false, reason: created.reason };
        default:
          return { ok: false, reason: 'provision-failed' };
      }
    }
    logger.info(SCOPE, `auto-provisioned directory user for ${email} (zero grants)`);
    return { ok: true, record: created.record };
  }

  /**
   * The claims→grant fold, run on EVERY completed login: reconcile the
   * user's `idp`-origin WRA rows against what the verified claims map
   * to, audit each applied change with the logging-in user as the
   * actor. Best-effort by design — a fold failure logs and the login
   * proceeds (the session is valid; grants keep their pre-login state).
   */
  async function applyClaimMappings(record: DaemonUserRecord, claims: OidcIdTokenClaims): Promise<void> {
    const mappings = config.claimMappings;
    if (!mappings) return;
    try {
      const { desired, unknownWorkspaceIds } = desiredGrantsFromClaims(
        claims.mappingValues ?? [],
        mappings.rules,
        workspaceExists,
      );
      if (unknownWorkspaceIds.length > 0) {
        logger.warn(SCOPE, `claim mapping skipped unknown workspaces: ${unknownWorkspaceIds.join(', ')}`);
      }
      const outcome = await reconcileGrants(record.principal.id, desired);
      for (const change of [...outcome.granted, ...outcome.updated]) {
        emitAudit({
          actorUserId: record.user.id,
          capability: 'daemon.sso-grant',
          workspaceId: change.workspaceId,
          decision: { allow: true },
        });
      }
      for (const change of outcome.revoked) {
        emitAudit({
          actorUserId: record.user.id,
          capability: 'daemon.sso-revoke',
          workspaceId: change.workspaceId,
          decision: { allow: true },
        });
      }
      if (outcome.granted.length > 0 && offerGrantedWorkspaces) {
        // A user logging in here may have other tabs already on the
        // wire — offer the newly visible rows to those sockets live.
        await offerGrantedWorkspaces(
          record.user.id,
          outcome.granted.map((change) => change.workspaceId),
        );
      }
      if (outcome.skippedManual.length > 0) {
        const pairs = outcome.skippedManual.map((s) => s.workspaceId).join(', ');
        logger.info(SCOPE, `claim mapping deferred to manual grants for user=${record.user.id}: ${pairs}`);
      }
      const applied = outcome.granted.length + outcome.updated.length + outcome.revoked.length;
      if (applied > 0) {
        logger.info(
          SCOPE,
          `claim mapping applied for user=${record.user.id}: +${outcome.granted.length} ` +
            `~${outcome.updated.length} -${outcome.revoked.length}`,
        );
      }
    } catch (err) {
      logger.warn(SCOPE, `claim mapping failed for user=${record.user.id}; login proceeds`, err);
    }
  }

  return {
    providerLabel(): string {
      if (config.providerLabel) return config.providerLabel;
      try {
        return new URL(config.issuer).hostname;
      } catch {
        return config.issuer;
      }
    },

    async beginLogin(externalOrigin: string, options?: { personalLicense?: string }): Promise<OidcBeginResult> {
      prune();
      if (pendingLogins.size >= PENDING_LOGIN_CAP) return { ok: false, reason: 'too-many-pending' };
      let metadata: OidcProviderMetadata;
      try {
        metadata = await discover();
      } catch (err) {
        logger.warn(SCOPE, 'provider discovery failed', err);
        return { ok: false, reason: 'provider-unavailable' };
      }
      const state = randomToken();
      const nonce = randomToken();
      const codeVerifier = randomToken();
      const bindingNonce = randomToken();
      const redirectUri = redirectUriFor(externalOrigin);
      const personalLicense = options?.personalLicense?.trim();
      pendingLogins.set(state, {
        nonce,
        codeVerifier,
        redirectUri,
        bindingHash: bindingHashOf(bindingNonce),
        ...(personalLicense ? { personalLicense } : {}),
        createdAt: now(),
      });
      const url = new URL(metadata.authorizationEndpoint);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', config.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('scope', scopes.join(' '));
      url.searchParams.set('state', state);
      url.searchParams.set('nonce', nonce);
      url.searchParams.set('code_challenge', pkceChallenge(codeVerifier));
      url.searchParams.set('code_challenge_method', 'S256');
      return { ok: true, authorizationUrl: url.toString(), bindingNonce };
    },

    async completeLogin(params): Promise<OidcCompleteResult> {
      prune();
      // One-shot: a state consumed here can never complete twice, so a
      // replayed callback URL dies as state-mismatch.
      const pending = pendingLogins.get(params.state);
      pendingLogins.delete(params.state);
      if (!pending) return { ok: false, reason: 'state-mismatch' };
      // The completing browser must present the binding cookie the flow
      // started with. Refusal is indistinguishable from a forged state —
      // no oracle separating "state exists" from "cookie wrong".
      if (!timingSafeEqual(bindingHashOf(params.bindingNonce), pending.bindingHash)) {
        logger.warn(SCOPE, 'callback refused: login-binding mismatch');
        return { ok: false, reason: 'state-mismatch' };
      }
      let metadata: OidcProviderMetadata;
      try {
        metadata = await discover();
      } catch (err) {
        logger.warn(SCOPE, 'provider discovery failed on callback', err);
        return { ok: false, reason: 'provider-unavailable' };
      }

      // Code exchange. The redirect_uri MUST be the one the flow started
      // with (the provider compares them), so it comes from the pending
      // entry, not from this request.
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: params.code,
        redirect_uri: pending.redirectUri,
        client_id: config.clientId,
        code_verifier: pending.codeVerifier,
      });
      const headers: Record<string, string> = {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      };
      if (config.clientSecret) {
        // Confidential client — client_secret_basic, the spec default.
        const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
        headers.authorization = `Basic ${basic}`;
      }
      let idToken: string;
      try {
        const response = await fetchImpl(metadata.tokenEndpoint, { method: 'POST', headers, body });
        if (!response.ok) throw new Error(`token endpoint answered ${response.status}`);
        const payload = (await response.json()) as Record<string, unknown>;
        if (typeof payload.id_token !== 'string') throw new Error('token response carries no id_token');
        idToken = payload.id_token;
      } catch (err) {
        logger.warn(SCOPE, 'code exchange failed', err);
        return { ok: false, reason: 'exchange-failed' };
      }

      let claims: OidcIdTokenClaims;
      try {
        claims = await verifyIdToken(idToken, metadata, config.clientId);
      } catch (err) {
        logger.warn(SCOPE, 'ID token verification failed', err);
        return { ok: false, reason: 'invalid-id-token' };
      }
      if (claims.nonce !== pending.nonce) return { ok: false, reason: 'nonce-mismatch' };

      const resolved = await resolveDirectoryUser(claims, pending.personalLicense);
      if (!resolved.ok) {
        logger.warn(SCOPE, `SSO login refused: ${resolved.reason} (email=${claims.email ?? 'none'})`);
        return { ok: false, reason: resolved.reason };
      }

      // Grants land before the mint so the session's first join already
      // sees what the claims map to.
      await applyClaimMappings(resolved.record, claims);

      const email = resolved.record.userIdentity.value ?? claims.email ?? '';
      const minted: MintDaemonAuthTokenResult = await mintToken({
        label: `sso:${email}`,
        userId: resolved.record.user.id,
        kind: 'session',
        expiresAt: now() + sessionTtlMs,
      });
      const claimCode = randomToken();
      pendingClaims.set(claimCode, { secret: minted.secret, createdAt: now() });
      logger.info(SCOPE, `SSO login minted session token ${minted.record.id} for user=${resolved.record.user.id}`);
      return { ok: true, claimCode, userId: resolved.record.user.id, email };
    },

    claimToken(claimCode: string): { secret: string } | null {
      prune();
      const entry = pendingClaims.get(claimCode);
      if (!entry) return null;
      pendingClaims.delete(claimCode);
      return { secret: entry.secret };
    },

    dispose(): void {
      pendingLogins.clear();
      pendingClaims.clear();
    },
  };
}
