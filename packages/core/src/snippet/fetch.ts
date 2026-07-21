/**
 * Copy as fetch — render a resolved wire request as a `fetch()` call.
 * Mirrors the DevTools panel's copy shape: `fetch(url, init)` with a
 * pretty-printed init. Form bodies serialize to the urlencoded string
 * the executor would ship (with the Content-Type made explicit, since a
 * string body doesn't set one); multipart bodies emit a FormData
 * prologue with one append per part, and file parts a comment naming
 * the file to attach — bytes can't ride a text snippet.
 *
 * SigV4 / digest auth aren't expressible in a fetch call (both sign or
 * answer challenges at the wire) — a leading comment says so instead of
 * silently dropping the auth.
 */

import type { WireHeader, WireSnippetRequest } from './types';
import { effectiveHeaders, enabledFormParts, wireTextBody } from './wire';

function headersObject(headers: readonly WireHeader[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers) out[h.key] = h.value;
  return out;
}

function hasContentType(headers: readonly WireHeader[]): boolean {
  return headers.some((h) => h.key.toLowerCase() === 'content-type');
}

/** Indent every line after the first so nested JSON sits inside the init. */
function indentTail(text: string, pad: string): string {
  return text.split('\n').join(`\n${pad}`);
}

export function formatFetchSnippet(req: WireSnippetRequest): string {
  const method = req.method.toUpperCase();
  let headers = effectiveHeaders(req);
  const prologue: string[] = [];

  if (req.awsSigV4 || req.digest) {
    prologue.push(
      req.awsSigV4
        ? '// AWS SigV4 signing is not expressible in fetch() — use the cURL copy instead.'
        : '// HTTP digest auth is not expressible in fetch() — use the cURL copy instead.',
    );
  }

  let bodyExpr: string | null = null;
  const text = wireTextBody(req.body);
  if (text !== null && text.length > 0) {
    bodyExpr = JSON.stringify(text);
  } else if (req.body.type === 'form') {
    const params = new URLSearchParams();
    for (const p of enabledFormParts(req.body.formParts)) params.append(p.key, p.value);
    bodyExpr = JSON.stringify(params.toString());
    if (!hasContentType(headers)) {
      headers = [...headers, { key: 'Content-Type', value: 'application/x-www-form-urlencoded' }];
    }
  } else if (req.body.type === 'multipart') {
    prologue.push('const formData = new FormData();');
    for (const part of req.body.multipartParts) {
      if (part.enabled === false) continue;
      if (part.kind === 'text') {
        prologue.push(`formData.append(${JSON.stringify(part.name)}, ${JSON.stringify(part.value)});`);
        continue;
      }
      for (const ref of part.fileRefs) {
        prologue.push(`// ${JSON.stringify(part.name)}: attach ${ref.filename} as a File/Blob here`);
        prologue.push(`formData.append(${JSON.stringify(part.name)}, new Blob([]), ${JSON.stringify(ref.filename)});`);
      }
    }
    bodyExpr = 'formData';
  }

  const initLines: string[] = [];
  if (method !== 'GET') initLines.push(`  "method": ${JSON.stringify(method)}`);
  if (headers.length > 0) {
    initLines.push(`  "headers": ${indentTail(JSON.stringify(headersObject(headers), null, 2), '  ')}`);
  }
  if (bodyExpr !== null) initLines.push(`  "body": ${bodyExpr}`);

  const call =
    initLines.length === 0
      ? `fetch(${JSON.stringify(req.url)})`
      : `fetch(${JSON.stringify(req.url)}, {\n${initLines.join(',\n')}\n})`;

  return prologue.length > 0 ? `${prologue.join('\n')}\n${call}` : call;
}
