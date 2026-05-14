/**
 * Live-tracked active workspace id for renderer surfaces that don't
 * mount {@link RuleProvider} (devpanel popovers, awareness ribbon).
 *
 * Bootstraps from `popupOpen`, then follows `workspaceChanged`
 * broadcasts. Returns `null` until the first reply lands so callers
 * can short-circuit writes while the workspace is unknown.
 */

import { call, subscribe } from '@utils/bridge';
import { useEffect, useState } from 'react';

export function useActiveWorkspaceId(): string | null {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    call('popupOpen')
      .then((resp) => {
        if (cancelled) return;
        setWorkspaceId(resp.activeWorkspaceId ?? null);
      })
      .catch(() => undefined);

    const unsub = subscribe('workspaceChanged', (payload) => {
      if (cancelled) return;
      setWorkspaceId(payload.activeWorkspaceId ?? null);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return workspaceId;
}
