/**
 * Generic walker — derives `ConflictTrackingAdapter` +
 * `ConflictResolveAdapter` from a {@link FieldNode} descriptor.
 *
 * Validated initially by Variable / LiveVariable / Vault canaries
 * (Session 28). The walker covers leaf / enum / object / set(uid|value)
 * / union(kindTransitionUnsafe) / opaque / omit. Map-semantics
 * `set(identity:'key')` is wired but only exercised by Rule/Template
 * in Session 29.
 *
 * The walks themselves live in `walker-read.ts` (navigation, baseline
 * emission, set snapshots) and `walker-write.ts` (resolution writes,
 * form-path decoding); this module holds the args contract and the
 * factory that binds them into the two adapters.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { FormInstance } from 'antd';
import { stableStringify } from '../../forms/fingerprint';
import type { ConflictResolveAdapter, ConflictTrackingAdapter, PathMap } from '../conflict-adapters';
import { decodeReorderConflictKey, decodeSetConflictKey, decodeSetValueConflictKey } from '../conflict-keys';
import type { PathConflict } from '../types';
import type { FieldNode } from './descriptor';
import { getPolicy } from './descriptor';
import {
  buildSnapshots,
  collectSets,
  decodeUnionDivergenceKey,
  emit,
  navigate,
  type SetWalkInfo,
  snapshotSetsFromForm,
} from './walker-read';
import {
  decodeLeafPathForForm,
  navigateToUnionParent,
  reorderRows,
  writeLeafByPath,
  writeSetArray,
} from './walker-write';

export { decodeUnionDivergenceKey, isUnionDivergenceKey } from './walker-read';

interface Adapters<E> {
  tracking: ConflictTrackingAdapter<E>;
  resolve: ConflictResolveAdapter<E>;
}

export interface MakeAdapterArgs<E> {
  schema: FieldNode;
  signature: (entity: E) => string;
  /** Optional override hook so the entity bundle can intercept specific
   *  leaf writes (Rule's name routes to the sidebar mutator, etc.).
   *
   *  Return `true` to mark the path handled, `false` to refuse the write
   *  (the walker also stops — used by Vault's kind-leaf refusal), or
   *  `'fallthrough'` to let the walker's default writer handle the path. */
  writeLeafOverride?: (entity: E, path: string, value: string) => boolean | 'fallthrough';
  /** Map a canonical conflict path / set path to the form name (or full
   *  form path) the editor binds it under.
   *
   *  Called for:
   *    - leaf scalar paths (e.g. `'action.redirectTo'`, `'name'`) — the
   *      hook returns either the string form-name, a full
   *      `(string|number)[]` form-path, `null` to skip the write
   *      entirely (form doesn't own the field), or `undefined` to fall
   *      back to the path's last segment.
   *    - set paths (e.g. `'action.requestHeaders'`,
   *      `'action.params'`) — the hook returns the Form.List name. The
   *      walker handles uid → idx resolution itself for leaves nested
   *      inside a uid-set; the hook only resolves the container name.
   *
   *  Bundles use this to bridge schema-side path keys (e.g. rule's
   *  `'params'`) to form-side names (e.g. `'queryParams'`) when the two
   *  diverge. */
  formNameForPath?: (entity: E, path: string) => string | (string | number)[] | null | undefined;
}

interface ReorderPayload {
  savedOrder: readonly string[];
}
function isReorderPayload(p: unknown): p is ReorderPayload {
  return typeof p === 'object' && p !== null && Array.isArray((p as { savedOrder?: unknown }).savedOrder);
}

// ── Pretty path ──────────────────────────────────────────────────

