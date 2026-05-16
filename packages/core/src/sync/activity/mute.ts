/**
 * Activity Feed mute — Phase C F6.b.
 *
 * Workspace-scoped suppression list: when the user mutes a specific
 * entity (rule, request, environment, …), the classifier still produces
 * mutator outcomes for that entity but the receiver-side installer
 * drops the resulting {@link ActivityEntry} before it reaches the feed
 * log or the unread badge.
 *
 * Three invariants drive the wire shape:
 *
 *   - **`(workspaceId, entityType, entityId)` is the unique key.** Mute
 *     a rule by its uid, not by its current name — a rename mustn't
 *     un-mute the row, and the entity might not exist on this host
 *     anyway (peer just created and you decided you didn't care).
 *   - **Wall-clock `mutedAt` only.** No HLC. Mutes are a local UI
 *     preference, never cross trust zones; we wouldn't want a peer's
 *     mute decision leaking onto our feed.
 *   - **Open-ended.** No tombstone; `remove` is the unmute.
 *
 * Design source: `docs/DATA_PLANE_TOPOLOGIES.md` §11.6 (Activity Feed)
 * and `docs/PHASE_C_D_STATUS.md` F6 row.
 */
import type { EntityType } from '../envelope';

export interface ActivityMuteEntry {
  workspaceId: string;
  entityType: EntityType;
  entityId: string;
  /** Wall-clock millis the user muted at. Display-only; ordering follows insertion. */
  mutedAt: number;
}

/**
 * Canonical cache / index key for a `(entityType, entityId)` pair within
 * one workspace. Workspace prefix is handled at the storage layer; this
 * helper is the in-memory `Set<string>` key.
 */
export function activityMuteKey(entityType: EntityType, entityId: string): string {
  return `${entityType}:${entityId}`;
}
