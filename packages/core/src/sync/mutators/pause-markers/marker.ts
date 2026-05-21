/**
 * Marker intent factories.
 *
 * Three primitives:
 *   - `setPauseMarker(path, kind)` — addToSet on the singleton.
 *     Concurrent same-path sets converge under per-(setPath, itemId)
 *     LWW; the kind on the highest-HLC envelope wins.
 *   - `clearPauseMarker(path)` — removeFromSet tombstone. The path
 *     reverts to its inherited state per `resolvePauseState`.
 *   - `replacePauseMarkers({ existing, next })` — atomic batch that
 *     drops every entry in `existing` not present in `next` and adds
 *     each entry in `next`. Single batchId so the local oracle's
 *     all-or-nothing (§11.2) keeps observers from seeing the partial
 *     intermediate state. Used by import + bulk-clear gestures.
 *
 * Every primitive emits a `RECOMPILE_DNR` intent keyed by the
 * singleton id; the shared dnr-intent runner drains it and asks the
 * rule engine for a recompile that re-reads pause state through
 * `getPauseMarkers()`.
 */

import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { derivePauseMarkersSideEffects } from './side-effects';
import {
  PAUSE_MARKERS_ENTITY_TYPE,
  PAUSE_MARKERS_ID,
  PAUSE_MARKERS_PATH,
  type PauseMarkerKind,
  type PauseMarkerSlot,
} from './types';

export interface SetPauseMarkerArgs {
  path: string;
  marker: PauseMarkerKind;
}

export function setPauseMarker(ctx: MutatorContext, args: SetPauseMarkerArgs): MutatorIntent {
  const item: PauseMarkerSlot = { path: args.path, marker: args.marker };
  const batch = mintBatch(ctx, [
    {
      kind: 'addToSet',
      type: PAUSE_MARKERS_ENTITY_TYPE,
      id: PAUSE_MARKERS_ID,
      path: PAUSE_MARKERS_PATH,
      itemId: args.path,
      item,
    },
  ]);
  return { batch, sideEffects: batch.mutations.flatMap(derivePauseMarkersSideEffects) };
}

export interface ClearPauseMarkerArgs {
  path: string;
}

export function clearPauseMarker(ctx: MutatorContext, args: ClearPauseMarkerArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'removeFromSet',
      type: PAUSE_MARKERS_ENTITY_TYPE,
      id: PAUSE_MARKERS_ID,
      path: PAUSE_MARKERS_PATH,
      itemId: args.path,
    },
  ]);
  return { batch, sideEffects: batch.mutations.flatMap(derivePauseMarkersSideEffects) };
}

export interface ReplacePauseMarkersArgs {
  /** Currently-known paths on this surface — used to compute removals. */
  existing: ReadonlyMap<string, PauseMarkerKind> | Readonly<Record<string, PauseMarkerKind>>;
  next: ReadonlyMap<string, PauseMarkerKind> | Readonly<Record<string, PauseMarkerKind>>;
}

export function replacePauseMarkers(ctx: MutatorContext, args: ReplacePauseMarkersArgs): MutatorIntent {
  const existing = toMap(args.existing);
  const next = toMap(args.next);
  const bodies: MutationBody[] = [];
  for (const path of existing.keys()) {
    if (!next.has(path)) {
      bodies.push({
        kind: 'removeFromSet',
        type: PAUSE_MARKERS_ENTITY_TYPE,
        id: PAUSE_MARKERS_ID,
        path: PAUSE_MARKERS_PATH,
        itemId: path,
      });
    }
  }
  for (const [path, marker] of next) {
    const item: PauseMarkerSlot = { path, marker };
    bodies.push({
      kind: 'addToSet',
      type: PAUSE_MARKERS_ENTITY_TYPE,
      id: PAUSE_MARKERS_ID,
      path: PAUSE_MARKERS_PATH,
      itemId: path,
      item,
    });
  }
  // An empty batch derives no intents; a non-empty one derives one
  // recompile per envelope, all singleton-keyed so the runner
  // coalesces them. Routing through the derivation keeps mint-side
  // identical to what `deriveSideEffectsForEnvelope` produces on the
  // inbound path.
  const batch = mintBatch(ctx, bodies);
  return { batch, sideEffects: batch.mutations.flatMap(derivePauseMarkersSideEffects) };
}

function toMap(
  src: ReadonlyMap<string, PauseMarkerKind> | Readonly<Record<string, PauseMarkerKind>>,
): Map<string, PauseMarkerKind> {
  if (src instanceof Map) return new Map(src);
  return new Map(Object.entries(src));
}
