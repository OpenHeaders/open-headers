/**
 * Native update affordances — the state-driven "Check for Updates…"
 * item shared by the application menu and the tray menu.
 *
 * Electron menus are immutable snapshots, so this module owns the
 * current updater state and re-runs every registered menu builder on
 * each transition: the item reads "Check for Updates…" → "Checking for
 * Updates…" → "Download Open Headers X" → "Downloading Update… N%" →
 * "Restart to Install Open Headers X" as the machine advances.
 *
 * Consent model is preserved end-to-end: every click maps 1:1 onto one
 * `oh.updates.*` action — checking never downloads, downloading never
 * installs. A manual check never opens a dialog: it shows the main
 * window and runs the check, and the renderer carries the outcome —
 * footer progress while it runs, a corner toast + notification entry
 * when it settles.
 */

import type { AppUpdateState } from '@openheaders/core/bridge';
import type { MenuItemConstructorOptions } from 'electron';
import { updaterSupported } from '../electron-updater-port';
import { showMainWindow } from './window-manager';

/** The update-service slice the menu items drive (wired by `install-rpc-host`). */
export interface UpdateMenuActions {
  checkNow(): Promise<AppUpdateState>;
  download(): Promise<AppUpdateState>;
  install(): Promise<AppUpdateState>;
}

let actions: UpdateMenuActions | null = null;
let state: AppUpdateState | null = null;

const menuBuilders = new Set<() => void>();

/** Menus register their own rebuild; the module never imports them back. */
export function registerUpdateMenuBuilder(rebuild: () => void): void {
  menuBuilders.add(rebuild);
}

/** Called by `install-rpc-host` once the update service exists. */
export function installUpdateMenuActions(next: UpdateMenuActions): void {
  actions = next;
}

/** Feed of `appUpdateState` transitions — rebuilds every registered menu. */
export function updateMenusOnState(next: AppUpdateState): void {
  state = next;
  for (const rebuild of menuBuilders) rebuild();
}

/**
 * Manual check from native chrome: reveal the window (the renderer owns
 * all feedback — footer progress, result toast, notification entry) and
 * kick the check. The service is single-flight, so a click during a
 * running check just reports current state.
 */
function runManualCheck(): void {
  if (!actions) return;
  showMainWindow();
  void actions.checkNow();
}

/**
 * The update menu item for the current state — one entry, or none on
 * builds without an updater (dev runs, deb/rpm channels).
 */
export function updateMenuItems(): MenuItemConstructorOptions[] {
  if (!updaterSupported()) return [];
  switch (state?.phase) {
    case 'checking':
      return [{ label: 'Checking for Updates…', enabled: false }];
    case 'available':
      return [
        {
          label: `Download Open Headers ${state.availableVersion}`,
          click: () => void actions?.download(),
        },
      ];
    case 'downloading':
      return [
        {
          label:
            state.progressPercent !== null ? `Downloading Update… ${state.progressPercent}%` : 'Downloading Update…',
          enabled: false,
        },
      ];
    case 'downloaded':
      return [
        {
          label: `Restart to Install Open Headers ${state.availableVersion}`,
          click: () => void actions?.install(),
        },
      ];
    default:
      // idle / error / pre-engine null — offer a fresh manual check.
      return [{ label: 'Check for Updates…', click: runManualCheck }];
  }
}
