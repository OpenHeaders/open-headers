import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import type { LiveSendStream } from '../useLiveSendStream';
import type { GraphqlResponseFacts } from './graphql-response';
import { type PillTone, statusPillTone } from './response-status';

export type SendPulsePhase = 'idle' | 'inflight' | 'settled';

/** What drives the bar: whether an exchange is out, and the tone of
 *  the state the surface rests on (null = nothing landed — the bar
 *  stays dark). Flight that keeps its landing is a sweep with no line
 *  at its end — a publish on an open session. */
export interface SendPulseDrive {
  inflight: boolean;
  landing: PillTone | null;
}

/** How a streamed capture's end reads, by whose doing it was: the
 *  user's own Stop neutral, the byte cap or the deadline warning, a
 *  connection severed mid-body error. The server's own close says
 *  nothing new — the status pill's range stands. */
function streamedEndTone(endedBy: NonNullable<ExecutedRequestSnapshot['streamedCapture']>['endedBy']): PillTone | null {
  switch (endedBy) {
    case 'stop':
      return 'neutral';
    case 'cap':
    case 'timeout':
      return 'warning';
    case 'error':
      return 'error';
    case 'end':
      return null;
    default: {
      const _exhaustive: never = endedBy;
      void _exhaustive;
      return null;
    }
  }
}

/** The settled line's tone: error for a send that never completed, an
 *  error snapshot, GraphQL `errors[]` or a failed assertion — the
 *  meta strip's own error-toned tags — then how a streamed capture
 *  ended, else the status pill's range. */
export function sendPulseTone(response: ExecutedRequestSnapshot, graphql?: GraphqlResponseFacts | null): PillTone {
  const assertions = response.scripts?.postResponse?.assertions ?? [];
  if (
    response.error !== null ||
    response.status === 0 ||
    (graphql?.errors.length ?? 0) > 0 ||
    assertions.some((a) => !a.passed)
  ) {
    return 'error';
  }
  const ended = response.streamedCapture === undefined ? null : streamedEndTone(response.streamedCapture.endedBy);
  return ended ?? statusPillTone(response.status);
}

/** The HTTP pane's drive: a send is in flight until its snapshot
 *  lands; an SSE stream rests on its head's status tone from the
 *  moment the head declares `text/event-stream` — the live strip's
 *  pill beside the bar — a stream is a session (the gRPC pane's rule),
 *  no looping sweep across a long one and nothing for an event the
 *  server sends; the end lands by whose doing it was, the server's own
 *  close playing nothing. */
export function httpSendPulse(send: {
  sending: boolean;
  response: ExecutedRequestSnapshot | null;
  live: LiveSendStream | null;
  graphql?: GraphqlResponseFacts | null;
}): SendPulseDrive {
  if (send.sending && send.live !== null && send.live.head !== null && send.live.sse !== null) {
    return { inflight: false, landing: statusPillTone(send.live.head.status) };
  }
  return {
    inflight: send.sending,
    landing: send.response === null ? null : sendPulseTone(send.response, send.graphql),
  };
}
