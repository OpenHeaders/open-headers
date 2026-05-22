/**
 * useIdentitySnapshot — live-tracked identity snapshot for renderer
 * surfaces (popup / sidepanel / workbench).
 *
 * The synthetic identity rows are written to host storage by the host's
 * boot path (the extension SW's `ensureSyntheticIdentity` cycle); the
 * registry's in-memory mirror is per-context, so a renderer surface
 * hydrates its own copy via `refreshIdentitySnapshotFromHostStorage`
 * and re-hydrates whenever a persisted identity slot changes —
 * `OH.syntheticIdentity` (home-org rename / identity promotion) or
 * `OH.joinedOrgs` (a daemon-join adding a real Org).
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
    // Re-hydrate on either identity slot. Subscribing to only
    // `OH.syntheticIdentity` left a long-lived surface (a workbench tab
    // open across a daemon-join) showing a stale single-Org catalogue —
    // the join appends to `OH.joinedOrgs`, never touching the former.
    const storage = getHostStorage();
    const unsubscribers = [
      storage?.subscribe(OH.syntheticIdentity, hydrate),
      storage?.subscribe(OH.joinedOrgs, hydrate),
    ];
    return () => {
      cancelled = true;
      for (const unsubscribe of unsubscribers) unsubscribe?.();
    };
  }, []);

  return snapshot;
}
