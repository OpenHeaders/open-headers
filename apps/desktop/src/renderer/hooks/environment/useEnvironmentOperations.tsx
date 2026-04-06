import type { Environment, EnvironmentVariable } from '@openheaders/core';
import { useCallback } from 'react';
import { createLogger } from '@/renderer/utils/error-handling/logger';
import { showMessage } from '@/renderer/utils/ui/messageUtil';
import { useEnvironmentCore } from './useEnvironmentCore';

const log = createLogger('useEnvironmentOperations');

interface UseEnvironmentOperationsReturn {
  environments: Environment[];
  activeEnvironment: string | null;
  createEnvironment: (params: {
    name: string;
    collectionId?: string;
    folderId?: string;
  }) => Promise<Environment | null>;
  updateEnvironment: (
    environmentId: string,
    updates: { name?: string; variables?: Record<string, EnvironmentVariable> },
  ) => Promise<boolean>;
  deleteEnvironment: (environmentId: string) => Promise<boolean>;
  switchEnvironment: (environmentId: string | null) => Promise<boolean>;
  cloneEnvironment: (sourceEnvId: string, newName: string) => Promise<boolean>;
  waitForEnvironments: (timeout?: number) => Promise<boolean>;
}

/**
 * Hook for environment CRUD operations
 */
export function useEnvironmentOperations(): UseEnvironmentOperationsReturn {
  const { service, environments, activeEnvironment } = useEnvironmentCore();

  const createEnvironment = useCallback(
    async (params: { name: string; collectionId?: string; folderId?: string }): Promise<Environment | null> => {
      try {
        const env = await service.createEnvironment(params);
        return env;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return null;
      }
    },
    [service],
  );

  const updateEnvironment = useCallback(
    async (
      environmentId: string,
      updates: { name?: string; variables?: Record<string, EnvironmentVariable> },
    ): Promise<boolean> => {
      try {
        await service.updateEnvironment(environmentId, updates);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  const deleteEnvironment = useCallback(
    async (environmentId: string): Promise<boolean> => {
      try {
        await service.deleteEnvironment(environmentId);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  const switchEnvironment = useCallback(
    async (environmentId: string | null): Promise<boolean> => {
      try {
        await service.switchEnvironment(environmentId);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  const cloneEnvironment = useCallback(
    async (sourceEnvId: string, newName: string): Promise<boolean> => {
      try {
        const sourceEnv = environments.find((e) => e.id === sourceEnvId);
        if (!sourceEnv) {
          showMessage('error', 'Source environment does not exist');
          return false;
        }

        const newEnv = await service.createEnvironment({
          name: newName,
          collectionId: sourceEnv.collectionId,
          folderId: sourceEnv.folderId,
        });

        // Batch copy all variables (single save + single IPC event)
        const variablesToSet = Object.entries(sourceEnv.variables).map(([varName, variable]) => ({
          name: varName,
          value: variable.value ?? null,
          isSensitive: variable.isSensitive,
        }));

        if (variablesToSet.length > 0) {
          await service.batchSetVariablesInEnvironment(newEnv.id, variablesToSet);
        }

        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service, environments],
  );

  const waitForEnvironments = useCallback(
    async (timeout: number = 5000): Promise<boolean> => {
      try {
        return await service.waitForReady(timeout);
      } catch (error) {
        log.error('Failed to wait for environments:', error);
        return false;
      }
    },
    [service],
  );

  return {
    environments,
    activeEnvironment,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    switchEnvironment,
    cloneEnvironment,
    waitForEnvironments,
  };
}
