/**
 * CapturePartitionHost — the owner of ONE open lifecycle partition: the
 * lifeline client, the wire join and the panel projection over it, run
 * once and published to the registry for every reader of the partition.
 *
 * The wire-join seam derives its merged rows between the client and the
 * projection, so every reader sees the upgraded rows through the one
 * pipeline. An element only because the pipeline is hooks: it renders
 * nothing — a partition has no place on screen, its readers do.
 */

import { useCallback, useEffect, useMemo } from 'react';
import {
  type CapturePartition,
  type CapturePartitionOwnerProps,
  type CapturePartitionView,
  capturePartitions,
} from './capture-partition-registry';
import { EMPTY_FIRE_SNAPSHOT } from './stores/fire-client-store';
import { EMPTY_PAGE_SNAPSHOT } from './stores/page-client-store';
import { EMPTY_RESOURCE_TIMING_SNAPSHOT } from './stores/resource-timing-client-store';
import { useLifecycleClient } from './stores/use-lifecycle-client';
import { usePanelData } from './use-panel-data';
import { useWireJoin, type WireJoinSourceRef } from './use-wire-join';

/**
 * The per-partition data pipeline. The page-stream / fire /
 * resource-timing feeds have no source for these partitions, so their
 * shared empty snapshots are fed to the projection.
 */
function useCapturePartitionView({ tabId, portName, wireJoin }: CapturePartition): CapturePartitionView {
  const lifecycleClient = useLifecycleClient({ tabId, ...(portName !== undefined ? { portName } : {}) });
  const joinSource = useMemo<WireJoinSourceRef | undefined>(
    () =>
      wireJoin?.mode === 'browser' && wireJoin.nodeId !== undefined
        ? { nodeId: wireJoin.nodeId, tabId, label: wireJoin.sourceLabel ?? null }
        : undefined,
    [wireJoin, tabId],
  );
  const wire = useWireJoin({
    mode: wireJoin?.mode ?? 'off',
    snapshot: lifecycleClient.snapshot,
    ...(joinSource !== undefined ? { source: joinSource } : {}),
  });
  const data = usePanelData({
    lifecycle: wire.snapshot,
    page: EMPTY_PAGE_SNAPSHOT,
    fire: EMPTY_FIRE_SNAPSHOT,
    opts: useMemo(() => ({ consolidateRetries: false }), []),
    resourceTiming: EMPTY_RESOURCE_TIMING_SNAPSHOT,
  });
  // Composed body pull: a CDP-fed partition serves its own bodies; a
  // joined hop on any other partition pulls from the wire twin (the
  // body lands in the wire store and re-derives the merged row).
  const { source, watchRefusedReason, clearSession, requestResponseBody: pullOwnBody } = lifecycleClient;
  const { joinedIds, seenLabels, pullWireBody } = wire;
  const requestResponseBody = useCallback(
    (requestId: string, hopIndex: number) => {
      if (source !== 'cdp' && pullWireBody(requestId, hopIndex)) return;
      pullOwnBody(requestId, hopIndex);
    },
    [source, pullWireBody, pullOwnBody],
  );
  return useMemo(
    () => ({ data, source, watchRefusedReason, joinedIds, seenLabels, clearSession, requestResponseBody }),
    [data, source, watchRefusedReason, joinedIds, seenLabels, clearSession, requestResponseBody],
  );
}

export function CapturePartitionHost({ partition }: CapturePartitionOwnerProps) {
  const view = useCapturePartitionView(partition);
  useEffect(() => {
    capturePartitions.publish(partition.key, view);
  }, [partition.key, view]);
  return null;
}
