/**
 * The served web app's script sandbox — the realm entry: the shared
 * sandbox iframe realm (`@openheaders/oracle-host-browser`) over the
 * shared script runtime. `vite.sandbox-plugin.ts` bundles it standalone
 * into core's self-contained sandbox document (`scriptSandboxDocument`
 * — the script inline, the policy as a meta tag: a unique opaque
 * origin by the frame's sandbox attribute, `'unsafe-eval'` for the
 * user scripts it compiles, nothing loaded from anywhere, no network
 * of its own) and the workbench tab mounts that document hidden as
 * `srcdoc`, driving it over `postMessage`; every `oh.*` call crosses
 * back to the tab as a typed host request.
 */

import { mountIframeSandboxRealm } from '@openheaders/oracle-host-browser/live/iframe-sandbox-realm';

mountIframeSandboxRealm();
