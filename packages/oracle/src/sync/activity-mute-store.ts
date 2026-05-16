/**
 * Activity Feed mute store — Phase C F6.b.
 *
 * Durable backing for the per-workspace mute list. The cache module
 * ({@link ActivityMuteCache}) is the source of truth at runtime; this
 * store exists so a mute survives across SW restarts and desktop main
 * restarts.
 *
 * Contract:
 *
 *   - **Idempotent `put`.** Same `(workspaceId, entityType, entityId)`
 *     overwrites the entry in place; `mutedAt` reflects the most
 *     recent mute gesture.
 *   - **Workspace-scoped reads.** Every read takes a `workspaceId`;
 *     cross-workspace bleed is structurally impossible at the key level.
 *   - **No tombstones.** `remove` is the unmute. Re-muting after an
 *     unmute is a fresh `put`.
 *
 * Two production backends mirror the {@link ActivityLog} layout:
 *
 *   - {@link IdbActivityMuteStore} — extension SW.
 *   - {@link SqliteActivityMuteStore} — desktop main / future daemon.
 *
 * Tests use the in-memory reference impl below.
 */

import type { ActivityMuteEntry } from '@openheaders/core/sync';

export interface ActivityMuteStore {
  /** Insert or replace the mute entry. Idempotent on the unique key. */
  put(entry: ActivityMuteEntry): Promise<void>;

  /** Drop the entry, if present. No-op when absent. */
  remove(workspaceId: string, entityType: string, entityId: string): Promise<void>;

  /** Existence check; cheap. */
  has(workspaceId: string, entityType: string, entityId: string): Promise<boolean>;

  /** Full list for one workspace; insertion order. Used to hydrate the cache. */
  list(workspaceId: string): Promise<ActivityMuteEntry[]>;
}

/**
 * Pure in-memory reference implementation. Used by tests + the
 * cold-start window before a durable backend resolves.
 */
export class InMemoryActivityMuteStore implements ActivityMuteStore {
  private readonly buckets = new Map<string, Map<string, ActivityMuteEntry>>();

  private bucket(workspaceId: string): Map<string, ActivityMuteEntry> {
    let b = this.buckets.get(workspaceId);
    if (!b) {
      b = new Map();
      this.buckets.set(workspaceId, b);
    }
    return b;
  }

  private key(entityType: string, entityId: string): string {
    return `${entityType}:${entityId}`;
  }

  async put(entry: ActivityMuteEntry): Promise<void> {
    const b = this.bucket(entry.workspaceId);
    b.set(this.key(entry.entityType, entry.entityId), { ...entry });
  }

  async remove(workspaceId: string, entityType: string, entityId: string): Promise<void> {
    const b = this.buckets.get(workspaceId);
    if (!b) return;
    b.delete(this.key(entityType, entityId));
  }

  async has(workspaceId: string, entityType: string, entityId: string): Promise<boolean> {
    const b = this.buckets.get(workspaceId);
    if (!b) return false;
    return b.has(this.key(entityType, entityId));
  }

  async list(workspaceId: string): Promise<ActivityMuteEntry[]> {
    const b = this.buckets.get(workspaceId);
    if (!b) return [];
    return [...b.values()];
  }
}
