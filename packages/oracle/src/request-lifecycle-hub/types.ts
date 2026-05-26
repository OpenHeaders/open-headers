/**
 * Engine-side hub seams.
 *
 * `Sink` is the host-neutral delivery seam. The chrome adapter wraps a
 * `chrome.runtime.Port`; a desktop adapter would wrap an IPC channel; a
 * daemon adapter would wrap a WebSocket. Oracle never imports any of
 * those — the hub talks only to `Sink`.
 *
 * The wire envelope `LifecycleWireMessage` itself lives in
 * `@openheaders/core/request-lifecycle` so the consumer side
 * (`@openheaders/ui`) can import it without depending on oracle.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';

export interface Sink {
  /** First message after attach; signals the consumer the pipe is live. */
  deliverReady(tabId: number): void;
  /**
   * Lifecycle update for the tab the sink attached to.
   *
   * Reentrancy contract: `deliverUpdate` MUST NOT re-enter the store
   * (e.g. by synchronously calling `store.apply(...)`). Sinks are pure
   * delivery channels — re-entry during `attach`'s replay loop would
   * interleave live updates into the replay stream for this and every
   * other attached sink.
   */
  deliverUpdate(update: RequestLifecycleUpdate): void;
  /**
   * Hub-initiated close. The adapter MAY ignore (e.g. if the underlying
   * transport disconnects itself); the hub uses this to signal "you've
   * been detached," not the other way around.
   */
  close(): void;
}

/** Handle returned by `RequestLifecycleHub.attach`. Idempotent on detach. */
export interface AttachmentHandle {
  readonly tabId: number;
  detach(): void;
}
