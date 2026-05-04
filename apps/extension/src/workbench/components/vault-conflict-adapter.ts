/**
 * Conflict tracking + resolve adapters for V5.Vault (singleton, secrets
 * keyed by uid).
 *
 * Vault diverges from the variable adapter on two axes:
 *
 *   1. Field is `secrets`, not `variables`. Path prefix is `secrets`
 *      and `setPath` matches.
 *   2. Each row is a discriminated union (`kind: 'string' | 'totp'`).
 *      String rows carry `name + value`; TOTP rows carry `name + seed +
 *      algorithm + digits + period + issuer`. Leaf paths exist only for
 *      fields the row's `kind` actually has — a leaf conflict at
 *      `secrets.<uid>.value` against a TOTP row is meaningless and
 *      surfaces as null.
 *
 * Vault is local-only per workspace per §12.3 — concurrent edits come
 * from same-user-different-tab on the same machine, never from a peer
 * over the wire. The "saved value" surfaced in chips is the user's own
 * other tab; no cross-trust-boundary leak. Per-field awareness chips
 * (presence) are still skipped at the editor layer per §14.4 to avoid
 * leaking the secret namespace via presence pings on a path-key that
 * embeds the secret name; conflict chips are different — they only
 * surface when the local form is dirty AND a same-user peer edited the
 * same secret, so the namespace was already revealed by virtue of the
 * user opening it.
 */

import type { V5 } from '@openheaders/core/types';
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

const SECRETS_PATH = 'secrets';

const SECRET_LEAVES = ['name', 'kind', 'value', 'seed', 'algorithm', 'digits', 'period', 'issuer'] as const;
type SecretLeaf = (typeof SECRET_LEAVES)[number];

const SECRET_PATH_RE = /^secrets\.([a-z0-9]{8})\.(name|kind|value|seed|algorithm|digits|period|issuer)$/;

function rowPath(uid: string, leaf: SecretLeaf): string {
  return `secrets.${uid}.${leaf}`;
}

function summarizeSecret(s: V5.VaultSecret): string {
  return s.kind === 'totp' ? `${s.name} (TOTP)` : `${s.name}`;
}

function readLeaf(s: V5.VaultSecret, leaf: SecretLeaf): string | null {
  switch (leaf) {
    case 'name':
      return String(s.name ?? '');
    case 'kind':
      return s.kind;
    case 'value':
      return s.kind === 'string' ? String(s.value ?? '') : null;
    case 'seed':
      return s.kind === 'totp' ? String(s.seed ?? '') : null;
    case 'algorithm':
      return s.kind === 'totp' ? String(s.algorithm ?? '') : null;
    case 'digits':
      return s.kind === 'totp' ? String(s.digits ?? '') : null;
    case 'period':
      return s.kind === 'totp' ? String(s.period ?? '') : null;
    case 'issuer':
      return s.kind === 'totp' ? String(s.issuer ?? '') : null;
  }
}

function readPath(vault: V5.Vault, path: string): string | null {
  const m = SECRET_PATH_RE.exec(path);
  if (!m) return null;
  const uid = m[1];
  const leaf = m[2] as SecretLeaf;
  const row = vault.secrets.find((s) => s.uid === uid);
  if (!row) return null;
  return readLeaf(row, leaf);
}

function extractBaseline(vault: V5.Vault): PathMap {
  const out: PathMap = {};
  for (const s of vault.secrets) {
    for (const leaf of SECRET_LEAVES) {
      const v = readLeaf(s, leaf);
      if (v !== null) out[rowPath(s.uid, leaf)] = v;
    }
  }
  return out;
}

function snapshotSets(vault: V5.Vault): readonly SetMemberSnapshot[] {
  const byUid = new Map<string, SetMember>();
  for (const s of vault.secrets) {
    byUid.set(s.uid, { uid: s.uid, summary: summarizeSecret(s), payload: s });
  }
  return [{ setPath: SECRETS_PATH, byUid }];
}

function snapshotSetsFromForm(form: PathMap): readonly SetMemberSnapshot[] {
  const byUid = new Map<string, Record<string, unknown>>();
  for (const key of Object.keys(form)) {
    const m = SECRET_PATH_RE.exec(key);
    if (!m) continue;
    const uid = m[1];
    const leaf = m[2];
    const slot = byUid.get(uid) ?? {};
    slot[leaf] = form[key];
    byUid.set(uid, slot);
  }
  const members = new Map<string, SetMember>();
  for (const [uid, leaves] of byUid) {
    const name = (leaves.name as string) ?? '';
    const kind = (leaves.kind as string) ?? 'string';
    members.set(uid, {
      uid,
      summary: kind === 'totp' ? `${name} (TOTP)` : name,
      payload: { uid, ...leaves },
    });
  }
  return [{ setPath: SECRETS_PATH, byUid: members }];
}

