/**
 * Shared append policy for the lifecycle message stream (WS frames /
 * SSE events). Lives in core — like {@link ./derived-timing} — because
 * BOTH reducers (the engine store's and the panel client mirror's) must
 * apply the exact same ring policy: append in arrival order, drop-oldest
 * past {@link MAX_STREAM_MESSAGES_PER_REQUEST}, accumulate the drop
 * count on `messagesDropped`. A diverging policy would silently fork the
 * panel's mirror from the engine after the bound is hit.
 */

import type { RequestLifecycle, StreamMessage } from './types';
import { MAX_STREAM_MESSAGES_PER_REQUEST } from './types';

export function appendStreamMessage(prev: RequestLifecycle, message: StreamMessage): RequestLifecycle {
  const appended = prev.messages === undefined ? [message] : [...prev.messages, message];
  const overflow = appended.length - MAX_STREAM_MESSAGES_PER_REQUEST;
  if (overflow <= 0) return { ...prev, messages: appended };
  return {
    ...prev,
    messages: appended.slice(overflow),
    messagesDropped: (prev.messagesDropped ?? 0) + overflow,
  };
}
