/**
 * Engine-side hub seams for the rule fire stream.
 *
 * Mirrors the lifecycle / page hubs: `Sink` is the host-neutral delivery
 * seam. Chrome adapter wraps a runtime port; a desktop adapter would wrap
 * IPC; a daemon adapter would wrap WebSocket. Oracle never imports any
 * host-specific module — the hub only talks to `Sink`.
 *
 * The wire envelope `RuleFireWireMessage` lives in
 * `@openheaders/core/rule-fire-stream` so consumers can import it without
 * depending on oracle.
 */

import type { RuleFireUpdate } from '@openheaders/core/rule-fire-stream';

export interface Sink {
  /** First message after attach; signals the consumer the pipe is live. */
  deliverReady(tabId: number): void;
  /** Rule-fire update for the tab the sink attached to. */
  deliverUpdate(update: RuleFireUpdate): void;
  /** Hub-initiated close. Adapter MAY ignore if its transport
   *  disconnects itself. */
  close(): void;
}

/** Handle returned by `RuleFireHub.attach`. Idempotent on detach. */
export interface AttachmentHandle {
  readonly tabId: number;
  detach(): void;
}
