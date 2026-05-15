/// <reference types="vite/client" />

/**
 * Build metadata injected by electron-vite at build time. See
 * `electron.vite.config.ts` — the renderer target's `define` block.
 * `src/renderer/host/install-build-info.ts` feeds this into
 * `@openheaders/ui/shared/build-info`, the typed accessor seam consumers
 * should use.
 */
declare global {
  /**
   * Build metadata injected by electron-vite at build time. See
   * `electron.vite.config.ts` — the renderer target's `define` block.
   * `src/renderer/host/install-build-info.ts` feeds this into
   * `@openheaders/ui/shared/build-info`, the typed accessor seam consumers
   * should use.
   */
  const __BUILD_INFO__: {
    version: string;
    commit: string;
    commitFull: string;
    build: number;
    date: string;
    channel: 'stable' | 'beta';
  };

  /**
   * Preload-exposed RPC surface to the main-process engine host. Set up
   * by `apps/desktop/src/preload.ts` through `contextBridge`. Only the
   * IPC `HostBridge` adapter (`renderer/host/ipc-bridge.ts`) should
   * reach for this; everything else goes through `@openheaders/core/bridge`'s
   * `hostBridge` proxy.
   */
  interface Window {
    oh: {
      invoke(message: Record<string, unknown>): Promise<unknown>;
      onBroadcast(
        handler: (envelope: { type: string; payload: unknown }) => void,
      ): () => void;
    };
  }
}

export {};
