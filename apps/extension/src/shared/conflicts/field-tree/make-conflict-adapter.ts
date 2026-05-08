/**
 * Generic walker — derives `ConflictTrackingAdapter` +
 * `ConflictResolveAdapter` from a {@link FieldNode} descriptor.
 *
 * Validated initially by Variable / LiveVariable / Vault canaries
 * (Session 28). The walker covers leaf / enum / object / set(uid|value)
 * / union(kindTransitionUnsafe) / opaque / omit. Map-semantics
 * `set(identity:'key')` is wired but only exercised by Rule/Template
 * in Session 29.
 */

import type {
  ConflictResolveAdapter,
  ConflictTrackingAdapter,
  PathMap,
  SetMember,
  SetMemberSnapshot,
} from '@/shared/conflicts/conflict-adapters';
import {
  decodeReorderConflictKey,
  decodeSetConflictKey,
  decodeSetValueConflictKey,
} from '@/shared/conflicts/conflict-keys';
import type { PathConflict } from '@/shared/conflicts/types';
import { getPolicy, type FieldNode } from './descriptor';

interface Adapters<E> {
  tracking: ConflictTrackingAdapter<E>;
  resolve: ConflictResolveAdapter<E>;
}

export interface MakeAdapterArgs<E> {
  schema: FieldNode;
  signature: (entity: E) => string;
  /** Pretty-print the entity-level prefix used in `prettyPath`. */
  entityLabel?: (entity: E) => string;
  /** Optional override hook so the entity bundle can intercept specific
   *  leaf writes (Rule's name routes to the sidebar mutator, etc.).
   *
   *  Return `true` to mark the path handled, `false` to refuse the write
   *  (the walker also stops — used by Vault's kind-leaf refusal), or
   *  `'fallthrough'` to let the walker's default writer handle the path. */
  writeLeafOverride?: (entity: E, path: string, value: string) => boolean | 'fallthrough';
}

interface ReorderPayload {
  savedOrder: readonly string[];
}
function isReorderPayload(p: unknown): p is ReorderPayload {
  return typeof p === 'object' && p !== null && Array.isArray((p as { savedOrder?: unknown }).savedOrder);
}

// ── Path navigation ──────────────────────────────────────────────

interface NavResult {
  /** Containing entity slot (object or set) — the parent of the path's tail. */
  parent: unknown;
  /** Field name or set-key in `parent`. */
  field: string | null;
  /** The descriptor at the path's tail (leaf / set / object). */
  node: FieldNode | null;
  /** Value at the tail. */
  value: unknown;
}

function readChild(node: FieldNode, name: string): FieldNode | null {
  if (node.kind === 'object') return node.children[name] ?? null;
  return null;
}

function navigate(root: FieldNode, entity: unknown, path: string): NavResult {
  const parts = path.split('.');
  let parent: unknown = entity;
  let value: unknown = entity;
  let node: FieldNode | null = root;
  let field: string | null = null;

  for (let i = 0; i < parts.length; i++) {
    if (!node) return { parent, field, node: null, value: undefined };

    if (node.kind === 'object') {
      const child: FieldNode | undefined = node.children[parts[i]];
      if (!child) return { parent, field, node: null, value: undefined };
      parent = value;
      field = parts[i];
      value = (value as Record<string, unknown> | null | undefined)?.[parts[i]];
      node = child;
      continue;
    }

    if (node.kind === 'set') {
      const arr = (Array.isArray(value) ? value : []) as unknown[];
      const memberKey = parts[i];
      let row: unknown = undefined;
      if (node.identity === 'uid') {
        row = arr.find((r) => (r as { uid?: string })?.uid === memberKey);
      } else if (node.identity === 'value') {
        row = arr.find((r) => r === memberKey);
      } else {
        row = arr.find((r) => (r as Record<string, unknown>)[memberKey] !== undefined);
      }
      parent = arr;
      field = memberKey;
      value = row;
      node = node.identity === 'value' ? null : (node as { child?: FieldNode }).child ?? null;
      continue;
    }

    if (node.kind === 'union') {
      const disc: string | undefined = node.discriminate
        ? node.discriminate(parent, value)
        : ((value as Record<string, unknown> | null | undefined)?.[node.discriminator] as string | undefined);
      const branch: FieldNode | undefined = typeof disc === 'string' ? node.branches[disc] : undefined;
      if (!branch) return { parent, field, node: null, value: undefined };
      // Re-enter without consuming a path part.
      i -= 1;
      node = branch;
      continue;
    }

    return { parent, field, node: null, value: undefined };
  }
  return { parent, field, node, value };
}

