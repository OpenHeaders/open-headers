/**
 * StatePersistence — workspace registry management.
 *
 * Handles the app-level workspaces.json config (which workspaces exist,
 * which is active). Individual workspace data is read/written by
 * V5StorageService using the YAML workspace format.
 */

import path from 'node:path';
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
        metadata: { version: '1', sourceCount: 0, ruleCount: 0, proxyRuleCount: 0 },
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

export function workspaceDir(appDataPath: string, workspaceId: string): string {
  return path.join(appDataPath, 'workspaces', workspaceId);
}
