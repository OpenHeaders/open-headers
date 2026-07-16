/**
 * Spec document path navigation — the pure AST core under the editor's
 * hover and go-to-definition services. Same position source as the
 * outline (`yaml.parseDocument` covers YAML and JSON — YAML 1.2 is a
 * superset), and everything here takes a parsed `Document` so callers
 * own the caching policy (the Monaco layer caches by model version;
 * tests parse directly).
 */

import type { Document, Pair, Scalar } from 'yaml';
import { isMap, isScalar, isSeq, parseDocument } from 'yaml';

/** One document-path segment: a map key or a sequence index. */
export type SpecDocSegment = string | number;

export interface SpecPathHit {
  /** Map keys / sequence indices from the root down to the token. */
  path: SpecDocSegment[];
  /** Whether the offset sits on a pair's key or a scalar value. */
  token: 'key' | 'value';
  /** The token's source span — the hover highlight range. */
  start: number;
  end: number;
  /** The scalar's text — value tokens only. */
  value?: string;
}

/** Parse for path navigation; null when the text isn't a mapping doc. */
export function parseSpecDocument(content: string): Document | null {
  const doc = parseDocument(content);
  return doc.errors.length === 0 && isMap(doc.contents) ? doc : null;
}

function tokenRange(node: unknown): [number, number] | null {
  if (node !== null && typeof node === 'object' && 'range' in node) {
    const range = (node as { range?: [number, number, number] | null }).range;
    // range[1] ends the node's own token text; range[2] would include
    // trailing comments/whitespace — wrong for a hover highlight.
    if (Array.isArray(range)) return [range[0], range[1]];
  }
  return null;
}

function contains(range: [number, number], offset: number): boolean {
  return offset >= range[0] && offset <= range[1];
}

function scalarText(node: Scalar): string | null {
  const value = node.value;
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : null;
}

function keyString(pair: Pair): string | null {
  return isScalar(pair.key) && (typeof pair.key.value === 'string' || typeof pair.key.value === 'number')
    ? String(pair.key.value)
    : null;
}

function walkNode(node: unknown, offset: number, path: SpecDocSegment[]): SpecPathHit | null {
  if (isScalar(node)) {
    const range = tokenRange(node);
    if (range === null || !contains(range, offset)) return null;
    const value = scalarText(node);
    return { path, token: 'value', start: range[0], end: range[1], ...(value !== null ? { value } : {}) };
  }
  if (isMap(node)) {
    for (const pair of node.items) {
      const key = keyString(pair);
      if (key === null) continue;
      const keyRange = tokenRange(pair.key);
      if (keyRange !== null && contains(keyRange, offset)) {
        return { path: [...path, key], token: 'key', start: keyRange[0], end: keyRange[1] };
      }
      const hit = walkNode(pair.value, offset, [...path, key]);
      if (hit !== null) return hit;
    }
    return null;
  }
  if (isSeq(node)) {
    for (const [index, item] of node.items.entries()) {
      const hit = walkNode(item, offset, [...path, index]);
      if (hit !== null) return hit;
    }
    return null;
  }
  return null;
}

/**
 * The document path of the token at `offset` — the pair key or scalar
 * value under the cursor; null on whitespace and structural syntax.
 */
export function specPathAtOffset(doc: Document, offset: number): SpecPathHit | null {
  return walkNode(doc.contents, offset, []);
}

export interface SpecPointerTarget {
  /** The target's key-token span — where go-to-definition lands. */
  start: number;
  end: number;
}

/**
 * Resolve a local JSON Pointer reference (`#/components/schemas/X`) to
 * the source span of the target's key. Null for external references,
 * non-pointer fragments, and paths the document doesn't contain.
 */
export function resolveSpecPointer(doc: Document, pointer: string): SpecPointerTarget | null {
  if (!pointer.startsWith('#/')) return null;
  const segments = pointer
    .slice(2)
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
  let node: unknown = doc.contents;
  let lastKeyRange: [number, number] | null = null;
  for (const segment of segments) {
    if (isMap(node)) {
      const pair = node.items.find((item) => keyString(item) === segment);
      if (pair === undefined) return null;
      lastKeyRange = tokenRange(pair.key);
      node = pair.value;
      continue;
    }
    if (isSeq(node)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= node.items.length) return null;
      const item: unknown = node.items[index];
      lastKeyRange = tokenRange(item);
      node = item;
      continue;
    }
    return null;
  }
  return lastKeyRange !== null ? { start: lastKeyRange[0], end: lastKeyRange[1] } : null;
}
