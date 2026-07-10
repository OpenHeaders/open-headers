/**
 * Request Draft Store — single-consume map of scratch-request pre-fills
 * handed from the DevTools panel to the workbench's API client. The
 * panel stashes a `RequestSeed` via `createRequestDraft`, opens
 * `workbench.html#/create-api-request/draft-<nonce>`, and the
 * workbench's intent router pops it via `takeRequestDraft` to seed a
 * scratch request-create tab. Mechanics (nonce, TTL, single-consume
 * rationale) live in `draft-store.ts`.
 */

import { RequestSeedSchema } from '@openheaders/core/schemas';
import type { RequestSeed } from '@openheaders/core/types';
import { createDraftStore } from './draft-store';

const store = createDraftStore(RequestSeedSchema, 'RequestDraftStore');

/**
 * Parse and stash a request seed. Returns the nonce the caller should
 * embed in the workbench intent. Throws if the seed fails schema
 * validation — callers should surface the error rather than silently
 * open an empty scratch tab.
 */
export function createRequestDraft(rawSeed: unknown): string {
  return store.create(rawSeed);
}

/**
 * Pop the seed for the given nonce. Returns the seed if present,
 * `null` if the nonce is unknown or already consumed.
 */
export function takeRequestDraft(nonce: string): RequestSeed | null {
  return store.take(nonce);
}

/** Test hook — not used in production, exported for unit tests. */
export function _clearAllRequestDrafts(): void {
  store.clear();
}
