/**
 * Empty-Request seed factory. Mirrors `rule-defaults.ts:buildEmptyRule`:
 * one source of truth for the freshly-created request shape, used by
 * every "create request" gesture (sidebar context-add, command palette
 * draft, import auto-create) so they stay byte-identical.
 *
 * Defaults:
 *   - method: GET
 *   - url: empty (user fills)
 *   - headers / params: empty
 *   - auth: inherit (collection / folder default)
 *   - body: none
 *
 * The output is a complete `Request` — `uid` and `path` are
 * caller-provided because the renderer mints uids locally and the
 * collection/folder context decides the path prefix.
 */

import type { Request } from '../types';
export interface BuildEmptyRequestInput {
  uid: string;
  /** Full request path: `${parentPath}/${pathSegment}`. */
  path: string;
  name: string;
}

export function buildEmptyRequest(input: BuildEmptyRequestInput): Request {
  return {
    schemaVersion: 5,
    uid: input.uid,
    path: input.path,
    name: input.name,
    method: 'GET',
    url: '',
    headers: [],
    params: [],
    auth: { type: 'inherit' },
    body: { type: 'none' },
  };
}
