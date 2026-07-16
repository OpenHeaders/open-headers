/**
 * Best-effort remote attribution for conflict chips — resolves "who
 * committed the diverging value" from the awareness mirror.
 */

import type { AwarenessState } from '@openheaders/core/protocol';
import type { getActiveAwarenessMirror } from '@openheaders/ui/context';
import type { ConflictRemoteInfo } from './types';

function describeRemote(presence: readonly AwarenessState[], now: number): ConflictRemoteInfo | undefined {
  if (presence.length === 0) return undefined;
  // Most-recent peer wins when several are in the candidate set.
  const sorted = [...presence].sort((a, b) => b.lastActivityHlc.physicalMs - a.lastActivityHlc.physicalMs);
  const top = sorted[0];
  const agoMs = Math.max(0, now - top.lastActivityHlc.physicalMs);
  return {
    surfaceKind: top.identity.surfaceKind,
    surfaceLabelContext: top.identity.labelContext,
    instanceId: top.identity.instanceId,
    agoMs,
  };
}

/**
 * Cascade peer lookup so attribution survives the saving peer moving
 * on. Signal weakens as we broaden scope, but a best-guess
 * attribution beats going silent — the user always wants to see
 * "this came from somewhere", even when that somewhere is their own
 * other tab they forgot about.
 *
 *   1. Peer focused on this exact field — strongest signal.
 *   2. Peer focused on this entity (different field) — still likely
 *      the same author who just navigated within the editor.
 *   3. Any peer alive on this workspace, most-recently-active first —
 *      catches "saved + closed tab" and cross-surface rename cases.
 *
 * The local surface is excluded at every tier; same-user-different-tab
 * is NOT excluded — that's the most useful case to surface.
 */
export function findRemoteAttribution(
  mirror: ReturnType<typeof getActiveAwarenessMirror>,
  entityType: string,
  entityId: string,
  path: string,
  localInstanceId: string | undefined,
  now: number,
): ConflictRemoteInfo | undefined {
  const opts = { excludeInstanceId: localInstanceId };
  const fieldPeers = mirror.getPresenceForField({ type: entityType, id: entityId, path }, opts);
  if (fieldPeers.length > 0) return describeRemote(fieldPeers, now);
  const entityPeers = mirror.getPresenceForEntity({ type: entityType, id: entityId }, opts);
  if (entityPeers.length > 0) return describeRemote(entityPeers, now);
  const all = mirror.getPresence().filter((p) => p.identity.instanceId !== localInstanceId);
  return describeRemote(all, now);
}
