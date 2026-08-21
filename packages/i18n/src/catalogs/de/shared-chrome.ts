/**
 * Shared chrome family — German. Mirrors `catalogs/en/shared-chrome.ts`
 * key for key; see that file for the family rules and the raw-by-design
 * plane (browser banner quoted verbatim, nav / worker / OOPIF,
 * xhr/fetch, boot.interactive). Mints: Debug mode = Debug-Modus (m.);
 * debug scope (reach referent, distinct from the variable-scope
 * Geltungsbereich) = Reichweite (f.); layout = Layout raw (n.); donor
 * = Spender (m.); Scratch = Skizze (f.); Draft = Entwurf (m.); cold
 * wake = kalter Aufwachvorgang.
 */

import type { Catalog } from '../../types';

export const sharedChrome = {
  // ── Debug mode pill + dormant notice ───────────────────────────────
  'shared.chrome.debug.title': 'Debug-Modus',
  'shared.chrome.debug.titleShort': 'Debug',
  'shared.chrome.debug.unavailableHint': 'Der Debug-Modus ist in Chrome und Edge verfügbar.',
  'shared.chrome.debug.toggleAria': 'Debug-Modus umschalten',
  'shared.chrome.debug.aboutTooltip': 'Über den Debug-Modus',
  'shared.chrome.debug.openDocsAria': 'Dokumentation zum Debug-Modus öffnen',
  'shared.chrome.debug.controlsAria': 'Steuerung des Debug-Modus',
  'shared.chrome.debug.turnOn': 'Debug-Modus einschalten',
  'shared.chrome.debug.turnOff': 'Debug-Modus ausschalten',
  'shared.chrome.debug.scopeDevtools': 'Wo DevTools geöffnet ist',
  'shared.chrome.debug.scopeActive': 'Der fokussierte Tab',
  'shared.chrome.debug.scopeBoth': 'Beide',
  'shared.chrome.debug.attachTo': 'Anhängen an',
  'shared.chrome.debug.includeThisTab': 'Diesen Browser-Tab einbeziehen',
  'shared.chrome.debug.pinThisTabAria': 'Diesen Browser-Tab anheften',
  'shared.chrome.debug.attachedTabs': 'Angehängte Tabs',
  'shared.chrome.debug.noTabsAttached': 'Noch keine Tabs angehängt',
  'shared.chrome.debug.bannerNote':
    'Solange der Debug-Modus eingeschaltet ist, zeigt der Browser das Banner „OH started debugging this ' +
    'browser“ auf jedem Tab an — nicht nur auf denen, an die er angehängt ist.',
  'shared.chrome.debug.tabNumber': 'Tab #{number}',
  'shared.chrome.debug.tabFallback': 'Tab {id}',
  'shared.chrome.debug.onThisTab': 'Du bist auf diesem Tab',
  'shared.chrome.debug.switchTo': 'Zu {target} wechseln',
  'shared.chrome.debug.dormantTooltip':
    'Der Debug-Modus ist eingeschaltet, aber dieser Tab liegt außerhalb seiner Reichweite — die nav- / worker- ' +
    '/ OOPIF-Effekte deiner Debug-Stufen-Regeln ruhen hier. Hole ihn über den Debug-Modus in die Reichweite ' +
    '(ändere die Reichweite oder hefte diesen Tab an). Über Seitenanfragen (xhr/fetch) laufen sie weiterhin.',
  'shared.chrome.debug.tabOutOfScope': 'Tab außerhalb der Reichweite',

  // ── System Status pill ─────────────────────────────────────────────
  'shared.chrome.status.title': 'System',
  'shared.chrome.status.aria': 'Systemstatus: {summary}',
  'shared.chrome.status.aboutTooltip': 'Über dieses Panel',
  'shared.chrome.status.openDocsAria': 'Dokumentation zum Systemstatus öffnen',
  'shared.chrome.status.healthy': 'Fehlerfrei',
  'shared.chrome.status.failure': 'Ausfall',
  'shared.chrome.status.issues': 'Probleme',
  'shared.chrome.status.noEvents': 'Noch keine Ereignisse',
  'shared.chrome.status.subsystemSync': 'Synchronisierung',
  'shared.chrome.status.subsystemRules': 'Regeln',
  'shared.chrome.status.subsystemRequests': 'Anfragen',
  'shared.chrome.status.subsystemPermissions': 'Berechtigungen',
  'shared.chrome.status.subsystemSecrets': 'Secrets',
  'shared.chrome.status.subsystemLive': 'Live',
  'shared.chrome.status.subsystemActivity': 'Aktivität',
  'shared.chrome.status.subsystemDebugMode': 'Debug-Modus',
  'shared.chrome.status.buildLine': 'Open Headers · {version}',
  'shared.chrome.status.versionBeta': '{version} (Beta)',
  'shared.chrome.status.buildNumber': 'Build {build}',

  // ── Status popover product extras ──────────────────────────────────
  'shared.chrome.status.relaunchApp': 'App neu starten',
  'shared.chrome.status.backendOff': 'Aus',
  'shared.chrome.status.backendConnecting': 'Verbindet…',
  'shared.chrome.status.companionDesktopApp': 'Desktop-App',
  'shared.chrome.status.companionExtensions': 'Erweiterungen',
  'shared.chrome.status.companionConnected': 'Verbunden',
  'shared.chrome.status.companionNotConnected': 'Nicht verbunden',
  'shared.chrome.status.companionInstalledNotConnected': 'Installiert · nicht verbunden',
  'shared.chrome.status.companionNotInstalled': 'Nicht installiert',
  'shared.chrome.status.companionDownload': 'Herunterladen',
  'shared.chrome.status.companionPeersConnected': '{count} verbunden',
  'shared.chrome.status.companionNoPeers': 'Keine verbunden',
  'shared.chrome.status.companionConnect': 'Verbinden',
  'shared.chrome.status.companionOpenApp': 'App öffnen',
  'shared.chrome.addons.title': 'Add-ons',
  'shared.chrome.addons.cli': 'CLI',
  'shared.chrome.addons.server': 'Server',
  'shared.chrome.addons.cliSetUp': 'Eingerichtet',
  'shared.chrome.addons.cliNotSetUp': 'Nicht eingerichtet',
  'shared.chrome.addons.cliStale': 'Token widerrufen — neu einrichten',
  'shared.chrome.addons.cliExternal': 'Externe Konfiguration',
  'shared.chrome.addons.cliMalformed': 'Konfiguration fehlerhaft',
  'shared.chrome.addons.cliProvision': 'Einrichten',
  'shared.chrome.addons.mcp': 'MCP',
  'shared.chrome.addons.mcpOn': 'An',
  'shared.chrome.addons.mcpTurnOn': 'Einschalten',
  'shared.chrome.addons.notConfigured': 'Nicht eingerichtet',
  'shared.chrome.addons.requiresDesktop': 'Erfordert die Desktop-App',
  'shared.chrome.addons.cliViaDesktop': 'Einrichtung über die Desktop-App',
  'shared.chrome.status.coldStart': 'Kaltstart',
  'shared.chrome.status.coldStartMessage': 'Performance-Regression erkannt — siehe Diagnose-Export',
  'shared.chrome.status.coldStartTooltip':
    'Drei aufeinanderfolgende kalte Aufwachvorgänge lagen ≥20 % über der Basislinie. Aktuelle ' +
    'boot.interactive-Messwerte (ms): {samples}.',

  // ── Update dialog ──────────────────────────────────────────────────
  'shared.chrome.updates.title': 'Open Headers Update',
  'shared.chrome.updates.downloading': 'Wird heruntergeladen…',
  'shared.chrome.updates.downloadingPercent': 'Wird heruntergeladen… {percent} %',
  'shared.chrome.updates.updateAndRestart': 'Aktualisieren und neu starten',
  'shared.chrome.updates.ignore': 'Dieses Update ignorieren',
  'shared.chrome.updates.remindLater': 'Später erinnern',
  'shared.chrome.updates.nowAvailableSuffix': 'ist jetzt verfügbar!',
  'shared.chrome.updates.moreDetailsPrefix': 'Mehr Details stehen in den',
  'shared.chrome.updates.releaseNotes': 'Versionshinweisen',
  'shared.chrome.updates.updatingTo': 'Aktualisierung von {from} auf {to}.',
  'shared.chrome.updates.configure': 'Updates konfigurieren…',

  // ── Settings gear menu ─────────────────────────────────────────────
  'shared.chrome.gearMenu.downloadVersion': '{version} herunterladen',
  'shared.chrome.gearMenu.versionAvailable': '{version} verfügbar…',
  'shared.chrome.gearMenu.updateAndRestartVersion': 'Auf {version} aktualisieren und neu starten',
  'shared.chrome.gearMenu.downloadingVersion': '{version} wird heruntergeladen…',
  'shared.chrome.gearMenu.restartToInstallVersion': 'Zum Installieren von {version} neu starten',
  'shared.chrome.gearMenu.settings': 'Einstellungen…',
  'shared.chrome.gearMenu.keyboardShortcuts': 'Tastenkürzel…',
  'shared.chrome.gearMenu.appearance': 'Erscheinungsbild…',
  'shared.chrome.gearMenu.about': 'Über Open Headers',
  'shared.chrome.gearMenu.tourGuide': 'Rundgang',
  'shared.chrome.gearMenu.signOut': 'Abmelden',
  'shared.chrome.gearMenu.searchPlaceholder': 'Suchen',
  'shared.chrome.gearMenu.noMatches': 'Keine Treffer',
  'shared.chrome.gearMenu.settingsTooltip': 'Einstellungen',
  'shared.chrome.gearMenu.settingsMenuAria': 'Einstellungsmenü',

  // ── Background tasks (Processes) ───────────────────────────────────
  'shared.chrome.tasks.processes': 'Prozesse',
  'shared.chrome.tasks.hidePanelAria': 'Prozess-Panel ausblenden',
  'shared.chrome.tasks.allCompleted': 'Alle Hintergrundaufgaben abgeschlossen',
  'shared.chrome.tasks.aboutNoteAria': 'Über diese Notiz',
  'shared.chrome.tasks.stop': 'Stoppen',
  'shared.chrome.tasks.keepRunning': 'Weiterlaufen lassen',
  'shared.chrome.tasks.stopTaskAria': 'Hintergrundaufgabe stoppen',
  'shared.chrome.tasks.hideTaskAria': 'Hintergrundaufgabe ausblenden',
  'shared.chrome.tasks.hideProcesses': 'Prozesse ausblenden',
  'shared.chrome.tasks.hideProcessesCount': 'Prozesse ausblenden ({count})',

  // ── Layout-donor pill ──────────────────────────────────────────────
  'shared.chrome.donor.defaultTooltip': 'Standard-{unit} — neue {units} erben das Layout von hier.',
  'shared.chrome.donor.nonDefaultTooltip': 'Ein anderes {unit} ist der Standard-Spender — neue {units} erben von dort.',
  'shared.chrome.donor.isDonorBody': 'Dieses {unit} ist der aktuelle Standard. Neue {units} erben dieses Layout.',
  'shared.chrome.donor.nonDonorBody':
    'Ein anderes {unit} ist der aktuelle Standard. Neue {units} erben das Layout dieses {unit}.',
  'shared.chrome.donor.reset': 'Layout auf Standard zurücksetzen',
  'shared.chrome.donor.defaultAria': 'Standard-{unit} für die Vererbung an neue {unit}',
  'shared.chrome.donor.nonDefaultAria': 'Nicht das Standard-{unit} für die Vererbung an neue {unit}',
  'shared.chrome.donor.defaultLabel': 'Standard-{unit}',
  'shared.chrome.donor.inheritsLabel': 'Erbt das Layout',

  // ── Lifecycle pill ─────────────────────────────────────────────────
  'shared.chrome.lifecycle.title': 'Lebenszyklus-Zustände',
  'shared.chrome.lifecycle.scratch': 'Skizze',
  'shared.chrome.lifecycle.scratchBody': 'Ungespeicherter Entwurf. Nichts wird gespeichert, bis du speicherst.',
  'shared.chrome.lifecycle.unresolved': 'Unaufgelöst',
  'shared.chrome.lifecycle.unresolvedBody':
    'Enthält {{ref}}s, die sich im aktiven Geltungsbereich nicht auflösen lassen.',
  'shared.chrome.lifecycle.draft': 'Entwurf',
  'shared.chrome.lifecycle.draftBody':
    'Gespeichert, aber noch nicht Live — Pflichtfelder fehlen, oder noch nicht veröffentlicht.',
  'shared.chrome.lifecycle.live': 'Live',
  'shared.chrome.lifecycle.liveBody': 'Veröffentlicht und aktiv.',
} as const satisfies Catalog;
