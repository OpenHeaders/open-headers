/**
 * Workbench Docs panel — anchor registry bodies — German. Mirrors
 * `catalogs/en/workbench-docs.ts` key for key; the fr/es S59 raw/keyed
 * split is followed exactly. Raw by design inside keyed prose:
 * wire/API tokens (declarativeNetRequest, webRequest, ResourceType,
 * queryTransform, block, main_frame, firstParty / thirdParty,
 * Equals / Contains, operationName / query / key / value,
 * chrome.storage(.local), fetch() / XMLHttpRequest, @font-face,
 * Set-Cookie, Accept, User-Agent, Content-Type, CORS,
 * ERR_BLOCKED_BY_CLIENT, RE2, stdio, HTTP/SSE, git log / git blame),
 * ResourceType enum labels (Page, Frame, Fetch/XHR, Script, …), the
 * S55 whole-raw one-letter fragment `'A'` and the styled term
 * `direct` (both copied verbatim, sentence reshaped around them —
 * fr/es precedent), and DNR / AND / DOM / CA / PII / YAML / CDN /
 * MCP / Endpunkt-nahe loanwords (monkey-patch raw, editors-rule
 * law). AND rides raw for condition logic; the emphasis caps in
 * prose translate (UND). Quoted UI labels copy their shipped de
 * mints: header/query-param ops (Hinzufügen / Überschreiben,
 * Anfügen, Entfernen, Zusammenführen, Nur überschreiben, Alle
 * entfernen), condition names and the ausschl. variants
 * (de/workbench-editors-rule), inject timing labels (So früh wie
 * möglich, Nach dem Laden der Seite), popup tab „Diese Seite“, docs
 * nav titles (de/workbench-chrome), Dynamisch (JavaScript), rule
 * kickers (-Regel compounds). Reuses die Reichweite = reach, die
 * Engine (f.), simulieren = mock, die Leitung = wire, das Badge,
 * der Treffer = match (popup twin), Werkzeugfenster, der Teiler,
 * Erstanbieter / Drittanbieter, lowercase `vault` per-case law;
 * genitive „Bodys“/„Chromes“ never — rephrased. MINTS: das Fixture
 * raw (n.); die Abwägung = trade-off; en's `30,000 ms` / `5,000 ms`
 * figures take de plain-space grouping (`30 000 ms`).
 */

import type { Catalog } from '../../types';

