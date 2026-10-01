/**
 * Locator helpers — the shared vocabulary between the vault editor's
 * per-provider input fields and the structured `SecretLocator` records
 * the schema persists. Field specs are ordered as the editor renders
 * them; `buildSecretLocator` is the single flat-fields → typed-record
 * codec so the row model never hand-rolls the union.
 *
 * A locator is the PATH into a manager. The connection it resolves
 * through rides beside the path as `connectionId` and is never one of
 * the path fields (see `connection.ts` for the connection's own
 * fields).
 */

import type { SecretLocator, SecretProviderId } from '../types';

export const SECRET_PROVIDER_IDS: readonly SecretProviderId[] = [
  'onepassword',
  'bitwarden',
  'oskeychain',
  'awssm',
  'azurekv',
  'hashivault',
];

export interface SecretLocatorFieldSpec {
  /** Property name on the provider's locator record. */
  key: string;
  required: boolean;
}

/**
 * Ordered locator path fields per provider. Keys mirror the schema's
 * per-provider record properties exactly — `buildSecretLocator` maps
 * the flat values back onto the typed union.
 */
export const SECRET_LOCATOR_FIELDS: Record<SecretProviderId, readonly SecretLocatorFieldSpec[]> = {
  onepassword: [
    { key: 'vault', required: true },
    { key: 'item', required: true },
    { key: 'field', required: true },
  ],
  bitwarden: [{ key: 'secretId', required: true }],
  oskeychain: [
    { key: 'service', required: true },
    { key: 'account', required: true },
  ],
  awssm: [
    { key: 'name', required: true },
    { key: 'stage', required: false },
  ],
  azurekv: [
    { key: 'name', required: true },
    { key: 'version', required: false },
  ],
  hashivault: [
    { key: 'mount', required: true },
    { key: 'path', required: true },
    { key: 'key', required: true },
  ],
};

function field(values: Readonly<Record<string, string>>, key: string): string {
  return (values[key] ?? '').trim();
}

function optional(values: Readonly<Record<string, string>>, key: string): string | undefined {
  const trimmed = field(values, key);
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Build a typed locator from flat per-field values. Deliberately
 * forgiving: missing required fields become empty strings so partial
 * input survives persistence (the editor's contract — never drop what
 * the user typed), and a blank `connectionId` persists as the empty
 * string. Callers that need validity use
 * {@link isSecretLocatorComplete}. Optional path fields are omitted
 * when blank so persisted rows stay byte-stable.
 */
export function buildSecretLocator(
  provider: SecretProviderId,
  connectionId: string,
  values: Readonly<Record<string, string>>,
): SecretLocator {
  const connection = connectionId.trim();
  switch (provider) {
    case 'onepassword':
      return {
        provider,
        connectionId: connection,
        vault: field(values, 'vault'),
        item: field(values, 'item'),
        field: field(values, 'field'),
      };
    case 'bitwarden':
      return { provider, connectionId: connection, secretId: field(values, 'secretId') };
    case 'oskeychain':
      return {
        provider,
        connectionId: connection,
        service: field(values, 'service'),
        account: field(values, 'account'),
      };
    case 'awssm': {
      const stage = optional(values, 'stage');
      return {
        provider,
        connectionId: connection,
        name: field(values, 'name'),
        ...(stage !== undefined ? { stage } : {}),
      };
    }
    case 'azurekv': {
      const version = optional(values, 'version');
      return {
        provider,
        connectionId: connection,
        name: field(values, 'name'),
        ...(version !== undefined ? { version } : {}),
      };
    }
    case 'hashivault':
      return {
        provider,
        connectionId: connection,
        mount: field(values, 'mount'),
        path: field(values, 'path'),
        key: field(values, 'key'),
      };
  }
}

/**
 * Whether every required path field carries a non-blank value — the
 * editor's validity check for the reference line (status hinting),
 * never a persistence gate. The connection is judged separately
 * ({@link hasSecretLocatorConnection}): a complete path with no
 * connection is a real state the row names honestly.
 */
export function isSecretLocatorComplete(locator: SecretLocator): boolean {
  const values = secretLocatorToFields(locator);
  return SECRET_LOCATOR_FIELDS[locator.provider].every((spec) => !spec.required || field(values, spec.key) !== '');
}

/** Whether the reference names a connection at all. */
export function hasSecretLocatorConnection(locator: SecretLocator): boolean {
  return locator.connectionId.trim() !== '';
}

/**
 * Flatten a typed locator's PATH fields back to per-field values — the
 * editor's hydrate direction, inverse of {@link buildSecretLocator}.
 * The discriminator and the connection id are not path fields.
 */
export function secretLocatorToFields(locator: SecretLocator): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(locator)) {
    if (key === 'provider' || key === 'connectionId' || typeof value !== 'string') continue;
    out[key] = value;
  }
  return out;
}

/**
 * Render a locator in its provider's native addressing idiom — the
 * display string the value cell and suggestion previews show, and a
 * stable recipe fingerprint for change detection. Never contains
 * secret material (references are shareable by construction).
 */
export function formatSecretLocator(locator: SecretLocator): string {
  switch (locator.provider) {
    case 'onepassword':
      return `op://${locator.vault}/${locator.item}/${locator.field}`;
    case 'bitwarden':
      return locator.secretId;
    case 'oskeychain':
      return `${locator.service}/${locator.account}`;
    case 'awssm':
      return locator.stage !== undefined ? `${locator.name}:${locator.stage}` : locator.name;
    case 'azurekv':
      return locator.version !== undefined ? `${locator.name}/${locator.version}` : locator.name;
    case 'hashivault':
      return `${locator.mount}/${locator.path}#${locator.key}`;
  }
}
