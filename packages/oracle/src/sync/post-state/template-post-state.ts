/**
 * Per-envelope template post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts`. Renderer-side write
 * helpers (`buildUpdateBatch`, partial save flows) need both the live
 * itemIds AND the per-itemId order keys at the set-modeled
 * `conditions` path on a template so the unified set-diff synthesizer
 * can emit the minimum envelope set on save (§7.2).
 */

import type { SyncTemplatePostState } from '@openheaders/core/protocol';
import { TEMPLATE_CONDITIONS_PATH, TEMPLATE_ENTITY_TYPE } from '@openheaders/core/sync';
import { projectTemplate } from '@openheaders/core/sync-builders/projections/template-projection';
import type { Template } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { buildSetMembersExtras, makeFlatEntityProjectors } from './flat-entity-post-state';
import { resolveLeafParentPath } from './folder-tree-post-state';
import { TEMPLATE_TREE } from './template-folder-post-state';

const TEMPLATE_SET_PATHS = [TEMPLATE_CONDITIONS_PATH] as const;

type Reads = Pick<
  EntityOracle,
  'materializeOne' | 'materializeAll' | 'liveSetItems' | 'liveOrderedSetItems' | 'revision'
>;

const projectors = makeFlatEntityProjectors<Reads, Template, SyncTemplatePostState>({
  entityType: TEMPLATE_ENTITY_TYPE,
  project: (materialized, oracle) =>
    projectTemplate(materialized, resolveLeafParentPath(oracle, materialized.id, TEMPLATE_TREE)),
  composeResult: (template, oracle, uid) => ({
    template,
    ...buildSetMembersExtras(oracle, TEMPLATE_ENTITY_TYPE, uid, TEMPLATE_SET_PATHS),
  }),
});

export const projectTemplatePostState = projectors.projectPostState;
export const projectTemplateByUid = projectors.projectByUid;
