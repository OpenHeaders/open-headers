/**
 * Safe-mode script sandbox — composition root. Wires the hidden-window
 * transport, the broker, and the `oh.*` host-RPC servicing together and
 * registers the result as the spine's {@link HostScriptCapability}, so
 * the node executor (`execute-request-rpc`) and the chain runner inject
 * script runners on this host. The headless daemon never calls this —
 * its sends stay scriptless by construction.
 */

import { setHostScriptCapability } from '@openheaders/oracle-host-node/daemon';
import { createSandboxWindowTransport } from './sandbox-window';
import { createScriptBroker } from './script-broker';
import { handleScriptHostRequest } from './script-host-rpc';

export interface ScriptSandboxHandle {
  dispose(): void;
}

export function installScriptSandbox(): ScriptSandboxHandle {
  const broker = createScriptBroker({
    createTransport: createSandboxWindowTransport,
    handleHostRequest: handleScriptHostRequest,
  });
  setHostScriptCapability({
    mode: 'safe',
    runScript: (opts) => broker.runScript(opts),
  });
  return {
    dispose(): void {
      setHostScriptCapability(null);
      broker.dispose();
    },
  };
}
