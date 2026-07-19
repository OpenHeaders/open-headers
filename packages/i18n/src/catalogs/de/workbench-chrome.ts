/**
 * Workbench chrome — the shell plane — German. Mirrors
 * `catalogs/en/workbench-chrome.ts` key for key; extends the de
 * register contract (`de/shared.ts`). Reuses the shipped de mints:
 * Seitenleiste / Unteres Panel / Werkzeugfenster / Aktivitätsleiste /
 * Befehlspalette / Tastenkürzel, the layout-menu wording quoted
 * verbatim from the shipped `de/panel.ts` twin (`Werkzeugfenster-Namen
 * anzeigen`, `Kompakt (unten fixiert)`, neuter {unit} per the panel
 * precedent), rule-type verbs from the shipped `popup.ruleType.*` set
 * (Blockieren / Umleiten / Query-Parameter / Injizieren /
 * Verzögerung), der Body (panel-inspector), Geltungsbereich (variable
 * scope) vs Reichweite (debug reach) two-word law, „Keine Umgebung“
 * runtime quote (S57). MINTS: scratch = Skizzen- entity prefix
 * (Skizzen-Anfrage, from the Skizze mint); anheften / lösen =
 * pin / unpin; der Teiler = splitter, Teilung aufheben = unsplit;
 * die Stufe = tier; die Ampelanzeige = the traffic-light status
 * pill; der Schutzschalter = circuit breaker with the actions
 * Wiederholen / Schaltkreis zurücksetzen (de workbench-live must
 * reuse); Peers raw (m. pl., matches peer-adressierbar);
 * Aktivitäts-Feed = activity feed (der Feed raw). Raw by design:
 * `Docs` / `Params` tab names (gRPC precedent), auth scheme and
 * body-mode enums (Basic, Bearer Token, Form data, raw, GraphQL),
 * Chrome ResourceType values (Page, Frame, Fetch/XHR, Script),
 * DNR / AND / DOM / L4 / L7 / TCP / TLS / RTT / Regex, Workflow /
 * Vault / Live / Build (m.) loanwords, footer key caps (↑↓ / ← /
 * → / ↵ / esc) and the {chord} / {unit} / {units} holes.
 */

import type { Catalog } from '../../types';

