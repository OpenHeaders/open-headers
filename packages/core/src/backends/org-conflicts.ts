/**
 * Durable per-(backend, Org) conflict registry — the persisted record of
 * WELCOME refusals under the Org-uniqueness invariant
 * (MULTI_BACKEND_PLAN.md §2: one Org, one backend).
 *
 * The refusal itself is surfaced twice: the per-backend sync-status slot
 * carries it temporally (a later report overwrites it), and this slot
 * carries it durably so the connections list can keep the conflict
 * visible under the row until it actually resolves. One row per
 * `(backendId, orgId)` — re-refusals refresh the row in place.
 *
 * Lifecycle: written by the handshake's refusal branch; cleared when the
 * same backend later claims the Org successfully (the binding moved or
 * the row was stale) and pruned wholesale when the refused record is
 * removed. `boundBackendId` is an id, not a label — consumers resolve it
 * against the live registry at render time.
 */

import { hostStorage } from '../storage/host-storage';
import { type BackendOrgConflict, OH } from '../storage/keys';
import { createMutex } from '../utils/mutex';

/** Serializes every read-modify-write on the conflicts slot. */
const withConflictsLock = createMutex();

export type RecordBackendOrgConflictInput = Omit<BackendOrgConflict, 'at'>;

/**
 * Upsert the conflict row for `(backendId, orgId)` — a repeat refusal
 * refreshes the name/provider/timestamp in place.
 */
export function recordBackendOrgConflict(input: RecordBackendOrgConflictInput): Promise<void> {
  return withConflictsLock(async () => {
    const stored = (await hostStorage.get(OH.backendOrgConflicts)) ?? [];
    const next: BackendOrgConflict = { ...input, at: new Date().toISOString() };
    const rest = stored.filter((c) => !(c.backendId === input.backendId && c.orgId === input.orgId));
    await hostStorage.set(OH.backendOrgConflicts, [...rest, next]);
  });
}

/**
 * Drop the row for `(backendId, orgId)` — the backend's claim succeeded,
 * so the conflict resolved. No-op (no write) when no row exists.
 */
export function clearBackendOrgConflict(backendId: string, orgId: string): Promise<void> {
  return withConflictsLock(async () => {
    const stored = (await hostStorage.get(OH.backendOrgConflicts)) ?? [];
    const next = stored.filter((c) => !(c.backendId === backendId && c.orgId === orgId));
    if (next.length === stored.length) return;
    await hostStorage.set(OH.backendOrgConflicts, next);
  });
}

/**
 * Drop every row recorded against `backendId` — its record was removed,
 * so there is no row to render them under. Rows naming it as the
 * PROVIDER stay: they still describe the refused backend's last attempt
 * truthfully until that backend re-handshakes and claims the Org.
 */
export function pruneBackendOrgConflictsForBackend(backendId: string): Promise<void> {
  return withConflictsLock(async () => {
    const stored = (await hostStorage.get(OH.backendOrgConflicts)) ?? [];
    const next = stored.filter((c) => c.backendId !== backendId);
    if (next.length === stored.length) return;
    await hostStorage.set(OH.backendOrgConflicts, next);
  });
}
