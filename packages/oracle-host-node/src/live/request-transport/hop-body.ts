/**
 * Hop body builders — the data-only `TransportBody` materialized for
 * whichever wire pipeline carries the hop: fetch `BodyInit`, undici
 * `request()`'s body slot, or raw payload bytes for the
 * prior-knowledge h2 stream. Per-hop, always fresh — a consumed
 * FormData / URLSearchParams is never reused across a redirect chain.
 */

import type {
  TransportBody,
  TransportHeader,
  TransportMultipartPart,
} from '@openheaders/oracle/live/request-exec/transport';
import { FormData, Headers, Response } from 'undici';
import type { NodeRequestInit } from './seam';

export function buildHeaders(headers: ReadonlyArray<TransportHeader>): Headers {
  const out = new Headers();
  for (const { key, value } of headers) out.append(key, value);
  return out;
}

/**
 * Materialize the data-only body into a Node fetch `BodyInit`. For
 * urlencoded / multipart the constructed object sets its own
 * Content-Type (with the multipart boundary), so we must NOT pre-set one
 * — the engine already stripped a user multipart Content-Type. Returns
 * `undefined` for `none` (no body attached).
 */
export function buildBody(body: TransportBody): NodeRequestInit['body'] {
  switch (body.kind) {
    case 'none':
      return undefined;
    case 'raw':
      return body.content;
    case 'urlencoded': {
      const params = new URLSearchParams();
      for (const f of body.fields) params.append(f.name, f.value);
      return params;
    }
    case 'multipart':
      return buildFormData(body.parts);
    default: {
      const _exhaustive: never = body;
      void _exhaustive;
      return undefined;
    }
  }
}

function buildFormData(parts: ReadonlyArray<TransportMultipartPart>): FormData {
  const form = new FormData();
  for (const part of parts) {
    if (part.kind === 'text') {
      form.append(part.name, part.value);
      continue;
    }
    // Retype the bytes with the part's MIME so the multipart boundary
    // carries the right content-type rather than octet-stream.
    const blob = new Blob([part.bytes], { type: part.mimeType });
    form.append(part.name, blob, part.filename);
  }
  return form;
}

/**
 * Materialize the data-only body for undici `request()`, whose body
 * slot takes text / bytes / FormData but no URLSearchParams —
 * urlencoded serializes here, alongside the Content-Type fetch would
 * have let the object set (a user-set header wins at the call site).
 */
export function buildRequestBody(body: TransportBody): { body?: string | FormData; contentType?: string } {
  switch (body.kind) {
    case 'none':
      return {};
    case 'raw':
      return { body: body.content };
    case 'urlencoded': {
      const params = new URLSearchParams();
      for (const f of body.fields) params.append(f.name, f.value);
      return { body: params.toString(), contentType: 'application/x-www-form-urlencoded;charset=UTF-8' };
    }
    case 'multipart':
      return { body: buildFormData(body.parts) };
    default: {
      const _exhaustive: never = body;
      void _exhaustive;
      return {};
    }
  }
}

/**
 * Materialize the data-only body for the prior-knowledge h2 pipeline,
 * which writes payload bytes straight onto its stream: text for raw /
 * urlencoded, and multipart serialized through undici's own encoder —
 * a `Response` over the built FormData yields the exact
 * boundary-framed bytes plus the Content-Type (boundary included)
 * fetch would have sent.
 */
export async function buildH2Body(
  body: TransportBody,
): Promise<{ payload?: string | Uint8Array; contentType?: string }> {
  switch (body.kind) {
    case 'none':
      return {};
    case 'raw':
      return { payload: body.content };
    case 'urlencoded': {
      const params = new URLSearchParams();
      for (const f of body.fields) params.append(f.name, f.value);
      return { payload: params.toString(), contentType: 'application/x-www-form-urlencoded;charset=UTF-8' };
    }
    case 'multipart': {
      const serialized = new Response(buildFormData(body.parts));
      const contentType = serialized.headers.get('content-type');
      return {
        payload: new Uint8Array(await serialized.arrayBuffer()),
        ...(contentType !== null ? { contentType } : {}),
      };
    }
    default: {
      const _exhaustive: never = body;
      void _exhaustive;
      return {};
    }
  }
}
