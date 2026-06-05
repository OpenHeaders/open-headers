/**
 * Pure projection from a fetched CDP response body into `InspectorHarBody`
 * — the shape the store lands in `harBodyByHop` and the panel's body
 * classifier reads.
 *
 * The CDP body fetch returns `{ body, base64Encoded }`; this maps it onto
 * the HAR body's `content` + `encoding` (`'base64'` for binary, `''` for
 * text — matching the heuristic body source's convention so the classifier
 * branches identically on both paths). The source request's
 * `method` / `url` / `startedDateTime` round out the shape; they are inert
 * once the body lands by hop index, but kept truthful so the body is
 * self-describing for search and export.
 *
 * Size cap. A body fetch pulls the whole payload across the attached
 * session and into the panel, so it is capped:
 *   - text over the cap is truncated to the cap — the user sees the head;
 *   - binary (base64) over the cap is dropped to an empty body, since a
 *     truncated base64 string decodes to garbage — better to surface the
 *     "unavailable" copy than a corrupt download.
 * An empty `content` is the universal "no body to show" signal the
 * classifier resolves to its unavailable copy; {@link emptyCdpHarBody}
 * mints one directly for the failure path (host evicted the body, unknown
 * request).
 *
 * No state, no chrome; every function is total and table-testable.
 */

import type { InspectorHarBody } from '@openheaders/core/types';

/** The source request fields an `InspectorHarBody` carries for context. */
export interface CdpBodySourceRequest {
  readonly method: string;
  readonly url: string;
  readonly startedDateTime: string;
}

/** Raw `Network.getResponseBody` result — body text + its encoding flag. */
export interface CdpRawResponseBody {
  readonly body: string;
  readonly base64Encoded: boolean;
}

/**
 * Max body length (characters of the fetched string) we surface. Binary
 * bodies arrive base64-encoded, so this bounds ~3/4 as many decoded bytes.
 * Generous on purpose: the heuristic body source caps nothing, so a tight
 * cap would make the same response render fully under the heuristic path
 * and truncated under CDP. This is a guard against pathological payloads,
 * not a routine trim.
 */
export const MAX_CDP_RESPONSE_BODY_CHARS = 10 * 1024 * 1024;

/** An empty body for `source` — the "no content to show" signal. */
export function emptyCdpHarBody(source: CdpBodySourceRequest): InspectorHarBody {
  return {
    method: source.method,
    url: source.url,
    startedDateTime: source.startedDateTime,
    content: '',
    encoding: '',
  };
}

/**
 * Project a fetched CDP body onto `InspectorHarBody`, applying the size
 * cap. Over-cap text is truncated to the head; over-cap binary is dropped
 * to empty (a truncated base64 string is unusable).
 */
export function cdpBodyToHarBody(
  source: CdpBodySourceRequest,
  raw: CdpRawResponseBody,
  capChars: number = MAX_CDP_RESPONSE_BODY_CHARS,
): InspectorHarBody {
  const encoding = raw.base64Encoded ? 'base64' : '';
  if (raw.body.length <= capChars) {
    return {
      method: source.method,
      url: source.url,
      startedDateTime: source.startedDateTime,
      content: raw.body,
      encoding,
    };
  }
  if (raw.base64Encoded) return emptyCdpHarBody(source);
  return {
    method: source.method,
    url: source.url,
    startedDateTime: source.startedDateTime,
    content: raw.body.slice(0, capChars),
    encoding,
  };
}
