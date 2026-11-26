/**
 * The workflow route's host seam — what a host that runs a workflow in
 * the realm of its stores contributes to the ONE host-neutral runner and
 * its doors in this directory: where a `call` step's exchange goes out,
 * and where a `listen` step's byte stream opens. The route owns
 * everything else — the check before the run, the adapter, the session
 * host, the commit — so the node hosts and the served web tab run a
 * workflow through one code path (the workflow runs plan, Decisions log,
 * S13).
 *
 * A node host hands its own two transports for every workspace; the web
 * tab the delegating ones toward its serving daemon, keyed by the
 * workspace the run reads under.
 */

import type { MqttByteTransport } from '../mqtt-exec/transport';
import type { RequestTransport } from '../request-exec/transport';

export interface WorkflowRouteHost {
  /** The transport every `call` step of a run in this workspace sends over, its OAuth renewal included. */
  requestTransportFor(workspaceId: string): RequestTransport;
  /** The byte-stream transport a `listen` step's MQTT session opens over. */
  mqttTransportFor(workspaceId: string): MqttByteTransport;
}
