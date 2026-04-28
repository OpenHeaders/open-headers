/**
 * Flatten an arbitrary JSON-shaped payload to a list of leaf
 * (path, value) pairs and reconstruct it back. The flattener powers
 * {@link applyCreate}: a `create` payload is treated as a bundle of
 * synthetic per-leaf `setField` writes, all stamped with the create's
 * HLC. This way `create` composes with subsequent `setField`s under
 * any total order — max-HLC-wins falls out per-leaf.
 *
 * Leaves are: scalars (string / number / boolean / null), `undefined`
 * (preserved as a sentinel — used by `unsetField` writes, never on
 * the wire), and empty containers (so an explicit `[]` or `{}` on a
 * field round-trips).
 */

import { joinPath } from '../path';

export interface Leaf {
  path: string;
  value: unknown;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function flattenToLeaves(payload: unknown): Leaf[] {
  const leaves: Leaf[] = [];
  walk(payload, [], leaves);
  return leaves;
}

function walk(node: unknown, prefix: string[], out: Leaf[]): void {
  if (Array.isArray(node)) {
    if (node.length === 0) {
      out.push({ path: joinPath(prefix), value: [] });
      return;
    }
    for (let i = 0; i < node.length; i += 1) {
      walk(node[i], [...prefix, String(i)], out);
    }
    return;
  }
  if (isPlainObject(node)) {
    const keys = Object.keys(node);
    if (keys.length === 0) {
      out.push({ path: joinPath(prefix), value: {} });
      return;
    }
    for (const k of keys) {
      walk(node[k], [...prefix, k], out);
    }
    return;
  }
  out.push({ path: joinPath(prefix), value: node });
}

const NUMERIC_RE = /^\d+$/;

/**
 * Build an object/array tree from a flat leaf set. Container type at
 * each level is inferred from the next path segment: numeric → array,
 * non-numeric → object.
 *
 * Empty containers carried as leaves (`{ path: 'a.b', value: [] }`)
 * are written verbatim. Conflicting container types at the same path
 * (one leaf says array, another says object) is a programmer error
 * and throws — generators avoid it.
 */
export function unflattenLeaves(leaves: Iterable<Leaf>): unknown {
  let result: unknown;
  let rootInitialized = false;

  for (const { path, value } of leaves) {
    if (path === '') {
      result = value;
      rootInitialized = true;
      continue;
    }
    const segments = path.split('.');
    if (!rootInitialized) {
      result = NUMERIC_RE.test(segments[0]) ? [] : {};
      rootInitialized = true;
    }
    result = writeLeaf(result, segments, value);
  }

  return result;
}

function writeLeaf(root: unknown, segments: string[], value: unknown): unknown {
  let cursor: unknown = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const seg = segments[i];
    const nextSeg = segments[i + 1];
    if (Array.isArray(cursor)) {
      const idx = Number.parseInt(seg, 10);
      if (cursor[idx] === undefined) {
        cursor[idx] = NUMERIC_RE.test(nextSeg) ? [] : {};
      }
      cursor = cursor[idx];
    } else if (isPlainObject(cursor)) {
      if (!(seg in cursor)) {
        cursor[seg] = NUMERIC_RE.test(nextSeg) ? [] : {};
      }
      cursor = cursor[seg];
    } else {
      throw new Error(`unflattenLeaves: cannot descend into ${typeof cursor} at "${seg}"`);
    }
  }
  const leaf = segments[segments.length - 1];
  if (Array.isArray(cursor)) {
    cursor[Number.parseInt(leaf, 10)] = value;
  } else if (isPlainObject(cursor)) {
    cursor[leaf] = value;
  } else {
    throw new Error(`unflattenLeaves: cannot write leaf into ${typeof cursor}`);
  }
  return root;
}
