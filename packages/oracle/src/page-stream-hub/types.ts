/**
 * Engine-side hub seams for the page stream.
 *
 * Mirrors the lifecycle hub: `Sink` is the host-neutral delivery seam,
 * adapters (chrome port, electron IPC, daemon WS) wrap their transport.
 * Oracle never imports any host-specific module — the hub only talks to
 * `Sink`. The wire envelope `PageWireMessage` lives in
 * `@openheaders/core/page-stream` so consumers can import it without
 * depending on oracle.
 */

import type { PageStreamUpdate } from '@openheaders/core/page-stream';

export interface Sink {
  /** First message after attach; signals the consumer the pipe is live. */
  deliverReady(tabId: number): void;
  /** Page update for the tab the sink attached to. */
  deliverUpdate(update: PageStreamUpdate): void;
  /** Hub-initiated close. Adapter MAY ignore if its transport
   *  disconnects itself. */
  close(): void;
}

/** Handle returned by `PageStreamHub.attach`. Idempotent on detach. */
export interface AttachmentHandle {
  readonly tabId: number;
  detach(): void;
}
