/**
 * useBackendOrgConflicts — live mirror of `OH.backendOrgConflicts`, the
 * durable per-(backend, Org) refusal rows written by the handshake's
 * Org-uniqueness guard. The connections list renders each backend's
 * rows beneath its status line; a row disappears when the backend later
 * claims the Org successfully or its record is removed. Same
 * host-storage subscription shape as {@link useBackendReach}.
 */

import type { BackendOrgConflict } from '@openheaders/core/storage';
import { getHostStorage, OH } from '@openheaders/core/storage';
import { useEffect, useState } from 'react';

const EMPTY: readonly BackendOrgConflict[] = [];

export function useBackendOrgConflicts(): readonly BackendOrgConflict[] {
  const [conflicts, setConflicts] = useState<readonly BackendOrgConflict[]>(EMPTY);

  useEffect(() => {
    const storage = getHostStorage();
    if (!storage) return;
    let cancelled = false;
    const hydrate = (): void => {
      void storage.get(OH.backendOrgConflicts).then((value) => {
        if (!cancelled) setConflicts(value && value.length > 0 ? value : EMPTY);
      });
    };
    hydrate();
    const unsubscribe = storage.subscribe(OH.backendOrgConflicts, hydrate);
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return conflicts;
}
