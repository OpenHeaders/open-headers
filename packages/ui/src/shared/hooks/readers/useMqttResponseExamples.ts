/**
 * useMqttResponseExamples — live MQTT example lists, the
 * `useWsResponseExamples` sibling for the MqttRequest family.
 * Subscribes to the per-workspace MQTT response-example sync mirror
 * directly (no context provider stack); groups return capture order
 * (oldest first), matching the sidebar's child-node ordering under the
 * request.
 */

import type { MqttResponseExample } from '@openheaders/core/types';
import { useEffect, useState } from 'react';
import { getMqttResponseExampleSyncMirrorForWorkspace } from '../../../context/mirrors/mqtt-response-example-sync-mirror';

const EMPTY_EXAMPLES: readonly MqttResponseExample[] = [];

/**
 * Every MQTT example in the workspace, live. Feeds workspace-wide
 * projections (tab display labels) that resolve examples by uid.
 */
export function useAllMqttResponseExamples(workspaceId: string | null): readonly MqttResponseExample[] {
  const [examples, setExamples] = useState<readonly MqttResponseExample[]>(EMPTY_EXAMPLES);
  useEffect(() => {
    if (!workspaceId) {
      setExamples(EMPTY_EXAMPLES);
      return;
    }
    const mirror = getMqttResponseExampleSyncMirrorForWorkspace(workspaceId);
    let alive = true;
    const refresh = () => {
      if (alive) setExamples(mirror.listMqttResponseExamples());
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
 * One MQTT example by uid, live. `hydrated` distinguishes "still
 * loading the snapshot" from "the example is gone" so the viewer tab
 * can show a loading state before falling to its not-found empty state.
 */
export function useMqttResponseExample(
  workspaceId: string | null,
  exampleUid: string | null,
): { example: MqttResponseExample | null; hydrated: boolean } {
  const [state, setState] = useState<{ example: MqttResponseExample | null; hydrated: boolean }>({
    example: null,
    hydrated: false,
  });
  useEffect(() => {
    if (!workspaceId || !exampleUid) {
      setState({ example: null, hydrated: true });
      return;
    }
    const mirror = getMqttResponseExampleSyncMirrorForWorkspace(workspaceId);
    let alive = true;
    const refresh = () => {
      if (!alive) return;
      setState({
        example: mirror.getMqttResponseExampleMirror(exampleUid)?.mqttResponseExample ?? null,
        hydrated: true,
      });
    };
    void mirror.hydrated.then(refresh);
    const unsubscribe = mirror.subscribeMqttResponseExampleMirror(exampleUid, refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [workspaceId, exampleUid]);
  return state;
}

const EMPTY_BY_REQUEST: ReadonlyMap<string, MqttResponseExample[]> = new Map();

/**
 * All MQTT examples in the workspace grouped by parent request, each
 * group in capture order (oldest first) — feeds the sidebar's
 * per-request child nodes without one subscription per request row.
 */
export function useMqttResponseExamplesByRequest(
  workspaceId: string | null,
): ReadonlyMap<string, MqttResponseExample[]> {
  const [byRequest, setByRequest] = useState<ReadonlyMap<string, MqttResponseExample[]>>(EMPTY_BY_REQUEST);
  useEffect(() => {
    if (!workspaceId) {
      setByRequest(EMPTY_BY_REQUEST);
      return;
    }
    const mirror = getMqttResponseExampleSyncMirrorForWorkspace(workspaceId);
    let alive = true;
    const refresh = () => {
      if (!alive) return;
      const next = new Map<string, MqttResponseExample[]>();
      for (const example of mirror.listMqttResponseExamples()) {
        const group = next.get(example.mqttRequestUid);
        if (group) group.push(example);
        else next.set(example.mqttRequestUid, [example]);
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
