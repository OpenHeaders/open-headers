/**
 * Sandboxed script runner page — the desktop's Safe-mode isolation
 * wrapper around the shared script runtime
 * (`@openheaders/core/scripts/runtime` over the runner core), running
 * inside a hidden BrowserWindow created with `sandbox: true`,
 * `contextIsolation` and no Node integration. The page's CSP allows
 * `'unsafe-eval'` so `new Function(source)` can compile user scripts;
 * nothing else loads.
 *
 * Transport: the extension sandbox posts to its parent document; here
 * the page is top-level, so both directions ride `window.postMessage`
 * on the page's own window. The sandbox preload
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

import { createScriptRuntime } from '@openheaders/core/scripts/runtime';

const runtime = createScriptRuntime((message) => {
  window.postMessage(message, '*');
});

window.addEventListener('message', (ev) => {
  // Same-window transport — structural typing via the `type` tag is the
  // filter (the page also receives its own outbound posts; their types
  // are disjoint from the inbound set the runtime handles).
  runtime.handleMessage(ev.data);
});

// Signal readiness so the broker can fan execute requests in.
runtime.announceReady();
