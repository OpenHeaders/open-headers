/**
 * Boot-time wiring: install the extension's build metadata into the
 * `@openheaders/ui` build-info seam.
 *
 * `__BUILD_INFO__` is injected by Vite at build time (see `vite.config.ts`
 * `buildInfo` constant). Every UI entry point (popup, workbench, devtools
 * panel, side panel) imports this module once at startup so UI code can
 * read build metadata through `@openheaders/ui/shared/build-info`'s
 * `getBuildInfo()` without depending on the Vite-specific global.
 */

import { setBuildInfo } from '@openheaders/ui/shared/build-info';

setBuildInfo(__BUILD_INFO__);
