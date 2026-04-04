/**
 * StatePersistence — pure functions for reading/writing workspace data.
 *
 * All functions take explicit paths and return data. No service state dependency.
 */

import path from 'node:path';
import type { RulesCollection, RulesStorage, Source } from '@openheaders/core';
import { DATA_FORMAT_VERSION } from '@/config/version';
import {
  convertV5toV4,
  isV5Workspace,
  readAllCollections,
  readAllEnvironments,
  readAllRules,
  readVault,
} from '@/services/workspace/v5-storage';
import type { EnvironmentsFile } from '@/types/environment';
import type { ProxyRule } from '@/types/proxy';
import type { Workspace, WorkspaceSyncStatus, WorkspaceType } from '@/types/workspace';
import atomicWriter from '@/utils/atomicFileWriter';
import mainLogger from '@/utils/mainLogger';

const { createLogger } = mainLogger;
const log = createLogger('StatePersistence');

// ── Workspace config (workspaces.json) ───────────────────────────

export interface WorkspacesConfig {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  syncStatus: Record<string, WorkspaceSyncStatus>;
}

export async function loadWorkspacesConfig(appDataPath: string): Promise<WorkspacesConfig> {
  const configPath = path.join(appDataPath, 'workspaces.json');
  try {
    const data = await atomicWriter.readJson<{
      workspaces?: Workspace[];
      activeWorkspaceId?: string;
      syncStatus?: Record<string, WorkspaceSyncStatus>;
    }>(configPath);
    if (data) {
      return {
        workspaces: data.workspaces ?? [],
        activeWorkspaceId: data.activeWorkspaceId ?? 'default-personal',
        syncStatus: data.syncStatus ?? {},
      };
    }
  } catch (_e) {
    /* fall through */
  }

  // Initialize with default workspace
  const defaultConfig: WorkspacesConfig = {
    workspaces: [
      {
        id: 'default-personal',
        name: 'Personal Workspace',
        type: 'personal' as WorkspaceType,
        description: 'Your default personal workspace',
        isDefault: true,
        isPersonal: true,
        isTeam: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { version: DATA_FORMAT_VERSION, sourceCount: 0, ruleCount: 0, proxyRuleCount: 0 },
      },
    ],
    activeWorkspaceId: 'default-personal',
    syncStatus: {},
  };
  await saveWorkspacesConfig(appDataPath, defaultConfig);
  return defaultConfig;
}

export async function saveWorkspacesConfig(appDataPath: string, config: WorkspacesConfig): Promise<void> {
  const configPath = path.join(appDataPath, 'workspaces.json');
  await atomicWriter.writeJson(configPath, config, { pretty: true });
}

// ── Workspace data (sources, rules, proxy rules) ─────────────────

export function workspaceDir(appDataPath: string, workspaceId: string): string {
  return path.join(appDataPath, 'workspaces', workspaceId);
}

export async function loadSources(appDataPath: string, workspaceId: string): Promise<Source[]> {
  return loadJson<Source[]>(path.join(workspaceDir(appDataPath, workspaceId), 'sources.json'), []);
}

export async function loadRules(appDataPath: string, workspaceId: string): Promise<RulesCollection> {
  const rulesPath = path.join(workspaceDir(appDataPath, workspaceId), 'rules.json');
  try {
    const data = await atomicWriter.readJson<RulesStorage>(rulesPath);
    return data?.rules ?? { header: [], request: [], response: [] };
  } catch (_e) {
    return { header: [], request: [], response: [] };
  }
}

export async function loadProxyRules(appDataPath: string, workspaceId: string): Promise<ProxyRule[]> {
  return loadJson<ProxyRule[]>(path.join(workspaceDir(appDataPath, workspaceId), 'proxy-rules.json'), []);
}

export async function saveSources(appDataPath: string, workspaceId: string, sources: Source[]): Promise<void> {
  const dir = workspaceDir(appDataPath, workspaceId);
  await atomicWriter.writeJson(path.join(dir, 'sources.json'), sources);
}

export async function saveRules(appDataPath: string, workspaceId: string, rules: RulesCollection): Promise<void> {
  const dir = workspaceDir(appDataPath, workspaceId);
  const storage: RulesStorage = {
    version: DATA_FORMAT_VERSION,
    rules,
    metadata: {
      totalRules: rules.header.length + rules.request.length + rules.response.length,
      lastUpdated: new Date().toISOString(),
    },
  };
  await atomicWriter.writeJson(path.join(dir, 'rules.json'), storage, { pretty: true });
}

export async function saveProxyRules(appDataPath: string, workspaceId: string, proxyRules: ProxyRule[]): Promise<void> {
  const dir = workspaceDir(appDataPath, workspaceId);
  await atomicWriter.writeJson(path.join(dir, 'proxy-rules.json'), proxyRules);
}

