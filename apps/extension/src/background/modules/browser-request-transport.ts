/**
 * Browser request transport — the service worker's implementation of the
 * engine's `RequestTransport` seam (`@openheaders/oracle/live/request-exec`),
 * used by the Live Workflow chain executor.
 *
 * Browser-specific concerns the host-neutral executor delegates here:
 *   - **Offline pre-flight.** Chromium opaques every network error into
 *     `TypeError: Failed to fetch`, so we catch `navigator.onLine` up
 *     front for a clean, actionable message.
 *   - **Host-access gate.** Every fetch routes through `withHostAccess`
 *     — today a pass-through, tomorrow the gate for a minimal-permissions
 *     SKU.
 *   - **Error classification.** The browser withholds the underlying OS
 *     error, so we replace the content-free default with a likely-cause
 *     breakdown (vs. Node, which exposes `err.cause.code`).
 *
 * Body construction (URLSearchParams / FormData) uses the SW's Web APIs;
 * the engine hands down a data-only `TransportBody` so this layer only
 * materializes the host fetch primitives.
 *
 * NOTE: the user-facing `executeResolved` in `request-executor.ts` still
 * carries its own copy of this wire logic (plus the Status-pill report);
 * converging it onto this transport is the deferred "full lift" of the
 * request executor onto the shared core.
 */

import {
  type RequestTransport,
  type TransportBody,
  TransportError,
  type TransportHeader,
  type TransportRequest,
  type TransportResponse,
} from '@openheaders/oracle/live/request-exec/transport';
import { withHostAccess } from '@/shared/fetch/with-host-access';

/** Singleton — the chain executor reuses one instance per host. */
export const browserRequestTransport: RequestTransport = {
  async send(request: TransportRequest): Promise<TransportResponse> {
    // Offline gate — produce a clean message before the opaque
    // `Failed to fetch` the browser would otherwise return.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new TransportError("Can't reach network — device reports offline. Check your connection and try again.");
    }

    const headers = new Headers();
    for (const { key, value } of request.headers) headers.append(key, value);

    const init: RequestInit = {
      method: request.method,
      headers,
      redirect: request.redirect,
      cache: 'no-store',
      credentials: request.credentials,
    };
    const body = buildBody(request.body);
    if (body !== undefined) init.body = body;

    let response: Response;
    try {
      response = await withHostAccess(request.url, () => fetch(request.url, init));
    } catch (err) {
      throw new TransportError(classifyFetchFailure(request.url, err));
    }

    const outHeaders: TransportHeader[] = [];
    response.headers.forEach((value, key) => {
      outHeaders.push({ key, value });
    });
    return {
      status: response.status,
      statusText: response.statusText,
      url: response.url || request.url,
      headers: outHeaders,
      body: await response.text(),
    };
  },
};

function buildBody(body: TransportBody): BodyInit | undefined {
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
 * Produce a user-actionable error string for the generic
 * `TypeError: Failed to fetch` Chromium returns for every non-TLS
 * network failure. The browser withholds the underlying OS error, so we
 * replace the content-free default with the likely causes.
 */
function classifyFetchFailure(url: string, err: unknown): string {
  const rawMessage = err instanceof Error ? err.message : String(err);
  let hostname = '';
  let protocol = '';
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname;
    protocol = parsed.protocol;
  } catch {
    return `${rawMessage} — invalid URL "${url}"`;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return `Network offline — could not reach ${hostname}.`;
  }
  const looksLocal =
    /^(localhost|127\.)/.test(hostname) ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.localhost') ||
    (!hostname.includes('.') && !hostname.includes(':'));
  if (looksLocal) {
    return `Could not reach ${hostname} (${protocol.replace(':', '')}). Is the service running? If it requires HTTPS, enter the full URL with https:// prefix.`;
  }
  return `Could not reach ${hostname}. Possible causes: host not found (DNS), connection refused, TLS certificate error, or missing host permission. Check the URL and retry.`;
}
