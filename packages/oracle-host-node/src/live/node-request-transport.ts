/**
 * Node request transport — the desktop main process's implementation of
 * the engine's {@link RequestTransport} seam, over Electron/Node's global
 * `fetch` (undici).
 *
 * Differences from the browser SW transport:
 *   - **No offline pre-flight.** The always-on desktop has no
 *     `navigator.onLine`; a genuinely-offline send surfaces as a
 *     classified connect error below.
 *   - **No host-access gate.** There is no `chrome.permissions` model on
 *     the desktop — the process can reach any host its network allows.
 *   - **No DNR-bypass concern.** The desktop has no DNR engine, so the
 *     `X-OH-Live-Bypass` header is never stamped (the chain adapter omits
 *     `prepareRequest`).
 *   - **Rich error classification.** Unlike the browser's opaque
 *     `TypeError: Failed to fetch`, undici exposes `err.cause.code`
 *     (`ECONNREFUSED` / `ENOTFOUND` / …), so the message is precise.
 */

import {
  type RequestTransport,
  type TransportBody,
  TransportError,
  type TransportHeader,
  type TransportRequest,
  type TransportResponse,
} from '@openheaders/oracle/live/request-exec/transport';

export function createNodeRequestTransport(): RequestTransport {
  return {
    async send(request: TransportRequest): Promise<TransportResponse> {
      const init: RequestInit = {
        method: request.method,
        headers: buildHeaders(request.headers),
        redirect: request.redirect,
        // No ambient cookie jar in the main process, so `credentials` has
        // nothing to ride — Node fetch never attaches cookies by default.
      };
      const body = buildBody(request.body, init);
      if (body !== undefined) init.body = body;

      let response: Response;
      try {
        response = await fetch(request.url, init);
      } catch (err) {
        throw new TransportError(classifyFetchFailure(request.url, err));
      }

      const headers: TransportHeader[] = [];
      response.headers.forEach((value, key) => {
        headers.push({ key, value });
      });
      const { body: responseBody, bodyBytes, bodyTruncated } = await readCappedBody(response, request.maxBodyBytes);
      return {
        status: response.status,
        statusText: response.statusText,
        url: response.url || request.url,
        headers,
        body: responseBody,
        bodyBytes,
        bodyTruncated,
      };
    },
  };
}

/**
 * Stream the response body, retaining at most `maxBodyBytes` and aborting
 * the read once the upstream overflows the cap. This is the load-bearing
 * memory bound on the always-on main process: `response.text()` would
 * buffer the *entire* upstream body — a multi-gigabyte or chunked-unbounded
 * response from a misconfigured/hostile cadence target OOMs the shared
 * process before any post-read cap could apply. We accumulate at most the
 * cap plus one in-flight chunk, then `cancel()` the stream.
 */
async function readCappedBody(
  response: Response,
  maxBodyBytes: number,
): Promise<{ body: string; bodyBytes: number; bodyTruncated: boolean }> {
  const stream = response.body;
  if (!stream) {
    // No readable stream (empty body / HEAD) — nothing to bound.
    return { body: '', bodyBytes: 0, bodyTruncated: false };
  }
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let bytesRead = 0;
  let truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      parts.push(value);
      bytesRead += value.byteLength;
      if (bytesRead > maxBodyBytes) {
        truncated = true;
        await reader.cancel();
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  return decodeCapped(parts, bytesRead, maxBodyBytes, truncated);
}

/** Concatenate the retained chunks, cap to `maxBodyBytes`, and decode as
 *  UTF-8. Shared cap arithmetic so the byte count + truncation flag stay
 *  consistent with what's actually decoded. */
function decodeCapped(
  parts: ReadonlyArray<Uint8Array>,
  bytesRead: number,
  maxBodyBytes: number,
  truncated: boolean,
): { body: string; bodyBytes: number; bodyTruncated: boolean } {
  const retained = Math.min(bytesRead, maxBodyBytes);
  const buf = new Uint8Array(retained);
  let offset = 0;
  for (const part of parts) {
    if (offset >= retained) break;
    const take = Math.min(part.byteLength, retained - offset);
    buf.set(part.subarray(0, take), offset);
    offset += take;
  }
  return { body: new TextDecoder().decode(buf), bodyBytes: retained, bodyTruncated: truncated };
}

function buildHeaders(headers: ReadonlyArray<TransportHeader>): Headers {
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
function buildBody(body: TransportBody, _init: RequestInit): BodyInit | undefined {
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
    case 'multipart': {
      const form = new FormData();
      for (const part of body.parts) {
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
    default: {
      const _exhaustive: never = body;
      void _exhaustive;
      return undefined;
    }
  }
}

/**
 * Turn a thrown Node `fetch` error into a user-actionable message.
 * undici wraps the OS error as `err.cause` with a `code` — far more
 * precise than the browser's opaque "Failed to fetch".
 */
function classifyFetchFailure(url: string, err: unknown): string {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    // Fall through with an empty host — the raw message still helps.
  }
  const cause = err && typeof err === 'object' && 'cause' in err ? (err as { cause: unknown }).cause : undefined;
  const code =
    cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code: unknown }).code) : undefined;
  switch (code) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return `Could not resolve host ${host} (DNS lookup failed). Check the URL and your network.`;
    case 'ECONNREFUSED':
      return `Connection refused by ${host}. Is the service running on that host/port?`;
    case 'ETIMEDOUT':
    case 'UND_ERR_CONNECT_TIMEOUT':
      return `Connection to ${host} timed out.`;
    case 'ECONNRESET':
      return `Connection to ${host} was reset.`;
    case 'CERT_HAS_EXPIRED':
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
      return `TLS certificate error reaching ${host} (${code}).`;
    default: {
      const causeMsg = cause instanceof Error ? cause.message : undefined;
      if (causeMsg) return `Could not reach ${host}: ${causeMsg}`;
      return err instanceof Error ? err.message : String(err);
    }
  }
}
