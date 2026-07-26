/**
 * DevTools panel — shell chrome — German. Mirrors `catalogs/en/panel.ts`
 * key for key; resource-type pills, throttle tier names, CDP method
 * names, header names, event names (Finish / DOMContentLoaded / Load),
 * keyboard chords, units (kB / kbit/s / ms) and the Aa / ab / .* / ▾ / ✓
 * glyphs stay raw. Mints: log = Protokoll; Preserve log = Protokoll
 * beibehalten; throttling = Drosselung (f.); preset = Voreinstellung;
 * System overrides = System-Überschreibungen (rides the Überschreiben
 * op mint); layout = Layout raw (n.); sanitized = bereinigt; evidence
 * chips = widerlegt / maßgeblich / bestätigt / indirekt (popup parity)
 * / stumm / erhärtet / abgeleitet; Off-HAR = ohne HAR; hit rides the
 * Auslösung fire mint (popup); Enter = Eingabetaste; footer = Fußzeile;
 * Raw = Roh / Decoded = Decodiert; Locale raw (f.); snapshot =
 * Schnappschuss; tool window = Werkzeugfenster (settings-defs mint);
 * Network / Storage / Console / Docs tool-window labels ride raw (es
 * precedent), Suche / Benachrichtigungen / Regel-Aktivität / Getroffene
 * Regeln translate.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panel = {
  // ── Toolbar buttons ─────────────────────────────────────────────────
  'panel.toolbar.record': 'Netzwerkprotokoll aufzeichnen',
  'panel.toolbar.stopRecording': 'Aufzeichnung stoppen',
  'panel.toolbar.clear': 'Netzwerkprotokoll leeren',
  'panel.toolbar.filter': 'Filtern',
  'panel.toolbar.search': 'Suchen',
  'panel.toolbar.preserveLog': 'Protokoll beibehalten',
  'panel.toolbar.preserveLogTitle':
    'Behält Anfragen über Seitennavigationen hinweg. Deaktiviert leert sich die Liste bei jeder Navigation ' +
    'oder jedem Neuladen, wie im Network-Panel des Browsers.',
  'panel.toolbar.aboutPreserveLog': 'Über „Protokoll beibehalten“',
  'panel.toolbar.aboutMoreFilters': 'Über „Weitere Filter“',
  'panel.toolbar.aboutFooterView': 'Über „Fußzeilen-Ansicht“',
  'panel.toolbar.moreTools': 'Weitere Werkzeuge',
  'panel.toolbar.activeWorkspaceAria': 'Aktiver Arbeitsbereich: {name}',

  // ── Toolbar layout cluster ──────────────────────────────────────────
  'panel.toolbar.leftSidebar': 'Linke Seitenleiste',
  'panel.toolbar.bottomPanel': 'Unteres Panel',
  'panel.toolbar.rightSidebar': 'Rechte Seitenleiste',
  'panel.toolbar.chooseBottomAlignment': 'Ausrichtung des unteren Panels wählen',
  'panel.toolbar.layoutOptions': 'Layout-Optionen',
  'panel.toolbar.bottomAlignTooltip.center': 'Unteres Panel: zentriert (verschachtelt)',
  'panel.toolbar.bottomAlignTooltip.left': 'Unteres Panel: linksbündig',
  'panel.toolbar.bottomAlignTooltip.right': 'Unteres Panel: rechtsbündig',
  'panel.toolbar.bottomAlignTooltip.justify': 'Unteres Panel: volle Breite',

  // ── Layout menu ─────────────────────────────────────────────────────
  'panel.layout.bottomAlignment': 'Ausrichtung des unteren Panels',
  'panel.layout.alignCenter': 'Zentriert (verschachtelt)',
  'panel.layout.alignLeft': 'Links',
  'panel.layout.alignRight': 'Rechts',
  'panel.layout.alignJustify': 'Blocksatz (volle Breite)',
  'panel.layout.showToolWindowNames': 'Werkzeugfenster-Namen anzeigen',
  'panel.layout.activityBarLayout': 'Layout der Aktivitätsleiste',
  'panel.layout.sidebarProportional': 'Proportional (gleiche Hälften)',
  'panel.layout.sidebarCompact': 'Kompakt (unten fixiert)',
  'panel.layout.sidebarStacked': 'Gestapelt (alles oben)',
  'panel.layout.sidebarDynamic': 'Dynamisch (folgt den Panelhöhen)',
  'panel.layout.defaultLayoutDonor': '{unit} mit Standard-Layout',
  'panel.layout.inheritsDefault': 'Erbt das Standard-Layout',
  'panel.layout.donorTooltip': 'Dieses {unit} ist der Standard — neue {units} erben dieses Layout.',
  'panel.layout.nonDonorTooltip': 'Ein anderes {unit} ist der Standard — neue {units} erben von dort.',
  'panel.layout.resetToDefaults': 'Layout auf Standard zurücksetzen',
  'panel.layout.restoreHidden': 'Ausgeblendete Aktivitätsleisten-Tools wiederherstellen',

  // ── Filter strip chrome (syntax tokens stay raw) ────────────────────
  'panel.filter.placeholder': 'Filtern',
  'panel.filter.clear': 'Leeren',
  'panel.filter.clearAria': 'Filter leeren',
  'panel.filter.matchCase': 'Groß-/Kleinschreibung beachten (Alt+C)',
  'panel.filter.wholeWord': 'Nur ganze Wörter (Alt+W)',
  'panel.filter.regex': 'Regulären Ausdruck verwenden (Alt+R)',
  'panel.filter.more': 'Mehr',
  'panel.filter.hiddenClearFilter': 'Filter leeren',
  'panel.filter.hiddenDismiss': 'Ausblenden',

  // Shared reset row across the panel's checkbox menus (More filters /
  // Footer View / resource pills) — one action family, one key.
  'panel.menu.resetToDefault': 'Auf Standard zurücksetzen',

  // ── More-filters menu ───────────────────────────────────────────────
  'panel.moreFilters.label': 'Weitere Filter',
  'panel.moreFilters.hideDataUrls': 'Data-URLs ausblenden',
  'panel.moreFilters.hideExtensionUrls': 'Erweiterungs-URLs ausblenden',
  'panel.moreFilters.blockedRequests': 'Blockierte Anfragen',
  'panel.moreFilters.thirdParty': 'Drittanbieter-Anfragen',
  'panel.moreFilters.swRequests': 'Service-Worker-Anfragen',
  'panel.moreFilters.ruleApplied': 'Anfragen mit angewendeter Regel',
  'panel.moreFilters.pageOriginPending': 'Die Origin der Seite ist noch nicht verfügbar',

  // ── Footer-View menu ────────────────────────────────────────────────
  'panel.view.label': 'Fußzeilen-Ansicht',
  'panel.view.title': 'Wähle, welche Statistiken die Fußzeile zeigt',
  'panel.view.focusedTool': 'Fokussiertes Tool',
  'panel.view.focusedToolTitle':
    'Die Fußzeile folgt dem fokussierten Werkzeugfenster — Storage, Console und die Suche zeigen eigene ' +
    'Zusammenfassungen; andere Tools fallen auf die Network-Zeile zurück.',
  'panel.view.networkOnly': 'Nur Network-Tool',
  'panel.view.networkOnlyTitle':
    'Die Fußzeile zeigt immer die Network-Zahlen, egal welches Werkzeugfenster den Fokus hat.',
  'panel.view.modifiedCount': 'Anzahl verändert',
  'panel.view.failedCount': 'Anzahl fehlgeschlagen',
  'panel.view.cachedCount': 'Anzahl aus dem Cache',
  'panel.view.pageLabel': 'Bezeichnung der aktuellen Seite',
  'panel.view.pageLabelTitle':
    'Wenn das Protokoll mehr als eine Navigation umfasst, benennt dies die Seite, die die Timing-Meilensteine ' +
    'beschreiben.',
  'panel.view.timingAllNavs': 'Timing über alle Navigationen',
  'panel.view.timingAllNavsTitle':
    'Finish / DOMContentLoaded / Load umfassen die gesamte Zeitachse des beibehaltenen Protokolls ab der ' +
    'ersten Navigation (Browser-Standard). Abwählen, um nur die letzte Navigation zu berichten.',

  // ── Export menu ─────────────────────────────────────────────────────
  'panel.export.title': 'Traffic exportieren',
  'panel.export.exportAll': 'Alles als HAR exportieren',
  'panel.export.exportAllSanitized': 'Alles als HAR exportieren (bereinigt)',
  'panel.export.copyAll': 'Alles als HAR kopieren',
  'panel.export.copyAllSanitized': 'Alles als HAR kopieren (bereinigt)',

  // ── Disable cache ───────────────────────────────────────────────────
  'panel.cache.label': 'Cache deaktivieren',
  'panel.cache.tooltipDebug':
    'Deaktiviert den Cache auf Netzwerk-Stack-Ebene (Debug-Modus) — entspricht dem nativen „Cache ' +
    'deaktivieren“ des Browsers.',
  'panel.cache.tooltipStandard':
    'Umgeht den HTTP-Cache durch erzwungene Revalidierung. Aktiviere den Debug-Modus für eine vollständige ' +
    'Deaktivierung auf Netzwerk-Stack-Ebene (auch der In-Memory-Cache).',
  'panel.cache.aboutAria': 'Über „Cache deaktivieren“',

  // ── Network throttling ──────────────────────────────────────────────
  'panel.throttle.none': 'Keine Drosselung',
  'panel.throttle.custom': 'Benutzerdefiniert',
  'panel.throttle.customEllipsis': 'Benutzerdefiniert…',
  'panel.throttle.customHint': 'Lege Download, Upload und Latenz fest.',
  'panel.throttle.customTitle': 'Benutzerdefinierte Drosselung',
  'panel.throttle.download': 'Download',
  'panel.throttle.upload': 'Upload',
  'panel.throttle.latency': 'Latenz',
  'panel.throttle.appliesToTab': 'Gilt für diesen Tab',
  'panel.throttle.morePresets': 'Weitere Voreinstellungen',
  'panel.throttle.morePresetsSubtitle': 'Fiber, cable, DSL, 5G, 2G.',
  'panel.throttle.wired': 'Kabelgebunden',
  'panel.throttle.mobile': 'Mobil',
  'panel.throttle.disabledTooltip':
    'Netzwerk-Drosselung gibt es nur im Debug-Modus. Aktiviere den Debug-Modus, um diesen Tab zu drosseln.',
  'panel.throttle.aboutAria': 'Über die Netzwerk-Drosselung',
  // One-line speed/latency hints under the preset rows (tier names raw).
  'panel.throttle.subtitle.fiber': '≈500 Mbit/s · 2 ms Latenz',
  'panel.throttle.subtitle.cable': '≈200 Mbit/s · 8 ms Latenz',
  'panel.throttle.subtitle.dsl': '≈20 Mbit/s · 25 ms Latenz',
  'panel.throttle.subtitle.fast5g': '≈100 Mbit/s · 8 ms Latenz',
  'panel.throttle.subtitle.slow5g': '≈30 Mbit/s · 18 ms Latenz',
  'panel.throttle.subtitle.fast4g': '≈8.1 Mbit/s · 165 ms Latenz',
  'panel.throttle.subtitle.slow4g': '≈1.44 Mbit/s · 562.5 ms Latenz',
  'panel.throttle.subtitle.3g': '≈400 kbit/s · 2000 ms Latenz',
  'panel.throttle.subtitle.fast2g': '≈280 kbit/s · 2000 ms Latenz',
  'panel.throttle.subtitle.slow2g': '≈100 kbit/s · 3000 ms Latenz',
  'panel.throttle.subtitle.offline': 'Blockiert sämtlichen Netzwerkverkehr des Tabs.',

  // Shared Apply across the debug cluster's builder footers.
  'panel.debug.apply': 'Anwenden',
  'panel.debug.enableDebugMode': 'Debug-Modus aktivieren',

  // ── System overrides ────────────────────────────────────────────────
  'panel.overrides.trigger': 'Überschreibungen',
  'panel.overrides.disabledTooltip':
    'System-Überschreibungen gibt es nur im Debug-Modus. Aktiviere den Debug-Modus, um diesen Tab zu ' +
    'überschreiben.',
  'panel.overrides.aboutAria': 'Über System-Überschreibungen',
  'panel.overrides.wireHint':
    'Wird auf Anfragen gesendet und an Seitenskripte gemeldet, solange dieser Tab im Debug-Modus bleibt.',
  'panel.overrides.pageOnlyHint':
    'Nur Seite — ändert, was die eigenen Skripte und das CSS der Seite beobachten, nicht die Anfragen.',
  'panel.overrides.platform': 'Plattform',
  'panel.overrides.locale': 'Locale',
  'panel.overrides.timezone': 'Zeitzone',
  'panel.overrides.colorScheme': 'Farbschema',
  'panel.overrides.reducedMotion': 'Reduzierte Bewegung',
  'panel.overrides.printMedia': 'Druckmedien',
  'panel.overrides.uaPlaceholder': 'Eigene User-Agent-Zeichenkette',
  'panel.overrides.alPlaceholder': 'z. B. fr-FR,fr;q=0.9',
  'panel.overrides.platformPlaceholder': 'navigator.platform, z. B. Linux',
  'panel.overrides.localePlaceholder': 'Echte Locale',
  'panel.overrides.timezonePlaceholder': 'Echte Zeitzone',
  'panel.overrides.auto': 'Auto',
  'panel.overrides.light': 'Hell',
  'panel.overrides.dark': 'Dunkel',
  'panel.overrides.reduce': 'Reduzieren',
  'panel.overrides.noPref': 'Keine Präferenz',
  'panel.overrides.screen': 'Bildschirm',
  'panel.overrides.print': 'Druck',
  'panel.overrides.resetAll': 'Alles zurücksetzen',

  // ── (i) corpora — Preserve log ──────────────────────────────────────
  'panel.info.preserveLog.summary':
    'Behält aufgezeichnete Anfragen über Seitennavigationen und Neuladen hinweg, statt die Liste bei jedem ' +
    'Seitenwechsel zu leeren.',
  'panel.info.preserveLog.description':
    'An — das Protokoll überdauert jede Navigation, sodass Anfragen sichtbar bleiben, die kurz vor einem ' +
    'Redirect, Formular-Submit oder Neuladen ausgelöst wurden. Aus — die Liste leert sich bei jeder Navigation ' +
    'oder jedem Neuladen, wie im Network-Panel des Browsers, und zeigt nur den Verkehr der aktuellen Seite.',
  'panel.info.preserveLog.whenHeading': 'Greif dazu, wenn',
  'panel.info.preserveLog.redirects': 'Redirects',
  'panel.info.preserveLog.redirectsDesc':
    'Untersuche die Anfrage, die eine Navigation ausgelöst hat, bevor die neue Seite sie wegwischt.',
  'panel.info.preserveLog.forms': 'Formular-Submits / Logins',
  'panel.info.preserveLog.formsDesc': 'Halte einen POST und seine Antwort sichtbar, nachdem die Seite neu geladen hat.',
  'panel.info.preserveLog.reloadLoops': 'Neulade-Schleifen',
  'panel.info.preserveLog.reloadLoopsDesc': 'Sieh, was kurz vor dem selbst ausgelösten Neuladen der Seite lief.',

  // ── (i) corpora — More filters ──────────────────────────────────────
  'panel.info.moreFilters.summary':
    'Sekundäre Anfragefilter hinter einem Menü — jeder engt die Liste ein, ohne erstklassigen Platz in der ' +
    'Symbolleiste zu belegen.',
  'panel.info.moreFilters.hideHeading': 'Ausblenden',
  'panel.info.moreFilters.dataUrls': 'Data-URLs',
  'panel.info.moreFilters.dataUrlsDesc':
    'Schließt inline eingebettete data:-Ressourcen aus — base64-Bilder, Schriften und dergleichen.',
  'panel.info.moreFilters.extensionUrls': 'Erweiterungs-URLs',
  'panel.info.moreFilters.extensionUrlsDesc': 'Schließt Anfragen an Browser-Erweiterungs-Origins aus.',
  'panel.info.moreFilters.onlyHeading': 'Nur anzeigen',
  'panel.info.moreFilters.blocked': 'Blockierte Anfragen',
  'panel.info.moreFilters.blockedDesc': 'Beschränkt die Liste auf Anfragen, die eine Regel blockiert hat.',
  'panel.info.moreFilters.thirdParty': 'Drittanbieter-Anfragen',
  'panel.info.moreFilters.thirdPartyDesc':
    'Beschränkt auf Anfragen, deren Origin sich von der der Seite unterscheidet.',
  'panel.info.moreFilters.swRequests': 'Service-Worker-Anfragen',
  'panel.info.moreFilters.swRequestsDesc':
    'Beschränkt auf Service-Worker-Austausch — Anfragen, die der Worker selbst gestellt hat (⚙-Zeilen), und ' +
    'Seitenanfragen, die sein fetch-Handler beantwortet hat.',
  'panel.info.moreFilters.ruleApplied': 'Anfragen mit angewendeter Regel',
  'panel.info.moreFilters.ruleAppliedDesc':
    'Beschränkt auf Anfragen, die eine Regel von Open Headers nachweislich verändert hat.',

  // ── (i) corpora — Footer View ───────────────────────────────────────
  'panel.info.view.summary':
    'Wählt, welche optionalen Statistiken die Fußzeile neben den immer sichtbaren Anfrage- und Transferzahlen ' +
    'zeigt.',
  'panel.info.view.scopeHeading': 'Bereich der Zusammenfassung',
  'panel.info.view.focusedTool': 'Fokussiertes Tool',
  'panel.info.view.focusedToolDesc':
    'Die Fußzeile folgt dem fokussierten Werkzeugfenster — Storage, Console und die Suche zeigen eigene ' +
    'Zusammenfassungszeilen; andere Tools fallen auf die Network-Zeile zurück.',
  'panel.info.view.networkOnly': 'Nur Network-Tool',
  'panel.info.view.networkOnlyDesc':
    'Die Fußzeile zeigt immer die Network-Zahlen, egal welches Werkzeugfenster den Fokus hat.',
  'panel.info.view.countsHeading': 'Fußzeilen-Zähler',
  'panel.info.view.modified': 'Verändert',
  'panel.info.view.modifiedDesc': 'Wie viele Anfragen eine Regel verändert hat.',
  'panel.info.view.failed': 'Fehlgeschlagen',
  'panel.info.view.failedDesc': 'Wie viele Anfragen fehlschlugen oder blockiert wurden.',
  'panel.info.view.cached': 'Aus dem Cache',
  'panel.info.view.cachedDesc': 'Wie viele Antworten aus dem Cache bedient wurden.',
  'panel.info.view.timingHeading': 'Timing',
  'panel.info.view.pageLabel': 'Bezeichnung der aktuellen Seite',
  'panel.info.view.pageLabelDesc':
    'Benennt die Seite, die die Timing-Meilensteine beschreiben, wenn das Protokoll mehr als eine Navigation ' +
    'umfasst.',
  'panel.info.view.allNavs': 'Über alle Navigationen',
  'panel.info.view.allNavsDesc':
    'Finish / DOMContentLoaded / Load umfassen die gesamte Zeitachse des beibehaltenen Protokolls, nicht nur ' +
    'die letzte Navigation.',

  // ── (i) corpora — Disable cache ─────────────────────────────────────
  'panel.info.cache.summary': 'Hindert diesen Tab daran, Antworten aus dem Cache zu bedienen.',
  'panel.info.cache.debugDesc':
    'Dieser Tab ist im Debug-Modus: Der Cache ist auf Netzwerk-Stack-Ebene deaktiviert — auch der ' +
    'In-Memory-Cache — wie beim nativen „Cache deaktivieren“ des Browsers.',
  'panel.info.cache.standardDesc':
    'Dieser Tab ist im Standardmodus: Nur der HTTP-Cache wird umgangen, indem der Server um Revalidierung ' +
    'gebeten wird. Aktiviere den Debug-Modus für eine vollständige Deaktivierung auf Netzwerk-Stack-Ebene, ' +
    'die auch den In-Memory-Cache leert.',
  'panel.info.cache.standardHeading': 'Standardmodus',
  'panel.info.cache.revalidateDesc':
    'Wird jeder Anfrage hinzugefügt, damit der Server die Frische neu prüft. Umgeht nur den HTTP-Cache.',
  'panel.info.cache.debugHeading': 'Debug-Modus',
  'panel.info.cache.cdpDesc':
    'Deaktiviert den Cache für den ganzen Tab auf Netzwerk-Stack-Ebene, einschließlich In-Memory-Cache.',

  // ── (i) corpora — System overrides ──────────────────────────────────
  'panel.info.overrides.title': 'System-Überschreibungen',
  'panel.info.overrides.summary':
    'Fixiert die Systemidentität dieses Tabs — User-Agent, Locale, Zeitzone und emulierte Medien — um zu ' +
    'sehen, wie eine Website auf einen anderen Client reagiert.',
  'panel.info.overrides.debugDesc':
    'Auf diesem Tab über den Debug-Modus aktiv. Die User-Agent-Facetten gelten für Anfragen und ' +
    'Seitenskripte; Locale, Zeitzone und Medien ändern nur, was die eigenen Skripte und das CSS der Seite ' +
    'beobachten. „Alles zurücksetzen“ stellt die echten Werte wieder her.',
  'panel.info.overrides.standardDesc':
    'System-Überschreibungen brauchen den Debug-Modus — es gibt keinen Standardmodus-Ersatz. Aktiviere den ' +
    'Debug-Modus und halte diesen Tab im Geltungsbereich, um ihn zu überschreiben.',
  'panel.info.overrides.wireHeading': 'Auf der Leitung + Seitenskripte',
  'panel.info.overrides.uaDesc':
    'Setzt die User-Agent- / Accept-Language-Header, die Plattform und die passenden navigator.*-Werte.',
  'panel.info.overrides.pageHeading': 'Nur Seite',
  'panel.info.overrides.localeDesc': 'Ändert die Locale, die Seitenskripte lesen.',
  'panel.info.overrides.timezoneDesc': 'Ändert die Zeitzone, zu der Date und Intl auflösen.',
  'panel.info.overrides.mediaDesc': 'Erzwingt color-scheme- / reduced-motion- / print-Media-Queries.',

  // ── (i) corpora — Network throttling ────────────────────────────────
  'panel.info.throttle.title': 'Netzwerk-Drosselung',
  'panel.info.throttle.summary':
    'Simuliert langsamere Verbindungen, indem die Bandbreite dieses Tabs gedeckelt und Latenz hinzugefügt wird.',
  'panel.info.throttle.debugDesc':
    'Auf diesem Tab über den Debug-Modus aktiv. Wähle eine Voreinstellung — die Standards plus Fiber / Cable ' +
    '/ DSL und 5G / 2G unter „Weitere Voreinstellungen“ — geh Offline, oder lege Download / Upload / Latenz ' +
    'selbst fest.',
  'panel.info.throttle.standardDesc':
    'Die Drosselung braucht den Debug-Modus — es gibt keinen Standardmodus-Ersatz. Aktiviere den Debug-Modus ' +
    'und halte diesen Tab im Geltungsbereich, um ihn zu drosseln.',
  'panel.info.throttle.presetsHeading': 'Voreinstellungen',
  'panel.info.throttle.fast4gDesc': '≈8.1 Mbit/s Download, 165 ms Latenz.',
  'panel.info.throttle.slow4gDesc': '≈1.44 Mbit/s Download, 562.5 ms Latenz.',
  'panel.info.throttle.3gDesc': '≈400 kbit/s, 2000 ms Latenz.',
  'panel.info.throttle.offlineDesc': 'Blockiert sämtlichen Netzwerkverkehr des Tabs.',
  'panel.info.throttle.wiredHeading': 'Weitere Voreinstellungen · Kabelgebunden',
  'panel.info.throttle.fiberDesc': '≈500 Mbit/s, 2 ms Latenz.',
  'panel.info.throttle.cableDesc': '≈200 Mbit/s Download, 8 ms Latenz.',
  'panel.info.throttle.dslDesc': '≈20 Mbit/s Download, 25 ms Latenz.',
  'panel.info.throttle.mobileHeading': 'Weitere Voreinstellungen · Mobil',
  'panel.info.throttle.fast5gDesc': '≈100 Mbit/s Download, 8 ms Latenz.',
  'panel.info.throttle.slow5gDesc': '≈30 Mbit/s Download, 18 ms Latenz.',
  'panel.info.throttle.fast2gDesc': '≈280 kbit/s, 2000 ms Latenz.',
  'panel.info.throttle.slow2gDesc': '≈100 kbit/s, 3000 ms Latenz.',

  // ── Status bar (footer summary line) ───────────────────────────────
  'panel.status.requests': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Anfrage', other: '{count} Anfragen' }),
  'panel.status.requestsSubset': '{subset} / {total} Anfragen',
  'panel.status.modified': '{count} verändert',
  'panel.status.modifiedTitle': 'Anfragen, die deine Regeln verändert haben',
  'panel.status.failed': '{count} fehlgeschlagen',
  'panel.status.failedTitle': 'Fehlgeschlagene Anfragen oder Anfragen mit Fehlerstatus',
  'panel.status.cached': '{count} aus dem Cache',
  'panel.status.cachedTitle': 'Aus dem Cache bediente Anfragen',
  'panel.status.transferredOnly': '{size} übertragen',
  'panel.status.transferredAndResources': '{transferred} übertragen / {resources} Ressourcen',
  'panel.status.transferredSubset': '{subset} / {total} übertragen',
  'panel.status.resourcesSubset': '{subset} / {total} Ressourcen',
  'panel.status.finish': 'Finish: {time}',
  'panel.status.loadEventTitle': 'Load-Ereignis',
  'panel.status.tabs': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Tab', other: '{count} Tabs' }),
  'panel.status.messagesOf': '{visible} von {total} Nachrichten',
  'panel.status.messages': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Nachricht', other: '{count} Nachrichten' }),
  'panel.status.errors': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Fehler', other: '{count} Fehler' }),
  'panel.status.errorsTitle': 'Konsolenmeldungen auf der Fehlerstufe',
  'panel.status.warnings': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Warnung', other: '{count} Warnungen' }),
  'panel.status.warningsTitle': 'Konsolenmeldungen auf der Warnstufe',
  'panel.status.systemStatus': 'System',
  'panel.status.theme.light': 'Hell',
  'panel.status.theme.dark': 'Dunkel',
  'panel.status.theme.auto': 'Auto',

  // ── Tool-window registry labels (activity bar / dock tabs / restore) ─
  'panel.toolWindows.network': 'Network',
  'panel.toolWindows.storage': 'Storage',
  'panel.toolWindows.console': 'Console',
  'panel.toolWindows.search': 'Suche',
  'panel.toolWindows.notifications': 'Benachrichtigungen',
  'panel.toolWindows.docs': 'Docs',
  'panel.toolWindows.ruleActivity': 'Regel-Aktivität',
  'panel.toolWindows.matchedRules': 'Getroffene Regeln',

  // ── Search tool window (station: search family) ─────────────────────
  // Raw by design: match-text lines, section labels (doc-plane vocabulary
  // shared with the filter grammar), #ordinal / line:col figures, doc
  // names/origins, timing figures (ms / s), and the · separators. The
  // source chips and group badges reuse the tool-window label keys.
  'panel.search.placeholder': 'Suchen (Eingabetaste drücken)',
  'panel.search.inputAria': 'Erfasste Daten durchsuchen',
  'panel.search.syntaxHelp': 'Hilfe zur Suchsyntax',
  'panel.search.run': 'Suchen',
  'panel.search.runTitle': 'Suche ausführen (Eingabetaste)',
  'panel.search.cancel': 'Abbrechen',
  'panel.search.cancelTitle': 'Suche abbrechen',
  'panel.search.idleHintMin': 'Gib eine Suchanfrage ein (mind. 2 Zeichen) und drücke die Eingabetaste.',
  'panel.search.idleHintShort': 'Drücke die Eingabetaste, um zu suchen.',
  'panel.search.noMatches': 'Keine Treffer gefunden.',

  // Session status lines (panel status strip + published footer line)
  'panel.search.status.searching': 'Suche läuft… {done} / {total}',
  'panel.search.status.noResults': 'Keine Ergebnisse · {elapsed}',
  'panel.search.status.found': ({ matches, files, elapsed }, locale) => {
    const found = plural(locale, Number(matches), {
      one: '{count} Treffer gefunden',
      other: '{count} Treffer gefunden',
    });
    const where = plural(locale, Number(files), { one: '{count} Datei', other: '{count} Dateien' });
    return `${found} in ${where} · ${elapsed}`;
  },
  'panel.search.status.capped': 'die ersten {shown} werden angezeigt — verfeinere die Suche für den Rest',

  // Result groups + rows
  'panel.search.group.countTitle': '{count} Treffer in dieser Datei',
  'panel.search.group.countTitleCapped': '{count} Treffer in dieser Datei — die ersten {shown} werden angezeigt',
  'panel.search.row.lineCol': 'Zeile {line}, Spalte {col}',
  'panel.search.row.line': 'Zeile {line}',
  'panel.search.row.matchesOnLine': '{count} Treffer in dieser Zeile',

  // ── Matched Rules tool window (station: rule tool windows) ──────────
  // Raw by design: rule action descriptor lines (`req set X = v` — rule
  // syntax plane), match patterns, rule names/uids, and the brand mark
  // riding between the select-prompt halves.
  'panel.matchedRules.selectPrompt.lead': 'Wähle eine Anfrage, um zu sehen, welche',
  'panel.matchedRules.selectPrompt.tail': 'Regeln auf sie zutreffen',
  'panel.matchedRules.matchedCount': 'Getroffen · {count}',
  'panel.matchedRules.futureCount': 'Künftige Treffer · {count}',
  'panel.matchedRules.noMatched': 'Keine Regel hat diese Anfrage getroffen.',
  'panel.matchedRules.noFuture': 'Keine weitere Regel würde diese Anfrage treffen.',
  'panel.matchedRules.pattern': 'Muster: {pattern}',
  'panel.matchedRules.wouldMatch': 'würde treffen',

  // Fire-evidence badges + their receipts
  'panel.matchedRules.evidence.contradicted': 'widerlegt',
  'panel.matchedRules.evidence.authoritative': 'maßgeblich',
  'panel.matchedRules.evidence.confirmed': 'bestätigt',
  'panel.matchedRules.evidence.fallback': 'indirekt',
  'panel.matchedRules.evidence.silent': 'stumm',
  'panel.matchedRules.evidence.corroborated': 'erhärtet',
  'panel.matchedRules.evidence.inferred': 'abgeleitet',
  'panel.matchedRules.evidenceTitle.contradicted':
    'Widerlegt — die erfassten Header widerlegen eine Änderung, die diese Regel behauptet hat.',
  'panel.matchedRules.evidenceTitle.authoritative':
    'Maßgeblich — die Regel-Engine hat bestätigt, dass diese DNR-Regel auf der Anfrage ausgeführt wurde.',
  'panel.matchedRules.evidenceTitle.capturedOverride':
    'Bestätigt — die Regel hat den Body im Seitenkontext verändert und beide Seiten (ausgeliefert vs. ' +
    'original) wurden für diese Anfrage erfasst.',
  'panel.matchedRules.evidenceTitle.confirmed':
    'Vom In-Page-Reporter bestätigt — die skriptbare Aktion lief in der Seite.',
  'panel.matchedRules.evidenceTitle.fallback':
    'Aus URL-Treffern abgeleitet — eine skriptbare Bestätigung wurde erwartet, kam aber nicht an.',
  'panel.matchedRules.evidenceTitle.silent':
    'Das Muster traf, aber die Anfrage wurde aus dem Cache / von einem Service Worker bedient — weder DNR ' +
    'noch skriptbare Aktion liefen.',
  'panel.matchedRules.evidenceTitle.corroborated':
    'Erhärtet — die behauptete Änderung ist in den erfassten Headern sichtbar.',
  'panel.matchedRules.evidenceTitle.inferred':
    'Aus URL-Treffern abgeleitet — die Regel würde diese Anfrage laut ihren Bedingungen treffen.',
  'panel.matchedRules.contradiction.stillPresent': '{header} ist weiterhin vorhanden ({observed}).',
  'panel.matchedRules.contradiction.missing': '{header} fehlt in den erfassten Headern.',
  'panel.matchedRules.contradiction.otherValue': '{header} trägt „{observed}“ statt des behaupteten Werts.',

  // Rule-state badges (the snapshot fired; the live rule moved on)
  'panel.matchedRules.ruleState.deleted': 'Regel gelöscht',
  'panel.matchedRules.ruleState.disabled': 'Regel deaktiviert',
  'panel.matchedRules.ruleState.modified': 'Regel geändert',
  'panel.matchedRules.ruleStateTitle.deleted':
    'Diese Regel wurde seit ihrer Auslösung gelöscht. Die Zeile zeigt, was sie zum Zeitpunkt der Auslösung tat.',
  'panel.matchedRules.ruleStateTitle.disabled':
    'Diese Regel wurde seit ihrer Auslösung deaktiviert — auf die nächste Anfrage wird sie nicht angewendet.',
  'panel.matchedRules.ruleStateTitle.modified':
    'Diese Regel wurde seit ihrer Auslösung bearbeitet. Die Zeile zeigt, was sie zum Zeitpunkt der Auslösung ' +
    'tat; fahre mit der Maus darüber, um die aktuelle Regel zu sehen.',

  // ── Rule Activity tool window ────────────────────────────────────────
  'panel.ruleActivity.empty': 'Noch keine Regel-Aktivität in diesem Tab.',
  'panel.ruleActivity.toolbarHint': 'Regel-Aktivität, gruppiert nach Regel.',
  // Legend: bold term key + remainder key per sentence (the popup tour's
  // term/hint split idiom).
  'panel.ruleActivity.hint.applied': 'Angewendet',
  'panel.ruleActivity.hint.appliedDesc':
    'sind Auslösungen, die nachweislich gelaufen sind — die Regel-Engine hat die Ausführung gemeldet, der ' +
    'In-Page-Reporter hat die Aktion bestätigt, oder die Änderung ist in den erfassten Headern sichtbar.',
  'panel.ruleActivity.hint.contradicted': 'Widerlegt',
  'panel.ruleActivity.hint.contradictedDesc':
    'sind Auslösungen, die eine Header-Änderung behaupteten, die die erfassten Header widerlegen.',
  'panel.ruleActivity.hint.inferred': 'Abgeleitet',
  'panel.ruleActivity.hint.inferredDesc':
    'sind Auslösungen, bei denen deine Regelmuster auf beobachtete Anfragen passen, sich aber nicht bestätigen ' +
    'ließen.',
  'panel.ruleActivity.hint.offHar': 'Ohne HAR',
  'panel.ruleActivity.hint.offHarDesc': 'sind Regeltreffer auf Anfragen, die das Panel nicht erfasst hat.',
  'panel.ruleActivity.hits': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Auslösung', other: '{count} Auslösungen' }),
  'panel.ruleActivity.applied': '{count} angewendet',
  'panel.ruleActivity.contradicted': '{count} widerlegt',
  'panel.ruleActivity.offHar': '{count} ohne HAR',
  'panel.ruleActivity.offHarTitle': 'Ohne HAR — das Panel hat für diese Auslösung keine HAR-Hülle erfasst',

  // ── Rule-value editor-tab document (ValueDocumentTab) ──────────────
  // The crumb's rule/header names ride raw as data; 'Rules' is its
  // fallback when the rule is gone.
  'panel.valueDoc.crumbFallback': 'Regeln',
  'panel.valueDoc.saveHint': 'Den bearbeiteten Wert neu codieren und in die Regel zurückschreiben',
  'panel.valueDoc.blockedHintInvalid': 'Der bearbeitete Text lässt sich für diesen Werttyp nicht codieren',
  'panel.valueDoc.blockedHintDetached': 'Das Regelfeld, zu dem dieser Wert gehörte, ist weg',
  'panel.valueDoc.rereadTitle': 'Wert neu aus der Regel einlesen',
  'panel.valueDoc.rereadConfirm': 'Verwirft deine Änderungen — zum Neu-Einlesen erneut klicken',
  'panel.valueDoc.rereadAria': 'Änderungen verwerfen und Wert neu einlesen',
  'panel.valueDoc.openRuleTitle': 'Diese Regel im Arbeitsbereich-Editor öffnen',
  'panel.valueDoc.openRule': 'Regel im Arbeitsbereich öffnen',
  'panel.valueDoc.driftNote':
    'Der Wert hat sich in der Regel geändert, während du bearbeitet hast — deine ungespeicherten Änderungen ' +
    'bleiben erhalten. Speichern überschreibt ihn.',
  'panel.valueDoc.undetectedNote':
    'Das Feld enthält keinen Wert mehr, den dieser Editor codieren kann — deine ungespeicherten Änderungen ' +
    'bleiben zum Herauskopieren erhalten.',
  'panel.valueDoc.detachedNote':
    'Das Regelfeld, zu dem dieser Wert gehörte, ist weg — deine ungespeicherten Änderungen bleiben zum ' +
    'Herauskopieren erhalten.',
  'panel.valueDoc.discardEdits': 'Meine Änderungen verwerfen',
  'panel.valueDoc.saveFailed.detached':
    'Die Modifikation, zu der dieser Wert gehörte, ist aus der Regel verschwunden — es gibt nichts mehr, ' +
    'wohin geschrieben werden könnte.',
  'panel.valueDoc.saveFailed.notFound': 'Regel nicht gefunden — sie wurde womöglich gelöscht.',
  'panel.valueDoc.saveFailed.write': 'Speichern fehlgeschlagen — die Regel hat den Schreibvorgang abgelehnt.',
  'panel.valueDoc.encodedPreview': 'Codierte Vorschau',
  'panel.valueDoc.cannotEncode': 'Codieren nicht möglich — der bearbeitete Wert ist für diesen Typ ungültig',
  'panel.valueDoc.undetectedTitle': 'Kein codierter Wert mehr',
  'panel.valueDoc.undetectedSub':
    'Der aktuelle Wert des Felds passt zu keinem Decoder — bearbeite ihn stattdessen im Regel-Editor.',
  'panel.valueDoc.detachedTitle': 'Wert nicht mehr in der Regel',
  'panel.valueDoc.detachedSub':
    'Die Regel oder die Modifikation mit diesem Wert wurde gelöscht, oder die Operation trägt keinen Wert mehr.',

  // ── Value-view snapshot document (ValueViewDocumentTab) ────────────
  // The crumb's source name rides raw as data; the type title comes
  // from the shared value-editor title keys.
  'panel.valueView.snapshotNote': 'Schnappschuss',
  'panel.valueView.snapshotTitle': 'Beim Öffnen dieses Dokuments erfasst — spätere Änderungen werden nicht verfolgt.',
  'panel.valueView.encodedValue': 'Codierter Wert',

  // ── Rule editor-tab document (RuleEditorTab) ───────────────────────
  // Rule names ride raw as data; status codes and MIME values stay raw.
  'panel.ruleDoc.crumbKind': 'Antwort-Überschreibung',
  'panel.ruleDoc.nameLabel': 'Regelname',
  'panel.ruleDoc.saveHint': 'Die Überschreibungs-Regel speichern — sie bleibt im selben Schritt veröffentlicht',
  'panel.ruleDoc.saveHintCreate': 'Regel anlegen und veröffentlichen',
  'panel.ruleDoc.blockedHintDetached': 'Die Regel, zu der dieses Dokument gehörte, ist weg',
  'panel.ruleDoc.rereadTitle': 'Regel neu einlesen',
  'panel.ruleDoc.rereadConfirm': 'Verwirft deine Änderungen — zum Neu-Einlesen erneut klicken',
  'panel.ruleDoc.rereadAria': 'Änderungen verwerfen und Regel neu einlesen',
  'panel.ruleDoc.openRuleTitle': 'Diese Regel im Arbeitsbereich-Editor öffnen',
  'panel.ruleDoc.openRule': 'Im Arbeitsbereich öffnen',
  'panel.ruleDoc.saveFailed.notFound': 'Regel nicht gefunden — sie wurde womöglich gelöscht.',
  'panel.ruleDoc.saveFailed.write': 'Speichern fehlgeschlagen — die Regel hat den Schreibvorgang abgelehnt.',
  'panel.ruleDoc.detachedTitle': 'Regel existiert nicht mehr',
  'panel.ruleDoc.detachedSub': 'Die Überschreibungs-Regel, die dieses Dokument bearbeitet hat, wurde gelöscht.',
  'panel.ruleDoc.dynamicTitle': 'Regel mit dynamischem Body',
  'panel.ruleDoc.dynamicSub': 'JavaScript-Antwort-Bodys werden im Arbeitsbereich-Editor bearbeitet.',

  // ── Onboarding tour (PanelOnboardingTour) ──────────────────────────
  // Tool-window names (Network / Storage / Console / Docs), HAR, and
  // IndexedDB stay raw per the registry's English boundary.
  'panel.tour.stepIndicator': 'Schritt {current} von {total}',
  'panel.tour.previous': 'Zurück',
  'panel.tour.next': 'Weiter',
  'panel.tour.finish': 'Fertig',
  'panel.tour.welcomeTitle': 'Ein einheitliches DevTools-Erlebnis',
  'panel.tour.welcomeSubtitle': 'Ein Netzwerk-Debugger mit deinen Regeln an Bord.',
  'panel.tour.welcomeCapture': 'Erfassen',
  'panel.tour.welcomeCaptureHint': '— Live-Anfragen mit Zeiten, Headern und Größen',
  'panel.tour.welcomeRules': 'Zuordnen',
  'panel.tour.welcomeRulesHint': '— sieh, welche Regeln auf jede Anfrage gefeuert haben, und warum',
  'panel.tour.welcomeState': 'Untersuchen',
  'panel.tour.welcomeStateHint': '— Cookies, Speicher und Konsole direkt neben dem Traffic',
  'panel.tour.networkTitle': 'Das Network-Fenster',
  'panel.tour.networkSubtitle': 'Jede Anfrage des untersuchten Tabs, live.',
  'panel.tour.networkFilters': 'Filtern',
  'panel.tour.networkFiltersHint': '— nach Text, Ressourcentyp oder den Voreinstellungen unter „Weitere Filter“',
  'panel.tour.networkToolbar': 'Steuern',
  'panel.tour.networkToolbarHint': '— Protokoll behalten, Drosselung und Cache deaktivieren ganz oben',
  'panel.tour.networkExport': 'Exportieren',
  'panel.tour.networkExportHint': '— das ganze Protokoll als HAR speichern oder kopieren',
  'panel.tour.storageTitle': 'Das Storage-Fenster',
  'panel.tour.storageSubtitle': 'Der clientseitige Zustand des untersuchten Tabs, an einem Ort.',
  'panel.tour.storageAreas': 'Durchsuchen',
  'panel.tour.storageAreasHint': '— Local und Session Storage, Cookies, IndexedDB, Caches',
  'panel.tour.storageEdit': 'Bearbeiten',
  'panel.tour.storageEditHint': '— öffne jeden Eintrag als Dokument-Tab und ändere ihn direkt',
  'panel.tour.inspectorTitle': 'Anfragedetail',
  'panel.tour.inspectorSubtitle': 'Wähle eine Anfrage aus, um sie hier als Tab zu öffnen.',
  'panel.tour.inspectorTabs': 'Abschnitte',
  'panel.tour.inspectorTabsHint': '— Header, Payload, Antwort, Zeiten und Cookies',
  'panel.tour.inspectorEdit': 'Überschreiben',
  'panel.tour.inspectorEditHint': '— erstelle eine Regel aus der Anfrage, ohne das Panel zu verlassen',
  'panel.tour.matchedTitle': 'Anfrage-Regeln',
  'panel.tour.matchedSubtitle':
    'Welche deiner Regeln auf die ausgewählte Anfrage gepasst haben — und welche bei der nächsten feuern würden.',
  'panel.tour.layoutTitle': 'Mach es zu deinem',
  'panel.tour.layoutSubtitle': 'Die Seitenleisten tragen weitere Werkzeugfenster.',
  'panel.tour.layoutTools': 'Mehr Werkzeuge',
  'panel.tour.layoutToolsHint': '— Console, Suche, Docs und Benachrichtigungen wohnen auf den Leisten',
  'panel.tour.layoutDrag': 'Umordnen',
  'panel.tour.layoutDragHint': '— ziehe Werkzeugfenster zwischen den Docks; das Layout-Menü setzt zurück',
  'panel.tour.debugTitle': 'Debug-Modus',
  'panel.tour.debugSubtitle': 'Standardmäßig aus — schalte ihn hier ein, wenn du tiefere Erfassung brauchst.',
  'panel.tour.debugUnlocks': 'Schaltet frei',
  'panel.tour.debugUnlocksHint': '— Antwort-Bodys, Konsole, exakte Zeiten und Regeln der Skript-Ebene',
  'panel.tour.debugBanner': 'Hinweis',
  'panel.tour.debugBannerHint': '— der Browser zeigt auf angebundenen Tabs ein Debugging-Banner, solange er an ist',

  // ── Value expander (headers / cookies detail readout) ──────────────
  // JWT part and claim names (Header / Payload / Signature / iat / nbf
  // / exp) are spec vocabulary and stay raw via the glossary.
  'panel.valueExpander.decoded': 'Decodiert',
  'panel.valueExpander.raw': 'Roh',
} as const satisfies Catalog;
