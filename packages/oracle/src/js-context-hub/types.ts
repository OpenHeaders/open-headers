/**
 * Engine-side hub seams for the JS-contexts stream.
 *
 * Mirrors `console-stream-hub/types.ts`: `Sink` is the host-neutral delivery
 * seam a chrome adapter wraps a runtime port with. The wire envelope
 * `JsContextsWireMessage` lives in `@openheaders/core/js-contexts` so
 * consumers can import it without depending on oracle.
 */

import type { JsContextUpdate } from '@openheaders/core/js-contexts';

export interface Sink {
  /** First message after attach; signals the consumer the pipe is live. */
  deliverReady(tabId: number): void;
  /** Contexts update for the tab the sink attached to. */
  deliverUpdate(update: JsContextUpdate): void;
  /** Hub-initiated close. Adapter MAY ignore if its transport disconnects
   *  itself. */
  close(): void;
}

/** Handle returned by `JsContextHub.attach`. Idempotent on detach. */
export interface AttachmentHandle {
  readonly tabId: number;
  detach(): void;
}
