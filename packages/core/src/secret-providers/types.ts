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

import type { SecretLocator, SecretManagerConnection, SecretProviderId } from '../types';

export type { SecretLocator, SecretManagerConnection, SecretProviderId } from '../types';

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
 *   - `denied`               — the user declined the manager's own
 *                              authorization prompt; the next use asks
 *                              again (a consent outcome, never a fault).
 *   - `unreachable`          — a remote endpoint didn't answer.
 *   - `broker-unreachable`   — this surface resolves through the
 *                              desktop app on this device, and the
 *                              desktop app is not connected.
 */
export type SecretProviderUnavailableReason =
  | 'not-installed'
  | 'integration-disabled'
  | 'no-credentials'
  | 'locked'
  | 'denied'
  | 'unreachable'
  | 'broker-unreachable';

export type SecretProviderProbe =
  | { available: true }
  | { available: false; reason: SecretProviderUnavailableReason; detail?: string };

/**
 * Why one locator failed to resolve. `authorization-required` is a
 * NORMAL outcome (the provider's own lock/approval policy said "ask
 * again") — consumers surface a retry affordance, never treat it as a
 * crash. We never manage provider sessions ourselves (L1).
 * `broker-unreachable` is the browser host's own gap: its entries
 * resolve through the desktop app on this device, and it is away.
 */
export type SecretResolveFailureReason = 'authorization-required' | 'not-found' | 'unavailable' | 'broker-unreachable';

export type SecretResolution =
  | { ok: true; value: string }
  | { ok: false; reason: SecretResolveFailureReason; detail?: string };

/** Who answers a surface's secret-manager calls: the host's own
 *  providers, the desktop app on this device over loopback, or nobody
 *  while the desktop app is away. */
export type SecretBrokerKind = 'local' | 'desktop-app' | 'unreachable';

/** One referenced entry of a send — its vault name and its locator. */
export interface SecretBrokerEntry {
  name: string;
  locator: SecretLocator;
}

/**
 * The seam between a resolving surface and the providers — one send's
 * referenced secret-manager entries in, each one's typed result out,
 * keyed by name. A node host's broker resolves through its own
 * providers and connections; the browser's broker asks the desktop
 * app on this device over loopback (the same-device law). Values live
 * only in the returned map for the one send (L1).
 */
export interface SecretManagerBroker {
  resolveBatch(entries: readonly SecretBrokerEntry[]): Promise<ReadonlyMap<string, SecretResolution>>;
}

/** The authorization gesture's outcome; a refusal carries the standing
 *  reason it left behind (the probe's vocabulary) so the surface that
 *  asked can name the fix beside the vendor's detail. */
export type SecretAuthorizeResult =
  | { ok: true }
  | { ok: false; reason?: SecretProviderUnavailableReason; detail?: string };

/**
 * One external secret manager behind the seam. Every call names the
 * CONNECTION it acts through — the provider is the integration, the
 * connection is one configured instance of it (an account, a server,
 * a profile); a provider holds no instance state of its own beyond
 * what it caches per connection.
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
  /**
   * Is the connection usable right now, and if not, why not. Side-effect
   * free by contract: a probe never prompts the user — the status chip
   * and the settings list call it freely.
   */
  probe(connection: SecretManagerConnection): Promise<SecretProviderProbe>;
  /**
   * Kick off the connection's interactive authorization when the
   * provider supports one (a broker prompt, a device flow) — the
   * settings list's Test / Sign in gesture. Absent on providers whose
   * auth is entirely ambient (credential chains, OS ACL prompts).
   */
  authorize?(connection: SecretManagerConnection): Promise<SecretAuthorizeResult>;
  /** Resolve one locator through the connection to its current secret value. */
  resolve(connection: SecretManagerConnection, locator: SecretLocator): Promise<SecretResolution>;
}
