/**
 * MQTT prefill bus — hands a saved example's captured request block to
 * the parent MqttRequest editor as unsaved draft edits ("Open in
 * Request", the WS prefill bus's sibling for the MQTT family).
 *
 * Module-level registry keyed by mqttRequestUid: the editor subscribes
 * for its uid on mount; a publish delivers immediately when the editor
 * is mounted and parks as pending otherwise, consumed by the next
 * subscriber (the tab the opener just switched to). Display-plumbing
 * only — nothing here persists.
 */

import type { CapturedMqttRequest } from '@openheaders/core/types';

const pending = new Map<string, CapturedMqttRequest>();
const listeners = new Map<string, Set<(captured: CapturedMqttRequest) => void>>();

export function publishMqttPrefill(mqttRequestUid: string, captured: CapturedMqttRequest): void {
  const subs = listeners.get(mqttRequestUid);
  if (subs !== undefined && subs.size > 0) {
    for (const listener of subs) listener(captured);
    return;
  }
  pending.set(mqttRequestUid, captured);
}

export function subscribeMqttPrefill(
  mqttRequestUid: string,
  listener: (captured: CapturedMqttRequest) => void,
): () => void {
  let subs = listeners.get(mqttRequestUid);
  if (subs === undefined) {
    subs = new Set();
    listeners.set(mqttRequestUid, subs);
  }
  subs.add(listener);
  const parked = pending.get(mqttRequestUid);
  if (parked !== undefined) {
    pending.delete(mqttRequestUid);
    listener(parked);
  }
  return () => {
    subs.delete(listener);
    if (subs.size === 0) listeners.delete(mqttRequestUid);
  };
}
