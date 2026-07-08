/// <reference types="vite/client" />

/** Build-time constant injected by Vite from package.json version. */
declare const __APP_VERSION__: string;

/**
 * Build metadata injected by Vite at build time. See `vite.config.ts`
 * (`buildInfo` constant); `src/host/install-build-info.ts` feeds this
 * into `@openheaders/ui/shared/build-info`, the typed accessor seam
 * consumers should use.
 */
declare const __BUILD_INFO__: {
  version: string;
  commit: string;
  commitFull: string;
  build: number;
  date: string;
  channel: 'stable' | 'beta';
};
