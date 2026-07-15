/**
 * Conflict tracking + resolve adapters for Vault (singleton, secrets
 * keyed by uid). Each row is a `{kind: 'string' | 'totp' |
 * 'client-certificate'}` union;
 * partial leaf-write of the discriminator is refused — kind transitions
 * resolve via Use Saved on the row (carries the full payload).
 *
 * Vault is local-only per workspace per §12.3 — concurrent edits come
 * from same-user-different-tab on the same machine, never from a peer
 * over the wire. Per-field awareness is skipped at the editor layer
 * per §14.4; conflict chips here only surface when the local form is
 * dirty AND a same-user peer edited the same secret.
 */

import type { Vault, VaultSecret } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import type {
  ConflictResolveAdapter,
  ConflictTrackingAdapter,
} from '@openheaders/ui/shared/conflicts/conflict-adapters';
import { enumLeaf, leaf, obj, setByUid, union } from '@openheaders/ui/shared/conflicts/field-tree/descriptor';
import { makeConflictAdapter } from '@openheaders/ui/shared/conflicts/field-tree/make-conflict-adapter';

const MASK = new Set<'mask' | 'redact-presence'>(['mask']);

const VAULT_KINDS = ['string', 'totp', 'client-certificate'];

const VAULT_SCHEMA = obj({
  secrets: setByUid({
    summary: (row) => {
      const s = row as VaultSecret;
      if (s.kind === 'totp') return `${s.name} (TOTP)`;
      if (s.kind === 'client-certificate') return `${s.name} (certificate)`;
      return s.name;
    },
    rowLabel: (t, row) => {
      const s = row as VaultSecret;
      return s.name
        ? t('shared.conflicts.label.vault.rowNamed', { name: s.name })
        : t('shared.conflicts.label.vault.row');
    },
    child: union({
      discriminator: 'kind',
      kindTransitionUnsafe: true,
      branches: {
        string: obj({
          kind: enumLeaf(VAULT_KINDS),
          name: leaf('string'),
          value: leaf('string', { flags: MASK }),
        }),
        totp: obj({
          kind: enumLeaf(VAULT_KINDS),
          name: leaf('string'),
          seed: leaf('string', { flags: MASK }),
          algorithm: enumLeaf(['SHA1', 'SHA256', 'SHA512']),
          digits: leaf('number', { coercion: 'number-strict' }),
          period: leaf('number', { coercion: 'number-strict' }),
          issuer: leaf('string', { coercion: 'optional-string' }),
        }),
        'client-certificate': obj({
          kind: enumLeaf(VAULT_KINDS),
          name: leaf('string'),
          cert: leaf('string', { flags: MASK }),
          key: leaf('string', { flags: MASK }),
          passphrase: leaf('string', { coercion: 'optional-string', flags: MASK }),
        }),
      },
    }),
  }),
});

const SECRET_PATH_RE =
  /^secrets\.([a-z0-9]{8})\.(name|kind|value|seed|algorithm|digits|period|issuer|cert|key|passphrase)$/;

const LEAF_LABEL: Record<string, MessageKey> = {
  name: 'shared.conflicts.label.vault.field.name',
  kind: 'shared.conflicts.label.vault.field.kind',
  value: 'shared.conflicts.label.vault.field.value',
  seed: 'shared.conflicts.label.vault.field.seed',
  algorithm: 'shared.conflicts.label.vault.field.algorithm',
  digits: 'shared.conflicts.label.vault.field.digits',
  period: 'shared.conflicts.label.vault.field.period',
  issuer: 'shared.conflicts.label.vault.field.issuer',
  cert: 'shared.conflicts.label.vault.field.cert',
  key: 'shared.conflicts.label.vault.field.key',
  passphrase: 'shared.conflicts.label.vault.field.passphrase',
};

type VaultEntity = Vault & { uid: string };

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
  prettyPath(t, vault, path) {
    if (path.startsWith('reorder:')) return t('shared.conflicts.label.vault.orderChanged');
    if (path.startsWith('set:')) {
      const m = /^set:secrets\.([a-z0-9]{8})$/.exec(path);
      if (m) {
        const name = findSecretName(vault, m[1]);
        return name ? t('shared.conflicts.label.vault.rowNamed', { name }) : t('shared.conflicts.label.vault.row');
      }
    }
    const leafMatch = SECRET_PATH_RE.exec(path);
    if (leafMatch) {
      const name = findSecretName(vault, leafMatch[1]);
      const label = t(LEAF_LABEL[leafMatch[2]]);
      return name
        ? t('shared.conflicts.label.vault.leafNamed', { name, label })
        : t('shared.conflicts.label.vault.leaf', { label });
    }
    return adapters.resolve.prettyPath(t, vault, path);
  },
};
