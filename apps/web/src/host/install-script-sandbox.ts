/**
 * Web host script runtime — the served tab's composition root (the
 * Execution Place plan, Phase W: the tab is a context, so its scripts
 * run HERE). Registers ONE capability, Safe mode, into the host-neutral
 * registry every send and session host resolves through
 * (`@openheaders/oracle/live/script-host/capability`): the same oracle
 * broker the node hosts run, over the shared sandbox iframe transport
 * (`@openheaders/oracle-host-browser`) mounting the page the serving
 * daemon delivers under the sandbox CSP header (`WEB_SANDBOX_PAGE` —
 * a unique opaque origin, `'unsafe-eval'` for the user scripts it
 * compiles, no network of its own), with the `oh.*` servicing every
 * mirror-backed host shares (`host-rpc.ts`) over the tab's seam: the
 * vault-ref OAuth refresh leg rides the tab's delegating HTTP leg
 * toward the serving daemon, and an ad-hoc `oh.sendRequest` draft
 * goes through the tab's own Send route — the shared request route
 * over the tab's seam, so it delegates the socket exactly as a
 * workbench Send does and cannot recurse (the draft carries no
 * scripts).
 *
 * A browser tab never runs Developer mode: there is no full-Node
 * runtime to register and no chooser for it. The anonymous public
 * viewer (session-less, wire-less, read-only) registers nothing.
 * Import order: after `install-capabilities` — the boot's install
 * modules load at import time; the iframe mounts lazily on the first
 * script run, never at boot.
 */

import { WEB_SANDBOX_PAGE } from '@openheaders/core/scripts';
import type { RequestTransport } from '@openheaders/oracle/live/request-exec/transport';
import { executeRequestRoute } from '@openheaders/oracle/live/request-route/route';
import { createScriptBroker } from '@openheaders/oracle/live/script-host/broker';
import { setHostScriptCapabilities } from '@openheaders/oracle/live/script-host/capability';
import { createScriptHostRequestHandler } from '@openheaders/oracle/live/script-host/host-rpc';
import { peekActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import { createIframeSandboxTransport } from '@openheaders/oracle-host-browser/live/iframe-sandbox-transport';
import { isPublicView } from './public-view';
import { webRequestRouteHost } from './tab-requests-rpc';

/** The refresh leg keyed by the workspace active at the moment the
 *  script runs — the delegating transport the tab's sends ride. */
const tabRefreshTransport: RequestTransport = {
  send: async (request) => {
    const workspaceId = peekActiveWorkspaceId();
    if (workspaceId === null) throw new Error('No active workspace');
    return webRequestRouteHost.transportFor(undefined, workspaceId).send(request);
  },
};

if (!isPublicView()) {
  const broker = createScriptBroker({
    createTransport: createIframeSandboxTransport({ src: `/${WEB_SANDBOX_PAGE}` }),
    handleHostRequest: createScriptHostRequestHandler({
      refreshTransport: tabRefreshTransport,
      sendRequest: (draft) => executeRequestRoute({ draft }, webRequestRouteHost),
    }),
  });
  setHostScriptCapabilities({
    safe: {
      mode: 'safe',
      runScript: (opts) => broker.runScript(opts),
      endSession: (sessionId) => broker.endSession(sessionId),
    },
  });
}
