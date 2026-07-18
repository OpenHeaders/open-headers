/**
 * useWsResponseExamples — live WebSocket example lists, the
 * `useGrpcResponseExamples` sibling for the WebSocketRequest family.
 * Subscribes to the per-workspace WebSocket response-example sync
 * mirror directly (no context provider stack); groups return capture
 * order (oldest first), matching the sidebar's child-node ordering
 * under the request.
 */

import type { WsResponseExample } from '@openheaders/core/types';
import { useEffect, useState } from 'react';
import { getWsResponseExampleSyncMirrorForWorkspace } from '../../../context/mirrors/ws-response-example-sync-mirror';

const EMPTY_EXAMPLES: readonly WsResponseExample[] = [];

/**
 * Every WebSocket example in the workspace, live. Feeds workspace-wide
 * projections (tab display labels) that resolve examples by uid.
 */
export function useAllWsResponseExamples(workspaceId: string | null): readonly WsResponseExample[] {
  const [examples, setExamples] = useState<readonly WsResponseExample[]>(EMPTY_EXAMPLES);
  useEffect(() => {
    if (!workspaceId) {
      setExamples(EMPTY_EXAMPLES);
      return;
    }
    const mirror = getWsResponseExampleSyncMirrorForWorkspace(workspaceId);
    let alive = true;
    const refresh = () => {
      if (alive) setExamples(mirror.listWsResponseExamples());
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
 * One WebSocket example by uid, live. `hydrated` distinguishes "still
 * loading the snapshot" from "the example is gone" so the viewer tab
 * can show a loading state before falling to its not-found empty state.
 */
export function useWsResponseExample(
  workspaceId: string | null,
  exampleUid: string | null,
): { example: WsResponseExample | null; hydrated: boolean } {
  const [state, setState] = useState<{ example: WsResponseExample | null; hydrated: boolean }>({
    example: null,
    hydrated: false,
  });
  useEffect(() => {
    if (!workspaceId || !exampleUid) {
      setState({ example: null, hydrated: true });
      return;
    }
    const mirror = getWsResponseExampleSyncMirrorForWorkspace(workspaceId);
    let alive = true;
    const refresh = () => {
      if (!alive) return;
      setState({
        example: mirror.getWsResponseExampleMirror(exampleUid)?.wsResponseExample ?? null,
        hydrated: true,
      });
    };
    void mirror.hydrated.then(refresh);
    const unsubscribe = mirror.subscribeWsResponseExampleMirror(exampleUid, refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [workspaceId, exampleUid]);
  return state;
}

const EMPTY_BY_REQUEST: ReadonlyMap<string, WsResponseExample[]> = new Map();

/**
 * All WebSocket examples in the workspace grouped by parent request,
 * each group in capture order (oldest first) — feeds the sidebar's
 * per-request child nodes without one subscription per request row.
 */
export function useWsResponseExamplesByRequest(workspaceId: string | null): ReadonlyMap<string, WsResponseExample[]> {
  const [byRequest, setByRequest] = useState<ReadonlyMap<string, WsResponseExample[]>>(EMPTY_BY_REQUEST);
  useEffect(() => {
    if (!workspaceId) {
      setByRequest(EMPTY_BY_REQUEST);
      return;
    }
    const mirror = getWsResponseExampleSyncMirrorForWorkspace(workspaceId);
    let alive = true;
    const refresh = () => {
      if (!alive) return;
      const next = new Map<string, WsResponseExample[]>();
      for (const example of mirror.listWsResponseExamples()) {
        const group = next.get(example.websocketRequestUid);
        if (group) group.push(example);
        else next.set(example.websocketRequestUid, [example]);
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
