/**
 * Pure formatters for the response panel: pretty-print a JSON body
 * (falling back to the raw text on parse failure) and humanize byte
 * counts.
 */

import type { ExecutedRequestSnapshot } from '@openheaders/core/types';

export function formatBody(resp: ExecutedRequestSnapshot): string {
  if (!resp.body) return '(empty body)';
  const ct = resp.headers.find((h) => h.key.toLowerCase() === 'content-type')?.value ?? '';
  if (ct.includes('json')) {
    try {
      return JSON.stringify(JSON.parse(resp.body), null, 2);
    } catch {
      return resp.body;
    }
  }
  return resp.body;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
