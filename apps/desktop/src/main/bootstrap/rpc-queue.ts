/**
 * Pre-engine queueing handler for `oh:rpc`. Registered at module-load
 * time so the renderer's eager-mirror RPCs find a handler even when
 * they arrive before `installRpcHost` finishes. Calls await
 * `engineReadyPromise` then fall through to the engine's dispatcher.
 *
 * The engine populates `getOhRpcDispatcher()` (in `install-rpc-host.ts`)
 * once its setup completes; the caller signals readiness via the
 * returned `signalEngineReady`.
 */

import { ipcMain } from 'electron';
import { getOhRpcDispatcher } from '../install-rpc-host';

const RPC_CHANNEL = 'oh:rpc';

export type RpcQueueHandle = {
  signalEngineReady: () => void;
};

export function installRpcQueue(): RpcQueueHandle {
  let resolveEngineReady!: () => void;
  const engineReadyPromise = new Promise<void>((resolve) => {
    resolveEngineReady = resolve;
  });

  ipcMain.handle(RPC_CHANNEL, async (_event, raw: unknown) => {
    let dispatcher = getOhRpcDispatcher();
    if (!dispatcher) {
      await engineReadyPromise;
      dispatcher = getOhRpcDispatcher();
    }
    if (!dispatcher) {
      return { __error: 'desktop main: oh:rpc dispatcher unavailable after engine boot' };
    }
    return dispatcher(raw);
  });

  // No handler teardown on quit: `before-quit` fires while renderer
  // windows are still alive and flushing state, so deregistering here
  // turns their last calls into "No handler registered" errors. The
  // handler dies with the process.

  return { signalEngineReady: () => resolveEngineReady() };
}
