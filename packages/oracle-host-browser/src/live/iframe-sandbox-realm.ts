/**
 * Sandbox iframe realm — the inside of the frame
 * `iframe-sandbox-transport.ts` mounts: the shared script runtime
 * (`@openheaders/core/scripts/runtime` over the runner core) wired to
 * the parent document over `postMessage`. The page that hosts it is
 * sandboxed (a unique opaque origin, `'unsafe-eval'` allowed so
 * `new Function(source)` compiles user scripts, `connect-src 'none'`
 * so a script opens no fetch / XHR / WebSocket of its own) — every
 * side-effecting `oh.*` call posts a `script.host-request` to the
 * parent and awaits the reply; the parent is the only thing that
 * speaks to a broker. The origin cannot be checked (opaque sandbox),
 * so the wire's `type` tag is the filter.
 *
 * Each host's sandbox page is then one line: mount the realm.
 */

import { createScriptRuntime } from '@openheaders/core/scripts/runtime';

export function mountIframeSandboxRealm(): void {
  const runtime = createScriptRuntime((message) => {
    window.parent.postMessage(message, '*');
  });
  window.addEventListener('message', (event) => {
    runtime.handleMessage(event.data);
  });
  // Readiness after the listener is attached — never before, so the
  // broker's first execute cannot race the wiring.
  runtime.announceReady();
}
