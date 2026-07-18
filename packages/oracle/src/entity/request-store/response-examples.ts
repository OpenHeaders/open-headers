// ── Response examples (cascade plumbing) ────────────────────────────
//
// Examples are renderer-written (see the UI's response-example write
// client); the store's only job is keeping them consistent with their
// parent request's lifecycle — a deleted request must not leave orphan
// examples behind. Every request-delete path (single delete, collection
// cascade, folder cascade) routes through
// {@link deleteResponseExamplesForRequests}.

import { buildDeleteResponseExampleBatch } from '@openheaders/core/sync-builders/mutations/response-example-mutations';
import type { ResponseExampleCache } from '@openheaders/oracle/sync/caches/response-example-cache';
import { RESPONSE_EXAMPLE_REGISTRATION } from '@openheaders/oracle/sync/entity-registry';
import { getActiveCacheForRegistration } from '@openheaders/oracle/sync/service/accessors';
import { applyRequestMutationOrThrow } from './apply';

/** Example uids under any of the given requests, in the active workspace. */
function responseExampleUidsForRequests(requestUids: readonly string[]): string[] {
  const cache = getActiveCacheForRegistration<ResponseExampleCache>(RESPONSE_EXAMPLE_REGISTRATION);
  if (!cache) return [];
  const parents = new Set(requestUids);
  return cache
    .getResponseExamples()
    .filter((e) => parents.has(e.requestUid))
    .map((e) => e.uid);
}

/** Tombstone every example owned by the given requests. */
export async function deleteResponseExamplesForRequests(requestUids: readonly string[]): Promise<void> {
  for (const exampleUid of responseExampleUidsForRequests(requestUids)) {
    await applyRequestMutationOrThrow(
      (ctx) => buildDeleteResponseExampleBatch(exampleUid, ctx),
      'deleteResponseExamples-cascade',
    );
  }
}
