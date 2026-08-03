/**
 * `traffic_to_rule` draft computation (AGENT_TRAFFIC_PLAN.md §5, slice
 * S6) — pure over projections, like `traffic-diff.ts` and
 * `traffic-graph.ts`: no tap, no workspace, no mutation. The tool layer
 * resolves the exchange and the body, hands both here, and mints the
 * rule from the returned fields.
 *
 * Design decisions this module owns:
 *
 *   - **The condition is origin + path + `*`, query excluded** — the
 *     same identity the diff pairing uses: query strings carry cache
 *     busters, tags and status knobs, and a condition pinned to one
 *     exact query never matches the re-fire it exists to fix. (This
 *     also keeps redacted query markers out of the condition plane.)
 *     The trailing `*` is load-bearing: the scriptable matcher is a
 *     prefix match, but a debug-tier rule's CDP `Fetch.enable`
 *     `urlPattern` is a FULL-URL glob — without the star a query-bearing
 *     request never pauses, and the rule realizes nowhere on a
 *     CDP-attached tab.
 *   - **CORS rides the mint** (the origin session's burned round-trip):
 *     observed `Access-Control-*` response headers are copied verbatim;
 *     when the response carried none but the request was cross-origin
 *     (initiator origin ≠ URL origin), a permissive set is synthesized —
 *     and the result says which of the two happened.
 *   - **Redaction is honored, never solved.** Marker-bearing values are
 *     minted VERBATIM (a projection is all this module ever sees), and
 *     every draft field carrying a `[redacted:…]` marker is listed in
 *     `redactedFields` so a human knows to fill the real value before
 *     publishing. The reveal plane is never touched (STATUS finding 10).
 */

import type { TrafficBodyProjection, TrafficRecordProjection } from '@openheaders/core/traffic';

/** Where the draft's `responseBody` came from — honest, per PLAN §3's
 *  body-decay posture: a missing body mints an empty draft plus a note,
 *  never an error. */
export type TrafficDraftBodySource = 'argument' | 'retained-failure' | 'pulled' | 'empty';

export interface TrafficDraftBodyInput {
  readonly projection: TrafficBodyProjection | null;
  readonly source: TrafficDraftBodySource;
  /** Why the body plane is empty when `projection` is null. */
  readonly unavailableNote?: string;
}

export interface TrafficDraftOverrides {
  readonly statusCode?: number;
  readonly contentType?: string;
}

export interface TrafficDraftBodyReport {
  readonly source: TrafficDraftBodySource;
  readonly truncated: boolean;
  readonly note?: string;
}

export interface TrafficResponseDraft {
  /** `url-filter` condition value: origin + pathname + `*`. */
  readonly conditionValue: string;
  readonly statusCode: number;
  readonly contentType: string;
  readonly responseBody: string;
  readonly responseHeaders: Record<string, string>;
  /** Observed `Access-Control-*` header names copied into the draft. */
  readonly corsCopied: readonly string[];
  /** Synthesized `Access-Control-*` header names (cross-origin request,
   *  no CORS headers observed) — empty when nothing was synthesized. */
  readonly corsSynthesized: readonly string[];
  /** Draft fields carrying a `[redacted:…]` marker — broken-by-redaction
   *  until a human fills the real value. */
  readonly redactedFields: readonly string[];
  readonly body: TrafficDraftBodyReport;
  /** Honest caveats about what the draft could and could not take from
   *  the observed exchange. */
  readonly notes: readonly string[];
}

const REDACTION_MARKER_PREFIX = '[redacted:';
const CORS_HEADER_PREFIX = /^access-control-/i;

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Origin + pathname, query and fragment stripped; the raw URL when it
 *  does not parse (a projection URL always should). */
export function conditionValueForUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

