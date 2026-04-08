import type { V5 } from '@openheaders/core/types';
import { useCentralizedWorkspace } from '@/renderer/hooks/useCentralizedWorkspace';

interface UseWorkspaceVariablesReturn {
  workspaceVariables: V5.WorkspaceVariables;
}

export function useWorkspaceVariables(): UseWorkspaceVariablesReturn {
  const { workspaceVariables } = useCentralizedWorkspace();
  return { workspaceVariables };
}
