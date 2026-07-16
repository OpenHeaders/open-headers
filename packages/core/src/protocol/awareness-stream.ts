/**
 * Cross-host awareness frame — same-trust-zone presence forwarding over
 * the localhost WS pipe.
 *
 * Each host (extension SW, desktop main) owns an independent in-memory
 * awareness store (`packages/oracle/src/sync/awareness.ts`). For surfaces
 * mounted on a single host (two workbench tabs, popup + sidepanel) the
 * local store is the full picture. But for the T2 topology — same user,
 * same machine, extension + desktop on localhost — surfaces mounted on
 * the other host don't appear in the local store unless we ship their
 * presence over the wire.
 *
 * The wire frame is a flat snapshot of the sender's CURRENT presence
 * list for one workspace. The receiver upserts each state into its
 * local store (instanceIds are globally unique, so peer and local rows
 * coexist). The 30s TTL handles staleness; no separate disconnect frame
 * is required for Phase C (peer-drop = no fresh frames = entries age
 * out within a TTL window).
 *
 * Echo prevention rides on `identity.appId`: each host forwards ONLY
 * states whose `appId` matches its own (extension forwards extension
 * surfaces; desktop forwards desktop surfaces). Peer-received states
 * are not re-sent, so the wire never loops.
 */

import * as v from 'valibot';

import type { AwarenessState } from './awareness-bridge';

export const SYNC_AWARENESS_PRESENCE_TYPE = 'oh.awareness.presence' as const;

export interface SyncAwarenessPresenceMessage {
  type: typeof SYNC_AWARENESS_PRESENCE_TYPE;
  workspaceId: string;
  presence: readonly AwarenessState[];
}

// ── Schemas ───────────────────────────────────────────────────────────
//
// AwarenessState carries opaque-ish `identity` + focus refs + dirty
// paths + an HLC. The wire boundary validates structural shape only;
// per-entity sanitization (sensitive-field-strip) re-runs in the local
// awareness store when it ingests the published state.

const HlcShape = v.object({
  physicalMs: v.pipe(v.number(), v.integer(), v.minValue(0)),
  logical: v.pipe(v.number(), v.integer(), v.minValue(0)),
  nodeId: v.pipe(v.string(), v.minLength(1)),
});

const EntityRefShape = v.object({
  type: v.pipe(v.string(), v.minLength(1)),
  id: v.pipe(v.string(), v.minLength(1)),
});

const FieldRefShape = v.object({
  type: v.pipe(v.string(), v.minLength(1)),
  id: v.pipe(v.string(), v.minLength(1)),
  path: v.string(),
});

const PresenceIdentityShape = v.looseObject({
  instanceId: v.pipe(v.string(), v.minLength(1)),
  surfaceKind: v.picklist(['workbench', 'popup', 'devpanel', 'sidepanel']),
  appId: v.picklist(['extension', 'desktop', 'cli', 'web']),
  labelContext: v.optional(v.string()),
});

const AwarenessStateShape = v.object({
  identity: PresenceIdentityShape,
  entityFocus: v.nullable(EntityRefShape),
  fieldFocus: v.nullable(FieldRefShape),
  dirtyFields: v.array(v.string()),
  lastActivityHlc: HlcShape,
});

export const SyncAwarenessPresenceMessageSchema = v.object({
  type: v.literal(SYNC_AWARENESS_PRESENCE_TYPE),
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  presence: v.array(AwarenessStateShape),
});
