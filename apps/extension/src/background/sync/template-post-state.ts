/**
 * Per-envelope template post-state projection.
 *
 * Same shape as the request + rule projectors: renderer-side write
 * helpers (`buildUpdateBatch`, partial save flows) need both the live
 * itemIds AND the per-itemId order keys at the set-modeled `conditions`
 * path on a template so the unified set-diff synthesizer can emit the
 * minimum envelope set on save (§7.2). Round-tripping back to the SW
 * per write would kill the synchronous-render discipline (§19.4), so
 * the post-commit projection rides every Template
 * {@link SyncBroadcastEvent}.
 */

import type { SyncTemplatePostState } from '@openheaders/core/protocol';
import type { MutationEnvelope } from '@openheaders/core/sync';
import { TEMPLATE_CONDITIONS_PATH, TEMPLATE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { EntityOracle } from './oracle';
import { projectTemplate } from '@/shared/sync/template-projection';

const TEMPLATE_SET_PATHS = [TEMPLATE_CONDITIONS_PATH] as const;

/**
 * Build the template post-state for `envelope` using `oracle`. Returns
 * `null` for non-Template envelopes, deletes (entity tombstoned), and
 * any envelope whose target template fails to project — the broadcast
 * still fires; just without the optional payload.
 */
export function projectTemplatePostState(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveOrderedSetItems'>,
  envelope: MutationEnvelope,
): SyncTemplatePostState | null {
  if (envelope.body.type !== TEMPLATE_ENTITY_TYPE) return null;
  return projectTemplateByUid(oracle, envelope.body.id);
}

/**
 * Build the template post-state for a known template uid. Same shape
 * the envelope projector returns; used by the snapshot RPC to seed
 * freshly-mounted renderer mirrors before the next live broadcast.
 */
export function projectTemplateByUid(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveOrderedSetItems'>,
  templateUid: string,
): SyncTemplatePostState | null {
  const materialized = oracle.materializeOne(TEMPLATE_ENTITY_TYPE, templateUid);
  if (!materialized) return null;

  const template = projectTemplate(materialized);
  if (!template) return null;

  const setItemIds: Record<string, string[]> = {};
  const setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>> = {};
  for (const path of TEMPLATE_SET_PATHS) {
    const items = oracle.liveOrderedSetItems(TEMPLATE_ENTITY_TYPE, templateUid, path);
    if (items.length === 0) continue;
    setItemIds[path] = items.map((entry) => entry.itemId);
    setOrderKeys[path] = items.map((entry) => ({ itemId: entry.itemId, orderKey: entry.key }));
  }

  return { template, setItemIds, setOrderKeys };
}
