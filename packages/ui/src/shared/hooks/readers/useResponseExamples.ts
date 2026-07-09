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

const EMPTY_EXAMPLES: readonly ResponseExample[] = [];

/**
 * Every example in the workspace, live. Feeds workspace-wide
 * projections (tab display labels) that resolve examples by uid.
 */
export function useAllResponseExamples(workspaceId: string | null): readonly ResponseExample[] {
  const [examples, setExamples] = useState<readonly ResponseExample[]>(EMPTY_EXAMPLES);
  useEffect(() => {
    if (!workspaceId) {
      setExamples(EMPTY_EXAMPLES);
      return;
    }
    const mirror = getResponseExampleSyncMirrorForWorkspace(workspaceId);
    let alive = true;
    const refresh = () => {
      if (alive) setExamples(mirror.listResponseExamples());
    };
    void mirror.hydrated.then(refresh);
    const unsubscribe = mirror.subscribeAny(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [workspaceId]);
  return examples;
}

/**
 * One example by uid, live. `hydrated` distinguishes "still loading the
 * snapshot" from "the example is gone" so the viewer tab can show a
 * loading state before falling to its not-found empty state (same
 * contract as the request editor's summary lookup).
 */
export function useResponseExample(
  workspaceId: string | null,
  exampleUid: string | null,
): { example: ResponseExample | null; hydrated: boolean } {
  const [state, setState] = useState<{ example: ResponseExample | null; hydrated: boolean }>({
    example: null,
    hydrated: false,
  });
  useEffect(() => {
    if (!workspaceId || !exampleUid) {
      setState({ example: null, hydrated: true });
      return;
    }
    const mirror = getResponseExampleSyncMirrorForWorkspace(workspaceId);
    let alive = true;
    const refresh = () => {
      if (!alive) return;
      setState({ example: mirror.getResponseExampleMirror(exampleUid)?.responseExample ?? null, hydrated: true });
    };
    void mirror.hydrated.then(refresh);
    const unsubscribe = mirror.subscribeResponseExampleMirror(exampleUid, refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [workspaceId, exampleUid]);
  return state;
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
