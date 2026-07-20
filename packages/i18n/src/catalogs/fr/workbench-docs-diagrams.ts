/**
 * Workbench Docs panel — SVG diagram labels — French. Mirrors
 * `catalogs/en/workbench-docs-diagrams.ts` key for key. Vocabulary is
 * quoted from the shipped fr catalogs: portée = scope, référence nue =
 * bare reference, occulté = shadowed, l'échelle = the ladder, le
 * parcours = the walk (all from `fr/workbench-docs-variables.ts`);
 * sidebar entry names copy `fr/workbench-chrome-sidebar.ts` verbatim
 * (Vault, Variables d'espace de travail, Variables Live); Exposer =
 * expose and Envoyer = Send reuse the shipped editor mints. Monospace
 * wire fragments and `{{ns.*}}` tokens are whole-raw values copied
 * verbatim. Sample identifiers (staging, production, api_host) ride
 * raw.
 */

import type { Catalog } from '../../types';

export const workbenchDocsDiagrams = {
  // ── Variables : l'échelle de résolution ─────────────────────────────
  'workbench.docs.diagrams.variables.ladder.aria':
    "Une référence nue se résout à travers le vault, l'environnement, la collection, puis l'espace de travail — " +
    'la première correspondance gagne. Live, step, file et dynamic ne sont accessibles que par leur préfixe ' +
    "d'espace de noms.",
  'workbench.docs.diagrams.variables.ladder.title': 'Référence nue — la première portée qui la définit gagne',
  'workbench.docs.diagrams.variables.ladder.vault': 'Vault',
  'workbench.docs.diagrams.variables.ladder.vaultSub': 'secrets · cet appareil uniquement',
  'workbench.docs.diagrams.variables.ladder.environment': 'Environnement',
  'workbench.docs.diagrams.variables.ladder.environmentSub': "l'actif, puis celui par défaut",
  'workbench.docs.diagrams.variables.ladder.collection': 'Collection',
  'workbench.docs.diagrams.variables.ladder.collectionSub': 'collection active uniquement',
  'workbench.docs.diagrams.variables.ladder.workspace': 'Espace de travail',
  'workbench.docs.diagrams.variables.ladder.workspaceSub': 'partagé avec tout le monde',
  'workbench.docs.diagrams.variables.ladder.miss': 'absent',
  'workbench.docs.diagrams.variables.ladder.railHeading': 'ESPACE DE NOMS SEULEMENT',
  'workbench.docs.diagrams.variables.ladder.railFoot1': 'accessibles par préfixe seulement —',
  'workbench.docs.diagrams.variables.ladder.railFoot2': 'jamais dans le parcours nu',
  'workbench.docs.diagrams.variables.ladder.pinExamples': '{{vault.token}} · {{env.token}} · {{collection.token}}',
  'workbench.docs.diagrams.variables.ladder.pinNote': '{{workspace.token}} — le préfixe épingle une portée.',

  // ── Variables : carte de création ───────────────────────────────────
  'workbench.docs.diagrams.variables.creation.aria':
    'Plan de la barre latérale — les variables de collection vivent sur la collection, les environnements sous ' +
    "Environnements, et Vault, Variables d'espace de travail et Variables Live sont des entrées de premier niveau",
  'workbench.docs.diagrams.variables.creation.title': 'Où chaque portée se crée',
  'workbench.docs.diagrams.variables.creation.workspaceName': 'ÉQUIPE PAIEMENTS',
  'workbench.docs.diagrams.variables.creation.collections': '▾ Collections',
  'workbench.docs.diagrams.variables.creation.collectionName': '▾ API Paiements',
  'workbench.docs.diagrams.variables.creation.variables': 'Variables',
  'workbench.docs.diagrams.variables.creation.environments': '▾ Environnements',
  'workbench.docs.diagrams.variables.creation.envStaging': 'staging  ●',
  'workbench.docs.diagrams.variables.creation.envProduction': 'production',
  'workbench.docs.diagrams.variables.creation.vault': 'Vault',
  'workbench.docs.diagrams.variables.creation.workspaceVariables': "Variables d'espace de travail",
  'workbench.docs.diagrams.variables.creation.liveVariables': 'Variables Live',
  'workbench.docs.diagrams.variables.creation.footer1': 'Les collections portent leur propre page Variables ;',
  'workbench.docs.diagrams.variables.creation.footer2': 'tout le reste est une entrée de la barre latérale.',

  // ── Variables : occultation ─────────────────────────────────────────
  'workbench.docs.diagrams.variables.shadowing.aria':
    "api_host défini à la fois dans l'environnement et l'espace de travail — la référence nue se résout sur la " +
    "valeur d'environnement ; la forme à espace de noms lit encore la valeur d'espace de travail",
  'workbench.docs.diagrams.variables.shadowing.title': 'Même nom dans deux portées — la plus haute gagne',
  'workbench.docs.diagrams.variables.shadowing.wins': '✓ gagne',
  'workbench.docs.diagrams.variables.shadowing.shadowed': 'occultée',
  'workbench.docs.diagrams.variables.shadowing.envLabel': 'Environnement · staging',
  'workbench.docs.diagrams.variables.shadowing.wsLabel': 'Espace de travail',
  'workbench.docs.diagrams.variables.shadowing.footer': "Le préfixe saute l'échelle et lit une portée directement.",

  // ── Variables : cycle de vie Live ───────────────────────────────────
  'workbench.docs.diagrams.variables.live.aria':
    'Un Live Workflow exécute ses étapes, publie la capture exposée comme variable live, et les règles et ' +
    'requêtes la consomment ; la planification relance le workflow',
  'workbench.docs.diagrams.variables.live.title': 'Une exécution réussie publie la valeur',
  'workbench.docs.diagrams.variables.live.workflowTitle': 'Live Workflow',
  'workbench.docs.diagrams.variables.live.step1': 'Étape 1 · connexion',
  'workbench.docs.diagrams.variables.live.step2': 'Étape 2 · récupérer le token',
  'workbench.docs.diagrams.variables.live.expose': 'exposer : token',
  'workbench.docs.diagrams.variables.live.runSucceeds': "l'exécution réussit",
  'workbench.docs.diagrams.variables.live.publishes': 'publie',
  'workbench.docs.diagrams.variables.live.rules': 'Règles',
  'workbench.docs.diagrams.variables.live.requests': 'Requêtes',
  'workbench.docs.diagrams.variables.live.autoRefresh': "l'actualisation auto relance",
  'workbench.docs.diagrams.variables.live.footer1': "Enregistrer active le workflow — la valeur n'apparaît qu'après",
  'workbench.docs.diagrams.variables.live.footer2':
    'une exécution réussie, et se rafraîchit selon la planification du workflow.',

  // ── Variables : consommateurs ───────────────────────────────────────
  'workbench.docs.diagrams.variables.consumers.aria':
    'Une seule valeur à modèle — Authorization: Bearer token — consommée par les règles, requêtes et workflows',
  'workbench.docs.diagrams.variables.consumers.title': 'Définir une fois, référencer partout',
  'workbench.docs.diagrams.variables.consumers.template': 'Authorization: Bearer {{token}}',
  'workbench.docs.diagrams.variables.consumers.rules': 'Règles',
  'workbench.docs.diagrams.variables.consumers.rulesLine1': 'en-têtes, redirection,',
  'workbench.docs.diagrams.variables.consumers.rulesLine2': 'corps, injection',
  'workbench.docs.diagrams.variables.consumers.rulesWhen': "quand une règle s'applique",
  'workbench.docs.diagrams.variables.consumers.requests': 'Requêtes',
  'workbench.docs.diagrams.variables.consumers.requestsLine1': 'URL, paramètres,',
  'workbench.docs.diagrams.variables.consumers.requestsLine2': 'en-têtes, auth, corps',
  'workbench.docs.diagrams.variables.consumers.requestsWhen': "à l'envoi",
  'workbench.docs.diagrams.variables.consumers.workflows': 'Workflows',
  'workbench.docs.diagrams.variables.consumers.workflowsLine1': 'chaque étape,',
  'workbench.docs.diagrams.variables.consumers.workflowsLine2': 'captures chaînées',
  'workbench.docs.diagrams.variables.consumers.workflowsWhen': 'à chaque exécution',
  'workbench.docs.diagrams.variables.consumers.footer1':
    "Les valeurs sont substituées à l'usage — changez la variable une fois,",
  'workbench.docs.diagrams.variables.consumers.footer2': 'et chaque règle, requête et workflow la reprend.',

  // ── Multi-onglets : aperçu de la synchronisation ────────────────────
  'workbench.docs.diagrams.multiTab.sync.aria':
    "Deux onglets d'espace de travail ouverts côte à côte — espaces de travail différents ou dispositions " +
    'différentes, en parallèle',
  'workbench.docs.diagrams.multiTab.sync.title': 'Deux onglets, deux contextes — en même temps',
  'workbench.docs.diagrams.multiTab.sync.tabTitle': '{ordinal} Open Headers',
  'workbench.docs.diagrams.multiTab.sync.workspaceProduction': 'Production',
  'workbench.docs.diagrams.multiTab.sync.workspaceStaging': 'Staging',
  'workbench.docs.diagrams.multiTab.sync.sidebarRules': 'Règles',
  'workbench.docs.diagrams.multiTab.sync.sidebarRequests': 'Requêtes',
  'workbench.docs.diagrams.multiTab.sync.sidebarEnv': 'Env',
  'workbench.docs.diagrams.multiTab.sync.ruleRow1': "En-tête d'auth",
  'workbench.docs.diagrams.multiTab.sync.ruleRow2': 'Contournement CORS',
  'workbench.docs.diagrams.multiTab.sync.ruleRow3': 'Bloquer les pubs',
  'workbench.docs.diagrams.multiTab.sync.rulesEditor': 'Éditeur de règles',
  'workbench.docs.diagrams.multiTab.sync.envEditor': "Éditeur d'env",
  'workbench.docs.diagrams.multiTab.sync.footer1': 'Règles + collections se synchronisent via le stockage.',
  'workbench.docs.diagrams.multiTab.sync.footer2': 'Chaque onglet garde son espace de travail + sa disposition.',

  // ── Multi-onglets : chronologie de numérotation ─────────────────────
  'workbench.docs.diagrams.multiTab.numbering.aria':
    "Chronologie de numérotation — les ordinaux restent stables pendant la vie d'un onglet ; fermer #1 ne " +
    'renumérote pas, le suivant reçoit #4',
  'workbench.docs.diagrams.multiTab.numbering.title': "Les ordinaux restent stables pendant la vie d'un onglet",
  'workbench.docs.diagrams.multiTab.numbering.step1': '1 onglet ouvert',
  'workbench.docs.diagrams.multiTab.numbering.note1': 'pas de préfixe',
  'workbench.docs.diagrams.multiTab.numbering.step2': 'ouvrir un autre',
  'workbench.docs.diagrams.multiTab.numbering.note2': 'les préfixes apparaissent',
  'workbench.docs.diagrams.multiTab.numbering.step3': 'ouvrir un troisième',
  'workbench.docs.diagrams.multiTab.numbering.step4': 'fermer #1',
  'workbench.docs.diagrams.multiTab.numbering.note4': '#2 #3 inchangés',
  'workbench.docs.diagrams.multiTab.numbering.step5': 'encore un',
  'workbench.docs.diagrams.multiTab.numbering.note5': 'le suivant est #4',
  'workbench.docs.diagrams.multiTab.numbering.footer':
    "La numérotation ne repart à #1 qu'après la fermeture de tous les onglets d'espace de travail.",

  // ── Multi-onglets : réutilisation à la navigation ───────────────────
  'workbench.docs.diagrams.multiTab.navigation.aria':
    "Réutilisation à la navigation — la même fenêtre d'abord. En haut : la même fenêtre a un onglet d'espace " +
    "de travail, le clic l'active. En bas : seule une autre fenêtre en a un, un nouvel onglet s'ouvre dans la " +
    "fenêtre d'origine.",
  'workbench.docs.diagrams.multiTab.navigation.title': 'Cliquez sur «Modifier la règle» dans la popup —',
  'workbench.docs.diagrams.multiTab.navigation.subtitle':
    "la popup cherche d'abord un onglet d'espace de travail dans VOTRE fenêtre",
  'workbench.docs.diagrams.multiTab.navigation.sameWindow': 'Même fenêtre',
  'workbench.docs.diagrams.multiTab.navigation.sameWindowHint': "— a déjà un onglet d'espace de travail",
  'workbench.docs.diagrams.multiTab.navigation.window1': 'Fenêtre 1',
  'workbench.docs.diagrams.multiTab.navigation.window1Caller': 'Fenêtre 1 (origine)',
  'workbench.docs.diagrams.multiTab.navigation.window2': 'Fenêtre 2',
  'workbench.docs.diagrams.multiTab.navigation.workspaceTab': '#1 Open Headers',
  'workbench.docs.diagrams.multiTab.navigation.otherTab': 'gmail',
  'workbench.docs.diagrams.multiTab.navigation.popup': 'popup',
  'workbench.docs.diagrams.multiTab.navigation.editRule': 'Modifier la règle ▸',
  'workbench.docs.diagrams.multiTab.navigation.activates': "l'onglet existant s'active · pas de nouvel onglet",
  'workbench.docs.diagrams.multiTab.navigation.otherWindow': 'Autre fenêtre',
  'workbench.docs.diagrams.multiTab.navigation.otherWindowHint': "— la vôtre n'en a aucun",
  'workbench.docs.diagrams.multiTab.navigation.newTab': '+ nouvel onglet',
  'workbench.docs.diagrams.multiTab.navigation.untouched': 'intacte · aucun vol de focus',
  'workbench.docs.diagrams.multiTab.navigation.footer1': "Comme les DevTools de Chrome s'ancrent par fenêtre —",
  'workbench.docs.diagrams.multiTab.navigation.footer2': 'vous restez dans la fenêtre où vous étiez déjà.',

  // ── Multi-onglets : ce qui se synchronise ───────────────────────────
  'workbench.docs.diagrams.multiTab.synced.aria':
    'Ce qui se synchronise entre les onglets — chrome.storage contient règles, collections, dossiers, ' +
    'environnements, variables, vault, requêtes, modèles. Les deux onglets lisent et écrivent à travers lui.',
  'workbench.docs.diagrams.multiTab.synced.title': '✓ Se synchronise entre les onglets',
  'workbench.docs.diagrams.multiTab.synced.subtitle': 'chaque onglet lit et écrit le même chrome.storage',
  'workbench.docs.diagrams.multiTab.synced.sourceOfTruth': 'source de vérité unique',
  'workbench.docs.diagrams.multiTab.synced.pillRules': 'règles',
  'workbench.docs.diagrams.multiTab.synced.pillCollections': 'collections',
  'workbench.docs.diagrams.multiTab.synced.pillFolders': 'dossiers',
  'workbench.docs.diagrams.multiTab.synced.pillEnvironments': 'environnements',
  'workbench.docs.diagrams.multiTab.synced.pillVariables': 'variables',
  'workbench.docs.diagrams.multiTab.synced.pillVault': 'vault',
  'workbench.docs.diagrams.multiTab.synced.pillRequests': 'requêtes',
  'workbench.docs.diagrams.multiTab.synced.pillTemplates': 'modèles',
  'workbench.docs.diagrams.multiTab.synced.tab1': 'Onglet #1',
  'workbench.docs.diagrams.multiTab.synced.tab2': 'Onglet #2',
  'workbench.docs.diagrams.multiTab.synced.liveData': 'données en direct',
  'workbench.docs.diagrams.multiTab.synced.footer':
    "Enregistrez dans l'un ou l'autre — l'autre se réhydrate instantanément.",

  // ── Multi-onglets : ce qui reste local ──────────────────────────────
  'workbench.docs.diagrams.multiTab.local.aria':
    'Ce qui reste dans chaque onglet — ratio du séparateur et brouillons non enregistrés. Deux onglets ' +
    'visiblement différents : partages 25/75 et 65/35, un brouillon dans un seul.',
  'workbench.docs.diagrams.multiTab.local.title': '✗ Reste dans chaque onglet',
  'workbench.docs.diagrams.multiTab.local.subtitle':
    'ratio du séparateur + saisie non enregistrée — privés là où vous les avez faits',
  'workbench.docs.diagrams.multiTab.local.tabTitle': 'Onglet {ordinal}',
  'workbench.docs.diagrams.multiTab.local.layoutLabel': 'disposition',
  'workbench.docs.diagrams.multiTab.local.draftLabel': 'brouillon non enregistré',
  'workbench.docs.diagrams.multiTab.local.unsavedBadge': '● non enregistré',
  'workbench.docs.diagrams.multiTab.local.noUnsaved': 'aucune modification non enregistrée',
  'workbench.docs.diagrams.multiTab.local.footer1': 'Chaque onglet garde son séparateur + son brouillon.',
  'workbench.docs.diagrams.multiTab.local.footer2':
    'Un onglet ouvert APRÈS votre glissement hérite de la nouvelle disposition.',
} as const satisfies Catalog;
