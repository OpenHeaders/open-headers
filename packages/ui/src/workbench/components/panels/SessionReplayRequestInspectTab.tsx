/**
 * SessionReplayRequestInspectTab — one recorded request from an
 * archived session opened as a main editor tab (mode
 * `session-replay-request-inspect`). Thin binding of the panel-package
 * request detail to the session's replay lifeline; the detail owns its
 * own lifeline client (its own re-stream of the sealed log), so the
 * tab renders with or without the session's list tab open — the same
 * self-sufficiency contract as the proxy/live-network inspect tabs,
 * with the archive standing in for the engine.
 */

import { replayLifecyclePortName } from '@openheaders/core/request-lifecycle';
import type React from 'react';
import { useMemo } from 'react';
import { NetworkCaptureRequestDetail } from '../../../panel/components/NetworkCaptureView';

export interface SessionReplayRequestInspectTabProps {
  /** Archive-wide session identity — the directory basename. */
  sessionId: string;
  /** The lifecycle partition the recorded envelopes address. */
  partitionTabId: number;
  requestId: string;
}

const SessionReplayRequestInspectTab: React.FC<SessionReplayRequestInspectTabProps> = ({
  sessionId,
  partitionTabId,
  requestId,
}) => {
  const portName = useMemo(() => () => replayLifecyclePortName(sessionId), [sessionId]);
  return <NetworkCaptureRequestDetail tabId={partitionTabId} portName={portName} requestId={requestId} />;
};

export default SessionReplayRequestInspectTab;
