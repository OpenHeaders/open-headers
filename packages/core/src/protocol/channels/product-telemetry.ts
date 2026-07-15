/**
 * Product-telemetry RPCs (`TELEMETRY_PLAN.md` §6/§7) — the seam between
 * UI surfaces and the host-owned `TelemetryClient`. Exactly one client
 * lives per host (extension SW / desktop main); surfaces never construct
 * one and never open the socket themselves.
 *
 * Named "product telemetry" throughout: plain "telemetry" in this
 * codebase already means per-tab traffic telemetry (the inspector's own
 * request stream), which is unrelated to this channel.
 */

import type { TelemetryDisposition, TelemetryEvent } from '../../telemetry';

/** One session-log entry, as the telemetry inspector renders it. */
export interface ProductTelemetryLogEntryWire {
  event: TelemetryEvent;
  /** ms since epoch at track() time. */
  at: number;
  disposition: TelemetryDisposition;
}

/** Everything the inspector shows: the log plus the channel's current gates. */
export interface ProductTelemetrySnapshot {
  sessionId: string;
  enabled: boolean;
  disclosed: boolean;
  entries: ProductTelemetryLogEntryWire[];
}

export interface ProductTelemetryRpc {
  /** Record one vocabulary event on the host's client. Fire-and-forget semantics — the response only acknowledges receipt. */
  productTelemetryTrack: { req: { event: TelemetryEvent }; res: { success: boolean } };
  /** Read the session event log + channel gates for the telemetry inspector. */
  productTelemetryRead: { req: Record<string, never>; res: ProductTelemetrySnapshot };
}
