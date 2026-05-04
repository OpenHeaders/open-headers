/**
 * Conflict tracking + resolve adapters for any entity that holds a
 * uid-keyed `variables: V5.Variable[]` set at a fixed `varsPath`.
 *
 * Three call sites share this factory: V5.Environment,
 * V5.WorkspaceVariables, V5.Collection (request / template / rule
 * collection variants all share the same Collection schema). All three
 * persist their variables under `entity.variables` and key them by
 * `variable.uid` post-session-66.
 *
 * Set-member identity = `variable.uid`; the user-mutable `name` is just
 * another scalar leaf on the row. Rename / type-toggle surface as a
 * leaf conflict at `variables.<uid>.name` / `variables.<uid>.type` —
 * NOT as set-add + set-remove. Concurrent same-uid renames produce one
 * leaf conflict the user resolves with Take Theirs / Keep Mine. This
 * is the convergent-rename guarantee uid identity buys; harness
 * scenario `genVariableRenameSameUid` exercises it.
 *
 * Vault uses a separate adapter (`vault-conflict-adapter.ts`) — the
 * VaultSecret discriminated union has TOTP-only fields that don't fit
 * the flat `(name|value|type)` leaf model.
 */

import type { V5 } from '@openheaders/core/types';
import { VARIABLE_PATHS } from '@/shared/awareness';
import {
  decodeReorderConflictKey,
  decodeSetConflictKey,
} from '@/shared/conflicts/conflict-keys';
import type {
  ConflictResolveAdapter,
  ConflictTrackingAdapter,
  PathMap,
  SetMember,
  SetMemberSnapshot,
} from '@/shared/conflicts/conflict-adapters';
import type { PathConflict } from '@/shared/conflicts/types';

/** Subset of an entity that carries a flat `variables` set. */
export interface VariableEntity {
  uid: string;
  variables: V5.Variable[];
}

const VAR_LEAVES = ['name', 'value', 'type'] as const;
type VarLeaf = (typeof VAR_LEAVES)[number];

const VAR_PATH_RE = /^variables\.([a-z0-9]{8})\.(name|value|type)$/;

function summarizeVar(row: { name?: string; value?: string }): string {
  return `${row.name ?? ''} = ${row.value ?? ''}`;
}

function readLeaf(row: V5.Variable, leaf: VarLeaf): string {
  switch (leaf) {
    case 'name':
      return String(row.name ?? '');
    case 'value':
      return String(row.value ?? '');
    case 'type':
      return String(row.type ?? 'default');
  }
}

function readPath(entity: VariableEntity, path: string): string | null {
  const m = VAR_PATH_RE.exec(path);
  if (!m) return null;
  const uid = m[1];
  const leaf = m[2] as VarLeaf;
  const row = entity.variables.find((v) => v.uid === uid);
  if (!row) return null;
  return readLeaf(row, leaf);
}

function extractBaseline(entity: VariableEntity): PathMap {
  const out: PathMap = {};
  for (const v of entity.variables) {
    out[VARIABLE_PATHS.row(v.uid, 'name')] = readLeaf(v, 'name');
    out[VARIABLE_PATHS.row(v.uid, 'value')] = readLeaf(v, 'value');
    out[VARIABLE_PATHS.row(v.uid, 'type')] = readLeaf(v, 'type');
  }
  return out;
}

function snapshotSets(entity: VariableEntity): readonly SetMemberSnapshot[] {
  const byUid = new Map<string, SetMember>();
  for (const v of entity.variables) {
    byUid.set(v.uid, { uid: v.uid, summary: summarizeVar(v), payload: v });
  }
  return [{ setPath: VARIABLE_PATHS.set, byUid }];
}

function snapshotSetsFromForm(form: PathMap): readonly SetMemberSnapshot[] {
  const byUid = new Map<string, Record<string, unknown>>();
  for (const key of Object.keys(form)) {
    const m = VAR_PATH_RE.exec(key);
    if (!m) continue;
    const uid = m[1];
    const leaf = m[2];
    const slot = byUid.get(uid) ?? {};
    slot[leaf] = form[key];
    byUid.set(uid, slot);
  }
  const members = new Map<string, SetMember>();
  for (const [uid, leaves] of byUid) {
    members.set(uid, {
      uid,
      summary: summarizeVar({ name: leaves.name as string, value: leaves.value as string }),
      payload: { uid, ...leaves },
    });
  }
  return [{ setPath: VARIABLE_PATHS.set, byUid: members }];
}

