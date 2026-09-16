/**
 * The page realm's delegated socket calls (the Execution Place plan's
 * socket family): the realm's session executor keeps the session and
 * opens its socket on a place, but the backend wire lives here — so
 * every OPEN and rider frame arrives as `delegatedSocketCall`, rides
 * `wsRequest` on the frame's EXPLICIT backend (never the default
 * wire), and the place's answer goes back verbatim. A dead wire or the
 * place's refusal answers a structured failure the delegating
 * transport settles the session with.
 */

import { wsRequest } from '../../../ws-request';
import type { HandlerMap } from '../types';

/** A socket call answers as soon as the place registered or wrote. */
const CALL_TIMEOUT_MS = 15_000;

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
    wsRequest<Record<string, unknown>>(frame as { type: string } & Record<string, unknown>, {
      backendId,
      timeoutMs: CALL_TIMEOUT_MS,
    })
      .then((result) => respond(result))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },
};
