/**
 * SyncDataImporter — writes synced Git data to the workspace directory on disk.
 *
 * Handles:
 *  - Source merging (preserves local execution data like sourceContent)
 *  - Rules import with proper storage format
 *  - Proxy rules import
 *  - Environment import with safety guards (backup, validation, value preservation)
 *
 * After writing, passes SyncData to WorkspaceStateService via the onSyncDataChanged
 * callback so it can merge directly into in-memory state and broadcast.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Environment, Source } from '@openheaders/core';
import electron from 'electron';
import { DATA_FORMAT_VERSION } from '@/config/version';
import {
  cleanupOldBackups,
  createBackupIfNeeded,
  ENV_FILE_READ_MAX_RETRIES,
  readFileWithAtomicWriter,
  validateEnvironmentWrite,
} from '@/services/workspace/git/utils/EnvironmentSyncUtils';
import type { EnvironmentMap, EnvironmentsFile } from '@/types/environment';
import atomicWriter from '@/utils/atomicFileWriter';
import mainLogger from '@/utils/mainLogger';
import { broadcastToRenderers } from './SyncBroadcaster';
import type { BroadcasterFn, SyncData } from './types';

const { createLogger } = mainLogger;
const log = createLogger('SyncDataImporter');

interface ImportOptions {
  broadcastToExtensions?: boolean;
}

/**
 * Import synced configuration data into a workspace directory on disk.
 *
 * @param workspaceId  Target workspace
 * @param data         Synced data from Git
 * @param options      Import options
 * @param broadcaster  Optional broadcaster for IPC events (testing)
 * @param onSyncDataChanged  Callback to merge synced data into in-memory state
 */
export async function importSyncedData(
  workspaceId: string,
  data: SyncData,
  options: ImportOptions = {},
  broadcaster: BroadcasterFn | null = null,
  onSyncDataChanged: ((workspaceId: string, data: SyncData) => Promise<void>) | null = null,
): Promise<void> {
  const { broadcastToExtensions = true } = options;

  try {
    const userDataPath = electron.app.getPath('userData');
    const workspacePath = path.join(userDataPath, 'workspaces', workspaceId);

    await fs.promises.mkdir(workspacePath, { recursive: true });

    // Write to disk for cold boot / crash recovery persistence.
    await importSources(workspacePath, workspaceId, data);
    await importRules(workspacePath, workspaceId, data);
    await importProxyRules(workspacePath, workspaceId, data);
    await importEnvironments(workspacePath, workspaceId, data, broadcaster);

    // Merge synced data directly into in-memory state. The callback
    // receives the raw SyncData so it can merge against the current
    // in-memory state (which may include CRUD changes not yet on disk),
    // rather than reloading from the disk files we just wrote.
    if (broadcastToExtensions && onSyncDataChanged) {
      await onSyncDataChanged(workspaceId, data);
    }
  } catch (error) {
    log.error(`Failed to import synced data for workspace ${workspaceId}:`, error);
    throw error;
  }
}

// ── Sources ──────────────────────────────────────────────────────

/**
 * Merge remote sources with existing local sources.
 *
 * Remote defines which sources exist (structure authority). For each source,
 * local execution state (content, fetch results, activation, refresh timers)
 * is preserved so the app doesn't lose runtime data during sync.
 *
 * Exported so both importSources (disk merge for persistence) and
 * WorkspaceStateService.onSyncDataChanged (memory merge for runtime)
 * share the same merge logic.
 */