export const variableConflictAdapter: ConflictTrackingAdapter<VariableEntity> = {
  signature: (e) => e.uid,
  extractBaseline,
  readPath,
  snapshotSets,
  snapshotSetsFromForm: (form) => snapshotSetsFromForm(form),
};

// ── Resolve ───────────────────────────────────────────────────────

interface ReorderPayload {
  savedOrder: readonly string[];
}

function isReorderPayload(p: unknown): p is ReorderPayload {
  return (
    typeof p === 'object' && p !== null && Array.isArray((p as { savedOrder?: unknown }).savedOrder)
  );
}

function reorderRows<T extends { uid: string }>(rows: readonly T[], savedOrder: readonly string[]): T[] {
  const byUid = new Map<string, T>();
  for (const row of rows) byUid.set(row.uid, row);
  const out: T[] = [];
  for (const uid of savedOrder) {
    const row = byUid.get(uid);
    if (row) {
      out.push(row);
      byUid.delete(uid);
    }
  }
  for (const row of rows) if (byUid.has(row.uid)) out.push(row);
  return out;
}

function writeRowLeaf(entity: VariableEntity, path: string, value: string): boolean {
  const m = VAR_PATH_RE.exec(path);
  if (!m) return false;
  const uid = m[1];
  const leaf = m[2] as VarLeaf;
  const row = entity.variables.find((v) => v.uid === uid) as
    | (V5.Variable & Record<string, unknown>)
    | undefined;
  if (!row) return false;
  if (leaf === 'type') {
    row.type = (value === 'secret' ? 'secret' : 'default') as V5.Variable['type'];
  } else {
    row[leaf] = value;
  }
  return true;
}

const LEAF_LABEL: Record<VarLeaf, string> = {
  name: 'name',
  value: 'value',
  type: 'type',
};

function findRowName(entity: VariableEntity, uid: string): string | null {
  return entity.variables.find((v) => v.uid === uid)?.name ?? null;
}

export const variableResolveAdapter: ConflictResolveAdapter<VariableEntity> = {
  // Variable editors all use controlled `useState<V5.Variable[]>` draft
  // state, not antd Form. Resolution writes go through
  // `applyResolutionToEntity` against a clone; the editor projects back
  // into its draft array.
  applyResolutionToForm: () => false,
  applyResolutionToEntity(entity, path, conflict) {
    const reorderKey = decodeReorderConflictKey(path);
    if (reorderKey) {
      if (!isReorderPayload(conflict.rowPayload)) return false;
      if (entity.variables.length === 0) return false;
      entity.variables = reorderRows(entity.variables, conflict.rowPayload.savedOrder);
      return true;
    }
    const setKey = decodeSetConflictKey(path);
    if (setKey) {
      if (conflict.kind === 'set-add') {
        if (conflict.rowPayload === undefined) return false;
        if (entity.variables.some((v) => v.uid === setKey.uid)) return false;
        entity.variables = [...entity.variables, conflict.rowPayload as V5.Variable];
        return true;
      }
      if (conflict.kind === 'set-remove') {
        const next = entity.variables.filter((v) => v.uid !== setKey.uid);
        if (next.length === entity.variables.length) return false;
        entity.variables = next;
        return true;
      }
      return false;
    }
    return writeRowLeaf(entity, path, conflict.theirs);
  },
  prettyPath(entity, path) {
    if (path.startsWith('reorder:')) return 'Variables — order changed';
    if (path.startsWith('set:')) {
      const m = /^set:variables\.([a-z0-9]{8})$/.exec(path);
      if (!m) return path;
      const name = findRowName(entity, m[1]);
      return name ? `Variable ${name}` : 'Variable';
    }
    const leafMatch = VAR_PATH_RE.exec(path);
    if (leafMatch) {
      const uid = leafMatch[1];
      const leaf = leafMatch[2] as VarLeaf;
      const name = findRowName(entity, uid);
      const label = LEAF_LABEL[leaf];
      return name ? `Variable ${name} (${label})` : `Variable (${label})`;
    }
    return path;
  },
};
