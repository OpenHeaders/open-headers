/**
 * Snapshot-watermark intent factory and its read-back.
 *
 * One primitive: `recordSnapshotWatermark({ vector })` — whole-vector
 * scalar `setField` on the singleton. A later snapshot from the same
 * peer replaces the vector by LWW; the fold unions every watermark row
 * it walks, so an older row left below a newer one costs nothing.
 *
 * `snapshotWatermarkVector` is the fold's reader: the vector a logged
 * envelope carries, or null for any other row (or a malformed value —
 * the fold then falls back to the rows alone, which only costs the
 * peer one redundant catch-up decision).
 *
 * No side effects — the watermark shapes nothing a runner drains.
 */

import * as v from 'valibot';

import type { MutationEnvelope } from '../../envelope';
import { StateVectorSchema } from '../../state-vector/schema';
import type { StateVector } from '../../state-vector/types';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { SNAPSHOT_WATERMARK_ENTITY_TYPE, SNAPSHOT_WATERMARK_ID, SNAPSHOT_WATERMARK_PATH } from './types';

export interface RecordSnapshotWatermarkArgs {
  /** The sender's state vector the applied snapshot covered (`takenAtHlc`). */
  vector: StateVector;
}

export function recordSnapshotWatermark(ctx: MutatorContext, args: RecordSnapshotWatermarkArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'setField',
        type: SNAPSHOT_WATERMARK_ENTITY_TYPE,
        id: SNAPSHOT_WATERMARK_ID,
        path: SNAPSHOT_WATERMARK_PATH,
        value: args.vector,
      },
    ]),
    sideEffects: [],
  };
}

/** The covered vector a watermark row carries; null for every other envelope. */
export function snapshotWatermarkVector(envelope: MutationEnvelope): StateVector | null {
  const { body } = envelope;
  if (body.type !== SNAPSHOT_WATERMARK_ENTITY_TYPE) return null;
  if (body.kind !== 'setField' || body.path !== SNAPSHOT_WATERMARK_PATH) return null;
  const parsed = v.safeParse(StateVectorSchema, body.value);
  return parsed.success ? parsed.output : null;
}
