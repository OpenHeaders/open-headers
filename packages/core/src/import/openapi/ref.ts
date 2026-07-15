/**
 * Internal `$ref` resolution for OpenAPI documents. Refs use the
 * RFC 6901 JSON-pointer fragment form (`#/components/parameters/Page`).
 * External refs (anything not starting with `#`) are never fetched —
 * the importer is offline by design — and external / missing /
 * circular targets resolve to a typed failure the caller reports;
 * resolution never throws.
 */

import { isRecord } from '../data-scan/json';

export type RefFailureKind = 'external' | 'missing' | 'circular';

export interface RefFailure {
  ref: string;
  kind: RefFailureKind;
}

export type Resolved = { ok: true; value: unknown } | { ok: false; failure: RefFailure };

export interface RefResolver {
  /** Follow `$ref` chains until a concrete node (or a failure). */
  resolve(node: unknown): Resolved;
}

export function createRefResolver(root: Record<string, unknown>): RefResolver {
  function lookup(ref: string): { found: boolean; value?: unknown } {
    const pointer = ref.slice(1);
    if (pointer === '') return { found: true, value: root };
    if (!pointer.startsWith('/')) return { found: false };
    let node: unknown = root;
    for (const rawSegment of pointer.slice(1).split('/')) {
      const segment = rawSegment.replace(/~1/g, '/').replace(/~0/g, '~');
      if (Array.isArray(node)) {
        const index = Number(segment);
        if (!Number.isInteger(index) || index < 0 || index >= node.length) return { found: false };
        node = node[index];
      } else if (isRecord(node)) {
        if (!Object.hasOwn(node, segment)) return { found: false };
        node = node[segment];
      } else {
        return { found: false };
      }
    }
    return { found: true, value: node };
  }

  function resolve(node: unknown): Resolved {
    const seen = new Set<string>();
    let current = node;
    while (isRecord(current) && typeof current.$ref === 'string') {
      const ref = current.$ref;
      if (!ref.startsWith('#')) return { ok: false, failure: { ref, kind: 'external' } };
      if (seen.has(ref)) return { ok: false, failure: { ref, kind: 'circular' } };
      seen.add(ref);
      const target = lookup(ref);
      if (!target.found) return { ok: false, failure: { ref, kind: 'missing' } };
      current = target.value;
    }
    return { ok: true, value: current };
  }

  return { resolve };
}
