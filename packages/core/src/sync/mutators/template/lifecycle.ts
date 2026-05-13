/**
 * `createTemplate` + `deleteTemplate` — template entity lifecycle.
 *
 * Mirrors the request-side lifecycle: each is a single-envelope batch
 * (no parent slot — templates are tracked by `path` on the template
 * payload itself, just like requests). The set-modeled path
 * (`conditions`) is NOT pre-seeded by `createTemplate`. The projection
 * layer (`template-projection.ts`) flattens the create payload into
 * per-leaf scalars + per-row `addToSet` envelopes, so the catalog's
 * create can stay opaque about row shapes — same pattern `seedRequest`
 * uses.
 *
 * Cascade deletes when a parent template-collection / template-folder
 * is removed are emitted from the SW write site (template-store
 * cascade walks `path` prefixes); this catalog ships the
 * single-entity primitives.
 */

import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { TEMPLATE_ENTITY_TYPE } from './types';

export interface CreateTemplateArgs {
  templateUid: string;
  /**
   * Full template payload as `Template` minus `uid` (carried on
   * the envelope as `id`). Validated at the oracle boundary by the
   * template schema. The projector is responsible for splitting
   * `conditions` array into per-row `addToSet` envelopes.
   */
  payload: unknown;
}

export function createTemplate(ctx: MutatorContext, args: CreateTemplateArgs): MutatorIntent {
  const bodies: MutationBody[] = [
    {
      kind: 'create',
      type: TEMPLATE_ENTITY_TYPE,
      id: args.templateUid,
      payload: args.payload,
    },
  ];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

export interface DeleteTemplateArgs {
  templateUid: string;
}

export function deleteTemplate(ctx: MutatorContext, args: DeleteTemplateArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [{ kind: 'delete', type: TEMPLATE_ENTITY_TYPE, id: args.templateUid }]),
    sideEffects: [],
  };
}
