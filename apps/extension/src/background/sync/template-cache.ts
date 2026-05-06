/**
 * Template cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { TEMPLATE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { wsKeys } from '@/shared/storage';
import { projectTemplate, seedTemplate } from '@/shared/sync/template-projection';
import type { InMemoryBroadcast } from './broadcast';
import { createFlatEntityCache } from './flat-entity-cache';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type TemplateCacheListener = () => void;

export interface TemplateCache {
  readonly workspaceId: string;
  getTemplates(): V5.Template[];
  seedFromPersistedTemplates(templates: V5.Template[]): Promise<void>;
  onChange(listener: TemplateCacheListener): () => void;
  dispose(): void;
}

export function createTemplateCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): TemplateCache {
  const core = createFlatEntityCache<V5.Template, typeof TEMPLATE_ENTITY_TYPE>(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: TEMPLATE_ENTITY_TYPE,
      loggerTag: 'TemplateCache',
      storageKey: (ws) => wsKeys(ws).templates,
      project: projectTemplate,
      seed: seedTemplate,
    },
  );
  return {
    workspaceId: core.workspaceId,
    getTemplates: core.getEntities,
    seedFromPersistedTemplates: core.seedFromPersisted,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
