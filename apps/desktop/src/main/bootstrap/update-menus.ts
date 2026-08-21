/**
 * Native update affordances — the state-driven "Check for Updates…"
 * item shared by the application menu and the tray menu.
 *
 * Electron menus are immutable snapshots, so this module owns the
 * current updater state and re-runs every registered menu builder on
 * each transition: the item reads "Check for Updates…" → "Checking for
 * Updates…" → "Update to X & Restart" → "Downloading Update… N%" →
 * "Restart to Install X" as the machine advances.
 *
 * Every click maps 1:1 onto one `oh.updates.*` action — checking never
 * downloads, and only the explicit Update & Restart / Restart items
 * restart the app. A manual check never opens a dialog: it shows the
 * main window and runs the check, and the renderer carries the outcome
 * — footer progress while it runs, a corner toast + notification entry
 * when it settles.
 */

import type { AppUpdateState } from '@openheaders/core/bridge';
import { type MenuItemConstructorOptions, shell } from 'electron';
import { updateCapability } from '../electron-updater-port';
import { mainTranslator, onLocaleChange } from './locale';
import { showMainWindow } from './window-manager';

/** The update-service slice the menu items drive (wired by `install-rpc-host`). */
export interface UpdateMenuActions {
  checkNow(): Promise<AppUpdateState>;
  updateAndRestart(): Promise<AppUpdateState>;
  install(): Promise<AppUpdateState>;
}

let actions: UpdateMenuActions | null = null;
let state: AppUpdateState | null = null;

const menuBuilders = new Set<() => void>();

/** Menus register their own rebuild; the module never imports them back. */
export function registerUpdateMenuBuilder(rebuild: () => void): void {
  menuBuilders.add(rebuild);
}

// A locale change relabels every native menu, not just the update item —
// the registry here is the one place that already reaches them all.
onLocaleChange(() => {
  for (const rebuild of menuBuilders) rebuild();
});

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
 * builds without an update service (dev runs). deb/rpm installs get
 * the notify-only pair: Check for Updates… plus, when one is offered,
 * an item opening the release notes — the package manager owns the
 * install, so no Update & Restart ever appears there.
 */
export function updateMenuItems(): MenuItemConstructorOptions[] {
  if (updateCapability() === 'none') return [];
  const t = mainTranslator();
  switch (state?.phase) {
    case 'checking':
      return [{ label: t('desktop.update.checking'), enabled: false }];
    case 'available': {
      if (state.installMethod === 'packageManager') {
        const url = state.releaseNotesUrl;
        return [
          {
            label: t('desktop.update.availableExternal', { version: state.availableVersion ?? '' }),
            enabled: url !== null,
            click: () => {
              if (url !== null) void shell.openExternal(url);
            },
          },
        ];
      }
      return [
        {
          label: t('desktop.update.updateAndRestart', { version: state.availableVersion ?? '' }),
          click: () => void actions?.updateAndRestart(),
        },
      ];
    }
    case 'downloading':
      return [
        {
          label:
            state.progressPercent !== null
              ? t('desktop.update.downloading', { percent: state.progressPercent })
              : t('desktop.update.downloadingNoProgress'),
          enabled: false,
        },
      ];
    case 'downloaded':
      return [
        {
          label: t('desktop.update.restartToInstall', { version: state.availableVersion ?? '' }),
          click: () => void actions?.install(),
        },
      ];
    default:
      // idle / error / pre-engine null — offer a fresh manual check.
      return [{ label: t('desktop.update.check'), click: runManualCheck }];
  }
}
