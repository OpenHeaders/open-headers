/**
 * Marker intent factories.
 *
 * Three primitives:
 *   - `setPauseMarker(entry)` — addToSet on the singleton, keyed by the
 *     container uid. Concurrent same-container sets converge under
 *     per-(setPath, itemId) LWW; the kind on the highest-HLC envelope
 *     wins.
 *   - `clearPauseMarker(uid)` — removeFromSet tombstone. The container
 *     reverts to its inherited state per `resolvePauseState`.
 *   - `replacePauseMarkers({ existing, next })` — atomic batch that
 *     drops every uid in `existing` absent from `next` and adds each
 *     entry in `next`. Single batchId so the local oracle's
 *     all-or-nothing (§11.2) keeps observers from seeing the partial
 *     intermediate state. Used by prune + bulk-clear gestures.
 *
 *   - `migrateLegacyPauseMarkers(plan)` — the boot migration's batch:
 *     one `removeFromSet` per version-1 member to retire, and for each
 *     member to convert its `removeFromSet` plus the `addToSet` keyed
 *     by the container uid (the path kept as the hint). The plan comes
 *     from the projection module's `planLegacyPauseMarkerMigration`;
 *     the cache's boot pass commits the batch once, and a later boot
 *     finds no live version-1 member and mints nothing.
 *
 * Every primitive emits a `RECOMPILE_DNR` intent keyed by the
 * singleton id; the shared dnr-intent runner drains it and asks the
 * rule engine for a recompile that re-reads pause state through
 * `getPausedUids()`.
 */

import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { derivePauseMarkersSideEffects } from './side-effects';
import {
  type LegacyPauseMarkerMigration,
  PAUSE_MARKERS_ENTITY_TYPE,
  PAUSE_MARKERS_ID,
  PAUSE_MARKERS_PATH,
  type PauseMarkerEntry,
} from './types';

export type SetPauseMarkerArgs = PauseMarkerEntry;

export function setPauseMarker(ctx: MutatorContext, args: SetPauseMarkerArgs): MutatorIntent {
  const batch = mintBatch(ctx, [addBody(args)]);
  return { batch, sideEffects: batch.mutations.flatMap(derivePauseMarkersSideEffects) };
}

export interface ClearPauseMarkerArgs {
  uid: string;
}

export function clearPauseMarker(ctx: MutatorContext, args: ClearPauseMarkerArgs): MutatorIntent {
  const batch = mintBatch(ctx, [removeBody(args.uid)]);
  return { batch, sideEffects: batch.mutations.flatMap(derivePauseMarkersSideEffects) };
}

export interface ReplacePauseMarkersArgs {
  /** Currently-known container uids on this surface — used to compute removals. */
  existing: Iterable<string>;
  next: readonly PauseMarkerEntry[];
}

export function replacePauseMarkers(ctx: MutatorContext, args: ReplacePauseMarkersArgs): MutatorIntent {
  const keep = new Set(args.next.map((entry) => entry.uid));
  const bodies: MutationBody[] = [];
  for (const uid of args.existing) {
    if (!keep.has(uid)) bodies.push(removeBody(uid));
  }
  for (const entry of args.next) bodies.push(addBody(entry));
  // An empty batch derives no intents; a non-empty one derives one
  // recompile per envelope, all singleton-keyed so the runner
  // coalesces them. Routing through the derivation keeps mint-side
  // identical to what `deriveSideEffectsForEnvelope` produces on the
  // inbound path.
  const batch = mintBatch(ctx, bodies);
  return { batch, sideEffects: batch.mutations.flatMap(derivePauseMarkersSideEffects) };
}

export function migrateLegacyPauseMarkers(ctx: MutatorContext, plan: LegacyPauseMarkerMigration): MutatorIntent {
  const bodies: MutationBody[] = [];
  for (const itemId of plan.retire) bodies.push(removeBody(itemId));
  for (const { itemId, entry } of plan.convert) {
    bodies.push(removeBody(itemId));
    bodies.push(addBody(entry));
  }
  const batch = mintBatch(ctx, bodies);
  return { batch, sideEffects: batch.mutations.flatMap(derivePauseMarkersSideEffects) };
}

function addBody(entry: PauseMarkerEntry): MutationBody {
  const item: PauseMarkerEntry = { type: entry.type, uid: entry.uid, marker: entry.marker };
  if (entry.path !== undefined) item.path = entry.path;
  return {
    kind: 'addToSet',
    type: PAUSE_MARKERS_ENTITY_TYPE,
    id: PAUSE_MARKERS_ID,
    path: PAUSE_MARKERS_PATH,
    itemId: entry.uid,
    item,
  };
}

/** The tombstone for a set key: a container uid, or a version-1 member's path. */
function removeBody(itemId: string): MutationBody {
  return {
    kind: 'removeFromSet',
    type: PAUSE_MARKERS_ENTITY_TYPE,
    id: PAUSE_MARKERS_ID,
    path: PAUSE_MARKERS_PATH,
    itemId,
  };
}
