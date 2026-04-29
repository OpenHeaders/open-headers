/**
 * Template condition intent factories.
 *
 * Conditions live as set members at `conditions` on the template. They
 * mirror the rule-condition shape exactly (`{ type, values, headerName? }`),
 * but unlike rule conditions a template-condition write does NOT emit
 * a DNR side-effect: templates are passive snapshots applied on demand
 * to materialize a fresh rule, not live participants in DNR routing.
 *
 * `setTemplateConditionField` re-emits the whole condition record via
 * addToSet with the same itemId. Per-field LWW within a single
 * condition is not a v1 generic primitive (parallel to rule
 * `condition.ts` and request `auth`/`body`). The caller passes the
 * merged condition object; this factory does not read state.
 */

import { generateUid } from '../../../utils/workspace';
import type { MutationBody } from '../../envelope';
import { mintBatch } from './envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { TEMPLATE_CONDITIONS_PATH, TEMPLATE_ENTITY_TYPE, type TemplateConditionLike } from './types';

export interface AddTemplateConditionArgs {
  templateUid: string;
  condition: TemplateConditionLike;
  itemId?: string;
}

export function addTemplateCondition(
  ctx: MutatorContext,
  args: AddTemplateConditionArgs,
): MutatorIntent {
  const itemId = args.itemId ?? generateUid();
  const bodies: MutationBody[] = [
    {
      kind: 'addToSet',
      type: TEMPLATE_ENTITY_TYPE,
      id: args.templateUid,
      path: TEMPLATE_CONDITIONS_PATH,
      itemId,
      item: args.condition,
    },
  ];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

export interface RemoveTemplateConditionArgs {
  templateUid: string;
  itemId: string;
}

export function removeTemplateCondition(
  ctx: MutatorContext,
  args: RemoveTemplateConditionArgs,
): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'removeFromSet',
        type: TEMPLATE_ENTITY_TYPE,
        id: args.templateUid,
        path: TEMPLATE_CONDITIONS_PATH,
        itemId: args.itemId,
      },
    ]),
    sideEffects: [],
  };
}

export interface SetTemplateConditionFieldArgs {
  templateUid: string;
  itemId: string;
  /** Full merged condition record after the field write. The caller owns the merge. */
  condition: TemplateConditionLike;
}

export function setTemplateConditionField(
  ctx: MutatorContext,
  args: SetTemplateConditionFieldArgs,
): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'addToSet',
        type: TEMPLATE_ENTITY_TYPE,
        id: args.templateUid,
        path: TEMPLATE_CONDITIONS_PATH,
        itemId: args.itemId,
        item: args.condition,
      },
    ]),
    sideEffects: [],
  };
}
