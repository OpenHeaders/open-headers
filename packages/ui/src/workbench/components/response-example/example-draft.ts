/**
 * Example editor draft model — reuses the request editor's `Draft` for
 * the request half (so the URL bar, Params/Headers grids, and Body tab
 * are the exact same components), plus a small row-based projection of
 * the captured response.
 *
 * Two pure projections feed save and derived-dirty:
 *   - `capturedRequestFromDraft` / `capturedResponseFromDraft` — the
 *     persisted shapes (row uids kept on the request side, where the
 *     schema stores them; response headers persist as bare key/value).
 *   - `exampleDraftFingerprint` — uid-free: response rows (and any
 *     URL-derived param rows) mint fresh uids on every populate, so a
 *     fingerprint carrying uids would read as a permanent phantom edit.
 */

import type { CapturedRequest, CapturedResponse, ResponseExample } from '@openheaders/core/types';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { statusCodePhrase } from '@openheaders/ui/shared/info-popover/data/http-status';
import { type Draft, draftFromRequest, rowsToHeaders, rowsToParams } from '../request-editor/draft';
import { type KeyValueRow, makeKvRow } from '../request-editor/KeyValueTable';

export interface ExampleResponseDraft {
  status: number;
  statusText: string;
  url: string;
  headers: KeyValueRow[];
  body: string;
}

export interface ExampleDraft {
  request: Draft;
  response: ExampleResponseDraft;
}

export function exampleToDraft(example: ResponseExample): ExampleDraft {
  return {
    // The stub identity never persists — `draftFromRequest` only reads
    // content fields. Auth is 'none': the capture holds no credentials
    // and the Authorization tab is not mounted for examples.
    request: draftFromRequest({
      schemaVersion: 5,
      uid: example.uid,
      path: '',
      name: example.name,
      method: example.request.method,
      url: example.request.url,
      headers: example.request.headers,
      params: example.request.params,
      auth: { type: 'none' },
      body: example.request.body,
    }),
    response: {
      status: example.response.status,
      statusText: example.response.statusText,
      url: example.response.url,
      headers: example.response.headers.map((h) => makeKvRow({ key: h.key, value: h.value })),
      body: example.response.body,
    },
  };
}

export function capturedRequestFromDraft(draft: Draft): CapturedRequest {
  return {
    method: draft.method,
    url: draft.url,
    headers: rowsToHeaders(draft.headers),
    params: rowsToParams(draft.params),
    body: draft.body,
  };
}

/**
 * Persisted response from the edited rows. Body meta derives here: an
 * edited body is exactly what's stored, so its byte size recomputes and
 * any capture-time truncation stamp clears; an untouched body keeps the
 * captured meta. `durationMs` always stays the captured fact.
 */
export function capturedResponseFromDraft(
  response: ExampleResponseDraft,
  canonical: CapturedResponse,
): CapturedResponse {
  const bodyChanged = response.body !== canonical.body;
  return {
    status: response.status,
    statusText: response.statusText,
    url: response.url,
    headers: response.headers.filter((r) => r.key.trim()).map((r) => ({ key: r.key, value: r.value })),
    body: response.body,
    bodyTruncated: bodyChanged ? false : canonical.bodyTruncated,
    ...(bodyChanged || canonical.bodyCapBytes === undefined ? {} : { bodyCapBytes: canonical.bodyCapBytes }),
    bodyBytes: bodyChanged ? new TextEncoder().encode(response.body).length : canonical.bodyBytes,
    durationMs: canonical.durationMs,
  };
}

/** Uid-free structural fingerprint over everything editable. */
export function exampleDraftFingerprint(draft: ExampleDraft): string {
  const stripRow = (r: KeyValueRow) => ({
    key: r.key,
    value: r.value,
    description: r.description?.trim() ? r.description : undefined,
    enabled: r.enabled,
    hasEquals: r.hasEquals,
  });
  return stableStringify({
    request: {
      method: draft.request.method,
      url: draft.request.url,
      headers: draft.request.headers.filter((r) => r.key.trim()).map(stripRow),
      params: draft.request.params.filter((r) => r.key.trim()).map(stripRow),
      body: draft.request.body,
    },
    response: {
      status: draft.response.status,
      statusText: draft.response.statusText,
      url: draft.response.url,
      headers: draft.response.headers.filter((r) => r.key.trim()).map((r) => ({ key: r.key, value: r.value })),
      body: draft.response.body,
    },
  });
}

/** Canonical-side fingerprint — same projection path as the form's. */
export function exampleSignature(example: ResponseExample): string {
  return exampleDraftFingerprint(exampleToDraft(example));
}

/**
 * Parse a status-picker commit — `"404"`, `"404 Not Found"`, or free
 * text after a code. Unknown codes keep the typed phrase (or clear
 * it); curated codes without a typed phrase get the canonical one.
 */
export function parseStatusInput(input: string): { status: number; statusText: string } | null {
  const match = /^\s*(\d{3})\s*(.*)$/.exec(input);
  if (!match) return null;
  const status = Number(match[1]);
  const typedPhrase = match[2].trim();
  return { status, statusText: typedPhrase || (statusCodePhrase(status) ?? '') };
}
