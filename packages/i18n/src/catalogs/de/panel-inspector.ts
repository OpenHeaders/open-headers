/**
 * DevTools panel — request inspector shell + detail tabs — German.
 * Mirrors `catalogs/en/panel-inspector.ts` key for key. Raw by design:
 * async stack labels (JS vocabulary), wire-shaped hover titles,
 * encoding names (Base64 / UTF-8), the detail section tab nouns
 * (Headers / Payload / … — host-panel parity vocabulary), and wire
 * tokens (HEAD / CONNECT / 204 No Content / Server-Timing). Mints:
 * split = teilen / unsplit = Teilung aufheben; frame rides raw (m.,
 * JS vocabulary, fr/es precedent); redact = schwärzen; pretty print
 * = Formatieren; hex viewer = Hex-Viewer raw (m.); cascade =
 * Kaskade; call stack = Aufrufstapel; source map raw (f.);
 * `{percent} %` spaced per the de register.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspector = {
  // ── Inspector detail empty states ────────────────────────────────────
  // The select prompt flanks an inline Network-panel glyph, so it keys
  // as prefix + suffix fragments.
  'panel.inspector.detailEmpty.requestGone': 'Anfrage nicht mehr verfügbar (geleert oder Seite verlassen)',
  'panel.inspector.detailEmpty.selectPrefix': 'Wähle eine Anfrage im',
  'panel.inspector.detailEmpty.selectSuffix': 'Network-Panel, um sie zu inspizieren',

  // ── Inspector shell (editor tab bar + detail section tabs) ──────────
  // Raw by design: method badges, status codes, tab labels (URLs, storage
  // keys, cookie/cache identities), the IDB/SS/LS/CS chips, the wire-shaped
  // pill hover title, and the ▾ / ▼ / ▶ / × glyphs beside keyed values.
  'panel.inspector.tabBar.closeTab': 'Tab schließen',
  'panel.inspector.tabBar.unsavedChanges': 'Ungespeicherte Änderungen',
  'panel.inspector.tabBar.searchTabs': 'Tabs durchsuchen',
  'panel.inspector.tabBar.searchPlaceholder': 'Tabs durchsuchen…',
  'panel.inspector.tabBar.noOpenTabs': 'Keine offenen Tabs',
  'panel.inspector.tabBar.noOpenTabsMatch': 'Kein offener Tab passt zu deiner Suche',
  'panel.inspector.tabBar.noClosedTabsMatch': 'Kein geschlossener Tab passt zu deiner Suche',
  'panel.inspector.tabBar.recentlyClosed': 'Kürzlich geschlossen ({count})',
  'panel.inspector.tabBar.recentlyClosedFiltered': 'Kürzlich geschlossen ({matched} von {total})',

  // Dirty-close confirm (useTabCloseGuard) — the body follows a bolded
  // tab label in the JSX, so it keys as the sentence remainder.
  'panel.inspector.tabBar.closeGuard.unsavedTitle': 'Änderungen speichern?',
  'panel.inspector.tabBar.closeGuard.unsavedBody':
    'hat ungespeicherte Änderungen. Speichere sie, um deine Arbeit nicht zu verlieren.',
  'panel.inspector.tabBar.closeGuard.dontSave': 'Nicht speichern',
  'panel.inspector.tabBar.closeGuard.cancel': 'Abbrechen',
  'panel.inspector.tabBar.closeGuard.save': 'Änderungen speichern',

  // Tab context menu. Direction words are split directions, not the
  // layout menu's alignment nouns — separate referents, separate keys.
  'panel.inspector.tabMenu.close': 'Schließen',
  'panel.inspector.tabMenu.closeOther': 'Andere Tabs schließen',
  'panel.inspector.tabMenu.closeAll': 'Alle Tabs schließen',
  'panel.inspector.tabMenu.closeToLeft': 'Tabs links davon schließen',
  'panel.inspector.tabMenu.closeToRight': 'Tabs rechts davon schließen',
  'panel.inspector.tabMenu.splitAndMove': 'Teilen und verschieben',
  'panel.inspector.tabMenu.right': 'Rechts',
  'panel.inspector.tabMenu.left': 'Links',
  'panel.inspector.tabMenu.down': 'Unten',
  'panel.inspector.tabMenu.up': 'Oben',
  'panel.inspector.tabMenu.moveToOppositeGroup': 'In die gegenüberliegende Gruppe verschieben',
  'panel.inspector.tabMenu.changeSplitterOrientation': 'Teiler-Ausrichtung wechseln',
  'panel.inspector.tabMenu.unsplit': 'Teilung aufheben',
  'panel.inspector.tabMenu.unsplitAll': 'Alle Teilungen aufheben',

  // Detail section tabs — keyed but glossary-protected on translator
  // handoff (host-panel tab nouns, same as the workbench tab nouns).
  'panel.inspector.sections.headers': 'Headers',
  'panel.inspector.sections.messages': 'Messages',
  'panel.inspector.sections.eventStream': 'EventStream',
  'panel.inspector.sections.payload': 'Payload',
  'panel.inspector.sections.preview': 'Preview',
  'panel.inspector.sections.response': 'Response',
  'panel.inspector.sections.initiator': 'Initiator',
  'panel.inspector.sections.timing': 'Timing',
  'panel.inspector.sections.cookies': 'Cookies',
  'panel.inspector.sections.rawData': 'Raw Data',

  // Override-body CTA — shared by the Response tab and the Preview tab
  // (same control, same rule target on both surfaces).
  'panel.inspector.overrideCta.editOverride': 'Überschreibung bearbeiten',
  'panel.inspector.overrideCta.editOverrideTitle':
    'Die Regel bearbeiten, die diese Antwort erzeugt hat — Änderungen gelten für künftige Anfragen',
  'panel.inspector.overrideCta.overrideResponse': 'Antwort überschreiben',
  'panel.inspector.overrideCta.overrideResponseTitle':
    'Eine Regel anlegen, die diese Antwort als bearbeitbaren Mock ausliefert',
  'panel.inspector.overrideCta.editQueryParams': 'Query-Parameter-Überschreibung bearbeiten',
  'panel.inspector.overrideCta.editQueryParamsTitle':
    'Die Regel bearbeiten, die diese Query-Parameter umgeschrieben hat — Änderungen gelten für künftige ' + 'Anfragen',
  'panel.inspector.overrideCta.overrideQueryParams': 'Query-Parameter überschreiben',
  'panel.inspector.overrideCta.overrideQueryParamsTitle': 'Eine Regel anlegen, die diese Query-Parameter umschreibt',
  'panel.inspector.overrideCta.editRequestBody': 'Anfrage-Body-Überschreibung bearbeiten',
  'panel.inspector.overrideCta.editRequestBodyTitle':
    'Die Regel bearbeiten, die diesen Anfrage-Body ersetzt hat — Änderungen gelten für künftige Anfragen',
  'panel.inspector.overrideCta.overrideRequestBody': 'Anfrage-Body überschreiben',
  'panel.inspector.overrideCta.overrideRequestBodyTitle':
    'Eine Regel anlegen, die diesen Anfrage-Body durch einen bearbeitbaren statischen Body ersetzt',

  // Dual-view controls (Response / Preview / Payload two-sided views).
  'panel.inspector.dualView.diff': 'Diff',
  'panel.inspector.dualView.fullResponse': 'Volle Antwort',
  'panel.inspector.dualView.fullRequest': 'Volle Anfrage',
  'panel.inspector.dualView.swapSides': 'Seiten tauschen',
  'panel.inspector.dualView.hideUnchanged': 'Unverändertes ausblenden',

  // Delivery-path pane captions for the two-sided views — phrased as
  // the delivery path; the server/page arrows ride raw inside the value.
  'panel.inspector.paneCaption.responseOriginal': 'Original · Server → Seite',
  'panel.inspector.paneCaption.responseModified': 'Verändert · Server → Open Headers → Seite',
  'panel.inspector.paneCaption.requestOriginal': 'Original · Seite → Server',
  'panel.inspector.paneCaption.requestModified': 'Verändert · Seite → Open Headers → Server',
  'panel.inspector.paneCaption.wsRecvDropped': 'Verworfen · hat die Seite nie erreicht',
  'panel.inspector.paneCaption.wsSendDropped': 'Verworfen · hat den Server nie erreicht',

  // Body-state notices (Response tab + Preview tab twins). Wire vocab
  // (HEAD / CONNECT / status codes / WebSocket) rides raw inside values.
  'panel.inspector.bodyState.noResponseBodyTitle': 'Kein Antwort-Body',
  'panel.inspector.bodyState.noPreviewTitle': 'Keine Vorschau verfügbar',
  'panel.inspector.bodyState.nothingToPreviewTitle': 'Nichts für eine Vorschau',
  'panel.inspector.bodyState.noResponseDetail': 'Für diese Anfrage liegen keine Antwortdaten vor',
  'panel.inspector.bodyState.failedTitle': 'Antwortdaten konnten nicht geladen werden',
  'panel.inspector.bodyState.emptyTitle': '(leerer Antwort-Body)',
  'panel.inspector.bodyState.emptyDetail': 'Der Server hat einen leeren Body zurückgegeben.',
  'panel.inspector.bodyState.binaryPayloadBytes': 'Binäre Payload ({count} Bytes).',
  'panel.inspector.bodyState.notApplicable.preflight': 'Kein Inhalt für eine Preflight-Anfrage',
  'panel.inspector.bodyState.notApplicable.head': 'Kein Antwort-Body bei einer HEAD-Anfrage',
  'panel.inspector.bodyState.notApplicable.connect': 'Kein Antwort-Body bei einer CONNECT-Anfrage',
  'panel.inspector.bodyState.notApplicable.status204': 'Kein Inhalt (204 No Content)',
  'panel.inspector.bodyState.notApplicable.status205': 'Kein Inhalt (205 Reset Content)',
  'panel.inspector.bodyState.notApplicable.status304': 'Nicht verändert — Body aus dem Browser-Cache bedient',
  'panel.inspector.bodyState.notApplicable.informational': 'Kein Inhalt (informative Antwort)',
  'panel.inspector.bodyState.notApplicable.websocket': 'WebSocket-Verbindung hochgestuft — siehe den Messages-Tab',
  'panel.inspector.bodyState.unavailable.opaque': 'Antwort-Body nicht verfügbar — opake Cross-Origin-Antwort',
  'panel.inspector.bodyState.unavailable.cache':
    'Body nicht verfügbar — die Antwort wurde aus dem Cache bedient, bevor die DevTools geöffnet waren',
  'panel.inspector.bodyState.unavailable.redirect': 'Kein Inhalt verfügbar, weil diese Anfrage umgeleitet wurde',
  'panel.inspector.bodyState.unavailable.unknown':
    'Body nicht erfasst. Der Host lieferte keinen Inhalt — die Antwort wurde ohne Pufferung gestreamt oder aus ' +
    'dem Cache bedient.',

  // Preview tab's own chrome.
  'panel.inspector.preview.notAvailableForType': 'Für diesen Inhaltstyp gibt es keine Vorschau.',
  'panel.inspector.preview.imageAlt': 'Antwortvorschau',

  // Shared body-viewer toolbars. Raw by design: Base64 / UTF-8 encoding
  // names, keyboard chords, the { } pretty-print glyph, and the sniffer
  // format nouns (JSON / XML / …) riding through as {format}.
  'panel.inspector.viewer.prettyPrintTitle': 'Formatieren',
  'panel.inspector.viewer.revertTitle': 'Zum deklarierten Content-Type zurückkehren',
  'panel.inspector.viewer.parsedAsRevert': 'Als {format} geparst · zurücksetzen',
  'panel.inspector.viewer.looksLikeParse': 'Sieht nach {format} aus · parsen',
  'panel.inspector.viewer.looksLikeTitle':
    'Der Content-Type wirkt falsch — der Body parst als {format}. Klicke zum Neuinterpretieren.',
  'panel.inspector.viewer.cursorInfo': 'Zeile {line}, Spalte {col}',
  'panel.inspector.viewer.lineCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Zeile', other: '{count} Zeilen' }),
  'panel.inspector.viewer.hexViewer': 'Hex-Viewer',
  'panel.inspector.viewer.find': 'Suchen',
  'panel.inspector.viewer.findTitle': 'Suchen ({chord})',

  // Payload tab chrome. The section titles carry the captured MIME raw.
  'panel.inspector.payload.queryStringParameters': 'Query-String-Parameter',
  'panel.inspector.payload.requestBody': 'Anfrage-Body ({mime})',
  'panel.inspector.payload.viewSource': 'Quelle anzeigen',
  'panel.inspector.payload.viewParsed': 'Geparst anzeigen',
  'panel.inspector.payload.viewUrlEncoded': 'URL-codiert anzeigen',

  // ── Raw Data tab (inspector detail) — export-snippet band + raw HAR
  // band. Raw by design: the generated snippet text itself (paste-into-
  // terminal material), HAR / JSON / .har / HAR 1.2 format nouns riding
  // inside keyed values, and the technical tokens inside the format
  // option labels (cURL, bash, fetch, Node, Python requests,
  // Invoke-WebRequest). ────────────────────────────────────────────────
  'panel.inspector.rawData.exportSnippet': 'Snippet exportieren',
  'panel.inspector.rawData.formatLabel': 'Format',
  'panel.inspector.rawData.copy': 'Kopieren',
  'panel.inspector.rawData.copied': 'Kopiert',
  'panel.inspector.rawData.rawHar': 'Rohes HAR (JSON)',
  'panel.inspector.rawData.downloadHar': '.har herunterladen',
  'panel.inspector.rawData.noRequestData': '(noch keine Anfragedaten)',
  'panel.inspector.rawData.view.label': 'Ansicht',
  'panel.inspector.rawData.view.includeHeaders': 'Anfrage-Header einschließen',
  'panel.inspector.rawData.view.includeBody': 'Anfrage-Body einschließen',
  'panel.inspector.rawData.view.redactSecrets': 'Secrets schwärzen',
  'panel.inspector.rawData.view.ruleModifiedHeading': 'Regelveränderte Header',
  'panel.inspector.rawData.view.postRule': 'Nach der Regel (auf der Leitung)',
  'panel.inspector.rawData.view.original': 'Original (vor den Regeln)',
  'panel.inspector.rawData.format.curlUnix': 'cURL (bash)',
  'panel.inspector.rawData.format.curlWindows': 'cURL (Windows)',
  'panel.inspector.rawData.format.fetchBrowser': 'JavaScript — fetch (Browser)',
  'panel.inspector.rawData.format.fetchNode': 'JavaScript — fetch (Node)',
  'panel.inspector.rawData.format.pythonRequests': 'Python — requests',
  'panel.inspector.rawData.format.powershell': 'PowerShell — Invoke-WebRequest',
  'panel.inspector.rawData.format.httpRaw': 'HTTP — rohe Nachricht',
  'panel.inspector.rawData.format.har': 'HAR — einzelner Eintrag',
  // HAR (i) corpus — the title stays the raw format name (HAR 1.2).
  'panel.inspector.rawData.harInfo.kicker': 'Format',
  'panel.inspector.rawData.harInfo.summary': 'Portables HTTP-Archiv — ein JSON-Schnappschuss einer Anfrage.',
  'panel.inspector.rawData.harInfo.description':
    'Speichere es für einen Bug-Report, teile es mit Teamkollegen oder importiere es in ein anderes Tool, das ' +
    'HAR-Dateien liest.',

  // ── Initiator tab (inspector detail) — call stack, upstream chain,
  // downstream tree, cascade stats + insights. Raw by design: the
  // async-boundary section labels (`await in fn`, `Promise resolved
  // (async)` — JS vocabulary that also feeds the copied stack text),
  // `(anonymous)`, the `@` locator glyph, wire initiator-type values
  // (parser / script / other), filter grammar tokens riding inside the
  // keyed placeholder, the ▼ / ▶ toggles, and byte / ms figures. ──────
  'panel.inspector.initiator.noData': 'Keine Initiator-Daten verfügbar.',
  'panel.inspector.initiator.typeLabel': 'Typ:',
  'panel.inspector.initiator.stack.heading': 'Aufrufstapel der Anfrage',
  'panel.inspector.initiator.stack.frameCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Frame', other: '{count} Frames' }),
  'panel.inspector.initiator.stack.resolvedCount': '{count} aufgelöst',
  'panel.inspector.initiator.stack.resolvedTitle': 'Funktionsnamen über Source Maps aufgelöst',
  'panel.inspector.initiator.stack.showHidden': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} verborgenen zeigen',
      other: '{count} verborgene zeigen',
    }),
  'panel.inspector.initiator.stack.hideNoisy': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} rauschigen verbergen',
      other: '{count} rauschige verbergen',
    }),
  'panel.inspector.initiator.stack.noiseTitle': 'Anonyme Frames in minifizierten Bundles verbergen',
  'panel.inspector.initiator.stack.copyTitle': 'Stack als Text kopieren',
  'panel.inspector.initiator.stack.copy': 'Kopieren',
  'panel.inspector.initiator.stack.copied': 'Kopiert',
  'panel.inspector.initiator.stack.filterPlaceholder': 'Frames filtern (Funktionsname oder URL)…',
  'panel.inspector.initiator.stack.filterAria': 'Aufrufstapel-Frames filtern',
  'panel.inspector.initiator.stack.noMatch': 'Kein Frame passt.',
  'panel.inspector.initiator.stack.showing': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), { one: '{count} Frame', other: '{count} Frames' });
    return `${String(shown)} von ${total} angezeigt`;
  },
  'panel.inspector.initiator.stack.hiddenSuffix': '({count} verborgen)',
  'panel.inspector.initiator.stack.sourceMapNameTitle': 'Source-Map-Name: {name}',
  'panel.inspector.initiator.stack.originalTitle': '{url} (Original: {source})',
  'panel.inspector.initiator.moreFilters.label': 'Weitere Filter',
  'panel.inspector.initiator.moreFilters.failuresOnly': 'Nur Fehlschläge',
  'panel.inspector.initiator.moreFilters.thirdPartyOnly': 'Nur Drittanbieter',
  'panel.inspector.initiator.view.label': 'Ansicht',
  'panel.inspector.initiator.view.sort': 'Sortieren',
  'panel.inspector.initiator.view.sortInitiator': 'Initiator-Reihenfolge',
  'panel.inspector.initiator.view.sortChronological': 'Chronologisch',
  'panel.inspector.initiator.view.sortLargest': 'Größter Teilbaum',
  'panel.inspector.initiator.view.showSuggestions': 'Vorschläge anzeigen',
  'panel.inspector.initiator.filterPlaceholder':
    'Filtern — Text, is:failed, is:third-party, type:js, status:404, size:>50kb',
  'panel.inspector.initiator.filterAria': 'Initiator-Kette filtern',
  'panel.inspector.initiator.matchCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Treffer', other: '{count} Treffer' }),
  // Two sections share the English 'Request initiator chain' but are
  // separate referents: the upstream (ancestor) chain and the
  // downstream tree.
  'panel.inspector.initiator.upstreamChain': 'Initiator-Kette der Anfrage',
  'panel.inspector.initiator.chainTree': 'Initiator-Kette der Anfrage',
  'panel.inspector.initiator.collapse': 'Zuklappen',
  'panel.inspector.initiator.expand': 'Aufklappen',
  // Cascade stat strip — the bolded figures ride outside; the noun
  // declines with the count (markup-split plural, count not printed).
  'panel.inspector.initiator.cascade.requestsWord': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'Anfrage', other: 'Anfragen' }),
  'panel.inspector.initiator.cascade.transferred': 'übertragen',
  'panel.inspector.initiator.cascade.cumulative': 'kumuliert',
  'panel.inspector.initiator.cascade.failed': 'fehlgeschlagen',
  // Row chips (product classifier vocabulary, cookie-role precedent).
  'panel.inspector.initiator.chip.initiatorTypeTitle': 'Initiator-Typ',
  'panel.inspector.initiator.chip.httpStatusTitle': 'HTTP-Status',
  'panel.inspector.initiator.chip.requestFailedTitle': 'Anfrage fehlgeschlagen',
  'panel.inspector.initiator.chip.failed': 'fehlgeschlagen',
  'panel.inspector.initiator.chip.transferredTitle': 'Übertragen',
  'panel.inspector.initiator.chip.durationTitle': 'Dauer',
  'panel.inspector.initiator.chip.thirdPartyTitle': 'Drittanbieter-Origin',
  'panel.inspector.initiator.chip.thirdParty': 'Drittanbieter',
  'panel.inspector.initiator.chip.subtreeTitle': 'Teilbaum-Gewicht (Nachfahren · Bytes)',
  'panel.inspector.initiator.chip.subtree': '+{count} Anfr. · {bytes}',
  // Cascade insights (t-fed `computeCascadeInsights`). Hosts, byte
  // figures and percentages ride as raw holes.
  'panel.inspector.initiator.insights.failedHeadline': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} fehlgeschlagene Anfrage in dieser Kaskade.',
      other: '{count} fehlgeschlagene Anfragen in dieser Kaskade.',
    }),
  'panel.inspector.initiator.insights.failedHint': 'Prüfe Ad-Blocker, CSP-Regeln und die CORS-Konfiguration.',
  'panel.inspector.initiator.insights.hostHeadline': ({ host, count, bytes, percent }, locale) => {
    const loaded = plural(locale, Number(count), {
      one: 'hat {count} Anfrage geladen',
      other: 'hat {count} Anfragen geladen',
    });
    return `${String(host)} ${loaded} (${String(bytes)}) — ${String(percent)} % des Kaskadengewichts.`;
  },
  'panel.inspector.initiator.insights.hostHint':
    'Größter einzelner Host in dieser Kaskade. Selbst hosten oder aufschieben, wenn möglich.',
  'panel.inspector.initiator.insights.thirdPartyHeadline': '{percent} % der Kaskaden-Bytes stammen von Drittanbietern.',
  'panel.inspector.initiator.insights.thirdPartyHint':
    'Nicht essenzielle Drittanbieter kürzen, aufschieben oder selbst hosten.',

  // ── Timing tab (inspector detail) — the tab's OWN copy. Raw by
  // design (S34 parity-vocab lock): the eight rung names everywhere
  // (insight subjects, the open `Stalled:` step), the Server Timing
  // section name (header vocabulary), cache-source words (memory cache
  // / disk cache / service worker / miss — Size-column parity, and the
  // repeat section's cache-breakdown line with them), ms / s / B/s
  // figures on the Chrome scale, and protocol / priority / IP values. ─
  'panel.inspector.timing.noData': 'Keine Timing-Daten verfügbar.',
  'panel.inspector.timing.view.label': 'Ansicht',
  'panel.inspector.timing.view.showSuggestions': 'Vorschläge anzeigen',
  'panel.inspector.timing.view.showContextStrip': 'Kontextleiste anzeigen',
  'panel.inspector.timing.view.showPhaseBreakdown': 'Phasenaufschlüsselung anzeigen',
  'panel.inspector.timing.view.showTimingBar': 'Timing-Balken anzeigen',
  'panel.inspector.timing.view.showServerTiming': 'Server-Timing anzeigen',
  'panel.inspector.timing.view.showRepeats': 'Wiederholungen der Sitzung anzeigen',
  'panel.inspector.timing.view.showTransferRate': 'Übertragungsrate anzeigen',
  // Insight headlines — the raw rung name is the bolded subject; the
  // keyed predicate joins it at the markup boundary (raw-label +
  // keyed-clause join, S34 idiom). Figures ride as raw holes.
  'panel.inspector.timing.insight.dominatesTail': 'dominiert diese Anfrage — {ms} ({percent} % der Gesamtzeit).',
  'panel.inspector.timing.insight.unusuallyHighTail': 'ist ungewöhnlich hoch — {ms}.',
  // Per-phase diagnosis (t-fed `findBottleneck` / `findWarnings`).
  'panel.inspector.timing.phase.queueing.what': 'Der Anfragen-Scheduler hat diese Anfrage zurückgehalten',
  'panel.inspector.timing.phase.queueing.hint':
    'Zu viele gleichzeitige Anfragen konkurrieren um Slots, oder niedrige Priorität.',
  'panel.inspector.timing.phase.stalled.what': 'Warten auf eine verfügbare Verbindung',
  'panel.inspector.timing.phase.stalled.hint':
    'Verbindungspool-Limit, Proxy-Aushandlung oder HTTP/1.1-Head-of-Line-Blocking.',
  'panel.inspector.timing.phase.dns.what': 'DNS-Auflösung',
  'panel.inspector.timing.phase.dns.hint': 'Betrifft nur die erste Anfrage an diese Domain. Erwäge DNS-Prefetch.',
  'panel.inspector.timing.phase.connect.what': 'TCP-Handshake zum Server',
  'panel.inspector.timing.phase.connect.hint':
    'Neue Verbindung — Keep-Alive oder HTTP/2/3-Multiplexing verwendet eine über mehrere Anfragen hinweg.',
  'panel.inspector.timing.phase.ssl.what': 'TLS-Handshake',
  'panel.inspector.timing.phase.ssl.hint': 'Verringert durch Session Resumption / 0-RTT (HTTP/3).',
  'panel.inspector.timing.phase.send.what': 'Hochladen des Anfrage-Bodys',
  'panel.inspector.timing.phase.send.hint':
    'Großer Anfrage-Body oder langsamer Upstream — meist nur bei POST/PUT sichtbar.',
  'panel.inspector.timing.phase.wait.what': 'Serverzeit bis zum ersten Byte',
  'panel.inspector.timing.phase.wait.hint':
    'Backend-Verarbeitung. Suche nach Backend-Timing in Server-Timing oder in DB-Query-Logs.',
  'panel.inspector.timing.phase.receive.what': 'Herunterladen der Antwort-Payload',
  'panel.inspector.timing.phase.receive.hint':
    'Payload-Größe oder CDN-Durchsatz — prüfe die effektive Übertragungsrate.',
  // Context strip chips — labels keyed; cache / protocol / priority
  // values stay raw.
  'panel.inspector.timing.chip.protocol': 'Protokoll',
  'panel.inspector.timing.chip.connection': 'Verbindung',
  'panel.inspector.timing.chip.cache': 'Cache',
  'panel.inspector.timing.chip.priority': 'Priorität',
  'panel.inspector.timing.chip.started': 'Gestartet',
  'panel.inspector.timing.chip.serverIp': 'Server-IP',
  'panel.inspector.timing.chip.connectionReused': 'wiederverwendet',
  'panel.inspector.timing.chip.connectionNew': 'neu',
  'panel.inspector.timing.chip.openedBy': 'geöffnet von {url}',
  'panel.inspector.timing.totalTime': 'Gesamtzeit',
  'panel.inspector.timing.totalWhere': '(eingereiht → beendet)',
  'panel.inspector.timing.caution': 'ACHTUNG: Die Anfrage ist noch nicht abgeschlossen!',
  'panel.inspector.timing.queuedAt': 'Eingereiht um {offset}',
  'panel.inspector.timing.startedAt': 'Gestartet um {offset}',
  'panel.inspector.timing.inProgress': 'läuft…',
  'panel.inspector.timing.noDuration': 'keine Dauer',
  'panel.inspector.timing.transferRate.heading': 'Übertragungsrate',
  'panel.inspector.timing.transferRate.contentDownloaded': 'Heruntergeladener Inhalt:',
  'panel.inspector.timing.transferRate.effectiveRate': 'Effektive Rate:',
  'panel.inspector.timing.transferRate.amount': '{size} in {duration}',
  'panel.inspector.timing.repeats.heading': 'Wiederholungen in dieser Sitzung',
  'panel.inspector.timing.repeats.hitCount': 'URL-Trefferzahl:',
  'panel.inspector.timing.repeats.fastestMedianSlowest': 'Schnellste / Median / Langsamste:',
  'panel.inspector.timing.repeats.thisRequest': 'Diese Anfrage:',
  'panel.inspector.timing.repeats.slowestTag': '(langsamste)',
  'panel.inspector.timing.repeats.fastestTag': '(schnellste)',
  'panel.inspector.timing.repeats.cacheBreakdown': 'Cache-Aufschlüsselung:',
  'panel.inspector.timing.repeats.url': 'URL:',
} as const satisfies Catalog;
