/**
 * Boot-time wiring: the workbench page's workflow run host
 * (`workflow-page-run.ts`) — a workflow that holds a session runs IN this
 * page, beside the session it opens (the workflow runs plan, Laws — "The
 * run lives with its session"). A session a run opens is the host-neutral
 * MQTT adapter over this page's own MQTT-over-WebSocket transport, its
 * templates resolved from the scopes the workbench shell publishes.
 *
 * Import AFTER `install-grpc-invoke-host` — this module re-installs the
 * bridge with the decorated instance. It registers `workflowPageRun` (the
 * shell publishes the scopes) and `workflowSessionSteps` (every Refresh
 * and the Run view follow), and ends a run's sessions as the page goes.
 *
 * Not yet here, each refused before the run by name: a `listen` that runs
 * its request's scripts, and a request on mqtt(s):// — a place's socket.
 */

import { getHostBridge, setHostBridge } from '@openheaders/core/bridge';
import { registerCapability } from '@openheaders/core/capabilities';
import { createMqttRunSessionHost } from '@openheaders/oracle/live/mqtt-exec/run-session';
import { createBrowserMqttTransport } from '@openheaders/oracle-host-browser/live/browser-mqtt-transport';
import { getWorkflowRunScope } from '@openheaders/ui/workbench/components/live/workflow-run-scope';
import { createWorkflowRunBridge } from '@/host/workflow-page-run';

const baseBridge = getHostBridge();
if (baseBridge === null) {
  throw new Error('install-workflow-run-host: no host bridge installed — import after install-grpc-invoke-host.');
}

// Stateless — one stream per session.
const browserMqttTransport = createBrowserMqttTransport();

const { bridge, endOpenSessions } = createWorkflowRunBridge({
  base: baseBridge,
  getScope: getWorkflowRunScope,
  sessionsFor: (scope, environmentId) =>
    createMqttRunSessionHost({
      // This realm pins none of the engine's workspaces: its scopes are handed in.
      workspaceId: null,
      environmentId,
      transport: browserMqttTransport,
      findRequest: (uid) => scope.mqttRequests.find((request) => request.uid === uid) ?? null,
      sessionScope: async (request, stepCaptures) => {
        const session = await scope.mqttSession(request, { environmentId, stepCaptures });
        return {
          resolution: session.resolve,
          prepareResolution: session.prepare,
          referencesSecret: session.referencesSecret,
          totp: session.totp,
          authChain: session.authChain,
          scriptChain: session.scriptChain,
          settingsChain: session.settingsChain,
        };
      },
    }),
  runsScripts: false,
});

setHostBridge(bridge);

// A session never outlives its run, and the run goes with this page.
window.addEventListener('pagehide', endOpenSessions);

registerCapability('workflowPageRun', () => true);
registerCapability('workflowSessionSteps', () => true);
