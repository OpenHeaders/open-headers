/**
 * useBackendIdentityChanges — live mirror of `OH.backendIdentityChanges`,
 * the durable per-record rows the handshake writes when the host behind
 * a connection record announces a different Org than the one it was
 * bound to. The connections list renders each backend's row beneath its
 * status line: a pending change with the accept action, a replaced one
 * with its dismissal. Same host-storage subscription shape as
 * {@link useBackendOrgConflicts}.
 */

import type { BackendIdentityChange } from '@openheaders/core/storage';
import { getHostStorage, OH } from '@openheaders/core/storage';
import { useEffect, useState } from 'react';

const EMPTY: readonly BackendIdentityChange[] = [];

export function useBackendIdentityChanges(): readonly BackendIdentityChange[] {
  const [changes, setChanges] = useState<readonly BackendIdentityChange[]>(EMPTY);

  useEffect(() => {
    const storage = getHostStorage();
    if (!storage) return;
    let cancelled = false;
    const hydrate = (): void => {
      void storage.get(OH.backendIdentityChanges).then((value) => {
        if (!cancelled) setChanges(value && value.length > 0 ? value : EMPTY);
      });
    };
    hydrate();
    const unsubscribe = storage.subscribe(OH.backendIdentityChanges, hydrate);
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return changes;
}
