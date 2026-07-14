/**
 * Script runtimes — composition root. Wires one broker per runtime
 * (Safe: the hidden sandboxed-renderer transport; Developer: the
 * full-Node `utilityProcess` worker transport) over the SAME `oh.*`
 * host-RPC servicing, and registers both as the spine's
 * {@link HostScriptCapabilities}, so the node executor
 * (`execute-request-rpc`) and the chain runner inject script runners
 * on this host. Which runtime a local interactive send rides is the
 * per-workspace, host-local `OH.scriptExecutionModes` slot's call —
 * resolved in the spine, not here. The headless daemon never calls
 * this — its sends stay scriptless by construction.
 *
 * The Developer broker keeps the chain read-only tier too: chains
 * never resolve the Developer runtime, but the tier gate is defense in
 * depth, not the policy's only home.
 */

import { setHostScriptCapabilities } from '@openheaders/oracle-host-node/daemon';
import { createSandboxWindowTransport } from './sandbox-window';
import { createScriptBroker } from './script-broker';
import { handleScriptHostRequest } from './script-host-rpc';
import { createScriptWorkerTransport } from './worker-transport';

export interface ScriptSandboxHandle {
  dispose(): void;
}

export function installScriptSandbox(): ScriptSandboxHandle {
  const safeBroker = createScriptBroker({
    createTransport: createSandboxWindowTransport,
    handleHostRequest: handleScriptHostRequest,
  });
  const developerBroker = createScriptBroker({
    createTransport: createScriptWorkerTransport,
    handleHostRequest: handleScriptHostRequest,
  });
  setHostScriptCapabilities({
    safe: { mode: 'safe', runScript: (opts) => safeBroker.runScript(opts) },
    developer: { mode: 'developer', runScript: (opts) => developerBroker.runScript(opts) },
  });
  return {
    dispose(): void {
      setHostScriptCapabilities(null);
      safeBroker.dispose();
      developerBroker.dispose();
    },
  };
}
