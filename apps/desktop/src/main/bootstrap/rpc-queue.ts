/**
 * Pre-engine queueing handler for `oh:rpc`. Registered at module-load
 * time so the renderer's eager-mirror RPCs find a handler even when
 * they arrive before `installRpcHost` finishes. Calls wait on the
 * engine-readiness gate (`engine-readiness.ts`) then fall through to
 * the engine's dispatcher.
 *
 * The engine populates `getOhRpcDispatcher()` (in `install-rpc-host.ts`)
 * once its setup completes; `main.ts` signals the gate when the boot
 * settles.
 */

import { ipcMain } from 'electron';
import { getOhRpcDispatcher } from '../install-rpc-host';
import type { EngineReadiness } from './engine-readiness';

const RPC_CHANNEL = 'oh:rpc';

export function installRpcQueue(readiness: EngineReadiness): void {
  ipcMain.handle(RPC_CHANNEL, async (_event, raw: unknown) => {
    let dispatcher = getOhRpcDispatcher();
    if (!dispatcher) {
      await readiness.whenReady();
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
}
