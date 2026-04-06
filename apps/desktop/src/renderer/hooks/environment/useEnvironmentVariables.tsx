import type { EnvironmentVariable } from '@openheaders/core';
import { useCallback } from 'react';
import { createLogger } from '@/renderer/utils/error-handling/logger';
import { showMessage } from '@/renderer/utils/ui/messageUtil';
import { useEnvironmentCore } from './useEnvironmentCore';

const log = createLogger('useEnvironmentVariables');

interface UseEnvironmentVariablesReturn {
  setVariable: (
    name: string,
    value: string | null,
    environmentId?: string | null,
    isSensitive?: boolean,
  ) => Promise<boolean>;
  deleteVariable: (name: string, environmentId?: string | null) => Promise<boolean>;
  getVariable: (name: string, environmentId?: string | null) => string;
  getAllVariables: (environmentId?: string | null) => Record<string, string>;
  getAllVariablesWithMetadata: (environmentId?: string | null) => Record<string, EnvironmentVariable>;
}

/**
 * Hook for environment variable management
 */
export function useEnvironmentVariables(): UseEnvironmentVariablesReturn {
  const { service, activeEnvironment, environments, isReady } = useEnvironmentCore();

  const setVariable = useCallback(
    async (
      name: string,
      value: string | null,
      environmentId: string | null = null,
      isSensitive: boolean = false,
    ): Promise<boolean> => {
      try {
        const targetId = environmentId || activeEnvironment;
        if (!targetId) {
          showMessage('error', 'No environment selected');
          return false;
        }
        if (environmentId && environmentId !== activeEnvironment) {
          await service.setVariableInEnvironment(name, value, environmentId, isSensitive);
        } else {
          await service.setVariable(name, value, isSensitive);
        }
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service, activeEnvironment],
  );

  const deleteVariable = useCallback(
    async (name: string, environmentId: string | null = null): Promise<boolean> => {
      return setVariable(name, null, environmentId);
    },
    [setVariable],
  );

  const getVariable = useCallback(
    (name: string, environmentId: string | null = null): string => {
      const targetId = environmentId || activeEnvironment;
      if (!targetId) return '';
      const env = environments.find((e) => e.id === targetId);
      return env?.variables[name]?.value || '';
    },
    [environments, activeEnvironment],
  );

  const getAllVariables = useCallback(
    (environmentId: string | null = null): Record<string, string> => {
      const targetId = environmentId || activeEnvironment;

      // If service is not ready, use the service's getAllVariables which handles initialization
      if (!isReady) {
        log.debug('Service not ready, using service.getAllVariables()');
        return service.getAllVariables();
      }

      if (!targetId) return {};
      const env = environments.find((e) => e.id === targetId);
      if (!env) return {};

      const result: Record<string, string> = {};
      for (const [key, variable] of Object.entries(env.variables)) {
        result[key] = variable.value || '';
      }
      return result;
    },
    [environments, activeEnvironment, isReady, service],
  );

  const getAllVariablesWithMetadata = useCallback(
    (environmentId: string | null = null): Record<string, EnvironmentVariable> => {
      const targetId = environmentId || activeEnvironment;
      if (!targetId) return {};
      const env = environments.find((e) => e.id === targetId);
      if (!env) return {};

      const variables: Record<string, EnvironmentVariable> = {};
      for (const [key, data] of Object.entries(env.variables)) {
        if (data && typeof data === 'object' && 'value' in data) {
          variables[key] = data;
        }
      }
      return variables;
    },
    [environments, activeEnvironment],
  );

  return {
    setVariable,
    deleteVariable,
    getVariable,
    getAllVariables,
    getAllVariablesWithMetadata,
  };
}
