import type { V5 } from '@openheaders/core/types';
import { useCallback } from 'react';
import { showMessage } from '@/renderer/utils';
import { useCentralizedWorkspace } from './useCentralizedWorkspace';

interface UseEnvironmentsReturn {
  environments: V5.Environment[];
  activeEnvironment: string | null;
  loading: boolean;
  environmentsReady: boolean;
  createEnvironment: (params: { name: string }) => Promise<V5.Environment | null>;
  deleteEnvironment: (name: string) => Promise<boolean>;
  switchEnvironment: (name: string | null) => Promise<boolean>;
  setVariable: (envName: string, varName: string, value: string, type: 'default' | 'secret') => Promise<boolean>;
  updateEnvironment: (name: string, updates: Partial<V5.Environment>) => Promise<boolean>;
}

/**
 * Hook for environment management — reads from workspace state,
 * mutations go through main process via IPC.
 */
export function useCentralizedEnvironments(): UseEnvironmentsReturn {
  const { environments, activeEnvironmentName, loading, isReady, service } = useCentralizedWorkspace();

  const createEnvironment = useCallback(
    async (params: { name: string }): Promise<V5.Environment | null> => {
      try {
        return await service.createEnvironment(params.name);
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return null;
      }
    },
    [service],
  );

  const deleteEnvironment = useCallback(
    async (name: string): Promise<boolean> => {
      try {
        await service.deleteEnvironment(name);
        showMessage('success', `Environment '${name}' deleted`);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  const switchEnvironment = useCallback(
    async (name: string | null): Promise<boolean> => {
      try {
        await service.switchEnvironment(name);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  const setVariable = useCallback(
    async (envName: string, varName: string, value: string, type: 'default' | 'secret'): Promise<boolean> => {
      try {
        await service.setVariable(envName, varName, value, type);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  const updateEnvironment = useCallback(
    async (name: string, updates: Partial<V5.Environment>): Promise<boolean> => {
      try {
        await service.updateEnvironment(name, {
          name: updates.name,
          variables: updates.variables,
        });
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  return {
    environments,
    activeEnvironment: activeEnvironmentName,
    loading,
    environmentsReady: isReady,
    createEnvironment,
    deleteEnvironment,
    switchEnvironment,
    setVariable,
    updateEnvironment,
  };
}

export const useEnvironments = useCentralizedEnvironments;
