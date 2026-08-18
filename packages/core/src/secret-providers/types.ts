/**
 * SecretProvider — the seam between vault `secret-manager` entries and
 * the external secret managers that actually hold the values. One
 * implementation per manager, registered per host at boot (see
 * `registry.ts`); the vault row stores only a structured locator, never
 * the secret.
 *
 * Provider ids are brand-free in source (standing rule); the product
 * each id maps to is documented in the secret-providers plan.
 *
 * Resolution is always host-side where the provider is installed (the
 * desktop main process); renderer/extension surfaces consume resolved
 * values over existing wires and never hold a provider instance.
 */

import type { SecretLocator, SecretProviderId } from '../types';

export type { SecretLocator, SecretProviderId } from '../types';

/**
 * Why a registered provider can't serve resolves right now. Distinct
 * from resolve-time failures: probe reasons describe the provider's
 * standing state, and the UI's status chip renders them as honest
 * affordances (install / unlock / sign in — L4).
 *
 *   - `not-installed`        — the local prerequisite (companion app,
 *                              OS facility) is absent on this machine.
 *   - `integration-disabled` — the prerequisite exists but its
 *                              third-party-integration surface is off.
 *   - `no-credentials`       — no usable credential chain (cloud
 *                              profile/env/token) was found.
 *   - `locked`               — the manager is present but locked and
 *                              can't be unlocked non-interactively.
 *   - `unreachable`          — a remote endpoint didn't answer.
 */
export type SecretProviderUnavailableReason =
  | 'not-installed'
  | 'integration-disabled'
  | 'no-credentials'
  | 'locked'
  | 'unreachable';

export type SecretProviderProbe =
  | { available: true }
  | { available: false; reason: SecretProviderUnavailableReason; detail?: string };

/**
 * Why one locator failed to resolve. `authorization-required` is a
 * NORMAL outcome (the provider's own lock/approval policy said "ask
 * again") — consumers surface a retry affordance, never treat it as a
 * crash. We never manage provider sessions ourselves (L1).
 */
export type SecretResolveFailureReason = 'authorization-required' | 'not-found' | 'unavailable';

export type SecretResolution =
  | { ok: true; value: string }
  | { ok: false; reason: SecretResolveFailureReason; detail?: string };

export type SecretAuthorizeResult = { ok: true } | { ok: false; detail?: string };

/**
 * One external secret manager behind the seam.
 *
 * `yields` declares what `resolve` produces — `'concealed-string'` is
 * the only yield today (TOTP yield is deferred, demand-gated). The
 * declaration exists so future yields extend the union instead of
 * changing the method shape.
 *
 * Every method is async and non-throwing by contract: failures come
 * back as typed results so callers never need provider-specific
 * try/catch.
 */
export interface SecretProvider {
  readonly id: SecretProviderId;
  readonly yields: 'concealed-string';
  /** Is the provider usable right now, and if not, why not. */
  probe(): Promise<SecretProviderProbe>;
  /**
   * Kick off the provider's interactive authorization when it supports
   * one (a broker prompt, a device flow). Absent on providers whose
   * auth is entirely ambient (credential chains, OS ACL prompts).
   */
  authorize?(): Promise<SecretAuthorizeResult>;
  /** Resolve one locator to its current secret value. */
  resolve(locator: SecretLocator): Promise<SecretResolution>;
}
