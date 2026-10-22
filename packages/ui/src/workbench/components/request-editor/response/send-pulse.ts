import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
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

/** The settled line's tone: error for a send that never completed, an
 *  error snapshot, GraphQL `errors[]` or a failed assertion — the
 *  meta strip's own error-toned tags — else the status pill's range. */
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
  return statusPillTone(response.status);
}
