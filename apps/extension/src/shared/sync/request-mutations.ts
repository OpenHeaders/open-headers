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
  keyBetween,
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
 * Live-itemId reader for set-modeled paths on a Request. Returns the
 * triplet `{itemId, orderKey, item}` per live set member in canonical
 * sort order — `buildUpdateBatch` consults the orderKey + item to detect
 * pure-reorder gestures (emit `moveBefore` instead of full
 * `removeFromSet + addToSet` rewrite) and to preserve persisted itemIds
 * (a row's `uid`) on whatever fallback path it ends up on. SW + renderer
 * both satisfy this — see `oracle.liveOrderedSetItems` and
 * `RequestSyncMirror.liveOrderedSetItems`.
 */
export type LiveSetEntries = (
  requestUid: string,
  setPath: string,
) => ReadonlyArray<{ itemId: string; orderKey: string; item: unknown }>;

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
  liveSetEntries: LiveSetEntries,
): RequestMutationPayload {
  const bodies: MutationBody[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;

    const setPath = isSetPath(key);
    if (setPath && Array.isArray(value)) {
      pushSetReplacement(bodies, requestUid, setPath, value, liveSetEntries);
      continue;
    }

    bodies.push({ kind: 'setField', type: REQUEST_ENTITY_TYPE, id: requestUid, path: key, value });
  }

  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

interface UidCarrier {
  uid: string;
}

function isUidCarrier(item: unknown): item is UidCarrier & Record<string, unknown> {
  return typeof item === 'object' && item !== null && typeof (item as { uid?: unknown }).uid === 'string';
}

function pushSetReplacement(
  bodies: MutationBody[],
  requestUid: string,
  setPath: SetPath,
  newItems: unknown[],
  liveSetEntries: LiveSetEntries,
): void {
  const live = liveSetEntries(requestUid, setPath);

  // Pure-reorder fast path: same itemId set + content unchanged per uid +
  // ordering differs. Emit `moveBefore` per moved row via
  // `keyBetween(prev, next)` so the engine preserves identity (§7.2 LWW
  // per itemId) and the on-the-wire diff shrinks to the moved rows only.
  // Mixed reorder + content edits and any add/remove fall through to the
  // full replacement below; per-itemId LWW + tombstones still converge.
  const reorder = pureReorderPlan(live, newItems);
  if (reorder) {
    for (const move of reorder) {
      bodies.push({
        kind: 'moveBefore',
        type: REQUEST_ENTITY_TYPE,
        id: requestUid,
        path: setPath,
        itemId: move.itemId,
        orderKey: move.orderKey,
      });
    }
    return;
  }

  // Fallback: tombstone every live itemId, re-add every new row at its
  // persisted `uid`. Reusing the row's uid as the itemId keeps the
  // post-save oracle keyed identically to the YAML on disk — content
  // updates land as `removeFromSet(uid)` + `addToSet(uid, …)` under the
  // same batch's monotonic HLCs (the per-batch lock guarantees order),
  // so the addToSet at higher HLC supersedes the tombstone (§7.2).
  for (const entry of live) {
    bodies.push({
      kind: 'removeFromSet',
      type: REQUEST_ENTITY_TYPE,
      id: requestUid,
      path: setPath,
      itemId: entry.itemId,
    });
  }
  for (const item of newItems) {
    const itemId = isUidCarrier(item) ? item.uid : generateUid();
    bodies.push({
      kind: 'addToSet',
      type: REQUEST_ENTITY_TYPE,
      id: requestUid,
      path: setPath,
      itemId,
      item,
    });
  }
}

interface ReorderMove {
  itemId: string;
  orderKey: string;
}

/**
 * Detect a pure-reorder gesture and synthesize the `moveBefore` plan.
 *
 * Returns `null` when the new items add or remove rows, when any row's
 * non-position content changed, or when the order is byte-identical
 * (no-op — caller emits nothing). Returns a (possibly empty list of)
 * `moveBefore` for each row whose new position requires a fresh order
 * key.
 *
 * Algorithm: walk the new items in order. For row `i`, look up the
 * matching live entry by itemId and compare content. If the entry sits
 * at the right relative position (its live order key still lies between
 * the previously-emitted orderKey and the next live row's orderKey),
 * we don't need to move it. Otherwise mint a fresh key with
 * `keyBetween(prev, next)` against the keys of rows already committed
 * (or re-positioned) to its left + the live keys of un-moved rows on
 * its right.
 *
 * The comparison strips no fields — content equality is exact JSON
 * equality after normalizing key order. Keeping it strict avoids the
 * "did the user just rearrange or did they also tweak a value?" edge
 * case from silently riding the fast path.
 */
function pureReorderPlan(
  live: ReadonlyArray<{ itemId: string; orderKey: string; item: unknown }>,
  newItems: ReadonlyArray<unknown>,
): ReorderMove[] | null {
  if (live.length !== newItems.length) return null;
  if (live.length === 0) return null;

  const liveByUid = new Map<string, { orderKey: string; item: unknown }>();
  for (const entry of live) liveByUid.set(entry.itemId, { orderKey: entry.orderKey, item: entry.item });

  // Same itemId set + content equality per uid; collect the new order in
  // pass 1 so pass 2 can compute keyBetween against the committed-so-far
  // tail.
  const newUids: string[] = [];
  for (const item of newItems) {
    if (!isUidCarrier(item)) return null;
    const liveEntry = liveByUid.get(item.uid);
    if (!liveEntry) return null;
    if (!shallowItemEqual(item, liveEntry.item)) return null;
    newUids.push(item.uid);
  }

  // Detect the byte-identical case so callers emit nothing.
  let identical = true;
  for (let i = 0; i < live.length; i++) {
    if (live[i].itemId !== newUids[i]) {
      identical = false;
      break;
    }
  }
  if (identical) return [];

  // Mint moveBefore keys for the rows whose position changed. We walk
  // left-to-right and, for each row, check whether its current orderKey
  // already lies in the half-open band (prevKey, nextLiveKey] dictated
  // by the new order. If yes — keep its key. If no — mint a fresh one
  // via `keyBetween(prev, next)` against the committed predecessor and
  // the next un-moved row to the right (or `null` for either end).
  const finalKey = new Map<string, string>();
  for (const entry of live) finalKey.set(entry.itemId, entry.orderKey);

  // For each row in the new order, decide whether its existing key
  // already satisfies the strictly-increasing constraint against its
  // left neighbour's final key. If so, leave it. Otherwise mint
  // `keyBetween(left, right)`. We pick `right` as the next row whose
  // existing key strictly exceeds whatever key we're about to assign —
  // a simple choice that keeps the algorithm one-pass.
  const moves: ReorderMove[] = [];
  let prevKey: string | null = null;
  for (let i = 0; i < newUids.length; i++) {
    const uid = newUids[i];
    const currentKey = finalKey.get(uid)!;
    if (prevKey === null || currentKey > prevKey) {
      // Row's position is consistent with what we've committed.
      prevKey = currentKey;
      continue;
    }
    // Need to move this row. Right-bound: the next un-touched row's key
    // (any `j > i` whose `finalKey[newUids[j]]` is strictly greater than
    // prevKey). If none exists, right-bound is `null` (append after).
    let nextKey: string | null = null;
    for (let j = i + 1; j < newUids.length; j++) {
      const candidate = finalKey.get(newUids[j])!;
      if (candidate > prevKey) {
        nextKey = candidate;
        break;
      }
    }
    const fresh = keyBetween(prevKey, nextKey);
    finalKey.set(uid, fresh);
    moves.push({ itemId: uid, orderKey: fresh });
    prevKey = fresh;
  }
  return moves;
}

function shallowItemEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  return canonicalize(a) === canonicalize(b);
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`).join(',')}}`;
}
