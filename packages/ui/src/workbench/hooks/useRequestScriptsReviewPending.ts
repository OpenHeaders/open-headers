import { useEffect, useMemo, useState } from 'react';
import { hostStorage, wsKeys } from '@openheaders/core/storage';
import { hostBridge } from '@openheaders/core/bridge';

/**
 * Subscribe to the active workspace's
 * `oh.ws.<id>.requestScriptsReviewPending` storage key. Returned set
 * is the live mirror of imported request uids whose scripts the user
 * hasn't reviewed in the inspector yet — the sidebar uses it to render
 * a "scripts" badge on each row that survives until the inspector
 * opens. Re-subscribes on workspace switch so a stale set from the
 * outgoing workspace never leaks into the incoming UI.
 */
export function useRequestScriptsReviewPending(activeWorkspaceId: string | null): ReadonlySet<string> {
  const [uids, setUids] = useState<readonly string[]>([]);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setUids([]);
      return;
    }
    let cancelled = false;
    void hostBridge.call('getRequestScriptsReviewPending').then((res) => {
      if (!cancelled) setUids(res.uids);
    });
    const dispose = hostStorage.subscribe(wsKeys(activeWorkspaceId).requestScriptsReviewPending, (next) => {
      setUids(Array.isArray(next) ? next : []);
    });
    return () => {
      cancelled = true;
      dispose();
    };
  }, [activeWorkspaceId]);

  return useMemo(() => new Set(uids), [uids]);
}
