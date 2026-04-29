/**
 * Per-envelope layout-state post-state projection (Phase B).
 *
 * Mirrors `pause-markers-post-state.ts` for the singleton layout-state
 * entity. Reads the materialized whole-object scalar at
 * `LAYOUT_STATE_PATH` and re-emits the opaque blob so renderer
 * consumers see post-commit state without round-tripping through the
 * SW.
 *
 * Tombstoned (singleton deletion is a workspace-teardown gesture only)
 * and non-matching envelopes return `null`.
 */

import type { SyncLayoutStatePostState } from '@openheaders/core/protocol';
import {
  LAYOUT_STATE_ENTITY_TYPE,
  LAYOUT_STATE_ID,
  LAYOUT_STATE_PATH,
  type MutationEnvelope,
} from '@openheaders/core/sync';
import type { EntityOracle } from './oracle';

/**
 * Build the layout-state post-state for `envelope` using `oracle`.
 * Returns `null` for non-matching envelopes, deletes (entity
 * tombstoned), and any envelope whose materialized record fails to
 * project.
 */
export function projectLayoutStatePostState(
  oracle: Pick<EntityOracle, 'materializeOne'>,
  envelope: MutationEnvelope,
): SyncLayoutStatePostState | null {
  if (envelope.body.type !== LAYOUT_STATE_ENTITY_TYPE) return null;
  return projectLayoutStateSingleton(oracle);
}

/**
 * Build the layout-state post-state for the singleton entity. Used by
 * the snapshot RPC to seed freshly-mounted renderer mirrors before the
 * next live broadcast lands. Returns `null` when the singleton hasn't
 * been materialized yet (cold oracle prior to seed).
 */
export function projectLayoutStateSingleton(
  oracle: Pick<EntityOracle, 'materializeOne'>,
): SyncLayoutStatePostState | null {
  const materialized = oracle.materializeOne(LAYOUT_STATE_ENTITY_TYPE, LAYOUT_STATE_ID);
  if (!materialized) return null;

  const data = materialized.data as Record<string, unknown> | null;
  const layout = data && LAYOUT_STATE_PATH in data ? data[LAYOUT_STATE_PATH] : null;
  return { layout: layout ?? null };
}
