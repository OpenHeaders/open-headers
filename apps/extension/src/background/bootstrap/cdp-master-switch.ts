/**
 * Opt-in CDP master switch wiring.
 *
 * The single effector for `inspection.cdpEnabled`: seed the reconciler
 * with the persisted value once (`subscribeKey` fires on change only),
 * then drive it on every subsequent change. The setting is
 * chrome.storage-backed, so a write from any surface (popup / panel /
 * workbench) propagates into this worker via `storage.onChanged` and
 * fires the same subscription — no reload, no permission prompt (the
 * permission is static).
 *
 * Settings must be ready before this runs so the seed read resolves to
 * the persisted (or default) value rather than `undefined`.
 */

import { get as getSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';

/**
 * Seed `setCdpEnabled` with the current value, then keep it in sync with
 * every change. Returns the unsubscribe handle.
 */
export function installCdpMasterSwitch(setCdpEnabled: (enabled: boolean) => void): () => void {
  setCdpEnabled(getSetting('inspection.cdpEnabled'));
  return subscribeKey('inspection.cdpEnabled', () => setCdpEnabled(getSetting('inspection.cdpEnabled')));
}
