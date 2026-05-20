/**
 * useActiveOrg — live-tracked active-Org pointer (Phase U5.9, the org
 * switcher).
 *
 * Org is the top-level container; this hook owns the persisted "which
 * Org am I working in?" selector (`OH.activeOrgId`). It returns the
 * *resolved* active-Org id — the stored value when it still names an
 * authorized Org, otherwise the home-org — so consumers never have to
 * guard against a stale joined-Org id themselves.
 *
 * Orthogonal to the active workspace: switching Org only re-scopes the
 * workspace list; it does not change which workspace's rules apply.
 */

import { type IdentitySnapshot, resolveActiveOrgId, setActiveOrgId } from '@openheaders/core/identity';
import { getHostStorage, OH } from '@openheaders/core/storage';
import { useCallback, useEffect, useState } from 'react';

export interface UseActiveOrgApi {
  /** Resolved active-Org id; `null` until identity hydrates. */
  activeOrgId: string | null;
  isReady: boolean;
  /** Persist a new active Org. */
  setActiveOrg: (orgId: string) => Promise<void>;
}

export function useActiveOrg(snapshot: IdentitySnapshot | null): UseActiveOrgApi {
  const [stored, setStored] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const storage = getHostStorage();
    const apply = (next: string | undefined): void => {
      if (cancelled) return;
      setStored(next ?? null);
      setIsReady(true);
    };
    storage
      ?.get(OH.activeOrgId)
      .then(apply)
      .catch(() => {
        if (!cancelled) setIsReady(true);
      });
    const unsubscribe = storage?.subscribe(OH.activeOrgId, apply);
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const setActiveOrg = useCallback(async (orgId: string): Promise<void> => {
    await setActiveOrgId(orgId);
  }, []);

  return { activeOrgId: resolveActiveOrgId(snapshot, stored), isReady, setActiveOrg };
}
