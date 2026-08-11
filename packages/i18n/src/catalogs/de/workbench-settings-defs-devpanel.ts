/**
 * Workbench settings — the setting-definition corpus for the DevTools
 * panel categories — German. Extends the de register contract
 * (`de/shared.ts`). Mirrors
 * `catalogs/en/workbench-settings-defs-devpanel.ts` key for key.
 * Parity vocabulary rides raw per the S34 lock: column names
 * (Waterfall, Name, Time, …), waterfall metric names (Start time,
 * Total duration, …), tool-window and detail-tab names (Network,
 * Storage, Console, Headers, Cookies, Messages, EventStream),
 * milestone names (Finish / DCL / DOMContentLoaded / Load),
 * Train-Case, header names, and every wire token. Option labels reuse
 * the shipped de panel menus verbatim (`Fehlschläge zuerst`,
 * `Fokussiertes Tool`, `Gruppiert`/`Flach`,
 * `Aufsteigend`/`Absteigend`, the timing view rows, streams
 * `Kompakt`/`Breit`, `Protokoll beibehalten`). MINTS: status bar =
 * `die Statusleiste`; top bar = `die obere Leiste`; footer = Fußzeile
 * (panel.ts mint); value chip = `der Wert-Chip` (chip raw m., cookies
 * precedent); summary scope = `der Umfang` in the footer-summary
 * sense (Geltungsbereich stays variable/cookie scope).
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefsDevpanel = {
  // ── DevTools Panel · Layout category defs ──────────────────────────
  'workbench.settings.def.devpanelLayout.footerShowVersion.label': 'Version in der Fußzeile anzeigen',
  'workbench.settings.def.devpanelLayout.footerShowVersion.description':
    'Zeigt die Versionsnummer der Erweiterung in der Statusleiste des DevTools-Panels.',
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.label': 'Theme-Umschalter in der Fußzeile anzeigen',
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.description':
    'Zeigt das Dropdown für das helle/dunkle/automatische Theme in der Statusleiste des DevTools-Panels.',
  'workbench.settings.def.devpanelLayout.footerShowModified.label': 'Zähler der Veränderten in der Fußzeile anzeigen',
  'workbench.settings.def.devpanelLayout.footerShowModified.description':
    'Zeigt in der Statusleiste des DevTools-Panels, wie viele Anfragen deine Regeln tatsächlich verändert haben.',
  'workbench.settings.def.devpanelLayout.footerShowFailed.label':
    'Zähler der Fehlgeschlagenen in der Fußzeile anzeigen',
  'workbench.settings.def.devpanelLayout.footerShowFailed.description':
    'Zeigt in der Statusleiste des DevTools-Panels, wie viele Anfragen fehlgeschlagen sind oder einen ' +
    'Fehlerstatus zurückgegeben haben.',
  'workbench.settings.def.devpanelLayout.footerShowCached.label': 'Cache-Zähler in der Fußzeile anzeigen',
  'workbench.settings.def.devpanelLayout.footerShowCached.description':
    'Zeigt in der Statusleiste des DevTools-Panels, wie viele Anfragen aus dem Cache bedient wurden.',
  'workbench.settings.def.devpanelLayout.footerShowPageContext.label': 'Aktuelle Seite in der Fußzeile anzeigen',
  'workbench.settings.def.devpanelLayout.footerShowPageContext.description':
    'Beschriftet die Timing-Meilensteine in der Statusleiste des DevTools-Panels mit der Seite, die sie ' +
    'beschreiben — nützlich, wenn das Protokoll über mehrere Navigationen hinweg beibehalten wird.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.label': 'Timing-Umfang der Fußzeile',
  'workbench.settings.def.devpanelLayout.footerTimingMode.description':
    'Welche Navigation die Meilensteine Finish / DOMContentLoaded / Load in der Statusleiste des ' +
    'DevTools-Panels beschreiben. Aggregiert umspannt die ganze Zeitleiste des beibehaltenen Protokolls seit ' +
    'der ersten Navigation (wie der Browser); Nur die aktuelle Seite meldet nur die letzte Navigation.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.label': 'Aggregiert (alle Navigationen)',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.description':
    'Finish / DCL / Load umspannen die ganze Zeitleiste seit der ersten Navigation — der Browser-Standard.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.label': 'Nur die aktuelle Seite',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.description':
    'Finish / DCL / Load melden nur die letzte Navigation, verankert an ihrem Start.',
  'workbench.settings.def.devpanelLayout.footerScope.label': 'Zusammenfassungs-Umfang der Fußzeile',
  'workbench.settings.def.devpanelLayout.footerScope.description':
    'Was die Statusleiste des DevTools-Panels zusammenfasst. Fokussiertes Tool folgt dem Werkzeugfenster, in ' +
    'dem du arbeitest (Storage, Console und die Suche haben eigene Zusammenfassungszeilen); Nur das ' +
    'Network-Tool zeigt immer die Network-Zahlen.',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.label': 'Fokussiertes Tool',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.description':
    'Die Fußzeile folgt dem fokussierten Werkzeugfenster — Storage, Console und die Suche zeigen eigene ' +
    'Zusammenfassungen; andere Tools fallen auf die Network-Zeile zurück.',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.label': 'Nur das Network-Tool',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.description':
    'Die Fußzeile zeigt immer die Network-Zahlen, egal welches Werkzeugfenster den Fokus hat.',
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.label':
    'Panel-Umschalter in der oberen Leiste anzeigen',
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.description':
    'Zeigt die Umschalt-Icons für das linke / untere / rechte Panel in der oberen Leiste des DevTools-Panels.',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.label': 'Layout-Menü in der oberen Leiste anzeigen',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.description':
    'Zeigt das Layout-Dropdown (unteres Panel in voller Breite, Werkzeugfenster-Namen, Layout der ' +
    'Aktivitätsleiste) in der oberen Leiste des DevTools-Panels.',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.label': 'Ausrichtung des unteren Panels',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.description':
    'Wo das untere Panel im DevTools-Panel sitzt. Links/rechts richtet es unter einer Seitenleiste + dem ' +
    'Editor aus; zentriert verschachtelt es in der mittleren Spalte; Blocksatz umspannt die volle Breite.',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.label': 'Zentriert',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.description':
    'Unteres Panel in der mittleren Spalte verschachtelt',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.label': 'Links',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.description':
    'Unteres Panel umspannt linke Seitenleiste + Editor',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.label': 'Rechts',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.description':
    'Unteres Panel umspannt Editor + rechte Seitenleiste',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.label': 'Blocksatz',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.description':
    'Unteres Panel umspannt die volle Breite des DevTools-Panels',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.label': 'Aufteilung des unteren Panels',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.description':
    'Wie sich zwei geöffnete untere Docks das untere Panel teilen: nebeneinander oder übereinander.',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.columns.label': 'Nebeneinander',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.columns.description':
    'Untere Docks liegen nebeneinander',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.rows.label': 'Gestapelt',
  'workbench.settings.def.devpanelLayout.bottomPanelSplit.option.rows.description': 'Untere Docks liegen übereinander',
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.label': 'Werkzeugfenster-Namen anzeigen',
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.description':
    'Rendert Textbeschriftungen neben den Icons der Aktivitätsleiste und der Dock-Tabs im DevTools-Panel. ' +
    'Standardmäßig deaktiviert, weil das Panel schmaler ist als der Arbeitsbereich.',
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.label': 'Breite der linken Aktivitätsleiste',
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.description':
    'Breite der linken Aktivitätsleiste im DevTools-Panel, wenn die Werkzeugfenster-Namen sichtbar sind. Im ' +
    'Nur-Icons-Modus auf 36px festgelegt.',
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.label': 'Breite der rechten Aktivitätsleiste',
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.description':
    'Breite der rechten Aktivitätsleiste im DevTools-Panel, wenn die Werkzeugfenster-Namen sichtbar sind. Im ' +
    'Nur-Icons-Modus auf 36px festgelegt.',
  'workbench.settings.def.devpanelLayout.sidebarLayout.label': 'Layout der Aktivitätsleiste',
  'workbench.settings.def.devpanelLayout.sidebarLayout.description':
    'Wie die Aktivitätsleiste die obere und untere Werkzeugfenster-Gruppe im DevTools-Panel aufteilt.',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.label': 'Proportional',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.description':
    'Obere und untere Gruppe teilen sich die Aktivitätsleiste 50/50',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.label': 'Kompakt',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.description':
    'Obere Gruppe passt sich dem Inhalt an; untere unten fixiert',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.label': 'Gestapelt',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.description':
    'Alle Gruppen oben gebündelt, mit Teilern dazwischen',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.label': 'Dynamisch',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.description':
    'Chip-Gruppen spiegeln die Höhen ihrer angrenzenden Panels. Geschlossene Docks kollabieren auf den Inhalt, ' +
    'und aktive Nachbarn nehmen den Platz auf.',

  // ── DevTools Panel · Network category defs ─────────────────────────
  'workbench.settings.def.devpanelNetwork.layout.label': 'Network-Layout',
  'workbench.settings.def.devpanelNetwork.layout.description':
    'Wie die Network-Tabelle den horizontalen Platz aufnimmt. Kompakt lässt dehnbare Spalten (Name, Waterfall) ' +
    'auf die Panelbreite flexen, sodass die Tabelle nie horizontal scrollt; Breit deckelt diese Spalten und ' +
    'scrollt für den Rest horizontal.',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.label': 'Kompakt',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.description':
    'Dehnbare Spalten nehmen die Panelbreite auf.',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.label': 'Breit',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.description':
    'Gedeckelte Breiten, scrollt bei Bedarf horizontal.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.label': 'Messages-Layout',
  'workbench.settings.def.devpanelNetwork.messagesLayout.description':
    'Wie das Frame-Raster von Messages den horizontalen Platz aufnimmt. Kompakt lässt die Data-Spalte auf die ' +
    'Bereichsbreite flexen, sodass das Raster nie horizontal scrollt; Breit deckelt sie und scrollt bei Bedarf ' +
    'horizontal.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.label': 'Kompakt',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.description':
    'Die Data-Spalte nimmt die Bereichsbreite auf.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.label': 'Breit',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.description':
    'Gedeckelte Breiten, scrollt bei Bedarf horizontal.',
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.label': 'Payload-Vorschau anzeigen',
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.description':
    'Zeigt den Payload-Vorschaubereich unter den Rastern Messages / EventStream — die größenverstellbare ' +
    'Teilung, in der der ausgewählte Frame oder das Ereignis als JSON-Baum, Rohtext oder Binär-Viewer ' +
    'gerendert wird. Schalte sie aus, um dem Raster den ganzen Bereich zu geben.',
  'workbench.settings.def.devpanelNetwork.sortKind.label': 'Quelle der Network-Sortierung',
  'workbench.settings.def.devpanelNetwork.sortKind.description':
    'Welche Seite des Sortierzustands aktiv ist. `mode` führt einen der benannten zusammengesetzten ' +
    'Sortiermodi aus (Fehlschläge zuerst / Langsamste zuerst / …). `column` führt die Einspalten-Sortierung ' +
    'aus, die per Klick auf eine Spaltenüberschrift gewählt wurde. Das Panel wechselt automatisch — ein Klick ' +
    'auf eine Spaltenüberschrift stellt dies auf `column`; die Wahl eines Modus im Ansicht-Menü stellt es auf ' +
    '`mode`.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.label': 'Modus',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.description':
    'Einen benannten zusammengesetzten Sortiermodus verwenden.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.label': 'Spalte',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.description':
    'Die angeklickte Einspalten-Sortierung verwenden.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.label': 'Benutzerdefiniert (verschachtelt)',
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.description':
    'Die selbst gebaute Mehrschlüssel-Sortierkette verwenden.',
  'workbench.settings.def.devpanelNetwork.sortMode.label': 'Network-Sortiermodus',
  'workbench.settings.def.devpanelNetwork.sortMode.description':
    'Benannte zusammengesetzte Sortierreihenfolge — Hauptachse, dann Ankunft als Gleichstand. Aktiv, wenn die ' +
    'Sortierquelle = `mode` ist.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.label': 'Fehlschläge zuerst',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.description':
    'Fehlgeschlagen → ausstehend → umgeleitet → Erfolg.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.label': 'Langsamste zuerst',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.description': 'Längste Dauer zuerst.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.label': 'Größte zuerst',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.description': 'Meiste Wire-Bytes zuerst.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.label': 'Browser-Priorität',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.description':
    'Gemeldete Priorität von Highest → Lowest.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.label': 'Nach Ressourcentyp',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.description':
    'Nach Ressourcentyp gruppiert, Ankunft innerhalb der Gruppe.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.label': 'Nach Domain',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.description':
    'Nach Hostname gruppiert, Ankunft innerhalb der Domain.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.label': 'Regelverändert zuerst',
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.description':
    'Angewendete Regeln zuerst, Ankunft innerhalb der Gruppe.',
  'workbench.settings.def.devpanelNetwork.sortBy.label': 'Network-Sortierspalte',
  'workbench.settings.def.devpanelNetwork.sortBy.description':
    'Welche Spalte die Spaltenklick-Sortierung antreibt. Aktiv, wenn die Sortierquelle = `column` ist. Ein ' +
    'Klick auf eine Spaltenüberschrift aktualisiert diesen Wert.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.label': 'Waterfall',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.description':
    'Zeitleiste nach der aktiven Waterfall-Metrik (standardmäßig Startzeit).',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.label': 'Request #',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.description':
    'Anfragenummer — die Reihenfolge, in der Anfragen entdeckt wurden.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.label': 'Method',
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.description': 'HTTP-Methode.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.label': 'Name',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.description': 'Letztes Segment der URL.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.label': 'Path',
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.description': 'Pfad + Query.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.label': 'URL',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.description': 'Vollständige URL.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.label': 'Status',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.description': 'Statuscode der Antwort.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.label': 'Protocol',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.description': 'HTTP-Version.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.label': 'Scheme',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.description': 'http / https.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.label': 'Domain',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.description': 'Host-Teil der URL.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.label': 'Remote address',
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.description': 'Server-IP.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.label': 'Type',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.description': 'Ressourcentyp.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.label': 'Initiator',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.description': 'Was die Anfrage ausgelöst hat.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.label': 'Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.description': 'Anzahl der Anfrage-Cookies.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.label': 'Set Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.description': 'Anzahl der Set-Cookie der Antwort.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.label': 'Size',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.description': 'Wire-Bytes.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.label': 'Time',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.description': 'Gesamtdauer der Anfrage.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.label': 'Priority',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.description': 'Vom Browser zugewiesene Priorität.',
  'workbench.settings.def.devpanelNetwork.sortDir.label': 'Network-Sortierrichtung',
  'workbench.settings.def.devpanelNetwork.sortDir.description':
    'Auf- oder absteigende Reihenfolge für die aktuelle Network-Sortierspalte.',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.label': 'Aufsteigend',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.description': 'Niedrigste zuerst.',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.label': 'Absteigend',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.description': 'Höchste zuerst.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.label': 'Waterfall-Metrik',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.description':
    'Nach welcher Zeit die Waterfall-Spalte sortiert und zeichnet. Start / Response / End time setzen die ' +
    'Balken auf eine absolute Zeitleiste; Total duration und Latency richten die Balken auf null aus, damit ' +
    'sich die Längen direkt vergleichen lassen.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.label': 'Start time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.description': 'Wann die Anfrage begann.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.label': 'Response time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.description':
    'Wann das erste Antwort-Byte ankam.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.label': 'End time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.description': 'Wann die Anfrage fertig war.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.label': 'Total duration',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.description':
    'Wie lange die Anfrage von Ende zu Ende dauerte.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.label': 'Latency',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.description':
    'Zeit bis zum ersten Antwort-Byte.',
  'workbench.settings.def.devpanelNetwork.showFireDots.label': 'Regel-Auslösungspunkte anzeigen',
  'workbench.settings.def.devpanelNetwork.showFireDots.description':
    'Zeigt die führende 14px-Spalte mit dem farbigen Punkt, der Regeltreffer markiert (gefüllt = eine Regel ' +
    'wurde tatsächlich angewendet, hohl = abgeleitet). Schalte sie aus, um die horizontalen Pixel in dichten ' +
    'Bereichen zurückzugewinnen.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.label': 'Waterfall-Werte',
  'workbench.settings.def.devpanelNetwork.waterfallValues.description':
    'Wann die Werte der aktiven Waterfall-Metrik auf dem Balken stehen — der Chip mit Start / Response / End ' +
    'time bei den Zeitleisten-Metriken oder die Warte-/Download-Beschriftungen bei Total duration und Latency.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.label': 'Immer',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.description': 'Den Wert-Chip sichtbar lassen.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.label': 'Beim Überfahren',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.description':
    'Den Wert-Chip beim Überfahren der Zeile einblenden.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.label': 'Aus',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.description': 'Den Wert-Chip ausblenden.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.label': 'Waterfall-Wertformat',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.description':
    'Wie sich der Wert einer Zeitleisten-Metrik liest: Relativ ist der Versatz zur ersten sichtbaren Anfrage; ' +
    'Zeitstempel ist der absolute Uhrzeit-Moment. Total duration und Latency sind unabhängig davon immer ' +
    'Dauern.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.label': 'Relativ',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.description':
    'Versatz zur ersten sichtbaren Anfrage.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.label': 'Zeitstempel',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.description':
    'Absoluter Uhrzeit-Moment.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.label': 'Zeitzone der Waterfall-Zeitstempel',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.description':
    'Zeitzone für das Wertformat Zeitstempel — lokale Zeit oder UTC.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.label': 'Lokal',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.description': 'Deine lokale Zeitzone.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.label': 'UTC',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.description': 'Koordinierte Weltzeit.',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.label': 'Waterfall-Wert erklären',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.description':
    'Markiert im Hover-Popover der Waterfall die Phasenzeilen, aus denen sich der Gesamtwert zusammensetzt, ' +
    'hebt sie hervor und zeigt ihre Summe als Formel. Reine visuelle Hilfe — es ändert keine Werte.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.label': 'Layout des Waterfall-Popovers',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.description':
    'Ausrichtung der Timing-Aufschlüsselung beim Überfahren der Waterfall. Kompakt stapelt die Schritte im ' +
    'Popover untereinander; Breit legt dieselbe Leiter auf eine Zeitachse; Auto wählt nach Panelbreite — ' +
    'breit bei einem unten angedockten Panel, kompakt bei einem schmalen (seitlich angedockten).',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.label': 'Kompakt',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.description':
    'Schritte im Popover untereinander gestapelt.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.label': 'Breit',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.description':
    'Schritte auf einer horizontalen Zeitachse.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.label': 'Auto',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.description':
    'Breit bei breitem Panel, sonst kompakt.',

  // ── DevTools Panel · Headers category defs ─────────────────────────
  'workbench.settings.def.devpanelHeaders.layout.label': 'Headers-Layout',
  'workbench.settings.def.devpanelHeaders.layout.description':
    'Wie die Header-Zeilen in den Anfrage-/Antwort-Abschnitten organisiert sind. Gruppiert bündelt die Zeilen ' +
    'nach Kategorie (Auth, CORS, Caching, …); Flach rendert eine einzige Liste in der gewählten ' +
    'Sortierreihenfolge.',
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.label': 'Gruppiert',
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.description': 'Zeilen nach Kategorie gebündelt.',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.label': 'Flach',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.description':
    'Eine einzige Liste, ohne Kategorie-Überschriften (im Stil von Chrome).',
  'workbench.settings.def.devpanelHeaders.sortMode.label': 'Headers-Sortierung',
  'workbench.settings.def.devpanelHeaders.sortMode.description':
    'Zeilenreihenfolge innerhalb jeder Liste (und jeder Gruppe, wenn gruppiert). Original bewahrt die ' +
    'Reihenfolge, in der der Server die Header gesendet hat (HAR-Reihenfolge); A → Z sortiert nach Name; ' +
    'Regelveränderte zuerst hebt regelveränderte Zeilen nach oben.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.label': 'Original',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.description': 'HAR-Reihenfolge.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.az.description': 'Alphabetisch.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.label': 'Regelveränderte zuerst',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.description': 'Regelveränderte Zeilen oben.',
  'workbench.settings.def.devpanelHeaders.nameCase.label': 'Schreibweise der Header-Namen',
  'workbench.settings.def.devpanelHeaders.nameCase.description':
    'Wie Header-Namen angezeigt werden. Train-Case kanonisiert jeden Namen (`Content-Type`, `Set-Cookie`, ' +
    '`ETag`) passend zu den DevTools von Chrome/Firefox — leichter zu überfliegen. Original behält die rohe ' +
    'Schreibweise, die der Server gesendet hat (HTTP/2+ schreibt auf der Leitung alles klein).',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.label': 'Original',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.description':
    'Genau das, was der Server gesendet hat (bei HTTP/2+ oft kleingeschrieben).',
  'workbench.settings.def.devpanelHeaders.showChips.label': 'Wert-Tags anzeigen',
  'workbench.settings.def.devpanelHeaders.showChips.description':
    'Zeigt die Tags pro Wert an den Header-Zeilen (Cache-Control / Set-Cookie / HSTS / JWT-Decodierung, …). ' +
    'Schalte sie aus für eine knappe Ansicht nur mit Werten.',
  'workbench.settings.def.devpanelHeaders.showInsights.label': 'Vorschläge anzeigen',
  'workbench.settings.def.devpanelHeaders.showInsights.description':
    'Zeigt die handlungsleitenden Warnkarten oben im Headers-Tab (CORS-Fehlkonfigurationen, fehlendes ' +
    'CSP/HSTS, unsichere Cookies, abgelaufenes JWT, …).',
  'workbench.settings.def.devpanelHeaders.hideNoise.label': 'Rausch-Header ausblenden',
  'workbench.settings.def.devpanelHeaders.hideNoise.description':
    'Klappt Header mit wenig Signal ein (Accept-*, Sec-Fetch-*, Sec-CH-UA-*, User-Agent, Connection, …). Der ' +
    'Hinweis unter jedem Abschnitt listet die ausgeblendeten Namen beim Überfahren.',
  'workbench.settings.def.devpanelHeaders.ruleOnly.label': 'Nur Regelveränderte',
  'workbench.settings.def.devpanelHeaders.ruleOnly.description':
    'Zeigt nur Header, die von einer Regel von Open Headers hinzugefügt, verändert oder entfernt wurden.',
  'workbench.settings.def.devpanelHeaders.securityOnly.label': 'Nur Sicherheits-Header',
  'workbench.settings.def.devpanelHeaders.securityOnly.description':
    'Zeigt nur sicherheitsbezogene Header (CSP, HSTS, X-Frame-Options, Permissions-Policy, …).',
  'workbench.settings.def.devpanelHeaders.overridableOnly.label': 'Nur überschreibbare Header',
  'workbench.settings.def.devpanelHeaders.overridableOnly.description':
    'Blendet geschützte Header aus, die der Browser Regeln nicht überschreiben lässt (host, content-length, ' +
    'sec-ch-ua, …).',

  // ── DevTools Panel · Initiator category defs ───────────────────────
  'workbench.settings.def.devpanelInitiator.sortMode.label': 'Sortierung der Initiator-Kinder',
  'workbench.settings.def.devpanelInitiator.sortMode.description':
    'Wie Kind-Anfragen innerhalb der Initiator-Kette geordnet werden. Initiator-Reihenfolge bewahrt den ' +
    'ursprünglichen Durchlauf des Initiator-Graphen; Chronologisch ordnet nach Anfragezeit; Größter Teilbaum ' +
    'setzt den schwersten Teilbaum nach vorn.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.label': 'Initiator-Reihenfolge',
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.description': 'Wie entdeckt.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.label': 'Chronologisch',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.description': 'Nach Anfragezeit.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.label': 'Größter Teilbaum',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.description': 'Schwerste Teilbäume zuerst.',
  'workbench.settings.def.devpanelInitiator.showInsights.label': 'Vorschläge anzeigen',
  'workbench.settings.def.devpanelInitiator.showInsights.description':
    'Zeigt die handlungsleitenden Hinweise oben im Initiator-Tab (fehlgeschlagene Unteranfragen, dominanter ' +
    'Host, Drittanbieter-Anteil, …).',
  'workbench.settings.def.devpanelInitiator.failuresOnly.label': 'Nur Fehlschläge',
  'workbench.settings.def.devpanelInitiator.failuresOnly.description':
    'Zeigt nur fehlgeschlagene oder blockierte Zeilen in der Initiator-Kette.',
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.label': 'Nur Drittanbieter',
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.description':
    'Zeigt nur Zeilen von Origins, die sich von der Origin der Seite unterscheiden.',

  // ── DevTools Panel · Cookies category defs ─────────────────────────
  'workbench.settings.def.devpanelCookies.sortMode.label': 'Cookies-Sortierung',
  'workbench.settings.def.devpanelCookies.sortMode.description':
    'Zeilenreihenfolge innerhalb jedes Cookies-Abschnitts. Original bewahrt die Reihenfolge, die Server / ' +
    'Anfrage verwendet haben; A → Z sortiert nach Name; Size sortiert nach serialisierter Cookie-Größe; ' +
    'Expires setzt die am frühesten ablaufenden nach vorn (Session ans Ende).',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.label': 'Original',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.description': 'Wie gesendet / gesetzt.',
  'workbench.settings.def.devpanelCookies.sortMode.option.az.description': 'Alphabetisch nach Name.',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.label': 'Size',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.description': 'Größtes Cookie zuerst.',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.label': 'Expires',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.description': 'Nächster Ablauf zuerst.',
  'workbench.settings.def.devpanelCookies.expiresFormat.label': 'Expires-Format',
  'workbench.settings.def.devpanelCookies.expiresFormat.description':
    'Wie der Cookie-Ablauf gerendert wird. Relativ zeigt „in 2 d“, „vor 30 s“, „Session“; Absolut zeigt das ' +
    'geparste UTC-Datum.',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.relative.label': 'Relativ',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.label': 'Absolut',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.description': 'UTC-Datum.',
  'workbench.settings.def.devpanelCookies.showChips.label': 'Tags anzeigen',
  'workbench.settings.def.devpanelCookies.showChips.description':
    'Zeigt die Rollen- / Lebenszyklus- / Kontext-Tags neben jedem Cookie-Namen (auth? / tracking? / pref / ' +
    'gerade gesetzt / verworfen / Drittanbieter / partitioniert / …). Schalte sie aus für eine knappe Ansicht ' +
    'nur mit Spalten.',
  'workbench.settings.def.devpanelCookies.showInsights.label': 'Vorschläge anzeigen',
  'workbench.settings.def.devpanelCookies.showInsights.description':
    'Zeigt die handlungsleitenden Warnkarten oben im Cookies-Tab (SameSite=None ohne Secure, Verstöße gegen ' +
    'die Präfixe __Host- / __Secure-, übergroße Cookies, abgelaufen-aber-gesendet, …).',
  'workbench.settings.def.devpanelCookies.decodeValues.label': 'URL-codierte Werte decodieren',
  'workbench.settings.def.devpanelCookies.decodeValues.description':
    'Zeigt Cookie-Werte mit decodierter Prozent-Codierung („Europe%2FMadrid“ → „Europe/Madrid“). Fahre über ' +
    'den Wert, um die Rohform zu sehen.',
  'workbench.settings.def.devpanelCookies.groupByRole.label': 'Nach Rolle gruppieren',
  'workbench.settings.def.devpanelCookies.groupByRole.description':
    'Gruppiert Cookies innerhalb jedes Abschnitts nach ihrer abgeleiteten Rolle — Auth und Sitzung zuerst, ' +
    'dann Funktional, Präferenzen, Analytik und Tracking. Heuristikgetrieben; die Rollen-Chips (auth? / ' +
    'tracking? / pref) tragen das Fragezeichen als Erinnerung.',
  'workbench.settings.def.devpanelCookies.showFilteredOut.label': 'Ausgefilterte Anfrage-Cookies anzeigen',
  'workbench.settings.def.devpanelCookies.showFilteredOut.description':
    'Spiegelt den Umschalter „show filtered out request cookies“ von Chrome — listet auch Cookies aus dem ' +
    'Cookie-Glas, die auf dieser Anfrage wegen abweichender Pfad- / Secure- / SameSite- / Ablauf-Bedingungen ' +
    'nicht gesendet wurden.',
  'workbench.settings.def.devpanelCookies.problemsOnly.label': 'Nur Probleme',
  'workbench.settings.def.devpanelCookies.problemsOnly.description':
    'Zeigt nur Cookies, die eine Warnung ausgelöst haben — fehlendes Secure, Präfix-Verstoß, ' +
    'abgelaufen-aber-gesendet, …',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.label': 'Nur Drittanbieter',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.description':
    'Zeigt nur Cookies, deren Domain cross-site zur Origin des obersten Frames ist.',
  'workbench.settings.def.devpanelCookies.ruleOnly.label': 'Nur Regelveränderte',
  'workbench.settings.def.devpanelCookies.ruleOnly.description':
    'Zeigt nur Cookies, deren Cookie- / Set-Cookie-Zeile von einer Regel hinzugefügt, verändert oder entfernt ' +
    'wurde.',

  // ── DevTools Panel · Timing category defs ──────────────────────────
  'workbench.settings.def.devpanelTiming.showInsights.label': 'Vorschläge anzeigen',
  'workbench.settings.def.devpanelTiming.showInsights.description':
    'Zeigt die Engpass- und Pro-Phase-Warnkarten oben im Timing-Tab. Schalte sie aus für eine Ansicht nur mit ' +
    'Zahlen.',
  'workbench.settings.def.devpanelTiming.showContextStrip.label': 'Kontextleiste anzeigen',
  'workbench.settings.def.devpanelTiming.showContextStrip.description':
    'Zeigt die Chip-Zeile Protokoll / Verbindung / Cache / Priorität / Start / Server-IP über der ' +
    'Phasenaufschlüsselung.',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.label': 'Phasenaufschlüsselung anzeigen',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.description':
    'Zeigt die Abschnitte Resource Scheduling / Connection Start / Request-Response mit den ' +
    'Millisekunden-Zeilen pro Phase.',
  'workbench.settings.def.devpanelTiming.showTimingBar.label': 'Timing-Balken anzeigen',
  'workbench.settings.def.devpanelTiming.showTimingBar.description':
    'Zeigt den proportionalen segmentierten Balken mit der Legende pro Phase (und der Total-Zeile darunter).',
  'workbench.settings.def.devpanelTiming.showServerTiming.label': 'Server-Timing anzeigen',
  'workbench.settings.def.devpanelTiming.showServerTiming.description':
    'Zeigt die geparsten Metriken des Antwort-Headers `Server-Timing`, wenn der Server welche gesendet hat.',
  'workbench.settings.def.devpanelTiming.showRepeats.label': 'Wiederholungen der Sitzung anzeigen',
  'workbench.settings.def.devpanelTiming.showRepeats.description':
    'Zeigt den Vergleich mit dem schnellsten / mittleren / langsamsten Treffer derselben URL innerhalb der ' +
    'aktuellen Panel-Sitzung.',
  'workbench.settings.def.devpanelTiming.showTransferRate.label': 'Übertragungsrate anzeigen',
  'workbench.settings.def.devpanelTiming.showTransferRate.description':
    'Zeigt den effektiven Content-Download-Durchsatz (Body-Bytes ÷ Download-Zeit), wenn sowohl die Größe als ' +
    'auch der Empfangsabschnitt bekannt sind.',
} as const satisfies Catalog;