export async function saveAll(
  appDataPath: string,
  workspaceId: string,
  dirty: { sources: boolean; rules: boolean; proxyRules: boolean; workspaces: boolean },
  data: { sources: Source[]; rules: RulesCollection; proxyRules: ProxyRule[]; workspacesConfig: WorkspacesConfig },
): Promise<number> {
  const saves: Promise<void>[] = [];
  if (dirty.sources) saves.push(saveSources(appDataPath, workspaceId, data.sources));
  if (dirty.rules) saves.push(saveRules(appDataPath, workspaceId, data.rules));
  if (dirty.proxyRules) saves.push(saveProxyRules(appDataPath, workspaceId, data.proxyRules));
  if (dirty.workspaces) saves.push(saveWorkspacesConfig(appDataPath, data.workspacesConfig));
  if (saves.length > 0) {
    await Promise.all(saves);
    log.debug(`Saved ${saves.length} data types`);
  }
  return saves.length;
}

// ── Environments (environments.json) ──────────────────────────────

export async function loadEnvironments(appDataPath: string, workspaceId: string): Promise<EnvironmentsFile> {
  const envPath = path.join(workspaceDir(appDataPath, workspaceId), 'environments.json');
  try {
    const data = await atomicWriter.readJson<EnvironmentsFile>(envPath);
    if (data?.environments && Object.keys(data.environments).length > 0) {
      return {
        environments: data.environments,
        activeEnvironment: data.activeEnvironment || 'Default',
      };
    }
  } catch (_e) {
    /* fall through */
  }

  return { environments: { Default: {} }, activeEnvironment: 'Default' };
}

export async function saveEnvironments(
  appDataPath: string,
  workspaceId: string,
  data: EnvironmentsFile,
): Promise<void> {
  const envPath = path.join(workspaceDir(appDataPath, workspaceId), 'environments.json');
  await atomicWriter.writeJson(envPath, data, { pretty: true });
}

// ── v5-aware loading ─────────────────────────────────────────────

/**
 * Load workspace data, preferring v5 format if available.
 *
 * When a v5/ subdirectory exists (created by MigrationRunner), reads from
 * the v5 directory tree and converts back to v4 shapes. Falls back to the
 * original v4 flat files if no v5 data exists.
 *
 * This allows the existing renderer to work with migrated v5 data
 * without any changes to the renderer code.
 */
export async function loadWorkspaceDataV5Aware(
  appDataPath: string,
  workspaceId: string,
): Promise<{
  sources: Source[];
  rules: RulesCollection;
  proxyRules: ProxyRule[];
  environments: EnvironmentsFile;
  loadedFromV5: boolean;
} | null> {
  const wsDir = workspaceDir(appDataPath, workspaceId);
  const v5Root = path.join(wsDir, 'v5');

  if (await isV5Workspace(v5Root)) {
    try {
      log.info(`Loading workspace ${workspaceId} from v5 format`);

      const [collections, v5Rules, v5Environments, vault] = await Promise.all([
        readAllCollections(v5Root),
        readAllRules(v5Root),
        readAllEnvironments(v5Root),
        readVault(v5Root),
      ]);

      // Apply vault secrets to environment variables (vault has highest priority)
      for (const env of v5Environments) {
        for (const secret of vault.secrets) {
          const existing = env.variables.find((v) => v.name === secret.name);
          if (existing) {
            existing.value = secret.value;
          }
        }
      }

      // Mark active environment
      // For now, mark the first (or 'Default') as active
      const defaultEnv = v5Environments.find((e) => e.name === 'Default') ?? v5Environments[0];
      if (defaultEnv) defaultEnv.isActive = true;

      const v4Shape = convertV5toV4(collections, v5Rules, v5Environments);

      return {
        sources: v4Shape.sources,
        rules: v4Shape.rules,
        proxyRules: v4Shape.proxyRules,
        environments: {
          environments: v4Shape.environments,
          activeEnvironment: v4Shape.activeEnvironment,
        },
        loadedFromV5: true,
      };
    } catch (err) {
      log.warn(`Failed to load v5 data for workspace ${workspaceId}, falling back to v4:`, err);
    }
  }

  // Fall back to v4
  const [sources, rules, proxyRules, environments] = await Promise.all([
    loadSources(appDataPath, workspaceId),
    loadRules(appDataPath, workspaceId),
    loadProxyRules(appDataPath, workspaceId),
    loadEnvironments(appDataPath, workspaceId),
  ]);

  return { sources, rules, proxyRules, environments, loadedFromV5: false };
}

// ── Helpers ──────────────────────────────────────────────────────

async function loadJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const data = await atomicWriter.readJson<T>(filePath);
    return data ?? fallback;
  } catch (_e) {
    return fallback;
  }
}
