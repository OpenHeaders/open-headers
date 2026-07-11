/**
 * The web tab's daemon access token — one origin-scoped slot for the
 * one backend this tab can have (the daemon that served it).
 *
 * The wire's HELLO reads the token synchronously, so the slot hydrates
 * into memory once at boot. The login gate sets a CANDIDATE token in
 * memory first and persists only after the daemon's WELCOME accepts it
 * — a token check is a real handshake, never a local comparison.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { hostStorage, OH } from '@openheaders/core/storage';

const SCOPE = 'DaemonToken';

let current: string | null = null;

/** Hydrate the persisted token into memory. Called once by host boot. */
export async function hydrateDaemonToken(): Promise<void> {
  try {
    const stored = await hostStorage.get(OH.webBackendToken);
    current = stored && stored.length > 0 ? stored : null;
  } catch (err) {
    logger.warn(SCOPE, 'token hydrate failed; treating as absent', err);
    current = null;
  }
}

/** Synchronous read — the wire's HELLO auth dep. */
export function peekDaemonToken(): string | null {
  return current;
}

/** True when a persisted (or candidate) token is present. */
export function hasDaemonToken(): boolean {
  return current !== null;
}

/**
 * Install a candidate token in memory only — the login gate calls this
 * before its probe handshake so the next HELLO carries it without
 * committing an unverified secret to storage.
 */
export function setCandidateDaemonToken(token: string): void {
  current = token.length > 0 ? token : null;
}

/** Persist the current in-memory token (post-WELCOME-accept). */
export async function persistDaemonToken(): Promise<void> {
  if (current === null) return;
  await hostStorage.set(OH.webBackendToken, current);
}

/** Drop the persisted token and clear the in-memory slot (sign-out). */
export async function clearDaemonToken(): Promise<void> {
  current = null;
  await hostStorage.remove(OH.webBackendToken);
}
