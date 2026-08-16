/**
 * Conflict tracking + resolve adapters for Vault (singleton, secrets
 * keyed by uid). Each row is a `{kind: 'string' | 'totp' |
 * 'client-certificate' | 'secret-manager'}` union;
 * partial leaf-write of a discriminator (`kind`, `locator.provider`) is
 * refused — transitions resolve via Use Saved on the row (carries the
 * full payload).
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

const VAULT_KINDS = ['string', 'totp', 'client-certificate', 'secret-manager'];

const SECRET_PROVIDERS = ['onepassword', 'bitwarden', 'oskeychain', 'awssm', 'azurekv', 'hashivault'];

// Locator leaves are UNMASKED by design — a secret-manager reference is
// shareable by construction (the secret stays in the manager); masking
// it would misrepresent its sensitivity. Provider transitions reshape
// the record, so `locator.provider` is leaf-write-refused like `kind`.
const OPTIONAL = { coercion: 'optional-string' as const };
const SECRET_LOCATOR_SCHEMA = union({
  discriminator: 'provider',
  kindTransitionUnsafe: true,
  branches: {
    onepassword: obj({
      provider: enumLeaf(SECRET_PROVIDERS),
      vault: leaf('string'),
      item: leaf('string'),
      field: leaf('string'),
      account: leaf('string', OPTIONAL),
    }),
    bitwarden: obj({
      provider: enumLeaf(SECRET_PROVIDERS),
      secretId: leaf('string'),
    }),
    oskeychain: obj({
      provider: enumLeaf(SECRET_PROVIDERS),
      service: leaf('string'),
      account: leaf('string'),
    }),
    awssm: obj({
      provider: enumLeaf(SECRET_PROVIDERS),
      name: leaf('string'),
      stage: leaf('string', OPTIONAL),
      region: leaf('string', OPTIONAL),
      profile: leaf('string', OPTIONAL),
    }),
    azurekv: obj({
      provider: enumLeaf(SECRET_PROVIDERS),
      vaultUrl: leaf('string'),
      name: leaf('string'),
      version: leaf('string', OPTIONAL),
    }),
    hashivault: obj({
      provider: enumLeaf(SECRET_PROVIDERS),
      mount: leaf('string'),
      path: leaf('string'),
      key: leaf('string'),
      serverUrl: leaf('string', OPTIONAL),
    }),
  },
});

const VAULT_SCHEMA = obj({
  secrets: setByUid({
    summary: (row) => {
      const s = row as VaultSecret;
      if (s.kind === 'totp') return `${s.name} (TOTP)`;
      if (s.kind === 'client-certificate') return `${s.name} (certificate)`;
      if (s.kind === 'secret-manager') return `${s.name} (secret manager)`;
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
        'secret-manager': obj({
          kind: enumLeaf(VAULT_KINDS),
          name: leaf('string'),
          locator: SECRET_LOCATOR_SCHEMA,
        }),
      },
    }),
  }),
});

const SECRET_PATH_RE =
  /^secrets\.([a-z0-9]{8})\.(name|kind|value|seed|algorithm|digits|period|issuer|cert|key|passphrase|locator\.(?:provider|vault|item|field|account|secretId|service|name|stage|region|profile|vaultUrl|version|mount|path|key|serverUrl))$/;

// Locator leaf labels reuse the table's field vocabulary — one label
// per field across the editor and the conflict surfaces.
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
  'locator.provider': 'workbench.variables.table.smField.provider',
  'locator.vault': 'workbench.variables.table.smField.vault',
  'locator.item': 'workbench.variables.table.smField.item',
  'locator.field': 'workbench.variables.table.smField.field',
  'locator.account': 'workbench.variables.table.smField.account',
  'locator.secretId': 'workbench.variables.table.smField.secretId',
  'locator.service': 'workbench.variables.table.smField.service',
  'locator.name': 'workbench.variables.table.smField.name',
  'locator.stage': 'workbench.variables.table.smField.stage',
  'locator.region': 'workbench.variables.table.smField.region',
  'locator.profile': 'workbench.variables.table.smField.profile',
  'locator.vaultUrl': 'workbench.variables.table.smField.vaultUrl',
  'locator.version': 'workbench.variables.table.smField.version',
  'locator.mount': 'workbench.variables.table.smField.mount',
  'locator.path': 'workbench.variables.table.smField.path',
  'locator.key': 'workbench.variables.table.smField.key',
  'locator.serverUrl': 'workbench.variables.table.smField.serverUrl',
};

type VaultEntity = Vault & { uid: string };

const adapters = makeConflictAdapter<VaultEntity>({
  schema: VAULT_SCHEMA,
  signature: (v) => v.uid,
  // Refuse partial leaf-write of the union discriminators — kind and
  // locator.provider transitions reshape the row/record, so the user
  // resolves via Use Saved on the row (which carries the full payload
  // through the set-add path). Mirrors the pre-walker adapter's behavior.
  writeLeafOverride: (_entity, path) => {
    const m = SECRET_PATH_RE.exec(path);
    if (m && (m[2] === 'kind' || m[2] === 'locator.provider')) return true;
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
