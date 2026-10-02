/**
 * `(i)` info-popover content for the secret-manager forms — the auth
 * form's `AuthRowInfo` idiom brought to Settings › Secret Managers'
 * connection form and the Vault row's reference: kicker, title, one
 * example card per provider with the popover's slice lit, then the
 * row's own copy. The card is the provider's two layers in its own
 * idiom — the connection (where the manager is and as whom it is
 * reached) and a reference (the path into it) — ending in the line the
 * reference resolves to, so a field popover answers "what goes here,
 * and where does it land". Values are fictional placeholders, never
 * the user's. The card follows the form's picklists (the 1Password
 * auth lane, the HashiCorp auth method) since those change the shape;
 * a text field always shows the example. Card tokens ride raw (wire
 * vocabulary); only the caption is localized.
 */

import { buildSecretLocator, formatSecretLocator, SECRET_LOCATOR_FIELDS } from '@openheaders/core/secret-providers';
import type { SecretProviderId } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import {
  EXAMPLE_CARD_POPOVER_WIDTH,
  ExampleCard,
  type ExampleCardLine,
  type ExampleCardToken,
  type InfoPopoverContent,
} from '@openheaders/ui/shared/info-popover';
import { SM_FIELD_LABEL, SM_PROVIDER_LABEL } from './SecretManagerStatusChip';

/** The form's current field values — the picklists steer the card. */
export type SecretConnectionFields = Readonly<Record<string, string>>;

const NO_FIELDS: SecretConnectionFields = {};

type TokenId = `connection.${string}` | `locator.${string}` | 'reference';
type Token = ExampleCardToken<TokenId>;
type Line = ExampleCardLine<TokenId>;

/** The one Vault entry every card resolves — the same name across providers. */
const VAULT_REFERENCE = '{{vault.apiToken}}';

const connectionTok = (key: string, text: string): Token => ({ id: `connection.${key}`, text });
const locatorTok = (key: string, text: string): Token => ({ id: `locator.${key}`, text });

/** The example path per provider — the card's reference line and, through
 *  the core codec, its resolved form. */
const EXAMPLE_LOCATOR: Record<SecretProviderId, Readonly<Record<string, string>>> = {
  onepassword: { vault: 'Engineering', item: 'Payments API', field: 'credential' },
  bitwarden: { secretId: '7c2f9a1e-3b4d-4e5f-8a6b-1c2d3e4f5a6b' },
  oskeychain: { service: 'api.openheaders.com', account: 'john.doe' },
  awssm: { name: 'prod/payments/api-key', stage: 'AWSCURRENT' },
  azurekv: { name: 'payments-api-key', version: '7c2f9a1e' },
  hashivault: { mount: 'secret', path: 'payments/api', key: 'token' },
};

/** The word a token opens with when the field key is not one. */
const TOKEN_WORD: Readonly<Record<string, string>> = { secretId: 'secret' };

/** The connection's own name leads the connect line — what the Vault
 *  row's picker shows beside the provider's description. */
const LABEL_TOKEN: Token = connectionTok('label', 'name: Work');

function connectionTokens(provider: SecretProviderId, fields: SecretConnectionFields): Token[] {
  return [LABEL_TOKEN, ...providerConnectionTokens(provider, fields)];
}

function providerConnectionTokens(provider: SecretProviderId, fields: SecretConnectionFields): Token[] {
  switch (provider) {
    case 'onepassword':
      return [
        connectionTok('account', 'account: Acme Team'),
        connectionTok('auth', fields.auth === 'service-account' ? 'auth: service account token' : 'auth: desktop app'),
      ];
    case 'bitwarden':
      return [connectionTok('serverUrl', 'server: https://bitwarden.openheaders.com')];
    case 'oskeychain':
      return [connectionTok('store', "this computer's credential store")];
    case 'awssm':
      return [connectionTok('profile', 'profile: default'), connectionTok('region', 'region: eu-central-1')];
    case 'azurekv':
      return [connectionTok('vaultUrl', 'vault: https://acme-secrets.vault.azure.net')];
    case 'hashivault': {
      const method = fields.authMethod === 'approle' || fields.authMethod === 'oidc' ? fields.authMethod : 'token';
      return [
        connectionTok('serverUrl', 'server: https://vault.openheaders.com:8200'),
        connectionTok('namespace', 'namespace: team-a'),
        connectionTok('authMethod', `auth: ${method}`),
      ];
    }
  }
}

