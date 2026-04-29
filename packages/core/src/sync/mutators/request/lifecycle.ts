/**
 * `createRequest` + `deleteRequest` — request entity lifecycle.
 *
 * Unlike folders, the request entity is NOT slotted on a parent — its
 * tree position is encoded by the `path` scalar (legacy `requests/<col>/<folder>/<request>`
 * filesystem-style segments) on the request payload itself. Parent
 * collections / folders own only their own state, not a child-slot
 * for requests. Cascade deletes when a parent collection / folder is
 * removed are emitted from the SW write site (rule-store / request-
 * store cascade walks `path` prefixes); this catalog ships the
 * single-entity primitives.
 *
 * Set-modeled paths (`headers`, `params`) and body-internal arrays
 * are NOT pre-seeded by `createRequest`. The projection layer in
 * Phase B commit 2 (`request-projection.ts`) flattens the create
 * payload into per-leaf scalars + per-row `addToSet` envelopes, so
 * the catalog's create can stay opaque about the row shapes — the
 * payload is just `V5.Request` minus uid/path (which are the
 * envelope's `id` and a scalar respectively).
 */

import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { REQUEST_ENTITY_TYPE } from './types';

export interface CreateRequestArgs {
  requestUid: string;
  /**
   * Full request payload as `V5.Request` minus `uid` (carried on the
   * envelope as `id`). Validated at the oracle boundary by the
   * request schema. The projector layer is responsible for splitting
   * `headers` / `params` arrays into per-row `addToSet` envelopes —
   * this factory does not do that splitting itself, mirroring the way
   * `seedRule` / `seedFolder` operate (catalog mints the create; SW
   * shared/sync projector seeds the set-modeled paths).
   */
  payload: unknown;
}

export function createRequest(ctx: MutatorContext, args: CreateRequestArgs): MutatorIntent {
  const bodies: MutationBody[] = [
    {
      kind: 'create',
      type: REQUEST_ENTITY_TYPE,
      id: args.requestUid,
      payload: args.payload,
    },
  ];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

export interface DeleteRequestArgs {
  requestUid: string;
}

export function deleteRequest(ctx: MutatorContext, args: DeleteRequestArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [{ kind: 'delete', type: REQUEST_ENTITY_TYPE, id: args.requestUid }]),
    sideEffects: [],
  };
}
