/**
 * Connection helpers — the editor vocabulary for `SecretManagerConnection`
 * records: the per-provider connection fields in render order, the
 * flat-fields → typed-config codec, and the completeness check. The
 * twin of `locator.ts` for the other layer: a locator is the path INTO
 * a manager, a connection is WHERE the manager is and AS WHOM it is
 * reached. Nothing here is ever a credential value.
 */

import type { SecretManagerConnection, SecretManagerConnectionConfig, SecretProviderId } from '../types';

export interface SecretConnectionFieldSpec {
  /** Property name on the provider's connection config. */
  key: string;
  required: boolean;
  /** A closed set of values — the editor renders a picklist, text otherwise. */
  options?: readonly string[];
}

/**
 * Ordered connection fields per provider. Keys mirror the schema's
 * per-provider config properties exactly — `buildSecretConnectionConfig`
 * maps the flat values back onto the typed union.
 */
export const SECRET_CONNECTION_FIELDS: Record<SecretProviderId, readonly SecretConnectionFieldSpec[]> = {
  onepassword: [
    { key: 'account', required: true },
    { key: 'auth', required: false, options: ['app', 'service-account'] },
  ],
  bitwarden: [{ key: 'serverUrl', required: false }],
  oskeychain: [],
  awssm: [
    { key: 'profile', required: false },
    { key: 'region', required: false },
  ],
  azurekv: [{ key: 'vaultUrl', required: true }],
  hashivault: [
    { key: 'serverUrl', required: true },
    { key: 'namespace', required: false },
    { key: 'authMethod', required: false, options: ['token', 'approle', 'oidc'] },
  ],
};

function field(values: Readonly<Record<string, string>>, key: string): string {
  return (values[key] ?? '').trim();
}

function optional(values: Readonly<Record<string, string>>, key: string): string | undefined {
  const trimmed = field(values, key);
  return trimmed === '' ? undefined : trimmed;
}

function pick<T extends string>(values: Readonly<Record<string, string>>, key: string, options: readonly T[]): T {
  const value = field(values, key);
  return options.find((option) => option === value) ?? options[0];
}

/**
 * Build a typed connection config from flat per-field values. Forgiving
 * like the locator codec: a missing required field becomes the empty
 * string so a half-typed connection survives; validity is
 * {@link isSecretConnectionConfigComplete}. Optional fields are omitted
 * when blank; a picklist left blank persists as its default.
 */
export function buildSecretConnectionConfig(
  provider: SecretProviderId,
  values: Readonly<Record<string, string>>,
): SecretManagerConnectionConfig {
  switch (provider) {
    case 'onepassword':
      return {
        provider,
        account: field(values, 'account'),
        auth: pick(values, 'auth', ['app', 'service-account'] as const),
      };
    case 'bitwarden': {
      const serverUrl = optional(values, 'serverUrl');
      return { provider, ...(serverUrl !== undefined ? { serverUrl } : {}) };
    }
    case 'oskeychain':
      return { provider };
    case 'awssm': {
      const profile = optional(values, 'profile');
      const region = optional(values, 'region');
      return {
        provider,
        ...(profile !== undefined ? { profile } : {}),
        ...(region !== undefined ? { region } : {}),
      };
    }
    case 'azurekv':
      return { provider, vaultUrl: field(values, 'vaultUrl') };
    case 'hashivault': {
      const namespace = optional(values, 'namespace');
      return {
        provider,
        serverUrl: field(values, 'serverUrl'),
        ...(namespace !== undefined ? { namespace } : {}),
        authMethod: pick(values, 'authMethod', ['token', 'approle', 'oidc'] as const),
      };
    }
  }
}

/** Flatten a typed config back to per-field values — the editor's hydrate direction. */
export function secretConnectionConfigToFields(config: SecretManagerConnectionConfig): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    if (key === 'provider' || typeof value !== 'string') continue;
    out[key] = value;
  }
  return out;
}

/** Whether every required connection field carries a non-blank value. */
export function isSecretConnectionConfigComplete(config: SecretManagerConnectionConfig): boolean {
  const values = secretConnectionConfigToFields(config);
  return SECRET_CONNECTION_FIELDS[config.provider].every((spec) => !spec.required || field(values, spec.key) !== '');
}

/**
 * The connection's own one-line description in the provider's idiom
 * (the account, the server, the vault URL) — what a picker shows
 * beside the label. Never a credential.
 */
export function describeSecretConnection(connection: SecretManagerConnection): string {
  const config = connection.config;
  switch (config.provider) {
    case 'onepassword':
      return config.account;
    case 'bitwarden':
      return config.serverUrl ?? '';
    case 'oskeychain':
      return '';
    case 'awssm':
      return [config.profile, config.region].filter((part) => part !== undefined && part !== '').join(' · ');
    case 'azurekv':
      return config.vaultUrl;
    case 'hashivault':
      return config.namespace !== undefined ? `${config.serverUrl} · ${config.namespace}` : config.serverUrl;
  }
}
