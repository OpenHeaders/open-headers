/**
 * Conflict tracking + resolve adapters for V5.Vault (singleton, secrets
 * keyed by uid). Each row is a `{kind: 'string' | 'totp'}` union;
 * partial leaf-write of the discriminator is refused — kind transitions
 * resolve via Use Saved on the row (carries the full payload).
 *
 * Vault is local-only per workspace per §12.3 — concurrent edits come
 * from same-user-different-tab on the same machine, never from a peer
 * over the wire. Per-field awareness is skipped at the editor layer
 * per §14.4; conflict chips here only surface when the local form is
 * dirty AND a same-user peer edited the same secret.
 */

import type { V5 } from '@openheaders/core/types';
import type { ConflictResolveAdapter, ConflictTrackingAdapter } from '@/shared/conflicts/conflict-adapters';
import { enumLeaf, leaf, obj, setByUid, union } from '@/shared/conflicts/field-tree/descriptor';
import { makeConflictAdapter } from '@/shared/conflicts/field-tree/make-conflict-adapter';

const MASK = new Set<'mask' | 'redact-presence'>(['mask']);

const VAULT_SCHEMA = obj({
  secrets: setByUid({
    summary: (row) => {
      const s = row as V5.VaultSecret;
      return s.kind === 'totp' ? `${s.name} (TOTP)` : s.name;
    },
    rowLabel: (row) => {
      const s = row as V5.VaultSecret;
      return s.name ? `Secret ${s.name}` : 'Secret';
    },
    child: union({
      discriminator: 'kind',
      kindTransitionUnsafe: true,
      branches: {
        string: obj({
          kind: enumLeaf(['string', 'totp']),
          name: leaf('string'),
          value: leaf('string', { flags: MASK }),
        }),
        totp: obj({
          kind: enumLeaf(['string', 'totp']),
          name: leaf('string'),
          seed: leaf('string', { flags: MASK }),
          algorithm: enumLeaf(['SHA1', 'SHA256', 'SHA512']),
          digits: leaf('number', { coercion: 'number-strict' }),
          period: leaf('number', { coercion: 'number-strict' }),
          issuer: leaf('string', { coercion: 'optional-string' }),
        }),
      },
    }),
  }),
});

const SECRET_PATH_RE = /^secrets\.([a-z0-9]{8})\.(name|kind|value|seed|algorithm|digits|period|issuer)$/;

const LEAF_LABEL: Record<string, string> = {
  name: 'name',
  kind: 'kind',
  value: 'value',
  seed: 'seed',
  algorithm: 'algorithm',
  digits: 'digits',
  period: 'period',
  issuer: 'issuer',
};

type VaultEntity = V5.Vault & { uid: string };

const adapters = makeConflictAdapter<VaultEntity>({
  schema: VAULT_SCHEMA,
  signature: (v) => v.uid,
  // Refuse partial leaf-write of the union discriminator — kind
  // transitions reshape the row, so the user resolves via Use Saved
  // on the row (which carries the full payload through the set-add
  // path). Mirrors the pre-walker adapter's behavior.
  writeLeafOverride: (_entity, path) => {
    const m = SECRET_PATH_RE.exec(path);
    if (m && m[2] === 'kind') return true;
    return false;
  },
});

function findSecretName(vault: VaultEntity, uid: string): string | null {
  return vault.secrets.find((s) => s.uid === uid)?.name ?? null;
}

export const vaultConflictAdapter: ConflictTrackingAdapter<VaultEntity> = adapters.tracking;

export const vaultResolveAdapter: ConflictResolveAdapter<VaultEntity> = {
  ...adapters.resolve,
  prettyPath(vault, path) {
    if (path.startsWith('reorder:')) return 'Secrets — order changed';
    if (path.startsWith('set:')) {
      const m = /^set:secrets\.([a-z0-9]{8})$/.exec(path);
      if (m) {
        const name = findSecretName(vault, m[1]);
        return name ? `Secret ${name}` : 'Secret';
      }
    }
    const leafMatch = SECRET_PATH_RE.exec(path);
    if (leafMatch) {
      const name = findSecretName(vault, leafMatch[1]);
      const label = LEAF_LABEL[leafMatch[2]];
      return name ? `Secret ${name} (${label})` : `Secret (${label})`;
    }
    return adapters.resolve.prettyPath(vault, path);
  },
};