export function buildResponseOverrideDraft(
  record: TrafficRecordProjection,
  bodyInput: TrafficDraftBodyInput,
  overrides: TrafficDraftOverrides,
): TrafficResponseDraft {
  const notes: string[] = [];

  // ── Status ─────────────────────────────────────────────────────────
  let statusCode: number;
  if (overrides.statusCode !== undefined) {
    statusCode = overrides.statusCode;
  } else if (record.statusCode !== undefined) {
    statusCode = record.statusCode;
    if (record.statusCode >= 400) {
      notes.push(
        `the draft replays the observed ${record.statusCode} — pass statusCode (e.g. 200) to serve a fix instead`,
      );
    }
  } else {
    statusCode = 200;
    notes.push('the observed exchange had no response status (network failure) — the draft serves 200');
  }

  // ── Body ───────────────────────────────────────────────────────────
  let responseBody = '';
  let bodyReport: TrafficDraftBodyReport;
  const projection = bodyInput.projection;
  if (projection === null) {
    bodyReport = {
      source: 'empty',
      truncated: false,
      note:
        bodyInput.unavailableNote ??
        'no response body was available — the draft body is empty; fill responseBody before publishing',
    };
  } else if (projection.encoding === 'base64') {
    bodyReport = {
      source: 'empty',
      truncated: false,
      note: 'the observed body is binary (base64) — not minted into the draft; fill responseBody manually',
    };
  } else {
    responseBody = projection.content;
    bodyReport = {
      source: bodyInput.source,
      truncated: projection.truncated,
      ...(projection.truncated
        ? { note: 'the observed body was truncated at the capture cap — the draft carries the truncated text' }
        : {}),
    };
  }
  if (bodyReport.note !== undefined) notes.push(bodyReport.note);

  // ── Content type ───────────────────────────────────────────────────
  const observedContentType = record.responseHeaders?.find((h) => h.name.toLowerCase() === 'content-type')?.value;
  let contentType: string;
  if (overrides.contentType !== undefined) {
    contentType = overrides.contentType;
  } else if (observedContentType !== undefined) {
    contentType = observedContentType;
  } else if (record.mimeType !== undefined) {
    contentType = record.mimeType;
  } else {
    contentType = 'application/json';
    notes.push('no content type was observed — the draft defaults to application/json');
  }

  // ── CORS response headers ──────────────────────────────────────────
  const responseHeaders: Record<string, string> = {};
  const corsCopied: string[] = [];
  for (const header of record.responseHeaders ?? []) {
    if (!CORS_HEADER_PREFIX.test(header.name) || header.name in responseHeaders) continue;
    responseHeaders[header.name] = header.value;
    corsCopied.push(header.name);
  }
  const corsSynthesized: string[] = [];
  if (corsCopied.length === 0) {
    const urlOrigin = originOf(record.url);
    const initiatorOrigin = record.initiator !== undefined ? originOf(record.initiator) : null;
    if (urlOrigin !== null && initiatorOrigin !== null && urlOrigin !== initiatorOrigin) {
      responseHeaders['Access-Control-Allow-Origin'] = initiatorOrigin;
      responseHeaders['Access-Control-Allow-Methods'] = record.method.toUpperCase();
      responseHeaders['Access-Control-Allow-Headers'] = '*';
      corsSynthesized.push(...Object.keys(responseHeaders));
      notes.push(
        'the observed response carried no CORS headers but the request was cross-origin — a permissive set was ' +
          'synthesized (the mistake a hand-written mock reliably makes)',
      );
    }
  }

  // ── Redaction honesty ──────────────────────────────────────────────
  const conditionValue = `${conditionValueForUrl(record.url)}*`;
  const redactedFields: string[] = [];
  if (conditionValue.includes(REDACTION_MARKER_PREFIX)) redactedFields.push('conditions[0].values[0]');
  if (responseBody.includes(REDACTION_MARKER_PREFIX)) redactedFields.push('action.responseBody');
  for (const [name, value] of Object.entries(responseHeaders)) {
    if (value.includes(REDACTION_MARKER_PREFIX)) redactedFields.push(`action.responseHeaders.${name}`);
  }
  if (redactedFields.length > 0) {
    notes.push(
      'redacted [redacted:…] markers were minted verbatim (secrets are never revealed) — fill the fields listed ' +
        'in redactedFields with real values before publishing',
    );
  }

  return {
    conditionValue,
    statusCode,
    contentType,
    responseBody,
    responseHeaders,
    corsCopied,
    corsSynthesized,
    redactedFields,
    body: bodyReport,
    notes,
  };
}
