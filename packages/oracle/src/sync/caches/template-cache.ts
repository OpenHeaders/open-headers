/**
 * Template cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { TemplateSchema } from '@openheaders/core/schemas';
import { TEMPLATE_ENTITY_TYPE } from '@openheaders/core/sync';
import { projectTemplate, seedTemplate } from '@openheaders/core/sync-builders/projections/template-projection';
import type { Template } from '@openheaders/core/types';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import type { InMemoryBroadcast } from '../broadcast';
import type { EntityOracle } from '../oracle';
import {
  affectsTreeContainment,
  arrangeInTreeOrder,
  resolveLeafParentPath,
} from '../post-state/folder-tree-post-state';
import { TEMPLATE_TREE } from '../post-state/template-folder-post-state';
import { driftRecorder } from '../storage-drift';
import type { SwMutatorContextFactory } from '../sw-context';
import { createFlatEntityCache } from './flat-entity-cache';

export type TemplateCacheListener = () => void;

export interface TemplateCache {
  readonly workspaceId: string;
  getTemplates(): Template[];
  seedFromPersistedTemplates(templates: Template[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: TemplateCacheListener): () => void;
  dispose(): void;
}

export function createTemplateCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): TemplateCache {
  const core = createFlatEntityCache<Template, typeof TEMPLATE_ENTITY_TYPE>(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: TEMPLATE_ENTITY_TYPE,
      loggerTag: 'TemplateCache',
      storageKey: (ws) => wsKeys(ws).templates,
      project: (materialized, oracle) =>
        projectTemplate(materialized, resolveLeafParentPath(oracle, materialized.id, TEMPLATE_TREE)),
      arrange: (entities, oracle) => arrangeInTreeOrder(oracle, TEMPLATE_TREE, entities),
      // Own envelopes plus the containment envelopes a leaf's projected
      // path and sibling order depend on (a parent's `folders` / `items`
      // slots — folder moves cascade through here).
      affects: (event) =>
        event.envelope.body.type === TEMPLATE_ENTITY_TYPE || affectsTreeContainment(event.envelope.body, TEMPLATE_TREE),
      seed: seedTemplate,
      loadFromStorage: (ws) =>
        hostStorage.getValidatedArray(wsKeys(ws).templates, TemplateSchema, {
          onError: driftRecorder({
            subsystem: 'rule-engine',
            storageKey: wsKeys(ws).templates.key,
            workspaceId: ws,
          }),
        }),
    },
  );
  return {
    workspaceId: core.workspaceId,
    getTemplates: core.getEntities,
    seedFromPersistedTemplates: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
