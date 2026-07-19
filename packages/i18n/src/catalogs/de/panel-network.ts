/**
 * DevTools panel — traffic table plane — German. Mirrors
 * `catalogs/en/panel-network.ts` key for key. Parity vocabulary stays
 * raw (S34 lock): column names, waterfall metric names + ST/RT/ET/TD/L
 * tags, the eight timing rung names, terminal outcome labels,
 * 'Connection Start', wire vocabulary (GET, 2xx, h2, net::ERR_…, csp),
 * cURL / fetch / HAR, and every µs/ms/s figure. Mints: waterfall =
 * Wasserfall (m.); queue = Warteschlange; untracked gaps = nicht
 * erfasste Lücken; warm socket = warmer Socket; key moments =
 * Schlüsselmomente; band names Planung / Verbindungsaufbau /
 * Übertragung; synthesized row = synthetisierte Zeile; capture gap =
 * Erfassungslücke; preflight raw (m., shared-info-headers mint);
 * sort level = Ebene; tiebreak = Gleichstand.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelNetwork = {
  // ── Network tool window — header chrome + menus (station: traffic
  // menus) ─────────────────────────────────────────────────────────────
  // Raw by design (network-table parity vocabulary): the column names
  // (Name / Status / Type / … / Waterfall) everywhere they appear —
  // header cells, the column-visibility menu rows, the nested-sort
  // builder options, the closed-state sort subtitles — and the Waterfall
  // metric names (Start time / Response time / End time / Total duration
  // / Latency) plus their header tags (ST / RT / ET / TD / L). The menu
  // chrome AROUND them localizes; the vocabulary itself does not.
  'panel.network.filterSyntaxHelp': 'Hilfe zur Filtersyntax',
  'panel.network.aboutTypeFilters': 'Über die Anfragetyp-Filter',
  'panel.network.aboutSorting': 'Über die Sortierung',

  // Traffic table cells — resolved once per locale into the CellMessages
  // bundle (the row render loop is hot and never calls t() itself).
  'panel.network.cell.workerGearTitle': 'Anfrage vom Service Worker der Origin gestellt',
  'panel.network.cell.jumpToPreflight': 'Zur Preflight-Anfrage springen',
  'panel.network.cell.selectPreflightInitiator': 'Die Anfrage auswählen, die diesen Preflight ausgelöst hat',
  'panel.network.cell.pendingTitle': 'Anfrage noch nicht abgeschlossen',
  'panel.network.cell.pending': 'Ausstehend',
  'panel.network.gridAria': 'Netzwerkanfragen',
  'panel.network.noMatches': 'Keine passenden Anfragen.',
  'panel.network.reloadPage': 'Seite neu laden',
  'panel.network.startRecording': 'Aufzeichnung starten',

  // View ▾ menu
  'panel.network.view.label': 'Ansicht',
  'panel.network.view.layout': 'Layout',
  'panel.network.view.layoutCompact': 'Kompakt',
  'panel.network.view.layoutWide': 'Breit',
  'panel.network.view.valueNumber': 'Wertspalte',
  'panel.network.view.showValue': 'Wert anzeigen',
  'panel.network.view.valuesAlways': 'Immer',
  'panel.network.view.valuesHover': 'Beim Überfahren',
  'panel.network.view.valuesOff': 'Aus',
  'panel.network.view.valueFormat': 'Wertformat',
  'panel.network.view.formatRelative': 'Relativ',
  'panel.network.view.formatTimestamp': 'Zeitstempel',
  'panel.network.view.timezone': 'Zeitzone',
  'panel.network.view.tzLocal': 'Lokal',
  'panel.network.view.tzUtc': 'UTC',
  'panel.network.view.explainValue': 'Wert erklären',
  'panel.network.view.explainValueTitle':
    'Hebt im Hover-Popover die Zeilen hervor, aus denen sich der Gesamtwert zusammensetzt, und zeigt ihre Summe.',
  'panel.network.view.popover': 'Popover',
  'panel.network.view.popoverTitle':
    'Ausrichtung der Timing-Aufschlüsselung beim Überfahren. Auto wählt nach Panelbreite — horizontal bei ' +
    'breitem, vertikal bei schmalem Panel.',
  'panel.network.view.popoverAuto': 'Auto',
  'panel.network.view.popoverCompact': 'Kompakt',
  'panel.network.view.popoverWide': 'Breit',
  'panel.network.view.showFireDots': 'Regel-Auslösungspunkte anzeigen',

  // Sort ▾ menu
  'panel.network.sort.label': 'Sortieren',
  'panel.network.sort.heading': 'Sortierreihenfolge',
  'panel.network.sort.byTime': 'Nach Zeit sortieren.',
  'panel.network.sort.groupPriority': 'Priorität',
  'panel.network.sort.groupPriorityHint': 'Was zuerst deine Aufmerksamkeit braucht.',
  'panel.network.sort.groupGrouping': 'Gruppierung',
  'panel.network.sort.groupGroupingHint': 'Anfragen nach Kategorie bündeln.',
  'panel.network.sort.ascending': 'Aufsteigend',
  'panel.network.sort.descending': 'Absteigend',
  'panel.network.sort.customNested': 'Benutzerdefiniert (verschachtelt)',
  'panel.network.sort.customNestedIdle': 'Mehrschlüssel-Sortierung — Spalte für Spalte.',
  'panel.network.sort.customNestedLevels': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} Ebene — zum Bearbeiten öffnen.',
      other: '{count} Ebenen — zum Bearbeiten öffnen.',
    }),
  'panel.network.sort.noLevelsYet': 'Noch keine Ebenen — öffne den Builder.',
  'panel.network.sort.builderTitle': 'Sortieren nach, in dieser Reihenfolge',
  'panel.network.sort.builderEmpty': 'Noch keine Ebenen. Füge unten eine hinzu.',
  'panel.network.sort.asc': 'Aufst.',
  'panel.network.sort.desc': 'Abst.',
  'panel.network.sort.removeLevel': 'Ebene {n} entfernen',
  'panel.network.sort.addLevel': '+ Ebene hinzufügen',
  'panel.network.sort.finalTiebreak': 'Letzter Gleichstand: Startzeit',
  'panel.network.sort.active': 'Aktiv',
  'panel.network.sort.apply': 'Anwenden',
  'panel.network.sort.columnClick': 'Benutzerdefiniert (Spaltenklick)',
  'panel.network.sort.columnClickIdle': 'Klicke auf eine Spaltenüberschrift, um danach zu sortieren.',
  'panel.network.sort.columnClickUse': 'klicke auf eine Spaltenüberschrift, um dies zu nutzen',

  // Named sort modes (OH product vocabulary, not browser parity)
  'panel.network.sortMode.failures': 'Fehlschläge zuerst',
  'panel.network.sortMode.failuresSubtitle':
    'Fehlgeschlagen → ausstehend → umgeleitet → Erfolg · Startzeit innerhalb jeder Gruppe.',
  'panel.network.sortMode.slowest': 'Langsamste zuerst',
  'panel.network.sortMode.slowestSubtitle':
    'Längste Dauer zuerst · die Startzeit erhält bei Gleichstand die Wasserfall-Reihenfolge.',
  'panel.network.sortMode.largest': 'Größte zuerst',
  'panel.network.sortMode.largestSubtitle': 'Meiste Wire-Bytes zuerst · Startzeit bei Gleichstand.',
  'panel.network.sortMode.browserPriority': 'Browser-Priorität',
  'panel.network.sortMode.browserPrioritySubtitle':
    'Highest → Lowest nach der vom Browser gemeldeten Priorität · Startzeit innerhalb jeder Stufe.',
  'panel.network.sortMode.byType': 'Nach Ressourcentyp',
  'panel.network.sortMode.byTypeSubtitle':
    'Document → XHR/Fetch → Script → Style → Image → Font → Media → WS → Other · Startzeit innerhalb jeder ' +
    'Gruppe.',
  'panel.network.sortMode.byDomain': 'Nach Domain',
  'panel.network.sortMode.byDomainSubtitle': 'Nach Hostname gruppiert (A → Z) · Startzeit innerhalb jeder Domain.',
  'panel.network.sortMode.ruleModified': 'Regelverändert zuerst',
  'panel.network.sortMode.ruleModifiedSubtitle':
    'Angewendete Regeln → abgeleitet → keine Auslösung · Startzeit innerhalb jeder Gruppe.',

  // Waterfall sort submenu subtitles (the metric names above them stay raw)
  'panel.network.sortMetric.startTime': 'Wann die Anfrage begann.',
  'panel.network.sortMetric.responseTime': 'Wann das erste Antwort-Byte ankam.',
  'panel.network.sortMetric.endTime': 'Wann die Anfrage fertig war.',
  'panel.network.sortMetric.duration': 'Wie lange sie dauerte — Balken auf null ausgerichtet.',
  'panel.network.sortMetric.latency': 'Zeit bis zum ersten Byte — Balken auf null ausgerichtet.',

  // The two OH-native rails (also the rail-header popover titles)
  'panel.network.railFires': 'Regel-Auslösungen',
  'panel.network.railAnnotations': 'Anmerkungen',

  // Row context menu (menu-local keys; cURL / fetch / HAR ride raw)
  'panel.requestMenu.openInNewTab': 'In neuem Tab öffnen',
  'panel.requestMenu.createApiRequest': 'API-Anfrage erstellen',
  'panel.requestMenu.copy': 'Kopieren',
  'panel.requestMenu.copyUrl': 'URL kopieren',
  'panel.requestMenu.copyAsCurl': 'Als cURL kopieren',
  'panel.requestMenu.copyAsFetch': 'Als fetch kopieren',
  'panel.requestMenu.copyRequestHeaders': 'Anfrage-Header kopieren',
  'panel.requestMenu.copyResponseHeaders': 'Antwort-Header kopieren',
  'panel.requestMenu.copyResponse': 'Antwort kopieren',
  'panel.requestMenu.copyAsHar': 'Als HAR kopieren',
  'panel.requestMenu.copyAsHarSanitized': 'Als HAR kopieren (bereinigt)',
  'panel.requestMenu.copyAllUrls': 'Alle URLs kopieren',
  'panel.requestMenu.copyAllAsCurl': 'Alle als cURL kopieren',
  'panel.requestMenu.copyAllAsHar': 'Alle als HAR kopieren',
  'panel.requestMenu.copyAllAsHarSanitized': 'Alle als HAR kopieren (bereinigt)',
  'panel.requestMenu.blockRequests': 'Anfragen blockieren',
  'panel.requestMenu.blockUrl': 'Anfrage-URL blockieren',
  'panel.requestMenu.blockDomain': 'Anfrage-Domain blockieren',
  'panel.requestMenu.saveAs': 'Speichern unter...',
  'panel.requestMenu.saveThisAsHar': 'Diese als HAR speichern',
  'panel.requestMenu.saveThisAsHarSanitized': 'Diese als HAR speichern (bereinigt)',
  'panel.requestMenu.saveAllAsHar': 'Alle als HAR speichern',
  'panel.requestMenu.saveAllAsHarSanitized': 'Alle als HAR speichern (bereinigt)',

  // Filter-strip `(i)` corpora (pill vocabulary rides raw in the labels)
  'panel.network.typeInfo.title': 'Anfragetypen',
  'panel.network.typeInfo.summary':
    'Engt die Liste auf einen oder mehrere Anfragetypen ein. „All“ zeigt alles; wähle Typen zum Filtern oder ' +
    'kombiniere mehrere.',
  'panel.network.typeInfo.inlineHeading': 'Direkt sichtbar',
  'panel.network.typeInfo.fetchXhrDesc': 'API-Aufrufe — fetch() und XMLHttpRequest.',
  'panel.network.typeInfo.socketDesc': 'WebSocket-Verbindungen.',
  'panel.network.typeInfo.underMoreHeading': 'Unter More',
  'panel.network.typeInfo.docCssJsDesc': 'Dokumente, Stylesheets und Skripte.',
  'panel.network.typeInfo.fontImgMediaDesc': 'Schriften, Bilder und Audio / Video.',
  'panel.network.typeInfo.manifestWasmOtherDesc': 'Web-App-Manifeste, WebAssembly und alles Übrige.',
  'panel.network.sortInfo.summary':
    'Legt fest, wie die Anfrageliste geordnet ist. Fahre über eine Gruppe, um einen konkreten Modus zu wählen.',
  'panel.network.sortInfo.modesHeading': 'Modi',
  'panel.network.sortInfo.waterfallDesc': 'Nach Zeit — Start, Antwort, Ende, Dauer oder Latenz.',
  'panel.network.sortInfo.priorityDesc':
    'Was zuerst Aufmerksamkeit braucht — Fehlschläge, die Langsamsten, die Größten.',
  'panel.network.sortInfo.groupingDesc': 'Nach Typ, Domain oder Regelveränderung bündeln.',
  'panel.network.sortInfo.custom': 'Benutzerdefiniert',
  'panel.network.sortInfo.customDesc':
    'Klicke auf eine Spaltenüberschrift oder baue eine verschachtelte Mehrschlüssel-Sortierung.',

  // Network column `(i)` corpora. Titles are the raw column names
  // (they name the raw header cells); item labels are wire vocabulary
  // (GET, 2xx, h2, (pending), net::ERR_…, csp, ST/RT/…) and ride raw;
  // the kicker reuses the tool-window label key.
  'panel.network.colInfo.exampleCaption': 'Beispielanfrage',
  'panel.network.colInfo.name.summary':
    'Der Dateiname oder das letzte Pfadsegment der Ressource — der schnellste Weg, eine Zeile zu erkennen.',
  'panel.network.colInfo.name.description':
    'Das führende Symbol codiert den Ressourcentyp; Zeilen-Tooltip und Detailansicht tragen die volle URL, ' +
    'Header, Payload und Timing.',
  'panel.network.colInfo.path.summary': 'Alles nach dem Host — der URL-Pfad samt Query-String.',
  'panel.network.colInfo.url.summary':
    'Die vollständige Anfrage-URL: Schema, Host, Pfad und Query, von vorn bis hinten.',
  'panel.network.colInfo.requestNumber.summary':
    'Ein stabiler Index in der Reihenfolge, in der Anfragen während der Aufzeichnung entdeckt wurden, ab 1.',
  'panel.network.colInfo.requestNumber.description':
    'Er ändert sich beim Umsortieren nie und dient so zugleich als Verweis auf die ursprüngliche ' +
    'Erfassungsreihenfolge.',
  'panel.network.colInfo.method.summary': 'Das HTTP-Verb der Anfrage.',
  'panel.network.colInfo.method.commonVerbsHeading': 'Gängige Verben',
  'panel.network.colInfo.method.getDesc': 'Eine Ressource lesen — ohne Body, gefahrlos wiederholbar.',
  'panel.network.colInfo.method.postDesc': 'Anlegen oder absenden — trägt einen Anfrage-Body.',
  'panel.network.colInfo.method.putPatchDesc': 'Eine Ressource ersetzen oder teilweise aktualisieren.',
  'panel.network.colInfo.method.deleteDesc': 'Eine Ressource entfernen.',
  'panel.network.colInfo.status.summary':
    'Der HTTP-Antwortcode (z. B. 200, 404) oder ein kurzes Zustandslabel, wenn es keinen Code gibt.',
  'panel.network.colInfo.status.description':
    'Statusbereiche sind nicht farbcodiert. Ein echter Fehlschlag — ein Wire-Fehler, jedes 4xx/5xx oder eine ' +
    'CORS-Ablehnung — färbt die ganze Zeile rot; ein Cache-Treffer oder eine Zeile ohne Status graut die Zelle ' +
    'aus. Die Reason-Phrase (z. B. „Not Found“) steht im Zellen-Tooltip.',
  'panel.network.colInfo.status.codeRangesHeading': 'Codebereiche',
  'panel.network.colInfo.status.s2xxDesc': 'Erfolg — die Anfrage wurde empfangen und bearbeitet (z. B. 200 OK).',
  'panel.network.colInfo.status.s3xxDesc': 'Umleitung — folge dem Location-Header zur nächsten URL.',
  'panel.network.colInfo.status.s4xxDesc':
    'Client-Fehler — die Anfrage war fehlerhaft, nicht autorisiert oder das Ziel nicht gefunden.',
  'panel.network.colInfo.status.s5xxDesc': 'Server-Fehler — der Server konnte eine gültige Anfrage nicht erfüllen.',
  'panel.network.colInfo.status.insteadHeading': 'Statt eines Codes',
  'panel.network.colInfo.status.pendingDesc': 'Gesendet, aber noch keine Antwort — grau, solange unterwegs.',
  'panel.network.colInfo.status.failedDesc':
    'Ein Fehlschlag auf Leitungsebene (DNS, TLS, Timeout, Verbindungsabbruch); der net-stack-Code steht daneben.',
  'panel.network.colInfo.status.canceledDesc': 'Die Anfrage wurde vor dem Abschluss abgebrochen.',
  'panel.network.colInfo.status.blockedDesc':
    'Der Browser hat sie aus Policy-Gründen verweigert — z. B. csp, oder other für eine Erweiterung / einen ' +
    'Ad-Blocker.',
  'panel.network.colInfo.status.corsDesc': 'Eine Cross-Origin-Prüfung hat die Antwort abgelehnt.',
  'panel.network.colInfo.status.dataDesc': 'Eine data:-URL — inline bedient, hat das Netzwerk nie berührt.',
  'panel.network.colInfo.status.finishedDesc': 'Eine Antwort, die keinen Statuscode trug.',
  'panel.network.colInfo.protocol.summary':
    'Die HTTP-Version, die die Verbindung ausgehandelt hat, festgelegt beim Handshake.',
  'panel.network.colInfo.protocol.valuesHeading': 'Werte',
  'panel.network.colInfo.protocol.http11Desc': 'Textbasiert, eine Anfrage gleichzeitig pro Verbindung.',
  'panel.network.colInfo.protocol.h2Desc': 'HTTP/2 — binär und über eine einzige Verbindung gemultiplext.',
  'panel.network.colInfo.protocol.h3Desc': 'HTTP/3 — läuft auf QUIC über UDP für schnellere Handshakes.',
  'panel.network.colInfo.scheme.summary': 'Das URL-Schema — `https`, `http`, `ws` oder `wss`.',
  'panel.network.colInfo.domain.summary': 'Der Hostname, an den die Anfrage adressiert war.',
  'panel.network.colInfo.remoteAddress.summary': 'IP-Adresse und Port, die die Verbindung tatsächlich erreicht hat.',
  'panel.network.colInfo.remoteAddress.description':
    'Weicht von der Domain ab, wenn DNS mehrere IPs liefert, ein CDN per Anycast routet oder ein lokaler Proxy ' +
    'die Verbindung abfängt.',
  'panel.network.colInfo.type.summary':
    'Der vom Browser zugewiesene Ressourcentyp — er bestimmt das Zeilensymbol und die Filter-Chips über der ' +
    'Tabelle.',
  'panel.network.colInfo.type.examplesHeading': 'Beispiele',
  'panel.network.colInfo.type.documentDesc': 'Eine Top-Level- oder Frame-HTML-Navigation.',
  'panel.network.colInfo.type.fetchXhrDesc': 'Eine Datenanfrage aus JavaScript.',
  'panel.network.colInfo.type.scriptCssDesc': 'Seitenressourcen, die der Parser lädt.',
  'panel.network.colInfo.type.imgFontMediaDesc': 'Statische Assets.',
  'panel.network.colInfo.initiator.summary': 'Was den Versand der Anfrage ausgelöst hat.',
  'panel.network.colInfo.initiator.kindsHeading': 'Arten',
  'panel.network.colInfo.initiator.scriptDesc': 'Aus JavaScript ausgelöst — die Zelle verlinkt die Aufrufstelle.',
  'panel.network.colInfo.initiator.parserDesc':
    'Der HTML-Parser hat die Ressource gefunden (ein `<script>`, `<img>`, `<link>`…).',
  'panel.network.colInfo.initiator.redirectDesc': 'Eine `3xx`-Antwort hat den Browser hierher geschickt.',
  'panel.network.colInfo.initiator.otherDesc': 'Eine Navigation, ein Preload oder eine nicht zuordenbare Quelle.',
  'panel.network.colInfo.cookies.summary':
    'Wie viele Cookies der Browser im `Cookie`-Header der Anfrage mitgeschickt hat. Leer, wenn keine.',
  'panel.network.colInfo.setCookies.summary': 'Wie viele `Set-Cookie`-Header die Antwort zurückgab. Leer, wenn keine.',
  'panel.network.colInfo.setCookies.description':
    'Öffne den Cookies-Tab der Anfrage, um zu sehen, ob der Browser jeden einzelnen angenommen oder verworfen ' +
    'hat.',
  'panel.network.colInfo.size.summary':
    'Bytes, die über die Leitung gingen, einschließlich Antwort-Headern und Kompressions-Overhead.',
  'panel.network.colInfo.size.insteadHeading': 'Statt einer Zahl',
  'panel.network.colInfo.size.diskCacheDesc': 'Aus dem Festplatten-Cache bedient — nichts berührte das Netzwerk.',
  'panel.network.colInfo.size.memoryCacheDesc': 'Aus dem In-Memory-Cache der aktuellen Seite bedient.',
  'panel.network.colInfo.size.pendingDesc': 'Die Anfrage ist noch nicht abgeschlossen.',
  'panel.network.colInfo.time.summary':
    'Aktive Dauer vom Absenden der Anfrage bis zum letzten Antwort-Byte — Wartezeit in der Warteschlange ' +
    'zählt nicht.',
  'panel.network.colInfo.time.description':
    'Zeigt `0 ms` bei einer sofortigen Antwort; bleibt leer, solange eine Anfrage noch unterwegs ist.',
  'panel.network.colInfo.priority.summary':
    'Die Fetch-Priorität, die der Browser vergeben hat, von `Highest` bis `Lowest`.',
  'panel.network.colInfo.priority.description':
    'Ressourcen mit höherer Priorität werden früher angefragt und bekommen mehr von der Verbindung. Eine Seite ' +
    'kann mit dem `fetchpriority`-Attribut nachhelfen.',
  'panel.network.colInfo.waterfall.summary':
    'Ein Zeitachsenbalken pro Anfrage. Das Kopfzeilenmenü wählt die Metrik, angezeigt als kurzes Tag wie ' +
    '`Waterfall (ST)`.',
  'panel.network.colInfo.waterfall.metricTagsHeading': 'Metrik-Tags',
  'panel.network.colInfo.waterfall.stDesc':
    'Start time — Balken liegen auf einer gemeinsamen Zeitachse nach dem Beginn jeder Anfrage.',
  'panel.network.colInfo.waterfall.rtDesc': 'Response time — platziert nach der Ankunft des ersten Antwort-Bytes.',
  'panel.network.colInfo.waterfall.etDesc': 'End time — platziert nach dem Abschluss jeder Anfrage.',
  'panel.network.colInfo.waterfall.tdDesc':
    'Total duration — auf null ausgerichtete Balken, bemessen nach der vollen Anfragedauer.',
  'panel.network.colInfo.waterfall.lDesc':
    'Latency — auf null ausgerichtete Balken, geteilt dort, wo die Antwort begann.',

  // OH-native rail header popovers (the ● / ⚠ / ℹ glyphs ride raw)
  'panel.network.fireRail.summary': 'Ein Punkt markiert jede Anfrage, auf der eine deiner Regeln gewirkt hat.',
  'panel.network.fireRail.dotColorsHeading': 'Punktfarben',
  'panel.network.fireRail.appliedDesc':
    'Angewendet — die Regel-Engine hat die Ausführung bestätigt, unser In-Page-Reporter hat die Aktion ' +
    'bestätigt, oder die Änderung ist in den erfassten Headern sichtbar.',
  'panel.network.fireRail.inferredDesc':
    'Abgeleitet — die Regel traf, die Anwendung ließ sich für diese Anfrage nicht verifizieren.',
  'panel.network.fireRail.contradictedDesc':
    'Widerlegt — die Regel behauptete eine Header-Änderung, die die erfassten Header widerlegen.',
  'panel.network.annotationRail.summary':
    'Markiert, was OpenHeaders über das hinaus weiß, was die Spalten zeigen. Fahre über ein Zeichen für die ' +
    'Erklärung; klicke darauf, um die Details zu öffnen.',
  'panel.network.annotationRail.glyphsHeading': 'Zeichen',
  'panel.network.annotationRail.warnDesc':
    'Die Zeile ist nicht, was sie zu sein scheint — z. B. ein mitten im Download abgebrochener Transfer.',
  'panel.network.annotationRail.infoDesc':
    'Herkunfts- oder Genauigkeitskontext — nie abgeschlossen, Erfassungslücke, synthetisierte Zeile.',

  // ── Timing plane (waterfall popovers + ladder legend + Timing tab) ──
  // Raw by design: the eight rung names (Queueing / Stalled / DNS Lookup
  // / TCP / TLS / Request sent / Waiting for server / Content Download —
  // browser Timing-tab parity), the terminal outcome labels mirroring
  // the Status cell ((canceled), (blocked:…), CORS error, (failed)
  // net::ERR_…), the Connection Start section name, and every µs/ms/s
  // figure. The OH-invented band names, absent-step reasons, key-moment
  // narrative, and footnote sentences key.
  'panel.network.timing.band.beforeWire': 'Planung',
  'panel.network.timing.band.connecting': 'Verbindungsaufbau',
  'panel.network.timing.band.exchange': 'Übertragung',
  'panel.network.timing.where.beforeWire': '(Browser)',
  'panel.network.timing.where.connecting': '(Browser ↔ Netzwerk)',
  'panel.network.timing.where.exchange': '(Netzwerk)',
  'panel.network.timing.absent.reused': 'Verbindung wiederverwendet',
  'panel.network.timing.absent.notReached': 'nicht erreicht',
  'panel.network.timing.absent.na': 'n/a',
  'panel.network.timing.absent.unknown': 'keine Daten',
  'panel.network.timing.warmSocketTitle':
    'Kein TCP-Handshake auf der Uhr dieser Anfrage — der Socket bestand bereits (vermutlich preconnected). ' +
    'Nur TLS lief hier.',
  'panel.network.timing.warmSocketHint': 'warmer Socket',
  'panel.network.timing.moment.queued': 'Eingereiht',
  'panel.network.timing.moment.started': 'Gestartet',
  'panel.network.timing.moment.response': 'Antwort',
  'panel.network.timing.moment.ended': 'Beendet',
  'panel.network.timing.momentWhy.queued': 'Anfrage erstellt',
  'panel.network.timing.momentWhy.started': 'hat die Warteschlange verlassen',
  'panel.network.timing.momentWhy.response': 'erstes Byte (TTFB)',
  'panel.network.timing.momentWhy.ended': 'letztes Byte, fertig',
  'panel.network.timing.untrackedGaps': 'Nicht erfasste Lücken: {parts}',
  'panel.network.timing.chromeEquivalent':
    'Chrome-Äquivalent: Initial connection = TCP {tcp} + TLS {tls} = {total} (SSL darin gezeichnet)',
  'panel.network.timing.terminalDetail.noResponse': 'keine Antwort erhalten',
  'panel.network.timing.terminalDetail.neverReached': 'hat das Netzwerk nie erreicht',
  'panel.network.timing.keyMoments': 'Schlüsselmomente',
  'panel.network.timing.sinceFirstRequest': '(seit der ersten Anfrage)',
  'panel.network.timing.timingNotes': 'Timing-Notizen',
  'panel.network.timing.totalTime': 'Gesamtzeit',
  'panel.network.timing.queuedToEnded': '(eingereiht → beendet)',
  'panel.network.timing.connectionOpenedBy': '↳ Verbindung geöffnet von {name}',
  'panel.network.timing.notFinishedCaution': 'ACHTUNG: Die Anfrage ist noch nicht abgeschlossen!',
  'panel.network.timing.queuedAt': 'Eingereiht um {time}',
  'panel.network.timing.startedAt': 'Gestartet um {time}',
  // Separate referent from the rung-state 'not reached': this one marks an
  // instant tick a terminal request never got to.
  'panel.network.timing.tickNotReached': 'nicht erreicht',
  'panel.network.timing.onTheWire': '🌐 auf der Leitung',
  'panel.network.timing.cdpExplainer':
    'Aktiviere CDP und lade neu, bevor du navigierst, um die volle Verbindungsaufschlüsselung live zu sehen.',

  // Timing `(i)` corpora. Rung / terminal titles stay raw (they name the
  // raw rung rows and Status-cell labels); band, moment, key-moments, and
  // notes titles reuse the keys of the labels they name.
  'panel.network.rungInfo.kicker': 'Timing',
  'panel.network.rungInfo.kickerBrowser': 'Timing · Browser',
  'panel.network.rungInfo.kickerBrowserNetwork': 'Timing · Browser ↔ Netzwerk',
  'panel.network.rungInfo.kickerNetwork': 'Timing · Netzwerk',
  'panel.network.rungInfo.kickerInstant': 'Timing · Zeitpunkt',
  'panel.network.rungInfo.kickerOutcome': 'Timing · Ausgang',
  'panel.network.rungInfo.stripCaption': 'Beispielanfrage — {ms} ms von Anfang bis Ende',
  'panel.network.rungInfo.stripStop': 'markiert: wo die Anfrage stoppte — die späteren Phasen liefen nie',
  'panel.network.rungInfo.stripMarked': 'markiert: {label} bei {ms} ms',
  'panel.network.rungInfo.stripGaps': 'hervorgehoben: die nicht erfassten Lücken (3 + 4 ms)',
  'panel.network.rungInfo.stripHighlighted': 'hervorgehoben: {segs} ({ms} ms)',
  'panel.network.rungInfo.queueing.summary': 'Zeit, die die Anfrage im Browser wartete, bevor sie starten durfte.',
  'panel.network.rungInfo.queueing.description':
    'Der Browser stellt Anfragen für Ressourcen niedrigerer Priorität zurück, während wichtigere zuerst laden ' +
    'und der Festplatten-Cache geprüft wird. Unter HTTP/1.x wartet sie hier auch, wenn alle Sockets zum Host ' +
    'belegt sind.',
  'panel.network.rungInfo.stalled.summary':
    'Startfreigabe erteilt, aber wartend auf eine nutzbare Verbindung, bevor irgendeine Netzwerkarbeit ' +
    'beginnen konnte.',
  'panel.network.rungInfo.stalled.description':
    'Typischerweise das Warten auf einen freien Socket oder eine Proxy-Entscheidung. Endet in dem Moment, in ' +
    'dem der erste Netzwerkschritt (DNS, TCP oder Senden) beginnt.',
  'panel.network.rungInfo.dns.summary': 'Auflösen des Hostnamens zur IP-Adresse, mit der verbunden wird.',
  'panel.network.rungInfo.dns.description':
    'Zeigt „Verbindung wiederverwendet“, wenn die Anfrage auf einer bereits offenen Verbindung ritt — auf der ' +
    'Uhr dieser Anfrage war keine Auflösung nötig.',
  'panel.network.rungInfo.connect.summary': 'Nur der TCP-Handshake — der Round-Trip, der den Socket zum Server öffnet.',
  'panel.network.rungInfo.connect.description':
    'Der Timing-Tab von Chrome zeichnet einen „Initial connection“-Balken über diese UND die TLS-Aushandlung ' +
    '(sein SSL-Balken liegt darin). Wir trennen sie in eigene, überlappungsfreie Phasen, damit jede ' +
    'Millisekunde genau einmal zählt — TCP + TLS hier entspricht dem Initial-connection-Balken von Chrome.',
  'panel.network.rungInfo.ssl.summary':
    'Der TLS-Handshake — Schlüssel aushandeln und Zertifikate prüfen, damit die Verbindung verschlüsselt ist.',
  'panel.network.rungInfo.ssl.description':
    'Nur bei https://-Anfragen (n/a bei reinem http://). „Verbindung wiederverwendet“ bedeutet, dass eine ' +
    'frühere Anfrage diese Kosten auf demselben Socket schon bezahlt hat.',
  'panel.network.rungInfo.send.summary': 'Die Anfrage-Bytes — Header und etwaiger Body — auf die Leitung schieben.',
  'panel.network.rungInfo.send.description':
    'Bei Header-only-Anfragen meist deutlich unter einer Millisekunde; wächst mit großen Uploads.',
  'panel.network.rungInfo.wait.summary':
    'Vom letzten gesendeten Anfrage-Byte bis zum ersten empfangenen Antwort-Byte (Time to First Byte).',
  'panel.network.rungInfo.wait.description':
    'Server-Denkzeit plus ein Netzwerk-Round-Trip — die Phase, in der Backend-Arbeit sichtbar wird.',
  'panel.network.rungInfo.receive.summary': 'Herunterladen des Antwort-Bodys, vom ersten bis zum letzten Byte.',
  'panel.network.rungInfo.receive.description':
    'Wächst live, solange eine Antwort noch streamt; die Warnzeile unter dem Diagramm markiert einen Download, ' +
    'der nie fertig wurde.',
  'panel.network.rungInfo.notes.summary':
    'Buchführung über die Zeitsplitter zwischen den Phasen — von Anfang bis Ende erfasst, aber keiner Phase ' +
    'zugehörig.',
  'panel.network.rungInfo.notes.description':
    'Jede Phase wird zwischen ihren eigenen Start- und Stopp-Zeitpunkten gemessen, die Gesamtzeit dagegen von ' +
    'Anfang bis Ende — deshalb können winzige „nicht erfasste Lücken“ zwischen zwei Phasen liegen (z. B. ' +
    'zwischen der DNS-Antwort und dem Beginn des TCP-Handshakes). Sie sind der Grund, warum die Phasen nicht ' +
    'immer zur Gesamtzeit aufsummieren. Der Timing-Tab von Chrome hat dieselben Lücken und zeichnet sie ' +
    'schlicht nicht; wir listen sie, damit jede Millisekunde erfasst bleibt.',
  'panel.network.rungInfo.notes.linesHeading': 'Die Zeilen',
  'panel.network.rungInfo.notes.gapsLabel': 'Nicht erfasste Lücken',
  'panel.network.rungInfo.notes.gapsDesc': 'Jede Lücke, benannt nach den Phasen um sie herum, mit ihrer Dauer.',
  'panel.network.rungInfo.notes.chromeLabel': 'Chrome-Äquivalent',
  'panel.network.rungInfo.notes.chromeDesc':
    'Wie unsere getrennten TCP- + TLS-Phasen auf den einzelnen „Initial connection“-Balken von Chrome ' +
    'abbilden (sein SSL-Balken liegt in diesem Balken, nicht dahinter).',
  'panel.network.rungInfo.band.beforeWire.summary':
    'Zeit, die vollständig im Browser vergeht, bevor irgendeine Netzwerkarbeit beginnt — noch hat nichts die ' +
    'Maschine verlassen.',
  'panel.network.rungInfo.band.beforeWire.description':
    'Queueing (Warten auf die Startfreigabe) plus Stalled (Warten auf eine nutzbare Verbindung). Eine Anfrage, ' +
    'die hier viel Zeit verliert, wird lokal zurückgehalten — durch Prioritäten, Verbindungslimits oder ' +
    'Proxy-Entscheidungen — nicht vom Server.',
  'panel.network.rungInfo.band.connecting.summary':
    'Den Weg zum Server aufbauen: Name auflösen, Socket öffnen, verschlüsseln.',
  'panel.network.rungInfo.band.connecting.description':
    'DNS Lookup + TCP + TLS — die Handshake-Round-Trips. Einmal pro Verbindung fällig: Eine Anfrage auf einem ' +
    'bereits offenen Socket überspringt dieses ganze Band („Verbindung wiederverwendet“).',
  'panel.network.rungInfo.band.exchange.summary':
    'Der eigentliche Austausch über die Leitung: Anfrage senden, auf den Server warten, Antwort herunterladen.',
  'panel.network.rungInfo.band.exchange.description':
    'Request sent + Waiting for server (TTFB) + Content Download. Serverseitige Langsamkeit zeigt sich in ' +
    'Waiting; große Antworten oder langsame Leitungen in Content Download.',
  'panel.network.rungInfo.moment.queued.summary':
    'Der Zeitpunkt, an dem der Browser die Anfrage erstellte — der Nullpunkt, von dem jede Phase dieser ' +
    'Aufschlüsselung misst.',
  'panel.network.rungInfo.moment.queued.description':
    'Der „um“-Wert ist der Versatz zur ersten Anfrage im Blick, damit sich Zeilen auf einer gemeinsamen Uhr ' +
    'vergleichen lassen.',
  'panel.network.rungInfo.moment.started.summary':
    'Der Zeitpunkt, an dem die Anfrage die Warteschlange verließ und die Arbeit wirklich begann.',
  'panel.network.rungInfo.moment.started.description':
    'Eingereiht + Queueing. Alles vor dieser Marke ist Browser-Planung; alles danach echter Fortschritt der ' +
    'Anfrage.',
  'panel.network.rungInfo.moment.response.summary':
    'Der Zeitpunkt, an dem das erste Antwort-Byte ankam (Time to First Byte).',
  'panel.network.rungInfo.moment.response.description':
    'Der Server hat geantwortet; ab hier lädt der Body herunter. Fehlt, wenn nie eine Antwort ankam (zuerst ' +
    'blockiert oder fehlgeschlagen).',
  'panel.network.rungInfo.moment.ended.summary':
    'Der Zeitpunkt, an dem das letzte Antwort-Byte ankam — die Anfrage ist fertig.',
  'panel.network.rungInfo.moment.ended.description':
    'Beendet − Eingereiht ist die Gesamtzeit unter der Aufschlüsselung; Beendet − Gestartet ist die aktive ' +
    'Dauer der Time-Spalte.',
  'panel.network.rungInfo.keyMoments.summary':
    'Die Grenzzeitpunkte im Leben der Anfrage — dort, wo eine Etappe an die nächste übergibt.',
  'panel.network.rungInfo.keyMoments.description':
    'Eingereiht und Gestartet existieren immer; Antwort und Beendet erst, wenn tatsächlich eine Antwort ankam ' +
    '(eine zuvor blockierte oder fehlgeschlagene Anfrage zeigt stattdessen ihren Ausgangsmarker). Die Phasen ' +
    'darunter sind die Spannen zwischen diesen Zeitpunkten.',
  'panel.network.rungInfo.terminal.whereHeading': 'Wo sie stoppte',
  'panel.network.rungInfo.terminal.noResponseDesc':
    'Sie hat das Netzwerk erreicht, aber es kam nie eine Antwort zurück.',
  'panel.network.rungInfo.terminal.neverReachedDesc':
    'Sie starb in der browserseitigen Planung — nichts wurde gesendet.',
  'panel.network.rungInfo.terminal.canceled.summary':
    'Die Anfrage wurde vor dem Abschluss abgebrochen — das ✗ markiert, wo sie stoppte; spätere Phasen liefen ' + 'nie.',
  'panel.network.rungInfo.terminal.canceled.description':
    'Typische Ursachen: Die Seite navigierte mitten im Laden weg, ein Skript brach den Fetch ab, oder der ' +
    'Nutzer stoppte das Laden. Mit dem Netzwerk war alles in Ordnung — der Browser hat die Antwort schlicht ' +
    'aufgegeben.',
  'panel.network.rungInfo.terminal.blocked.summary':
    'Der Browser hat die Anfrage aus Policy-Gründen verweigert — das Wort nach dem Doppelpunkt nennt die ' + 'Policy.',
  'panel.network.rungInfo.terminal.stoppedHere': 'Das ✗ markiert, wo sie stoppte; spätere Phasen liefen nie.',
  'panel.network.rungInfo.terminal.blocked.reasonsHeading': 'Häufige Gründe',
  'panel.network.rungInfo.terminal.blocked.cspDesc': 'Die Content-Security-Policy der Seite verbietet dieses Ziel.',
  'panel.network.rungInfo.terminal.blocked.mixedContentDesc':
    'Eine unsichere http://-Ressource auf einer https://-Seite.',
  'panel.network.rungInfo.terminal.blocked.otherDesc':
    'Eine Erweiterung, ein Ad-Blocker oder eine interne Browserregel hat sie verweigert.',
  'panel.network.rungInfo.terminal.cors.summary':
    'Eine Cross-Origin-Prüfung hat die Antwort abgelehnt — der Server antwortete, aber die Seite durfte sie ' +
    'nicht lesen.',
  'panel.network.rungInfo.terminal.cors.description':
    'Der Server muss mit Access-Control-Allow-Origin (und Verwandten) zustimmen, damit eine Cross-Origin-Seite ' +
    'seine Antwort lesen darf. Das ✗ markiert, wo die Ablehnung landete.',
  'panel.network.rungInfo.terminal.failed.summary':
    'Ein Fehlschlag auf Leitungsebene — die Verbindung selbst brach, und der net::-Code nennt die genaue ' + 'Ursache.',
  'panel.network.rungInfo.terminal.failed.codesHeading': 'Häufige Codes',
  'panel.network.rungInfo.terminal.failed.nameNotResolvedDesc': 'DNS konnte den Host nicht finden.',
  'panel.network.rungInfo.terminal.failed.connectionRefusedDesc':
    'Der Server hat den Socket abgelehnt oder fallen gelassen.',
  'panel.network.rungInfo.terminal.failed.timedOutDesc': 'Keine Antwort innerhalb des Zeitlimits des Netzwerk-Stacks.',
  'panel.network.rungInfo.terminal.failed.certDesc': 'Das TLS-Zertifikat bestand die Prüfung nicht.',

  // ── OH row annotations — one classifier, one copy family (traffic
  // rail glyph popover + Headers-tab insight cards). The rail is a hot
  // row loop: copy resolves once per locale via
  // `buildRowAnnotationMessages(t)` threaded through the stable cell
  // context — never `t()` in the row body. The popover kicker is the
  // raw brand mark. ───────────────────────────────────────────────────
  'panel.rowAnnotations.alsoOnThisRow': 'Ebenfalls in dieser Zeile',
  'panel.rowAnnotations.openDetails': 'Details öffnen',
  'panel.rowAnnotations.interrupted.label': 'Transfer unterbrochen',
  'panel.rowAnnotations.interrupted.detail':
    'Der Download wurde vor dem Abschluss abgebrochen. Der Status spiegelt die Header wider, die vor der ' +
    'Unterbrechung ankamen, und die empfangenen Daten sind unvollständig — sonst ist die Zeile von einer ' +
    'abgeschlossenen nicht zu unterscheiden.',
  'panel.rowAnnotations.neverFinished.label': 'Nie abgeschlossen',
  'panel.rowAnnotations.neverFinished.detail':
    'Die Seite, die diese Anfrage stellte, wurde entladen, während sie noch unterwegs war — es wurde nie ein ' +
    'Ausgang aufgezeichnet. Deshalb zeigen Status und Time „(unknown)“.',
  'panel.rowAnnotations.fidelityGap.label': 'Erfassungslücke',
  'panel.rowAnnotations.fidelityGap.detail':
    'Übertragene Bytes und der Antwort-Body sind für nie abgeschlossene Anfragen im Standard-Erfassungspfad ' +
    'nicht sichtbar — die CDP-erweiterte Inspektion zeichnet sie auf.',
  'panel.rowAnnotations.syntheticHar.label': 'Synthetisierte Zeile',
  'panel.rowAnnotations.syntheticHar.detail':
    'Diese Zeile wurde aus einem Erfassungsdatensatz rekonstruiert, der nie zu einer Live-Anfrage gehörte — ' +
    'manche Spalten lassen sich deshalb nicht füllen.',
  'panel.rowAnnotations.syntheticMemory.label': 'Synthetisierte Zeile',
  'panel.rowAnnotations.syntheticMemory.detail':
    'Diese Zeile wurde aus dem Resource Timing der Seite rekonstruiert (ein Memory-Cache-Treffer erreicht den ' +
    'Netzwerk-Stack nie) — Header und Cookies sind deshalb nicht verfügbar.',
  'panel.rowAnnotations.debugPaused.label': 'Debug-Modus-Halt',
  'panel.rowAnnotations.debugPaused.detail':
    '{ms} ms der Zeit dieser Zeile vergingen pausiert in der Debug-Modus-Interception, nicht im Warten auf ' +
    'Server oder Netzwerk — der Debug-Modus hielt die Anfrage fest, während er sie inspizierte, sodass die ' +
    'Gesamtzeit der Zeile länger läuft, als die Anfrage selbst brauchte.',
  'panel.rowAnnotations.queryParamRewrite.label': 'Query-Parameter-Umschreibung',
  'panel.rowAnnotations.queryParamRewrite.detail':
    'Diese Umleitung ist Open Headers beim Anwenden einer Query-Parameter-Regel, nicht der Server. Das ' +
    'Umschreiben des Query-Strings einer URL läuft als interne Umleitung und erscheint deshalb als eigener ' +
    'Sprung; die Anfrage geht dann zur umgeschriebenen URL weiter — Methode, Body, Cookies und Header werden ' +
    'unverändert mitgenommen.',
  'panel.rowAnnotations.redirectRule.label': 'Umleitungsregel',
  'panel.rowAnnotations.redirectRule.detail':
    'Diese Umleitung ist Open Headers beim Anwenden einer Umleitungsregel, nicht der Server. Sie läuft als ' +
    'interne Umleitung, sodass die ursprüngliche Anfrage als eigener Sprung erscheint, bevor die Anfrage zur ' +
    'umgeschriebenen URL weitergeht.',
} as const satisfies Catalog;
