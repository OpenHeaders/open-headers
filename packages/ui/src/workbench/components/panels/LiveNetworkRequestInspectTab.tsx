/**
 * LiveNetworkRequestInspectTab — a live browser request opened as a
 * main editor tab (mode `live-network-request-inspect`). Thin binding
 * of the panel-package request detail to the QUALIFIED lifecycle
 * lifeline for the watched `(nodeId, tabId)` partition; the detail owns
 * its own lifeline client, so the tab stays live (and survives the Live
 * Network tool window closing) on the engine's replay contract alone.
 */

import { qualifiedLifecyclePortName } from '@openheaders/core/request-lifecycle';
import type React from 'react';
import { useMemo } from 'react';
import { NetworkCaptureRequestDetail } from '../../../panel/components/NetworkCaptureView';

export interface LiveNetworkRequestInspectTabProps {
  nodeId: string;
  tabId: number;
  requestId: string;
}

const LiveNetworkRequestInspectTab: React.FC<LiveNetworkRequestInspectTabProps> = ({ nodeId, tabId, requestId }) => {
  const portName = useMemo(() => (id: number) => qualifiedLifecyclePortName(id, nodeId), [nodeId]);
  return <NetworkCaptureRequestDetail tabId={tabId} portName={portName} requestId={requestId} />;
};

export default LiveNetworkRequestInspectTab;
