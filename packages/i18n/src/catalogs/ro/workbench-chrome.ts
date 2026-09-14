/**
 * Workbench chrome — the shell plane — Romanian. Mirrors
 * `catalogs/en/workbench-chrome.ts` key for key; extends the ro
 * register contract (`ro/shared.ts`). Reuses shipped mints: the
 * layout-menu wording quoted verbatim from the `ro/panel.ts` twin
 * (Aspect panou inferior, Centrat (imbricat), Alăturat / Suprapus,
 * Afișare nume ferestre de instrumente, Compact (cel de jos fixat),
 * Proporțional (jumătăți egale), the donor tooltips, Resetare aspect
 * la valorile implicite, Restaurare instrumente ascunse din bara de
 * activități), Schiță = Scratch (shared-chrome), fixare = pin
 * (trusted-roots / shared-chrome), Certificate de încredere
 * (trusted-roots), noutăți = What's New (shared-notifications), Proxy
 * de sistem (panel-network), modul Depanare, „Permiteți aplicației
 * desktop să vadă acest browser” and „Trafic” quoted from ro/popup,
 * Biblioteca de pachete (script-packages), serverul din amonte
 * (info-status), sesiune = session (notifications), bara de activități
 * = the activity bar (panel), fila urmărită = the watched tab
 * (panel-network). MINTS: Interceptor de browser = Browser
 * Interceptor; separator = splitter (Anulare împărțire = unsplit);
 * paleta de comenzi = command palette; Flux de activitate = Activity
 * Feed (bara de activități stays the activity bar); peer raw
 * (carried); pastila-semafor = the traffic-light status pill; emitere =
 * mint (a token); sfera de decriptare = decrypt scope (sferă is legal
 * here — a variable-plane scope); tunel opac = opaque tunnel; listă de
 * modificări = changelist; amânare = shelve (Amânare fără confirmare =
 * Shelve Silently); stocare temporară = stash (Stocare temporară a
 * modificărilor… / Restaurare modificări stocate temporar…);
 * Modificare ultimul commit = Amend; Cherry-pick raw; revizie =
 * revision; neversionate = unversioned; Topologic = topologically;
 * Administrare server = Server Admin (the server-admin file quotes
 * it); acordare de acces = grant; Controlul versiunilor = Version
 * Control; Jurnal = the Log tab; Ramură / Etichetă / Utilizator / Dată
 * / Căi chips; Push / Pull / Fetch / Rebase / Diff ride raw as the git
 * verbs (Commit și Push…, Fetch eșuat, Afișare Diff); Îmbinare… =
 * Merge…; commit-uri = the loanword plural (commit is not a glossary
 * token). Raw by design: `Docs` / `Params` tab names (gRPC precedent),
 * auth scheme and body-mode enums (Basic, Bearer Token, Form data,
 * raw, GraphQL), Chrome ResourceType values (Page, Frame, Fetch/XHR,
 * Script), DNR / AND / DOM / TLS, Vault / Live labels, lowercase vault
 * / live / shell / pty / oh (token case follows en), the proxy scope
 * placeholder wire value, footer key caps (↑↓ / ← / → / ↵ / esc) and
 * the {chord} / {unit} / {units} holes. Bold-prefix bodies open with
 * the head noun and no leading space (Fila conține …, Elementul nu a
 * fost …) since the render site joins `<strong>{label}</strong>
 * {body}` with its own space; prefix / suffix sandwiches keep their
 * en edge spaces. The draft seed `New {name}` lands on the hole's own
 * label (`{name} (nouă)` — every filler is a feminine „Regulă …” from
 * this file) and the palette row reads `Creare: {type}`; `{a}` / `{b}`
 * / `{branch}` / `{from}` refs take ramura as head noun or a
 * preposition with no ending; the `{unit}` toast reads `Acest element
 * ({unit}) a fost comutat la` + ` și setat ca activ` (App.tsx joins
 * prefix + glyph + name + suffix).
 */

import type { Catalog } from '../../types';

