/**
 * In-tab broadcast fan-out — the web host's `broadcastLocal`.
 *
 * The oracle and the Workbench share one JS context here, so a host
 * broadcast is a plain listener dispatch: the oracle's host hooks call
 * {@link broadcastLocal} and the host bridge's `subscribe` reads the
 * same registry. No transport, no serialization — the payload object
 * the oracle emitted is the object the mirrors fold in.
 */

import { hostLogger as logger } from '@openheaders/core/logger';

const SCOPE = 'WebBroadcast';

type BroadcastListener = (payload: unknown) => void;

const listeners = new Map<string, Set<BroadcastListener>>();

export function broadcastLocal(type: string, payload: unknown): void {
  const bucket = listeners.get(type);
  if (!bucket) return;
  for (const listener of [...bucket]) {
    try {
      listener(payload);
    } catch (err) {
      logger.warn(SCOPE, `subscriber for ${type} threw`, err);
    }
  }
}

export function subscribeLocal(type: string, listener: BroadcastListener): () => void {
  const bucket = listeners.get(type) ?? new Set<BroadcastListener>();
  bucket.add(listener);
  listeners.set(type, bucket);
  return () => {
    const current = listeners.get(type);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listeners.delete(type);
  };
}
