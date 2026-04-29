/**
 * `setPinnedEnvironments` + `setDefaultEnvironmentId` — collection
 * scalar field setters used by the pinned-environments picker.
 *
 * Both fields are arrays/scalars, not set-modeled — `pinnedEnvironmentIds`
 * is a strict array (order is informational, repeats invalid) and
 * `defaultEnvironmentId` is a single uid. The natural model is
 * whole-value LWW via `setField`. Two surfaces editing the same
 * picker state converge to one winning value with the higher HLC;
 * concurrent edits to *different* fields land independently.
 *
 * The pinned + default-env gestures usually fire together (the picker
 * commits both at once). The caller passes `batchId` on
 * {@link MutatorContext} so the two `setField` envelopes ride one
 * batch — the oracle's per-batch all-or-nothing guarantees observers
 * never see "default cleared but pinned still old."
 */

import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { COLLECTION_ENTITY_TYPE } from './types';

export interface SetPinnedEnvironmentsArgs {
  collectionUid: string;
  pinnedEnvironmentIds: readonly string[];
}

export function setPinnedEnvironments(ctx: MutatorContext, args: SetPinnedEnvironmentsArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'setField',
        type: COLLECTION_ENTITY_TYPE,
        id: args.collectionUid,
        path: 'pinnedEnvironmentIds',
        value: [...args.pinnedEnvironmentIds],
      },
    ]),
    sideEffects: [],
  };
}

export interface SetDefaultEnvironmentIdArgs {
  collectionUid: string;
  defaultEnvironmentId: string | null;
}

export function setDefaultEnvironmentId(
  ctx: MutatorContext,
  args: SetDefaultEnvironmentIdArgs,
): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'setField',
        type: COLLECTION_ENTITY_TYPE,
        id: args.collectionUid,
        path: 'defaultEnvironmentId',
        value: args.defaultEnvironmentId,
      },
    ]),
    sideEffects: [],
  };
}

export interface SetPinnedAndDefaultArgs {
  collectionUid: string;
  pinnedEnvironmentIds: readonly string[];
  defaultEnvironmentId: string | null;
}

/**
 * Convenience: the picker UI commits both fields at once. Single batch
 * so per-batch all-or-nothing kicks in.
 */
export function setPinnedAndDefault(ctx: MutatorContext, args: SetPinnedAndDefaultArgs): MutatorIntent {
  const bodies: MutationBody[] = [
    {
      kind: 'setField',
      type: COLLECTION_ENTITY_TYPE,
      id: args.collectionUid,
      path: 'pinnedEnvironmentIds',
      value: [...args.pinnedEnvironmentIds],
    },
    {
      kind: 'setField',
      type: COLLECTION_ENTITY_TYPE,
      id: args.collectionUid,
      path: 'defaultEnvironmentId',
      value: args.defaultEnvironmentId,
    },
  ];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}
