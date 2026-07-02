/**
 * Write-side schema walks for the conflict adapter — resolution writes
 * into the live entity (leaf writes, set-array replacement, union-branch
 * swaps) and the leaf-path decoder the form writer uses to translate a
 * canonical conflict path into a Form.List name + index.
 */

import { type FieldNode, getPolicy } from './descriptor';

export function reorderRows<T extends { uid: string }>(rows: readonly T[], savedOrder: readonly string[]): T[] {
  const byUid = new Map<string, T>();
  for (const row of rows) byUid.set(row.uid, row);
  const result: T[] = [];
  for (const uid of savedOrder) {
    const row = byUid.get(uid);
    if (row) {
      result.push(row);
      byUid.delete(uid);
    }
  }
  for (const row of rows) if (byUid.has(row.uid)) result.push(row);
  return result;
}

export function writeLeafByPath(node: FieldNode, entity: unknown, path: string, value: string): boolean {
  const parts = path.split('.');
  let grandParent: Record<string, unknown> | null = null;
  let parent: Record<string, unknown> | null = entity as Record<string, unknown>;
  let cur: FieldNode | null = node;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur || !parent) return false;
    if (cur.kind === 'object') {
      const child: FieldNode | undefined = cur.children[parts[i]];
      if (!child) return false;
      grandParent = parent;
      parent = parent[parts[i]] as Record<string, unknown>;
      cur = child;
      continue;
    }
    if (cur.kind === 'set') {
      const arr = parent as unknown as unknown[];
      if (cur.identity === 'uid') {
        const row = arr.find((r) => (r as { uid?: string })?.uid === parts[i]) as Record<string, unknown> | undefined;
        if (!row) return false;
        grandParent = parent;
        parent = row;
        cur = cur.child;
        continue;
      }
      return false;
    }
    if (cur.kind === 'union') {
      const disc: string | undefined = cur.discriminate
        ? cur.discriminate(grandParent, parent)
        : (parent[cur.discriminator] as string | undefined);
      const branch: FieldNode | undefined = typeof disc === 'string' ? cur.branches[disc] : undefined;
      if (!branch) return false;
      cur = branch;
      i -= 1;
      continue;
    }
    return false;
  }

  if (!cur || !parent) return false;
  const last = parts[parts.length - 1];
  if (cur.kind === 'object') {
    const child = cur.children[last];
    if (!child) return false;
    if (child.kind === 'leaf' || child.kind === 'enum') {
      parent[last] = getPolicy(child.coercion).write(value);
      return true;
    }
  }
  if (cur.kind === 'union') {
    const disc: string | undefined = cur.discriminate
      ? cur.discriminate(grandParent, parent)
      : (parent[cur.discriminator] as string | undefined);
    const branch = typeof disc === 'string' ? cur.branches[disc] : undefined;
    if (branch && branch.kind === 'object') {
      const child = branch.children[last];
      if (child && (child.kind === 'leaf' || child.kind === 'enum')) {
        parent[last] = getPolicy(child.coercion).write(value);
        return true;
      }
    }
  }
  return false;
}

export function writeSetArray(node: FieldNode, entity: unknown, setPath: string, value: unknown[]): boolean {
  const parts = setPath.split('.');
  let parent: Record<string, unknown> | null = entity as Record<string, unknown>;
  let cur: FieldNode | null = node;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur || cur.kind !== 'object' || !parent) return false;
    cur = cur.children[parts[i]];
    parent = parent[parts[i]] as Record<string, unknown>;
  }
  if (!parent || !cur) return false;
  const last = parts[parts.length - 1];
  parent[last] = value;
  return true;
}

export interface UnionParentInfo {
  parent: Record<string, unknown>;
  tailKey: string;
  unionNode: Extract<FieldNode, { kind: 'union' }>;
}

/** Walk to the parent object that holds the union node at `prefix`.
 *  Returns the mutable parent + the tail key + the union descriptor —
 *  enough to write both the new branch and the discriminator. */
export function navigateToUnionParent(schema: FieldNode, entity: unknown, prefix: string): UnionParentInfo | null {
  const parts = prefix.split('.');
  let cur: FieldNode | null = schema;
  let val: unknown = entity;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur || cur.kind !== 'object') return null;
    const child: FieldNode | undefined = cur.children[parts[i]];
    if (!child) return null;
    val = (val as Record<string, unknown> | null | undefined)?.[parts[i]];
    if (val == null || typeof val !== 'object') return null;
    cur = child;
  }
  if (!cur || cur.kind !== 'object') return null;
  const tailKey = parts[parts.length - 1];
  const child = cur.children[tailKey];
  if (!child || child.kind !== 'union') return null;
  return { parent: val as Record<string, unknown>, tailKey, unionNode: child };
}

export interface DecodedLeafPath {
  /** Set-rooted leaf — found a uid-set ancestor in the schema walk. */
  setLeaf?: { setPath: string; idx: number; leaf: string };
  /** Plain scalar leaf — no uid-set ancestor. */
  scalar?: { leaf: string };
}

/** Walk schema + entity along `path`, identifying whether the leaf is
 *  nested inside a uid-set (and at what index in the live entity). */
export function decodeLeafPathForForm(schema: FieldNode, entity: unknown, path: string): DecodedLeafPath | null {
  const parts = path.split('.');
  let cur: FieldNode | null = schema;
  let val: unknown = entity;
  let parent: unknown = null;
  let setHit: { setPath: string; idx: number } | null = null;

  let i = 0;
  while (i < parts.length) {
    if (!cur) return null;
    if (cur.kind === 'union') {
      const disc: string | undefined = cur.discriminate
        ? cur.discriminate(parent, val)
        : ((val as Record<string, unknown> | null | undefined)?.[cur.discriminator] as string | undefined);
      const branchNode: FieldNode | undefined = typeof disc === 'string' ? cur.branches[disc] : undefined;
      if (!branchNode) return null;
      cur = branchNode;
      continue;
    }
    if (cur.kind === 'object') {
      const child: FieldNode | undefined = cur.children[parts[i]];
      if (!child) return null;
      parent = val;
      val = (val as Record<string, unknown> | null | undefined)?.[parts[i]];
      cur = child;
      i += 1;
      continue;
    }
    if (cur.kind === 'set') {
      if (cur.identity !== 'uid') return null;
      const arr = Array.isArray(val) ? val : [];
      const uid = parts[i];
      const idx = arr.findIndex((r) => (r as { uid?: string })?.uid === uid);
      if (idx < 0) return null;
      const setPath = parts.slice(0, i).join('.');
      setHit = { setPath, idx };
      parent = val;
      val = arr[idx];
      cur = cur.child;
      i += 1;
      continue;
    }
    return null;
  }
  if (!cur || (cur.kind !== 'leaf' && cur.kind !== 'enum')) return null;
  const leaf = parts[parts.length - 1];
  if (setHit) return { setLeaf: { setPath: setHit.setPath, idx: setHit.idx, leaf } };
  return { scalar: { leaf } };
}
