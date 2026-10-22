import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import type { GraphqlResponseFacts } from './graphql-response';
import { type PillTone, statusPillTone } from './response-status';

export type SendPulsePhase = 'idle' | 'inflight' | 'settled';

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
