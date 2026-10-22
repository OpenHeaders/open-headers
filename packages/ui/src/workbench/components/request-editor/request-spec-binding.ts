/**
 * Request ↔ spec operation resolution — the pure half of the HTTP
 * Spec tab. A request pairs with the operation of its collection's
 * linked OpenAPI document by method + URL template (the update
 * planner's own key, in the path-parameter form), the pair carries the
 * planner's field diff so the tab can name what differs, and the apply
 * lands the chosen fields on the draft.
 */

import type { CurlRequest, OpenApiParseResult } from '@openheaders/core/import';
import {
  diffRequest,
  operationKey,
  type SpecChangedField,
  type SpecComparableRequest,
} from '../specs/spec-update-plan';
import { type Draft, derivePathParamRows, headersFromRequest, paramsFromRequest } from './draft';

export interface RequestSpecOperation {
  /** The operation as the spec defines it. */
  spec: CurlRequest;
  changedFields: ReturnType<typeof diffRequest>['changedFields'];
  updates: ReturnType<typeof diffRequest>['updates'];
}

/** The operation the live request pairs with, or `null` when the spec
 *  names no operation at its method + URL. */
export function resolveSpecOperation(
  parsed: OpenApiParseResult,
  live: SpecComparableRequest & { method: string },
): RequestSpecOperation | null {
  const key = operationKey(live.method, live.url);
  const match = parsed.requests.find((r) => operationKey(r.request.method, r.request.url) === key);
  if (!match) return null;
  return { spec: match.request, ...diffRequest(match.request, live) };
}

/** The draft after the operation's updates land for `fields` — the
 *  Spec tab's apply. `name` never lands (the tab's identity, not draft
 *  content). The Path Parameters rows are DERIVED from the URL, so a
 *  URL or path-row apply re-derives them against the resulting URL,
 *  the applied rows standing in as the stored twins when `pathParams`
 *  is among the fields — the table and the stored rows agree, and a
 *  row the URL does not name is dropped (rows applied against a URL
 *  still in the `{{name}}` form keep nothing until the URL lands). */
export function applySpecOperation(
  draft: Draft,
  operation: RequestSpecOperation,
  fields: readonly SpecChangedField[],
): Draft {
  const { updates } = operation;
  const next = { ...draft };
  let pathRows: Parameters<typeof derivePathParamRows>[1] = draft.pathParams;
  for (const field of fields) {
    if (field === 'description' && updates.description !== undefined) next.description = updates.description;
    if (field === 'url' && updates.url !== undefined) next.url = updates.url;
    if (field === 'headers' && updates.headers) next.headers = headersFromRequest(updates.headers);
    if (field === 'params' && updates.params) next.params = paramsFromRequest(updates.params);
    if (field === 'pathParams' && updates.pathParams) pathRows = updates.pathParams;
    if (field === 'auth' && updates.auth) next.auth = updates.auth;
    if (field === 'body' && updates.body) next.body = updates.body;
  }
  if (fields.includes('url') || fields.includes('pathParams')) {
    next.pathParams = derivePathParamRows(next.url, pathRows);
  }
  return next;
}
