/**
 * Workbench chrome — the shell plane — French. Mirrors
 * `catalogs/en/workbench-chrome.ts` key for key. Reuses the fr mints:
 * `Flux d'activité` + `palette de commandes` + the shortcut action
 * labels (fr/workbench-settings-defs-keyboard), the layout-menu
 * vocabulary and switch-behavior option labels
 * (fr/workbench-settings-defs), donor phrasing (fr/shared-chrome),
 * sidebar rule-type nouns and pause plane `Suspendre`/`Reprendre`
 * (fr/workbench-chrome-sidebar), rule kickers as entity names
 * (fr/workbench-editors-rule), header-op vocabulary (`Ajouter à la
 * suite`, `Retirer`, `Fusionner`), Override = `Substituer`. Raw by
 * design: `Docs` / `Params` tab names (gRPC precedent), auth scheme
 * and body-mode enums (Basic, Bearer Token, Form data, raw, GraphQL),
 * Chrome ResourceType values (Page, Frame, Fetch/XHR, Script), DNR /
 * AND / DOM / L4 / L7 / TCP / TLS / RTT / regex / `handshake` (m.),
 * `workflow` / `workbench` / `shell` / `Vault` / `Live` loanwords,
 * footer key caps (↑↓ / ← / → / ↵ / esc) and the {chord} / {unit} /
 * {units} holes.
 */

import type { Catalog } from '../../types';

