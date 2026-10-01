/**
 * Secret-manager connections — one trust relationship with one
 * external secret manager instance: where it is and as whom it is
 * reached. The reference a vault row stores (`SecretLocator`) names a
 * connection and carries only the path INTO it; the connection carries
 * the rest (the account, the profile and region, the vault URL, the
 * server and auth method) and never a credential value — credentials
 * stay with the manager or ride the environment.
 *
 * Device posture, the Vault's tier: persisted under the host-local
 * `OH.secretManagerConnections` key, never synced, never exported.
 * Many connections of one provider coexist (two accounts, a production
 * and a staging server). Provider ids are brand-free in source.
 */

import * as v from 'valibot';
import { UidSchema } from './common';
import { SecretProviderIdSchema } from './variable';

export const OnePasswordAuthLaneSchema = v.picklist(['app', 'service-account']);

export const HashicorpAuthMethodSchema = v.picklist(['token', 'approle', 'oidc']);

export const SecretManagerConnectionConfigSchema = v.variant('provider', [
  v.object({
    provider: v.literal('onepassword'),
    /** Account name or UUID as the companion app shows it — the SDK's desktop auth needs it. */
    account: v.string(),
    /** `app` = the companion app brokers (biometric); `service-account` = the token from the environment. */
    auth: v.optional(OnePasswordAuthLaneSchema, 'app'),
  }),
  v.object({
    provider: v.literal('bitwarden'),
    /** Self-hosted server; blank = the vendor cloud. */
    serverUrl: v.optional(v.string()),
  }),
  v.object({
    provider: v.literal('oskeychain'),
  }),
  v.object({
    provider: v.literal('awssm'),
    /** Credential-chain profile; blank = the default chain. */
    profile: v.optional(v.string()),
    /** Blank = the chain's region. */
    region: v.optional(v.string()),
  }),
  v.object({
    provider: v.literal('azurekv'),
    vaultUrl: v.string(),
  }),
  v.object({
    provider: v.literal('hashivault'),
    serverUrl: v.string(),
    namespace: v.optional(v.string()),
    authMethod: v.optional(HashicorpAuthMethodSchema, 'token'),
  }),
]);

export const SecretManagerConnectionSchema = v.object({
  uid: UidSchema,
  /** The user's own name for it ("Work", "Prod vault"). */
  label: v.string(),
  config: SecretManagerConnectionConfigSchema,
});

export const SecretManagerConnectionsSchema = v.object({
  connections: v.array(SecretManagerConnectionSchema),
});

export const SECRET_PROVIDER_IDS = SecretProviderIdSchema.options;
