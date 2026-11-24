/**
 * Watched browsers' Debug-mode posture, shared across the workbench
 * surfaces that show or drive it outside the Traffic tool's source rail —
 * an inspected request's editor tab outlives the tool window and can be
 * restored without it.
 *
 * One answer per browser (`nodeId`, the peer's stable qualifier), fed by
 * whoever learns it:
 *   - the Traffic tool publishes every inventory snapshot it holds, so
 *     the answer stays live while the tool is mounted;
 *   - a control command's reply is the browser's post-command snapshot;
 *   - a surface mounted without the tool asks once
 *     ({@link loadPeerDebugStates}) — one inventory read fills every
 *     connected browser.
 *
 * Module scope like the Traffic tool's own cross-mount state: plain
 * values, no lifeline of its own.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { TelemetryDebugCommand, TelemetryDebugState } from '@openheaders/core/protocol';
import type { CdpScopeMode } from '@openheaders/core/types';

const states = new Map<string, TelemetryDebugState>();
const listeners = new Set<() => void>();
/** An inventory read has settled — a browser still unknown is not reachable. */
let inventoryRead = false;
let reading: Promise<void> | null = null;

function sameTabs(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((tabId, index) => tabId === b[index]);
}

function sameState(a: TelemetryDebugState, b: TelemetryDebugState): boolean {
  return (
    a.available === b.available &&
    a.enabled === b.enabled &&
    a.scope === b.scope &&
    sameTabs(a.attachedTabs, b.attachedTabs) &&
    sameTabs(a.pinnedTabs, b.pinnedTabs)
  );
}

function notify(): void {
  for (const listener of listeners) listener();
}

/** Record one browser's posture. A snapshot that changes nothing notifies no one. */
export function publishPeerDebugState(nodeId: string, debug: TelemetryDebugState): void {
  const held = states.get(nodeId);
  if (held !== undefined && sameState(held, debug)) return;
  states.set(nodeId, debug);
  notify();
}

export function subscribePeerDebugStates(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The browser's posture, or `undefined` while nobody has learned it. */
export function readPeerDebugState(nodeId: string): TelemetryDebugState | undefined {
  return states.get(nodeId);
}

/** True once an inventory read has settled, answered or not. */
export function peerDebugStatesRead(): boolean {
  return inventoryRead;
}

/**
 * Ask the host for every connected browser's posture, once at a time.
 * A read the host could not answer settles too, and leaves what is held.
 */
export function loadPeerDebugStates(): Promise<void> {
  if (reading !== null) return reading;
  reading = hostBridge
    .call('oh.daemon.telemetry.tabs.list')
    .then(
      (response) => {
        for (const peer of response.peers) publishPeerDebugState(peer.nodeId, peer.debug);
      },
      () => {},
    )
    .finally(() => {
      reading = null;
      if (inventoryRead) return;
      inventoryRead = true;
      notify();
    });
  return reading;
}

/**
 * Debug mode covers the tab: the browser's switch is on and the tab is in
 * its scope — attached, or included and attaching. A switch that is on for
 * other tabs only does not count: this tab's requests still carry no body.
 */
export function isTabCovered(debug: TelemetryDebugState, tabId: number): boolean {
  return debug.enabled && (debug.attachedTabs.includes(tabId) || debug.pinnedTabs.includes(tabId));
}

async function sendDebugCommand(nodeId: string, command: TelemetryDebugCommand): Promise<void> {
  const response = await hostBridge.call('oh.daemon.telemetry.debug.control', { nodeId, command });
  if (response.ok && response.debug !== null) publishPeerDebugState(nodeId, response.debug);
}

/** Run one gesture's commands. A browser that is gone answers nothing, and
 *  what is held stands. */
async function gesture(run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch {
    // The host could not reach the browser; the held posture stands.
  }
}

/**
 * Turn the browser's Debug mode on FOR one tab: include the tab, then flip
 * the switch. A pin is recorded while the switch is off, so the tab
 * attaches the moment it flips — the switch alone attaches only what its
 * scope already names, which a tab with DevTools closed usually is not.
 */
export function enableDebugModeForTab(nodeId: string, tabId: number): Promise<void> {
  return gesture(async () => {
    if (states.get(nodeId)?.pinnedTabs.includes(tabId) !== true) {
      await sendDebugCommand(nodeId, { kind: 'pin', tabId, pinned: true });
    }
    if (states.get(nodeId)?.enabled !== true) {
      await sendDebugCommand(nodeId, { kind: 'enable', enabled: true });
    }
  });
}

/** Turn the browser's Debug mode off. Pins stay, as they do from the source rail. */
export function disableDebugMode(nodeId: string): Promise<void> {
  return gesture(() => sendDebugCommand(nodeId, { kind: 'enable', enabled: false }));
}

/** Include one tab in the browser's Debug mode, or take it out. */
export function setTabIncluded(nodeId: string, tabId: number, included: boolean): Promise<void> {
  return gesture(() => sendDebugCommand(nodeId, { kind: 'pin', tabId, pinned: included }));
}

/** Choose which tabs the browser's Debug mode attaches on its own. */
export function setDebugScope(nodeId: string, scope: CdpScopeMode): Promise<void> {
  return gesture(() => sendDebugCommand(nodeId, { kind: 'scope', scope }));
}

/** Drop everything held — tests only. */
export function __resetPeerDebugStatesForTests(): void {
  states.clear();
  listeners.clear();
  inventoryRead = false;
  reading = null;
}
