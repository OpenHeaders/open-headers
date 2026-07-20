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
} as const satisfies Catalog;