export const workbenchChrome = {
  // ── Tab strip: context menu ─────────────────────────────────────────
  'workbench.tabbar.menu.duplicateTab': "Dupliquer l'onglet",
  'workbench.tabbar.menu.close': 'Fermer',
  'workbench.tabbar.menu.closeOther': 'Fermer les autres onglets',
  'workbench.tabbar.menu.closeAll': 'Fermer tous les onglets',
  'workbench.tabbar.menu.closeUnmodified': 'Fermer les onglets non modifiés',
  'workbench.tabbar.menu.closeLeft': 'Fermer les onglets à gauche',
  'workbench.tabbar.menu.closeRight': 'Fermer les onglets à droite',
  'workbench.tabbar.menu.splitAndMove': 'Scinder et déplacer',
  'workbench.tabbar.menu.right': 'À droite',
  'workbench.tabbar.menu.left': 'À gauche',
  'workbench.tabbar.menu.down': 'En bas',
  'workbench.tabbar.menu.up': 'En haut',
  'workbench.tabbar.menu.moveOpposite': 'Déplacer vers le groupe opposé',
  'workbench.tabbar.menu.changeSplitterOrientation': "Changer l'orientation du séparateur",
  'workbench.tabbar.menu.unsplit': 'Annuler la scission',
  'workbench.tabbar.menu.unsplitAll': 'Annuler toutes les scissions',

  // ── Tab strip: close guard confirms (useTabLifecycle) ───────────────
  // The dialog bodies follow a bolded tab label in the JSX, so they key
  // as the sentence remainder (OnboardingTour bold-prefix idiom).
  'workbench.tabbar.closeGuard.unsavedTitle': 'Enregistrer les modifications ?',
  'workbench.tabbar.closeGuard.unsavedBody':
    'comporte des modifications non enregistrées. Enregistrez-les pour ne pas perdre votre travail.',
  'workbench.tabbar.closeGuard.dontSave': 'Ne pas enregistrer',
  'workbench.tabbar.closeGuard.cancel': 'Annuler',
  'workbench.tabbar.closeGuard.save': 'Enregistrer les modifications',
  'workbench.tabbar.closeGuard.draftTitle': 'Abandonner le brouillon ?',
  'workbench.tabbar.closeGuard.draftBody':
    "n'a pas encore été publié. L'abandonner supprime le brouillon ; le garder le laisse dans votre barre " +
    'latérale pour le terminer plus tard.',
  'workbench.tabbar.closeGuard.discard': 'Abandonner',
  'workbench.tabbar.closeGuard.keep': 'Garder comme brouillon',

  // ── Tab strip: bar chrome + search overlay ──────────────────────────
  'workbench.tabbar.createApiRequest': 'Créer une requête API',
  'workbench.tabbar.createItem': 'Créer un élément',
  'workbench.tabbar.searchTabs': 'Rechercher dans les onglets',
  'workbench.tabbar.search.placeholder': 'Rechercher dans les onglets...',
  'workbench.tabbar.search.noMatch': 'Aucun onglet ouvert ne correspond à votre recherche',
  'workbench.tabbar.search.noOpenTabs': 'Aucun onglet ouvert',
  'workbench.tabbar.search.noClosedMatch': 'Aucun onglet fermé ne correspond à votre recherche',
  'workbench.tabbar.search.recentlyClosed': 'Récemment fermés ({count})',
  'workbench.tabbar.search.recentlyClosedFiltered': 'Récemment fermés ({matched} sur {total})',
  'workbench.tabbar.envPinnedAria': 'Environnement épinglé',
  'workbench.tabbar.fromExample': 'depuis « {name} »',

  // ── Scratch segment labels (tab tooltip + breadcrumb bar) ───────────
  'workbench.scratch.request': 'Requête provisoire',
  'workbench.scratch.rule': 'Règle provisoire',
  'workbench.scratch.variable': 'Variable provisoire',
  'workbench.scratch.workflow': 'Workflow provisoire',

  // ── Shell: command palette ──────────────────────────────────────────
  'workbench.shell.commandPalette.collectionsDivider': 'Collections',
  'workbench.shell.commandPalette.searchInGroup': 'Rechercher dans {name}...',
  'workbench.shell.commandPalette.placeholder': 'Recherchez règles, collections, ou tapez > pour les commandes...',
  'workbench.shell.commandPalette.noResults': 'Aucun résultat',
  'workbench.shell.commandPalette.emptyHint': 'Tapez pour rechercher ou > pour les commandes',
  'workbench.shell.commandPalette.footer.navigate': '↑↓ naviguer',
  'workbench.shell.commandPalette.footer.back': '← retour',
  'workbench.shell.commandPalette.footer.open': '→ ouvrir',
  'workbench.shell.commandPalette.footer.select': '↵ sélectionner',
  'workbench.shell.commandPalette.footer.close': 'esc fermer',
  'workbench.shell.commandPalette.group.rules': 'Règles',
  'workbench.shell.commandPalette.group.templates': 'Modèles',
  'workbench.shell.commandPalette.group.requests': 'Requêtes',
  'workbench.shell.commandPalette.group.systemTemplates': 'Modèles système',
  'workbench.shell.commandPalette.group.settings': 'Paramètres',
  'workbench.shell.commandPalette.section.create': 'Créer',
  'workbench.shell.commandPalette.section.commands': 'Commandes',
  'workbench.shell.commandPalette.section.variables': 'Variables',
  'workbench.shell.commandPalette.cmd.createItem': 'Créer un élément...',
  'workbench.shell.commandPalette.cmd.newRuleType': 'Nouvelle {type}',
  'workbench.shell.commandPalette.cmd.toggleLeftSidebar': 'Basculer la barre latérale gauche',
  'workbench.shell.commandPalette.cmd.toggleRightSidebar': 'Basculer la barre latérale droite',
  'workbench.shell.commandPalette.cmd.toggleBottomPanel': 'Basculer le panneau inférieur',
  'workbench.shell.commandPalette.cmd.toggleActivityFeed': "Basculer le flux d'activité",
  'workbench.shell.commandPalette.cmd.keyboardShortcuts': 'Raccourcis clavier',
  'workbench.shell.commandPalette.cmd.openSettings': 'Ouvrir les paramètres',
  'workbench.shell.commandPalette.cmd.openWorkspaceVariables': "Ouvrir les variables d'espace de travail",
  'workbench.shell.commandPalette.cmd.openVault': 'Ouvrir le Vault',
  'workbench.shell.commandPalette.cmd.openLiveVariables': 'Ouvrir les variables Live',
  'workbench.shell.commandPalette.cmd.openPackageLibrary': 'Ouvrir la bibliothèque de packages',
  'workbench.shell.commandPalette.cmd.openEnvironment': "Ouvrir l'environnement : {name}",

  // ── Shell: top bar (search button, layout menu, panel toggles) ──────
  'workbench.shell.topbar.search': 'Rechercher ou exécuter une commande...',
  'workbench.shell.topbar.layout.bottomAlignment': 'Alignement du panneau inférieur',
  'workbench.shell.topbar.layout.alignCenter': 'Centré (imbriqué)',
  'workbench.shell.topbar.layout.alignLeft': 'Gauche',
  'workbench.shell.topbar.layout.alignRight': 'Droite',
  'workbench.shell.topbar.layout.alignJustify': 'Justifié (pleine largeur)',
  'workbench.shell.topbar.layout.showToolWindowNames': "Afficher les noms des fenêtres d'outils",
  'workbench.shell.topbar.layout.activityBarLayout': "Disposition de la barre d'activité",
  'workbench.shell.topbar.layout.sidebarProportional': 'Proportionnelle (moitiés égales)',
  'workbench.shell.topbar.layout.sidebarCompact': 'Compacte (bas épinglé)',
  'workbench.shell.topbar.layout.sidebarStacked': 'Empilée (tout en haut)',
  'workbench.shell.topbar.layout.sidebarDynamic': 'Dynamique (suit les hauteurs des panneaux)',
  'workbench.shell.topbar.layout.defaultLayoutDonor': '{unit} de disposition par défaut',
  'workbench.shell.topbar.layout.inheritsDefault': 'Hérite de la disposition par défaut',
  'workbench.shell.topbar.layout.donorTooltip':
    'Ce {unit} est le défaut — les nouveaux {units} héritent de cette disposition.',
  'workbench.shell.topbar.layout.nonDonorTooltip':
    'Un autre {unit} est le défaut — les nouveaux {units} héritent de sa disposition.',
  'workbench.shell.topbar.layout.resetToDefaults': 'Rétablir la disposition par défaut',
  'workbench.shell.topbar.layout.restoreHidden': "Restaurer les outils masqués de la barre d'activité",
  'workbench.shell.topbar.toggle.leftSidebar': 'Barre latérale gauche',
  'workbench.shell.topbar.toggle.bottomPanel': 'Panneau inférieur',
  'workbench.shell.topbar.toggle.rightSidebar': 'Barre latérale droite',
  'workbench.shell.topbar.bottomAlign.center': 'Panneau inférieur : centré (imbriqué)',
  'workbench.shell.topbar.bottomAlign.left': 'Panneau inférieur : aligné à gauche',
  'workbench.shell.topbar.bottomAlign.right': 'Panneau inférieur : aligné à droite',
  'workbench.shell.topbar.bottomAlign.justify': 'Panneau inférieur : pleine largeur',
  'workbench.shell.topbar.bottomAlign.chooseAria': "Choisir l'alignement du panneau inférieur",
  'workbench.shell.topbar.layoutOptions': 'Options de disposition',

  // ── Shell: status bar ───────────────────────────────────────────────
  'workbench.shell.statusbar.theme.light': 'Clair',
  'workbench.shell.statusbar.theme.dark': 'Sombre',
  'workbench.shell.statusbar.theme.auto': 'Auto',
  'workbench.shell.statusbar.systemStatus': 'État du système',

  // ── Shell: activity bar ─────────────────────────────────────────────
  'workbench.shell.activityBar.hideLabels': 'Masquer les libellés',
  'workbench.shell.activityBar.showLabels': 'Afficher les libellés',

  // ── Shell: editor empty state ───────────────────────────────────────
  'workbench.shell.empty.createRule': 'Créer une règle',
  'workbench.shell.empty.createRuleDesc': 'En-têtes, redirections, blocage et plus',
  'workbench.shell.empty.createVariable': 'Créer une variable',
  'workbench.shell.empty.createVariableDesc': 'Environnement, espace de travail, live et plus',
  'workbench.shell.empty.createRequest': 'Créer une requête API',
  'workbench.shell.empty.createRequestDesc': 'Construisez, envoyez et enregistrez des requêtes HTTP',
  'workbench.shell.empty.createWorkflow': 'Créer un workflow',
  'workbench.shell.empty.createWorkflowDesc': 'Enchaînez et planifiez des requêtes API',
  'workbench.shell.empty.import': 'Importer',
  'workbench.shell.empty.importDesc': 'Curl, HAR, Postman et plus',
  'workbench.shell.empty.migrate': 'Migrer depuis un autre outil',
  'workbench.shell.empty.migrateDesc': 'Apportez vos données Postman, Insomnia ou Bruno',
  'workbench.shell.empty.browseTemplates': 'Parcourir tous les modèles…',
  'workbench.shell.empty.varEnvironment': "Variable d'environnement",
  'workbench.shell.empty.varWorkspace': "Variable d'espace de travail",
  'workbench.shell.empty.varLive': 'Variable live',
  'workbench.shell.empty.varVault': 'Secret du vault',
  'workbench.shell.empty.varCollection': 'Variable de collection',
  'workbench.shell.empty.varCollectionTooltip':
    "Les variables de collection se créent depuis l'intérieur d'une collection.",

  // ── Shell: environment selector ─────────────────────────────────────
  'workbench.shell.envSelector.noEnvironment': 'Aucun environnement',
  'workbench.shell.envSelector.defaultPill': 'DÉFAUT',
  'workbench.shell.envSelector.defaultTooltip':
    "L'environnement par défaut est sélectionné automatiquement pendant le travail avec la collection.",
  'workbench.shell.envSelector.openEnv': 'Ouvrir {name}',
  'workbench.shell.envSelector.pinToTab': 'Épingler à cet onglet',
  'workbench.shell.envSelector.unpinFromTab': 'Désépingler de cet onglet',
  'workbench.shell.envSelector.pinToTabDesc': "Bascule vers cet environnement chaque fois que l'onglet a le focus.",
  'workbench.shell.envSelector.pinToCollection': 'Épingler à la collection',
  'workbench.shell.envSelector.unpinFromCollection': 'Désépingler de la collection',
  'workbench.shell.envSelector.pinToCollectionDesc':
    'Affiche cet environnement dans la liste épinglée de la collection.',
  'workbench.shell.envSelector.pinAria': "Épingler l'environnement",
  'workbench.shell.envSelector.setCollectionDefault': 'Définir comme défaut de la collection',
  'workbench.shell.envSelector.clearCollectionDefault': 'Effacer le défaut de la collection',
  'workbench.shell.envSelector.searchPlaceholder': 'Rechercher des environnements…',
  'workbench.shell.envSelector.modeLabel': 'Mode : {mode}',
  'workbench.shell.envSelector.switchBehavior.title': 'Lors du passage entre les collections',
  'workbench.shell.envSelector.switchBehavior.keep': "Garder l'environnement sélectionné",
  'workbench.shell.envSelector.switchBehavior.keepDesc':
    "Votre sélection reste en place à travers les collections et tout ce qu'elles contiennent.",
  'workbench.shell.envSelector.switchBehavior.applyDefaults': 'Appliquer les défauts des collections',
  'workbench.shell.envSelector.switchBehavior.applyDefaultsDesc':
    "Les défauts prennent la main à l'intérieur. Votre dernier choix manuel est restauré ailleurs.",
  'workbench.shell.envSelector.switchBehavior.follow': 'Suivre chaque collection',
  'workbench.shell.envSelector.switchBehavior.followDesc':
    "Les collections dotées d'un défaut y basculent (et mémorisent vos choix). Les autres ne basculent pas.",
  'workbench.shell.envSelector.switchBehavior.aria': "Comportement de changement d'environnement",
  'workbench.shell.envSelector.pinnedBanner':
    "Épinglé à l'onglet courant — choisir un environnement déplace l'épingle.",
  'workbench.shell.envSelector.unpin': 'Désépingler',
  'workbench.shell.envSelector.createNew': 'Créer un nouvel environnement',
  'workbench.shell.envSelector.pinnedSection': 'Épinglés à cette collection',
  'workbench.shell.envSelector.othersSection': 'Autres environnements',
  'workbench.shell.envSelector.noMatches': 'Aucun environnement correspondant',
  'workbench.shell.envSelector.footer.vault': 'Vault',
  'workbench.shell.envSelector.footer.collection': 'Collection',
  'workbench.shell.envSelector.footer.workspace': 'Espace de travail',
  'workbench.shell.envSelector.footer.live': 'Live',
  'workbench.shell.envSelector.triggerAriaActive': 'Environnement actif : {name}',
  'workbench.shell.envSelector.triggerAriaActivePinned': 'Environnement actif : {name} (épinglé par cet onglet)',
  'workbench.shell.envSelector.triggerAriaNone': 'Aucun environnement sélectionné',
  'workbench.shell.envSelector.triggerAriaNonePinned': 'Aucun environnement sélectionné (épinglé par cet onglet)',

  // ── Shell: breadcrumb root nouns ────────────────────────────────────
  'workbench.shell.breadcrumbs.settings': 'Paramètres',
  'workbench.shell.breadcrumbs.whatsNew': 'Nouveautés',
  'workbench.shell.breadcrumbs.workspaces': 'Espaces de travail',
  'workbench.shell.breadcrumbs.daemonAdmin': 'Admin du daemon',
  'workbench.shell.breadcrumbs.environments': 'Environnements',
  'workbench.shell.breadcrumbs.specs': 'Spécifications',
  'workbench.shell.breadcrumbs.workspaceVariables': "Variables d'espace de travail",
  'workbench.shell.breadcrumbs.vault': 'Vault',
  'workbench.shell.breadcrumbs.packageLibrary': 'Bibliothèque de packages',
  'workbench.shell.breadcrumbs.rules': 'Règles',
  'workbench.shell.breadcrumbs.requests': 'Requêtes',
  'workbench.shell.breadcrumbs.templates': 'Modèles',
  'workbench.shell.breadcrumbs.variables': 'Variables',
  'workbench.shell.breadcrumbs.apiRequests': 'Requêtes API',
  'workbench.shell.breadcrumbs.workflows': 'Workflows',
  'workbench.shell.breadcrumbs.liveVariables': 'Variables Live',

  // ── Shell: fallback entity labels ───────────────────────────────────
  'workbench.shell.fallback.workflow': 'Workflow',
  'workbench.shell.fallback.template': 'Modèle',
  'workbench.shell.fallback.environment': 'Environnement',

  // ── Shell: tab-label compositions + draft seeds. Singleton tab
  // labels resolve live through the breadcrumb root nouns; only copy
  // with no breadcrumb twin lives here. Draft seeds persist as entity
  // names BY DESIGN (V5 fresh start) — keyed at mint time. ────────────
  'workbench.shell.tabLabel.collectionVariables': '{name} · Variables',
  'workbench.shell.tabLabel.collectionScripts': '{name} · Scripts',
  'workbench.shell.tabLabel.collectionAuth': '{name} · Autorisation',
  'workbench.shell.tabLabel.newRequest': 'Nouvelle requête',
  'workbench.shell.tabLabel.newGrpcRequest': 'Nouvelle requête gRPC',
  'workbench.shell.tabLabel.newWebSocketRequest': 'Nouvelle requête WebSocket',
  'workbench.shell.tabLabel.newSocketIoRequest': 'Nouvelle requête Socket.IO',
  'workbench.shell.tabLabel.newWorkflow': 'Nouveau workflow',
  'workbench.shell.tabLabel.newLiveVariable': 'Nouvelle variable live',

  // ── Shell: App glue — workspace-switch toast, dirty-close confirm,
  // create-flow toasts. `{unit}` interpolates the host-vocabulary
  // instance noun (tab / window). ─────────────────────────────────────
  'workbench.shell.appGlue.switchedTo': 'Ce {unit} est passé à',
  'workbench.shell.appGlue.andMadeActive': " et l'a activé",
  'workbench.shell.appGlue.discardTitle': 'Abandonner les brouillons non enregistrés ?',
  'workbench.shell.appGlue.discardBody':
    "Changer d'espace de travail fermera les onglets d'éditeur comportant des modifications non enregistrées.",
  'workbench.shell.appGlue.discardOk': 'Changer et abandonner',
  'workbench.shell.appGlue.cancel': 'Annuler',
  'workbench.shell.toast.createEnvironmentFailed': "Impossible de créer l'environnement",
  'workbench.shell.toast.noActiveWorkspace': 'Aucun espace de travail actif',
  'workbench.shell.toast.createRuleFailed': 'Impossible de créer la règle',

  // ── Save: collection modal chrome ───────────────────────────────────
  'workbench.save.title': 'ENREGISTRER',
  'workbench.save.newFolder': 'Nouveau dossier',
  'workbench.save.newFolderTooltip': 'Nouveau dossier ({chord})',
  'workbench.save.newCollection': 'Nouvelle collection',
  'workbench.save.newCollectionTooltip': 'Nouvelle collection ({chord})',
  'workbench.save.cancel': 'Annuler',
  'workbench.save.save': 'Enregistrer',
  'workbench.save.selectCollectionFirst': "Sélectionnez d'abord une collection",
  'workbench.save.enterName': 'Saisissez un nom',
  'workbench.save.saveWithChord': 'Enregistrer ({chord})',
  'workbench.save.footer.navigate': '↑↓ naviguer',
  'workbench.save.footer.open': '→ ouvrir',
  'workbench.save.footer.back': '← retour',
  'workbench.save.footer.new': '{chord} nouveau',
  'workbench.save.footer.save': '{chord} enregistrer',
  'workbench.save.footer.close': 'esc fermer',
  'workbench.save.nameLabel': 'Nom',
  'workbench.save.saveTo': 'Enregistrer dans ',
  'workbench.save.rootCrumb': 'Règles locales',
  'workbench.save.searchFolders': 'Rechercher des dossiers',
  'workbench.save.searchCollections': 'Rechercher une collection',
  'workbench.save.nameYourCollection': 'Nommez votre collection',
  'workbench.save.create': 'Créer',
  'workbench.save.noCollections': 'Aucune collection pour le moment.',
  'workbench.save.noMatchingCollections': 'Aucune collection correspondante.',
  'workbench.save.createCollection': 'Créer une collection',
  'workbench.save.orPressPrefix': 'ou appuyez sur',
  'workbench.save.nameYourFolder': 'Nommez votre dossier',
  'workbench.save.folderEmpty': 'Ce dossier est vide.',
  'workbench.save.collectionEmpty': 'Cette collection est vide.',
  'workbench.save.pressPrefix': 'Appuyez sur',
  'workbench.save.pressMiddle': 'pour enregistrer ici, ou',
  'workbench.save.pressSuffix': 'pour un nouveau dossier.',

  // ── Save: as-template step ──────────────────────────────────────────
  'workbench.save.template.title': 'Enregistrer comme modèle utilisateur',
  'workbench.save.template.next': 'Suivant',
  'workbench.save.template.intro': 'Enregistrez la configuration actuelle de {type} comme modèle réutilisable.',
  'workbench.save.template.iconLabel': 'Icône',
  'workbench.save.template.nameLabel': 'Nom *',
  'workbench.save.template.namePlaceholder': 'Nom de mon modèle',
  'workbench.save.template.descriptionLabel': 'Description',
  'workbench.save.template.descriptionPlaceholder': 'Que fait ce modèle ? (facultatif)',
  'workbench.save.template.includeConditions': 'Inclure les conditions',
  'workbench.save.template.includeActions': 'Inclure les actions',
  'workbench.save.template.ruleFallback': 'Règle',

  // ── Save: per-surface rule-type vocabulary ──────────────────────────
  'workbench.save.ruleType.header': 'En-tête',
  'workbench.save.ruleType.block': 'Blocage',
  'workbench.save.ruleType.redirect': 'Redirection',
  'workbench.save.ruleType.queryParam': 'Paramètre de requête',
  'workbench.save.ruleType.inject': 'Injection',
  'workbench.save.ruleType.delay': 'Délai',
  'workbench.save.ruleType.requestBody': 'Corps de requête API',
  'workbench.save.ruleType.response': 'Réponse API',

  // ── Shell: rule-type entity names ('New {name}' draft seeds, command
  //    palette scope column + New-rule rows). Draft names persist as
  //    entity names — keyed at mint time (V5 fresh start, no back-compat). ─
  'workbench.shell.ruleTypeName.header': "Règle d'en-tête",
  'workbench.shell.ruleTypeName.block': 'Règle de blocage',
  'workbench.shell.ruleTypeName.redirect': 'Règle de redirection',
  'workbench.shell.ruleTypeName.queryParam': 'Règle de paramètre de requête',
  'workbench.shell.ruleTypeName.inject': "Règle d'injection",
  'workbench.shell.ruleTypeName.delay': 'Règle de délai',
  'workbench.shell.ruleTypeName.requestBody': 'Règle de corps de requête API',
  'workbench.shell.ruleTypeName.response': 'Règle de réponse API',
  'workbench.shell.ruleTypeName.ws': 'Règle WebSocket',
  'workbench.shell.ruleTypeName.sse': 'Règle SSE',
  'workbench.shell.ruleTypeName.fallback': 'Règle',
  'workbench.shell.ruleTypeName.draftName': 'Nouvelle {name}',

  // ── Tool-window registry (activity bars, dock tab strips, restore
  //    rows, drag previews) ───────────────────────────────────────────
  'workbench.toolWindows.httpRules': 'Règles HTTP',
  'workbench.toolWindows.apiRequests': 'Requêtes API',
  'workbench.toolWindows.workflows': 'Workflows',
  'workbench.toolWindows.notifications': 'Notifications',
  'workbench.toolWindows.docs': 'Docs',
  'workbench.toolWindows.varScope': 'Portée des variables',
  'workbench.toolWindows.variables': 'Variables',
  'workbench.toolWindows.workflowStatus': 'Statut des workflows',
  'workbench.toolWindows.activity': 'Activité',
  'workbench.toolWindows.activityTooltip': "Flux d'activité — modifications entrantes des pairs",
  'workbench.toolWindows.deepNetworkInspection': 'Inspection réseau approfondie',
  'workbench.toolWindows.terminal': 'Terminal',

  // ── Tool-window `(i)` info popovers. `{{live.*}}` / `{{name}}`
  //    reference chips compose raw in JSX between the keyed prefix/
  //    suffix fragments; the Notifications entry stays on the shared
  //    NOTIFICATIONS_PANEL_INFO corpus (panel co-consumer, Phase D). ───
  'workbench.toolWindows.info.httpRules.summary':
    'Créez des règles qui réécrivent les requêtes sortantes et les réponses entrantes. Les règles vivent dans ' +
    'des collections et peuvent injecter des valeurs depuis les variables, le vault et les workflows Live.',
  'workbench.toolWindows.info.httpRules.ruleTypesHeading': 'Types de règles',
  'workbench.toolWindows.info.workflows.summaryPrefix':
    'Un producteur de variables à rafraîchissement planifié : une chaîne de requêtes plus une règle ' +
    "d'extraction. Sa sortie apparaît comme une référence",
  'workbench.toolWindows.info.workflows.summarySuffix': 'utilisable partout où une variable est acceptée.',
  'workbench.toolWindows.info.docs.summary':
    'Documentation intégrée pour les règles, variables, workflows et le workbench lui-même — consultez sans ' +
    "quitter l'application.",
  'workbench.toolWindows.info.varScope.summaryPrefix':
    "Les variables référencées par l'onglet actif et chaque portée contre laquelle elles se résolvent. Une " +
    'référence nue',
  'workbench.toolWindows.info.varScope.summaryMiddle':
    "descend l'ordre de priorité ci-dessous ; les références à espace de noms comme",
  'workbench.toolWindows.info.varScope.summarySuffix': 'ciblent directement une portée.',
  'workbench.toolWindows.info.varScope.priorityHeading': 'Ordre de priorité',
  'workbench.toolWindows.info.varScope.vaultLabel': 'Vault',
  'workbench.toolWindows.info.varScope.vaultDesc':
    'Secrets par utilisateur, jamais synchronisés — priorité la plus haute.',
  'workbench.toolWindows.info.varScope.environmentLabel': 'Environnement',
  'workbench.toolWindows.info.varScope.environmentDesc':
    "L'environnement actif, avec repli sur l'environnement par défaut.",
  'workbench.toolWindows.info.varScope.collectionLabel': 'Collection',
  'workbench.toolWindows.info.varScope.collectionDesc': "La collection de l'entité active.",
  'workbench.toolWindows.info.varScope.workspaceLabel': 'Espace de travail',
  'workbench.toolWindows.info.varScope.workspaceDesc':
    "Partagées dans tout l'espace de travail — priorité la plus basse.",
  'workbench.toolWindows.info.varScope.namespacedHeading': 'À espace de noms',
  'workbench.toolWindows.info.varScope.liveLabel': 'Live',
  'workbench.toolWindows.info.varScope.liveDescPrefix': 'Adossées à un workflow ; accessibles uniquement via',
  'workbench.toolWindows.info.varScope.liveDescSuffix': ', résolues depuis la dernière exécution.',
  'workbench.toolWindows.info.variables.summary':
    'Le catalogue des variables — tout ce qui est défini à travers les environnements, les collections, ' +
    "l'espace de travail et le vault. Utilisez Portée pour voir ce qui est réellement en portée pour l'onglet " +
    'actif.',
  'workbench.toolWindows.info.variables.typesHeading': 'Types de variables',
  'workbench.toolWindows.info.variables.vaultDesc':
    'Secrets par utilisateur — stockés localement, jamais synchronisés.',
  'workbench.toolWindows.info.variables.environmentDesc': "Définies par environnement ; l'actif fournit les valeurs.",
  'workbench.toolWindows.info.variables.collectionDesc':
    "Définies sur une collection ; s'appliquent aux entités qu'elle contient.",
  'workbench.toolWindows.info.variables.workspaceDesc': "Partagées dans tout l'espace de travail.",
  'workbench.toolWindows.info.variables.liveDescPrefix': 'Valeurs produites par des workflows, référencées comme',
  'workbench.toolWindows.info.variables.liveDescSuffix': '.',
  'workbench.toolWindows.info.apiRequests.summary':
    "Les requêtes API enregistrées et les environnements dans lesquels elles s'exécutent, organisés en " +
    'collections et dossiers.',
  'workbench.toolWindows.info.apiRequests.editorHeading': 'Éditeur de requête',
  'workbench.toolWindows.info.apiRequests.docsLabel': 'Docs',
  'workbench.toolWindows.info.apiRequests.docsDesc': 'Notes libres pour la requête — Markdown pris en charge.',
  'workbench.toolWindows.info.apiRequests.paramsLabel': 'Params',
  'workbench.toolWindows.info.apiRequests.paramsDesc': "Paramètres de requête ajoutés à l'URL de la requête.",
  'workbench.toolWindows.info.apiRequests.authorizationLabel': 'Autorisation',
  'workbench.toolWindows.info.apiRequests.authorizationDesc':
    "Hériter du parent, Basic, Bearer Token, API Key ou OAuth 2.0 — appliquée à l'envoi.",
  'workbench.toolWindows.info.apiRequests.headersLabel': 'En-têtes',
  'workbench.toolWindows.info.apiRequests.headersDesc':
    "En-têtes de requête, avec les références de variables résolues à l'envoi.",
  'workbench.toolWindows.info.apiRequests.bodyLabel': 'Corps',
  'workbench.toolWindows.info.apiRequests.bodyDesc':
    'Form data, URL-encoded, raw (Text, JavaScript, JSON, HTML, XML) ou GraphQL.',
  'workbench.toolWindows.info.apiRequests.scriptsLabel': 'Scripts',
  'workbench.toolWindows.info.apiRequests.scriptsDesc': 'Hooks JavaScript pré-requête et post-réponse.',
  'workbench.toolWindows.info.apiRequests.settingsLabel': 'Paramètres',
  'workbench.toolWindows.info.apiRequests.settingsDesc':
    'Comportement par requête — vérification SSL, redirections et plus.',
  'workbench.toolWindows.info.deepNetworkInspection.summary':
    'Inspection au niveau connexion (L4) et HTTP (L7) dans une seule vue — santé TCP/TLS (RTT, ' +
    "retransmissions, durée du handshake) aux côtés d'une visibilité, d'une modification et d'un rejeu " +
    'complets des requêtes/réponses.',
  'workbench.toolWindows.info.workflowStatus.summary':
    'Tableau de bord du disjoncteur par workflow — état, échecs consécutifs, ouvertures et compte à rebours ' +
    'de la prochaine tentative, avec les actions manuelles Réessayer et Réinitialiser le circuit.',
  'workbench.toolWindows.info.activity.summary':
    "Flux des modifications entrantes des pairs à l'échelle de l'espace de travail, avec mises en évidence " +
    'du classifieur pour les rotations de champs sensibles, les élargissements de portée de permission et ' +
    'les supplantations de modifications locales.',
  'workbench.terminal.sessionEnded': 'Session terminée',
  'workbench.terminal.restart': 'Relancer le shell',
  'workbench.terminal.tabLocal': 'Local',
  'workbench.terminal.tabLocalN': 'Local ({n})',
  'workbench.terminal.newTab': 'Nouvel onglet de terminal',
  'workbench.terminal.closeTab': 'Fermer l’onglet',
  'workbench.terminal.openTui': 'Ouvrir le mode TUI',
  'workbench.terminal.closeConfirm.title': 'Processus en cours d’exécution',
  'workbench.terminal.closeConfirm.bodyPrefix': 'Un processus s’exécute encore dans ',
  'workbench.terminal.closeConfirm.bodySuffix': '. L’interrompre ?',
  'workbench.terminal.closeConfirm.ok': 'Interrompre',
  'workbench.toolWindows.info.terminal.summary':
    'Un terminal intégré qui exécute votre shell dans un vrai pty — tout ce qui tourne dans un terminal ' +
    "autonome tourne ici, y compris la CLI oh contre l'application locale.",

  // ── Deep Network Inspection placeholder panel. The sample connection
  // feed (TCP/TLS lines, HPACK fields, stat figures) and the tier
  // roadmap's quoted scenario copy ride raw as illustration data —
  // only the panel chrome keys here. ──────────────────────────────────
  'workbench.deepNetwork.comingSoon': 'BIENTÔT DISPONIBLE — APPLICATION DE BUREAU',
  'workbench.deepNetwork.heading': 'Inspection connexion (L4) + HTTP (L7)',
  'workbench.deepNetwork.description':
    'Santé de la connexion et HTTP complet dans une seule vue — les couches sur lesquelles vous agissez ' +
    "vraiment, faciles à inspecter et à modifier. Pas encore actif ; données d'exemple ci-dessous.",
  'workbench.deepNetwork.viewTiers': 'Feuille de route des paliers',
  'workbench.deepNetwork.viewConnection': 'Vue connexion',
  'workbench.deepNetwork.stats': 'Statistiques',
  'workbench.deepNetwork.rowSolves': 'Résout',
  'workbench.deepNetwork.rowTrust': 'Confiance requise',
  'workbench.deepNetwork.rowPower': 'Puissance',
  'workbench.deepNetwork.rowFriction': 'Friction',
  'workbench.deepNetwork.wall': 'Vous butez sur un mur :',

  // ── Shared markdown widgets (toolbar + highlighted code block) ──────
  'workbench.markdown.heading': 'Titre',
  'workbench.markdown.bold': 'Gras',
  'workbench.markdown.italic': 'Italique',
  'workbench.markdown.strikethrough': 'Barré',
  'workbench.markdown.codeBlock': 'Bloc de code',
  'workbench.markdown.link': 'Lien',
  'workbench.markdown.bulletedList': 'Liste à puces',
  'workbench.markdown.numberedList': 'Liste numérotée',
  'workbench.markdown.table': 'Tableau',
  'workbench.markdown.copyCode': 'Copier le code',
  'workbench.markdown.copied': 'Copié',

  // ── Two-tone icon picker ────────────────────────────────────────────
  'workbench.iconPicker.searchPlaceholder': 'Rechercher des icônes...',

  // ── Template editor ─────────────────────────────────────────────────
  'workbench.templateEditor.toast.saved': 'Modèle enregistré',
  'workbench.templateEditor.toast.saveFailed': "Impossible d'enregistrer le modèle",
  'workbench.templateEditor.notFound': 'Modèle introuvable',
  'workbench.templateEditor.namePlaceholder': 'Nom du modèle',
  'workbench.templateEditor.descriptionPlaceholder': 'Description (facultatif)',
  'workbench.templateEditor.includeConditions': 'Inclure les conditions',
  'workbench.templateEditor.includeActions': 'Inclure les actions',
  'workbench.templateEditor.conditionsTitle': 'Conditions',

  // ── What's New tab ──────────────────────────────────────────────────
  'workbench.whatsNew.title': "Nouveautés d'Open Headers {version}",
  'workbench.whatsNew.noNotes': 'Ce build est livré sans notes de version.',

  // ── Keyboard shortcuts: SHORTCUTS registry action names + the docs
  // cheatsheet chrome around them. Chords, key caps (?, ⌘, Ctrl) and
  // the regions diagram internals stay raw. ──────────────────────────
  'workbench.shortcuts.action.toggleLeftSidebar': 'Basculer la barre latérale gauche',
  'workbench.shortcuts.action.toggleRightSidebar': 'Basculer la barre latérale droite',
  'workbench.shortcuts.action.toggleBottomPanel': 'Basculer le panneau inférieur',
  'workbench.shortcuts.action.toggleActivityFeed': "Basculer le flux d'activité",
  'workbench.shortcuts.action.terminalNewTab': 'Nouvel onglet de terminal',
  'workbench.shortcuts.action.closeTab': "Fermer l'onglet",
  'workbench.shortcuts.action.newTab': 'Nouvel onglet',
  'workbench.shortcuts.action.prevTab': 'Onglet précédent',
  'workbench.shortcuts.action.nextTab': 'Onglet suivant',
  'workbench.shortcuts.action.tabSearch': 'Rechercher dans les onglets',
  'workbench.shortcuts.action.commandPalette': 'Palette de commandes',
  'workbench.shortcuts.action.focusFilter': 'Focus sur le filtre de la section active',
  'workbench.shortcuts.action.focusLeftSidebar': 'Focus sur la barre latérale gauche',
  'workbench.shortcuts.action.focusEditor': "Focus sur l'éditeur",
  'workbench.shortcuts.action.focusRightSidebar': 'Focus sur la barre latérale droite',
  'workbench.shortcuts.action.focusBottomPanel': 'Focus sur le panneau inférieur',
  'workbench.shortcuts.action.save': 'Enregistrer',
  'workbench.shortcuts.action.newRule': 'Créer un élément',
  'workbench.shortcuts.action.import': 'Importer',
  'workbench.shortcuts.action.showShortcuts': 'Raccourcis clavier',
  'workbench.shortcuts.action.openSettings': 'Ouvrir les paramètres',
  'workbench.shortcuts.action.find': "Rechercher dans l'éditeur",
  'workbench.shortcuts.action.replace': "Remplacer dans l'éditeur",
  'workbench.shortcuts.action.formatCode': 'Formater le code',
  'workbench.shortcuts.category.panels': 'Panneaux',
  'workbench.shortcuts.category.tabs': 'Onglets',
  'workbench.shortcuts.category.navigation': 'Navigation',
  'workbench.shortcuts.category.actions': 'Actions',
  'workbench.shortcuts.allSurfacesTitle': 'Toutes les surfaces',
  'workbench.shortcuts.toggleDebugMode': 'Basculer le mode débogage',
  'workbench.shortcuts.goToTab': "Aller à l'onglet 1–9 (9 = dernier)",
  'workbench.shortcuts.introPrefix': 'Appuyez sur',
  'workbench.shortcuts.introMiddle': 'à tout moment pour venir ici. Les raccourcis utilisent',
  'workbench.shortcuts.introSuffix': 'comme touche de modification.',
  'workbench.shortcuts.regionsCaption': 'Quatre combinaisons placent votre focus dans une des quatre régions du shell.',

  // ── Docs navigator plane: group labels + section titles/summaries
  // from the workbench DOC_GROUPS registry (raw-or-key DocSection
  // idiom). Section body corpus + diagrams are their own station. ────
  'workbench.docs.nav.group.openHeaders': 'Open Headers',
  'workbench.docs.nav.group.concepts': 'Concepts',
  'workbench.docs.nav.group.modifyRequests': 'Modifier les requêtes',
  'workbench.docs.nav.group.modifyResponses': 'Modifier les réponses',
  'workbench.docs.nav.group.runCode': 'Exécuter du code',
  'workbench.docs.nav.group.reference': 'Référence',
  'workbench.docs.nav.paradigm.title': 'Ce que nous faisons (différemment)',
  'workbench.docs.nav.paradigm.summary':
    'Une extension de navigateur qui fait ce qui exigeait autrefois un proxy, un binaire de bureau ou un ' +
    'compte cloud.',
  'workbench.docs.nav.comparison.title': 'Comment nous nous comparons',
  'workbench.docs.nav.comparison.summary':
    'Où se situe Open Headers face aux plateformes cloud, aux proxys de bureau et aux extensions limitées ' +
    'aux en-têtes.',
  'workbench.docs.nav.roadmap.title': 'Ce que nous construisons ensuite',
  'workbench.docs.nav.roadmap.summary':
    'Les jalons en séquence — espaces de travail Git, application de bureau, daemon, CLI, application web, ' +
    "plus d'importateurs.",
  'workbench.docs.nav.conditions.title': 'Conditions',
  'workbench.docs.nav.conditions.summary':
    "Filtres à correspondance AND qui conditionnent chaque règle — domaines, motifs d'URL, méthodes, en-têtes.",
  'workbench.docs.nav.actions.title': 'Actions',
  'workbench.docs.nav.actions.summary':
    "La moitié « agir » d'une règle — modifier la requête, modifier la réponse ou exécuter du code. Se " +
    'combine aux conditions.',
  'workbench.docs.nav.variables.title': 'Variables',
  'workbench.docs.nav.variables.summary':
    'Cinq portées de variables — vault, environnement, collection, espace de travail, live — et comment les ' +
    'références se résolvent.',
  'workbench.docs.nav.requestTracking.title': 'Suivi des requêtes',
  'workbench.docs.nav.requestTracking.summary':
    'Comment les requêtes correspondantes sont observées, enregistrées et affichées comme pastilles dans le ' +
    'popup.',
  'workbench.docs.nav.execution.title': "Comment les règles s'exécutent",
  'workbench.docs.nav.execution.summary':
    "Les deux moteurs (DNR et à base de scripts) qui décident où chaque règle s'applique.",
  'workbench.docs.nav.multiTab.title': 'Comportement multi-onglets',
  'workbench.docs.nav.multiTab.summary':
    "Ce qui se synchronise entre les onglets d'espace de travail (les données) et ce qui reste par onglet " +
    '(disposition, brouillons).',
  'workbench.docs.nav.systemStatus.title': 'État du système',
  'workbench.docs.nav.systemStatus.summary':
    'La pastille feu tricolore — ce que rapporte chaque sous-système et ce que signifient rouge / jaune / vert.',
  'workbench.docs.nav.debugMode.title': 'Mode débogage',
  'workbench.docs.nav.debugMode.summary':
    "S'attacher au protocole de débogage du navigateur — une portée plus profonde pour les requêtes, " +
    "l'injection et l'environnement d'onglet.",
  'workbench.docs.nav.headerActions.title': "Actions d'en-tête",
  'workbench.docs.nav.headerActions.summary':
    'Ajouter, remplacer, ajouter à la suite, retirer ou fusionner les en-têtes de requête et de réponse.',
  'workbench.docs.nav.block.title': 'Blocage',
  'workbench.docs.nav.block.summary': 'Annuler les requêtes correspondantes au niveau de la couche réseau.',
  'workbench.docs.nav.redirect.title': 'Redirection',
  'workbench.docs.nav.redirect.summary':
    'Envoyer les requêtes correspondantes vers une autre URL — statique ou substituée par regex.',
  'workbench.docs.nav.queryParam.title': 'Paramètres de requête',
  'workbench.docs.nav.queryParam.summary':
    "Ajouter, remplacer ou retirer des paramètres de requête d'URL avant que la requête parte.",
  'workbench.docs.nav.requestBody.title': 'Corps de requête',
  'workbench.docs.nav.requestBody.summary':
    'Substituer ou transformer les corps fetch / XHR sortants — statiques, dynamiques ou filtrés par GraphQL.',
  'workbench.docs.nav.response.title': 'Modifier la réponse',
  'workbench.docs.nav.response.summary':
    'Mock ou modification des réponses API — corps, statut et en-têtes synthétiques ou transformés.',
  'workbench.docs.nav.inject.title': 'Injecter JS / CSS',
  'workbench.docs.nav.inject.summary':
    'Exécuter du JavaScript ou du CSS dans le contexte de la page — avant les scripts de la page ou une fois ' +
    'le DOM prêt.',
  'workbench.docs.nav.delay.title': 'Délai',
  'workbench.docs.nav.delay.summary':
    'Ajouter une latence artificielle aux navigations et aux fetch / XHR initiés par JS.',
  'workbench.docs.nav.resourceTypes.title': 'Types de ressources',
  'workbench.docs.nav.resourceTypes.summary':
    'Table de correspondance des valeurs ResourceType de Chrome — Page, Frame, Fetch/XHR, Script et les autres.',
  'workbench.docs.nav.keyboardShortcuts.title': 'Raccourcis clavier',
  'workbench.docs.nav.keyboardShortcuts.summary':
    'Chaque raccourci du workbench, groupé par surface — panneaux, onglets, navigation, actions.',
  'workbench.docs.nav.limitations.title': 'Limitations',
  'workbench.docs.nav.limitations.summary':
    'Les surprises connues en un seul endroit — visibilité DevTools, portée des scripts, correspondance ' +
    "d'en-têtes, Fusionner.",
} as const satisfies Catalog;
