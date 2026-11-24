/**
 * Frame batcher — one stream session's outbound run, cut into frames by
 * size.
 *
 * The host a session streams to closes the whole connection on a frame
 * over its limit, so a run of messages leaves as several frames, never
 * as one that grew with the tab: a replay of a long history crosses in
 * order, frame by frame, and the receiving list fills as it arrives.
 *
 * Each message is serialised ONCE, when it is queued. Its text is what
 * is measured, and a frame is those texts joined inside the batch
 * envelope — nothing is serialised a second time to learn a size.
 *
 * A frame holds at most {@link FRAME_BUDGET_CHARS} characters of
 * messages. A code unit is at most three bytes on the wire, so the
 * budget is also kept to a third of the host's limit and a frame of
 * several messages can never pass it. One message larger than the
 * budget travels alone, after `fit` has measured it against the limit
 * itself; a message `fit` cannot make cross is left out and reported.
 */

/** Messages per frame, in characters — an eighth of the default limit. */
export const FRAME_BUDGET_CHARS = 1024 * 1024;

export interface FrameBatcherOptions<TMessage> {
  /** The batch frame's own fields; `messages` is appended to them. */
  readonly envelope: Record<string, unknown>;
  readonly flushIntervalMs: number;
  /** The largest frame the wire accepts right now, in bytes. */
  readonly maxFrameBytes: () => number;
  /** Send one serialised frame; false when the wire did not take it. */
  readonly send: (frame: string) => boolean;
  /**
   * The serialised message that fits `maxBytes` — the text given, a
   * reduced message, or `null` when it cannot cross at all.
   */
  readonly fit: (message: TMessage, serialized: string, maxBytes: number) => string | null;
  /** A message was left out because nothing could make it fit. */
  readonly onLeftOut: (message: TMessage) => void;
}

export interface FrameBatcher<TMessage> {
  /** Queue one message for the next tick's frames. */
  enqueue(message: TMessage): void;
  /** Drop what is queued and stop the tick. */
  clear(): void;
}

export function createFrameBatcher<TMessage>(options: FrameBatcherOptions<TMessage>): FrameBatcher<TMessage> {
  const head = `${JSON.stringify(options.envelope).slice(0, -1)},"messages":[`;
  const TAIL = ']}';
  // Bytes the envelope can take around the messages, at three a unit.
  const envelopeBytes = (head.length + TAIL.length) * 3;
  let queue: string[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush(): void {
    timer = null;
    if (queue.length === 0) return;
    const texts = queue;
    queue = [];
    const budget = Math.min(FRAME_BUDGET_CHARS, Math.floor((options.maxFrameBytes() - envelopeBytes) / 3));
    let start = 0;
    let chars = 0;
    for (let i = 0; i < texts.length; i++) {
      const length = texts[i].length + 1;
      if (i > start && chars + length > budget) {
        // A failed send means the wire is down mid-flight — drop the
        // run; the wire-close teardown (or the daemon's re-subscribe on
        // reconnect) rebuilds the view from a fresh replay.
        if (!options.send(head + texts.slice(start, i).join(',') + TAIL)) return;
        start = i;
        chars = 0;
      }
      chars += length;
    }
    options.send(head + (start === 0 ? texts : texts.slice(start)).join(',') + TAIL);
  }

  return {
    enqueue(message) {
      const text = options.fit(message, JSON.stringify(message), options.maxFrameBytes() - envelopeBytes);
      if (text === null) {
        options.onLeftOut(message);
        return;
      }
      queue.push(text);
      if (timer === null) timer = setTimeout(flush, options.flushIntervalMs);
    },
    clear() {
      queue = [];
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
