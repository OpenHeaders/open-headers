/**
 * Build metadata injected by Vite at bundle time (`buildInfo` in
 * `vite.config.ts`). Absent in unbundled runs (vitest, tsc) — access
 * only through `src/build-info.ts`, which guards for that.
 */
declare const __BUILD_INFO__:
  | {
      version: string;
      commit: string;
      commitFull: string;
      build: number;
      date: string;
      channel: 'stable' | 'beta';
    }
  | undefined;
