/**
 * DevTools panel — console tool window — German. Mirrors
 * `catalogs/en/panel-console.ts` key for key. Raw by design: level
 * wire names (debug/log/…), the › ‹ chevrons and ⚙ prefix, context
 * labels (top / frame names / script URLs), source locations,
 * "(anonymous)", the browser's synthesized network phrasing quoted
 * verbatim („finished loading“, „Access to fetch at …“), key names
 * (Tab / arrows — the keyed Enter renders as Eingabetaste per the de
 * register), and the example-transcript rows in the (i) corpora.
 * Mints: prompt rides raw (m., JS vocabulary); log = das Protokoll
 * (carried); scope rides the debug-reach Reichweite (S19 law);
 * transcript = das Transkript; eager evaluation = vorauseilende
 * Auswertung.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelConsole = {
  // ── Console tool window (station: console family) ───────────────────
  'panel.console.clear': 'Konsole leeren',
  'panel.console.collapseAll': 'Alle zuklappen',
  'panel.console.expandAll': 'Alle aufklappen',
  'panel.console.filterAria': 'Konsolennachrichten filtern',
  'panel.console.levelTitle': 'Protokollstufe: {label}',
  'panel.console.settings': 'Einstellungen der Konsole',
  'panel.console.settingsPaneAria': 'Einstellungen der Konsole',
  'panel.console.contextTitle': 'JavaScript-Kontext — wo Konsolenbefehle ausgewertet werden',

  // Level-filter menu (the browser's "Default levels ▾" ladder)
  'panel.console.levels.verbose': 'Ausführlich',
  'panel.console.levels.info': 'Info',
  'panel.console.levels.warnings': 'Warnungen',
  'panel.console.levels.errors': 'Fehler',
  'panel.console.levels.all': 'Alle Stufen',
  'panel.console.levels.defaultLevels': 'Standardstufen',
  'panel.console.levels.hideAll': 'Alle ausblenden',
  'panel.console.levels.only': 'Nur {level}',
  'panel.console.levels.custom': 'Eigene Stufen',
  'panel.console.levels.default': 'Standard',

  // Settings pane (labels + hover titles, browser pane order)
  'panel.console.setting.hideNetwork': 'Netzwerk ausblenden',
  'panel.console.setting.hideNetworkTitle':
    'Die Netzwerk-Protokolleinträge des Browsers ausblenden (fehlgeschlagene und blockierte Anfragen)',
  'panel.console.setting.logXhr': 'XMLHttpRequests protokollieren',
  'panel.console.setting.logXhrTitle':
    'Eine Nachricht protokollieren, wenn eine XHR-, fetch- oder EventSource-Anfrage endet oder fehlschlägt',
  'panel.console.setting.preserveLog': 'Protokoll beibehalten',
  'panel.console.setting.preserveLogTitle': 'Das Protokoll beim Navigieren nicht leeren',
  'panel.console.setting.eagerEval': 'Vorauseilende Auswertung',
  'panel.console.setting.eagerEvalTitle': 'Text im Prompt vorauseilend auswerten (Vorschau ohne Seiteneffekte)',
  'panel.console.setting.selectedContextOnly': 'Nur der ausgewählte Kontext',
  'panel.console.setting.selectedContextOnlyTitle': 'Nur Nachrichten aus dem ausgewählten Kontext zeigen',
  'panel.console.setting.autocompleteHistory': 'Aus dem Verlauf vervollständigen',
  'panel.console.setting.autocompleteHistoryTitle':
    'Bereits ausgeführte Befehle vorschlagen, während du im Prompt tippst',
  'panel.console.setting.groupSimilar': 'Ähnliche Nachrichten in der Konsole gruppieren',
  'panel.console.setting.groupSimilarTitle':
    'Wiederholte identische Nachrichten zu einer Zeile mit Zähler zusammenfassen',
  'panel.console.setting.evalUserGesture': 'Code-Auswertung als Benutzeraktion behandeln',
  'panel.console.setting.evalUserGestureTitle':
    'Mit einer Benutzergeste auswerten, damit APIs, die an eine Benutzeraktivierung gebunden sind, aus dem ' +
    'Prompt funktionieren',
  'panel.console.setting.showCorsErrors': 'CORS-Fehler in der Konsole zeigen',
  'panel.console.setting.showCorsErrorsTitle': 'CORS-Richtlinienfehler neben der eigenen Ausgabe der Seite zeigen',

  // Per-setting (i) info corpora (titles reuse the setting label keys;
  // groupSimilar's popover title differs from its checkbox label)
  'panel.console.info.exampleCaption': 'Beispiel-Konsole',
  'panel.console.info.hideNetwork.summary':
    'Blendet die eigenen Netzwerk-Protokolleinträge des Browsers aus — fehlgeschlagene und blockierte ' +
    'Anfragen — während die Konsolenausgabe der Seite immer bleibt.',
  'panel.console.info.hideNetwork.description':
    'Blendet auch die von „XMLHttpRequests protokollieren“ synthetisierten „finished loading“-Zeilen aus — ' +
    'auch sie sind Nachrichten aus der Netzwerkquelle.',
  'panel.console.info.logXhr.summary':
    'Protokolliert eine Zeile, sobald eine XHR-, fetch- oder EventSource-Anfrage endet oder fehlschlägt.',
  'panel.console.info.logXhr.description':
    'Die Zeilen landen auf der Stufe Info — auch Fehlschläge — und die URL verlinkt auf die Zeile der Anfrage ' +
    'im Network-Panel. Netzwerk ausblenden verbirgt auch diese Zeilen.',
  'panel.console.info.preserveLog.summary': 'Behält das Protokoll über Seitennavigationen hinweg, statt es zu leeren.',
  'panel.console.info.preserveLog.description':
    'Ausgeschaltet beschneidet eine Navigation — das Neuerzeugen des top-Kontexts der Seite — die Ansicht auf ' +
    'die Einträge, die danach eintreffen.',
  'panel.console.info.eagerEval.summary':
    'Zeigt eine Vorschau des Ergebnisses des Ausdrucks, den du gerade tippst, auf der grauen Zeile unter dem ' +
    'Prompt.',
  'panel.console.info.eagerEval.description':
    'Die Vorschau wertet ohne Seiteneffekte aus: Ein Ausdruck, der den Seitenzustand ändern würde, zeigt ' +
    'nichts, statt zu laufen, und ins Protokoll wird nichts geschrieben, bis du die Eingabetaste drückst.',
  'panel.console.info.selectedContextOnly.summary':
    'Zeigt nur Nachrichten aus dem JavaScript-Kontext, der im Kontext-Selektor der Werkzeugleiste gewählt ist.',
  'panel.console.info.selectedContextOnly.description':
    'Einträge ohne Kontext — die eigenen Protokolleinträge des Browsers — bleiben immer sichtbar.',
  'panel.console.info.autocompleteHistory.summary':
    'Schlägt den jüngsten Befehl vor, der das Getippte fortsetzt, als abgedunkelte Vervollständigung im Prompt.',
  'panel.console.info.autocompleteHistory.description':
    'Tab — oder → am Ende der Eingabe — übernimmt ihn; ↑/↓ durchlaufen weiterhin den Verlauf. Der Verlauf lebt ' +
    'für die aktuelle Panel-Sitzung.',
  'panel.console.info.groupSimilar.title': 'Ähnliche Nachrichten gruppieren',
  'panel.console.info.groupSimilar.summary':
    'Fasst aufeinanderfolgende identische Nachrichten zu einer Zeile mit Zähler-Badge zusammen.',
  'panel.console.info.groupSimilar.description':
    'Getippte Befehle und ihre Ergebnisse gruppieren nie — das Transkript bleibt wörtlich.',
  'panel.console.info.evalUserGesture.summary': 'Führt Prompt-Befehle aus, als hätte eine Benutzergeste sie ausgelöst.',
  'panel.console.info.evalUserGesture.description':
    'APIs, die an eine Benutzeraktivierung gebunden sind — ein Fenster öffnen, in die Zwischenablage ' +
    'schreiben, Vollbild — gelingen aus dem Prompt, wenn das eingeschaltet ist.',
  'panel.console.info.showCorsErrors.summary':
    'Zeigt die CORS-Erklärungen des Browsers — „Access to fetch at … has been blocked by CORS policy: …“ — ' +
    'neben der Ausgabe der Seite.',
  'panel.console.info.showCorsErrors.description':
    'Ausgeschaltet verbirgt nur diese Erklärungsnachrichten; die blockierte Anfrage selbst erscheint weiterhin ' +
    'im Network-Panel.',

  // Capture-stopped banner + never-silent empty surfaces
  'panel.console.banner.leftScope':
    'Erfassung gestoppt — dieser Tab hat die Reichweite des Debug-Modus verlassen. Die zuletzt erfasste ' +
    'Ausgabe wird gezeigt.',
  'panel.console.banner.debugOff':
    'Erfassung gestoppt — der Debug-Modus ist aus. Die zuletzt erfasste Ausgabe wird gezeigt.',
  'panel.console.enableDebug': 'Debug-Modus aktivieren',
  'panel.console.empty.noCdp.title': 'Die Konsolen-Erfassung braucht den Debug-Modus',
  'panel.console.empty.noCdp.sub': 'Die Inspektion im Debug-Modus ist in diesem Browser nicht verfügbar.',
  'panel.console.empty.capturing.title': 'Noch keine Konsolenausgabe',
  'panel.console.empty.capturing.sub':
    'Die Protokollnachrichten und nicht abgefangenen Ausnahmen dieses Tabs erscheinen hier, sobald sie ' + 'auftreten.',
  'panel.console.empty.debugOff.title': 'Aktiviere den Debug-Modus, um Konsolenprotokolle zu sehen',
  'panel.console.empty.debugOff.sub':
    'Open Headers erfasst die Konsolenausgabe und nicht abgefangenen Ausnahmen dieses Tabs, solange der ' +
    'Debug-Modus eingeschaltet ist.',
  'panel.console.empty.outOfScope.title': 'Dieser Tab liegt außerhalb der Reichweite des Debug-Modus',
  'panel.console.empty.outOfScope.sub':
    'Hole ihn über den Debug-Modus in die Reichweite — ändere die Reichweite oder hefte diesen Tab an — um ' +
    'seine Konsolenausgabe zu erfassen.',
  'panel.console.noMatch': 'Kein Konsoleneintrag passt zu deinem Filter.',
  'panel.console.revealedHidden': 'Die aufgedeckte Nachricht ist durch den aktiven Filter verborgen',

  // Log rows
  'panel.console.repeatTitle': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} identische Nachricht', other: '{count} identische Nachrichten' }),
  'panel.console.expandStack': 'Aufrufstapel aufklappen',
  'panel.console.collapseStack': 'Aufrufstapel zuklappen',

  // REPL prompt
  'panel.console.prompt.waiting': 'Warten auf einen JavaScript-Kontext…',
  'panel.console.prompt.placeholder': 'JavaScript im ausgewählten Kontext ausführen',
  'panel.console.prompt.aria': 'Konsolen-Prompt',
  'panel.console.prompt.previewAria': 'Vorschau der vorauseilenden Auswertung',
} as const satisfies Catalog;
