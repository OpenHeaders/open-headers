/**
 * `oh.*` host-RPC servicing — the node hosts' composition of the
 * host-neutral handler (`@openheaders/oracle/live/script-host/host-rpc`),
 * shared by the desktop main process and the standalone daemon: the
 * vault-ref OAuth refresh leg rides the node request transport (the
 * same seam every send rides, so the proxy and trust planes cover it)
 * and an ad-hoc `oh.sendRequest` draft goes through this host's own
 * workbench-Send route, sharing its transport, dispatcher cache and
 * cookie jars.
 */

import { createScriptHostRequestHandler } from '@openheaders/oracle/live/script-host/host-rpc';
import { createNodeRequestTransport } from '../live/node-request-transport';
import { handleExecuteRequestRpc } from './execute-request-rpc';

export const handleScriptHostRequest = createScriptHostRequestHandler({
  refreshTransport: createNodeRequestTransport(),
  sendRequest: (draft) => handleExecuteRequestRpc({ draft }),
});
