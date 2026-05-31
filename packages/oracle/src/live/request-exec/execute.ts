/**
 * Wire executor — takes a {@link ResolvedRequest}, normalizes it into a
 * data-only {@link TransportRequest} (scheme-normalized URL, body
 * resolved down to text / urlencoded fields / multipart bytes), hands it
 * to the host {@link RequestTransport}, and maps the response back to an
 * {@link ExecutedRequestSnapshot} with the body byte cap applied.
 *
 * Host-neutral. Everything host-specific — the offline pre-flight, host-
 * access gating, the actual `fetch`, and error classification — lives
 * behind `transport.send`. A {@link TransportError} (network failure)
 * becomes a structured error snapshot; a 4xx/5xx is a normal response.
 */

import type { ExecutedRequestSnapshot, RequestBody } from '@openheaders/core/types';
import { ensureScheme } from '@openheaders/core/utils';
import { getFileBlob } from '../../entity/files-store';
import type { ResolvedRequest } from './resolve-request';
import {
  type RequestTransport,
  type TransportBody,
  TransportError,
  type TransportHeader,
  type TransportMultipartPart,
  type TransportRequest,
} from './transport';

/** Body read cap — the transport streams up to this many bytes and aborts
 *  the read past it, so the always-on host never buffers an unbounded
 *  response. Larger responses surface truncated with a flag; this is also
 *  the exact ceiling on what the chain extractor ever reads, so aborting
 *  here discards only bytes that would have been sliced off anyway. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

export async function executeOverTransport(
  resolved: ResolvedRequest,
  transport: RequestTransport,
): Promise<ExecutedRequestSnapshot> {
  const trimmed = resolved.url.trim();
  if (!trimmed) return errorSnapshot('URL is empty');
  const url = ensureScheme(trimmed);

  // Pre-flight URL validation — catch malformed inputs before the wire
  // so the consumer sees a specific reason. Templated URLs are left
  // alone (a resolved request shouldn't carry one, but be defensive).
  if (!url.startsWith('{{')) {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname) return errorSnapshot(`Invalid URL — missing host: "${url}"`);
    } catch (err) {
      return errorSnapshot(`Invalid URL: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const body = await buildTransportBody(resolved.body);
  const headers = transportHeaders(resolved.headers, body);

  const request: TransportRequest = {
    method: resolved.method,
    url,
    headers,
    body,
    redirect: resolved.followRedirects === false ? 'manual' : 'follow',
    credentials: resolved.credentialsMode,
    maxBodyBytes: MAX_BODY_BYTES,
  };

  const startedAt = performance.now();
  try {
    const response = await transport.send(request);
    const durationMs = Math.round(performance.now() - startedAt);
    // The transport already streamed + capped the body at `maxBodyBytes`,
    // so we surface its result verbatim — no re-slice, no full-body
    // re-encode (which would defeat the streamed memory bound).
    return {
      status: response.status,
      statusText: response.statusText,
      url: response.url || url,
      headers: [...response.headers],
      body: response.body,
      bodyTruncated: response.bodyTruncated,
      bodyBytes: response.bodyBytes,
      durationMs,
      error: null,
      scripts: null,
    };
  } catch (err) {
    const durationMs = Math.round(performance.now() - startedAt);
    // The transport classifies network failures into a user-actionable
    // message; anything else surfaces its raw message.
    const message = err instanceof TransportError ? err.message : err instanceof Error ? err.message : String(err);
    return { ...errorSnapshot(message), durationMs };
  }
}

/**
 * Resolve the domain body union into the data-only transport shape.
 * File-part bytes are read here (engine-side) so the transport only
 * materializes host fetch primitives from plain data.
 */
async function buildTransportBody(body: RequestBody): Promise<TransportBody> {
  switch (body.type) {
    case 'none':
      return { kind: 'none' };
    case 'json':
    case 'xml':
    case 'text':
      return { kind: 'raw', content: body.content };
    case 'graphql': {
      // GraphQL HTTP transport: `{"query": "...", "variables": {...}}`.
      // `graphqlVariables` is JSON text — embed it parsed when valid,
      // else omit (better to send `{query}` than a malformed wire body).
      const wire: { query: string; variables?: unknown } = { query: body.content };
      const variablesText = body.graphqlVariables?.trim();
      if (variablesText) {
        try {
          wire.variables = JSON.parse(variablesText);
        } catch {
          // Leave `variables` unset.
        }
      }
      return { kind: 'raw', content: JSON.stringify(wire) };
    }
    case 'form': {
      const fields: Array<{ name: string; value: string }> = [];
      for (const p of body.formParts) {
        if (p.enabled === false) continue;
        fields.push({ name: p.key, value: p.value });
      }
      return { kind: 'urlencoded', fields };
    }
    case 'multipart': {
      const parts: TransportMultipartPart[] = [];
      for (const part of body.multipartParts) {
        if (part.enabled === false) continue;
        if (part.kind === 'text') {
          parts.push({ kind: 'text', name: part.name, value: part.value });
          continue;
        }
        // File parts hold a list — emit one part per FileRef so repeated
        // field names round-trip. Missing blobs are skipped silently;
        // the consumer sees the mismatch reflected in the response.
        for (const ref of part.fileRefs) {
          const blob = await getFileBlob(ref.fileId);
          if (!blob) continue;
          const mimeType = ref.mimeType ?? blob.type ?? 'application/octet-stream';
          const bytes = new Uint8Array(await blob.arrayBuffer());
          parts.push({ kind: 'file', name: part.name, filename: ref.filename, mimeType, bytes });
        }
      }
      return { kind: 'multipart', parts };
    }
    default: {
      const _exhaustive: never = body;
      void _exhaustive;
      return { kind: 'none' };
    }
  }
}

/**
 * Strip a user-set `multipart/form-data` Content-Type when sending a
 * multipart body — the host MUST set its own with the generated
 * boundary, and a manual one omits it (every server rejects it). Other
 * Content-Types pass through.
 */
function transportHeaders(
  headers: ReadonlyArray<{ key: string; value: string }>,
  body: TransportBody,
): TransportHeader[] {
  if (body.kind !== 'multipart') return headers.map((h) => ({ key: h.key, value: h.value }));
  return headers
    .filter((h) => !(h.key.toLowerCase() === 'content-type' && h.value.toLowerCase().startsWith('multipart/form-data')))
    .map((h) => ({ key: h.key, value: h.value }));
}

export function errorSnapshot(message: string): ExecutedRequestSnapshot {
  return {
    status: 0,
    statusText: '',
    url: '',
    headers: [],
    body: '',
    bodyTruncated: false,
    bodyBytes: 0,
    durationMs: 0,
    error: message,
    scripts: null,
  };
}