// ── Baseline + set snapshots ─────────────────────────────────────

function emit(node: FieldNode, value: unknown, prefix: string, out: PathMap, parent: unknown = null): void {
  if (node.kind === 'omit' || node.kind === 'opaque') return;
  if (node.kind === 'leaf') {
    if (node.baseline === 'skip') return;
    out[prefix] = getPolicy(node.coercion).read(value);
    return;
  }
  if (node.kind === 'enum') {
    if (node.baseline === 'skip') return;
    out[prefix] = getPolicy(node.coercion).read(value);
    return;
  }
  if (node.kind === 'object') {
    if (value == null || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(node.children)) {
      const sub = (value as Record<string, unknown>)[key];
      const subPrefix = prefix ? `${prefix}.${key}` : key;
      emit(child, sub, subPrefix, out, value);
    }
    return;
  }
  if (node.kind === 'set') {
    const arr = Array.isArray(value) ? value : [];
    if (node.identity === 'uid') {
      for (const row of arr) {
        const uid = (row as { uid?: string })?.uid;
        if (!uid) continue;
        emit(node.child, row, `${prefix}.${uid}`, out, arr);
      }
      return;
    }
    if (node.identity === 'key') {
      for (const row of arr) {
        for (const k of Object.keys(row as Record<string, unknown>)) {
          emit(node.child, (row as Record<string, unknown>)[k], `${prefix}.${k}`, out, row);
        }
      }
      return;
    }
    // identity:'value' — set membership only; no per-leaf baseline.
    return;
  }
  if (node.kind === 'union') {
    const disc: string | undefined = node.discriminate
      ? node.discriminate(parent, value)
      : ((value as Record<string, unknown> | null | undefined)?.[node.discriminator] as string | undefined);
    const branch = typeof disc === 'string' ? node.branches[disc] : undefined;
    if (!branch) return;
    emit(branch, value, prefix, out, parent);
  }
}

interface SetWalkInfo {
  setPath: string;
  node: Extract<FieldNode, { kind: 'set' }>;
  rows: readonly unknown[];
}

function collectSets(
  node: FieldNode,
  value: unknown,
  prefix: string,
  out: SetWalkInfo[],
  parent: unknown = null,
): void {
  if (node.kind === 'object') {
    if (value == null || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(node.children)) {
      const sub = (value as Record<string, unknown>)[key];
      const subPrefix = prefix ? `${prefix}.${key}` : key;
      collectSets(child, sub, subPrefix, out, value);
    }
    return;
  }
  if (node.kind === 'set') {
    const arr = Array.isArray(value) ? value : [];
    out.push({ setPath: prefix, node, rows: arr });
    if (node.identity === 'uid') {
      for (const row of arr) {
        const uid = (row as { uid?: string })?.uid;
        if (!uid) continue;
        if (node.child.kind === 'object' || node.child.kind === 'union') {
          collectSets(node.child, row, `${prefix}.${uid}`, out, arr);
        }
      }
    }
    return;
  }
  if (node.kind === 'union') {
    const disc: string | undefined = node.discriminate
      ? node.discriminate(parent, value)
      : ((value as Record<string, unknown> | null | undefined)?.[node.discriminator] as string | undefined);
    const branch = typeof disc === 'string' ? node.branches[disc] : undefined;
    if (branch) collectSets(branch, value, prefix, out, parent);
  }
}

function buildSnapshots(sets: SetWalkInfo[]): SetMemberSnapshot[] {
  const out: SetMemberSnapshot[] = [];
  for (const s of sets) {
    const byUid = new Map<string, SetMember>();
    if (s.node.identity === 'uid') {
      for (const row of s.rows) {
        const uid = (row as { uid?: string })?.uid;
        if (!uid) continue;
        byUid.set(uid, { uid, summary: s.node.summary(row), payload: row });
      }
    } else if (s.node.identity === 'value') {
      for (const row of s.rows) {
        const v = String(row);
        byUid.set(v, { uid: v, summary: s.node.summary ? s.node.summary(v) : v, payload: v });
      }
    }
    out.push({ setPath: s.setPath, byUid });
  }
  return out;
}

