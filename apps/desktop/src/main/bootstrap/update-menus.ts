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
 * installs. A manual menu check additionally reports its outcome in a
 * native dialog (the window may be hidden or closed when the tray item
 * is used, so renderer toasts alone can't carry the answer).
 */

import type { AppUpdateState } from '@openheaders/core/bridge';
import { dialog, type MenuItemConstructorOptions } from 'electron';
import { updaterSupported } from '../electron-updater-port';

/** The update-service slice the menu items drive (wired by `install-rpc-host`). */
export interface UpdateMenuActions {
  checkNow(): Promise<AppUpdateState>;
  download(): Promise<AppUpdateState>;
  install(): Promise<AppUpdateState>;
}

let actions: UpdateMenuActions | null = null;
let state: AppUpdateState | null = null;
// Guards the result dialog: only a user-clicked menu check answers with
// a dialog; scheduled background checks stay silent.
let manualCheckInFlight = false;

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

async function runManualCheck(): Promise<void> {
  if (!actions || manualCheckInFlight) return;
  manualCheckInFlight = true;
  try {
    const result = await actions.checkNow();
    if (result.phase === 'available' && result.availableVersion !== null) {
      const { response } = await dialog.showMessageBox({
        type: 'info',
        message: `Open Headers ${result.availableVersion} is available.`,
        detail: `You are on ${result.currentVersion}. Downloading stages the update; it installs when you restart.`,
        buttons: ['Download', 'Later'],
        defaultId: 0,
        cancelId: 1,
      });
      if (response === 0) void actions.download();
    } else if (result.phase === 'error') {
      await dialog.showMessageBox({
        type: 'warning',
        message: 'Update check failed.',
        detail: result.errorMessage ?? 'Unknown error.',
        buttons: ['OK'],
      });
    } else if (result.phase === 'idle') {
      await dialog.showMessageBox({
        type: 'info',
        message: "You're up to date.",
        detail: `Open Headers ${result.currentVersion} is the latest version.`,
        buttons: ['OK'],
      });
    }
    // 'checking'/'downloading' — another flow already owns the updater;
    // the live menu labels carry that state, no dialog needed.
  } finally {
    manualCheckInFlight = false;
  }
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
      return [{ label: 'Check for Updates…', click: () => void runManualCheck() }];
  }
}
