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
    'pas un vrai sous-domaine — pas de point avant « openheaders.io »',
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
  'workbench.docs.diagrams.conditions.initiatorDomains.ruleBanner': 'Domaines initiateurs : portal.openheaders.io',
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
  'workbench.docs.diagrams.conditions.urlPattern.footerExample': 'Domaines de requête : openheaders.io',

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
} as const satisfies Catalog;