export const workbenchChrome = {
  // ── Tab strip: context menu ─────────────────────────────────────────
  'workbench.tabbar.menu.duplicateTab': 'Duplicare filă',
  'workbench.tabbar.menu.close': 'Închidere',
  'workbench.tabbar.menu.closeOther': 'Închidere celelalte file',
  'workbench.tabbar.menu.closeAll': 'Închidere toate filele',
  'workbench.tabbar.menu.closeUnmodified': 'Închidere filele nemodificate',
  'workbench.tabbar.menu.closeLeft': 'Închidere filele din stânga',
  'workbench.tabbar.menu.closeRight': 'Închidere filele din dreapta',
  'workbench.tabbar.menu.splitAndMove': 'Împărțire și mutare',
  'workbench.tabbar.menu.right': 'Dreapta',
  'workbench.tabbar.menu.left': 'Stânga',
  'workbench.tabbar.menu.down': 'Jos',
  'workbench.tabbar.menu.up': 'Sus',
  'workbench.tabbar.menu.moveOpposite': 'Mutare în grupul opus',
  'workbench.tabbar.menu.changeSplitterOrientation': 'Schimbare orientare separator',
  'workbench.tabbar.menu.unsplit': 'Anulare împărțire',
  'workbench.tabbar.menu.unsplitAll': 'Anulare toate împărțirile',

  // ── Tab strip: close guard confirms (useTabLifecycle) ───────────────
  // The dialog bodies follow a bolded tab label in the JSX, so they key
  // as the sentence remainder (OnboardingTour bold-prefix idiom).
  'workbench.tabbar.closeGuard.unsavedTitle': 'Salvare modificări?',
  'workbench.tabbar.closeGuard.unsavedBody':
    'Fila conține modificări nesalvate. Salvați-le pentru a nu vă pierde munca.',
  'workbench.tabbar.closeGuard.dontSave': 'Fără salvare',
  'workbench.tabbar.closeGuard.cancel': 'Anulare',
  'workbench.tabbar.closeGuard.save': 'Salvare modificări',
  'workbench.tabbar.closeGuard.draftTitle': 'Renunțare la ciornă?',
  'workbench.tabbar.closeGuard.draftBody':
    'Elementul nu a fost publicat încă. Renunțarea șterge ciorna; păstrarea o lasă în bara laterală, ca să o finalizați mai târziu.',
  'workbench.tabbar.closeGuard.discard': 'Renunțare',
  'workbench.tabbar.closeGuard.keep': 'Păstrare ca ciornă',

  // ── Tab strip: bar chrome + search overlay ──────────────────────────
  'workbench.tabbar.createApiRequest': 'Creare cerere API',
  'workbench.tabbar.createRule': 'Creare regulă',
  'workbench.tabbar.createItem': 'Creare element',
  'workbench.tabbar.searchTabs': 'Căutare în file',
  'workbench.tabbar.search.placeholder': 'Căutare în file...',
  'workbench.tabbar.search.noMatch': 'Nicio filă deschisă nu corespunde căutării',
  'workbench.tabbar.search.noOpenTabs': 'Nicio filă deschisă',
  'workbench.tabbar.search.noClosedMatch': 'Nicio filă închisă nu corespunde căutării',
  'workbench.tabbar.search.recentlyClosed': 'Închise recent ({count})',
  'workbench.tabbar.search.recentlyClosedFiltered': 'Închise recent ({matched} din {total})',
  'workbench.tabbar.envPinnedAria': 'Mediu fixat',
  'workbench.tabbar.fromExample': 'din „{name}”',

  // ── Scratch segment labels (tab tooltip + breadcrumb bar) ───────────
  'workbench.scratch.request': 'Schiță de cerere',
  'workbench.scratch.rule': 'Schiță de regulă',
  'workbench.scratch.variable': 'Schiță de variabilă',
  'workbench.scratch.workflow': 'Schiță de flux de lucru',

  // ── Shell: command palette ──────────────────────────────────────────
  'workbench.shell.commandPalette.collectionsDivider': 'Colecții',
  'workbench.shell.commandPalette.searchInGroup': 'Căutare în {name}...',
  'workbench.shell.commandPalette.placeholder': 'Căutați reguli, colecții sau tastați > pentru comenzi...',
  'workbench.shell.commandPalette.noResults': 'Niciun rezultat',
  'workbench.shell.commandPalette.emptyHint': 'Tastați pentru a căuta sau > pentru comenzi',
  'workbench.shell.commandPalette.footer.navigate': '↑↓ navigare',
  'workbench.shell.commandPalette.footer.back': '← înapoi',
  'workbench.shell.commandPalette.footer.open': '→ deschidere',
  'workbench.shell.commandPalette.footer.select': '↵ selectare',
  'workbench.shell.commandPalette.footer.close': 'esc închidere',
  'workbench.shell.commandPalette.group.rules': 'Reguli',
  'workbench.shell.commandPalette.group.templates': 'Șabloane',
  'workbench.shell.commandPalette.group.requests': 'Cereri',
  'workbench.shell.commandPalette.group.systemTemplates': 'Șabloane de sistem',
  'workbench.shell.commandPalette.group.settings': 'Setări',
  'workbench.shell.commandPalette.section.create': 'Creare',
  'workbench.shell.commandPalette.section.commands': 'Comenzi',
  'workbench.shell.commandPalette.section.variables': 'Variabile',
  'workbench.shell.commandPalette.cmd.createItem': 'Creare element...',
  'workbench.shell.commandPalette.cmd.newRuleType': 'Creare: {type}',
  'workbench.shell.commandPalette.cmd.toggleLeftSidebar': 'Comutare bară laterală stângă',
  'workbench.shell.commandPalette.cmd.toggleRightSidebar': 'Comutare bară laterală dreaptă',
  'workbench.shell.commandPalette.cmd.toggleBottomPanel': 'Comutare panou inferior',
  'workbench.shell.commandPalette.cmd.toggleActivityFeed': 'Comutare flux de activitate',
  'workbench.shell.commandPalette.cmd.keyboardShortcuts': 'Scurtături de tastatură',
  'workbench.shell.commandPalette.cmd.openSettings': 'Deschidere setări',
  'workbench.shell.commandPalette.cmd.openWorkspaceVariables': 'Deschidere variabile de spațiu de lucru',
  'workbench.shell.commandPalette.cmd.openVault': 'Deschidere Vault',
  'workbench.shell.commandPalette.cmd.openTrustedRoots': 'Deschidere certificate de încredere',
  'workbench.shell.commandPalette.cmd.openLiveVariables': 'Deschidere variabile Live',
  'workbench.shell.commandPalette.cmd.openPackageLibrary': 'Deschidere Biblioteca de pachete',
  'workbench.shell.commandPalette.cmd.openEnvironment': 'Deschidere mediu: {name}',

  // ── Shell: top bar (search button, layout menu, panel toggles) ──────
  'workbench.shell.topbar.search': 'Căutare sau rulare comandă...',
  'workbench.shell.topbar.layout.bottomLayout': 'Aspect panou inferior',
  'workbench.shell.topbar.layout.alignCenter': 'Centrat (imbricat)',
  'workbench.shell.topbar.layout.alignLeft': 'Stânga',
  'workbench.shell.topbar.layout.alignRight': 'Dreapta',
  'workbench.shell.topbar.layout.alignJustify': 'Justificat (lățime completă)',
  'workbench.shell.topbar.layout.splitColumns': 'Alăturat',
  'workbench.shell.topbar.layout.splitRows': 'Suprapus',
  'workbench.shell.topbar.layout.showToolWindowNames': 'Afișare nume ferestre de instrumente',
  'workbench.shell.topbar.layout.activityBarLayout': 'Aspect bară de activități',
  'workbench.shell.topbar.layout.sidebarProportional': 'Proporțional (jumătăți egale)',
  'workbench.shell.topbar.layout.sidebarCompact': 'Compact (cel de jos fixat)',
  'workbench.shell.topbar.layout.sidebarStacked': 'Suprapus (toate sus)',
  'workbench.shell.topbar.layout.sidebarDynamic': 'Dinamic (urmează înălțimile panourilor)',
  'workbench.shell.topbar.layout.defaultLayoutDonor': 'Aspect implicit: {unit}',
  'workbench.shell.topbar.layout.inheritsDefault': 'Moștenește aspectul implicit',
  'workbench.shell.topbar.layout.donorTooltip':
    'Acest element ({unit}) este cel implicit — noile {units} moștenesc acest aspect.',
  'workbench.shell.topbar.layout.nonDonorTooltip':
    'Un alt element ({unit}) este cel implicit — noile {units} moștenesc aspectul de acolo.',
  'workbench.shell.topbar.layout.resetToDefaults': 'Resetare aspect la valorile implicite',
  'workbench.shell.topbar.layout.restoreHidden': 'Restaurare instrumente ascunse din bara de activități',
  'workbench.shell.topbar.toggle.leftSidebar': 'Bară laterală stângă',
  'workbench.shell.topbar.toggle.bottomPanel': 'Panou inferior',
  'workbench.shell.topbar.toggle.rightSidebar': 'Bară laterală dreaptă',
  'workbench.shell.topbar.bottomAlign.center': 'Panou inferior: centrat (imbricat)',
  'workbench.shell.topbar.bottomAlign.left': 'Panou inferior: aliniat la stânga',
  'workbench.shell.topbar.bottomAlign.right': 'Panou inferior: aliniat la dreapta',
  'workbench.shell.topbar.bottomAlign.justify': 'Panou inferior: lățime completă',
  'workbench.shell.topbar.bottomAlign.chooseAria': 'Alegeți alinierea panoului inferior',
  'workbench.shell.topbar.layoutOptions': 'Opțiuni de aspect',

  // ── Shell: status bar ───────────────────────────────────────────────
  'workbench.shell.statusbar.theme.light': 'Luminoasă',
  'workbench.shell.statusbar.theme.dark': 'Întunecată',
  'workbench.shell.statusbar.theme.auto': 'Automat',
  'workbench.shell.statusbar.systemStatus': 'Sistem',

  // ── Shell: activity bar ─────────────────────────────────────────────
  'workbench.shell.activityBar.hideLabels': 'Ascundere etichete',
  'workbench.shell.activityBar.showLabels': 'Afișare etichete',

  // ── Shell: editor empty state ───────────────────────────────────────
  'workbench.shell.empty.createRule': 'Creare regulă',
  'workbench.shell.empty.createRuleDesc': 'Antete, redirecționări, blocare și altele',
  'workbench.shell.empty.createVariable': 'Creare variabilă',
  'workbench.shell.empty.createVariableDesc': 'Mediu, spațiu de lucru, Live și altele',
  'workbench.shell.empty.createRequest': 'Creare cerere API',
  'workbench.shell.empty.createRequestDesc': 'HTTP, gRPC, WebSocket și altele',
  'workbench.shell.empty.createWorkflow': 'Creare flux de lucru',
  'workbench.shell.empty.createWorkflowDesc': 'Înlănțuiți și programați cereri API',
  'workbench.shell.empty.import': 'Import',
  'workbench.shell.empty.importDesc': 'Curl, HAR, Postman și altele',
  'workbench.shell.empty.migrate': 'Migrare din alt instrument',
  'workbench.shell.empty.migrateDesc': 'Aduceți-vă datele din Postman, Insomnia sau Bruno',
  'workbench.shell.empty.browseTemplates': 'Răsfoire toate șabloanele…',
  'workbench.shell.empty.varEnvironment': 'Variabilă de mediu',
  'workbench.shell.empty.varWorkspace': 'Variabilă de spațiu de lucru',
  'workbench.shell.empty.varLive': 'Variabilă Live',
  'workbench.shell.empty.varVault': 'Secret Vault',
  'workbench.shell.empty.varCollection': 'Variabilă de colecție',
  'workbench.shell.empty.varCollectionTooltip': 'Variabilele de colecție se creează din interiorul unei colecții.',
  'workbench.shell.empty.adminNoWorkspace':
    'Sunteți conectat ca administrator de server fără niciun spațiu de lucru acordat. Datele spațiilor de lucru rămân inaccesibile până când există o acordare de acces — inclusiv una pe care v-o dați dvs. înșivă.',
  'workbench.shell.empty.adminOpenServerAdmin': 'Deschidere Administrare server',
  'workbench.shell.empty.adminOpenServerAdminDesc': 'Gestionați utilizatorii, accesul și serverul',

  // ── Shell: environment selector ─────────────────────────────────────
  'workbench.shell.envSelector.noEnvironment': 'Fără mediu',
  'workbench.shell.envSelector.defaultPill': 'IMPLICIT',
  'workbench.shell.envSelector.defaultTooltip': 'Mediul implicit este selectat automat cât timp lucrați cu colecția.',
  'workbench.shell.envSelector.openEnv': 'Editare variabile',
  'workbench.shell.envSelector.pinToTab': 'Fixare pe această filă',
  'workbench.shell.envSelector.unpinFromTab': 'Anulare fixare de pe această filă',
  'workbench.shell.envSelector.pinToTabDesc': 'Comută la acest mediu ori de câte ori fila primește focalizarea.',
  'workbench.shell.envSelector.pinToCollection': 'Fixare pe colecție',
  'workbench.shell.envSelector.unpinFromCollection': 'Anulare fixare de pe colecție',
  'workbench.shell.envSelector.pinToCollectionDesc': 'Afișează acest mediu în lista fixată a colecției.',
  'workbench.shell.envSelector.pinAria': 'Fixare mediu',
  'workbench.shell.envSelector.setCollectionDefault': 'Setare ca implicit pentru colecție',
  'workbench.shell.envSelector.clearCollectionDefault': 'Golire implicit pentru colecție',
  'workbench.shell.envSelector.searchPlaceholder': 'Căutare medii…',
  'workbench.shell.envSelector.modeLabel': 'Mod: {mode}',
  'workbench.shell.envSelector.switchBehavior.title': 'La comutarea între colecții',
  'workbench.shell.envSelector.switchBehavior.keep': 'Păstrare mediu selectat',
  'workbench.shell.envSelector.switchBehavior.keepDesc':
    'Selecția dvs. rămâne neschimbată între colecții și în tot ce conțin ele.',
  'workbench.shell.envSelector.switchBehavior.applyDefaults': 'Aplicare valori implicite ale colecțiilor',
  'workbench.shell.envSelector.switchBehavior.applyDefaultsDesc':
    'Valorile implicite preiau controlul în interior. Ultima dvs. alegere manuală este restaurată în altă parte.',
  'workbench.shell.envSelector.switchBehavior.follow': 'Urmărire fiecare colecție',
  'workbench.shell.envSelector.switchBehavior.followDesc':
    'Colecțiile cu un mediu implicit comută la el (și vă rețin alegerile). Celelalte nu comută.',
  'workbench.shell.envSelector.switchBehavior.aria': 'Comportament la comutarea mediilor',
  'workbench.shell.envSelector.pinnedBanner': 'Fixat pe fila curentă — alegerea unui mediu mută fixarea.',
  'workbench.shell.envSelector.unpin': 'Anulare fixare',
  'workbench.shell.envSelector.createNew': 'Creare mediu nou',
  'workbench.shell.envSelector.pinnedSection': 'Fixate pe această colecție',
  'workbench.shell.envSelector.othersSection': 'Alte medii',
  'workbench.shell.envSelector.noMatches': 'Niciun mediu corespunzător',
  'workbench.shell.envSelector.footer.vault': 'Vault',
  'workbench.shell.envSelector.footer.collection': 'Colecție',
  'workbench.shell.envSelector.footer.workspace': 'Spațiu de lucru',
  'workbench.shell.envSelector.footer.live': 'Live',
  'workbench.shell.envSelector.triggerAriaActive': 'Mediu activ: {name}',
  'workbench.shell.envSelector.triggerAriaActivePinned': 'Mediu activ: {name} (fixat de această filă)',
  'workbench.shell.envSelector.triggerAriaNone': 'Niciun mediu selectat',
  'workbench.shell.envSelector.triggerAriaNonePinned': 'Niciun mediu selectat (fixat de această filă)',

  // ── Shell: breadcrumb root nouns ────────────────────────────────────
  'workbench.shell.breadcrumbs.settings': 'Setări',
  'workbench.shell.breadcrumbs.whatsNew': 'Noutăți',
  'workbench.shell.breadcrumbs.workspaces': 'Spații de lucru',
  'workbench.shell.breadcrumbs.serverAdmin': 'Administrare server',
  'workbench.shell.breadcrumbs.environments': 'Medii',
  'workbench.shell.breadcrumbs.specs': 'Specificații',
  'workbench.shell.breadcrumbs.workspaceVariables': 'Variabile de spațiu de lucru',
  'workbench.shell.breadcrumbs.vault': 'Vault',
  'workbench.shell.breadcrumbs.packageLibrary': 'Biblioteca de pachete',
  'workbench.shell.breadcrumbs.rules': 'Reguli',
  'workbench.shell.breadcrumbs.requests': 'Cereri',
  'workbench.shell.breadcrumbs.templates': 'Șabloane',
  'workbench.shell.breadcrumbs.variables': 'Variabile',
  'workbench.shell.breadcrumbs.apiRequests': 'Cereri API',
  'workbench.shell.breadcrumbs.workflows': 'Fluxuri de lucru',
  'workbench.shell.breadcrumbs.liveVariables': 'Variabile Live',

  // ── Shell: fallback entity labels ───────────────────────────────────
  'workbench.shell.fallback.workflow': 'Flux de lucru',
  'workbench.shell.fallback.template': 'Șablon',
  'workbench.shell.fallback.environment': 'Mediu',

  // ── Shell: tab-label compositions + draft seeds. Singleton tab
  // labels resolve live through the breadcrumb root nouns; only copy
  // with no breadcrumb twin lives here. Draft seeds persist as entity
  // names BY DESIGN (V5 fresh start) — keyed at mint time. ────────────
  'workbench.shell.tabLabel.collectionVariables': '{name} · Variabile',
  'workbench.shell.tabLabel.newRequest': 'Cerere nouă',
  'workbench.shell.tabLabel.newGrpcRequest': 'Cerere gRPC nouă',
  'workbench.shell.tabLabel.newWebSocketRequest': 'Cerere WebSocket nouă',
  'workbench.shell.tabLabel.newSocketIoRequest': 'Cerere Socket.IO nouă',
  'workbench.shell.tabLabel.newMqttRequest': 'Cerere MQTT nouă',
  'workbench.shell.tabLabel.newGraphqlRequest': 'Cerere GraphQL nouă',
  'workbench.shell.tabLabel.newWorkflow': 'Flux de lucru nou',
  'workbench.shell.tabLabel.newLiveVariable': 'Variabilă Live nouă',

  // ── Shell: App glue — workspace-switch toast, dirty-close confirm,
  // create-flow toasts. `{unit}` interpolates the host-vocabulary
  // instance noun (tab / window). ─────────────────────────────────────
  'workbench.shell.appGlue.switchedTo': 'Acest element ({unit}) a fost comutat la',
  'workbench.shell.appGlue.andMadeActive': ' și setat ca activ',
  'workbench.shell.appGlue.discardTitle': 'Renunțare la ciornele nesalvate?',
  'workbench.shell.appGlue.discardBody':
    'Comutarea spațiului de lucru va închide filele de editor cu modificări nesalvate.',
  'workbench.shell.appGlue.discardOk': 'Comutare și renunțare',
  'workbench.shell.appGlue.cancel': 'Anulare',
  'workbench.shell.toast.createEnvironmentFailed': 'Crearea mediului a eșuat',
  'workbench.shell.toast.noActiveWorkspace': 'Niciun spațiu de lucru activ',
  'workbench.shell.toast.createRuleFailed': 'Crearea regulii a eșuat',

  // ── Save: collection modal chrome ───────────────────────────────────
  'workbench.save.title': 'SALVARE',
  'workbench.save.newFolder': 'Folder nou',
  'workbench.save.newFolderTooltip': 'Folder nou ({chord})',
  'workbench.save.newCollection': 'Colecție nouă',
  'workbench.save.newCollectionTooltip': 'Colecție nouă ({chord})',
  'workbench.save.cancel': 'Anulare',
  'workbench.save.save': 'Salvare',
  'workbench.save.selectCollectionFirst': 'Selectați mai întâi o colecție',
  'workbench.save.enterName': 'Introduceți un nume',
  'workbench.save.saveWithChord': 'Salvare ({chord})',
  'workbench.save.footer.navigate': '↑↓ navigare',
  'workbench.save.footer.open': '→ deschidere',
  'workbench.save.footer.back': '← înapoi',
  'workbench.save.footer.new': '{chord} nou',
  'workbench.save.footer.save': '{chord} salvare',
  'workbench.save.footer.close': 'esc închidere',
  'workbench.save.nameLabel': 'Nume',
  'workbench.save.saveTo': 'Salvare în ',
  'workbench.save.rootCrumb': 'Reguli locale',
  'workbench.save.searchFolders': 'Căutare foldere',
  'workbench.save.searchCollections': 'Căutare colecție',
  'workbench.save.nameYourCollection': 'Denumiți colecția',
  'workbench.save.create': 'Creare',
  'workbench.save.noCollections': 'Nicio colecție încă.',
  'workbench.save.noMatchingCollections': 'Nicio colecție corespunzătoare.',
  'workbench.save.createCollection': 'Creare colecție',
  'workbench.save.orPressPrefix': 'sau apăsați',
  'workbench.save.nameYourFolder': 'Denumiți folderul',
  'workbench.save.folderEmpty': 'Acest folder este gol.',
  'workbench.save.collectionEmpty': 'Această colecție este goală.',
  'workbench.save.pressPrefix': 'Apăsați',
  'workbench.save.pressMiddle': 'pentru a salva aici sau',
  'workbench.save.pressSuffix': 'pentru un folder nou.',

  // ── Save: as-template step ──────────────────────────────────────────
  'workbench.save.template.title': 'Salvare ca șablon de utilizator',
  'workbench.save.template.next': 'Înainte',
  'workbench.save.template.intro': 'Salvați configurația curentă ({type}) ca șablon reutilizabil.',
  'workbench.save.template.iconLabel': 'Pictogramă',
  'workbench.save.template.nameLabel': 'Nume *',
  'workbench.save.template.namePlaceholder': 'Numele șablonului meu',
  'workbench.save.template.descriptionLabel': 'Descriere',
  'workbench.save.template.descriptionPlaceholder': 'Ce face acest șablon? (opțional)',
  'workbench.save.template.includeConditions': 'Includere condiții',
  'workbench.save.template.includeActions': 'Includere acțiuni',
  'workbench.save.template.ruleFallback': 'Regulă',

  // ── Save: per-surface rule-type vocabulary ──────────────────────────
  'workbench.save.ruleType.header': 'Antet',
  'workbench.save.ruleType.block': 'Blocare',
  'workbench.save.ruleType.redirect': 'Redirecționare',
  'workbench.save.ruleType.queryParam': 'Parametru de interogare',
  'workbench.save.ruleType.inject': 'Injectare',
  'workbench.save.ruleType.delay': 'Întârziere',
  'workbench.save.ruleType.requestBody': 'Corp cerere API',
  'workbench.save.ruleType.response': 'Răspuns API',

  // ── Shell: rule-type entity names ('New {name}' draft seeds, command
  //    palette scope column + New-rule rows). Draft names persist as
  //    entity names — keyed at mint time (V5 fresh start, no back-compat). ─
  'workbench.shell.ruleTypeName.header': 'Regulă de antete',
  'workbench.shell.ruleTypeName.block': 'Regulă de blocare',
  'workbench.shell.ruleTypeName.redirect': 'Regulă de redirecționare',
  'workbench.shell.ruleTypeName.queryParam': 'Regulă de parametru de interogare',
  'workbench.shell.ruleTypeName.inject': 'Regulă de injectare',
  'workbench.shell.ruleTypeName.delay': 'Regulă de întârziere',
  'workbench.shell.ruleTypeName.requestBody': 'Regulă de corp cerere API',
  'workbench.shell.ruleTypeName.response': 'Regulă de răspuns API',
  'workbench.shell.ruleTypeName.ws': 'Regulă WebSocket',
  'workbench.shell.ruleTypeName.sse': 'Regulă SSE',
  'workbench.shell.ruleTypeName.fallback': 'Regulă',
  'workbench.shell.ruleTypeName.draftName': '{name} (nouă)',

  // ── Tool-window registry (activity bars, dock tab strips, restore
  //    rows, drag previews) ───────────────────────────────────────────
  'workbench.toolWindows.serverAdmin': 'Administrare server',
  'workbench.toolWindows.httpRules': 'Interceptor de browser',
  'workbench.toolWindows.apiRequests': 'Cereri API',
  'workbench.toolWindows.workflows': 'Fluxuri de lucru',
  'workbench.toolWindows.notifications': 'Notificări',
  'workbench.toolWindows.docs': 'Docs',
  'workbench.toolWindows.varScope': 'Sfera variabilelor',
  'workbench.toolWindows.variables': 'Variabile',
  'workbench.toolWindows.workflowStatus': 'Starea fluxurilor de lucru',
  'workbench.toolWindows.activity': 'Activitate',
  'workbench.toolWindows.activityTooltip': 'Flux de activitate — modificări primite de la peeri',
  'workbench.toolWindows.trafficMonitor': 'Trafic',
  'workbench.toolWindows.terminal': 'Terminal',
  'workbench.toolWindows.git': 'Git · Controlul versiunilor',
  'workbench.toolWindows.versionControl': 'Controlul versiunilor',

  // ── Tool-window `(i)` info popovers. `{{live.*}}` / `{{name}}`
  //    reference chips compose raw in JSX between the keyed prefix/
  //    suffix fragments; the Notifications entry stays on the shared
  //    NOTIFICATIONS_PANEL_INFO corpus (panel co-consumer, Phase D). ───
  'workbench.toolWindows.info.serverAdmin.summary':
    'Administrați acest server: utilizatorii și accesul lor, dispozitivele asociate, legăturile cu depozitele și pista de audit. Fiecare rând se deschide în propria filă.',
  'workbench.toolWindows.info.serverAdmin.domainsHeading': 'Domenii de administrare',
  'workbench.toolWindows.info.httpRules.summary':
    'Creați reguli care rescriu cererile trimise și răspunsurile primite. Regulile trăiesc în colecții și pot injecta valori din variabile, din vault și din fluxurile de lucru live.',
  'workbench.toolWindows.info.httpRules.ruleTypesHeading': 'Tipuri de reguli',
  'workbench.toolWindows.info.workflows.summaryPrefix':
    'Un producător de variabile cu reîmprospătare programată: un lanț de cereri plus o regulă de extragere. Rezultatul său apare ca o referință',
  'workbench.toolWindows.info.workflows.summarySuffix': 'pe care o puteți folosi oriunde este acceptată o variabilă.',
  'workbench.toolWindows.info.docs.summary':
    'Documentație în aplicație pentru reguli, variabile, fluxuri de lucru și fereastra Workbench însăși — răsfoiți fără a părăsi aplicația.',
  'workbench.toolWindows.info.varScope.summaryPrefix':
    'Variabilele la care face referire fila activă și fiecare sferă în care se rezolvă. O referință simplă',
  'workbench.toolWindows.info.varScope.summaryMiddle':
    'parcurge ordinea de prioritate de mai jos; referințele cu spațiu de nume, precum',
  'workbench.toolWindows.info.varScope.summarySuffix': 'țintesc direct o singură sferă.',
  'workbench.toolWindows.info.varScope.priorityHeading': 'Ordinea de prioritate',
  'workbench.toolWindows.info.varScope.vaultLabel': 'Vault',
  'workbench.toolWindows.info.varScope.vaultDesc':
    'Secrete per utilizator, niciodată sincronizate — prioritate maximă.',
  'workbench.toolWindows.info.varScope.environmentLabel': 'Mediu',
  'workbench.toolWindows.info.varScope.environmentDesc': 'Mediul activ, cu revenire la mediul implicit.',
  'workbench.toolWindows.info.varScope.collectionLabel': 'Colecție',
  'workbench.toolWindows.info.varScope.collectionDesc': 'Colecția entității active.',
  'workbench.toolWindows.info.varScope.workspaceLabel': 'Spațiu de lucru',
  'workbench.toolWindows.info.varScope.workspaceDesc': 'Partajate în tot spațiul de lucru — prioritate minimă.',
  'workbench.toolWindows.info.varScope.namespacedHeading': 'Cu spațiu de nume',
  'workbench.toolWindows.info.varScope.liveLabel': 'Live',
  'workbench.toolWindows.info.varScope.liveDescPrefix': 'Susținute de fluxuri de lucru; accesibile doar prin',
  'workbench.toolWindows.info.varScope.liveDescSuffix': ', rezolvate din ultima rulare.',
  'workbench.toolWindows.info.variables.summary':
    'Catalogul de variabile — tot ce este definit în medii, colecții, spațiul de lucru și vault. Folosiți „Sfera variabilelor” pentru a vedea ce este efectiv în sferă pentru fila activă.',
  'workbench.toolWindows.info.variables.typesHeading': 'Tipuri de variabile',
  'workbench.toolWindows.info.variables.vaultDesc': 'Secrete per utilizator — stocate local, niciodată sincronizate.',
  'workbench.toolWindows.info.variables.environmentDesc': 'Definite per mediu; cel activ furnizează valorile.',
  'workbench.toolWindows.info.variables.collectionDesc': 'Definite pe o colecție; se aplică entităților din ea.',
  'workbench.toolWindows.info.variables.workspaceDesc': 'Partajate în tot spațiul de lucru.',
  'workbench.toolWindows.info.variables.liveDescPrefix': 'Valori produse de fluxuri de lucru, referite ca',
  'workbench.toolWindows.info.variables.liveDescSuffix': '.',
  'workbench.toolWindows.info.apiRequests.summary':
    'Cererile API salvate și mediile în care rulează, organizate în colecții și foldere.',
  'workbench.toolWindows.info.apiRequests.editorHeading': 'Editorul de cereri',
  'workbench.toolWindows.info.apiRequests.docsLabel': 'Docs',
  'workbench.toolWindows.info.apiRequests.docsDesc': 'Note libere pentru cerere — Markdown acceptat.',
  'workbench.toolWindows.info.apiRequests.paramsLabel': 'Params',
  'workbench.toolWindows.info.apiRequests.paramsDesc': 'Parametri de interogare adăugați la adresa URL a cererii.',
  'workbench.toolWindows.info.apiRequests.authorizationLabel': 'Autorizare',
  'workbench.toolWindows.info.apiRequests.authorizationDesc':
    'Moștenire de la părinte, Basic, Bearer Token, cheie API sau OAuth 2.0 — aplicate la trimitere.',
  'workbench.toolWindows.info.apiRequests.headersLabel': 'Antete',
  'workbench.toolWindows.info.apiRequests.headersDesc':
    'Antetele cererii, cu referințele la variabile rezolvate la trimitere.',
  'workbench.toolWindows.info.apiRequests.bodyLabel': 'Corp',
  'workbench.toolWindows.info.apiRequests.bodyDesc':
    'Form data, URL-encoded, raw (Text, JavaScript, JSON, HTML, XML) sau GraphQL.',
  'workbench.toolWindows.info.apiRequests.scriptsLabel': 'Scripturi',
  'workbench.toolWindows.info.apiRequests.scriptsDesc': 'Hook-uri JavaScript pre-cerere și post-răspuns.',
  'workbench.toolWindows.info.apiRequests.settingsLabel': 'Setări',
  'workbench.toolWindows.info.apiRequests.settingsDesc':
    'Comportament per cerere — verificare SSL, redirecționări și altele.',
  'workbench.toolWindows.info.trafficMonitor.summary':
    'Vizualizarea unificată a traficului live — alegeți o sursă din listă: o filă de browser conectată (extensia îi transmite traficul în timp real) sau Proxy de sistem (orice instrument de pe acest computer îndreptat către portul proxy local). Ambele redau același jurnal de rețea pe care îl folosește panoul DevTools; nimic nu se transmite până nu este selectată o sursă. Sesiunile salvate stau sub „SESIUNI” — denumite și arhivate automat la încheiere; apăsați pe una pentru a o reda ca filă.',
  'workbench.toolWindows.info.workflowStatus.summary':
    'Tablou de bord al întrerupătoarelor de circuit per flux de lucru — stare, eșecuri consecutive, deschideri și numărătoarea inversă până la următoarea încercare, cu acțiunile manuale „Reîncercare” și „Resetare circuit”.',
  'workbench.toolWindows.info.activity.summary':
    'Flux la nivel de spațiu de lucru al modificărilor primite de la peeri, cu evidențieri ale clasificatorului pentru rotațiile câmpurilor sensibile, extinderile sferei permisiunilor și substituirile editărilor locale.',
  'workbench.terminal.sessionEnded': 'Sesiune încheiată',
  'workbench.terminal.restart': 'Repornire shell',
  'workbench.terminal.tabLocal': 'Local',
  'workbench.terminal.tabLocalN': 'Local ({n})',
  'workbench.terminal.newTab': 'Filă de terminal nouă',
  'workbench.terminal.newTabWithProfile': 'Filă nouă din profil',
  'workbench.terminal.closeTab': 'Închidere filă',
  'workbench.terminal.openTui': 'TUI',
  'workbench.terminal.closeConfirm.title': 'Un proces rulează',
  'workbench.terminal.closeConfirm.bodyPrefix': 'Un proces încă rulează în ',
  'workbench.terminal.closeConfirm.bodySuffix': '. Îl terminați?',
  'workbench.terminal.closeConfirm.ok': 'Terminare',
  'workbench.terminal.closeConfirm.bodyMany':
    'Procese încă rulează în {count} dintre filele care se închid. Le terminați?',
  'workbench.terminal.menu.rename': 'Redenumire',
  'workbench.terminal.rename.title': 'Redenumire filă',
  'workbench.terminal.settings': 'Setări',
  'workbench.terminal.cliGate.title': 'Conectare OpenHeaders CLI',
  'workbench.terminal.cliGate.body':
    'Modul TUI este susținut de instrumentul de linie de comandă oh, care nu este încă conectat la această aplicație.',
  'workbench.terminal.cliGate.bodyInfo.title': 'Conexiunea CLI',
  'workbench.terminal.cliGate.bodyInfo.summary':
    'Conectarea emite un token de acces și îl scrie în {path}. Instrumentul oh citește acel fișier pentru a se autentifica la daemonul local, așa că după conectare oh funcționează în orice terminal de pe acest computer. Anularea nu emite nimic.',
  'workbench.terminal.cliGate.enableMcp': 'Activare server MCP',
  'workbench.terminal.cliGate.enableMcpRider':
    'Cât timp punctul final este oprit, TUI raportează daemonul ca inaccesibil. Debifați pentru a furniza doar tokenul.',
  'workbench.terminal.cliGate.ok': 'Conectare și deschidere',
  'workbench.terminal.cliGate.openSettings': 'Deschidere setări',
  'workbench.terminal.cliGate.installTitle': 'Instalare OpenHeaders CLI',
  'workbench.terminal.cliGate.installBody':
    'Modul TUI este susținut de instrumentul de linie de comandă oh, care nu este încă instalat pe acest computer. Rulați aceasta în orice terminal pentru a-l instala, apoi deschideți din nou modul TUI:',
  'workbench.terminal.cliGate.installOk': 'Deschidere terminal',
  'workbench.toolWindows.info.terminal.summary':
    'Un terminal integrat care rulează shell-ul dvs. într-un pty real — tot ce puteți rula într-un terminal de sine stătător rulează și aici, inclusiv oh CLI împotriva aplicației locale.',
  'workbench.toolWindows.info.git.summary':
    'Istoricul commit-urilor pentru legătura Git a spațiului de lucru activ — cronologia spațiului de lucru cu fișierele modificate per commit, autorii și istoricul per fișier.',

  // ── Git tool window (log view) ───────────────────────────────────
  'workbench.gitLog.logTab': 'Jurnal: {branch}',
  'workbench.gitLog.logTabAll': 'Jurnal',
  'workbench.gitLog.closeTab': 'Închidere filă',
  'workbench.gitLog.newLogTab': 'Filă de jurnal nouă',
  'workbench.gitLog.tabMenu': 'Opțiuni filă',
  'workbench.gitLog.console.tab': 'Consolă',
  'workbench.gitLog.console.show': 'Afișare consolă Git',
  'workbench.gitLog.console.empty': 'Comenzile Git pe care aplicația le rulează în acest depozit vor apărea aici.',
  'workbench.gitLog.filterPlaceholder': 'Text sau hash',
  'workbench.gitLog.filter.regex': 'Expresie regulată',
  'workbench.gitLog.filter.matchCase': 'Potrivire majuscule/minuscule',
  'workbench.gitLog.chip.branch': 'Ramură',
  'workbench.gitLog.chip.tag': 'Etichetă',
  'workbench.gitLog.chip.user': 'Utilizator',
  'workbench.gitLog.chip.date': 'Dată',
  'workbench.gitLog.chip.paths': 'Căi',
  'workbench.gitLog.chip.pathsCount': 'căi: {count}',
  'workbench.gitLog.menu.select': 'Selectare…',
  'workbench.gitLog.menu.selectInTree': 'Selectare în arbore…',
  'workbench.gitLog.menu.favorites': 'Favorite',
  'workbench.gitLog.user.me': 'eu',
  'workbench.gitLog.date.last24h': 'Ultimele 24 de ore',
  'workbench.gitLog.date.last7d': 'Ultimele 7 zile',
  'workbench.gitLog.date.title': 'Filtrare după dată',
  'workbench.gitLog.date.since': 'De la',
  'workbench.gitLog.date.until': 'Până la',
  'workbench.gitLog.paths.title': 'Filtrare după căi',
  'workbench.gitLog.paths.hint': 'O cale relativă la depozit pe linie — un folder cuprinde tot ce se află sub el.',
  'workbench.gitLog.modal.ok': 'OK',
  'workbench.gitLog.modal.cancel': 'Anulare',
  'workbench.gitLog.graphOptions': 'Opțiuni grafic',
  'workbench.gitLog.sort.heading': 'Sortare',
  'workbench.gitLog.sort.byDate': 'După data commit-ului',
  'workbench.gitLog.sort.topo': 'Topologic',
  'workbench.gitLog.options.heading': 'Opțiuni',
  'workbench.gitLog.options.firstParent': 'Doar primul părinte',
  'workbench.gitLog.options.noMerges': 'Fără îmbinări',
  'workbench.gitLog.branchActions.heading': 'Acțiuni pe ramuri',
  'workbench.gitLog.branchActions.collapseLinear': 'Restrângere ramuri liniare',
  'workbench.gitLog.branchActions.expandLinear': 'Extindere ramuri liniare',
  'workbench.gitLog.cherryPick': 'Cherry-pick',
  'workbench.gitLog.viewOptions': 'Opțiuni de vizualizare',
  'workbench.gitLog.show.heading': 'Afișare',
  'workbench.gitLog.show.compactRefs': 'Vizualizare compactă a referințelor',
  'workbench.gitLog.show.tagNames': 'Nume etichete',
  'workbench.gitLog.show.longEdges': 'Muchii lungi',
  'workbench.gitLog.show.commitTimestamp': 'Marcaj de timp commit',
  'workbench.gitLog.show.refsOnLeft': 'Referințe în stânga',
  'workbench.gitLog.show.columns': 'Coloane',
  'workbench.gitLog.highlight.heading': 'Evidențiere',
  'workbench.gitLog.highlight.myCommits': 'Commit-urile mele',
  'workbench.gitLog.highlight.mergeCommits': 'Commit-uri de îmbinare',
  'workbench.gitLog.highlight.currentBranch': 'Ramura curentă',
  'workbench.gitLog.highlight.notCherryPicked': 'Commit-uri fără cherry-pick',
  'workbench.gitLog.goTo': 'Salt la hash/ramură/etichetă',
  'workbench.gitLog.goTo.placeholder': 'Hash, ramură sau etichetă',
  'workbench.gitLog.goTo.notFound': 'Negăsit în jurnalul încărcat.',
  'workbench.gitLog.details.showDiff': 'Afișare Diff',
  'workbench.gitLog.details.revertSelected': 'Revenire asupra modificărilor selectate',
  'workbench.gitLog.details.groupBy': 'Grupare după',
  'workbench.gitLog.details.directory': 'Director',
  'workbench.gitLog.details.layout': 'Aspect',
  'workbench.gitLog.details.showDetails': 'Afișare detalii',
  'workbench.gitLog.details.showDiffPreview': 'Afișare previzualizare Diff',
  'workbench.gitLog.refresh': 'Reîmprospătare',
  'workbench.gitLog.empty':
    'Niciun commit încă — commit-urile se fac la cadența configurată sau manual, din „Setări › Git”.',
  'workbench.gitLog.noMatches': 'Niciun commit nu corespunde filtrelor',
  'workbench.gitLog.resetFilters': 'Resetare filtre',
  'workbench.gitLog.selectCommit': 'Selectați un commit pentru a-i vedea modificările',
  'workbench.gitLog.noneSelected': 'Niciun commit selectat',
  'workbench.gitLog.loadFailed': 'Istoricul nu a putut fi încărcat: {detail}',
  'workbench.gitLog.authorLine': '{author} <{email}>, {date}',
  'workbench.gitLog.coAuthors': 'Coautori: {authors}',
  'workbench.gitLog.filesHeading': 'Fișiere modificate',
  'workbench.gitLog.filesCount': 'fișiere: {count}',
  'workbench.gitLog.expandAll': 'Extindere toate',
  'workbench.gitLog.collapseAll': 'Restrângere toate',
  'workbench.gitLog.date.yesterday': 'Ieri, {time}',
  'workbench.gitLog.diff.title': 'Diff — {path}',
  'workbench.gitLog.diff.binary': 'Fișier binar — fără previzualizare text.',
  'workbench.gitLog.diff.tooLarge': 'Fișier prea mare pentru previzualizare ({size} KB).',
  'workbench.gitLog.refs.search': 'Ramură sau etichetă',
  'workbench.gitLog.refs.head': 'HEAD (ramura curentă)',
  'workbench.gitLog.refs.local': 'Locale',
  'workbench.gitLog.refs.remote': 'La distanță',
  'workbench.gitLog.refs.tags': 'Etichete',
  'workbench.gitLog.refs.empty': 'Ramurile apar după primul commit.',
  'workbench.gitLog.rail.hide': 'Ascundere ramuri Git',
  'workbench.gitLog.rail.show': 'Afișare ramuri Git',
  'workbench.gitLog.rail.branchesStrip': 'Ramuri',
  'workbench.gitLog.rail.newBranch': 'Ramură nouă',
  'workbench.gitLog.rail.updateSelected': 'Actualizare selecție',
  'workbench.gitLog.rail.deleteBranch': 'Ștergere ramură',
  'workbench.gitLog.rail.compareWithCurrent': 'Comparare cu cea curentă',
  'workbench.gitLog.rail.showMyBranches': 'Afișare ramurile mele',
  'workbench.gitLog.rail.fetch': 'Fetch',
  'workbench.gitLog.rail.toggleFavorite': 'Adăugare la / eliminare din favorite',
  'workbench.gitLog.rail.navigateToHead': 'Navigare în jurnal la vârful ramurii selectate',
  'workbench.gitLog.rail.paneSettings': 'Setările panoului de ramuri',
  'workbench.gitLog.rail.singleClickHeading': 'La un singur clic',
  'workbench.gitLog.rail.singleClickFilter': 'Actualizare filtru de ramură',
  'workbench.gitLog.rail.singleClickNavigate': 'Navigare în jurnal la vârful ramurii',
  'workbench.gitLog.rail.showTags': 'Afișare etichete',
  'workbench.gitLog.rail.groupByDirectory': 'Grupare după director',
  'workbench.gitLog.rail.expandAll': 'Extindere toate',
  'workbench.gitLog.rail.collapseAll': 'Restrângere toate',
  'workbench.gitLog.createBranch.title': 'Creare ramură din {from}',
  'workbench.gitLog.createBranch.nameLabel': 'Nume ramură:',
  'workbench.gitLog.createBranch.checkout': 'Comutare pe ramură',
  'workbench.gitLog.createBranch.overwrite': 'Suprascriere ramură existentă',
  'workbench.gitLog.createBranch.create': 'Creare',
  'workbench.gitLog.createBranch.cancel': 'Anulare',
  'workbench.gitLog.createBranch.exists': 'Ramura {name} există deja — bifați „Suprascriere” pentru a o reseta.',
  'workbench.gitLog.createBranch.failed': 'Ramura nu a putut fi creată: {detail}',
  'workbench.gitLog.createBranch.checkedOut': 'S-a comutat pe noua ramură {branch}, creată din {from}',
  'workbench.gitLog.deleteBranch.deleted': 'Ramură ștearsă: {branch}',
  'workbench.gitLog.deleteBranch.restore': 'Restaurare',
  'workbench.gitLog.deleteBranch.failed': 'Ramura nu a putut fi ștearsă: {detail}',
  'workbench.gitLog.updateBranch.noUpstream': 'Ramura {branch} nu are o ramură din amonte din care să se actualizeze.',
  'workbench.gitLog.updateBranch.failed': 'Ramura {branch} nu a putut fi actualizată: {detail}',
  'workbench.gitLog.fetch.noRemote': 'Niciun depozit la distanță configurat.',
  'workbench.gitLog.fetch.failed': 'Fetch eșuat: {detail}',
  'workbench.gitLog.compareTab': 'Comparare: {a} și {b}',
  'workbench.gitLog.compare.onlyIn': 'Commit-uri care există în {a}, dar nu există în {b}',
  'workbench.gitLog.compare.containsAll': 'Ramura {a} conține toate commit-urile din {b}',
  'workbench.gitLog.compare.failed': 'Compararea a eșuat: {detail}',

  // ── Commit tool window ───────────────────────────────────────────
  'workbench.toolWindows.commit': 'Git · Commit',
  'workbench.toolWindows.info.commit.summary':
    'Faceți commit modificărilor din legătura Git a spațiului de lucru activ — un arbore de modificări cu casete de bifare, mesajul de commit și „Commit” / „Commit și Push” cu propria dvs. identitate git și propriile hook-uri.',
  'workbench.commitTool.groups.changes': 'Modificări',
  'workbench.commitTool.oneFile': '1 fișier',
  'workbench.commitTool.oneDirectory': '1 director',
  'workbench.commitTool.directoriesCount': 'directoare: {count}',
  'workbench.commitTool.dirsAndFiles': '{dirs} și {files}',
  'workbench.commitTool.groups.unversioned': 'Fișiere neversionate',
  'workbench.commitTool.groups.ignored': 'Fișiere ignorate',
  'workbench.commitTool.refresh': 'Reîmprospătare',
  'workbench.commitTool.rollback': 'Revenire…',
  'workbench.commitTool.shelve': 'Amânare fără confirmare',
  'workbench.commitTool.show': 'Afișare',
  'workbench.commitTool.ignoredFiles': 'Fișiere ignorate',
  'workbench.commitTool.selectOpened': 'Selectare fișier deschis în arborele de modificări',
  'workbench.commitTool.amend': 'Modificare ultimul commit',
  'workbench.commitTool.historyTooltip': 'Istoricul mesajelor de commit',
  'workbench.commitTool.historyEmpty': 'Niciun mesaj de commit încă',
  'workbench.commitTool.messagePlaceholder': 'Mesaj de commit',
  'workbench.commitTool.commit': 'Commit',
  'workbench.commitTool.commitAndPush': 'Commit și Push…',
  'workbench.commitTool.optionsTooltip': 'Afișare opțiuni de commit',
  'workbench.commitTool.options.gitSection': 'Git',
  'workbench.commitTool.options.signOff': 'Adăugare Signed-off-by',
  'workbench.commitTool.options.runGitHooks': 'Rulare hook-uri Git',
  'workbench.commitTool.counter.modified': 'modificate: {count}',
  'workbench.commitTool.counter.added': 'adăugate: {count}',
  'workbench.commitTool.counter.deleted': 'șterse: {count}',
  'workbench.commitTool.counter.unversioned': 'neversionate: {count}',
  'workbench.commitTool.nothingToCommit': 'Nicio modificare în fișierele selectate',
  'workbench.commitTool.committed': 'Commit creat: {sha}',
  'workbench.commitTool.menu.commitFile': 'Commit fișier…',
  'workbench.commitTool.menu.moveToChangelist': 'Mutare în altă listă de modificări…',
  'workbench.commitTool.menu.showDiff': 'Afișare Diff',
  'workbench.commitTool.menu.showDiffNewTab': 'Afișare Diff într-o filă nouă',
  'workbench.commitTool.menu.jumpToSource': 'Salt la sursă',
  'workbench.commitTool.menu.delete': 'Ștergere…',
  'workbench.commitTool.menu.addToVcs': 'Adăugare la VCS',
  'workbench.commitTool.menu.addToGitignore': 'Adăugare la .gitignore',
  'workbench.commitTool.menu.excludeFile': '.git/info/exclude',
  'workbench.commitTool.menu.newChangelist': 'Listă de modificări nouă…',
  'workbench.commitTool.menu.editChangelist': 'Editare listă de modificări…',
  'workbench.commitTool.menu.createPatch': 'Creare patch din modificările locale…',
  'workbench.commitTool.menu.copyPatch': 'Copiere ca patch în clipboard',
  'workbench.commitTool.menu.shelveChanges': 'Amânare modificări…',
  'workbench.commitTool.menu.localHistory': 'Istoric local',
  'workbench.commitTool.menu.localHistoryShow': 'Afișare istoric…',
  'workbench.commitTool.menu.showProjectHistory': 'Afișare istoric proiect…',
  'workbench.commitTool.menu.recentChanges': 'Modificări recente',
  'workbench.commitTool.menu.putLabel': 'Aplicare etichetă…',
  'workbench.commitTool.menu.git': 'Git',
  'workbench.commitTool.menu.add': 'Adăugare',
  'workbench.commitTool.menu.compareRevision': 'Comparare cu o revizie…',
  'workbench.commitTool.menu.compareBranch': 'Comparare cu o ramură sau o etichetă…',
  'workbench.commitTool.menu.showHistory': 'Afișare istoric',
  'workbench.commitTool.menu.showCurrentRevision': 'Afișare revizia curentă',
  'workbench.commitTool.menu.push': 'Push…',
  'workbench.commitTool.menu.pull': 'Pull…',
  'workbench.commitTool.menu.fetch': 'Fetch',
  'workbench.commitTool.menu.merge': 'Îmbinare…',
  'workbench.commitTool.menu.rebase': 'Rebase…',
  'workbench.commitTool.menu.branches': 'Ramuri…',
  'workbench.commitTool.menu.newBranch': 'Ramură nouă…',
  'workbench.commitTool.menu.newTag': 'Etichetă nouă…',
  'workbench.commitTool.menu.resetHead': 'Resetare HEAD…',
  'workbench.commitTool.menu.stash': 'Stocare temporară a modificărilor…',
  'workbench.commitTool.menu.unstash': 'Restaurare modificări stocate temporar…',
  'workbench.commitTool.menu.github': 'GitHub',
  'workbench.commitTool.menu.manageRemotes': 'Gestionare depozite la distanță…',
  'workbench.commitTool.menu.clone': 'Clonare…',
  'workbench.commitTool.menu.comparePickerTitle': 'Comparare cu o ramură sau o etichetă',
  'workbench.commitTool.menu.comparePickerSearch': 'Căutare ramuri și etichete',
  'workbench.commitTool.menu.comparePickerEmpty': 'Nicio referință corespunzătoare',
  'workbench.commitTool.menu.pullUpToDate': 'Deja actualizat',
  'workbench.commitTool.menu.pullDone': 'Pull finalizat',
  'workbench.commitTool.menu.pullFailed': 'Pull eșuat: {detail}',
  'workbench.commitTool.menu.ignoreFailed': 'Fișierul de ignorare nu a putut fi actualizat: {detail}',
  'workbench.commitTool.menu.stopIgnoring': 'Oprire ignorare',
  'workbench.commitTool.ignoreSourceGlobal': 'global',
  'workbench.commitTool.menu.fetchDone': 'Fetch finalizat',
  'workbench.commitTool.pushed': 'Trimis',
  'workbench.commitTool.nothingToPush': 'Nimic de trimis',
  'workbench.commitTool.errors.notARepo': 'Acest spațiu de lucru nu are un depozit Git',
  'workbench.commitTool.errors.gitUnavailable': 'Git nu este disponibil pe acest computer',
  'workbench.commitTool.errors.emptyMessage': 'Introduceți un mesaj de commit',
  'workbench.commitTool.errors.noPaths': 'Selectați cel puțin un fișier pentru commit',
  'workbench.commitTool.errors.amendUnborn': 'Nu există încă niciun commit de modificat',
  'workbench.commitTool.errors.amendMerge': 'Commit-urile de îmbinare nu pot fi modificate',
  'workbench.commitTool.errors.amendPushed':
    'HEAD este deja trimis în ramura din amonte — modificarea ar rescrie istoricul publicat',
  'workbench.commitTool.errors.stageFailed': 'Fișierele selectate nu au putut fi pregătite pentru commit',
  'workbench.commitTool.errors.commitFailed': 'Commit eșuat',
  'workbench.commitTool.errors.pushFailed': 'Push eșuat',

  // ── Proxy capture tool window (control strip) ────────────────────
  'workbench.proxyCapture.running': 'În funcțiune · :{port}',
  'workbench.proxyCapture.stopped': 'Oprit',
  'workbench.proxyCapture.start': 'Pornire',
  'workbench.proxyCapture.stop': 'Oprire',
  'workbench.proxyCapture.port': 'Port',
  'workbench.proxyCapture.scope': 'Sfera de decriptare',
  'workbench.proxyCapture.optionsAria': 'Setări Proxy de sistem',
  'workbench.proxyCapture.scopePlaceholder': 'example.com, *.example.com',
  'workbench.proxyCapture.scopeHint':
    'Doar gazdele listate sunt decriptate; tot restul traficului HTTPS trece ca tunel opac.',
  'workbench.proxyCapture.scopeSaved': 'Sfera de decriptare a fost actualizată',
  'workbench.proxyCapture.scopeFailed': 'Sfera nu a putut fi actualizată: {message}',
  'workbench.proxyCapture.startFailed': 'Proxy-ul nu a putut fi pornit: {message}',
  'workbench.proxyCapture.emptyRunning': 'Se așteaptă trafic prin proxy…',
  'workbench.proxyCapture.emptyRunningHint':
    'Îndreptați orice aplicație — instrumente CLI, scripturi, alt dispozitiv — către http://127.0.0.1:{port} pentru a-i captura cererile',
  'workbench.proxyCapture.emptyStopped': 'Proxy-ul este oprit',
  'workbench.proxyCapture.emptyStoppedHint': 'Porniți proxy-ul pentru a începe capturarea traficului',
  'workbench.proxyCapture.noCa':
    'Nicio CA de încredere — HTTP este capturat integral; HTTPS rămâne un tunel opac până o instalați.',
  'workbench.proxyCapture.noCaAction': 'Instalare CA',
  'workbench.proxyCapture.routing': 'Rutare browsere',
  'workbench.proxyCapture.routingFailed': 'Rutarea nu a putut fi actualizată: {message}',
  'workbench.proxyCapture.routingActiveLead':
    'Aceste browsere trimit acum gazdele din sfera de decriptare prin proxy-ul de captură; tot restul rămâne direct.',
  'workbench.proxyCapture.routingCaveat':
    'Pe gazdele rutate, HTTP/3 revine la HTTP/2 sau 1.1, iar punctele finale cu certificate fixate pot eșua.',
  'workbench.proxyCapture.routingInactive': 'Browserele rutează gazdele din sferă odată ce proxy-ul rulează.',
  'workbench.proxyCapture.routingUnsupported': '{agent} · neacceptat',
  'workbench.proxyCapture.scopeInfo.exampleCaption': 'Exemplu de sferă',
  'workbench.proxyCapture.scopeInfo.exampleDecrypted': 'decriptat',
  'workbench.proxyCapture.scopeInfo.exampleOpaque': 'tunel opac',
  'workbench.proxyCapture.scopeInfo.summary':
    'Doar gazdele listate sunt decriptate TLS și inspectate — orice altă conexiune HTTPS trece ca tunel opac, niciodată interceptată.',
  'workbench.proxyCapture.scopeInfo.description':
    'O listă goală nu decriptează nimic: interceptarea este întotdeauna o alegere explicită, gazdă cu gazdă.',
  'workbench.proxyCapture.scopeInfo.patternsHeading': 'Modele',
  'workbench.proxyCapture.scopeInfo.exactDesc': 'Nume de gazdă exact — se potrivește doar cu domeniul rădăcină.',
  'workbench.proxyCapture.scopeInfo.wildcardDesc': 'Orice subdomeniu — niciodată domeniul rădăcină însuși.',
  'workbench.proxyCapture.scopeInfo.ipDesc': 'O adresă IP literală se potrivește exact.',
  'workbench.proxyCapture.routingInfo.exampleCaption': 'Exemplu de rutare',
  'workbench.proxyCapture.routingInfo.summary':
    'Browserele conectate trimit gazdele din sfera de decriptare prin proxy-ul de captură — fără setări de proxy în sistemul de operare, fără configurare manuală; tot restul rămâne direct. În principal pentru browsere pe care nu le puteți urmări sau depana direct.',
  'workbench.proxyCapture.routingInfo.description':
    'Rutarea persistă până o opriți — o repornire a aplicației sau o cădere a conexiunii nu lasă niciodată browserul blocat în spatele unui proxy mort.',
  'workbench.proxyCapture.routingInfo.behaviorHeading': 'Comportament',
  'workbench.proxyCapture.routingInfo.appliedDesc':
    'Browserele Chromium aplică un PAC generat; Firefox rutează per cerere.',
  'workbench.proxyCapture.routingInfo.failoverDesc':
    'Dacă portul de captură este inaccesibil, traficul revine la o conexiune directă — o lacună în captură, niciodată navigare întreruptă.',
  'workbench.proxyCapture.routingInfo.h3Desc':
    'Gazdele rutate revin de la HTTP/3 la HTTP/2 sau 1.1; punctele finale cu certificate fixate pot eșua cât timp sunt rutate.',
  'workbench.proxyCapture.routingPopoverHint':
    'Rutează gazdele din sfera de decriptare de la browserele conectate prin proxy-ul de captură. În principal pentru browsere pe care nu le puteți urmări sau depana direct — o filă urmăribilă primește mai mult prin modul Depanare de pe rândul ei.',

  // ── Traffic Monitor tool window (unified observability surface) ─────
  'workbench.trafficMonitor.browserConnected': 'Browsere conectate: {count}',
  'workbench.trafficMonitor.noBrowser': 'Niciun browser conectat',
  'workbench.trafficMonitor.untitledTab': 'Filă fără titlu',
  'workbench.trafficMonitor.closeSourceTab': 'Închidere filă',
  'workbench.trafficMonitor.railSideToRight': 'Mutare surse în partea dreaptă',
  'workbench.trafficMonitor.railSideToLeft': 'Mutare surse în partea stângă',
  'workbench.trafficMonitor.extensionVersion': 'v{version}',
  'workbench.trafficMonitor.emptyWatching': 'Se așteaptă trafic…',
  'workbench.trafficMonitor.emptyWatchingHint': 'Navigați în fila urmărită — cererile ei apar aici în timp real',
  'workbench.trafficMonitor.browserTabs': 'File de browser',
  'workbench.trafficMonitor.windowLabel': 'Fereastra {n}',
  'workbench.trafficMonitor.proxySystem': 'Proxy · Sistem',
  'workbench.trafficMonitor.systemProxy': 'Proxy de sistem',
  'workbench.trafficMonitor.systemProxyHint':
    'Trafic din afara browserului și neurmăribil — tot ce este rutat prin portul de captură: instrumente CLI, aplicații native, alte dispozitive',
  'workbench.trafficMonitor.emptyNoSource': 'Nicio sursă selectată',
  'workbench.trafficMonitor.emptyNoSourceHint':
    'Alegeți o filă de browser sau Proxy de sistem din lista de surse pentru a-i urmări traficul',
  'workbench.trafficMonitor.debugTab':
    'Depanare această filă — fidelitate completă: corpuri, antete exacte, temporizare',
  'workbench.trafficMonitor.debugAttached':
    'Această filă este depanată — fidelitate completă prin depanatorul browserului',
  'workbench.trafficMonitor.debugPinned': 'Fixată pentru depanare — se atașează odată ce modul Depanare este activ',
  'workbench.trafficMonitor.debugPinAria': 'Comutare depanare pentru această filă',
  'workbench.trafficMonitor.debugModeHint':
    'Modul Depanare — atașează depanatorul browserului la filele din rază și la cele fixate, pentru corpuri și antete exacte. Browserul afișează un banner pe fiecare filă atașată.',
  'workbench.trafficMonitor.captureAria': 'Opțiuni de captură pentru această sursă',
  'workbench.trafficMonitor.captureMenuStart': 'Pornire captură',
  'workbench.trafficMonitor.captureMenuStartHint':
    'Păstrează traficul recent al acestei surse: agenții AI conectați îl pot citi (valorile sensibile mascate), iar „Salvare sesiune” îl înregistrează pe disc. Urmărirea vizualizării live de aici nu are nevoie de asta.',
  'workbench.trafficMonitor.captureAdvanced': 'Avansat',
  'workbench.trafficMonitor.captureDebugOptionHint':
    'Fidelitate completă prin depanatorul browserului — corpuri de răspuns și antete exacte. Browserul afișează un banner de depanare.',
  'workbench.trafficMonitor.captureSaveOption': 'Salvare sesiune',
  'workbench.trafficMonitor.captureSaveOptionHint':
    'Înregistrează captura în arhiva de sesiuni criptată de pe acest computer',
  'workbench.trafficMonitor.captureMenuStop': 'Oprire captură',
  'workbench.trafficMonitor.captureMenuStopRecordingHint': 'Încheie înregistrarea și păstrează sesiunea',
  'workbench.trafficMonitor.sessionsTitle': 'Sesiuni',
  'workbench.trafficMonitor.noBrowsersHint':
    'Niciun browser conectat. Deschideți un browser cu extensia instalată sau instalați-o:',
  'workbench.trafficMonitor.installExtension': 'Instalare extensie pentru {browser}',
  'workbench.trafficMonitor.watchConsentOff': 'Vizualizare oprită',
  'workbench.trafficMonitor.watchConsentOffHint':
    'Extensia acestui browser nu permite aplicației desktop să îi vadă traficul, stocarea sau consola. Regulile și sincronizarea funcționează în continuare. Activați „Permiteți aplicației desktop să vadă acest browser” în setările extensiei pentru a-l urmări aici.',
  'workbench.trafficMonitor.watchConsentOffEmpty': 'Vizualizarea live este oprită în acest browser',
  'workbench.trafficMonitor.watchConsentOffEmptyHint':
    'Activați „Permiteți aplicației desktop să vadă acest browser” în setările extensiei pentru a urmări aici traficul, stocarea și consola acestei file',

  // ── The SESSIONS rail section (the sessions archive, in-rail) ───────
  'workbench.trafficSessions.empty': 'Nicio sesiune salvată încă',
  'workbench.trafficSessions.emptyHint':
    'Capturați o sursă în panoul „Trafic” cu „Salvare sesiune” activat — sesiunile salvate ajung aici',
  'workbench.trafficSessions.stateRecording': 'Înregistrare',
  'workbench.trafficSessions.stateSealing': 'Sigilare…',
  'workbench.trafficSessions.move': 'Mutare în folder',
  'workbench.trafficSessions.moveNew': 'Folder nou…',
  'workbench.trafficSessions.moveNone': 'Eliminare din folder',
  'workbench.trafficSessions.deleteTitle': 'Ștergere această sesiune?',
  'workbench.trafficSessions.deleteBody':
    '„{name}” și toate datele înregistrate la care face referire doar această sesiune sunt eliminate de pe disc.',
  'workbench.trafficSessions.deleteOk': 'Ștergere',
  'workbench.trafficSessions.deleteGroupTitle': 'Ștergere „{name}”?',
  'workbench.trafficSessions.deleteGroupBody':
    'Sesiunile din acest folder ({count}) și toate datele înregistrate la care fac referire doar ele sunt eliminate de pe disc.',

  // ── Session replay tab (C6 — an archived session in the live views) ──
  'workbench.sessionReplay.empty': 'Această sesiune nu a înregistrat nicio cerere',
  'workbench.sessionReplay.emptyHint':
    'Sursa a fost capturată, dar niciun trafic nu a trecut prin ea în timpul înregistrării',
  'workbench.sessionReplay.unavailableTitle': 'Această sesiune nu a putut fi deschisă',
  'workbench.sessionReplay.unavailableBody':
    'Datele înregistrate lipsesc sau sunt deteriorate ori sunt criptate cu o cheie pe care această aplicație nu o mai deține.',

  // ── Shared markdown widgets (toolbar + highlighted code block) ──────
  'workbench.markdown.heading': 'Titlu',
  'workbench.markdown.bold': 'Aldin',
  'workbench.markdown.italic': 'Cursiv',
  'workbench.markdown.strikethrough': 'Tăiat',
  'workbench.markdown.codeBlock': 'Bloc de cod',
  'workbench.markdown.link': 'Link',
  'workbench.markdown.bulletedList': 'Listă cu marcatori',
  'workbench.markdown.numberedList': 'Listă numerotată',
  'workbench.markdown.table': 'Tabel',
  'workbench.markdown.copyCode': 'Copiere cod',
  'workbench.markdown.copied': 'Copiat',

  // ── Two-tone icon picker ────────────────────────────────────────────
  'workbench.iconPicker.searchPlaceholder': 'Căutare pictograme...',

  // ── Template editor ─────────────────────────────────────────────────
  'workbench.templateEditor.toast.saved': 'Șablon salvat',
  'workbench.templateEditor.toast.saveFailed': 'Salvarea șablonului a eșuat',
  'workbench.templateEditor.notFound': 'Șablonul nu a fost găsit',
  'workbench.templateEditor.namePlaceholder': 'Nume șablon',
  'workbench.templateEditor.descriptionPlaceholder': 'Descriere (opțional)',
  'workbench.templateEditor.includeConditions': 'Includere condiții',
  'workbench.templateEditor.includeActions': 'Includere acțiuni',
  'workbench.templateEditor.conditionsTitle': 'Condiții',

  // ── What's New tab ──────────────────────────────────────────────────
  'workbench.whatsNew.title': 'Noutăți în versiunea {version}',
  'workbench.whatsNew.noNotes': 'Această versiune este livrată fără note de lansare.',
  'workbench.whatsNew.historyTitle': 'Lansări anterioare',
  'workbench.whatsNew.historyShowNotes': 'Afișare note',
  'workbench.whatsNew.historyHideNotes': 'Ascundere note',
  'workbench.whatsNew.historyNotesUnavailable': 'Notele de lansare nu au putut fi încărcate.',
  'workbench.whatsNew.historyBetaTag': 'Beta',
  'workbench.whatsNew.historySecurityTag': 'Securitate',

  // ── Keyboard shortcuts: SHORTCUTS registry action names + the docs
  // cheatsheet chrome around them. Chords, key caps (?, ⌘, Ctrl) and
  // the regions diagram internals stay raw. ──────────────────────────
  'workbench.shortcuts.action.toggleLeftSidebar': 'Comutare bară laterală stângă',
  'workbench.shortcuts.action.toggleRightSidebar': 'Comutare bară laterală dreaptă',
  'workbench.shortcuts.action.toggleBottomPanel': 'Comutare panou inferior',
  'workbench.shortcuts.action.toggleActivityFeed': 'Comutare flux de activitate',
  'workbench.shortcuts.action.terminalNewTab': 'Filă de terminal nouă',
  'workbench.shortcuts.action.closeTab': 'Închidere filă',
  'workbench.shortcuts.action.newTab': 'Filă nouă',
  'workbench.shortcuts.action.prevTab': 'Fila anterioară',
  'workbench.shortcuts.action.nextTab': 'Fila următoare',
  'workbench.shortcuts.action.tabSearch': 'Căutare în file',
  'workbench.shortcuts.action.commandPalette': 'Paleta de comenzi',
  'workbench.shortcuts.action.focusFilter': 'Focalizare pe filtrul secțiunii active',
  'workbench.shortcuts.action.focusLeftSidebar': 'Focalizare pe bara laterală stângă',
  'workbench.shortcuts.action.focusEditor': 'Focalizare pe editor',
  'workbench.shortcuts.action.focusRightSidebar': 'Focalizare pe bara laterală dreaptă',
  'workbench.shortcuts.action.focusBottomPanel': 'Focalizare pe panoul inferior',
  'workbench.shortcuts.action.save': 'Salvare',
  'workbench.shortcuts.action.newRule': 'Creare element',
  'workbench.shortcuts.action.import': 'Import',
  'workbench.shortcuts.action.showShortcuts': 'Scurtături de tastatură',
  'workbench.shortcuts.action.openSettings': 'Deschidere setări',
  'workbench.shortcuts.action.find': 'Căutare în editor',
  'workbench.shortcuts.action.replace': 'Înlocuire în editor',
  'workbench.shortcuts.action.formatCode': 'Formatare cod',
  'workbench.shortcuts.category.panels': 'Panouri',
  'workbench.shortcuts.category.tabs': 'File',
  'workbench.shortcuts.category.navigation': 'Navigare',
  'workbench.shortcuts.category.actions': 'Acțiuni',
  'workbench.shortcuts.allSurfacesTitle': 'Toate suprafețele',
  'workbench.shortcuts.toggleDebugMode': 'Comutare mod Depanare',
  'workbench.shortcuts.goToTab': 'Salt la fila 1–9 (9 = ultima)',
  'workbench.shortcuts.introPrefix': 'Apăsați',
  'workbench.shortcuts.introMiddle': 'oricând pentru a ajunge aici. Scurtăturile folosesc',
  'workbench.shortcuts.introSuffix': 'ca tastă modificatoare.',
  'workbench.shortcuts.regionsCaption':
    'Patru combinații de taste vă mută focalizarea într-una din cele patru regiuni ale shell-ului.',

  // ── Docs navigator plane: group labels + section titles/summaries
  // from the workbench DOC_GROUPS registry (raw-or-key DocSection
  // idiom). Section body corpus + diagrams are their own station. ────
  'workbench.docs.nav.group.openHeaders': 'Open Headers',
  'workbench.docs.nav.group.concepts': 'Concepte',
  'workbench.docs.nav.group.modifyRequests': 'Modificarea cererilor',
  'workbench.docs.nav.group.modifyResponses': 'Modificarea răspunsurilor',
  'workbench.docs.nav.group.runCode': 'Rularea codului',
  'workbench.docs.nav.group.reference': 'Referință',
  'workbench.docs.nav.paradigm.title': 'Ce facem (altfel)',
  'workbench.docs.nav.paradigm.summary':
    'O extensie de browser care face ceea ce înainte necesita un proxy, un binar desktop sau un cont în cloud.',
  'workbench.docs.nav.comparison.title': 'Cum ne comparăm',
  'workbench.docs.nav.comparison.summary':
    'Cum se situează Open Headers față de platformele cloud, proxy-urile desktop și extensiile doar pentru antete.',
  'workbench.docs.nav.roadmap.title': 'Fiecare suprafață, livrată',
  'workbench.docs.nav.roadmap.summary':
    'Etapele livrate — spații de lucru Git, aplicație desktop, server MCP, server auto-găzduit, CLI, aplicație web, importatoare.',
  'workbench.docs.nav.conditions.title': 'Condiții',
  'workbench.docs.nav.conditions.summary':
    'Filtre cu potrivire AND care condiționează fiecare regulă — domenii, modele URL, metode, antete.',
  'workbench.docs.nav.actions.title': 'Acțiuni',
  'workbench.docs.nav.actions.summary':
    'Jumătatea „de făcut” a unei reguli — modificare cerere, modificare răspuns sau rulare cod. Se împerechează cu condițiile.',
  'workbench.docs.nav.variables.title': 'Variabile',
  'workbench.docs.nav.variables.summary':
    'Cinci sfere de variabile — vault, mediu, colecție, spațiu de lucru, live — și cum se rezolvă referințele.',
  'workbench.docs.nav.requestTracking.title': 'Urmărirea cererilor',
  'workbench.docs.nav.requestTracking.summary':
    'Cum sunt observate, înregistrate și afișate ca insigne în fereastra popup cererile potrivite.',
  'workbench.docs.nav.execution.title': 'Cum se execută regulile',
  'workbench.docs.nav.execution.summary':
    'Cele două motoare (DNR și bazat pe script) care decid unde se aplică fiecare regulă.',
  'workbench.docs.nav.multiTab.title': 'Comportamentul cu mai multe file',
  'workbench.docs.nav.multiTab.summary':
    'Ce se sincronizează între filele spațiului de lucru (datele) și ce rămâne per filă (aspectul, ciornele).',
  'workbench.docs.nav.systemStatus.title': 'Starea sistemului',
  'workbench.docs.nav.systemStatus.summary':
    'Pastila-semafor — ce raportează fiecare subsistem și ce înseamnă roșu / galben / verde.',
  'workbench.docs.nav.debugMode.title': 'Modul Depanare',
  'workbench.docs.nav.debugMode.summary':
    'Atașare la protocolul de depanare al browserului — rază de acțiune mai mare pentru cereri, injectare și mediul filei.',
  'workbench.docs.nav.headerActions.title': 'Acțiuni pe antete',
  'workbench.docs.nav.headerActions.summary':
    'Adăugarea, înlocuirea, adăugarea la sfârșit, eliminarea sau îmbinarea antetelor de cerere și de răspuns.',
  'workbench.docs.nav.block.title': 'Blocare',
  'workbench.docs.nav.block.summary': 'Anularea cererilor potrivite la nivelul rețelei.',
  'workbench.docs.nav.redirect.title': 'Redirecționare',
  'workbench.docs.nav.redirect.summary':
    'Trimiterea cererilor potrivite către o altă adresă URL — statică sau cu substituție regex.',
  'workbench.docs.nav.queryParam.title': 'Parametri de interogare',
  'workbench.docs.nav.queryParam.summary':
    'Adăugarea, înlocuirea sau eliminarea parametrilor de interogare URL înainte ca cererea să plece.',
  'workbench.docs.nav.requestBody.title': 'Corpul cererii',
  'workbench.docs.nav.requestBody.summary':
    'Suprascrierea sau transformarea corpurilor fetch / XHR trimise — static, dinamic sau filtrat GraphQL.',
  'workbench.docs.nav.response.title': 'Modificarea răspunsului',
  'workbench.docs.nav.response.summary':
    'Simularea sau modificarea răspunsurilor API — corp, stare și antete sintetice sau transformate.',
  'workbench.docs.nav.inject.title': 'Injectare JS / CSS',
  'workbench.docs.nav.inject.summary':
    'Rularea de JavaScript sau CSS în contextul paginii — înaintea scripturilor paginii sau după ce DOM este gata.',
  'workbench.docs.nav.delay.title': 'Întârziere',
  'workbench.docs.nav.delay.summary':
    'Adăugarea de latență artificială navigărilor și cererilor fetch / XHR inițiate din JS.',
  'workbench.docs.nav.resourceTypes.title': 'Tipuri de resurse',
  'workbench.docs.nav.resourceTypes.summary':
    'Tabel de referință pentru valorile Chrome ResourceType — Page, Frame, Fetch/XHR, Script și restul.',
  'workbench.docs.nav.keyboardShortcuts.title': 'Scurtături de tastatură',
  'workbench.docs.nav.keyboardShortcuts.summary':
    'Fiecare scurtătură din fereastra Workbench, grupată pe suprafețe — panouri, file, navigare, acțiuni.',
  'workbench.docs.nav.limitations.title': 'Limitări',
  'workbench.docs.nav.limitations.summary':
    'Surprizele cunoscute, într-un singur loc — vizibilitatea în DevTools, raza de acțiune a scripturilor, potrivirea antetelor, Îmbinare.',

  // ── Copy-as-snippet toasts (sidebar row menu + request editor ⋯) ────
  'workbench.copySnippet.copied': 'Copiat ca {format}',
  'workbench.copySnippet.failed': 'Copierea a eșuat',
  'workbench.copySnippet.failedDetail': 'Copierea a eșuat: {message}',
} as const satisfies Catalog;
