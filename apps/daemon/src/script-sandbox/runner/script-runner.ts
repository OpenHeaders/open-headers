/**
 * Safe-mode script runner — the daemon's isolated script process,
 * forked by `fork-transport.ts` under Node's permission model
 * (`--permission`: filesystem, child processes, worker threads and
 * native addons all refuse with ERR_ACCESS_DENIED) with a scrubbed
 * environment. Built as its own SELF-CONTAINED entry
 * (`dist/script-runner.js`, `vite.config.runner.ts`) so the permission
 * grant covers exactly one file and no shared chunk can drag
 * `better-sqlite3` (a denied native addon) into this process.
 *
 * Everything matches the desktop runtimes exactly: the same
 * execute / result / host-request envelopes (here riding the fork IPC
 * channel — `process.on('message')` receives the data directly and
 * `process.send` posts up), the same shared runner core, and every
 * side-effecting `oh.*` call crossing to the daemon's broker — the
 * workspace-state posture does not relax with the transport. No
 * `scopeExtras`: Safe mode's scope is `oh` + `console`, nothing else.
 */

import type { ScriptExecutionRequest, ScriptHostRequest, ScriptHostResponse } from '@openheaders/core/scripts';
import { executeScript } from '@openheaders/core/scripts/runner';

function postUp(message: unknown): void {
  process.send?.(message);
}

// Each inbound `script.host-response` resolves the waiting promise.
const pendingHostRpcs = new Map<string, (response: ScriptHostResponse) => void>();

function sendHostRequest(request: ScriptHostRequest): Promise<ScriptHostResponse> {
  const p = new Promise<ScriptHostResponse>((resolve) => {
    pendingHostRpcs.set(request.rpcId, resolve);
  });
  postUp({ type: 'script.host-request', request });
  return p;
}

process.on('message', (data: unknown) => {
  const message = data as
    | { type: 'script.execute'; request: ScriptExecutionRequest }
    | { type: 'script.host-response'; response: ScriptHostResponse }
    | undefined;
  if (!message || typeof message !== 'object') return;

  if (message.type === 'script.execute') {
    void executeScript(message.request, { sendHostRequest }).then((result) => {
      postUp({ type: 'script.result', result });
    });
    return;
  }

  if (message.type === 'script.host-response') {
    const resolver = pendingHostRpcs.get(message.response.rpcId);
    if (resolver) {
      pendingHostRpcs.delete(message.response.rpcId);
      resolver(message.response);
    }
  }
});

// A dropped IPC channel means the daemon is gone — exit instead of
// lingering as an orphan the idle close can no longer reach.
process.on('disconnect', () => {
  process.exit(0);
});

// Signal readiness so the broker can fan execute requests in.
postUp({ type: 'sandbox.ready' });
