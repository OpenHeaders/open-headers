/**
 * LiveNetworkRequestInspectTab — a live browser request opened as a
 * main editor tab (mode `live-network-request-inspect`). Thin binding
 * of the panel-package request detail to the QUALIFIED lifecycle
 * lifeline for the watched `(nodeId, tabId)` partition; the detail owns
 * its own lifeline client, so the tab stays live (and survives the Live
 * Network tool window closing) on the engine's replay contract alone.
 */

import { hasCapability } from '@openheaders/core/capabilities';
import { qualifiedLifecyclePortName } from '@openheaders/core/request-lifecycle';
import type React from 'react';
import { useMemo } from 'react';
import { NetworkCaptureRequestDetail, type WireJoinSeam } from '../../../panel/components/NetworkCaptureView';

export interface LiveNetworkRequestInspectTabProps {
  nodeId: string;
  tabId: number;
  requestId: string;
}

const LiveNetworkRequestInspectTab: React.FC<LiveNetworkRequestInspectTabProps> = ({ nodeId, tabId, requestId }) => {
  const portName = useMemo(() => (id: number) => qualifiedLifecyclePortName(id, nodeId), [nodeId]);
  // Wire-join (Phase 6): on a host that runs the wire capture, the
  // detail derives the same merged rows the Traffic Monitor list shows.
  // The tab knows no display title — the seen record keeps a labelled
  // entry over this unlabelled one.
  const wireJoin = useMemo<WireJoinSeam | undefined>(
    () => (hasCapability('proxyCapture') ? { mode: 'browser', nodeId, sourceLabel: null } : undefined),
    [nodeId],
  );
  return <NetworkCaptureRequestDetail tabId={tabId} portName={portName} requestId={requestId} wireJoin={wireJoin} />;
};

export default LiveNetworkRequestInspectTab;
