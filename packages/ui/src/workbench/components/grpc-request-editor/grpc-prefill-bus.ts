/**
 * gRPC prefill bus — hands a saved example's captured request block to
 * the parent GrpcRequest editor as unsaved draft edits ("Open in
 * Request", the HTTP example's "Try" flow adapted to a family with no
 * scratch mode: the fork lands IN the parent editor's draft).
 *
 * Module-level registry keyed by grpcRequestUid: the editor subscribes
 * for its uid on mount; a publish delivers immediately when the editor
 * is mounted and parks as pending otherwise, consumed by the next
 * subscriber (the tab the opener just switched to). Display-plumbing
 * only — nothing here persists.
 */

import type { CapturedGrpcRequest } from '@openheaders/core/types';

const pending = new Map<string, CapturedGrpcRequest>();
const listeners = new Map<string, Set<(captured: CapturedGrpcRequest) => void>>();

export function publishGrpcPrefill(grpcRequestUid: string, captured: CapturedGrpcRequest): void {
  const subs = listeners.get(grpcRequestUid);
  if (subs !== undefined && subs.size > 0) {
    for (const listener of subs) listener(captured);
    return;
  }
  pending.set(grpcRequestUid, captured);
}

export function subscribeGrpcPrefill(
  grpcRequestUid: string,
  listener: (captured: CapturedGrpcRequest) => void,
): () => void {
  let subs = listeners.get(grpcRequestUid);
  if (subs === undefined) {
    subs = new Set();
    listeners.set(grpcRequestUid, subs);
  }
  subs.add(listener);
  const parked = pending.get(grpcRequestUid);
  if (parked !== undefined) {
    pending.delete(grpcRequestUid);
    listener(parked);
  }
  return () => {
    subs.delete(listener);
    if (subs.size === 0) listeners.delete(grpcRequestUid);
  };
}
