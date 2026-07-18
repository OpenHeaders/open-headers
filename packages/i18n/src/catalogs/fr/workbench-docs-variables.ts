/**
 * Workbench Docs panel — the Variables section body — French. Mirrors
 * `catalogs/en/workbench-docs-variables.ts` key for key. `{{ns.NAME}}`
 * reference tokens ride raw as code chips composed by the section
 * body; `Vault` / `Live` / `Live Workflow` stay raw as product and
 * scope names; the `string` / `TOTP` vault kinds ride raw. Sidebar
 * entry names referenced in prose mint the sidebar translations
 * (`Variables d'espace de travail`, `Variables Live`,
 * `Environnements`, `Variables`) — `workbench-chrome-sidebar.ts` must
 * reuse them verbatim.
 */

import type { Catalog } from '../../types';

export const workbenchDocsVariables = {
  // ── Concepts: Variables ─────────────────────────────────────────────
  'workbench.docs.body.variables.intro1Prefix':
    "Tout champ acceptant un modèle — une valeur d'en-tête, une URL de redirection, un corps de requête, une " +
    'étape de workflow — peut référencer une variable avec',
  'workbench.docs.body.variables.intro1Suffix':
    ". La valeur est substituée au moment de l'usage, donc une seule définition alimente chaque règle, requête " +
    'et workflow qui la mentionne. Les variables vivent dans cinq portées, chacune avec son propre foyer dans ' +
    "l'application et son propre rang quand le même nom existe dans plusieurs.",
  'workbench.docs.body.variables.ladderCaptionPrefix': 'Une référence nue',
  'workbench.docs.body.variables.ladderCaptionSuffix':
    "parcourt quatre portées de haut en bas et s'arrête à la première correspondance. Live et les autres " +
    'portées à espace de noms restent hors du parcours.',
  'workbench.docs.body.variables.scopesHeading': 'Les cinq portées',
  'workbench.docs.body.variables.vaultHeading': 'Vault — secrets, sur cet appareil uniquement',
  'workbench.docs.body.variables.vault1Prefix':
    "Le vault contient les secrets propres à l'appareil : clés d'API, mots de passe, graines TOTP. Les entrées " +
    "du vault ne se synchronisent jamais et ne quittent jamais l'appareil — elles restent hors des exports " +
    "d'espace de travail et de l'historique git. Il en existe deux sortes : les entrées",
  'workbench.docs.body.variables.vaultKindString': 'string',
  'workbench.docs.body.variables.vault1Middle': 'se résolvent telles quelles, et les entrées',
  'workbench.docs.body.variables.vaultKindTotp': 'TOTP',
  'workbench.docs.body.variables.vault1Suffix':
    'se résolvent en le code courant à 6–8 chiffres calculé à partir de la graine stockée — la graine ' +
    "elle-même n'est jamais exposée via un modèle. Le vault a le rang le plus élevé, donc un secret du vault " +
    'gagne toujours une référence nue.',
  'workbench.docs.body.variables.vaultCaptionPrefix': 'Référencez le secret avec',
  'workbench.docs.body.variables.vaultCaptionSuffix':
    'depuis les entités synchronisées — ne collez jamais la valeur brute.',
  'workbench.docs.body.variables.environmentHeading': 'Environnement — jeux de valeurs commutables',
  'workbench.docs.body.variables.environment1Prefix':
    "Les environnements sont des ensembles nommés de variables que vous permutez d'un bloc —",
  'workbench.docs.body.variables.environment1Suffix':
    ", la configuration locale d'un coéquipier. L'environnement actif se choisit dans le sélecteur d'en-tête ; " +
    "un nom que l'environnement actif ne définit pas retombe sur l'environnement par défaut avant que le " +
    'parcours continue vers le bas. Fonctionner sans environnement sélectionné est un état valide — la ' +
    'résolution saute simplement la portée. Les lignes peuvent être marquées secrètes pour que leurs valeurs ' +
    "s'affichent masquées dans l'éditeur.",
  'workbench.docs.body.variables.environmentCaption':
    "Un même nom, une valeur par stade — changez d'environnement au lieu de dupliquer les règles.",
  'workbench.docs.body.variables.collectionHeading': 'Collection — limitée à une collection',
  'workbench.docs.body.variables.collection1':
    'Les variables de collection sont définies sur une collection et ne se résolvent que pour les règles et ' +
    "requêtes qui lui appartiennent. C'est le bon foyer pour les valeurs vraies pour une API mais pas pour " +
    "tout l'espace de travail — une URL de base, un id de tenant, un préfixe de version.",
  'workbench.docs.body.variables.collectionCaption':
    "Les variables de collection ne se résolvent qu'à l'intérieur de leur propre collection — ailleurs, le " +
    'parcours passe outre.',
  'workbench.docs.body.variables.workspaceHeading': 'Espace de travail — partagé avec tout le monde',
  'workbench.docs.body.variables.workspace1':
    "Les variables d'espace de travail sont les globales de l'espace de travail — visibles de chaque règle, " +
    "requête et workflow, et synchronisées avec l'espace de travail. Elles ont le rang le plus bas, ce qui en " +
    'fait la couche de base naturelle : mettez-y la valeur commune et laissez un environnement ou une ' +
    "collection la substituer là où c'est nécessaire.",
  'workbench.docs.body.variables.workspaceCaption':
    'La couche de base — pour les valeurs vraies partout. Pas pour les secrets, pas pour les valeurs par stade.',
  'workbench.docs.body.variables.liveHeading': 'Live — publiée par une exécution de workflow',
  'workbench.docs.body.variables.live1Prefix':
    'Une variable live est adossée à un Live Workflow — une chaîne de requêtes qui se connecte, récupère un ' +
    "jeton et expose une valeur capturée. Enregistrer le workflow l'active ; une exécution réussie (manuelle " +
    "ou planifiée) publie la valeur exposée, et l'actualisation automatique relance le workflow pour la garder " +
    'fraîche. Les valeurs live ne sont accessibles que via',
  'workbench.docs.body.variables.live1Suffix':
    "— jamais par une référence nue — pour qu'un modèle de règle ne puisse pas ramasser en silence une valeur " +
    "en cours d'actualisation quand une variable d'espace de travail ou d'environnement porte le même nom. " +
    "Modifier la recette du workflow marque la valeur publiée comme périmée jusqu'à la prochaine exécution.",
  'workbench.docs.body.variables.liveRefCaptionPrefix': 'Toujours le préfixe —',
  'workbench.docs.body.variables.liveRefCaptionSuffix': '— et toujours adossée à un workflow, jamais un jeton collé.',
  'workbench.docs.body.variables.liveLifecycleCaptionPrefix':
    "L'exécution réussit → la capture exposée est publiée comme",
  'workbench.docs.body.variables.liveLifecycleCaptionSuffix':
    '→ les règles et requêtes la consomment. La planification relance le workflow.',
  'workbench.docs.body.variables.priorityHeading': 'Priorité et occultation',
  'workbench.docs.body.variables.priority1Prefix': 'Une référence nue',
  'workbench.docs.body.variables.priority1Suffix':
    "se résout à travers les quatre portées réelles dans un ordre strict — le vault, puis l'environnement " +
    "actif (avec repli sur l'environnement par défaut), puis la collection, puis l'espace de travail — et " +
    "s'arrête à la première portée qui définit le nom. Les définitions plus basses existent toujours ; elles " +
    'sont simplement occultées.',
  'workbench.docs.body.variables.shadowingCaptionPrefix':
    "L'environnement bat l'espace de travail pour la référence nue ;",
  'workbench.docs.body.variables.shadowingCaptionSuffix': 'lit quand même la valeur occultée.',
  'workbench.docs.body.variables.namespacePin1Prefix':
    "Chaque portée a aussi un espace de noms qui y épingle la résolution, en sautant entièrement l'échelle :",
  'workbench.docs.body.variables.namespacePin1Suffix':
    '. Utilisez la forme nue pour le cas normal, et la forme à espace de noms quand vous visez une portée ' +
    'précise, indépendamment de ce qui est défini au-dessus.',
  'workbench.docs.body.variables.tipTitle': 'Gardez les secrets dans le vault',
  'workbench.docs.body.variables.tip1Prefix':
    "Les règles, requêtes et workflows se synchronisent avec l'espace de travail — pas le vault. Référencez",
  'workbench.docs.body.variables.tip1Suffix':
    'depuis une entité synchronisée : chaque coéquipier fournit sa propre valeur localement, et rien de ' +
    "sensible n'atterrit jamais dans les données partagées.",
  'workbench.docs.body.variables.rulesHeading': 'Les variables dans les règles',
  'workbench.docs.body.variables.rules1':
    'Presque chaque chaîne portée par une règle accepte un modèle : valeurs de condition (domaines, motifs ' +
    "d'URL, noms d'en-tête), valeurs d'en-tête, URL de redirection, noms et valeurs de paramètres de requête, " +
    'corps statiques de requête et de réponse, code injecté, charges utiles WS / SSE et identifiants ' +
    "Basic-auth. L'éditeur de règle met chaque référence en évidence, montre la valeur résolue au survol et " +
    'signale par un bandeau toute référence qui ne se résout pas — une règle non résolue ne peut pas prendre ' +
    "effet tant que chaque référence n'a pas de valeur.",
  'workbench.docs.body.variables.consumersCaption':
    "Une seule valeur à modèle alimente les trois surfaces consommatrices — substituée là où chacune s'applique.",
  'workbench.docs.body.variables.dynamicNoteTitle': 'Les corps dynamiques (JS) ne sont pas des modèles',
  'workbench.docs.body.variables.dynamicNote1Prefix': 'Les règles de corps de requête et de réponse en mode',
  'workbench.docs.body.variables.dynamicWord': 'dynamique',
  'workbench.docs.body.variables.dynamicNote1Middle':
    'exécutent votre JavaScript au lieu de substituer des modèles — le code calcule ses valeurs lui-même. ' +
    'Seuls les corps',
  'workbench.docs.body.variables.staticWord': 'statiques',
  'workbench.docs.body.variables.dynamicNote1Middle2': 'voient leurs références',
  'workbench.docs.body.variables.dynamicNote1Suffix': 'substituées.',
  'workbench.docs.body.variables.requestsHeading': 'Les variables dans les requêtes',
  'workbench.docs.body.variables.requests1Prefix':
    "Dans le client API, l'URL, les paramètres de requête, les en-têtes, les champs d'authentification et le " +
    "corps se résolvent tous au moment de l'envoi — y compris les variables de collection de la collection où " +
    "vit la requête. Une référence qui ne peut pas être résolue bloque l'envoi avec une erreur nommant la " +
    'variable manquante, plutôt que de mettre un',
  'workbench.docs.body.variables.requests1Suffix': 'littéral sur le fil.',
  'workbench.docs.body.variables.workflowsHeading': 'Les variables dans les workflows',
  'workbench.docs.body.variables.workflows1Prefix':
    'Chaque étape de Live Workflow se résout comme une requête, plus une portée supplémentaire :',
  'workbench.docs.body.variables.workflows1Suffix':
    "référence une valeur capturée par une étape antérieure de la même exécution — connectez-vous à l'étape 1, " +
    "dépensez le jeton de session à l'étape 2. Les références d'étape n'existent que pendant l'exécution de la " +
    'chaîne ; les captures marquées comme exposées sont ce qui est publié comme variables live quand ' +
    "l'exécution réussit.",
  'workbench.docs.body.variables.namespacesHeading': 'Assistants à espace de noms uniquement',
  'workbench.docs.body.variables.helpers1':
    'Trois espaces de noms supplémentaires résolvent des valeurs qui ne sont pas du tout des variables stockées.',
  'workbench.docs.body.variables.helpersDynamicMiddle': 'exécute un générateur intégré —',
  'workbench.docs.body.variables.helpersFriends':
    ', et consorts — produisant une valeur fraîche à chaque résolution : par envoi dans le client API, par ' +
    "compilation pour les règles statiques (la valeur est figée jusqu'à la prochaine recompilation).",
  'workbench.docs.body.variables.helpersFileMiddle': 'référence un fichier stocké par son nom. Et',
  'workbench.docs.body.variables.helpersStepSuffix':
    ", vu plus haut, n'a de sens qu'à l'intérieur d'une chaîne de workflow en cours d'exécution. Aucun d'eux " +
    'ne participe au parcours nu — ils ne sont accessibles que par leur préfixe.',
  'workbench.docs.body.variables.inspectingHeading': 'Créer et inspecter',
  'workbench.docs.body.variables.create1Prefix': 'Chaque portée se crée depuis la barre latérale :',
  'workbench.docs.body.variables.sidebarVault': 'Vault',
  'workbench.docs.body.variables.sidebarWorkspaceVars': "Variables d'espace de travail",
  'workbench.docs.body.variables.createAnd': ', et',
  'workbench.docs.body.variables.sidebarLiveVars': 'Variables Live',
  'workbench.docs.body.variables.create1Middle':
    "sont des entrées de premier niveau ; les environnements s'ajoutent sous",
  'workbench.docs.body.variables.sidebarEnvironments': 'Environnements',
  'workbench.docs.body.variables.create1Middle2': ' ; et chaque collection porte sa propre page',
  'workbench.docs.body.variables.sidebarVariables': 'Variables',
  'workbench.docs.body.variables.create1Suffix': 'dédiée.',
  'workbench.docs.body.variables.creationMapCaption':
    "Chaque foyer de variables dans la barre latérale, annoté de l'espace de noms qu'il alimente.",
  'workbench.docs.body.variables.inspect1Prefix': "La fenêtre d'outil",
  'workbench.docs.body.variables.inspect1Middle': "est la surface d'inspection.",
  'workbench.docs.body.variables.inScopeLabel': 'Dans la portée',
  'workbench.docs.body.variables.inspect1Middle2':
    'liste les variables que la règle, la requête ou le modèle en focus référence réellement — chacune ' +
    "résolue à travers l'échelle complète, pour voir la valeur exacte qui s'appliquera.",
  'workbench.docs.body.variables.allScopesLabel': 'Toutes les portées',
  'workbench.docs.body.variables.inspect1Middle3':
    "liste tout ce qui est défini où que ce soit, groupé par priorité. Dans n'importe quel champ à modèle, taper",
  'workbench.docs.body.variables.inspect1Suffix':
    'ouvre la liste de suggestions avec chaque nom résoluble, et survoler une référence montre sa valeur ' +
    'résolue et la portée gagnante.',
} as const satisfies Catalog;