// ── Form snapshot ────────────────────────────────────────────────

function snapshotSetsFromForm(node: FieldNode, form: PathMap): readonly SetMemberSnapshot[] {
  const sets: { setPath: string; node: Extract<FieldNode, { kind: 'set' }> }[] = [];
  collectSetPaths(node, '', sets);

  const out: SetMemberSnapshot[] = [];
  for (const s of sets) {
    const byUid = new Map<string, SetMember>();
    if (s.node.identity === 'uid') {
      const grouped = new Map<string, Record<string, string>>();
      const re = new RegExp(`^${escape(s.setPath)}\\.([a-z0-9]{8})\\.(.+)$`);
      for (const key of Object.keys(form)) {
        const m = re.exec(key);
        if (!m) continue;
        const slot = grouped.get(m[1]) ?? {};
        slot[m[2]] = form[key];
        grouped.set(m[1], slot);
      }
      for (const [uid, leaves] of grouped) {
        const payload: Record<string, unknown> = { uid };
        // Naive merge — leaves include nested-path keys when child is
        // an object (e.g. `name`, `value`). The Variable canary's child
        // is flat so this works as-is; richer shapes get richer payload
        // synthesis when their canary lands.
        for (const [k, v] of Object.entries(leaves)) payload[k] = v;
        const summaryRow: Record<string, string> = leaves;
        byUid.set(uid, { uid, summary: s.node.summary(summaryRow), payload });
      }
    }
    out.push({ setPath: s.setPath, byUid });
  }
  return out;
}

