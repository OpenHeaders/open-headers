/**
 * Boot-time wiring: install the web app's build metadata into the
 * `@openheaders/ui` build-info seam. `__BUILD_INFO__` is injected by
 * Vite at build time (see `vite.config.ts`).
 */

import { setBuildInfo } from '@openheaders/ui/shared/build-info';

setBuildInfo(__BUILD_INFO__);
