/**
 * useBackendReach — live-tracked reach tier of the connected backend.
 *
 * The extension SW writes `OH.backendReach` from each handshake WELCOME
 * and clears it on disconnect (and at SW init); this hook mirrors that
 * slot so reach-aware surfaces — the workspace dropdown's "extend your
 * reach" footer — react without their own bridge plumbing. Same
 * host-storage subscription shape as {@link useIdentitySnapshot}.
 *
 * Returns `null` when no backend is connected, or before the first
 * hydration completes.
 */

import type { BackendReach } from '@openheaders/core/protocol';
import { getHostStorage, OH } from '@openheaders/core/storage';
import { useEffect, useState } from 'react';

export function useBackendReach(): BackendReach | null {
  const [reach, setReach] = useState<BackendReach | null>(null);

  useEffect(() => {
    const storage = getHostStorage();
    if (!storage) return;
    let cancelled = false;
    const hydrate = (): void => {
      void storage.get(OH.backendReach).then((value) => {
        if (!cancelled) setReach(value ?? null);
      });
    };
    hydrate();
    const unsubscribe = storage.subscribe(OH.backendReach, hydrate);
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return reach;
}
