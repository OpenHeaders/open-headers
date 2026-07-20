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

  // ── Conditions: shared ──────────────────────────────────────────────
  'workbench.docs.diagrams.conditions.shared.ruleLabel': 'Regel:',
  'workbench.docs.diagrams.conditions.shared.testRequests': 'Testanfragen:',
  'workbench.docs.diagrams.conditions.shared.testedAgainst': 'Gegen diese URLs getestet:',
  'workbench.docs.diagrams.conditions.shared.beforeKicker': 'VORHER',
  'workbench.docs.diagrams.conditions.shared.afterKicker': 'NACHHER',
  'workbench.docs.diagrams.conditions.shared.legendLiteral': 'literal — exakte Übereinstimmung',
  'workbench.docs.diagrams.conditions.shared.usePrefix': 'Verwende stattdessen ',
  'workbench.docs.diagrams.conditions.shared.useSuffix': '.',
  'workbench.docs.diagrams.conditions.shared.requestDomainsName': 'Anfrage-Domains',
  'workbench.docs.diagrams.conditions.shared.urlPatternName': 'URL-Muster',
  'workbench.docs.diagrams.conditions.shared.initiatorDomainsName': 'Initiator-Domains',

  // ── Conditions: host vs origin ──────────────────────────────────────
  'workbench.docs.diagrams.conditions.hostVsOrigin.aria':
    'Zwei URLs in einem fetch — die URL der Adressleiste ist der Origin (Initiator-Domains); die Ziel-URL des ' +
    'fetch ist der Host (Anfrage-Domains)',
  'workbench.docs.diagrams.conditions.hostVsOrigin.title': 'Zwei URLs, zwei Bedingungen',
  'workbench.docs.diagrams.conditions.hostVsOrigin.pageDoes': 'Das JS dieser Seite ruft auf:',
  'workbench.docs.diagrams.conditions.hostVsOrigin.fetchOpen': "fetch('",
  'workbench.docs.diagrams.conditions.hostVsOrigin.sameFetch': 'Derselbe fetch — zwei verschiedene URLs.',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendOriginTerm': 'Origin',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendOriginRest': ' — die URL der Seite → geprüft durch ',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendHostTerm': 'Host',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendHostRest': ' — das Ziel des fetch → geprüft durch ',

  // ── Conditions: matching attributes ─────────────────────────────────
  'workbench.docs.diagrams.conditions.matching.aria':
    'Jede Bedingung prüft ein Attribut der Anfrage — die farbigen Pillen rechts nennen den Bedingungstyp, der das ' +
    'Attribut der jeweiligen Zeile prüft. Alle Bedingungen werden mit AND verknüpft.',
  'workbench.docs.diagrams.conditions.matching.title': 'Jede Bedingung prüft ein Attribut der Anfrage',
  'workbench.docs.diagrams.conditions.matching.colAttribute': 'ANFRAGE-ATTRIBUT',
  'workbench.docs.diagrams.conditions.matching.colCheckedBy': 'GEPRÜFT DURCH',
  'workbench.docs.diagrams.conditions.matching.attrMethod': 'Methode:',
  'workbench.docs.diagrams.conditions.matching.attrUrl': 'URL:',
  'workbench.docs.diagrams.conditions.matching.attrHost': 'Host:',
  'workbench.docs.diagrams.conditions.matching.attrOrigin': 'Origin:',
  'workbench.docs.diagrams.conditions.matching.attrType': 'Typ:',
  'workbench.docs.diagrams.conditions.matching.attrParty': 'Partei:',
  'workbench.docs.diagrams.conditions.matching.attrHeader': 'Header:',
  'workbench.docs.diagrams.conditions.matching.condMethods': 'Methoden',
  'workbench.docs.diagrams.conditions.matching.condUrlPattern': 'URL-Muster',
  'workbench.docs.diagrams.conditions.matching.condRequestDomains': 'Anfrage-Domains',
  'workbench.docs.diagrams.conditions.matching.condInitiatorDomains': 'Initiator-Domains',
  'workbench.docs.diagrams.conditions.matching.condResourceTypes': 'Ressourcentypen',
  'workbench.docs.diagrams.conditions.matching.condDomainType': 'Domain-Typ',
  'workbench.docs.diagrams.conditions.matching.condHeaders': 'Header',
  'workbench.docs.diagrams.conditions.matching.allMustMatch': 'Alle müssen zutreffen (AND)',
  'workbench.docs.diagrams.conditions.matching.ruleFires': '→ Regel greift',

  // ── Conditions: rule fires ──────────────────────────────────────────
  'workbench.docs.diagrams.conditions.ruleFires.aria':
    'Wenn alle Bedingungen zutreffen, greift die Regel — der Authorization-Header wird ersetzt, bevor die Anfrage ' +
    'den Browser verlässt',
  'workbench.docs.diagrams.conditions.ruleFires.title': 'Bedingungen treffen zu → Regel greift → Anfrage ändert sich',
  'workbench.docs.diagrams.conditions.ruleFires.opOverride': 'Überschreiben',
  'workbench.docs.diagrams.conditions.ruleFires.ruleValue': 'Authorization: Bearer NEW',
  'workbench.docs.diagrams.conditions.ruleFires.beforeOld': 'Bearer OLD',
  'workbench.docs.diagrams.conditions.ruleFires.afterNew': 'Bearer NEW',
  'workbench.docs.diagrams.conditions.ruleFires.lineSession': 'session=abc',
  'workbench.docs.diagrams.conditions.ruleFires.arrowRule': 'Regel',
  'workbench.docs.diagrams.conditions.ruleFires.arrowFires': 'greift',
  'workbench.docs.diagrams.conditions.ruleFires.footer':
    'Die Regel ändert nur ihr Ziel — der Rest läuft unverändert durch.',

  // ── Conditions: request domains ─────────────────────────────────────
  'workbench.docs.diagrams.conditions.requestDomains.aria':
    'Anfrage-Domains: ein Eintrag schließt automatisch die Apex-Domain und jede Subdomain ein, auf jedem Pfad ' +
    'und Query',
  'workbench.docs.diagrams.conditions.requestDomains.title':
    'Anfrage-Domains — ein Eintrag, alle Subdomains, jeder Pfad',
  'workbench.docs.diagrams.conditions.requestDomains.autoIncludes': 'schließt automatisch ein',
  'workbench.docs.diagrams.conditions.requestDomains.hostOnly':
    'Nur der Host zählt — jeder Pfad und Query-String passt',
  'workbench.docs.diagrams.conditions.requestDomains.doesntMatch': 'Trifft nicht zu:',
  'workbench.docs.diagrams.conditions.requestDomains.reasonTld': 'andere TLD (.com ≠ .io)',
  'workbench.docs.diagrams.conditions.requestDomains.reasonNotSub':
    'keine echte Subdomain — kein Punkt vor „openheaders.io“',
  'workbench.docs.diagrams.conditions.requestDomains.footerPathPrefix': 'Nach Pfad eingrenzen? Ergänze ',
  'workbench.docs.diagrams.conditions.requestDomains.footerPathSuffix': ' in der Regel.',
  'workbench.docs.diagrams.conditions.requestDomains.footerCross':
    'Mehrere Domains? Füge jede Domain als eigenen Eintrag hinzu.',

  // ── Conditions: exclude domains ─────────────────────────────────────
  'workbench.docs.diagrams.conditions.excludeDomains.aria':
    'Domains ausschließen zieht Hosts von den Treffern einer anderen Bedingung ab; allein trifft es auf nichts zu',
  'workbench.docs.diagrams.conditions.excludeDomains.title':
    'Domains ausschließen — zieht von einer anderen Bedingung ab',
  'workbench.docs.diagrams.conditions.excludeDomains.subtitle': 'Zieht von den Treffern einer anderen Bedingung ab',
  'workbench.docs.diagrams.conditions.excludeDomains.includeKicker': '+ ANFRAGE-DOMAINS',
  'workbench.docs.diagrams.conditions.excludeDomains.excludeKicker': '− DOMAINS AUSSCHLIESSEN',
  'workbench.docs.diagrams.conditions.excludeDomains.finalHosts': 'Final passende Hosts:',
  'workbench.docs.diagrams.conditions.excludeDomains.excluded': 'ausgeschlossen',
  'workbench.docs.diagrams.conditions.excludeDomains.excludedSub':
    'ausgeschlossen — die Subdomain-Regel gilt auch fürs Ausschließen',
  'workbench.docs.diagrams.conditions.excludeDomains.warnTitle': 'Ausschließen allein trifft auf nichts zu.',
  'workbench.docs.diagrams.conditions.excludeDomains.warnBody':
    'Es zieht nur von den Treffern einer anderen Bedingung ab.',

  // ── Conditions: initiator domains ───────────────────────────────────
  'workbench.docs.diagrams.conditions.initiatorDomains.aria':
    'Initiator-Domains: gleiches Ziel, verschiedene Seiten-Origins, entgegengesetzte Ergebnisse',
  'workbench.docs.diagrams.conditions.initiatorDomains.title':
    'Initiator-Domains — nach der Seite, die den Aufruf macht',
  'workbench.docs.diagrams.conditions.initiatorDomains.subtitle':
    'Gleicher fetch, zwei Seitenkontexte → verschiedene Ergebnisse',
  'workbench.docs.diagrams.conditions.initiatorDomains.ruleBanner': 'Initiator-Domains: portal.openheaders.io',
  'workbench.docs.diagrams.conditions.initiatorDomains.openPage': 'OFFENE SEITE',
  'workbench.docs.diagrams.conditions.initiatorDomains.fetches': '↓ ruft ab',
  'workbench.docs.diagrams.conditions.initiatorDomains.matches': '✓ TRIFFT ZU',
  'workbench.docs.diagrams.conditions.initiatorDomains.noMatch': '✗ KEIN TREFFER',
  'workbench.docs.diagrams.conditions.initiatorDomains.initiatorEq': 'Initiator =',
  'workbench.docs.diagrams.conditions.initiatorDomains.footerQ': 'Nach Ziel statt Origin matchen?',

  // ── Conditions: methods ─────────────────────────────────────────────
  'workbench.docs.diagrams.conditions.methods.aria':
    'Methoden — HTTP-Verben mit Mehrfachauswahl; nur die ausgewählten (orangen) Methoden treffen zu',
  'workbench.docs.diagrams.conditions.methods.title': 'Methoden — wähle, welche HTTP-Verben zutreffen',
  'workbench.docs.diagrams.conditions.methods.subtitle': 'Mehrfachauswahl — Orange trifft zu; der Rest löst nichts aus',
  'workbench.docs.diagrams.conditions.methods.testGet': 'GET /api/users',
  'workbench.docs.diagrams.conditions.methods.testPost': 'POST /api/login',
  'workbench.docs.diagrams.conditions.methods.testPut': 'PUT /api/users/1',
  'workbench.docs.diagrams.conditions.methods.testDelete': 'DELETE /api/users/1',
  'workbench.docs.diagrams.conditions.methods.notSelected': 'Methode nicht in der Auswahl',
  'workbench.docs.diagrams.conditions.methods.footerQ': 'Alle Methoden matchen?',
  'workbench.docs.diagrams.conditions.methods.footerA': 'Entferne die Bedingung — Standard sind alle Methoden.',

  // ── Conditions: resource types ──────────────────────────────────────
  'workbench.docs.diagrams.conditions.resourceTypes.aria':
    'Ressourcentypen — Anfragearten mit Mehrfachauswahl; ausgewählte (lila) Typen treffen zu, andere werden ' +
    'übersprungen',
  'workbench.docs.diagrams.conditions.resourceTypes.title': 'Ressourcentypen — Anfragearten mit Mehrfachauswahl',
  'workbench.docs.diagrams.conditions.resourceTypes.subtitle': 'Lila trifft zu; der Rest löst die Regel nicht aus',
  'workbench.docs.diagrams.conditions.resourceTypes.testVisit': 'öffne /dashboard',
  'workbench.docs.diagrams.conditions.resourceTypes.testImage': 'GET /img/logo.png',
  'workbench.docs.diagrams.conditions.resourceTypes.testScript': 'GET /js/app.js',
  'workbench.docs.diagrams.conditions.resourceTypes.kindXhr': 'xhr',
  'workbench.docs.diagrams.conditions.resourceTypes.kindPage': 'Seite',
  'workbench.docs.diagrams.conditions.resourceTypes.kindImageSkipped': 'Bild — übersprungen',
  'workbench.docs.diagrams.conditions.resourceTypes.kindScriptSkipped': 'Skript — übersprungen',
  'workbench.docs.diagrams.conditions.resourceTypes.footerQ': 'Jeden Ressourcentyp matchen?',
  'workbench.docs.diagrams.conditions.resourceTypes.footerA': 'Entferne die Bedingung — Standard sind alle Arten.',

  // ── Conditions: domain type ─────────────────────────────────────────
  'workbench.docs.diagrams.conditions.domainType.aria':
    'Domain-Typ — jede Anfrage wird als Erstanbieter (gleiche registrierbare Domain) oder Drittanbieter ' +
    'eingestuft; die Auswahl der Regel entscheidet, welcher Typ zutrifft',
  'workbench.docs.diagrams.conditions.domainType.title': 'Domain-Typ — Erstanbieter vs. Drittanbieter',
  'workbench.docs.diagrams.conditions.domainType.subtitle': 'Eingestuft nach dem Verhältnis von Seite und Anfrage-URL',
  'workbench.docs.diagrams.conditions.domainType.pageLabel': 'Seite:',
  'workbench.docs.diagrams.conditions.domainType.ruleSelection': 'Auswahl der Regel:',
  'workbench.docs.diagrams.conditions.domainType.pillFirstParty': 'firstParty',
  'workbench.docs.diagrams.conditions.domainType.pillThirdParty': 'thirdParty',
  'workbench.docs.diagrams.conditions.domainType.colDestination': 'ZIEL',
  'workbench.docs.diagrams.conditions.domainType.colType': 'TYP',
  'workbench.docs.diagrams.conditions.domainType.colMatch': 'TREFFER',
  'workbench.docs.diagrams.conditions.domainType.partyFirst': 'Erstanbieter',
  'workbench.docs.diagrams.conditions.domainType.partyThird': 'Drittanbieter',
  'workbench.docs.diagrams.conditions.domainType.footerBoth': 'Beides? Wähle firstParty UND thirdParty.',
  'workbench.docs.diagrams.conditions.domainType.footerRemove': 'Oder entferne die Bedingung — Standard ist beides.',

  // ── Conditions: response headers ────────────────────────────────────
  'workbench.docs.diagrams.conditions.headers.aria':
    'Bedingung Antwort-Header — exakter Name plus exakter Wert, nur auf Antwortseite (Chrome DNR matcht keine ' +
    'Anfrage-Header)',
  'workbench.docs.diagrams.conditions.headers.title': 'Antwort-Header — exakter Name + exakter Wert',
  'workbench.docs.diagrams.conditions.headers.subtitle': 'Nur Antwortseite — Chrome DNR matcht keine Anfrage-Header',
  'workbench.docs.diagrams.conditions.headers.exactName': 'exakter Name',
  'workbench.docs.diagrams.conditions.headers.exactValue': 'exakter Wert',
  'workbench.docs.diagrams.conditions.headers.testHeaders': 'Getestete Antwort-Header:',
  'workbench.docs.diagrams.conditions.headers.testJson': 'Content-Type: application/json',
  'workbench.docs.diagrams.conditions.headers.testHtml': 'Content-Type: text/html',
  'workbench.docs.diagrams.conditions.headers.testServer': 'Server: nginx',
  'workbench.docs.diagrams.conditions.headers.reasonValue': 'Name passt, aber der Wert weicht ab',
  'workbench.docs.diagrams.conditions.headers.reasonName': 'anderer Header-Name',
  'workbench.docs.diagrams.conditions.headers.absentLine': '(Antwort ohne Content-Type)',
  'workbench.docs.diagrams.conditions.headers.reasonAbsent': 'Header fehlt — er muss vorhanden sein, um zu treffen',
  'workbench.docs.diagrams.conditions.headers.footer':
    'Typisch: nach Content-Type der Antwort oder eigenen Flags filtern',

  // ── Conditions: URL pattern ─────────────────────────────────────────
  'workbench.docs.diagrams.conditions.urlPattern.aria':
    'URL-Muster nutzt Platzhalter auf der ganzen URL — Aufbau des Musters plus Beispiele mit und ohne Treffer',
  'workbench.docs.diagrams.conditions.urlPattern.title': 'URL-Muster — Platzhalter (*) auf der ganzen URL',
  'workbench.docs.diagrams.conditions.urlPattern.labelAny': 'jedes',
  'workbench.docs.diagrams.conditions.urlPattern.labelProtocol': 'Protokoll',
  'workbench.docs.diagrams.conditions.urlPattern.labelLiteralHost': 'literaler Host',
  'workbench.docs.diagrams.conditions.urlPattern.labelNoWildcards': '(keine Platzhalter)',
  'workbench.docs.diagrams.conditions.urlPattern.labelAnyPath': 'jeder Pfad',
  'workbench.docs.diagrams.conditions.urlPattern.labelQueryString': '+ Query-String',
  'workbench.docs.diagrams.conditions.urlPattern.legendWildcard': 'Platzhalter — matcht alles',
  'workbench.docs.diagrams.conditions.urlPattern.reasonSubdomain': '„cdn“ ≠ „api“ — Subdomain passt nicht',
  'workbench.docs.diagrams.conditions.urlPattern.reasonHost': 'völlig anderer Host',
  'workbench.docs.diagrams.conditions.urlPattern.footerQ': 'Alle Subdomains auf einmal matchen?',
  'workbench.docs.diagrams.conditions.urlPattern.footerExample': 'Anfrage-Domains: openheaders.io',

  // ── Conditions: URL regex ───────────────────────────────────────────
  'workbench.docs.diagrams.conditions.urlRegex.aria':
    'Aufbau der URL-Regex plus Beispiele — das Lila ist echte Regex; alles andere ist literal',
  'workbench.docs.diagrams.conditions.urlRegex.title': 'URL-Regex — RE2-Regex auf der ganzen URL',
  'workbench.docs.diagrams.conditions.urlRegex.labelStart': 'Start-',
  'workbench.docs.diagrams.conditions.urlRegex.labelAnchor': 'Anker',
  'workbench.docs.diagrams.conditions.urlRegex.labelLiteralChars': 'literale Zeichen',
  'workbench.docs.diagrams.conditions.urlRegex.labelDotNote': '(\\. matcht das Zeichen .)',
  'workbench.docs.diagrams.conditions.urlRegex.labelOneOrMore': 'eine oder mehr',
  'workbench.docs.diagrams.conditions.urlRegex.labelDigits': 'Ziffern',
  'workbench.docs.diagrams.conditions.urlRegex.legendRegex': 'Regex-Syntax — besondere Bedeutung',
  'workbench.docs.diagrams.conditions.urlRegex.reasonHttp': 'die Regex verlangt https:// — http trifft nicht',
  'workbench.docs.diagrams.conditions.urlRegex.reasonLatest': '„latest“ passt nicht auf /v[0-9]+',
  'workbench.docs.diagrams.conditions.urlRegex.footerQ': 'http und https zugleich?',
  'workbench.docs.diagrams.conditions.urlRegex.footerUsePrefix': 'Verwende ',
  'workbench.docs.diagrams.conditions.urlRegex.footerMid': ' — das ',
  'workbench.docs.diagrams.conditions.urlRegex.footerEnd': ' macht das s optional.',

  // ── Actions: rule anatomy ───────────────────────────────────────────
  'workbench.docs.diagrams.actions.ruleAnatomy.aria':
    'Regel-Anatomie — eine ausgehende HTTP-Anfrage wird gegen die AND-verknüpften Bedingungen der Regel geprüft; ' +
    'treffen alle zu, verändert die Aktion die Anfrage, bevor sie den Browser verlässt.',
  'workbench.docs.diagrams.actions.ruleAnatomy.title': 'Eine Regel = Bedingungen + Aktion',
  'workbench.docs.diagrams.actions.ruleAnatomy.subtitle':
    'Bedingungen entscheiden, ob die Regel greift. Die Aktion entscheidet, was sich ändert.',
  'workbench.docs.diagrams.actions.ruleAnatomy.outgoingRequest': 'Ausgehende Anfrage',
  'workbench.docs.diagrams.actions.ruleAnatomy.sideBefore': 'vorher',
  'workbench.docs.diagrams.actions.ruleAnatomy.sideAfter': 'nachher',
  'workbench.docs.diagrams.actions.ruleAnatomy.addedTag': 'HINZUGEFÜGT',
  'workbench.docs.diagrams.actions.ruleAnatomy.arrowCheck': 'prüfen',
  'workbench.docs.diagrams.actions.ruleAnatomy.arrowApply': 'anwenden',
  'workbench.docs.diagrams.actions.ruleAnatomy.ruleLabel': 'Regel',
  'workbench.docs.diagrams.actions.ruleAnatomy.editorEntity': 'Editor-Entität',
  'workbench.docs.diagrams.actions.ruleAnatomy.conditionsKicker': 'BEDINGUNGEN',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionKicker': 'AKTION',
  'workbench.docs.diagrams.actions.ruleAnatomy.condMethods': 'Methoden',
  'workbench.docs.diagrams.actions.ruleAnatomy.condRequestDomains': 'Anfrage-Domains',
  'workbench.docs.diagrams.actions.ruleAnatomy.condHeaders': 'Header',
  'workbench.docs.diagrams.actions.ruleAnatomy.allMustMatch': 'ALLE MÜSSEN ZUTREFFEN (AND)',
  'workbench.docs.diagrams.actions.ruleAnatomy.onePerRule': 'eine pro Regel',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionCard': 'Header-Aktion · Hinzufügen',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionValue': 'Bearer abc123…',
  'workbench.docs.diagrams.actions.ruleAnatomy.categoryLine': 'Kategorie: Anfrage verändern',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictConditions': 'Bedingungen filtern',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictAction': 'Aktion wandelt um',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictResult': 'Anfrage verändert gesendet',

  // ── Actions: taxonomy ───────────────────────────────────────────────
  'workbench.docs.diagrams.actions.taxonomy.aria':
    'Aktions-Taxonomie — drei Kategorien (Anfrage verändern, Antwort verändern, Code ausführen), die jede ' +
    'Aktion mit ihrer Ausführungs-Engine (DNR oder Script) auflisten.',
  'workbench.docs.diagrams.actions.taxonomy.title': 'Aktionen — nach Kategorie',
  'workbench.docs.diagrams.actions.taxonomy.subtitle':
    'Jede Aktion gehört zu einer der drei Kategorien. Das Engine-Tag zeigt dir, wo sie ausgeführt wird.',
  'workbench.docs.diagrams.actions.taxonomy.catModifyRequest': 'Anfrage verändern',
  'workbench.docs.diagrams.actions.taxonomy.catModifyRequestSub': 'bevor sie den Browser verlässt',
  'workbench.docs.diagrams.actions.taxonomy.catModifyResponse': 'Antwort verändern',
  'workbench.docs.diagrams.actions.taxonomy.catModifyResponseSub': 'bevor die Seite sie sieht',
  'workbench.docs.diagrams.actions.taxonomy.catRunCode': 'Code ausführen',
  'workbench.docs.diagrams.actions.taxonomy.catRunCodeSub': 'in der Seite oder ihrem Scheduler',
  'workbench.docs.diagrams.actions.taxonomy.nameHeaderActions': 'Header-Aktionen',
  'workbench.docs.diagrams.actions.taxonomy.subHeaderOps': 'die vier Header-Operationen',
  'workbench.docs.diagrams.actions.taxonomy.nameBlock': 'Blockieren',
  'workbench.docs.diagrams.actions.taxonomy.subBlock': 'auf Netzwerkebene abbrechen',
  'workbench.docs.diagrams.actions.taxonomy.nameRedirect': 'Umleiten',
  'workbench.docs.diagrams.actions.taxonomy.subRedirect': 'statische URL oder Regex',
  'workbench.docs.diagrams.actions.taxonomy.nameQueryParams': 'Query-Parameter',
  'workbench.docs.diagrams.actions.taxonomy.subQueryParams': 'hinzufügen · ersetzen · entfernen',
  'workbench.docs.diagrams.actions.taxonomy.nameRequestBody': 'Anfrage-Body',
  'workbench.docs.diagrams.actions.taxonomy.subRequestBody': 'statisch · dynamisch · GraphQL',
  'workbench.docs.diagrams.actions.taxonomy.subHeaderResponse': 'Header auf der Antwortseite',
  'workbench.docs.diagrams.actions.taxonomy.nameResponseBody': 'Antwort-Body',
  'workbench.docs.diagrams.actions.taxonomy.subResponseBody': 'Mock-Body · Status · Header',
  'workbench.docs.diagrams.actions.taxonomy.nameInject': 'JS / CSS injizieren',
  'workbench.docs.diagrams.actions.taxonomy.subInject': 'vor den Scripts oder nach dem DOM',
  'workbench.docs.diagrams.actions.taxonomy.nameDelay': 'Verzögerung',
  'workbench.docs.diagrams.actions.taxonomy.subDelay': 'Navigationen + fetch / XHR',
  'workbench.docs.diagrams.actions.taxonomy.verdict': 'Kategorie wählen · Aktion wählen · mit Bedingungen kombinieren',

  // ── System status: shared ───────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.shared.sync': 'Synchronisierung',
  'workbench.docs.diagrams.systemStatus.shared.rules': 'Regeln',
  'workbench.docs.diagrams.systemStatus.shared.requests': 'Anfragen',
  'workbench.docs.diagrams.systemStatus.shared.permissions': 'Berechtigungen',
  'workbench.docs.diagrams.systemStatus.shared.secrets': 'Secrets',
  'workbench.docs.diagrams.systemStatus.shared.live': 'Live',
  'workbench.docs.diagrams.systemStatus.shared.systemStatus': 'Systemstatus',
  'workbench.docs.diagrams.systemStatus.shared.noEventsYet': 'Noch keine Ereignisse',
  'workbench.docs.diagrams.systemStatus.shared.green': 'grün',
  'workbench.docs.diagrams.systemStatus.shared.yellow': 'gelb',
  'workbench.docs.diagrams.systemStatus.shared.red': 'rot',
  'workbench.docs.diagrams.systemStatus.shared.desktopApp': 'Desktop-App',
  'workbench.docs.diagrams.systemStatus.shared.swWakes': 'SW wacht auf',

  // ── System status: surfaces ─────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.aria':
    'Workbench-Oberfläche — der Workbench-Tab von OpenHeaders. Die Statuszeile lebt in der Fußleiste, mit ' +
    'einer Pille pro Subsystem.',
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.title': 'Workbench: Statuszeile in der Fußleiste',
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.callout':
    '↑ sechs Pillen — eine pro Subsystem; ein Klick öffnet das Popover.',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.aria':
    'Popup-Oberfläche — das Popup der Erweiterung hängt am Toolbar-Symbol. Die Status-Pille sitzt in der ' +
    'Fußleiste des Popups: ein Punkt plus das Label „Systemstatus“.',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.title': 'Popup: Systemstatus-Pille in der Fußleiste',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.wsChip': 'ws ▾',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.callout':
    '↑ Punkt + Label „Systemstatus“ sitzt im Fußstreifen des Popups.',

  // ── System status: worst-level aggregator ───────────────────────────
  'workbench.docs.diagrams.systemStatus.worstLevel.aria':
    'Schlechtester-Zustand-Aggregator — sechs Subsystem-Zustände speisen einen einzigen zusammengesetzten ' +
    'Punkt. Die schlechteste Farbe gewinnt: Rot schlägt Gelb schlägt Grün.',
  'workbench.docs.diagrams.systemStatus.worstLevel.title': 'Die schlechteste Farbe gewinnt',
  'workbench.docs.diagrams.systemStatus.worstLevel.subtitle':
    'rot > gelb > grün · grau = noch keine Ereignisse (zählt als grün)',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgConnected': 'verbunden',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgActive': '12 aktiv',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgNoEvents': 'noch keine Ereignisse',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgHostNarrowed': 'Host eingeschränkt',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgCipher': 'Entschlüsselung',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgFresh': '3 frisch',
  'workbench.docs.diagrams.systemStatus.worstLevel.maxFn': 'max()',
  'workbench.docs.diagrams.systemStatus.worstLevel.composite': 'zusammengesetzter',
  'workbench.docs.diagrams.systemStatus.worstLevel.dot': 'Punkt',
  'workbench.docs.diagrams.systemStatus.worstLevel.footer':
    'Ein Rot irgendwo → Komposit rot. Steuert den Punkt in Popup / Seitenleiste.',

  // ── System status: popover ──────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.popover.aria':
    'Layout des Status-Popovers — graue Zeilen (noch keine Ereignisse) stehen über den farbigen Zeilen ' +
    '(die bereits gemeldet haben).',
  'workbench.docs.diagrams.systemStatus.popover.title': 'Popover-Reihenfolge: erst Grau, dann Farbe',
  'workbench.docs.diagrams.systemStatus.popover.subtitle':
    'Innerhalb jeder Stufe bleibt die kanonische Subsystem-Reihenfolge erhalten',
  'workbench.docs.diagrams.systemStatus.popover.header': '● Systemstatus',
  'workbench.docs.diagrams.systemStatus.popover.msgConnected': 'Verbunden',
  'workbench.docs.diagrams.systemStatus.popover.msgActiveRules': '12 aktive Regeln',
  'workbench.docs.diagrams.systemStatus.popover.msgHostsNarrowed': 'Hosts eingeschränkt',
  'workbench.docs.diagrams.systemStatus.popover.msgCipherFailed': 'Entschlüsselung fehlgeschlagen',
  'workbench.docs.diagrams.systemStatus.popover.dividerNote': '↑ keine Ereignisse · ↓ haben gemeldet',
  'workbench.docs.diagrams.systemStatus.popover.footer':
    'Beim ersten Bericht wandert eine Zeile einmalig von grau zu farbig.',

  // ── System status: sync topology ────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.syncTopology.aria':
    'Sync-Topologie — der Service Worker der Erweiterung hält einen WebSocket zur Desktop-App auf ' +
    '127.0.0.1:8137 und tauscht Arbeitsbereiche, Variablen und Team-Synchronisierung aus.',
  'workbench.docs.diagrams.systemStatus.syncTopology.title': 'Wie sich das Subsystem Synchronisierung verbindet',
  'workbench.docs.diagrams.systemStatus.syncTopology.extension': 'Erweiterung',
  'workbench.docs.diagrams.systemStatus.syncTopology.serviceWorker': 'Service Worker',
  'workbench.docs.diagrams.systemStatus.syncTopology.wsClient': 'WS-Client',
  'workbench.docs.diagrams.systemStatus.syncTopology.onYourMachine': 'auf deinem Rechner',
  'workbench.docs.diagrams.systemStatus.syncTopology.wsServer': 'WS-Server',
  'workbench.docs.diagrams.systemStatus.syncTopology.webSocket': 'WebSocket',
  'workbench.docs.diagrams.systemStatus.syncTopology.carries':
    'Transportiert: dynamische Variablen · Arbeitsbereiche · Team-Sync',
  'workbench.docs.diagrams.systemStatus.syncTopology.loopback': 'Nur Loopback — verlässt deinen Rechner nie.',

  // ── System status: sync lifecycle ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.syncLifecycle.aria':
    'Lebenszyklus der Sync-Verbindung als Sequenzdiagramm — der Service Worker der Erweiterung verbindet sich ' +
    'mit der Desktop-App; die Pille wechselt von grün zu gelb und zurück zu grün',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.title': 'Wie sich die Sync-Pille über die Zeit verändert',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.extensionSw': 'Erweiterungs-SW',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.syncPill': 'Sync-Pille',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.readsSettings': 'liest Einstellungen',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.autoConnectOff': 'wenn Auto-Verbinden = aus →',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateDisabled': 'Deaktiviert',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateConnecting': 'Verbindet',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateConnected': 'Verbunden',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retry1': 'Versuch #1',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retry2': 'Versuch #2',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.otherwise': 'andernfalls →',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.wsConnect': 'WebSocket-Verbindung',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.handshakeOk': 'Handshake OK',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.pingPong': 'Ping ⇄ Pong',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.connectionDrops': '✗ Verbindung bricht ab',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.backoff': 'Backoff',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retryConnect': 'erneut verbinden',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.footer':
    'Exponentieller Backoff zwischen Versuchen · Pings erkennen stille Proxy-Abbrüche',

  // ── System status: rules pipeline ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.rulesPipeline.aria':
    'Regel-Pipeline — die Regel wird kompiliert, Variablen aufgelöst, das Limit geprüft, dann wendet Chrome ' +
    'sie an. Jede Stufe kann einen Status-Level melden, wenn etwas schiefgeht.',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.title': 'Wie eine Regel zum aktiven DNR-Eintrag wird',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageYourRule': 'Deine Regel',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageCompile': 'Kompilieren',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageResolve': '{{VAR}} auflösen',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageCapCheck': 'Limit-Prüfung',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageChromeApply': 'Chrome wendet an',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageLiveRule': 'Aktive Regel',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subToDnrJson': 'zu DNR-JSON',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subResolveScopes': 'vault · env · Arbeitsbereich',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subMatches': 'matcht Anfragen',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outUnresolved': 'unaufgelöst → gelb',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outOverCap': 'über dem Limit → gelb',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outRejected': 'abgelehnt → rot',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outActive': 'N aktiv → grün',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.footerRebuild': 'Der Neuaufbau feuert bei jedem Speichern.',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.footerPaused':
    'Pausiert bleibt grün („Regelausführung pausiert“).',

  // ── System status: rules capacity ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.rulesCapacity.aria':
    'DNR-Kapazitätsleiste — grün bis zur Warnschwelle, gelb bis zum Kürzungslimit, rot darüber. Regeln über ' +
    'dem Limit werden verworfen, die rote Zone wird zur Laufzeit nie erreicht.',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.title': 'Regelkapazität — wo jede Anzahl landet',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneHealthy': '✓ gesund',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneApproach': 'nähert sich',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneTruncated': 'gekürzt',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countHealthy': '1,200',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countApproaching': '4,500',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countOver': '5,600',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.warnLabel': 'Warnung',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.capLabel': 'Limit',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.warnValue': '4,000',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.capValue': '5,000',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.footerDrop':
    'Regeln über dem Limit werden in Match-Reihenfolge verworfen (oben gewinnt).',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.footerCeiling':
    'Die harte Obergrenze von Chrome liegt viel weiter draußen, bei 30.000.',

  // ── System status: request outcomes ─────────────────────────────────
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.aria':
    'Ergebnisse des Anfrage-Executors — jede HTTP-Antwort, auch 4xx und 5xx, stellt die Pille auf grün. Nur ' +
    'Netzwerkfehler ohne Antwort stellen sie auf gelb.',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.title': 'Was färbt die Anfragen-Pille in welche Farbe?',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.requestEditor': 'Anfrage-Editor',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.sendButton': 'Senden ▸',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.executorFires': 'Executor feuert',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.gotResponse': '✓ HTTP-Antwort erhalten',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.anyStatus': 'jeder Statuscode zählt',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exOk': 'OK',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exNotFound': 'Nicht gefunden',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exServerError': 'Serverfehler',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exAborted': 'Abgebrochen',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exOffline': 'Offline / DNS',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.pillGreen': 'Pille → grün',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.pillYellow': 'Pille → gelb',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.noResponse': '✗ keine Antwort',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.networkFailure': 'Fehler auf Netzwerkebene',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.footer':
    'Ein 500 ist trotzdem „grün“ — die Anfrage kam durch, du hast eben einen 500 bekommen.',

  // ── System status: request scope ────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.requestsScope.aria':
    'Geltungsbereich des Executors — nur Senden-Button-Anfragen aktualisieren die Pille. Live-Workflow-' +
    'Aktualisierungen sind still; Seitenverkehr läuft über die Regel-Engine.',
  'workbench.docs.diagrams.systemStatus.requestsScope.title': 'Was aktualisiert die Anfragen-Pille?',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcSend': 'Senden ▸ im Editor',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcLive': 'Live-Workflow-Refresh',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcWebpage': 'fetch / XHR der Seite',
  'workbench.docs.diagrams.systemStatus.requestsScope.subUser': 'vom Nutzer ausgelöst',
  'workbench.docs.diagrams.systemStatus.requestsScope.subBackground': 'Hintergrund-Tick',
  'workbench.docs.diagrams.systemStatus.requestsScope.subObserved': 'von der Regel-Engine beobachtet',
  'workbench.docs.diagrams.systemStatus.requestsScope.updatesPill': 'aktualisiert die Pille',
  'workbench.docs.diagrams.systemStatus.requestsScope.differentSystem': 'anderes System',
  'workbench.docs.diagrams.systemStatus.requestsScope.noUpdate': 'keine Aktualisierung',
  'workbench.docs.diagrams.systemStatus.requestsScope.footer':
    'Nur Ad-hoc-Verkehr des Senden-Buttons formt diese Pille.',

  // ── System status: permissions impact ───────────────────────────────
  'workbench.docs.diagrams.systemStatus.permissionsImpact.aria':
    'Gleiche Regel, zwei Berechtigungszustände. Mit gewährtem all_urls greift die DNR-Regel. Mit entzogenem ' +
    'Host tut die Regel still nichts und der Header kommt nie an.',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.title': 'Gleiche Regel, zwei Berechtigungszustände',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.granted': 'Gewährt',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.narrowed': 'Eingeschränkt',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.hostRevoked': 'Host entzogen',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.addHeader': 'Header hinzufügen',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.page': 'Seite',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.fetchCall': 'fetch()',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.applies': 'greift',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.noOp': 'No-op',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.headerArrives': '✓ Header kommt an',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.headerMissing': '✗ Header fehlt',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.ruleFired': 'Regel griff',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.silentNoOp': 'stilles No-op',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.footer1':
    'Eingeschränkte Hosts werfen keinen Fehler — Regeln tun einfach still nichts.',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.footer2':
    'Das Rot der Pille ist der einzige Hinweis, bis du den Zugriff wiederherstellst.',

  // ── System status: permissions audit ────────────────────────────────
  'workbench.docs.diagrams.systemStatus.permissionsAudit.aria':
    'Wann das Audit läuft und welchen Status-Level jeder Zweig meldet.',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.title': 'Wann läuft das Audit, und was meldet jeder Zweig?',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.firstHydration': 'erste Hydration',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.happyPath': 'Normalfall',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.userRevoked': 'ein Host wurde entzogen',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.apiUnavailable': 'API nicht verfügbar',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.throws': 'wirft Fehler',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgAllGranted': '„Alles gewährt“',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgHostsNarrowed': '„Hosts eingeschränkt“',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgAuditFailed': '„Audit fehlgeschlagen“',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.footer1':
    'MV3 hat keinen Beobachter für Berechtigungsänderungen —',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.footer2':
    'die Prüfung feuert bei jedem Aufwachen des SW erneut.',

  // ── System status: vault hydration ──────────────────────────────────
  'workbench.docs.diagrams.systemStatus.vaultHydration.aria':
    'Vault-Hydration — der vault-Blob lädt aus dem Speicher, jeder Eintrag läuft durchs Schema. Passende bleiben; ' +
    'abgedriftete Einträge werden verworfen und als gelb gemeldet.',
  'workbench.docs.diagrams.systemStatus.vaultHydration.title': 'Vault-Hydration beim Aufwachen des SW',
  'workbench.docs.diagrams.systemStatus.vaultHydration.blobSuffix': ' (verschlüsselter Blob)',
  'workbench.docs.diagrams.systemStatus.vaultHydration.schemaValidator': 'Schema-Validator',
  'workbench.docs.diagrams.systemStatus.vaultHydration.matchesSchema': 'passt zum Schema',
  'workbench.docs.diagrams.systemStatus.vaultHydration.driftOldShape': 'Drift: alte Form',
  'workbench.docs.diagrams.systemStatus.vaultHydration.kept': '✓ behalten',
  'workbench.docs.diagrams.systemStatus.vaultHydration.dropped': '✗ verworfen',
  'workbench.docs.diagrams.systemStatus.vaultHydration.secretsYellow': 'Secrets · gelb',
  'workbench.docs.diagrams.systemStatus.vaultHydration.keptEntries': 'behaltene Einträge',
  'workbench.docs.diagrams.systemStatus.vaultHydration.hydrateCleanly': 'hydrieren sauber',

  // ── System status: vault drift detail ───────────────────────────────
  'workbench.docs.diagrams.systemStatus.vaultDrift.aria':
    'Wie Schema-Drift konkret aussieht — ein gültiger Eintrag hat uid, label und cipher; einem abgedrifteten ' +
    'kann das cipher-Feld fehlen. Der Validator verwirft die schlechte Zeile und meldet gelb.',
  'workbench.docs.diagrams.systemStatus.vaultDrift.title': 'Wie „Schema-Drift“ konkret aussieht',
  'workbench.docs.diagrams.systemStatus.vaultDrift.validEntry': 'Gültiger Eintrag',
  'workbench.docs.diagrams.systemStatus.vaultDrift.driftEntry': 'Drift-Eintrag',
  'workbench.docs.diagrams.systemStatus.vaultDrift.apiToken': 'API-token',
  'workbench.docs.diagrams.systemStatus.vaultDrift.oldToken': 'alter token',
  'workbench.docs.diagrams.systemStatus.vaultDrift.missing': '— fehlt —',
  'workbench.docs.diagrams.systemStatus.vaultDrift.issue': '2 Schema-Probleme → verworfen',
  'workbench.docs.diagrams.systemStatus.vaultDrift.footer1':
    'Drift-Einträge werden beim Hydrieren verworfen und die Pille wird gelb.',
  'workbench.docs.diagrams.systemStatus.vaultDrift.footer2':
    'Erneutes Speichern im Vault-Editor gibt dem Eintrag seine aktuelle Form zurück.',

  // ── System status: live freshness ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.liveFreshness.aria':
    'Zustandsregeln pro Workflow — frisch, veraltet/wackelnd, fehlschlagend — an die echten Schwellen ' + 'gepinnt.',
  'workbench.docs.diagrams.systemStatus.liveFreshness.title': 'Zustandsregeln pro Workflow',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateFresh': 'frisch',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateStale': 'veraltet / wackelnd',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateFailing': 'fehlschlagend',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleFresh': 'letzter Lauf OK · innerhalb 2× Kadenz · 0 Fehler',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleStale': 'über 2× Kadenz · ODER 1–4 Fehler in Folge',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleFailing': '≥ 5 Fehler in Folge',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egFresh': 'z. B. jeder Refresh trifft die 200',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egStale': 'z. B. ein Timeout, neuer Versuch',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egFailing': 'z. B. API eine Stunde down',
  'workbench.docs.diagrams.systemStatus.liveFreshness.footer':
    'Kadenz = das konfigurierte Aktualisierungsintervall des Workflows.',

  // ── System status: live aggregation ─────────────────────────────────
  'workbench.docs.diagrams.systemStatus.liveAggregation.aria':
    'Live-Pillen-Aggregation — drei Workflows des aktiven Arbeitsbereichs falten sich via max zu einem ' +
    'Komposit; Workflows inaktiver Arbeitsbereiche sind ausgeschlossen.',
  'workbench.docs.diagrams.systemStatus.liveAggregation.title':
    'Workflows des aktiven Arbeitsbereichs falten sich zu einer Pille',
  'workbench.docs.diagrams.systemStatus.liveAggregation.activeWorkspace': 'Aktiver Arbeitsbereich',
  'workbench.docs.diagrams.systemStatus.liveAggregation.contributes': 'zählt für die Pille',
  'workbench.docs.diagrams.systemStatus.liveAggregation.msgFresh': 'frisch',
  'workbench.docs.diagrams.systemStatus.liveAggregation.msgConsecFails': '2 Fehler in Folge',
  'workbench.docs.diagrams.systemStatus.liveAggregation.otherWorkspaces': 'Andere Arbeitsbereiche',
  'workbench.docs.diagrams.systemStatus.liveAggregation.excluded': 'bewusst ausgeschlossen',
  'workbench.docs.diagrams.systemStatus.liveAggregation.skipped': '✗ nicht handhabbar — übersprungen',
  'workbench.docs.diagrams.systemStatus.liveAggregation.livePill': 'Live-Pille',
  'workbench.docs.diagrams.systemStatus.liveAggregation.maxYellow': 'max() = gelb',
  'workbench.docs.diagrams.systemStatus.liveAggregation.footer1':
    'Ein einziger Workflow im schlechtesten Zustand kippt die ganze Pille.',
  'workbench.docs.diagrams.systemStatus.liveAggregation.footer2':
    'Wechsle den Arbeitsbereich und die Pille rechnet mit den Läufen dieses Bereichs neu.',
} as const satisfies Catalog;
