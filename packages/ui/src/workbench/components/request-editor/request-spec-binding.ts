/**
 * Request ↔ spec operation resolution — the pure half of the HTTP
 * Spec tab. A request pairs with the operation of its collection's
 * linked OpenAPI document by method + URL template (the update
 * planner's own key), and the pair carries the planner's field diff so
 * the tab can name what differs and converge it field by field.
 */

import type { CurlRequest, OpenApiParseResult } from '@openheaders/core/import';
import { diffRequest, operationKey, type SpecComparableRequest } from '../specs/spec-update-plan';

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
  live: SpecComparableRequest & { method: string; url: string },
): RequestSpecOperation | null {
  const key = operationKey(live.method, live.url);
  const match = parsed.requests.find((r) => operationKey(r.request.method, r.request.url) === key);
  if (!match) return null;
  return { spec: match.request, ...diffRequest(match.request, live) };
}
