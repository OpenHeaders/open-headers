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

  // ── Variablen: Referenzen pro Geltungsbereich ───────────────────────
  'workbench.docs.diagrams.variables.refs.shared.dont': 'Vermeide:',
  'workbench.docs.diagrams.variables.refs.vault.aria':
    'Vault: Referenziere Secrets aus synchronisierten Entitäten über Vorlagen aus dem vault; füge rohe ' +
    'Schlüssel nie in Regeln oder Arbeitsbereich-Variablen ein',
  'workbench.docs.diagrams.variables.refs.vault.title': 'Vault — Secrets, die dieses Gerät nie verlassen',
  'workbench.docs.diagrams.variables.refs.vault.chipSub': 'Vault · kind: string',
  'workbench.docs.diagrams.variables.refs.vault.arrowCaption': 'lokal aufgelöst',
  'workbench.docs.diagrams.variables.refs.vault.good1Note':
    'synchronisierte Regel — der eigene Schlüssel jedes Teammitglieds wird eingesetzt',
  'workbench.docs.diagrams.variables.refs.vault.good2Note': 'TOTP-Eintrag — löst den aktuellen Code auf, nie den Seed',
  'workbench.docs.diagrams.variables.refs.vault.goodFootnote':
    'Einträge im vault bleiben außerhalb von Sync, Exporten und git',
  'workbench.docs.diagrams.variables.refs.vault.bad1Text': 'Bearer sk-live-9f3d… in einer Regel',
  'workbench.docs.diagrams.variables.refs.vault.bad1Reason':
    'eingefügter Klartext synchronisiert sich in den ganzen Arbeitsbereich',
  'workbench.docs.diagrams.variables.refs.vault.bad2Text': 'api_key als Arbeitsbereich-Variable',
  'workbench.docs.diagrams.variables.refs.vault.bad2Reason':
    'ebenfalls synchronisiert — der vault ist der einzige lokale Geltungsbereich',
  'workbench.docs.diagrams.variables.refs.vault.footer1':
    'Der Vault schlägt jeden Geltungsbereich — ein einfaches {{api_key}}',
  'workbench.docs.diagrams.variables.refs.vault.footer2': 'nimmt immer den Wert aus dem vault, wenn es einen gibt.',
  'workbench.docs.diagrams.variables.refs.environment.aria':
    'Umgebung: Ein Variablenname löst sich pro Stufe auf einen anderen Wert auf; wechsle die Umgebung, statt ' +
    'Regeln zu duplizieren, und bewahre Secrets im vault auf',
  'workbench.docs.diagrams.variables.refs.environment.title': 'Umgebung — ein Name, ein Wert pro Stufe',
  'workbench.docs.diagrams.variables.refs.environment.chipSub': 'Umgebungen · staging (aktiv)',
  'workbench.docs.diagrams.variables.refs.environment.arrowCaption': 'die aktive Umgebung gewinnt',
  'workbench.docs.diagrams.variables.refs.environment.good1Note': 'solange staging aktiv ist',
  'workbench.docs.diagrams.variables.refs.environment.good2Note':
    'wechsle die Umgebung — gleiche Regeln, null Änderungen',
  'workbench.docs.diagrams.variables.refs.environment.goodFootnote':
    'ein Fehltreffer fällt zuerst auf die Standardumgebung zurück',
  'workbench.docs.diagrams.variables.refs.environment.bad1Text': 'sk-live-Schlüssel in production eingetippt',
  'workbench.docs.diagrams.variables.refs.environment.bad1Reason':
    'Umgebungen synchronisieren sich — Secrets gehören in den Vault',
  'workbench.docs.diagrams.variables.refs.environment.bad2Text': 'eine Kopie jeder Regel für staging',
  'workbench.docs.diagrams.variables.refs.environment.bad2Reason':
    'dupliziere Regeln nicht pro Stufe — wechsle die Umgebung',
  'workbench.docs.diagrams.variables.refs.environment.footer1':
    'Gleicher Wert in jeder Stufe? Nimm den Arbeitsbereich.',
  'workbench.docs.diagrams.variables.refs.environment.footer2': 'Secret pro Nutzer? Der Vault schlägt jede Umgebung.',
  'workbench.docs.diagrams.variables.refs.collection.aria':
    'Sammlung: Variablen lösen sich nur für Regeln und Anfragen innerhalb ihrer Sammlung auf; verschiebe ' +
    'überall gültige Werte in den Arbeitsbereich',
  'workbench.docs.diagrams.variables.refs.collection.title': 'Sammlung — auf eine API begrenzt',
  'workbench.docs.diagrams.variables.refs.collection.chipSub': 'Payments-API · Variablen',
  'workbench.docs.diagrams.variables.refs.collection.arrowCaption': 'löst sich innerhalb der Payments-API auf',
  'workbench.docs.diagrams.variables.refs.collection.good1Note': 'Anfrage in der Sammlung Payments-API',
  'workbench.docs.diagrams.variables.refs.collection.good2Note': 'Regel in der Sammlung Payments-API',
  'workbench.docs.diagrams.variables.refs.collection.badsLabel': 'Löst sich nicht auf:',
  'workbench.docs.diagrams.variables.refs.collection.bad1Text': '{{base_url}} in der Billing-API',
  'workbench.docs.diagrams.variables.refs.collection.bad1Reason': 'andere Sammlung — definiere sie dort',
  'workbench.docs.diagrams.variables.refs.collection.bad2Text': '{{base_url}} in einer Regel ohne Sammlung',
  'workbench.docs.diagrams.variables.refs.collection.bad2Reason':
    'keine Sammlung → die Referenz läuft an diesem Geltungsbereich vorbei',
  'workbench.docs.diagrams.variables.refs.collection.footer1':
    'Von jeder Sammlung gebraucht? Verschiebe sie in den Arbeitsbereich.',
  'workbench.docs.diagrams.variables.refs.collection.footer2': 'Eine gleichnamige Umgebungsvariable schlägt sie.',
  'workbench.docs.diagrams.variables.refs.workspace.aria':
    'Arbeitsbereich: Arbeitsbereich-Variablen lösen sich überall auf und stehen am niedrigsten; bewahre ' +
    'Secrets im vault und stufenabhängige Werte in Umgebungen auf',
  'workbench.docs.diagrams.variables.refs.workspace.title': 'Arbeitsbereich — die geteilte Basisschicht',
  'workbench.docs.diagrams.variables.refs.workspace.chipSub': 'Arbeitsbereich-Variablen',
  'workbench.docs.diagrams.variables.refs.workspace.arrowCaption': 'löst sich überall auf',
  'workbench.docs.diagrams.variables.refs.workspace.good1Note': 'Header-Regel — jede Sammlung, jede Umgebung',
  'workbench.docs.diagrams.variables.refs.workspace.good2Note': 'Anfrage-URL',
  'workbench.docs.diagrams.variables.refs.workspace.good3Note':
    'gebunden — selbst wenn ein höherer Geltungsbereich den Namen verschattet',
  'workbench.docs.diagrams.variables.refs.workspace.bad1Reason':
    'an alle synchronisiert — bewahre Secrets im Vault auf',
  'workbench.docs.diagrams.variables.refs.workspace.bad2Reason':
    'ändert sich pro Stufe — definiere sie in jeder Umgebung',
  'workbench.docs.diagrams.variables.refs.workspace.footer1':
    'Secret? Nimm den Vault. Pro Stufe anders? Nimm die Umgebung.',
  'workbench.docs.diagrams.variables.refs.workspace.footer2': 'Der Arbeitsbereich ist für Werte, die überall gelten.',
  'workbench.docs.diagrams.variables.refs.live.aria':
    'Live: Referenziere von Workflows veröffentlichte Werte mit dem live-Präfix; eine einfache Referenz löst ' +
    'live nie auf, und von Hand eingefügte Tokens veralten',
  'workbench.docs.diagrams.variables.refs.live.title': 'Live — erzeugt von einem Workflow-Lauf',
  'workbench.docs.diagrams.variables.refs.live.chipSub': 'Live-Variablen · OAuth-Anmelde-Workflow',
  'workbench.docs.diagrams.variables.refs.live.arrowCaption': 'vom letzten Lauf veröffentlicht',
  'workbench.docs.diagrams.variables.refs.live.good1Note': 'Header-Regel, die nie veraltet',
  'workbench.docs.diagrams.variables.refs.live.good2Text': '{{live.token}} in Anfragen und Workflows',
  'workbench.docs.diagrams.variables.refs.live.good2Note': 'immer der zuletzt veröffentlichte Wert',
  'workbench.docs.diagrams.variables.refs.live.bad1Text': '{{token}} — einfach',
  'workbench.docs.diagrams.variables.refs.live.bad1Reason':
    'live nimmt nie am einfachen Durchlauf teil — schreibe {{live.token}}',
  'workbench.docs.diagrams.variables.refs.live.bad2Text': 'ein eingefügtes Token in einer Umgebungsvariable',
  'workbench.docs.diagrams.variables.refs.live.bad2Reason': 'läuft still ab — hinterlege stattdessen einen Workflow',
  'workbench.docs.diagrams.variables.refs.live.footer1': 'Workflow bearbeitet? Der Wert zeigt sich veraltet —',
  'workbench.docs.diagrams.variables.refs.live.footer2': 'erst der nächste erfolgreiche Lauf veröffentlicht ihn neu.',

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
    'keine echte Subdomain — kein Punkt vor „openheaders.com“',
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
  'workbench.docs.diagrams.conditions.initiatorDomains.ruleBanner': 'Initiator-Domains: portal.openheaders.com',
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
  'workbench.docs.diagrams.conditions.urlPattern.footerExample': 'Anfrage-Domains: openheaders.com',

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

  // ── Open Headers: shared ────────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.shared.openHeaders': 'Open Headers',
  'workbench.docs.diagrams.openHeaders.shared.stampBestInClass': 'KLASSENBESTER',
  'workbench.docs.diagrams.openHeaders.shared.badgeToday': 'HEUTE',
  'workbench.docs.diagrams.openHeaders.shared.badgeRoadmap': 'ROADMAP',
  'workbench.docs.diagrams.openHeaders.shared.supports': 'UNTERSTÜTZT',
  'workbench.docs.diagrams.openHeaders.shared.inBrowser': 'Im Browser',
  'workbench.docs.diagrams.openHeaders.shared.desktopApp': 'Desktop-App',
  'workbench.docs.diagrams.openHeaders.shared.localServer': 'Lokaler Server',
  'workbench.docs.diagrams.openHeaders.shared.yourVm': 'Deine VM',
  'workbench.docs.diagrams.openHeaders.shared.workbench': 'Workbench',
  'workbench.docs.diagrams.openHeaders.shared.devtools': 'DevTools',
  'workbench.docs.diagrams.openHeaders.shared.soon': 'bald',

  // ── Open Headers: paradigm shift ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.shift.aria':
    'Der Paradigmenwechsel — gruppierte Kontraste zwischen Open Headers und jedem anderen Tool im Feld. Alles in ' +
    'einer Browser-Erweiterung, kein Konto, nur lokal, kein Tracking, eine Engine für neun Regeltypen, ' +
    'feldgenauer Sync, eine vollwertige Gratis-Stufe ohne Feature-Gates, Preise pro Sitz und keine Aussperrung ' +
    'bei Zahlungsausfall — gegen den Rest des Markts.',
  'workbench.docs.diagrams.openHeaders.shift.title': 'DER PARADIGMENWECHSEL',
  'workbench.docs.diagrams.openHeaders.shift.everyoneElse': 'Alle anderen',
  'workbench.docs.diagrams.openHeaders.shift.groupArchitecture': 'Architektur & Reichweite',
  'workbench.docs.diagrams.openHeaders.shift.groupPrivacy': 'Privatsphäre & Eigentum',
  'workbench.docs.diagrams.openHeaders.shift.groupCapability': 'Fähigkeiten',
  'workbench.docs.diagrams.openHeaders.shift.groupSync': 'Sync & Resilienz',
  'workbench.docs.diagrams.openHeaders.shift.groupPricing': 'Preise & Vertrauen',
  'workbench.docs.diagrams.openHeaders.shift.stampUnique': 'EINZIGARTIG',
  'workbench.docs.diagrams.openHeaders.shift.stampUserControlled': 'DU ENTSCHEIDEST',
  'workbench.docs.diagrams.openHeaders.shift.stampNoGates': 'KEINE FEATURE-GATES',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserPrimary': 'Alles im Browser',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserSub': 'Back-End + Front-End',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserTag': '- in der Erweiterung',
  'workbench.docs.diagrams.openHeaders.shift.themBrowserPrimary': 'Back-End außerhalb des Browsers',
  'workbench.docs.diagrams.openHeaders.shift.themBrowserSub': 'Desktop-App / Cloud, Internet nötig',
  'workbench.docs.diagrams.openHeaders.shift.usSelfHostPrimary': 'Back-End selbst hosten',
  'workbench.docs.diagrams.openHeaders.shift.usSelfHostSub': 'Browser · Desktop-App · Server · VM',
  'workbench.docs.diagrams.openHeaders.shift.themSelfHostPrimary': 'Nur deren Cloud',
  'workbench.docs.diagrams.openHeaders.shift.themSelfHostSub': 'keine Wahl, wo deine Daten liegen',
  'workbench.docs.diagrams.openHeaders.shift.usOfflinePrimary': 'Front-End nativ offline',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineSub': 'Erweiterung · Desktop · CLI · Web',
  'workbench.docs.diagrams.openHeaders.shift.themOfflinePrimary': 'Front-End nur in der Cloud (online)',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineSub': 'braucht Internet für das Back-End',
  'workbench.docs.diagrams.openHeaders.shift.usAccountPrimary': 'Kein Konto',
  'workbench.docs.diagrams.openHeaders.shift.usAccountSub': 'kein Sign-in, keine Login-Wand',
  'workbench.docs.diagrams.openHeaders.shift.themAccountPrimary': 'Anmeldung erforderlich',
  'workbench.docs.diagrams.openHeaders.shift.themAccountSub': 'um deine eigenen Daten zu nutzen',
  'workbench.docs.diagrams.openHeaders.shift.usLocalPrimary': 'Nur lokal',
  'workbench.docs.diagrams.openHeaders.shift.usLocalSub': 'kein Cloud-Relay',
  'workbench.docs.diagrams.openHeaders.shift.themLocalPrimary': 'Über die Cloud geleitet',
  'workbench.docs.diagrams.openHeaders.shift.themLocalSub': 'dein Traffic läuft über sie',
  'workbench.docs.diagrams.openHeaders.shift.usTrackingPrimary': 'Kein Tracking',
  'workbench.docs.diagrams.openHeaders.shift.usTrackingSub': 'anonyme Zähler · ein Schalter',
  'workbench.docs.diagrams.openHeaders.shift.themTrackingPrimary': 'Tracking als Standard',
  'workbench.docs.diagrams.openHeaders.shift.themTrackingSub': 'Nutzungsdaten gehen nach Hause',
  'workbench.docs.diagrams.openHeaders.shift.usEnginePrimary': 'Regel-Engine',
  'workbench.docs.diagrams.openHeaders.shift.usEngineSub': 'Anfragen abfangen und ändern',
  'workbench.docs.diagrams.openHeaders.shift.themEnginePrimary': 'Keine Engine im Browser',
  'workbench.docs.diagrams.openHeaders.shift.themEngineSub': 'separater Proxy oder App nötig',
  'workbench.docs.diagrams.openHeaders.shift.usCatalogPrimary': 'API-Anfragenkatalog',
  'workbench.docs.diagrams.openHeaders.shift.usCatalogSub': 'HTTP, WS, GraphQL — alles im Browser',
  'workbench.docs.diagrams.openHeaders.shift.themCatalogPrimary': 'Anmeldung bei einer Plattform',
  'workbench.docs.diagrams.openHeaders.shift.themCatalogSub': 'und Installation ihrer App',
  'workbench.docs.diagrams.openHeaders.shift.usAutomatePrimary': 'Automatisiere deinen Workspace',
  'workbench.docs.diagrams.openHeaders.shift.usAutomateSub': 'dein KI-Agent, lokal oder remote',
  'workbench.docs.diagrams.openHeaders.shift.usAutomateTag': '- du entscheidest',
  'workbench.docs.diagrams.openHeaders.shift.themAutomatePrimary': 'Privat oder nur deren Cloud-KI',
  'workbench.docs.diagrams.openHeaders.shift.themAutomateSub': 'kein offener oder programmatischer Zugriff',
  'workbench.docs.diagrams.openHeaders.shift.usSyncPrimary': 'Echtzeit-Sync-Engine',
  'workbench.docs.diagrams.openHeaders.shift.usSyncSub': 'über Geräte, Browser, Oberflächen',
  'workbench.docs.diagrams.openHeaders.shift.themSyncPrimary': 'Last-write-wins',
  'workbench.docs.diagrams.openHeaders.shift.themSyncSub': 'oder gar kein Sync',
  'workbench.docs.diagrams.openHeaders.shift.usSavePrimary': 'Konfliktfreies paralleles Speichern',
  'workbench.docs.diagrams.openHeaders.shift.usSaveSub': 'feldgenau, alle Änderungen bleiben',
  'workbench.docs.diagrams.openHeaders.shift.themSavePrimary': 'Überschreiben auf Entitätsebene',
  'workbench.docs.diagrams.openHeaders.shift.themSaveSub': 'Speichern löscht sich gegenseitig',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineEditPrimary': 'Offline voll editierbar',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineEditSub': 'synct automatisch, sobald du zurück bist',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineEditPrimary': 'Braucht Online-Verbindung',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineEditSub': 'oder gar keinen Zugriff',
  'workbench.docs.diagrams.openHeaders.shift.usTierPrimary': 'Alles ab heute, auf jeder Stufe',
  'workbench.docs.diagrams.openHeaders.shift.usTierSub': 'gratis ≤ 6 Nutzer · bezahlt = Team-Sitze',
  'workbench.docs.diagrams.openHeaders.shift.themTierPrimary': 'Stufen mit Feature-Gates',
  'workbench.docs.diagrams.openHeaders.shift.themTierSub': 'Kernfunktionen hinter Upsells',
  'workbench.docs.diagrams.openHeaders.shift.usSsoPrimary': 'SSO & Sicherheit immer gratis',
  'workbench.docs.diagrams.openHeaders.shift.usSsoSub': 'SSO/OIDC · RBAC · Audit · SIEM',
  'workbench.docs.diagrams.openHeaders.shift.themSsoPrimary': 'Die SSO-Steuer',
  'workbench.docs.diagrams.openHeaders.shift.themSsoSub': 'Sicherheit als Enterprise-Zusatz verkauft',
  'workbench.docs.diagrams.openHeaders.shift.usLapsePrimary': 'Ein Zahlungsausfall sperrt dich nie aus',
  'workbench.docs.diagrams.openHeaders.shift.usLapseSub': 'Kulanz, dann Gratis-Stufe — Daten bleiben deine',
  'workbench.docs.diagrams.openHeaders.shift.themLapsePrimary': 'Zahlung stoppen, Zugriff verlieren',
  'workbench.docs.diagrams.openHeaders.shift.themLapseSub': 'Paywall über deinen eigenen Daten',
  'workbench.docs.diagrams.openHeaders.shift.footer': 'Local-first. Von Anfang an. Kein Nachgedanke.',

  // ── Open Headers: API catalog ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.apiCatalog.aria':
    'API-Anfragenkatalog — stilisiertes Mockup eines Anfrage-Editors mit Methodenwähler, URL-Leiste, Tab-Leiste ' +
    'und Body-Vorschau, plus einer Funktionsleiste über Protokolle, Auth, Scripts, Variablen, Dateien, ' +
    'Sammlungen und Cookies.',
  'workbench.docs.diagrams.openHeaders.apiCatalog.title': 'API-Anfragenkatalog',
  'workbench.docs.diagrams.openHeaders.apiCatalog.subtitle':
    'Anfragen bauen, senden und Sammlungen verwalten — in der Erweiterung.',
  'workbench.docs.diagrams.openHeaders.apiCatalog.send': 'Senden ▸',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabParams': 'Params',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabAuth': 'Autorisierung',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabHeaders': 'Header',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabBody': 'Body',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabScripts': 'Scripts',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabSettings': 'Einstellungen',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featAuth': 'Auth',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featAuthSub': 'OAuth 2.0 · Basic · Bearer · API-Schlüssel',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featScripts': 'Scripts',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featScriptsSub': 'Pre-Request + Post-Response',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featVariables': 'Variablen',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featVariablesSub': '5 Scopes · strukturierte Diagnosen',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featFiles': 'Dateien',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featFilesSub': 'multipart · {{file.X}}-Auflösung',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCollections': 'Sammlungen',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCollectionsSub': 'Ordner · Umgebungen · pro Anfrage',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCookies': 'Cookies',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCookiesSub': 'credentialsMode als Opt-in',
  'workbench.docs.diagrams.openHeaders.apiCatalog.kicker':
    'ALLES, WAS EIN DESKTOP-API-CLIENT KANN — IN DER ERWEITERUNG',
  'workbench.docs.diagrams.openHeaders.apiCatalog.footer': 'Eine vollständige API-Plattform — ohne die Plattform.',

  // ── Open Headers: rule engine ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.ruleEngine.aria':
    'Regel-Engine von Open Headers — zwei Ausführungspfade (DNR-nativ und Script-Interception), neun ' +
    'Regeltyp-Kategorien nach Engine gruppiert, plus die gemeinsame Bedingungssprache und die Kette der ' +
    'Variablen-Scopes, die jede Regel liest.',
  'workbench.docs.diagrams.openHeaders.ruleEngine.title': 'Regel-Engine',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subtitle': 'MV3-nativ · zwei Engines · neun Regelkategorien',
  'workbench.docs.diagrams.openHeaders.ruleEngine.headerDnr': 'DNR · nativ',
  'workbench.docs.diagrams.openHeaders.ruleEngine.headerScript': 'Script · Interception',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameHeaders': 'Header',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subHeaders': 'Überschreiben · Anfügen · Entfernen',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameBlock': 'Blockieren',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subBlock': 'auf Netzwerkebene abbrechen',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameRedirect': 'Umleiten',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subRedirect': 'statische URL oder Regex',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameQueryParams': 'Query-Params',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subQueryParams': 'hinzufügen · ersetzen · entfernen · alle entfernen',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameHeadersMerge': 'Header (Zusammenführen)',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subHeadersMerge': 'Werte verketten',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameInject': 'Injizieren',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subInject': 'JS oder CSS, zwei Zeitpunkte',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameDelay': 'Verzögerung',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subDelay': 'Navigation + fetch/XHR',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameRequestBody': 'Anfrage-Body',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subRequestBody': 'statisch · dynamisch · GraphQL-Filter',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameResponseBody': 'Antwort-Body',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subResponseBody': 'Body + Status + Header',
  'workbench.docs.diagrams.openHeaders.ruleEngine.captionDnr': 'fängt jede Browser-Anfrage',
  'workbench.docs.diagrams.openHeaders.ruleEngine.captionScript': 'fängt JS-initiierte fetch / XHR',
  'workbench.docs.diagrams.openHeaders.ruleEngine.conditionsKicker': 'EINE BEDINGUNGSSPRACHE',
  'workbench.docs.diagrams.openHeaders.ruleEngine.conditionsList':
    'Request Domains · URL Pattern · URL Regex · Methoden · Ressource · Initiator · Header · Domaintyp',
  'workbench.docs.diagrams.openHeaders.ruleEngine.scopesKicker': 'FÜNF VARIABLEN-SCOPES',
  'workbench.docs.diagrams.openHeaders.ruleEngine.footer':
    'Eine Engine. Zwei Ausführungspfade. Volle Bedingungs- und Variablensprache. In der Erweiterung.',

  // ── Open Headers: convergence ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.convergence.aria':
    'Drei alte Produktkategorien — Desktop-Proxys, Cloud-API-Plattformen, reine Header-Erweiterungen — laufen in ' +
    'einer einzigen Erweiterung von Open Headers zusammen. Ein stilisierter Chromium-Browser zeigt die geöffnete ' +
    'Workbench-Seite der Erweiterung, und jede Fähigkeit der drei Kategorien lebt in diesem einen Tab.',
  'workbench.docs.diagrams.openHeaders.convergence.title': 'Drei Tool-Kategorien. Eine Erweiterung.',
  'workbench.docs.diagrams.openHeaders.convergence.subtitle':
    'Was früher drei Installationen brauchte, lebt jetzt in einem Browser-Tab.',
  'workbench.docs.diagrams.openHeaders.convergence.legacyProxies': 'Desktop-Proxys',
  'workbench.docs.diagrams.openHeaders.convergence.legacyProxiesSub':
    'HTTP-Interception · CA-Zertifikat · eigenes Binary',
  'workbench.docs.diagrams.openHeaders.convergence.legacyPlatforms': 'API-Plattformen',
  'workbench.docs.diagrams.openHeaders.convergence.legacyPlatformsSub':
    'Anfragen + Sammlungen · Cloud-gehostet · Konto',
  'workbench.docs.diagrams.openHeaders.convergence.legacyExtensions': 'Header-Erweiterungen',
  'workbench.docs.diagrams.openHeaders.convergence.legacyExtensionsSub': 'ein Regeltyp · keine Scripts · keine Auth',
  'workbench.docs.diagrams.openHeaders.convergence.allInOneTab': '▼ ALLES OFFEN IN EINEM TAB',
  'workbench.docs.diagrams.openHeaders.convergence.tabTitle': '#1 Open Headers',
  'workbench.docs.diagrams.openHeaders.convergence.workbenchSurface': 'die Workbench-Oberfläche',
  'workbench.docs.diagrams.openHeaders.convergence.mv3Chip': 'MV3-nativ',
  'workbench.docs.diagrams.openHeaders.convergence.pillRuleEngine': 'Regel-Engine',
  'workbench.docs.diagrams.openHeaders.convergence.pillApiCatalog': 'API-Anfragenkatalog',
  'workbench.docs.diagrams.openHeaders.convergence.pillSync': 'Echtzeit-Sync-Engine',
  'workbench.docs.diagrams.openHeaders.convergence.pillSave': 'Konfliktfreies Speichern',
  'workbench.docs.diagrams.openHeaders.convergence.pillNoAccount': 'Kein Konto · kein Sign-in',
  'workbench.docs.diagrams.openHeaders.convergence.pillLocalOnly': 'Nur lokal · kein Cloud-Relay',
  'workbench.docs.diagrams.openHeaders.convergence.pillNoTracking': 'Kein Tracking · keine persönlichen Daten',
  'workbench.docs.diagrams.openHeaders.convergence.pillMultiSurface': 'UI für mehrere Oberflächen',
  'workbench.docs.diagrams.openHeaders.convergence.footerStrip':
    'Mehrere Oberflächen · Sync über Geräte · lokal per Design',
  'workbench.docs.diagrams.openHeaders.convergence.caption':
    'Blau = Fähigkeiten · Violett = Haltung · alle acht leben in einem Tab',

  // ── Open Headers: field sync ────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.fieldSync.aria':
    'Zwei Oberflächen bearbeiten dieselbe Regel gleichzeitig. DevTools fügt Header hinzu, ändert und entfernt ' +
    'sie; die Workbench bearbeitet drei andere Felder derselben Regel. Alle sechs Änderungen landen ohne Banner ' +
    'oder Überschreiben in der zusammengeführten Regel.',
  'workbench.docs.diagrams.openHeaders.fieldSync.title': 'Zwei Oberflächen, eine Regel, beide Änderungen landen',
  'workbench.docs.diagrams.openHeaders.fieldSync.subtitle':
    'Feldgenauer Sync — kein Banner, kein Überschreiben, nichts verloren',
  'workbench.docs.diagrams.openHeaders.fieldSync.surfaceA': 'Oberfläche A',
  'workbench.docs.diagrams.openHeaders.fieldSync.surfaceB': 'Oberfläche B',
  'workbench.docs.diagrams.openHeaders.fieldSync.editingHeaders': 'bearbeitet Header',
  'workbench.docs.diagrams.openHeaders.fieldSync.ruleX': 'Regel X',
  'workbench.docs.diagrams.openHeaders.fieldSync.headersTag': 'Header',
  'workbench.docs.diagrams.openHeaders.fieldSync.syncBand': 'SYNC-ENGINE · feldgenaues Zusammenführen',
  'workbench.docs.diagrams.openHeaders.fieldSync.mergedTag': 'zusammengeführter Stand · Header',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupAdded': 'Hinzugefügt',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupModified': 'Geändert',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupRemoved': 'Entfernt',
  'workbench.docs.diagrams.openHeaders.fieldSync.fromPrefix': '← von ',
  'workbench.docs.diagrams.openHeaders.fieldSync.verdict1':
    '✓ beide Änderungen übernommen — kein Banner, kein Konflikt',
  'workbench.docs.diagrams.openHeaders.fieldSync.verdict2':
    'Derselbe Pfad skaliert: heute Erweiterung → morgen Erweiterung + Desktop + CLI',

  // ── Open Headers: front-ends ────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.frontEnds.aria':
    'Wähle dein Front-End — wie du auf deine Daten zugreifst und sie verwaltest. Vier Formfaktoren übereinander: ' +
    'Browser-Erweiterung, Desktop-App, CLI-App und Web-App. Jede Karte listet die Oberflächen, die erreichbaren ' +
    'Back-Ends (der erste Chip ist der Standard) und die unterstützten Plattformen.',
  'workbench.docs.diagrams.openHeaders.frontEnds.title': 'Wähle dein Front-End — dein Zugang zu deinen Daten',
  'workbench.docs.diagrams.openHeaders.frontEnds.subtitle':
    'Gleiche Daten, jedes Front-End — nimm eins oder alle, jede Oberfläche bleibt synchron.',
  'workbench.docs.diagrams.openHeaders.frontEnds.titleExtension': 'Browser-Erweiterung',
  'workbench.docs.diagrams.openHeaders.frontEnds.subExtension': 'in einem Browser',
  'workbench.docs.diagrams.openHeaders.frontEnds.subDesktop': 'natives Fenster',
  'workbench.docs.diagrams.openHeaders.frontEnds.subCli': 'Kommandozeile',
  'workbench.docs.diagrams.openHeaders.frontEnds.titleWeb': 'Web-App',
  'workbench.docs.diagrams.openHeaders.frontEnds.subWeb': 'Browser-Tab',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfPopup': 'Popup',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfSidePanel': 'Seitenleiste',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfCommandLine': 'Kommandozeile',
  'workbench.docs.diagrams.openHeaders.frontEnds.chipEmbedded': 'Eingebettet',
  'workbench.docs.diagrams.openHeaders.frontEnds.sectSurfaces': 'OBERFLÄCHEN',
  'workbench.docs.diagrams.openHeaders.frontEnds.sectBackEnds': 'VERBINDET SICH MIT BACK-END',
  'workbench.docs.diagrams.openHeaders.frontEnds.strip1': 'EIN FRONT-END ODER ALLE — ES SIND DIESELBEN DATEN',
  'workbench.docs.diagrams.openHeaders.frontEnds.strip2':
    '✓ Erweiterung · ✓ Desktop · ✓ CLI · ✓ Web — alle lesen dieselben kanonischen Entitäten',
  'workbench.docs.diagrams.openHeaders.frontEnds.footer':
    'Gleiche Daten, egal auf welchem Weg — jede Oberfläche bleibt synchron.',

  // ── Open Headers: local-first ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.localFirst.aria':
    'Wähle dein Back-End — wo deine Daten leben. Vier Hosting-Optionen übereinander. Jede Stufe erbt alle ' +
    'Fähigkeiten der vorigen und fügt neue hinzu, hervorgehoben in einem grün gepunkteten Rechteck. Eine Spalte ' +
    'UNTERSTÜTZT listet Browser, Betriebssysteme und Clouds jeder Stufe. Alle vier Stufen sind nur lokal.',
  'workbench.docs.diagrams.openHeaders.localFirst.title': 'Wähle dein Back-End — wo deine Daten leben',
  'workbench.docs.diagrams.openHeaders.localFirst.subtitle':
    'Jede Stufe erbt von der vorigen — der grüne Kasten zeigt das Neue — rechts steht, wo sie läuft.',
  'workbench.docs.diagrams.openHeaders.localFirst.subBrowser': 'Service Worker der Erweiterung',
  'workbench.docs.diagrams.openHeaders.localFirst.subDesktop': 'eingebettetes Back-End',
  'workbench.docs.diagrams.openHeaders.localFirst.subServer': 'eigenständiger Prozess',
  'workbench.docs.diagrams.openHeaders.localFirst.subVm': 'hoste sie, wo du willst',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletZeroSetup': 'null Einrichtung',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletSingleDevice': 'ein Gerät',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletPerBrowser': 'Instanz pro Browser',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiSurface': 'paralleles Bearbeiten über Oberflächen',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiWindow': 'paralleles Bearbeiten über Fenster',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletLocalhostOnly': 'nur localhost',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiBrowser': 'Instanzen über mehrere Browser',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletPerApp': 'Instanz pro App',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletFilesystem': 'natives Dateisystem',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletYaml': 'YAML auf der Platte',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletGit': 'git-Integration (lokal/remote)',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMinimalSetup': 'minimale Einrichtung',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletLan': 'im LAN erreichbar',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiApp': 'Instanzen über mehrere Apps',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiDevice': 'mehrere Geräte',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletFrontEnds': 'Browser-Erw. · Desktop-App · CLI',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletStandardSetup': 'Standard-Einrichtung',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletWan': 'über WAN/Internet erreichbar',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletTeamReady': 'team-tauglich',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletSso': 'SSO-Auth',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletRbac': 'RBAC-Nutzerverwaltung',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletAudit': 'Audit-Logs & Berichte',
  'workbench.docs.diagrams.openHeaders.localFirst.platAllOs': 'Alle OS',
  'workbench.docs.diagrams.openHeaders.localFirst.platEmbedded': 'Embedded',
  'workbench.docs.diagrams.openHeaders.localFirst.platHyperscalers': 'Hyperscaler',
  'workbench.docs.diagrams.openHeaders.localFirst.platEuNative': 'EU-nativ',
  'workbench.docs.diagrams.openHeaders.localFirst.platOther': 'Sonstige',
  'workbench.docs.diagrams.openHeaders.localFirst.platEnterprise': 'Enterprise',
  'workbench.docs.diagrams.openHeaders.localFirst.itemMiniPc': 'Mini-PC',
  'workbench.docs.diagrams.openHeaders.localFirst.itemHomeServer': 'Heimserver',
  'workbench.docs.diagrams.openHeaders.localFirst.itemOldLaptop': 'Alter Laptop',
  'workbench.docs.diagrams.openHeaders.localFirst.itemYourCloud': 'Deine Cloud',
  'workbench.docs.diagrams.openHeaders.localFirst.itemOnPrem': 'On-Prem',
  'workbench.docs.diagrams.openHeaders.localFirst.inheritsFrom': 'ERBT VON {tier}',
  'workbench.docs.diagrams.openHeaders.localFirst.newInTier': '+ NEU IN DIESER STUFE',
  'workbench.docs.diagrams.openHeaders.localFirst.strip1': 'WAS AUCH IMMER DU WÄHLST — ES GEHÖRT DIR, END-TO-END',
  'workbench.docs.diagrams.openHeaders.localFirst.strip2':
    '✓ kein Konto · ✓ kein Cloud-Relay · ✓ kein Tracking · ✓ keine persönlichen Daten',
  'workbench.docs.diagrams.openHeaders.localFirst.footer':
    'Deine Daten, dein Back-End, deine Wahl — bei jedem Schritt.',

  // ── Open Headers: comparison matrix ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.matrix.aria':
    'Vier Kategorie-Karten, die SaaS-API-Plattformen, Desktop-Proxys und Nur-Header-Erweiterungen mit Open Headers ' +
    'vergleichen.',
  'workbench.docs.diagrams.openHeaders.matrix.title': 'WO OPEN HEADERS STEHT',
  'workbench.docs.diagrams.openHeaders.matrix.catSaas': 'SaaS-API-Plattformen',
  'workbench.docs.diagrams.openHeaders.matrix.catProxies': 'Desktop-Proxys',
  'workbench.docs.diagrams.openHeaders.matrix.catHeaderOnly': 'Nur-Header-Erweiterungen',
  'workbench.docs.diagrams.openHeaders.matrix.tagCloud': 'Cloud',
  'workbench.docs.diagrams.openHeaders.matrix.tagNative': 'nativ',
  'workbench.docs.diagrams.openHeaders.matrix.tagLite': 'leicht',
  'workbench.docs.diagrams.openHeaders.matrix.tagUs': 'wir',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasData': 'Deine Daten liegen auf deren Servern',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasAccount': 'Konto + Login erforderlich',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasFeatures': 'Breiter Funktionsumfang',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyBinary': 'Separates Binary installieren + starten',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyCert': 'CA-Zertifikat + Proxy-Config pro App',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyTraffic': 'Sieht jede Art von Traffic',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteNoSetup': 'Im Browser, kein Setup',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteOneRule': 'Ein Regeltyp — nur Header',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteNoScripts': 'Keine Scripts, kein Auth, keine Body-Edits',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsLocal': 'Im Browser · nur lokal · ohne Konto',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsNine': 'Neun Regeltypen · eine Bedingungssprache',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsScripts': 'Scripts + OAuth + Dateien in der Erweiterung',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsSurfaces': 'Vier Oberflächen teilen dieselben Daten',

  // ── Open Headers: vs cloud ──────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsCloud.aria':
    'Gegen Cloud-API-Plattformen. Cloud-Plattformen halten Zugangsdaten, Regeldefinitionen und Request-Logs auf ' +
    'einem Anbieter-Server. Open Headers hält alle drei auf deinem Gerät.',
  'workbench.docs.diagrams.openHeaders.vsCloud.title': 'Wo deine Daten landen',
  'workbench.docs.diagrams.openHeaders.vsCloud.subtitle':
    'Zugangsdaten, Regeldefinitionen, Request-Logs — lokal oder remote?',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowCredentials': 'Zugangsdaten',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowRules': 'Regeln',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowLogs': 'Logs',
  'workbench.docs.diagrams.openHeaders.vsCloud.onDevice': 'auf deinem Gerät',
  'workbench.docs.diagrams.openHeaders.vsCloud.onVendor': 'auf deren Server',
  'workbench.docs.diagrams.openHeaders.vsCloud.cloudPlatform': 'Cloud-API-Plattform',
  'workbench.docs.diagrams.openHeaders.vsCloud.you': 'du',
  'workbench.docs.diagrams.openHeaders.vsCloud.yourData': 'deine Daten',
  'workbench.docs.diagrams.openHeaders.vsCloud.cloud': 'Cloud',
  'workbench.docs.diagrams.openHeaders.vsCloud.yourDevice': 'dein Gerät',
  'workbench.docs.diagrams.openHeaders.vsCloud.deviceContents': 'Daten · Regeln · Logs',
  'workbench.docs.diagrams.openHeaders.vsCloud.allInOnePlace': 'alles an einem Ort',
  'workbench.docs.diagrams.openHeaders.vsCloud.verdict': 'Deine Daten verlassen nie deinen Rechner',

  // ── Open Headers: vs header-only ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.aria':
    'Gegen Nur-Header-Erweiterungen. Sie beherrschen einen einzigen Regeltyp. Open Headers beherrscht neun — ' +
    'Header, Blockieren, Umleiten, Query-Params, Header-Zusammenführung, Injizieren, Verzögerung, Anfrage-Body, ' +
    'Antwort-Body.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.title': 'Wie viele Regeltypen',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.subtitle':
    'Ein Tool, das eine Sache kann — oder ein Tool, das neun kann.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.headerOnlyExtension': 'Nur-Header-Erweiterung',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileHeaders': 'Header',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileHeadersSub': 'überschreiben',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileBlock': 'Blockieren',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileBlockSub': 'abbrechen',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileRedirect': 'Umleiten',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileRedirectSub': 'statisch / Regex',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileQuery': 'Query',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileQuerySub': 'ergänzen · löschen',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileMerge': 'Merge',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileMergeSub': 'Header ⊕',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileInject': 'Injizieren',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileInjectSub': 'JS / CSS',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileDelay': 'Verzögerung',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileDelaySub': 'Nav / fetch',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileReqBody': 'Req-Body',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileReqBodySub': 'statisch · dyn.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileResBody': 'Res-Body',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileResBodySub': 'Body / Status',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.captionLeft': 'Die anderen 8? — noch eine Erweiterung installieren',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.captionRight':
    'Gleiche Bedingungen, gleiche Oberfläche, ein Workspace',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.verdict':
    'Neun Regeltypen, eine Bedingungssprache, eine beobachtbare Oberfläche',

  // ── Open Headers: vs proxy ──────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsProxy.aria':
    'Gegen Desktop-Proxys. Proxys leiten Traffic durch einen separaten Prozess hinter einem CA-Zertifikat. ' +
    'Open Headers wendet Regeln inline über die nativen Browser-APIs an — kein Proxy-Port, kein Zertifikat.',
  'workbench.docs.diagrams.openHeaders.vsProxy.title': 'Wie Requests geformt werden',
  'workbench.docs.diagrams.openHeaders.vsProxy.subtitle':
    'Inline-Regeln im Browser — kein Proxy-Port, kein CA-Zertifikat, keine Config pro App.',
  'workbench.docs.diagrams.openHeaders.vsProxy.desktopProxy': 'Desktop-Proxy',
  'workbench.docs.diagrams.openHeaders.vsProxy.stampDetour': 'UMWEG',
  'workbench.docs.diagrams.openHeaders.vsProxy.stampInline': 'INLINE',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeApp': 'App',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeAppSub': 'konfiguriert',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodePortSub': 'Proxy-Port',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeProxy': 'Proxy',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeProxySub': 'CA-Zertifikat',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeInternet': 'Internet',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeBrowser': 'Browser',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallBinary': 'Binary nötig',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallCert': 'CA-Zertifikat nötig',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipPerApp': 'Config pro App',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallExtension': 'Erweiterung installieren',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipThatsIt': "das war's",
  'workbench.docs.diagrams.openHeaders.vsProxy.verdict':
    'Eine Installation · null Zertifikate · Regeln laufen mit den Rechten der Seite',

  // ── Open Headers: roadmap CLI ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapCli.aria':
    'Roadmap-Meilenstein — CLI. Ein Terminalfenster mit Beispielkommandos zum Auflisten von Regeln, Wechseln der ' +
    'Umgebung und Senden einer gespeicherten Anfrage — alle sprechen mit demselben Server wie die UI.',
  'workbench.docs.diagrams.openHeaders.roadmapCli.title': 'CLI · Headless-Scripting',
  'workbench.docs.diagrams.openHeaders.roadmapCli.subtitle':
    'Derselbe Server wie die UI — die Automatisierung bleibt synchron mit dem, was du siehst.',
  'workbench.docs.diagrams.openHeaders.roadmapCli.termTitle': 'oh · Terminal',
  'workbench.docs.diagrams.openHeaders.roadmapCli.comment': '# derselbe Server · derselbe Workspace wie die UI',
  'workbench.docs.diagrams.openHeaders.roadmapCli.verdict':
    'Auflisten · Umschalten · Senden · Diff — direkt aus der Shell',

  // ── Open Headers: roadmap daemon ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapServer.aria':
    'Roadmap-Meilenstein — lokaler / LAN-Server. Ein Server in der Mitte; Erweiterung, Desktop-App und CLI ' +
    'verbinden sich alle als Clients über dein LAN.',
  'workbench.docs.diagrams.openHeaders.roadmapServer.title': 'Lokaler / LAN-Server · ein Sync-Hub',
  'workbench.docs.diagrams.openHeaders.roadmapServer.subtitle':
    'Erweiterung · Desktop · CLI — alle Clients desselben Servers, alle in deinem Netz.',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackWorkspaces': 'Workspaces',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackRules': 'Regeln · vault',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackSync': 'Sync-Engine',
  'workbench.docs.diagrams.openHeaders.roadmapServer.lanReachable': 'im LAN erreichbar',
  'workbench.docs.diagrams.openHeaders.roadmapServer.clientExtension': 'Browser-Erw.',
  'workbench.docs.diagrams.openHeaders.roadmapServer.sideLaptop': 'Laptop',
  'workbench.docs.diagrams.openHeaders.roadmapServer.sideWorkstation': 'Workstation',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfExtension': 'Popup · Workbench · DevTools',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfDesktop': 'Workbench · Mehrfenster',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfCli': 'jede Maschine · $ oh rules · $ oh env',
  'workbench.docs.diagrams.openHeaders.roadmapServer.verdict': 'Ein Server · viele Clients · bleibt in deinem Netz',

  // ── Open Headers: roadmap desktop app ───────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.aria':
    'Roadmap-Meilenstein — Desktop-App. Browser-Erweiterung und native Desktop-App zeigen beide die ' +
    'Workbench-Oberfläche über denselben Store auf der Festplatte. Die Desktop-App ergänzt Protokolle, die eine ' +
    'Browser-Erweiterung nicht nativ hosten kann: AI, MCP, gRPC, MQTT.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.title': 'Natives Fenster · derselbe Store · mehr Reichweite',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.subtitle':
    'Gleiche Workbench, gleicher Workspace — Desktop ergänzt Protokolle, die ein Browser nicht hosten kann.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.cardExtension': 'Browser-Erweiterung',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.tagToday': 'heute',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerSurface': 'OBERFLÄCHE',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerFeatures': 'FUNKTIONEN',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerApiCatalog': 'API-KATALOG',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featHttpRules': 'Interceptor',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featVariables': 'Variablen',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featWorkflows': 'Workflows',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featApiCatalog': 'API-Katalog',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.noteLocalRemote': 'lokal / remote',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.desktopOnly': '+ NUR DESKTOP',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.browserFeasible': 'Alle vier sind browser-tauglich.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.storePill': 'derselbe Workspace-Store auf der Festplatte',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.verdict':
    'Ein Workspace, zwei Front-Ends, mehr Reichweite, wo der Browser nicht hinkommt',

  // ── Open Headers: roadmap git workspaces ────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapGit.aria':
    'Roadmap-Meilenstein — Team-Workspaces über Git. Zwei Geräte halten je einen Workspace; beide pushen in ein ' +
    'gemeinsames Git-Repository und pullen daraus. Das Repo ist die Sync-Schicht; kein Anbieter-Server ' +
    'dazwischen.',
  'workbench.docs.diagrams.openHeaders.roadmapGit.title': 'Workspaces als Git-Repositorys',
  'workbench.docs.diagrams.openHeaders.roadmapGit.subtitle':
    'Pull synct · Push teilt · Merge über Git — kein Anbieter-Server.',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceA': 'Gerät A',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceB': 'Gerät B',
  'workbench.docs.diagrams.openHeaders.roadmapGit.workspace': 'Workspace',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceContents': 'Regeln · Umgebungen · vault',
  'workbench.docs.diagrams.openHeaders.roadmapGit.verdict': 'Deine Daten, dein Repo, deine prüfbare Historie',

  // ── Open Headers: roadmap importers ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapImporters.aria':
    'Importer. Sechs Quellformate münden in einen einzigen Workspace von Open Headers — cURL, HAR-Header, Postman, ' +
    'volle HAR-Requests, Insomnia, OpenAPI — alles heute schon da.',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.title': 'Importer · bring deine Sammlung mit',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.subtitle':
    'cURL, HAR, Postman, Insomnia, OpenAPI, volle HAR-Requests — alles heute schon da.',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcHarNote': 'Header',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcPostman': 'Sammlung aus Postman',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcHarFull': 'HAR (volle Requests)',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcInsomnia': 'Sammlung aus Insomnia',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcOpenApi': 'OpenAPI-Spec',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.tagToday': 'HEUTE',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.tagNext': 'BALD',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.sideWorkspace': 'Workspace',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.kickerImported': 'IMPORTIERT IN',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetRules': 'Interceptor',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetCollections': 'API-Anfragensammlungen',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetEnvironments': 'Umgebungen',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetVault': 'Vault-Einträge',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.verdict':
    'In einem Schritt rüberholen — einfach weiterarbeiten',

  // ── Open Headers: roadmap MCP architecture ──────────────────────────
  'workbench.docs.diagrams.openHeaders.mcpArch.aria':
    'Meilenstein der Roadmap — MCP-Server-Architektur. Ein KI-Client verbindet sich über das Model Context ' +
    'Protocol mit Open Headers (stdio lokal, HTTP/SSE remote). Der OH MCP Server ändert den Workspace; das ' +
    'Ergebnis erscheint im Workbench.',
  'workbench.docs.diagrams.openHeaders.mcpArch.title': 'MCP-Server · dein Workspace, jeder KI-Client',
  'workbench.docs.diagrams.openHeaders.mcpArch.subtitle':
    'Open Headers spricht Model Context Protocol — jeder MCP-fähige Agent kann deinen Workspace steuern.',
  'workbench.docs.diagrams.openHeaders.mcpArch.clientTitle': 'KI-Client',
  'workbench.docs.diagrams.openHeaders.mcpArch.clientSideTag': 'dein Agent',
  'workbench.docs.diagrams.openHeaders.mcpArch.kickerAnyClient': 'JEDER MCP-CLIENT',
  'workbench.docs.diagrams.openHeaders.mcpArch.serverTitle': 'OH MCP Server',
  'workbench.docs.diagrams.openHeaders.mcpArch.sideTagOpenHeaders': 'open headers',
  'workbench.docs.diagrams.openHeaders.mcpArch.kickerExposes': 'STELLT BEREIT',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeRules': 'Regeln · CRUD',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeRequests': 'API-Requests',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeEnvironments': 'Umgebungen',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeVariables': 'Variablen · Vault',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeWorkflows': 'Workflows',
  'workbench.docs.diagrams.openHeaders.mcpArch.transportLocal': 'lokal',
  'workbench.docs.diagrams.openHeaders.mcpArch.transportRemote': 'remote',
  'workbench.docs.diagrams.openHeaders.mcpArch.mutates': 'ändert',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbTitle': 'Workbench · dein Workspace',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbLive': 'live',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbContents': 'Regeln · Umgebungen · Variablen · Workflows · vault',
  'workbench.docs.diagrams.openHeaders.mcpArch.verdict':
    'Steuere deinen Workspace mit jedem KI-Agenten · lokal oder remote',

  // ── Open Headers: roadmap MCP tools ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.mcpTools.aria':
    'Meilenstein der Roadmap — Werkzeugkatalog des MCP-Servers. Sieben Domänen mit insgesamt {n} Tools: Regeln, ' +
    'Requests, Umgebungen, Variablen, Workflows, Workspaces, Aktivität.',
  'workbench.docs.diagrams.openHeaders.mcpTools.title': 'Was der KI-Agent tun kann',
  'workbench.docs.diagrams.openHeaders.mcpTools.subtitle':
    'Sieben Domänen — volles CRUD, wo es Sinn ergibt, gezielt read-only, wo nicht.',
  'workbench.docs.diagrams.openHeaders.mcpTools.domRules': 'Regeln',
  'workbench.docs.diagrams.openHeaders.mcpTools.subRules': 'Header · Blockieren · Umleiten · Resp.',
  'workbench.docs.diagrams.openHeaders.mcpTools.domRequests': 'Requests',
  'workbench.docs.diagrams.openHeaders.mcpTools.subRequests': 'API-Katalog',
  'workbench.docs.diagrams.openHeaders.mcpTools.domEnvironments': 'Umgebungen',
  'workbench.docs.diagrams.openHeaders.mcpTools.subEnvironments': 'pro Workspace',
  'workbench.docs.diagrams.openHeaders.mcpTools.domVariables': 'Variablen',
  'workbench.docs.diagrams.openHeaders.mcpTools.subVariables': 'alle Scopes · vault',
  'workbench.docs.diagrams.openHeaders.mcpTools.domWorkflows': 'Workflows',
  'workbench.docs.diagrams.openHeaders.mcpTools.subWorkflows': 'verkettete API-Aufrufe',
  'workbench.docs.diagrams.openHeaders.mcpTools.domWorkspaces': 'Workspaces',
  'workbench.docs.diagrams.openHeaders.mcpTools.subWorkspaces': 'Multi-Workspace',
  'workbench.docs.diagrams.openHeaders.mcpTools.toolsCount': '{n} TOOLS',
  'workbench.docs.diagrams.openHeaders.mcpTools.toolsCountOne': '1 TOOL',
  'workbench.docs.diagrams.openHeaders.mcpTools.activityTitle': 'Aktivität',
  'workbench.docs.diagrams.openHeaders.mcpTools.activityNote':
    'der Änderungs-Feed — ein Agent sieht vor dem Handeln, was sich geändert hat',
  'workbench.docs.diagrams.openHeaders.mcpTools.verdict':
    '{n} Tools · sieben Domänen · die volle Oberfläche von Open Headers',

  // ── Open Headers: roadmap milestones ────────────────────────────────
  'workbench.docs.diagrams.openHeaders.milestones.aria':
    'Meilensteine — geordnete Karten in einem Browserfenster: Git-Workspaces, Desktop-App, MCP-Server, lokaler ' +
    'Server, CLI, selbst gehostete Web-App, Importer — alle live.',
  'workbench.docs.diagrams.openHeaders.milestones.chromeTitle': 'Jede Oberfläche, ausgeliefert',
  'workbench.docs.diagrams.openHeaders.milestones.addrSubtitle':
    'In Reihenfolge ausgeliefert — nur-lokal blieb bei jedem Meilenstein das Produkt.',
  'workbench.docs.diagrams.openHeaders.milestones.tagLive': 'LIVE',
  'workbench.docs.diagrams.openHeaders.milestones.badgeUserControlled': 'DU ENTSCHEIDEST',
  'workbench.docs.diagrams.openHeaders.milestones.msGit': 'Workspace-Kollaboration via Git (teamfähig)',
  'workbench.docs.diagrams.openHeaders.milestones.descGit':
    'YAML in einem Git-Repo unter deiner Kontrolle — pull, push, merge via Git.',
  'workbench.docs.diagrams.openHeaders.milestones.descDesktop':
    'Natives Binary auf demselben Store — erreicht, was eine Erweiterung nicht kann.',
  'workbench.docs.diagrams.openHeaders.milestones.msMcp': 'MCP-Server (KI-Steuerung)',
  'workbench.docs.diagrams.openHeaders.milestones.descMcp':
    'Open Headers über MCP — lass einen KI-Agenten deinen Workspace steuern.',
  'workbench.docs.diagrams.openHeaders.milestones.msServer': 'Lokaler / LAN-Server',
  'workbench.docs.diagrams.openHeaders.milestones.descServer':
    'Server auf deinem Rechner oder im LAN — Erweiterung, Desktop, CLI als Clients.',
  'workbench.docs.diagrams.openHeaders.milestones.descCli':
    'Headless-Scripting und CI — listen, umschalten, senden aus der Shell.',
  'workbench.docs.diagrams.openHeaders.milestones.msVm': 'Selbst gehostetes VM-Deployment + Web-App',
  'workbench.docs.diagrams.openHeaders.milestones.descVm':
    'Web-Bundle auf deiner VM — abgeriegelte Browser oder gebrandete Deployments.',
  'workbench.docs.diagrams.openHeaders.milestones.msImporters': 'Mehr Importer',
  'workbench.docs.diagrams.openHeaders.milestones.descImporters':
    'Über Postman hinaus — Insomnia, OpenAPI-Spezifikationen, volle HAR-Importe.',
  'workbench.docs.diagrams.openHeaders.milestones.footer':
    'Sync zwischen Nutzern läuft über Git und selbst gehostete Deployments — keine vom Anbieter gehostete Cloud.',

  // ── Open Headers: roadmap web app ───────────────────────────────────
  'workbench.docs.diagrams.openHeaders.webApp.aria':
    'Meilenstein der Roadmap — selbst gehostete Web-App. Dein Origin liefert dasselbe UI-Bundle; Nutzer öffnen es ' +
    'als Browser-Tab auf einer Domain unter deiner Kontrolle. Dieselbe Workbench-Oberfläche, keine Erweiterung ' +
    'nötig.',
  'workbench.docs.diagrams.openHeaders.webApp.title': 'Selbst gehostetes VM-Deployment + Web-App',
  'workbench.docs.diagrams.openHeaders.webApp.subtitle':
    'Deine VM liefert das Web-Bundle — dein Origin, deine Domain, deine Nutzer.',
  'workbench.docs.diagrams.openHeaders.webApp.serves': 'liefert',
  'workbench.docs.diagrams.openHeaders.webApp.chromeTitle': 'Open Headers · web',
  'workbench.docs.diagrams.openHeaders.webApp.bodySub': 'gleiche Oberfläche wie Erweiterung + Desktop',
  'workbench.docs.diagrams.openHeaders.webApp.verdict': 'Gleiche UI · dein Origin · keine Erweiterung nötig',

  // ── Root shared — kickers recurring across root-level diagrams ──────
  'workbench.docs.diagrams.shared.ruleKicker': 'REGEL',
  'workbench.docs.diagrams.shared.useCasesKicker': 'HÄUFIGE ANWENDUNGSFÄLLE',
  'workbench.docs.diagrams.shared.wontFireKicker': 'WENN DIE REGEL NICHT GREIFT',
  'workbench.docs.diagrams.shared.suggestion': 'Vorschlag',
  'workbench.docs.diagrams.shared.beforeKicker': 'VORHER',
  'workbench.docs.diagrams.shared.afterKicker': 'NACHHER',

  // ── Block ───────────────────────────────────────────────────────────
  'workbench.docs.diagrams.block.aria':
    'Blockieren bricht passende Anfragen auf der Netzwerkebene ab — die Seite sieht einen Netzwerkfehler. Ein ' +
    'main_frame-Block zeigt ERR_BLOCKED_BY_CLIENT; ein Subressourcen-Block scheitert still.',
  'workbench.docs.diagrams.block.rule': 'Block · Request Domains: ads.openheaders.com',
  'workbench.docs.diagrams.block.pageTitle': 'Seite',
  'workbench.docs.diagrams.block.dnrBlock': 'DNR-Block',
  'workbench.docs.diagrams.block.network': 'Netzwerk',
  'workbench.docs.diagrams.block.neverReached': 'nie erreicht',
  'workbench.docs.diagrams.block.requestCancelled': 'Anfrage abgebrochen',
  'workbench.docs.diagrams.block.pageSeesKicker': 'WAS DIE SEITE SIEHT',
  'workbench.docs.diagrams.block.chromeBlockPage': 'Blockseite von Chrome',
  'workbench.docs.diagrams.block.silentFailure': 'Stilles Scheitern',
  'workbench.docs.diagrams.block.pageHandlesError': 'Seite behandelt den Fehler selbst',
  'workbench.docs.diagrams.block.useCasesAria':
    'Blockieren — häufige Anwendungsfälle: Werbung und Tracker, Ausfall-Simulation, Endpoint sperren und ' +
    'Nur-Seiten-Block.',
  'workbench.docs.diagrams.block.card1Title': 'Werbung & Tracker',
  'workbench.docs.diagrams.block.card1Example': 'ads.openheaders.com blockieren',
  'workbench.docs.diagrams.block.card2Title': 'Ausfall-Simulation',
  'workbench.docs.diagrams.block.card2Example': 'Host zum Testen offline nehmen',
  'workbench.docs.diagrams.block.card3Title': 'Endpoint sperren',
  'workbench.docs.diagrams.block.card3Example': 'Nur /api/admin blockieren',
  'workbench.docs.diagrams.block.card4Title': 'Nur-Seiten-Block',
  'workbench.docs.diagrams.block.card4Example': 'main_frame-Bedingung ergänzen',
  'workbench.docs.diagrams.block.useCasesFooter': 'Kombiniere Blockieren mit Bedingungen, um es einzugrenzen.',
  'workbench.docs.diagrams.block.wontApplyAria':
    'Blockieren bricht bereits geladene Ressourcen nicht rückwirkend ab. Lade die Seite nach dem Aktivieren ' +
    'der Regel neu, um künftige Anfragen zu erfassen.',
  'workbench.docs.diagrams.block.alreadyLoaded': 'Bereits geladene Ressourcen',
  'workbench.docs.diagrams.block.alreadyLoadedSub': 'Nur künftige Anfragen werden abgefangen — Geladenes bleibt.',
  'workbench.docs.diagrams.block.suggestionText': 'Lade die Seite nach dem Aktivieren der Regel neu.',

  // ── Redirect ────────────────────────────────────────────────────────
  'workbench.docs.diagrams.redirect.staticAria':
    'Statische Umleitung — jede passende Anfrage wird auf dieselbe Ziel-URL umgeschrieben.',
  'workbench.docs.diagrams.redirect.ruleStatic': 'Redirect → https://openheaders.com/new-page',
  'workbench.docs.diagrams.redirect.originalRequestKicker': 'URSPRÜNGLICHE ANFRAGE',
  'workbench.docs.diagrams.redirect.urlRewritten': 'URL umgeschrieben',
  'workbench.docs.diagrams.redirect.redirectedToKicker': 'UMGELEITET ZU',
  'workbench.docs.diagrams.redirect.staticStamp': 'Jeder Treffer → dieselbe Ziel-URL.',
  'workbench.docs.diagrams.redirect.staticStampSub':
    'Der Browser navigiert, als hätte der Server eine Umleitung geliefert.',
  'workbench.docs.diagrams.redirect.regexAria':
    'Regex-Umleitung — die Capture-Gruppen des URL-Musters werden als \\1, \\2 in der Ziel-URL referenziert.',
  'workbench.docs.diagrams.redirect.ruleRegexLine1': 'URL Regex: ^http://(openheaders\\.io/.*)$',
  'workbench.docs.diagrams.redirect.ruleRegexLine2': 'Redirect → https://\\1',
  'workbench.docs.diagrams.redirect.originalUrlKicker': 'URSPRÜNGLICHE URL',
  'workbench.docs.diagrams.redirect.captureChip': '\\1 = openheaders.com/page',
  'workbench.docs.diagrams.redirect.substituted': '\\1 ersetzt',
  'workbench.docs.diagrams.redirect.regexStamp': '\\1 erbt, was die Capture-Gruppe getroffen hat.',
  'workbench.docs.diagrams.redirect.useCasesAria':
    'Umleiten — häufige Anwendungsfälle: HTTP→HTTPS, Domain-Umzug, Pfad-Rewrite, lokaler Dev-Proxy.',
  'workbench.docs.diagrams.redirect.card1Example': 'http zu https erzwingen',
  'workbench.docs.diagrams.redirect.card2Title': 'Domain-Umzug',
  'workbench.docs.diagrams.redirect.card3Title': 'Pfad-Rewrite',
  'workbench.docs.diagrams.redirect.card4Title': 'Lokaler Dev-Proxy',
  'workbench.docs.diagrams.redirect.useCasesFooter': 'URL-Regex mit Backreferences erhält den Pfad beim Rewrite.',
  'workbench.docs.diagrams.redirect.wontApplyAria':
    'Umleiten wirkt nicht rückwirkend auf geladene Seiten, und Chrome deckelt Umleitungsschleifen.',
  'workbench.docs.diagrams.redirect.pageLoaded': 'Seite bereits geladen',
  'workbench.docs.diagrams.redirect.pageLoadedSub': 'Nur künftige Navigationen und Fetches werden abgefangen.',
  'workbench.docs.diagrams.redirect.loops': 'Umleitungsschleifen',
  'workbench.docs.diagrams.redirect.loopsSub': 'Chrome deckelt sie — ERR_TOO_MANY_REDIRECTS.',
  'workbench.docs.diagrams.redirect.suggestionText': 'Neu laden. Bedingungen dürfen keine Schleife bilden.',

  // ── Inject JS / CSS ─────────────────────────────────────────────────
  'workbench.docs.diagrams.inject.timingAria':
    'Injektions-Timing — So früh wie möglich läuft vor den Seiten-Scripts; Nach dem Laden, sobald das DOM ' +
    'geparst ist.',
  'workbench.docs.diagrams.inject.timeAxis': 'Zeit →',
  'workbench.docs.diagrams.inject.navigation': 'Navigation',
  'workbench.docs.diagrams.inject.domParsed': 'DOM geparst',
  'workbench.docs.diagrams.inject.loadEvent': 'load-Event',
  'workbench.docs.diagrams.inject.asap': 'So früh wie möglich',
  'workbench.docs.diagrams.inject.prePageScript': 'vor den Scripts',
  'workbench.docs.diagrams.inject.afterLoad': 'Nach dem Laden',
  'workbench.docs.diagrams.inject.domSafe': 'DOM-sicher',
  'workbench.docs.diagrams.inject.timingFooter': 'So früh wie möglich für Races · Nach dem Laden fürs DOM',
  'workbench.docs.diagrams.inject.scriptAria':
    'Script-Injektion — das JavaScript läuft in der Seite, entweder So früh wie möglich (vor den Scripts) ' +
    'oder Nach dem Laden (DOM-sicher).',
  'workbench.docs.diagrams.inject.ruleScript': 'Script (ASAP): jeden fetch-Aufruf loggen',
  'workbench.docs.diagrams.inject.injectedComment': '<script> // von der Erweiterung injiziert',
  'workbench.docs.diagrams.inject.runsInPage': 'Läuft im Seitenkontext — dieselben Globals wie das Seiten-JS.',
  'workbench.docs.diagrams.inject.scriptFooter':
    'So früh wie möglich schlägt den App-Code; Nach dem Laden liest das DOM.',
  'workbench.docs.diagrams.inject.cssAria':
    'CSS-Injektion — ein <style>-Tag wird in den head der Seite eingehängt und blendet das Banner aus.',
  'workbench.docs.diagrams.inject.ruleCss': 'CSS: header.banner { display: none }',
  'workbench.docs.diagrams.inject.ruleApplied1': 'Regel',
  'workbench.docs.diagrams.inject.ruleApplied2': 'wirkt',
  'workbench.docs.diagrams.inject.hidden': '(verborgen)',
  'workbench.docs.diagrams.inject.cssFooter': 'Als <style>-Tag injiziert — gleiche CSS-Spezifität wie Seiten-CSS.',
  'workbench.docs.diagrams.inject.wontApplyAria':
    'Injektion wirkt nicht in Sandbox-Iframes oder auf Seiten, deren strikte CSP Inline-Scripts blockiert.',
  'workbench.docs.diagrams.inject.sandboxed': 'Sandbox-Iframes',
  'workbench.docs.diagrams.inject.sandboxedSub': 'Seiten mit sandbox="", das Scripts deaktiviert.',
  'workbench.docs.diagrams.inject.strictCsp': "Strikte CSP (script-src 'self')",
  'workbench.docs.diagrams.inject.strictCspSub': 'Inline injizierte Scripts blockiert die Seiten-Policy.',
  'workbench.docs.diagrams.inject.suggestionText': 'In die Elternseite injizieren; per postMessage ins Iframe.',
  'workbench.docs.diagrams.inject.useCasesAria':
    'JS / CSS injizieren — häufige Anwendungsfälle: Monkey-Patching, Dark Mode, Elemente ausblenden, ' +
    'Feature-Flags.',
  'workbench.docs.diagrams.inject.card1Title': 'Monkey-Patch',
  'workbench.docs.diagrams.inject.card1Example': 'fetch / XHR wrappen (ASAP)',
  'workbench.docs.diagrams.inject.card2Title': 'Dark Mode',
  'workbench.docs.diagrams.inject.card2Example': 'Ein CSS-Theme erzwingen',
  'workbench.docs.diagrams.inject.card3Title': 'Rauschen ausblenden',
  'workbench.docs.diagrams.inject.card3Example': 'Banner per display: none',
  'workbench.docs.diagrams.inject.card4Title': 'Feature-Flags',
  'workbench.docs.diagrams.inject.card4Example': 'window-Flags früh setzen',
  'workbench.docs.diagrams.inject.useCasesFooter': 'Erst-Code: So früh wie möglich · DOM-Lesen: Nach dem Laden.',

  // ── Delay ───────────────────────────────────────────────────────────
  'workbench.docs.diagrams.delay.routingAria':
    'Delay-Routing über Navigation, fetch und Subressourcen — nur die ersten beiden Spuren werden ' +
    'abgefangen, Subressourcen laufen durch.',
  'workbench.docs.diagrams.delay.matchedRequest': 'Passende Anfrage',
  'workbench.docs.diagrams.delay.document': 'Dokument',
  'workbench.docs.diagrams.delay.documentSub': 'iframe-Nav',
  'workbench.docs.diagrams.delay.navCap': '≤ 30,000 ms',
  'workbench.docs.diagrams.delay.viaWaitingPage': 'über Warteseite',
  'workbench.docs.diagrams.delay.fetchXhr': 'Fetch / XHR',
  'workbench.docs.diagrams.delay.jsInitiated': 'JS-initiiert',
  'workbench.docs.diagrams.delay.xhrCap': '≤ 5,000 ms',
  'workbench.docs.diagrams.delay.monkeyPatched': 'monkey-gepatcht',
  'workbench.docs.diagrams.delay.subResource': 'Subressource',
  'workbench.docs.diagrams.delay.subResourceSub': 'img / css / js',
  'workbench.docs.diagrams.delay.notDelayed': 'nicht verzögert',
  'workbench.docs.diagrams.delay.passesThrough': 'läuft durch',
  'workbench.docs.diagrams.delay.routingFooter': 'Höhere Limits brauchen einen echten lokalen Proxy',
  'workbench.docs.diagrams.delay.navAria':
    'Navigations-Delay — der Browser wird auf eine lokale Warteseite umgeleitet, die N ms hält, bevor sie ' +
    'zur echten Ziel-URL weiterleitet.',
  'workbench.docs.diagrams.delay.ruleNav': 'Delay 8,000 ms · Seiten-Navigation',
  'workbench.docs.diagrams.delay.click': 'Klick',
  'workbench.docs.diagrams.delay.waitingPage': 'Warteseite',
  'workbench.docs.diagrams.delay.holds8s': '⏱ hält 8 s',
  'workbench.docs.diagrams.delay.loadsNow': 'lädt jetzt',
  'workbench.docs.diagrams.delay.navStamp': 'Bis 30,000 ms eingehalten — die Redirect-Obergrenze von Chrome.',
  'workbench.docs.diagrams.delay.navStampSub': 'Umgesetzt als DNR-Redirect auf eine lokale Warteseite.',
  'workbench.docs.diagrams.delay.xhrAria':
    'Delay für JS-initiierte fetch/XHR — ein monkey-gepatchtes setTimeout hält die Auflösung. Limit: 5000 ms.',
  'workbench.docs.diagrams.delay.ruleXhr': 'Delay 3,000 ms · JS fetch / XHR',
  'workbench.docs.diagrams.delay.intercept': 'Abfangen',
  'workbench.docs.diagrams.delay.network': 'Netzwerk',
  'workbench.docs.diagrams.delay.hold3000': '3,000 ms halten',
  'workbench.docs.diagrams.delay.realRequest': 'echte Anfrage',
  'workbench.docs.diagrams.delay.responseDelayed': 'Antwort (3 s verzögert)',
  'workbench.docs.diagrams.delay.xhrStamp': 'Limit 5,000 ms — höhere Werte werden auf dem Draht gekappt.',
  'workbench.docs.diagrams.delay.wontApplyAria':
    'Delay gilt nicht für Subressourcen (img/css/js) oder Service-Worker-Fetches, die den Seiten-Patch ' + 'umgehen.',
  'workbench.docs.diagrams.delay.subResources': 'Subressourcen (img, css, js, fonts)',
  'workbench.docs.diagrams.delay.subResourcesSub': 'Der Browser lädt sie selbst — kein Monkey-Patch hält sie.',
  'workbench.docs.diagrams.delay.swFetches': 'Service-Worker-Fetches',
  'workbench.docs.diagrams.delay.swFetchesSub': 'Laufen in anderem Scope; Seiten-Patches erreichen sie nicht.',
  'workbench.docs.diagrams.delay.suggestionText': 'Subressourcen-Drosselung kommt bald mit der Desktop-App.',
  'workbench.docs.diagrams.delay.useCasesAria':
    'Delay — häufige Anwendungsfälle: Ladezustands-QA, Debounce-Tests, Races sichtbar machen, langsames ' +
    'Netz simulieren.',
  'workbench.docs.diagrams.delay.card1Title': 'Ladezustände',
  'workbench.docs.diagrams.delay.card1Example': 'Spinner zuverlässig sehen',
  'workbench.docs.diagrams.delay.card2Title': 'Debounce-Tests',
  'workbench.docs.diagrams.delay.card2Example': 'Tipp-Drosselung testen',
  'workbench.docs.diagrams.delay.card3Title': 'Race Conditions',
  'workbench.docs.diagrams.delay.card3Example': 'Anfrage-Reihenfolge zeigen',
  'workbench.docs.diagrams.delay.card4Title': 'Langsames Netz',
  'workbench.docs.diagrams.delay.card4Example': 'Ungefähre 3G-Latenz',
  'workbench.docs.diagrams.delay.useCasesFooter':
    'Statische Ressourcen brauchen einen echten Proxy, keine Erweiterung.',

  // ── Query Params ────────────────────────────────────────────────────
  'workbench.docs.diagrams.queryParams.ruleAdd': 'Add / Replace · debug = true',
  'workbench.docs.diagrams.queryParams.addArrow': 'Parameter ergänzt oder überschrieben',
  'workbench.docs.diagrams.queryParams.addStamp': 'Ergänzt, wenn er fehlt; überschreibt, wenn er da ist.',
  'workbench.docs.diagrams.queryParams.replaceOnlyAria':
    'Nur überschreiben — ersetzt den Wert vorhandener Query-Parameter, lässt URLs ohne den Parameter aber ' +
    'unangetastet.',
  'workbench.docs.diagrams.queryParams.ruleReplaceOnly': 'Replace only · region = eu',
  'workbench.docs.diagrams.queryParams.present': 'Vorhanden',
  'workbench.docs.diagrams.queryParams.presentSub': 'Parameter schon da',
  'workbench.docs.diagrams.queryParams.absent': 'Fehlt',
  'workbench.docs.diagrams.queryParams.absentSub': 'kein region-Parameter',
  'workbench.docs.diagrams.queryParams.valueReplaced': 'Wert überschrieben',
  'workbench.docs.diagrams.queryParams.unchanged': 'unverändert',
  'workbench.docs.diagrams.queryParams.replaceOnlyStamp':
    'Überschreibt, ergänzt nie — URLs ohne den Parameter laufen durch.',
  'workbench.docs.diagrams.queryParams.ruleRemove': 'Remove · utm_source',
  'workbench.docs.diagrams.queryParams.removeArrow': 'Parameter entfernt',
  'workbench.docs.diagrams.queryParams.removeStamp': 'Der benannte Parameter fliegt raus; alles andere läuft durch.',
  'workbench.docs.diagrams.queryParams.ruleRemoveAll': 'Remove All',
  'workbench.docs.diagrams.queryParams.noQueryString': '(kein Query-String)',
  'workbench.docs.diagrams.queryParams.removeAllArrow': 'ganzer Query-String entfernt',
  'workbench.docs.diagrams.queryParams.removeAllStamp': 'Der ganze Query-String verschwindet in einem Schritt.',
  'workbench.docs.diagrams.queryParams.wontApplyAria':
    'Stolperfalle bei Query-Parametern — Alle entfernen lässt sich nicht mit Hinzufügen / Überschreiben in ' +
    'derselben Regel kombinieren.',
  'workbench.docs.diagrams.queryParams.watchForKicker': 'WORAUF DU ACHTEN SOLLTEST',
  'workbench.docs.diagrams.queryParams.combining': 'Alle entfernen mit Hinzufügen / Überschreiben kombinieren',
  'workbench.docs.diagrams.queryParams.combiningSub':
    'DNR lehnt Regeln ab, die die Query leeren und neue Parameter ergänzen.',
  'workbench.docs.diagrams.queryParams.suggestionText':
    'Nimm zwei Regeln — erst Alle entfernen, dann Hinzufügen / Überschreiben.',
  'workbench.docs.diagrams.queryParams.suggestionSub':
    'Die Regel-Reihenfolge zählt; beide müssen dieselbe Anfrage treffen.',
  'workbench.docs.diagrams.queryParams.useCasesAria':
    'Query-Parameter — häufige Anwendungsfälle: Flag erzwingen, Wert kanonisieren, Tracker entfernen, alles ' +
    'entfernen im Privatmodus.',
  'workbench.docs.diagrams.queryParams.card1Title': 'Flag erzwingen',
  'workbench.docs.diagrams.queryParams.card1Example': 'debug=true ergänzen',
  'workbench.docs.diagrams.queryParams.card2Title': 'Kanonisieren',
  'workbench.docs.diagrams.queryParams.card2Example': 'Nur region überschreiben',
  'workbench.docs.diagrams.queryParams.card3Title': 'Tracker entfernen',
  'workbench.docs.diagrams.queryParams.card3Example': 'utm_*-Parameter entfernen',
  'workbench.docs.diagrams.queryParams.card4Title': 'Privatmodus',
  'workbench.docs.diagrams.queryParams.card4Example': 'Query-String ganz leeren',
  'workbench.docs.diagrams.queryParams.useCasesFooter':
    'Kombiniere URL-Muster oder Domains, um gezielte Routen zu treffen.',

  // ── Request Body ────────────────────────────────────────────────────
  'workbench.docs.diagrams.requestBody.interceptAria':
    'Interception-Pipeline für den Request-Body — der Aufruf aus page.js landet in der Interception der ' +
    'Script-Engine, verzweigt in die Transformationen Statisch / Dynamisch / GraphQL und geht dann ins echte Netz.',
  'workbench.docs.diagrams.requestBody.pageSub': 'fetch / XHR-Aufruf',
  'workbench.docs.diagrams.requestBody.intercept': 'Interception',
  'workbench.docs.diagrams.requestBody.interceptSub': 'Monkey-Patch der Erweiterung',
  'workbench.docs.diagrams.requestBody.branchStatic': 'Statisch',
  'workbench.docs.diagrams.requestBody.branchStaticSub1': 'ersetzt den Body',
  'workbench.docs.diagrams.requestBody.branchStaticSub2': 'komplett',
  'workbench.docs.diagrams.requestBody.branchDynamic': 'Dynamisch',
  'workbench.docs.diagrams.requestBody.branchDynamicSub1': 'fn(orig) →',
  'workbench.docs.diagrams.requestBody.branchDynamicSub2': 'geänderter Body',
  'workbench.docs.diagrams.requestBody.branchGraphqlSub1': 'Op passt? →',
  'workbench.docs.diagrams.requestBody.branchGraphqlSub2': 'anwenden : überspringen',
  'workbench.docs.diagrams.requestBody.realNetwork': 'echtes Netz',
  'workbench.docs.diagrams.requestBody.originalBodyKicker': 'ORIGINAL-BODY',
  'workbench.docs.diagrams.requestBody.bodySentKicker': 'GESENDETER BODY',
  'workbench.docs.diagrams.requestBody.ruleStatic': 'Static body: { "userId": "test-1" }',
  'workbench.docs.diagrams.requestBody.staticArrow': 'Body komplett ausgetauscht',
  'workbench.docs.diagrams.requestBody.staticStamp': 'Ganzer Body ersetzt; die Regel schaut das Original nie an.',
  'workbench.docs.diagrams.requestBody.ruleDynamic': 'Dynamic body: fn(orig) → gestempelt',
  'workbench.docs.diagrams.requestBody.fnReads': '→ fn liest und schreibt um',
  'workbench.docs.diagrams.requestBody.dynamicArrow': 'Funktion transformiert',
  'workbench.docs.diagrams.requestBody.dynamicStamp': 'Die Funktion bekommt das Original und liefert den neuen Body.',
  'workbench.docs.diagrams.requestBody.graphqlAria':
    'GraphQL-Filter — die Regel greift nur, wenn das benannte Feld im JSON-Body passt. Andere Operationen ' +
    'laufen unangetastet durch.',
  'workbench.docs.diagrams.requestBody.ruleGraphql': 'GraphQL: operationName Equals "GetUser"',
  'workbench.docs.diagrams.requestBody.ruleGraphqlAction': '→ statische Body-Substitution',
  'workbench.docs.diagrams.requestBody.match': 'Treffer',
  'workbench.docs.diagrams.requestBody.noMatch': 'Kein Treffer',
  'workbench.docs.diagrams.requestBody.noMatchSub': 'jede andere Operation',
  'workbench.docs.diagrams.requestBody.ruleFires': 'Regel greift',
  'workbench.docs.diagrams.requestBody.passesThrough': 'läuft durch',
  'workbench.docs.diagrams.requestBody.graphqlStamp': 'Filter auf Feldebene — nur passende Ops greifen.',
  'workbench.docs.diagrams.requestBody.graphqlStampSub':
    'Fehlende Felder oder Nicht-JSON-Bodys überspringen die Regel.',
  'workbench.docs.diagrams.requestBody.wontApplyAria':
    'Body-Regeln greifen nur bei JS-initiierten fetch/XHR mit Body. GET- und HEAD-Anfragen haben nichts zu ' +
    'ersetzen; statische Ressourcen erreichen die Script-Interception nie.',
  'workbench.docs.diagrams.requestBody.getHead': 'GET / HEAD-Anfragen',
  'workbench.docs.diagrams.requestBody.getHeadSub': 'Laut Spec kein Body — nichts zu ersetzen.',
  'workbench.docs.diagrams.requestBody.staticResources': 'Statische Ressourcen (img, script, link)',
  'workbench.docs.diagrams.requestBody.staticResourcesSub': 'Vom Browser ausgelöst — berühren fetch / XHR nie.',
  'workbench.docs.diagrams.requestBody.suggestionText':
    'Prüfe, ob die Anfrage ein POST/PUT/PATCH aus dem Seiten-JS ist.',
  'workbench.docs.diagrams.requestBody.useCasesAria':
    'Request-Body — häufige Anwendungsfälle: Test-Fixtures, Metadaten stempeln, eine GraphQL-Operation ' +
    'mocken, PII anonymisieren.',
  'workbench.docs.diagrams.requestBody.card1Title': 'Test-Fixtures',
  'workbench.docs.diagrams.requestBody.card1Example': 'Bekannten Payload erzwingen',
  'workbench.docs.diagrams.requestBody.card2Title': 'Metadaten stempeln',
  'workbench.docs.diagrams.requestBody.card2Example': 'debug: true ergänzen',
  'workbench.docs.diagrams.requestBody.card3Title': 'GraphQL-Ops',
  'workbench.docs.diagrams.requestBody.card3Example': 'Einen operationName mocken',
  'workbench.docs.diagrams.requestBody.card4Title': 'Replays formen',
  'workbench.docs.diagrams.requestBody.card4Example': 'PII-Felder anonymisieren',
  'workbench.docs.diagrams.requestBody.useCasesFooter': 'Nur Script-Engine — gilt für JS-initiierte fetch / XHR.',

  // ── Sequence primitives ─────────────────────────────────────────────
  'workbench.docs.diagrams.sequence.later': 'später',

  // ── Debug mode ──────────────────────────────────────────────────────
  'workbench.docs.diagrams.debugMode.surfaceAria':
    'Der Debug-Modus wohnt in der Fußzeile — ein Inline-Schalter schaltet ihn um; Punkt und Label öffnen ' +
    'ein Popover mit Scope, Pro-Tab-Pin und der Liste angehängter Tabs.',
  'workbench.docs.diagrams.debugMode.surfaceTitle': 'Der Debug-Modus wohnt in der Fußzeile',
  'workbench.docs.diagrams.debugMode.surfaceCaption': 'Der Schalter schaltet um · Punkt + Label öffnen das Popover.',
  'workbench.docs.diagrams.debugMode.debugMode': 'Debug-Modus',
  'workbench.docs.diagrams.debugMode.systemStatus': 'Systemstatus',
  'workbench.docs.diagrams.debugMode.inspectLabel': 'Inspizieren',
  'workbench.docs.diagrams.debugMode.scopeBoth': 'Beide ▾',
  'workbench.docs.diagrams.debugMode.includeThisTab': 'Diesen Tab einbeziehen',
  'workbench.docs.diagrams.debugMode.attachedTabs': 'Angehängte Tabs (1)',
  'workbench.docs.diagrams.debugMode.tabRow': 'Tab #11 · example.com',
  'workbench.docs.diagrams.debugMode.scopeAria':
    'Die angehängte Menge wird abgeleitet: der gewählte Scope vereint mit gepinnten Tabs, geschnitten mit ' +
    'dem Hauptschalter. Ist der Debug-Modus aus, hängt sich nichts an.',
  'workbench.docs.diagrams.debugMode.scopeTitle': 'Was angehängt wird',
  'workbench.docs.diagrams.debugMode.scopeFormula': '( Scope ∪ Pins ) ∩ Hauptschalter',
  'workbench.docs.diagrams.debugMode.inspectBoth': 'Inspizieren: Beide',
  'workbench.docs.diagrams.debugMode.devtoolsUnion': 'DevTools ∪ fokussierter Tab',
  'workbench.docs.diagrams.debugMode.pinnedTab': 'Gepinnt: Tab #11',
  'workbench.docs.diagrams.debugMode.candidates': 'Kandidaten',
  'workbench.docs.diagrams.debugMode.gateLabel': '∩ Debug AN',
  'workbench.docs.diagrams.debugMode.attached': 'Angehängt',
  'workbench.docs.diagrams.debugMode.attachedTab1': 'Tab #7',
  'workbench.docs.diagrams.debugMode.attachedTab2': 'Tab #11',
  'workbench.docs.diagrams.debugMode.scopeFooter1': 'Debug AUS → nichts hängt sich an, egal welcher Scope.',
  'workbench.docs.diagrams.debugMode.scopeFooter2':
    'Re-Attach spielt von hier ab — nie ein gespeicherter Schnappschuss.',
  'workbench.docs.diagrams.debugMode.reachAria':
    'Der Standardmodus erreicht nur fetch und XHR der Seite. Ein angehängter Debug-Tab erreicht zusätzlich ' +
    'Navigationen, Worker, Cross-Origin-Iframes und die Tab-Umgebung.',
  'workbench.docs.diagrams.debugMode.reachTitle': 'Was jeder Modus anfassen kann',
  'workbench.docs.diagrams.debugMode.standardMode': 'Standardmodus',
  'workbench.docs.diagrams.debugMode.rowFetch': 'Seiten-fetch / XHR',
  'workbench.docs.diagrams.debugMode.rowNavigations': 'Navigationen',
  'workbench.docs.diagrams.debugMode.rowWorkers': 'Worker',
  'workbench.docs.diagrams.debugMode.rowIframes': 'Cross-Origin-Iframes',
  'workbench.docs.diagrams.debugMode.rowTabEnv': 'Tab-Umgebung',
  'workbench.docs.diagrams.debugMode.bannerFree': 'ohne Banner',
  'workbench.docs.diagrams.debugMode.showsBanner': 'zeigt das Banner',
  'workbench.docs.diagrams.debugMode.statesAria':
    'Der Punkt hat vier Zustände: grau aus, grün an und angehängt, gelb auf Heuristik zurückgefallen nach ' +
    'weggeklicktem Banner, rot wenn ein Tab sich nicht anhängen konnte.',
  'workbench.docs.diagrams.debugMode.statesTitle': 'Der Punkt auf einen Blick',
  'workbench.docs.diagrams.debugMode.stateOff': 'Aus',
  'workbench.docs.diagrams.debugMode.stateOffMsg': 'Debug-Modus deaktiviert',
  'workbench.docs.diagrams.debugMode.stateOn': 'An · 2 Tabs',
  'workbench.docs.diagrams.debugMode.stateOnMsg': 'angehängt & gesund',
  'workbench.docs.diagrams.debugMode.stateFellBack': 'Zurückgefallen',
  'workbench.docs.diagrams.debugMode.stateFellBackMsg': 'Banner weggeklickt → Heuristik',
  'workbench.docs.diagrams.debugMode.stateFailed': 'Attach fehlgeschlagen',
  'workbench.docs.diagrams.debugMode.stateFailedMsg': 'Protokoll ließ sich nicht aktivieren',

  // ── Request Tracking ────────────────────────────────────────────────
  'workbench.docs.diagrams.requestTracking.phasesAria':
    'Zwei Phasen jeder Verbindung — Anfrage und Antwort — jede mit eigenen erfassten Feldern.',
  'workbench.docs.diagrams.requestTracking.phasesTitle': 'Jede Verbindung hat zwei Phasen',
  'workbench.docs.diagrams.requestTracking.phaseRequest': 'ANFRAGE',
  'workbench.docs.diagrams.requestTracking.phaseRequestDir': 'Seite → Netz',
  'workbench.docs.diagrams.requestTracking.outbound': 'ausgehend',
  'workbench.docs.diagrams.requestTracking.capMethod': 'Methode',
  'workbench.docs.diagrams.requestTracking.capHeaders': 'Header',
  'workbench.docs.diagrams.requestTracking.capBody': 'Body',
  'workbench.docs.diagrams.requestTracking.phaseResponse': 'ANTWORT',
  'workbench.docs.diagrams.requestTracking.phaseResponseDir': 'Netz → Seite',
  'workbench.docs.diagrams.requestTracking.inbound': 'eingehend',
  'workbench.docs.diagrams.requestTracking.capStatus': 'Statuscode',
  'workbench.docs.diagrams.requestTracking.capTimings': 'Timings',
  'workbench.docs.diagrams.requestTracking.perRoundtrip': 'pro HTTP-Roundtrip',
  'workbench.docs.diagrams.requestTracking.capturedKicker': 'ERFASST',
  'workbench.docs.diagrams.requestTracking.sameConnection': 'gleiche Verbindung',
  'workbench.docs.diagrams.requestTracking.phasesFooter': 'Beide Phasen speisen den Badge-Zähler in Diese Seite.',
  'workbench.docs.diagrams.requestTracking.seqAria':
    'Sequenzdiagramm: Anfrage beobachtet, gematcht, aufgezeichnet, dann vom Popup gelesen',
  'workbench.docs.diagrams.requestTracking.pBrowser': 'Browser',
  'workbench.docs.diagrams.requestTracking.pBrowserSub': 'Netzwerk-Stack',
  'workbench.docs.diagrams.requestTracking.pExtension': 'Erweiterung',
  'workbench.docs.diagrams.requestTracking.pExtensionSub': 'Service Worker',
  'workbench.docs.diagrams.requestTracking.pPopup': 'Popup',
  'workbench.docs.diagrams.requestTracking.pPopupSub': 'Tab „Diese Seite“',
  'workbench.docs.diagrams.requestTracking.msgRequest': 'webRequest (Anfrage)',
  'workbench.docs.diagrams.requestTracking.noteMatch': 'gegen Regeln matchen',
  'workbench.docs.diagrams.requestTracking.noteRecord1': 'aufzeichnen (Regel + URL +',
  'workbench.docs.diagrams.requestTracking.noteRecord2': 'Ressourcentyp)',
  'workbench.docs.diagrams.requestTracking.msgResponse': 'webRequest (Antwort)',
  'workbench.docs.diagrams.requestTracking.noteResponse': 'Antwortphase aufzeichnen',
  'workbench.docs.diagrams.requestTracking.msgOpenPopup': 'Nutzer öffnet das Popup',
  'workbench.docs.diagrams.requestTracking.msgReadBack': 'gematchte Regeln + Badges',
  'workbench.docs.diagrams.requestTracking.seqFooter': 'Aufgezeichnet wird live; das Popup liest es nur zurück.',
  'workbench.docs.diagrams.requestTracking.uiAria':
    'UI-Anatomie — das eingeklappte Badge klappt zur Liste gematchter Anfragen auf',
  'workbench.docs.diagrams.requestTracking.uiTitle': 'Regelzeile im Popup',
  'workbench.docs.diagrams.requestTracking.uiRule': 'Block ads.openheaders.com',
  'workbench.docs.diagrams.requestTracking.clickBadge': 'Badge anklicken',
  'workbench.docs.diagrams.requestTracking.matchedPattern': 'gematcht: ads.openheaders.com',
  'workbench.docs.diagrams.requestTracking.legendFields': 'Zeitstempel · URL · Ressourcentyp · gematchtes Muster',
  'workbench.docs.diagrams.requestTracking.legendBadge': 'Badge-Zähler = Anzahl der Zeilen',

  // ── Resource Types ──────────────────────────────────────────────────
  'workbench.docs.diagrams.resourceTypes.anatomyAria':
    'Anatomie der Ressourcentypen — ein stilisiertes Seiten-Mockup mit Hinweisen auf jeden ResourceType ' +
    'von Chrome: Page, Frame, Script, CSS, Image, Font, Media, Fetch/XHR, WebSocket, Ping, Other.',
  'workbench.docs.diagrams.resourceTypes.anatomyTitle': 'Jede Anfrageart entspricht genau einem ResourceType',
  'workbench.docs.diagrams.resourceTypes.otherExamples': 'favicon, manifest, …',
  'workbench.docs.diagrams.resourceTypes.legendKicker': 'LEGENDE',
  'workbench.docs.diagrams.resourceTypes.footer': 'Zuordnung 1:1 — keine Überschneidung zwischen den Zeilen.',

  // ── Limitations ─────────────────────────────────────────────────────
  'workbench.docs.diagrams.limitations.overviewAria':
    'Häufige Einschränkungen — DevTools zeigt geänderte Header nicht; die Script-Engine sieht nur ' +
    'fetch/XHR; Zusammenführen sieht nur Header der Seite; Header-Abgleich braucht Chrome 128+.',
  'workbench.docs.diagrams.limitations.gotchasKicker': 'HÄUFIGE STOLPERFALLEN',
  'workbench.docs.diagrams.limitations.devtoolsTitle': 'DevTools blind',
  'workbench.docs.diagrams.limitations.devtoolsLine1': 'Der Netzwerk-Tab zeigt',
  'workbench.docs.diagrams.limitations.devtoolsLine2': 'die Original-Header.',
  'workbench.docs.diagrams.limitations.scriptTitle': 'Script-Reichweite',
  'workbench.docs.diagrams.limitations.scriptLine1': 'Nur fetch / XHR —',
  'workbench.docs.diagrams.limitations.scriptLine2': 'keine Nav, keine Statik.',
  'workbench.docs.diagrams.limitations.mergeTitle': 'Zusammenführen',
  'workbench.docs.diagrams.limitations.mergeLine1': 'Sieht nur Header,',
  'workbench.docs.diagrams.limitations.mergeLine2': 'die die Seite setzt.',
  'workbench.docs.diagrams.limitations.chromeTitle': 'Chrome 128+',
  'workbench.docs.diagrams.limitations.chromeLine1': 'Ältere Browser',
  'workbench.docs.diagrams.limitations.chromeLine2': 'ohne Header-Abgleich.',
  'workbench.docs.diagrams.limitations.seeCallout': 'Siehe Hinweis unten.',
  'workbench.docs.diagrams.limitations.footer': 'Jede Stolperfalle steht auch direkt im betroffenen Abschnitt.',

  // ── How rules execute ───────────────────────────────────────────────
  'workbench.docs.diagrams.execution.stackAria':
    'Wo jede Engine den Anfragefluss abfängt — JS läuft durch Script und dann DNR; Statisches und ' +
    'Navigation überspringen Script',
  'workbench.docs.diagrams.execution.stackTitle': 'Wo jede Engine abfängt',
  'workbench.docs.diagrams.execution.stackJsLane': 'JS-initiiert',
  'workbench.docs.diagrams.execution.stackStaticLane': 'Statisch / Navigation',
  'workbench.docs.diagrams.execution.stackPageJs': 'Seiten-JS',
  'workbench.docs.diagrams.execution.stackPageJsSub': 'fetch / XHR',
  'workbench.docs.diagrams.execution.stackBrowser': 'Browser',
  'workbench.docs.diagrams.execution.stackBrowserSub': '<img>, Nav usw.',
  'workbench.docs.diagrams.execution.stackScriptEngine': 'Script-Engine',
  'workbench.docs.diagrams.execution.stackScriptEngineSub': 'Monkey-Patch',
  'workbench.docs.diagrams.execution.stackBypasses1': 'umgeht die',
  'workbench.docs.diagrams.execution.stackBypasses2': 'Script-Engine',
  'workbench.docs.diagrams.execution.stackDnrEngine': 'DNR-Engine',
  'workbench.docs.diagrams.execution.stackDnrEngineSub': 'Netz von Chrome — fängt alles',
  'workbench.docs.diagrams.execution.stackNetwork': 'Netzwerk',
  'workbench.docs.diagrams.execution.stackFooter': 'DNR ist breit; Script ist schmal, liest aber Antwort-Bodys.',
  'workbench.docs.diagrams.execution.dnrAria':
    'Die breite Reichweite von DNR — jeder Ressourcentyp, den der Browser lädt, wird abgefangen',
  'workbench.docs.diagrams.execution.dnrTitle': 'DNR fängt jede Art von Anfrage',
  'workbench.docs.diagrams.execution.dnrItemNav': 'Seitennavigation',
  'workbench.docs.diagrams.execution.dnrItemSubFrame': 'Sub-Frame',
  'workbench.docs.diagrams.execution.dnrItemFetch': 'fetch / XHR',
  'workbench.docs.diagrams.execution.dnrItemScripts': 'Scripts',
  'workbench.docs.diagrams.execution.dnrItemStylesheets': 'Stylesheets',
  'workbench.docs.diagrams.execution.dnrItemImages': 'Bilder',
  'workbench.docs.diagrams.execution.dnrItemFonts': 'Schriften',
  'workbench.docs.diagrams.execution.dnrItemMedia': 'Medien',
  'workbench.docs.diagrams.execution.dnrItemWebsocket': 'websocket',
  'workbench.docs.diagrams.execution.dnrItemPing': 'ping / beacon',
  'workbench.docs.diagrams.execution.dnrFooter': 'jeder Ressourcentyp, den der Browser lädt',
  'workbench.docs.diagrams.execution.reachAria':
    'Reichweite der Script-Engine — was sie fängt und was an ihr vorbeiläuft',
  'workbench.docs.diagrams.execution.reachTitle': 'Was die Script-Engine wirklich sieht',
  'workbench.docs.diagrams.execution.reachCaught': '✓ gefangen',
  'workbench.docs.diagrams.execution.reachCaughtSub': 'die Engine sieht diese',
  'workbench.docs.diagrams.execution.reachFetch': 'fetch()',
  'workbench.docs.diagrams.execution.reachXhr': 'XMLHttpRequest',
  'workbench.docs.diagrams.execution.reachSwFetch': 'SW fetch',
  'workbench.docs.diagrams.execution.reachInScope': '(im Geltungsbereich)',
  'workbench.docs.diagrams.execution.reachMissed': '✗ verpasst',
  'workbench.docs.diagrams.execution.reachMissedSub': 'läuft ganz vorbei',
  'workbench.docs.diagrams.execution.reachImgSrc': '<img src>',
  'workbench.docs.diagrams.execution.reachScriptSrc': '<script src>',
  'workbench.docs.diagrams.execution.reachPageNav': 'Seitennavigation',
  'workbench.docs.diagrams.execution.reachBrowserInternal': 'Browser-intern',
  'workbench.docs.diagrams.execution.reachFaviconEtc': '(favicon usw.)',

  // ── Direct vs Indirect ──────────────────────────────────────────────
  'workbench.docs.diagrams.directVsIndirect.aria': 'Direkte vs. indirekte Treffer — gleiche Regel, zwei Seitenkontexte',
  'workbench.docs.diagrams.directVsIndirect.ruleLabel': 'Regel',
  'workbench.docs.diagrams.directVsIndirect.ruleBanner': 'Request Domains: openheaders.com',
  'workbench.docs.diagrams.directVsIndirect.directTitle': 'Direkt',
  'workbench.docs.diagrams.directVsIndirect.directSub': 'die Seiten-URL selbst trifft',
  'workbench.docs.diagrams.directVsIndirect.pageLabel': 'Seite',
  'workbench.docs.diagrams.directVsIndirect.directCaption1': 'Seite + Sub-Ressourcen',
  'workbench.docs.diagrams.directVsIndirect.directCaption2': 'desselben Hosts erfasst',
  'workbench.docs.diagrams.directVsIndirect.badgePrefix': 'Badge:',
  'workbench.docs.diagrams.directVsIndirect.badgeDirect': 'direct',
  'workbench.docs.diagrams.directVsIndirect.badgeIndirect': 'indirect',
  'workbench.docs.diagrams.directVsIndirect.indirectTitle': 'Indirekt',
  'workbench.docs.diagrams.directVsIndirect.indirectSub': 'nur eine Sub-Ressource trifft',
  'workbench.docs.diagrams.directVsIndirect.indirectCaption1': 'Nur die treffende',
  'workbench.docs.diagrams.directVsIndirect.indirectCaption2': 'Sub-Ressource erfasst',
  'workbench.docs.diagrams.directVsIndirect.legendMatches': 'trifft die Regel',
  'workbench.docs.diagrams.directVsIndirect.legendNoMatch': 'trifft nicht',

  // ── Response Body + Status (Mock) ───────────────────────────────────
  'workbench.docs.diagrams.mock.flowAria':
    'Statisch überspringt das Netz komplett; Dynamisch trifft es zuerst und transformiert dann die echte Antwort.',
  'workbench.docs.diagrams.mock.flowStatic': 'Statisch',
  'workbench.docs.diagrams.mock.flowDynamic': 'Dynamisch',
  'workbench.docs.diagrams.mock.flowIntercept': 'Abfangen',
  'workbench.docs.diagrams.mock.flowNeverHit1': '(echtes Netz',
  'workbench.docs.diagrams.mock.flowNeverHit2': 'nie berührt)',
  'workbench.docs.diagrams.mock.flowRealNetwork': 'echtes Netz',
  'workbench.docs.diagrams.mock.flowRealNetworkSub': 'echte Antwort',
  'workbench.docs.diagrams.mock.flowSynthetic': 'synthetischer Body',
  'workbench.docs.diagrams.mock.flowFnResponse': 'fn(response)',
  'workbench.docs.diagrams.mock.flowPageReceives': 'Seite empfängt',
  'workbench.docs.diagrams.mock.staticRule': 'Static response: 200 { "users": [] }',
  'workbench.docs.diagrams.mock.staticBeforeKicker': 'ECHTES NETZ',
  'workbench.docs.diagrams.mock.staticNever1': '(nie erreicht)',
  'workbench.docs.diagrams.mock.staticNever2': '— Anfrage kurzgeschlossen',
  'workbench.docs.diagrams.mock.pageReceivesKicker': 'SEITE EMPFÄNGT',
  'workbench.docs.diagrams.mock.staticAfterLine1': '200 OK · Content-Type: application/json',
  'workbench.docs.diagrams.mock.staticAfterBody': '{ "users": [] }',
  'workbench.docs.diagrams.mock.staticArrow': 'synthetische Antwort geliefert',
  'workbench.docs.diagrams.mock.staticStamp': 'Fester Body + Status + Header — der Server wird nie kontaktiert.',
  'workbench.docs.diagrams.mock.dynamicRule': 'Dynamic response: PII-Felder schwärzen',
  'workbench.docs.diagrams.mock.dynamicBeforeKicker': 'ECHTE ANTWORT',
  'workbench.docs.diagrams.mock.dynBodyOpen': '{ "user":',
  'workbench.docs.diagrams.mock.dynBodyEmail': '  { "email": "alice@openheaders.com" } }',
  'workbench.docs.diagrams.mock.dynAfterPrefix': '  { "email": ',
  'workbench.docs.diagrams.mock.dynRedacted': '"[geschwärzt]"',
  'workbench.docs.diagrams.mock.dynamicArrow': 'fn(real response) →',
  'workbench.docs.diagrams.mock.dynamicStamp':
    'Der echte Aufruf passiert trotzdem; deine Funktion schreibt den Body um.',
  'workbench.docs.diagrams.mock.wontAria':
    'Mocks fangen nur JS-initiierte fetch / XHR ab — statische Ressourcen fließen unverändert durch. ' +
    'Nutze für Sub-Ressourcen-Fixtures einen echten lokalen Proxy.',
  'workbench.docs.diagrams.mock.wontStatic': 'Statische Ressourcen (img, script, link)',
  'workbench.docs.diagrams.mock.wontStaticSub': 'Vom Browser ausgelöst — berühren fetch / XHR nie.',
  'workbench.docs.diagrams.mock.wontNav': 'Seitennavigationen',
  'workbench.docs.diagrams.mock.wontNavSub': 'Top-Level-HTML-Loads umgehen die Script-Engine komplett.',
  'workbench.docs.diagrams.mock.suggestionText': 'Echten lokalen Proxy für Sub-Ressourcen-Fixtures nutzen.',
  'workbench.docs.diagrams.mock.useCasesAria':
    'Antwort-Body + Status — häufige Anwendungsfälle: Offline-Dev, Fehlersimulation, PII-Schwärzung, ' +
    'Payload-Grenzfälle.',
  'workbench.docs.diagrams.mock.caseOffline': 'Offline-Dev',
  'workbench.docs.diagrams.mock.caseOfflineEx': 'Die ganze API stubben',
  'workbench.docs.diagrams.mock.caseError': 'Fehlersimulation',
  'workbench.docs.diagrams.mock.caseErrorEx': 'Eine Route auf 500 zwingen',
  'workbench.docs.diagrams.mock.casePii': 'PII-Schwärzung',
  'workbench.docs.diagrams.mock.casePiiEx': 'E-Mails unterwegs maskieren',
  'workbench.docs.diagrams.mock.caseEdge': 'Grenzfälle',
  'workbench.docs.diagrams.mock.caseEdgeEx': 'Leere Arrays, XXL-Payloads',
  'workbench.docs.diagrams.mock.useCasesFooter': 'Statisch = Fixture-Modus · Dynamisch = echter Aufruf + Edit.',

  // ── Keyboard Shortcuts ──────────────────────────────────────────────
  'workbench.docs.diagrams.keyboardShortcuts.aria':
    'Fokus-Regionen der Workbench — linke Seitenleiste, Editor, rechte Seitenleiste und unteres Panel — ' +
    'jede trägt ihre Fokus-Tastenfolge.',
  'workbench.docs.diagrams.keyboardShortcuts.title': 'Fokus-Tastenfolgen bringen dich in eine von vier Regionen',
  'workbench.docs.diagrams.keyboardShortcuts.windowTitle': 'Open Headers — Workbench',
  'workbench.docs.diagrams.keyboardShortcuts.leftSidebar': 'Linke Leiste',
  'workbench.docs.diagrams.keyboardShortcuts.editor': 'Editor',
  'workbench.docs.diagrams.keyboardShortcuts.rightSidebar': 'Rechte Leiste',
  'workbench.docs.diagrams.keyboardShortcuts.bottomPanel': 'Unteres Panel',
  'workbench.docs.diagrams.keyboardShortcuts.footer': 'Belege jede Tastenfolge neu unter Einstellungen → Tastatur.',

  // ── Wire mirrors (whole-raw copies of en) ───────────────────────────
  'workbench.docs.diagrams.block.wireFetch': 'fetch()',
  'workbench.docs.diagrams.delay.wireFetch': 'fetch()',
  'workbench.docs.diagrams.delay.wireSetTimeout': 'setTimeout',
  'workbench.docs.diagrams.inject.wireDoctype': '<!doctype html>',
  'workbench.docs.diagrams.inject.wireHookLine': 'const _f = window.fetch;',
  'workbench.docs.diagrams.inject.wireBodyOpen': '<body>',
  'workbench.docs.diagrams.inject.wireScriptSrc': '<script src="app.js"></script>',
  'workbench.docs.diagrams.limitations.wireFn': 'fn',
  'workbench.docs.diagrams.multiTab.sync.wireStagingEnv': 'staging',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wirePush': 'push',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wirePull': 'pull',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wireRepoName': '⎇ workspace.git',
  'workbench.docs.diagrams.openHeaders.mcpArch.wireStdio': 'stdio',
  'workbench.docs.diagrams.openHeaders.mcpArch.wireHttpSse': 'HTTP / SSE',
  'workbench.docs.diagrams.openHeaders.mcpTools.wireList': 'list',
  'workbench.docs.diagrams.queryParams.wirePage': '?page=1',
  'workbench.docs.diagrams.queryParams.wireDebugParam': '&debug=true',
  'workbench.docs.diagrams.queryParams.wireAmpPage': '&page=1',
  'workbench.docs.diagrams.requestBody.wirePostSave': 'POST /api/save  body:',
  'workbench.docs.diagrams.requestBody.wireBodyAbc': '{ "userId": "abc" }',
  'workbench.docs.diagrams.requestBody.wireBodyTest': '{ "userId": "test-1" }',
  'workbench.docs.diagrams.requestBody.wireBodyAbcOpen': '{ "userId": "abc", ',
  'workbench.docs.diagrams.requestBody.wireDebugTrue': '"debug": true',
  'workbench.docs.diagrams.requestBody.wireOpEquals': 'operationName = GetUser',
  'workbench.docs.diagrams.requestBody.wireGetUser': '  "GetUser", ...',
  'workbench.docs.diagrams.requestBody.wireListPosts': '  "ListPosts", ...',
  'workbench.docs.diagrams.requestTracking.wireTagXhr': 'xhr',
  'workbench.docs.diagrams.requestTracking.wireTagImage': 'image',
  'workbench.docs.diagrams.requestTracking.wireTagPing': 'ping',
  'workbench.docs.diagrams.resourceTypes.wireAa': 'Aa',
  'workbench.docs.diagrams.resourceTypes.wireScriptTag': '<script>',
  'workbench.docs.diagrams.resourceTypes.wireLinkCss': '<link css>',
  'workbench.docs.diagrams.resourceTypes.wireImgTag': '<img>',
  'workbench.docs.diagrams.resourceTypes.wireVideoTag': '<video>',
  'workbench.docs.diagrams.resourceTypes.wireIframeTag': '<iframe>',
  'workbench.docs.diagrams.resourceTypes.wireNewWebSocket': "new WebSocket('wss://…')",
  'workbench.docs.diagrams.systemStatus.permissionsAudit.wireOrigins': "{ origins: ['<all_urls>'] }",
  'workbench.docs.diagrams.systemStatus.vaultHydration.wireId': '<id>',
} as const satisfies Catalog;
