/**
 * Locator helpers — the shared vocabulary between the vault editor's
 * per-provider input fields and the structured `SecretLocator` records
 * the schema persists. Field specs are ordered as the editor renders
 * them; `buildSecretLocator` is the single flat-fields → typed-record
 * codec so the row model never hand-rolls the union.
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
 * Ordered locator fields per provider. Keys mirror the schema's
 * per-provider record properties exactly — `buildSecretLocator` maps
 * the flat values back onto the typed union.
 */
export const SECRET_LOCATOR_FIELDS: Record<SecretProviderId, readonly SecretLocatorFieldSpec[]> = {
  onepassword: [
    { key: 'vault', required: true },
    { key: 'item', required: true },
    { key: 'field', required: true },
    { key: 'account', required: false },
  ],
  bitwarden: [{ key: 'secretId', required: true }],
  oskeychain: [
    { key: 'service', required: true },
    { key: 'account', required: true },
  ],
  awssm: [
    { key: 'name', required: true },
    { key: 'stage', required: false },
    { key: 'region', required: false },
    { key: 'profile', required: false },
  ],
  azurekv: [
    { key: 'vaultUrl', required: true },
    { key: 'name', required: true },
    { key: 'version', required: false },
  ],
  hashivault: [
    { key: 'mount', required: true },
    { key: 'path', required: true },
    { key: 'key', required: true },
    { key: 'serverUrl', required: false },
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
 * the user typed). Callers that need validity use
 * {@link isSecretLocatorComplete}. Optional fields are omitted when
 * blank so persisted rows stay byte-stable.
 */
export function buildSecretLocator(
  provider: SecretProviderId,
  values: Readonly<Record<string, string>>,
): SecretLocator {
  switch (provider) {
    case 'onepassword': {
      const account = optional(values, 'account');
      return {
        provider,
        vault: field(values, 'vault'),
        item: field(values, 'item'),
        field: field(values, 'field'),
        ...(account !== undefined ? { account } : {}),
      };
    }
    case 'bitwarden':
      return { provider, secretId: field(values, 'secretId') };
    case 'oskeychain':
      return { provider, service: field(values, 'service'), account: field(values, 'account') };
    case 'awssm': {
      const stage = optional(values, 'stage');
      const region = optional(values, 'region');
      const profile = optional(values, 'profile');
      return {
        provider,
        name: field(values, 'name'),
        ...(stage !== undefined ? { stage } : {}),
        ...(region !== undefined ? { region } : {}),
        ...(profile !== undefined ? { profile } : {}),
      };
    }
    case 'azurekv': {
      const version = optional(values, 'version');
      return {
        provider,
        vaultUrl: field(values, 'vaultUrl'),
        name: field(values, 'name'),
        ...(version !== undefined ? { version } : {}),
      };
    }
    case 'hashivault': {
      const serverUrl = optional(values, 'serverUrl');
      return {
        provider,
        mount: field(values, 'mount'),
        path: field(values, 'path'),
        key: field(values, 'key'),
        ...(serverUrl !== undefined ? { serverUrl } : {}),
      };
    }
  }
}

/**
 * Whether every required locator field carries a non-blank value —
 * the editor's validity check (status hinting), never a persistence
 * gate.
 */
export function isSecretLocatorComplete(locator: SecretLocator): boolean {
  const values = secretLocatorToFields(locator);
  return SECRET_LOCATOR_FIELDS[locator.provider].every((spec) => !spec.required || field(values, spec.key) !== '');
}

/**
 * Flatten a typed locator back to per-field values — the editor's
 * hydrate direction, inverse of {@link buildSecretLocator}.
 */
export function secretLocatorToFields(locator: SecretLocator): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(locator)) {
    if (key === 'provider' || typeof value !== 'string') continue;
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
    case 'awssm': {
      const stage = locator.stage !== undefined ? `:${locator.stage}` : '';
      const region = locator.region !== undefined ? ` (${locator.region})` : '';
      return `${locator.name}${stage}${region}`;
    }
    case 'azurekv': {
      const version = locator.version !== undefined ? `/${locator.version}` : '';
      return `${locator.vaultUrl}/secrets/${locator.name}${version}`;
    }
    case 'hashivault':
      return `${locator.mount}/${locator.path}#${locator.key}`;
  }
}
