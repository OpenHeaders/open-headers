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
import { get as getSetting, set as setSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';

/**
 * Seed `setScopeMode` with the current value, then keep it in sync with
 * every change. Returns the unsubscribe handle.
 */
export function installCdpScopeMode(setScopeMode: (mode: CdpScopeMode) => void): () => void {
  setScopeMode(getSetting('inspection.cdpScope'));
  return subscribeKey('inspection.cdpScope', () => setScopeMode(getSetting('inspection.cdpScope')));
}

/** The persisted scope — what the remote control plane reports to the desktop. */
export function readCdpScopeMode(): CdpScopeMode {
  return getSetting('inspection.cdpScope');
}

/**
 * Write the scope — the remote control path (a desktop-relayed telemetry
 * Debug-mode command). Writes the SETTING, never the reconciler, exactly
 * like {@link setCdpMasterSwitch}: the footer's selector reflects it.
 */
export function writeCdpScopeMode(mode: CdpScopeMode): void {
  setSetting('inspection.cdpScope', mode);
}

/** Observe scope changes from any surface. Returns the unsubscribe handle. */
export function subscribeCdpScopeMode(listener: () => void): () => void {
  return subscribeKey('inspection.cdpScope', listener);
}
