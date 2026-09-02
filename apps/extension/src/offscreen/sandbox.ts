/**
 * Sandboxed script runner (ARCHITECTURE §19) — the extension's iframe
 * wrapper around the shared script runtime
 * (`@openheaders/core/scripts/runtime` over the runner core).
 *
 * Lives inside `sandbox.html`, which is served by the manifest under
 * `sandbox.pages` — unique opaque origin, no chrome.* access, and CSP
 * allows `'unsafe-eval'` so `new Function(source)` can compile user
 * scripts. Any extension page may mount it: the offscreen document
 * does for the service worker's HTTP scripts, the workbench page does
 * for its in-page sessions' hooks.
 *
 * We never touch storage / network / extension APIs directly. Every
 * side-effecting `oh.*` call posts a `script.host-request` to the
 * parent document and awaits the reply; the parent is the only thing
 * that speaks to a broker. The sandbox binding is `oh` only — no
 * compatibility aliases; any legacy identifier rewriting lives at
 * import time, not runtime.
 */

import { createScriptRuntime } from '@openheaders/core/scripts/runtime';

const runtime = createScriptRuntime((message) => {
  window.parent.postMessage(message, '*');
});

window.addEventListener('message', (ev) => {
  // We can't check origin reliably (opaque sandbox) — structural typing
  // via the `type` tag is the filter.
  runtime.handleMessage(ev.data);
});

// Signal readiness so the broker can fan execute requests in.
runtime.announceReady();