export const workbenchChrome = {
  // ── Tab strip: context menu ─────────────────────────────────────────
  'workbench.tabbar.menu.duplicateTab': 'Tab duplizieren',
  'workbench.tabbar.menu.close': 'Schließen',
  'workbench.tabbar.menu.closeOther': 'Andere Tabs schließen',
  'workbench.tabbar.menu.closeAll': 'Alle Tabs schließen',
  'workbench.tabbar.menu.closeUnmodified': 'Unveränderte Tabs schließen',
  'workbench.tabbar.menu.closeLeft': 'Tabs links schließen',
  'workbench.tabbar.menu.closeRight': 'Tabs rechts schließen',
  'workbench.tabbar.menu.splitAndMove': 'Teilen und verschieben',
  'workbench.tabbar.menu.right': 'Nach rechts',
  'workbench.tabbar.menu.left': 'Nach links',
  'workbench.tabbar.menu.down': 'Nach unten',
  'workbench.tabbar.menu.up': 'Nach oben',
  'workbench.tabbar.menu.moveOpposite': 'In die gegenüberliegende Gruppe verschieben',
  'workbench.tabbar.menu.changeSplitterOrientation': 'Ausrichtung des Teilers ändern',
  'workbench.tabbar.menu.unsplit': 'Teilung aufheben',
  'workbench.tabbar.menu.unsplitAll': 'Alle Teilungen aufheben',

  // ── Tab strip: close guard confirms (useTabLifecycle) ───────────────
  // The dialog bodies follow a bolded tab label in the JSX, so they key
  // as the sentence remainder (OnboardingTour bold-prefix idiom).
  'workbench.tabbar.closeGuard.unsavedTitle': 'Änderungen speichern?',
  'workbench.tabbar.closeGuard.unsavedBody':
    'hat ungespeicherte Änderungen. Speichere sie, um deine Arbeit nicht zu verlieren.',
  'workbench.tabbar.closeGuard.dontSave': 'Nicht speichern',
  'workbench.tabbar.closeGuard.cancel': 'Abbrechen',
  'workbench.tabbar.closeGuard.save': 'Änderungen speichern',
  'workbench.tabbar.closeGuard.draftTitle': 'Entwurf verwerfen?',
  'workbench.tabbar.closeGuard.draftBody':
    'wurde noch nicht veröffentlicht. Verwerfen löscht den Entwurf; Behalten lässt ihn zum späteren ' +
    'Fertigstellen in deiner Seitenleiste.',
  'workbench.tabbar.closeGuard.discard': 'Verwerfen',
  'workbench.tabbar.closeGuard.keep': 'Als Entwurf behalten',

  // ── Tab strip: bar chrome + search overlay ──────────────────────────
  'workbench.tabbar.createApiRequest': 'API-Anfrage erstellen',
  'workbench.tabbar.createItem': 'Element erstellen',
  'workbench.tabbar.searchTabs': 'Tabs durchsuchen',
  'workbench.tabbar.search.placeholder': 'Tabs durchsuchen...',
  'workbench.tabbar.search.noMatch': 'Keine offenen Tabs entsprechen deiner Suche',
  'workbench.tabbar.search.noOpenTabs': 'Keine offenen Tabs',
  'workbench.tabbar.search.noClosedMatch': 'Keine geschlossenen Tabs entsprechen deiner Suche',
  'workbench.tabbar.search.recentlyClosed': 'Kürzlich geschlossen ({count})',
  'workbench.tabbar.search.recentlyClosedFiltered': 'Kürzlich geschlossen ({matched} von {total})',
  'workbench.tabbar.envPinnedAria': 'Umgebung angeheftet',
  'workbench.tabbar.fromExample': 'aus „{name}“',

  // ── Scratch segment labels (tab tooltip + breadcrumb bar) ───────────
  'workbench.scratch.request': 'Skizzen-Anfrage',
  'workbench.scratch.rule': 'Skizzen-Regel',
  'workbench.scratch.variable': 'Skizzen-Variable',
  'workbench.scratch.workflow': 'Skizzen-Workflow',

  // ── Shell: command palette ──────────────────────────────────────────
  'workbench.shell.commandPalette.collectionsDivider': 'Sammlungen',
  'workbench.shell.commandPalette.searchInGroup': 'In {name} suchen...',
  'workbench.shell.commandPalette.placeholder': 'Suche Regeln, Sammlungen oder tippe > für Befehle...',
  'workbench.shell.commandPalette.noResults': 'Keine Ergebnisse gefunden',
  'workbench.shell.commandPalette.emptyHint': 'Tippe zum Suchen oder > für Befehle',
  'workbench.shell.commandPalette.footer.navigate': '↑↓ navigieren',
  'workbench.shell.commandPalette.footer.back': '← zurück',
  'workbench.shell.commandPalette.footer.open': '→ öffnen',
  'workbench.shell.commandPalette.footer.select': '↵ auswählen',
  'workbench.shell.commandPalette.footer.close': 'esc schließen',
  'workbench.shell.commandPalette.group.rules': 'Regeln',
  'workbench.shell.commandPalette.group.templates': 'Vorlagen',
  'workbench.shell.commandPalette.group.requests': 'Anfragen',
  'workbench.shell.commandPalette.group.systemTemplates': 'Systemvorlagen',
  'workbench.shell.commandPalette.group.settings': 'Einstellungen',
  'workbench.shell.commandPalette.section.create': 'Erstellen',
  'workbench.shell.commandPalette.section.commands': 'Befehle',
  'workbench.shell.commandPalette.section.variables': 'Variablen',
  'workbench.shell.commandPalette.cmd.createItem': 'Element erstellen...',
  'workbench.shell.commandPalette.cmd.newRuleType': 'Neue {type}',
  'workbench.shell.commandPalette.cmd.toggleLeftSidebar': 'Linke Seitenleiste umschalten',
  'workbench.shell.commandPalette.cmd.toggleRightSidebar': 'Rechte Seitenleiste umschalten',
  'workbench.shell.commandPalette.cmd.toggleBottomPanel': 'Unteres Panel umschalten',
  'workbench.shell.commandPalette.cmd.toggleActivityFeed': 'Aktivitäts-Feed umschalten',
  'workbench.shell.commandPalette.cmd.keyboardShortcuts': 'Tastenkürzel',
  'workbench.shell.commandPalette.cmd.openSettings': 'Einstellungen öffnen',
  'workbench.shell.commandPalette.cmd.openWorkspaceVariables': 'Arbeitsbereich-Variablen öffnen',
  'workbench.shell.commandPalette.cmd.openVault': 'Vault öffnen',
  'workbench.shell.commandPalette.cmd.openLiveVariables': 'Live-Variablen öffnen',
  'workbench.shell.commandPalette.cmd.openPackageLibrary': 'Paketbibliothek öffnen',
  'workbench.shell.commandPalette.cmd.openEnvironment': 'Umgebung öffnen: {name}',

  // ── Shell: top bar (search button, layout menu, panel toggles) ──────
  'workbench.shell.topbar.search': 'Suche oder führe einen Befehl aus...',
  'workbench.shell.topbar.layout.bottomAlignment': 'Ausrichtung des unteren Panels',
  'workbench.shell.topbar.layout.alignCenter': 'Zentriert (verschachtelt)',
  'workbench.shell.topbar.layout.alignLeft': 'Links',
  'workbench.shell.topbar.layout.alignRight': 'Rechts',
  'workbench.shell.topbar.layout.alignJustify': 'Blocksatz (volle Breite)',
  'workbench.shell.topbar.layout.showToolWindowNames': 'Werkzeugfenster-Namen anzeigen',
  'workbench.shell.topbar.layout.activityBarLayout': 'Layout der Aktivitätsleiste',
  'workbench.shell.topbar.layout.sidebarProportional': 'Proportional (gleiche Hälften)',
  'workbench.shell.topbar.layout.sidebarCompact': 'Kompakt (unten fixiert)',
  'workbench.shell.topbar.layout.sidebarStacked': 'Gestapelt (alles oben)',
  'workbench.shell.topbar.layout.sidebarDynamic': 'Dynamisch (folgt den Panelhöhen)',
  'workbench.shell.topbar.layout.defaultLayoutDonor': '{unit} mit Standard-Layout',
  'workbench.shell.topbar.layout.inheritsDefault': 'Erbt das Standard-Layout',
  'workbench.shell.topbar.layout.donorTooltip': 'Dieses {unit} ist der Standard — neue {units} erben dieses Layout.',
  'workbench.shell.topbar.layout.nonDonorTooltip': 'Ein anderes {unit} ist der Standard — neue {units} erben von dort.',
  'workbench.shell.topbar.layout.resetToDefaults': 'Layout auf Standard zurücksetzen',
  'workbench.shell.topbar.layout.restoreHidden': 'Ausgeblendete Aktivitätsleisten-Tools wiederherstellen',
  'workbench.shell.topbar.toggle.leftSidebar': 'Linke Seitenleiste',
  'workbench.shell.topbar.toggle.bottomPanel': 'Unteres Panel',
  'workbench.shell.topbar.toggle.rightSidebar': 'Rechte Seitenleiste',
  'workbench.shell.topbar.bottomAlign.center': 'Unteres Panel: zentriert (verschachtelt)',
  'workbench.shell.topbar.bottomAlign.left': 'Unteres Panel: linksbündig',
  'workbench.shell.topbar.bottomAlign.right': 'Unteres Panel: rechtsbündig',
  'workbench.shell.topbar.bottomAlign.justify': 'Unteres Panel: volle Breite',
  'workbench.shell.topbar.bottomAlign.chooseAria': 'Ausrichtung des unteren Panels wählen',
  'workbench.shell.topbar.layoutOptions': 'Layout-Optionen',

  // ── Shell: status bar ───────────────────────────────────────────────
  'workbench.shell.statusbar.theme.light': 'Hell',
  'workbench.shell.statusbar.theme.dark': 'Dunkel',
  'workbench.shell.statusbar.theme.auto': 'Auto',
  'workbench.shell.statusbar.systemStatus': 'Systemstatus',

  // ── Shell: activity bar ─────────────────────────────────────────────
  'workbench.shell.activityBar.hideLabels': 'Beschriftungen ausblenden',
  'workbench.shell.activityBar.showLabels': 'Beschriftungen anzeigen',

  // ── Shell: editor empty state ───────────────────────────────────────
  'workbench.shell.empty.createRule': 'Regel erstellen',
  'workbench.shell.empty.createRuleDesc': 'Header, Umleitungen, Blockieren und mehr',
  'workbench.shell.empty.createVariable': 'Variable erstellen',
  'workbench.shell.empty.createVariableDesc': 'Umgebung, Arbeitsbereich, Live und mehr',
  'workbench.shell.empty.createRequest': 'API-Anfrage erstellen',
  'workbench.shell.empty.createRequestDesc': 'Erstelle, sende und speichere HTTP-Anfragen',
  'workbench.shell.empty.createWorkflow': 'Workflow erstellen',
  'workbench.shell.empty.createWorkflowDesc': 'Verkette und plane API-Anfragen',
  'workbench.shell.empty.import': 'Importieren',
  'workbench.shell.empty.importDesc': 'Curl, HAR, Postman und mehr',
  'workbench.shell.empty.migrate': 'Aus einem anderen Tool migrieren',
  'workbench.shell.empty.migrateDesc': 'Bring deine Daten aus Postman, Insomnia oder Bruno mit',
  'workbench.shell.empty.browseTemplates': 'Alle Vorlagen durchstöbern…',
  'workbench.shell.empty.varEnvironment': 'Umgebungsvariable',
  'workbench.shell.empty.varWorkspace': 'Arbeitsbereich-Variable',
  'workbench.shell.empty.varLive': 'Live-Variable',
  'workbench.shell.empty.varVault': 'Vault-Secret',
  'workbench.shell.empty.varCollection': 'Sammlungsvariable',
  'workbench.shell.empty.varCollectionTooltip': 'Sammlungsvariablen werden innerhalb einer Sammlung erstellt.',

  // ── Shell: environment selector ─────────────────────────────────────
  'workbench.shell.envSelector.noEnvironment': 'Keine Umgebung',
  'workbench.shell.envSelector.defaultPill': 'STANDARD',
  'workbench.shell.envSelector.defaultTooltip':
    'Die Standard-Umgebung wird automatisch ausgewählt, während du mit der Sammlung arbeitest.',
  'workbench.shell.envSelector.openEnv': '{name} öffnen',
  'workbench.shell.envSelector.pinToTab': 'An diesen Tab anheften',
  'workbench.shell.envSelector.unpinFromTab': 'Von diesem Tab lösen',
  'workbench.shell.envSelector.pinToTabDesc': 'Wechselt zu dieser Umgebung, sobald der Tab den Fokus erhält.',
  'workbench.shell.envSelector.pinToCollection': 'An die Sammlung anheften',
  'workbench.shell.envSelector.unpinFromCollection': 'Von der Sammlung lösen',
  'workbench.shell.envSelector.pinToCollectionDesc':
    'Zeigt diese Umgebung in der Liste der an die Sammlung angehefteten Umgebungen.',
  'workbench.shell.envSelector.pinAria': 'Umgebung anheften',
  'workbench.shell.envSelector.setCollectionDefault': 'Als Standard der Sammlung festlegen',
  'workbench.shell.envSelector.clearCollectionDefault': 'Standard der Sammlung entfernen',
  'workbench.shell.envSelector.searchPlaceholder': 'Umgebungen durchsuchen…',
  'workbench.shell.envSelector.modeLabel': 'Modus: {mode}',
  'workbench.shell.envSelector.switchBehavior.title': 'Beim Wechseln zwischen Sammlungen',
  'workbench.shell.envSelector.switchBehavior.keep': 'Ausgewählte Umgebung beibehalten',
  'workbench.shell.envSelector.switchBehavior.keepDesc':
    'Deine Auswahl bleibt über Sammlungen und alles darin hinweg bestehen.',
  'workbench.shell.envSelector.switchBehavior.applyDefaults': 'Standards der Sammlungen anwenden',
  'workbench.shell.envSelector.switchBehavior.applyDefaultsDesc':
    'Innerhalb einer Sammlung übernehmen deren Standards. Deine letzte manuelle Wahl wird andernorts ' +
    'wiederhergestellt.',
  'workbench.shell.envSelector.switchBehavior.follow': 'Jeder Sammlung folgen',
  'workbench.shell.envSelector.switchBehavior.followDesc':
    'Sammlungen mit einem Standard wechseln zu ihm (und merken sich deine Wahl). Andere wechseln nicht.',
  'workbench.shell.envSelector.switchBehavior.aria': 'Verhalten beim Umgebungswechsel',
  'workbench.shell.envSelector.pinnedBanner':
    'An den aktuellen Tab angeheftet — die Wahl einer Umgebung verschiebt die Anheftung.',
  'workbench.shell.envSelector.unpin': 'Lösen',
  'workbench.shell.envSelector.createNew': 'Neue Umgebung erstellen',
  'workbench.shell.envSelector.pinnedSection': 'An diese Sammlung angeheftet',
  'workbench.shell.envSelector.othersSection': 'Weitere Umgebungen',
  'workbench.shell.envSelector.noMatches': 'Keine passenden Umgebungen',
  'workbench.shell.envSelector.footer.vault': 'Vault',
  'workbench.shell.envSelector.footer.collection': 'Sammlung',
  'workbench.shell.envSelector.footer.workspace': 'Arbeitsbereich',
  'workbench.shell.envSelector.footer.live': 'Live',
  'workbench.shell.envSelector.triggerAriaActive': 'Aktive Umgebung: {name}',
  'workbench.shell.envSelector.triggerAriaActivePinned': 'Aktive Umgebung: {name} (von diesem Tab angeheftet)',
  'workbench.shell.envSelector.triggerAriaNone': 'Keine Umgebung ausgewählt',
  'workbench.shell.envSelector.triggerAriaNonePinned': 'Keine Umgebung ausgewählt (von diesem Tab angeheftet)',

  // ── Shell: breadcrumb root nouns ────────────────────────────────────
  'workbench.shell.breadcrumbs.settings': 'Einstellungen',
  'workbench.shell.breadcrumbs.whatsNew': 'Neuigkeiten',
  'workbench.shell.breadcrumbs.workspaces': 'Arbeitsbereiche',
  'workbench.shell.breadcrumbs.daemonAdmin': 'Daemon-Verwaltung',
  'workbench.shell.breadcrumbs.environments': 'Umgebungen',
  'workbench.shell.breadcrumbs.specs': 'Spezifikationen',
  'workbench.shell.breadcrumbs.workspaceVariables': 'Arbeitsbereich-Variablen',
  'workbench.shell.breadcrumbs.vault': 'Vault',
  'workbench.shell.breadcrumbs.packageLibrary': 'Paketbibliothek',
  'workbench.shell.breadcrumbs.rules': 'Regeln',
  'workbench.shell.breadcrumbs.requests': 'Anfragen',
  'workbench.shell.breadcrumbs.templates': 'Vorlagen',
  'workbench.shell.breadcrumbs.variables': 'Variablen',
  'workbench.shell.breadcrumbs.apiRequests': 'API-Anfragen',
  'workbench.shell.breadcrumbs.workflows': 'Workflows',
  'workbench.shell.breadcrumbs.liveVariables': 'Live-Variablen',

  // ── Shell: fallback entity labels ───────────────────────────────────
  'workbench.shell.fallback.workflow': 'Workflow',
  'workbench.shell.fallback.template': 'Vorlage',
  'workbench.shell.fallback.environment': 'Umgebung',

  // ── Shell: tab-label compositions + draft seeds. Singleton tab
  // labels resolve live through the breadcrumb root nouns; only copy
  // with no breadcrumb twin lives here. Draft seeds persist as entity
  // names BY DESIGN (V5 fresh start) — keyed at mint time. ────────────
  'workbench.shell.tabLabel.collectionVariables': '{name} · Variablen',
  'workbench.shell.tabLabel.collectionScripts': '{name} · Scripts',
  'workbench.shell.tabLabel.collectionAuth': '{name} · Autorisierung',
  'workbench.shell.tabLabel.newRequest': 'Neue Anfrage',
  'workbench.shell.tabLabel.newGrpcRequest': 'Neue gRPC-Anfrage',
  'workbench.shell.tabLabel.newWebSocketRequest': 'Neue WebSocket-Anfrage',
  'workbench.shell.tabLabel.newSocketIoRequest': 'Neue Socket.IO-Anfrage',
  'workbench.shell.tabLabel.newWorkflow': 'Neuer Workflow',
  'workbench.shell.tabLabel.newLiveVariable': 'Neue Live-Variable',

  // ── Shell: App glue — workspace-switch toast, dirty-close confirm,
  // create-flow toasts. `{unit}` interpolates the host-vocabulary
  // instance noun (tab / window). ─────────────────────────────────────
  'workbench.shell.appGlue.switchedTo': '{unit} gewechselt zu',
  'workbench.shell.appGlue.andMadeActive': ' und aktiv gesetzt',
  'workbench.shell.appGlue.discardTitle': 'Ungespeicherte Entwürfe verwerfen?',
  'workbench.shell.appGlue.discardBody':
    'Beim Wechsel des Arbeitsbereichs werden Editor-Tabs mit ungespeicherten Änderungen geschlossen.',
  'workbench.shell.appGlue.discardOk': 'Wechseln und verwerfen',
  'workbench.shell.appGlue.cancel': 'Abbrechen',
  'workbench.shell.toast.createEnvironmentFailed': 'Umgebung konnte nicht erstellt werden',
  'workbench.shell.toast.noActiveWorkspace': 'Kein aktiver Arbeitsbereich',
  'workbench.shell.toast.createRuleFailed': 'Regel konnte nicht erstellt werden',

  // ── Save: collection modal chrome ───────────────────────────────────
  'workbench.save.title': 'SPEICHERN',
  'workbench.save.newFolder': 'Neuer Ordner',
  'workbench.save.newFolderTooltip': 'Neuer Ordner ({chord})',
  'workbench.save.newCollection': 'Neue Sammlung',
  'workbench.save.newCollectionTooltip': 'Neue Sammlung ({chord})',
  'workbench.save.cancel': 'Abbrechen',
  'workbench.save.save': 'Speichern',
  'workbench.save.selectCollectionFirst': 'Wähle zuerst eine Sammlung',
  'workbench.save.enterName': 'Gib einen Namen ein',
  'workbench.save.saveWithChord': 'Speichern ({chord})',
  'workbench.save.footer.navigate': '↑↓ navigieren',
  'workbench.save.footer.open': '→ öffnen',
  'workbench.save.footer.back': '← zurück',
  'workbench.save.footer.new': '{chord} neu',
  'workbench.save.footer.save': '{chord} speichern',
  'workbench.save.footer.close': 'esc schließen',
  'workbench.save.nameLabel': 'Name',
  'workbench.save.saveTo': 'Speichern in ',
  'workbench.save.rootCrumb': 'Lokale Regeln',
  'workbench.save.searchFolders': 'Ordner durchsuchen',
  'workbench.save.searchCollections': 'Sammlung suchen',
  'workbench.save.nameYourCollection': 'Gib deiner Sammlung einen Namen',
  'workbench.save.create': 'Erstellen',
  'workbench.save.noCollections': 'Noch keine Sammlungen.',
  'workbench.save.noMatchingCollections': 'Keine passenden Sammlungen.',
  'workbench.save.createCollection': 'Sammlung erstellen',
  'workbench.save.orPressPrefix': 'oder drücke',
  'workbench.save.nameYourFolder': 'Gib deinem Ordner einen Namen',
  'workbench.save.folderEmpty': 'Dieser Ordner ist leer.',
  'workbench.save.collectionEmpty': 'Diese Sammlung ist leer.',
  'workbench.save.pressPrefix': 'Drücke',
  'workbench.save.pressMiddle': 'um hier zu speichern, oder',
  'workbench.save.pressSuffix': 'für einen neuen Ordner.',

  // ── Save: as-template step ──────────────────────────────────────────
  'workbench.save.template.title': 'Als Benutzervorlage speichern',
  'workbench.save.template.next': 'Weiter',
  'workbench.save.template.intro': 'Speichere die aktuelle Konfiguration von {type} als wiederverwendbare Vorlage.',
  'workbench.save.template.iconLabel': 'Symbol',
  'workbench.save.template.nameLabel': 'Name *',
  'workbench.save.template.namePlaceholder': 'Name meiner Vorlage',
  'workbench.save.template.descriptionLabel': 'Beschreibung',
  'workbench.save.template.descriptionPlaceholder': 'Was macht diese Vorlage? (optional)',
  'workbench.save.template.includeConditions': 'Bedingungen einschließen',
  'workbench.save.template.includeActions': 'Aktionen einschließen',
  'workbench.save.template.ruleFallback': 'Regel',

  // ── Save: per-surface rule-type vocabulary ──────────────────────────
  'workbench.save.ruleType.header': 'Header',
  'workbench.save.ruleType.block': 'Blockieren',
  'workbench.save.ruleType.redirect': 'Umleiten',
  'workbench.save.ruleType.queryParam': 'Query-Parameter',
  'workbench.save.ruleType.inject': 'Injizieren',
  'workbench.save.ruleType.delay': 'Verzögerung',
  'workbench.save.ruleType.requestBody': 'API-Anfrage-Body',
  'workbench.save.ruleType.response': 'API-Antwort',

  // ── Shell: rule-type entity names ('New {name}' draft seeds, command
  //    palette scope column + New-rule rows). Draft names persist as
  //    entity names — keyed at mint time (V5 fresh start, no back-compat). ─
  'workbench.shell.ruleTypeName.header': 'Header-Regel',
  'workbench.shell.ruleTypeName.block': 'Blockier-Regel',
  'workbench.shell.ruleTypeName.redirect': 'Umleitungs-Regel',
  'workbench.shell.ruleTypeName.queryParam': 'Query-Parameter-Regel',
  'workbench.shell.ruleTypeName.inject': 'Injektions-Regel',
  'workbench.shell.ruleTypeName.delay': 'Verzögerungs-Regel',
  'workbench.shell.ruleTypeName.requestBody': 'API-Anfrage-Body-Regel',
  'workbench.shell.ruleTypeName.response': 'API-Antwort-Regel',
  'workbench.shell.ruleTypeName.ws': 'WebSocket-Regel',
  'workbench.shell.ruleTypeName.sse': 'SSE-Regel',
  'workbench.shell.ruleTypeName.fallback': 'Regel',
  'workbench.shell.ruleTypeName.draftName': 'Neue {name}',

  // ── Tool-window registry (activity bars, dock tab strips, restore
  //    rows, drag previews) ───────────────────────────────────────────
  'workbench.toolWindows.httpRules': 'HTTP-Regeln',
  'workbench.toolWindows.apiRequests': 'API-Anfragen',
  'workbench.toolWindows.workflows': 'Workflows',
  'workbench.toolWindows.notifications': 'Benachrichtigungen',
  'workbench.toolWindows.docs': 'Docs',
  'workbench.toolWindows.varScope': 'Variablen-Geltungsbereich',
  'workbench.toolWindows.variables': 'Variablen',
  'workbench.toolWindows.workflowStatus': 'Workflow-Status',
  'workbench.toolWindows.activity': 'Aktivität',
  'workbench.toolWindows.activityTooltip': 'Aktivitäts-Feed — eingehende Änderungen von Peers',
  'workbench.toolWindows.deepNetworkInspection': 'Tiefe Netzwerkinspektion',
  'workbench.toolWindows.terminal': 'Terminal',

  // ── Tool-window `(i)` info popovers. `{{live.*}}` / `{{name}}`
  //    reference chips compose raw in JSX between the keyed prefix/
  //    suffix fragments; the Notifications entry stays on the shared
  //    NOTIFICATIONS_PANEL_INFO corpus (panel co-consumer, Phase D). ───
  'workbench.toolWindows.info.httpRules.summary':
    'Erstelle Regeln, die ausgehende Anfragen und eingehende Antworten umschreiben. Regeln leben in ' +
    'Sammlungen und können Werte aus Variablen, dem vault und Live-Workflows injizieren.',
  'workbench.toolWindows.info.httpRules.ruleTypesHeading': 'Regeltypen',
  'workbench.toolWindows.info.workflows.summaryPrefix':
    'Ein Variablen-Produzent mit geplanter Aktualisierung: eine Anfragekette plus eine Extraktionsregel. ' +
    'Seine Ausgabe erscheint als',
  'workbench.toolWindows.info.workflows.summarySuffix':
    'Referenz, verwendbar überall dort, wo eine Variable akzeptiert wird.',
  'workbench.toolWindows.info.docs.summary':
    'Integrierte Dokumentation zu Regeln, Variablen, Workflows und dem Arbeitsbereich-Editor selbst — zum ' +
    'Durchstöbern, ohne die App zu verlassen.',
  'workbench.toolWindows.info.varScope.summaryPrefix':
    'Die Variablen, die der aktive Tab referenziert, und jeder Geltungsbereich, gegen den sie aufgelöst ' +
    'werden. Eine einfache',
  'workbench.toolWindows.info.varScope.summaryMiddle':
    'fällt durch die Prioritätsreihenfolge unten; Referenzen mit Namensraum wie',
  'workbench.toolWindows.info.varScope.summarySuffix': 'zielen direkt auf einen einzelnen Geltungsbereich.',
  'workbench.toolWindows.info.varScope.priorityHeading': 'Prioritätsreihenfolge',
  'workbench.toolWindows.info.varScope.vaultLabel': 'Vault',
  'workbench.toolWindows.info.varScope.vaultDesc': 'Secrets pro Benutzer, nie synchronisiert — höchste Priorität.',
  'workbench.toolWindows.info.varScope.environmentLabel': 'Umgebung',
  'workbench.toolWindows.info.varScope.environmentDesc': 'Die aktive Umgebung, mit Rückfall auf die Standard-Umgebung.',
  'workbench.toolWindows.info.varScope.collectionLabel': 'Sammlung',
  'workbench.toolWindows.info.varScope.collectionDesc': 'Die Sammlung der aktiven Entität.',
  'workbench.toolWindows.info.varScope.workspaceLabel': 'Arbeitsbereich',
  'workbench.toolWindows.info.varScope.workspaceDesc': 'Im ganzen Arbeitsbereich geteilt — niedrigste Priorität.',
  'workbench.toolWindows.info.varScope.namespacedHeading': 'Mit Namensraum',
  'workbench.toolWindows.info.varScope.liveLabel': 'Live',
  'workbench.toolWindows.info.varScope.liveDescPrefix': 'Workflow-gestützt; erreichbar nur über',
  'workbench.toolWindows.info.varScope.liveDescSuffix': ', aufgelöst aus dem letzten Lauf.',
  'workbench.toolWindows.info.variables.summary':
    'Der Variablenkatalog — alles, was über Umgebungen, Sammlungen, den Arbeitsbereich und den vault hinweg ' +
    'definiert ist. Nutze Geltungsbereich, um zu sehen, was für den aktiven Tab tatsächlich im ' +
    'Geltungsbereich ist.',
  'workbench.toolWindows.info.variables.typesHeading': 'Variablentypen',
  'workbench.toolWindows.info.variables.vaultDesc': 'Secrets pro Benutzer — lokal gespeichert, nie synchronisiert.',
  'workbench.toolWindows.info.variables.environmentDesc': 'Pro Umgebung definiert; die aktive liefert die Werte.',
  'workbench.toolWindows.info.variables.collectionDesc':
    'Auf einer Sammlung definiert; gelten für die Entitäten darin.',
  'workbench.toolWindows.info.variables.workspaceDesc': 'Im ganzen Arbeitsbereich geteilt.',
  'workbench.toolWindows.info.variables.liveDescPrefix': 'Von Workflows erzeugte Werte, referenziert als',
  'workbench.toolWindows.info.variables.liveDescSuffix': '.',
  'workbench.toolWindows.info.apiRequests.summary':
    'Gespeicherte API-Anfragen und die Umgebungen, gegen die sie laufen, organisiert in Sammlungen und ' + 'Ordnern.',
  'workbench.toolWindows.info.apiRequests.editorHeading': 'Anfragen-Editor',
  'workbench.toolWindows.info.apiRequests.docsLabel': 'Docs',
  'workbench.toolWindows.info.apiRequests.docsDesc': 'Freie Notizen zur Anfrage — Markdown wird unterstützt.',
  'workbench.toolWindows.info.apiRequests.paramsLabel': 'Params',
  'workbench.toolWindows.info.apiRequests.paramsDesc': 'Query-Parameter, die an die URL der Anfrage angehängt werden.',
  'workbench.toolWindows.info.apiRequests.authorizationLabel': 'Autorisierung',
  'workbench.toolWindows.info.apiRequests.authorizationDesc':
    'Vom Elternelement erben, Basic, Bearer Token, API Key oder OAuth 2.0 — angewendet beim Senden.',
  'workbench.toolWindows.info.apiRequests.headersLabel': 'Header',
  'workbench.toolWindows.info.apiRequests.headersDesc':
    'Anfrage-Header, mit beim Senden aufgelösten Variablenreferenzen.',
  'workbench.toolWindows.info.apiRequests.bodyLabel': 'Body',
  'workbench.toolWindows.info.apiRequests.bodyDesc':
    'Form data, URL-encoded, raw (Text, JavaScript, JSON, HTML, XML) oder GraphQL.',
  'workbench.toolWindows.info.apiRequests.scriptsLabel': 'Scripts',
  'workbench.toolWindows.info.apiRequests.scriptsDesc': 'JavaScript-Hooks vor der Anfrage und nach der Antwort.',
  'workbench.toolWindows.info.apiRequests.settingsLabel': 'Einstellungen',
  'workbench.toolWindows.info.apiRequests.settingsDesc': 'Verhalten pro Anfrage — SSL-Prüfung, Umleitungen und mehr.',
  'workbench.toolWindows.info.deepNetworkInspection.summary':
    'Inspektion auf Verbindungsebene (L4) und HTTP-Ebene (L7) in einer Ansicht — TCP/TLS-Gesundheit wie RTT, ' +
    'Neuübertragungen und Handshake-Timing neben vollständiger Sichtbarkeit, Veränderung und Wiederholung ' +
    'von Anfragen/Antworten.',
  'workbench.toolWindows.info.workflowStatus.summary':
    'Schutzschalter-Dashboard pro Workflow — Zustand, aufeinanderfolgende Fehlschläge, Öffnungen und ' +
    'Countdown zum nächsten Versuch, mit den manuellen Aktionen Wiederholen und Schaltkreis zurücksetzen.',
  'workbench.toolWindows.info.activity.summary':
    'Arbeitsbereichsweiter Feed eingehender Änderungen von Peers, mit Klassifizierer-Hervorhebungen für ' +
    'Rotationen sensibler Felder, Ausweitungen des Berechtigungsumfangs und Verdrängungen lokaler Änderungen.',
  'workbench.terminal.sessionEnded': 'Sitzung beendet',
  'workbench.terminal.restart': 'Shell neu starten',
  'workbench.terminal.tabLocal': 'Lokal',
  'workbench.terminal.tabLocalN': 'Lokal ({n})',
  'workbench.terminal.newTab': 'Neuer Terminal-Tab',
  'workbench.terminal.newTabWithProfile': 'Neuer Tab aus Profil',
  'workbench.terminal.closeTab': 'Tab schließen',
  'workbench.terminal.openTui': 'TUI-Modus öffnen',
  'workbench.terminal.closeConfirm.title': 'Prozess läuft',
  'workbench.terminal.closeConfirm.bodyPrefix': 'In ',
  'workbench.terminal.closeConfirm.bodySuffix': ' läuft noch ein Prozess. Beenden?',
  'workbench.terminal.closeConfirm.ok': 'Beenden',
  'workbench.terminal.closeConfirm.bodyMany': 'In {count} der zu schließenden Tabs laufen noch Prozesse. Beenden?',
  'workbench.terminal.menu.rename': 'Umbenennen',
  'workbench.terminal.rename.title': 'Tab umbenennen',
  'workbench.terminal.settings': 'Einstellungen',
  'workbench.terminal.cliGate.title': 'Die CLI von OpenHeaders verbinden',
  'workbench.terminal.cliGate.body':
    'Der TUI-Modus wird vom Kommandozeilen-Tool oh angetrieben, das noch nicht mit dieser App verbunden ist. ' +
    'Beim Verbinden wird ein Zugriffstoken erstellt und in {path} gespeichert — danach funktioniert oh in ' +
    'jedem Terminal auf diesem Rechner.',
  'workbench.terminal.cliGate.ok': 'Verbinden und öffnen',
  'workbench.terminal.cliGate.openSettings': 'Einstellungen öffnen',
  'workbench.toolWindows.info.terminal.summary':
    'Ein integriertes Terminal, das deine Shell in einem echten pty ausführt — alles, was in einem ' +
    'eigenständigen Terminal läuft, läuft auch hier, einschließlich der CLI oh gegen die lokale App.',

  // ── Deep Network Inspection placeholder panel. The sample connection
  // feed (TCP/TLS lines, HPACK fields, stat figures) and the tier
  // roadmap's quoted scenario copy ride raw as illustration data —
  // only the panel chrome keys here. ──────────────────────────────────
  'workbench.deepNetwork.comingSoon': 'BALD VERFÜGBAR — DESKTOP-APP',
  'workbench.deepNetwork.heading': 'Inspektion von Verbindung (L4) + HTTP (L7)',
  'workbench.deepNetwork.description':
    'Verbindungszustand und vollständiges HTTP in einer Ansicht — die Ebenen, auf denen du wirklich ' +
    'handelst, leicht zu inspizieren und zu verändern. Noch nicht live; unten werden Beispieldaten gezeigt.',
  'workbench.deepNetwork.viewTiers': 'Roadmap der Stufen',
  'workbench.deepNetwork.viewConnection': 'Verbindungsansicht',
  'workbench.deepNetwork.stats': 'Statistiken',
  'workbench.deepNetwork.rowSolves': 'Löst',
  'workbench.deepNetwork.rowTrust': 'Erforderliches Vertrauen',
  'workbench.deepNetwork.rowPower': 'Leistung',
  'workbench.deepNetwork.rowFriction': 'Reibung',
  'workbench.deepNetwork.wall': 'Du stößt an eine Wand:',

  // ── Shared markdown widgets (toolbar + highlighted code block) ──────
  'workbench.markdown.heading': 'Überschrift',
  'workbench.markdown.bold': 'Fett',
  'workbench.markdown.italic': 'Kursiv',
  'workbench.markdown.strikethrough': 'Durchgestrichen',
  'workbench.markdown.codeBlock': 'Codeblock',
  'workbench.markdown.link': 'Link',
  'workbench.markdown.bulletedList': 'Aufzählung',
  'workbench.markdown.numberedList': 'Nummerierte Liste',
  'workbench.markdown.table': 'Tabelle',
  'workbench.markdown.copyCode': 'Code kopieren',
  'workbench.markdown.copied': 'Kopiert',

  // ── Two-tone icon picker ────────────────────────────────────────────
  'workbench.iconPicker.searchPlaceholder': 'Symbole durchsuchen...',

  // ── Template editor ─────────────────────────────────────────────────
  'workbench.templateEditor.toast.saved': 'Vorlage gespeichert',
  'workbench.templateEditor.toast.saveFailed': 'Vorlage konnte nicht gespeichert werden',
  'workbench.templateEditor.notFound': 'Vorlage nicht gefunden',
  'workbench.templateEditor.namePlaceholder': 'Name der Vorlage',
  'workbench.templateEditor.descriptionPlaceholder': 'Beschreibung (optional)',
  'workbench.templateEditor.includeConditions': 'Bedingungen einschließen',
  'workbench.templateEditor.includeActions': 'Aktionen einschließen',
  'workbench.templateEditor.conditionsTitle': 'Bedingungen',

  // ── What's New tab ──────────────────────────────────────────────────
  'workbench.whatsNew.title': 'Neuigkeiten in Open Headers {version}',
  'workbench.whatsNew.noNotes': 'Dieser Build wird ohne Versionshinweise ausgeliefert.',

  // ── Keyboard shortcuts: SHORTCUTS registry action names + the docs
  // cheatsheet chrome around them. Chords, key caps (?, ⌘, Ctrl) and
  // the regions diagram internals stay raw. ──────────────────────────
  'workbench.shortcuts.action.toggleLeftSidebar': 'Linke Seitenleiste umschalten',
  'workbench.shortcuts.action.toggleRightSidebar': 'Rechte Seitenleiste umschalten',
  'workbench.shortcuts.action.toggleBottomPanel': 'Unteres Panel umschalten',
  'workbench.shortcuts.action.toggleActivityFeed': 'Aktivitäts-Feed umschalten',
  'workbench.shortcuts.action.terminalNewTab': 'Neuer Terminal-Tab',
  'workbench.shortcuts.action.closeTab': 'Tab schließen',
  'workbench.shortcuts.action.newTab': 'Neuer Tab',
  'workbench.shortcuts.action.prevTab': 'Vorheriger Tab',
  'workbench.shortcuts.action.nextTab': 'Nächster Tab',
  'workbench.shortcuts.action.tabSearch': 'Tabs durchsuchen',
  'workbench.shortcuts.action.commandPalette': 'Befehlspalette',
  'workbench.shortcuts.action.focusFilter': 'Filter des aktiven Bereichs fokussieren',
  'workbench.shortcuts.action.focusLeftSidebar': 'Linke Seitenleiste fokussieren',
  'workbench.shortcuts.action.focusEditor': 'Editor fokussieren',
  'workbench.shortcuts.action.focusRightSidebar': 'Rechte Seitenleiste fokussieren',
  'workbench.shortcuts.action.focusBottomPanel': 'Unteres Panel fokussieren',
  'workbench.shortcuts.action.save': 'Speichern',
  'workbench.shortcuts.action.newRule': 'Element erstellen',
  'workbench.shortcuts.action.import': 'Importieren',
  'workbench.shortcuts.action.showShortcuts': 'Tastenkürzel',
  'workbench.shortcuts.action.openSettings': 'Einstellungen öffnen',
  'workbench.shortcuts.action.find': 'Im Editor suchen',
  'workbench.shortcuts.action.replace': 'Im Editor ersetzen',
  'workbench.shortcuts.action.formatCode': 'Code formatieren',
  'workbench.shortcuts.category.panels': 'Panels',
  'workbench.shortcuts.category.tabs': 'Tabs',
  'workbench.shortcuts.category.navigation': 'Navigation',
  'workbench.shortcuts.category.actions': 'Aktionen',
  'workbench.shortcuts.allSurfacesTitle': 'Alle Oberflächen',
  'workbench.shortcuts.toggleDebugMode': 'Debug-Modus umschalten',
  'workbench.shortcuts.goToTab': 'Zu Tab 1–9 wechseln (9 = letzter)',
  'workbench.shortcuts.introPrefix': 'Drücke',
  'workbench.shortcuts.introMiddle': 'jederzeit, um hierher zu springen. Die Kürzel verwenden',
  'workbench.shortcuts.introSuffix': 'als Modifikatortaste.',
  'workbench.shortcuts.regionsCaption': 'Vier Tastenfolgen setzen deinen Fokus in eine der vier Regionen der Shell.',

  // ── Docs navigator plane: group labels + section titles/summaries
  // from the workbench DOC_GROUPS registry (raw-or-key DocSection
  // idiom). Section body corpus + diagrams are their own station. ────
  'workbench.docs.nav.group.openHeaders': 'Open Headers',
  'workbench.docs.nav.group.concepts': 'Konzepte',
  'workbench.docs.nav.group.modifyRequests': 'Anfragen verändern',
  'workbench.docs.nav.group.modifyResponses': 'Antworten verändern',
  'workbench.docs.nav.group.runCode': 'Code ausführen',
  'workbench.docs.nav.group.reference': 'Referenz',
  'workbench.docs.nav.paradigm.title': 'Was wir (anders) machen',
  'workbench.docs.nav.paradigm.summary':
    'Eine Browser-Erweiterung, die leistet, wofür früher ein Proxy, ein Desktop-Binary oder ein Cloud-Konto ' +
    'nötig war.',
  'workbench.docs.nav.comparison.title': 'Wie wir uns vergleichen',
  'workbench.docs.nav.comparison.summary':
    'Wie sich Open Headers gegenüber Cloud-Plattformen, Desktop-Proxys und Nur-Header-Erweiterungen schlägt.',
  'workbench.docs.nav.roadmap.title': 'Jede Oberfläche, ausgeliefert',
  'workbench.docs.nav.roadmap.summary':
    'Die ausgelieferten Meilensteine — Git-Arbeitsbereiche, Desktop-App, MCP-Server, Daemon, CLI, Web-App, ' +
    'Importer.',
  'workbench.docs.nav.conditions.title': 'Bedingungen',
  'workbench.docs.nav.conditions.summary':
    'AND-verknüpfte Filter, die jede Regel eingrenzen — Domains, URL-Muster, Methoden, Header.',
  'workbench.docs.nav.actions.title': 'Aktionen',
  'workbench.docs.nav.actions.summary':
    'Die „Machen“-Hälfte einer Regel — Anfrage verändern, Antwort verändern oder Code ausführen. Arbeitet ' +
    'mit den Bedingungen zusammen.',
  'workbench.docs.nav.variables.title': 'Variablen',
  'workbench.docs.nav.variables.summary':
    'Fünf Geltungsbereiche für Variablen — vault, Umgebung, Sammlung, Arbeitsbereich, live — und wie ' +
    'Referenzen aufgelöst werden.',
  'workbench.docs.nav.requestTracking.title': 'Anfragenverfolgung',
  'workbench.docs.nav.requestTracking.summary':
    'Wie getroffene Anfragen beobachtet, aufgezeichnet und als Badges im Popup angezeigt werden.',
  'workbench.docs.nav.execution.title': 'Wie Regeln ausgeführt werden',
  'workbench.docs.nav.execution.summary':
    'Die zwei Engines (DNR und skriptbasiert), die entscheiden, wo jede Regel angewendet wird.',
  'workbench.docs.nav.multiTab.title': 'Verhalten bei mehreren Tabs',
  'workbench.docs.nav.multiTab.summary':
    'Was zwischen Arbeitsbereich-Tabs synchronisiert wird (Daten) und was pro Tab bleibt (Layout, Entwürfe).',
  'workbench.docs.nav.systemStatus.title': 'Systemstatus',
  'workbench.docs.nav.systemStatus.summary':
    'Die Ampelanzeige — was jedes Subsystem meldet und was Rot / Gelb / Grün bedeuten.',
  'workbench.docs.nav.debugMode.title': 'Debug-Modus',
  'workbench.docs.nav.debugMode.summary':
    'Anbindung an das Debugging-Protokoll des Browsers — größere Reichweite für Anfragen, Injektion und ' +
    'Tab-Umgebung.',
  'workbench.docs.nav.headerActions.title': 'Header-Aktionen',
  'workbench.docs.nav.headerActions.summary':
    'Anfrage- und Antwort-Header hinzufügen, ersetzen, anfügen, entfernen oder zusammenführen.',
  'workbench.docs.nav.block.title': 'Blockieren',
  'workbench.docs.nav.block.summary': 'Passende Anfragen auf der Netzwerkebene abbrechen.',
  'workbench.docs.nav.redirect.title': 'Umleiten',
  'workbench.docs.nav.redirect.summary':
    'Passende Anfragen an eine andere URL senden — statisch oder per Regex ersetzt.',
  'workbench.docs.nav.queryParam.title': 'Query-Parameter',
  'workbench.docs.nav.queryParam.summary':
    'Query-Parameter der URL hinzufügen, ersetzen oder entfernen, bevor die Anfrage abgeht.',
  'workbench.docs.nav.requestBody.title': 'Anfrage-Body',
  'workbench.docs.nav.requestBody.summary':
    'Ausgehende fetch- / XHR-Bodys überschreiben oder transformieren — statisch, dynamisch oder ' +
    'GraphQL-gefiltert.',
  'workbench.docs.nav.response.title': 'Antwort verändern',
  'workbench.docs.nav.response.summary':
    'API-Antworten simulieren oder verändern — Body, Status und Header synthetisch oder transformiert.',
  'workbench.docs.nav.inject.title': 'JS / CSS injizieren',
  'workbench.docs.nav.inject.summary':
    'JavaScript oder CSS im Seitenkontext ausführen — vor den Seitenskripten oder nachdem das DOM bereit ist.',
  'workbench.docs.nav.delay.title': 'Verzögerung',
  'workbench.docs.nav.delay.summary': 'Künstliche Latenz zu Navigationen und JS-initiierten fetch / XHR hinzufügen.',
  'workbench.docs.nav.resourceTypes.title': 'Ressourcentypen',
  'workbench.docs.nav.resourceTypes.summary':
    'Nachschlagetabelle der ResourceType-Werte von Chrome — Page, Frame, Fetch/XHR, Script und der Rest.',
  'workbench.docs.nav.keyboardShortcuts.title': 'Tastenkürzel',
  'workbench.docs.nav.keyboardShortcuts.summary':
    'Jedes Kürzel des Arbeitsbereich-Editors, gruppiert nach Oberfläche — Panels, Tabs, Navigation, Aktionen.',
  'workbench.docs.nav.limitations.title': 'Einschränkungen',
  'workbench.docs.nav.limitations.summary':
    'Die bekannten Überraschungen an einem Ort — Sichtbarkeit in den DevTools, Reichweite der Skripte, ' +
    'Header-Abgleich, Zusammenführen.',
} as const satisfies Catalog;
