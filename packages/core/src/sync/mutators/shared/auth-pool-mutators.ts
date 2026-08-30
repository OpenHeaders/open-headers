/**
 * Shared auth-pool mutator factory — the collection and the folder
 * catalogs bind it to their routing constants.
 *
 * A container's pool is a set at `authsPath` (member identity = the
 * entry's `uid`, per-itemId LWW — the variables idiom: an upsert by
 * uid covers add, edit and rename; two concurrent edits of different
 * entries never clobber each other) plus ONE scalar naming the default
 * entry. The default is a scalar on purpose: a flag on the entries
 * could converge with two defaults under concurrent edits, a scalar
 * can't.
 *
 * No resolver side effects: the pool feeds the send, not variable
 * resolution.
 */

import type { AuthPoolEntry } from '../../../types/collection';
import type { MutationBatch, MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';

export interface AuthPoolMutatorBindings {
  entityType: string;
  authsPath: string;
  defaultAuthPath: string;
  mintBatch: (ctx: MutatorContext, bodies: MutationBody[]) => MutationBatch;
}

export interface SetAuthEntryInput {
  entityUid: string;
  /** Whole entry record. `entry.uid` is the set-member itemId. */
  entry: AuthPoolEntry;
  /** Optional explicit orderKey — defaults to seed-key when omitted. */
  orderKey?: string;
}

export interface RemoveAuthEntryInput {
  entityUid: string;
  uid: string;
}

export interface SetDefaultAuthInput {
  entityUid: string;
  /** The entry uid to make the default; `undefined` clears the field (the first entry is the default). */
  defaultAuthUid: string | undefined;
}

export interface AuthPoolMutators {
  setAuthEntry(ctx: MutatorContext, input: SetAuthEntryInput): MutatorIntent;
  removeAuthEntry(ctx: MutatorContext, input: RemoveAuthEntryInput): MutatorIntent;
  setDefaultAuth(ctx: MutatorContext, input: SetDefaultAuthInput): MutatorIntent;
}

export function makeAuthPoolMutators(bindings: AuthPoolMutatorBindings): AuthPoolMutators {
  const { entityType, authsPath, defaultAuthPath, mintBatch } = bindings;
  return {
    setAuthEntry(ctx, input) {
      const body: MutationBody = {
        kind: 'addToSet',
        type: entityType,
        id: input.entityUid,
        path: authsPath,
        itemId: input.entry.uid,
        item: input.entry,
        orderKey: input.orderKey,
      };
      return { batch: mintBatch(ctx, [body]), sideEffects: [] };
    },
    removeAuthEntry(ctx, input) {
      const body: MutationBody = {
        kind: 'removeFromSet',
        type: entityType,
        id: input.entityUid,
        path: authsPath,
        itemId: input.uid,
      };
      return { batch: mintBatch(ctx, [body]), sideEffects: [] };
    },
    setDefaultAuth(ctx, input) {
      const body: MutationBody =
        input.defaultAuthUid === undefined
          ? { kind: 'unsetField', type: entityType, id: input.entityUid, path: defaultAuthPath }
          : {
              kind: 'setField',
              type: entityType,
              id: input.entityUid,
              path: defaultAuthPath,
              value: input.defaultAuthUid,
            };
      return { batch: mintBatch(ctx, [body]), sideEffects: [] };
    },
  };
}
