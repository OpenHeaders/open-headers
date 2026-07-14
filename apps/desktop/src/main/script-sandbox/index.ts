/**
 * Script runtimes — the desktop's composition root. Wires one broker
 * per runtime (Safe: the hidden sandboxed-renderer transport;
 * Developer: the full-Node `utilityProcess` worker transport) over the
 * SAME `oh.*` host-RPC servicing — broker and servicing live
 * host-neutral in `@openheaders/oracle-host-node/daemon`; only the two
 * Electron transports are desktop-owned — and registers both as the
 * spine's {@link HostScriptCapabilities}, so the node executor
 * (`execute-request-rpc`) and the chain runner inject script runners
 * on this host. Which runtime a local interactive send rides is the
 * per-workspace, host-local `OH.scriptExecutionModes` slot's call —
 * resolved in the spine, not here. The standalone daemon has its own
 * composition root over the same lifted broker (Safe only, a
 * permission-restricted fork).
 *
 * The Developer broker keeps the chain read-only tier too: chains
 * never resolve the Developer runtime, but the tier gate is defense in
 * depth, not the policy's only home.
 */

import {
  createScriptBroker,
  handleScriptHostRequest,
  setHostScriptCapabilities,
} from '@openheaders/oracle-host-node/daemon';
import { createSandboxWindowTransport } from './sandbox-window';
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
