/**
 * SW-side awareness lifeline port handler.
 *
 * Each renderer surface opens a long-lived `chrome.runtime.Port` named
 * `oh.awareness.lifeline:<instanceId>` for its lifetime. The port's
 * `onDisconnect` is the canonical liveness signal — it fires when the
 * surface unmounts, the tab closes, the document navigates away, or
 * the SW is evicted (which auto-reconnects on the renderer side).
 *
 * Connection-bound liveness replaces the previous heartbeat-with-TTL
 * scheme. Heartbeat-based liveness is fundamentally polling and
 * therefore fails under any timer throttling — Chrome aggressively
 * throttles `setInterval` in background tabs, which used to cause
 * presence rows to flap as surfaces missed heartbeats and got pruned
 * before being re-published. The TTL stays in `awareness.ts` as a
 * defensive backstop only (5 min, see `AWARENESS_TTL_MS`).
 *
 * Same shape as the popup/sidepanel `presence(name)` plumbing in
 * `utils/bridge/index.ts` and identical to how every awareness library
 * (Yjs, Liveblocks, Figma, Linear, …) tracks liveness — bound to
 * transport, not polled. The transport here is `chrome.runtime.Port`;
 * for the future Mode 2/3 standalone oracle (`.notes/oracle-arc.md`)
 * the same shape applies with WebSocket close events instead.
 */

import { logger } from '@utils/logger';

const LIFELINE_PREFIX = 'oh.awareness.lifeline:' as const;

export function buildLifelinePortName(instanceId: string): string {
  return `${LIFELINE_PREFIX}${instanceId}`;
}

function parseInstanceId(portName: string): string | null {
  if (!portName.startsWith(LIFELINE_PREFIX)) return null;
  const id = portName.slice(LIFELINE_PREFIX.length);
  return id.length > 0 ? id : null;
}

/**
 * Register the lifeline port handler. Idempotent — safe to call
 * multiple times (no-ops on subsequent calls). Wire once at SW boot
 * from `background.ts`, passing the awareness-service mutator that
 * removes a presence row by instanceId.
 */
let setupDone = false;
export function setupAwarenessLifelinePorts(removeByInstanceId: (instanceId: string) => void): void {
  if (setupDone) return;
  setupDone = true;
  if (!chrome?.runtime?.onConnect?.addListener) {
    logger.info('AwarenessLifeline', 'runtime.onConnect unavailable — lifeline disabled');
    return;
  }
  chrome.runtime.onConnect.addListener((port) => {
    const instanceId = parseInstanceId(port.name);
    if (!instanceId) return; // Not an awareness lifeline port — pass through.

    port.onDisconnect.addListener(() => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        logger.info('AwarenessLifeline', `lifeline disconnect error: ${lastError.message}`);
      }
      try {
        removeByInstanceId(instanceId);
      } catch (err) {
        logger.info('AwarenessLifeline', `removeByInstanceId failed: ${(err as Error).message}`);
      }
    });
  });
}

/** Test-only — reset the idempotency latch so tests can re-register. */
export function __resetAwarenessLifelineSetupForTests(): void {
  setupDone = false;
}
