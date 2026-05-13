/**
 * Template write-site → oracle helpers.
 *
 * Parallel to {@link rule-mutations} / {@link request-mutations}: the
 * helpers below produce `(batch, sideEffects)` pairs from the template
 * catalog factories. Pure transforms — no oracle reads, no IO — used
 * by both the SW (template-store routing + cascade deletes) and the
 * renderer (`useTemplateMutator` write client).
 *
 * Set-modeled `conditions` is routed through the shared
 * {@link synthesizeSetDiff} so save-time gestures emit the minimum
 * envelope set (§7.2): `removeFromSet` for vanished uids, `addToSet`
 * for new and content-changed uids (per-itemId LWW supersedes; no
 * redundant `removeFromSet` for content edits), `moveBefore` for pure
 * position changes. Item identity comes from the schema-required
 * `RuleCondition.uid`.
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
import type { Template } from '@openheaders/core/types';
import { seedTemplate } from './template-projection';
import { type LiveSetEntry, synthesizeSetDiff } from './set-diff';

export interface TemplateMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

/**
 * Live-set reader for set-modeled paths on a Template. Returns the
 * triplet `{itemId, orderKey, item}` per live set member in canonical
 * sort order — {@link synthesizeSetDiff} consults the orderKey + item
 * to detect pure-reorder gestures, content edits, and additions in
 * one pass.
 */
export type LiveSetEntries = (
  templateUid: string,
  setPath: string,
) => ReadonlyArray<LiveSetEntry>;

/** New template → seed batch. No side effects. */
export function buildAddBatch(template: Template, ctx: MutatorContext): TemplateMutationPayload {
  return { batch: seedTemplate(template, ctx), sideEffects: [] };
}

/** Delete a template. Tombstone is permanent under §7.2 delete-wins. */
export function buildDeleteBatch(templateUid: string, ctx: MutatorContext): TemplateMutationPayload {
  const bodies: MutationBody[] = [{ kind: 'delete', type: TEMPLATE_ENTITY_TYPE, id: templateUid }];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

/**
 * Translate a `Partial<Omit<Template, 'uid'|'path'>>` patch into a
 * single batch of mutations. Scalar fields → one `setField` per leaf;
 * set-modeled `conditions` → minimum diff via {@link synthesizeSetDiff}.
 *
 * `formValues` and `includes` flow through `setField` — they're
 * variant scalars by §template-mutator-catalog v1 trade-off.
 */
export function buildUpdateBatch(
  templateUid: string,
  updates: Partial<Omit<Template, 'uid' | 'path'>>,
  ctx: MutatorContext,
  liveSetEntries: LiveSetEntries,
): TemplateMutationPayload {
  const bodies: MutationBody[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;

    if (key === TEMPLATE_CONDITIONS_PATH && Array.isArray(value)) {
      bodies.push(
        ...synthesizeSetDiff({
          type: TEMPLATE_ENTITY_TYPE,
          id: templateUid,
          path: TEMPLATE_CONDITIONS_PATH,
          live: liveSetEntries(templateUid, TEMPLATE_CONDITIONS_PATH),
          newItems: value,
        }),
      );
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
