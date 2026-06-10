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

/**
 * MIME types whose bodies are text despite a non-`text/` top-level type.
 * Matches the browser's text-detection set so the same response decodes
 * to text under both fetch paths.
 */
const TEXT_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/ecmascript',
  'application/javascript',
  'application/json',
  'application/json+protobuf',
  'application/mpegurl',
  'application/vnd.apple.mpegurl',
  'application/vnd.dart',
  'application/xml',
  'application/x-aspx',
  'application/x-javascript',
  'application/x-jsp',
  'application/x-httpd-php',
  'application/x-mpegurl',
  'audio/mpegurl',
  'audio/x-mpegurl',
]);

/**
 * Whether a MIME type carries textual content: `text/*`, `multipart/*`,
 * anything containing `json` or ending `+xml`, plus the fixed set above —
 * the browser's rule for deciding text-decode vs raw binary.
 */
export function isTextMimeType(mimeType: string): boolean {
  return (
    mimeType.startsWith('text/') ||
    mimeType.startsWith('multipart/') ||
    mimeType.includes('json') ||
    mimeType.endsWith('+xml') ||
    TEXT_MIME_TYPES.has(mimeType)
  );
}

/** Base64 → raw bytes, or `null` on malformed input. */
function base64ToBytes(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Project a streamed in-flight body (`streamResourceContent`'s buffered
 * bytes-so-far, always base64 of raw bytes) onto `InspectorHarBody`.
 *
 * `getResponseBody` hands text bodies back already decoded, so the
 * streamed path must decode too or the same response would render as text
 * under one fetch path and as binary under the other: a text MIME type is
 * decoded with its declared charset (UTF-8 when none), lossily — the
 * buffer may end mid-multibyte-sequence, which is the expected shape for
 * a body cut off mid-stream. Non-text stays base64. The size cap matches
 * {@link cdpBodyToHarBody}: over-cap text keeps the head, over-cap binary
 * drops to empty.
 */
export function streamedCdpBodyToHarBody(
  source: CdpBodySourceRequest,
  bufferedData: string,
  mimeType: string | undefined,
  charset: string | undefined,
  capChars: number = MAX_CDP_RESPONSE_BODY_CHARS,
): InspectorHarBody {
  if (mimeType !== undefined && isTextMimeType(mimeType)) {
    const bytes = base64ToBytes(bufferedData);
    if (bytes !== null) {
      let text: string;
      try {
        text = new TextDecoder(charset ?? 'utf-8').decode(bytes);
      } catch {
        // Unknown charset label — decode as UTF-8 rather than dropping the body.
        text = new TextDecoder('utf-8').decode(bytes);
      }
      return {
        method: source.method,
        url: source.url,
        startedDateTime: source.startedDateTime,
        content: text.length <= capChars ? text : text.slice(0, capChars),
        encoding: '',
      };
    }
  }
  if (bufferedData.length > capChars) return emptyCdpHarBody(source);
  return {
    method: source.method,
    url: source.url,
    startedDateTime: source.startedDateTime,
    content: bufferedData,
    encoding: 'base64',
  };
}
