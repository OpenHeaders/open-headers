/**
 * Sandboxed script runner (ARCHITECTURE §19) — the extension's
 * `sandbox.html` entry: the shared sandbox iframe realm
 * (`@openheaders/oracle-host-browser`) over the shared script runtime.
 *
 * The page is served by the manifest under `sandbox.pages` — unique
 * opaque origin, no chrome.* access, `'unsafe-eval'` allowed so
 * `new Function(source)` compiles user scripts, `connect-src 'none'`.
 * Any extension page may mount it: the offscreen document does for the
 * service worker's HTTP scripts, the workbench page does for its
 * in-page sessions' hooks. The sandbox binding is `oh` only — no
 * compatibility aliases; any legacy identifier rewriting lives at
 * import time, not runtime.
 */

import { mountIframeSandboxRealm } from '@openheaders/oracle-host-browser/live/iframe-sandbox-realm';

mountIframeSandboxRealm();
