/**
 * useOrgBindingPrefs — live-tracked per-user org-binding preferences
 * (UNIFIED_ORACLE_MODEL.md §6.2 / U3.6).
 *
 * Backs the two-personal-Orgs onboarding: `onboardingAcknowledgedAt`
 * gates whether the onboarding modal surfaces, `defaultNewWorkspaceOrgId`
 * is the Org newly-created workspaces bind to. Persisted in the global
 * `OH.orgBindingPrefs` slot; every surface that mounts this hook stays
 * in sync via the host-storage change subscription.
 */

import { getHostStorage, OH, type OrgBindingPrefs } from '@openheaders/core/storage';
import { useCallback, useEffect, useState } from 'react';

const EMPTY_PREFS: OrgBindingPrefs = {
  onboardingAcknowledgedAt: null,
  defaultNewWorkspaceOrgId: null,
};

export interface UseOrgBindingPrefsApi {
  prefs: OrgBindingPrefs;
  isReady: boolean;
  /** Stamp the two-personal-Orgs onboarding as seen, optionally setting the default Org. */
  acknowledgeOnboarding: (defaultNewWorkspaceOrgId: string | null) => Promise<void>;
  /** Update only the default-Org-for-new-workspaces preference. */
  setDefaultNewWorkspaceOrgId: (orgId: string | null) => Promise<void>;
}

export function useOrgBindingPrefs(): UseOrgBindingPrefsApi {
  const [prefs, setPrefs] = useState<OrgBindingPrefs>(EMPTY_PREFS);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const storage = getHostStorage();
    const apply = (next: OrgBindingPrefs | undefined): void => {
      if (cancelled) return;
      setPrefs(next ?? EMPTY_PREFS);
      setIsReady(true);
    };
    storage
      ?.get(OH.orgBindingPrefs)
      .then(apply)
      .catch(() => {
        if (!cancelled) setIsReady(true);
      });
    const unsubscribe = storage?.subscribe(OH.orgBindingPrefs, apply);
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const write = useCallback(async (next: OrgBindingPrefs): Promise<void> => {
    await getHostStorage()?.set(OH.orgBindingPrefs, next);
  }, []);

  const acknowledgeOnboarding = useCallback(
    async (defaultNewWorkspaceOrgId: string | null): Promise<void> => {
      await write({ onboardingAcknowledgedAt: new Date().toISOString(), defaultNewWorkspaceOrgId });
    },
    [write],
  );

  const setDefaultNewWorkspaceOrgId = useCallback(
    async (orgId: string | null): Promise<void> => {
      await write({ ...prefs, defaultNewWorkspaceOrgId: orgId });
    },
    [write, prefs],
  );

  return { prefs, isReady, acknowledgeOnboarding, setDefaultNewWorkspaceOrgId };
}
