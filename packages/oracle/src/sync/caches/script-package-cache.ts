/**
 * Script-package cache + persistence sink. Thin adapter over
 * `flat-entity-cache.ts`.
 */

import { ScriptPackageSchema } from '@openheaders/core/schemas';
import { SCRIPT_PACKAGE_ENTITY_TYPE } from '@openheaders/core/sync';
import {
  projectScriptPackage,
  seedScriptPackage,
} from '@openheaders/core/sync-builders/projections/script-package-projection';
import type { ScriptPackage } from '@openheaders/core/types';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import type { InMemoryBroadcast } from '../broadcast';
import type { EntityOracle } from '../oracle';
import { driftRecorder } from '../storage-drift';
import type { SwMutatorContextFactory } from '../sw-context';
import { createFlatEntityCache } from './flat-entity-cache';

export type ScriptPackageCacheListener = () => void;

export interface ScriptPackageCache {
  readonly workspaceId: string;
  getScriptPackages(): ScriptPackage[];
  seedFromPersistedScriptPackages(items: ScriptPackage[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: ScriptPackageCacheListener): () => void;
  dispose(): void;
}

export function createScriptPackageCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): ScriptPackageCache {
  const core = createFlatEntityCache<ScriptPackage, typeof SCRIPT_PACKAGE_ENTITY_TYPE>(
    workspaceId,
    oracle,
    broadcast,
    contextFactory,
    {
      entityType: SCRIPT_PACKAGE_ENTITY_TYPE,
      loggerTag: 'ScriptPackageCache',
      storageKey: (ws) => wsKeys(ws).scriptPackages,
      project: projectScriptPackage,
      seed: seedScriptPackage,
      loadFromStorage: (ws) =>
        hostStorage.getValidatedArray(wsKeys(ws).scriptPackages, ScriptPackageSchema, {
          onError: driftRecorder({
            subsystem: 'scripts',
            storageKey: wsKeys(ws).scriptPackages.key,
            workspaceId: ws,
          }),
        }),
    },
  );
  return {
    workspaceId: core.workspaceId,
    getScriptPackages: core.getEntities,
    seedFromPersistedScriptPackages: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
