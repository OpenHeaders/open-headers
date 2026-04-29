/**
 * Variable intent factories for collection-scoped variables.
 *
 * Mirrors `environment/variable.ts`. Collection vars live as set
 * members at `variables` on the collection entity. Set-member identity
 * = variable name (per `types.ts`). Concurrent same-name edits converge
 * under per-(setPath, name) LWW; concurrent diverging renames produce
 * two new entries — the convergent answer for "two surfaces
 * independently renamed the same variable to different names."
 *
 * Collection vars do NOT support `secret` — only Vault holds secrets
 * (§12.3). The catalog still types `VariableType` as `'default' |
 * 'secret'` so the wire shape is uniform with environment vars; the
 * UI layer + schema enforcement reject secret on collection scope.
 */

import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { invalidateResolverIntent } from './side-effects';
import { COLLECTION_ENTITY_TYPE, COLLECTION_VARS_PATH } from './types';

export type VariableType = 'default' | 'secret';

export interface SetCollectionVarArgs {
  collectionUid: string;
  name: string;
  value: string;
  type?: VariableType;
  /** Optional explicit orderKey — defaults to seed-key when omitted. */
  orderKey?: string;
}

/**
 * Add or update a collection variable. Idempotent on (name) — a
 * subsequent `setCollectionVar` for the same name supersedes via
 * per-itemId LWW (§7.2). Whole-record replacement matches the env-var
 * model.
 */
export function setCollectionVar(ctx: MutatorContext, args: SetCollectionVarArgs): MutatorIntent {
  const item = { name: args.name, value: args.value, type: args.type ?? 'default' };
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'addToSet',
        type: COLLECTION_ENTITY_TYPE,
        id: args.collectionUid,
        path: COLLECTION_VARS_PATH,
        itemId: args.name,
        item,
        orderKey: args.orderKey,
      },
    ]),
    sideEffects: [invalidateResolverIntent(args.collectionUid, ctx.hlc)],
  };
}

export interface RemoveCollectionVarArgs {
  collectionUid: string;
  name: string;
}

/**
 * Tombstone a collection variable. The tombstone retains for the
 * configured TTL (§9.2) so reconnecting offline nodes don't resurrect
 * the entry via a stale `setCollectionVar` at lower HLC.
 */
export function removeCollectionVar(ctx: MutatorContext, args: RemoveCollectionVarArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'removeFromSet',
        type: COLLECTION_ENTITY_TYPE,
        id: args.collectionUid,
        path: COLLECTION_VARS_PATH,
        itemId: args.name,
      },
    ]),
    sideEffects: [invalidateResolverIntent(args.collectionUid, ctx.hlc)],
  };
}

export interface RenameCollectionVarArgs {
  collectionUid: string;
  oldName: string;
  newName: string;
  /** Carried through so the new entry has the same value. */
  value: string;
  type?: VariableType;
  orderKey?: string;
}

/**
 * Atomic rename — emitted as a single batch so the local oracle's
 * per-batch all-or-nothing (§11.2) guarantees observers never see the
 * "old removed but new not yet added" intermediate state. Rename
 * to the same name returns an empty batch (no broadcast, no recompile).
 */
export function renameCollectionVar(ctx: MutatorContext, args: RenameCollectionVarArgs): MutatorIntent {
  if (args.oldName === args.newName) {
    return { batch: mintBatch(ctx, []), sideEffects: [] };
  }
  const item = { name: args.newName, value: args.value, type: args.type ?? 'default' };
  const bodies: MutationBody[] = [
    {
      kind: 'removeFromSet',
      type: COLLECTION_ENTITY_TYPE,
      id: args.collectionUid,
      path: COLLECTION_VARS_PATH,
      itemId: args.oldName,
    },
    {
      kind: 'addToSet',
      type: COLLECTION_ENTITY_TYPE,
      id: args.collectionUid,
      path: COLLECTION_VARS_PATH,
      itemId: args.newName,
      item,
      orderKey: args.orderKey,
    },
  ];
  return {
    batch: mintBatch(ctx, bodies),
    sideEffects: [invalidateResolverIntent(args.collectionUid, ctx.hlc)],
  };
}

export interface SetCollectionVarTypeArgs {
  collectionUid: string;
  name: string;
  /** Carried through so the LWW replacement preserves it. */
  value: string;
  type: VariableType;
}

/**
 * Toggle a variable's `type`. Re-emits the whole record via `addToSet`;
 * per-(setPath, itemId) LWW means the latest type wins.
 */
export function setCollectionVarType(ctx: MutatorContext, args: SetCollectionVarTypeArgs): MutatorIntent {
  const item = { name: args.name, value: args.value, type: args.type };
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'addToSet',
        type: COLLECTION_ENTITY_TYPE,
        id: args.collectionUid,
        path: COLLECTION_VARS_PATH,
        itemId: args.name,
        item,
      },
    ]),
    sideEffects: [invalidateResolverIntent(args.collectionUid, ctx.hlc)],
  };
}