export const workbenchDocs = {
  // ── Concepts: Execution (DNR vs Script) ─────────────────────────────
  'workbench.docs.body.execution.intro':
    'Regeln werden je nach ihrer Aufgabe von einer von zwei Engines ausgeführt. Zu wissen, welchen Weg eine ' +
    'Regel nimmt, erklärt, wo sie wirkt — und wo sie nicht wirken kann.',
  'workbench.docs.body.execution.stackCaption':
    'JS-initiierte Anfragen durchlaufen erst Script, dann DNR. Statischer und Navigations-Traffic umgeht ' +
    'Script vollständig.',
  'workbench.docs.body.execution.dnrHeading': 'Nativ, schnell, große Reichweite',
  'workbench.docs.body.execution.dnr1Prefix':
    'Header-Regeln (Hinzufügen / Überschreiben, Anfügen, Entfernen), Blockier-, Umleitungs- und ' +
    'Query-Parameter-Regeln kompilieren zu',
  'workbench.docs.body.execution.dnr1Suffix':
    'Einträgen. Chrome wendet sie auf der Netzwerkebene an, bevor irgendeine Anfrage den Browser verlässt.',
  'workbench.docs.body.execution.dnr2':
    'Die Reichweite ist groß: Seiten, Sub-Frames, Scripts, Bilder, Schriftarten, fetch, XHR — jede Anfrage, ' +
    'die der Browser im Auftrag der Seite stellt.',
  'workbench.docs.body.execution.dnrCaption':
    'Eine einzige umrandete Liste — die Reichweite von DNR ist im Grunde universell.',
  'workbench.docs.body.execution.scriptHeading': 'JS-Kontext, schmale Reichweite',
  'workbench.docs.body.execution.script1Prefix':
    'Injektions-, Verzögerungs-, API-Anfrage-Body- und API-Antwort-Regeln sowie das Zusammenführen von ' +
    'Headern funktionieren über Monkey-Patches von',
  'workbench.docs.body.execution.script1And': 'und',
  'workbench.docs.body.execution.script1Suffix':
    'im Inneren der Seite. Sie können JavaScript-initiierten Traffic auf Arten transformieren, die DNR ' +
    'nicht ausdrücken kann — einschließlich Lesen und Umschreiben des Antwort-Body-Inhalts, auf den DNR ' +
    'gar keinen Zugriff hat.',
  'workbench.docs.body.execution.scriptCaption':
    'Zwei Spalten — was die Script-Engine tatsächlich abfängt und was unverändert durchrutscht.',
  'workbench.docs.body.execution.limitPrefix': 'Statische Ressourcen (',
  'workbench.docs.body.execution.limitSuffix':
    '), Seitennavigationen und browserinterne Anfragen umgehen diese Engine vollständig. Nutze dafür eine ' +
    'DNR-basierte Regel.',

  // ── Concepts: Limitations ───────────────────────────────────────────
  'workbench.docs.body.limitations.intro':
    'Schnellreferenz für Verhalten, das überrascht. Jeder Punkt ist zusätzlich direkt in dem Abschnitt ' +
    'vermerkt, den er betrifft.',
  'workbench.docs.body.limitations.overviewCaption':
    'Vier häufige Stolperfallen auf einen Blick — jeder Hinweis unten hat die Details.',
  'workbench.docs.body.limitations.devtoolsTitle': 'Geänderte Header erscheinen nicht in den DevTools',
  'workbench.docs.body.limitations.devtoolsBody':
    'Header-Aktionen werden korrekt angewendet, aber der Netzwerk-Tab von Chrome zeigt weiterhin die ' +
    'ursprünglichen Server-Header an.',
  'workbench.docs.body.limitations.scriptTitle': 'Script-basierte Regeln — schmale Reichweite',
  'workbench.docs.body.limitations.scriptPrefix': 'Injizieren, Verzögerung, Body, Mock und Zusammenführen fangen nur',
  'workbench.docs.body.limitations.scriptAnd': 'und',
  'workbench.docs.body.limitations.scriptMiddle': ' ab. Statische Ressourcen und Seitennavigationen umgehen sie. Siehe',
  'workbench.docs.body.limitations.executionRef': 'Wie Regeln ausgeführt werden',
  'workbench.docs.body.limitations.scriptSuffix': '.',
  'workbench.docs.body.limitations.mergeTitle': 'Zusammenführen kann Browser-Standard-Header nicht lesen',
  'workbench.docs.body.limitations.mergeBody':
    'Die Operation Zusammenführen sieht nur Header, die der Seitencode explizit gesetzt hat — Accept, ' +
    'User-Agent und andere Browser-Standards sind für sie unsichtbar.',
  'workbench.docs.body.limitations.chromeTitle': 'Header-Abgleich braucht Chrome 128+',
  'workbench.docs.body.limitations.chromeBody':
    'Bedingungen, die auf Werte von Anfrage- / Antwort-Headern abgleichen, erfordern Chrome 128 oder ' +
    'neuer. Ältere Browser ignorieren die Bedingung stillschweigend.',

  // ── Concepts: Multi-tab Behavior ────────────────────────────────────
  'workbench.docs.body.multiTab.intro1Prefix':
    'Mehrere gleichzeitig geöffnete Arbeitsbereich-Tabs sind ein vollwertiger Zustand. Persistierte Daten ' +
    'synchronisieren über',
  'workbench.docs.body.multiTab.intro1Suffix':
    ', der Layout-Zustand bleibt pro Tab, und Navigationsabsichten verwenden bestehende Tabs im selben ' +
    'Fenster wieder, bevor neue geöffnet werden.',
  'workbench.docs.body.multiTab.syncCaption':
    'Tab A speichert, der SW sendet den Broadcast, Tab B hydriert neu. Der Layout-Zustand bleibt in jedem ' + 'Tab.',
  'workbench.docs.body.multiTab.navHeading': 'Navigation verwendet bestehende Tabs wieder',
  'workbench.docs.body.multiTab.nav1':
    'Zuerst im selben Fenster: Ist im Fenster, aus dem du klickst, bereits ein Arbeitsbereich-Tab offen, ' +
    'wird er aktiviert und erhält die Absicht (Docs-Abschnitt zum Hinscrollen, Regel zum Bearbeiten). ' +
    'Anderes Fenster: Ein frischer Tab öffnet sich in deinem aktuellen Fenster, statt den Fokus über ' +
    'Chrome-Fenster hinweg zu ziehen — gespiegelt an der Arbeitsweise der Chrome-eigenen DevTools mit ' +
    'einem Panel pro Fenster.',
  'workbench.docs.body.multiTab.navCaption':
    'Der warme Pfad aktiviert den Tab im selben Fenster; der kalte öffnet einen neuen Tab im Fenster des ' +
    'Aufrufers.',
  'workbench.docs.body.multiTab.numberingHeading': 'Tab-Nummerierung',
  'workbench.docs.body.multiTab.numbering1Prefix':
    'Ab zwei Arbeitsbereich-Tabs bekommt der Titel jedes Tabs seine Ordnungszahl vorangestellt —',
  'workbench.docs.body.multiTab.numbering1Suffix':
    '. Fällt die Zahl zurück auf eins, verliert der Überlebende sein Präfix.',
  'workbench.docs.body.multiTab.numbering2Prefix':
    'Ordnungszahlen sind über die Lebensdauer eines Tabs stabil: das Schließen von',
  'workbench.docs.body.multiTab.numbering2While': 'während',
  'workbench.docs.body.multiTab.numbering2And': 'und',
  'workbench.docs.body.multiTab.numbering2Middle':
    'bestehen bleiben, nummeriert die Überlebenden nicht um. Der nächste geöffnete Tab erhält',
  'workbench.docs.body.multiTab.numbering2Middle2': '; die Nummerierung beginnt bei',
  'workbench.docs.body.multiTab.numbering2Suffix': 'erst wieder, nachdem jeder Arbeitsbereich-Tab geschlossen wurde.',
  'workbench.docs.body.multiTab.numberingCaption':
    'Überlebende behalten ihre Nummern über Schließungen hinweg; der nächste Tab ist immer max + 1.',
  'workbench.docs.body.multiTab.syncsHeading': 'Was synchronisiert und was nicht',
  'workbench.docs.body.multiTab.syncs1Prefix':
    'Jede persistierte Entität — Regeln, Sammlungen, Ordner, Umgebungen, Arbeitsbereich-Variablen, vault, ' +
    'Anfragen, Vorlagen — lebt in',
  'workbench.docs.body.multiTab.syncs1Suffix':
    'als der einzigen Quelle der Wahrheit. Speichern in Tab A sendet den Broadcast über den Hintergrund, ' +
    'und Tab B hydriert neu. Arbeitsbereich- und Umgebungswechsel breiten sich genauso aus.',
  'workbench.docs.body.multiTab.syncedCaption':
    'Ein gemeinsames chrome.storage; beide Tabs lesen und schreiben dieselben persistierten Daten.',
  'workbench.docs.body.multiTab.localCaption':
    'Layout-Züge und ungespeichertes Tippen leben in jedem Tab — der andere Tab sieht sie nie.',
  'workbench.docs.body.multiTab.layoutTitle': 'Das Layout synchronisiert nicht live',
  'workbench.docs.body.multiTab.layout1Prefix':
    'Teiler-Verhältnisse und der Dock-Zustand der Werkzeugfenster gelten pro Arbeitsbereich, aber ' +
    'Änderungen breiten sich nicht auf bereits offene Tabs aus. Einen Teiler in Tab A zu ziehen lässt ' +
    'Tab B bis zum Neuladen unberührt — Live-Layout-Sync würde sich beim Tippen störend anfühlen. Ein ' +
    'Tab, der',
  'workbench.docs.body.multiTab.layoutAfter': 'nach',
  'workbench.docs.body.multiTab.layout1Suffix': 'dem Ziehen geöffnet wird, erbt das neue Layout.',
  'workbench.docs.body.multiTab.draftsTitle': 'Ungespeicherte Entwürfe sind tab-lokal',
  'workbench.docs.body.multiTab.drafts1':
    'Editor-Entwürfe leben im Speicher ihres eigenen Tabs. Speichert Tab A dieselbe Regel, die Tab B ' +
    'gerade bearbeitet, gewinnt Tab A den Storage-Schreibvorgang — einen Tab-übergreifenden „Geändert, ' +
    'neu laden?“-Hinweis gibt es heute nicht. Relevant nur, wenn zwei Tabs dieselbe Entität gleichzeitig ' +
    'bearbeiten.',

  // ── Concepts: Request Tracking ──────────────────────────────────────
  'workbench.docs.body.requestTracking.intro1Prefix': 'Der Tab',
  'workbench.docs.body.requestTracking.thisPage': 'Diese Seite',
  'workbench.docs.body.requestTracking.intro1Suffix':
    'im Popup zeigt, welche Regeln für die aktuelle Seite aktiv sind und welche Anfragen sie getroffen ' +
    'haben. Die Verfolgung umfasst Anfrage- und Antwortphase jeder Verbindung, die die Seite aufbaut.',
  'workbench.docs.body.requestTracking.phasesCaption':
    'Eine einzelne Verbindung hat zwei Phasen — beide zählen für den Badge-Zähler.',
  'workbench.docs.body.requestTracking.howHeading': 'Wie es funktioniert',
  'workbench.docs.body.requestTracking.how1Prefix': 'Die Erweiterung beobachtet HTTP-Anfragen über die',
  'workbench.docs.body.requestTracking.how1Middle':
    'API. Wenn eine Anfrage-URL die Bedingungen einer Regel trifft (Domains, URL-Muster oder URL-Regex), ' +
    'wird sie mit ihrem Ressourcentyp aufgezeichnet. Die Aufzeichnung passiert live im Service Worker; ' +
    'das Popup liest den Datensatz erst zurück, wenn du den Tab',
  'workbench.docs.body.requestTracking.how1Suffix': 'öffnest.',
  'workbench.docs.body.requestTracking.howCaption':
    'Der Browser feuert webRequest-Ereignisse; die Erweiterung gleicht ab und zeichnet auf; das Popup ' +
    'liest später.',
  'workbench.docs.body.requestTracking.badge1':
    'Jede getroffene Regel zeigt ein nummeriertes Badge mit der Zahl ihrer getroffenen Anfragen. Klicke ' +
    'auf das Badge, um eine Liste aus Zeitstempeln, URLs, Ressourcentypen und dem getroffenen Muster ' +
    'aufzuklappen.',
  'workbench.docs.body.requestTracking.badgeCaption':
    'Das Badge verdichtet den Zähler; ein Klick zeigt die vollständige Trefferliste.',
  'workbench.docs.body.requestTracking.directHeading': 'Direkte vs. indirekte Treffer',
  'workbench.docs.body.requestTracking.direct1Prefix': 'A',
  'workbench.docs.body.requestTracking.directTerm': 'direct',
  'workbench.docs.body.requestTracking.direct1Middle':
    '— ein direkter Treffer — bedeutet, dass die Seiten-URL selbst getroffen wurde. Ein',
  'workbench.docs.body.requestTracking.indirectTerm': 'indirekter',
  'workbench.docs.body.requestTracking.direct1Suffix':
    'Treffer bedeutet, dass nur eine Subressource — Script, Stylesheet, XHR, Bild, Schriftart — getroffen ' +
    'wurde, die Seiten-URL aber nicht. Dieselbe Regel kann je nach Seite, auf der du bist, beide Arten ' +
    'erzeugen.',
  'workbench.docs.body.requestTracking.directCaption':
    'Eine Regel, zwei Seitenkontexte. Grün = getroffen. Gestrichelt = ausgeschlossen.',
  'workbench.docs.body.requestTracking.typesHeading': 'Ressourcentypen',
  'workbench.docs.body.requestTracking.types1Prefix': 'Jede getroffene Anfrage trägt ihren Chrome-Typ',
  'workbench.docs.body.requestTracking.types1Middle':
    '— Page, Frame, Fetch/XHR, Script, CSS, Image, Font, Media, WebSocket, Ping oder Other. Sieh dir die ' +
    'Referenzseite',
  'workbench.docs.body.requestTracking.resourceTypesLink': 'Ressourcentypen',
  'workbench.docs.body.requestTracking.types1Suffix': 'für die vollständige Zuordnung mit Beispielen an.',

  // ── Reference: Resource Types (section shell + table descriptions;
  //    tags/codes/example lines stay raw parity vocabulary) ────────────
  'workbench.docs.body.resourceTypes.introPrefix': 'Referenz für die Chrome-Werte',
  'workbench.docs.body.resourceTypes.introSuffix':
    'aus der Anfragenverfolgung und der Bedingung Ressourcentypen. Jede Beschriftung entspricht genau ' +
    'einem zugrunde liegenden Typ — die Zeilen überlappen sich nicht.',
  'workbench.docs.body.resourceTypes.anatomyCaption':
    'Welche Art von Anfrage in welchem ResourceType landet — auf einen Blick.',
  'workbench.docs.body.resourceTypes.descPage': 'Top-Level-Dokumentnavigation — die URL in der Adressleiste.',
  'workbench.docs.body.resourceTypes.descFrame': 'Ein iframe oder verschachtelter Frame, eingebettet in die Seite.',
  'workbench.docs.body.resourceTypes.descXhr':
    'API-Aufrufe über fetch() oder XMLHttpRequest. Chrome meldet beide als denselben Typ — sie lassen ' +
    'sich nicht unterscheiden.',
  'workbench.docs.body.resourceTypes.descScript': 'JavaScript-Dateien, die die Seite lädt.',
  'workbench.docs.body.resourceTypes.descStylesheet': 'Stylesheets, die die Seite lädt.',
  'workbench.docs.body.resourceTypes.descImage': 'Bilder, die die Seite oder ihre Styles laden.',
  'workbench.docs.body.resourceTypes.descFont': 'Webfonts, geladen über @font-face-Regeln.',
  'workbench.docs.body.resourceTypes.descMedia': 'Audio- oder Videoressourcen.',
  'workbench.docs.body.resourceTypes.descWebsocket':
    'WebSocket-Handshake — die initiale HTTP-Upgrade-Anfrage. Nur der Handshake wird verfolgt, nicht ' +
    'einzelne Nachrichten.',
  'workbench.docs.body.resourceTypes.descPing': 'Beacon- und Ping-Anfragen, typischerweise für Analyse/Tracking.',
  'workbench.docs.body.resourceTypes.descOther': 'Alles, was in keine der obigen Kategorien passt.',

  // ── Concepts: Actions (overview) ────────────────────────────────────
  'workbench.docs.body.actions.intro1Prefix': 'Eine Aktion ist das „',
  'workbench.docs.body.actions.introDo': 'Tun',
  'workbench.docs.body.actions.intro1Middle': '“ einer Regel. Wo eine',
  'workbench.docs.body.actions.conditionLink': 'Bedingung',
  'workbench.docs.body.actions.intro1Middle2': 'entscheidet,',
  'workbench.docs.body.actions.introWhether': 'ob',
  'workbench.docs.body.actions.intro1Middle3': 'die Regel feuert, entscheidet die Aktion,',
  'workbench.docs.body.actions.introWhatChanges': 'was sich ändert',
  'workbench.docs.body.actions.intro1Suffix':
    '. Jede Regel koppelt einen Stapel AND-verknüpfter Bedingungen an genau eine Aktion.',
  'workbench.docs.body.actions.categories1':
    'Aktionen fallen in drei Kategorien — die ausgehende Anfrage verändern, die eingehende Antwort ' +
    'verändern oder Code in der Seite ausführen. Jede Aktion wird von einer von zwei Engines umgesetzt:',
  'workbench.docs.body.actions.engineDnr': 'DNR',
  'workbench.docs.body.actions.categoriesDnrParen': '(die Chrome-API',
  'workbench.docs.body.actions.categoriesDnrSuffix': ', schnell und nativ) oder',
  'workbench.docs.body.actions.engineScript': 'Script',
  'workbench.docs.body.actions.categoriesScriptParen':
    '(die In-Page-Engine von Open Headers, für das, was DNR nicht ausdrücken kann). Siehe',
  'workbench.docs.body.actions.executionLink': 'Wie Regeln ausgeführt werden',
  'workbench.docs.body.actions.categories1Suffix': 'für die Abwägungen.',
  'workbench.docs.body.actions.ruleAnatomyCaption':
    'Eine Regel = AND-verknüpfte Bedingungen, gekoppelt an genau eine Aktion.',
  'workbench.docs.body.actions.taxonomyCaption': 'Drei Kategorien, jede Aktion mit ihrem Engine-Tag.',
  'workbench.docs.body.actions.modifyRequestTitle': 'Anfrage verändern',
  'workbench.docs.body.actions.tagRequest': 'bevor sie den Browser verlässt',
  'workbench.docs.body.actions.modifyRequest1':
    'Forme die ausgehende Anfrage um — ihre Header, URL-Parameter, ihren Body, ihr Ziel oder ob sie ' +
    'überhaupt hinausgeht. Die meisten Regeln leben hier.',
  'workbench.docs.body.actions.headerActionsLink': 'Header-Aktionen',
  'workbench.docs.body.actions.liHeaderActionsRequest':
    '— Hinzufügen / Überschreiben / Anfügen / Entfernen / Zusammenführen auf Anfrage-Headern.',
  'workbench.docs.body.actions.blockLink': 'Blockieren',
  'workbench.docs.body.actions.liBlock': '— die Anfrage auf der Netzwerkebene abbrechen.',
  'workbench.docs.body.actions.redirectLink': 'Umleiten',
  'workbench.docs.body.actions.liRedirect': '— die Anfrage an eine andere URL schicken, statisch oder per Regex.',
  'workbench.docs.body.actions.queryParamsLink': 'Query-Parameter',
  'workbench.docs.body.actions.liQueryParams': '— URL-Parameter hinzufügen, ersetzen oder entfernen.',
  'workbench.docs.body.actions.requestBodyLink': 'Anfrage-Body',
  'workbench.docs.body.actions.liRequestBody':
    '— den ausgehenden fetch- / XHR-Body umschreiben (statisch, dynamisch oder GraphQL-gefiltert).',
  'workbench.docs.body.actions.modifyResponseTitle': 'Antwort verändern',
  'workbench.docs.body.actions.tagResponse': 'bevor die Seite sie sieht',
  'workbench.docs.body.actions.modifyResponse1':
    'Forme die Antwort auf dem Rückweg um — Header, Body oder HTTP-Status. Nützlich, um ungebaute ' +
    'Endpunkte zu simulieren und Fehlermodi in der Entwicklung zu erzwingen.',
  'workbench.docs.body.actions.liHeaderActionsResponse': '— dieselben fünf Operationen gelten für Antwort-Header.',
  'workbench.docs.body.actions.responseLink': 'Antwort verändern',
  'workbench.docs.body.actions.liResponse':
    '— die Antwort simulieren oder verändern: synthetischer Body, Status oder Header.',
  'workbench.docs.body.actions.runCodeTitle': 'Code ausführen',
  'workbench.docs.body.actions.tagRunCode': 'in der Seite oder ihrem Scheduler',
  'workbench.docs.body.actions.runCode1':
    'Effekte, die nicht sauber unter „eine Anfrage oder Antwort verändern“ fallen — Code-Injektion und ' +
    'künstliche Latenz. Beide laufen über die Script-Engine, weil DNR kein Gegenstück hat.',
  'workbench.docs.body.actions.injectLink': 'JS / CSS injizieren',
  'workbench.docs.body.actions.liInject':
    '— JavaScript oder CSS im Seitenkontext ausführen, vor den Seiten-Scripts oder nachdem das DOM bereit ' + 'ist.',
  'workbench.docs.body.actions.delayLink': 'Verzögerung',
  'workbench.docs.body.actions.liDelay':
    '— künstliche Latenz zu Navigationen und JS-initiierten fetch / XHR hinzufügen.',
  'workbench.docs.body.actions.oneActionTitle': 'Eine Aktion pro Regel',
  'workbench.docs.body.actions.oneAction1':
    'Jede Regel trägt genau eine Aktion. Um zwei Dinge auf einmal zu tun — z. B. einen Header hinzufügen ' +
    'UND umleiten — schreibe zwei Regeln mit denselben Bedingungen. Beide feuern auf dieselbe Anfrage; ' +
    'DNR setzt sie in einer dokumentierten Reihenfolge zusammen.',

  // ── Actions: Header Actions ─────────────────────────────────────────
  'workbench.docs.body.headerActions.intro':
    'Vier Operationen auf Anfrage- und Antwort-Headern — drei native (Hinzufügen / Überschreiben, ' +
    'Anfügen, Entfernen) plus eine Script-basierte (Zusammenführen) für Wertverkettung, die DNR nicht ' +
    'ausdrücken kann.',
  'workbench.docs.body.headerActions.opsCaption': 'Gleiche Ausgangs-Header, vier verschiedene Ergebnisse',
  'workbench.docs.body.headerActions.overrideTitle': 'Hinzufügen / Überschreiben',
  'workbench.docs.body.headerActions.override1':
    'Setzt den Header auf diesen Wert. Ersetzt, wenn vorhanden, fügt hinzu, wenn nicht — immer genau ein ' +
    'Header mit deinem Wert.',
  'workbench.docs.body.headerActions.overrideCaption':
    'Dieselbe Regel deckt beide Fälle ab — ersetzt, wenn vorhanden, fügt hinzu, wenn nicht.',
  'workbench.docs.body.headerActions.overrideWontApplyCaption':
    'Treffen die Bedingungen der Regel die Anfrage nicht, passiert nichts — kein Fehler, ein No-op.',
  'workbench.docs.body.headerActions.appendTitle': 'Anfügen',
  'workbench.docs.body.headerActions.append1':
    'Fügt einen neuen Header-Eintrag mit demselben Namen hinzu. Das Original bleibt — es entstehen ' +
    'doppelte Header. Nutze es für Set-Cookie, Link, Via.',
  'workbench.docs.body.headerActions.appendCaption':
    'Der ursprüngliche Header bleibt; eine zweite Zeile mit demselben Namen kommt hinzu. Beide werden ' +
    'ausgeliefert.',
  'workbench.docs.body.headerActions.appendWontApplyCaption':
    'Manche Header lassen sich nicht duplizieren — der Browser fasst sie zusammen. Greif stattdessen zu ' +
    'Überschreiben oder Zusammenführen.',
  'workbench.docs.body.headerActions.removeTitle': 'Entfernen',
  'workbench.docs.body.headerActions.remove1': 'Löscht alle Instanzen dieses Headers. Kein Wert nötig.',
  'workbench.docs.body.headerActions.removeCaption':
    'Die Zielzeile verschwindet; alles andere fließt unverändert durch.',
  'workbench.docs.body.headerActions.removeWontApplyCaption':
    'Ist der Header nicht da, passiert nichts — kein Fehler, nur ein No-op.',
  'workbench.docs.body.headerActions.mergeTitle': 'Zusammenführen',
  'workbench.docs.body.headerActions.merge1Prefix':
    'Liest zur Laufzeit den vorhandenen Wert und hängt deinen mit einem Trennzeichen an. Standard ist',
  'workbench.docs.body.headerActions.merge1Middle': 'für Cookie und',
  'workbench.docs.body.headerActions.merge1Suffix':
    'für andere. Das Trennzeichen darf für direkte Verkettung leer sein.',
  'workbench.docs.body.headerActions.mergeCaption':
    'Der vorhandene Wert bleibt; dein Wert wird nach dem Trennzeichen angehängt.',
  'workbench.docs.body.headerActions.mergeWontApplyCaption':
    'Nur Script-Engine — Seitennavigationen und statische Ressourcen fließen unberührt durch.',
  'workbench.docs.body.headerActions.mergeLimitation':
    'Zusammenführen ist in den DevTools unsichtbar und kann Browser-Standard-Header (Accept, User-Agent) ' +
    'nicht lesen — nur Header, die der Seitencode explizit gesetzt hat.',

  // ── Actions: Block ──────────────────────────────────────────────────
  'workbench.docs.body.block.intro':
    'Bricht passende Anfragen auf der Netzwerkebene ab. Der Browser erhält einen Netzwerkfehler, und die ' +
    'Seite sieht die Anfrage scheitern, als wäre der Server nicht erreichbar.',
  'workbench.docs.body.block.howTitle': 'Wie es funktioniert',
  'workbench.docs.body.block.how1Prefix': 'Kompiliert zu einer DNR-Aktion vom Typ',
  'workbench.docs.body.block.how1Suffix':
    'ohne Body. Gilt unabhängig vom Ressourcentyp — Seiten, Sub-Frames, Scripts, Bilder, Schriftarten, ' +
    'fetch, XHR — eine einzige Regel deckt also alles ab, sofern du sie nicht mit einer ' +
    'Ressourcentyp-Bedingung eingrenzt.',
  'workbench.docs.body.block.blockCaption':
    'Die Anfrage wird beendet, bevor sie den Browser verlässt; die Seite sieht einen Netzwerkfehler.',
  'workbench.docs.body.block.wontApplyCaption':
    'Bereits geladene Ressourcen bleiben geladen — Blockieren fängt nur künftige Anfragen.',
  'workbench.docs.body.block.whenTitle': 'Wann du das nutzt',
  'workbench.docs.body.block.when1Prefix':
    'Werbe- / Analyse- / Tracking-Domains blockieren, Ausfälle für einen einzelnen Host simulieren oder ' +
    'den Zugriff auf einen Endpunkt verweigern, während der Rest einer API erreichbar bleibt. Um nur das ' +
    'Dokument einer Seite zu blockieren (nicht ihre Subressourcen), ergänze eine Ressourcentyp-Bedingung ' +
    'mit',
  'workbench.docs.body.block.when1Suffix': '.',
  'workbench.docs.body.block.useCasesCaption':
    'Vier typische Muster — grenze jedes mit Bedingungen ein (Domains, URL-Muster, Ressourcentyp).',
  'workbench.docs.body.block.note1Prefix': 'Wird eine Anfrage vom Typ',
  'workbench.docs.body.block.note1Suffix':
    'blockiert, rendert Chrome eine „ERR_BLOCKED_BY_CLIENT“-Seite. Subressourcen-Blockaden passieren ' +
    'still — was sichtbar ist, hängt von der eigenen Fehlerbehandlung der Seite ab.',

  // ── Actions: Redirect ───────────────────────────────────────────────
  'workbench.docs.body.redirect.intro':
    'Leitet passende Anfragen zu einer anderen URL um. Unterstützt statische URLs und ' + 'Regex-Erfassungsgruppen.',
  'workbench.docs.body.redirect.staticTitle': 'Statische Umleitung',
  'workbench.docs.body.redirect.static1':
    'Gib eine vollständige URL ein, um jede passende Anfrage zum selben Ziel umzuleiten.',
  'workbench.docs.body.redirect.staticCaption': 'Dasselbe Ziel für jede passende Anfrage — vollständige URL-Ersetzung.',
  'workbench.docs.body.redirect.regexTitle': 'Regex-Umleitung',
  'workbench.docs.body.redirect.regex1Prefix': 'Kombiniere mit einer URL-Regex-Bedingung. Verwende',
  'workbench.docs.body.redirect.regex1Suffix': 'usw., um Erfassungsgruppen in der Ziel-URL zu referenzieren.',
  'workbench.docs.body.redirect.regexCaption':
    'Der getroffene Text der Erfassungsgruppe wird in die Ziel-URL eingesetzt.',
  'workbench.docs.body.redirect.wontApplyCaption':
    'Umleiten wirkt nicht rückwirkend auf bereits geladene Seiten. Schleifen kappt Chrome stillschweigend.',
  'workbench.docs.body.redirect.whenTitle': 'Wann du das nutzt',
  'workbench.docs.body.redirect.when1':
    'HTTP → HTTPS erzwingen, Nutzer von einer alten Domain migrieren, API-Versionen umschreiben und ' +
    'CDN-Traffic auf einen lokalen Dev-Server umbiegen sind die vier typischen Muster. Nimm Statisch für ' +
    'vollständige URLs, die du vorab kennst; greif zu Regex, wenn der Pfad durch die Umleitung ' +
    'mitgetragen werden soll.',
  'workbench.docs.body.redirect.useCasesCaption':
    'Vier typische Muster — wähle Regex, wenn der Zielpfad vom Treffer abhängt.',

  // ── Actions: Query Params ───────────────────────────────────────────
  'workbench.docs.body.queryParam.introPrefix':
    'Verändere URL-Query-Parameter, bevor die Anfrage den Browser verlässt. Kompiliert zu einer ' +
    'DNR-Aktion vom Typ',
  'workbench.docs.body.queryParam.introSuffix': '.',
  'workbench.docs.body.queryParam.addTitle': 'Hinzufügen / Überschreiben',
  'workbench.docs.body.queryParam.add1':
    'Fügt den Parameter hinzu, wenn er fehlt, oder ersetzt seinen Wert, wenn er schon da ist.',
  'workbench.docs.body.queryParam.addCaption':
    'Fügt hinzu, wenn er fehlt, ersetzt, wenn vorhanden — immer genau ein passender Parameter mit deinem ' + 'Wert.',
  'workbench.docs.body.queryParam.replaceOnlyTitle': 'Nur überschreiben',
  'workbench.docs.body.queryParam.replaceOnly1Prefix': 'Ersetzt den Wert',
  'workbench.docs.body.queryParam.replaceOnlyStrong': 'nur, wenn der Parameter bereits vorhanden ist',
  'workbench.docs.body.queryParam.replaceOnly1Middle':
    '. URLs ohne den Parameter bleiben unberührt. Nutze das, um einen Wert zu kanonisieren (z. B. erzwinge',
  'workbench.docs.body.queryParam.replaceOnly1Suffix':
    'auf URLs, die bereits irgendeine Region tragen), ohne ihn in URLs zu injizieren, die ihn nicht ' + 'hatten.',
  'workbench.docs.body.queryParam.replaceOnlyCaption':
    'Ersetzt nur vorhandene Werte — URLs ohne den Parameter bleiben unberührt.',
  'workbench.docs.body.queryParam.removeTitle': 'Entfernen',
  'workbench.docs.body.queryParam.remove1': 'Entfernt bestimmte Parameter nach Name. Der Wert wird ignoriert.',
  'workbench.docs.body.queryParam.removeCaption':
    'Der benannte Parameter verschwindet; jeder andere Query-Parameter fließt durch.',
  'workbench.docs.body.queryParam.removeAllTitle': 'Alle entfernen',
  'workbench.docs.body.queryParam.removeAll1':
    'Streicht den gesamten Query-String. Lässt sich nicht mit Hinzufügen / Überschreiben in derselben ' +
    'Regel kombinieren.',
  'workbench.docs.body.queryParam.removeAllCaption': 'Streicht die ganze Query in einem Schritt — die URL endet nackt.',
  'workbench.docs.body.queryParam.wontApplyCaption':
    'Alle entfernen kollidiert auf der DNR-Ebene mit Hinzufügen / Überschreiben — teile es in zwei Regeln ' + 'auf.',
  'workbench.docs.body.queryParam.whenTitle': 'Wann du das nutzt',
  'workbench.docs.body.queryParam.when1':
    'Ein Debug-Flag erzwingen, Region oder Locale kanonisieren, Tracking-Parameter ausputzen oder alle ' +
    'Query-Strings für mehr Privatsphäre streichen. Jedes davon passt sauber auf eine der vier ' +
    'Operationen oben.',
  'workbench.docs.body.queryParam.useCasesCaption':
    'Vier typische Muster — wähle die Operation, die zu deiner Absicht passt.',

  // ── Actions: Inject JS / CSS ────────────────────────────────────────
  'workbench.docs.body.inject.intro':
    'Injiziere JavaScript oder CSS in passende Seiten. Der Code läuft über ein Content-Script im Kontext ' +
    'der Seite.',
  'workbench.docs.body.inject.timingCaption':
    'Einfüge-Timing — vor den Seiten-Scripts (So früh wie möglich) vs. DOM-sicher (Nach dem Laden der ' + 'Seite).',
  'workbench.docs.body.inject.scriptTitle': 'Script-Injektion',
  'workbench.docs.body.inject.script1': 'Inline-Code oder eine externe URL. Wähle das Einfüge-Timing:',
  'workbench.docs.body.inject.asapStrong': 'So früh wie möglich',
  'workbench.docs.body.inject.asap1':
    '— läuft vor den eigenen Scripts der Seite. Nützlich für Monkey-Patches, die das Rennen gewinnen ' +
    'müssen (z. B. das Wrappen von',
  'workbench.docs.body.inject.asap1Suffix': 'bevor der App-Code sich eine Referenz greift).',
  'workbench.docs.body.inject.afterStrong': 'Nach dem Laden der Seite',
  'workbench.docs.body.inject.after1':
    '— läuft, sobald die Seite geparst ist. Der sicherere Standard für Code, der das DOM liest, weil die ' +
    'Elemente garantiert existieren.',
  'workbench.docs.body.inject.scriptCaption':
    'Das Script landet als <script>-Tag in der Seite — sieht dieselben Globals wie das Seiten-JS.',
  'workbench.docs.body.inject.cssTitle': 'CSS-Injektion',
  'workbench.docs.body.inject.css1Prefix': 'Injiziere eigenes CSS als Tag vom Typ',
  'workbench.docs.body.inject.css1Suffix':
    '. Nützlich für Dark-Mode-Überschreibungen, das Ausblenden störender Elemente oder Theming pro ' + 'Umgebung.',
  'workbench.docs.body.inject.cssCaption': 'CSS wird als <style>-Tag angehängt, mit normaler CSS-Spezifität.',
  'workbench.docs.body.inject.wontApplyCaption':
    'Sandboxed iframes und Seiten mit strikter CSP blockieren injizierte Scripts.',
  'workbench.docs.body.inject.whenTitle': 'Wann du das nutzt',
  'workbench.docs.body.inject.when1':
    'Browser-APIs monkey-patchen, bevor der App-Code sie greift, ein Dark-Mode-Theme erzwingen, störende ' +
    'UI-Elemente ausblenden und Feature-Flags auf window-Ebene setzen, bevor die Seite initialisiert.',
  'workbench.docs.body.inject.useCasesCaption':
    'Vier typische Muster — für das erste und vierte ist das Timing So früh wie möglich nötig.',

  // ── Actions: Delay ──────────────────────────────────────────────────
  'workbench.docs.body.delay.intro':
    'Fügt passenden Anfragen künstliche Latenz hinzu. Drei Spuren laufen parallel, je nach Art der ' + 'Anfrage.',
  'workbench.docs.body.delay.routingCaption': 'Verzögerungs-Routing — drei Spuren für drei Anfragearten.',
  'workbench.docs.body.delay.navHeading': 'Dokument- und iframe-Navigationen',
  'workbench.docs.body.delay.nav1Prefix': 'Laufen über eine lokale Warteseite. Respektiert Verzögerungen bis',
  'workbench.docs.body.delay.navMs': '30 000 ms',
  'workbench.docs.body.delay.nav1Suffix': '— die DNR-Umleitungsobergrenze von Chrome.',
  'workbench.docs.body.delay.navCaption':
    'Eine lokale Warteseite hält die Navigation N ms fest und leitet dann zum echten Ziel weiter.',
  'workbench.docs.body.delay.xhrHeading': 'JS-initiierte XHR / fetch',
  'workbench.docs.body.delay.xhr1Prefix': 'Abgefangen von einem Monkey-Patch auf',
  'workbench.docs.body.delay.xhr1Middle': '. Gedeckelt bei',
  'workbench.docs.body.delay.xhrMs': '5 000 ms',
  'workbench.docs.body.delay.xhr1Suffix':
    'damit der HTTP-Verbindungs-Pool von Chrome nicht aushungert — höhere Werte werden auf der Leitung ' + 'gekappt.',
  'workbench.docs.body.delay.xhrCaption':
    'Ein setTimeout im Patch auf Seitenebene hält den Aufruf, bevor er ans Netzwerk weitergeht.',
  'workbench.docs.body.delay.wontApplyCaption':
    'Subressourcen und Service-Worker-Fetches entkommen dem Monkey-Patch auf Seitenebene.',
  'workbench.docs.body.delay.whenTitle': 'Wann du das nutzt',
  'workbench.docs.body.delay.when1':
    'Regressionen im Ladezustand sichtbar machen, Debounce-/Throttle-Codepfade durchexerzieren, Race ' +
    'Conditions zwischen gleichzeitigen Anfragen aufdecken und langsame Netzwerkbedingungen in der ' +
    'lokalen Entwicklung annähern.',
  'workbench.docs.body.delay.useCasesCaption':
    'Vier typische Muster — kombiniere mit URL-Muster oder Domains zum Eingrenzen.',
  'workbench.docs.body.delay.desktopNoteTitle': 'Desktop-App — Produkthinweis',
  'workbench.docs.body.delay.desktopNote1':
    'Statische Ressourcen zu drosseln (Bilder, Scripts, Stylesheets, Schriftarten) braucht eine echte ' +
    'lokale Netzwerkschicht, die Verbindungen offen halten und Bytes streamen kann — außer Reichweite ' +
    'für eine Erweiterung. Die Desktop-App übernimmt das bald.',

  // ── Actions: Request Body ───────────────────────────────────────────
  'workbench.docs.body.requestBody.introPrefix':
    'Überschreibe oder transformiere den Anfrage-Body, bevor er den Browser verlässt. Script-basiert — ' +
    'im Abfangpfad liegen',
  'workbench.docs.body.requestBody.introAnd': 'und',
  'workbench.docs.body.requestBody.introDot': '.',
  'workbench.docs.body.requestBody.interceptCaption':
    'Die Regel feuert zwischen page.js und dem Netzwerk — drei Transformationsformen',
  'workbench.docs.body.requestBody.staticTitle': 'Statischer Body',
  'workbench.docs.body.requestBody.static1':
    'Ersetzt den gesamten Anfrage-Body durch eine feste Zeichenkette. Funktioniert für REST und GraphQL ' +
    '— die Regel parst den Body nicht, sie ersetzt ihn im Ganzen.',
  'workbench.docs.body.requestBody.staticCaption': 'Ganzer Body ersetzt — das Original wird verworfen.',
  'workbench.docs.body.requestBody.dynamicTitle': 'Dynamischer Body',
  'workbench.docs.body.requestBody.dynamic1':
    'Schreibe eine Funktion, die den ursprünglichen Body und den Anfragekontext erhält und den ' +
    'veränderten Body zurückgibt. Die Funktion erhält',
  'workbench.docs.body.requestBody.dynamicDot': '.',
  'workbench.docs.body.requestBody.dynamicCaption':
    'Die Funktion sieht das Original; sie gibt zurück, was gesendet werden soll.',
  'workbench.docs.body.requestBody.graphqlTitle': 'GraphQL-Filter',
  'workbench.docs.body.requestBody.graphql1Prefix':
    'Ist der Ressourcentyp GraphQL, feuert die Regel nur auf Anfragen, deren konfiguriertes Feld in der ' +
    'JSON-Payload zum Wert passt. Die Laufzeitumgebung parst den Anfrage-Body als JSON, liest das Feld ' +
    'namens',
  'workbench.docs.body.requestBody.graphql1Middle': 'und prüft es gegen',
  'workbench.docs.body.requestBody.graphql1Middle2': 'mit dem gewählten Operator (',
  'workbench.docs.body.requestBody.graphql1Middle3': 'für den exakten Treffer,',
  'workbench.docs.body.requestBody.graphql1Suffix': 'für Teilzeichenketten).',
  'workbench.docs.body.requestBody.graphql2Prefix': 'Übliche Schlüssel:',
  'workbench.docs.body.requestBody.graphql2Middle': 'für die benannte Operation,',
  'workbench.docs.body.requestBody.graphql2Suffix':
    'für eine Teilzeichenkette des Abfragetexts. Anfragen ohne JSON-Body oder mit fehlendem oder nicht ' +
    'passendem Feld fließen unberührt durch.',
  'workbench.docs.body.requestBody.graphqlCaption':
    'Ein Gate auf Feldebene — Operationen, die nicht passen, fließen unberührt durch.',
  'workbench.docs.body.requestBody.wontApplyCaption':
    'GET/HEAD haben nichts zu ersetzen; statische Ressourcen betreten den Script-Abfangpfad nicht.',
  'workbench.docs.body.requestBody.whenTitle': 'Wann du das nutzt',
  'workbench.docs.body.requestBody.when1':
    'Test-Fixtures erzwingen, jede Payload mit Metadaten stempeln (Debug-Flags, Anfrage-IDs), bestimmte ' +
    'GraphQL-Operationen simulieren und PII vor dem Replay anonymisieren sind die vier typischen Muster.',
  'workbench.docs.body.requestBody.useCasesCaption':
    'Vier typische Muster — kombiniere mit URL-Muster oder Domains zum Eingrenzen.',

  // ── Actions: Modify Response ────────────────────────────────────────
  'workbench.docs.body.response.introPrefix':
    'Fange API-Aufrufe ab und liefere eigene Antworten — volle Kontrolle über Statuscode, Body und ' +
    'Antwort-Header. Script-basiert — im Abfangpfad liegen',
  'workbench.docs.body.response.introAnd': 'und',
  'workbench.docs.body.response.introDot': '.',
  'workbench.docs.body.response.flowCaption':
    'Statisch überspringt das Netzwerk komplett; Dynamisch trifft es zuerst und transformiert dann.',
  'workbench.docs.body.response.staticTitle': 'Statische Antwort',
  'workbench.docs.body.response.static1':
    'Liefert einen festen Body mit voller Kontrolle über die synthetische Antwort — Statuscode, ' +
    'Content-Type und beliebige zusätzliche Antwort-Header (Set-Cookie, CORS-Header, eigene Flags). Die ' +
    'echte Anfrage wird nie gestellt. Nützlich für Offline-Entwicklung gegen ein bekanntes Fixture.',
  'workbench.docs.body.response.staticCaption':
    'Der Server wird nie kontaktiert — die Seite erhält das Fixture, als käme es von der Leitung.',
  'workbench.docs.body.response.dynamicTitle': 'Dynamische Antwort',
  'workbench.docs.body.response.dynamic1':
    'Die echte Anfrage wird zuerst gestellt. Deine Funktion erhält die Antwort und den Anfragekontext ' +
    'und gibt die veränderte Antwort zurück. Die Funktion erhält',
  'workbench.docs.body.response.dynamicDot': '.',
  'workbench.docs.body.response.dynamic2':
    'Statuscode, Content-Type und die auf der Regel gesetzten Antwort-Header-Felder gelten weiterhin ' +
    'über dem Rückgabewert der Funktion — du kannst also den Body verändern und die Regel die ' +
    'Rahmen-Header steuern lassen.',
  'workbench.docs.body.response.dynamicCaption':
    'Der echte Aufruf passiert zuerst; die Funktion schreibt um, was zurückkommt.',
  'workbench.docs.body.response.graphqlTitle': 'GraphQL-Filter',
  'workbench.docs.body.response.graphql1':
    'Ist der Ressourcentyp GraphQL, feuert die Regel nur auf Anfragen, deren konfiguriertes Feld in der ' +
    'JSON-Payload zu dem von dir gesetzten Wert passt (Equals oder Contains) — ein einzelner Endpunkt, ' +
    'der viele Operationen bündelt, lässt sich so Operation für Operation abfangen. Anfragen, deren ' +
    'Payload nicht passt, fließen unberührt weiter ans Netzwerk.',
  'workbench.docs.body.response.wontApplyCaption':
    'Statische Ressourcen und Seitennavigationen betreten den Script-Abfangpfad nie.',
  'workbench.docs.body.response.whenTitle': 'Wann du das nutzt',
  'workbench.docs.body.response.when1':
    'Offline-Entwicklung gegen ein Fixture, das Simulieren bestimmter Fehlerantworten, das Schwärzen von ' +
    'PII, bevor sie die Seite erreicht, und das Durchspielen von Payload-Sonderformen, die gegen ein ' +
    'echtes Back-end schwer zu reproduzieren sind.',
  'workbench.docs.body.response.useCasesCaption':
    'Vier typische Muster — nimm Statisch für Fixtures, Dynamisch für Transformationen echter Daten.',

  // ── Reference: Conditions ───────────────────────────────────────────
  'workbench.docs.body.conditions.intro1Prefix':
    'Eine Bedingung ist ein Filter auf einem Attribut einer ausgehenden Anfrage. Staple mehrere ' +
    'Bedingungen, und sie verknüpfen sich mit AND-Logik — jede Bedingung muss passen, damit die Regel ' +
    'feuert. Jede Bedingung entspricht direkt einem Feld der Chrome-API',
  'workbench.docs.body.conditions.intro1Suffix': '.',
  'workbench.docs.body.conditions.intro2Prefix': 'Die meisten Bedingungen gibt es im Regel-Editor auch als',
  'workbench.docs.body.conditions.exclStrong': 'ausschl.',
  'workbench.docs.body.conditions.intro2Suffix':
    'Variante — Methoden ausschl., Ressourcen ausschl., Initiator ausschl., Antw.-Header ausschl. —, die ' +
    'den Abgleich umkehrt (z. B. „alles außer diesen Methoden“). Nutze sie, wann immer die Negativmenge ' +
    'kleiner ist als die Positivmenge.',
  'workbench.docs.body.conditions.anatomyCaption':
    'Eine Regel koppelt AND-verknüpfte Bedingungen an eine Aktion — die Bedingungen entscheiden, ob die ' +
    'Regel feuert.',
  'workbench.docs.body.conditions.matchingCaption':
    'Jede Bedingung prüft ein Anfrageattribut. Alle müssen passen, damit die Regel feuert.',
  'workbench.docs.body.conditions.hostVsOriginCaption':
    'Die Seiten-URL und die Ziel-URL des fetch werden getrennt verfolgt — deshalb gibt es zwei ' +
    'Domain-Bedingungen.',
  'workbench.docs.body.conditions.urlPatternTitle': 'URL-Muster',
  'workbench.docs.body.conditions.urlPattern1Prefix': 'Wildcard-Muster auf der vollständigen URL. Verwende',
  'workbench.docs.body.conditions.urlPattern1Middle': 'für beliebige Zeichen. Das Protokoll muss angegeben sein:',
  'workbench.docs.body.conditions.urlPattern1Middle2': 'für jedes,',
  'workbench.docs.body.conditions.urlPattern1Suffix': 'nur für HTTPS.',
  'workbench.docs.body.conditions.urlPatternCaption':
    'Gold = Wildcard, Grün = wörtlich. Jede Test-URL unten zeigt, ob das Muster sie trifft.',
  'workbench.docs.body.conditions.urlRegexTitle': 'URL-Regex',
  'workbench.docs.body.conditions.urlRegex1':
    'RE2-regulärer Ausdruck auf der vollständigen URL einschließlich Protokoll. Für Abgleiche, die ' +
    'Wildcards nicht ausdrücken können. Lässt sich nicht mit URL-Muster in derselben Regel kombinieren.',
  'workbench.docs.body.conditions.urlRegexCaption':
    'Lila = echte Regex-Syntax. Grün = wörtliche Zeichen. Jede Test-URL unten zeigt, ob die Regex trifft.',
  'workbench.docs.body.conditions.requestDomainsTitle': 'Anfrage-Domains',
  'workbench.docs.body.conditions.requestDomains1Prefix':
    'Trifft eine Domain plus automatisch jede ihrer Subdomains. Gib die Apex-Domain einmal ein; die ' + 'Regel deckt',
  'workbench.docs.body.conditions.requestDomains1Suffix': 'und jede tiefere Verschachtelung ab — ohne Wildcards.',
  'workbench.docs.body.conditions.requestDomainsCaption':
    'Ein Wert, alle Subdomains. Die Grenzfälle unten zeigen, was als echte Subdomain zählt.',
  'workbench.docs.body.conditions.excludeDomainsTitle': 'Domains ausschließen',
  'workbench.docs.body.conditions.excludeDomains1':
    'Zieht Hosts von den Treffern einer anderen Bedingung ab — dieselbe Subdomain-Semantik wie ' +
    'Anfrage-Domains, einen Host auszuschließen schließt also auch seine Subdomains aus. Trifft für ' +
    'sich allein nichts.',
  'workbench.docs.body.conditions.excludeDomainsCaption':
    'Das grüne Einschließen engt auf eine Kandidatenmenge ein; das rote Ausschließen entfernt einige ' +
    'davon. Subdomains folgen.',
  'workbench.docs.body.conditions.initiatorDomainsTitle': 'Initiator-Domains',
  'workbench.docs.body.conditions.initiatorDomains1':
    'Trifft danach, welche Seite offen ist, wenn die Anfrage gestellt wird — den Ursprung der Anfrage, ' +
    'nicht ihr Ziel. Derselbe fetch-Aufruf an dieselbe URL kann treffen oder verfehlen, je nachdem, in ' +
    'welchem Tab du gerade bist.',
  'workbench.docs.body.conditions.initiatorDomainsCaption':
    'Dasselbe Ziel, zwei verschiedene Seitenkontexte. Der Initiator entscheidet, welcher trifft.',
  'workbench.docs.body.conditions.methodsTitle': 'Methoden',
  'workbench.docs.body.conditions.methods1':
    'Filtere nach HTTP-Verb. Mehrfachauswahl — wähle die Methoden, die treffen sollen; die übrigen lösen ' +
    'die Regel nicht aus. Lass die Bedingung ganz weg, um jede Methode zu treffen.',
  'workbench.docs.body.conditions.methodsCaption':
    'Orangefarbene Pillen sind ausgewählt; graue werden übersprungen. Die Testanfragen unten verfolgen ' +
    'jedes Verb zu seinem Ergebnis.',
  'workbench.docs.body.conditions.resourceTypesTitle': 'Ressourcentypen',
  'workbench.docs.body.conditions.resourceTypes1Prefix':
    'Filtere danach, welche Art von Ressource geladen wird — Seitennavigationen, XHR/fetch, Scripts, ' +
    'Bilder, Schriftarten und mehr. Mehrfachauswahl wie bei Methoden. Sieh dir die Referenz',
  'workbench.docs.body.conditions.resourceTypesLink': 'Ressourcentypen',
  'workbench.docs.body.conditions.resourceTypes1Suffix':
    'für die vollständige Liste mit Codenamen und konkreten Beispielen an.',
  'workbench.docs.body.conditions.resourceTypesCaption':
    'Lila Arten treffen; graue werden übersprungen. Jede Testanfrage zeigt ihre Art inline.',
  'workbench.docs.body.conditions.domainTypeTitle': 'Domain-Typ',
  'workbench.docs.body.conditions.domainType1Prefix': 'Klassifiziert jede Anfrage nach ihrer Beziehung zur Seite —',
  'workbench.docs.body.conditions.domainType1Middle': 'wenn das Ziel die registrierbare Domain der Seite teilt,',
  'workbench.docs.body.conditions.domainType1Suffix':
    'wenn nicht. Üblich: Tracker blockieren (nur thirdParty treffen) oder eine Regel auf die eigenen ' +
    'Dienste eingrenzen (nur firstParty treffen).',
  'workbench.docs.body.conditions.domainTypeCaption':
    'Das Seitenbanner setzt den Origin; der Selektor wählt den treffenden Typ; die Tabelle zeigt das ' +
    'Urteil pro Ziel.',
  'workbench.docs.body.conditions.headersTitle': 'Antwort-Header',
  'workbench.docs.body.conditions.headers1':
    'Trifft Antworten, die einen bestimmten Header mit einem bestimmten Wert tragen. Das DNR von Chrome ' +
    'stellt keinen Abgleich von Anfrage-Headern bereit — diese Bedingung ist nur antwortseitig. ' +
    'Header-Name und Wert werden als exakte Zeichenketten verglichen (keine Wildcards, kein ' +
    'Teilabgleich), und der Header muss auf der Antwort tatsächlich vorhanden sein.',
  'workbench.docs.body.conditions.headersCaption':
    'Zwei Pillen (Name + Wert), verbunden durch =, dann Test-Antwort-Header, die jeden Fehlermodus ' + 'treffen.',

  // ── Open Headers: Paradigm ──────────────────────────────────────────
  'workbench.docs.body.paradigm.oneExtensionHeading': 'Alles in einer Erweiterung',
  'workbench.docs.body.paradigm.oneExtension1':
    'Drei Produktkategorien haben sich diese Fläche historisch untereinander aufgeteilt: Desktop-Proxys ' +
    'übernehmen das HTTP-Abfangen, Cloud-API-Plattformen halten deine Anfragen und Sammlungen, und ' +
    'leichte Header-Erweiterungen decken den Fall „nur einen Header umschreiben“ ab. Keine davon liefert ' +
    'die anderen mit. Open Headers schon — in einer einzigen Browser-Erweiterung, mit einem ' +
    'Arbeitsbereich-Speicher hinter jeder Oberfläche.',
  'workbench.docs.body.paradigm.convergenceCaption':
    'Drei Altkategorien laufen in einer Installation zusammen. Niemand sonst liefert diese Kombination ' +
    'in der Erweiterung.',
  'workbench.docs.body.paradigm.ruleEngineHeading': 'Regel-Engine auf Enterprise-Niveau',
  'workbench.docs.body.paradigm.ruleEngine1Prefix':
    'Die Regel-Engine ist kein einzelner Trick, über neun UIs gestreckt — sie ist zwei echte ' +
    'Ausführungspfade mit einer gemeinsamen Sprache darüber.',
  'workbench.docs.body.paradigm.dnrNativeStrong': 'DNR-native',
  'workbench.docs.body.paradigm.ruleEngine1Middle': 'Regeln kompilieren zur Chrome-eigenen',
  'workbench.docs.body.paradigm.ruleEngine1Middle2':
    'API und fangen jede vom Browser gestellte Anfrage ab (Seiten, Sub-Frames, fetch, XHR, Bilder, ' +
    'Schriftarten, Scripts). Die',
  'workbench.docs.body.paradigm.scriptEngineStrong': 'Script-Engine',
  'workbench.docs.body.paradigm.ruleEngine1Suffix':
    'setzt dort an, wo DNR nicht hinkommt — Header-Werte zusammenführen, Body-Inhalte transformieren, ' +
    'Antworten simulieren, Code injizieren, Aufrufe verzögern. Beide Engines lesen dieselbe ' +
    'Bedingungssprache und dieselben fünf Variablen-Geltungsbereiche — eine Regel, die du gegen DNR ' +
    'geschrieben hast, wandert mit dem Wechsel eines einzigen Aktionstyps zur Script-Engine.',
  'workbench.docs.body.paradigm.ruleEngineCaption':
    'Zwei Ausführungspfade, neun Regelkategorien, eine gemeinsame Bedingungs- und Variablensprache.',
  'workbench.docs.body.paradigm.apiCatalogHeading': 'Vollständiger API-Anfragenkatalog',
  'workbench.docs.body.paradigm.apiCatalog1':
    'Jede Fähigkeit, die ein Desktop-API-Client mitbringt — Anfragen bauen, Umgebungen, OAuth 2.0 ' +
    '(einschließlich PKCE + Client Credentials + Erneuerung), Pre-Request- und Post-Response-Scripts, ' +
    'multipart mit inhaltsadressierten Datei-Blobs, Sammlungen + Ordner, GraphQL mit ' +
    'Schema-Introspektion — lebt in der Erweiterung. Derselbe Arbeitsbereich-Speicher wie die Regeln, ' +
    'dieselben fünf Variablen-Geltungsbereiche, dieselben Oberflächen. Bring deine Sammlungen von einer ' +
    'anderen Plattform mit und arbeite weiter; nichts exportiert zurück in eine Cloud, die du nicht ' +
    'kontrollierst.',
  'workbench.docs.body.paradigm.apiCatalogCaption':
    'Der Anfrage-Editor, mit Protokollunterstützung, jedem Auth-Typ, Scripts, Dateien und Sammlungen — ' +
    'in der Erweiterung.',
  'workbench.docs.body.paradigm.localFirstHeading': 'Local-first als Bauprinzip',
  'workbench.docs.body.paradigm.localFirst1Prefix':
    '„Local-first“ ist eine Haltung, kein Feature. Die Erweiterung hat kein Kontosystem, kein ' +
    'Cloud-Relay, kein Tracking — die einzigen Nutzungsdaten sind anonymes Feature-Zählen, Byte für ' +
    'Byte einsehbar und mit einem Schalter aus — und du hast eine echte Wahl,',
  'workbench.docs.body.paradigm.localFirstWhere': 'wo',
  'workbench.docs.body.paradigm.localFirst1Suffix':
    'das Back-end lebt. Vier Hosting-Optionen, alle nur lokal, alle unter deiner Kontrolle: der Service ' +
    'Worker im Browser (heute, ohne Einrichtung), das eingebettete Back-end der Desktop-App, ein ' +
    'eigenständiger lokaler Server, der jede Oberfläche von Open Headers auf einer Maschine bedient, ' +
    'oder ein Back-end, das du auf deiner eigenen VM selbst hostest. Jede Option bewahrt dieselben ' +
    'Garantien; die Abwägung ist Reichweite, nicht Eigentum.',
  'workbench.docs.body.paradigm.localFirst2':
    'Teamzusammenarbeit läuft über nutzerkontrollierte Speicher-Back-ends (Git) — nicht über einen ' +
    'Anbieterserver.',
  'workbench.docs.body.paradigm.frontEnds1Prefix': 'Dasselbe Prinzip gilt dafür,',
  'workbench.docs.body.paradigm.frontEndsHow': 'wie',
  'workbench.docs.body.paradigm.frontEnds1Suffix':
    'du diese Daten erreichst. Die Browser-Erweiterung ist das Standard-Front-end — vier Oberflächen im ' +
    'Browser. Eine native Desktop-App, eine CLI und eine entfernte Web-App liefern wir daneben aus. ' +
    'Jedes Front-end spricht mit einem Back-end deiner Wahl; wähle jede beliebige Kombination, und jede ' +
    'Oberfläche bleibt synchron.',
  'workbench.docs.body.paradigm.autoSyncHeading': 'Auto-Sync, ohne deine Arbeit zu verlieren',
  'workbench.docs.body.paradigm.autoSync1Prefix':
    'Geräteübergreifender Sync ist meist der Punkt, an dem Local-first-Produkte einknicken und dich ' +
    'bitten, ihrer Cloud zu vertrauen. Open Headers löst ihn auf der Ebene',
  'workbench.docs.body.paradigm.perFieldStrong': 'einzelner Felder',
  'workbench.docs.body.paradigm.autoSync1Middle': ': Das Popup schaltet das Flag',
  'workbench.docs.body.paradigm.autoSync1Suffix':
    'einer Regel um, der Arbeitsbereich-Editor schreibt in derselben Regel einen Header-Wert um — beide ' +
    'landen, in beliebiger Reihenfolge, ohne Banner über veraltete Entwürfe und ohne Überschreiben. ' +
    'Derselbe Ansatz skaliert von den vier Oberflächen einer Erweiterung zu einem lokalen Server hinter ' +
    'Erweiterung + Desktop + CLI und zu Team-Arbeitsbereichen mit mehreren Nutzern über ein Git-Remote ' +
    '— ohne je einen Anbieterserver in der Mitte zu brauchen.',
  'workbench.docs.body.paradigm.fieldSyncCaption':
    'Zwei Oberflächen, eine Regel, verschiedene Felder — beide Änderungen landen, nichts wird ' + 'überschrieben.',
  'workbench.docs.body.paradigm.noteCalloutPrefix':
    'Willst du sehen, wie sich das mit anderen Tools vergleicht, die du vielleicht ausprobiert hast?',
  'workbench.docs.body.paradigm.comparisonLink': 'Wie wir uns vergleichen',
  'workbench.docs.body.paradigm.noteCalloutMiddle':
    'kommt als Nächstes. Willst du die ganze Plattform in einer Ansicht? Spring zu',
  'workbench.docs.body.paradigm.roadmapLink': 'Jede Oberfläche, ausgeliefert',
  'workbench.docs.body.paradigm.noteCalloutSuffix': '.',

  // ── Open Headers: Comparison ────────────────────────────────────────
  'workbench.docs.body.comparison.intro1':
    'Die kürzeste Fassung: Open Headers ist, was du bauen würdest, wenn du die Anfrage-Formkraft eines ' +
    'Desktop-Proxys, die Regelbibliothek einer Cloud-API-Plattform und die Immer-an-Oberfläche einer ' +
    'Nur-Header-Erweiterung nähmst und sie einen gemeinsamen Speicher teilen ließest.',
  'workbench.docs.body.comparison.matrixCaption':
    'Drei Produktkategorien mit je einem Satz Abwägungen — und wo Open Headers landet.',
  'workbench.docs.body.comparison.vsCloudHeading': 'vs. Cloud-API-Plattformen',
  'workbench.docs.body.comparison.vsCloud1':
    'Cloud-gehostete Tools erwarten, dass dein Traffic, deine Anmeldedaten und deine Regeldefinitionen ' +
    'auf ihren Servern leben. Dieses Modell setzt voraus, dass es dich nicht stört, wenn diese Daten ' +
    'deine Maschine verlassen — und dass du ein Konto pflegst, um an deine eigene Arbeit zu kommen. ' +
    'Open Headers macht keine der beiden Annahmen. Alles bleibt lokal; Teamzusammenarbeit läuft über ' +
    'nutzerkontrollierten Speicher (Git), nicht über die Datenbank eines Anbieters.',
  'workbench.docs.body.comparison.vsProxiesHeading': 'vs. Desktop-Proxys',
  'workbench.docs.body.comparison.vsProxies1Prefix':
    'Proxys leiten deinen gesamten Traffic durch einen separaten Prozess. Sie sind mächtig, aber ' +
    'schwer: eine Binärdatei installieren, ein CA-Zertifikat installieren, jede App auf den Proxy-Port ' +
    'zeigen lassen. Open Headers nutzt die Chrome-eigene',
  'workbench.docs.body.comparison.vsProxies1Suffix':
    'API für statischen Traffic und eine Script-Engine pro Seite für dynamische Transformationen. Kein ' +
    'Proxy-Port, kein CA-Zertifikat, keine Konfiguration pro App — und getroffene Regeln wirken mit den ' +
    'Berechtigungen der Seite selbst, nicht denen eines Man-in-the-Middle.',
  'workbench.docs.body.comparison.vsHeaderOnlyHeading': 'vs. Nur-Header-Erweiterungen',
  'workbench.docs.body.comparison.vsHeaderOnly1Prefix':
    'Nur-Header-Erweiterungen beherrschen genau einen Regeltyp und hören dort auf. Open Headers ' + 'beherrscht',
  'workbench.docs.body.comparison.nineLink': 'neun',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle':
    '— Header Hinzufügen / Überschreiben / Anfügen / Entfernen / Zusammenführen,',
  'workbench.docs.body.comparison.blockLink': 'Blockieren',
  'workbench.docs.body.comparison.redirectLink': 'Umleiten',
  'workbench.docs.body.comparison.queryParamsLink': 'Query-Parameter',
  'workbench.docs.body.comparison.injectLink': 'Injizieren',
  'workbench.docs.body.comparison.delayLink': 'Verzögerung',
  'workbench.docs.body.comparison.requestBodyLink': 'Anfrage-Body',
  'workbench.docs.body.comparison.responseLink': 'Antwort',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle2': '— alle getrieben von derselben',
  'workbench.docs.body.comparison.conditionLanguageLink': 'Bedingungssprache',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle3': ', alle beobachtbar über dieselbe Oberfläche der',
  'workbench.docs.body.comparison.requestTrackingLink': 'Anfragenverfolgung',
  'workbench.docs.body.comparison.vsHeaderOnly1Suffix': '.',
  'workbench.docs.body.comparison.whyMattersTitle': 'Warum das in der Praxis zählt',
  'workbench.docs.body.comparison.whyMatters1':
    'Die meisten Arbeitsabläufe berühren mehr als eine dieser Kategorien. Eine API-Antwort simulieren, ' +
    'einen Drittanbieter-Tracker blockieren und einen Debug-Header auf genau eine Umgebung erzwingen ' +
    'sind drei verschiedene Regeltypen — drei verschiedene Installationen in der alten Welt. Hier ' +
    'teilen sie sich einen Arbeitsbereich.',

  // ── Open Headers: Roadmap ───────────────────────────────────────────
  'workbench.docs.body.roadmap.intro1Prefix':
    'Open Headers hat rein lokal angefangen — eine Erweiterung auf einem Gerät. Jeder Meilenstein unten ' +
    'erweitert diese Form, ohne sie zu brechen, und jeder einzelne ist ausgeliefert. Nutzerübergreifender ' +
    'Sync läuft über',
  'workbench.docs.body.roadmap.userControlledStrong': 'nutzerkontrollierte',
  'workbench.docs.body.roadmap.intro1Suffix':
    'Mittel — Git-Repositorys und selbst gehostete Deployments — nie über eine vom Anbieter gehostete ' + 'Cloud.',
  'workbench.docs.body.roadmap.gitHeading': 'Arbeitsbereich-Zusammenarbeit über Git (teamfähig)',
  'workbench.docs.body.roadmap.git1Prefix':
    'Arbeitsbereiche serialisieren zu YAML in einem Git-Repository, das du kontrollierst. Pull ' +
    'synchronisiert; Push teilt; Merge-Konflikte löst das vorhandene Git-Werkzeug. Kein zentraler ' +
    'Server, kein Konto, kein Vendor-Lock-in. Echtzeit-Präsenz ist',
  'workbench.docs.body.roadmap.gitAnd': 'und',
  'workbench.docs.body.roadmap.git1Suffix': '— haltbar, nachvollziehbar, längst verstanden.',
  'workbench.docs.body.roadmap.desktopHeading': 'Desktop-App',
  'workbench.docs.body.roadmap.desktop1':
    'Eine native Binärdatei, die denselben Arbeitsbereich-Speicher fährt wie die Erweiterung. Nützlich ' +
    'für Flächen, die eine Erweiterung nicht erreicht — Traffic-Formung auf Systemebene, Bearbeiten in ' +
    'mehreren Fenstern, tiefere Dateisystem-Integration. Beide teilen dasselbe Format auf der Platte — ' +
    'die Desktop-App auf einem Arbeitsbereich zu öffnen, den die Erweiterung besitzt, ist ein Lesen, ' +
    'keine Migration.',
  'workbench.docs.body.roadmap.mcpHeading': 'MCP-Server — Steuerung durch KI-Agenten',
  'workbench.docs.body.roadmap.mcp1Prefix': 'Open Headers stellt sich über das',
  'workbench.docs.body.roadmap.mcpStrong': 'Model Context Protocol',
  'workbench.docs.body.roadmap.mcp1Suffix':
    'bereit, sodass jeder MCP-fähige KI-Client — Claude Desktop, Claude Code, Cursor, VS Code, Cline ' +
    'und das wachsende Ökosystem dahinter — deinen Arbeitsbereich direkt steuern kann. Bitte den ' +
    'Agenten in normaler Sprache, eine Header-Regel anzulegen, eine gespeicherte Anfrage gegen Staging ' +
    'laufen zu lassen, die Umgebung zu wechseln, zwei Arbeitsbereiche zu diffen oder eine ' +
    'Postman-Sammlung zu importieren; der Agent übersetzt das in MCP-Tool-Aufrufe, und dein ' +
    'Arbeitsbereich-Editor zeigt das Ergebnis.',
  'workbench.docs.body.roadmap.mcp2Prefix': 'Der Server läuft',
  'workbench.docs.body.roadmap.mcpLocalOnlyStrong': 'standardmäßig nur lokal',
  'workbench.docs.body.roadmap.mcp2Middle':
    '(stdio-Transport, eins-zu-eins mit einem Client auf derselben Maschine gekoppelt) und',
  'workbench.docs.body.roadmap.mcpRemoteStrong': 'über HTTP/SSE für entfernte Nutzung',
  'workbench.docs.body.roadmap.mcp2Suffix':
    'beim Selbst-Hosten. Kein Anbieter-Relay; dein Agent spricht direkt mit deiner Installation. ' +
    'Tool-Aufrufe laufen mit denselben Arbeitsbereich-Berechtigungen wie du — Secrets bleiben hinter ' +
    'dem vault, sensible Operationen bleiben Opt-in.',
  'workbench.docs.body.roadmap.serverHeading': 'Lokaler / LAN-Server für geräteübergreifenden Sync',
  'workbench.docs.body.roadmap.server1':
    'Ein Server, den du auf deiner Maschine, deinem LAN oder einem getunnelten Host betreiben ' +
    'kannst. Erweiterung, Desktop-App und CLI werden alle Clients desselben Servers — dieselben ' +
    'Arbeitsbereiche, dieselben Regeln, derselbe vault, über jedes Gerät hinweg, das du nutzt. Der ' +
    'Server bleibt im lokalen Netz; es gibt keinen darübergelegten Opt-in-Cloud-Pfad.',
  'workbench.docs.body.roadmap.cliHeading': 'CLI',
  'workbench.docs.body.roadmap.cli1':
    'Headless-Scripting und CI-Integration. Regeln auflisten, Umgebungen umschalten, eine einzelne ' +
    'gespeicherte Anfrage aus der Shell ausführen, einen Arbeitsbereich gegen einen anderen diffen. Die ' +
    'CLI spricht mit demselben Server wie Erweiterung und Desktop-App — die Automatisierung bleibt ' +
    'synchron mit dem, was du in der UI siehst.',
  'workbench.docs.body.roadmap.webAppHeading': 'Selbst gehostetes VM-Deployment + Web-App',
  'workbench.docs.body.roadmap.webApp1':
    'Dieselbe UI als Web-Bundle, das du von deinem eigenen Origin ausliefern kannst. Für abgeriegelte ' +
    'Firmen-Browser, Kiosk-Geräte oder jede Umgebung, in der sich keine Erweiterung installieren lässt ' +
    '— und für alle, die ein gebrandetes Deployment von Open Headers unter eigener Domain wollen.',
  'workbench.docs.body.roadmap.importersHeading': 'Importer',
  'workbench.docs.body.roadmap.importers1':
    'Neben den cURL- / HAR- / Postman-Importern: Insomnia-Sammlungen, OpenAPI-Spezifikationen und ' +
    'vollständige HAR-Anfragenimporte (nicht nur Header) — alles heute live. Importer-Parität ist, wie ' +
    'Open Headers die Übernahme durch Leute verdient, die bereits in ein anderes Tool investiert haben ' +
    '— bring deine Sammlung in einem Schritt herüber und arbeite weiter.',
  'workbench.docs.body.roadmap.cloudCalloutTitle': 'Und ein gehostetes Cloud-Back-end?',
  'workbench.docs.body.roadmap.cloudCallout1':
    'Steht vorerst nicht auf der Karte — wenn du ein Cloud-gehostetes Back-end willst, kannst du es auf ' +
    'deiner eigenen VM selbst hosten (siehe oben). Der Fokus liegt gerade auf dem Produkt, nicht auf ' +
    'dem Betrieb und der Wartung kostenloser Cloud-Infrastruktur für Endnutzer. Beim Aufsetzen eines ' +
    'selbst gehosteten Deployments helfen wir gern, wenn es hakt; Hosting selbst anzubieten ist nur ' +
    'gerade nicht drin.',

  // ── Docs sub-anchor (i) popovers (DOC_ANCHOR_INFO) ──────────────────
  'workbench.docs.anchor.override.title': 'Hinzufügen / Überschreiben',
  'workbench.docs.anchor.override.summary':
    'Setzt den Header auf diesen Wert — hinzugefügt, wenn er fehlt; jeder vorhandene Wert wird ersetzt.',
  'workbench.docs.anchor.append.title': 'Anfügen',
  'workbench.docs.anchor.append.summary':
    'Hängt diesen Wert an den vorhandenen Wert des Headers an. Nur standardmäßig listenwertige Header ' +
    'unterstützen das Anfügen — bei anderen wird die Regel als Entwurf gespeichert.',
  'workbench.docs.anchor.remove.title': 'Entfernen',
  'workbench.docs.anchor.remove.summary':
    'Streicht den Header vollständig aus passendem Traffic; das Wertfeld bleibt ungenutzt.',
  'workbench.docs.anchor.merge.title': 'Zusammenführen',
  'workbench.docs.anchor.merge.summary':
    'Führt diesen Wert in die vorhandene Liste des Headers ein und überspringt bereits vorhandene Werte.',
  'workbench.docs.anchor.qpAdd.title': 'Hinzufügen / Überschreiben',
  'workbench.docs.anchor.qpAdd.summary':
    'Setzt den Parameter auf der URL — hinzugefügt, wenn er fehlt, ersetzt, wenn schon vorhanden.',
  'workbench.docs.anchor.qpOverride.title': 'Nur überschreiben',
  'workbench.docs.anchor.qpOverride.summary':
    'Ersetzt den Wert des Parameters nur, wenn die URL ihn bereits trägt; URLs ohne ihn fließen ' +
    'unverändert durch.',
  'workbench.docs.anchor.qpRemove.title': 'Entfernen',
  'workbench.docs.anchor.qpRemove.summary': 'Entfernt den Parameter aus passenden URLs.',
  'workbench.docs.anchor.qpRemoveAll.title': 'Alle entfernen',
  'workbench.docs.anchor.qpRemoveAll.summary':
    'Streicht den gesamten Query-String aus passenden URLs. Andere Operationen derselben Regel werden ' +
    'ignoriert, solange es vorhanden ist.',
  'workbench.docs.anchor.urlPattern.title': 'URL-Muster',
  'workbench.docs.anchor.urlPattern.summary':
    'Gleicht die Anfrage-URL gegen ein urlFilter-Muster ab — *-Wildcards, ||-Domain-Anker, ^-Trenner.',
  'workbench.docs.anchor.urlRegex.title': 'URL-Regex',
  'workbench.docs.anchor.urlRegex.summary':
    'Gleicht die Anfrage-URL gegen einen regulären Ausdruck ab; Erfassungsgruppen speisen die \\1-, ' +
    '\\2-Ersetzungen in Umleitungszielen.',
  'workbench.docs.anchor.requestDomains.title': 'Anfrage-Domains',
  'workbench.docs.anchor.requestDomains.summary':
    'Trifft Anfragen, deren Ziel-Host eine der gelisteten Domains ist, Subdomains eingeschlossen.',
  'workbench.docs.anchor.excludeDomains.title': 'Domains ausschließen',
  'workbench.docs.anchor.excludeDomains.summary': 'Trifft jede Anfrage außer denen, deren Ziel-Host gelistet ist.',
  'workbench.docs.anchor.initiatorDomains.title': 'Initiator-Domains',
  'workbench.docs.anchor.initiatorDomains.summary':
    'Trifft nach der Seite, die die Anfrage gestellt hat, statt nach der Anfrage-URL selbst. Die ' +
    'ausschl.-Variante invertiert die Liste.',
  'workbench.docs.anchor.methods.title': 'Methoden',
  'workbench.docs.anchor.methods.summary':
    'Trifft auf die HTTP-Methode (GET, POST, …). Die ausschl.-Variante invertiert die Liste.',
  'workbench.docs.anchor.conditionResourceTypes.title': 'Ressourcentypen',
  'workbench.docs.anchor.conditionResourceTypes.summary':
    'Trifft darauf, was der Browser lädt — Dokumente, Scripts, XHR/fetch, Bilder, … Die ' +
    'ausschl.-Variante invertiert die Liste.',
  'workbench.docs.anchor.domainType.title': 'Domain-Typ',
  'workbench.docs.anchor.domainType.summary':
    'Erstanbieter trifft Anfragen an dieselbe Site wie die Seite; Drittanbieter trifft ' +
    'Site-übergreifende Anfragen.',
  'workbench.docs.anchor.headers.title': 'Antwort-Header',
  'workbench.docs.anchor.headers.summary':
    'Trifft auf einen Header der erhaltenen Antwort — nach Vorhandensein oder, wenn angegeben, nach ' + 'Wert.',
  'workbench.docs.anchor.redirectRegex.title': 'Regex-Ersetzung',
  'workbench.docs.anchor.redirectRegex.summary':
    'Mit einer URL-Regex-Bedingung setzen \\1, \\2 … die erfassten Gruppen in das Umleitungsziel ein.',
  'workbench.docs.anchor.requestBodyDynamic.title': 'Dynamisch (JavaScript)',
  'workbench.docs.anchor.requestBodyDynamic.summary':
    'Führt dein JavaScript gegen jede passende Anfrage aus, um aus dem Original den ausgehenden Body zu ' + 'bauen.',
  'workbench.docs.anchor.responseDynamic.title': 'Dynamisch (JavaScript)',
  'workbench.docs.anchor.responseDynamic.summary':
    'Führt dein JavaScript für jede passende Antwort aus — transformiert die echte Antwort (Netzwerk) ' +
    'oder baut eine von Grund auf (Mock).',
  'workbench.docs.anchor.requestBodyGraphql.title': 'GraphQL-Operationsfilter',
  'workbench.docs.anchor.requestBodyGraphql.summary':
    'Bindet die Regel zusätzlich an den GraphQL-Operationsnamen aus der Anfrage-Payload.',
  'workbench.docs.anchor.responseGraphql.title': 'GraphQL-Operationsfilter',
  'workbench.docs.anchor.responseGraphql.summary':
    'Bindet die Regel zusätzlich an den GraphQL-Operationsnamen aus der Anfrage-Payload.',
} as const satisfies Catalog;
