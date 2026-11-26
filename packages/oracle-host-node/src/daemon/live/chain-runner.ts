/**
 * Node-host live-workflow chain runner — the host-neutral runner
 * (`@openheaders/oracle/live/workflow-route/run`) over this host's two
 * transports.
 *
 * Boundaries:
 *   - The scheduler (`./live-refresh-scheduler`) owns WHEN to fire.
 *   - The workflow route owns the run: the check before the first step,
 *     the resolve→execute core, and the commit of the outcome to the
 *     live cache. The served web tab runs the same code over its
 *     delegating transports.
 *   - This module owns what is the node host's alone: the Node request
 *     transport every `call` step sends over, and the Node byte
 *     transport a `listen` step's MQTT session opens over.
 *
 * Every run feeds its step events to the host's surfaces — a cadence
 * fire, an agent's call, a person's press alike (the workflow runs plan,
 * The Run view).
 */

import type { WorkflowRouteHost } from '@openheaders/oracle/live/workflow-route/host';
import {
  runWorkflowRefresh as runWorkflowRefreshOver,
  type WorkflowRefreshArgs,
  type WorkflowRefreshResult,
} from '@openheaders/oracle/live/workflow-route/run';
import { createNodeMqttTransport } from '../../live/node-mqtt-transport';
import { createNodeRequestTransport } from '../../live/node-request-transport';

export type { WorkflowRefreshArgs, WorkflowRefreshResult };

/** One Node transport for the whole process — stateless, so a singleton
 *  avoids rebuilding the `fetch` wrapper on every step fetch. */
const nodeTransport = createNodeRequestTransport();
/** Stateless too — it opens one socket per session. */
const nodeMqttTransport = createNodeMqttTransport();

const nodeWorkflowRouteHost: WorkflowRouteHost = {
  requestTransportFor: () => nodeTransport,
  mqttTransportFor: () => nodeMqttTransport,
};

/** Run a workflow once against the Node transports and commit the outcome to the live cache. */
export function runWorkflowRefresh(args: WorkflowRefreshArgs): Promise<WorkflowRefreshResult> {
  return runWorkflowRefreshOver(args, nodeWorkflowRouteHost);
}
