/**
 * Sandboxed script runner page — the desktop's Safe-mode isolation
 * wrapper around the shared script runner core
 * (`@openheaders/core/scripts/runner`), running inside a hidden
 * BrowserWindow created with `sandbox: true`, `contextIsolation` and no
 * Node integration. The page's CSP allows `'unsafe-eval'` so
 * `new Function(source)` can compile user scripts; nothing else loads.
 *
 * Transport: the extension sandbox posts to its parent offscreen doc;
 * here the page is top-level, so both directions ride `window
 * .postMessage` on the page's own window. The sandbox preload
 * (`src/preload/sandbox.ts`) listens on the same window from the
 * isolated world and bridges to the main process over IPC. Outbound
 * and inbound message types are disjoint sets, so each side's listener
 * ignores the other's traffic (including its own echoes).
 *
 * No scope extras are injected — a script that reaches for `require`
 * or Node globals falls back to the sandboxed window object (no Node,
 * no host APIs, only postMessage on a hidden window — defense in
 * depth). The Developer-mode worker is where extras exist.
 */

import type { ScriptExecutionRequest, ScriptHostRequest, ScriptHostResponse } from '@openheaders/core/scripts';
import { executeScript } from '@openheaders/core/scripts/runner';

// Signal readiness so the broker can fan execute requests in.
window.postMessage({ type: 'sandbox.ready' }, '*');

// Each inbound `script.host-response` resolves the waiting promise.
const pendingHostRpcs = new Map<string, (response: ScriptHostResponse) => void>();

window.addEventListener('message', (ev) => {
  // Same-window transport — structural typing via the `type` tag is the
  // filter (the page also receives its own outbound posts; their types
  // are disjoint from the inbound set handled here).
  const data = ev.data as
    | { type: 'script.execute'; request: ScriptExecutionRequest }
    | { type: 'script.host-response'; response: ScriptHostResponse }
    | undefined;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'script.execute') {
    void executeScript(data.request, { sendHostRequest }).then((result) => {
      window.postMessage({ type: 'script.result', result }, '*');
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
  window.postMessage({ type: 'script.host-request', request }, '*');
  return p;
}
