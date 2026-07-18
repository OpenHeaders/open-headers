/**
 * WebSocket prefill bus — hands a saved example's captured request
 * block to the parent WebSocketRequest editor as unsaved draft edits
 * ("Open in Request", the gRPC prefill bus's sibling for the WebSocket
 * family).
 *
 * Module-level registry keyed by websocketRequestUid: the editor
 * subscribes for its uid on mount; a publish delivers immediately when
 * the editor is mounted and parks as pending otherwise, consumed by
 * the next subscriber (the tab the opener just switched to).
 * Display-plumbing only — nothing here persists.
 */

import type { CapturedWsRequest } from '@openheaders/core/types';

const pending = new Map<string, CapturedWsRequest>();
const listeners = new Map<string, Set<(captured: CapturedWsRequest) => void>>();

export function publishWsPrefill(websocketRequestUid: string, captured: CapturedWsRequest): void {
  const subs = listeners.get(websocketRequestUid);
  if (subs !== undefined && subs.size > 0) {
    for (const listener of subs) listener(captured);
    return;
  }
  pending.set(websocketRequestUid, captured);
}

export function subscribeWsPrefill(
  websocketRequestUid: string,
  listener: (captured: CapturedWsRequest) => void,
): () => void {
  let subs = listeners.get(websocketRequestUid);
  if (subs === undefined) {
    subs = new Set();
    listeners.set(websocketRequestUid, subs);
  }
  subs.add(listener);
  const parked = pending.get(websocketRequestUid);
  if (parked !== undefined) {
    pending.delete(websocketRequestUid);
    listener(parked);
  }
  return () => {
    subs.delete(listener);
    if (subs.size === 0) listeners.delete(websocketRequestUid);
  };
}
