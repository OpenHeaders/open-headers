/**
 * Wire envelope + sink seam for the request-lifecycle hub.
 *
 * `LifecycleWireMessage` is the only shape the hub emits. Two top-level
 * kinds keep `RequestLifecycleUpdate` semantically pure (engine→store
 * contract) — future wire-only concerns extend the envelope, not the
 * lifecycle union.
 *
 * `Sink` is the host-neutral delivery seam. The chrome adapter wraps a
 * `chrome.runtime.Port`; a desktop adapter would wrap an IPC channel; a
 * daemon adapter would wrap a WebSocket. Oracle never imports any of
 * those — the hub talks only to `Sink`.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';

export type LifecycleWireMessage =
  | { kind: 'ready'; tabId: number }
  | { kind: 'lifecycle-update'; update: RequestLifecycleUpdate };

export interface Sink {
  /** First message after attach; signals the consumer the pipe is live. */
  deliverReady(tabId: number): void;
  /** Lifecycle update for the tab the sink attached to. */
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
