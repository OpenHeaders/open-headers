import type { V5 } from '@openheaders/core/types';
import { useCallback } from 'react';
import { useCentralizedWorkspace } from '@/renderer/hooks/useCentralizedWorkspace';
import { showMessage } from '@/renderer/utils';

interface UseWorkspaceVariablesReturn {
  workspaceVariables: V5.WorkspaceVariables;
  updateWorkspaceVariables: (variables: V5.WorkspaceVariables) => Promise<boolean>;
}

export function useWorkspaceVariables(): UseWorkspaceVariablesReturn {
  const { workspaceVariables, service } = useCentralizedWorkspace();

  const updateWorkspaceVariables = useCallback(
    async (variables: V5.WorkspaceVariables): Promise<boolean> => {
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
