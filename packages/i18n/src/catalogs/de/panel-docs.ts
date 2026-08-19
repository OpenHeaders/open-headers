/**
 * DevTools panel — docs navigation + the Filter Syntax docs body —
 * German. Mirrors `catalogs/en/panel-docs.ts` key for key. Filter
 * grammar tokens, chord chips, and the FilterExample device ride raw
 * under the S18 diagram boundary; quoted example terms ride raw
 * inside keyed captions („api“, „Users“); tool-window and detail tab
 * names (Network, Console, Storage, Headers, …) stay raw. Mints:
 * filter-grammar token rides raw (n., das Token — distinct from der
 * Token auth loanword); match toggles = Vergleichsschalter; the ×
 * button = die Schaltfläche; capture = die Erfassung (carried); the
 * keyed Enter renders as Eingabetaste per the de register.
 */

import type { Catalog } from '../../types';

export const panelDocs = {
  // ── Docs tool-window navigation ─────────────────────────────────────
  'panel.docs.nav.group.panel': 'Panel',
  'panel.docs.nav.filterSyntax.title': 'Filtersyntax',
  'panel.docs.nav.filterSyntax.summary':
    'Text-Tokens, Eigenschaftsfilter und die Vergleichsschalter — jede Karte filtert dieselbe geteilte ' +
    'Beispiel-Erfassung.',

  // ── Docs tool window: Filter Syntax section body ─────────────────────
  'panel.docs.filterSyntax.intro1Prefix': 'Der Traffic-Filter kombiniert freien Text,',
  'panel.docs.filterSyntax.intro1Suffix':
    'Eigenschaftsfilter und drei Vergleichsschalter. Durch Leerzeichen getrennte Begriffe müssen ALLE passen ' +
    '(AND), und jede Karte unten wendet ihren Filter auf dieselbe Beispiel-Erfassung mit fünf Anfragen an — ' +
    'jedes Diagramm ist ein Ausschnitt dieses Bilds.',
  'panel.docs.filterSyntax.intro2Prefix':
    'Jedes Filterfeld im Panel — Network, Console, Storage, Headers, Cookies, Initiator, Messages — trägt ' +
    'dieselben drei Schalter',
  'panel.docs.filterSyntax.intro2MatchCase': 'Groß-/Kleinschreibung beachten',
  'panel.docs.filterSyntax.intro2WholeWord': 'ganzes Wort',
  'panel.docs.filterSyntax.intro2Regex': 'Regex',
  'panel.docs.filterSyntax.intro2Middle': 'und eine',
  'panel.docs.filterSyntax.intro2Suffix': 'Schaltfläche, die den Text löscht.',
  'panel.docs.filterSyntax.intro2Kbd': 'Tastatur:',
  'panel.docs.filterSyntax.intro2KbdSuffix': 'schalten die Schalter um, während das Feld den Fokus hat.',

  'panel.docs.filterSyntax.headingText': 'Textfilter',
  'panel.docs.filterExample.captureHeading': 'Die Beispiel-Erfassung',
  'panel.docs.filterSyntax.headingProperty': 'Eigenschaftsfilter',
  'panel.docs.filterSyntax.headingToggles': 'Vergleichsschalter',
  'panel.docs.filterSyntax.headingElsewhere': 'Überall sonst',

  'panel.docs.filterSyntax.textTitle': 'Text',
  'panel.docs.filterSyntax.text1':
    'Ein bloßer Begriff behält jede Anfrage, deren URL ihn enthält. Mehrere Begriffe verbinden sich per AND — ' +
    'eine Anfrage muss alle enthalten, an beliebiger Position.',
  'panel.docs.filterSyntax.textCaption':
    'Zwei Begriffe — nur die Anfrage überlebt, deren URL sowohl „api“ als auch „users“ enthält.',

  'panel.docs.filterSyntax.negationTitle': 'Negation',
  'panel.docs.filterSyntax.negation1Prefix': 'Ein führendes',
  'panel.docs.filterSyntax.negation1Middle': 'kehrt jedes Token um:',
  'panel.docs.filterSyntax.negation1Middle2':
    'verbirgt passende Anfragen, statt sie zu behalten. Funktioniert auch bei Eigenschaftsfiltern —',
  'panel.docs.filterSyntax.negationCaption': 'Alles bleibt, AUSSER Anfragen, die auf den negierten Begriff passen.',

  'panel.docs.filterSyntax.phraseTitle': 'Exakte Phrase',
  'panel.docs.filterSyntax.phrase1Prefix':
    'Anführungszeichen machen aus Text mit Leerzeichen ein einziges Token und halten Zeichen wie',
  'panel.docs.filterSyntax.phrase1Or': 'oder',
  'panel.docs.filterSyntax.phrase1Suffix': 'wörtlich — nützlich für Query-Strings.',
  'panel.docs.filterSyntax.phraseCaption': 'Die zitierte Phrase passt als ein zusammenhängendes Stück der URL.',

  'panel.docs.filterSyntax.propertyIntroPrefix': 'A',
  'panel.docs.filterSyntax.propertyIntroSuffix':
    '— ein solches Token prüft ein Attribut der Anfrage statt der ganzen URL. Eigenschaftsfilter kombinieren ' +
    'sich mit Text-Tokens und untereinander — alle müssen passen.',

  'panel.docs.filterSyntax.domainTitle': 'Domain',
  'panel.docs.filterSyntax.domain1Prefix':
    'Vergleicht den Hostnamen per Teilstring, sodass eine Apex-Domain jede Subdomain einfängt —',
  'panel.docs.filterSyntax.domain1Suffix': '— ganz ohne Wildcards.',
  'panel.docs.filterSyntax.domainCaption':
    'Ein Wert deckt jede Subdomain von openheaders.com ab; der Drittanbieter-Host geht leer aus.',

  'panel.docs.filterSyntax.statusCodeTitle': 'Statuscode',
  'panel.docs.filterSyntax.statusCode1':
    'Behält Anfragen, deren Antwort genau diesen Code trug. Ausstehende und fehlgeschlagene Anfragen haben ' +
    'keinen Code und passen daher nie.',
  'panel.docs.filterSyntax.statusCodeCaption': 'Nur die 404 überlebt — der exakte Code, kein Bereich.',

  'panel.docs.filterSyntax.methodTitle': 'Methode',
  'panel.docs.filterSyntax.method1Prefix':
    'Behält Anfragen mit diesem HTTP-Verb, verglichen ohne Beachtung der Groß-/Kleinschreibung —',
  'panel.docs.filterSyntax.method1And': 'und',
  'panel.docs.filterSyntax.method1Suffix': 'sind derselbe Filter.',
  'panel.docs.filterSyntax.methodCaption': 'Nur der POST überlebt.',

  'panel.docs.filterSyntax.mimeTypeTitle': 'MIME-Typ',
  'panel.docs.filterSyntax.mime1Prefix': 'Vergleicht den Content-Type der Antwort per Teilstring —',
  'panel.docs.filterSyntax.mime1Catches': 'fängt',
  'panel.docs.filterSyntax.mime1Suffix': 'fängt jedes Bildformat.',
  'panel.docs.filterSyntax.mimeCaption':
    'Beide JSON-Antworten überleben; Skripte, Schriften und Bilder gehen leer aus.',

  'panel.docs.filterSyntax.responseHeaderTitle': 'Antwort-Header',
  'panel.docs.filterSyntax.respHeader1Prefix':
    'Behält Anfragen, deren Antwort einen Header mit genau diesem Namen trägt — der Wert spielt keine Rolle. ' +
    'Praktisch, um CDN-Cache-Verhalten zu erkennen',
  'panel.docs.filterSyntax.respHeader1Suffix': 'oder fehlende Sicherheits-Header zu finden (negiere ihn).',
  'panel.docs.filterSyntax.respHeaderCaption': 'Nur die CDN-Antwort trägt einen x-cache-Header.',

  'panel.docs.filterSyntax.largerThanTitle': 'Größer als',
  'panel.docs.filterSyntax.largerThan1':
    'Behält Anfragen, die mehr als N Bytes übertragen haben. Suffixe skalieren die Zahl:',
  'panel.docs.filterSyntax.largerThanCaption': 'Nur das Bundle mit 128 kB überspringt die Schwelle von 100k.',

  'panel.docs.filterSyntax.fromCacheTitle': 'Aus dem Cache',
  'panel.docs.filterSyntax.fromCache1Prefix': 'Behält Antworten, die der Browser aus dem Cache bedient hat — ein',
  'panel.docs.filterSyntax.fromCache1Middle':
    ', oder ein Disk-/Memory-Cache-Treffer, der das Netzwerk nie berührt hat. Negiere ihn',
  'panel.docs.filterSyntax.fromCache1Suffix': 'um nur das zu sehen, was wirklich über die Leitung ging.',
  'panel.docs.filterSyntax.fromCacheCaption': 'Nur das gecachte Tracking-Pixel überlebt.',

  'panel.docs.filterSyntax.togglesIntroPrefix':
    'Die drei Schaltflächen im Feld ändern, wie Text-Tokens verglichen werden. Sie gelten für freien Text ' +
    '(und für Tokens im Stil von',
  'panel.docs.filterSyntax.togglesIntroMiddle': 'auf den Detail-Tabs);',
  'panel.docs.filterSyntax.togglesIntroSuffix': 'und die übrigen Eigenschaftsfilter behalten ihre eigene Semantik.',

  'panel.docs.filterSyntax.matchCaseTitle': 'Groß-/Kleinschreibung beachten',
  'panel.docs.filterSyntax.matchCase1Prefix': 'Ausgeschaltet (der Standard) sind',
  'panel.docs.filterSyntax.matchCase1And': 'und',
  'panel.docs.filterSyntax.matchCase1Suffix':
    'derselbe Filter. Eingeschaltet muss der Begriff exakt der Schreibung der URL entsprechen.',
  'panel.docs.filterSyntax.matchCaseCaption':
    'Mit Aa eingeschaltet passt „Users“ auf nichts — jede URL der Erfassung ist kleingeschrieben.',

  'panel.docs.filterSyntax.wholeWordTitle': 'Ganzes Wort',
  'panel.docs.filterSyntax.wholeWord1Prefix': 'Der Begriff passt nur an Wortgrenzen —',
  'panel.docs.filterSyntax.wholeWord1Suffix':
    'und Co. zählen als Grenzen. Nutze es, wenn ein kurzer Begriff in längeren Wörtern vergraben ist.',
  'panel.docs.filterSyntax.wholeWordCaption':
    '„user“ passt nicht mehr innerhalb von „users“ — mit ab ausgeschaltet würde Anfrage #7 passen.',

  'panel.docs.filterSyntax.regexTitle': 'Regex',
  'panel.docs.filterSyntax.regex1':
    'Die gesamte Eingabe wird zu einem einzigen regulären Ausdruck, der gegen die URL getestet wird — ' +
    'Eigenschafts-Tokens werden in diesem Modus nicht geparst. Ein Muster, das nicht kompiliert, färbt das ' +
    'Feld rot und verbirgt nichts.',
  'panel.docs.filterSyntax.regexCaption': 'Ein Muster, zwei Dateitypen: URLs, die auf .js oder .woff2 enden.',

  'panel.docs.filterSyntax.otherInputsTitle': 'Weitere Filterfelder',
  'panel.docs.filterSyntax.otherIntroPrefix':
    'Die Detail-Tabs tragen dasselbe Feld mit eigenen Eigenschaftsschlüsseln; die Schalter und die Negation mit',
  'panel.docs.filterSyntax.otherIntroSuffix': 'funktionieren in jedem gleich:',
  'panel.docs.filterSyntax.otherPlainGroup': 'Console, Storage, Messages, Call Stack',
  'panel.docs.filterSyntax.otherPlainBody':
    'einfacher Text mit den drei Schaltern; Storage zählt außerdem beim Tippen die Treffer pro Abschnitt auf ' +
    'seiner Navigationsleiste.',
  'panel.docs.filterSyntax.otherSearchPrefix': 'einfacher Text (oder eine Regex unter',
  'panel.docs.filterSyntax.otherSearchMiddle': ') mit den drei Schaltern, abgeschickt mit der Eingabetaste. Die Chips',
  'panel.docs.filterSyntax.otherSearchSuffix':
    'wählen aus, welche Daten durchsucht werden — mindestens einer bleibt ausgewählt — und jedes Ergebnis ' +
    'öffnet seine Quelle: den Anfrage-Tab, den Speicherabschnitt oder die Console.',
} as const satisfies Catalog;
