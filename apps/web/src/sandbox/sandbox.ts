/**
 * The served web app's script sandbox — the `sandbox.html` entry: the
 * shared sandbox iframe realm (`@openheaders/oracle-host-browser`)
 * over the shared script runtime. The page is emitted self-contained
 * by `vite.sandbox-plugin.ts` and served under the sandbox CSP
 * (`@openheaders/core/scripts` — `WEB_SANDBOX_CSP`): a unique opaque
 * origin, `'unsafe-eval'` for the user scripts it compiles, nothing
 * loaded from anywhere, no network of its own. The workbench tab
 * mounts it hidden and drives it over `postMessage`; every `oh.*`
 * call crosses back to the tab as a typed host request.
 */

import { mountIframeSandboxRealm } from '@openheaders/oracle-host-browser/live/iframe-sandbox-realm';

mountIframeSandboxRealm();
