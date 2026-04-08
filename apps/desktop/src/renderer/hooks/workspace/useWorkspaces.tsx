import { useCallback } from 'react';
import { useCentralizedWorkspace } from '@/renderer/hooks/useCentralizedWorkspace';
import { createLogger } from '@/renderer/utils/error-handling/logger';
import { showMessage } from '@/renderer/utils/ui/messageUtil';
import type { Workspace, WorkspaceSyncStatus, WorkspaceType } from '@/types/workspace';

const log = createLogger('useWorkspaces');

interface UseWorkspacesReturn {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  syncStatus: Record<string, WorkspaceSyncStatus>;
  loading: boolean;
  createWorkspace: (name: string, type: WorkspaceType, options?: { description?: string; gitUrl?: string }) => Promise<Workspace | null>;
  switchWorkspace: (workspaceId: string) => Promise<boolean>;
  deleteWorkspace: (workspaceId: string) => Promise<boolean>;
  updateWorkspace: (workspaceId: string, updates: Partial<Workspace>) => Promise<boolean>;
  copyWorkspaceData: (sourceWorkspaceId: string, targetWorkspaceId: string) => Promise<boolean>;
}

/**
 * Hook for workspace management — all mutations go through main process via IPC.
 */
export function useWorkspaces(): UseWorkspacesReturn {
  const { workspaces, activeWorkspaceId, syncStatus, loading, service } = useCentralizedWorkspace();

  const createWorkspace = useCallback(
    async (name: string, type: WorkspaceType, options?: { description?: string; gitUrl?: string }): Promise<Workspace | null> => {
      try {
        const result = await service.createWorkspace(name, type, options);
        showMessage('success', `Workspace '${name}' created and activated`);
        return result;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return null;
      }
    },
    [service],
  );

  const switchWorkspace = useCallback(
    async (workspaceId: string): Promise<boolean> => {
      try {
        log.info(`Starting workspace switch to: ${workspaceId}`);
        await service.switchWorkspace(workspaceId);
        log.info('Workspace switch completed successfully');
        return true;
      } catch (error: unknown) {
        log.error('Workspace switch failed:', error);
        showMessage('error', `Failed to switch workspace: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    },
    [service],
  );

  const deleteWorkspace = useCallback(
    async (workspaceId: string): Promise<boolean> => {
      if (workspaceId === 'default-personal') {
        showMessage('error', 'Cannot delete default personal workspace');
        return false;
      }

      try {
        const result = await service.deleteWorkspace(workspaceId);
        if (result) {
          showMessage('success', 'Workspace deleted');
        }
        return result;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  const updateWorkspace = useCallback(
    async (workspaceId: string, updates: Partial<Workspace>): Promise<boolean> => {
      try {
        const result = await service.updateWorkspace(workspaceId, updates);
        if (result) {
          showMessage('success', 'Workspace updated');
        }
        return result;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  const copyWorkspaceData = useCallback(
    async (sourceWorkspaceId: string, targetWorkspaceId: string): Promise<boolean> => {
      try {
        await service.copyWorkspaceData(sourceWorkspaceId, targetWorkspaceId);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  return {
    workspaces,
    activeWorkspaceId,
    syncStatus,
    loading,
    createWorkspace,
    switchWorkspace,
    deleteWorkspace,
    updateWorkspace,
    copyWorkspaceData,
  };
}
