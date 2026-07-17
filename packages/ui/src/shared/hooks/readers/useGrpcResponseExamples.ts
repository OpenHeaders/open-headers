/**
 * useGrpcResponseExamples — live gRPC example lists, the
 * `useResponseExamples` sibling for the GrpcRequest family. Subscribes
 * to the per-workspace gRPC response-example sync mirror directly (no
 * context provider stack); groups return capture order (oldest first),
 * matching the sidebar's child-node ordering under the request.
 */

import type { GrpcResponseExample } from '@openheaders/core/types';
import { useEffect, useState } from 'react';
import { getGrpcResponseExampleSyncMirrorForWorkspace } from '../../../context/mirrors/grpc-response-example-sync-mirror';

const EMPTY_EXAMPLES: readonly GrpcResponseExample[] = [];

/**
 * Every gRPC example in the workspace, live. Feeds workspace-wide
 * projections (tab display labels) that resolve examples by uid.
 */
export function useAllGrpcResponseExamples(workspaceId: string | null): readonly GrpcResponseExample[] {
  const [examples, setExamples] = useState<readonly GrpcResponseExample[]>(EMPTY_EXAMPLES);
  useEffect(() => {
    if (!workspaceId) {
      setExamples(EMPTY_EXAMPLES);
      return;
    }
    const mirror = getGrpcResponseExampleSyncMirrorForWorkspace(workspaceId);
    let alive = true;
    const refresh = () => {
      if (alive) setExamples(mirror.listGrpcResponseExamples());
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
 * One gRPC example by uid, live. `hydrated` distinguishes "still
 * loading the snapshot" from "the example is gone" so the viewer tab
 * can show a loading state before falling to its not-found empty state.
 */
export function useGrpcResponseExample(
  workspaceId: string | null,
  exampleUid: string | null,
): { example: GrpcResponseExample | null; hydrated: boolean } {
  const [state, setState] = useState<{ example: GrpcResponseExample | null; hydrated: boolean }>({
    example: null,
    hydrated: false,
  });
  useEffect(() => {
    if (!workspaceId || !exampleUid) {
      setState({ example: null, hydrated: true });
      return;
    }
    const mirror = getGrpcResponseExampleSyncMirrorForWorkspace(workspaceId);
    let alive = true;
    const refresh = () => {
      if (!alive) return;
      setState({
        example: mirror.getGrpcResponseExampleMirror(exampleUid)?.grpcResponseExample ?? null,
        hydrated: true,
      });
    };
    void mirror.hydrated.then(refresh);
    const unsubscribe = mirror.subscribeGrpcResponseExampleMirror(exampleUid, refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [workspaceId, exampleUid]);
  return state;
}

const EMPTY_BY_REQUEST: ReadonlyMap<string, GrpcResponseExample[]> = new Map();

/**
 * All gRPC examples in the workspace grouped by parent request, each
 * group in capture order (oldest first) — feeds the sidebar's
 * per-request child nodes without one subscription per request row.
 */
export function useGrpcResponseExamplesByRequest(
  workspaceId: string | null,
): ReadonlyMap<string, GrpcResponseExample[]> {
  const [byRequest, setByRequest] = useState<ReadonlyMap<string, GrpcResponseExample[]>>(EMPTY_BY_REQUEST);
  useEffect(() => {
    if (!workspaceId) {
      setByRequest(EMPTY_BY_REQUEST);
      return;
    }
    const mirror = getGrpcResponseExampleSyncMirrorForWorkspace(workspaceId);
    let alive = true;
    const refresh = () => {
      if (!alive) return;
      const next = new Map<string, GrpcResponseExample[]>();
      for (const example of mirror.listGrpcResponseExamples()) {
        const group = next.get(example.grpcRequestUid);
        if (group) group.push(example);
        else next.set(example.grpcRequestUid, [example]);
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
