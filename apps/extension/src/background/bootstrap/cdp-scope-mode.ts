/**
 * CDP attach-scope-mode wiring.
 *
 * The single effector for `inspection.cdpScope`: seed the reconciler with
 * the persisted value once (`subscribeKey` fires on change only), then drive
 * it on every subsequent change. chrome.storage-backed, so a write from any
 * surface (footer / settings) propagates into this worker via
 * `storage.onChanged` and fires the same subscription — no reload.
 *
 * Sibling to {@link installCdpMasterSwitch}: the master switch is the on/off
 * axis, this is the breadth axis once on. Settings must be ready before this
 * runs so the seed read resolves to the persisted (or default) value.
 */

import type { CdpScopeMode } from '@openheaders/core/types';
import { get as getSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';

/**
 * Seed `setScopeMode` with the current value, then keep it in sync with
 * every change. Returns the unsubscribe handle.
 */
export function installCdpScopeMode(setScopeMode: (mode: CdpScopeMode) => void): () => void {
  setScopeMode(getSetting('inspection.cdpScope'));
  return subscribeKey('inspection.cdpScope', () => setScopeMode(getSetting('inspection.cdpScope')));
}
