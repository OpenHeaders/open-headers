/**
 * `TabSinkRegistry<TUpdate>` — per-tab sink fanout substrate shared by
 * `RequestLifecycleHub`, `PageStreamHub`, and `RuleFireHub`.
 *
 * Owns the `Map<tabId, Set<Sink>>` registry, the dispose flag, attach +
 * detach-handle wiring, and the best-effort `broadcast` / `close` loops.
 * Hubs compose one as a private field — they keep ownership of their
 * state, notify verbs, and replay shape; the registry handles only the
 * fanout substrate. JS single-threaded delivery contract is preserved
 * because `attach` runs `deliverReady` + the caller-supplied replay as
 * one synchronous block before returning.
 */

export interface FanoutSink<TUpdate> {
  deliverReady(tabId: number): void;
  deliverUpdate(update: TUpdate): void;
  /**
   * Substrate-level tab-cleared signal. Optional because hubs whose
   * `TUpdate` already carries a `tab-cleared` variant route it through
   * `deliverUpdate`; only the request-lifecycle pipe needs a separate
   * channel (its `RequestLifecycleUpdate` is the engine→store contract
   * and must stay pure).
   */
  deliverTabCleared?(tabId: number): void;
  close(): void;
}

export interface FanoutAttachmentHandle {
  readonly tabId: number;
  detach(): void;
}

export class TabSinkRegistry<TUpdate> {
  private readonly tabs = new Map<number, Set<FanoutSink<TUpdate>>>();
  private readonly hubName: string;
  private disposed = false;

  constructor(hubName: string) {
    this.hubName = hubName;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  guardDisposed(): void {
    if (this.disposed) throw new Error(`${this.hubName}: operation after dispose`);
  }

  attach(
    tabId: number,
    sink: FanoutSink<TUpdate>,
    replay: (sink: FanoutSink<TUpdate>) => void,
  ): FanoutAttachmentHandle {
    if (this.disposed) throw new Error(`${this.hubName}: attach after dispose`);
    let sinks = this.tabs.get(tabId);
    if (sinks === undefined) {
      sinks = new Set();
      this.tabs.set(tabId, sinks);
    }
    sinks.add(sink);

    sink.deliverReady(tabId);
    replay(sink);

    let detached = false;
    return {
      tabId,
      detach: () => {
        if (detached) return;
        detached = true;
        const set = this.tabs.get(tabId);
        if (set === undefined) return;
        set.delete(sink);
        if (set.size === 0) this.tabs.delete(tabId);
      },
    };
  }

  broadcast(tabId: number, update: TUpdate): void {
    const sinks = this.tabs.get(tabId);
    if (sinks === undefined) return;
    for (const sink of sinks) {
      try {
        sink.deliverUpdate(update);
      } catch {
        /* sink delivery is best-effort — a throw must not block siblings */
      }
    }
  }

  broadcastTabCleared(tabId: number): void {
    const sinks = this.tabs.get(tabId);
    if (sinks === undefined) return;
    for (const sink of sinks) {
      try {
        sink.deliverTabCleared?.(tabId);
      } catch {
        /* best-effort */
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const sinks of this.tabs.values()) {
      for (const sink of sinks) {
        try {
          sink.close();
        } catch {
          /* sink close is best-effort */
        }
      }
    }
    this.tabs.clear();
  }
}
