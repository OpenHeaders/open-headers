/**
 * How a trust store is named on a settings surface — the HTTPS Trust
 * pane's rows and results, and the list of stores that kept the capture
 * certificate when a Windows package removes its data.
 */

import type { ProxyTrustStoreId } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';

export const STORE_LABEL: Record<ProxyTrustStoreId, MessageKey> = {
  'macos-login-keychain': 'workbench.settings.proxyTrustPane.stores.loginKeychain',
  'macos-system-keychain': 'workbench.settings.proxyTrustPane.stores.systemKeychain',
  'nss-firefox': 'workbench.settings.proxyTrustPane.stores.firefoxProfile',
};

/** A derived Firefox row names the installed app bundle, not a profile. */
function isFirefoxInstallRef(store: ProxyTrustStoreId, ref: string): boolean {
  return store === 'nss-firefox' && ref.endsWith('.app');
}

/**
 * Firefox profile rows are per-profile — profile dirs are
 * `<salt>.<name>`, so the name part tells them apart ("default",
 * "default-release"); the full path stays in the row tooltip. An
 * install row shows its bundle path whole, like the keychain rows.
 */
export function storeRefName(store: ProxyTrustStoreId, ref: string): string {
  if (store !== 'nss-firefox' || isFirefoxInstallRef(store, ref)) return ref;
  const basename = ref.split(/[\\/]/).pop() ?? ref;
  const dot = basename.indexOf('.');
  return dot > 0 ? basename.slice(dot + 1) : basename;
}

export function storeLabelKey(store: ProxyTrustStoreId, ref: string): MessageKey {
  return isFirefoxInstallRef(store, ref) ? 'workbench.settings.proxyTrustPane.stores.firefox' : STORE_LABEL[store];
}
