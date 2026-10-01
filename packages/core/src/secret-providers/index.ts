export {
  buildSecretConnectionConfig,
  describeSecretConnection,
  isSecretConnectionConfigComplete,
  SECRET_CONNECTION_FIELDS,
  type SecretConnectionFieldSpec,
  secretConnectionConfigToFields,
} from './connection';
export {
  buildSecretLocator,
  formatSecretLocator,
  hasSecretLocatorConnection,
  isSecretLocatorComplete,
  SECRET_LOCATOR_FIELDS,
  SECRET_PROVIDER_IDS,
  type SecretLocatorFieldSpec,
  secretLocatorToFields,
} from './locator';
export {
  getSecretProvider,
  listSecretProviders,
  registerSecretProvider,
  unregisterSecretProvider,
} from './registry';
export type {
  SecretAuthorizeResult,
  SecretLocator,
  SecretManagerConnection,
  SecretProvider,
  SecretProviderId,
  SecretProviderProbe,
  SecretProviderUnavailableReason,
  SecretResolution,
  SecretResolveFailureReason,
} from './types';
