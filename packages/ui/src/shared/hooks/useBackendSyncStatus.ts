/**
 * useBackendSyncStatus — mirrors the SW's per-backend `sync` slots into
 * the renderer, the same idiom as `useStatus`: one bridge RPC at mount
 * plus a `backendSyncStatusUpdated` subscription, no polling. Keys are
 * `OH.backends` record ids; a torn-down backend's slot is absent.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { BackendSyncStatusSnapshot } from '@openheaders/core/types';
import { useEffect, useState } from 'react';

export interface UseBackendSyncStatusApi {
  snapshot: BackendSyncStatusSnapshot;
  isReady: boolean;
}

export function useBackendSyncStatus(): UseBackendSyncStatusApi {
  const [snapshot, setSnapshot] = useState<BackendSyncStatusSnapshot>({});
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void hostBridge
      .call('getBackendSyncStatusSnapshot')
      .catch(() => null)
      .then((resp) => {
        if (cancelled) return;
        if (resp?.snapshot) setSnapshot(resp.snapshot);
        setIsReady(true);
      });

    const unsub = hostBridge.subscribe('backendSyncStatusUpdated', (payload) => {
      setSnapshot(payload);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { snapshot, isReady };
}
