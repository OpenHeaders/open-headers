/**
 * SW-side source-map fetcher for the DevTools panel.
 *
 * The panel page runs under `default-src 'self'` CSP, so it cannot
 * cross-origin fetch directly. This module runs in the background
 * service worker, which carries the extension's full host_permissions
 * and is unaffected by panel-page CSP.
 *
 * Two GETs (both read-only, idempotent, credentials included so source
 * maps behind corporate auth / dev-environment login pages still resolve
 * when the user has a live session — same trust boundary as the page
 * being debugged):
 *   1. The JS URL — to discover the `sourceMappingURL` via either the
 *      `SourceMap` / `X-SourceMap` response header or the trailing
 *      `//# sourceMappingURL=…` comment in the body.
 *   2. The resolved map URL — or, if it's a `data:` URL, the inline
 *      bytes are decoded without a second fetch.
 *
 * Every failure path returns `{ mapText: null }` — the renderer's
 * parser handles "no map" by leaving the raw V8 frame name in place.
 */

import { logger } from '@utils/logger';

const SOURCE_MAPPING_URL_RE = /\/[\/\*]#\s*sourceMappingURL=([^\s*]+)/;

/** 8 MB hard cap on map size — defensive against pathological responses. */
const MAP_MAX_BYTES = 8 * 1024 * 1024;

/** 5 MB hard cap on JS body we read while searching for the comment. */
const JS_BODY_MAX_BYTES = 5 * 1024 * 1024;

async function readWithCap(res: Response, cap: number): Promise<string | null> {
  // Streaming decode with a byte cap, so a misbehaving server can't
  // exhaust SW memory.
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    return text.length > cap ? null : text;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      try {
        await reader.cancel();
      } catch {
        // Cancellation failure is benign.
      }
      return null;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function decodeDataUrl(mapUrl: string): string | null {
  const commaIdx = mapUrl.indexOf(',');
  if (commaIdx < 0) return null;
  const header = mapUrl.slice(5, commaIdx);
  const data = mapUrl.slice(commaIdx + 1);
  if (header.includes('base64')) {
    try {
      return atob(data);
    } catch {
      return null;
    }
  }
  try {
    return decodeURIComponent(data);
  } catch {
    return null;
  }
}

export interface FetchSourceMapResult {
  mapText: string | null;
}

export async function fetchSourceMapText(jsUrl: string): Promise<FetchSourceMapResult> {
  logger.info('SourceMapFetch', `→ ${jsUrl}`);
  if (!jsUrl || (!jsUrl.startsWith('http://') && !jsUrl.startsWith('https://'))) {
    logger.info('SourceMapFetch', `skipped: not http(s) — ${jsUrl}`);
    return { mapText: null };
  }
  let jsRes: Response;
  try {
    jsRes = await fetch(jsUrl, { credentials: 'include', redirect: 'follow' });
  } catch (err) {
    logger.info('SourceMapFetch', `JS fetch threw: ${(err as Error).message}`);
    return { mapText: null };
  }
  if (!jsRes.ok) {
    logger.info('SourceMapFetch', `JS fetch !ok: status=${jsRes.status} ${jsUrl}`);
    return { mapText: null };
  }

  let mapUrl = jsRes.headers.get('SourceMap') ?? jsRes.headers.get('X-SourceMap');
  let fromHeader = true;
  if (!mapUrl) {
    fromHeader = false;
    const body = await readWithCap(jsRes, JS_BODY_MAX_BYTES);
    if (!body) {
      logger.info('SourceMapFetch', `JS body too large or unreadable — ${jsUrl}`);
      return { mapText: null };
    }
    const tail = body.slice(Math.max(0, body.length - 8192));
    const m = tail.match(SOURCE_MAPPING_URL_RE);
    if (!m) {
      logger.info('SourceMapFetch', `no sourceMappingURL directive in ${jsUrl}`);
      return { mapText: null };
    }
    mapUrl = m[1];
  }
  mapUrl = mapUrl.trim();
  logger.info('SourceMapFetch', `mapUrl=${mapUrl} (from=${fromHeader ? 'header' : 'comment'})`);

  if (mapUrl.startsWith('data:')) {
    const text = decodeDataUrl(mapUrl);
    logger.info('SourceMapFetch', `data: URL decoded → ${text ? `${text.length} bytes` : 'null'}`);
    return { mapText: text };
  }

  let absolute: string;
  try {
    absolute = new URL(mapUrl, jsUrl).toString();
  } catch {
    logger.info('SourceMapFetch', `invalid map URL: ${mapUrl}`);
    return { mapText: null };
  }

  let mapRes: Response;
  try {
    mapRes = await fetch(absolute, { credentials: 'include', redirect: 'follow' });
  } catch (err) {
    logger.info('SourceMapFetch', `map fetch threw: ${(err as Error).message} — ${absolute}`);
    return { mapText: null };
  }
  if (!mapRes.ok) {
    logger.info('SourceMapFetch', `map fetch !ok: status=${mapRes.status} ${absolute}`);
    return { mapText: null };
  }
  const mapText = await readWithCap(mapRes, MAP_MAX_BYTES);
  logger.info('SourceMapFetch', `✓ ${absolute} → ${mapText ? `${mapText.length} bytes` : 'null (cap exceeded)'}`);
  return { mapText };
}
