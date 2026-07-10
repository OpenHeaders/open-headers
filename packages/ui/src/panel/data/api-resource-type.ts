/**
 * REST-vs-GraphQL classification for a captured request — GraphQL when
 * the URL path points at a graphql endpoint, or when the outgoing JSON
 * body carries the standard `query` field (single or batched). Shared
 * by the override-draft seeding (rule CTAs) and the API-request
 * scratch-tab handoff.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';

export function detectApiResourceType(lc: RequestLifecycle, har: InspectorHarEntry | null): 'rest' | 'graphql' {
  try {
    if (new URL(lc.url).pathname.toLowerCase().includes('graphql')) return 'graphql';
  } catch {
    // non-URL values fall through to the body check
  }
  const text = har?.request?.postData?.text;
  if (text) {
    try {
      const parsed: unknown = JSON.parse(text);
      const ops = Array.isArray(parsed) ? parsed : [parsed];
      if (ops.length > 0 && ops.every((op) => typeof (op as { query?: unknown })?.query === 'string')) {
        return 'graphql';
      }
    } catch {
      // not JSON — REST
    }
  }
  return 'rest';
}
