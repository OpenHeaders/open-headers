/**
 * Boot-time wiring: the workbench page's workflow run host
 * (`workflow-page-run.ts`) — a workflow that holds a session runs IN this
 * page, beside the session it opens (the workflow runs plan, Laws — "The
 * run lives with its session"). A session a run opens is the host-neutral
 * MQTT adapter, its templates resolved from the scopes the workbench
 * shell publishes.
 *
 * Import AFTER `install-grpc-invoke-host` — this module re-installs the
 * bridge with the decorated instance. It registers `workflowPageRun` (the
 * shell publishes the scopes) and `workflowSessionSteps` (every Refresh
 * and the Run view follow), and ends a run's sessions as the page goes.
 *
 * A `listen` that runs its request's scripts runs them on this page's
 * sandbox under the run's tier; where the page has no sandbox (Firefox)
 * the run is refused before its first step. A session opens where its
 * request's Connect would: here over the page's own WebSocket, or over
 * the delegated socket of the place the request resolves to (the desktop
 * app, the workspace's server), an mqtt(s):// dial included.
 */

import { getHostBridge, setHostBridge } from '@openheaders/core/bridge';
import { registerCapability } from '@openheaders/core/capabilities';
import { createDelegatingMqttTransport } from '@openheaders/oracle/live/delegated-socket/delegating-mqtt-transport';
import { createMqttRunSessionHost } from '@openheaders/oracle/live/mqtt-exec/run-session';
import { createBrowserMqttTransport } from '@openheaders/oracle-host-browser/live/browser-mqtt-transport';
import { getWorkflowRunScope } from '@openheaders/ui/workbench/components/live/workflow-run-scope';
import { pageDelegatedSocketWireFor } from '@/host/delegated-socket-wire';
import { getPageRunScriptHost, setPageScriptScope } from '@/host/page-script-host';
import { createWorkflowRunBridge } from '@/host/workflow-page-run';

const baseBridge = getHostBridge();
if (baseBridge === null) {
  throw new Error('install-workflow-run-host: no host bridge installed — import after install-grpc-invoke-host.');
}

// Stateless — one stream per session.
const browserMqttTransport = createBrowserMqttTransport();
// The run's tier on the page's one script runtime; null on Firefox.
const runScriptHost = getPageRunScriptHost();

const { bridge, endOpenSessions } = createWorkflowRunBridge({
  base: baseBridge,
  getScope: getWorkflowRunScope,
  sessionsFor: (scope, environmentId) =>
    createMqttRunSessionHost({
      // This realm pins none of the engine's workspaces: its scopes are handed in.
      workspaceId: null,
      environmentId,
      transport: browserMqttTransport,
      // A request whose place is another host: that place opens the stream, the session stays here.
      transportFor: (request) => {
        const { target } = scope.mqttPlace(request);
        if (target === null) return null;
        return createDelegatingMqttTransport({
          wire: pageDelegatedSocketWireFor(target.backendId),
          workspaceId: scope.workspaceId,
        });
      },
      findRequest: (uid) => scope.mqttRequests.find((request) => request.uid === uid) ?? null,
      sessionScope: async (request, stepCaptures) => {
        const session = await scope.mqttSession(request, { environmentId, stepCaptures });
        // A hook's `oh.require` and credential refs answer against this session's scope, as a Connect's do.
        setPageScriptScope(session.scripts);
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
      resolveScriptHost: async () => runScriptHost,
    }),
  runsScripts: runScriptHost !== null,
});

setHostBridge(bridge);

// A session never outlives its run, and the run goes with this page.
window.addEventListener('pagehide', endOpenSessions);

registerCapability('workflowPageRun', () => true);
registerCapability('workflowSessionSteps', () => true);
