/**
 * The standing background end of the page-relayed WebSocket frame-capture
 * channel — sibling of {@link ../correlator-host/override-source}.
 *
 * A ws rule's MAIN-world wrapper relays each frame it acted on
 * (`window.postMessage` → `fire-bridge-content` → the `tabMessageCapture`
 * message handler), which calls {@link push} here. The lifecycle pipeline
 * subscribes and joins each capture to the open WebSocket lifecycle by
 * `(tabId, url, time window)` — the page never knows the requestId.
 *
 * A module singleton — the message handler (producer) and the pipeline
 * (consumer) reach the one instance without threading it through the
 * pipeline handles. One SW context, one source.
 */

import type { StreamMessageCapture } from '@openheaders/core/request-lifecycle';

export interface MessageCaptureEvent {
  readonly tabId: number;
  /** The resolved ws(s) endpoint the wrapper reported. */
  readonly url: string;
  readonly capture: StreamMessageCapture;
}

class ChromeMessageCaptureSource {
  private readonly listeners = new Set<(event: MessageCaptureEvent) => void>();

  subscribe(listener: (event: MessageCaptureEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Fan a page-relayed frame capture to the subscribed pipeline. */
  push(event: MessageCaptureEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

/** The one source instance — produced into by the message handler,
 *  consumed by the lifecycle pipeline's store join. */
export const messageCaptureSource = new ChromeMessageCaptureSource();
