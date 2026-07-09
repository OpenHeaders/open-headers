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

const EMPTY_BY_REQUEST: ReadonlyMap<string, ResponseExample[]> = new Map();

/**
 * All examples in the workspace grouped by parent request, each group in
 * capture order (oldest first) — feeds the sidebar's per-request child
 * nodes without one subscription per request row.
 */
export function useResponseExamplesByRequest(workspaceId: string | null): ReadonlyMap<string, ResponseExample[]> {
  const [byRequest, setByRequest] = useState<ReadonlyMap<string, ResponseExample[]>>(EMPTY_BY_REQUEST);
  useEffect(() => {
    if (!workspaceId) {
      setByRequest(EMPTY_BY_REQUEST);
      return;
    }
    const mirror = getResponseExampleSyncMirrorForWorkspace(workspaceId);
    let alive = true;
    const refresh = () => {
      if (!alive) return;
      const next = new Map<string, ResponseExample[]>();
      for (const example of mirror.listResponseExamples()) {
        const group = next.get(example.requestUid);
        if (group) group.push(example);
        else next.set(example.requestUid, [example]);
      }
      for (const group of next.values()) group.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
      setByRequest(next);
    };
    void mirror.hydrated.then(refresh);
    const unsubscribe = mirror.subscribeAny(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [workspaceId]);
  return byRequest;
}
