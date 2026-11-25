/**
 * ProxyRequestInspectTab — a captured proxy request opened as a main
 * editor tab (mode `proxy-request-inspect`). Thin binding of the
 * panel-package request detail to the proxy lifecycle partition. The
 * detail is a reader of that partition's shared view, so the tab stays
 * live with the tool window closed — alone, it keeps the partition open.
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
