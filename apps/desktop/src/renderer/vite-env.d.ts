/// <reference types="vite/client" />

/**
 * Build metadata injected by electron-vite at build time. See
 * `electron.vite.config.ts` — the renderer target's `define` block.
 * `src/renderer/host/install-build-info.ts` feeds this into
 * `@openheaders/ui/shared/build-info`, the typed accessor seam consumers
 * should use.
 */
declare const __BUILD_INFO__: {
  version: string;
  commit: string;
  commitFull: string;
  build: number;
  date: string;
  channel: 'stable' | 'beta';
};
