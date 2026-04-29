/**
 * Template write-site → oracle helpers.
 *
 * Parallel to {@link request-mutations}: the four helpers below produce
 * `(batch, sideEffects)` pairs from the template catalog factories.
 * Pure transforms — no oracle reads, no IO — used by both the SW
 * (template-store routing + cascade deletes) and the renderer
 * (`useTemplateMutator` write client).
 *
 * The set-modeled path (`conditions`) needs special handling on partial
 * updates: a naïve `setField('conditions', [...])` would write a leaf
 * entry that competes with the oracle's setItems entries at the same
 * path, producing a non-deterministic materialized view.
 * {@link buildUpdateBatch} therefore reads the live itemIds from the
 * oracle / mirror, emits one `removeFromSet` per existing item, then
 * emits one `addToSet` per member of the new value with a fresh itemId.
 *
 * No side-effect intents: templates are passive snapshots — they don't
 * feed DNR or the variables resolver.
 */

import {
  mintBatch,
  type MutationBatch,
  type MutationBody,
  TEMPLATE_CONDITIONS_PATH,
  TEMPLATE_ENTITY_TYPE,
  type MutatorContext,
  type SideEffectIntent,
} from '@openheaders/core/sync';
import { generateUid } from '@openheaders/core/utils';
import type { V5 } from '@openheaders/core/types';
import { seedTemplate } from './template-projection';

export interface TemplateMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

/**
 * Live-itemId reader for set-modeled paths on a Template. Same shape
 * as {@link request-mutations.LiveSetItemIds} so SW + renderer can
 * both satisfy it from their respective `liveSetItems` surfaces.
 */
export type LiveSetItemIds = (templateUid: string, setPath: string) => readonly string[];

/** New template → seed batch. No side effects. */
export function buildAddBatch(template: V5.Template, ctx: MutatorContext): TemplateMutationPayload {
  return { batch: seedTemplate(template, ctx), sideEffects: [] };
}

/** Delete a template. Tombstone is permanent under §7.2 delete-wins. */
export function buildDeleteBatch(templateUid: string, ctx: MutatorContext): TemplateMutationPayload {
  const bodies: MutationBody[] = [{ kind: 'delete', type: TEMPLATE_ENTITY_TYPE, id: templateUid }];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

const isConditionsPath = (key: string): boolean => key === TEMPLATE_CONDITIONS_PATH;

/**
 * Translate a `Partial<Omit<V5.Template, 'uid'|'path'>>` patch into a
 * single batch of mutations. Scalar fields → one `setField` per leaf;
 * set-modeled `conditions` → `removeFromSet` per existing itemId
 * followed by `addToSet` per new member.
 *
 * `formValues` and `includes` flow through `setField` — they're
 * variant scalars by §template-mutator-catalog v1 trade-off.
 */
export function buildUpdateBatch(
  templateUid: string,
  updates: Partial<Omit<V5.Template, 'uid' | 'path'>>,
  ctx: MutatorContext,
  liveSetItemIds: LiveSetItemIds,
): TemplateMutationPayload {
  const bodies: MutationBody[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;

    if (isConditionsPath(key) && Array.isArray(value)) {
      pushSetReplacement(bodies, templateUid, value, liveSetItemIds);
      continue;
    }

    bodies.push({
      kind: 'setField',
      type: TEMPLATE_ENTITY_TYPE,
      id: templateUid,
      path: key,
      value,
    });
  }

  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

function pushSetReplacement(
  bodies: MutationBody[],
  templateUid: string,
  newItems: unknown[],
  liveSetItemIds: LiveSetItemIds,
): void {
  const live = liveSetItemIds(templateUid, TEMPLATE_CONDITIONS_PATH);
  for (const itemId of live) {
    bodies.push({
      kind: 'removeFromSet',
      type: TEMPLATE_ENTITY_TYPE,
      id: templateUid,
      path: TEMPLATE_CONDITIONS_PATH,
      itemId,
    });
  }
  for (const item of newItems) {
    bodies.push({
      kind: 'addToSet',
      type: TEMPLATE_ENTITY_TYPE,
      id: templateUid,
      path: TEMPLATE_CONDITIONS_PATH,
      itemId: generateUid(),
      item,
    });
  }
}
