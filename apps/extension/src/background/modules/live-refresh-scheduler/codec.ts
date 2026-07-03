/**
 * Alarm name codec (shared primitive) — encodes one `(workspaceId,
 * workflowUid, environmentId)` identity per alarm under the
 * `live-refresh:` prefix.
 */

import { createKeyCodec } from '../refresh-scheduler';

export const LIVE_ALARM_PREFIX = 'live-refresh:';

export interface LiveAlarmPayload {
  /** workspaceId */
  w: string;
  /** workflowUid */
  u: string;
  /** environmentId — null = "No environment" */
  e: string | null;
}

export const codec = createKeyCodec<LiveAlarmPayload>(LIVE_ALARM_PREFIX, (p): p is LiveAlarmPayload => {
  if (!p || typeof p !== 'object') return false;
  const obj = p as { w?: unknown; u?: unknown; e?: unknown };
  if (typeof obj.w !== 'string' || typeof obj.u !== 'string') return false;
  return obj.e === null || typeof obj.e === 'string';
});

/**
 * Encode `(workspaceId, workflowUid, environmentId)` into an alarm
 * name. Uses base64url over JSON so arbitrary id contents survive.
 * `environmentId === null` round-trips to the "No environment" state.
 */
export function buildAlarmName(workspaceId: string, workflowUid: string, environmentId: string | null): string {
  return codec.encode({ w: workspaceId, u: workflowUid, e: environmentId });
}

/**
 * Decode an alarm name produced by {@link buildAlarmName}. Returns
 * null for anything that doesn't carry the prefix or whose payload is
 * malformed.
 */
export function parseAlarmName(
  name: string,
): { workspaceId: string; workflowUid: string; environmentId: string | null } | null {
  const parsed = codec.decode(name);
  if (!parsed) return null;
  return { workspaceId: parsed.w, workflowUid: parsed.u, environmentId: parsed.e };
}

/** True when the alarm belongs to the live scheduler. */
export function isLiveRefreshAlarm(alarm: chrome.alarms.Alarm): boolean {
  return codec.matches(alarm?.name);
}
