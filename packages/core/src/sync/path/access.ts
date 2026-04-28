/**
 * Immutable read/write traversal over object/array trees by parsed
 * path segments. Spine cloning only — leaf values are not deep-cloned.
 *
 * Mutators run schema validation on the path itself before calling
 * these helpers (§7.3), so missing intermediates are programmer
 * errors and surface as exceptions, not silent creates.
 */

import type { PathSegment } from './parse';

type IndexableArray = readonly unknown[];
type IndexableObject = { readonly [key: string]: unknown };
type Indexable = IndexableArray | IndexableObject;

const isArray = Array.isArray as (v: unknown) => v is IndexableArray;
const isObject = (v: unknown): v is IndexableObject => typeof v === 'object' && v !== null && !isArray(v);

function indexOrKey(parent: Indexable, segment: PathSegment): number | string {
  if (isArray(parent)) {
    const i = Number.parseInt(segment, 10);
    if (!Number.isInteger(i) || i < 0) {
      throw new Error(`pathAccess: array segment must be a non-negative integer, got "${segment}"`);
    }
    return i;
  }
  return segment;
}

export function getAtPath(root: unknown, segments: readonly PathSegment[]): unknown {
  let cur: unknown = root;
  for (const seg of segments) {
    if (cur === undefined || cur === null) return undefined;
    if (!isArray(cur) && !isObject(cur)) return undefined;
    const k = indexOrKey(cur, seg);
    cur = (cur as IndexableObject | IndexableArray)[k as never];
  }
  return cur;
}

export function setAtPath<T>(root: T, segments: readonly PathSegment[], value: unknown): T {
  if (segments.length === 0) return value as T;
  return cloneAndSet(root, segments, 0, value) as T;
}

export function unsetAtPath<T>(root: T, segments: readonly PathSegment[]): T {
  if (segments.length === 0) return undefined as unknown as T;
  return cloneAndUnset(root, segments, 0) as T;
}

export function hasPath(root: unknown, segments: readonly PathSegment[]): boolean {
  let cur: unknown = root;
  for (const seg of segments) {
    if (!isArray(cur) && !isObject(cur)) return false;
    const k = indexOrKey(cur, seg);
    if (isArray(cur)) {
      if ((k as number) >= cur.length) return false;
    } else {
      if (!Object.hasOwn(cur, k)) return false;
    }
    cur = (cur as IndexableObject | IndexableArray)[k as never];
  }
  return true;
}

function cloneAndSet(node: unknown, segments: readonly PathSegment[], depth: number, value: unknown): unknown {
  const seg = segments[depth];
  if (isArray(node)) {
    const i = Number.parseInt(seg, 10);
    if (!Number.isInteger(i) || i < 0 || i > node.length) {
      throw new Error(`setAtPath: index ${seg} out of bounds for array length ${node.length}`);
    }
    const next = node.slice() as unknown[];
    next[i] = depth === segments.length - 1 ? value : cloneAndSet(node[i], segments, depth + 1, value);
    return next;
  }
  if (isObject(node)) {
    const next: Record<string, unknown> = { ...node };
    next[seg] = depth === segments.length - 1 ? value : cloneAndSet(node[seg], segments, depth + 1, value);
    return next;
  }
  throw new Error(`setAtPath: cannot descend into non-container at segment "${seg}"`);
}

function cloneAndUnset(node: unknown, segments: readonly PathSegment[], depth: number): unknown {
  const seg = segments[depth];
  const isLeaf = depth === segments.length - 1;
  if (isArray(node)) {
    const i = Number.parseInt(seg, 10);
    if (!Number.isInteger(i) || i < 0 || i >= node.length) return node;
    if (isLeaf) {
      const next = node.slice() as unknown[];
      next.splice(i, 1);
      return next;
    }
    const next = node.slice() as unknown[];
    next[i] = cloneAndUnset(node[i], segments, depth + 1);
    return next;
  }
  if (isObject(node)) {
    if (isLeaf) {
      if (!Object.hasOwn(node, seg)) return node;
      const next: Record<string, unknown> = { ...node };
      delete next[seg];
      return next;
    }
    const next: Record<string, unknown> = { ...node };
    next[seg] = cloneAndUnset(node[seg], segments, depth + 1);
    return next;
  }
  return node;
}
