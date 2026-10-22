/**
 * The MQTT session pane's send-pulse drive — the session's lifecycle
 * read as the bar's two facts: dialing and redialing are in flight;
 * an accepted CONNACK lands on the success tint (the CONNECTED
 * badge's), and the settled session lands on its end pill's tone. A
 * publish on the open session is flight that keeps its landing — one
 * sweep, no line.
 */

import type { ExecutedMqttSnapshot } from '@openheaders/core/types';
import type { SendPulseDrive } from '../request-editor/response/send-pulse';
import { sessionEndTone } from './session-display';
import type { LiveMqttSession } from './useLiveMqttSession';

export function mqttSessionPulse(
  live: LiveMqttSession | null,
  snapshot: ExecutedMqttSnapshot | null,
  /** The pane's reading of the live item log — between connections
   *  of an auto-reconnecting session. */
  reconnecting: boolean,
  /** A publish rider is out on the open session. */
  publishing: boolean,
): SendPulseDrive {
  if (snapshot !== null) return { inflight: false, landing: sessionEndTone(snapshot) };
  if (live === null) return { inflight: false, landing: null };
  return live.open !== null && !reconnecting
    ? { inflight: publishing, landing: 'success' }
    : { inflight: true, landing: null };
}
