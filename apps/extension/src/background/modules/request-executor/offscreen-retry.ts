/**
 * Certificate-exception retry — the SW side of the offscreen wire
 * fetch (see shared/wire-fetch/execute-plan.ts for the why).
 *
 * Chromium stores the user's "Proceed to … (unsafe)" decision per
 * host, but honors it only for document-associated requests: the SW's
 * own `fetch()` keeps failing `net::ERR_CERT_*` after the user accepts
 * the interstitial. When the wire capture recovers a certificate-
 * family code, the executor rebuilds the exchange as a serializable
 * {@link WirePlan} and re-runs it inside the offscreen document, where
 * the exception applies. Retrying is safe by construction: a
 * certificate rejection fails the TLS handshake, so the original
 * request never reached the server — no double-send risk.
 *
 * Firefox needs none of this — its background context is a real
 * document, so the accepted override already applies to the normal
 * fetch. `isOffscreenSupported()` (false there) gates the retry out.
 */

import { getFileBlob } from '@openheaders/oracle/entity/files-store';
import { toBase64 } from '@openheaders/oracle/live/request-exec/body-decode';
import type { WireFetchResult, WirePlan, WirePlanBody, WirePlanMultipartPart } from '@/shared/wire-fetch/plan';
import { isOffscreenSupported, runWireFetch } from '../offscreen-host';
import { graphqlWireText } from './body';
import type { ResolvedRequest } from './resolve';

/**
 * True for the certificate-family net codes a user-accepted exception
 * can bypass. Client-certificate failures (`ERR_SSL_CLIENT_AUTH_*`,
 * `ERR_BAD_SSL_CLIENT_AUTH_CERT`) are excluded — the server is asking
 * for a certificate we don't have; no interstitial decision fixes that.
 */
export function isCertRejection(netError: string | undefined): boolean {
  if (!netError) return false;
  if (netError.includes('CLIENT_AUTH')) return false;
  return netError.includes('CERT_');
}

/**
 * Rebuild the resolved exchange as a wire plan and run it in the
 * offscreen document. `null` means "no better outcome" — unsupported
 * runtime, plan build failure, or the retry failing too (the caller
 * keeps its original classified error in every case).
 */
export async function retryCertRejectedFetch(
  req: ResolvedRequest,
  capBytes: number,
): Promise<(WireFetchResult & { ok: true }) | null> {
  if (!isOffscreenSupported()) return null;
  try {
    const plan = await buildWirePlan(req, capBytes);
    const result = await runWireFetch(plan);
    return result.ok ? result : null;
  } catch {
    return null;
  }
}

/** Fold a `ResolvedRequest` down to wire altitude — the same shapes
 *  `executeResolved` puts on the socket, but JSON-serializable. */
export async function buildWirePlan(req: ResolvedRequest, capBytes: number): Promise<WirePlan> {
  const headers = req.headers.map((h) => ({ key: h.key, value: h.value }));
  const body = await buildWirePlanBody(req);
  if (body.kind === 'multipart') {
    // Mirror the SW wire layer: a user-set multipart Content-Type must
    // not travel — the executing context's FormData sets its own with
    // the generated boundary.
    const at = headers.findIndex(
      (h) => h.key.toLowerCase() === 'content-type' && h.value.toLowerCase().startsWith('multipart/form-data'),
    );
    if (at >= 0) headers.splice(at, 1);
  }
  return {
    url: req.url,
    method: req.method,
    headers,
    body,
    redirect: req.followRedirects === false ? 'manual' : 'follow',
    credentials: req.credentialsMode,
    ...(req.timeoutMs !== undefined ? { timeoutMs: req.timeoutMs } : {}),
    capBytes,
  };
}

async function buildWirePlanBody(req: ResolvedRequest): Promise<WirePlanBody> {
  switch (req.body.type) {
    case 'none':
      return { kind: 'none' };
    case 'json':
    case 'xml':
    case 'text':
      return { kind: 'text', content: req.body.content };
    case 'graphql':
      return { kind: 'text', content: graphqlWireText(req.body.content, req.body.graphqlVariables) };
    case 'form':
      return {
        kind: 'form',
        entries: req.body.formParts.filter((p) => p.enabled !== false).map((p) => ({ key: p.key, value: p.value })),
      };
    case 'multipart': {
      const parts: WirePlanMultipartPart[] = [];
      for (const part of req.body.multipartParts) {
        if (part.enabled === false) continue;
        if (part.kind === 'text') {
          parts.push({ kind: 'text', name: part.name, value: part.value });
          continue;
        }
        // Same blob semantics as `buildMultipartForm`: one part per
        // FileRef, missing blobs skipped silently.
        for (const ref of part.fileRefs) {
          const blob = await getFileBlob(ref.fileId);
          if (!blob) continue;
          const mimeType = ref.mimeType ?? blob.type ?? 'application/octet-stream';
          parts.push({
            kind: 'file',
            name: part.name,
            bytesBase64: toBase64(new Uint8Array(await blob.arrayBuffer())),
            filename: ref.filename,
            mimeType,
          });
        }
      }
      return { kind: 'multipart', parts };
    }
    default: {
      const _exhaustive: never = req.body;
      void _exhaustive;
      return { kind: 'none' };
    }
  }
}
