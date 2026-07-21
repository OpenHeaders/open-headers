/**
 * Copy as cURL — render a resolved wire request as a runnable POSIX
 * shell command. Quoting matches the DevTools Network tab's POSIX copy
 * variant (single-quote escape via `'\''`); one flag per line, joined
 * with backslash continuations.
 *
 * Auth that signs at the wire maps onto curl's native machinery instead
 * of pre-baked headers: `aws-sigv4` emits `--user` + `--aws-sigv4` (curl
 * signs the final shape itself, exactly like our wire executor), and
 * `digest` emits `--digest --user` (curl answers the 401 challenge).
 */

import type { WireSnippetRequest } from './types';
import { effectiveHeaders, enabledFormParts, wireTextBody } from './wire';

function shellQuote(value: string): string {
  if (value === '') return "''";
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function formatCurlSnippet(req: WireSnippetRequest): string {
  const method = req.method.toUpperCase();
  const parts: string[] = [`curl ${shellQuote(req.url)}`];

  if (method !== 'GET') {
    parts.push(`-X ${shellQuote(method)}`);
  }

  for (const h of effectiveHeaders(req)) {
    parts.push(`-H ${shellQuote(`${h.key}: ${h.value}`)}`);
  }

  if (req.digest) {
    parts.push('--digest');
    parts.push(`--user ${shellQuote(`${req.digest.username}:${req.digest.password}`)}`);
  }

  if (req.awsSigV4) {
    parts.push(`--user ${shellQuote(`${req.awsSigV4.accessKeyId}:${req.awsSigV4.secretAccessKey}`)}`);
    parts.push(`--aws-sigv4 ${shellQuote(`aws:amz:${req.awsSigV4.region}:${req.awsSigV4.service}`)}`);
    if (req.awsSigV4.sessionToken) {
      parts.push(`-H ${shellQuote(`x-amz-security-token: ${req.awsSigV4.sessionToken}`)}`);
    }
  }

  const text = wireTextBody(req.body);
  if (text !== null && text.length > 0) {
    parts.push(`--data-raw ${shellQuote(text)}`);
  } else if (req.body.type === 'form') {
    for (const p of enabledFormParts(req.body.formParts)) {
      parts.push(`--data-urlencode ${shellQuote(`${p.key}=${p.value}`)}`);
    }
  } else if (req.body.type === 'multipart') {
    for (const part of req.body.multipartParts) {
      if (part.enabled === false) continue;
      if (part.kind === 'text') {
        parts.push(`-F ${shellQuote(`${part.name}=${part.value}`)}`);
        continue;
      }
      for (const ref of part.fileRefs) {
        const type = ref.mimeType ? `;type=${ref.mimeType}` : '';
        parts.push(`-F ${shellQuote(`${part.name}=@${ref.filename}${type}`)}`);
      }
    }
  }

  return parts.join(' \\\n  ');
}
