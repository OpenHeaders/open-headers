/**
 * Request write-site → oracle helpers.
 *
 * Parallel to {@link rule-mutations}: `request-store.ts` historically
 * owned the in-memory `V5.Request[]` array and persisted it on every
 * write. With the request entity routed through the oracle, writes
 * now flow as `MutationBatch`es; the request cache projects the
 * oracle's materialized state back to `V5.Request[]` and persists it.
 *
 * The four helpers below produce `(batch, sideEffects)` pairs for the
 * four legacy write paths. They're pure transforms — no oracle reads,
 * no IO — so the request-store can apply them under its existing
 * orchestration.
 *
 * Set-modeled fields (`headers`, `params`) need special handling on
 * partial updates: a naïve `setField('headers', [...])` would write a
 * leaf entry that competes with the oracle's setItems entries at the
 * same path, producing a non-deterministic materialized view.
 * {@link buildUpdateBatch} therefore reads the live itemIds from the
 * oracle, emits one `removeFromSet` per existing item, then emits one
 * `addToSet` per member of the new value with a fresh itemId.
 * Replacement semantics preserved; convergence preserved (latest-HLC
 * wins between concurrent set-replacements applies as designed).
 *
 * No side-effect intents: requests don't feed DNR or the variables
 * resolver. {@link RequestMutationPayload.sideEffects} is always `[]`.
 */

import {
  mintBatch,
  type MutationBatch,
  type MutationBody,
  REQUEST_ENTITY_TYPE,
  REQUEST_HEADERS_PATH,
  REQUEST_PARAMS_PATH,
  type MutatorContext,
  type SideEffectIntent,
} from '@openheaders/core/sync';
import { generateUid } from '@openheaders/core/utils';
import type { V5 } from '@openheaders/core/types';
import { seedRequest } from './request-projection';

export interface RequestMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

/**
 * Live-itemId reader for set-modeled paths on a Request. Same shape
 * as {@link rule-mutations.LiveSetItemIds} so SW + renderer can both
 * satisfy it from their respective `liveSetItems` surfaces.
 */
export type LiveSetItemIds = (requestUid: string, setPath: string) => readonly string[];

/** New request → seed batch. No side effects. */
export function buildAddBatch(request: V5.Request, ctx: MutatorContext): RequestMutationPayload {
  return { batch: seedRequest(request, ctx), sideEffects: [] };
}

/** Delete a request. Tombstone is permanent under §7.2 delete-wins. */
export function buildDeleteBatch(requestUid: string, ctx: MutatorContext): RequestMutationPayload {
  const bodies: MutationBody[] = [{ kind: 'delete', type: REQUEST_ENTITY_TYPE, id: requestUid }];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

/**
 * Set-modeled paths on a Request. Mirrors {@link request-projection}'s
 * SET_PATHS; kept inline so this module doesn't import a private
 * constant from a sibling.
 */
const SET_PATHS = [REQUEST_HEADERS_PATH, REQUEST_PARAMS_PATH] as const;
type SetPath = (typeof SET_PATHS)[number];

const isSetPath = (key: string): SetPath | null =>
  key === REQUEST_HEADERS_PATH ? REQUEST_HEADERS_PATH : key === REQUEST_PARAMS_PATH ? REQUEST_PARAMS_PATH : null;

/**
 * Translate a `Partial<Omit<V5.Request, 'uid'|'path'>>` patch into a
 * single batch of mutations. Scalar fields → one `setField` per leaf;
 * set-modeled fields (`headers`, `params`) → `removeFromSet` per
 * existing itemId followed by `addToSet` per new member.
 *
 * `oracle.liveSetItems` is consulted at emit time so the removeFromSet
 * envelopes carry the itemIds the oracle currently holds. Concurrency
 * with another emitter mid-update is handled by per-itemId LWW: a
 * concurrent `addToSet(newItemId, ...)` wins because we never tombstone
 * an itemId we didn't observe; a concurrent `removeFromSet(itemId)` is
 * idempotent under tombstone HLC compare.
 *
 * `auth` and `body` flow through `setField` — they're variant scalars
 * by §request-mutator-catalog v1 trade-off (see catalog `types.ts`).
 */
export function buildUpdateBatch(
  requestUid: string,
  updates: Partial<Omit<V5.Request, 'uid' | 'path'>>,
  ctx: MutatorContext,
  liveSetItemIds: LiveSetItemIds,
): RequestMutationPayload {
  const bodies: MutationBody[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;

    const setPath = isSetPath(key);
    if (setPath && Array.isArray(value)) {
      pushSetReplacement(bodies, requestUid, setPath, value, liveSetItemIds);
      continue;
    }

    bodies.push({ kind: 'setField', type: REQUEST_ENTITY_TYPE, id: requestUid, path: key, value });
  }

  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

function pushSetReplacement(
  bodies: MutationBody[],
  requestUid: string,
  setPath: SetPath,
  newItems: unknown[],
  liveSetItemIds: LiveSetItemIds,
): void {
  const live = liveSetItemIds(requestUid, setPath);
  for (const itemId of live) {
    bodies.push({
      kind: 'removeFromSet',
      type: REQUEST_ENTITY_TYPE,
      id: requestUid,
      path: setPath,
      itemId,
    });
  }
  for (const item of newItems) {
    bodies.push({
      kind: 'addToSet',
      type: REQUEST_ENTITY_TYPE,
      id: requestUid,
      path: setPath,
      itemId: generateUid(),
      item,
    });
  }
}
