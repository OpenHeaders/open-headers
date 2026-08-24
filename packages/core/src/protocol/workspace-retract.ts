/**
 * Workspace retraction wire type — the revoke twin of the grant-time
 * workspace offer (the access-foundation plan §8 F2, S5c).
 *
 * A revoked grant mutates no row — it changes who may read one — so a
 * workspace revoked while the user's socket is up would stay visible in
 * the open tab until reload. The server closes that gap by pushing this
 * frame to the revoked user's connected sockets; the receiving client
 * evicts the workspace locally (state surgery, the eviction law in
 * `workspace-eviction.ts`). Deliberately NOT a synced delete: a
 * tombstone's fresh HLC would outrank the server's workspace state for
 * every peer forever, and this frame is only ever sent to the revoked
 * user's own sockets — no other peer can observe it.
 */

import * as v from 'valibot';

export const SYNC_WORKSPACE_RETRACT_TYPE = 'oh.sync.workspaceRetract' as const;

export interface SyncWorkspaceRetractMessage {
  type: typeof SYNC_WORKSPACE_RETRACT_TYPE;
  /** The workspace the receiving user no longer holds a grant on. */
  workspaceId: string;
}

export const SyncWorkspaceRetractMessageSchema = v.object({
  type: v.literal(SYNC_WORKSPACE_RETRACT_TYPE),
  workspaceId: v.pipe(v.string(), v.minLength(1)),
});
