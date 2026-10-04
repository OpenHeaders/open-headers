/**
 * Durable per-backend identity-change registry — the persisted record
 * of a host changing identity behind a connection record (the mirror of
 * the Org-uniqueness invariant: one record, one Org).
 *
 * A record names one address and one credential; the Org its WELCOME
 * announces is the host's identity, learned on first use. When a later
 * WELCOME over the same record names a different Org, the host behind
 * the address is a different installation — a wiped or reinstalled
 * store, a build with its own data dir, a server rebuilt from scratch,
 * a record re-pointed at another machine. The handshake resolves it by
 * the wire's trust posture and writes one row here either way, so the
 * connections list can say what happened under the row: `replaced`
 * (accepted on a trust-by-process wire; the person dismisses it) or
 * `pending` (refused on an authenticated wire; the person accepts it,
 * and the record's next successful join clears it). One row per
 * `backendId` — a later change refreshes it in place; removing the
 * record prunes it.
 */

import { hostStorage } from '../storage/host-storage';
import { type BackendIdentityChange, OH } from '../storage/keys';
import { createMutex } from '../utils/mutex';

/** Serializes every read-modify-write on the identity-changes slot. */
const withChangesLock = createMutex();

export type RecordBackendIdentityChangeInput = Omit<BackendIdentityChange, 'at'>;

/** Upsert the row for `backendId` — a later change refreshes it in place. */
export function recordBackendIdentityChange(input: RecordBackendIdentityChangeInput): Promise<void> {
  return withChangesLock(async () => {
    const stored = (await hostStorage.get(OH.backendIdentityChanges)) ?? [];
    const next: BackendIdentityChange = { ...input, at: new Date().toISOString() };
    const rest = stored.filter((row) => row.backendId !== input.backendId);
    await hostStorage.set(OH.backendIdentityChanges, [...rest, next]);
  });
}

/**
 * Drop a PENDING row for `backendId` — the record's join succeeded, so
 * the identity the person accepted is now the one bound. A replaced
 * row is untouched: it waits for the person's dismissal, since the
 * same Org re-announces itself on every reconnect. No-op (no write)
 * when nothing matches.
 */
export function resolvePendingBackendIdentityChange(backendId: string): Promise<void> {
  return withChangesLock(async () => {
    const stored = (await hostStorage.get(OH.backendIdentityChanges)) ?? [];
    const next = stored.filter((row) => !(row.backendId === backendId && row.resolution === 'pending'));
    if (next.length === stored.length) return;
    await hostStorage.set(OH.backendIdentityChanges, next);
  });
}

/**
 * Drop whatever row `backendId` holds — the person dismissed the
 * notice, or the record was removed. No-op (no write) when none exists.
 */
export function dismissBackendIdentityChange(backendId: string): Promise<void> {
  return withChangesLock(async () => {
    const stored = (await hostStorage.get(OH.backendIdentityChanges)) ?? [];
    const next = stored.filter((row) => row.backendId !== backendId);
    if (next.length === stored.length) return;
    await hostStorage.set(OH.backendIdentityChanges, next);
  });
}
