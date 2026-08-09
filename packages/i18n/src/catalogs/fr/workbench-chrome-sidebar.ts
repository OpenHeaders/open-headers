/**
 * Workbench chrome — the navigator plane — French. Mirrors
 * `catalogs/en/workbench-chrome-sidebar.ts` key for key. Reuses the
 * sidebar mints recorded in `fr/workbench-docs-variables.ts`
 * (`Variables d'espace de travail`, `Variables Live`,
 * `Environnements`, `Variables`, `Vault` raw) and the
 * script-packages title (`Bibliothèque de packages`). `workflow` and
 * `package` stay as dev loanwords (m.); pause vocabulary follows
 * popup (`Suspendre`/`Reprendre`/`Suspendue`); badges are invariant
 * lowercase markers in the workbench-variables register (`brouillon`,
 * `inactif`); Override = `substitution`. Entity names, collection
 * names, and counts ride raw inside keyed values.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchChromeSidebar = {
  // ── Sidebar: section headers (caps in the value) ────────────────────
  'workbench.sidebar.section.rules': 'RÈGLES',
  'workbench.sidebar.section.templates': 'MODÈLES',
  'workbench.sidebar.section.requests': 'REQUÊTES',
  'workbench.sidebar.section.workflows': 'WORKFLOWS',
  'workbench.sidebar.section.environments': 'ENVIRONNEMENTS',
  'workbench.sidebar.section.vault': 'VAULT',
  'workbench.sidebar.section.workspaceVariables': "VARIABLES D'ESPACE DE TRAVAIL",
  'workbench.sidebar.section.liveVariables': 'VARIABLES LIVE',
  'workbench.sidebar.section.packageLibrary': 'BIBLIOTHÈQUE DE PACKAGES',
  'workbench.sidebar.section.specs': 'SPÉCIFICATIONS',

  // ── Sidebar: per-view header title ──────────────────────────────────
  'workbench.sidebar.view.httpRules': 'Intercepteur',
  'workbench.sidebar.view.apiRequests': 'Requêtes API',
  'workbench.sidebar.view.workflows': 'Workflows',
  'workbench.sidebar.view.variables': 'Variables',

  // ── Sidebar: header action cluster ──────────────────────────────────
  'workbench.sidebar.header.newRule': 'Nouvelle règle',
  'workbench.sidebar.header.addRequest': 'Ajouter une requête',
  'workbench.sidebar.header.createNewEnvironment': 'Créer un nouvel environnement',
  'workbench.sidebar.header.createNewSpec': 'Créer une nouvelle spécification',
  'workbench.sidebar.header.newWorkflow': 'Nouveau workflow',
  'workbench.sidebar.header.newTemplateCollection': 'Nouvelle collection de modèles',
  'workbench.sidebar.header.exportSelected': 'Exporter la sélection ({count})…',
  'workbench.sidebar.header.exportSelectedAria': 'Exporter les {count} éléments sélectionnés',
  'workbench.sidebar.header.clearSelection': 'Effacer la sélection',
  'workbench.sidebar.header.clearSelectionAria': "Effacer la sélection d'export",
  'workbench.sidebar.header.selectOpenedTab': "Sélectionner l'onglet ouvert",
  'workbench.sidebar.header.selectOpenedTabAria': "Sélectionner l'onglet ouvert",
  'workbench.sidebar.header.expandAll': 'Tout développer',
  'workbench.sidebar.header.expandAllAria': 'Tout développer',
  'workbench.sidebar.header.collapseAll': 'Tout réduire',
  'workbench.sidebar.header.collapseAllAria': 'Tout réduire',
  'workbench.sidebar.behavior.title': 'Comportement',
  'workbench.sidebar.behavior.openEntriesSingleClick': "Ouvrir les entrées d'un simple clic",
  'workbench.sidebar.behavior.openCollectionsSingleClick': "Ouvrir les collections d'un simple clic",
  'workbench.sidebar.behavior.openFoldersSingleClick': "Ouvrir les dossiers d'un simple clic",
  'workbench.sidebar.behavior.alwaysSelectOpened': "Toujours sélectionner l'onglet ouvert",
  'workbench.sidebar.filterPlaceholder': 'Filtrer',

  // ── Sidebar : barre de recherche rapide (à la demande, double mode) ──
  'workbench.sidebar.menu.search': 'Rechercher',
  'workbench.sidebar.search.searchPlaceholder': 'Rechercher',
  'workbench.sidebar.search.modeSearch': 'Recherche : surligner les lignes correspondantes',
  'workbench.sidebar.search.modeFilter': 'Filtre : masquer les lignes sans correspondance',
  'workbench.sidebar.search.noMatches': 'Aucune correspondance',
  'workbench.sidebar.search.close': 'Fermer la recherche',

  // ── Sidebar: container + row menus ──────────────────────────────────
  'workbench.sidebar.menu.newCollection': 'Nouvelle collection',
  'workbench.sidebar.menu.newRequest': 'Nouvelle requête',
  'workbench.sidebar.menu.import': 'Importer…',
  'workbench.sidebar.menu.addRule': 'Ajouter une règle',
  'workbench.sidebar.menu.addRequest': 'Ajouter une requête',
  'workbench.sidebar.menu.addGrpcRequest': 'Ajouter une requête gRPC',
  'workbench.sidebar.menu.addWebSocketRequest': 'Ajouter une requête WebSocket',
  'workbench.sidebar.menu.addSocketIoRequest': 'Ajouter une requête Socket.IO',
  'workbench.sidebar.menu.addFolder': 'Ajouter un dossier',
  'workbench.sidebar.menu.rename': 'Renommer',
  'workbench.sidebar.menu.editVariables': 'Modifier les variables',
  'workbench.sidebar.menu.createWorkflow': 'Créer un workflow…',
  'workbench.sidebar.menu.export': 'Exporter…',
  'workbench.sidebar.menu.delete': 'Supprimer',
  'workbench.sidebar.menu.duplicate': 'Dupliquer',
  'workbench.sidebar.menu.copyAs': 'Copier en',
  'workbench.sidebar.menu.copyAsCurl': 'cURL',
  'workbench.sidebar.menu.copyAsFetch': 'fetch',
  'workbench.sidebar.menu.pauseCollection': 'Suspendre la collection',
  'workbench.sidebar.menu.unpauseCollection': 'Reprendre la collection',
  'workbench.sidebar.menu.pauseFolder': 'Suspendre le dossier',
  'workbench.sidebar.menu.unpauseFolder': 'Reprendre le dossier',
  'workbench.sidebar.menu.resetCollectionPauseOverride': 'Réinitialiser la substitution de suspension de la collection',
  'workbench.sidebar.menu.resetFolderPauseOverride': 'Réinitialiser la substitution de suspension du dossier',
  'workbench.sidebar.menu.clearNestedPauseOverrides': 'Effacer les substitutions de suspension imbriquées',

  // ── Sidebar: row badges + hover actions ─────────────────────────────
  'workbench.sidebar.badge.paused': 'suspendue',
  'workbench.sidebar.badge.draft': 'brouillon',
  'workbench.sidebar.badge.unresolved': 'non résolu',
  'workbench.sidebar.badge.off': 'inactif',
  'workbench.sidebar.badge.incomplete': 'incomplet',
  'workbench.sidebar.badge.scratch': 'provisoire',
  'workbench.sidebar.badge.scripts': 'scripts',
  'workbench.sidebar.badge.specDrift': 'modifiée',
  'workbench.sidebar.badge.scriptsTooltip':
    'Cette requête importée exécutera du JavaScript lors de son exécution. Ouvrez-la pour examiner les scripts.',
  'workbench.sidebar.badge.dirtyAria': 'modifications non enregistrées',
  'workbench.sidebar.rule.enable': 'Activer la règle',
  'workbench.sidebar.rule.disable': 'Désactiver la règle',
  'workbench.sidebar.env.setActive': 'Définir comme actif',
  'workbench.sidebar.env.setInactive': 'Définir comme inactif',
  'workbench.sidebar.env.setDefault': 'Définir par défaut',
  'workbench.sidebar.env.unsetDefault': 'Ne plus définir par défaut',
  'workbench.sidebar.workflow.bindingsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} var',
      many: '{count} vars',
      other: '{count} vars',
    }),
  'workbench.sidebar.workflow.bindingsTooltip': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} variable live liée à ce workflow',
      many: '{count} variables live liées à ce workflow',
      other: '{count} variables live liées à ce workflow',
    }),

  // ── Sidebar: empty placeholders ─────────────────────────────────────
  'workbench.sidebar.placeholder.folderEmptyTitle': 'Le dossier est vide',
  'workbench.sidebar.placeholder.collectionEmptyTitle': 'La collection est vide',
  'workbench.sidebar.placeholder.requestsEmptyTitle': 'Aucune requête pour le moment',
  'workbench.sidebar.placeholder.templatesEmptyTitle': 'Aucun modèle pour le moment',
  'workbench.sidebar.placeholder.addRuleOrFolder': 'Ajoutez une règle ou un dossier pour commencer.',
  'workbench.sidebar.placeholder.addRequestOrFolder': 'Ajoutez une requête ou un dossier pour commencer.',
  'workbench.sidebar.placeholder.templateFolderEmptyMessage': 'Enregistrez une règle comme modèle pour le remplir.',
  'workbench.sidebar.placeholder.templatesEmptyMessage': "Enregistrez une règle comme modèle depuis l'éditeur.",
  'workbench.sidebar.placeholder.addRule': 'Ajouter une règle',
  'workbench.sidebar.placeholder.addFolder': 'Ajouter un dossier',
  'workbench.sidebar.placeholder.addRequest': 'Ajouter une requête',
  'workbench.sidebar.emptySection': 'Aucun élément dans cette section',
  'workbench.sidebar.emptySectionCreate': 'Créer',

  // ── Sidebar: templates view ─────────────────────────────────────────
  'workbench.sidebar.templates.systemGroup': 'Modèles système',
  'workbench.sidebar.ruleType.header': 'En-tête',
  'workbench.sidebar.ruleType.block': 'Blocage',
  'workbench.sidebar.ruleType.redirect': 'Redirection',
  'workbench.sidebar.ruleType.queryParam': 'Paramètre de requête',
  'workbench.sidebar.ruleType.inject': 'Injection',
  'workbench.sidebar.ruleType.delay': 'Délai',
  'workbench.sidebar.ruleType.requestBody': 'Corps de requête API',
  'workbench.sidebar.ruleType.response': 'Réponse API',

  // ── Sidebar: variables-view singleton rows ──────────────────────────
  'workbench.sidebar.singleton.vault': 'Vault',
  'workbench.sidebar.singleton.workspaceVariables': "Variables d'espace de travail",
  'workbench.sidebar.singleton.liveVariables': 'Variables Live',
  'workbench.sidebar.singleton.packageLibrary': 'Bibliothèque de packages',

  // ── Sidebar: default entity names ───────────────────────────────────
  'workbench.sidebar.defaults.newFolder': 'Nouveau dossier',

  // ── Sidebar: confirm-delete modal + toasts ──────────────────────────
  'workbench.sidebar.confirmDelete.title': "Supprimer l'élément ?",
  'workbench.sidebar.confirmDelete.bodyPrefix': 'Voulez-vous vraiment supprimer ',
  'workbench.sidebar.confirmDelete.bodySuffix': ' ? Cette action est irréversible.',
  'workbench.sidebar.confirmDelete.ok': 'Supprimer',
  'workbench.sidebar.toast.toggleRuleFailed': 'Impossible de basculer la règle',
  'workbench.sidebar.toast.renameExampleFailed': "Impossible de renommer l'exemple",
  'workbench.sidebar.toast.duplicateExampleFailed': "Impossible de dupliquer l'exemple",
  'workbench.sidebar.toast.deleteExampleFailed': "Impossible de supprimer l'exemple",
  'workbench.sidebar.toast.createRequestCollectionFailed': 'Impossible de créer la collection de requêtes',
  'workbench.sidebar.toast.createEnvironmentFailed': "Impossible de créer l'environnement",
  'workbench.sidebar.toast.createSpecFailed': 'Impossible de créer la spécification',
  'workbench.sidebar.toast.renameSpecFailed': 'Impossible de renommer la spécification',
  'workbench.sidebar.toast.deleteSpecFailed': 'Impossible de supprimer la spécification',

  // ── Sidebar: folder drag-and-drop ───────────────────────────────────
  'workbench.sidebar.dnd.dragToReorderFolder': 'Glisser pour réordonner le dossier',

  // ── Activity feed panel + cards ─────────────────────────────────────
  'workbench.activityFeed.reverted': 'Modification annulée',
  'workbench.activityFeed.revertFailed': "Échec de l'annulation : {reason}",
  'workbench.activityFeed.emptyTitle': 'Aucune activité pour le moment',
  'workbench.activityFeed.emptyHint': 'Les modifications entrantes des pairs apparaîtront ici.',
  'workbench.activityFeed.view': 'Voir',
  'workbench.activityFeed.mute': 'Ignorer',
  'workbench.activityFeed.unmute': 'Ne plus ignorer',
  'workbench.activityFeed.muteTip':
    "Supprime les prochaines lignes d'activité entrante pour cette entité. Les lignes passées sont conservées.",
  'workbench.activityFeed.unmuteTip': "Cesse de supprimer l'activité entrante pour cette entité.",
  'workbench.activityFeed.revert': 'Annuler',
  'workbench.activityFeed.revertTip':
    "Applique l'inverse de cette modification. Émet une nouvelle mutation qui ramène l'entité à son état " +
    "d'avant la réception.",
  'workbench.activityFeed.revertUnavailableDelete':
    'Les suppressions sont définitives et ne peuvent pas être annulées (§7.2 delete-wins).',
  'workbench.activityFeed.revertUnavailable': 'Cette modification ne peut pas être annulée.',
  'workbench.activityFeed.kind.created': 'Créée',
  'workbench.activityFeed.kind.createdTip': "Une nouvelle entité est arrivée d'un pair.",
  'workbench.activityFeed.kind.edited': 'Modifiée',
  'workbench.activityFeed.kind.editedTip': 'Un pair a modifié des champs de cette entité.',
  'workbench.activityFeed.kind.deleted': 'Supprimée',
  'workbench.activityFeed.kind.deletedTip': 'Un pair a supprimé cette entité.',
  'workbench.activityFeed.kind.superseded': 'Modification locale supplantée',
  'workbench.activityFeed.kind.supersededTip': 'Une mutation entrante a supplanté votre modification locale en cours.',
  'workbench.activityFeed.kind.sensitiveRotation': "Rotation d'un champ sensible",
  'workbench.activityFeed.kind.sensitiveRotationTip':
    'Un champ sensible (secret / jeton / en-tête sensible) a été remplacé.',
  'workbench.activityFeed.kind.scopeWidened': 'Portée élargie',
  'workbench.activityFeed.kind.scopeWidenedTip':
    'Une condition de la règle a été assouplie — la règle correspond désormais à un ensemble URL/méthode plus large.',
  'workbench.activityFeed.kind.agentObserved': 'Lecture par agent',
  'workbench.activityFeed.kind.agentObservedTip':
    "Un agent a lu du trafic en direct via le palier MCP observe — des projections caviardées d'une source armée.",
  'workbench.activityFeed.rawRead': 'Non caviardé',
  'workbench.activityFeed.rawReadTip':
    'Cette lecture a projeté les valeurs brutes — l’autorisation de lecture non caviardée des sessions était activée dans Paramètres → Trafic.',

  // ── Overview tabs (collection / folder, all three families). The
  // folder-suffix chunks carry their leading '· ' — the JSX supplies
  // only the separating space. ────────────────────────────────────────
  'workbench.overview.stats.rules': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} règle',
      many: '{count} règles',
      other: '{count} règles',
    }),
  'workbench.overview.stats.requests': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} requête',
      many: '{count} requêtes',
      other: '{count} requêtes',
    }),
  'workbench.overview.stats.templates': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} modèle',
      many: '{count} modèles',
      other: '{count} modèles',
    }),
  'workbench.overview.stats.foldersSuffix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '· {count} dossier',
      many: '· {count} dossiers',
      other: '· {count} dossiers',
    }),
  'workbench.overview.stats.subfoldersSuffix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '· {count} sous-dossier',
      many: '· {count} sous-dossiers',
      other: '· {count} sous-dossiers',
    }),
  'workbench.overview.stats.activeTag': '{count} actives',
  'workbench.overview.stats.disabledTag': '{count} désactivées',
  'workbench.overview.stats.draftTag': '{count} en brouillon',
  'workbench.overview.stats.pausedTag': 'Suspendue',
  'workbench.overview.cell.folderRules': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Dossier · {count} règle',
      many: 'Dossier · {count} règles',
      other: 'Dossier · {count} règles',
    }),
  'workbench.overview.cell.folderRequests': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Dossier · {count} requête',
      many: 'Dossier · {count} requêtes',
      other: 'Dossier · {count} requêtes',
    }),
  'workbench.overview.cell.folderTemplates': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Dossier · {count} modèle',
      many: 'Dossier · {count} modèles',
      other: 'Dossier · {count} modèles',
    }),
  'workbench.overview.status.draft': 'Brouillon',
  'workbench.overview.status.incomplete': 'Incomplète',
  'workbench.overview.status.disabled': 'Désactivée',
  'workbench.overview.status.paused': 'Suspendue',
  'workbench.overview.status.active': 'Active',
  'workbench.overview.action.addRule': 'Ajouter une règle',
  'workbench.overview.action.addRequest': 'Ajouter une requête',
  'workbench.overview.action.pause': 'Suspendre',
  'workbench.overview.action.resume': 'Reprendre',
  'workbench.overview.action.pauseCollectionTooltip': 'Suspendre toutes les règles de cette collection',
  'workbench.overview.action.resumeCollectionTooltip': 'Reprendre toutes les règles de cette collection',
  'workbench.overview.action.pauseFolderTooltip': 'Suspendre toutes les règles de ce dossier',
  'workbench.overview.action.resumeFolderTooltip': 'Reprendre toutes les règles de ce dossier',
  'workbench.overview.action.variables': 'Variables',
  'workbench.overview.action.variablesTooltip': 'Modifier les variables limitées à cette collection',
  'workbench.overview.action.variablesTooltipRequest': 'Modifier les variables limitées à cette collection de requêtes',
  'workbench.overview.action.variablesTooltipTemplate': 'Modifier les variables limitées à cette collection de modèles',
  'workbench.overview.action.scripts': 'Scripts',
  'workbench.overview.action.scriptsTooltipCollection':
    'Modifier les scripts exécutés pour chaque requête de cette collection',
  'workbench.overview.action.scriptsTooltipFolder': 'Modifier les scripts exécutés pour chaque requête de ce dossier',
  'workbench.overview.action.auth': 'Autorisation',
  'workbench.overview.action.authTooltipCollection':
    "Définir l'autorisation par défaut héritée par chaque requête de cette collection",
  'workbench.overview.action.authTooltipFolder':
    "Définir l'autorisation par défaut héritée par chaque requête de ce dossier",
  'workbench.overview.caption.description': 'Description',
  'workbench.overview.caption.contents': 'Contenu',
  'workbench.overview.empty.collectionNotFound': 'Collection introuvable',
  'workbench.overview.empty.folderNotFound': 'Dossier introuvable',
  'workbench.overview.empty.requestCollectionNotFound': 'Collection de requêtes introuvable',
  'workbench.overview.empty.templateCollectionNotFound': 'Collection de modèles introuvable',
  'workbench.overview.empty.noItems': 'Aucun élément pour le moment',
  'workbench.overview.empty.noRequests': 'Aucune requête pour le moment',
  'workbench.overview.empty.templatesCollection':
    'Aucun modèle dans cette collection. Enregistrez une règle comme modèle pour remplir cette collection.',
  'workbench.overview.empty.templatesFolder':
    'Aucun modèle pour le moment — enregistrez une règle comme modèle depuis ' +
    "l'éditeur de règle pour remplir ce dossier.",

  // ── Collection picker panel (import flows) ──────────────────────────
  'workbench.collectionPicker.searchPlaceholder': 'Rechercher une collection',
  'workbench.collectionPicker.empty':
    "Aucune collection pour le moment — une collection est créée pour vous à l'import.",
  'workbench.collectionPicker.noMatch': 'Aucune collection correspondante.',
  'workbench.collectionPicker.newCollection': 'Nouvelle collection',
} as const satisfies Catalog;
