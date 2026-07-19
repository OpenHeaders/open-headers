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
    build: number;
    date: string;
    channel: 'stable' | 'beta';
  };

  /**
   * App version string injected by electron-vite at build time. See
   * `electron.vite.config.ts` — the renderer target's `define` block.
   * Consumed by `@openheaders/ui`'s status bar components.
   */
  const __APP_VERSION__: string;

  /**
   * Preload-exposed RPC surface to the main-process engine host. Set up
   * by `apps/desktop/src/preload.ts` through `contextBridge`. Only the
   * IPC `HostBridge` adapter (`renderer/host/ipc-bridge.ts`) should
   * reach for this; everything else goes through `@openheaders/core/bridge`'s
   * `hostBridge` proxy.
   */
  interface Window {
    oh: {
      platform: 'darwin' | 'win32' | 'linux' | 'aix' | 'freebsd' | 'openbsd' | 'sunos' | 'cygwin' | 'netbsd';
      invoke(message: Record<string, unknown>): Promise<unknown>;
      onBroadcast(handler: (envelope: { type: string; payload: unknown }) => void): () => void;
      storage: {
        get(req: { key: string }): Promise<{ value: unknown; seq: number }>;
        set(req: { key: string; value: unknown }): Promise<{ seq: number }>;
        getMany(req: { keys: string[] }): Promise<{
          entries: Array<{ key: string; value: unknown; seq: number }>;
        }>;
        setMany(req: { writes: Array<{ key: string; value: unknown }> }): Promise<{
          seqs: Array<{ key: string; seq: number }>;
        }>;
        remove(req: { keys: string[] }): Promise<{
          seqs: Array<{ key: string; seq: number }>;
        }>;
        subscribe(req: { key: string; lastSeenSeq?: number }): Promise<{
          value: unknown;
          seq: number;
          stale: boolean;
        }>;
        unsubscribe(req: { key: string }): Promise<void>;
        onChange(handler: (envelope: { key: string; value: unknown; seq: number }) => void): () => void;
      };
      lifeline: {
        open(req: { portId: string; name: string }): Promise<{ ok: boolean; error?: string }>;
        message(req: { portId: string; message: unknown }): void;
        close(req: { portId: string }): void;
        onHostMessage(handler: (envelope: { portId: string; message: unknown }) => void): () => void;
        onHostDisconnect(handler: (envelope: { portId: string; errorMessage?: string }) => void): () => void;
      };
      openExternal(url: string): Promise<{ ok: boolean; error?: string }>;
      protocol: {
        onUrl(handler: (url: string) => void): () => void;
      };
      terminal: {
        spawn(req: { cols: number; rows: number }): Promise<{ ok: true; id: string } | { ok: false; error: string }>;
        write(req: { id: string; data: string }): void;
        resize(req: { id: string; cols: number; rows: number }): void;
        kill(req: { id: string }): void;
        onData(handler: (envelope: { id: string; data: string }) => void): () => void;
        onExit(handler: (envelope: { id: string; exitCode: number }) => void): () => void;
      };
    };
  }
}

export {};