export function mergeSyncedSources(remoteSources: Source[], existingSources: Source[]): Source[] {
  const existingMap = new Map<string, Source>();
  for (const source of existingSources) {
    if (source.sourceId) {
      existingMap.set(source.sourceId, source);
    }
  }

  return remoteSources.map((remoteSource): Source => {
    const existing = existingMap.get(remoteSource.sourceId);

    if (existing) {
      return {
        ...remoteSource,
        sourceContent: existing.sourceContent ?? null,
        originalResponse: existing.originalResponse ?? null,
        isFiltered: existing.isFiltered,
        filteredWith: existing.filteredWith,
        activationState: existing.activationState ?? remoteSource.activationState,
        missingDependencies: existing.missingDependencies ?? [],
        refreshOptions: remoteSource.refreshOptions
          ? {
              ...remoteSource.refreshOptions,
              lastRefresh: existing.refreshOptions?.lastRefresh ?? null,
              nextRefresh: existing.refreshOptions?.nextRefresh ?? null,
            }
          : existing.refreshOptions,
        createdAt: existing.createdAt ?? remoteSource.createdAt,
        updatedAt: existing.updatedAt ?? remoteSource.updatedAt,
      };
    }

    return remoteSource;
  });
}

async function importSources(workspacePath: string, workspaceId: string, data: SyncData): Promise<void> {
  if (!data.sources || !Array.isArray(data.sources)) return;

  const sourcesPath = path.join(workspacePath, 'sources.json');

  // Load existing sources from disk to preserve local execution data
  let existingSources: Source[] = [];
  try {
    const existingData = await fs.promises.readFile(sourcesPath, 'utf8');
    existingSources = JSON.parse(existingData);
  } catch (_error) {
    // No existing sources, that's fine
  }

  const mergedSources = mergeSyncedSources(data.sources, existingSources);

  await atomicWriter.writeJson(sourcesPath, mergedSources, { pretty: true });
  log.info(`Imported ${data.sources.length} sources for workspace ${workspaceId} (preserved local execution data)`);
}

// ── Rules ────────────────────────────────────────────────────────

async function importRules(workspacePath: string, workspaceId: string, data: SyncData): Promise<void> {
  if (!data.rules) return;

  const rulesStorage = {
    version: DATA_FORMAT_VERSION,
    rules: data.rules,
    metadata: {
      lastUpdated: new Date().toISOString(),
      totalRules:
        (data.rules.header?.length ?? 0) + (data.rules.request?.length ?? 0) + (data.rules.response?.length ?? 0),
    },
  };

  const rulesPath = path.join(workspacePath, 'rules.json');
  await atomicWriter.writeJson(rulesPath, rulesStorage, { pretty: true });
  log.info(`Imported ${rulesStorage.metadata.totalRules} rules for workspace ${workspaceId}`);
}

// ── Proxy rules ──────────────────────────────────────────────────

async function importProxyRules(workspacePath: string, workspaceId: string, data: SyncData): Promise<void> {
  if (!data.proxyRules || !Array.isArray(data.proxyRules)) return;

  const proxyPath = path.join(workspacePath, 'proxy-rules.json');
  await atomicWriter.writeJson(proxyPath, data.proxyRules, { pretty: true });
  log.info(`Imported ${data.proxyRules.length} proxy rules for workspace ${workspaceId}`);
}

// ── Environments ─────────────────────────────────────────────────

