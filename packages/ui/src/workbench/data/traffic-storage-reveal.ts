/**
 * Reveal-in-Storage intents — a storage-document editor tab's "Reveal in
 * Storage" jump back into the Traffic Monitor's storage pane.
 *
 * The editor tab posts an intent; the workbench shell activates the
 * Traffic Monitor tool window on it, and the mounted panel consumes the
 * pending intent exactly once (selecting the source and handing the
 * reveal to the storage pane). A post with no panel mounted parks until
 * the activation mounts one — the same consume-once posture as the
 * pane's own reveal prop.
 */

import type { StorageRevealRequest } from '../../panel/components/storage/StoragePanel';

export interface TrafficStorageRevealIntent {
  nodeId: string;
  tabId: number;
  reveal: StorageRevealRequest;
}

let pending: TrafficStorageRevealIntent | null = null;
const listeners = new Set<() => void>();

export function postTrafficStorageReveal(intent: TrafficStorageRevealIntent): void {
  pending = intent;
  for (const listener of listeners) listener();
}

/** Consume the pending intent (once). */
export function takeTrafficStorageReveal(): TrafficStorageRevealIntent | null {
  const taken = pending;
  pending = null;
  return taken;
}

/** Observe posts — fired after the intent is parked. Returns unsubscribe. */
export function subscribeTrafficStorageReveal(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
