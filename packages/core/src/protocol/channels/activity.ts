/**
 * Activity-feed bridge RPCs (Phase C F5/F8) — reading the workspace-wide
 * inbound-mutation feed, the read-flag + mute state, and the F6.d
 * Revert path.
 */

import type { ActivityEntry, ActivityMuteEntry, InverseEnvelopeContext } from '../../sync';

export interface ActivityRpc {
  /**
   * Read the workspace-wide activity feed — newest-first list of
   * inbound mutation classifications produced by the F2 receiver-side
   * classifier. `limit` defaults to 100 if omitted; `sinceHlcKey`
   * filters to entries strictly newer than the cursor (paging for
   * live tails); `unreadOnly` restricts to entries the user has not
   * yet acknowledged.
   *
   * Returns an empty list when no activity log is installed yet
   * (boot race) — callers re-fetch on the `activityEntry` broadcast.
   */
  'oh.sync.listActivity': {
    req: { workspaceId: string; limit?: number; sinceHlcKey?: string; unreadOnly?: boolean };
    res: { entries: ActivityEntry[] };
  };
  /**
   * Flip the `read` flag on the given entry ids. Used by the panel to
   * mark rows as the user views them (F8). Idempotent.
   */
  'oh.sync.markActivityRead': {
    req: { workspaceId: string; ids: readonly string[] };
    res: { ok: true };
  };
  /**
   * Read the workspace's mute list. The classifier-installer gate
   * checks the cache populated from this list — RPC handlers and the
   * cache share the same source of truth in the host process.
   */
  'oh.sync.listActivityMutes': {
    req: { workspaceId: string };
    res: { mutes: ActivityMuteEntry[] };
  };
  /**
   * Mute `(entityType, entityId)` in `workspaceId`. The installer drops
   * further inbound activity rows for the pair until an
   * {@link ActivityRpc#unmuteActivityEntity} call clears it. Idempotent —
   * re-muting refreshes `mutedAt` but does not double-count.
   */
  'oh.sync.muteActivityEntity': {
    req: { workspaceId: string; entityType: string; entityId: string };
    res: { ok: true; entry: ActivityMuteEntry };
  };
  /**
   * Unmute `(entityType, entityId)` in `workspaceId`. Idempotent —
   * unmuting an absent pair is `ok: true` with no side-effect.
   */
  'oh.sync.unmuteActivityEntity': {
    req: { workspaceId: string; entityType: string; entityId: string };
    res: { ok: true };
  };
  /**
   * Emit the inverse of an inbound mutation captured in the workspace's
   * activity feed (F6.d Revert). The renderer carries the
   * {@link InverseEnvelopeContext} the F2 classifier embedded on the
   * structural entry; the host validates against current state, mints
   * an envelope, and routes through {@link SyncEngineRpc#apply} so the
   * inverse is HLC-stamped + broadcast + persisted like any local
   * mutation. The local emit is NOT in the wire-side seen set, so the
   * revert itself does not appear in the activity feed.
   *
   * Returns `{ ok: false }` with a structured reason on validation
   * failure (e.g. entity has been tombstoned since the prior was
   * captured, set member moved away). The UI maps reasons to
   * user-facing copy.
   */
  'oh.sync.revertActivity': {
    req: {
      workspaceId: string;
      entityType: string;
      entityId: string;
      inverse: InverseEnvelopeContext;
    };
    res: { ok: true; mutationId: string } | { ok: false; reason: string };
  };
}
