import type { EnvironmentVariable } from '@openheaders/core';
import { useCallback } from 'react';
import { useCentralizedWorkspace } from '@/renderer/hooks/useCentralizedWorkspace';
import { showMessage } from '@/renderer/utils';

interface UseWorkspaceVariablesReturn {
  workspaceVariables: Record<string, EnvironmentVariable>;
  updateWorkspaceVariables: (variables: Record<string, EnvironmentVariable>) => Promise<boolean>;
}

export function useWorkspaceVariables(): UseWorkspaceVariablesReturn {
  const { workspaceVariables, service } = useCentralizedWorkspace();

  const updateWorkspaceVariables = useCallback(
    async (variables: Record<string, EnvironmentVariable>): Promise<boolean> => {
      try {
        await service.updateWorkspaceVariables(variables);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  return { workspaceVariables, updateWorkspaceVariables };
}
