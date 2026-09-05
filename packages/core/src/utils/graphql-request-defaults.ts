/**
 * Empty-GraphqlRequest seed factory. Mirrors `mqtt-request-defaults.ts`:
 * one source of truth for the freshly-created GraphQL request shape so
 * every creation gesture stays byte-identical.
 *
 * Defaults:
 *   - url: empty (user fills the endpoint)
 *   - query: empty; variables / operationName: absent
 *   - headers: empty
 *   - auth: inherit (collection / folder default)
 */

import type { GraphqlRequest } from '../types';

export interface BuildEmptyGraphqlRequestInput {
  uid: string;
  /** Full request path: `${parentPath}/${pathSegment}`. */
  path: string;
  name: string;
}

export function buildEmptyGraphqlRequest(input: BuildEmptyGraphqlRequestInput): GraphqlRequest {
  return {
    schemaVersion: 5,
    uid: input.uid,
    path: input.path,
    name: input.name,
    url: '',
    query: '',
    headers: [],
    auth: { type: 'inherit' },
  };
}