function locatorTokens(provider: SecretProviderId): Token[] {
  const example = EXAMPLE_LOCATOR[provider];
  return SECRET_LOCATOR_FIELDS[provider].map((spec) =>
    locatorTok(spec.key, `${TOKEN_WORD[spec.key] ?? spec.key}: ${example[spec.key]}`),
  );
}

function exampleLines(provider: SecretProviderId, fields: SecretConnectionFields): Line[] {
  const resolved = formatSecretLocator(buildSecretLocator(provider, 'example', EXAMPLE_LOCATOR[provider]));
  return [
    { opener: 'connect', tokens: connectionTokens(provider, fields) },
    { opener: VAULT_REFERENCE, tokens: locatorTokens(provider) },
    { opener: 'resolves', tokens: [{ id: 'reference', text: resolved }] },
  ];
}

function SecretExampleCard({
  provider,
  fields,
  lit,
}: {
  provider: SecretProviderId;
  fields: SecretConnectionFields;
  lit: ReadonlySet<TokenId>;
}) {
  const t = useT();
  return (
    <ExampleCard
      caption={t('workbench.variables.table.smInfo.exampleCaption')}
      lines={exampleLines(provider, fields)}
      lit={lit}
    />
  );
}

function card(provider: SecretProviderId, fields: SecretConnectionFields, lit: Iterable<TokenId>) {
  return {
    diagram: <SecretExampleCard provider={provider} fields={fields} lit={new Set(lit)} />,
    maxWidth: EXAMPLE_CARD_POPOVER_WIDTH,
  };
}

const PROVIDER_SUMMARY_KEY: Record<SecretProviderId, MessageKey> = {
  onepassword: 'workbench.variables.table.smInfo.provider.onepassword',
  bitwarden: 'workbench.variables.table.smInfo.provider.bitwarden',
  oskeychain: 'workbench.variables.table.smInfo.provider.oskeychain',
  awssm: 'workbench.variables.table.smInfo.provider.awssm',
  azurekv: 'workbench.variables.table.smInfo.provider.azurekv',
  hashivault: 'workbench.variables.table.smInfo.provider.hashivault',
};

/** One summary per connection field — explicit keys so the union stays typecheckable. */
const CONNECTION_FIELD_SUMMARY_KEY: Record<SecretProviderId, Readonly<Record<string, MessageKey>>> = {
  onepassword: {
    account: 'workbench.variables.table.smInfo.connection.onepassword.account',
    auth: 'workbench.variables.table.smInfo.connection.onepassword.auth',
  },
  bitwarden: { serverUrl: 'workbench.variables.table.smInfo.connection.bitwarden.serverUrl' },
  oskeychain: {},
  awssm: {
    profile: 'workbench.variables.table.smInfo.connection.awssm.profile',
    region: 'workbench.variables.table.smInfo.connection.awssm.region',
  },
  azurekv: { vaultUrl: 'workbench.variables.table.smInfo.connection.azurekv.vaultUrl' },
  hashivault: {
    serverUrl: 'workbench.variables.table.smInfo.connection.hashivault.serverUrl',
    namespace: 'workbench.variables.table.smInfo.connection.hashivault.namespace',
    authMethod: 'workbench.variables.table.smInfo.connection.hashivault.authMethod',
  },
};

