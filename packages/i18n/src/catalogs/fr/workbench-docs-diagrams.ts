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

  // ── Variables : références par portée ───────────────────────────────
  'workbench.docs.diagrams.variables.refs.shared.dont': 'À éviter :',
  'workbench.docs.diagrams.variables.refs.vault.aria':
    'Vault : référencez les secrets depuis les entités synchronisées via les modèles vault ; ne collez jamais ' +
    "de clés brutes dans les règles ou les variables d'espace de travail",
  'workbench.docs.diagrams.variables.refs.vault.title': 'Vault — des secrets qui ne quittent jamais cet appareil',
  'workbench.docs.diagrams.variables.refs.vault.chipSub': 'Vault · kind: string',
  'workbench.docs.diagrams.variables.refs.vault.arrowCaption': 'résolu localement',
  'workbench.docs.diagrams.variables.refs.vault.good1Note': "règle synchronisée — la clé de chaque coéquipier s'insère",
  'workbench.docs.diagrams.variables.refs.vault.good2Note': 'entrée TOTP — résout le code courant, jamais la graine',
  'workbench.docs.diagrams.variables.refs.vault.goodFootnote':
    'les entrées du vault restent hors de la synchro, des exports et de git',
  'workbench.docs.diagrams.variables.refs.vault.bad1Text': 'Bearer sk-live-9f3d… dans une règle',
  'workbench.docs.diagrams.variables.refs.vault.bad1Reason':
    "le texte en clair collé se synchronise vers tout l'espace de travail",
  'workbench.docs.diagrams.variables.refs.vault.bad2Text': "api_key comme variable d'espace de travail",
  'workbench.docs.diagrams.variables.refs.vault.bad2Reason': 'synchronisée aussi — le vault est la seule portée locale',
  'workbench.docs.diagrams.variables.refs.vault.footer1': 'Le Vault prime sur toute portée — un {{api_key}} nu',
  'workbench.docs.diagrams.variables.refs.vault.footer2': 'choisit toujours la valeur du vault quand elle existe.',
  'workbench.docs.diagrams.variables.refs.environment.aria':
    'Environnement : un même nom de variable se résout en une valeur différente par étape ; changez ' +
    "d'environnement au lieu de dupliquer les règles, et gardez les secrets dans le vault",
  'workbench.docs.diagrams.variables.refs.environment.title': 'Environnement — un nom, une valeur par étape',
  'workbench.docs.diagrams.variables.refs.environment.chipSub': 'Environnements · staging (actif)',
  'workbench.docs.diagrams.variables.refs.environment.arrowCaption': "l'environnement actif gagne",
  'workbench.docs.diagrams.variables.refs.environment.good1Note': 'tant que staging est actif',
  'workbench.docs.diagrams.variables.refs.environment.good2Note':
    "changez d'environnement — mêmes règles, zéro modification",
  'workbench.docs.diagrams.variables.refs.environment.goodFootnote':
    "un échec retombe d'abord sur l'environnement par défaut",
  'workbench.docs.diagrams.variables.refs.environment.bad1Text': 'clé sk-live saisie dans production',
  'workbench.docs.diagrams.variables.refs.environment.bad1Reason':
    'les environnements se synchronisent — les secrets vont dans le Vault',
  'workbench.docs.diagrams.variables.refs.environment.bad2Text': 'une copie staging de chaque règle',
  'workbench.docs.diagrams.variables.refs.environment.bad2Reason':
    "ne dupliquez pas les règles par étape — changez d'environnement",
  'workbench.docs.diagrams.variables.refs.environment.footer1':
    'Même valeur à chaque étape ? Utilisez Espace de travail.',
  'workbench.docs.diagrams.variables.refs.environment.footer2':
    'Secret par utilisateur ? Le Vault prime sur tout environnement.',
  'workbench.docs.diagrams.variables.refs.collection.aria':
    'Collection : les variables ne se résolvent que pour les règles et requêtes de leur collection ; déplacez ' +
    'les valeurs valables partout vers la portée espace de travail',
  'workbench.docs.diagrams.variables.refs.collection.title': 'Collection — limitée à une seule API',
  'workbench.docs.diagrams.variables.refs.collection.chipSub': 'API Paiements · Variables',
  'workbench.docs.diagrams.variables.refs.collection.arrowCaption': "se résout dans l'API Paiements",
  'workbench.docs.diagrams.variables.refs.collection.good1Note': 'requête dans la collection API Paiements',
  'workbench.docs.diagrams.variables.refs.collection.good2Note': 'règle dans la collection API Paiements',
  'workbench.docs.diagrams.variables.refs.collection.badsLabel': 'Ne se résout pas :',
  'workbench.docs.diagrams.variables.refs.collection.bad1Text': "{{base_url}} dans l'API Facturation",
  'workbench.docs.diagrams.variables.refs.collection.bad1Reason': 'autre collection — définissez-la là-bas',
  'workbench.docs.diagrams.variables.refs.collection.bad2Text': '{{base_url}} dans une règle hors collection',
  'workbench.docs.diagrams.variables.refs.collection.bad2Reason':
    'pas de collection → la référence passe outre cette portée',
  'workbench.docs.diagrams.variables.refs.collection.footer1':
    'Nécessaire à toutes les collections ? Passez-la en Espace de travail.',
  'workbench.docs.diagrams.variables.refs.collection.footer2':
    "Une variable d'environnement du même nom prime sur elle.",
  'workbench.docs.diagrams.variables.refs.workspace.aria':
    "Espace de travail : les variables d'espace de travail se résolvent partout et sont au rang le plus bas ; " +
    'gardez les secrets dans le vault et les valeurs par étape dans les environnements',
  'workbench.docs.diagrams.variables.refs.workspace.title': 'Espace de travail — la couche de base partagée',
  'workbench.docs.diagrams.variables.refs.workspace.chipSub': "Variables d'espace de travail",
  'workbench.docs.diagrams.variables.refs.workspace.arrowCaption': 'se résout partout',
  'workbench.docs.diagrams.variables.refs.workspace.good1Note':
    "règle d'en-tête — toute collection, tout environnement",
  'workbench.docs.diagrams.variables.refs.workspace.good2Note': 'URL de requête',
  'workbench.docs.diagrams.variables.refs.workspace.good3Note':
    'épinglée — même quand une portée plus haute occulte le nom',
  'workbench.docs.diagrams.variables.refs.workspace.bad1Reason':
    'synchronisé vers tout le monde — gardez les secrets dans le Vault',
  'workbench.docs.diagrams.variables.refs.workspace.bad2Reason':
    "change selon l'étape — définissez-la dans chaque Environnement",
  'workbench.docs.diagrams.variables.refs.workspace.footer1':
    'Secret ? Utilisez le Vault. Différent par étape ? Utilisez Environnement.',
  'workbench.docs.diagrams.variables.refs.workspace.footer2':
    "L'Espace de travail est pour les valeurs vraies partout.",
  'workbench.docs.diagrams.variables.refs.live.aria':
    'Live : référencez les valeurs publiées par un workflow avec le préfixe live ; une référence nue ne résout ' +
    'jamais live, et les tokens collés à la main périment',
  'workbench.docs.diagrams.variables.refs.live.title': 'Live — produit par une exécution de workflow',
  'workbench.docs.diagrams.variables.refs.live.chipSub': 'Variables Live · workflow de connexion OAuth',
  'workbench.docs.diagrams.variables.refs.live.arrowCaption': 'publié par la dernière exécution',
  'workbench.docs.diagrams.variables.refs.live.good1Note': "règle d'en-tête qui ne périme jamais",
  'workbench.docs.diagrams.variables.refs.live.good2Text': '{{live.token}} dans les requêtes et workflows',
  'workbench.docs.diagrams.variables.refs.live.good2Note': 'toujours la dernière valeur publiée',
  'workbench.docs.diagrams.variables.refs.live.bad1Text': '{{token}} — nu',
  'workbench.docs.diagrams.variables.refs.live.bad1Reason':
    'live ne rejoint jamais le parcours nu — écrivez {{live.token}}',
  'workbench.docs.diagrams.variables.refs.live.bad2Text': "un token collé dans une variable d'environnement",
  'workbench.docs.diagrams.variables.refs.live.bad2Reason': 'expire en silence — adossez-le plutôt à un workflow',
  'workbench.docs.diagrams.variables.refs.live.footer1': 'Workflow modifié ? La valeur affiche périmée —',
  'workbench.docs.diagrams.variables.refs.live.footer2': 'seule la prochaine exécution réussie la republie.',

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

  // ── Header actions: shared kickers ──────────────────────────────────
  'workbench.docs.diagrams.headerActions.shared.ruleKicker': 'RÈGLE',
  'workbench.docs.diagrams.headerActions.shared.beforeKicker': 'AVANT',
  'workbench.docs.diagrams.headerActions.shared.afterKicker': 'APRÈS',
  'workbench.docs.diagrams.headerActions.shared.wontFireKicker': 'QUAND ÇA NE SE DÉCLENCHE PAS',
  'workbench.docs.diagrams.headerActions.shared.suggestion': 'Suggestion',

  // ── Header actions: operations overview ─────────────────────────────
  'workbench.docs.diagrams.headerActions.overview.aria':
    'Quatre opérations appliquées au même en-tête de départ — Remplacer remplace la valeur, Ajouter à la suite ' +
    'ajoute un doublon, Retirer supprime, Fusionner concatène.',
  'workbench.docs.diagrams.headerActions.overview.title': 'Même en-tête de départ → quatre résultats',
  'workbench.docs.diagrams.headerActions.overview.before': 'Cookie: a=1',
  'workbench.docs.diagrams.headerActions.overview.opOverride': 'Remplacer',
  'workbench.docs.diagrams.headerActions.overview.opAppend': 'Ajouter à la suite',
  'workbench.docs.diagrams.headerActions.overview.opRemove': 'Retirer',
  'workbench.docs.diagrams.headerActions.overview.opMerge': 'Fusionner',
  'workbench.docs.diagrams.headerActions.overview.engineDnr': 'DNR',
  'workbench.docs.diagrams.headerActions.overview.engineScript': 'Script',
  'workbench.docs.diagrams.headerActions.overview.afterOverrideNew': 'Z',
  'workbench.docs.diagrams.headerActions.overview.afterAppendKept': 'a=1 ·',
  'workbench.docs.diagrams.headerActions.overview.afterAppendNew': '+Cookie: Z',
  'workbench.docs.diagrams.headerActions.overview.afterRemoveGone': '(en-tête supprimé)',
  'workbench.docs.diagrams.headerActions.overview.afterMergeNew': '; new=val',
  'workbench.docs.diagrams.headerActions.overview.legendDnr': 'DNR — natif, appliqué par Chrome',
  'workbench.docs.diagrams.headerActions.overview.legendScript': 'Script — fetch / XHR patchés (Fusionner uniquement)',

  // ── Header actions: add / replace ───────────────────────────────────
  'workbench.docs.diagrams.headerActions.override.aria':
    "Ajouter / Remplacer — la même règle couvre les deux cas. Elle remplace la valeur d'un en-tête X-Auth existant, " +
    "ou ajoute l'en-tête quand il est absent. Les deux aboutissent au même résultat.",
  'workbench.docs.diagrams.headerActions.override.rule': 'Override X-Auth: Bearer token',
  'workbench.docs.diagrams.headerActions.override.replaceLabel': 'Remplacer',
  'workbench.docs.diagrams.headerActions.override.addLabel': 'Ajouter',
  'workbench.docs.diagrams.headerActions.override.replaceSub': 'en-tête déjà présent',
  'workbench.docs.diagrams.headerActions.override.addSub': "pas encore d'en-tête X-Auth",
  'workbench.docs.diagrams.headerActions.override.beforeOld': 'X-Auth: old-value',
  'workbench.docs.diagrams.headerActions.override.lineContentType': 'Content-Type: html',
  'workbench.docs.diagrams.headerActions.override.afterNew': 'X-Auth: Bearer token',
  'workbench.docs.diagrams.headerActions.override.noHeaderNote': '(pas de X-Auth)',
  'workbench.docs.diagrams.headerActions.override.arrowReplaced': 'valeur remplacée',
  'workbench.docs.diagrams.headerActions.override.arrowAdded': 'en-tête ajouté',
  'workbench.docs.diagrams.headerActions.override.stamp':
    'Dans les deux cas → un seul en-tête X-Auth avec votre valeur',
  'workbench.docs.diagrams.headerActions.override.wontAria':
    "Ajouter / Remplacer ne s'applique pas quand les conditions de la règle ne correspondent pas à la requête — " +
    "silencieusement, aucune opération. Suggestion : vérifiez les conditions Domaines de requête ou Motif d'URL.",
  'workbench.docs.diagrams.headerActions.override.wontTitle': 'Requête vers un domaine qui ne correspond pas',
  'workbench.docs.diagrams.headerActions.override.wontDetail':
    "Les conditions verrouillent l'action — pas de correspondance, aucune opération.",
  'workbench.docs.diagrams.headerActions.override.wontSuggestion':
    "Vérifiez les Domaines de requête ou le Motif d'URL de la règle.",

  // ── Header actions: append ──────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.append.aria':
    "Ajouter à la suite ajoute une seconde ligne d'en-tête du même nom — les deux sont livrées. AVANT montre une " +
    'ligne Set-Cookie ; APRÈS en montre deux, la nouvelle mise en évidence.',
  'workbench.docs.diagrams.headerActions.append.rule': 'Append Set-Cookie: tracking=xyz',
  'workbench.docs.diagrams.headerActions.append.lineSession': 'Set-Cookie: session=abc',
  'workbench.docs.diagrams.headerActions.append.arrowLabel': '+1 ligne dupliquée',
  'workbench.docs.diagrams.headerActions.append.afterNew': 'Set-Cookie: tracking=xyz',
  'workbench.docs.diagrams.headerActions.append.stamp1': 'Deux lignes Set-Cookie — les deux sont livrées.',
  'workbench.docs.diagrams.headerActions.append.stamp2':
    'À utiliser pour Set-Cookie, Link, Via — les en-têtes qui acceptent les doublons.',
  'workbench.docs.diagrams.headerActions.append.wontAria':
    "Ajouter à la suite ne s'applique pas proprement aux en-têtes qui n'acceptent pas les doublons — le navigateur " +
    "n'en garde qu'un. Utilisez Ajouter / Remplacer pour remplacer ou Fusionner pour concaténer.",
  'workbench.docs.diagrams.headerActions.append.wontTitle': "En-têtes qui n'acceptent pas les doublons",
  'workbench.docs.diagrams.headerActions.append.wontDetail':
    "p. ex. Authorization, Host, Content-Type — le navigateur n'en garde qu'un.",
  'workbench.docs.diagrams.headerActions.append.wontSuggestion1':
    'Utilisez Ajouter / Remplacer pour remplacer la valeur.',
  'workbench.docs.diagrams.headerActions.append.wontSuggestion2':
    'Utilisez Fusionner pour compléter la valeur existante.',

  // ── Header actions: remove ──────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.remove.aria':
    "Retirer supprime l'en-tête ciblé. AVANT montre X-Frame-Options barré ; APRÈS ne montre que l'en-tête " +
    'Content-Type restant.',
  'workbench.docs.diagrams.headerActions.remove.rule': 'Remove X-Frame-Options',
  'workbench.docs.diagrams.headerActions.remove.beforeStruck': 'X-Frame-Options: DENY',
  'workbench.docs.diagrams.headerActions.remove.lineContentType': 'Content-Type: text/html',
  'workbench.docs.diagrams.headerActions.remove.arrowLabel': 'cible retirée',
  'workbench.docs.diagrams.headerActions.remove.stamp1': 'Toutes les instances de X-Frame-Options sont supprimées.',
  'workbench.docs.diagrams.headerActions.remove.stamp2':
    "Les lignes dupliquées du même en-tête sont toutes retirées d'un coup.",
  'workbench.docs.diagrams.headerActions.remove.wontAria':
    "Retirer est sans effet quand l'en-tête ciblé est absent — aucune erreur. Utilisez Ajouter / Remplacer si vous " +
    'vouliez définir une autre valeur.',
  'workbench.docs.diagrams.headerActions.remove.wontTitle': 'En-tête déjà absent',
  'workbench.docs.diagrams.headerActions.remove.wontDetail':
    'Sans effet — aucune erreur, la requête passe simplement inchangée.',
  'workbench.docs.diagrams.headerActions.remove.wontSuggestion':
    'Utilisez Ajouter / Remplacer si vous vouliez définir la valeur, pas la retirer.',

  // ── Header actions: merge ───────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.merge.aria':
    "Fusionner lit la valeur existante de l'en-tête à l'exécution, joint votre valeur avec un séparateur et " +
    "remplace l'original.",
  'workbench.docs.diagrams.headerActions.merge.rule': "Merge Cookie + new=val  (sep: '; ')",
  'workbench.docs.diagrams.headerActions.merge.lineSession': 'Cookie: session=abc',
  'workbench.docs.diagrams.headerActions.merge.arrowLabel': 'jonction avec le séparateur',
  'workbench.docs.diagrams.headerActions.merge.afterNew': 'new=val',
  'workbench.docs.diagrams.headerActions.merge.stamp1': 'Valeur existante + votre valeur, jointes par le séparateur.',
  'workbench.docs.diagrams.headerActions.merge.stamp2':
    "Séparateur par défaut : '; ' pour Cookie, ', ' pour les autres en-têtes.",
  'workbench.docs.diagrams.headerActions.merge.wontAria':
    "Fusionner n'intercepte que les fetch / XHR initiés par JS — les navigations de page et les ressources " +
    'statiques passent inchangées. Utilisez Ajouter / Remplacer ou Ajouter à la suite (DNR) pour celles-ci.',
  'workbench.docs.diagrams.headerActions.merge.wontTitle1': 'Navigations de page',
  'workbench.docs.diagrams.headerActions.merge.wontDetail1':
    'Seuls les fetch / XHR initiés par JS passent par le moteur Script.',
  'workbench.docs.diagrams.headerActions.merge.wontTitle2': 'Ressources statiques (img, script, link)',
  'workbench.docs.diagrams.headerActions.merge.wontDetail2':
    'Émises par le navigateur — elles ne touchent jamais fetch / XHR.',
  'workbench.docs.diagrams.headerActions.merge.wontSuggestion':
    'Pour les en-têtes au niveau de la page, utilisez Ajouter / Remplacer ou Ajouter à la suite (DNR).',

  // ── Conditions: shared ──────────────────────────────────────────────
  'workbench.docs.diagrams.conditions.shared.ruleLabel': 'Règle :',
  'workbench.docs.diagrams.conditions.shared.testRequests': 'Requêtes de test :',
  'workbench.docs.diagrams.conditions.shared.testedAgainst': 'Testé contre ces URL :',
  'workbench.docs.diagrams.conditions.shared.beforeKicker': 'AVANT',
  'workbench.docs.diagrams.conditions.shared.afterKicker': 'APRÈS',
  'workbench.docs.diagrams.conditions.shared.legendLiteral': 'littéral — correspondance exacte',
  'workbench.docs.diagrams.conditions.shared.usePrefix': 'Utilisez ',
  'workbench.docs.diagrams.conditions.shared.useSuffix': ' à la place.',
  'workbench.docs.diagrams.conditions.shared.requestDomainsName': 'Domaines de requête',
  'workbench.docs.diagrams.conditions.shared.urlPatternName': "Motif d'URL",
  'workbench.docs.diagrams.conditions.shared.initiatorDomainsName': 'Domaines initiateurs',

  // ── Conditions: host vs origin ──────────────────────────────────────
  'workbench.docs.diagrams.conditions.hostVsOrigin.aria':
    "Deux URL dans un même fetch — l'URL de la barre d'adresse est l'origine (Domaines initiateurs) ; l'URL de " +
    "destination du fetch est l'hôte (Domaines de requête)",
  'workbench.docs.diagrams.conditions.hostVsOrigin.title': 'Deux URL, deux conditions',
  'workbench.docs.diagrams.conditions.hostVsOrigin.pageDoes': 'Le JS de cette page fait :',
  'workbench.docs.diagrams.conditions.hostVsOrigin.fetchOpen': "fetch('",
  'workbench.docs.diagrams.conditions.hostVsOrigin.sameFetch': 'Même fetch — deux URL différentes.',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendOriginTerm': 'origine',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendOriginRest': " — l'URL de la page → vérifiée par ",
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendHostTerm': 'hôte',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendHostRest': ' — la destination du fetch → vérifiée par ',

  // ── Conditions: matching attributes ─────────────────────────────────
  'workbench.docs.diagrams.conditions.matching.aria':
    'Chaque condition vérifie un attribut de la requête — les pastilles colorées à droite nomment le type de ' +
    "condition qui vérifie l'attribut de chaque ligne. Toutes les conditions se combinent en AND.",
  'workbench.docs.diagrams.conditions.matching.title': 'Chaque condition vérifie un attribut de la requête',
  'workbench.docs.diagrams.conditions.matching.colAttribute': 'ATTRIBUT DE LA REQUÊTE',
  'workbench.docs.diagrams.conditions.matching.colCheckedBy': 'VÉRIFIÉ PAR',
  'workbench.docs.diagrams.conditions.matching.attrMethod': 'méthode :',
  'workbench.docs.diagrams.conditions.matching.attrUrl': 'URL :',
  'workbench.docs.diagrams.conditions.matching.attrHost': 'hôte :',
  'workbench.docs.diagrams.conditions.matching.attrOrigin': 'origine :',
  'workbench.docs.diagrams.conditions.matching.attrType': 'type :',
  'workbench.docs.diagrams.conditions.matching.attrParty': 'partie :',
  'workbench.docs.diagrams.conditions.matching.attrHeader': 'en-tête :',
  'workbench.docs.diagrams.conditions.matching.condMethods': 'Méthodes',
  'workbench.docs.diagrams.conditions.matching.condUrlPattern': "Motif d'URL",
  'workbench.docs.diagrams.conditions.matching.condRequestDomains': 'Domaines de requête',
  'workbench.docs.diagrams.conditions.matching.condInitiatorDomains': 'Domaines initiateurs',
  'workbench.docs.diagrams.conditions.matching.condResourceTypes': 'Types de ressource',
  'workbench.docs.diagrams.conditions.matching.condDomainType': 'Type de domaine',
  'workbench.docs.diagrams.conditions.matching.condHeaders': 'En-têtes',
  'workbench.docs.diagrams.conditions.matching.allMustMatch': 'Toutes doivent correspondre (AND)',
  'workbench.docs.diagrams.conditions.matching.ruleFires': '→ la règle se déclenche',

  // ── Conditions: rule fires ──────────────────────────────────────────
  'workbench.docs.diagrams.conditions.ruleFires.aria':
    "Quand toutes les conditions correspondent, la règle se déclenche — l'en-tête Authorization est remplacé " +
    'avant que la requête quitte le navigateur',
  'workbench.docs.diagrams.conditions.ruleFires.title':
    'Conditions remplies → la règle se déclenche → la requête change',
  'workbench.docs.diagrams.conditions.ruleFires.opOverride': 'Remplacer',
  'workbench.docs.diagrams.conditions.ruleFires.ruleValue': 'Authorization: Bearer NEW',
  'workbench.docs.diagrams.conditions.ruleFires.beforeOld': 'Bearer OLD',
  'workbench.docs.diagrams.conditions.ruleFires.afterNew': 'Bearer NEW',
  'workbench.docs.diagrams.conditions.ruleFires.lineSession': 'session=abc',
  'workbench.docs.diagrams.conditions.ruleFires.arrowRule': 'la règle',
  'workbench.docs.diagrams.conditions.ruleFires.arrowFires': 'se déclenche',
  'workbench.docs.diagrams.conditions.ruleFires.footer': 'La règle ne change que sa cible — le reste passe tel quel.',

  // ── Conditions: request domains ─────────────────────────────────────
  'workbench.docs.diagrams.conditions.requestDomains.aria':
    'Domaines de requête : une seule entrée inclut automatiquement le domaine racine et chaque sous-domaine, sur ' +
    'tout chemin ou paramètre',
  'workbench.docs.diagrams.conditions.requestDomains.title': 'Domaines de requête — une entrée, tous les sous-domaines',
  'workbench.docs.diagrams.conditions.requestDomains.autoIncludes': 'inclut automatiquement',
  'workbench.docs.diagrams.conditions.requestDomains.hostOnly':
    'hôte seul — tout chemin ou paramètre de requête convient',
  'workbench.docs.diagrams.conditions.requestDomains.doesntMatch': 'Ne correspond pas :',
  'workbench.docs.diagrams.conditions.requestDomains.reasonTld': 'TLD différent (.com ≠ .io)',
  'workbench.docs.diagrams.conditions.requestDomains.reasonNotSub':
    'pas un vrai sous-domaine — pas de point avant « openheaders.com »',
  'workbench.docs.diagrams.conditions.requestDomains.footerPathPrefix': 'Besoin de limiter par chemin ? Ajoutez ',
  'workbench.docs.diagrams.conditions.requestDomains.footerPathSuffix': ' à la règle.',
  'workbench.docs.diagrams.conditions.requestDomains.footerCross':
    'Plusieurs domaines ? Ajoutez chaque domaine comme entrée séparée.',

  // ── Conditions: exclude domains ─────────────────────────────────────
  'workbench.docs.diagrams.conditions.excludeDomains.aria':
    "Exclure des domaines soustrait des hôtes des correspondances d'une autre condition ; seul, il ne correspond " +
    'à rien',
  'workbench.docs.diagrams.conditions.excludeDomains.title': "Exclure des domaines — soustrait d'une autre condition",
  'workbench.docs.diagrams.conditions.excludeDomains.subtitle': "Soustrait des correspondances d'une autre condition",
  'workbench.docs.diagrams.conditions.excludeDomains.includeKicker': '+ DOMAINES DE REQUÊTE',
  'workbench.docs.diagrams.conditions.excludeDomains.excludeKicker': '− EXCLURE DES DOMAINES',
  'workbench.docs.diagrams.conditions.excludeDomains.finalHosts': 'Hôtes retenus au final :',
  'workbench.docs.diagrams.conditions.excludeDomains.excluded': 'exclu',
  'workbench.docs.diagrams.conditions.excludeDomains.excludedSub':
    'exclu — la règle des sous-domaines vaut aussi pour Exclure',
  'workbench.docs.diagrams.conditions.excludeDomains.warnTitle': 'Exclure seul ne correspond à rien.',
  'workbench.docs.diagrams.conditions.excludeDomains.warnBody':
    "Il ne fait que soustraire des correspondances d'une autre condition.",

  // ── Conditions: initiator domains ───────────────────────────────────
  'workbench.docs.diagrams.conditions.initiatorDomains.aria':
    "Domaines initiateurs : même destination, pages d'origine différentes, résultats opposés",
  'workbench.docs.diagrams.conditions.initiatorDomains.title': "Domaines initiateurs — selon la page qui fait l'appel",
  'workbench.docs.diagrams.conditions.initiatorDomains.subtitle':
    'Même fetch, deux contextes de page → résultats différents',
  'workbench.docs.diagrams.conditions.initiatorDomains.ruleBanner': 'Domaines initiateurs : portal.openheaders.com',
  'workbench.docs.diagrams.conditions.initiatorDomains.openPage': 'PAGE OUVERTE',
  'workbench.docs.diagrams.conditions.initiatorDomains.fetches': '↓ fetch vers',
  'workbench.docs.diagrams.conditions.initiatorDomains.matches': '✓ CORRESPOND',
  'workbench.docs.diagrams.conditions.initiatorDomains.noMatch': '✗ AUCUNE CORRESPONDANCE',
  'workbench.docs.diagrams.conditions.initiatorDomains.initiatorEq': 'initiateur =',
  'workbench.docs.diagrams.conditions.initiatorDomains.footerQ': "Vous voulez cibler la destination, pas l'origine ?",

  // ── Conditions: methods ─────────────────────────────────────────────
  'workbench.docs.diagrams.conditions.methods.aria':
    'Méthodes — verbes HTTP à sélection multiple ; seules les méthodes sélectionnées (orange) correspondent',
  'workbench.docs.diagrams.conditions.methods.title': 'Méthodes — choisissez les verbes HTTP qui correspondent',
  'workbench.docs.diagrams.conditions.methods.subtitle':
    "Sélection multiple — l'orange correspond ; le reste ne déclenche rien",
  'workbench.docs.diagrams.conditions.methods.testGet': 'GET /api/users',
  'workbench.docs.diagrams.conditions.methods.testPost': 'POST /api/login',
  'workbench.docs.diagrams.conditions.methods.testPut': 'PUT /api/users/1',
  'workbench.docs.diagrams.conditions.methods.testDelete': 'DELETE /api/users/1',
  'workbench.docs.diagrams.conditions.methods.notSelected': 'méthode hors de la sélection',
  'workbench.docs.diagrams.conditions.methods.footerQ': 'Vous voulez toutes les méthodes ?',
  'workbench.docs.diagrams.conditions.methods.footerA': 'Retirez cette condition — toutes les méthodes par défaut.',

  // ── Conditions: resource types ──────────────────────────────────────
  'workbench.docs.diagrams.conditions.resourceTypes.aria':
    'Types de ressource — sortes de requêtes à sélection multiple ; les types sélectionnés (violet) ' +
    'correspondent, les autres sont ignorés',
  'workbench.docs.diagrams.conditions.resourceTypes.title': 'Types de ressource — sélection multiple',
  'workbench.docs.diagrams.conditions.resourceTypes.subtitle':
    'Le violet correspond ; le reste ne déclenche pas la règle',
  'workbench.docs.diagrams.conditions.resourceTypes.testVisit': 'visite /dashboard',
  'workbench.docs.diagrams.conditions.resourceTypes.testImage': 'GET /img/logo.png',
  'workbench.docs.diagrams.conditions.resourceTypes.testScript': 'GET /js/app.js',
  'workbench.docs.diagrams.conditions.resourceTypes.kindXhr': 'xhr',
  'workbench.docs.diagrams.conditions.resourceTypes.kindPage': 'page',
  'workbench.docs.diagrams.conditions.resourceTypes.kindImageSkipped': 'image — ignorée',
  'workbench.docs.diagrams.conditions.resourceTypes.kindScriptSkipped': 'script — ignoré',
  'workbench.docs.diagrams.conditions.resourceTypes.footerQ': 'Vous voulez tous les types de ressource ?',
  'workbench.docs.diagrams.conditions.resourceTypes.footerA': 'Retirez cette condition — tous les types par défaut.',

  // ── Conditions: domain type ─────────────────────────────────────────
  'workbench.docs.diagrams.conditions.domainType.aria':
    'Type de domaine — chaque requête est classée première partie (même domaine enregistrable) ou tierce partie ; ' +
    'le sélecteur de la règle décide quel type correspond',
  'workbench.docs.diagrams.conditions.domainType.title': 'Type de domaine — première vs tierce partie',
  'workbench.docs.diagrams.conditions.domainType.subtitle':
    "Classé selon la relation entre la page et l'URL de la requête",
  'workbench.docs.diagrams.conditions.domainType.pageLabel': 'Page :',
  'workbench.docs.diagrams.conditions.domainType.ruleSelection': 'Choix de la règle :',
  'workbench.docs.diagrams.conditions.domainType.pillFirstParty': 'firstParty',
  'workbench.docs.diagrams.conditions.domainType.pillThirdParty': 'thirdParty',
  'workbench.docs.diagrams.conditions.domainType.colDestination': 'DESTINATION',
  'workbench.docs.diagrams.conditions.domainType.colType': 'TYPE',
  'workbench.docs.diagrams.conditions.domainType.colMatch': 'CORRESP.',
  'workbench.docs.diagrams.conditions.domainType.partyFirst': 'première partie',
  'workbench.docs.diagrams.conditions.domainType.partyThird': 'tierce partie',
  'workbench.docs.diagrams.conditions.domainType.footerBoth': 'Les deux ? Sélectionnez firstParty ET thirdParty.',
  'workbench.docs.diagrams.conditions.domainType.footerRemove': 'Ou retirez la condition — les deux par défaut.',

  // ── Conditions: response headers ────────────────────────────────────
  'workbench.docs.diagrams.conditions.headers.aria':
    'Condition En-têtes de réponse — nom exact plus valeur exacte, côté réponse uniquement (Chrome DNR ne filtre ' +
    'pas les en-têtes de requête)',
  'workbench.docs.diagrams.conditions.headers.title': 'En-têtes de réponse — nom exact + valeur exacte',
  'workbench.docs.diagrams.conditions.headers.subtitle':
    'Réponse seulement — Chrome DNR ne filtre pas les en-têtes de requête',
  'workbench.docs.diagrams.conditions.headers.exactName': 'nom exact',
  'workbench.docs.diagrams.conditions.headers.exactValue': 'valeur exacte',
  'workbench.docs.diagrams.conditions.headers.testHeaders': 'En-têtes de réponse testés :',
  'workbench.docs.diagrams.conditions.headers.testJson': 'Content-Type: application/json',
  'workbench.docs.diagrams.conditions.headers.testHtml': 'Content-Type: text/html',
  'workbench.docs.diagrams.conditions.headers.testServer': 'Server: nginx',
  'workbench.docs.diagrams.conditions.headers.reasonValue': 'le nom correspond, mais la valeur diffère',
  'workbench.docs.diagrams.conditions.headers.reasonName': "nom d'en-tête différent",
  'workbench.docs.diagrams.conditions.headers.absentLine': '(réponse sans Content-Type)',
  'workbench.docs.diagrams.conditions.headers.reasonAbsent': 'en-tête absent — il doit être présent pour correspondre',
  'workbench.docs.diagrams.conditions.headers.footer': 'Usage courant : filtrer par Content-Type ou indicateurs maison',

  // ── Conditions: URL pattern ─────────────────────────────────────────
  'workbench.docs.diagrams.conditions.urlPattern.aria':
    "Motif d'URL avec jokers sur l'URL complète — anatomie du motif plus exemples qui correspondent ou non",
  'workbench.docs.diagrams.conditions.urlPattern.title': "Motif d'URL — jokers (*) sur l'URL complète",
  'workbench.docs.diagrams.conditions.urlPattern.labelAny': 'tout',
  'workbench.docs.diagrams.conditions.urlPattern.labelProtocol': 'protocole',
  'workbench.docs.diagrams.conditions.urlPattern.labelLiteralHost': 'hôte littéral',
  'workbench.docs.diagrams.conditions.urlPattern.labelNoWildcards': '(aucun joker)',
  'workbench.docs.diagrams.conditions.urlPattern.labelAnyPath': 'tout chemin',
  'workbench.docs.diagrams.conditions.urlPattern.labelQueryString': '+ paramètres',
  'workbench.docs.diagrams.conditions.urlPattern.legendWildcard': 'joker — correspond à tout',
  'workbench.docs.diagrams.conditions.urlPattern.reasonSubdomain': '« cdn » ≠ « api » — sous-domaine différent',
  'workbench.docs.diagrams.conditions.urlPattern.reasonHost': 'hôte entièrement différent',
  'workbench.docs.diagrams.conditions.urlPattern.footerQ': 'Besoin de tous les sous-domaines à la fois ?',
  'workbench.docs.diagrams.conditions.urlPattern.footerExample': 'Domaines de requête : openheaders.com',

  // ── Conditions: URL regex ───────────────────────────────────────────
  'workbench.docs.diagrams.conditions.urlRegex.aria':
    "Anatomie d'une regex d'URL plus exemples — le violet est de la vraie regex ; tout le reste est littéral",
  'workbench.docs.diagrams.conditions.urlRegex.title': "Regex d'URL — regex RE2 sur l'URL complète",
  'workbench.docs.diagrams.conditions.urlRegex.labelStart': 'ancre',
  'workbench.docs.diagrams.conditions.urlRegex.labelAnchor': 'de début',
  'workbench.docs.diagrams.conditions.urlRegex.labelLiteralChars': 'caractères littéraux',
  'workbench.docs.diagrams.conditions.urlRegex.labelDotNote': '(\\. correspond au caractère .)',
  'workbench.docs.diagrams.conditions.urlRegex.labelOneOrMore': 'un ou plusieurs',
  'workbench.docs.diagrams.conditions.urlRegex.labelDigits': 'chiffres',
  'workbench.docs.diagrams.conditions.urlRegex.legendRegex': 'syntaxe regex — sens spécial',
  'workbench.docs.diagrams.conditions.urlRegex.reasonHttp': 'la regex impose https:// — http ne correspond pas',
  'workbench.docs.diagrams.conditions.urlRegex.reasonLatest': '« latest » ne correspond pas à /v[0-9]+',
  'workbench.docs.diagrams.conditions.urlRegex.footerQ': 'Vous voulez http et https ?',
  'workbench.docs.diagrams.conditions.urlRegex.footerUsePrefix': 'Utilisez ',
  'workbench.docs.diagrams.conditions.urlRegex.footerMid': ' — le ',
  'workbench.docs.diagrams.conditions.urlRegex.footerEnd': ' rend le s facultatif.',

  // ── Actions: rule anatomy ───────────────────────────────────────────
  'workbench.docs.diagrams.actions.ruleAnatomy.aria':
    "Anatomie d'une règle — une requête HTTP sortante est confrontée aux conditions de la règle (jointes par " +
    "AND) ; si toutes correspondent, l'action modifie la requête avant qu'elle quitte le navigateur.",
  'workbench.docs.diagrams.actions.ruleAnatomy.title': 'Une règle = Conditions + Action',
  'workbench.docs.diagrams.actions.ruleAnatomy.subtitle':
    "Les conditions décident si la règle se déclenche. L'action décide de ce qui change.",
  'workbench.docs.diagrams.actions.ruleAnatomy.outgoingRequest': 'Requête sortante',
  'workbench.docs.diagrams.actions.ruleAnatomy.sideBefore': 'avant',
  'workbench.docs.diagrams.actions.ruleAnatomy.sideAfter': 'après',
  'workbench.docs.diagrams.actions.ruleAnatomy.addedTag': 'AJOUTÉ',
  'workbench.docs.diagrams.actions.ruleAnatomy.arrowCheck': 'vérifier',
  'workbench.docs.diagrams.actions.ruleAnatomy.arrowApply': 'appliquer',
  'workbench.docs.diagrams.actions.ruleAnatomy.ruleLabel': 'Règle',
  'workbench.docs.diagrams.actions.ruleAnatomy.editorEntity': "entité de l'éditeur",
  'workbench.docs.diagrams.actions.ruleAnatomy.conditionsKicker': 'CONDITIONS',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionKicker': 'ACTION',
  'workbench.docs.diagrams.actions.ruleAnatomy.condMethods': 'Méthodes',
  'workbench.docs.diagrams.actions.ruleAnatomy.condRequestDomains': 'Domaines de requête',
  'workbench.docs.diagrams.actions.ruleAnatomy.condHeaders': 'En-têtes',
  'workbench.docs.diagrams.actions.ruleAnatomy.allMustMatch': 'TOUTES DOIVENT CORRESPONDRE (AND)',
  'workbench.docs.diagrams.actions.ruleAnatomy.onePerRule': 'une par règle',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionCard': "Action d'en-tête · Ajouter",
  'workbench.docs.diagrams.actions.ruleAnatomy.actionValue': 'Bearer abc123…',
  'workbench.docs.diagrams.actions.ruleAnatomy.categoryLine': 'catégorie : Modifier la requête',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictConditions': 'Conditions filtrent',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictAction': 'action transforme',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictResult': 'requête sort modifiée',

  // ── Actions: taxonomy ───────────────────────────────────────────────
  'workbench.docs.diagrams.actions.taxonomy.aria':
    'Taxonomie des actions — trois catégories (Modifier la requête, Modifier la réponse, Exécuter du code) ' +
    "listant chaque action avec son moteur d'exécution (DNR ou Script).",
  'workbench.docs.diagrams.actions.taxonomy.title': 'Actions — par catégorie',
  'workbench.docs.diagrams.actions.taxonomy.subtitle':
    "Chaque action appartient à une des trois catégories. Le badge moteur indique où elle s'exécute.",
  'workbench.docs.diagrams.actions.taxonomy.catModifyRequest': 'Modifier la requête',
  'workbench.docs.diagrams.actions.taxonomy.catModifyRequestSub': "avant qu'elle quitte le navigateur",
  'workbench.docs.diagrams.actions.taxonomy.catModifyResponse': 'Modifier la réponse',
  'workbench.docs.diagrams.actions.taxonomy.catModifyResponseSub': 'avant que la page la voie',
  'workbench.docs.diagrams.actions.taxonomy.catRunCode': 'Exécuter du code',
  'workbench.docs.diagrams.actions.taxonomy.catRunCodeSub': 'dans la page ou son ordonnanceur',
  'workbench.docs.diagrams.actions.taxonomy.nameHeaderActions': "Actions d'en-tête",
  'workbench.docs.diagrams.actions.taxonomy.subHeaderOps': "les quatre opérations d'en-tête",
  'workbench.docs.diagrams.actions.taxonomy.nameBlock': 'Blocage',
  'workbench.docs.diagrams.actions.taxonomy.subBlock': 'annuler au niveau réseau',
  'workbench.docs.diagrams.actions.taxonomy.nameRedirect': 'Redirection',
  'workbench.docs.diagrams.actions.taxonomy.subRedirect': 'URL statique ou regex',
  'workbench.docs.diagrams.actions.taxonomy.nameQueryParams': 'Paramètres de requête',
  'workbench.docs.diagrams.actions.taxonomy.subQueryParams': 'ajouter · remplacer · retirer',
  'workbench.docs.diagrams.actions.taxonomy.nameRequestBody': 'Corps de requête',
  'workbench.docs.diagrams.actions.taxonomy.subRequestBody': 'statique · dynamique · GraphQL',
  'workbench.docs.diagrams.actions.taxonomy.subHeaderResponse': 'en-têtes côté réponse',
  'workbench.docs.diagrams.actions.taxonomy.nameResponseBody': 'Corps de réponse',
  'workbench.docs.diagrams.actions.taxonomy.subResponseBody': 'corps simulé · statut · en-têtes',
  'workbench.docs.diagrams.actions.taxonomy.nameInject': 'Injecter JS / CSS',
  'workbench.docs.diagrams.actions.taxonomy.subInject': 'avant les scripts ou après le DOM',
  'workbench.docs.diagrams.actions.taxonomy.nameDelay': 'Délai',
  'workbench.docs.diagrams.actions.taxonomy.subDelay': 'navigations + fetch / XHR',
  'workbench.docs.diagrams.actions.taxonomy.verdict':
    'Choisissez une catégorie · une action · associez-la aux conditions',

  // ── System status: shared ───────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.shared.sync': 'Synchronisation',
  'workbench.docs.diagrams.systemStatus.shared.rules': 'Règles',
  'workbench.docs.diagrams.systemStatus.shared.requests': 'Requêtes',
  'workbench.docs.diagrams.systemStatus.shared.permissions': 'Autorisations',
  'workbench.docs.diagrams.systemStatus.shared.secrets': 'Secrets',
  'workbench.docs.diagrams.systemStatus.shared.live': 'Live',
  'workbench.docs.diagrams.systemStatus.shared.systemStatus': 'État du système',
  'workbench.docs.diagrams.systemStatus.shared.noEventsYet': 'Aucun événement',
  'workbench.docs.diagrams.systemStatus.shared.green': 'vert',
  'workbench.docs.diagrams.systemStatus.shared.yellow': 'jaune',
  'workbench.docs.diagrams.systemStatus.shared.red': 'rouge',
  'workbench.docs.diagrams.systemStatus.shared.desktopApp': 'App de bureau',
  'workbench.docs.diagrams.systemStatus.shared.swWakes': 'réveil du SW',

  // ── System status: surfaces ─────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.aria':
    "Surface du Workbench — l'onglet workbench d'OpenHeaders. La rangée d'état vit dans le pied de page, avec " +
    'une pastille par sous-système.',
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.title': "Workbench : la rangée d'état dans le pied de page",
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.callout':
    '↑ six pastilles — une par sous-système ; cliquez pour ouvrir le popover.',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.aria':
    "Surface du popup — le popup de l'extension s'accroche à l'icône de la barre d'outils. La pastille d'état " +
    'vit dans le pied du popup : un point plus le libellé « État du système ».',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.title': 'Popup : la pastille État du système dans le pied',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.wsChip': 'ws ▾',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.callout':
    '↑ point + libellé « État du système » dans le bandeau du pied du popup.',

  // ── System status: worst-level aggregator ───────────────────────────
  'workbench.docs.diagrams.systemStatus.worstLevel.aria':
    'Agrégateur du pire état — six états de sous-systèmes alimentent un seul point composite. La pire couleur ' +
    'gagne : rouge bat jaune bat vert.',
  'workbench.docs.diagrams.systemStatus.worstLevel.title': 'La pire couleur gagne',
  'workbench.docs.diagrams.systemStatus.worstLevel.subtitle':
    'rouge > jaune > vert · gris = aucun événement (traité comme vert)',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgConnected': 'connectée',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgActive': '12 actives',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgNoEvents': 'aucun événement',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgHostNarrowed': 'hôte restreint',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgCipher': 'déchiffrement',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgFresh': '3 fraîches',
  'workbench.docs.diagrams.systemStatus.worstLevel.maxFn': 'max()',
  'workbench.docs.diagrams.systemStatus.worstLevel.composite': 'point',
  'workbench.docs.diagrams.systemStatus.worstLevel.dot': 'composite',
  'workbench.docs.diagrams.systemStatus.worstLevel.footer':
    "Un rouge n'importe où → composite rouge. Pilote le point du popup / panneau latéral.",

  // ── System status: popover ──────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.popover.aria':
    "Disposition du popover d'état — les lignes grises (aucun événement) apparaissent au-dessus des lignes " +
    'colorées (celles qui ont déjà rapporté).',
  'workbench.docs.diagrams.systemStatus.popover.title': "Ordre du popover : les gris d'abord, puis les colorés",
  'workbench.docs.diagrams.systemStatus.popover.subtitle':
    "Dans chaque niveau, l'ordre canonique des sous-systèmes est préservé",
  'workbench.docs.diagrams.systemStatus.popover.header': '● État du système',
  'workbench.docs.diagrams.systemStatus.popover.msgConnected': 'Connectée',
  'workbench.docs.diagrams.systemStatus.popover.msgActiveRules': '12 règles actives',
  'workbench.docs.diagrams.systemStatus.popover.msgHostsNarrowed': 'Hôtes restreints',
  'workbench.docs.diagrams.systemStatus.popover.msgCipherFailed': 'Échec du déchiffrement',
  'workbench.docs.diagrams.systemStatus.popover.dividerNote': '↑ aucun événement · ↓ ont rapporté',
  'workbench.docs.diagrams.systemStatus.popover.footer':
    'Au premier rapport, une ligne migre du gris vers le coloré, une seule fois.',

  // ── System status: sync topology ────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.syncTopology.aria':
    "Topologie de la synchronisation — le service worker de l'extension tient un WebSocket vers l'application " +
    "de bureau sur 127.0.0.1:8137, échangeant espaces de travail, variables et synchronisation d'équipe.",
  'workbench.docs.diagrams.systemStatus.syncTopology.title': 'Comment le sous-système Synchronisation se connecte',
  'workbench.docs.diagrams.systemStatus.syncTopology.extension': 'Extension',
  'workbench.docs.diagrams.systemStatus.syncTopology.serviceWorker': 'service worker',
  'workbench.docs.diagrams.systemStatus.syncTopology.wsClient': 'client WS',
  'workbench.docs.diagrams.systemStatus.syncTopology.onYourMachine': 'sur votre machine',
  'workbench.docs.diagrams.systemStatus.syncTopology.wsServer': 'serveur WS',
  'workbench.docs.diagrams.systemStatus.syncTopology.webSocket': 'WebSocket',
  'workbench.docs.diagrams.systemStatus.syncTopology.carries':
    "Transporte : variables dynamiques · espaces de travail · synchro d'équipe",
  'workbench.docs.diagrams.systemStatus.syncTopology.loopback':
    'Boucle locale uniquement — ne quitte jamais votre machine.',

  // ── System status: sync lifecycle ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.syncLifecycle.aria':
    "Cycle de vie de la connexion de synchronisation en diagramme de séquence — le service worker de l'extension " +
    "se connecte à l'application de bureau ; la pastille passe de vert à jaune puis revient au vert",
  'workbench.docs.diagrams.systemStatus.syncLifecycle.title':
    'Comment la pastille Synchronisation évolue dans le temps',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.extensionSw': 'SW extension',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.syncPill': 'Pastille Sync',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.readsSettings': 'lit les réglages',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.autoConnectOff': 'si connexion auto = off →',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateDisabled': 'Désactivé',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateConnecting': 'Connexion',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateConnected': 'Connecté',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retry1': 'Essai #1',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retry2': 'Essai #2',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.otherwise': 'sinon →',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.wsConnect': 'connexion WebSocket',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.handshakeOk': 'handshake OK',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.pingPong': 'ping ⇄ pong',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.connectionDrops': '✗ la connexion tombe',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.backoff': 'attente',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retryConnect': 'nouvelle tentative',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.footer':
    'Backoff exponentiel entre les essais · les pings détectent les coupures silencieuses de proxy',

  // ── System status: rules pipeline ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.rulesPipeline.aria':
    'Pipeline des règles — la règle est compilée, ses variables résolues, le plafond vérifié, puis Chrome ' +
    "l'applique. Chaque étape peut émettre un niveau d'état si elle tourne mal.",
  'workbench.docs.diagrams.systemStatus.rulesPipeline.title': 'Comment une règle devient une entrée DNR active',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageYourRule': 'Votre règle',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageCompile': 'Compilation',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageResolve': 'Résolution {{VAR}}',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageCapCheck': 'Contrôle du plafond',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageChromeApply': 'Application par Chrome',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageLiveRule': 'Règle active',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subToDnrJson': 'en JSON DNR',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subResolveScopes': 'vault · env · espace de travail',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subMatches': 'correspond aux requêtes',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outUnresolved': 'non résolue → jaune',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outOverCap': 'plafond dépassé → jaune',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outRejected': 'rejetée → rouge',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outActive': 'N actives → vert',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.footerRebuild':
    'La reconstruction se déclenche à chaque enregistrement.',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.footerPaused':
    'En pause reste vert (« Exécution des règles en pause »).',

  // ── System status: rules capacity ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.rulesCapacity.aria':
    "Barre de capacité DNR — vert jusqu'au seuil d'alerte, jaune jusqu'au plafond de troncature, rouge au-delà. " +
    "Les règles au-dessus du plafond sont abandonnées : la zone rouge n'est jamais atteinte à l'exécution.",
  'workbench.docs.diagrams.systemStatus.rulesCapacity.title': 'Capacité de règles — où atterrit chaque décompte',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneHealthy': '✓ sain',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneApproach': 'approche',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneTruncated': 'tronqué',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countHealthy': '1,200',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countApproaching': '4,500',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countOver': '5,600',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.warnLabel': 'alerte',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.capLabel': 'plafond',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.warnValue': '4,000',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.capValue': '5,000',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.footerDrop':
    "Au-delà du plafond, les règles sont abandonnées dans l'ordre de correspondance (le haut gagne).",
  'workbench.docs.diagrams.systemStatus.rulesCapacity.footerCeiling':
    'Le plafond dur de Chrome est bien plus loin, à 30 000.',

  // ── System status: request outcomes ─────────────────────────────────
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.aria':
    "Résultats de l'exécuteur de requêtes — toute réponse HTTP, y compris 4xx et 5xx, passe la pastille au " +
    'vert. Seuls les échecs réseau sans réponse la passent au jaune.',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.title': 'Qui donne quelle couleur à la pastille Requêtes ?',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.requestEditor': 'Éditeur de requête',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.sendButton': 'Envoyer ▸',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.executorFires': 'Exécution',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.gotResponse': '✓ réponse HTTP reçue',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.anyStatus': 'tout code de statut compte',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exOk': 'OK',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exNotFound': 'Introuvable',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exServerError': 'Erreur serveur',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exAborted': 'Interrompue',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exOffline': 'Hors ligne / DNS',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.pillGreen': 'Pastille → vert',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.pillYellow': 'Pastille → jaune',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.noResponse': '✗ aucune réponse',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.networkFailure': 'échec au niveau réseau',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.footer':
    'Un 500 reste « vert » — la requête a abouti, vous avez juste reçu un 500.',

  // ── System status: request scope ────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.requestsScope.aria':
    "Portée de l'exécuteur — seules les requêtes du bouton Envoyer mettent à jour la pastille. Les " +
    'rafraîchissements Live sont silencieux ; le trafic des pages passe par le moteur de règles.',
  'workbench.docs.diagrams.systemStatus.requestsScope.title': 'Qui met à jour la pastille Requêtes ?',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcSend': "Envoyer ▸ dans l'éditeur",
  'workbench.docs.diagrams.systemStatus.requestsScope.srcLive': 'Rafraîchissement Live',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcWebpage': 'fetch / XHR de la page',
  'workbench.docs.diagrams.systemStatus.requestsScope.subUser': "initiée par l'utilisateur",
  'workbench.docs.diagrams.systemStatus.requestsScope.subBackground': "tic d'arrière-plan",
  'workbench.docs.diagrams.systemStatus.requestsScope.subObserved': 'observé par le moteur de règles',
  'workbench.docs.diagrams.systemStatus.requestsScope.updatesPill': 'met à jour la pastille',
  'workbench.docs.diagrams.systemStatus.requestsScope.differentSystem': 'autre système',
  'workbench.docs.diagrams.systemStatus.requestsScope.noUpdate': 'pas de mise à jour',
  'workbench.docs.diagrams.systemStatus.requestsScope.footer':
    'Seul le trafic ad hoc du bouton Envoyer façonne cette pastille.',

  // ── System status: permissions impact ───────────────────────────────
  'workbench.docs.diagrams.systemStatus.permissionsImpact.aria':
    "Même règle, deux états d'autorisation. Avec all_urls accordé, la règle DNR se déclenche. Hôte révoqué, la " +
    "règle ne fait silencieusement rien et l'en-tête n'arrive jamais.",
  'workbench.docs.diagrams.systemStatus.permissionsImpact.title': "Même règle, deux états d'autorisation",
  'workbench.docs.diagrams.systemStatus.permissionsImpact.granted': 'Accordé',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.narrowed': 'Restreint',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.hostRevoked': 'hôte révoqué',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.addHeader': 'Ajouter un en-tête',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.page': 'Page',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.fetchCall': 'fetch()',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.applies': "s'applique",
  'workbench.docs.diagrams.systemStatus.permissionsImpact.noOp': 'no-op',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.headerArrives': "✓ l'en-tête arrive",
  'workbench.docs.diagrams.systemStatus.permissionsImpact.headerMissing': '✗ en-tête manquant',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.ruleFired': 'règle déclenchée',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.silentNoOp': 'no-op silencieux',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.footer1':
    'Les hôtes restreints ne produisent aucune erreur — les règles ne font simplement rien.',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.footer2':
    "Le rouge de la pastille est le seul indice jusqu'au rétablissement de l'accès.",

  // ── System status: permissions audit ────────────────────────────────
  'workbench.docs.diagrams.systemStatus.permissionsAudit.aria':
    "Quand l'audit s'exécute et quel niveau d'état chaque branche rapporte.",
  'workbench.docs.diagrams.systemStatus.permissionsAudit.title':
    "Quand l'audit s'exécute-t-il, et que rapporte chaque branche ?",
  'workbench.docs.diagrams.systemStatus.permissionsAudit.firstHydration': 'première hydratation',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.happyPath': 'chemin nominal',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.userRevoked': 'un hôte a été révoqué',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.apiUnavailable': 'API indisponible',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.throws': 'lève une exception',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgAllGranted': '« Tout accordé »',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgHostsNarrowed': '« Hôtes restreints »',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgAuditFailed': "« Échec de l'audit »",
  'workbench.docs.diagrams.systemStatus.permissionsAudit.footer1':
    "MV3 n'a pas d'observateur de changement d'autorisations —",
  'workbench.docs.diagrams.systemStatus.permissionsAudit.footer2': 'la re-vérification part à chaque réveil du SW.',

  // ── System status: vault hydration ──────────────────────────────────
  'workbench.docs.diagrams.systemStatus.vaultHydration.aria':
    'Hydratation du vault — le blob se charge depuis le stockage, chaque entrée passe par le schéma. Les ' +
    'conformes sont gardées ; les entrées en dérive sont abandonnées et rapportées en jaune.',
  'workbench.docs.diagrams.systemStatus.vaultHydration.title': 'Hydratation du vault au réveil du SW',
  'workbench.docs.diagrams.systemStatus.vaultHydration.blobSuffix': ' (blob chiffré)',
  'workbench.docs.diagrams.systemStatus.vaultHydration.schemaValidator': 'Validateur de schéma',
  'workbench.docs.diagrams.systemStatus.vaultHydration.matchesSchema': 'conforme au schéma',
  'workbench.docs.diagrams.systemStatus.vaultHydration.driftOldShape': 'dérive : ancienne forme',
  'workbench.docs.diagrams.systemStatus.vaultHydration.kept': '✓ gardée',
  'workbench.docs.diagrams.systemStatus.vaultHydration.dropped': '✗ abandonnée',
  'workbench.docs.diagrams.systemStatus.vaultHydration.secretsYellow': 'Secrets · jaune',
  'workbench.docs.diagrams.systemStatus.vaultHydration.keptEntries': 'les entrées gardées',
  'workbench.docs.diagrams.systemStatus.vaultHydration.hydrateCleanly': "s'hydratent proprement",

  // ── System status: vault drift detail ───────────────────────────────
  'workbench.docs.diagrams.systemStatus.vaultDrift.aria':
    'À quoi ressemble concrètement la dérive de schéma — une entrée valide a uid, label et cipher ; une entrée ' +
    'en dérive peut manquer le champ cipher. Le validateur abandonne la mauvaise ligne et émet un état jaune.',
  'workbench.docs.diagrams.systemStatus.vaultDrift.title': 'À quoi ressemble la « dérive de schéma »',
  'workbench.docs.diagrams.systemStatus.vaultDrift.validEntry': 'Entrée valide',
  'workbench.docs.diagrams.systemStatus.vaultDrift.driftEntry': 'Entrée en dérive',
  'workbench.docs.diagrams.systemStatus.vaultDrift.apiToken': 'token API',
  'workbench.docs.diagrams.systemStatus.vaultDrift.oldToken': 'ancien token',
  'workbench.docs.diagrams.systemStatus.vaultDrift.missing': '— manquant —',
  'workbench.docs.diagrams.systemStatus.vaultDrift.issue': '2 problèmes de schéma → abandonnée',
  'workbench.docs.diagrams.systemStatus.vaultDrift.footer1':
    "Les entrées en dérive sont abandonnées à l'hydratation et la pastille passe au jaune.",
  'workbench.docs.diagrams.systemStatus.vaultDrift.footer2':
    "Ré-enregistrer depuis l'éditeur du Vault redonne à l'entrée sa forme actuelle.",

  // ── System status: live freshness ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.liveFreshness.aria':
    "Règles d'état par workflow — frais, périmé/vacillant, en échec — épinglées aux seuils réels.",
  'workbench.docs.diagrams.systemStatus.liveFreshness.title': "Règles d'état par workflow",
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateFresh': 'frais',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateStale': 'périmé / vacillant',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateFailing': 'en échec',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleFresh':
    'dernière exécution OK · sous 2× la cadence · 0 échec',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleStale':
    'au-delà de 2× la cadence · OU 1–4 échecs consécutifs',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleFailing': '≥ 5 échecs consécutifs',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egFresh': 'p. ex. chaque rafraîchissement obtient le 200',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egStale': 'p. ex. un timeout, nouvel essai',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egFailing': 'p. ex. API en panne depuis une heure',
  'workbench.docs.diagrams.systemStatus.liveFreshness.footer':
    "Cadence = l'intervalle de rafraîchissement configuré du workflow.",

  // ── System status: live aggregation ─────────────────────────────────
  'workbench.docs.diagrams.systemStatus.liveAggregation.aria':
    "Agrégation de la pastille Live — trois workflows de l'espace de travail actif se replient en un composite " +
    'via max ; les workflows des autres espaces sont exclus.',
  'workbench.docs.diagrams.systemStatus.liveAggregation.title':
    "Les workflows de l'espace actif se replient en une pastille",
  'workbench.docs.diagrams.systemStatus.liveAggregation.activeWorkspace': 'Espace de travail actif',
  'workbench.docs.diagrams.systemStatus.liveAggregation.contributes': 'contribue à la pastille',
  'workbench.docs.diagrams.systemStatus.liveAggregation.msgFresh': 'frais',
  'workbench.docs.diagrams.systemStatus.liveAggregation.msgConsecFails': '2 échecs consécutifs',
  'workbench.docs.diagrams.systemStatus.liveAggregation.otherWorkspaces': 'Autres espaces de travail',
  'workbench.docs.diagrams.systemStatus.liveAggregation.excluded': 'délibérément exclus',
  'workbench.docs.diagrams.systemStatus.liveAggregation.skipped': '✗ inactionnables — ignorés',
  'workbench.docs.diagrams.systemStatus.liveAggregation.livePill': 'Pastille Live',
  'workbench.docs.diagrams.systemStatus.liveAggregation.maxYellow': 'max() = jaune',
  'workbench.docs.diagrams.systemStatus.liveAggregation.footer1':
    'Un seul workflow au pire état fait basculer toute la pastille.',
  'workbench.docs.diagrams.systemStatus.liveAggregation.footer2':
    "Changez d'espace de travail : la pastille se recalcule sur les exécutions de cet espace.",

  // ── Open Headers: shared ────────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.shared.openHeaders': 'Open Headers',
  'workbench.docs.diagrams.openHeaders.shared.stampBestInClass': 'MEILLEUR DU MARCHÉ',
  'workbench.docs.diagrams.openHeaders.shared.badgeToday': "AUJOURD'HUI",
  'workbench.docs.diagrams.openHeaders.shared.badgeRoadmap': 'FEUILLE DE ROUTE',
  'workbench.docs.diagrams.openHeaders.shared.supports': 'PREND EN CHARGE',
  'workbench.docs.diagrams.openHeaders.shared.inBrowser': 'Dans le navigateur',
  'workbench.docs.diagrams.openHeaders.shared.desktopApp': 'App de bureau',
  'workbench.docs.diagrams.openHeaders.shared.localServer': 'Serveur local',
  'workbench.docs.diagrams.openHeaders.shared.yourVm': 'Votre VM',
  'workbench.docs.diagrams.openHeaders.shared.workbench': 'Workbench',
  'workbench.docs.diagrams.openHeaders.shared.devtools': 'DevTools',
  'workbench.docs.diagrams.openHeaders.shared.soon': 'bientôt',

  // ── Open Headers: paradigm shift ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.shift.aria':
    'Le changement de paradigme — contrastes groupés entre Open Headers et tous les autres outils du domaine. ' +
    'Tout dans une seule extension de navigateur, aucun compte, local uniquement, aucun suivi, un moteur pour ' +
    'neuf types de règles, synchro au niveau du champ, une offre gratuite complète sans verrous, tarification au ' +
    "siège, et aucun verrouillage en cas d'impayé — face au reste du marché.",
  'workbench.docs.diagrams.openHeaders.shift.title': 'LE CHANGEMENT DE PARADIGME',
  'workbench.docs.diagrams.openHeaders.shift.everyoneElse': 'Tous les autres',
  'workbench.docs.diagrams.openHeaders.shift.groupArchitecture': 'Architecture et portée',
  'workbench.docs.diagrams.openHeaders.shift.groupPrivacy': 'Confidentialité et propriété',
  'workbench.docs.diagrams.openHeaders.shift.groupCapability': 'Capacités',
  'workbench.docs.diagrams.openHeaders.shift.groupSync': 'Synchronisation et résilience',
  'workbench.docs.diagrams.openHeaders.shift.groupPricing': 'Tarifs et confiance',
  'workbench.docs.diagrams.openHeaders.shift.stampUnique': 'UNIQUE',
  'workbench.docs.diagrams.openHeaders.shift.stampUserControlled': 'VOUS DÉCIDEZ',
  'workbench.docs.diagrams.openHeaders.shift.stampNoGates': 'AUCUN VERROU',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserPrimary': 'Tout dans le navigateur',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserSub': 'back-end + front-end',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserTag': "- dans l'extension",
  'workbench.docs.diagrams.openHeaders.shift.themBrowserPrimary': 'Back-end hors du navigateur',
  'workbench.docs.diagrams.openHeaders.shift.themBrowserSub': 'app de bureau / cloud, internet requis',
  'workbench.docs.diagrams.openHeaders.shift.usSelfHostPrimary': 'Back-end auto-hébergé',
  'workbench.docs.diagrams.openHeaders.shift.usSelfHostSub': 'navigateur · app de bureau · serveur · VM',
  'workbench.docs.diagrams.openHeaders.shift.themSelfHostPrimary': 'Leur cloud uniquement',
  'workbench.docs.diagrams.openHeaders.shift.themSelfHostSub': 'aucun choix sur où vivent vos données',
  'workbench.docs.diagrams.openHeaders.shift.usOfflinePrimary': 'Front-end natif hors ligne',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineSub': 'extension · bureau · CLI · web',
  'workbench.docs.diagrams.openHeaders.shift.themOfflinePrimary': 'Front-end cloud uniquement (en ligne)',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineSub': 'internet requis pour joindre le back-end',
  'workbench.docs.diagrams.openHeaders.shift.usAccountPrimary': 'Aucun compte',
  'workbench.docs.diagrams.openHeaders.shift.usAccountSub': 'pas de connexion, pas de mur de login',
  'workbench.docs.diagrams.openHeaders.shift.themAccountPrimary': 'Connexion obligatoire',
  'workbench.docs.diagrams.openHeaders.shift.themAccountSub': 'pour utiliser vos propres données',
  'workbench.docs.diagrams.openHeaders.shift.usLocalPrimary': 'Local uniquement',
  'workbench.docs.diagrams.openHeaders.shift.usLocalSub': 'aucun relais cloud',
  'workbench.docs.diagrams.openHeaders.shift.themLocalPrimary': 'Relayé par le cloud',
  'workbench.docs.diagrams.openHeaders.shift.themLocalSub': 'votre trafic passe chez eux',
  'workbench.docs.diagrams.openHeaders.shift.usTrackingPrimary': 'Aucun suivi',
  'workbench.docs.diagrams.openHeaders.shift.usTrackingSub': 'compteurs anonymes · un seul interrupteur',
  'workbench.docs.diagrams.openHeaders.shift.themTrackingPrimary': 'Suivi par défaut',
  'workbench.docs.diagrams.openHeaders.shift.themTrackingSub': "données d'usage envoyées chez eux",
  'workbench.docs.diagrams.openHeaders.shift.usEnginePrimary': 'Moteur de règles',
  'workbench.docs.diagrams.openHeaders.shift.usEngineSub': 'intercepter et modifier les requêtes',
  'workbench.docs.diagrams.openHeaders.shift.themEnginePrimary': 'Pas de moteur dans le navigateur',
  'workbench.docs.diagrams.openHeaders.shift.themEngineSub': 'proxy ou app séparés requis',
  'workbench.docs.diagrams.openHeaders.shift.usCatalogPrimary': 'Catalogue de requêtes API',
  'workbench.docs.diagrams.openHeaders.shift.usCatalogSub': 'HTTP, WS, GraphQL — tout dans le navigateur',
  'workbench.docs.diagrams.openHeaders.shift.themCatalogPrimary': 'Connexion à une plateforme',
  'workbench.docs.diagrams.openHeaders.shift.themCatalogSub': 'et installation de leur app',
  'workbench.docs.diagrams.openHeaders.shift.usAutomatePrimary': 'Automatisez votre espace de travail',
  'workbench.docs.diagrams.openHeaders.shift.usAutomateSub': 'votre agent IA, local ou distant',
  'workbench.docs.diagrams.openHeaders.shift.usAutomateTag': '- vous décidez',
  'workbench.docs.diagrams.openHeaders.shift.themAutomatePrimary': 'Privé ou leur IA cloud uniquement',
  'workbench.docs.diagrams.openHeaders.shift.themAutomateSub': 'aucun accès ouvert ni programmatique',
  'workbench.docs.diagrams.openHeaders.shift.usSyncPrimary': 'Moteur de synchro temps réel',
  'workbench.docs.diagrams.openHeaders.shift.usSyncSub': 'multi-appareil, navigateur, surface',
  'workbench.docs.diagrams.openHeaders.shift.themSyncPrimary': 'Dernier écrit gagne',
  'workbench.docs.diagrams.openHeaders.shift.themSyncSub': 'ou pas de synchro du tout',
  'workbench.docs.diagrams.openHeaders.shift.usSavePrimary': 'Enregistrement concurrent sans conflit',
  'workbench.docs.diagrams.openHeaders.shift.usSaveSub': 'au niveau du champ, tout est conservé',
  'workbench.docs.diagrams.openHeaders.shift.themSavePrimary': "Écrasement au niveau de l'entité",
  'workbench.docs.diagrams.openHeaders.shift.themSaveSub': "les enregistrements s'effacent entre eux",
  'workbench.docs.diagrams.openHeaders.shift.usOfflineEditPrimary': 'Hors ligne, entièrement éditable',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineEditSub': 'resynchronise à votre retour',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineEditPrimary': 'Connexion en ligne requise',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineEditSub': 'ou aucun accès du tout',
  'workbench.docs.diagrams.openHeaders.shift.usTierPrimary': "Tout, dès aujourd'hui, à chaque palier",
  'workbench.docs.diagrams.openHeaders.shift.usTierSub': 'gratuit ≤ 6 utilisateurs · payant = sièges',
  'workbench.docs.diagrams.openHeaders.shift.themTierPrimary': 'Paliers à fonctions verrouillées',
  'workbench.docs.diagrams.openHeaders.shift.themTierSub': 'capacités clés derrière des upsells',
  'workbench.docs.diagrams.openHeaders.shift.usSsoPrimary': 'SSO et sécurité toujours gratuits',
  'workbench.docs.diagrams.openHeaders.shift.usSsoSub': 'SSO/OIDC · RBAC · audit · SIEM',
  'workbench.docs.diagrams.openHeaders.shift.themSsoPrimary': 'La taxe SSO',
  'workbench.docs.diagrams.openHeaders.shift.themSsoSub': 'sécurité vendue en option entreprise',
  'workbench.docs.diagrams.openHeaders.shift.usLapsePrimary': 'Un impayé ne vous verrouille jamais',
  'workbench.docs.diagrams.openHeaders.shift.usLapseSub': 'grâce, puis offre gratuite — données à vous',
  'workbench.docs.diagrams.openHeaders.shift.themLapsePrimary': "Cessez de payer, perdez l'accès",
  'workbench.docs.diagrams.openHeaders.shift.themLapseSub': 'péage sur vos propres données',
  'workbench.docs.diagrams.openHeaders.shift.footer': 'Local-first. Par conception. Pas après coup.',

  // ── Open Headers: API catalog ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.apiCatalog.aria':
    "Catalogue de requêtes API — maquette stylisée d'un éditeur de requête (sélecteur de méthode, barre d'URL, " +
    "bandeau d'onglets, aperçu du corps), plus une bande de fonctionnalités couvrant protocoles, auth, scripts, " +
    'variables, fichiers, collections et cookies.',
  'workbench.docs.diagrams.openHeaders.apiCatalog.title': 'Catalogue de requêtes API',
  'workbench.docs.diagrams.openHeaders.apiCatalog.subtitle':
    "Construction, envoi et gestion des collections — dans l'extension.",
  'workbench.docs.diagrams.openHeaders.apiCatalog.send': 'Envoyer ▸',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabParams': 'Params',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabAuth': 'Autorisation',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabHeaders': 'En-têtes',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabBody': 'Corps',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabScripts': 'Scripts',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabSettings': 'Paramètres',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featAuth': 'Auth',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featAuthSub': 'OAuth 2.0 · Basic · Bearer · clé API',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featScripts': 'Scripts',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featScriptsSub': 'pré-requête + post-réponse',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featVariables': 'Variables',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featVariablesSub': '5 portées · diagnostics structurés',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featFiles': 'Fichiers',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featFilesSub': 'multipart · résolution {{file.X}}',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCollections': 'Collections',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCollectionsSub': 'dossiers · environnements · par requête',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCookies': 'Cookies',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCookiesSub': 'credentialsMode en opt-in',
  'workbench.docs.diagrams.openHeaders.apiCatalog.kicker':
    "TOUT CE QU'UN CLIENT API DE BUREAU OFFRE — DANS L'EXTENSION",
  'workbench.docs.diagrams.openHeaders.apiCatalog.footer': 'Une plateforme API complète — sans la plateforme.',

  // ── Open Headers: rule engine ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.ruleEngine.aria':
    "Moteur de règles Open Headers — deux chemins d'exécution (DNR natif et interception par script), neuf " +
    'catégories de types de règles groupées par moteur, plus le langage de conditions partagé et la chaîne de ' +
    'portées de variables que chaque règle consulte.',
  'workbench.docs.diagrams.openHeaders.ruleEngine.title': 'Moteur de règles',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subtitle': 'natif MV3 · deux moteurs · neuf catégories de règles',
  'workbench.docs.diagrams.openHeaders.ruleEngine.headerDnr': 'DNR · natif',
  'workbench.docs.diagrams.openHeaders.ruleEngine.headerScript': 'Script · interception',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameHeaders': 'En-têtes',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subHeaders': 'Remplacer · Ajouter à la suite · Retirer',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameBlock': 'Blocage',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subBlock': 'annuler au niveau réseau',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameRedirect': 'Redirection',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subRedirect': 'URL statique ou regex',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameQueryParams': 'Params de requête',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subQueryParams': 'ajouter · remplacer · retirer · tout ôter',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameHeadersMerge': 'En-têtes (Fusionner)',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subHeadersMerge': 'concaténation de valeurs',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameInject': 'Injecter',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subInject': 'JS ou CSS, deux moments',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameDelay': 'Délai',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subDelay': 'navigation + fetch/XHR',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameRequestBody': 'Corps de requête',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subRequestBody': 'statique · dynamique · filtre GraphQL',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameResponseBody': 'Corps de réponse',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subResponseBody': 'corps + statut + en-têtes',
  'workbench.docs.diagrams.openHeaders.ruleEngine.captionDnr': 'capte chaque requête émise par le navigateur',
  'workbench.docs.diagrams.openHeaders.ruleEngine.captionScript': 'capte les fetch / XHR initiés par JS',
  'workbench.docs.diagrams.openHeaders.ruleEngine.conditionsKicker': 'UN SEUL LANGAGE DE CONDITIONS',
  'workbench.docs.diagrams.openHeaders.ruleEngine.conditionsList':
    'Request Domains · URL Pattern · URL Regex · Méthodes · Ressource · Initiateur · En-têtes · Type de domaine',
  'workbench.docs.diagrams.openHeaders.ruleEngine.scopesKicker': 'CINQ PORTÉES DE VARIABLES',
  'workbench.docs.diagrams.openHeaders.ruleEngine.footer':
    "Un moteur. Deux chemins d'exécution. Conditions et variables complètes. Dans l'extension.",

  // ── Open Headers: convergence ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.convergence.aria':
    'Trois catégories de produits historiques — proxys de bureau, plateformes API cloud, extensions ' +
    "d'en-têtes seules — convergent vers une seule extension Open Headers. Un navigateur Chromium stylisé montre " +
    "la page workbench de l'extension ouverte, et chaque capacité que fournissaient les trois catégories vit dans " +
    'ce seul onglet.',
  'workbench.docs.diagrams.openHeaders.convergence.title': "Trois catégories d'outils. Une extension.",
  'workbench.docs.diagrams.openHeaders.convergence.subtitle':
    'Ce qui exigeait trois installations séparées vit désormais dans un seul onglet.',
  'workbench.docs.diagrams.openHeaders.convergence.legacyProxies': 'Proxys de bureau',
  'workbench.docs.diagrams.openHeaders.convergence.legacyProxiesSub': 'interception HTTP · cert CA · binaire séparé',
  'workbench.docs.diagrams.openHeaders.convergence.legacyPlatforms': 'Plateformes API',
  'workbench.docs.diagrams.openHeaders.convergence.legacyPlatformsSub':
    'requêtes + collections · hébergé cloud · compte',
  'workbench.docs.diagrams.openHeaders.convergence.legacyExtensions': "Extensions d'en-têtes",
  'workbench.docs.diagrams.openHeaders.convergence.legacyExtensionsSub':
    'un seul type de règle · sans scripts · sans auth',
  'workbench.docs.diagrams.openHeaders.convergence.allInOneTab': '▼ TOUT OUVERT DANS UN SEUL ONGLET',
  'workbench.docs.diagrams.openHeaders.convergence.tabTitle': '#1 Open Headers',
  'workbench.docs.diagrams.openHeaders.convergence.workbenchSurface': 'la surface workbench',
  'workbench.docs.diagrams.openHeaders.convergence.mv3Chip': 'natif MV3',
  'workbench.docs.diagrams.openHeaders.convergence.pillRuleEngine': 'Moteur de règles',
  'workbench.docs.diagrams.openHeaders.convergence.pillApiCatalog': 'Catalogue de requêtes API',
  'workbench.docs.diagrams.openHeaders.convergence.pillSync': 'Moteur de synchro temps réel',
  'workbench.docs.diagrams.openHeaders.convergence.pillSave': 'Enregistrement sans conflit',
  'workbench.docs.diagrams.openHeaders.convergence.pillNoAccount': 'Aucun compte · aucune connexion',
  'workbench.docs.diagrams.openHeaders.convergence.pillLocalOnly': 'Local uniquement · sans relais cloud',
  'workbench.docs.diagrams.openHeaders.convergence.pillNoTracking': 'Aucun suivi · aucune donnée personnelle',
  'workbench.docs.diagrams.openHeaders.convergence.pillMultiSurface': 'UI multi-surface',
  'workbench.docs.diagrams.openHeaders.convergence.footerStrip':
    'Multi-surface · synchro multi-appareil · local par conception',
  'workbench.docs.diagrams.openHeaders.convergence.caption':
    'Bleu = capacités · violet = posture · les huit vivent dans un seul onglet',

  // ── Open Headers: field sync ────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.fieldSync.aria':
    'Deux surfaces modifient la même règle en même temps. DevTools ajoute, modifie et retire des en-têtes ; le ' +
    'Workbench modifie trois autres champs de la même règle. Les six modifications atterrissent dans la règle ' +
    'fusionnée sans bannière ni écrasement.',
  'workbench.docs.diagrams.openHeaders.fieldSync.title': 'Deux surfaces, même règle, les deux modifications passent',
  'workbench.docs.diagrams.openHeaders.fieldSync.subtitle':
    "Synchro par champ — pas de bannière, pas d'écrasement, rien de perdu",
  'workbench.docs.diagrams.openHeaders.fieldSync.surfaceA': 'surface A',
  'workbench.docs.diagrams.openHeaders.fieldSync.surfaceB': 'surface B',
  'workbench.docs.diagrams.openHeaders.fieldSync.editingHeaders': 'édition des en-têtes',
  'workbench.docs.diagrams.openHeaders.fieldSync.ruleX': 'Règle X',
  'workbench.docs.diagrams.openHeaders.fieldSync.headersTag': 'en-têtes',
  'workbench.docs.diagrams.openHeaders.fieldSync.syncBand': 'MOTEUR DE SYNCHRO · fusion par champ',
  'workbench.docs.diagrams.openHeaders.fieldSync.mergedTag': 'instantané fusionné · en-têtes',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupAdded': 'Ajouté',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupModified': 'Modifié',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupRemoved': 'Retiré',
  'workbench.docs.diagrams.openHeaders.fieldSync.fromPrefix': '← depuis ',
  'workbench.docs.diagrams.openHeaders.fieldSync.verdict1':
    '✓ les deux modifications appliquées — ni bannière, ni conflit',
  'workbench.docs.diagrams.openHeaders.fieldSync.verdict2':
    "Le même chemin passe à l'échelle : extension aujourd'hui → extension + bureau + CLI demain",

  // ── Open Headers: front-ends ────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.frontEnds.aria':
    'Choisissez votre front-end — comment vous accédez à vos données et les gérez. Quatre formats empilés : ' +
    'extension de navigateur, app de bureau, app CLI et app web. Chaque carte liste les surfaces exposées, les ' +
    'back-ends joignables (la première puce est le défaut) et les plateformes prises en charge.',
  'workbench.docs.diagrams.openHeaders.frontEnds.title': 'Choisissez votre front-end — votre accès à vos données',
  'workbench.docs.diagrams.openHeaders.frontEnds.subtitle':
    'Mêmes données, tout front-end — prenez-en un ou tous, chaque surface reste synchronisée.',
  'workbench.docs.diagrams.openHeaders.frontEnds.titleExtension': 'Extension de navigateur',
  'workbench.docs.diagrams.openHeaders.frontEnds.subExtension': 'dans un navigateur',
  'workbench.docs.diagrams.openHeaders.frontEnds.subDesktop': 'fenêtre native',
  'workbench.docs.diagrams.openHeaders.frontEnds.subCli': 'ligne de commande',
  'workbench.docs.diagrams.openHeaders.frontEnds.titleWeb': 'App web',
  'workbench.docs.diagrams.openHeaders.frontEnds.subWeb': 'onglet de navigateur',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfPopup': 'Popup',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfSidePanel': 'Panneau latéral',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfCommandLine': 'Ligne de commande',
  'workbench.docs.diagrams.openHeaders.frontEnds.chipEmbedded': 'Intégré',
  'workbench.docs.diagrams.openHeaders.frontEnds.sectSurfaces': 'SURFACES',
  'workbench.docs.diagrams.openHeaders.frontEnds.sectBackEnds': 'SE CONNECTE AU BACK-END',
  'workbench.docs.diagrams.openHeaders.frontEnds.strip1': 'UN FRONT-END OU TOUS — CE SONT LES MÊMES DONNÉES',
  'workbench.docs.diagrams.openHeaders.frontEnds.strip2':
    '✓ extension · ✓ bureau · ✓ CLI · ✓ web — tous lisent les mêmes entités canoniques',
  'workbench.docs.diagrams.openHeaders.frontEnds.footer':
    'Mêmes données, quel que soit le chemin — chaque surface reste synchronisée.',

  // ── Open Headers: local-first ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.localFirst.aria':
    "Choisissez votre back-end — où vivent vos données. Quatre options d'hébergement empilées. Chaque palier " +
    'hérite de toutes les capacités du précédent et en ajoute de nouvelles, surlignées dans un rectangle vert en ' +
    'pointillés. Une colonne PREND EN CHARGE liste les navigateurs, systèmes et clouds de chaque palier. Les ' +
    'quatre paliers sont locaux uniquement.',
  'workbench.docs.diagrams.openHeaders.localFirst.title': 'Choisissez votre back-end — où vivent vos données',
  'workbench.docs.diagrams.openHeaders.localFirst.subtitle':
    'Chaque palier hérite du précédent — le cadre vert montre les nouveautés — la colonne de droite dit où il ' +
    'tourne.',
  'workbench.docs.diagrams.openHeaders.localFirst.subBrowser': "service worker de l'extension",
  'workbench.docs.diagrams.openHeaders.localFirst.subDesktop': 'back-end intégré',
  'workbench.docs.diagrams.openHeaders.localFirst.subServer': 'processus autonome',
  'workbench.docs.diagrams.openHeaders.localFirst.subVm': "hébergez-le n'importe où",
  'workbench.docs.diagrams.openHeaders.localFirst.bulletZeroSetup': 'zéro configuration',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletSingleDevice': 'un seul appareil',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletPerBrowser': 'instance par navigateur',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiSurface': 'édition concurrente multi-surface',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiWindow': 'édition concurrente multi-fenêtre',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletLocalhostOnly': 'localhost uniquement',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiBrowser': 'instances multi-navigateur',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletPerApp': 'instance par app',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletFilesystem': 'système de fichiers natif',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletYaml': 'YAML sur disque',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletGit': 'intégration git (local/distant)',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMinimalSetup': 'configuration minimale',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletLan': 'joignable sur le LAN',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiApp': 'instances multi-app',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiDevice': 'plusieurs appareils',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletFrontEnds': 'ext. navigateur · app bureau · CLI',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletStandardSetup': 'configuration standard',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletWan': 'joignable WAN/Internet',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletTeamReady': 'prêt pour les équipes',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletSso': 'auth SSO',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletRbac': 'gestion des utilisateurs RBAC',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletAudit': "journaux d'audit et rapports",
  'workbench.docs.diagrams.openHeaders.localFirst.platAllOs': 'Tous OS',
  'workbench.docs.diagrams.openHeaders.localFirst.platEmbedded': 'Embarqué',
  'workbench.docs.diagrams.openHeaders.localFirst.platHyperscalers': 'Hyperscalers',
  'workbench.docs.diagrams.openHeaders.localFirst.platEuNative': 'Natifs UE',
  'workbench.docs.diagrams.openHeaders.localFirst.platOther': 'Autres',
  'workbench.docs.diagrams.openHeaders.localFirst.platEnterprise': 'Entreprise',
  'workbench.docs.diagrams.openHeaders.localFirst.itemMiniPc': 'Mini PC',
  'workbench.docs.diagrams.openHeaders.localFirst.itemHomeServer': 'Serveur maison',
  'workbench.docs.diagrams.openHeaders.localFirst.itemOldLaptop': 'Vieux portable',
  'workbench.docs.diagrams.openHeaders.localFirst.itemYourCloud': 'Votre cloud',
  'workbench.docs.diagrams.openHeaders.localFirst.itemOnPrem': 'Sur site',
  'workbench.docs.diagrams.openHeaders.localFirst.inheritsFrom': 'HÉRITE DE {tier}',
  'workbench.docs.diagrams.openHeaders.localFirst.newInTier': '+ NOUVEAU DANS CE PALIER',
  'workbench.docs.diagrams.openHeaders.localFirst.strip1': 'QUEL QUE SOIT VOTRE CHOIX — IL EST À VOUS, DE BOUT EN BOUT',
  'workbench.docs.diagrams.openHeaders.localFirst.strip2':
    '✓ aucun compte · ✓ aucun relais cloud · ✓ aucun suivi · ✓ aucune donnée personnelle',
  'workbench.docs.diagrams.openHeaders.localFirst.footer': 'Vos données, votre back-end, votre choix — à chaque étape.',

  // ── Open Headers: comparison matrix ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.matrix.aria':
    'Quatre cartes de catégories comparant les plateformes API SaaS, les proxys de bureau et les extensions limitées ' +
    'aux en-têtes à Open Headers.',
  'workbench.docs.diagrams.openHeaders.matrix.title': 'OÙ SE SITUE OPEN HEADERS',
  'workbench.docs.diagrams.openHeaders.matrix.catSaas': 'Plateformes API SaaS',
  'workbench.docs.diagrams.openHeaders.matrix.catProxies': 'Proxys de bureau',
  'workbench.docs.diagrams.openHeaders.matrix.catHeaderOnly': 'Extensions limitées aux en-têtes',
  'workbench.docs.diagrams.openHeaders.matrix.tagCloud': 'cloud',
  'workbench.docs.diagrams.openHeaders.matrix.tagNative': 'natif',
  'workbench.docs.diagrams.openHeaders.matrix.tagLite': 'léger',
  'workbench.docs.diagrams.openHeaders.matrix.tagUs': 'nous',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasData': 'Vos données vivent sur leurs serveurs',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasAccount': 'Compte + connexion obligatoires',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasFeatures': 'Large éventail de fonctionnalités',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyBinary': 'Binaire séparé à installer + lancer',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyCert': 'Cert CA + config proxy par appli',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyTraffic': 'Voit tous les types de trafic',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteNoSetup': 'Dans le navigateur, zéro config',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteOneRule': 'Un seul type de règle — en-têtes uniquement',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteNoScripts': 'Ni scripts, ni auth, ni édition de corps',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsLocal': 'Dans le navigateur · local uniquement · sans compte',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsNine': 'Neuf types de règles · un langage de conditions',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsScripts': "Scripts + OAuth + fichiers dans l'extension",
  'workbench.docs.diagrams.openHeaders.matrix.rowUsSurfaces': 'Quatre surfaces partagent les mêmes données',

  // ── Open Headers: vs cloud ──────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsCloud.aria':
    'Face aux plateformes API cloud. Les plateformes cloud gardent identifiants, définitions de règles et journaux ' +
    'de requêtes sur un serveur du fournisseur. Open Headers garde les trois sur votre appareil.',
  'workbench.docs.diagrams.openHeaders.vsCloud.title': 'Où finissent vos données',
  'workbench.docs.diagrams.openHeaders.vsCloud.subtitle':
    'Identifiants, définitions de règles, journaux de requêtes — en local ou à distance ?',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowCredentials': 'identifiants',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowRules': 'règles',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowLogs': 'journaux',
  'workbench.docs.diagrams.openHeaders.vsCloud.onDevice': 'sur votre appareil',
  'workbench.docs.diagrams.openHeaders.vsCloud.onVendor': 'sur leur serveur',
  'workbench.docs.diagrams.openHeaders.vsCloud.cloudPlatform': 'Plateforme API cloud',
  'workbench.docs.diagrams.openHeaders.vsCloud.you': 'vous',
  'workbench.docs.diagrams.openHeaders.vsCloud.yourData': 'vos données',
  'workbench.docs.diagrams.openHeaders.vsCloud.cloud': 'cloud',
  'workbench.docs.diagrams.openHeaders.vsCloud.yourDevice': 'votre appareil',
  'workbench.docs.diagrams.openHeaders.vsCloud.deviceContents': 'données · règles · logs',
  'workbench.docs.diagrams.openHeaders.vsCloud.allInOnePlace': 'tout au même endroit',
  'workbench.docs.diagrams.openHeaders.vsCloud.verdict': 'Vos données ne quittent jamais votre machine',

  // ── Open Headers: vs header-only ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.aria':
    'Face aux extensions limitées aux en-têtes. Elles gèrent un seul type de règle. Open Headers en gère neuf — ' +
    "en-têtes, blocage, redirection, params de requête, fusion d'en-têtes, injection, délai, corps de requête, " +
    'corps de réponse.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.title': 'Combien de types de règles',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.subtitle':
    'Un outil qui fait une chose — ou un outil qui en fait neuf.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.headerOnlyExtension': 'Extension limitée aux en-têtes',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileHeaders': 'En-têtes',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileHeadersSub': 'remplacer',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileBlock': 'Blocage',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileBlockSub': 'annuler',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileRedirect': 'Redirection',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileRedirectSub': 'statique / regex',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileQuery': 'Params',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileQuerySub': 'ajouter · retirer',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileMerge': 'Fusion',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileMergeSub': 'en-têtes ⊕',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileInject': 'Injecter',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileInjectSub': 'JS / CSS',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileDelay': 'Délai',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileDelaySub': 'nav / fetch',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileReqBody': 'Corps req.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileReqBodySub': 'statique · dyn.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileResBody': 'Corps rép.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileResBodySub': 'corps / statut',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.captionLeft':
    'Besoin des 8 autres ? — installez une autre extension',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.captionRight':
    'Mêmes conditions, même surface, un seul espace de travail',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.verdict':
    'Neuf types de règles, un langage de conditions, une surface observable',

  // ── Open Headers: vs proxy ──────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsProxy.aria':
    'Face aux proxys de bureau. Les proxys détournent le trafic via un processus séparé derrière un certificat CA. ' +
    'Open Headers applique les règles en ligne via les API natives du navigateur — ni port proxy, ni certificat.',
  'workbench.docs.diagrams.openHeaders.vsProxy.title': 'Comment les requêtes sont façonnées',
  'workbench.docs.diagrams.openHeaders.vsProxy.subtitle':
    'Règles en ligne dans le navigateur — ni port proxy, ni certificat CA, ni config par appli.',
  'workbench.docs.diagrams.openHeaders.vsProxy.desktopProxy': 'Proxy de bureau',
  'workbench.docs.diagrams.openHeaders.vsProxy.stampDetour': 'DÉTOUR',
  'workbench.docs.diagrams.openHeaders.vsProxy.stampInline': 'EN LIGNE',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeApp': 'Appli',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeAppSub': 'configurée',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodePortSub': 'port proxy',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeProxy': 'Proxy',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeProxySub': 'cert CA',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeInternet': 'Internet',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeBrowser': 'Navigateur',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallBinary': 'binaire à installer',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallCert': 'cert CA à installer',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipPerApp': 'config par appli',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallExtension': "installer l'extension",
  'workbench.docs.diagrams.openHeaders.vsProxy.chipThatsIt': "c'est tout",
  'workbench.docs.diagrams.openHeaders.vsProxy.verdict':
    'Une installation · zéro certificat · les règles ont les permissions de la page',

  // ── Open Headers: roadmap CLI ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapCli.aria':
    'Jalon de la feuille de route — CLI. Une fenêtre de terminal montrant des commandes types pour lister les ' +
    "règles, changer d'environnement et envoyer une requête enregistrée — toutes parlant au même serveur que l'UI.",
  'workbench.docs.diagrams.openHeaders.roadmapCli.title': 'CLI · scripting sans interface',
  'workbench.docs.diagrams.openHeaders.roadmapCli.subtitle':
    "Même serveur que l'UI — l'automatisation reste en phase avec ce que vous voyez.",
  'workbench.docs.diagrams.openHeaders.roadmapCli.termTitle': 'oh · terminal',
  'workbench.docs.diagrams.openHeaders.roadmapCli.comment': "# même serveur · même espace de travail que l'UI",
  'workbench.docs.diagrams.openHeaders.roadmapCli.verdict':
    'Lister · basculer · envoyer · diff — directement depuis le shell',

  // ── Open Headers: roadmap daemon ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapServer.aria':
    'Jalon de la feuille de route — serveur local / LAN. Un serveur au centre ; extension, app de bureau et ' +
    'CLI se connectent tous comme clients à travers votre LAN.',
  'workbench.docs.diagrams.openHeaders.roadmapServer.title': 'Serveur local / LAN · un seul hub de sync',
  'workbench.docs.diagrams.openHeaders.roadmapServer.subtitle':
    'Extension · bureau · CLI — tous clients du même serveur, tous sur votre réseau.',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackWorkspaces': 'espaces de travail',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackRules': 'règles · vault',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackSync': 'moteur de sync',
  'workbench.docs.diagrams.openHeaders.roadmapServer.lanReachable': 'joignable sur le LAN',
  'workbench.docs.diagrams.openHeaders.roadmapServer.clientExtension': 'Ext. navigateur',
  'workbench.docs.diagrams.openHeaders.roadmapServer.sideLaptop': 'portable',
  'workbench.docs.diagrams.openHeaders.roadmapServer.sideWorkstation': 'poste de travail',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfExtension': 'Popup · Workbench · DevTools',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfDesktop': 'Workbench · multifenêtre',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfCli': 'toute machine · $ oh rules · $ oh env',
  'workbench.docs.diagrams.openHeaders.roadmapServer.verdict':
    'Un serveur · plusieurs clients · reste sur votre réseau',

  // ── Open Headers: roadmap desktop app ───────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.aria':
    "Jalon de la feuille de route — app de bureau. L'extension de navigateur et l'app de bureau native exposent " +
    "toutes deux la surface Workbench sur le même store sur disque. L'app de bureau ajoute des protocoles qu'une " +
    'extension de navigateur ne peut pas héberger nativement : AI, MCP, gRPC, MQTT.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.title': 'Fenêtre native · même store · plus de portée',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.subtitle':
    'Même Workbench, même espace de travail — le bureau ajoute des protocoles impossibles dans un navigateur.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.cardExtension': 'Extension navigateur',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.tagToday': "aujourd'hui",
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerSurface': 'SURFACE',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerFeatures': 'FONCTIONS',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerApiCatalog': 'CATALOGUE API',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featHttpRules': 'Intercepteur',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featVariables': 'Variables',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featWorkflows': 'Workflows',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featApiCatalog': 'Catalogue API',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.noteLocalRemote': 'local / distant',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.desktopOnly': '+ BUREAU UNIQUEMENT',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.browserFeasible': 'Les quatre passent dans le navigateur.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.storePill': "même store d'espace de travail sur disque",
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.verdict':
    'Un workspace, deux front-ends, plus de portée là où le navigateur ne va pas',

  // ── Open Headers: roadmap git workspaces ────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapGit.aria':
    'Jalon de la feuille de route — espaces de travail en équipe via Git. Deux appareils portent chacun un espace ' +
    'de travail ; les deux poussent vers et tirent depuis un dépôt Git partagé. Le dépôt est la couche de sync ; ' +
    'aucun serveur du fournisseur au milieu.',
  'workbench.docs.diagrams.openHeaders.roadmapGit.title': 'Les espaces de travail comme dépôts Git',
  'workbench.docs.diagrams.openHeaders.roadmapGit.subtitle':
    'pull synchronise · push partage · fusion via Git — aucun serveur du fournisseur.',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceA': 'appareil A',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceB': 'appareil B',
  'workbench.docs.diagrams.openHeaders.roadmapGit.workspace': 'Espace de travail',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceContents': 'règles · environnements · vault',
  'workbench.docs.diagrams.openHeaders.roadmapGit.verdict': 'Vos données, votre dépôt, votre historique auditable',

  // ── Open Headers: roadmap importers ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapImporters.aria':
    'Importateurs. Six formats source convergent vers un seul espace de travail Open Headers — cURL, en-têtes ' +
    "HAR, Postman, requêtes HAR complètes, Insomnia, OpenAPI — tous disponibles aujourd'hui.",
  'workbench.docs.diagrams.openHeaders.roadmapImporters.title': 'Importateurs · faites venir votre collection',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.subtitle':
    'cURL, HAR, Postman, Insomnia, OpenAPI, requêtes HAR complètes — tout est déjà là.',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcHarNote': 'en-têtes',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcPostman': 'Collection Postman',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcHarFull': 'HAR complet',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcInsomnia': 'Collection Insomnia',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcOpenApi': 'Spéc OpenAPI',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.tagToday': 'ACTUEL',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.tagNext': 'À VENIR',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.sideWorkspace': 'espace de travail',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.kickerImported': 'IMPORTÉ DANS',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetRules': 'Intercepteur',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetCollections': 'Collections de requêtes API',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetEnvironments': 'Environnements',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetVault': 'Entrées vault',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.verdict':
    'Faites la bascule en une étape — et continuez à travailler',

  // ── Open Headers: roadmap MCP architecture ──────────────────────────
  'workbench.docs.diagrams.openHeaders.mcpArch.aria':
    'Jalon de la feuille de route — architecture du serveur MCP. Un client IA se connecte à Open Headers via le ' +
    "Model Context Protocol (stdio en local, HTTP/SSE à distance). Le serveur MCP OH modifie l'espace de travail " +
    "de l'utilisateur ; le résultat apparaît dans le Workbench.",
  'workbench.docs.diagrams.openHeaders.mcpArch.title': 'Serveur MCP · votre espace de travail, tout client IA',
  'workbench.docs.diagrams.openHeaders.mcpArch.subtitle':
    'Open Headers parle Model Context Protocol — tout agent compatible MCP peut piloter votre espace de travail.',
  'workbench.docs.diagrams.openHeaders.mcpArch.clientTitle': 'Client IA',
  'workbench.docs.diagrams.openHeaders.mcpArch.clientSideTag': 'votre agent',
  'workbench.docs.diagrams.openHeaders.mcpArch.kickerAnyClient': 'TOUT CLIENT MCP',
  'workbench.docs.diagrams.openHeaders.mcpArch.serverTitle': 'Serveur MCP OH',
  'workbench.docs.diagrams.openHeaders.mcpArch.sideTagOpenHeaders': 'open headers',
  'workbench.docs.diagrams.openHeaders.mcpArch.kickerExposes': 'EXPOSE',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeRules': 'Règles · CRUD',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeRequests': 'Requêtes API',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeEnvironments': 'Environnements',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeVariables': 'Variables · Vault',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeWorkflows': 'Workflows',
  'workbench.docs.diagrams.openHeaders.mcpArch.transportLocal': 'local',
  'workbench.docs.diagrams.openHeaders.mcpArch.transportRemote': 'distant',
  'workbench.docs.diagrams.openHeaders.mcpArch.mutates': 'modifie',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbTitle': 'Workbench · votre espace de travail',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbLive': 'en direct',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbContents': 'règles · environnements · variables · workflows · vault',
  'workbench.docs.diagrams.openHeaders.mcpArch.verdict':
    "Pilotez votre espace de travail avec n'importe quel agent IA · local ou distant",

  // ── Open Headers: roadmap MCP tools ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.mcpTools.aria':
    'Jalon de la feuille de route — catalogue des outils du serveur MCP. Sept domaines exposant {n} outils au ' +
    'total : règles, requêtes, environnements, variables, workflows, espaces de travail, activité.',
  'workbench.docs.diagrams.openHeaders.mcpTools.title': "Ce que l'agent IA peut faire",
  'workbench.docs.diagrams.openHeaders.mcpTools.subtitle':
    'Sept domaines — CRUD complet où cela a du sens, lecture seule ciblée ailleurs.',
  'workbench.docs.diagrams.openHeaders.mcpTools.domRules': 'Règles',
  'workbench.docs.diagrams.openHeaders.mcpTools.subRules': 'en-têtes · blocage · redir. · réponse',
  'workbench.docs.diagrams.openHeaders.mcpTools.domRequests': 'Requêtes',
  'workbench.docs.diagrams.openHeaders.mcpTools.subRequests': 'Catalogue API',
  'workbench.docs.diagrams.openHeaders.mcpTools.domEnvironments': 'Environnements',
  'workbench.docs.diagrams.openHeaders.mcpTools.subEnvironments': 'par espace de travail',
  'workbench.docs.diagrams.openHeaders.mcpTools.domVariables': 'Variables',
  'workbench.docs.diagrams.openHeaders.mcpTools.subVariables': 'toutes les portées · vault',
  'workbench.docs.diagrams.openHeaders.mcpTools.domWorkflows': 'Workflows',
  'workbench.docs.diagrams.openHeaders.mcpTools.subWorkflows': 'appels API enchaînés',
  'workbench.docs.diagrams.openHeaders.mcpTools.domWorkspaces': 'Espaces',
  'workbench.docs.diagrams.openHeaders.mcpTools.subWorkspaces': 'multi-espaces',
  'workbench.docs.diagrams.openHeaders.mcpTools.toolsCount': '{n} OUTILS',
  'workbench.docs.diagrams.openHeaders.mcpTools.toolsCountOne': '1 OUTIL',
  'workbench.docs.diagrams.openHeaders.mcpTools.activityTitle': 'Activité',
  'workbench.docs.diagrams.openHeaders.mcpTools.activityNote':
    "le fil des changements — l'agent voit ce qui a changé avant d'agir",
  'workbench.docs.diagrams.openHeaders.mcpTools.verdict': '{n} outils · sept domaines · toute la surface Open Headers',

  // ── Open Headers: roadmap milestones ────────────────────────────────
  'workbench.docs.diagrams.openHeaders.milestones.aria':
    'Jalons — cartes ordonnées dans une fenêtre de navigateur : espaces de travail Git, app de bureau, serveur ' +
    'MCP, serveur local, CLI, app web auto-hébergée, importateurs — tous disponibles.',
  'workbench.docs.diagrams.openHeaders.milestones.chromeTitle': 'Chaque surface, livrée',
  'workbench.docs.diagrams.openHeaders.milestones.addrSubtitle':
    "Livrés dans l'ordre — local uniquement est resté le produit, jalon après jalon.",
  'workbench.docs.diagrams.openHeaders.milestones.tagLive': 'DISPONIBLE',
  'workbench.docs.diagrams.openHeaders.milestones.badgeUserControlled': 'VOUS DÉCIDEZ',
  'workbench.docs.diagrams.openHeaders.milestones.msGit': "Espaces de travail via Git (prêt pour l'équipe)",
  'workbench.docs.diagrams.openHeaders.milestones.descGit':
    'YAML dans un dépôt Git que vous contrôlez — pull, push, merge via Git.',
  'workbench.docs.diagrams.openHeaders.milestones.descDesktop':
    "Binaire natif sur le même store — atteint ce qu'une extension ne peut pas.",
  'workbench.docs.diagrams.openHeaders.milestones.msMcp': 'Serveur MCP (contrôle par agent IA)',
  'workbench.docs.diagrams.openHeaders.milestones.descMcp':
    'Open Headers via MCP — laissez un agent IA piloter votre espace de travail.',
  'workbench.docs.diagrams.openHeaders.milestones.msServer': 'Serveur local / LAN',
  'workbench.docs.diagrams.openHeaders.milestones.descServer':
    'Serveur sur votre machine ou LAN — extension, bureau, CLI comme clients.',
  'workbench.docs.diagrams.openHeaders.milestones.descCli':
    'Scripting sans interface et CI — lister, basculer, envoyer depuis le shell.',
  'workbench.docs.diagrams.openHeaders.milestones.msVm': 'Déploiement VM auto-hébergé + app web',
  'workbench.docs.diagrams.openHeaders.milestones.descVm':
    'Bundle web sur votre VM — navigateurs verrouillés ou déploiements à votre marque.',
  'workbench.docs.diagrams.openHeaders.milestones.msImporters': "Plus d'importateurs",
  'workbench.docs.diagrams.openHeaders.milestones.descImporters':
    'Au-delà de Postman — Insomnia, spécs OpenAPI, imports HAR complets.',
  'workbench.docs.diagrams.openHeaders.milestones.footer':
    'La sync entre utilisateurs passe par Git et les déploiements auto-hébergés — aucun cloud du fournisseur.',

  // ── Open Headers: roadmap web app ───────────────────────────────────
  'workbench.docs.diagrams.openHeaders.webApp.aria':
    'Jalon de la feuille de route — app web auto-hébergée. Votre origine sert le même bundle UI ; les ' +
    "utilisateurs l'ouvrent comme un onglet sur un domaine que vous contrôlez. Même surface Workbench, aucune " +
    'extension requise.',
  'workbench.docs.diagrams.openHeaders.webApp.title': 'Déploiement VM auto-hébergé + app web',
  'workbench.docs.diagrams.openHeaders.webApp.subtitle':
    'Votre VM sert le bundle web — votre origine, votre domaine, vos utilisateurs.',
  'workbench.docs.diagrams.openHeaders.webApp.serves': 'sert',
  'workbench.docs.diagrams.openHeaders.webApp.chromeTitle': 'Open Headers · web',
  'workbench.docs.diagrams.openHeaders.webApp.bodySub': "même surface que l'extension + le bureau",
  'workbench.docs.diagrams.openHeaders.webApp.verdict': 'Même UI · votre origine · aucune extension requise',

  // ── Root shared — kickers recurring across root-level diagrams ──────
  'workbench.docs.diagrams.shared.ruleKicker': 'RÈGLE',
  'workbench.docs.diagrams.shared.useCasesKicker': "CAS D'USAGE COURANTS",
  'workbench.docs.diagrams.shared.wontFireKicker': 'QUAND ÇA NE SE DÉCLENCHE PAS',
  'workbench.docs.diagrams.shared.suggestion': 'Suggestion',
  'workbench.docs.diagrams.shared.beforeKicker': 'AVANT',
  'workbench.docs.diagrams.shared.afterKicker': 'APRÈS',

  // ── Block ───────────────────────────────────────────────────────────
  'workbench.docs.diagrams.block.aria':
    'Le blocage annule les requêtes correspondantes au niveau de la couche réseau — la page voit une erreur ' +
    'réseau. Un blocage main_frame affiche ERR_BLOCKED_BY_CLIENT ; un blocage de sous-ressource échoue ' +
    'silencieusement.',
  'workbench.docs.diagrams.block.rule': 'Block · Request Domains: ads.openheaders.com',
  'workbench.docs.diagrams.block.pageTitle': 'Page',
  'workbench.docs.diagrams.block.dnrBlock': 'Blocage DNR',
  'workbench.docs.diagrams.block.network': 'Réseau',
  'workbench.docs.diagrams.block.neverReached': 'jamais atteint',
  'workbench.docs.diagrams.block.requestCancelled': 'requête annulée',
  'workbench.docs.diagrams.block.pageSeesKicker': 'CE QUE LA PAGE VOIT',
  'workbench.docs.diagrams.block.chromeBlockPage': 'page de blocage de Chrome',
  'workbench.docs.diagrams.block.silentFailure': 'Échec silencieux',
  'workbench.docs.diagrams.block.pageHandlesError': 'la page gère sa propre erreur',
  'workbench.docs.diagrams.block.useCasesAria':
    "Blocage — cas d'usage courants : pubs et traqueurs, simulation de panne, refus d'endpoint et blocage de " +
    'page seule.',
  'workbench.docs.diagrams.block.card1Title': 'Pubs et traqueurs',
  'workbench.docs.diagrams.block.card1Example': 'Bloquer ads.openheaders.com',
  'workbench.docs.diagrams.block.card2Title': 'Simulation de panne',
  'workbench.docs.diagrams.block.card2Example': 'Simuler un hôte hors ligne',
  'workbench.docs.diagrams.block.card3Title': "Refus d'endpoint",
  'workbench.docs.diagrams.block.card3Example': 'Bloquer /api/admin seulement',
  'workbench.docs.diagrams.block.card4Title': 'Blocage de page seule',
  'workbench.docs.diagrams.block.card4Example': 'Ajouter condition main_frame',
  'workbench.docs.diagrams.block.useCasesFooter': 'Associez Blocage aux conditions pour en limiter la portée.',
  'workbench.docs.diagrams.block.wontApplyAria':
    "Le blocage n'annule pas rétroactivement les ressources déjà chargées. Rechargez la page après activation " +
    'de la règle pour intercepter les requêtes futures.',
  'workbench.docs.diagrams.block.alreadyLoaded': 'Ressources déjà chargées',
  'workbench.docs.diagrams.block.alreadyLoadedSub': 'Requêtes futures interceptées — les anciennes restent chargées.',
  'workbench.docs.diagrams.block.suggestionText': 'Rechargez la page après avoir activé la règle.',

  // ── Redirect ────────────────────────────────────────────────────────
  'workbench.docs.diagrams.redirect.staticAria':
    'Redirection statique — chaque requête correspondante est réécrite vers la même URL de destination.',
  'workbench.docs.diagrams.redirect.ruleStatic': 'Redirect → https://openheaders.com/new-page',
  'workbench.docs.diagrams.redirect.originalRequestKicker': 'REQUÊTE ORIGINALE',
  'workbench.docs.diagrams.redirect.urlRewritten': 'URL réécrite',
  'workbench.docs.diagrams.redirect.redirectedToKicker': 'REDIRIGÉ VERS',
  'workbench.docs.diagrams.redirect.staticStamp': 'Chaque correspondance → même URL de destination.',
  'workbench.docs.diagrams.redirect.staticStampSub': 'Le navigateur réagit comme à une redirection du serveur.',
  'workbench.docs.diagrams.redirect.regexAria':
    "Redirection par regex — les groupes de capture du motif d'URL sont référencés comme \\1, \\2 dans l'URL " +
    'de destination.',
  'workbench.docs.diagrams.redirect.ruleRegexLine1': 'URL Regex: ^http://(openheaders\\.io/.*)$',
  'workbench.docs.diagrams.redirect.ruleRegexLine2': 'Redirect → https://\\1',
  'workbench.docs.diagrams.redirect.originalUrlKicker': 'URL ORIGINALE',
  'workbench.docs.diagrams.redirect.captureChip': '\\1 = openheaders.com/page',
  'workbench.docs.diagrams.redirect.substituted': '\\1 substitué',
  'workbench.docs.diagrams.redirect.regexStamp': '\\1 hérite de ce que le groupe de capture a trouvé.',
  'workbench.docs.diagrams.redirect.useCasesAria':
    "Redirection — cas d'usage courants : passage HTTP→HTTPS, migration de domaine, réécriture de chemin, " +
    'proxy de dev local.',
  'workbench.docs.diagrams.redirect.card1Example': 'Forcer tout http vers https',
  'workbench.docs.diagrams.redirect.card2Title': 'Migration de domaine',
  'workbench.docs.diagrams.redirect.card3Title': 'Réécriture de chemin',
  'workbench.docs.diagrams.redirect.card4Title': 'Proxy de dev local',
  'workbench.docs.diagrams.redirect.useCasesFooter': "Regex d'URL + backreferences pour conserver le chemin.",
  'workbench.docs.diagrams.redirect.wontApplyAria':
    "La redirection ne s'applique pas rétroactivement aux pages chargées, et Chrome plafonne les boucles de " +
    'redirection.',
  'workbench.docs.diagrams.redirect.pageLoaded': 'Page déjà chargée',
  'workbench.docs.diagrams.redirect.pageLoadedSub': 'Seules les navigations et requêtes futures sont interceptées.',
  'workbench.docs.diagrams.redirect.loops': 'Boucles de redirection',
  'workbench.docs.diagrams.redirect.loopsSub': 'Chrome plafonne — ERR_TOO_MANY_REDIRECTS.',
  'workbench.docs.diagrams.redirect.suggestionText': 'Rechargez. Vérifiez que les conditions ne bouclent pas.',

  // ── Inject JS / CSS ─────────────────────────────────────────────────
  'workbench.docs.diagrams.inject.timingAria':
    "Moment d'injection — Dès que possible s'exécute avant les scripts de la page ; Après chargement une fois " +
    'le DOM analysé.',
  'workbench.docs.diagrams.inject.timeAxis': 'temps →',
  'workbench.docs.diagrams.inject.navigation': 'navigation',
  'workbench.docs.diagrams.inject.domParsed': 'DOM analysé',
  'workbench.docs.diagrams.inject.loadEvent': 'événement load',
  'workbench.docs.diagrams.inject.asap': 'Dès que possible',
  'workbench.docs.diagrams.inject.prePageScript': 'avant les scripts',
  'workbench.docs.diagrams.inject.afterLoad': 'Après chargement',
  'workbench.docs.diagrams.inject.domSafe': 'sûr pour le DOM',
  'workbench.docs.diagrams.inject.timingFooter': 'Dès que possible pour les races · Après chargement pour le DOM',
  'workbench.docs.diagrams.inject.scriptAria':
    "Injection de script — le JavaScript s'exécute dans la page, soit Dès que possible (avant les scripts), " +
    'soit Après chargement (sûr pour le DOM).',
  'workbench.docs.diagrams.inject.ruleScript': 'Script (ASAP) : tracer chaque appel fetch',
  'workbench.docs.diagrams.inject.injectedComment': "<script> // injecté par l'extension",
  'workbench.docs.diagrams.inject.runsInPage': "S'exécute dans la page — mêmes globales que son JS.",
  'workbench.docs.diagrams.inject.scriptFooter': "Dès que possible devance l'app ; Après chargement lit le DOM.",
  'workbench.docs.diagrams.inject.cssAria':
    'Injection CSS — une balise <style> est ajoutée au head de la page et masque la bannière.',
  'workbench.docs.diagrams.inject.ruleCss': 'CSS: header.banner { display: none }',
  'workbench.docs.diagrams.inject.ruleApplied1': 'règle',
  'workbench.docs.diagrams.inject.ruleApplied2': 'active',
  'workbench.docs.diagrams.inject.hidden': '(masqué)',
  'workbench.docs.diagrams.inject.cssFooter': 'Injecté en balise <style> — même spécificité que le CSS de la page.',
  'workbench.docs.diagrams.inject.wontApplyAria':
    "L'injection ne s'applique pas aux iframes sandboxées ni aux pages dont la CSP stricte bloque les " +
    'scripts inline.',
  'workbench.docs.diagrams.inject.sandboxed': 'Iframes sandboxées',
  'workbench.docs.diagrams.inject.sandboxedSub': 'Pages avec sandbox="" qui désactive les scripts.',
  'workbench.docs.diagrams.inject.strictCsp': "CSP stricte (script-src 'self')",
  'workbench.docs.diagrams.inject.strictCspSub': 'Les scripts injectés inline sont bloqués par la page.',
  'workbench.docs.diagrams.inject.suggestionText': "Injectez dans la page parente ; postMessage vers l'iframe.",
  'workbench.docs.diagrams.inject.useCasesAria':
    "Injecter JS / CSS — cas d'usage courants : monkey-patch, mode sombre, masquer des éléments, feature flags.",
  'workbench.docs.diagrams.inject.card1Title': 'Monkey-patch',
  'workbench.docs.diagrams.inject.card1Example': 'Wrapper fetch / XHR (ASAP)',
  'workbench.docs.diagrams.inject.card2Title': 'Mode sombre',
  'workbench.docs.diagrams.inject.card2Example': 'Forcer un thème CSS',
  'workbench.docs.diagrams.inject.card3Title': 'Masquer le bruit',
  'workbench.docs.diagrams.inject.card3Example': 'Bannières en display: none',
  'workbench.docs.diagrams.inject.card4Title': 'Feature flags',
  'workbench.docs.diagrams.inject.card4Example': 'Flags window au plus tôt',
  'workbench.docs.diagrams.inject.useCasesFooter':
    'Dès que possible pour passer en premier ; Après chargement pour le DOM.',

  // ── Delay ───────────────────────────────────────────────────────────
  'workbench.docs.diagrams.delay.routingAria':
    'Routage du délai entre navigation, fetch et sous-ressources — seules les deux premières voies sont ' +
    'interceptées, les sous-ressources passent.',
  'workbench.docs.diagrams.delay.matchedRequest': 'Requête reconnue',
  'workbench.docs.diagrams.delay.document': 'Document',
  'workbench.docs.diagrams.delay.documentSub': 'nav iframe',
  'workbench.docs.diagrams.delay.navCap': '≤ 30,000 ms',
  'workbench.docs.diagrams.delay.viaWaitingPage': "via page d'attente",
  'workbench.docs.diagrams.delay.fetchXhr': 'Fetch / XHR',
  'workbench.docs.diagrams.delay.jsInitiated': 'initié par JS',
  'workbench.docs.diagrams.delay.xhrCap': '≤ 5,000 ms',
  'workbench.docs.diagrams.delay.monkeyPatched': 'monkey-patché',
  'workbench.docs.diagrams.delay.subResource': 'Sous-ressource',
  'workbench.docs.diagrams.delay.subResourceSub': 'img / css / js',
  'workbench.docs.diagrams.delay.notDelayed': 'non retardée',
  'workbench.docs.diagrams.delay.passesThrough': 'passe direct',
  'workbench.docs.diagrams.delay.routingFooter': 'Des plafonds plus hauts exigent un vrai proxy local',
  'workbench.docs.diagrams.delay.navAria':
    "Délai de navigation — le navigateur est redirigé vers une page d'attente locale qui retient N ms avant " +
    "de renvoyer vers l'URL cible réelle.",
  'workbench.docs.diagrams.delay.ruleNav': 'Delay 8,000 ms · navigation de page',
  'workbench.docs.diagrams.delay.click': 'Clic',
  'workbench.docs.diagrams.delay.waitingPage': "Page d'attente",
  'workbench.docs.diagrams.delay.holds8s': '⏱ retient 8 s',
  'workbench.docs.diagrams.delay.loadsNow': 'charge ensuite',
  'workbench.docs.diagrams.delay.navStamp': "Honoré jusqu'à 30,000 ms — le plafond de redirection de Chrome.",
  'workbench.docs.diagrams.delay.navStampSub': "Réalisé par une redirection DNR vers une page d'attente locale.",
  'workbench.docs.diagrams.delay.xhrAria':
    'Délai des fetch/XHR initiés par JS — un setTimeout monkey-patché retient la résolution. Plafonné à 5000 ms.',
  'workbench.docs.diagrams.delay.ruleXhr': 'Delay 3,000 ms · fetch / XHR JS',
  'workbench.docs.diagrams.delay.intercept': 'interception',
  'workbench.docs.diagrams.delay.network': 'réseau',
  'workbench.docs.diagrams.delay.hold3000': 'pause de 3,000 ms',
  'workbench.docs.diagrams.delay.realRequest': 'requête réelle',
  'workbench.docs.diagrams.delay.responseDelayed': 'réponse (retardée de 3 s)',
  'workbench.docs.diagrams.delay.xhrStamp': 'Plafonné à 5,000 ms — les valeurs au-delà sont ramenées au plafond.',
  'workbench.docs.diagrams.delay.wontApplyAria':
    "Le délai ne s'applique pas aux sous-ressources (img/css/js) ni aux fetch de service worker qui " +
    'contournent le patch de la page.',
  'workbench.docs.diagrams.delay.subResources': 'Sous-ressources (img, css, js, fonts)',
  'workbench.docs.diagrams.delay.subResourcesSub': 'Le navigateur les émet — aucun patch ne peut les retenir.',
  'workbench.docs.diagrams.delay.swFetches': 'Fetch de service worker',
  'workbench.docs.diagrams.delay.swFetchesSub': 'Autre scope ; les patchs côté page ne les atteignent pas.',
  'workbench.docs.diagrams.delay.suggestionText': "Le throttling des sous-ressources arrive avec l'app de bureau.",
  'workbench.docs.diagrams.delay.useCasesAria':
    "Délai — cas d'usage courants : QA des états de chargement, tests de debounce, mise au jour des races, " +
    'simulation de réseau lent.',
  'workbench.docs.diagrams.delay.card1Title': 'États de chargement',
  'workbench.docs.diagrams.delay.card1Example': 'Voir les spinners à coup sûr',
  'workbench.docs.diagrams.delay.card2Title': 'Tests de debounce',
  'workbench.docs.diagrams.delay.card2Example': 'Tester les limites de frappe',
  'workbench.docs.diagrams.delay.card3Title': 'Race conditions',
  'workbench.docs.diagrams.delay.card3Example': "Révéler l'ordre des requêtes",
  'workbench.docs.diagrams.delay.card4Title': 'Simuler réseau lent',
  'workbench.docs.diagrams.delay.card4Example': 'Latence approx. type 3G',
  'workbench.docs.diagrams.delay.useCasesFooter': 'Ressources statiques : un vrai proxy est requis, pas une extension.',

  // ── Query Params ────────────────────────────────────────────────────
  'workbench.docs.diagrams.queryParams.ruleAdd': 'Add / Replace · debug = true',
  'workbench.docs.diagrams.queryParams.addArrow': 'paramètre ajouté ou remplacé',
  'workbench.docs.diagrams.queryParams.addStamp': 'Ajoute si absent, remplace si présent.',
  'workbench.docs.diagrams.queryParams.replaceOnlyAria':
    'Remplacer uniquement — remplace la valeur des paramètres existants, mais laisse intactes les URL sans ' +
    'le paramètre.',
  'workbench.docs.diagrams.queryParams.ruleReplaceOnly': 'Replace only · region = eu',
  'workbench.docs.diagrams.queryParams.present': 'Présent',
  'workbench.docs.diagrams.queryParams.presentSub': 'paramètre déjà là',
  'workbench.docs.diagrams.queryParams.absent': 'Absent',
  'workbench.docs.diagrams.queryParams.absentSub': 'aucun paramètre region',
  'workbench.docs.diagrams.queryParams.valueReplaced': 'valeur remplacée',
  'workbench.docs.diagrams.queryParams.unchanged': 'inchangé',
  'workbench.docs.diagrams.queryParams.replaceOnlyStamp':
    "Remplace, n'ajoute jamais — les URL sans le paramètre passent telles quelles.",
  'workbench.docs.diagrams.queryParams.ruleRemove': 'Remove · utm_source',
  'workbench.docs.diagrams.queryParams.removeArrow': 'paramètre retiré',
  'workbench.docs.diagrams.queryParams.removeStamp': 'Le paramètre nommé est retiré ; tout le reste passe tel quel.',
  'workbench.docs.diagrams.queryParams.ruleRemoveAll': 'Remove All',
  'workbench.docs.diagrams.queryParams.noQueryString': '(pas de chaîne de requête)',
  'workbench.docs.diagrams.queryParams.removeAllArrow': 'chaîne de requête supprimée',
  'workbench.docs.diagrams.queryParams.removeAllStamp': 'Toute la chaîne de requête est retirée en une étape.',
  'workbench.docs.diagrams.queryParams.wontApplyAria':
    'Piège des paramètres de requête — Tout retirer ne se combine pas avec Ajouter / Remplacer dans la ' +
    'même règle.',
  'workbench.docs.diagrams.queryParams.watchForKicker': 'À SURVEILLER',
  'workbench.docs.diagrams.queryParams.combining': 'Combiner Tout retirer avec Ajouter / Remplacer',
  'workbench.docs.diagrams.queryParams.combiningSub':
    'DNR rejette les règles qui vident la requête et ajoutent de nouveaux paramètres.',
  'workbench.docs.diagrams.queryParams.suggestionText':
    "Utilisez deux règles — Tout retirer d'abord, puis Ajouter / Remplacer.",
  'workbench.docs.diagrams.queryParams.suggestionSub':
    "L'ordre des règles compte ; les deux doivent reconnaître la même requête.",
  'workbench.docs.diagrams.queryParams.useCasesAria':
    "Paramètres de requête — cas d'usage courants : forcer un flag, canoniser une valeur, retirer les " +
    'traqueurs, tout retirer en mode privé.',
  'workbench.docs.diagrams.queryParams.card1Title': 'Forcer un flag',
  'workbench.docs.diagrams.queryParams.card1Example': 'Ajouter debug=true',
  'workbench.docs.diagrams.queryParams.card2Title': 'Canoniser',
  'workbench.docs.diagrams.queryParams.card2Example': 'Ne remplacer que region',
  'workbench.docs.diagrams.queryParams.card3Title': 'Retirer les traqueurs',
  'workbench.docs.diagrams.queryParams.card3Example': 'Retirer les params utm_*',
  'workbench.docs.diagrams.queryParams.card4Title': 'Mode privé',
  'workbench.docs.diagrams.queryParams.card4Example': 'Vider la chaîne de requête',
  'workbench.docs.diagrams.queryParams.useCasesFooter':
    "Associez Motif d'URL ou Domaines pour cibler des routes précises.",

  // ── Request Body ────────────────────────────────────────────────────
  'workbench.docs.diagrams.requestBody.interceptAria':
    "Pipeline d'interception du corps de requête — l'appel de page.js entre dans l'interception du moteur " +
    'de script, se ramifie en transformations Statique / Dynamique / GraphQL, puis part vers le vrai réseau.',
  'workbench.docs.diagrams.requestBody.pageSub': 'appel fetch / XHR',
  'workbench.docs.diagrams.requestBody.intercept': 'Interception',
  'workbench.docs.diagrams.requestBody.interceptSub': "monkey-patch de l'extension",
  'workbench.docs.diagrams.requestBody.branchStatic': 'Statique',
  'workbench.docs.diagrams.requestBody.branchStaticSub1': 'remplace le corps',
  'workbench.docs.diagrams.requestBody.branchStaticSub2': 'en bloc',
  'workbench.docs.diagrams.requestBody.branchDynamic': 'Dynamique',
  'workbench.docs.diagrams.requestBody.branchDynamicSub1': 'fn(orig) →',
  'workbench.docs.diagrams.requestBody.branchDynamicSub2': 'corps modifié',
  'workbench.docs.diagrams.requestBody.branchGraphqlSub1': 'op reconnue ? →',
  'workbench.docs.diagrams.requestBody.branchGraphqlSub2': 'applique : ignore',
  'workbench.docs.diagrams.requestBody.realNetwork': 'vrai réseau',
  'workbench.docs.diagrams.requestBody.originalBodyKicker': 'CORPS ORIGINAL',
  'workbench.docs.diagrams.requestBody.bodySentKicker': 'CORPS ENVOYÉ',
  'workbench.docs.diagrams.requestBody.ruleStatic': 'Static body: { "userId": "test-1" }',
  'workbench.docs.diagrams.requestBody.staticArrow': 'corps substitué en bloc',
  'workbench.docs.diagrams.requestBody.staticStamp': "Corps entier remplacé ; la règle n'inspecte jamais l'original.",
  'workbench.docs.diagrams.requestBody.ruleDynamic': 'Dynamic body: fn(orig) → estampillé',
  'workbench.docs.diagrams.requestBody.fnReads': '→ fn lit et réécrit',
  'workbench.docs.diagrams.requestBody.dynamicArrow': 'la fonction transforme',
  'workbench.docs.diagrams.requestBody.dynamicStamp': "La fonction reçoit l'original ; elle renvoie le nouveau corps.",
  'workbench.docs.diagrams.requestBody.graphqlAria':
    'Filtre GraphQL — la règle ne se déclenche que si le champ nommé du corps JSON correspond. Les autres ' +
    'opérations passent intactes.',
  'workbench.docs.diagrams.requestBody.ruleGraphql': 'GraphQL: operationName Equals "GetUser"',
  'workbench.docs.diagrams.requestBody.ruleGraphqlAction': '→ substitution de corps statique',
  'workbench.docs.diagrams.requestBody.match': 'Correspond',
  'workbench.docs.diagrams.requestBody.noMatch': 'Sans correspondance',
  'workbench.docs.diagrams.requestBody.noMatchSub': 'toute autre opération',
  'workbench.docs.diagrams.requestBody.ruleFires': 'règle déclenchée',
  'workbench.docs.diagrams.requestBody.passesThrough': 'passe intact',
  'workbench.docs.diagrams.requestBody.graphqlStamp': 'Filtre au niveau du champ — seules les op correspondantes.',
  'workbench.docs.diagrams.requestBody.graphqlStampSub': 'Champs manquants ou corps non JSON : la règle est ignorée.',
  'workbench.docs.diagrams.requestBody.wontApplyAria':
    'Les règles de corps ne visent que les fetch/XHR initiés par JS avec un corps. Les requêtes GET et HEAD ' +
    "n'ont rien à remplacer ; les ressources statiques n'entrent jamais dans l'interception de script.",
  'workbench.docs.diagrams.requestBody.getHead': 'Requêtes GET / HEAD',
  'workbench.docs.diagrams.requestBody.getHeadSub': 'Pas de corps selon la spec — rien à remplacer.',
  'workbench.docs.diagrams.requestBody.staticResources': 'Ressources statiques (img, script, link)',
  'workbench.docs.diagrams.requestBody.staticResourcesSub': 'Émises par le navigateur — jamais via fetch / XHR.',
  'workbench.docs.diagrams.requestBody.suggestionText':
    'Vérifiez que la requête est un POST/PUT/PATCH du JS de la page.',
  'workbench.docs.diagrams.requestBody.useCasesAria':
    "Corps de requête — cas d'usage courants : fixtures de test, estampillage de métadonnées, mock " +
    "d'opération GraphQL, anonymisation de PII.",
  'workbench.docs.diagrams.requestBody.card1Title': 'Fixtures de test',
  'workbench.docs.diagrams.requestBody.card1Example': 'Forcer un payload connu',
  'workbench.docs.diagrams.requestBody.card2Title': 'Estampiller des méta',
  'workbench.docs.diagrams.requestBody.card2Example': 'Ajouter debug: true',
  'workbench.docs.diagrams.requestBody.card3Title': 'Op GraphQL',
  'workbench.docs.diagrams.requestBody.card3Example': 'Mocker un operationName',
  'workbench.docs.diagrams.requestBody.card4Title': 'Façonner un replay',
  'workbench.docs.diagrams.requestBody.card4Example': 'Anonymiser les champs PII',
  'workbench.docs.diagrams.requestBody.useCasesFooter': 'Moteur de script seul — vise les fetch / XHR initiés par JS.',

  // ── Sequence primitives ─────────────────────────────────────────────
  'workbench.docs.diagrams.sequence.later': 'plus tard',

  // ── Debug mode ──────────────────────────────────────────────────────
  'workbench.docs.diagrams.debugMode.surfaceAria':
    "Le mode débogage vit dans le pied de page — un interrupteur en ligne l'active ; le point et le libellé " +
    "ouvrent un popover avec la portée, l'épingle par onglet et la liste des onglets attachés.",
  'workbench.docs.diagrams.debugMode.surfaceTitle': 'Le mode débogage vit dans le pied de page',
  'workbench.docs.diagrams.debugMode.surfaceCaption': "L'interrupteur l'active · point + libellé ouvrent le popover.",
  'workbench.docs.diagrams.debugMode.debugMode': 'Mode débogage',
  'workbench.docs.diagrams.debugMode.systemStatus': 'État du système',
  'workbench.docs.diagrams.debugMode.inspectLabel': 'Inspecter',
  'workbench.docs.diagrams.debugMode.scopeBoth': 'Les deux ▾',
  'workbench.docs.diagrams.debugMode.includeThisTab': 'Inclure cet onglet',
  'workbench.docs.diagrams.debugMode.attachedTabs': 'Onglets attachés (1)',
  'workbench.docs.diagrams.debugMode.tabRow': 'Onglet #11 · example.com',
  'workbench.docs.diagrams.debugMode.scopeAria':
    "L'ensemble attaché est dérivé : la portée choisie unie aux onglets épinglés, intersectée avec " +
    "l'interrupteur principal. Mode débogage éteint, rien ne s'attache.",
  'workbench.docs.diagrams.debugMode.scopeTitle': "Ce qui s'attache",
  'workbench.docs.diagrams.debugMode.scopeFormula': '( portée ∪ épingles ) ∩ interrupteur principal',
  'workbench.docs.diagrams.debugMode.inspectBoth': 'Inspecter : Les deux',
  'workbench.docs.diagrams.debugMode.devtoolsUnion': 'DevTools ∪ onglet actif',
  'workbench.docs.diagrams.debugMode.pinnedTab': 'Épinglé : Onglet #11',
  'workbench.docs.diagrams.debugMode.candidates': 'candidats',
  'workbench.docs.diagrams.debugMode.gateLabel': '∩ Débogage ON',
  'workbench.docs.diagrams.debugMode.attached': 'Attachés',
  'workbench.docs.diagrams.debugMode.attachedTab1': 'Onglet #7',
  'workbench.docs.diagrams.debugMode.attachedTab2': 'Onglet #11',
  'workbench.docs.diagrams.debugMode.scopeFooter1': "Débogage OFF → rien ne s'attache, quelle que soit la portée.",
  'workbench.docs.diagrams.debugMode.scopeFooter2': 'Le ré-attachement rejoue depuis ceci — jamais un instantané.',
  'workbench.docs.diagrams.debugMode.reachAria':
    "Le mode standard n'atteint que les fetch et XHR de la page. Un onglet attaché en mode débogage atteint " +
    "aussi les navigations, les workers, les iframes cross-origin et l'environnement de l'onglet.",
  'workbench.docs.diagrams.debugMode.reachTitle': 'Ce que chaque mode peut toucher',
  'workbench.docs.diagrams.debugMode.standardMode': 'Mode standard',
  'workbench.docs.diagrams.debugMode.rowFetch': 'Fetch / XHR de la page',
  'workbench.docs.diagrams.debugMode.rowNavigations': 'Navigations',
  'workbench.docs.diagrams.debugMode.rowWorkers': 'Workers',
  'workbench.docs.diagrams.debugMode.rowIframes': 'Iframes cross-origin',
  'workbench.docs.diagrams.debugMode.rowTabEnv': "Environnement de l'onglet",
  'workbench.docs.diagrams.debugMode.bannerFree': 'sans bannière',
  'workbench.docs.diagrams.debugMode.showsBanner': 'affiche la bannière',
  'workbench.docs.diagrams.debugMode.statesAria':
    "Le point a quatre états : gris éteint, vert attaché et sain, jaune replié sur l'heuristique quand la " +
    "bannière a été fermée, rouge quand un onglet n'a pas pu s'attacher.",
  'workbench.docs.diagrams.debugMode.statesTitle': "Le point en un coup d'œil",
  'workbench.docs.diagrams.debugMode.stateOff': 'Éteint',
  'workbench.docs.diagrams.debugMode.stateOffMsg': 'mode débogage désactivé',
  'workbench.docs.diagrams.debugMode.stateOn': 'Actif · 2 onglets',
  'workbench.docs.diagrams.debugMode.stateOnMsg': 'attaché et sain',
  'workbench.docs.diagrams.debugMode.stateFellBack': 'Replié',
  'workbench.docs.diagrams.debugMode.stateFellBackMsg': 'bannière fermée → heuristique',
  'workbench.docs.diagrams.debugMode.stateFailed': "Échec d'attachement",
  'workbench.docs.diagrams.debugMode.stateFailedMsg': "impossible d'engager le protocole",

  // ── Request Tracking ────────────────────────────────────────────────
  'workbench.docs.diagrams.requestTracking.phasesAria':
    'Les deux phases de chaque connexion — requête et réponse — chacune avec ses champs capturés.',
  'workbench.docs.diagrams.requestTracking.phasesTitle': 'Chaque connexion a deux phases',
  'workbench.docs.diagrams.requestTracking.phaseRequest': 'REQUÊTE',
  'workbench.docs.diagrams.requestTracking.phaseRequestDir': 'Page → Réseau',
  'workbench.docs.diagrams.requestTracking.outbound': 'sortant',
  'workbench.docs.diagrams.requestTracking.capMethod': 'Méthode',
  'workbench.docs.diagrams.requestTracking.capHeaders': 'En-têtes',
  'workbench.docs.diagrams.requestTracking.capBody': 'Corps',
  'workbench.docs.diagrams.requestTracking.phaseResponse': 'RÉPONSE',
  'workbench.docs.diagrams.requestTracking.phaseResponseDir': 'Réseau → Page',
  'workbench.docs.diagrams.requestTracking.inbound': 'entrant',
  'workbench.docs.diagrams.requestTracking.capStatus': 'Code de statut',
  'workbench.docs.diagrams.requestTracking.capTimings': 'Chronologie',
  'workbench.docs.diagrams.requestTracking.perRoundtrip': 'par aller-retour HTTP',
  'workbench.docs.diagrams.requestTracking.capturedKicker': 'CAPTURÉ',
  'workbench.docs.diagrams.requestTracking.sameConnection': 'même connexion',
  'workbench.docs.diagrams.requestTracking.phasesFooter':
    'Les deux phases alimentent le compteur du badge dans Cette page.',
  'workbench.docs.diagrams.requestTracking.seqAria':
    'Diagramme de séquence : requête observée, reconnue, enregistrée, puis lue par le popup',
  'workbench.docs.diagrams.requestTracking.pBrowser': 'Navigateur',
  'workbench.docs.diagrams.requestTracking.pBrowserSub': 'pile réseau',
  'workbench.docs.diagrams.requestTracking.pExtension': 'Extension',
  'workbench.docs.diagrams.requestTracking.pExtensionSub': 'service worker',
  'workbench.docs.diagrams.requestTracking.pPopup': 'Popup',
  'workbench.docs.diagrams.requestTracking.pPopupSub': 'onglet Cette page',
  'workbench.docs.diagrams.requestTracking.msgRequest': 'webRequest (requête)',
  'workbench.docs.diagrams.requestTracking.noteMatch': 'confronter aux règles',
  'workbench.docs.diagrams.requestTracking.noteRecord1': 'enregistrer (règle + URL +',
  'workbench.docs.diagrams.requestTracking.noteRecord2': 'type de ressource)',
  'workbench.docs.diagrams.requestTracking.msgResponse': 'webRequest (réponse)',
  'workbench.docs.diagrams.requestTracking.noteResponse': 'enregistrer la phase réponse',
  'workbench.docs.diagrams.requestTracking.msgOpenPopup': "l'utilisateur ouvre le popup",
  'workbench.docs.diagrams.requestTracking.msgReadBack': 'règles reconnues + badges',
  'workbench.docs.diagrams.requestTracking.seqFooter': "L'enregistrement est en direct ; le popup ne fait que relire.",
  'workbench.docs.diagrams.requestTracking.uiAria':
    'Anatomie UI — le badge replié se déploie en liste des requêtes reconnues',
  'workbench.docs.diagrams.requestTracking.uiTitle': 'Ligne de règle dans le popup',
  'workbench.docs.diagrams.requestTracking.uiRule': 'Block ads.openheaders.com',
  'workbench.docs.diagrams.requestTracking.clickBadge': 'cliquer le badge',
  'workbench.docs.diagrams.requestTracking.matchedPattern': 'reconnu : ads.openheaders.com',
  'workbench.docs.diagrams.requestTracking.legendFields': 'horodatage · URL · type de ressource · motif reconnu',
  'workbench.docs.diagrams.requestTracking.legendBadge': 'compteur du badge = nombre de lignes',

  // ── Resource Types ──────────────────────────────────────────────────
  'workbench.docs.diagrams.resourceTypes.anatomyAria':
    'Anatomie des types de ressources — une maquette de page stylisée avec des rappels vers chaque ' +
    'ResourceType de Chrome : Page, Frame, Script, CSS, Image, Font, Media, Fetch/XHR, WebSocket, Ping, Other.',
  'workbench.docs.diagrams.resourceTypes.anatomyTitle': 'Chaque genre de requête correspond à un ResourceType',
  'workbench.docs.diagrams.resourceTypes.otherExamples': 'favicon, manifest, …',
  'workbench.docs.diagrams.resourceTypes.legendKicker': 'LÉGENDE',
  'workbench.docs.diagrams.resourceTypes.footer': 'Correspondance 1:1 — aucun chevauchement entre les lignes.',

  // ── Limitations ─────────────────────────────────────────────────────
  'workbench.docs.diagrams.limitations.overviewAria':
    "Limitations courantes — DevTools n'affiche pas les en-têtes modifiés ; le moteur de script ne voit " +
    "que fetch/XHR ; Fusionner ne voit que les en-têtes posés par la page ; la correspondance d'en-têtes " +
    'nécessite Chrome 128+.',
  'workbench.docs.diagrams.limitations.gotchasKicker': 'PIÈGES COURANTS',
  'workbench.docs.diagrams.limitations.devtoolsTitle': 'DevTools aveugle',
  'workbench.docs.diagrams.limitations.devtoolsLine1': "L'onglet Network affiche",
  'workbench.docs.diagrams.limitations.devtoolsLine2': "les en-têtes d'origine.",
  'workbench.docs.diagrams.limitations.scriptTitle': 'Portée des scripts',
  'workbench.docs.diagrams.limitations.scriptLine1': 'Seulement fetch / XHR —',
  'workbench.docs.diagrams.limitations.scriptLine2': 'ni nav, ni statique.',
  'workbench.docs.diagrams.limitations.mergeTitle': 'Portée de Fusionner',
  'workbench.docs.diagrams.limitations.mergeLine1': 'Ne voit que les en-têtes',
  'workbench.docs.diagrams.limitations.mergeLine2': 'du code de la page.',
  'workbench.docs.diagrams.limitations.chromeTitle': 'Chrome 128+',
  'workbench.docs.diagrams.limitations.chromeLine1': "Correspondance d'en-têtes",
  'workbench.docs.diagrams.limitations.chromeLine2': 'ignorée par les anciens.',
  'workbench.docs.diagrams.limitations.seeCallout': "Voir l'encadré ci-dessous.",
  'workbench.docs.diagrams.limitations.footer': 'Chaque piège est aussi signalé dans la section concernée.',

  // ── How rules execute ───────────────────────────────────────────────
  'workbench.docs.diagrams.execution.stackAria':
    'Où chaque moteur intercepte le flux de requêtes — JS passe par Script puis DNR ; statique et ' +
    'navigation sautent Script',
  'workbench.docs.diagrams.execution.stackTitle': 'Où chaque moteur intercepte',
  'workbench.docs.diagrams.execution.stackJsLane': 'Initiées par JS',
  'workbench.docs.diagrams.execution.stackStaticLane': 'Statique / navigation',
  'workbench.docs.diagrams.execution.stackPageJs': 'JS de page',
  'workbench.docs.diagrams.execution.stackPageJsSub': 'fetch / XHR',
  'workbench.docs.diagrams.execution.stackBrowser': 'Navigateur',
  'workbench.docs.diagrams.execution.stackBrowserSub': '<img>, nav, etc.',
  'workbench.docs.diagrams.execution.stackScriptEngine': 'Moteur Script',
  'workbench.docs.diagrams.execution.stackScriptEngineSub': 'monkey-patch',
  'workbench.docs.diagrams.execution.stackBypasses1': 'contourne le',
  'workbench.docs.diagrams.execution.stackBypasses2': 'moteur Script',
  'workbench.docs.diagrams.execution.stackDnrEngine': 'Moteur DNR',
  'workbench.docs.diagrams.execution.stackDnrEngineSub': 'réseau Chrome — attrape tout',
  'workbench.docs.diagrams.execution.stackNetwork': 'Réseau',
  'workbench.docs.diagrams.execution.stackFooter': 'DNR est large ; Script est étroit mais lit les corps de réponse.',
  'workbench.docs.diagrams.execution.dnrAria':
    'La large portée de DNR — chaque type de ressource chargé par le navigateur est intercepté',
  'workbench.docs.diagrams.execution.dnrTitle': 'DNR attrape chaque type de requête',
  'workbench.docs.diagrams.execution.dnrItemNav': 'navigation de page',
  'workbench.docs.diagrams.execution.dnrItemSubFrame': 'sous-frame',
  'workbench.docs.diagrams.execution.dnrItemFetch': 'fetch / XHR',
  'workbench.docs.diagrams.execution.dnrItemScripts': 'scripts',
  'workbench.docs.diagrams.execution.dnrItemStylesheets': 'feuilles de style',
  'workbench.docs.diagrams.execution.dnrItemImages': 'images',
  'workbench.docs.diagrams.execution.dnrItemFonts': 'polices',
  'workbench.docs.diagrams.execution.dnrItemMedia': 'médias',
  'workbench.docs.diagrams.execution.dnrItemWebsocket': 'websocket',
  'workbench.docs.diagrams.execution.dnrItemPing': 'ping / beacon',
  'workbench.docs.diagrams.execution.dnrFooter': 'chaque type de ressource que le navigateur charge',
  'workbench.docs.diagrams.execution.reachAria': "Portée du moteur Script — ce qu'il attrape et ce qui le contourne",
  'workbench.docs.diagrams.execution.reachTitle': 'Ce que le moteur Script voit vraiment',
  'workbench.docs.diagrams.execution.reachCaught': '✓ attrapé',
  'workbench.docs.diagrams.execution.reachCaughtSub': 'le moteur voit ceci',
  'workbench.docs.diagrams.execution.reachFetch': 'fetch()',
  'workbench.docs.diagrams.execution.reachXhr': 'XMLHttpRequest',
  'workbench.docs.diagrams.execution.reachSwFetch': 'SW fetch',
  'workbench.docs.diagrams.execution.reachInScope': '(dans le périmètre)',
  'workbench.docs.diagrams.execution.reachMissed': '✗ manqué',
  'workbench.docs.diagrams.execution.reachMissedSub': 'contourné entièrement',
  'workbench.docs.diagrams.execution.reachImgSrc': '<img src>',
  'workbench.docs.diagrams.execution.reachScriptSrc': '<script src>',
  'workbench.docs.diagrams.execution.reachPageNav': 'navigation de page',
  'workbench.docs.diagrams.execution.reachBrowserInternal': 'interne au navigateur',
  'workbench.docs.diagrams.execution.reachFaviconEtc': '(favicon, etc.)',

  // ── Direct vs Indirect ──────────────────────────────────────────────
  'workbench.docs.diagrams.directVsIndirect.aria':
    'Correspondances directes vs indirectes — même règle, deux contextes de page',
  'workbench.docs.diagrams.directVsIndirect.ruleLabel': 'Règle',
  'workbench.docs.diagrams.directVsIndirect.ruleBanner': 'Request Domains: openheaders.com',
  'workbench.docs.diagrams.directVsIndirect.directTitle': 'Directe',
  'workbench.docs.diagrams.directVsIndirect.directSub': "l'URL de la page correspond",
  'workbench.docs.diagrams.directVsIndirect.pageLabel': 'page',
  'workbench.docs.diagrams.directVsIndirect.directCaption1': 'Page + sous-ressources',
  'workbench.docs.diagrams.directVsIndirect.directCaption2': 'du même hôte suivies',
  'workbench.docs.diagrams.directVsIndirect.badgePrefix': 'badge :',
  'workbench.docs.diagrams.directVsIndirect.badgeDirect': 'direct',
  'workbench.docs.diagrams.directVsIndirect.badgeIndirect': 'indirect',
  'workbench.docs.diagrams.directVsIndirect.indirectTitle': 'Indirecte',
  'workbench.docs.diagrams.directVsIndirect.indirectSub': 'seule une sous-ressource correspond',
  'workbench.docs.diagrams.directVsIndirect.indirectCaption1': 'Seule la sous-ressource',
  'workbench.docs.diagrams.directVsIndirect.indirectCaption2': 'correspondante est suivie',
  'workbench.docs.diagrams.directVsIndirect.legendMatches': 'correspond à la règle',
  'workbench.docs.diagrams.directVsIndirect.legendNoMatch': 'ne correspond pas',

  // ── Response Body + Status (Mock) ───────────────────────────────────
  'workbench.docs.diagrams.mock.flowAria':
    "Statique saute entièrement le réseau ; Dynamique le touche d'abord puis transforme la vraie réponse.",
  'workbench.docs.diagrams.mock.flowStatic': 'Statique',
  'workbench.docs.diagrams.mock.flowDynamic': 'Dynamique',
  'workbench.docs.diagrams.mock.flowIntercept': 'Interception',
  'workbench.docs.diagrams.mock.flowNeverHit1': '(vrai réseau',
  'workbench.docs.diagrams.mock.flowNeverHit2': 'jamais touché)',
  'workbench.docs.diagrams.mock.flowRealNetwork': 'vrai réseau',
  'workbench.docs.diagrams.mock.flowRealNetworkSub': 'vraie réponse',
  'workbench.docs.diagrams.mock.flowSynthetic': 'corps synthétique',
  'workbench.docs.diagrams.mock.flowFnResponse': 'fn(response)',
  'workbench.docs.diagrams.mock.flowPageReceives': 'la page reçoit',
  'workbench.docs.diagrams.mock.staticRule': 'Static response: 200 { "users": [] }',
  'workbench.docs.diagrams.mock.staticBeforeKicker': 'VRAI RÉSEAU',
  'workbench.docs.diagrams.mock.staticNever1': '(jamais atteint)',
  'workbench.docs.diagrams.mock.staticNever2': '— requête court-circuitée',
  'workbench.docs.diagrams.mock.pageReceivesKicker': 'LA PAGE REÇOIT',
  'workbench.docs.diagrams.mock.staticAfterLine1': '200 OK · Content-Type: application/json',
  'workbench.docs.diagrams.mock.staticAfterBody': '{ "users": [] }',
  'workbench.docs.diagrams.mock.staticArrow': 'réponse synthétique servie',
  'workbench.docs.diagrams.mock.staticStamp': "Corps + statut + en-têtes fixes — le serveur n'est jamais contacté.",
  'workbench.docs.diagrams.mock.dynamicRule': 'Dynamic response: masquer les champs PII',
  'workbench.docs.diagrams.mock.dynamicBeforeKicker': 'VRAIE RÉPONSE',
  'workbench.docs.diagrams.mock.dynBodyOpen': '{ "user":',
  'workbench.docs.diagrams.mock.dynBodyEmail': '  { "email": "alice@openheaders.com" } }',
  'workbench.docs.diagrams.mock.dynAfterPrefix': '  { "email": ',
  'workbench.docs.diagrams.mock.dynRedacted': '"[masqué]"',
  'workbench.docs.diagrams.mock.dynamicArrow': 'fn(real response) →',
  'workbench.docs.diagrams.mock.dynamicStamp': 'Le vrai appel a bien lieu ; votre fonction réécrit le corps.',
  'workbench.docs.diagrams.mock.wontAria':
    "Les mocks n'interceptent que les fetch / XHR initiés par JS — les ressources statiques passent sans " +
    'changement. Utilisez un vrai proxy local pour les fixtures de sous-ressources.',
  'workbench.docs.diagrams.mock.wontStatic': 'Ressources statiques (img, script, link)',
  'workbench.docs.diagrams.mock.wontStaticSub': 'Émises par le navigateur — jamais via fetch / XHR.',
  'workbench.docs.diagrams.mock.wontNav': 'Navigations de page',
  'workbench.docs.diagrams.mock.wontNavSub': 'Le HTML de premier niveau contourne le moteur Script.',
  'workbench.docs.diagrams.mock.suggestionText': 'Vrai proxy local pour les fixtures de sous-ressources.',
  'workbench.docs.diagrams.mock.useCasesAria':
    "Corps + statut de réponse — cas d'usage courants : dev hors ligne, simulation d'erreurs, masquage " +
    'PII, formes de payload limites.',
  'workbench.docs.diagrams.mock.caseOffline': 'Dev hors ligne',
  'workbench.docs.diagrams.mock.caseOfflineEx': "Simuler toute l'API",
  'workbench.docs.diagrams.mock.caseError': 'Simuler des erreurs',
  'workbench.docs.diagrams.mock.caseErrorEx': 'Forcer un 500 sur une route',
  'workbench.docs.diagrams.mock.casePii': 'Masquage PII',
  'workbench.docs.diagrams.mock.casePiiEx': 'Masquer les e-mails au vol',
  'workbench.docs.diagrams.mock.caseEdge': 'Cas limites',
  'workbench.docs.diagrams.mock.caseEdgeEx': 'Tableaux vides, gros payloads',
  'workbench.docs.diagrams.mock.useCasesFooter': 'Statique = mode fixture · Dynamique = passage réel + édition.',

  // ── Keyboard Shortcuts ──────────────────────────────────────────────
  'workbench.docs.diagrams.keyboardShortcuts.aria':
    'Régions de focus du workbench — barre latérale gauche, éditeur, barre latérale droite et panneau ' +
    'inférieur — chacune étiquetée avec sa combinaison de focus.',
  'workbench.docs.diagrams.keyboardShortcuts.title': 'Les combinaisons de focus mènent à une des quatre régions',
  'workbench.docs.diagrams.keyboardShortcuts.windowTitle': 'Open Headers — Workbench',
  'workbench.docs.diagrams.keyboardShortcuts.leftSidebar': 'Barre gauche',
  'workbench.docs.diagrams.keyboardShortcuts.editor': 'Éditeur',
  'workbench.docs.diagrams.keyboardShortcuts.rightSidebar': 'Barre droite',
  'workbench.docs.diagrams.keyboardShortcuts.bottomPanel': 'Panneau inférieur',
  'workbench.docs.diagrams.keyboardShortcuts.footer': 'Réassignez chaque combinaison dans Paramètres → Clavier.',

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
