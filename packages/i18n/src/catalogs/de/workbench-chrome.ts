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
 * die Ampelanzeige = the traffic-light status
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

import { formatMessage, plural } from '../../runtime';
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
  'workbench.tabbar.createRule': 'Regel erstellen',
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
  'workbench.shell.commandPalette.cmd.openTrustedRoots': 'Vertrauenswürdige Zertifikate öffnen',
  'workbench.shell.commandPalette.cmd.openLiveVariables': 'Live-Variablen öffnen',
  'workbench.shell.commandPalette.cmd.openPackageLibrary': 'Paketbibliothek öffnen',
  'workbench.shell.commandPalette.cmd.openEnvironment': 'Umgebung öffnen: {name}',

  // ── Shell: top bar (search button, layout menu, panel toggles) ──────
  'workbench.shell.topbar.search': 'Suche oder führe einen Befehl aus...',
  'workbench.shell.topbar.layout.bottomLayout': 'Layout des unteren Panels',
  'workbench.shell.topbar.layout.alignCenter': 'Zentriert (verschachtelt)',
  'workbench.shell.topbar.layout.alignLeft': 'Links',
  'workbench.shell.topbar.layout.alignRight': 'Rechts',
  'workbench.shell.topbar.layout.alignJustify': 'Blocksatz (volle Breite)',
  'workbench.shell.topbar.layout.splitColumns': 'Nebeneinander',
  'workbench.shell.topbar.layout.splitRows': 'Gestapelt',
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
  'workbench.shell.topbar.appMenu': 'Menü',

  // ── Shell: status bar ───────────────────────────────────────────────
  'workbench.shell.statusbar.theme.light': 'Hell',
  'workbench.shell.statusbar.theme.dark': 'Dunkel',
  'workbench.shell.statusbar.theme.auto': 'Auto',
  'workbench.shell.statusbar.systemStatus': 'System',

  // ── Shell: activity bar ─────────────────────────────────────────────
  'workbench.shell.activityBar.hideLabels': 'Beschriftungen ausblenden',
  'workbench.shell.activityBar.showLabels': 'Beschriftungen anzeigen',

  // ── Shell: editor empty state ───────────────────────────────────────
  'workbench.shell.empty.createRule': 'Regel erstellen',
  'workbench.shell.empty.createRuleDesc': 'Header, Umleitungen, Blockieren und mehr',
  'workbench.shell.empty.createVariable': 'Variable erstellen',
  'workbench.shell.empty.createVariableDesc': 'Umgebung, Arbeitsbereich, Live und mehr',
  'workbench.shell.empty.createRequest': 'API-Anfrage erstellen',
  'workbench.shell.empty.createRequestDesc': 'HTTP, gRPC, WebSocket und mehr',
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
  'workbench.shell.empty.adminNoWorkspace':
    'Sie sind als Server-Administrator angemeldet, ohne dass Ihnen ein Workspace gewährt wurde. Workspace-Daten bleiben unerreichbar, bis eine Gewährung existiert — auch eine, die Sie sich selbst erteilen.',
  'workbench.shell.empty.adminOpenServerAdmin': 'Server-Administration öffnen',
  'workbench.shell.empty.adminOpenServerAdminDesc': 'Benutzer, Gewährungen und den Server verwalten',

  // ── Shell: environment selector ─────────────────────────────────────
  'workbench.shell.envSelector.noEnvironment': 'Keine Umgebung',
  'workbench.shell.envSelector.defaultPill': 'STANDARD',
  'workbench.shell.envSelector.defaultTooltip':
    'Die Standard-Umgebung wird automatisch ausgewählt, während du mit der Sammlung arbeitest.',
  'workbench.shell.envSelector.openEnv': 'Variablen bearbeiten',
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
  'workbench.shell.breadcrumbs.serverAdmin': 'Server-Verwaltung',
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
  'workbench.shell.tabLabel.newRequest': 'Neue Anfrage',
  'workbench.shell.tabLabel.newGrpcRequest': 'Neue gRPC-Anfrage',
  'workbench.shell.tabLabel.newWebSocketRequest': 'Neue WebSocket-Anfrage',
  'workbench.shell.tabLabel.newSocketIoRequest': 'Neue Socket.IO-Anfrage',
  'workbench.shell.tabLabel.newMqttRequest': 'Neue MQTT-Anfrage',
  'workbench.shell.tabLabel.newGraphqlRequest': 'Neue GraphQL-Anfrage',
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
  'workbench.shell.toast.gitHeadBranch': '„{workspace}“ steht auf dem Back-end jetzt auf dem Branch {branch}',
  'workbench.shell.toast.gitHeadDetached': '„{workspace}“ steht auf dem Back-end jetzt losgelöst auf {sha}',

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
  'workbench.toolWindows.serverAdmin': 'Server-Admin',
  'workbench.toolWindows.httpRules': 'Browser Interceptor',
  'workbench.toolWindows.apiRequests': 'API-Anfragen',
  'workbench.toolWindows.workflows': 'Workflows',
  'workbench.toolWindows.notifications': 'Benachrichtigungen',
  'workbench.toolWindows.docs': 'Docs',
  'workbench.toolWindows.varScope': 'Variablen-Geltungsbereich',
  'workbench.toolWindows.variables': 'Variablen',
  'workbench.toolWindows.workflowStatus': 'Workflow-Status',
  'workbench.toolWindows.activity': 'Aktivität',
  'workbench.toolWindows.activityTooltip': 'Aktivitäts-Feed — eingehende Änderungen von Peers',
  'workbench.toolWindows.trafficMonitor': 'Traffic',
  'workbench.toolWindows.terminal': 'Terminal',
  'workbench.toolWindows.git': 'Git · Versionsverwaltung',
  'workbench.toolWindows.versionControl': 'Versionsverwaltung',

  // ── Tool-window `(i)` info popovers. `{{live.*}}` / `{{name}}`
  //    reference chips compose raw in JSX between the keyed prefix/
  //    suffix fragments; the Notifications entry stays on the shared
  //    NOTIFICATIONS_PANEL_INFO corpus (panel co-consumer, Phase D). ───
  'workbench.toolWindows.info.serverAdmin.summary':
    'Diesen Server verwalten: Benutzer und ihre Zugriffe, gekoppelte Geräte, Repository-Bindungen und das ' +
    'Audit-Protokoll. Jede Zeile öffnet einen eigenen Tab.',
  'workbench.toolWindows.info.serverAdmin.domainsHeading': 'Verwaltungsbereiche',
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
  'workbench.terminal.openTui': 'TUI',
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
    'Der TUI-Modus wird vom Kommandozeilen-Tool oh angetrieben, das noch nicht mit dieser App verbunden ist.',
  'workbench.terminal.cliGate.bodyInfo.title': 'CLI-Verbindung',
  'workbench.terminal.cliGate.bodyInfo.summary':
    'Beim Verbinden wird ein Zugriffstoken erstellt und in {path} geschrieben. Die CLI oh liest diese ' +
    'Datei, um sich beim lokalen Daemon zu authentifizieren — nach dem Verbinden funktioniert oh in jedem ' +
    'Terminal auf diesem Rechner. Abbrechen erstellt kein Token.',
  'workbench.terminal.cliGate.enableMcp': 'MCP-Server aktivieren',
  'workbench.terminal.cliGate.enableMcpRider':
    'Solange der Endpunkt aus ist, meldet die TUI den Daemon als nicht erreichbar. Abwählen erstellt nur ' +
    'das Token.',
  'workbench.terminal.cliGate.ok': 'Verbinden und öffnen',
  'workbench.terminal.cliGate.installTitle': 'Die CLI von OpenHeaders installieren',
  'workbench.terminal.cliGate.installBody':
    'Der TUI-Modus wird vom Kommandozeilen-Tool oh angetrieben, das auf diesem Rechner noch nicht ' +
    'installiert ist. Zum Installieren in einem beliebigen Terminal ausführen, danach den TUI-Modus ' +
    'erneut öffnen:',
  'workbench.terminal.cliGate.installOk': 'Ein Terminal öffnen',
  'workbench.terminal.cliGate.openSettings': 'Einstellungen öffnen',
  'workbench.toolWindows.info.trafficMonitor.summary':
    'Die vereinte Live-Verkehrsansicht — wähle eine Quelle aus der Liste: einen verbundenen Browser-Tab (die Erweiterung ' +
    'streamt seinen Verkehr live) oder den System-Proxy (beliebige Tools dieser Maschine, die auf den ' +
    'lokalen Proxy-Port zeigen). Beide nutzen dasselbe Netzwerkprotokoll wie das DevTools-Panel; es wird nichts ' +
    'gestreamt, bis eine Quelle ausgewählt ist. Gespeicherte Sitzungen liegen unter SITZUNGEN — beim Ende ' +
    'automatisch benannt und abgelegt; ein Klick spielt sie in einem Tab wieder ab.',
  'workbench.toolWindows.info.terminal.summary':
    'Ein integriertes Terminal, das deine Shell in einem echten pty ausführt — alles, was in einem ' +
    'eigenständigen Terminal läuft, läuft auch hier, einschließlich der CLI oh gegen die lokale App.',
  'workbench.toolWindows.info.git.summary':
    'Die Commit-Historie der Git-Bindung des aktiven Workspace — die Workspace-Zeitleiste mit geänderten ' +
    'Dateien pro Commit, Autorenschaft und Historie pro Datei.',

  // ── Proxy capture tool window (control strip) ──────────────────
  'workbench.proxyCapture.running': 'Läuft · :{port}',
  'workbench.proxyCapture.stopped': 'Gestoppt',
  'workbench.proxyCapture.start': 'Starten',
  'workbench.proxyCapture.stop': 'Stoppen',
  'workbench.proxyCapture.port': 'Port',
  'workbench.proxyCapture.scope': 'Entschlüsselungsbereich',
  'workbench.proxyCapture.optionsAria': 'System-Proxy-Einstellungen',
  'workbench.proxyCapture.scopePlaceholder': 'example.com, *.example.com',
  'workbench.proxyCapture.scopeHint':
    'Nur gelistete Hosts werden entschlüsselt; der übrige HTTPS-Verkehr läuft als opaker Tunnel durch.',
  'workbench.proxyCapture.scopeSaved': 'Entschlüsselungsbereich aktualisiert',
  'workbench.proxyCapture.scopeFailed': 'Bereich konnte nicht aktualisiert werden: {message}',
  'workbench.proxyCapture.startFailed': 'Proxy konnte nicht gestartet werden: {message}',
  'workbench.proxyCapture.emptyRunning': 'Warten auf Proxy-Verkehr…',
  'workbench.proxyCapture.emptyRunningHint':
    'Richte jede beliebige App — CLI-Tools, Skripte, ein anderes Gerät — auf http://127.0.0.1:{port}, um ihre ' +
    'Anfragen zu erfassen',
  'workbench.proxyCapture.emptyStopped': 'Der Proxy ist gestoppt',
  'workbench.proxyCapture.emptyStoppedHint': 'Starte den Proxy, um Verkehr zu erfassen',
  'workbench.proxyCapture.noCa':
    'Keiner CA vertraut — Klartext-HTTP wird vollständig erfasst; HTTPS bleibt ein opaker Tunnel, bis du sie ' +
    'installierst.',
  'workbench.proxyCapture.noCaAction': 'CA installieren',
  'workbench.proxyCapture.routing': 'Browser routen',
  'workbench.proxyCapture.routingFailed': 'Routing konnte nicht aktualisiert werden: {message}',
  'workbench.proxyCapture.routingActiveLead':
    'Diese Browser senden Hosts im Entschlüsselungsbereich jetzt durch den Capture-Proxy; alles andere bleibt direkt.',
  'workbench.proxyCapture.routingCaveat':
    'HTTP/3 fällt auf gerouteten Hosts auf HTTP/2 oder 1.1 zurück, und Endpunkte mit Zertifikats-Pinning können ' +
    'fehlschlagen.',
  'workbench.proxyCapture.routingInactive': 'Browser routen Hosts im Bereich, sobald der Proxy läuft.',
  'workbench.proxyCapture.routingUnsupported': '{agent} · nicht unterstützt',
  'workbench.proxyCapture.scopeInfo.exampleCaption': 'Beispiel-Geltungsbereich',
  'workbench.proxyCapture.scopeInfo.exampleDecrypted': 'entschlüsselt',
  'workbench.proxyCapture.scopeInfo.exampleOpaque': 'opaker Tunnel',
  'workbench.proxyCapture.scopeInfo.summary':
    'Nur gelistete Hosts werden TLS-entschlüsselt und inspiziert — jede andere HTTPS-Verbindung läuft als opaker ' +
    'Tunnel durch, nie abgefangen.',
  'workbench.proxyCapture.scopeInfo.description':
    'Eine leere Liste entschlüsselt nichts: Abfangen ist immer eine explizite Entscheidung, Host für Host.',
  'workbench.proxyCapture.scopeInfo.patternsHeading': 'Muster',
  'workbench.proxyCapture.scopeInfo.exactDesc': 'Exakter Hostname — trifft nur den Apex.',
  'workbench.proxyCapture.scopeInfo.wildcardDesc': 'Jede Subdomain — nie der Apex selbst.',
  'workbench.proxyCapture.scopeInfo.ipDesc': 'Ein IP-Literal trifft exakt.',
  'workbench.proxyCapture.routingInfo.exampleCaption': 'Beispiel-Routing',
  'workbench.proxyCapture.routingInfo.summary':
    'Verbundene Browser leiten Hosts im Entschlüsselungsbereich durch den Capture-Proxy — keine ' +
    'OS-Proxy-Einstellungen, keine manuelle Einrichtung; alles andere bleibt direkt. Vor allem für Browser, die ' +
    'sich nicht direkt beobachten oder debuggen lassen.',
  'workbench.proxyCapture.routingInfo.description':
    'Das Routing bleibt bestehen, bis du es ausschaltest — ein App-Neustart oder Verbindungsabriss lässt den ' +
    'Browser nie hinter einem toten Proxy hängen.',
  'workbench.proxyCapture.routingInfo.behaviorHeading': 'Verhalten',
  'workbench.proxyCapture.routingInfo.appliedDesc':
    'Chromium-Browser wenden ein generiertes PAC an; Firefox routet pro Anfrage.',
  'workbench.proxyCapture.routingInfo.failoverDesc':
    'Ist der Capture-Port unerreichbar, fällt der Verkehr auf eine Direktverbindung zurück — eine Capture-Lücke, ' +
    'nie kaputtes Surfen.',
  'workbench.proxyCapture.routingInfo.h3Desc':
    'Geroutete Hosts fallen von HTTP/3 auf HTTP/2 oder 1.1 zurück; Endpunkte mit Certificate-Pinning können ' +
    'während des Routings fehlschlagen.',
  'workbench.proxyCapture.routingPopoverHint':
    'Leitet Hosts im Entschlüsselungsbereich verbundener Browser über den Capture-Proxy. Vor allem für Browser, die sich ' +
    'nicht direkt beobachten oder debuggen lassen — ein beobachtbarer Tab bekommt mehr über den Debug-Modus in ' +
    'seiner Zeile.',

  // ── Live-Netzwerk-Werkzeugfenster (Observability, Phase 1) ──────────
  'workbench.trafficMonitor.browserConnected': 'Verbundene Browser: {count}',
  'workbench.trafficMonitor.noBrowser': 'Kein Browser verbunden',
  'workbench.trafficMonitor.untitledTab': 'Unbenannter Tab',
  'workbench.trafficMonitor.closeSourceTab': 'Tab schließen',
  'workbench.trafficMonitor.railSideToRight': 'Quellen auf die rechte Seite verschieben',
  'workbench.trafficMonitor.railSideToLeft': 'Quellen auf die linke Seite verschieben',
  'workbench.trafficMonitor.extensionVersion': 'v{version}',
  'workbench.trafficMonitor.emptyWatching': 'Warte auf Verkehr…',
  'workbench.trafficMonitor.emptyWatchingHint': 'Surfe im beobachteten Tab — seine Anfragen erscheinen hier live',
  'workbench.trafficMonitor.browserTabs': 'Browser-Tabs',
  'workbench.trafficMonitor.windowLabel': 'Fenster {n}',
  'workbench.trafficMonitor.proxySystem': 'Proxy · System',
  'workbench.trafficMonitor.systemProxy': 'System-Proxy',
  'workbench.trafficMonitor.systemProxyHint':
    'Nicht-Browser- und nicht beobachtbarer Verkehr — alles, was über den Capture-Port geroutet wird: CLI-Tools, ' +
    'native Apps, andere Geräte',
  'workbench.trafficMonitor.emptyNoSource': 'Keine Quelle ausgewählt',
  'workbench.trafficMonitor.emptyNoSourceHint':
    'Wähle in der Quellenliste einen Browser-Tab oder den System-Proxy, um den zugehörigen Verkehr live zu sehen',
  'workbench.trafficMonitor.debugTab': 'Diesen Tab debuggen — volle Genauigkeit: Bodies, exakte Header, Timing',
  'workbench.trafficMonitor.debugAttached': 'Tab wird debuggt — volle Genauigkeit über den Debugger des Browsers',
  'workbench.trafficMonitor.debugPinned': 'Zum Debuggen angepinnt — verbindet sich, sobald der Debug-Modus an ist',
  'workbench.trafficMonitor.debugPinAria': 'Debugging für diesen Tab umschalten',
  'workbench.trafficMonitor.debugModeHint':
    'Debug-Modus — verbindet den Debugger des Browsers mit Tabs im Geltungsbereich und angepinnten Tabs für Bodies ' +
    'und exakte Header. Der Browser zeigt auf jedem verbundenen Tab einen Hinweis an.',
  'workbench.trafficMonitor.captureAria': 'Erfassungsoptionen für diese Quelle',
  'workbench.trafficMonitor.captureMenuStart': 'Erfassung starten',
  'workbench.trafficMonitor.captureMenuStartHint':
    'Behält den jüngsten Verkehr dieser Quelle: verbundene KI-Agents können ihn lesen (sensible Werte maskiert), ' +
    'und „Sitzung speichern“ zeichnet ihn auf die Festplatte auf. Das Betrachten der Live-Ansicht hier erfordert ' +
    'das nie.',
  'workbench.trafficMonitor.captureAdvanced': 'Erweitert',
  'workbench.trafficMonitor.captureDebugOptionHint':
    'Volle Detailtreue über den Debugger des Browsers — Antwortinhalte und exakte Header. Der Browser zeigt ein ' +
    'Debugging-Banner an.',
  'workbench.trafficMonitor.captureSaveOption': 'Sitzung speichern',
  'workbench.trafficMonitor.captureSaveOptionHint':
    'Zeichnet die Erfassung im verschlüsselten Sitzungsarchiv auf diesem Computer auf',
  'workbench.trafficMonitor.captureMenuStop': 'Erfassung stoppen',
  'workbench.trafficMonitor.captureMenuStopRecordingHint': 'Beendet die Aufzeichnung und behält die Sitzung',
  'workbench.trafficMonitor.sessionsTitle': 'Sitzungen',
  'workbench.trafficMonitor.noBrowsersHint':
    'Keine Browser verbunden. Öffne einen Browser mit installierter Erweiterung oder installiere sie:',
  'workbench.trafficMonitor.installExtension': 'Erweiterung für {browser} installieren',
  'workbench.trafficMonitor.watchConsentOff': 'Ansicht aus',
  'workbench.trafficMonitor.watchConsentOffHint':
    'Die Erweiterung dieses Browsers erlaubt der Desktop-App nicht, Verkehr, Speicher oder Konsole einzusehen. ' +
    'Regeln und Synchronisierung laufen weiter. Aktiviere „Desktop-App darf diesen Browser einsehen“ in den ' +
    'Einstellungen der Erweiterung, um ihn hier zu beobachten.',
  'workbench.trafficMonitor.watchConsentOffEmpty': 'Live-Ansicht ist in diesem Browser deaktiviert',
  'workbench.trafficMonitor.watchConsentOffEmptyHint':
    'Aktiviere „Desktop-App darf diesen Browser einsehen“ in den Einstellungen der Erweiterung, um Verkehr, ' +
    'Speicher und Konsole dieses Tabs hier zu beobachten',

  // ── Die SITZUNGEN-Sektion der Quellenleiste (das Sitzungsarchiv) ────
  'workbench.trafficSessions.empty': 'Noch keine gespeicherten Sitzungen',
  'workbench.trafficSessions.emptyHint':
    'Erfasse eine Quelle im Traffic-Panel mit aktiviertem „Sitzung speichern“ — gespeicherte Sitzungen ' +
    'landen hier',
  'workbench.trafficSessions.stateRecording': 'Aufzeichnung',
  'workbench.trafficSessions.stateSealing': 'Versiegeln…',
  'workbench.trafficSessions.move': 'In Ordner verschieben',
  'workbench.trafficSessions.moveNew': 'Neuer Ordner…',
  'workbench.trafficSessions.moveNone': 'Aus dem Ordner entfernen',
  'workbench.trafficSessions.deleteTitle': 'Diese Sitzung löschen?',
  'workbench.trafficSessions.deleteBody':
    '„{name}“ und alle aufgezeichneten Daten, auf die nur diese Sitzung verweist, werden von der Festplatte entfernt.',
  'workbench.trafficSessions.deleteOk': 'Löschen',
  'workbench.trafficSessions.deleteGroupTitle': '„{name}“ löschen?',
  'workbench.trafficSessions.deleteGroupBody':
    'Die enthaltenen {count} Sitzungen und alle aufgezeichneten Daten, auf die nur sie verweisen, werden von der Festplatte entfernt.',

  // ── Sitzungswiedergabe-Tab (C6) ─────────────────────────────────────
  'workbench.sessionReplay.empty': 'Diese Sitzung hat keine Anfragen aufgezeichnet',
  'workbench.sessionReplay.emptyHint':
    'Die Quelle wurde erfasst, aber während der Aufzeichnung floss kein Datenverkehr über sie',
  'workbench.sessionReplay.unavailableTitle': 'Diese Sitzung konnte nicht geöffnet werden',
  'workbench.sessionReplay.unavailableBody':
    'Die aufgezeichneten Daten fehlen oder sind beschädigt, oder sie sind mit einem Schlüssel verschlüsselt, den diese App nicht mehr besitzt.',

  // ── Git tool window (log view) ───────────────────────────────────
  'workbench.gitLog.filterPlaceholder': 'Text oder Hash',
  'workbench.gitLog.filter.regex': 'Regulärer Ausdruck',
  'workbench.gitLog.filter.matchCase': 'Groß-/Kleinschreibung',
  'workbench.gitLog.chip.branch': 'Branch',
  'workbench.gitLog.chip.tag': 'Tag',
  'workbench.gitLog.chip.user': 'Benutzer',
  'workbench.gitLog.chip.date': 'Datum',
  'workbench.gitLog.chip.paths': 'Pfade',
  'workbench.gitLog.chip.pathsCount': '{count} Pfade',
  'workbench.gitLog.menu.select': 'Auswählen…',
  'workbench.gitLog.menu.selectInTree': 'Im Baum auswählen…',
  'workbench.gitLog.menu.favorites': 'Favoriten',
  'workbench.gitLog.user.me': 'ich',
  'workbench.gitLog.date.last24h': 'Letzte 24 Stunden',
  'workbench.gitLog.date.last7d': 'Letzte 7 Tage',
  'workbench.gitLog.date.title': 'Nach Datum filtern',
  'workbench.gitLog.date.since': 'Von',
  'workbench.gitLog.date.until': 'Bis',
  'workbench.gitLog.paths.title': 'Nach Pfaden filtern',
  'workbench.gitLog.paths.hint': 'Ein repository-relativer Pfad pro Zeile — ein Ordner umfasst alles darunter.',
  'workbench.gitLog.modal.ok': 'OK',
  'workbench.gitLog.modal.cancel': 'Abbrechen',
  'workbench.gitLog.graphOptions': 'Graph-Optionen',
  'workbench.gitLog.sort.heading': 'Sortierung',
  'workbench.gitLog.sort.byDate': 'Nach Commit-Datum',
  'workbench.gitLog.sort.topo': 'Topologisch',
  'workbench.gitLog.options.heading': 'Optionen',
  'workbench.gitLog.options.firstParent': 'Erster Elternteil',
  'workbench.gitLog.options.noMerges': 'Ohne Merges',
  'workbench.gitLog.branchActions.heading': 'Branch-Aktionen',
  'workbench.gitLog.branchActions.collapseLinear': 'Lineare Branches einklappen',
  'workbench.gitLog.branchActions.expandLinear': 'Lineare Branches ausklappen',
  'workbench.gitLog.cherryPick': 'Cherry-Pick',
  'workbench.gitLog.viewOptions': 'Ansichtsoptionen',
  'workbench.gitLog.show.heading': 'Anzeigen',
  'workbench.gitLog.show.compactRefs': 'Kompakte Referenzansicht',
  'workbench.gitLog.show.tagNames': 'Tag-Namen',
  'workbench.gitLog.show.longEdges': 'Lange Kanten',
  'workbench.gitLog.show.commitTimestamp': 'Commit-Zeitstempel',
  'workbench.gitLog.show.refsOnLeft': 'Referenzen links',
  'workbench.gitLog.show.columns': 'Spalten',
  'workbench.gitLog.columns.author': 'Autor',
  'workbench.gitLog.columns.hash': 'Hash',
  'workbench.gitLog.columns.date': 'Datum',
  'workbench.gitLog.highlight.heading': 'Hervorheben',
  'workbench.gitLog.highlight.myCommits': 'Meine Commits',
  'workbench.gitLog.highlight.mergeCommits': 'Merge-Commits',
  'workbench.gitLog.highlight.currentBranch': 'Aktueller Branch',
  'workbench.gitLog.highlight.notCherryPicked': 'Nicht gecherry-pickte Commits',
  'workbench.gitLog.goTo': 'Gehe zu Hash/Branch/Tag',
  'workbench.gitLog.goTo.placeholder': 'Hash, Branch oder Tag',
  'workbench.gitLog.goTo.notFound': 'Im geladenen Verlauf nicht gefunden.',
  'workbench.gitLog.details.showDiff': 'Diff anzeigen',
  'workbench.gitLog.details.revertSelected': 'Ausgewählte Änderungen zurücksetzen',
  'workbench.gitLog.details.groupBy': 'Gruppieren nach',
  'workbench.gitLog.details.directory': 'Verzeichnis',
  'workbench.gitLog.details.layout': 'Layout',
  'workbench.gitLog.details.showDetails': 'Details anzeigen',
  'workbench.gitLog.details.showDiffPreview': 'Diff-Vorschau',
  'workbench.gitLog.refresh': 'Aktualisieren',
  'workbench.gitLog.empty':
    'Noch keine Commits — Commits entstehen gemäß der konfigurierten Kadenz, oder committe manuell unter Einstellungen › Git.',
  'workbench.gitLog.logTab': 'Log: {branch}',
  'workbench.gitLog.logTabAll': 'Log',
  'workbench.gitLog.closeTab': 'Tab schließen',
  'workbench.gitLog.newLogTab': 'Neuer Log-Tab',
  'workbench.gitLog.tabMenu': 'Tab-Optionen',
  'workbench.gitLog.console.tab': 'Konsole',
  'workbench.gitLog.console.show': 'Git-Konsole anzeigen',
  'workbench.gitLog.console.empty': 'Git-Befehle, die die App in diesem Repository ausführt, erscheinen hier.',
  'workbench.gitLog.tabMenu.settings': 'Einstellungen',
  'workbench.gitLog.options.showOnDoubleClick': 'Bei Doppelklick anzeigen',
  'workbench.gitLog.options.showOnDoubleClick.diff': 'Diff',
  'workbench.gitLog.options.showOnDoubleClick.source': 'Quelle',
  'workbench.gitLog.options.closeAll': 'Alle schließen',
  'workbench.gitLog.console.softWrap': 'Zeilenumbruch',
  'workbench.gitLog.console.scrollToEnd': 'Zum Ende scrollen',
  'workbench.gitLog.console.clearAll': 'Alles löschen',
  'workbench.gitLog.console.foldOptions': 'Optionen einklappen',
  'workbench.gitLog.console.shortenPaths': 'Pfade kürzen',
  'workbench.gitLog.noMatches': 'Keine Commits entsprechen den Filtern',
  'workbench.gitLog.resetFilters': 'Filter zurücksetzen',
  'workbench.gitLog.selectCommit': 'Wähle einen Commit, um seine Änderungen zu sehen',
  'workbench.gitLog.noneSelected': 'Kein Commit ausgewählt',
  'workbench.gitLog.commitsSelected': '{count} Commits ausgewählt',
  'workbench.gitLog.loadFailed': 'Historie konnte nicht geladen werden: {detail}',
  'workbench.gitLog.authorLine': '{author} <{email}> am {date}',
  'workbench.gitLog.coAuthors': 'Co-Autoren: {authors}',
  'workbench.gitLog.filesHeading': 'Geänderte Dateien',
  'workbench.gitLog.filesCount': '{count} Dateien',
  'workbench.gitLog.expandAll': 'Alle ausklappen',
  'workbench.gitLog.collapseAll': 'Alle einklappen',
  'workbench.gitLog.date.today': 'Heute {time}',
  'workbench.gitLog.date.yesterday': 'Gestern {time}',
  'workbench.gitLog.diff.title': 'Diff — {path}',
  'workbench.gitLog.diff.binary': 'Binärdatei — keine Textvorschau.',
  'workbench.gitLog.diff.tooLarge': 'Datei zu groß für die Vorschau ({size} KB).',
  'workbench.gitLog.rail.hide': 'Git-Branches ausblenden',
  'workbench.gitLog.rail.show': 'Git-Branches anzeigen',
  'workbench.gitLog.rail.branchesStrip': 'Branches',
  'workbench.gitLog.rail.newBranch': 'Neuer Branch',
  'workbench.gitLog.rail.updateSelected': 'Auswahl aktualisieren (Fast-Forward)',
  'workbench.gitLog.rail.deleteBranch': 'Branch löschen',
  'workbench.gitLog.rail.compareWithCurrent': 'Mit aktuellem Branch vergleichen',
  'workbench.gitLog.rail.showMyBranches': 'Meine Branches anzeigen',
  'workbench.gitLog.rail.fetch': 'Abrufen',
  'workbench.gitLog.rail.toggleFavorite': 'Als Favorit markieren/entfernen',
  'workbench.gitLog.rail.navigateToHead': 'Im Log zum Kopf des ausgewählten Branches springen',
  'workbench.gitLog.rail.paneSettings': 'Einstellungen des Branch-Bereichs',
  'workbench.gitLog.rail.singleClickHeading': 'Bei Einzelklick',
  'workbench.gitLog.rail.singleClickFilter': 'Branch-Filter aktualisieren',
  'workbench.gitLog.rail.singleClickNavigate': 'Im Log zum Branch-Kopf springen',
  'workbench.gitLog.rail.showTags': 'Tags anzeigen',
  'workbench.gitLog.rail.groupByDirectory': 'Nach Verzeichnis gruppieren',
  'workbench.gitLog.rail.expandAll': 'Alle aufklappen',
  'workbench.gitLog.rail.collapseAll': 'Alle zuklappen',
  'workbench.gitLog.rail.moreActions': 'Weitere Aktionen',
  'workbench.gitLog.createBranch.title': 'Branch aus {from} erstellen',
  'workbench.gitLog.createBranch.nameLabel': 'Branch-Name:',
  'workbench.gitLog.createBranch.checkout': 'Branch auschecken',
  'workbench.gitLog.createBranch.overwrite': 'Vorhandenen Branch überschreiben',
  'workbench.gitLog.createBranch.create': 'Erstellen',
  'workbench.gitLog.createBranch.cancel': 'Abbrechen',
  'workbench.gitLog.createBranch.exists':
    'Branch {name} existiert bereits — Überschreiben ankreuzen, um ihn zurückzusetzen.',
  'workbench.gitLog.createBranch.failed': 'Branch konnte nicht erstellt werden: {detail}',
  'workbench.gitLog.createBranch.checkedOut': 'Neuer Branch {branch} aus {from} ausgecheckt',
  'workbench.gitLog.createTag.title': 'Tag bei {sha} erstellen',
  'workbench.gitLog.createTag.nameLabel': 'Tag-Name:',
  'workbench.gitLog.createTag.create': 'Erstellen',
  'workbench.gitLog.createTag.exists': 'Tag {name} existiert bereits.',
  'workbench.gitLog.createTag.failed': 'Tag konnte nicht erstellt werden: {detail}',
  'workbench.gitLog.createTag.created': 'Tag {name} bei {sha} erstellt',
  'workbench.gitLog.createPatch.copied': 'Patch in die Zwischenablage kopiert',
  'workbench.gitLog.createPatch.failed': 'Patch konnte nicht erstellt werden: {detail}',
  'workbench.gitLog.createPatch.empty': 'Nichts für einen Patch: Ein Merge-Commit hat keine eigenen Änderungen.',
  'workbench.gitLog.createPatch.tooLarge': 'Der Patch ist zu groß, um ihn hier zu erstellen.',
  'workbench.gitLog.deleteBranch.deleted': 'Branch gelöscht: {branch}',
  'workbench.gitLog.deleteBranch.restore': 'Wiederherstellen',
  'workbench.gitLog.deleteBranch.failed': 'Branch konnte nicht gelöscht werden: {detail}',
  'workbench.gitLog.updateBranch.noUpstream': '{branch} hat keinen Upstream zum Aktualisieren.',
  'workbench.gitLog.updateBranch.failed': '{branch} konnte nicht aktualisiert werden: {detail}',
  'workbench.gitLog.fetch.noRemote': 'Keine Remotes konfiguriert.',
  'workbench.gitLog.fetch.failed': 'Abrufen fehlgeschlagen: {detail}',
  'workbench.gitRemotes.title': 'Git-Remotes',
  'workbench.gitRemotes.name': 'Name',
  'workbench.gitRemotes.url': 'URL',
  'workbench.gitRemotes.empty': 'Keine Remotes konfiguriert.',
  'workbench.gitRemotes.add': 'Remote hinzufügen',
  'workbench.gitRemotes.edit': 'Remote bearbeiten',
  'workbench.gitRemotes.remove': 'Remote entfernen',
  'workbench.gitRemotes.define.title': 'Remote definieren',
  'workbench.gitRemotes.define.nameEmpty': 'Geben Sie einen Remote-Namen ein.',
  'workbench.gitRemotes.define.nameInvalid':
    'Ein Remote-Name besteht aus Buchstaben, Ziffern, Punkten, Bindestrichen und Unterstrichen.',
  'workbench.gitRemotes.define.urlEmpty': 'Geben Sie eine URL ein.',
  'workbench.gitRemotes.define.urlInvalid': 'Eine URL darf nicht mit einem Bindestrich beginnen.',
  'workbench.gitRemotes.exists': 'Remote {name} existiert bereits.',
  'workbench.gitRemotes.unknown': 'Remote {name} existiert nicht mehr.',
  'workbench.gitRemotes.failed': 'Remotes konnten nicht aktualisiert werden: {detail}',
  'workbench.gitRemotes.listFailed': 'Remotes konnten nicht gelesen werden: {detail}',
  'workbench.gitRemotes.removeConfirm': 'Remote {name} entfernen?',
  'workbench.gitRemotes.removeConfirmBody': 'Die zugehörigen Remote-Tracking-Branches werden ebenfalls entfernt.',
  'workbench.gitRemotes.removeOk': 'Entfernen',
  'workbench.gitLog.shallow.tag': 'Flacher Klon',
  'workbench.gitLog.shallow.tooltip':
    'Dieser Klon hat eine gekürzte Historie. Log und Vergleich enden an der Grenze, und ein Pull oder Merge darüber hinaus behandelt jede entfernte Datei als geändert. Führen Sie git fetch --unshallow aus, um ihn zu vervollständigen.',
  'workbench.gitLog.compareTab': 'Vergleich: {a} und {b}',
  'workbench.gitLog.compare.onlyIn': 'Commits, die in {a} existieren, aber nicht in {b}',
  'workbench.gitLog.compare.containsAll': '{a} enthält alle Commits aus {b}',
  'workbench.gitLog.compare.failed': 'Vergleich nicht möglich: {detail}',
  'workbench.gitLog.refMenu.checkout': 'Auschecken',
  'workbench.gitLog.refMenu.newBranchFrom': 'Neuer Branch von {name}…',
  'workbench.gitLog.refMenu.checkoutAndRebase': 'Auschecken und auf {current} rebasen',
  'workbench.gitLog.refMenu.compareWithCurrent': 'Mit aktuellem vergleichen',
  'workbench.gitLog.refMenu.showDiffWithWorkingTree': 'Diff zum Arbeitsbaum anzeigen',
  'workbench.gitLog.refMenu.rebaseCurrentOnto': 'Aktuellen auf {name} rebasen',
  'workbench.gitLog.refMenu.mergeIntoCurrent': '{name} in {current} mergen',
  'workbench.gitLog.refMenu.update': 'Aktualisieren (Fast-Forward)',
  'workbench.gitLog.refMenu.updateCurrent': 'Aktualisieren (Pull)',
  'workbench.gitLog.refMenu.push': 'Pushen…',
  'workbench.gitLog.refMenu.rename': 'Umbenennen…',
  'workbench.gitLog.refMenu.delete': 'Löschen',
  'workbench.gitLog.commitMenu.copyRevision': 'Revisionsnummer kopieren',
  'workbench.gitLog.commitMenu.createPatch': 'Patch erstellen…',
  'workbench.gitLog.commitMenu.copyAsPatch': 'Als Patch in die Zwischenablage kopieren',
  'workbench.gitLog.commitMenu.checkoutRevision': 'Revision auschecken',
  'workbench.gitLog.commitMenu.compareWithLocal': 'Mit lokaler Version vergleichen',
  'workbench.gitLog.commitMenu.revert': 'Commit rückgängig machen (Revert)',
  'workbench.gitLog.commitMenu.goToChild': 'Zum untergeordneten Commit',
  'workbench.gitLog.commitMenu.goToParent': 'Zum übergeordneten Commit',
  'workbench.gitBranch.widget.aria': 'Git-Branch: {branch}',
  'workbench.gitBranch.widget.detached': 'HEAD · {sha}',
  'workbench.gitBranch.widget.behind': 'Eingehende Commits: {count}',
  'workbench.gitBranch.widget.ahead': 'Ausgehende Commits: {count}',
  'workbench.gitBranch.popup.search': 'Branches und Aktionen suchen',
  'workbench.gitBranch.popup.settings': 'Einstellungen des Branch-Popups',
  'workbench.gitBranch.popup.noMatches': 'Keine passenden Branches oder Aktionen',
  'workbench.gitBranch.action.updateWorkspace': 'Workspace aktualisieren (Pull)',
  'workbench.gitBranch.action.commit': 'Commit…',
  'workbench.gitBranch.action.push': 'Push…',
  'workbench.gitBranch.action.newBranch': 'Neuer Branch…',
  'workbench.gitLog.jumpToSource.noEditor': 'Kein Editor für {path}',
  'workbench.gitBranch.group.recent': 'Zuletzt verwendet',
  'workbench.gitPush.title': 'Commits pushen nach {folder}',
  'workbench.gitPush.noUpstream': 'Upstream wird beim ersten Push gesetzt',
  'workbench.gitPush.nothing': 'Alles ist aktuell. Nichts zu pushen.',
  'workbench.gitPush.detached': 'HEAD ist losgelöst. Zum Pushen einen Branch auschecken.',
  'workbench.gitPush.push': 'Pushen',
  'workbench.gitPush.cancel': 'Abbrechen',
  'workbench.gitPush.rejected.title': 'Push abgelehnt',
  'workbench.gitPush.rejected.body':
    'Der Push des aktuellen Branches „{branch}“ wurde abgelehnt. Remote-Änderungen müssen vor dem Push zusammengeführt werden.',
  'workbench.gitPush.rejected.merge': 'Zusammenführen',
  'workbench.gitPush.failed': 'Die zu pushenden Commits konnten nicht ermittelt werden: {detail}',
  'workbench.gitBranch.pushNoPermission':
    'Das Remote hat den Push abgelehnt: keine Berechtigung. „Commit und Push“ im Commit-Fenster kann die Arbeit als neuen Branch veröffentlichen.',
  'workbench.gitLog.switch.checkedOut': '{branch} ausgecheckt',
  'workbench.gitLog.switch.failed': '{branch} konnte nicht ausgecheckt werden: {detail}',
  'workbench.gitLog.switch.dirtyTitle': 'Du hast nicht committete Änderungen',
  'workbench.gitLog.switch.dirtyBody': ({ count, branch }, locale) =>
    formatMessage(
      plural(locale, Number(count), {
        one: 'Committe, stashe oder verwirf {count} nicht committete Änderung, bevor du zu {branch} wechselst.',
        other: 'Committe, stashe oder verwirf {count} nicht committete Änderungen, bevor du zu {branch} wechselst.',
      }),
      { branch: String(branch) },
    ),
  'workbench.gitLog.switch.commit': 'Committen und wechseln',
  'workbench.gitLog.switch.stash': 'Stashen und wechseln',
  'workbench.gitLog.switch.discard': 'Änderungen verwerfen',
  'workbench.gitLog.switch.discardConfirm.title': 'Nicht committete Änderungen verwerfen?',
  'workbench.gitLog.switch.discardConfirm.body':
    'Jede nicht committete Änderung wird gelöscht, neue Dateien eingeschlossen. Das lässt sich nicht rückgängig machen.',
  'workbench.gitLog.switch.discardConfirm.ok': 'Verwerfen',
  'workbench.gitLog.merge.done': '{ref} in {branch} gemergt ({sha})',
  'workbench.gitLog.merge.upToDate': '{branch} enthält {ref} bereits',
  'workbench.gitLog.merge.doneShallow':
    '{ref} in {branch} gemergt. Der flache Klon verbirgt die gemeinsame Historie, daher galt jede Datei aus {ref} als geändert.',
  'workbench.gitLog.merge.doneUnrelated':
    '{ref} in {branch} gemergt. Die Historien teilen keinen gemeinsamen Commit, daher galt jede Datei aus {ref} als geändert.',
  'workbench.gitLog.merge.failed': '{ref} konnte nicht gemergt werden: {detail}',
  'workbench.gitLog.keptLocal':
    'Beide Seiten haben {files} geändert. Deine Version wurde behalten, die eingehende Änderung wurde nicht übernommen.',
  'workbench.gitLog.applyCommit.picked': 'Cherry-Pick abgeschlossen',
  'workbench.gitLog.applyCommit.reverted': 'Revert abgeschlossen',
  'workbench.gitLog.applyCommit.pickFailed': 'Cherry-Pick von {commit} fehlgeschlagen: {detail}',
  'workbench.gitLog.applyCommit.revertFailed': 'Revert von {commit} fehlgeschlagen: {detail}',
  'workbench.gitLog.applyCommit.pickEmpty':
    'Kein Cherry-Pick aus {commit} nötig: Der Branch enthält diese Änderung bereits.',
  'workbench.gitLog.applyCommit.revertEmpty':
    'Kein Revert von {commit} nötig: Der Branch enthält diese Änderung nicht mehr.',
  'workbench.gitLog.applyCommit.conflicts':
    'Der Branch und der Commit {commit} haben beide {files} geändert. Es wurde nichts angewendet.',
  'workbench.gitLog.applyCommit.unsupported':
    'Der Commit {commit} hat keine einzelne Änderung, die sich anwenden lässt: Er ist ein Merge oder der erste Commit.',
  'workbench.gitLog.applyCommit.leftOut':
    'Ein Teil der Änderung wurde ausgelassen, weil der Branch nicht dazu passt: {files}.',
  'workbench.gitLog.forcePush.title': 'Die Remote-Historie wurde umgeschrieben',
  'workbench.gitLog.forcePush.body':
    'Der Remote-Branch enthält die zuletzt synchronisierte Historie ({sha}) nicht mehr. Pull, Push und Merge warten auf deine Wahl — nichts ändert sich, bis du entscheidest.',
  'workbench.gitLog.forcePush.abandon': 'Lokale Änderungen aufgeben',
  'workbench.gitLog.forcePush.abandonConfirm.title': 'Lokale Änderungen aufgeben?',
  'workbench.gitLog.forcePush.abandonConfirm.body':
    'Lokale Commits seit der letzten Synchronisierung werden verworfen, und die umgeschriebene Remote-Historie wird der Arbeitsbereich-Zustand.',
  'workbench.gitLog.forcePush.abandonConfirm.ok': 'Aufgeben',
  'workbench.gitLog.forcePush.rescue': 'Auf einem Rettungs-Branch bewahren',
  'workbench.gitLog.forcePush.reapply': 'Obendrauf neu anwenden',
  'workbench.gitLog.forcePush.resolved': 'Umgeschriebene Historie übernommen ({sha})',
  'workbench.gitLog.forcePush.rescued': 'Lokale Historie auf {branch} bewahrt',
  'workbench.gitLog.forcePush.failed': 'Ließ sich nicht auflösen: {detail}',
  'workbench.gitLog.fileMenu.showDiff': 'Diff anzeigen',
  'workbench.gitLog.fileMenu.showHistory': 'Verlauf anzeigen',
  'workbench.gitLog.fileMenu.showCurrentRevision': 'Aktuelle Revision anzeigen',
  'workbench.gitLog.fileMenu.jumpToSource': 'Zur Quelle springen',
  'workbench.gitLog.fileHistory.title': 'Verlauf: {path}',
  'workbench.gitLog.fileHistory.empty': 'Kein Commit berührt diese Datei.',
  'workbench.gitLog.fileHistory.failed': 'Verlauf konnte nicht gelesen werden: {detail}',

  // ── Commit tool window ───────────────────────────────────────────
  'workbench.toolWindows.commit': 'Git · Commit',
  'workbench.toolWindows.info.commit.summary':
    'Änderungen der Git-Bindung des aktiven Workspace committen — abhakbarer Änderungsbaum, ' +
    'Commit-Nachricht und Commit / Commit und Push mit Ihrer eigenen Git-Identität und Ihren Hooks.',
  'workbench.commitTool.groups.changes': 'Änderungen',
  'workbench.commitTool.oneFile': '1 Datei',
  'workbench.commitTool.oneDirectory': '1 Verzeichnis',
  'workbench.commitTool.directoriesCount': '{count} Verzeichnisse',
  'workbench.commitTool.dirsAndFiles': '{dirs} und {files}',
  'workbench.commitTool.renamedFrom': '- umbenannt von {name}',
  'workbench.commitTool.groups.unversioned': 'Nicht versionierte Dateien',
  'workbench.commitTool.groups.ignored': 'Ignorierte Dateien',
  'workbench.commitTool.refresh': 'Aktualisieren',
  'workbench.commitTool.rollback': 'Zurücksetzen…',
  'workbench.commitTool.shelve': 'Stillschweigend zurückstellen',
  'workbench.commitTool.show': 'Anzeigen',
  'workbench.commitTool.ignoredFiles': 'Ignorierte Dateien',
  'workbench.commitTool.selectOpened': 'Geöffnete Datei in der Änderungsansicht auswählen',
  'workbench.commitTool.amend': 'Amend',
  'workbench.commitTool.historyTooltip': 'Verlauf der Commit-Nachrichten',
  'workbench.commitTool.historyEmpty': 'Noch keine committeten Nachrichten',
  'workbench.commitTool.messagePlaceholder': 'Commit-Nachricht',
  'workbench.commitTool.commit': 'Commit',
  'workbench.commitTool.commitAndPush': 'Commit und Push',
  'workbench.commitTool.amendCommit': 'Amend-Commit',
  'workbench.commitTool.amendCommitAndPush': 'Amend-Commit und Push',
  'workbench.commitTool.amendBy': 'Von',
  'workbench.commitTool.optionsTooltip': 'Commit-Optionen anzeigen',
  'workbench.commitTool.options.gitSection': 'Git',
  'workbench.commitTool.options.signOff': 'Commit mit Sign-off',
  'workbench.commitTool.options.runGitHooks': 'Git-Hooks ausführen',
  'workbench.commitTool.counter.modified': '{count} geändert',
  'workbench.commitTool.counter.added': '{count} hinzugefügt',
  'workbench.commitTool.counter.deleted': '{count} gelöscht',
  'workbench.commitTool.counter.unversioned': '{count} nicht versioniert',
  'workbench.commitTool.nothingToCommit': 'Keine Änderungen in den ausgewählten Dateien',
  'workbench.commitTool.committed': 'Commit {sha} erstellt',
  'workbench.commitTool.detached.message':
    'Losgelöster HEAD bei {sha} — ein Commit hier gehört zu keinem Branch. Erstellen Sie einen Branch, um diese Arbeit zu behalten.',
  'workbench.commitTool.detached.newBranch': 'Neuer Branch von HEAD…',
  'workbench.commitTool.menu.commitFile': 'Datei committen…',
  'workbench.commitTool.menu.commitFiles': 'Dateien committen…',
  'workbench.commitTool.menu.commitDirectory': 'Verzeichnis committen…',
  'workbench.commitTool.menu.commit': 'Committen…',
  'workbench.commitTool.menu.moveToChangelist': 'In andere Änderungsliste verschieben…',
  'workbench.commitTool.menu.showDiff': 'Diff anzeigen',
  'workbench.commitTool.menu.showDiffNewTab': 'Diff in neuem Tab anzeigen',
  'workbench.commitTool.menu.jumpToSource': 'Zur Quelle springen',
  'workbench.commitTool.menu.delete': 'Löschen…',
  'workbench.commitTool.menu.addToVcs': 'Zur Versionsverwaltung hinzufügen',
  'workbench.commitTool.menu.addToGitignore': 'Zu .gitignore hinzufügen',
  'workbench.commitTool.menu.excludeFile': '.git/info/exclude',
  'workbench.commitTool.menu.newChangelist': 'Neue Änderungsliste…',
  'workbench.commitTool.menu.editChangelist': 'Änderungsliste bearbeiten…',
  'workbench.commitTool.menu.createPatch': 'Patch aus lokalen Änderungen erstellen…',
  'workbench.commitTool.menu.copyPatch': 'Als Patch in die Zwischenablage kopieren',
  'workbench.commitTool.menu.shelveChanges': 'Änderungen zurückstellen…',
  'workbench.commitTool.menu.localHistory': 'Lokaler Verlauf',
  'workbench.commitTool.menu.localHistoryShow': 'Verlauf anzeigen…',
  'workbench.commitTool.menu.showProjectHistory': 'Projektverlauf anzeigen…',
  'workbench.commitTool.menu.recentChanges': 'Letzte Änderungen',
  'workbench.commitTool.menu.putLabel': 'Label setzen…',
  'workbench.commitTool.menu.git': 'Git',
  'workbench.commitTool.menu.add': 'Hinzufügen',
  'workbench.commitTool.menu.compareRevision': 'Mit Revision vergleichen…',
  'workbench.commitTool.menu.compareBranch': 'Mit Branch oder Tag vergleichen…',
  'workbench.commitTool.menu.showHistory': 'Verlauf anzeigen',
  'workbench.commitTool.menu.showCurrentRevision': 'Aktuelle Revision anzeigen',
  'workbench.commitTool.menu.push': 'Push…',
  'workbench.commitTool.menu.pull': 'Pull…',
  'workbench.commitTool.menu.fetch': 'Abrufen',
  'workbench.commitTool.menu.merge': 'Zusammenführen…',
  'workbench.commitTool.menu.rebase': 'Rebase…',
  'workbench.commitTool.menu.branches': 'Branches…',
  'workbench.commitTool.menu.newBranch': 'Neuer Branch…',
  'workbench.commitTool.menu.newTag': 'Neues Tag…',
  'workbench.commitTool.menu.resetHead': 'HEAD zurücksetzen…',
  'workbench.commitTool.menu.stash': 'Änderungen in Stash ablegen…',
  'workbench.commitTool.menu.unstash': 'Änderungen aus Stash holen…',
  'workbench.commitTool.menu.github': 'GitHub',
  'workbench.commitTool.menu.manageRemotes': 'Remotes verwalten…',
  'workbench.commitTool.menu.clone': 'Klonen…',
  'workbench.commitTool.menu.comparePickerTitle': 'Mit Branch oder Tag vergleichen',
  'workbench.commitTool.menu.comparePickerSearch': 'Branches und Tags durchsuchen',
  'workbench.commitTool.menu.comparePickerEmpty': 'Keine passenden Referenzen',
  'workbench.commitTool.menu.pullUpToDate': 'Bereits aktuell',
  'workbench.commitTool.menu.pullDone': 'Pull abgeschlossen',
  'workbench.commitTool.menu.pullDoneShallow':
    'Pull abgeschlossen. Der flache Klon verbirgt die gemeinsame Historie, daher wurde jede entfernte Datei als geändert behandelt.',
  'workbench.commitTool.menu.pullDoneUnrelated':
    'Pull abgeschlossen. Die Historien haben keinen gemeinsamen Commit, daher wurde jede entfernte Datei als geändert behandelt.',
  'workbench.commitTool.menu.pullFailed': 'Pull fehlgeschlagen: {detail}',
  'workbench.commitTool.menu.ignoreFailed': 'Ignore-Datei konnte nicht aktualisiert werden: {detail}',
  'workbench.commitTool.menu.addToVcsFailed': 'Konnte nicht zur VCS hinzufügen: {detail}',
  'workbench.commitTool.menu.deleteFailed': 'Konnte nicht löschen: {detail}',
  'workbench.commitTool.delete.confirmTitle': '{files} löschen?',
  'workbench.commitTool.delete.confirmBody':
    'Die Dateien werden von der Festplatte entfernt. Eine versionierte Datei gilt bis zum Commit als gelöscht; eine unversionierte Datei ist weg.',
  'workbench.commitTool.delete.ok': 'Löschen',
  'workbench.commitTool.menu.rollbackFailed': 'Konnte nicht zurücksetzen: {detail}',
  'workbench.commitTool.rollbackAdded.confirmTitle': '{files} zurücksetzen?',
  'workbench.commitTool.rollbackAdded.confirmBody':
    'Die Dateien verlassen den Index und kehren zu den unversionierten Dateien zurück. Auf der Festplatte ändert sich nichts.',
  'workbench.commitTool.rollbackAdded.ok': 'Zurücksetzen',
  'workbench.commitTool.menu.stopIgnoring': 'Nicht mehr ignorieren',
  'workbench.commitTool.ignoreSourceGlobal': 'global',
  'workbench.commitTool.menu.fetchDone': 'Abrufen abgeschlossen',
  'workbench.commitTool.pushed': 'Gepusht',
  'workbench.commitTool.nothingToPush': 'Nichts zu pushen',
  'workbench.commitTool.errors.notARepo': 'Dieser Workspace hat kein Git-Repository',
  'workbench.commitTool.errors.gitUnavailable': 'Git ist auf diesem Rechner nicht verfügbar',
  'workbench.commitTool.errors.emptyMessage': 'Geben Sie eine Commit-Nachricht ein',
  'workbench.commitTool.errors.noPaths': 'Wählen Sie mindestens eine Datei zum Committen aus',
  'workbench.commitTool.errors.amendUnborn': 'Es gibt noch keinen Commit zum Amenden',
  'workbench.commitTool.errors.amendMerge': 'Merge-Commits können nicht amendet werden',
  'workbench.commitTool.errors.amendPushed':
    'HEAD ist bereits zum Upstream gepusht — Amend würde veröffentlichte Historie umschreiben',
  'workbench.commitTool.errors.stageFailed': 'Die ausgewählten Dateien konnten nicht gestagt werden',
  'workbench.commitTool.errors.commitFailed': 'Commit fehlgeschlagen',
  'workbench.commitTool.errors.pushFailed': 'Push fehlgeschlagen',
  'workbench.commitTool.errors.pushRejected': 'Das Remote hat neue Commits — pulle zuerst und pushe dann erneut.',
  'workbench.commitTool.errors.historyRewritten':
    'Die Remote-Historie wurde umgeschrieben — löse das zuerst im Banner auf.',
  'workbench.commitTool.pushNoPermission.title': 'Kein Push-Zugriff',
  'workbench.commitTool.pushNoPermission.body':
    'Dieses Remote ist für dich schreibgeschützt. Deine Commits bleiben lokal; veröffentliche sie als neuen Branch und eröffne bei deinem git-Host einen Merge-Request.',
  'workbench.commitTool.pushNoPermission.placeholder': 'neuer-branch-name',
  'workbench.commitTool.pushNoPermission.button': 'Als neuen Branch pushen',
  'workbench.commitTool.pushNoPermission.pushed': 'Branch {branch} gepusht',
  'workbench.gitLog.refs.search': 'Branch oder Tag',
  'workbench.gitLog.refs.head': 'HEAD (aktueller Branch)',
  'workbench.gitLog.refs.headDetached': 'HEAD · {sha} (losgelöst)',
  'workbench.gitLog.refs.local': 'Lokal',
  'workbench.gitLog.refs.remote': 'Remote',
  'workbench.gitLog.refs.tags': 'Tags',
  'workbench.gitLog.refs.empty': 'Branches erscheinen nach dem ersten Commit.',

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
  'workbench.whatsNew.historyTitle': 'Frühere Versionen',
  'workbench.whatsNew.historyShowNotes': 'Hinweise anzeigen',
  'workbench.whatsNew.historyHideNotes': 'Hinweise ausblenden',
  'workbench.whatsNew.historyNotesUnavailable': 'Die Versionshinweise konnten nicht geladen werden.',
  'workbench.whatsNew.historyBetaTag': 'Beta',
  'workbench.whatsNew.historySecurityTag': 'Sicherheit',

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
    'Die ausgelieferten Meilensteine — Git-Arbeitsbereiche, Desktop-App, MCP-Server, selbst gehosteter Server, CLI, Web-App, ' +
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

  // ── Copy-as-snippet toasts (sidebar row menu + request editor ⋯) ────
  'workbench.copySnippet.copied': 'Als {format} kopiert',
  'workbench.copySnippet.failed': 'Kopieren fehlgeschlagen',
  'workbench.copySnippet.failedDetail': 'Kopieren fehlgeschlagen: {message}',
  'workbench.copySnippet.copiedWithReferences':
    'Als {format} kopiert – {references} als Referenz geschrieben; der Wert eines Secret-Managers gelangt nie in einen kopierten Befehl.',

  // ── Report Issue dialog (Help menu, Settings › About) ───────────
  'workbench.support.title.bug': 'Problem melden',
  'workbench.support.title.feature': 'Funktionswunsch',
  'workbench.support.kind.bug': 'Fehlerbericht',
  'workbench.support.kind.feature': 'Funktionswunsch',
  'workbench.support.field.title': 'Titel',
  'workbench.support.field.steps': 'Schritte zum Nachstellen',
  'workbench.support.field.steps.hint':
    'Die Schritte, mit denen sich das Problem zuverlässig nachstellen lässt, mit tatsächlichem und erwartetem Ergebnis.',
  'workbench.support.field.description': 'Beschreibung',
  'workbench.support.field.description.hint':
    'Der Arbeitsablauf, den Sie erreichen möchten, und das gewünschte Verhalten.',
  'workbench.support.field.markdownHint':
    'Markdown wird unterstützt; auf GitHub können Sie das Issue bearbeiten und Screenshots anhängen.',
  'workbench.support.facts.include': 'Systeminformationen beifügen',
  'workbench.support.facts.show': 'anzeigen',
  'workbench.support.facts.hide': 'ausblenden',
  'workbench.support.facts.unavailable':
    'Systeminformationen sind auf diesem Host nicht verfügbar; tragen Sie Version und Plattform auf GitHub ein.',
  'workbench.support.logs.notice':
    'Protokolle sind nicht enthalten. Hängen Sie das Diagnosepaket auf GitHub an das Issue an, wenn es hilft.',
  'workbench.support.logs.saveBundle': 'Anonymisiertes Diagnosepaket herunterladen…',
  'workbench.support.trimmed.rows':
    'Einige Systemzeilen wurden weggelassen, damit der Link kurz bleibt; das Diagnosepaket enthält sie alle.',
  'workbench.support.trimmed.facts':
    'Die Systeminformationen wurden weggelassen, damit der Link kurz bleibt; das Diagnosepaket enthält sie.',
  'workbench.support.overBudget':
    'Der Text ist zu lang für einen vorausgefüllten Link. Kürzen Sie ihn hier und ergänzen Sie den Rest auf GitHub.',
  'workbench.support.preview': 'Auf GitHub ansehen',
} as const satisfies Catalog;
