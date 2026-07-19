/**
 * Workbench Docs panel — the Debug Mode section body — German. Mirrors
 * `catalogs/en/workbench-docs-debug-mode.ts` key for key. UI labels the
 * prose references copy the shipped `de/shared-chrome.ts` strings
 * verbatim (`Anhängen an`, `Wo DevTools geöffnet ist`, `Der fokussierte
 * Tab`, `Beide`, `Diesen Browser-Tab einbeziehen`, `Angehängte Tabs`,
 * `Tab außerhalb der Reichweite`, `Systemstatus`, Debug-Modus); the
 * browser banner quote rides verbatim raw inside „…“. Reichweite =
 * debug reach (S19 two-word law); Überschreibungen = the Overrides
 * surface (panel mint). MINT: `Debug-Modus aus` = the rules-list
 * badge (future editors-rule de must reuse). Raw by design: the
 * `● Debug mode` pill chip and `fetch` / `XHR` code chips composed
 * by the section body, `CSP`, worker/cross-origin vocabulary per the
 * panel parity laws.
 */

import type { Catalog } from '../../types';

export const workbenchDocsDebugMode = {
  // ── Concepts: Debug mode ────────────────────────────────────────────
  'workbench.docs.body.debugMode.term': 'Der Debug-Modus',
  'workbench.docs.body.debugMode.intro1':
    'hängt Open Headers an das Debugging-Protokoll des Browsers an, um Datenverkehr zu inspizieren und zu ' +
    'verändern, den gewöhnliche Erweiterungs-APIs nicht erreichen. Es ist dieselbe Maschinerie, die die ' +
    'Entwicklertools des Browsers selbst verwenden — deshalb zeigt der Browser, solange er eingeschaltet ' +
    'ist, das Banner',
  'workbench.docs.body.debugMode.introBanner': '„OH started debugging this browser“',
  'workbench.docs.body.debugMode.intro1Suffix': 'an.',
  'workbench.docs.body.debugMode.intro2':
    'Der Standardmodus (Debug-Modus aus) deckt die meisten Regeln bereits ab — Header, Blockieren, Umleiten, ' +
    'Query-Parameter und die Body- / Antwort- / Injektionsregeln im Seitenkontext. Der Debug-Modus ist die ' +
    'ausdrücklich zuschaltbare Erweiterung für das, was diese nicht erreichen: Navigationen, Worker, ' +
    'Cross-Origin-Frames und Umgebungsänderungen für den ganzen Tab.',
  'workbench.docs.body.debugMode.controlHeading': 'Wo du ihn steuerst',
  'workbench.docs.body.debugMode.control1Prefix': 'Die Anzeige',
  'workbench.docs.body.debugMode.control1Middle': 'sitzt in der Fußzeile jeder Oberfläche, direkt links von',
  'workbench.docs.body.debugMode.systemStatusLink': 'Systemstatus',
  'workbench.docs.body.debugMode.control1Suffix':
    '. Der eingebaute Schalter schaltet ihn ein und aus, der farbige Punkt verfolgt seinen Zustand, und ' +
    'Punkt + Beschriftung öffnen ein Popover mit allem Übrigen — Reichweite, angeheftete Tabs und die Liste ' +
    'der gerade angehängten Tabs.',
  'workbench.docs.body.debugMode.surfaceCaption':
    'Der eingebaute Schalter schaltet ihn ein; Punkt + Beschriftung öffnen das Popover für alles Übrige.',
  'workbench.docs.body.debugMode.scopeHeading': 'Wählen, was inspiziert wird',
  'workbench.docs.body.debugMode.scope1Prefix': 'Das Dropdown',
  'workbench.docs.body.debugMode.attachTo': 'Anhängen an',
  'workbench.docs.body.debugMode.scope1Middle': 'entscheidet, an welche Tabs sich der Debug-Modus anhängt —',
  'workbench.docs.body.debugMode.scopeDevtools': 'Wo DevTools geöffnet ist',
  'workbench.docs.body.debugMode.scope1DevtoolsParen':
    '(nur Tabs mit geöffnetem Panel Open Headers; der engste Standard),',
  'workbench.docs.body.debugMode.scopeFocused': 'Der fokussierte Tab',
  'workbench.docs.body.debugMode.scope1FocusedParen': '(folgt dem aktiven Tab, während du wechselst) oder',
  'workbench.docs.body.debugMode.scopeBoth': 'Beide',
  'workbench.docs.body.debugMode.scope1BothParen': '(die Vereinigung der beiden).',
  'workbench.docs.body.debugMode.consent1Prefix': 'Die Wahl einer Reichweite',
  'workbench.docs.body.debugMode.consentIs': 'ist',
  'workbench.docs.body.debugMode.consent1Middle':
    'die Zustimmung zum Browser-Banner — es gibt keine separate Abfrage. Wenn der aktuelle Tab noch nicht ' +
    'von der Reichweite abgedeckt ist, erscheint die Option',
  'workbench.docs.body.debugMode.includeTabPin': 'Diesen Browser-Tab einbeziehen',
  'workbench.docs.body.debugMode.consent1Suffix':
    '— so hängst du genau diesen einen Tab an, ohne die Reichweite für alles andere auszuweiten.',
  'workbench.docs.body.debugMode.attached1Prefix': 'Die Liste',
  'workbench.docs.body.debugMode.attachedTabs': 'Angehängte Tabs',
  'workbench.docs.body.debugMode.attached1Suffix':
    'zeigt jeden Tab, den der Debug-Modus gerade steuert, jeweils mit einer Aktion zum Springen in den Tab. ' +
    'Die angehängte Menge wird immer neu aus deiner Reichweite, deinen angehefteten Tabs und den offenen ' +
    'Panels berechnet — sie spiegelt die Gegenwart, nie einen veralteten Schnappschuss.',
  'workbench.docs.body.debugMode.scopeCaption':
    'Die angehängte Menge wird jedes Mal abgeleitet — erneutes Anhängen spielt sie nach, nichts wird gespeichert.',
  'workbench.docs.body.debugMode.bannerCalloutTitle': 'Das Banner gilt für den ganzen Browser',
  'workbench.docs.body.debugMode.banner1Prefix':
    'Solange der Debug-Modus eingeschaltet ist, zeigt der Browser das Banner „OH started debugging this ' +
    'browser“ auf',
  'workbench.docs.body.debugMode.bannerEvery': 'jedem',
  'workbench.docs.body.debugMode.banner1Suffix':
    'Tab — nicht nur auf denen, an die er angehängt ist. Das ist das Verhalten des Browsers selbst; das ' +
    'Ausschalten des Debug-Modus entfernt es sofort.',
  'workbench.docs.body.debugMode.unlocksHeading': 'Was er freischaltet',
  'workbench.docs.body.debugMode.unlocksIntro':
    'Auf einem angehängten Tab reichen Regeln und Steuerungen über den Seitenkontext hinaus:',
  'workbench.docs.body.debugMode.anyRequestLead': 'Jede Anfrage, jeder Kontext.',
  'workbench.docs.body.debugMode.anyRequest1':
    'Simuliere oder schreibe Top-Level-Navigationen, Worker-Anfragen und Cross-Origin-iframes um — nicht nur ' + 'die',
  'workbench.docs.body.debugMode.anyRequest2':
    ' der Seite. Anfrage- und Antwort-Bodys lassen sich in denselben Kontexten lesen und transformieren, und ' +
    'HTTP-Authentifizierungsabfragen werden für Dev-Proxys und Staging automatisch beantwortet.',
  'workbench.docs.body.debugMode.injectionLead': 'Stärkere Injektion.',
  'workbench.docs.body.debugMode.injection1':
    'Die Skript-Injektion wird frei von Wettläufen und CSP-fest und reicht in Worker und Cross-Origin-Frames ' +
    'hinein, die der Standardweg über den Seitenkontext nicht berühren kann.',
  'workbench.docs.body.debugMode.tabEnvLead': 'Tab-Umgebung.',
  'workbench.docs.body.debugMode.tabEnv1':
    'Exaktes Deaktivieren des Caches, Drosselung / Offline im Netzwerk und Überschreibungen von User-Agent / ' +
    'Locale / Zeitzone / Medien — pro Tab gesetzt über die Panel-Werkzeugleiste und die Oberfläche',
  'workbench.docs.body.debugMode.overrides': 'Überschreibungen',
  'workbench.docs.body.debugMode.tabEnv2': '.',
  'workbench.docs.body.debugMode.reachCaption':
    'Der Standardmodus deckt fetch / XHR der Seite ab; ein angehängter Tab erweitert dieselben Regeln auf ' +
    'alles andere.',
  'workbench.docs.body.debugMode.silentHeading': 'Regeln scheitern nie stumm',
  'workbench.docs.body.debugMode.silent1Prefix':
    'Eine Regel, die für ihre volle Wirkung den Debug-Modus braucht, zeigt ein Badge',
  'workbench.docs.body.debugMode.badgeOff': 'Debug-Modus aus',
  'workbench.docs.body.debugMode.silent1Middle': 'in der Regelliste, solange er aus ist, und einen Hinweis',
  'workbench.docs.body.debugMode.badgeOutOfScope': 'Tab außerhalb der Reichweite',
  'workbench.docs.body.debugMode.silent1Middle2':
    'im Panel, wenn er an ist, der Tab aber nicht in der Reichweite liegt. Die Regel führt weiterhin alles aus, was sie',
  'workbench.docs.body.debugMode.silentCan': 'kann',
  'workbench.docs.body.debugMode.silent1Suffix':
    '— über den Standardweg im Seitenkontext; das Scharfschalten des Debug-Modus erweitert dieselbe Regel nur ' +
    'auf die Kontexte, die die Seiten-Injektion nicht erreicht.',
  'workbench.docs.body.debugMode.colorsHeading': 'Statusfarben',
  'workbench.docs.body.debugMode.colors1Prefix': 'Der Punkt spiegelt die Zeile',
  'workbench.docs.body.debugMode.colors1Suffix': ':',
  'workbench.docs.body.debugMode.statesCaption':
    'Grau im ausgeschalteten Zustand; grün / gelb / rot, sobald er an ist.',
  'workbench.docs.body.debugMode.stateGreenLabel': 'grün',
  'workbench.docs.body.debugMode.stateOn': 'An',
  'workbench.docs.body.debugMode.stateOnRest': 'und sauber angehängt. (Ist er aus, ist der Punkt einfach grau.)',
  'workbench.docs.body.debugMode.stateYellowLabel': 'gelb',
  'workbench.docs.body.debugMode.stateYellowPrefix': 'Ein Tab',
  'workbench.docs.body.debugMode.stateYellowTerm': 'ist auf die Heuristik zurückgefallen',
  'workbench.docs.body.debugMode.stateYellowSuffix':
    '— meist weil das Debug-Banner des Browsers geschlossen wurde; dieser Tab kehrt zur ' +
    'Standardbeobachtung zurück.',
  'workbench.docs.body.debugMode.stateRedLabel': 'rot',
  'workbench.docs.body.debugMode.stateRedPrefix': 'Ein Tab',
  'workbench.docs.body.debugMode.stateRedTerm': 'konnte nicht angehängt werden',
  'workbench.docs.body.debugMode.stateRedSuffix': '— das Debugging-Protokoll ließ sich für ihn nicht starten.',
  'workbench.docs.body.debugMode.chromiumTitle': 'Nur Chromium',
  'workbench.docs.body.debugMode.chromium1':
    'Der Debug-Modus stützt sich auf ein Debugging-Protokoll, das nur Chromium-basierte Browser für ' +
    'Erweiterungen freigeben. In Firefox und Safari bleibt die Anzeige verborgen; die Standardmodus-Regeln ' +
    'oben funktionieren überall.',
} as const satisfies Catalog;
