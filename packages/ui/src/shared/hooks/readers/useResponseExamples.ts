/**
 * useResponseExamples — live example list for one request.
 *
 * Subscribes to the per-workspace response-example sync mirror directly
 * (no context provider stack — same posture as `useScriptPackages`).
 * Returns capture order (oldest first), matching the sidebar's
 * child-node ordering under the request.
 */

import type { ResponseExample } from '@openheaders/core/types';
import { useEffect, useState } from 'react';
import { getResponseExampleSyncMirrorForWorkspace } from '../../../context/mirrors/response-example-sync-mirror';

export function useResponseExamples(workspaceId: string | null, requestUid: string | null): ResponseExample[] {
  const [examples, setExamples] = useState<ResponseExample[]>([]);
  useEffect(() => {
    if (!workspaceId || !requestUid) {
      setExamples([]);
      return;
    }
    const mirror = getResponseExampleSyncMirrorForWorkspace(workspaceId);
    let alive = true;
    const refresh = () => {
      if (alive) setExamples(mirror.listResponseExamplesForRequest(requestUid));
    };
    void mirror.hydrated.then(refresh);
    const unsubscribe = mirror.subscribeAny(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [workspaceId, requestUid]);
  return examples;
}
