/**
 * Popup namespace — German. Mirrors `catalogs/en/popup.ts` key for
 * key; see that file for the namespace rules and English boundary.
 * Extends the de register contract (`de/shared.ts`). Mints: rule fire
 * = auslösen / Auslösung (f.); matched request = getroffene Anfrage
 * (Treffer family; rules greifen); shadowed evidence chip = verdeckt
 * (shadow detection = Verdeckungserkennung); fallback evidence chip =
 * indirekt; silent chip = stumm; delivery chips: live raw / Cache /
 * raw sw; expand = aufklappen / collapse = zuklappen; side panel =
 * Seitenpanel (shared-components precedent); tour = Tour (f.); Delay
 * = Verzögerung (shared-conflicts precedent); Query Param =
 * Query-Parameter; Add Rule = Regel hinzufügen; ground truth =
 * Ground Truth raw (f.); overflow menu = Überlaufmenü; exclude
 * chip prefix = Exkl.; header-op quotes copy the de mints
 * (Überschreiben); browser-menu mocks quote the browsers' own de UI
 * (Chrome Entwicklertools, Safari Einstellungen/Entwickler).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const popup = {
  // ── Header ─────────────────────────────────────────────────────────
  'popup.header.switchFailed': 'Ansicht konnte nicht gewechselt werden',
  'popup.header.switchToSidePanel': 'Zum Seitenpanel wechseln (bleibt beim Surfen geöffnet)',
  'popup.header.switchToPopup': 'Zum Popup-Modus wechseln (Klick in der Symbolleiste)',
  'popup.header.rulesResumed': 'Regelausführung fortgesetzt',
  'popup.header.rulesPaused': 'Regelausführung pausiert',
  'popup.header.rulesLabel': 'Regeln',
  'popup.header.resumeRules': 'Regelausführung fortsetzen',
  'popup.header.pauseRules': 'Alle Regeln pausieren (die Einstellungen einzelner Regeln bleiben erhalten)',
  'popup.header.openSettings': 'Einstellungen öffnen',
  'popup.header.notifications': 'Benachrichtigungen',
  'popup.header.openNotifications': 'Benachrichtigungen öffnen',
  'popup.header.activeWorkspace': 'Aktiver Arbeitsbereich: {name}',

  // ── Shared status vocabulary ───────────────────────────────────────
  'popup.status.active': 'Aktiv',
  'popup.status.paused': 'Pausiert',

  // ── Footer ─────────────────────────────────────────────────────────
  'popup.footer.debugTooltip': 'So erreichst du unsere aufgeladenen Browser-DevTools.',
  'popup.footer.networkDebug': 'Netzwerk-Debugging.',
  'popup.footer.tagline': 'Wie es sein sollte',
  'popup.footer.keyboardShortcuts': 'Tastenkürzel',
  'popup.footer.systemStatus': 'System',

  // ── Desktop watch privacy indicator ────────────────────────────────
  'popup.desktopWatch.label': 'Desktop sieht zu',
  'popup.desktopWatch.tooltip':
    'Die Open-Headers-Desktop-App betrachtet diesen Browser gerade in ihrem Traffic Monitor. Klicke, um die ' +
    'Einstellungen zu öffnen — „Desktop-App darf diesen Browser einsehen“ ist der Aus-Schalter.',
  'popup.desktopWatch.aria': 'Die Desktop-App betrachtet diesen Browser — Einstellungen öffnen',

  // ── Tabs ───────────────────────────────────────────────────────────
  'popup.tabs.thisPage': 'Diese Seite',
  'popup.tabs.allRules': 'Alle Regeln',
  'popup.tabs.collections': 'Sammlungen',
  'popup.tabs.openWorkspaceEditor': 'Vollständigen Arbeitsbereich-Editor öffnen',
  'popup.tabs.workspace': 'Arbeitsbereich',

  // ── Delete confirmation overlay ────────────────────────────────────
  'popup.deleteConfirm.title': '„{name}“ löschen?',
  'popup.deleteConfirm.confirm': 'bestätigen',
  'popup.deleteConfirm.cancel': 'abbrechen',

  // ── Table toolbars (shared across the three tabs) ──────────────────
  'popup.table.searchPlaceholder': 'Alles durchsuchen...',
  'popup.table.sortOrder': 'Sortierreihenfolge',
  'popup.table.sortOrderHeading': 'SORTIERREIHENFOLGE',
  'popup.table.sortByStatus': 'Nach Status',
  'popup.table.sortByPriority': 'Nach Priorität',
  'popup.table.sortByColumn': 'Nach Spalte',
  'popup.table.sortWorkspaceOrder': 'Arbeitsbereich-Reihenfolge',
  'popup.table.sortWorkspaceOrderHint': 'Folgt der Baumreihenfolge der Arbeitsbereich-Seitenleiste',
  'popup.table.sortByColumnHint': 'Sortiert nach {column} — klicke oben auf eine Option zum Zurücksetzen',
  'popup.table.sortByPriorityHint':
    'Blockieren → Umleiten → Query-Parameter → Header → Injizieren · A-Z innerhalb jedes Typs',
  'popup.table.sortByStatusHintAll': 'Aktiv → Pausiert → Deaktiviert → Entwurf · Priorität innerhalb jeder Gruppe',
  'popup.table.sortByStatusHintThisPage': 'Aktiv → Pausiert → Deaktiviert · Priorität innerhalb jeder Gruppe',
  'popup.table.sortByStatusHintCollections': 'Aktiv → Pausiert · A-Z innerhalb jeder Gruppe',
  'popup.table.columnName': 'Name',
  'popup.table.columnDetails': 'Details',
  'popup.table.columnConditions': 'Bedingungen',

  // ── Rule mutations ─────────────────────────────────────────────────
  'popup.rule.toggleFailed': 'Regel konnte nicht umgeschaltet werden',
  'popup.rule.deleted': 'Regel gelöscht',
  'popup.rule.deleteFailed': 'Regel konnte nicht gelöscht werden',
  'popup.rule.edit': 'Regel bearbeiten',
  'popup.rule.delete': 'Regel löschen',
  'popup.rule.deleteOk': 'Löschen',
  'popup.rule.notConnected': 'App nicht verbunden',
  'popup.rule.desktopTag': 'Desktop',
  'popup.rule.comingSoon': 'bald verfügbar',

  // ── All Rules tab ──────────────────────────────────────────────────
  'popup.rules.title': 'Regeln',
  'popup.rules.activeSummary': '{active} von {total} aktiv',
  'popup.rules.draftSuffix': ', {count} im Entwurf',
  'popup.rules.pausedByCollection': '{count} durch Sammlung pausiert',
  'popup.rules.addRule': 'Regel hinzufügen',
  'popup.rules.addRuleTooltip': 'Eine Regel hinzufügen — durchsuche Typen und Vorlagen',
  'popup.rules.matchedCount': ({ matched, total }, locale) =>
    `${matched} von ${plural(locale, Number(total), { one: '{count} Regel', other: '{count} Regeln' })} greifen`,
  'popup.rules.emptyNoMatch': 'Keine passenden Regeln gefunden',
  'popup.rules.emptyNone': 'Noch keine Regeln',
  'popup.rules.emptyHint': 'Klicke auf „Regel hinzufügen“, um Browser-Anfragen live zu verändern',

  // ── Collections tab ────────────────────────────────────────────────
  'popup.collections.title': 'Sammlungen',
  'popup.collections.summary': ({ collections, rules }, locale) =>
    `${plural(locale, Number(collections), { one: '{count} Sammlung', other: '{count} Sammlungen' })}, ${plural(
      locale,
      Number(rules),
      { one: '{count} Regel', other: '{count} Regeln' },
    )}`,
  'popup.collections.matchedCount': ({ matched, total }, locale) =>
    `${matched} von ${plural(locale, Number(total), { one: '{count} Sammlung', other: '{count} Sammlungen' })} passen`,
  'popup.collections.emptyNoMatch': 'Keine passenden Sammlungen gefunden',
  'popup.collections.emptyNone': 'Keine Sammlungen',
  'popup.collections.emptyHint': 'Lege Regeln im Arbeitsbereich-Editor an, um sie in Sammlungen zu organisieren',
  'popup.collections.enabledSummary': ({ enabled, total }, locale) =>
    `${enabled} von ${plural(locale, Number(total), { one: '{count} Regel', other: '{count} Regeln' })} aktiviert`,
  'popup.collections.pausedEnabledSummary': 'Pausiert · {enabled} von {total} aktiviert',
  'popup.collections.resumeTooltip':
    'Fortsetzen — hält {count} Regeln aktiv (übergeht bei Bedarf die übergeordnete Gruppe)',
  'popup.collections.pauseTooltip':
    'Pausieren — setzt {count} Regeln aus, ohne ihre individuellen Einstellungen zu ändern',

  // ── Condition vocabulary (rule condition field labels) ─────────────
  'popup.conditions.allDomains': 'Alle Domains',
  'popup.conditions.none': 'Keine Bedingungen',
  'popup.conditions.short.urlFilter': 'URL',
  'popup.conditions.short.urlRegex': 'Regex',
  'popup.conditions.short.requestDomains': 'Domain',
  'popup.conditions.short.excludeRequestDomains': 'Exkl. Domain',
  'popup.conditions.short.initiatorDomains': 'Von',
  'popup.conditions.short.excludeInitiatorDomains': 'Exkl. Von',
  'popup.conditions.short.requestMethods': 'Methode',
  'popup.conditions.short.excludeRequestMethods': 'Exkl. Methode',
  'popup.conditions.short.resourceTypes': 'Ressource',
  'popup.conditions.short.excludeResourceTypes': 'Exkl. Ressource',
  'popup.conditions.short.domainType': 'Domain-Typ',
  'popup.conditions.short.responseHeader': 'Antw.-Header',
  'popup.conditions.short.excludeResponseHeader': 'Exkl. Antw.-Header',
  'popup.conditions.full.urlFilter': 'URL-Muster',
  'popup.conditions.full.urlRegex': 'URL-Regex',
  'popup.conditions.full.requestDomains': 'Domains',
  'popup.conditions.full.excludeRequestDomains': 'Exkl. Domains',
  'popup.conditions.full.initiatorDomains': 'Initiator',
  'popup.conditions.full.excludeInitiatorDomains': 'Exkl. Initiator',
  'popup.conditions.full.requestMethods': 'Methoden',
  'popup.conditions.full.excludeRequestMethods': 'Exkl. Methoden',
  'popup.conditions.full.resourceTypes': 'Ressourcen',
  'popup.conditions.full.excludeResourceTypes': 'Exkl. Ressourcen',
  'popup.conditions.full.domainType': 'Domain-Typ',
  'popup.conditions.full.responseHeader': 'Antwort-Header',
  'popup.conditions.full.excludeResponseHeader': 'Exkl. Antwort-Header',

  // ── Action-detail vocabulary (tooltip grid row labels) ─────────────
  'popup.actionDetail.name': 'Name',
  'popup.actionDetail.url': 'URL',
  'popup.actionDetail.count': 'Anzahl',
  'popup.actionDetail.type': 'Typ',
  'popup.actionDetail.duration': 'Dauer',
  'popup.actionDetail.format': 'Format',
  'popup.actionDetail.status': 'Status',
  'popup.actionDetail.value': 'Wert',
  'popup.actionDetail.position': 'Position',
  'popup.actionDetail.body': 'Body',
  'popup.actionDetail.contentType': 'Content-Type',
  'popup.actionDetail.label': 'Bezeichnung',
  'popup.actionDetail.headers': 'Header',
  'popup.actionDetail.params': 'Parameter',

  // ── This Page tab ──────────────────────────────────────────────────
  'popup.thisPage.loading': 'Informationen zum aktuellen Tab werden geladen...',
  'popup.thisPage.noTab': 'Informationen zum aktuellen Tab konnten nicht abgerufen werden',
  'popup.thisPage.columnMatch': 'Treffer',
  'popup.thisPage.expandHeaderBadgeHint': 'Klicke auf das Badge einer Zeile, um die getroffenen Anfragen zu sehen',
  'popup.thisPage.expandHeaderDocsHint': 'Klicke auf das Symbol darunter, um die Dokumentation zu sehen',
  'popup.thisPage.badgeSearchMatch': ({ matched, total, query }, locale) =>
    `${matched} von ${plural(locale, Number(total), { one: '{count} Anfrage', other: '{count} Anfragen' })} passen zu „${query}“ — zum Aufklappen klicken`,
  'popup.thisPage.badgeNone': 'Noch keine getroffenen Anfragen — zum Aufklappen klicken',
  'popup.thisPage.badgeAllSilent': ({ count }, locale) =>
    `${plural(locale, Number(count), { one: '{count} getroffene Anfrage', other: '{count} getroffene Anfragen' })}, alle aus dem Cache bedient (stumm) — zum Aufklappen klicken`,
  'popup.thisPage.badgeMixed': ({ fired, silent }, locale) =>
    `${plural(locale, Number(fired), { one: '{count} getroffene Anfrage ausgelöst', other: '{count} getroffene Anfragen ausgelöst' })} + ${silent} stumm (Cache) — zum Aufklappen klicken`,
  'popup.thisPage.badgeMatched': ({ count }, locale) =>
    `${plural(locale, Number(count), { one: '{count} getroffene Anfrage', other: '{count} getroffene Anfragen' })} — zum Aufklappen klicken`,
  'popup.thisPage.systemPage': 'Systemseite',
  'popup.thisPage.systemPageHint': 'Header-Regeln gelten nicht für Systemseiten des Browsers',
  'popup.thisPage.emptyNoRules': 'Keine Regel greift auf dieser Seite',
  'popup.thisPage.emptyNoRulesHint': 'Für diese Domain sind keine Regeln konfiguriert',
  'popup.thisPage.ruleDisabled': 'Regel ist deaktiviert',
  'popup.thisPage.rulePausedByGroup': 'Regel ist durch ihre Sammlung oder ihren Ordner pausiert',
  'popup.thisPage.zeroRelated':
    'Die Regel zielt auf eine verwandte Domain — Anfragen an diese Domain wurden noch nicht beobachtet. Sie löst aus, sobald die Seite eine stellt.',
  'popup.thisPage.zeroPage':
    'Das Muster passt auf diese Seite, aber es wurden noch keine passenden Anfragen beobachtet. Interagiere mit der Seite oder lade sie neu, um sie auszulösen.',
  'popup.thisPage.shadowAllPrefix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Die {count} getroffene Anfrage',
      other: 'Alle {count} getroffenen Anfragen',
    }),
  'popup.thisPage.shadowSomePrefix': '{shadowed} von {total} getroffenen Anfragen',
  'popup.thisPage.shadowTooltip':
    '{prefix} werden von „{name}“ beendet (Blockier-Regel mit höherer Priorität) — diese Regel hat auf sie also keine sichtbare Wirkung. Experimentell: Die Verdeckungserkennung kann über- oder untererfassen. Zum Ausblenden in den Einstellungen deaktivieren.',
  'popup.thisPage.evidenceConfirmed': ({ count }, locale) =>
    `Das Skript hat auf dieser Seite ${plural(locale, Number(count), { one: '{count} Auslösung', other: '{count} Auslösungen' })} bestätigt (Ground Truth aus der In-Page-Injektion).`,
  'popup.thisPage.evidenceFallback': ({ count }, locale) =>
    `${plural(locale, Number(count), { one: '{count} Anfrage', other: '{count} Anfragen' })} per URL getroffen, aber der In-Page-Skript-Reporter hat es nicht bestätigt. Häufige Ursachen: eine strikte Content-Security-Policy blockiert die Injektion, oder der Ressourcentyp (Stylesheet, Bild, Manifest-Link) umgeht die fetch/XHR-Interception.`,
  'popup.thisPage.evidenceSilent': ({ count }, locale) =>
    `Das Muster traf ${plural(locale, Number(count), { one: '{count} gecachte Subressource', other: '{count} gecachte Subressourcen' })} — die Aktion konnte nicht laufen, weil die Antwort das Netzwerk umgangen hat. Lade unter Umgehung des Caches neu, um eine frische Anfrage zu erzwingen.`,
  'popup.thisPage.evidenceMatched': ({ count }, locale) =>
    `${plural(locale, Number(count), { one: '{count} Anfrage', other: '{count} Anfragen' })} auf dieser Seite getroffen. Das declarativeNetRequest von Chrome meldet nicht, welche Regel gewinnt, wenn mehrere greifen — wir beobachten URL-Treffer, keine Arbitrierungsergebnisse.`,
  'popup.thisPage.pausedTagTooltip': 'Sammlung oder Ordner ist pausiert — Regel wird nicht angewendet',
  'popup.thisPage.rulesPausedByCollection': ({ count }, locale) =>
    `${plural(locale, Number(count), { one: '{count} Regel', other: '{count} Regeln' })} durch Sammlung pausiert`,
  'popup.thisPage.firing': '{count} ausgelöst',
  'popup.thisPage.silentCached': '{count} stumm (Cache)',
  'popup.thisPage.related': '{count} verwandt',
  'popup.thisPage.liveMonitoring': 'Live — Anfragen werden beobachtet',
  'popup.thisPage.visibleResourceTypes': 'SICHTBARE RESSOURCENTYPEN',
  'popup.thisPage.showAll': 'Alle anzeigen',
  'popup.thisPage.filterResourceTypes': 'Ressourcentypen filtern',
  'popup.thisPage.filterResourceTypesCount': 'Ressourcentypen filtern ({shown} von {total} sichtbar)',
  'popup.thisPage.requestCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Anfrage', other: '{count} Anfragen' }),
  'popup.thisPage.requestCountAllSilent': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} stumme Anfrage (Cache)',
      other: '{count} stumme Anfragen (Cache)',
    }),
  'popup.thisPage.requestCountSomeSilent': ({ count, silent }, locale) =>
    `${plural(locale, Number(count), { one: '{count} Anfrage', other: '{count} Anfragen' })} (${silent} stumm)`,
  'popup.thisPage.rulesOfTotal': ({ matched, total }, locale) =>
    `${matched} von ${plural(locale, Number(total), { one: '{count} Regel', other: '{count} Regeln' })}`,
  'popup.thisPage.requestsOfTotal': ({ matched, total }, locale) =>
    `${matched} von ${plural(locale, Number(total), { one: '{count} Anfrage', other: '{count} Anfragen' })}`,
  'popup.thisPage.matchedJoin': '{parts} getroffen',
  'popup.thisPage.copyTsv': 'Anfragen als TSV kopieren',

  // ── Matched-requests sub-table ─────────────────────────────────────
  'popup.matched.columnTime': 'Zeit',
  'popup.matched.columnUrl': 'Anfrage-URL',
  'popup.matched.columnType': 'Typ',
  'popup.matched.columnDelivery': 'Auslieferung',
  'popup.matched.columnEvidence': 'Nachweis',
  'popup.matched.columnPattern': 'Muster',
  'popup.matched.matchedBy': 'getroffen von',
  'popup.matched.deliveryLive': 'live',
  'popup.matched.deliveryCached': 'Cache',
  'popup.matched.deliverySw': 'sw',
  'popup.matched.deliveryLiveTip':
    'Die Anfrage ging in dieser Sitzung ins Netzwerk; die Antwort kam nicht aus dem Cache.',
  'popup.matched.deliveryCachedTip':
    'Die Antwort kam aus dem HTTP-Cache von Chrome. Deine Regel griff, als diese Antwort ursprünglich geladen wurde oder beim Revalidierungs-Round-Trip.',
  'popup.matched.deliverySwTip':
    'Ein Service Worker hat die Anfrage abgefangen. Ob deine Regel griff, hängt davon ab, was der Service Worker danach getan hat.',
  'popup.matched.evidenceShadowed': 'verdeckt',
  'popup.matched.evidenceShadowedTip':
    'Diese Anfrage wurde von „{name}“ beendet (Blockier-Regel, höhere Priorität). Diese Regel lief nie auf ihr.',
  'popup.matched.evidenceConfirmed': 'bestätigt',
  'popup.matched.evidenceConfirmedTip':
    'Das Skript hat diese Auslösung aus der In-Page-Injektion bestätigt — Ground Truth, dass die Regel lief.',
  'popup.matched.evidenceFallback': 'indirekt',
  'popup.matched.evidenceFallbackTip':
    'Per URL getroffen, aber der In-Page-Skript-Reporter hat es nicht bestätigt. Häufige Ursachen: eine strikte Content-Security-Policy blockiert die MAIN-world-Injektion, oder ein Ressourcentyp (Stylesheet, Bild, Manifest-Link) umgeht die fetch/XHR-Interception.',
  'popup.matched.evidenceSilent': 'stumm',
  'popup.matched.evidenceSilentTip':
    'Das Muster traf diese Subressource, aber die Antwort kam aus dem Cache / einem Service Worker / dem bfcache, sodass die Aktion der Regel nicht laufen konnte. Lade unter Umgehung des Caches neu, um eine frische Anfrage zu erzwingen.',
  'popup.matched.evidenceMatched': 'getroffen',
  'popup.matched.evidenceMatchedTip':
    'Die URL traf die Bedingungen dieser Regel. Das declarativeNetRequest von Chrome meldet nicht, welche Regel die Arbitrierung gewinnt — wir beobachten URL-Treffer, nicht die Ausführung.',
  'popup.matched.searchSummary': ({ matched, total, query }, locale) =>
    `${matched} von ${plural(locale, Number(total), { one: '{count} Anfrage', other: '{count} Anfragen' })} zu „${query}“`,
  'popup.matched.countSummary': ({ count }, locale) =>
    `${plural(locale, Number(count), { one: '{count} Anfrage', other: '{count} Anfragen' })} getroffen`,
  'popup.matched.emptySearch':
    'Keine getroffene Anfrage enthält „{query}“. Leere oder erweitere die Suche, um alle Treffer zu sehen.',
  'popup.matched.emptyRelated':
    'Die Regel zielt auf eine verwandte Domain — Treffer erscheinen, sobald die Seite Anfragen an diese Domain stellt.',
  'popup.matched.emptyPage':
    'Das Muster passt auf diese Seite. Treffer erscheinen, sobald die Seite Anfragen stellt, die dem Muster entsprechen — interagiere mit der Seite oder lade sie neu, um sie auszulösen.',
  'popup.matched.emptyNone': 'Noch keine getroffenen Anfragen — lade die Seite neu, um sie zu erfassen.',

  // ── Rule-type vocabulary ───────────────────────────────────────────
  'popup.ruleType.header': 'Header',
  'popup.ruleType.block': 'Blockieren',
  'popup.ruleType.redirect': 'Umleiten',
  'popup.ruleType.queryParam': 'Query-Parameter',
  'popup.ruleType.inject': 'Injizieren',
  'popup.ruleType.requestBody': 'API-Anfrage',
  'popup.ruleType.delay': 'Verzögerung',
  'popup.ruleType.response': 'API-Antwort',
  'popup.ruleType.headerDesc': 'HTTP-Header verändern',
  'popup.ruleType.blockDesc': 'Anfragen blockieren',
  'popup.ruleType.redirectDesc': 'Anfragen umleiten',
  'popup.ruleType.queryParamDesc': 'Query-Parameter verändern',
  'popup.ruleType.injectDesc': 'Skripte oder CSS injizieren',
  'popup.ruleType.requestBodyDesc': 'Body von API-Anfragen verändern (fetch/XHR)',
  'popup.ruleType.delayDesc': 'Antwort verzögern',
  'popup.ruleType.responseDesc': 'API-Antwort simulieren oder verändern (fetch/XHR)',

  // ── Resource-type explanations (labels stay English — parity vocab) ─
  'popup.resourceType.mainFrameTip': 'Trifft direkt die URL der Seite',
  'popup.resourceType.subFrameTip': 'Gilt für ein iframe, das diese Seite lädt',
  'popup.resourceType.xhrTip': 'Gilt für fetch()- und XMLHttpRequest-Aufrufe',
  'popup.resourceType.scriptTip': 'Gilt für Skript-Ressourcen',
  'popup.resourceType.stylesheetTip': 'Gilt für Stylesheets',
  'popup.resourceType.imageTip': 'Gilt für Bilder',
  'popup.resourceType.fontTip': 'Gilt für Schriftdateien',
  'popup.resourceType.mediaTip': 'Gilt für Audio-/Video-Ressourcen',
  'popup.resourceType.websocketTip': 'Gilt für WebSocket-Verbindungen',
  'popup.resourceType.pingTip': 'Gilt für Ping-/Beacon-Anfragen',
  'popup.resourceType.otherTip': 'Gilt für sonstige Ressourcen',

  // ── Add Rule palette ───────────────────────────────────────────────
  'popup.palette.blankRule': 'Leere Regel',
  'popup.palette.searchPlaceholder': 'Regeltypen und Vorlagen durchsuchen…',
  'popup.palette.noMatches': 'Keine Treffer für „{query}“',

  // ── Keyboard shortcuts overlay + registry descriptions ─────────────
  'popup.shortcuts.title': 'Tastenkürzel',
  'popup.shortcuts.press': 'drücke',
  'popup.shortcuts.or': 'oder',
  'popup.shortcuts.toClose': 'zum Schließen',
  'popup.shortcuts.groupNavigation': 'Navigation',
  'popup.shortcuts.groupActions': 'Aktionen',
  'popup.shortcuts.groupRow': 'Tabellenzeilen',
  'popup.shortcuts.groupBrowser': 'Browser',
  'popup.shortcuts.groupTour': 'Tour',
  'popup.shortcuts.openExtension': 'Erweiterung öffnen',
  'popup.shortcuts.customize': 'Kürzel der Erweiterung anpassen ↗',
  'popup.shortcuts.toggleDebugMode': 'Debug-Modus umschalten',
  'popup.shortcuts.tabThisPage': 'Tab „Diese Seite“',
  'popup.shortcuts.tabAllRules': 'Tab „Alle Regeln“',
  'popup.shortcuts.tabCollections': 'Tab „Sammlungen“',
  'popup.shortcuts.focusSearch': 'Suche fokussieren',
  'popup.shortcuts.prevPage': 'Vorherige Seite',
  'popup.shortcuts.nextPage': 'Nächste Seite',
  'popup.shortcuts.addRule': 'Neue Regel hinzufügen',
  'popup.shortcuts.openWorkspace': 'Arbeitsbereich öffnen',
  'popup.shortcuts.openSettings': 'Einstellungen öffnen',
  'popup.shortcuts.toggleSurface': 'Popup / Seitenpanel umschalten',
  'popup.shortcuts.toggleRulesPause': 'Alle Regeln pausieren / fortsetzen',
  'popup.shortcuts.togglePauseFocused': 'Sammlung oder Ordner pausieren / fortsetzen',
  'popup.shortcuts.toggleOptionsMenu': 'Optionsmenü',
  'popup.shortcuts.cycleTheme': 'Design durchschalten',
  'popup.shortcuts.toggleCompactMode': 'Kompaktmodus',
  'popup.shortcuts.toggleShortcutsHelp': 'Dieses Panel',
  'popup.shortcuts.moveDown': 'Nach unten',
  'popup.shortcuts.moveUp': 'Nach oben',
  'popup.shortcuts.expandRow': 'Aufklappen / in Unterzeilen wechseln',
  'popup.shortcuts.collapseRow': 'Zuklappen / Unterzeilen verlassen',
  'popup.shortcuts.toggleRow': 'Ein- / ausschalten',
  'popup.shortcuts.editRow': 'Regel bearbeiten',
  'popup.shortcuts.copyValue': 'Wert kopieren',
  'popup.shortcuts.deleteRow': 'Löschen (zweimal drücken)',
  'popup.shortcuts.openTourGuide': 'Tour öffnen',

  // ── Onboarding tour ────────────────────────────────────────────────
  'popup.tour.stepIndicator': 'Schritt {current} von {total}',
  'popup.tour.previous': 'Zurück',
  'popup.tour.next': 'Weiter',
  'popup.tour.finish': 'Fertig',
  'popup.tour.welcomeTitle': 'Willkommen bei Open Headers',
  'popup.tour.welcomeSubtitle': 'HTTP-Verkehr in Echtzeit abfangen und verändern.',
  'popup.tour.modify': 'Verändern',
  'popup.tour.modifyDesc': 'Header, Cookies, Auth-Tokens, CORS, Payloads',
  'popup.tour.route': 'Umleiten',
  'popup.tour.routeDesc': 'Anfragen umleiten, Tracker blockieren, URLs umschreiben',
  'popup.tour.debug': 'Debuggen',
  'popup.tour.debugDesc': 'Live-Anfragen inspizieren, Skripte injizieren, Antworten überschreiben',
  'popup.tour.migrateSwitching': 'Du kommst von',
  'popup.tour.migrateOr': 'oder',
  'popup.tour.migrateButton': 'Von einem anderen Tool migrieren',
  'popup.tour.tabsTitle': 'Zwischen Tabs wechseln',
  'popup.tour.tabsSubtitle': 'Drücke eine Zifferntaste für den sofortigen Wechsel.',
  'popup.tour.thisPageHint': '— Regeln, die auf den aktuellen Tab passen',
  'popup.tour.allRulesHint': '— jede Regel, die du angelegt hast',
  'popup.tour.tagsLabel': 'Tags',
  'popup.tour.tagsHint': '— Gruppen organisieren und pausieren',
  'popup.tour.workspaceTitle': 'Dein Arbeitsbereich',
  'popup.tour.workspaceSubtitle': 'Der vollständige Editor — öffnet sich in einem eigenen Tab.',
  'popup.tour.workspaceRequests': 'API-Client',
  'popup.tour.workspaceRequestsHint': '— API-Anfragen erstellen, senden und speichern',
  'popup.tour.workspaceWorkflows': 'Workflows',
  'popup.tour.workspaceWorkflowsHint': '— Anfragen zu automatisierten Läufen verketten',
  'popup.tour.workspaceEnvs': 'Umgebungen und Variablen',
  'popup.tour.workspaceEnvsHint': '— plus Importe, Regeln und Team-Sync',
  'popup.tour.navTitle': 'Regeln durchsuchen und navigieren',
  'popup.tour.navSubtitle': 'Navigiere mit Tastenkürzeln durch die Zeilen',
  'popup.tour.keyMove': 'Bewegen',
  'popup.tour.keyExpand': 'Aufklappen',
  'popup.tour.keyToggle': 'Umschalten',
  'popup.tour.keyEdit': 'Bearbeiten',
  'popup.tour.keyCopy': 'Kopieren',
  'popup.tour.keyDelete': 'Löschen',
  'popup.tour.devtoolsTitle': 'Netzwerk in den DevTools debuggen',
  'popup.tour.findThePrefix': 'Finde den Tab',
  'popup.tour.findTheSuffix': 'in den DevTools:',
  'popup.tour.devtoolsHint': 'Klicke jederzeit auf diesen Button für die Einrichtung.',
  'popup.tour.shortcutsTitle': 'Alle Tastenkürzel',
  'popup.tour.shortcutsSubtitle': 'Das Popup ist vollständig per Tastatur bedienbar.',
  'popup.tour.pressLabel': 'Drücke',
  'popup.tour.shortcutsHint': 'jederzeit, um jedes Kürzel zu sehen',
  'popup.tour.debugModeTitle': 'Debug-Modus',
  'popup.tour.debugModeSubtitle': 'Volle Kontrolle über den Live-Browserverkehr.',
  'popup.tour.debugModeReqRes': 'Anfragen und Antworten',
  'popup.tour.debugModeReqResHint': '— Header, Bodys und Statuscodes live umschreiben',
  'popup.tour.debugModeStreams': 'WebSockets und SSE',
  'popup.tour.debugModeStreamsHint': '— gestreamte Nachrichten inspizieren und bearbeiten',
  'popup.tour.debugModeScripts': 'Skripte und Speicher',
  'popup.tour.debugModeScriptsHint': '— Skripte injizieren, Cookies und Speicher inspizieren',
  'popup.tour.statusTitle': 'Systemstatus',
  'popup.tour.statusSubtitle':
    'Klicke auf den Punkt für eine Zustandsübersicht über Sync, Regeln, Anfragen, Berechtigungen, Secrets und Live.',
  'popup.tour.statusGreen': 'Grün',
  'popup.tour.statusGreenDesc': '— alles in Ordnung',
  'popup.tour.statusYellow': 'Gelb',
  'popup.tour.statusYellowDesc': '— ein Subsystem meldet eine Warnung',
  'popup.tour.statusRed': 'Rot',
  'popup.tour.statusRedDesc': '— ein Subsystem ist ausgefallen',
  'popup.tour.growTitle': 'Hilf uns zu wachsen',
  'popup.tour.growSubtitle': 'Hilf uns zu wachsen und mehr Entwickler zu erreichen.',
  'popup.tour.starGithub': 'Gib uns einen Stern auf GitHub',
  'popup.tour.recommend': 'Empfiehl uns deinen Freunden und Kollegen',
  'popup.tour.growHint': 'Das alles findest du jederzeit unter der Glocke.',

  // ── DevTools feature bullets (tour step 4 + Debug Network panel) ───
  'popup.devtools.featureModify': 'Header, Anfragen und Antworten verändern',
  'popup.devtools.featureTabs': 'Anfrage-Metadaten-Panels mit mehreren Tabs',
  'popup.devtools.featureSearch': 'Erweiterte Suche und Filter',
  'popup.devtools.featureDock': 'Seitenpanels per Drag & Drop',
  'popup.devtools.addOverride': '+ Hinzufügen/Überschreiben',

  // ── Debug Network panel ────────────────────────────────────────────
  'popup.debug.title': 'Netzwerk-Debugging',
  'popup.debug.step1': 'Öffne die DevTools des Browsers',
  'popup.debug.step1a': 'Auf einer normalen Seite, z. B.',
  'popup.debug.notPrefix': 'Nicht',
  'popup.debug.notSuffix': 'oder ein neuer Tab (Erweiterungen sind dort blockiert).',
  'popup.debug.onPlatform': 'auf {platform}',
  'popup.debug.menuHintSafari':
    'Aktiviere zuerst Entwickler — Safari → Einstellungen → Erweitert → „Funktionen für Webentwickler anzeigen“.',
  'popup.debug.clickThePrefix': 'Klicke auf den Tab',
  'popup.debug.clickTheSuffix': '',
  'popup.debug.overflowPrefix': 'Letzter Tab — versteckt sich womöglich im',
  'popup.debug.overflowSuffix': 'Überlaufmenü.',
  'popup.debug.step3': 'Lade dein Debugging auf',
  'popup.debug.menuGlyphAria': 'Menü Ansicht → Entwickler → Entwicklertools öffnen',
  'popup.debug.tabGlyphAria':
    'Angedockte DevTools mit ausgewähltem Tab „Open Headers“ — Seitenleisten, Netzwerkliste und geteilte Panels mit mehreren Tabs',
  // Menu-glyph mock labels — the browser's own menu rows, which the
  // browser localizes, so the mock localizes with them.
  'popup.debug.menuGlyphDeveloper': 'Entwickler',
  'popup.debug.menuGlyphDeveloperTools': 'Entwicklertools',
} as const satisfies Catalog;
