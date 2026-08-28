/**
 * Pause-markers write-site → oracle helpers.
 *
 * Pure transforms — no oracle reads, no IO — used by both the SW
 * (legacy store routing through the oracle) and the renderer
 * (`usePauseMarkersMutator` write client). Mirrors
 * `vault-mutations.ts`.
 *
 * `replacePauseMarkers` needs the existing uid set so it can compute
 * removals. Callers (SW: in-memory mirror; renderer: live mirror)
 * supply that — the helpers don't read the oracle directly.
 */

import {
  clearPauseMarker,
  type MutatorContext,
  type MutatorIntent,
  type PauseMarkerEntry,
  replacePauseMarkers,
  setPauseMarker,
} from '@openheaders/core/sync';

export type PauseMarkersMutationPayload = MutatorIntent;

export type SetPauseMarkerInput = PauseMarkerEntry;

export function buildSetPauseMarkerBatch(input: SetPauseMarkerInput, ctx: MutatorContext): PauseMarkersMutationPayload {
  return setPauseMarker(ctx, input);
}

export interface ClearPauseMarkerInput {
  uid: string;
}

export function buildClearPauseMarkerBatch(
  input: ClearPauseMarkerInput,
  ctx: MutatorContext,
): PauseMarkersMutationPayload {
  return clearPauseMarker(ctx, input);
}

export interface ReplacePauseMarkersInput {
  existing: Iterable<string>;
  next: readonly PauseMarkerEntry[];
}

export function buildReplacePauseMarkersBatch(
  input: ReplacePauseMarkersInput,
  ctx: MutatorContext,
): PauseMarkersMutationPayload {
  return replacePauseMarkers(ctx, input);
}
