/**
 * Awareness bridge RPCs (Phase A A1) — publishing a surface's presence
 * and snapshotting the canonical presence list for a fresh mount.
 */

import type { AwarenessPublishRequest, AwarenessPublishResponse, AwarenessState } from '../awareness-bridge';
import type { SyncRpcNotReadyResponse } from '../sync-bridge';

export interface AwarenessRpc {
  /**
   * Publish or refresh this surface's presence with the SW awareness
   * store. The SW returns the post-GC canonical presence list — the
   * caller folds it into its local mirror immediately, and every other
   * surface receives the same list via the `awarenessBroadcast` event.
   * Awareness is ephemeral; nothing persists.
   */
  'oh.awareness.publish': {
    req: Omit<AwarenessPublishRequest, 'type'>;
    res: AwarenessPublishResponse;
  };
  /**
   * Snapshot the canonical presence for a freshly-mounted surface so
   * its mirror has a starting view before the next publish/broadcast.
   */
  'oh.awareness.snapshot': {
    req: Record<string, never>;
    res: { workspaceId: string | null; presence: AwarenessState[] } | SyncRpcNotReadyResponse;
  };
}
