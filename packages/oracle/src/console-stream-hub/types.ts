/**
 * Engine-side hub seams for the console stream.
 *
 * Mirrors the lifecycle / page / rule-fire hubs: `Sink` is the host-neutral
 * delivery seam. A chrome adapter wraps a runtime port; a desktop adapter
 * would wrap IPC; a daemon adapter would wrap WebSocket. Oracle never imports
 * any host-specific module — the hub only talks to `Sink`.
 *
 * The wire envelope `ConsoleStreamWireMessage` lives in
 * `@openheaders/core/console-stream` so consumers can import it without
 * depending on oracle.
 */

import type { ConsoleStreamUpdate } from '@openheaders/core/console-stream';

export interface Sink {
  /** First message after attach; signals the consumer the pipe is live. */
  deliverReady(tabId: number): void;
  /** Console update for the tab the sink attached to. */
  deliverUpdate(update: ConsoleStreamUpdate): void;
  /** Hub-initiated close. Adapter MAY ignore if its transport disconnects
   *  itself. */
  close(): void;
}

/** Handle returned by `ConsoleStreamHub.attach`. Idempotent on detach. */
export interface AttachmentHandle {
  readonly tabId: number;
  detach(): void;
}
