/**
 * The web tab's own workflow runs — the `tab-requests-rpc.ts` and
 * `tab-sessions-rpc.ts` sibling for the calls the workflow editor, its
 * status strip, Workflow Status and the Run view make (the workflow runs
 * plan, Decisions log, S13): a run on a person's press, the cache read,
 * the circuit reset, and what one step of a run produced. The tab is the
 * CONTEXT: the runner, the session a `listen` step opens, the window an
 * `expect` reads and the scripts all run here against the tab's synced
 * mirrors, and the outcome commits to the tab's own live cache — only
 * the sockets move. The route is the host-neutral one the node hosts run
 * (`@openheaders/oracle/live/workflow-route`); this module is the tab's
 * seam into it: a `call` step sends over the delegating request
 * transport the tab's Send rides, a `listen` step's byte stream opens
 * over the delegating socket the tab's Connect rides — the serving
 * daemon dials, an mqtt(s):// broker included. The tab has exactly one
 * place, so a run has no place to choose.
 *
 * A press is the only trigger here: the tab starts no scheduler. The
 * run's step events and the cache's changes fan out on the in-tab
 * broadcast (`installTabWorkflowBroadcasts`).
 */

import { onLiveCacheStoreChange } from '@openheaders/oracle/live/live-cache-store';
import type { WorkflowRouteHost } from '@openheaders/oracle/live/workflow-route/host';
import {
  handleLiveWorkflowRpc,
  isLiveWorkflowRpc,
  type LiveWorkflowRpcType,
  type LiveWorkflowRunner,
} from '@openheaders/oracle/live/workflow-route/route';
import { runWorkflowRefresh } from '@openheaders/oracle/live/workflow-route/run';
import { setWorkflowRunEventSink } from '@openheaders/oracle/live/workflow-run-feed';
import { webRequestRouteHost } from './tab-requests-rpc';
import { webSessionRouteHost } from './tab-sessions-rpc';
import { broadcastLocal } from './web-broadcast';

export function isTabWorkflowsChannel(type: unknown): type is LiveWorkflowRpcType {
  return isLiveWorkflowRpc(type);
}

/** The tab's seam into the shared workflow route — see the module doc. */
export const webWorkflowRouteHost: WorkflowRouteHost = {
  requestTransportFor: (workspaceId) => webRequestRouteHost.transportFor(undefined, workspaceId),
  mqttTransportFor: (workspaceId) => webSessionRouteHost.mqttTransportFor(undefined, workspaceId).transport,
};

const runInTab: LiveWorkflowRunner = (args) => runWorkflowRefresh(args, webWorkflowRouteHost);

/**
 * Dispatch one tab-answered workflow channel. Only call for channels
 * {@link isTabWorkflowsChannel} owns.
 */
export function dispatchTabWorkflowsRpc(type: LiveWorkflowRpcType, message: Record<string, unknown>): Promise<unknown> {
  return handleLiveWorkflowRpc(type, message, runInTab);
}

/**
 * The two facts a workflow surface listens for, on the in-tab fan-out:
 * a cache row changed (a run here, or a value the server's run synced
 * down), and one step event of a run this tab started.
 */
export function installTabWorkflowBroadcasts(): void {
  onLiveCacheStoreChange((_workspaceId, workflowUid) => {
    broadcastLocal('liveCacheChanged', { workflowUid });
  });
  setWorkflowRunEventSink((event) => broadcastLocal('liveWorkflowRunEvent', event));
}
