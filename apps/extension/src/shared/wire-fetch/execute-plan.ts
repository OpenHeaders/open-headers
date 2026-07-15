/**
 * Wire-plan execution — runs a serialized {@link WirePlan} with
 * `fetch()` in WHATEVER context imports it. It exists because the
 * context matters: Chromium honors user-accepted certificate
 * exceptions ("Proceed to … (unsafe)") only for requests associated
 * with a document, never for MV3 service-worker fetches. The SW's own
 * fetch keeps failing `net::ERR_CERT_AUTHORITY_INVALID` after the user
 * accepts the interstitial, while the same fetch from the offscreen
 * document (a real page context) succeeds. The executor therefore
 * retries certificate-rejected sends by shipping the plan to the
 * offscreen document, which calls this function.
 *
 * The result is JSON-serializable (body as base64) so it can ride the
 * `chrome.runtime` reply channel back to the SW, which re-materializes
 * text-vs-binary with the shared body-decode contract.
 */

import { toBase64 } from '@openheaders/oracle/live/request-exec/body-decode';
import { withHostAccess } from '../fetch/with-host-access';
import { base64ToBytes, type WireFetchResult, type WirePlan } from './plan';

export async function executeWirePlan(plan: WirePlan): Promise<WireFetchResult> {
  const headers = new Headers();
  for (const h of plan.headers) headers.append(h.key, h.value);

  const init: RequestInit = {
    method: plan.method,
    headers,
    redirect: plan.redirect,
    cache: 'no-store',
    credentials: plan.credentials,
  };

  switch (plan.body.kind) {
    case 'none':
      break;
    case 'text':
      init.body = plan.body.content;
      break;
    case 'form': {
      const params = new URLSearchParams();
      for (const e of plan.body.entries) params.append(e.key, e.value);
      init.body = params;
      break;
    }
    case 'multipart': {
      const form = new FormData();
      for (const part of plan.body.parts) {
        if (part.kind === 'text') {
          form.append(part.name, part.value);
          continue;
        }
        const blob = new Blob([base64ToBytes(part.bytesBase64) as BlobPart], { type: part.mimeType });
        form.append(part.name, blob, part.filename);
      }
      init.body = form;
      break;
    }
    default: {
      const _exhaustive: never = plan.body;
      void _exhaustive;
    }
  }

  // Same one-deadline-spans-everything contract as the SW wire layer:
  // connect, response, and body read all race the same abort.
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  if (plan.timeoutMs !== undefined) {
    const controller = new AbortController();
    init.signal = controller.signal;
    timer = setTimeout(() => {
      expired = true;
      controller.abort();
    }, plan.timeoutMs);
  }

  const startedAt = performance.now();
  try {
    const response = await withHostAccess(plan.url, () => fetch(plan.url, init));
    const rawBytes = new Uint8Array(await response.arrayBuffer());
    const truncated = rawBytes.byteLength > plan.capBytes;
    const kept = truncated ? rawBytes.subarray(0, plan.capBytes) : rawBytes;
    const headersOut: Array<{ key: string; value: string }> = [];
    response.headers.forEach((value, key) => {
      headersOut.push({ key, value });
    });
    return {
      ok: true,
      status: response.status,
      statusText: response.statusText,
      url: response.url || plan.url,
      headers: headersOut,
      bodyBase64: toBase64(kept),
      bodyBytes: rawBytes.byteLength,
      truncated,
      durationMs: Math.round(performance.now() - startedAt),
    };
  } catch (err) {
    const message = expired
      ? `Request timed out after ${plan.timeoutMs} ms.`
      : err instanceof Error
        ? err.message
        : String(err);
    return { ok: false, message };
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}
