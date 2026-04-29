/**
 * Layout-state intent factory.
 *
 * One primitive: `setLayoutState({ layout })` — whole-object scalar
 * setField on the singleton. Every renderer gesture that persists
 * layout swaps the full blob (the editor surface never edits a single
 * ratio in isolation), so per-leaf LWW would only invent collisions
 * that don't exist in practice.
 *
 * No side effects — layout is pure UX state. Concurrent same-time
 * writes converge under per-(setPath, fieldValues) LWW just like every
 * other scalar `setField`.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { LAYOUT_STATE_ENTITY_TYPE, LAYOUT_STATE_ID, LAYOUT_STATE_PATH } from './types';

export interface SetLayoutStateArgs {
  /** Opaque layout blob — shape lives in the renderer hooks. */
  layout: unknown;
}

export function setLayoutState(ctx: MutatorContext, args: SetLayoutStateArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'setField',
        type: LAYOUT_STATE_ENTITY_TYPE,
        id: LAYOUT_STATE_ID,
        path: LAYOUT_STATE_PATH,
        value: args.layout,
      },
    ]),
    sideEffects: [],
  };
}
