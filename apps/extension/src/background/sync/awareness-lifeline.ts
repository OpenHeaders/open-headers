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
 * Bind message published by the renderer-side lifeline immediately
 * after `chrome.runtime.connect` resolves. The SW trusts the
 * `workspaceId` field per the lifeline trust contract (design
 * § 4.0.7): workbench's slice resolver corrects stale bindings BEFORE
 * the lifeline fires (lint #14 pins the mount-time ordering); system
 * surfaces send their runtime-Active workspaceId. SW-side validation
 * would duplicate work the renderer already performed.
 */
export interface LifelineBindMessage {
  /** Discriminator so future port-message types can land alongside. */
  kind: 'bind';
  /** Workspace the surface is currently editing or rendering for. */
  workspaceId: string;
}

function isBindMessage(m: unknown): m is LifelineBindMessage {
  if (!m || typeof m !== 'object') return false;
  const obj = m as { kind?: unknown; workspaceId?: unknown };
  return obj.kind === 'bind' && typeof obj.workspaceId === 'string' && obj.workspaceId.length > 0;
}

export interface LifelinePortHooks {
  /** Awareness presence cleanup — runs unconditionally on disconnect. */
  removeByInstanceId: (instanceId: string) => void;
  /**
   * Workspace-service refcount acquire — invoked on the first `bind`
   * message a port sends. Subsequent `bind` messages on the same port
   * (rebinds) release the previous workspace before acquiring the new
   * one, so the refcount stays balanced across in-flight rebinds.
   */
  acquireWorkspace: (workspaceId: string) => void;
  /** Workspace-service refcount release — invoked on rebind + on disconnect. */
  releaseWorkspace: (workspaceId: string) => void;
}

/**
 * Register the lifeline port handler. Idempotent — safe to call
 * multiple times (no-ops on subsequent calls). Wire once at SW boot
 * from `background.ts`, passing the awareness-service mutator and the
 * workspace-service refcount hooks.
 *
 * Lifelines do double duty per design § 4.0.7: liveness (presence
 * cleanup on disconnect) AND `WorkspaceServiceState` refcount handles
 * (acquire on `bind`, release on disconnect or rebind). One port ↔ at
 * most one workspace ref outstanding; the per-port `boundWorkspaceId`
 * makes the bracketing structural — no duplicate-acquire / mismatched-
 * release windows.
 */
let setupDone = false;
export function setupAwarenessLifelinePorts(hooks: LifelinePortHooks): void {
  if (setupDone) return;
  setupDone = true;
  if (!chrome?.runtime?.onConnect?.addListener) {
    logger.info('AwarenessLifeline', 'runtime.onConnect unavailable — lifeline disabled');
    return;
  }
  chrome.runtime.onConnect.addListener((port) => {
    const instanceId = parseInstanceId(port.name);
    if (!instanceId) return; // Not an awareness lifeline port — pass through.

    let boundWorkspaceId: string | null = null;

    port.onMessage.addListener((raw) => {
      if (!isBindMessage(raw)) return;
      // Rebind: release prior workspace BEFORE acquiring the new one
      // so the refcount on the old workspace can drop to 0 and start
      // its grace timer cleanly. Same workspaceId is a no-op (acquire
      // would just bump-then-release on next message; cheaper to skip).
      if (boundWorkspaceId === raw.workspaceId) return;
      if (boundWorkspaceId !== null) {
        try {
          hooks.releaseWorkspace(boundWorkspaceId);
        } catch (err) {
          logger.info('AwarenessLifeline', `releaseWorkspace(rebind) failed: ${(err as Error).message}`);
        }
      }
      boundWorkspaceId = raw.workspaceId;
      try {
        hooks.acquireWorkspace(raw.workspaceId);
      } catch (err) {
        // If acquire throws (workspace deleted mid-message), zero the
        // bound id so onDisconnect doesn't double-release. The presence
        // sweep on disconnect still runs.
        boundWorkspaceId = null;
        logger.info('AwarenessLifeline', `acquireWorkspace failed: ${(err as Error).message}`);
      }
    });

    port.onDisconnect.addListener(() => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        logger.info('AwarenessLifeline', `lifeline disconnect error: ${lastError.message}`);
      }
      if (boundWorkspaceId !== null) {
        const id = boundWorkspaceId;
        boundWorkspaceId = null;
        try {
          hooks.releaseWorkspace(id);
        } catch (err) {
          logger.info('AwarenessLifeline', `releaseWorkspace failed: ${(err as Error).message}`);
        }
      }
      try {
        hooks.removeByInstanceId(instanceId);
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
