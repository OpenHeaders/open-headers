/**
 * Request write-site → oracle helpers.
 *
 * Parallel to {@link rule-mutations}: `request-store.ts` historically
 * owned the in-memory `Request[]` array and persisted it on every
 * write. With the request entity routed through the oracle, writes
 * now flow as `MutationBatch`es; the request cache projects the
 * oracle's materialized state back to `Request[]` and persists it.
 *
 * The four helpers below produce `(batch, sideEffects)` pairs for the
 * four legacy write paths. They're pure transforms — no oracle reads,
 * no IO — so the request-store can apply them under its existing
 * orchestration.
 *
 * Set-modeled fields (`headers`, `params`) need special handling on
 * partial updates: a naïve `setField('headers', [...])` would write a
 * leaf entry that competes with the oracle's setItems entries at the
 * same path, producing a non-deterministic materialized view. The
 * shared {@link synthesizeSetDiff} computes the **minimum** envelope
 * sequence — `removeFromSet` for vanished uids, `addToSet` for new and
 * content-changed uids (per-itemId LWW supersedes; no redundant
 * `removeFromSet` for content edits), and `moveBefore` for pure
 * position changes. Mixed gestures (reorder + content edit) emit the
 * minimum diff in one walk.
 *
 * No side-effect intents: requests don't feed DNR or the variables
 * resolver. {@link RequestMutationPayload.sideEffects} is always `[]`.
 */

import {
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  REQUEST_ENTITY_TYPE,
  REQUEST_HEADERS_PATH,
  REQUEST_PARAMS_PATH,
  type SideEffectIntent,
} from '@openheaders/core/sync';
import { type LiveSetEntry, synthesizeFieldDiff, synthesizeSetDiff } from '@openheaders/core/sync-builders';
import type { Request } from '@openheaders/core/types';
import { seedRequest } from './request-projection';

export interface RequestMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

/**
 * Live-itemId reader for set-modeled paths on a Request. Returns the
 * triplet `{itemId, orderKey, item}` per live set member in canonical
 * sort order — {@link synthesizeSetDiff} consults the orderKey + item
 * to detect pure-reorder gestures, content edits, and additions in
 * one pass. SW + renderer both satisfy this — see
 * `oracle.liveOrderedSetItems` and `RequestSyncMirror.liveOrderedSetItems`.
 */
export type LiveSetEntries = (requestUid: string, setPath: string) => ReadonlyArray<LiveSetEntry>;

/**
 * Current materialized value reader for object-valued scalar paths
 * (`auth`, `body`). Threaded as the baseline for {@link synthesizeFieldDiff}
 * so a variant switch tombstones the leaves that vanish. Returns
 * `undefined` when the path has no live value yet — the diff then emits
 * `setField` for every new leaf and no `unsetField`. SW + renderer both
 * satisfy this from their canonical request snapshot.
 */
export type LiveFieldValue = (requestUid: string, path: string) => unknown;

/** New request → seed batch. No side effects. */
export function buildAddBatch(request: Request, ctx: MutatorContext): RequestMutationPayload {
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
 * Translate a `Partial<Omit<Request, 'uid'|'path'>>` patch into a
 * single batch of mutations. Scalar fields → one `setField` per leaf;
 * set-modeled fields (`headers`, `params`) → minimum diff via
 * {@link synthesizeSetDiff}.
 *
 * Concurrency with another emitter mid-update is handled by per-itemId
 * LWW: a concurrent `addToSet(newItemId, ...)` wins because we never
 * tombstone an itemId we didn't observe; a concurrent
 * `removeFromSet(itemId)` is idempotent under tombstone HLC compare.
 *
 * `auth` and `body` are discriminated unions flattened to per-leaf paths
 * at create time (`auth.type`, `body.content`, …). A whole-object
 * `setField` at `auth` would collide with those create-time leaves and
 * let the stale discriminant clobber the edit at materialize time — so
 * object-valued scalars route through {@link synthesizeFieldDiff}, which
 * mirrors create's granularity and tombstones leaves that vanish on a
 * variant switch. `liveFieldValue` supplies the diff baseline.
 */
export function buildUpdateBatch(
  requestUid: string,
  updates: Partial<Omit<Request, 'uid' | 'path'>>,
  ctx: MutatorContext,
  liveSetEntries: LiveSetEntries,
  liveFieldValue: LiveFieldValue,
): RequestMutationPayload {
  const bodies: MutationBody[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;

    const setPath = isSetPath(key);
    if (setPath && Array.isArray(value)) {
      bodies.push(
        ...synthesizeSetDiff({
          type: REQUEST_ENTITY_TYPE,
          id: requestUid,
          path: setPath,
          live: liveSetEntries(requestUid, setPath),
          newItems: value,
        }),
      );
      continue;
    }

    // Object/array-valued scalars (`auth`, `body`) — emit a per-leaf
    // flatten-diff so the edit shares create's representation.
    if (value !== null && typeof value === 'object') {
      bodies.push(
        ...synthesizeFieldDiff({
          type: REQUEST_ENTITY_TYPE,
          id: requestUid,
          basePath: key,
          oldValue: liveFieldValue(requestUid, key),
          newValue: value,
        }),
      );
      continue;
    }

    bodies.push({ kind: 'setField', type: REQUEST_ENTITY_TYPE, id: requestUid, path: key, value });
  }

  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}