async function importEnvironments(
  workspacePath: string,
  workspaceId: string,
  data: SyncData,
  broadcaster: BroadcasterFn | null,
): Promise<void> {
  const envPath = path.join(workspacePath, 'environments.json');

  // Load existing environments
  const existing = await loadExistingEnvironments(envPath, workspaceId, broadcaster);
  if (existing.loadFailed) return; // Abort — can't risk data loss

  // Merge synced data with existing
  const environmentsToImport = mergeEnvironments(data, existing.environments);
  if (!environmentsToImport) return; // Nothing to import

  // Validate write safety
  const newValueCount = countEnvArrayValues(environmentsToImport);
  const validation = validateEnvironmentWrite(existing.valueCount, newValueCount);

  if (!validation.safe || validation.shouldBackup) {
    log.warn(`Potential data loss detected for workspace ${workspaceId}:`, {
      existingValues: existing.valueCount,
      newValues: newValueCount,
      lossPercentage: `${validation.lossPercentage}%`,
      shouldBackup: validation.shouldBackup,
      shouldBlock: validation.shouldBlock,
    });
  }

  if (validation.shouldBackup && existing.fileExists) {
    log.warn(
      `Creating backup before potentially destructive environment sync (${validation.lossPercentage}% value loss)`,
    );
    await createBackupIfNeeded(fs.promises, envPath);
  }

  if (validation.shouldBlock) {
    log.error(
      `BLOCKED: Refusing to write environments with 0 values when existing file had ${existing.valueCount} values`,
    );
    broadcastToRenderers(
      'workspace-sync-warning',
      {
        workspaceId,
        warning: 'Environment sync blocked: Would have deleted all values. Your local data is preserved.',
        timestamp: Date.now(),
      },
      broadcaster,
    );
    return;
  }

  // Write — validate activeEnvironment still exists in the merged result
  const activeStillExists = existing.activeEnvironment
    ? environmentsToImport.some((e) => e.id === existing.activeEnvironment)
    : false;
  const environmentsData: EnvironmentsFile = {
    environments: environmentsToImport,
    activeEnvironment: activeStillExists ? existing.activeEnvironment : (environmentsToImport[0]?.id ?? null),
  };

  await atomicWriter.writeJson(envPath, environmentsData, { pretty: true });
  await cleanupOldBackups(fs.promises, workspacePath, path, 3);

  let varCount = 0;
  for (const env of environmentsToImport) {
    varCount += Object.keys(env.variables).length;
  }
  log.info(
    `Imported ${environmentsToImport.length} environment(s) with ${varCount} variables for workspace ${workspaceId}`,
  );

  broadcastToRenderers(
    'environments-structure-changed',
    {
      workspaceId,
      timestamp: Date.now(),
    },
    broadcaster,
  );
}

/** Count non-empty values across an Environment array. */
function countEnvArrayValues(envs: Environment[]): number {
  let count = 0;
  for (const env of envs) {
    for (const v of Object.values(env.variables)) {
      if (v.value) count++;
    }
  }
  return count;
}

// ── Environment helpers ──────────────────────────────────────────

interface ExistingEnvResult {
  environments: Environment[];
  activeEnvironment: string | null;
  fileExists: boolean;
  loadFailed: boolean;
  valueCount: number;
}

