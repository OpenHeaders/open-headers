/**
 * useIdentitySnapshot — live-tracked identity snapshot for renderer
 * surfaces (popup / sidepanel / workbench).
 *
 * The synthetic identity rows are written to host storage by the host's
 * boot path (the extension SW's `ensureSyntheticIdentity` cycle); the
 * registry's in-memory mirror is per-context, so a renderer surface
 * hydrates its own copy via `refreshIdentitySnapshotFromHostStorage`
 * and re-hydrates whenever the persisted `OH.syntheticIdentity` slot
 * changes (e.g. identity promotion, a daemon-join adding a real Org).
 *
 * Returns `null` until the first hydration completes — callers render
 * an org-agnostic fallback in that window.
 */

import {
  getIdentitySnapshot,
  type IdentitySnapshot,
  refreshIdentitySnapshotFromHostStorage,
} from '@openheaders/core/identity';
import { getHostStorage, OH } from '@openheaders/core/storage';
import { useEffect, useState } from 'react';

export function useIdentitySnapshot(): IdentitySnapshot | null {
  const [snapshot, setSnapshot] = useState<IdentitySnapshot | null>(() => getIdentitySnapshot());

  useEffect(() => {
    let cancelled = false;
    const hydrate = (): void => {
      refreshIdentitySnapshotFromHostStorage()
        .then((next) => {
          if (!cancelled) setSnapshot(next);
        })
        .catch(() => {
          /* host storage not wired yet — stay on the prior snapshot */
        });
    };
    hydrate();
    const unsubscribe = getHostStorage()?.subscribe(OH.syntheticIdentity, hydrate);
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return snapshot;
}
