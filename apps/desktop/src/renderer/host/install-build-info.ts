/**
 * Boot-time wiring: install the desktop's build metadata into the
 * `@openheaders/ui` build-info seam.
 *
 * `__BUILD_INFO__` is injected by electron-vite at build time (see
 * `electron.vite.config.ts` — the renderer target's `define` block).
 * UI code reads build metadata through `getBuildInfo()` without
 * depending on the Vite-specific global; this module is the only place
 * the global is referenced.
 */

import { setBuildInfo } from '@openheaders/ui/shared/build-info';

setBuildInfo(__BUILD_INFO__);
