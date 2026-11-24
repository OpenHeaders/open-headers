/**
 * Fit one lifecycle wire message to a frame.
 *
 * A row can outgrow any frame through two of its fields: a response
 * body, and the message stream of a long-lived socket. A sender that
 * must stay under a frame limit sends the row without the part that
 * cannot cross, and the row says so — an omitted body is marked
 * `omitted: 'too-large'`, a shortened message stream raises the drop
 * counts the reducers already keep for their ring bound. Everything
 * else about the row crosses as it is.
 *
 * Pure, and only reached by a message that does not fit: the common
 * path is the one size test at the top.
 */

import { fitsFrame } from '../protocol/frame-limit';
import type { InspectorHarBody } from '../types/har-source';
import type { RequestLifecycle } from './types';
import type { LifecycleWireMessage } from './wire';

function withoutContent(body: InspectorHarBody): InspectorHarBody {
  return { ...body, content: '', omitted: 'too-large' };
}

function withoutBodies(lifecycle: RequestLifecycle): RequestLifecycle {
  return {
    ...lifecycle,
    harBodyByHop: lifecycle.harBodyByHop.map((body) =>
      body !== null && body.content !== '' ? withoutContent(body) : body,
    ),
  };
}

/** Drop the older half of each message stream, counted as dropped. */
function withHalvedStreams(lifecycle: RequestLifecycle): RequestLifecycle {
  const messages = lifecycle.messages ?? [];
  const captures = lifecycle.messageCaptures ?? [];
  const keptMessages = Math.floor(messages.length / 2);
  const keptCaptures = Math.floor(captures.length / 2);
  return {
    ...lifecycle,
    ...(messages.length > 0
      ? {
          messages: messages.slice(messages.length - keptMessages),
          messagesDropped: (lifecycle.messagesDropped ?? 0) + messages.length - keptMessages,
        }
      : {}),
    ...(captures.length > 0
      ? {
          messageCaptures: captures.slice(captures.length - keptCaptures),
          messageCapturesDropped: (lifecycle.messageCapturesDropped ?? 0) + captures.length - keptCaptures,
        }
      : {}),
  };
}

function startedText(lifecycle: RequestLifecycle): string {
  return JSON.stringify({
    kind: 'lifecycle-update',
    update: { kind: 'started', lifecycle },
  } satisfies LifecycleWireMessage);
}

/**
 * The serialised form of `message` that fits `maxBytes`: `serialized`
 * itself when it already does, a reduced row otherwise, `null` when no
 * reduction can make it fit.
 */
export function fitLifecycleWireMessage(
  message: LifecycleWireMessage,
  serialized: string,
  maxBytes: number,
): string | null {
  if (fitsFrame(serialized, maxBytes)) return serialized;
  if (message.kind !== 'lifecycle-update') return null;
  const update = message.update;
  if (update.kind === 'body-attached') {
    const reduced = JSON.stringify({
      kind: 'lifecycle-update',
      update: { ...update, body: withoutContent(update.body) },
    } satisfies LifecycleWireMessage);
    return fitsFrame(reduced, maxBytes) ? reduced : null;
  }
  if (update.kind !== 'started') return null;
  let lifecycle = withoutBodies(update.lifecycle);
  let text = startedText(lifecycle);
  while (!fitsFrame(text, maxBytes)) {
    if ((lifecycle.messages?.length ?? 0) === 0 && (lifecycle.messageCaptures?.length ?? 0) === 0) return null;
    lifecycle = withHalvedStreams(lifecycle);
    text = startedText(lifecycle);
  }
  return text;
}
