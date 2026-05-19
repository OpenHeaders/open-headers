/**
 * Cross-host awareness — receive path.
 *
 * The wire frame (`packages/core/src/protocol/awareness-stream.ts`)
 * carries a snapshot of the SENDER'S local presence for one workspace.
 * Each state lands in the local awareness store via `publish(state)` —
 * the same path local surfaces use. instanceIds are globally unique, so
 * peer rows and local rows coexist without collision; the store's
 * existing sanitize / TTL / change-detection pipeline runs untouched.
 *
 * Echo prevention rides on the sender side (forwarder filters by
 * `identity.appId` so each host only forwards its own surfaces). At the
 * receiver we publish unconditionally — any drift from that contract
 * gets caught by the next publish from the legitimate owner.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import type { SyncAwarenessPresenceMessage } from '@openheaders/core/protocol';
import type { AwarenessStore } from './awareness';

const SCOPE = 'AwarenessInbound';

export interface ApplyInboundAwarenessFrameDeps {
  resolveStore: (workspaceId: string) => AwarenessStore | null;
}

export function applyInboundAwarenessFrame(
  frame: SyncAwarenessPresenceMessage,
  deps: ApplyInboundAwarenessFrameDeps,
): void {
  const store = deps.resolveStore(frame.workspaceId);
  if (!store) {
    // No service for this workspace on this host (yet). The peer is
    // free to publish into any workspace; we ignore frames for ones
    // we haven't booted. Silent — chatter would mask real bugs.
    return;
  }
  for (const state of frame.presence) {
    try {
      store.publish(state);
    } catch (err) {
      logger.warn(SCOPE, 'publish failed', err);
    }
  }
}
