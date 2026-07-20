/**
 * Workbench Docs panel — SVG diagram labels — German. Mirrors
 * `catalogs/en/workbench-docs-diagrams.ts` key for key. Vocabulary is
 * quoted from the shipped de catalogs: Geltungsbereich = variable
 * scope, einfache Referenz = bare reference, verschattet = shadowed,
 * die Leiter = the ladder, der Durchlauf = the walk (all from
 * `de/workbench-docs-variables.ts`); sidebar entry names copy
 * `de/workbench-chrome-sidebar.ts` verbatim (Vault,
 * Arbeitsbereich-Variablen, Live-Variablen); freigeben = expose and
 * Senden = Send reuse the shipped editor mints. Monospace wire
 * fragments and `{{ns.*}}` tokens are whole-raw values copied
 * verbatim. Sample identifiers (staging, production, api_host) ride
 * raw.
 */

import type { Catalog } from '../../types';

export const workbenchDocsDiagrams = {
  // ── Variablen: die Auflösungsleiter ─────────────────────────────────
  'workbench.docs.diagrams.variables.ladder.aria':
    'Eine einfache Variablenreferenz löst sich durch vault, Umgebung, Sammlung und dann den Arbeitsbereich auf — ' +
    'der erste Treffer gewinnt. Live, step, file und dynamic sind nur über ihren Namensraum-Präfix erreichbar.',
  'workbench.docs.diagrams.variables.ladder.title':
    'Einfache Referenz — der erste Geltungsbereich, der sie definiert, gewinnt',
  'workbench.docs.diagrams.variables.ladder.vault': 'Vault',
  'workbench.docs.diagrams.variables.ladder.vaultSub': 'Secrets · nur dieses Gerät',
  'workbench.docs.diagrams.variables.ladder.environment': 'Umgebung',
  'workbench.docs.diagrams.variables.ladder.environmentSub': 'aktive, dann Standard',
  'workbench.docs.diagrams.variables.ladder.collection': 'Sammlung',
  'workbench.docs.diagrams.variables.ladder.collectionSub': 'nur die aktive Sammlung',
  'workbench.docs.diagrams.variables.ladder.workspace': 'Arbeitsbereich',
  'workbench.docs.diagrams.variables.ladder.workspaceSub': 'mit allen geteilt',
  'workbench.docs.diagrams.variables.ladder.miss': 'kein Treffer',
  'workbench.docs.diagrams.variables.ladder.railHeading': 'NUR NAMENSRAUM',
  'workbench.docs.diagrams.variables.ladder.railFoot1': 'nur per Präfix erreichbar —',
  'workbench.docs.diagrams.variables.ladder.railFoot2': 'nie Teil des einfachen Durchlaufs',
  'workbench.docs.diagrams.variables.ladder.pinExamples': '{{vault.token}} · {{env.token}} · {{collection.token}}',
  'workbench.docs.diagrams.variables.ladder.pinNote': '{{workspace.token}} — der Präfix bindet einen Geltungsbereich.',

  // ── Variablen: Erstellungskarte ─────────────────────────────────────
  'workbench.docs.diagrams.variables.creation.aria':
    'Seitenleisten-Karte — Sammlungs-Variablen leben auf der Sammlung, Umgebungen unter Umgebungen, und Vault, ' +
    'Arbeitsbereich-Variablen und Live-Variablen sind Einträge auf oberster Ebene',
  'workbench.docs.diagrams.variables.creation.title': 'Wo jeder Geltungsbereich entsteht',
  'workbench.docs.diagrams.variables.creation.workspaceName': 'PAYMENTS-TEAM',
  'workbench.docs.diagrams.variables.creation.collections': '▾ Sammlungen',
  'workbench.docs.diagrams.variables.creation.collectionName': '▾ Payments-API',
  'workbench.docs.diagrams.variables.creation.variables': 'Variablen',
  'workbench.docs.diagrams.variables.creation.environments': '▾ Umgebungen',
  'workbench.docs.diagrams.variables.creation.envStaging': 'staging  ●',
  'workbench.docs.diagrams.variables.creation.envProduction': 'production',
  'workbench.docs.diagrams.variables.creation.vault': 'Vault',
  'workbench.docs.diagrams.variables.creation.workspaceVariables': 'Arbeitsbereich-Variablen',
  'workbench.docs.diagrams.variables.creation.liveVariables': 'Live-Variablen',
  'workbench.docs.diagrams.variables.creation.footer1': 'Sammlungen tragen ihre eigene Variablen-Seite;',
  'workbench.docs.diagrams.variables.creation.footer2': 'alles andere ist ein Eintrag in der Seitenleiste.',

  // ── Variablen: Verschattung ─────────────────────────────────────────
  'workbench.docs.diagrams.variables.shadowing.aria':
    'api_host ist in Umgebung und Arbeitsbereich definiert — die einfache Referenz löst sich auf den ' +
    'Umgebungswert auf; die Namensraum-Form liest weiterhin den Arbeitsbereichswert',
  'workbench.docs.diagrams.variables.shadowing.title': 'Gleicher Name in zwei Geltungsbereichen — der höhere gewinnt',
  'workbench.docs.diagrams.variables.shadowing.wins': '✓ gewinnt',
  'workbench.docs.diagrams.variables.shadowing.shadowed': 'verschattet',
  'workbench.docs.diagrams.variables.shadowing.envLabel': 'Umgebung · staging',
  'workbench.docs.diagrams.variables.shadowing.wsLabel': 'Arbeitsbereich',
  'workbench.docs.diagrams.variables.shadowing.footer':
    'Der Präfix überspringt die Leiter und liest einen Geltungsbereich direkt.',

  // ── Variablen: Live-Lebenszyklus ────────────────────────────────────
  'workbench.docs.diagrams.variables.live.aria':
    'Ein Live Workflow führt seine Schritte aus, veröffentlicht die offengelegte Erfassung als Live-Variable, ' +
    'und Regeln und Anfragen konsumieren sie; die automatische Aktualisierung führt den Workflow erneut aus',
  'workbench.docs.diagrams.variables.live.title': 'Ein erfolgreicher Lauf veröffentlicht den Wert',
  'workbench.docs.diagrams.variables.live.workflowTitle': 'Live Workflow',
  'workbench.docs.diagrams.variables.live.step1': 'Schritt 1 · anmelden',
  'workbench.docs.diagrams.variables.live.step2': 'Schritt 2 · Token holen',
  'workbench.docs.diagrams.variables.live.expose': 'freigeben: token',
  'workbench.docs.diagrams.variables.live.runSucceeds': 'Lauf gelingt',
  'workbench.docs.diagrams.variables.live.publishes': 'veröffentlicht',
  'workbench.docs.diagrams.variables.live.rules': 'Regeln',
  'workbench.docs.diagrams.variables.live.requests': 'Anfragen',
  'workbench.docs.diagrams.variables.live.autoRefresh': 'Auto-Aktualisierung führt erneut aus',
  'workbench.docs.diagrams.variables.live.footer1': 'Speichern aktiviert den Workflow — der Wert erscheint erst nach',
  'workbench.docs.diagrams.variables.live.footer2':
    'einem erfolgreichen Lauf und aktualisiert sich nach dem Zeitplan des Workflows.',

  // ── Variablen: Konsumenten ──────────────────────────────────────────
  'workbench.docs.diagrams.variables.consumers.aria':
    'Ein einziger Vorlagenwert — Authorization: Bearer token — konsumiert von Regeln, Anfragen und Workflows',
  'workbench.docs.diagrams.variables.consumers.title': 'Einmal definieren, überall referenzieren',
  'workbench.docs.diagrams.variables.consumers.template': 'Authorization: Bearer {{token}}',
  'workbench.docs.diagrams.variables.consumers.rules': 'Regeln',
  'workbench.docs.diagrams.variables.consumers.rulesLine1': 'Header, Umleitung,',
  'workbench.docs.diagrams.variables.consumers.rulesLine2': 'Bodys, Injektion',
  'workbench.docs.diagrams.variables.consumers.rulesWhen': 'wenn eine Regel greift',
  'workbench.docs.diagrams.variables.consumers.requests': 'Anfragen',
  'workbench.docs.diagrams.variables.consumers.requestsLine1': 'URL, Parameter,',
  'workbench.docs.diagrams.variables.consumers.requestsLine2': 'Header, Auth, Body',
  'workbench.docs.diagrams.variables.consumers.requestsWhen': 'bei Senden',
  'workbench.docs.diagrams.variables.consumers.workflows': 'Workflows',
  'workbench.docs.diagrams.variables.consumers.workflowsLine1': 'jeder Schritt,',
  'workbench.docs.diagrams.variables.consumers.workflowsLine2': 'verkettete Erfassungen',
  'workbench.docs.diagrams.variables.consumers.workflowsWhen': 'pro Lauf',
  'workbench.docs.diagrams.variables.consumers.footer1':
    'Werte werden beim Verwenden eingesetzt — ändere die Variable einmal,',
  'workbench.docs.diagrams.variables.consumers.footer2': 'und jede Regel, Anfrage und jeder Workflow übernimmt sie.',

  // ── Multi-Tab: Sync-Überblick ───────────────────────────────────────
  'workbench.docs.diagrams.multiTab.sync.aria':
    'Zwei Arbeitsbereich-Tabs nebeneinander offen — verschiedene Arbeitsbereiche oder verschiedene Layouts, ' +
    'parallel bearbeitet',
  'workbench.docs.diagrams.multiTab.sync.title': 'Zwei Tabs, zwei Kontexte — gleichzeitig',
  'workbench.docs.diagrams.multiTab.sync.tabTitle': '{ordinal} Open Headers',
  'workbench.docs.diagrams.multiTab.sync.workspaceProduction': 'Produktion',
  'workbench.docs.diagrams.multiTab.sync.workspaceStaging': 'Staging',
  'workbench.docs.diagrams.multiTab.sync.sidebarRules': 'Regeln',
  'workbench.docs.diagrams.multiTab.sync.sidebarRequests': 'Anfragen',
  'workbench.docs.diagrams.multiTab.sync.sidebarEnv': 'Umg',
  'workbench.docs.diagrams.multiTab.sync.ruleRow1': 'Auth-Header',
  'workbench.docs.diagrams.multiTab.sync.ruleRow2': 'CORS-Bypass',
  'workbench.docs.diagrams.multiTab.sync.ruleRow3': 'Werbung blocken',
  'workbench.docs.diagrams.multiTab.sync.rulesEditor': 'Regel-Editor',
  'workbench.docs.diagrams.multiTab.sync.envEditor': 'Umgebungs-Editor',
  'workbench.docs.diagrams.multiTab.sync.footer1': 'Regeln + Sammlungen synchronisieren sich über den Speicher.',
  'workbench.docs.diagrams.multiTab.sync.footer2': 'Jeder Tab behält seinen Arbeitsbereich + sein Layout.',

  // ── Multi-Tab: Nummerierungs-Zeitleiste ─────────────────────────────
  'workbench.docs.diagrams.multiTab.numbering.aria':
    'Zeitleiste der Tab-Nummerierung — Ordinalzahlen bleiben über die Lebensdauer eines Tabs stabil; das ' +
    'Schließen von #1 nummeriert nicht um, der nächste Tab bekommt #4',
  'workbench.docs.diagrams.multiTab.numbering.title': 'Ordinalzahlen bleiben über die Lebensdauer eines Tabs stabil',
  'workbench.docs.diagrams.multiTab.numbering.step1': '1 Tab offen',
  'workbench.docs.diagrams.multiTab.numbering.note1': 'kein Präfix',
  'workbench.docs.diagrams.multiTab.numbering.step2': 'noch einen öffnen',
  'workbench.docs.diagrams.multiTab.numbering.note2': 'Präfixe erscheinen',
  'workbench.docs.diagrams.multiTab.numbering.step3': 'einen dritten öffnen',
  'workbench.docs.diagrams.multiTab.numbering.step4': '#1 schließen',
  'workbench.docs.diagrams.multiTab.numbering.note4': '#2 #3 unverändert',
  'workbench.docs.diagrams.multiTab.numbering.step5': 'einen weiteren öffnen',
  'workbench.docs.diagrams.multiTab.numbering.note5': 'der nächste ist #4',
  'workbench.docs.diagrams.multiTab.numbering.footer':
    'Die Nummerierung beginnt erst wieder bei #1, wenn jeder Arbeitsbereich-Tab geschlossen wurde.',

  // ── Multi-Tab: Navigations-Wiederverwendung ─────────────────────────
  'workbench.docs.diagrams.multiTab.navigation.aria':
    'Navigations-Wiederverwendung — zuerst das eigene Fenster. Oben: das eigene Fenster hat einen ' +
    'Arbeitsbereich-Tab, der Klick aktiviert ihn. Unten: nur ein anderes Fenster hat einen, ein neuer Tab ' +
    'öffnet sich im aufrufenden Fenster.',
  'workbench.docs.diagrams.multiTab.navigation.title': 'Klicke auf „Regel bearbeiten“ im Popup —',
  'workbench.docs.diagrams.multiTab.navigation.subtitle':
    'das Popup sucht zuerst in DEINEM Fenster nach einem Arbeitsbereich-Tab',
  'workbench.docs.diagrams.multiTab.navigation.sameWindow': 'Gleiches Fenster',
  'workbench.docs.diagrams.multiTab.navigation.sameWindowHint': '— hat bereits einen Arbeitsbereich-Tab',
  'workbench.docs.diagrams.multiTab.navigation.window1': 'Fenster 1',
  'workbench.docs.diagrams.multiTab.navigation.window1Caller': 'Fenster 1 (Aufrufer)',
  'workbench.docs.diagrams.multiTab.navigation.window2': 'Fenster 2',
  'workbench.docs.diagrams.multiTab.navigation.workspaceTab': '#1 Open Headers',
  'workbench.docs.diagrams.multiTab.navigation.otherTab': 'gmail',
  'workbench.docs.diagrams.multiTab.navigation.popup': 'Popup',
  'workbench.docs.diagrams.multiTab.navigation.editRule': 'Regel bearbeiten ▸',
  'workbench.docs.diagrams.multiTab.navigation.activates': 'bestehender Tab aktiviert sich · kein neuer Tab',
  'workbench.docs.diagrams.multiTab.navigation.otherWindow': 'Anderes Fenster',
  'workbench.docs.diagrams.multiTab.navigation.otherWindowHint': '— dein Fenster hat keinen',
  'workbench.docs.diagrams.multiTab.navigation.newTab': '+ neuer Tab',
  'workbench.docs.diagrams.multiTab.navigation.untouched': 'unangetastet · kein Fokusdiebstahl',
  'workbench.docs.diagrams.multiTab.navigation.footer1': 'Genau wie die DevTools von Chrome pro Fenster andocken —',
  'workbench.docs.diagrams.multiTab.navigation.footer2': 'du bleibst in dem Fenster, in dem du schon warst.',

  // ── Multi-Tab: was synchronisiert wird ──────────────────────────────
  'workbench.docs.diagrams.multiTab.synced.aria':
    'Was über Tabs synchronisiert wird — chrome.storage hält Regeln, Sammlungen, Ordner, Umgebungen, Variablen, ' +
    'vault, Anfragen, Vorlagen. Beide Tabs lesen und schreiben darüber.',
  'workbench.docs.diagrams.multiTab.synced.title': '✓ Synchronisiert über Tabs',
  'workbench.docs.diagrams.multiTab.synced.subtitle': 'jeder Tab liest und schreibt denselben chrome.storage',
  'workbench.docs.diagrams.multiTab.synced.sourceOfTruth': 'einzige Quelle der Wahrheit',
  'workbench.docs.diagrams.multiTab.synced.pillRules': 'Regeln',
  'workbench.docs.diagrams.multiTab.synced.pillCollections': 'Sammlungen',
  'workbench.docs.diagrams.multiTab.synced.pillFolders': 'Ordner',
  'workbench.docs.diagrams.multiTab.synced.pillEnvironments': 'Umgebungen',
  'workbench.docs.diagrams.multiTab.synced.pillVariables': 'Variablen',
  'workbench.docs.diagrams.multiTab.synced.pillVault': 'vault',
  'workbench.docs.diagrams.multiTab.synced.pillRequests': 'Anfragen',
  'workbench.docs.diagrams.multiTab.synced.pillTemplates': 'Vorlagen',
  'workbench.docs.diagrams.multiTab.synced.tab1': 'Tab #1',
  'workbench.docs.diagrams.multiTab.synced.tab2': 'Tab #2',
  'workbench.docs.diagrams.multiTab.synced.liveData': 'Live-Daten',
  'workbench.docs.diagrams.multiTab.synced.footer':
    'Speichere in einem der beiden — der andere hydriert sich sofort neu.',

  // ── Multi-Tab: was lokal bleibt ─────────────────────────────────────
  'workbench.docs.diagrams.multiTab.local.aria':
    'Was in jedem Tab bleibt — Teiler-Verhältnis und ungespeicherte Entwürfe. Zwei Tabs unterscheiden sich ' +
    'sichtbar: Teilungen 25/75 und 65/35, ein Entwurf nur in einem.',
  'workbench.docs.diagrams.multiTab.local.title': '✗ Bleibt im jeweiligen Tab',
  'workbench.docs.diagrams.multiTab.local.subtitle':
    'Teiler-Verhältnis + ungespeicherte Eingaben — privat, wo du sie gemacht hast',
  'workbench.docs.diagrams.multiTab.local.tabTitle': 'Tab {ordinal}',
  'workbench.docs.diagrams.multiTab.local.layoutLabel': 'Layout',
  'workbench.docs.diagrams.multiTab.local.draftLabel': 'ungespeicherter Entwurf',
  'workbench.docs.diagrams.multiTab.local.unsavedBadge': '● ungespeichert',
  'workbench.docs.diagrams.multiTab.local.noUnsaved': 'keine ungespeicherten Änderungen',
  'workbench.docs.diagrams.multiTab.local.footer1': 'Jeder Tab behält seinen Teiler + seinen Entwurf.',
  'workbench.docs.diagrams.multiTab.local.footer2':
    'Ein Tab, der NACH deinem Ziehen geöffnet wird, erbt das neue Layout.',

  // ── Header actions: shared kickers ──────────────────────────────────
  'workbench.docs.diagrams.headerActions.shared.ruleKicker': 'REGEL',
  'workbench.docs.diagrams.headerActions.shared.beforeKicker': 'VORHER',
  'workbench.docs.diagrams.headerActions.shared.afterKicker': 'NACHHER',
  'workbench.docs.diagrams.headerActions.shared.wontFireKicker': 'WENN DIE REGEL NICHT GREIFT',
  'workbench.docs.diagrams.headerActions.shared.suggestion': 'Vorschlag',

  // ── Header actions: operations overview ─────────────────────────────
  'workbench.docs.diagrams.headerActions.overview.aria':
    'Vier Header-Operationen auf denselben Ausgangs-Header angewendet — Überschreiben ersetzt den Wert, Anfügen ' +
    'ergänzt ein Duplikat, Entfernen löscht, Zusammenführen verkettet.',
  'workbench.docs.diagrams.headerActions.overview.title': 'Gleicher Ausgangs-Header → vier Ergebnisse',
  'workbench.docs.diagrams.headerActions.overview.before': 'Cookie: a=1',
  'workbench.docs.diagrams.headerActions.overview.opOverride': 'Überschreiben',
  'workbench.docs.diagrams.headerActions.overview.opAppend': 'Anfügen',
  'workbench.docs.diagrams.headerActions.overview.opRemove': 'Entfernen',
  'workbench.docs.diagrams.headerActions.overview.opMerge': 'Zusammenführen',
  'workbench.docs.diagrams.headerActions.overview.engineDnr': 'DNR',
  'workbench.docs.diagrams.headerActions.overview.engineScript': 'Script',
  'workbench.docs.diagrams.headerActions.overview.afterOverrideNew': 'Z',
  'workbench.docs.diagrams.headerActions.overview.afterAppendKept': 'a=1 ·',
  'workbench.docs.diagrams.headerActions.overview.afterAppendNew': '+Cookie: Z',
  'workbench.docs.diagrams.headerActions.overview.afterRemoveGone': '(Header weg)',
  'workbench.docs.diagrams.headerActions.overview.afterMergeNew': '; new=val',
  'workbench.docs.diagrams.headerActions.overview.legendDnr': 'DNR — nativ, von Chrome angewendet',
  'workbench.docs.diagrams.headerActions.overview.legendScript': 'Script — gepatchte fetch / XHR (nur Zusammenführen)',

  // ── Header actions: add / replace ───────────────────────────────────
  'workbench.docs.diagrams.headerActions.override.aria':
    'Hinzufügen / Überschreiben — dieselbe Regel deckt beide Fälle ab. Ersetzt den Wert eines vorhandenen ' +
    'X-Auth-Headers oder fügt den Header hinzu, wenn er fehlt. Beide kommen beim selben Ergebnis an.',
  'workbench.docs.diagrams.headerActions.override.rule': 'Override X-Auth: Bearer token',
  'workbench.docs.diagrams.headerActions.override.replaceLabel': 'Überschreiben',
  'workbench.docs.diagrams.headerActions.override.addLabel': 'Hinzufügen',
  'workbench.docs.diagrams.headerActions.override.replaceSub': 'Header bereits vorhanden',
  'workbench.docs.diagrams.headerActions.override.addSub': 'noch kein X-Auth-Header',
  'workbench.docs.diagrams.headerActions.override.beforeOld': 'X-Auth: old-value',
  'workbench.docs.diagrams.headerActions.override.lineContentType': 'Content-Type: html',
  'workbench.docs.diagrams.headerActions.override.afterNew': 'X-Auth: Bearer token',
  'workbench.docs.diagrams.headerActions.override.noHeaderNote': '(kein X-Auth)',
  'workbench.docs.diagrams.headerActions.override.arrowReplaced': 'Wert ersetzt',
  'workbench.docs.diagrams.headerActions.override.arrowAdded': 'Header hinzugefügt',
  'workbench.docs.diagrams.headerActions.override.stamp': 'So oder so → ein X-Auth-Header mit deinem Wert',
  'workbench.docs.diagrams.headerActions.override.wontAria':
    'Hinzufügen / Überschreiben greift nicht, wenn die Bedingungen der Regel die Anfrage nicht treffen — es ' +
    'passiert still nichts. Vorschlag: prüfe die Bedingungen Anfrage-Domains oder URL-Muster.',
  'workbench.docs.diagrams.headerActions.override.wontTitle': 'Anfrage an eine Domain, die nicht passt',
  'workbench.docs.diagrams.headerActions.override.wontDetail':
    'Die Bedingungen entscheiden, ob die Aktion greift — kein Treffer, ein No-op.',
  'workbench.docs.diagrams.headerActions.override.wontSuggestion':
    'Prüfe die Anfrage-Domains oder das URL-Muster der Regel.',

  // ── Header actions: append ──────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.append.aria':
    'Anfügen ergänzt eine zweite Header-Zeile mit demselben Namen — beide werden ausgeliefert. VORHER zeigt eine ' +
    'Set-Cookie-Zeile; NACHHER zwei, die neue hervorgehoben.',
  'workbench.docs.diagrams.headerActions.append.rule': 'Append Set-Cookie: tracking=xyz',
  'workbench.docs.diagrams.headerActions.append.lineSession': 'Set-Cookie: session=abc',
  'workbench.docs.diagrams.headerActions.append.arrowLabel': '+1 doppelte Zeile',
  'workbench.docs.diagrams.headerActions.append.afterNew': 'Set-Cookie: tracking=xyz',
  'workbench.docs.diagrams.headerActions.append.stamp1': 'Zwei Set-Cookie-Zeilen — beide werden ausgeliefert.',
  'workbench.docs.diagrams.headerActions.append.stamp2':
    'Nutze es für Set-Cookie, Link, Via — Header, die Duplikate erlauben.',
  'workbench.docs.diagrams.headerActions.append.wontAria':
    'Anfügen greift nicht sauber bei Headern, die keine Duplikate erlauben — der Browser behält nur einen. Nutze ' +
    'Überschreiben zum Ersetzen oder Zusammenführen zum Verketten.',
  'workbench.docs.diagrams.headerActions.append.wontTitle': 'Header, die keine Duplikate erlauben',
  'workbench.docs.diagrams.headerActions.append.wontDetail':
    'z. B. Authorization, Host, Content-Type — der Browser behält nur einen.',
  'workbench.docs.diagrams.headerActions.append.wontSuggestion1': 'Nutze Überschreiben, um den Wert zu ersetzen.',
  'workbench.docs.diagrams.headerActions.append.wontSuggestion2':
    'Nutze Zusammenführen, um an den vorhandenen Wert anzuhängen.',

  // ── Header actions: remove ──────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.remove.aria':
    'Entfernen löscht den anvisierten Header. VORHER zeigt X-Frame-Options durchgestrichen; NACHHER nur den ' +
    'verbleibenden Content-Type-Header.',
  'workbench.docs.diagrams.headerActions.remove.rule': 'Remove X-Frame-Options',
  'workbench.docs.diagrams.headerActions.remove.beforeStruck': 'X-Frame-Options: DENY',
  'workbench.docs.diagrams.headerActions.remove.lineContentType': 'Content-Type: text/html',
  'workbench.docs.diagrams.headerActions.remove.arrowLabel': 'Ziel entfernt',
  'workbench.docs.diagrams.headerActions.remove.stamp1': 'Alle Instanzen von X-Frame-Options gelöscht.',
  'workbench.docs.diagrams.headerActions.remove.stamp2':
    'Doppelte Zeilen desselben Headers werden alle auf einmal entfernt.',
  'workbench.docs.diagrams.headerActions.remove.wontAria':
    'Entfernen ist ein No-op, wenn der anvisierte Header fehlt — kein Fehler. Nutze Überschreiben, wenn du ' +
    'stattdessen einen anderen Wert setzen wolltest.',
  'workbench.docs.diagrams.headerActions.remove.wontTitle': 'Header gar nicht vorhanden',
  'workbench.docs.diagrams.headerActions.remove.wontDetail':
    'No-op — kein Fehler, die Anfrage geht einfach unverändert durch.',
  'workbench.docs.diagrams.headerActions.remove.wontSuggestion':
    'Nutze Überschreiben, wenn du den Wert setzen wolltest, nicht entfernen.',

  // ── Header actions: merge ───────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.merge.aria':
    'Zusammenführen liest den vorhandenen Header-Wert zur Laufzeit, verbindet deinen Wert über ein Trennzeichen ' +
    'und ersetzt das Original.',
  'workbench.docs.diagrams.headerActions.merge.rule': "Merge Cookie + new=val  (sep: '; ')",
  'workbench.docs.diagrams.headerActions.merge.lineSession': 'Cookie: session=abc',
  'workbench.docs.diagrams.headerActions.merge.arrowLabel': 'mit Trennzeichen verbinden',
  'workbench.docs.diagrams.headerActions.merge.afterNew': 'new=val',
  'workbench.docs.diagrams.headerActions.merge.stamp1':
    'Vorhandener Wert + dein Wert, verbunden durch das Trennzeichen.',
  'workbench.docs.diagrams.headerActions.merge.stamp2':
    "Standard-Trennzeichen: '; ' für Cookie, ', ' für andere Header.",
  'workbench.docs.diagrams.headerActions.merge.wontAria':
    'Zusammenführen fängt nur JS-initiierte fetch / XHR ab — Seitennavigationen und statische Ressourcen fließen ' +
    'unverändert durch. Nutze dafür Überschreiben oder Anfügen (DNR).',
  'workbench.docs.diagrams.headerActions.merge.wontTitle1': 'Seitennavigationen',
  'workbench.docs.diagrams.headerActions.merge.wontDetail1':
    'Nur JS-initiierte fetch / XHR laufen durch die Script-Engine.',
  'workbench.docs.diagrams.headerActions.merge.wontTitle2': 'Statische Ressourcen (img, script, link)',
  'workbench.docs.diagrams.headerActions.merge.wontDetail2': 'Vom Browser ausgelöst — sie berühren fetch / XHR nie.',
  'workbench.docs.diagrams.headerActions.merge.wontSuggestion':
    'Für Header auf Seitenebene nutze Überschreiben oder Anfügen (DNR).',
} as const satisfies Catalog;
