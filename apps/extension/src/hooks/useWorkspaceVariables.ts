/**
 * useWorkspaceVariables — interim slice hook.
 *
 * Reads workspace variables via the legacy `getWorkspaceVariables` RPC
 * + `environmentsChanged` broadcast. Session #2 of the MWPT-FULL epic
 * replaces this with a `WorkspaceVariablesProvider` mirroring
 * `EnvironmentProvider` (per-workspace storage subscribe + Phase B
 * write-client). Until then this hook follows the global default.
 */

import type { V5 } from '@openheaders/core/types';
import { call, subscribe } from '@utils/bridge';
import { useEffect, useState } from 'react';

const EMPTY_WS_VARS: V5.WorkspaceVariables = { schemaVersion: 5, variables: [] };

export interface UseWorkspaceVariablesApi {
  workspaceVariables: V5.WorkspaceVariables;
  isReady: boolean;
}

export function useWorkspaceVariables(): UseWorkspaceVariablesApi {
  const [workspaceVariables, setWorkspaceVariables] = useState<V5.WorkspaceVariables>(EMPTY_WS_VARS);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const reload = () =>
      call('getWorkspaceVariables')
        .then((resp) => {
          if (cancelled) return;
          setWorkspaceVariables(resp.workspaceVariables);
          setIsReady(true);
        })
        .catch(() => {
          if (cancelled) return;
          setIsReady(true);
        });

    void reload();

    const unsub = subscribe('environmentsChanged', (payload) => {
      setWorkspaceVariables(payload.workspaceVariables);
    });
    const unsubWs = subscribe('workspaceChanged', () => {
      void reload();
    });

    return () => {
      cancelled = true;
      unsub();
      unsubWs();
    };
  }, []);

  return { workspaceVariables, isReady };
}
