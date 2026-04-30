/**
 * Per-envelope request post-state projection.
 *
 * Same shape as the rule projector: renderer-side write helpers
 * (`buildUpdateBatch`, partial save flows) need the live `(itemId)`
 * pairs at each set-modeled path on a request before they can emit
 * matching `removeFromSet` envelopes. Round-tripping back to the SW
 * per write would kill the synchronous-render discipline (§19.4), so
 * the post-commit projection rides every Request {@link SyncBroadcastEvent}.
 *
 * The projector runs one `materializeOne` lookup + two `liveSetItems`
 * reads per request envelope. Cheap.
 */

import type { SyncRequestPostState } from '@openheaders/core/protocol';
import type { MutationEnvelope } from '@openheaders/core/sync';
import { REQUEST_ENTITY_TYPE, REQUEST_HEADERS_PATH, REQUEST_PARAMS_PATH } from '@openheaders/core/sync';
import type { EntityOracle } from './oracle';
import { projectRequest } from '@/shared/sync/request-projection';

/** Set-modeled paths on a Request — mirrors {@link request-projection}'s SET_PATHS. */
const REQUEST_SET_PATHS = [REQUEST_HEADERS_PATH, REQUEST_PARAMS_PATH] as const;

/**
 * Build the request post-state for `envelope` using `oracle`. Returns
 * `null` for non-Request envelopes, deletes (entity tombstoned), and
 * any envelope whose target request fails to project — the broadcast
 * still fires; just without the optional payload.
 */
export function projectRequestPostState(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveOrderedSetItems'>,
  envelope: MutationEnvelope,
): SyncRequestPostState | null {
  if (envelope.body.type !== REQUEST_ENTITY_TYPE) return null;
  return projectRequestByUid(oracle, envelope.body.id);
}

/**
 * Build the request post-state for a known request uid. Same shape the
 * envelope projector returns; used by the snapshot RPC to seed
 * freshly-mounted renderer mirrors before the next live broadcast.
 */
export function projectRequestByUid(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveOrderedSetItems'>,
  requestUid: string,
): SyncRequestPostState | null {
  const materialized = oracle.materializeOne(REQUEST_ENTITY_TYPE, requestUid);
  if (!materialized) return null;

  const request = projectRequest(materialized);
  if (!request) return null;

  // One ordered read per set path; the renderer's mirror needs both the
  // bare itemId list (for `removeFromSet` enumeration on full replace)
  // AND the per-itemId order keys (for `moveBefore` reorder via
  // `keyBetween`). Computing both from the same ordered read keeps the
  // two views byte-aligned.
  const setItemIds: Record<string, string[]> = {};
  const setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>> = {};
  for (const path of REQUEST_SET_PATHS) {
    const items = oracle.liveOrderedSetItems(REQUEST_ENTITY_TYPE, requestUid, path);
    if (items.length === 0) continue;
    setItemIds[path] = items.map((entry) => entry.itemId);
    setOrderKeys[path] = items.map((entry) => ({ itemId: entry.itemId, orderKey: entry.key }));
  }

  return { request, setItemIds, setOrderKeys };
}
