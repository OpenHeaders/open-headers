/**
 * Desktop namespace — main-process-owned strings (tray menu, application
 * menu, update items, native dialogs). These render outside any React
 * root: the main process threads a `Translator` from the runtime
 * directly and follows the settings locale, not the OS locale. Role-bound
 * menu items keep Electron's own labels (deferred to the first real
 * locale); the 'Open Headers' brand rides raw inside the values — the
 * brand never translates.
 */

import type { Catalog } from '../../types';

export const desktop = {
  'desktop.tray.open': 'Open Open Headers',
  'desktop.tray.quit': 'Quit',
  'desktop.menu.settings': 'Settings…',
  'desktop.menu.about': 'About {name}',
  'desktop.menu.enableHardwareAcceleration': 'Enable Hardware Acceleration',
  'desktop.menu.disableHardwareAcceleration': 'Disable Hardware Acceleration',
  'desktop.menu.file': 'File',
  'desktop.menu.edit': 'Edit',
  'desktop.menu.view': 'View',
  'desktop.menu.window': 'Window',
  'desktop.menu.help': 'Help',
  'desktop.menu.newItem': 'New…',
  'desktop.menu.newTab': 'New Tab',
  'desktop.menu.newWindow': 'New Window',
  'desktop.menu.import': 'Import…',
  'desktop.menu.closeTab': 'Close Tab',
  'desktop.menu.nextTab': 'Next Tab',
  'desktop.menu.previousTab': 'Previous Tab',
  'desktop.menu.actualSize': 'Actual Size',
  'desktop.menu.documentation': 'Documentation',
  'desktop.menu.reportIssue': 'Report an Issue',
  'desktop.menu.licenseAgreement': 'License Agreement',
  'desktop.update.check': 'Check for Updates…',
  'desktop.update.checking': 'Checking for Updates…',
  'desktop.update.updateAndRestart': 'Update to {version} & Restart',
  'desktop.update.availableExternal': 'Version {version} Available…',
  'desktop.update.downloading': 'Downloading Update… {percent}%',
  'desktop.update.downloadingNoProgress': 'Downloading Update…',
  'desktop.update.restartToInstall': 'Restart to Install {version}',
  'desktop.dialog.hardwareAcceleration.title': 'Hardware Acceleration',
  'desktop.dialog.hardwareAcceleration.willBeDisabled':
    'Hardware acceleration will be disabled the next time {name} starts.',
  'desktop.dialog.hardwareAcceleration.willBeEnabled':
    'Hardware acceleration will be enabled the next time {name} starts.',
  'desktop.dialog.hardwareAcceleration.detail': 'Restart now to apply the change immediately.',
  'desktop.dialog.hardwareAcceleration.restartNow': 'Restart Now',
  'desktop.dialog.hardwareAcceleration.later': 'Later',
  'desktop.firstRunLegal.message':
    'By continuing to use Open Headers, you agree to our license terms and privacy policy.',
  'desktop.firstRunLegal.license': 'License Terms',
  'desktop.firstRunLegal.privacy': 'Privacy Policy',
  'desktop.firstRunLegal.acknowledge': 'Got it',
} as const satisfies Catalog;
