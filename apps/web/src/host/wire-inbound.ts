/**
 * Inbound side of the web tab's single wire. Mutation-stream frames go
 * to the shared client receiver
 * (`@openheaders/oracle/sync/client/mutation-receiver`) — the same
 * validate → gate → apply boundary every host runs (Org-ownership +
 * local-only/loopback gates, seen-set echo dedup, receiver-side org
 * filter, `workspace.write` gate, side-effect derivation, HLC fold) —
 * evaluated against this tab's fixed wire port: the serving daemon's
 * {@link WEB_DAEMON_BACKEND_ID} and the served origin's loopback-ness.
 * Awareness presence frames fold into the local awareness store here.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import {
  SYNC_AWARENESS_PRESENCE_TYPE,
  type SyncAwarenessPresenceMessage,
  SyncAwarenessPresenceMessageSchema,
} from '@openheaders/core/protocol';
import { applyInboundAwarenessFrame, getAwarenessStoreForWorkspace } from '@openheaders/oracle/sync';
import { handleIncomingMutationFrame, type MutationWirePort } from '@openheaders/oracle/sync/client/mutation-receiver';
import * as v from 'valibot';
import { WEB_DAEMON_BACKEND_ID } from './web-backend-id';

const SCOPE = 'WireInbound';

/** Is the serving origin this machine — i.e. a loopback daemon? */
export function isServedOriginLoopback(): boolean {
  const host = location.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '::1' || /^127\./.test(host);
}

// The tab's one delivering connection as the shared gates see it: the
// fixed backend id, loopback classified from the origin the daemon
// actually serves on.
const WEB_WIRE_PORT: MutationWirePort = {
  backendId: WEB_DAEMON_BACKEND_ID,
  isLoopback: isServedOriginLoopback,
};

/**
 * Attempt to handle one parsed wire frame. Returns `true` when the
 * frame matched a mutation-stream or awareness kind (applied or
 * dropped by a gate / parse failure), `false` so the caller can route
 * other frame types onward.
 */
export async function handleInboundWireFrame(raw: unknown): Promise<boolean> {
  if (await handleIncomingMutationFrame(raw, WEB_WIRE_PORT)) return true;

  if (!raw || typeof raw !== 'object') return false;
  if ((raw as { type?: unknown }).type !== SYNC_AWARENESS_PRESENCE_TYPE) return false;

  const result = v.safeParse(SyncAwarenessPresenceMessageSchema, raw);
  if (!result.success) {
    logger.warn(SCOPE, 'dropping malformed oh.awareness.presence frame', result.issues);
    return true;
  }
  applyInboundAwarenessFrame(result.output as unknown as SyncAwarenessPresenceMessage, {
    resolveStore: getAwarenessStoreForWorkspace,
  });
  return true;
}
