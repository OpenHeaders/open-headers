import { useEffect, useMemo, useState } from 'react';
import {
  getCentralizedWorkspaceService,
  type WorkspaceServiceState,
} from '@/renderer/services/CentralizedWorkspaceService';

// Re-export hooks from workspace module
export {
  useCollections,
  useHeaderRules,
  useSources,
  useWorkspaces,
  useWorkspaceVariables,
} from './workspace';

// Re-export environment hook
export { useEnvironments } from './useCentralizedEnvironments';

/**
 * Main hook for accessing all workspace functionality
 */
export function useCentralizedWorkspace() {
  const service = useMemo(() => getCentralizedWorkspaceService(), []);
  const [state, setState] = useState(service.getState());

  useEffect(() => {
    // Hydrate from main process on first mount
    if (!service.getState().initialized) {
      service.initialize().catch((e) => {
        console.error('Failed to initialize workspace service:', e);
      });
    }

    const unsubscribe = service.subscribe((newState: WorkspaceServiceState) => {
      setState(newState);
    });
    return () => {
      unsubscribe();
    };
  }, [service]);

  return {
    ...state,
    service,
    isReady: state.initialized && !state.loading,
  };
}
