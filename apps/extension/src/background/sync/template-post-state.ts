/**
 * Per-envelope template post-state projection.
 *
 * Same shape as the request projector: renderer-side write helpers
 * (`buildUpdateBatch`, partial save flows) need the live `(itemId)`
 * pairs at the set-modeled `conditions` path on a template before they
 * can emit matching `removeFromSet` envelopes. Round-tripping back to
 * the SW per write would kill the synchronous-render discipline
 * (§19.4), so the post-commit projection rides every Template
 * {@link SyncBroadcastEvent}.
 *
 * The projector runs one `materializeOne` lookup + one `liveSetItems`
 * read per template envelope. Cheap.
 */

import type { SyncTemplatePostState } from '@openheaders/core/protocol';
import type { MutationEnvelope } from '@openheaders/core/sync';
import { TEMPLATE_CONDITIONS_PATH, TEMPLATE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { EntityOracle } from './oracle';
import { projectTemplate } from '@/shared/sync/template-projection';

/**
 * Build the template post-state for `envelope` using `oracle`. Returns
 * `null` for non-Template envelopes, deletes (entity tombstoned), and
 * any envelope whose target template fails to project — the broadcast
 * still fires; just without the optional payload.
 */
export function projectTemplatePostState(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>,
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
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>,
  templateUid: string,
): SyncTemplatePostState | null {
  const materialized = oracle.materializeOne(TEMPLATE_ENTITY_TYPE, templateUid);
  if (!materialized) return null;

  const template = projectTemplate(materialized);
  if (!template) return null;

  const setItemIds: Record<string, string[]> = {};
  const items = oracle.liveSetItems(TEMPLATE_ENTITY_TYPE, templateUid, TEMPLATE_CONDITIONS_PATH);
  if (items.length > 0) {
    setItemIds[TEMPLATE_CONDITIONS_PATH] = items.map((entry) => entry.itemId);
  }

  return { template, setItemIds };
}
