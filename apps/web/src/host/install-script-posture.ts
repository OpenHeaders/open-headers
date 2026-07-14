/**
 * Script-posture probe — asks the serving daemon ONCE per tab lifetime
 * whether forwarded sends run scripts, and registers the answer as the
 * `remoteScriptRuntime` capability so the request editor's Settings
 * tab renders the honest fact row: "Safe mode" against a daemon with
 * the fork-sandbox runtime, "don't run here" against a runtime-less
 * one (the SEA/Docker single binary). Never a chooser — the mode slot
 * belongs to the executing host, and forwarded sends only ever ride
 * Safe anyway.
 *
 * The channel is RBAC-gated daemon-side (workspace.read, like the jar
 * summary), so the ask waits for the first SYNCED handshake. A dead
 * wire or a pre-slice daemon that doesn't own the channel simply
 * leaves the capability unregistered — the honest default.
 */

import { registerCapability } from '@openheaders/core/capabilities';
import { hostLogger as logger } from '@openheaders/core/logger';
import type { DaemonWire } from './daemon-wire';
import { callWireRpc, registerWireRpcChannels } from './wire-rpc';

const SCOPE = 'ScriptPosture';

const CHANNEL = 'getScriptRuntimeInfo';

registerWireRpcChannels([CHANNEL]);

/** Latch the one-time posture ask onto the wire's first SYNCED state. */
export function watchDaemonScriptPosture(wire: DaemonWire): void {
  let asked = false;
  const unsubscribe = wire.subscribeHandshake((state) => {
    if (state !== 'synced' || asked) return;
    asked = true;
    unsubscribe();
    void callWireRpc({ type: CHANNEL })
      .then((payload) => {
        const info = payload as { scriptRuntime?: unknown } | null;
        if (info?.scriptRuntime === 'safe') {
          registerCapability('remoteScriptRuntime', () => 'safe');
          logger.info(SCOPE, 'daemon runs forwarded scripts in Safe mode');
        }
      })
      .catch((err: Error) => {
        // Older daemon / refused read — the fact row stays "don't run
        // here", which is exactly what a scriptless answer means.
        logger.info(SCOPE, `script posture unavailable: ${err.message}`);
      });
  });
}
