export {
  buildSecretLocator,
  formatSecretLocator,
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
  SecretProvider,
  SecretProviderId,
  SecretProviderProbe,
  SecretProviderUnavailableReason,
  SecretResolution,
  SecretResolveFailureReason,
} from './types';