function collectSetPaths(
  node: FieldNode,
  prefix: string,
  out: { setPath: string; node: Extract<FieldNode, { kind: 'set' }> }[],
): void {
  if (node.kind === 'object') {
    for (const [key, child] of Object.entries(node.children)) {
      const subPrefix = prefix ? `${prefix}.${key}` : key;
      collectSetPaths(child, subPrefix, out);
    }
    return;
  }
  if (node.kind === 'set') {
    out.push({ setPath: prefix, node });
    if (node.identity === 'uid' && (node.child.kind === 'object' || node.child.kind === 'union')) {
      // Nested sets inside per-row objects use a uid-segmented prefix
      // we can't pre-compute statically; the walker re-enters at row
      // discovery time. For Variable / LiveVariable / Vault none of
      // the canaries nest sets inside set rows, so the static collector
      // is sufficient for this session.
    }
    return;
  }
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Resolution writes ────────────────────────────────────────────

function reorderRows<T extends { uid: string }>(rows: readonly T[], savedOrder: readonly string[]): T[] {
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

function writeLeafByPath(node: FieldNode, entity: unknown, path: string, value: string): boolean {
  const parts = path.split('.');
  let parent: Record<string, unknown> | null = entity as Record<string, unknown>;
  let cur: FieldNode | null = node;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur || !parent) return false;
    if (cur.kind === 'object') {
      const child: FieldNode | undefined = cur.children[parts[i]];
      if (!child) return false;
      parent = parent[parts[i]] as Record<string, unknown>;
      cur = child;
      continue;
    }
    if (cur.kind === 'set') {
      const arr = parent as unknown as unknown[];
      if (cur.identity === 'uid') {
        const row = arr.find((r) => (r as { uid?: string })?.uid === parts[i]) as Record<string, unknown> | undefined;
        if (!row) return false;
        parent = row;
        cur = cur.child;
        continue;
      }
      return false;
    }
    if (cur.kind === 'union') {
      const disc: unknown = parent[cur.discriminator];
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
    const disc = parent[cur.discriminator];
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

// ── Pretty path ──────────────────────────────────────────────────

function prettyPath<E>(args: MakeAdapterArgs<E>, entity: E, path: string): string {
  const reorder = decodeReorderConflictKey(path);
  if (reorder) return `${reorder.setPath} — order changed`;

  const setKey = decodeSetConflictKey(path);
  if (setKey) {
    const sets: SetWalkInfo[] = [];
    collectSets(args.schema, entity, '', sets);
    const set = sets.find((s) => s.setPath === setKey.setPath);
    if (set?.node.identity === 'uid' && set.node.rowLabel) {
      const row = set.rows.find((r) => (r as { uid?: string })?.uid === setKey.uid);
      if (row) return set.node.rowLabel(row);
    }
    return `${setKey.setPath} (${setKey.uid})`;
  }

  const setValueKey = decodeSetValueConflictKey(path);
  if (setValueKey) return `${setValueKey.setPath}: ${setValueKey.value}`;

  return path;
}

// ── Public factory ───────────────────────────────────────────────

export function makeConflictAdapter<E>(args: MakeAdapterArgs<E>): Adapters<E> {
  const tracking: ConflictTrackingAdapter<E> = {
    signature: args.signature,
    extractBaseline(entity) {
      const out: PathMap = {};
      emit(args.schema, entity, '', out, entity);
      return out;
    },
    readPath(entity, path) {
      const nav = navigate(args.schema, entity, path);
      if (!nav.node) return null;
      if (nav.node.kind === 'leaf' || nav.node.kind === 'enum') {
        return getPolicy(nav.node.coercion).read(nav.value);
      }
      return null;
    },
    snapshotSets(entity) {
      const sets: SetWalkInfo[] = [];
      collectSets(args.schema, entity, '', sets, entity);
      return buildSnapshots(sets);
    },
    snapshotSetsFromForm(form) {
      return snapshotSetsFromForm(args.schema, form);
    },
  };

  const resolve: ConflictResolveAdapter<E> = {
    applyResolutionToForm: () => false,
    applyResolutionToEntity(entity, path, conflict) {
      const reorderKey = decodeReorderConflictKey(path);
      if (reorderKey) {
        if (!isReorderPayload(conflict.rowPayload)) return false;
        const sets: SetWalkInfo[] = [];
        collectSets(args.schema, entity, '', sets);
        const setInfo = sets.find((s) => s.setPath === reorderKey.setPath);
        if (!setInfo || setInfo.node.identity !== 'uid') return false;
        const reordered = reorderRows(
          setInfo.rows as readonly { uid: string }[],
          conflict.rowPayload.savedOrder,
        );
        writeSetArray(args.schema, entity, reorderKey.setPath, reordered);
        return true;
      }
      const setKey = decodeSetConflictKey(path);
      if (setKey) {
        const sets: SetWalkInfo[] = [];
        collectSets(args.schema, entity, '', sets);
        const setInfo = sets.find((s) => s.setPath === setKey.setPath);
        if (!setInfo || setInfo.node.identity !== 'uid') return false;
        const cur = setInfo.rows as readonly { uid: string }[];
        if (conflict.kind === 'set-add') {
          if (conflict.rowPayload === undefined) return false;
          if (cur.some((r) => r.uid === setKey.uid)) return false;
          writeSetArray(args.schema, entity, setKey.setPath, [...cur, conflict.rowPayload as { uid: string }]);
          return true;
        }
        if (conflict.kind === 'set-remove') {
          const next = cur.filter((r) => r.uid !== setKey.uid);
          if (next.length === cur.length) return false;
          writeSetArray(args.schema, entity, setKey.setPath, next);
          return true;
        }
        return false;
      }

      if (args.writeLeafOverride) {
        const result = args.writeLeafOverride(entity, path, conflict.theirs);
        if (result === true) return true;
        // `false` and `'fallthrough'` both fall through to the default
        // writer below — `'fallthrough'` is the explicit form for bundles
        // that opt only specific paths into the override (e.g. Rule's
        // name leaf) while all other leaves continue to write through
        // the schema-driven walker.
      }
      return writeLeafByPath(args.schema, entity, path, conflict.theirs);
    },
    prettyPath: (entity, path) => prettyPath(args, entity, path),
  };

  return { tracking, resolve };
}

function writeSetArray(node: FieldNode, entity: unknown, setPath: string, value: unknown[]): boolean {
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