async function loadExistingEnvironments(
  envPath: string,
  workspaceId: string,
  broadcaster: BroadcasterFn | null,
): Promise<ExistingEnvResult> {
  const result: ExistingEnvResult = {
    environments: [],
    activeEnvironment: null,
    fileExists: false,
    loadFailed: false,
    valueCount: 0,
  };

  try {
    const readResult = await readFileWithAtomicWriter(envPath);
    result.fileExists = readResult.exists;

    if (readResult.exists && readResult.content) {
      const parsed = JSON.parse(readResult.content) as {
        environments?: Environment[] | EnvironmentMap;
        activeEnvironment?: string | null;
      };

      if (parsed.environments) {
        if (Array.isArray(parsed.environments)) {
          result.environments = parsed.environments;
        } else {
          // Old format — migrate inline
          result.environments = Object.entries(parsed.environments).map(([name, vars]) => ({
            id: `env-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name,
            variables: vars,
            createdAt: new Date().toISOString(),
          }));
        }
        result.valueCount = countEnvArrayValues(result.environments);
      }
      if (parsed.activeEnvironment) {
        result.activeEnvironment = parsed.activeEnvironment;
      }
      log.info(`Loaded existing environments for workspace ${workspaceId}:`, {
        environmentCount: result.environments.length,
        variablesWithValues: result.valueCount,
        activeEnvironment: result.activeEnvironment,
      });
    } else {
      log.info(`No existing environments file for workspace ${workspaceId}, will create new one`);
    }
  } catch (readError: unknown) {
    result.loadFailed = true;
    result.fileExists = true;
    const errMsg = readError instanceof Error ? readError.message : String(readError);
    log.error(
      `CRITICAL: Failed to read existing environments for workspace ${workspaceId} after ${ENV_FILE_READ_MAX_RETRIES} retries: ${errMsg}`,
    );

    broadcastToRenderers(
      'workspace-sync-warning',
      {
        workspaceId,
        warning: 'Environment sync skipped due to file read error. Your local environment values are preserved.',
        timestamp: Date.now(),
      },
      broadcaster,
    );
  }

  return result;
}

/**
 * Merge synced environment data with existing environments.
 *
 * Exported so both importEnvironments (disk merge) and
 * WorkspaceStateService.onSyncDataChanged (memory merge) share the logic.
 * Returns null when the sync data contains no environment information.
 *
 * The remote sends EnvironmentMap (name-keyed). We merge into the existing
 * Environment[] by matching on name, preserving IDs and collectionId/folderId.
 */
export function mergeEnvironments(data: SyncData, existing: Environment[]): Environment[] | null {
  let mergedMap: EnvironmentMap | null = null;

  if (data.environments && typeof data.environments === 'object' && !data.environmentSchema) {
    mergedMap = mergeDirectEnvironmentsMap(data.environments, envArrayToMap(existing));
  } else if (data.environmentSchema?.environments) {
    mergedMap = mergeSchemaEnvironmentsMap(data, envArrayToMap(existing));
  }

  if (!mergedMap) return null;

  // Convert merged map back to Environment[], preserving existing IDs and organization
  const existingByName = new Map<string, Environment>();
  for (const env of existing) {
    existingByName.set(env.name, env);
  }

  const result: Environment[] = [];
  for (const [envName, vars] of Object.entries(mergedMap)) {
    const existingEnv = existingByName.get(envName);
    result.push({
      id: existingEnv?.id ?? `env-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: envName,
      collectionId: existingEnv?.collectionId,
      folderId: existingEnv?.folderId,
      variables: vars,
      createdAt: existingEnv?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return result;
}

/** Convert Environment[] to EnvironmentMap for internal merge logic. */
function envArrayToMap(envs: Environment[]): EnvironmentMap {
  const map: EnvironmentMap = {};
  for (const env of envs) {
    map[env.name] = env.variables;
  }
  return map;
}

/**
 * Merge direct environment data from the remote into existing local state.
 */
function mergeDirectEnvironmentsMap(remoteEnvs: EnvironmentMap, existing: EnvironmentMap): EnvironmentMap {
  const merged: EnvironmentMap = {};

  for (const [envName, envVars] of Object.entries(remoteEnvs)) {
    merged[envName] = {};

    for (const [varName, varData] of Object.entries(envVars)) {
      if (varData.value) {
        merged[envName][varName] = { ...varData };
      } else {
        const existingVar = existing[envName]?.[varName];
        if (existingVar?.value) {
          merged[envName][varName] = { ...existingVar, isSensitive: varData.isSensitive };
        } else {
          merged[envName][varName] = { value: '', isSensitive: varData.isSensitive };
        }
      }
    }
  }

  return merged;
}

/**
 * Merge schema-based environment data from the remote into existing local state.
 */
function mergeSchemaEnvironmentsMap(data: SyncData, existing: EnvironmentMap): EnvironmentMap {
  const merged: EnvironmentMap = {};
  const schema = data.environmentSchema!;

  for (const [envName, envSchema] of Object.entries(schema.environments)) {
    merged[envName] = {};

    if (envSchema.variables && Array.isArray(envSchema.variables)) {
      for (const varDef of envSchema.variables) {
        if (!varDef.name) continue;

        const existingVar = existing[envName]?.[varDef.name];
        const isSensitive = varDef.isSensitive !== undefined ? varDef.isSensitive : (existingVar?.isSensitive ?? false);

        merged[envName][varDef.name] = {
          value: existingVar?.value ?? '',
          isSensitive,
        };
      }
    }
  }

  if (data.environments) {
    for (const [envName, envVars] of Object.entries(data.environments)) {
      if (!merged[envName]) merged[envName] = {};

      for (const [varName, varData] of Object.entries(envVars)) {
        if (varData.value) {
          merged[envName][varName] = { ...varData };
        } else if (!merged[envName][varName]) {
          merged[envName][varName] = { value: '', isSensitive: varData.isSensitive };
        }
      }
    }
  }

  return merged;
}
