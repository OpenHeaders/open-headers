/**
 * Developer-mode script worker — the full-Node-runtime counterpart of
 * the Safe-mode sandbox page, running as an Electron `utilityProcess`
 * forked by `worker-transport.ts`. Built as its own main-process entry
 * (`dist-webpack/main/script-worker.js` — see `electron.vite.config.ts`).
 *
 * Full runtime IS the point of Developer mode: the compiled script's
 * scope receives Node's `require` (builtins and anything resolvable
 * from the app bundle), and the usual Node globals (`process`,
 * `Buffer`, …) stay reachable. `oh.require` keeps its Safe-mode
 * meaning — workspace script packages from the Package Library — so a
 * script moving between modes never has its package imports change
 * meaning under it.
 *
 * Everything else matches the Safe runtime exactly: the same
 * execute / result / host-request envelopes (here riding
 * `process.parentPort` instead of `window.postMessage`), the same
 * shared runner core, and every side-effecting `oh.*` call still
 * crossing to the main-process broker — the workspace-state posture
 * does not relax with the runtime.
 */

import { createRequire } from 'node:module';
import type { ScriptExecutionRequest, ScriptHostRequest, ScriptHostResponse } from '@openheaders/core/scripts';
import { executeScript } from '@openheaders/core/scripts/runner';

// The bundle is CJS but the source is a module, so mint a require
// anchored at the built worker file rather than assuming module scope.
const nodeRequire = createRequire(__filename);

// Signal readiness so the broker can fan execute requests in.
process.parentPort.postMessage({ type: 'sandbox.ready' });

// Each inbound `script.host-response` resolves the waiting promise.
const pendingHostRpcs = new Map<string, (response: ScriptHostResponse) => void>();

process.parentPort.on('message', (event) => {
  const data = event.data as
    | { type: 'script.execute'; request: ScriptExecutionRequest }
    | { type: 'script.host-response'; response: ScriptHostResponse }
    | undefined;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'script.execute') {
    void executeScript(data.request, { sendHostRequest, scopeExtras: { require: nodeRequire } }).then((result) => {
      process.parentPort.postMessage({ type: 'script.result', result });
    });
    return;
  }

  if (data.type === 'script.host-response') {
    const resolver = pendingHostRpcs.get(data.response.rpcId);
    if (resolver) {
      pendingHostRpcs.delete(data.response.rpcId);
      resolver(data.response);
    }
  }
});

function sendHostRequest(request: ScriptHostRequest): Promise<ScriptHostResponse> {
  const p = new Promise<ScriptHostResponse>((resolve) => {
    pendingHostRpcs.set(request.rpcId, resolve);
  });
  process.parentPort.postMessage({ type: 'script.host-request', request });
  return p;
}
