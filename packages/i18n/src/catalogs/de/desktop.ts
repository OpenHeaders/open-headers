/**
 * Desktop namespace — German. Mirrors `catalogs/en/desktop.ts` key for
 * key; role-bound menu items keep Electron's own labels and the
 * 'Open Headers' brand rides raw inside the values. Menu items follow
 * German platform convention (verb-final: `Tab schließen`); Settings =
 * `Einstellungen` (de register contract); Update/Tab ride raw as
 * established German UI vocabulary.
 */

import type { Catalog } from '../../types';

export const desktop = {
  'desktop.tray.open': 'Open Headers öffnen',
  'desktop.tray.quit': 'Beenden',
  'desktop.menu.settings': 'Einstellungen…',
  'desktop.menu.about': 'Über {name}',
  'desktop.menu.enableHardwareAcceleration': 'Hardwarebeschleunigung aktivieren',
  'desktop.menu.disableHardwareAcceleration': 'Hardwarebeschleunigung deaktivieren',
  'desktop.menu.file': 'Datei',
  'desktop.menu.edit': 'Bearbeiten',
  'desktop.menu.view': 'Ansicht',
  'desktop.menu.window': 'Fenster',
  'desktop.menu.help': 'Hilfe',
  'desktop.menu.newItem': 'Neu…',
  'desktop.menu.newTab': 'Neuer Tab',
  'desktop.menu.newWindow': 'Neues Fenster',
  'desktop.menu.import': 'Importieren…',
  'desktop.menu.closeTab': 'Tab schließen',
  'desktop.menu.nextTab': 'Nächster Tab',
  'desktop.menu.previousTab': 'Vorheriger Tab',
  'desktop.menu.actualSize': 'Originalgröße',
  'desktop.menu.documentation': 'Dokumentation',
  'desktop.menu.reportIssue': 'Problem melden',
  'desktop.menu.licenseAgreement': 'Lizenzvereinbarung',
  'desktop.update.check': 'Nach Updates suchen…',
  'desktop.update.checking': 'Suche nach Updates…',
  'desktop.update.updateAndRestart': 'Auf Open Headers {version} aktualisieren und neu starten',
  'desktop.update.availableExternal': 'Version {version} verfügbar…',
  'desktop.update.downloading': 'Update wird heruntergeladen… {percent} %',
  'desktop.update.downloadingNoProgress': 'Update wird heruntergeladen…',
  'desktop.update.restartToInstall': 'Neu starten, um Open Headers {version} zu installieren',
  'desktop.dialog.hardwareAcceleration.title': 'Hardwarebeschleunigung',
  'desktop.dialog.hardwareAcceleration.willBeDisabled':
    'Die Hardwarebeschleunigung wird beim nächsten Start von {name} deaktiviert.',
  'desktop.dialog.hardwareAcceleration.willBeEnabled':
    'Die Hardwarebeschleunigung wird beim nächsten Start von {name} aktiviert.',
  'desktop.dialog.hardwareAcceleration.detail': 'Starte jetzt neu, um die Änderung sofort anzuwenden.',
  'desktop.dialog.hardwareAcceleration.restartNow': 'Jetzt neu starten',
  'desktop.dialog.hardwareAcceleration.later': 'Später',
  'desktop.firstRunLegal.message':
    'Wenn du Open Headers weiter nutzt, stimmst du unseren Lizenzbedingungen und unserer Datenschutzerklärung zu.',
  'desktop.firstRunLegal.license': 'Lizenzbedingungen',
  'desktop.firstRunLegal.privacy': 'Datenschutzerklärung',
  'desktop.firstRunLegal.acknowledge': 'Verstanden',
} as const satisfies Catalog;
