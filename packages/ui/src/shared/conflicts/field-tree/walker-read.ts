/**
 * Read-side schema walks for the conflict adapter — path navigation,
 * baseline emission (including the union divergence marker), and the
 * set-membership snapshots taken from the entity and from a form
 * fingerprint.
 */

import { stableStringify } from '../../forms/fingerprint';
import type { PathMap, SetMember, SetMemberSnapshot } from '../conflict-adapters';
import { type FieldNode, getPolicy } from './descriptor';

/** Prefix for the structural divergence marker emitted at every
 *  `union(emitDivergenceKey: true)` node. Recognised by `useEntityConflicts`
 *  as a kind-transition signal that suppresses per-leaf paths under
 *  the same prefix when it diverges. */
const UNION_KEY_PREFIX = 'union:';

export function isUnionDivergenceKey(key: string): boolean {
  return key.startsWith(UNION_KEY_PREFIX);
}

export function decodeUnionDivergenceKey(key: string): { prefix: string } | null {
  if (!isUnionDivergenceKey(key)) return null;
  return { prefix: key.slice(UNION_KEY_PREFIX.length) };
}

// ── Path navigation ──────────────────────────────────────────────

export interface NavResult {
  /** Containing entity slot (object or set) — the parent of the path's tail. */
  parent: unknown;
  /** Field name or set-key in `parent`. */
  field: string | null;
  /** The descriptor at the path's tail (leaf / set / object). */
  node: FieldNode | null;
  /** Value at the tail. */
  value: unknown;
}

export function navigate(root: FieldNode, entity: unknown, path: string): NavResult {
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
      let row: unknown;
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
      node = node.identity === 'value' ? null : ((node as { child?: FieldNode }).child ?? null);
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

export function emit(node: FieldNode, value: unknown, prefix: string, out: PathMap, parent: unknown = null): void {
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
    if (node.emitDivergenceKey && prefix) {
      // Encode only the discriminator — the structural marker is for
      // kind-transition detection, not for every sub-leaf change. The
      // saved-side branch payload travels via the resolve adapter, not
      // the marker key.
      out[`${UNION_KEY_PREFIX}${prefix}`] = stableStringify({ kind: disc ?? null });
    }
    if (!branch) return;
    emit(branch, value, prefix, out, parent);
  }
}

export interface SetWalkInfo {
  setPath: string;
  node: Extract<FieldNode, { kind: 'set' }>;
  rows: readonly unknown[];
}

export function collectSets(
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

export function buildSnapshots(sets: SetWalkInfo[]): SetMemberSnapshot[] {
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

export function snapshotSetsFromForm<E>(node: FieldNode, form: PathMap, entity: E): readonly SetMemberSnapshot[] {
  const sets: { setPath: string; node: Extract<FieldNode, { kind: 'set' }> }[] = [];
  collectSetPaths(node, '', sets, entity, entity);

  const out: SetMemberSnapshot[] = [];
  for (const s of sets) {
    const byUid = new Map<string, SetMember>();
    if (s.node.identity === 'uid') {
      const grouped = new Map<string, Record<string, string>>();
      const re = new RegExp(`^${escapeRegExp(s.setPath)}\\.([a-z0-9]{8})\\.(.+)$`);
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
  parent: unknown,
  value: unknown,
): void {
  if (node.kind === 'object') {
    if (value == null || typeof value !== 'object') {
      // Walk children with undefined values so set paths still get
      // collected even when the entity hasn't materialized the parent
      // object yet (e.g. a missing optional sub-tree).
      for (const [key, child] of Object.entries(node.children)) {
        const subPrefix = prefix ? `${prefix}.${key}` : key;
        collectSetPaths(child, subPrefix, out, value, undefined);
      }
      return;
    }
    for (const [key, child] of Object.entries(node.children)) {
      const subPrefix = prefix ? `${prefix}.${key}` : key;
      collectSetPaths(child, subPrefix, out, value, (value as Record<string, unknown>)[key]);
    }
    return;
  }
  if (node.kind === 'set') {
    out.push({ setPath: prefix, node });
    if (node.identity === 'uid' && (node.child.kind === 'object' || node.child.kind === 'union')) {
      // Nested sets inside per-row objects use a uid-segmented prefix
      // we can't pre-compute statically; the walker re-enters at row
      // discovery time. None of the current consumers nest sets inside
      // set rows, so the static collector is sufficient.
    }
    return;
  }
  if (node.kind === 'union') {
    const disc: string | undefined = node.discriminate
      ? node.discriminate(parent, value)
      : ((value as Record<string, unknown> | null | undefined)?.[node.discriminator] as string | undefined);
    const branch = typeof disc === 'string' ? node.branches[disc] : undefined;
    if (branch) collectSetPaths(branch, prefix, out, parent, value);
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
