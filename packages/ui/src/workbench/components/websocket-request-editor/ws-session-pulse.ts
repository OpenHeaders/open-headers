/**
 * The WebSocket session pane's send-pulse drive — the MQTT drive's
 * twin: dialing and redialing are in flight; a settled handshake
 * lands on the success tint (the CONNECTED badge's), and the settled
 * session lands on its pill's tone. A message sent on the open
 * session is flight that keeps its landing — one sweep, no line.
 */

import type { ExecutedWsSnapshot } from '@openheaders/core/types';
import type { SendPulseDrive } from '../request-editor/response/send-pulse';
import type { LiveWsSession, WsSessionTiming } from './useLiveWsSession';
import { wsSessionEndTone } from './ws-lifecycle';

export function wsSessionPulse(
  live: LiveWsSession | null,
  snapshot: ExecutedWsSnapshot | null,
  /** The settled session's timing — whether the user asked for the close. */
  timing: Pick<WsSessionTiming, 'closeRequestedAt'> | null,
  /** The pane's reading of the lifecycle facts — between connections
   *  of an auto-reconnecting session. */
  reconnecting: boolean,
  /** A send rider is out on the open session. */
  sending: boolean,
): SendPulseDrive {
  if (snapshot !== null) return { inflight: false, landing: wsSessionEndTone(snapshot, timing) };
  if (live === null) return { inflight: false, landing: null };
  return live.open !== null && !reconnecting
    ? { inflight: sending, landing: 'success' }
    : { inflight: true, landing: null };
}