function prettyPath<E>(args: MakeAdapterArgs<E>, t: Translate, entity: E, path: string): string {
  const reorder = decodeReorderConflictKey(path);
  if (reorder) return t('shared.conflicts.label.walker.orderChanged', { set: reorder.setPath });

  const setKey = decodeSetConflictKey(path);
  if (setKey) {
    const sets: SetWalkInfo[] = [];
    collectSets(args.schema, entity, '', sets);
    const set = sets.find((s) => s.setPath === setKey.setPath);
    if (set?.node.identity === 'uid' && set.node.rowLabel) {
      const row = set.rows.find((r) => (r as { uid?: string })?.uid === setKey.uid);
      if (row) return set.node.rowLabel(t, row);
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
      const unionKey = decodeUnionDivergenceKey(path);
      if (unionKey) {
        // Walk to the union node + its current value via `navigate`.
        // Reuses the same parent-threading discriminator logic emit
        // does so the active-branch projection stays consistent.
        const nav = navigate(args.schema, entity, unionKey.prefix);
        if (!nav.node || nav.node.kind !== 'union') return null;
        const disc: string | undefined = nav.node.discriminate
          ? nav.node.discriminate(nav.parent, nav.value)
          : ((nav.value as Record<string, unknown> | null | undefined)?.[nav.node.discriminator] as string | undefined);
        return stableStringify({ kind: disc ?? null });
      }
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
    snapshotSetsFromForm(form, entity) {
      return snapshotSetsFromForm(args.schema, form, entity);
    },
    readUnionBranchInfo(entity, prefix) {
      const info = navigateToUnionParent(args.schema, entity, prefix);
      if (!info) return null;
      const branch = info.parent[info.tailKey];
      const disc: string | undefined = info.unionNode.discriminate
        ? info.unionNode.discriminate(info.parent, branch)
        : ((branch as Record<string, unknown> | null | undefined)?.[info.unionNode.discriminator] as
            | string
            | undefined);
      return { kind: disc ?? null, branch };
    },
    setOrderSensitivity() {
      // Built once per adapter instance — collectSetMetadata walks the
      // schema, not the entity, so the map is stable across entities.
      return SCHEMA_SET_ORDER_SENSITIVITY;
    },
  };

  // Static schema walk to find every uid-set's `orderSensitive` flag.
  // Doesn't depend on the entity, so we cache once at adapter build.
  const SCHEMA_SET_ORDER_SENSITIVITY: ReadonlyMap<string, boolean> = (() => {
    const out = new Map<string, boolean>();
    const visit = (node: FieldNode, prefix: string): void => {
      if (node.kind === 'object') {
        for (const [key, child] of Object.entries(node.children)) {
          visit(child, prefix ? `${prefix}.${key}` : key);
        }
        return;
      }
      if (node.kind === 'set' && node.identity === 'uid') {
        out.set(prefix, node.orderSensitive === true);
        if (node.child.kind === 'object' || node.child.kind === 'union') {
          // Set-of-sets is rare; descend so nested uid-sets can declare
          // their own sensitivity. Prefix can't be statically extended
          // here (uid is part of the path), so we visit the child without
          // appending — the entity-level walk handles uid expansion.
          visit(node.child, prefix);
        }
        return;
      }
      if (node.kind === 'union') {
        for (const branch of Object.values(node.branches)) {
          visit(branch, prefix);
        }
      }
    };
    visit(args.schema, '');
    return out;
  })();

  function resolveFormName(
    entity: E,
    setOrLeafPath: string,
  ): { skip: boolean; name: string | (string | number)[] | null } {
    const fn = args.formNameForPath?.(entity, setOrLeafPath);
    if (fn === null) return { skip: true, name: null };
    if (fn === undefined) {
      const tail = setOrLeafPath.split('.').pop() ?? setOrLeafPath;
      return { skip: false, name: tail };
    }
    return { skip: false, name: fn };
  }

  function applyResolutionToForm(form: FormInstance, entity: E, path: string, conflict: PathConflict): boolean {
    const reorderKey = decodeReorderConflictKey(path);
    if (reorderKey) {
      const { skip, name } = resolveFormName(entity, reorderKey.setPath);
      if (skip || typeof name !== 'string') return false;
      if (!isReorderPayload(conflict.rowPayload)) return false;
      const current = (form.getFieldValue(name) as { uid?: string }[] | undefined) ?? [];
      if (current.length === 0) return false;
      form.setFieldValue(name, reorderRows(current as { uid: string }[], conflict.rowPayload.savedOrder));
      return true;
    }
    const setKey = decodeSetConflictKey(path);
    if (setKey) {
      const { skip, name } = resolveFormName(entity, setKey.setPath);
      if (skip || typeof name !== 'string') return false;
      const current = (form.getFieldValue(name) as { uid?: string }[] | undefined) ?? [];
      if (conflict.kind === 'set-add') {
        if (conflict.rowPayload === undefined) return false;
        if (current.some((r) => r?.uid === setKey.uid)) return false;
        form.setFieldValue(name, [...current, conflict.rowPayload as { uid?: string }]);
        return true;
      }
      if (conflict.kind === 'set-remove') {
        const next = current.filter((r) => r?.uid !== setKey.uid);
        if (next.length === current.length) return false;
        form.setFieldValue(name, next);
        return true;
      }
      return false;
    }

    const decoded = decodeLeafPathForForm(args.schema, entity, path);
    if (!decoded) return false;
    if (decoded.setLeaf) {
      const { skip, name } = resolveFormName(entity, decoded.setLeaf.setPath);
      if (skip) return false;
      const formName = typeof name === 'string' ? name : null;
      if (!formName) return false;
      form.setFieldValue([formName, decoded.setLeaf.idx, decoded.setLeaf.leaf], conflict.theirs);
      return true;
    }
    if (decoded.scalar) {
      const { skip, name } = resolveFormName(entity, path);
      if (skip || name === null) return false;
      form.setFieldValue(name, conflict.theirs);
      return true;
    }
    return false;
  }

  const resolve: ConflictResolveAdapter<E> = {
    applyResolutionToForm,
    applyResolutionToEntity(entity, path, conflict) {
      const unionKey = decodeUnionDivergenceKey(path);
      if (unionKey) {
        const payload = conflict.rowPayload as { kind?: string | null; branch?: unknown } | undefined;
        if (!payload || !('branch' in payload)) return false;
        const info = navigateToUnionParent(args.schema, entity, unionKey.prefix);
        if (!info) return false;
        info.parent[info.tailKey] = payload.branch;
        if (info.unionNode.discriminate) {
          // Discriminator lives outside the union prefix on the parent
          // (e.g. Rule's `type` lives at the entity root while the union
          // covers `action.*`). Write it alongside the new branch.
          info.parent[info.unionNode.discriminator] = payload.kind ?? null;
        }
        return true;
      }
      const reorderKey = decodeReorderConflictKey(path);
      if (reorderKey) {
        if (!isReorderPayload(conflict.rowPayload)) return false;
        const sets: SetWalkInfo[] = [];
        collectSets(args.schema, entity, '', sets);
        const setInfo = sets.find((s) => s.setPath === reorderKey.setPath);
        if (!setInfo || setInfo.node.identity !== 'uid') return false;
        const reordered = reorderRows(setInfo.rows as readonly { uid: string }[], conflict.rowPayload.savedOrder);
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
    prettyPath: (t, entity, path) => prettyPath(args, t, entity, path),
  };

  return { tracking, resolve };
}
