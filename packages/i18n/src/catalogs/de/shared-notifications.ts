/**
 * Shared notifications family — German. Mirrors
 * `catalogs/en/shared-notifications.ts` key for key; see that file for
 * the family rules (store copy is captured at push time — timeline
 * entries keep the locale they were pushed under). Mints: timeline =
 * Zeitverlauf (m.); keychain (macOS) = Schlüsselbund (m.); keyring
 * (Linux) = Schlüsselbund-Backend; credential store =
 * Anmeldedaten-Speicher (m.).
 */

import type { Catalog } from '../../types';

export const sharedNotifications = {
  // ── Tool window chrome ─────────────────────────────────────────────
  'shared.notifications.title': 'Benachrichtigungen',
  'shared.notifications.info.summary':
    'Vorschläge zu deiner Einrichtung und ein Sitzungs-Zeitverlauf der App-Ereignisse — verfügbare Updates, ' +
    'Ergebnisse von Hintergrundaufgaben und andere Hinweise, hier gesammelt, statt deine Arbeit zu unterbrechen.',
  'shared.notifications.suggestionsHeading': 'Vorschläge',
  'shared.notifications.timelineHeading': 'Zeitverlauf',
  'shared.notifications.clearAll': 'Alle löschen',
  'shared.notifications.suggestionsEmpty.title': 'Keine Vorschläge',
  'shared.notifications.suggestionsEmpty.description': 'Hinweise zu deiner Einrichtung erscheinen hier.',
  'shared.notifications.timelineEmpty.title': 'Keine Benachrichtigungen',
  'shared.notifications.timelineEmpty.description': 'App-Ereignisse und Updates erscheinen hier.',
  'shared.notifications.dismiss': 'Verwerfen',
  'shared.notifications.moreActions': 'Weitere Aktionen',

  // ── Mute ("Don't show again") flow ─────────────────────────────────
  'shared.notifications.dontShowAgain': 'Nicht mehr anzeigen',
  'shared.notifications.muted.title': 'Benachrichtigungen deaktiviert',
  'shared.notifications.muted.description': '„{title}“ wird nicht mehr angezeigt.',
  'shared.notifications.muted.reEnable': 'Wieder aktivieren',
  'shared.notifications.muted.reEnableTooltip': 'Diese Benachrichtigung wieder zulassen',

  // ── Seed nudges ────────────────────────────────────────────────────
  'shared.notifications.seed.website.title': 'Entdecke Open Headers',
  'shared.notifications.seed.website.description':
    'Erkunde alle unsere Funktionen interaktiv, dazu die neuesten Updates.',
  'shared.notifications.seed.website.action': 'Besuche unsere Website',
  'shared.notifications.seed.website.tooltip': 'Website öffnen und Benachrichtigung löschen',
  'shared.notifications.seed.star.title': 'Hilf uns zu wachsen',
  'shared.notifications.seed.star.description': 'Empfiehl uns deinen Freunden und Kollegen',
  'shared.notifications.seed.star.action': 'Gib uns einen Stern auf GitHub',
  'shared.notifications.seed.star.tooltip': 'GitHub öffnen und Benachrichtigung löschen',

  // ── Desktop-app suggestion (browser hosts without the companion) ───
  'shared.notifications.desktopApp.title': 'Ein einheitliches Nutzererlebnis',
  'shared.notifications.desktopApp.rowTerminal': 'Integriertes Terminal — voller Shell-Zugriff in deinen Arbeitsbereichen',
  'shared.notifications.desktopApp.rowGit': 'Versionskontrolle — Git-Commits und -Verlauf für deine Arbeitsbereiche',
  'shared.notifications.desktopApp.rowProxy': 'Erfasse Live-Traffic aus deinen Browser-Tabs oder dem System',
  'shared.notifications.desktopApp.rowMcp': 'MCP-Server für KI-Assistenten — Live-Traffic-Analyse und Debugging',
  'shared.notifications.desktopApp.rowRequests': 'Erstelle und führe native API-Requests aus — gRPC, WebSocket, SSE und mehr',
  'shared.notifications.desktopApp.action': 'Desktop-App herunterladen',
  'shared.notifications.desktopApp.tooltip': 'App herunterladen und Vorschlag löschen',

  // ── App-update timeline entries ────────────────────────────────────
  'shared.notifications.appUpdate.title': 'Open Headers {version} verfügbar',
  'shared.notifications.appUpdate.securityTitle': 'Sicherheitsupdate Open Headers {version} verfügbar',
  'shared.notifications.appUpdate.securityDescription':
    'Diese Version behebt ein Sicherheitsproblem, das die von dir verwendete Version betrifft. Aktualisiere so ' +
    'bald wie möglich.',
  'shared.notifications.appUpdate.download': 'Herunterladen…',

  // ── Update corner balloon (AppUpdateToast) ─────────────────────────
  'shared.notifications.toast.settings': 'Einstellungen…',
  'shared.notifications.toast.dontShowAgain': 'Nicht mehr anzeigen',
  'shared.notifications.toast.optionsTooltip': 'Ausschalten oder Verhalten ändern',
  'shared.notifications.toast.optionsAria': 'Optionen für Update-Benachrichtigungen',
  'shared.notifications.toast.close': 'Schließen',
  'shared.notifications.toast.upToDateTitle': 'Du bist auf dem neuesten Stand',
  'shared.notifications.toast.upToDateDescription': 'Open Headers {version} ist die neueste Version.',
  'shared.notifications.toast.checkFailed': 'Update-Prüfung fehlgeschlagen',
  'shared.notifications.toast.downloadFailed': 'Update-Download fehlgeschlagen',
  'shared.notifications.toast.available': 'Open Headers {version} verfügbar',
  'shared.notifications.toast.update': 'Aktualisieren…',
  'shared.notifications.toast.packageManager': 'Aktualisiere über deinen Linux-Paketmanager.',
  'shared.notifications.toast.releaseNotes': 'Versionshinweise',
  'shared.notifications.toast.readyToInstall': 'Open Headers {version} bereit zur Installation',
  'shared.notifications.toast.restartToInstall': 'Zum Installieren neu starten',
  'shared.notifications.toast.updatedTo': 'Auf Open Headers {version} aktualisiert',
  'shared.notifications.toast.seeWhatsNew': 'Neuigkeiten ansehen',

  // ── Security-floor entry banner ────────────────────────────────────
  'shared.notifications.securityBanner.messageWithVersion':
    'Open Headers {availableVersion} behebt ein Sicherheitsproblem, das die von dir verwendete Version ' +
    '({currentVersion}) betrifft. Aktualisiere so bald wie möglich.',
  'shared.notifications.securityBanner.messageNoVersion':
    'Für die von dir verwendete Version ({currentVersion}) ist eine Sicherheitskorrektur veröffentlicht. ' +
    'Aktualisiere so bald wie möglich.',
  'shared.notifications.securityBanner.update': 'Aktualisieren…',

  // ── Secrets-storage suggestion ─────────────────────────────────────
  'shared.notifications.secrets.title': 'Der Secrets-Speicher ist gesperrt',
  'shared.notifications.secrets.description':
    'Vault-Secrets und OAuth-Tokens können in dieser Sitzung weder gelesen noch gespeichert werden. {remedy}',
  'shared.notifications.secrets.relaunch': 'App neu starten',
  'shared.notifications.secrets.remedy.darwin':
    'Open Headers wurde der Zugriff auf den System-Schlüsselbund verweigert. Starte die App neu und erlaube den ' +
    'Schlüsselbund-Zugriff, wenn du gefragt wirst.',
  'shared.notifications.secrets.remedy.linux':
    'Kein nutzbares Schlüsselbund-Backend verfügbar. Richte eines ein (GNOME Keyring oder KWallet) und starte ' +
    'die App danach neu.',
  'shared.notifications.secrets.remedy.other':
    'Open Headers konnte nicht auf den Anmeldedaten-Speicher des Systems zugreifen. Starte die App neu, um es ' +
    'erneut zu versuchen.',
} as const satisfies Catalog;
