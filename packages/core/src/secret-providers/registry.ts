/**
 * Secret-provider registry — the install seam between the host and the
 * provider implementations it supports. Same idiom as the capability
 * registry and the blob-backend seam: hosts register at boot, shared
 * code reads through the accessors and branches cleanly on absence.
 *
 * Default state is the NULL registry — no provider installed anywhere.
 * A `secret-manager` vault entry whose provider is unregistered
 * resolves to a typed `unavailable` failure, which is the honest answer
 * on any host that can't reach that manager (and on every host until a
 * provider implementation ships).
 */

import type { SecretProviderId } from '../types';
import type { SecretProvider } from './types';

const installed = new Map<SecretProviderId, SecretProvider>();

/**
 * Install (or replace) a provider. Hosts call this once at boot for
 * every manager they integrate; tests use it to install fakes.
 */
export function registerSecretProvider(impl: SecretProvider): void {
  installed.set(impl.id, impl);
}

/** Drop a provider — primarily for test teardown. */
export function unregisterSecretProvider(id: SecretProviderId): void {
  installed.delete(id);
}

/** The installed provider for `id`, or `undefined` when this host has none. */
export function getSecretProvider(id: SecretProviderId): SecretProvider | undefined {
  return installed.get(id);
}

/** Every provider installed on this host. */
export function listSecretProviders(): SecretProvider[] {
  return [...installed.values()];
}
