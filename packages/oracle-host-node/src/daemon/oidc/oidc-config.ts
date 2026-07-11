/**
 * OIDC provider configuration (Phase 5 slice 3, DAEMON_PLAN.md §4 team
 * tier). One provider per daemon; the shell reads it from `daemon.json`
 * (client secret optionally from the environment) and threads it into
 * the spine. SSO is ADDITIVE — daemon-local users, pairing, and
 * operator-minted tokens keep working unchanged (§11.4 fallback law).
 */

import type { WorkspaceRole } from '@openheaders/core/types';

/** One claims→grant rule: claim value present ⇒ this workspace role. */
export interface OidcClaimMappingRule {
  /** Claim value that activates the rule (exact string match). */
  value: string;
  /** Canonical workspace id the role lands on. */
  workspaceId: string;
  role: WorkspaceRole;
}

/**
 * IdP claims→workspace-grant mapping, applied on EVERY login — the IdP
 * is authoritative for the grants it maps: a mapped grant whose claim
 * disappears is dropped on the user's next login. Manual operator
 * grants are a separate axis (origin-less WRA rows) and stay sticky;
 * a manual row always wins its `(user, workspace)` pair.
 */
export interface OidcClaimMappings {
  /**
   * Dot-path into the verified ID token's payload where the mapped
   * values live (e.g. `groups`, or `realm_access.roles` for Keycloak
   * realm roles). The leaf may be a string array or a single string.
   */
  claimPath: string;
  rules: readonly OidcClaimMappingRule[];
}

export interface DaemonOidcConfig {
  /**
   * The provider's issuer URL — discovery runs against
   * `<issuer>/.well-known/openid-configuration` and the ID token's `iss`
   * claim must match what discovery reports.
   */
  issuer: string;
  /** OAuth client id registered with the provider. */
  clientId: string;
  /**
   * Client secret for confidential clients (sent as HTTP Basic on the
   * code exchange). Absent = public client — PKCE alone carries the
   * exchange, so a daemon can run SSO without any secret on disk.
   */
  clientSecret?: string;
  /**
   * Scopes requested on the authorization redirect. Defaults to
   * `openid email profile` — `email` is mandatory for the directory
   * join and is enforced even when this list omits it.
   */
  scopes?: readonly string[];
  /**
   * Create a directory user on first SSO login when the verified email
   * matches no record. Default false: only pre-created users
   * (`ohd user add --email`) can sign in — fail-closed, the
   * operator controls the directory. Auto-provisioned users start with
   * ZERO workspace grants; RBAC deny-by-default holds on both planes.
   */
  autoProvision?: boolean;
  /**
   * Lifetime of the session token an SSO login mints, in days.
   * Default 30. The minted token is a user-bound {@link DaemonAuthToken}
   * with `expiresAt`; validation refuses it past this window and the
   * user re-authenticates against the IdP.
   */
  sessionTtlDays?: number;
  /**
   * The externally visible origin the IdP redirects back to
   * (e.g. `https://oh.example.com`) — its `/auth/oidc/callback` must be
   * registered with the provider. Absent = derived per request from the
   * admission-validated `Host` header (`X-Forwarded-Proto`-aware behind
   * a trusted proxy).
   */
  redirectOrigin?: string;
  /** Human-readable provider name for the login gate's SSO button. */
  providerLabel?: string;
  /**
   * Claims→grant mapping. Absent = no automated grants; every grant is
   * a manual operator act (the pre-mapping behavior, unchanged).
   */
  claimMappings?: OidcClaimMappings;
}
