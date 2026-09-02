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
 * Everything else matches the Safe runtime exactly: the same shared
 * runtime loop and runner core, the same envelopes (here riding
 * `process.parentPort` instead of `window.postMessage`), and every
 * side-effecting `oh.*` call still crossing to the main-process broker
 * — the workspace-state posture does not relax with the runtime.
 */

import { createRequire } from 'node:module';
import { createScriptRuntime } from '@openheaders/core/scripts/runtime';

// The bundle is CJS but the source is a module, so mint a require
// anchored at the built worker file rather than assuming module scope.
const nodeRequire = createRequire(__filename);

const runtime = createScriptRuntime(
  (message) => {
    process.parentPort.postMessage(message);
  },
  { scopeExtras: { require: nodeRequire } },
);

process.parentPort.on('message', (event) => {
  runtime.handleMessage(event.data);
});

// Signal readiness so the broker can fan execute requests in.
runtime.announceReady();