/** One summary per locator (path) field. */
const LOCATOR_FIELD_SUMMARY_KEY: Record<SecretProviderId, Readonly<Record<string, MessageKey>>> = {
  onepassword: {
    vault: 'workbench.variables.table.smInfo.locator.onepassword.vault',
    item: 'workbench.variables.table.smInfo.locator.onepassword.item',
    field: 'workbench.variables.table.smInfo.locator.onepassword.field',
  },
  bitwarden: { secretId: 'workbench.variables.table.smInfo.locator.bitwarden.secretId' },
  oskeychain: {
    service: 'workbench.variables.table.smInfo.locator.oskeychain.service',
    account: 'workbench.variables.table.smInfo.locator.oskeychain.account',
  },
  awssm: {
    name: 'workbench.variables.table.smInfo.locator.awssm.name',
    stage: 'workbench.variables.table.smInfo.locator.awssm.stage',
  },
  azurekv: {
    name: 'workbench.variables.table.smInfo.locator.azurekv.name',
    version: 'workbench.variables.table.smInfo.locator.azurekv.version',
  },
  hashivault: {
    mount: 'workbench.variables.table.smInfo.locator.hashivault.mount',
    path: 'workbench.variables.table.smInfo.locator.hashivault.path',
    key: 'workbench.variables.table.smInfo.locator.hashivault.key',
  },
};

/** The Provider row's popover: the whole card lit, the provider's one-paragraph summary. */
export function secretProviderInfo(
  t: Translate,
  provider: SecretProviderId,
  fields: SecretConnectionFields = NO_FIELDS,
): InfoPopoverContent {
  return {
    kicker: t('workbench.variables.table.kindSecretManager'),
    title: t(SM_PROVIDER_LABEL[provider]),
    ...card(provider, fields, [...connectionTokens(provider, fields).map((token) => token.id), 'reference']),
    summary: t(PROVIDER_SUMMARY_KEY[provider]),
  };
}

/** The Name row's popover: the connect line's name token lit — the
 *  label names the connection here and never reaches the manager. */
export function secretConnectionLabelInfo(
  t: Translate,
  provider: SecretProviderId,
  fields: SecretConnectionFields = NO_FIELDS,
): InfoPopoverContent {
  return {
    kicker: t(SM_PROVIDER_LABEL[provider]),
    title: t('workbench.variables.secretManagers.form.label'),
    ...card(provider, fields, [LABEL_TOKEN.id]),
    summary: t('workbench.variables.table.smInfo.label'),
  };
}

/** One connection field's popover: its token lit; `undefined` for a
 *  field the provider's copy does not cover. */
export function secretConnectionFieldInfo(
  t: Translate,
  provider: SecretProviderId,
  key: string,
  fields: SecretConnectionFields = NO_FIELDS,
): InfoPopoverContent | undefined {
  const summary = CONNECTION_FIELD_SUMMARY_KEY[provider][key];
  if (summary === undefined) return undefined;
  return {
    kicker: t(SM_PROVIDER_LABEL[provider]),
    title: t(SM_FIELD_LABEL[key]),
    ...card(provider, fields, [`connection.${key}`]),
    summary: t(summary),
  };
}

/** The Vault row's popover: the reference line and its resolved form
 *  lit, then every path field of the provider with its own line. */
export function secretReferenceInfo(t: Translate, provider: SecretProviderId): InfoPopoverContent {
  const specs = SECRET_LOCATOR_FIELDS[provider];
  return {
    kicker: t(SM_PROVIDER_LABEL[provider]),
    title: t('workbench.variables.table.smInfo.referenceTitle'),
    ...card(provider, NO_FIELDS, [...specs.map((spec): TokenId => `locator.${spec.key}`), 'reference']),
    summary: t('workbench.variables.table.smInfo.reference'),
    sections: [
      {
        heading: t('workbench.variables.table.smInfo.fieldsHeading'),
        layout: 'stacked',
        items: specs.map((spec) => ({
          label: spec.required
            ? t(SM_FIELD_LABEL[spec.key])
            : t('workbench.variables.table.smFieldOptional', { label: t(SM_FIELD_LABEL[spec.key]) }),
          desc: t(LOCATOR_FIELD_SUMMARY_KEY[provider][spec.key]),
        })),
      },
    ],
  };
}
