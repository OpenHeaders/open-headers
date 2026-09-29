/**
 * The page realm's delegated calls (the Execution Place plan's socket
 * family and the gRPC leg): the realm's executor keeps the session or
 * the call and opens its socket on a place, but the backend wire lives
 * here — so every OPEN, rider, unary invoke and Stop frame arrives as
 * `delegatedSocketCall`, rides `wsRequest` on the frame's EXPLICIT
 * backend (never the default wire), and the place's answer goes back
 * verbatim. A dead wire or the place's refusal answers a structured
 * failure the delegating transport settles the session with.
 */

import { DELEGATE_GRPC_INVOKE_CHANNEL } from '@openheaders/core/protocol';
import { wsRequest } from '../../../ws-request';
import type { HandlerMap } from '../types';

/** A socket call answers as soon as the place registered or wrote. */
const CALL_TIMEOUT_MS = 15_000;

/** The wait by frame: a unary gRPC invoke is the whole exchange and
 *  waits deadline-free — the call's own ceiling rides inside the frame
 *  and the place enforces it (the HTTP exchange's law; the wire's
 *  close flush covers a dead connection, Stop the user's own exit). */
function waitFor(type: string): number {
  return type === DELEGATE_GRPC_INVOKE_CHANNEL ? 0 : CALL_TIMEOUT_MS;
}

export const delegatedSocketHandlers: HandlerMap = {
  delegatedSocketCall: ({ message, respond }) => {
    const backendId = typeof message.backendId === 'string' && message.backendId !== '' ? message.backendId : null;
    const frame = message.frame;
    if (
      backendId === null ||
      !frame ||
      typeof frame !== 'object' ||
      typeof (frame as { type?: unknown }).type !== 'string'
    ) {
      respond({ success: false, error: 'No backend or frame provided' });
      return;
    }
    const typed = frame as { type: string } & Record<string, unknown>;
    wsRequest<Record<string, unknown>>(typed, { backendId, timeoutMs: waitFor(typed.type) })
      .then((result) => respond(result))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },
};
