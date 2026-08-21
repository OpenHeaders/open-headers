/**
 * Workbench settings — shell chrome — German. Mirrors
 * `catalogs/en/workbench-settings.ts` key for key. Raw by design:
 * `MCP` / `Shell` as dev loanwords, the DevTools-panel tab names in
 * category labels (Network, Headers, Initiator, Cookies, Timing —
 * panel parity vocabulary), `MIME` / `Hash` / `LAN` / `Multipart` /
 * `Build` / `Opt-in`, lowercase `vault` (per-case token law), and
 * the {version} / {when} / {message} / {filename} / {sessionId} /
 * {installId} holes. `Daten` (Data category) matches the settings
 * path quoted by the system-status doc body (`Einstellungen → Daten
 * → …`). Backend rides as `Back-end` per the shared register mint;
 * Layout raw per the panel mint; tool windows use the apposition
 * style (Werkzeugfenster Terminal — panel-storage precedent);
 * Workbench = Arbeitsbereich-Editor (chrome mint); Stufe = tier and
 * Platz = seat reuse the daemon-admin mints. MINTS: setting
 * (countable) = die Einstellung (the surface stays Einstellungen);
 * reset = Zurücksetzen; DevTools panel = das DevTools-Panel; sort in
 * category prose = die Sortierung.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchSettings = {
  // ── Shell chrome ───────────────────────────────────────────────────
  'workbench.settings.shell.title': 'Einstellungen',
  'workbench.settings.shell.openInEditor': 'Im Editor öffnen',
  'workbench.settings.shell.openInEditorSoon': 'Im Editor öffnen (bald verfügbar)',
  'workbench.settings.shell.maximize': 'Maximieren',
  'workbench.settings.shell.restoreWindow': 'Wiederherstellen',
  'workbench.settings.shell.hint.search': 'Suchen',
  'workbench.settings.shell.hint.navigate': 'Navigieren',
  'workbench.settings.shell.hint.select': 'Auswählen',
  'workbench.settings.shell.hint.clearClose': 'Leeren / Schließen',
  'workbench.settings.shell.noneRegistered': 'Keine Einstellungen registriert.',
  'workbench.settings.shell.resetAll': 'Alle zurücksetzen',
  'workbench.settings.shell.resetAllCount': 'Alle zurücksetzen ({count})',
  'workbench.settings.shell.resetAllTitle': 'Alle Einstellungen zurücksetzen?',
  'workbench.settings.shell.resetAllNone':
    'Nichts zurückzusetzen — alle Einstellungen stehen auf ihren Standardwerten.',
  'workbench.settings.shell.resetAllDescription': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Einstellung auf ihren Standardwert zurücksetzen.',
      other: '{count} Einstellungen auf ihre Standardwerte zurücksetzen.',
    }),
  'workbench.settings.shell.resetConfirm': 'Zurücksetzen',
  'workbench.settings.shell.searchResults': 'Suchergebnisse',
  'workbench.settings.shell.matchesFor': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Treffer für', other: '{count} Treffer für' }),
  'workbench.settings.shell.noMatchesFor': 'Keine Einstellung passt zu',
  'workbench.settings.shell.jumpToCategory': 'Zur Kategorie springen',
  'workbench.settings.shell.navAria': 'Einstellungskategorien',
  'workbench.settings.shell.showCategoryNames': 'Kategorienamen anzeigen',
  'workbench.settings.shell.otherGroup': 'Sonstige',

  // ── Shared field-row chrome ────────────────────────────────────────
  'workbench.settings.row.modified': 'Vom Standard abweichend',
  'workbench.settings.row.modifiedAria': 'geändert',
  'workbench.settings.row.resetToDefault': 'Auf Standard zurücksetzen',
  'workbench.settings.row.experimental': 'Experimentell',
  'workbench.settings.row.desktopBadge': 'Desktop',
  'workbench.settings.row.desktopTip':
    'Erfordert eine aktive Verbindung zur Desktop-App von Open Headers. Die Desktop-App speichert den ' +
    'maßgeblichen Wert.',
  'workbench.settings.row.capabilityUnavailable': 'Dieser Browser unterstützt diese Einstellung nicht.',
  'workbench.settings.row.connectionRequired': 'Verbinde die Desktop-App, um diese Einstellung zu ändern.',
  'workbench.settings.row.aboutAria': 'Über {label}',
  'workbench.settings.row.disabledCapabilityAria': 'Deaktiviert — in diesem Browser nicht verfügbar',
  'workbench.settings.row.disabledConnectionAria': 'Deaktiviert — erfordert eine Desktop-Verbindung',
  'workbench.settings.row.managed': 'Von deiner Organisation verwaltet',
  'workbench.settings.row.managedBadge': 'Verwaltet',
  'workbench.settings.row.disabledManagedAria': 'Deaktiviert — von deiner Organisation verwaltet',
  'workbench.settings.row.run': 'Ausführen',

  // ── Categories ─────────────────────────────────────────────────────
  'workbench.settings.category.backend.label': 'Back-end',
  'workbench.settings.category.backend.description':
    'Wo deine Arbeitsbereiche, Regeln, dein vault und dein Verlauf leben. Wähle den Host, der zu deiner ' +
    'Reichweite passt — so oder so nur lokal.',
  'workbench.settings.category.backend.sub.connection': 'Verbindung',
  'workbench.settings.category.backend.sub.reliability': 'Zuverlässigkeit',
  'workbench.settings.category.backend.sub.notifications': 'Benachrichtigungen',
  'workbench.settings.category.backend.sub.lan-peers': 'LAN-Peers',
  'workbench.settings.category.mcp.label': 'KI · MCP-Server',
  'workbench.settings.category.mcp.description':
    'Lass KI-Agenten und andere MCP-Clients diese App lesen und steuern. Der Zugriff ist gestuft — Lesen, ' +
    'Schreiben, Ausführen und das Aufdecken von Secrets sind getrennte Schalter, alle standardmäßig aus.',
  'workbench.settings.category.general.label': 'Allgemein',
  'workbench.settings.category.general.description': 'App-weites Verhalten, Start und Locale.',
  'workbench.settings.category.appearance.label': 'Darstellung',
  'workbench.settings.category.appearance.description': 'Design, Dichte und visuelle Präsentation.',
  'workbench.settings.category.workspaceLayout.label': 'Arbeitsbereich-Layout',
  'workbench.settings.category.workspaceLayout.description':
    'Affordances der Fußzeile und Shell-Verhalten der Werkzeugfenster.',
  'workbench.settings.category.terminal.label': 'Terminal',
  'workbench.settings.category.terminal.description': 'Verhalten des integrierten Werkzeugfensters Terminal.',
  'workbench.settings.category.devpanel.label': 'DevTools-Panel',
  'workbench.settings.category.devpanel.description':
    'Standardwerte für das DevTools-Panel des Browsers — die Werkzeugfenster-Shell und jeder Tab der ' +
    'Anfragen-Oberfläche.',
  'workbench.settings.category.devpanelLayout.label': 'DevTools-Panel · Layout',
  'workbench.settings.category.devpanelLayout.navLabel': 'Layout',
  'workbench.settings.category.devpanelLayout.description':
    'Shell-Verhalten der Werkzeugfenster für das DevTools-Panel des Browsers.',
  'workbench.settings.category.devpanelNetwork.label': 'DevTools-Panel · Network',
  'workbench.settings.category.devpanelNetwork.navLabel': 'Network',
  'workbench.settings.category.devpanelNetwork.description':
    'Standardwerte für die Anfragen-Tabelle Network im DevTools-Panel — Layout, Sortierung, Punktspalte.',
  'workbench.settings.category.devpanelHeaders.label': 'DevTools-Panel · Headers',
  'workbench.settings.category.devpanelHeaders.navLabel': 'Headers',
  'workbench.settings.category.devpanelHeaders.description':
    'Standardwerte für den Tab Headers im DevTools-Panel — Layout, Sortierung, Filter, Vorschläge.',
  'workbench.settings.category.devpanelInitiator.label': 'DevTools-Panel · Initiator',
  'workbench.settings.category.devpanelInitiator.navLabel': 'Initiator',
  'workbench.settings.category.devpanelInitiator.description':
    'Standardwerte für den Tab Initiator im DevTools-Panel — Sortierung, Filter, Vorschläge.',
  'workbench.settings.category.devpanelCookies.label': 'DevTools-Panel · Cookies',
  'workbench.settings.category.devpanelCookies.navLabel': 'Cookies',
  'workbench.settings.category.devpanelCookies.description':
    'Standardwerte für den Tab Cookies im DevTools-Panel — Spalten, Sortierung, Filter, Vorschläge.',
  'workbench.settings.category.devpanelTiming.label': 'DevTools-Panel · Timing',
  'workbench.settings.category.devpanelTiming.navLabel': 'Timing',
  'workbench.settings.category.devpanelTiming.description':
    'Standardwerte für den Tab Timing im DevTools-Panel — welche Bänder sichtbar sind.',
  'workbench.settings.category.inspection.label': 'Debug-Modus',
  'workbench.settings.category.inspection.description':
    'Der Opt-in-Pfad, der das Debugging-Protokoll deines Browsers anbindet — untersuche und verändere ' +
    'Anfragen mit derselben Tiefe wie die eingebauten Entwicklerwerkzeuge.',
  'workbench.settings.category.trafficMonitor.label': 'Traffic',
  'workbench.settings.category.trafficMonitor.description':
    'Voreinstellungen der Geste „Beobachtung starten“ im Traffic-Panel und das Speicherbudget des ' +
    'Sitzungsarchivs.',
  'workbench.settings.category.editor.label': 'Code-Editor',
  'workbench.settings.category.editor.description':
    'Schrift, Einrückung und Ansichtsoptionen für Code-Bearbeitungsflächen.',
  'workbench.settings.category.requests.label': 'API-Anfragen',
  'workbench.settings.category.requests.description': 'Senden von HTTP-Anfragen und Verarbeitung der Antworten.',
  'workbench.settings.category.requests.sub.http': 'HTTP',
  'workbench.settings.category.requests.sub.sse': 'SSE',
  'workbench.settings.category.requests.sub.grpc': 'gRPC',
  'workbench.settings.category.requests.sub.websocket': 'WebSocket',
  'workbench.settings.category.rulesEngine.label': 'Regel-Engine',
  'workbench.settings.category.rulesEngine.description':
    'Wie Regeln ausgewertet, kompiliert und gegeneinander abgewogen werden.',
  'workbench.settings.category.keyboard.label': 'Tastatur',
  'workbench.settings.category.keyboard.description': 'Passe Tastenkürzel an.',
  'workbench.settings.category.keyboard.sub.global': 'Alle Oberflächen',
  'workbench.settings.category.keyboard.sub.workbench-general': 'Arbeitsbereich-Editor',
  'workbench.settings.category.keyboard.sub.workbench-layout': 'Arbeitsbereich-Editor · Layout',
  'workbench.settings.category.keyboard.sub.workbench-tabs': 'Arbeitsbereich-Editor · Tabs',
  'workbench.settings.category.keyboard.sub.workbench-focus': 'Arbeitsbereich-Editor · Fokus',
  'workbench.settings.category.keyboard.sub.workbench-editor': 'Arbeitsbereich-Editor · Editor',
  'workbench.settings.category.keyboard.sub.popup-general': 'Popup & Seitenpanel',
  'workbench.settings.category.keyboard.sub.popup-navigation': 'Popup & Seitenpanel · Navigation',
  'workbench.settings.category.keyboard.sub.popup-rows': 'Popup & Seitenpanel · Zeilenaktionen',
  'workbench.settings.category.keyboard.sub.popup-tabs': 'Popup & Seitenpanel · Tabs',
  'workbench.settings.category.workspaceSharing.label': 'Arbeitsbereich-Freigabe',
  'workbench.settings.category.workspaceSharing.description':
    'Anzeigeeinstellungen für die Import-Vorschau von Arbeitsbereich-Exporten.',
  'workbench.settings.category.git.label': 'Git',
  'workbench.settings.category.git.description':
    'Binde diesen Arbeitsbereich an einen Ordner auf der Festplatte — einen lebendigen, git-freundlichen ' +
    'YAML-Baum.',
  'workbench.settings.category.proxy.label': 'Proxy',
  'workbench.settings.category.proxy.description':
    'Der ausgehende Proxy dieses Geräts — wie Anfragen das Netzwerk erreichen — und die ' +
    'Vertrauenseinrichtung für den Erfassungs-Proxy.',
  'workbench.settings.category.proxyOutbound.label': 'Proxy · Ausgehende Anfragen',
  'workbench.settings.category.proxyOutbound.navLabel': 'Ausgehende Anfragen',
  'workbench.settings.category.proxyOutbound.description':
    'Der ausgehende Proxy dieses Geräts — wie Anfragen, WebSocket-Sitzungen und gRPC-Aufrufe das ' +
    'Netzwerk erreichen.',
  'workbench.settings.category.proxyTrust.label': 'Proxy · System',
  'workbench.settings.category.proxyTrust.navLabel': 'System-Proxy',
  'workbench.settings.category.proxyTrust.description':
    'Die Zertifizierungsstelle und Vertrauensspeicher, die das Entschlüsseln von HTTPS-Verkehr zur ' +
    'Inspektion erlauben — auf dieser Maschine erstellt, hier wieder entfernbar.',
  'workbench.settings.category.data.label': 'Daten',
  'workbench.settings.category.data.description': 'Diagnose, Import/Export und destruktive Wartung.',
  'workbench.settings.category.license.label': 'Lizenz',
  'workbench.settings.category.license.description':
    'Alles, was Open Headers heute bietet, ist in jeder Stufe enthalten — bezahlte Pläne decken Team-Plätze ' +
    'ab. Die kostenlose Stufe erlaubt bis zu 6 aktive Nutzer pro Server.',
  'workbench.settings.category.updates.label': 'Updates',
  'workbench.settings.category.updates.description': 'Update-Prüfungen, Kanal und Download-Verhalten.',
  'workbench.settings.category.about.label': 'Über',
  'workbench.settings.category.about.description': 'Version, Lizenzen und Build-Informationen.',

  // ── App-update row (updates.state custom editor) ───────────────────
  'workbench.settings.updatesRow.unsupported': 'In diesem Build übernimmt dein Installationskanal die Updates.',
  'workbench.settings.updatesRow.checking': 'Suche nach Updates…',
  'workbench.settings.updatesRow.securityFix':
    'Version {version} behebt ein Sicherheitsproblem, das diese Version betrifft.',
  'workbench.settings.updatesRow.available': 'Version {version} ist verfügbar.',
  'workbench.settings.updatesRow.packageManager': 'Installiere sie über deinen Linux-Paketmanager.',
  'workbench.settings.updatesRow.updateAndRestart': 'Aktualisieren und neu starten',
  'workbench.settings.updatesRow.downloading': 'Lade {version} herunter…',
  'workbench.settings.updatesRow.readyToInstall': 'Version {version} ist bereit zur Installation.',
  'workbench.settings.updatesRow.restartToInstall': 'Zum Installieren neu starten',
  'workbench.settings.updatesRow.checkFailed': 'Update-Prüfung fehlgeschlagen: {message}',
  'workbench.settings.updatesRow.retry': 'Wiederholen',
  'workbench.settings.updatesRow.upToDate': 'Du bist auf der neuesten Version ({version}).',
  'workbench.settings.updatesRow.checkNow': 'Jetzt prüfen',
  'workbench.settings.updatesRow.releaseNotes': 'Versionshinweise',
  'workbench.settings.updatesRow.lastChecked': 'Zuletzt geprüft {when}',

  // ── Terminal profiles row ──────────────────────────────────────────
  'workbench.settings.terminalProfiles.systemDefault': 'Standard-Shell des Systems',
  'workbench.settings.terminalProfiles.add': 'Profil hinzufügen',
  'workbench.settings.terminalProfiles.edit': 'Profil bearbeiten',
  'workbench.settings.terminalProfiles.remove': 'Profil entfernen',
  'workbench.settings.terminalProfiles.addTitle': 'Terminal-Profil hinzufügen',
  'workbench.settings.terminalProfiles.editTitle': 'Terminal-Profil bearbeiten',
  'workbench.settings.terminalProfiles.name': 'Name',
  'workbench.settings.terminalProfiles.shell': 'Shell-Pfad',
  'workbench.settings.terminalProfiles.args': 'Argumente',
  'workbench.settings.terminalProfiles.cwd': 'Startverzeichnis',
  'workbench.settings.terminalProfiles.cwdPlaceholder': 'Home-Verzeichnis',
  'workbench.settings.terminalProfiles.save': 'Speichern',

  // ── Settings field widgets ─────────────────────────────────────────
  'workbench.settings.fields.files.renameTooltip': 'Datei umbenennen',
  'workbench.settings.fields.files.renameMissing': 'Die Datei existiert in diesem Arbeitsbereich nicht mehr',
  'workbench.settings.fields.files.renameFailed': 'Datei konnte nicht umbenannt werden',
  'workbench.settings.fields.files.renameFailedReason': 'Datei konnte nicht umbenannt werden: {message}',
  'workbench.settings.fields.files.colFilename': 'Dateiname',
  'workbench.settings.fields.files.colSize': 'Größe',
  'workbench.settings.fields.files.colMime': 'MIME',
  'workbench.settings.fields.files.colHash': 'Hash',
  'workbench.settings.fields.files.colActions': 'Aktionen',
  'workbench.settings.fields.files.download': 'Herunterladen',
  'workbench.settings.fields.files.deleteTitle': '{filename} löschen?',
  'workbench.settings.fields.files.deleteWarning':
    'Multipart-Teile, die auf diese Datei verweisen, schlagen beim Senden fehl.',
  'workbench.settings.fields.files.loading': 'Dateien werden geladen…',
  'workbench.settings.fields.files.empty': 'Noch keine Dateien — nutze oben die Aktion Datei hochladen.',
  'workbench.settings.fields.keyValue.keyPlaceholder': 'Schlüssel',
  'workbench.settings.fields.keyValue.valuePlaceholder': 'Wert',
  'workbench.settings.fields.keyValue.addEntry': 'Eintrag hinzufügen',
  'workbench.settings.fields.keybinding.pressCombo': 'Drücke eine Tastenkombination…',
  'workbench.settings.fields.keybinding.record': 'Aufnehmen',
  'workbench.settings.fields.keybinding.cancel': 'Abbrechen',

  // ── Product-telemetry toggle row ───────────────────────────────────
  'workbench.settings.telemetryRow.viewEvents': 'Ereignisse ansehen',
  'workbench.settings.telemetryRow.modalTitle': 'Telemetrie-Ereignisse dieser Sitzung',
  'workbench.settings.telemetryRow.sessionOn': 'Sitzung {sessionId} — Zählung ist an',
  'workbench.settings.telemetryRow.sessionOff': 'Sitzung {sessionId} — Zählung ist aus',
  'workbench.settings.telemetryRow.install':
    'Installation {installId} (zufällig — identifiziert diese Installation, nicht dich)',
  'workbench.settings.telemetryRow.noInstall': 'Keine Installations-Kennung — Zählung ist aus',
  'workbench.settings.telemetryRow.empty': 'In dieser Sitzung wurden keine Telemetrie-Ereignisse aufgezeichnet.',
  'workbench.settings.telemetryRow.confirmTitle': 'Anonyme Nutzungszählung ausschalten?',
  'workbench.settings.telemetryRow.confirmHeading': 'Ihre Privatsphäre ist bereits geschützt',
  'workbench.settings.telemetryRow.confirmIntro':
    'Eine zufällige Kennung zählt diese Installation — niemals Sie. Es werden niemals persönliche Daten erhoben. Das leistet die Zählung:',
  'workbench.settings.telemetryRow.confirmPointFeatures': 'Zeigt, welche Funktionen weiterentwickelt werden sollten',
  'workbench.settings.telemetryRow.confirmPointScope': 'Zählt nur Funktionsnutzung, Plattform und App-Version',
  'workbench.settings.telemetryRow.confirmPointInspect':
    'Jedes Ereignis bleibt Byte für Byte unter „Ereignisse ansehen“ sichtbar',
  'workbench.settings.telemetryRow.confirmBadgePersonal': 'Keine persönlichen Daten',
  'workbench.settings.telemetryRow.confirmBadgeUrls': 'Keine URLs oder Header',
  'workbench.settings.telemetryRow.confirmBadgeContent': 'Keine Anfrageinhalte',
  'workbench.settings.telemetryRow.confirmKeep': 'Zählung eingeschaltet lassen',
  'workbench.settings.telemetryRow.confirmDisable': 'Trotzdem ausschalten',
} as const satisfies Catalog;
