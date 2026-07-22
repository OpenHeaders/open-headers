/**
 * ProxyRequestInspectTab — a captured proxy request opened as a main
 * editor tab (mode `proxy-request-inspect`). Thin binding of the
 * panel-package request detail to the proxy lifecycle partition; the
 * detail owns its own lifeline client, so the tab stays live (and
 * survives the Proxy tool window closing) on the engine's replay
 * contract alone.
 */

import { PROXY_LIFECYCLE_TAB_ID } from '@openheaders/core/proxy';
import type React from 'react';
import { NetworkCaptureRequestDetail, type WireJoinSeam } from '../../../panel/components/NetworkCaptureView';

export interface ProxyRequestInspectTabProps {
  requestId: string;
}

// The wire partition's detail annotates from the historical seen record
// (wire-join Phase 6) — a static seam, no extra lifeline.
const WIRE_JOIN: WireJoinSeam = { mode: 'wire' };

const ProxyRequestInspectTab: React.FC<ProxyRequestInspectTabProps> = ({ requestId }) => (
  <NetworkCaptureRequestDetail tabId={PROXY_LIFECYCLE_TAB_ID} requestId={requestId} wireJoin={WIRE_JOIN} />
);

export default ProxyRequestInspectTab;