export const vaultConflictAdapter: ConflictTrackingAdapter<V5.Vault & { uid: string }> = {
  // The Vault schema doesn't carry a `uid` per se — there's exactly one
  // vault per workspace (singleton, fixed `VAULT_ID`). The hook needs
  // a stable signature; `useVaultConflicts` synthesizes one via the
  // singleton id at the binding boundary.
  signature: (v) => v.uid,
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

function writeSecretLeaf(vault: V5.Vault, path: string, value: string): boolean {
  const m = SECRET_PATH_RE.exec(path);
  if (!m) return false;
  const uid = m[1];
  const leaf = m[2] as SecretLeaf;
  const idx = vault.secrets.findIndex((s) => s.uid === uid);
  if (idx === -1) return false;
  const row = { ...vault.secrets[idx] } as V5.VaultSecret & Record<string, unknown>;
  switch (leaf) {
    case 'name':
      row.name = value;
      break;
    case 'kind':
      // Kind transitions reshape the row entirely; whole-record replace
      // is what the mutator does. Refuse partial leaf-write here — the
      // user resolves kind transitions via the dialog's row-level Use
      // Saved (which carries the full payload).
      return false;
    case 'value':
      if (row.kind !== 'string') return false;
      row.value = value;
      break;
    case 'seed':
      if (row.kind !== 'totp') return false;
      row.seed = value;
      break;
    case 'algorithm':
      if (row.kind !== 'totp') return false;
      if (value !== 'SHA1' && value !== 'SHA256' && value !== 'SHA512') return false;
      row.algorithm = value;
      break;
    case 'digits':
      if (row.kind !== 'totp') return false;
      row.digits = Number(value);
      break;
    case 'period':
      if (row.kind !== 'totp') return false;
      row.period = Number(value);
      break;
    case 'issuer':
      if (row.kind !== 'totp') return false;
      if (value === '') delete row.issuer;
      else row.issuer = value;
      break;
  }
  vault.secrets[idx] = row as V5.VaultSecret;
  return true;
}

const LEAF_LABEL: Record<SecretLeaf, string> = {
  name: 'name',
  kind: 'kind',
  value: 'value',
  seed: 'seed',
  algorithm: 'algorithm',
  digits: 'digits',
  period: 'period',
  issuer: 'issuer',
};

function findSecretName(vault: V5.Vault, uid: string): string | null {
  return vault.secrets.find((s) => s.uid === uid)?.name ?? null;
}

export const vaultResolveAdapter: ConflictResolveAdapter<V5.Vault & { uid: string }> = {
  applyResolutionToForm: () => false,
  applyResolutionToEntity(vault, path, conflict) {
    const reorderKey = decodeReorderConflictKey(path);
    if (reorderKey) {
      if (!isReorderPayload(conflict.rowPayload)) return false;
      if (vault.secrets.length === 0) return false;
      vault.secrets = reorderRows(vault.secrets, conflict.rowPayload.savedOrder);
      return true;
    }
    const setKey = decodeSetConflictKey(path);
    if (setKey) {
      if (conflict.kind === 'set-add') {
        if (conflict.rowPayload === undefined) return false;
        if (vault.secrets.some((s) => s.uid === setKey.uid)) return false;
        vault.secrets = [...vault.secrets, conflict.rowPayload as V5.VaultSecret];
        return true;
      }
      if (conflict.kind === 'set-remove') {
        const next = vault.secrets.filter((s) => s.uid !== setKey.uid);
        if (next.length === vault.secrets.length) return false;
        vault.secrets = next;
        return true;
      }
      return false;
    }
    return writeSecretLeaf(vault, path, conflict.theirs);
  },
  prettyPath(vault, path) {
    if (path.startsWith('reorder:')) return 'Secrets — order changed';
    if (path.startsWith('set:')) {
      const m = /^set:secrets\.([a-z0-9]{8})$/.exec(path);
      if (!m) return path;
      const name = findSecretName(vault, m[1]);
      return name ? `Secret ${name}` : 'Secret';
    }
    const leafMatch = SECRET_PATH_RE.exec(path);
    if (leafMatch) {
      const uid = leafMatch[1];
      const leaf = leafMatch[2] as SecretLeaf;
      const name = findSecretName(vault, uid);
      const label = LEAF_LABEL[leaf];
      return name ? `Secret ${name} (${label})` : `Secret (${label})`;
    }
    return path;
  },
};
