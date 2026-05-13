/**
 * Template cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { TemplateSchema } from '@openheaders/core/schemas';
import { TEMPLATE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Template } from '@openheaders/core/types';
import { extensionStorage, wsKeys } from '@/shared/storage';
import { projectTemplate, seedTemplate } from '@/shared/sync/template-projection';
import { driftRecorder } from '../modules/storage-drift';
import type { InMemoryBroadcast } from './broadcast';
import { createFlatEntityCache } from './flat-entity-cache';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

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
      project: projectTemplate,
      seed: seedTemplate,
      loadFromStorage: (ws) =>
        extensionStorage.getValidatedArray(wsKeys(ws).templates, TemplateSchema, {
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
