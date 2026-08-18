/**
 * Browser console-plane streaming wire types — the observability plane's
 * console channels on the extension ↔ daemon WebSocket
 * (the observability plan Phase 4).
 *
 * The console plane is push-shaped (page-emitted events, not pulls), so
 * the wire mirrors the lifecycle trio, NOT the storage relay: a
 * forwarded subscribe opens one extension-side stream session per
 * `(wire, tab, consumer)`, and the extension fans tick-coalesced runs of
 * `ConsoleStreamWireMessage` envelopes back — the SAME envelopes the
 * in-browser panel's `oh-console:<tabId>` port carries, so the receiving
 * side needs no second reducer vocabulary.
 *
 *   - host → extension: {@link TelemetryConsoleConsumerMessage} opens
 *     one workbench consumer's watch on one browser tab;
 *     {@link TelemetryConsoleDetachMessage} ends it (per-consumer
 *     streams are the telemetry plane's law).
 *   - extension → host: {@link TelemetryConsoleBatchMessage} carries an
 *     ordered run of console wire envelopes for exactly that consumer's
 *     session — a `ready` always precedes its replay, replay precedes
 *     live.
 *
 * View-only by construction: the wire carries no eval verbs — the only
 * host→extension frames are the watch handshake. Arbitrary desktop→page
 * eval is scriptable-plane territory (PLAN §9); the storage relay's
 * method whitelist and this frame set are the enforcement points.
 *
 * Capture itself is Debug-mode (CDP) gated: a tab outside the attach
 * scope streams nothing beyond `ready` — the consumer renders why, fed
 * by the peer's `TelemetryDebugState` from the inventory reply.
 *
 * Same privacy posture as the lifecycle channels: the extension honors
 * console frames from SAME-DEVICE (loopback) wires only.
 */

import { CONSOLE_STREAM_PORT_PREFIX, type ConsoleStreamWireMessage } from '../console-stream';

export const TELEMETRY_CONSOLE_CONSUMER_TYPE = 'oh.telemetry.console.consumer' as const;
export const TELEMETRY_CONSOLE_DETACH_TYPE = 'oh.telemetry.console.detach' as const;
export const TELEMETRY_CONSOLE_BATCH_TYPE = 'oh.telemetry.console.batch' as const;

/** Host → extension: one workbench consumer starts watching a tab's
 *  console stream (`consumerId` minted by the host's relay). */
export interface TelemetryConsoleConsumerMessage {
  type: typeof TELEMETRY_CONSOLE_CONSUMER_TYPE;
  tabId: number;
  consumerId: string;
}

/** Host → extension: the consumer's console watch ended. */
export interface TelemetryConsoleDetachMessage {
  type: typeof TELEMETRY_CONSOLE_DETACH_TYPE;
  tabId: number;
  consumerId: string;
}

/**
 * Extension → host: an ordered, tick-coalesced run of console wire
 * envelopes for one tab, addressed to the one consumer whose session
 * produced it.
 */
export interface TelemetryConsoleBatchMessage {
  type: typeof TELEMETRY_CONSOLE_BATCH_TYPE;
  tabId: number;
  consumerId: string;
  messages: ConsoleStreamWireMessage[];
}

export type TelemetryConsoleWireMessage =
  | TelemetryConsoleConsumerMessage
  | TelemetryConsoleDetachMessage
  | TelemetryConsoleBatchMessage;

/**
 * A console watch addressed THROUGH a host to a remote extension —
 * `oh-console:<tabId>@<nodeId>`, the console sibling of the qualified
 * lifecycle port. Browser-tab ids collide across browsers, so the peer
 * qualifier is part of the watch identity — never inferred. The
 * unqualified local parser (`parseConsoleStreamPortName`) rejects this
 * shape by construction.
 */
export interface QualifiedConsolePortTarget {
  readonly tabId: number;
  readonly nodeId: string;
}

export function qualifiedConsolePortName(tabId: number, nodeId: string): string {
  return `${CONSOLE_STREAM_PORT_PREFIX}${tabId}@${nodeId}`;
}

/** Parse `oh-console:<tabId>@<nodeId>`. Returns `null` for any other shape. */
export function parseQualifiedConsolePortName(name: string): QualifiedConsolePortTarget | null {
  if (!name.startsWith(CONSOLE_STREAM_PORT_PREFIX)) return null;
  const suffix = name.slice(CONSOLE_STREAM_PORT_PREFIX.length);
  const at = suffix.indexOf('@');
  if (at <= 0) return null;
  const tabPart = suffix.slice(0, at);
  const nodeId = suffix.slice(at + 1);
  if (!/^-?\d+$/.test(tabPart) || nodeId.length === 0) return null;
  const tabId = Number.parseInt(tabPart, 10);
  if (!Number.isFinite(tabId)) return null;
  return { tabId, nodeId };
}
