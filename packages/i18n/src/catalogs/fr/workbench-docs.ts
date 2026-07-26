/**
 * Workbench Docs panel — anchor registry bodies — French. Mirrors
 * `catalogs/en/workbench-docs.ts` key for key. Raw by design inside
 * keyed prose: wire/API tokens (declarativeNetRequest, webRequest,
 * ResourceType, queryTransform, block, main_frame, firstParty /
 * thirdParty, Equals / Contains, operationName / query / key / value,
 * chrome.storage(.local), fetch() / XMLHttpRequest, @font-face,
 * Set-Cookie, Accept, User-Agent, Content-Type, CORS,
 * ERR_BLOCKED_BY_CLIENT, RE2, stdio, HTTP/SSE, git log / git blame),
 * ResourceType enum labels (Page, Frame, Fetch/XHR, Script, …), the
 * S55 whole-raw one-letter fragment `'A'` (copied verbatim, sentence
 * reshaped around it), and DNR / AND / DOM / CA / PII / YAML / CDN /
 * MCP loanwords. Quoted UI labels copy their fr mints: rule-op
 * vocabulary (Ajouter / Remplacer, Ajouter à la suite, Retirer,
 * Fusionner, Remplacer uniquement, Tout retirer), condition names and
 * Excl. variants (fr/workbench-editors-rule), inject timing labels
 * (`Dès que possible`, `Après le chargement de la page`), popup tab
 * « Cette page », nav titles (fr/workbench-chrome). Override =
 * `Substituer`; en's `30,000 ms` / `5,000 ms` figures take fr
 * grouping (`30 000 ms`).
 */

import type { Catalog } from '../../types';

export const workbenchDocs = {
  // ── Concepts: Execution (DNR vs Script) ─────────────────────────────
  'workbench.docs.body.execution.intro':
    "Les règles s'exécutent via l'un de deux moteurs selon ce qu'elles font. Savoir quel chemin une règle " +
    "emprunte explique où elle s'applique — et où elle ne le peut pas.",
  'workbench.docs.body.execution.stackCaption':
    'Les requêtes initiées par JS passent par Script puis DNR. Le trafic statique et de navigation ' +
    'contourne entièrement Script.',
  'workbench.docs.body.execution.dnrHeading': 'Natif, rapide, large portée',
  'workbench.docs.body.execution.dnr1Prefix':
    "Les règles d'en-tête (Ajouter / Remplacer, Ajouter à la suite, Retirer), de blocage, de redirection et " +
    'de paramètre de requête se compilent en entrées',
  'workbench.docs.body.execution.dnr1Suffix':
    "que Chrome applique au niveau de la couche réseau, avant qu'aucune requête ne quitte le navigateur.",
  'workbench.docs.body.execution.dnr2':
    'La portée est large : pages, sous-cadres, scripts, images, polices, fetch, XHR — chaque requête que le ' +
    'navigateur émet pour le compte de la page.',
  'workbench.docs.body.execution.dnrCaption':
    'Une seule liste encadrée — la portée de DNR est essentiellement universelle.',
  'workbench.docs.body.execution.scriptHeading': 'Contexte JS, portée étroite',
  'workbench.docs.body.execution.script1Prefix':
    "Les règles d'injection, de délai, de corps de requête, de réponse API et de fusion d'en-têtes opèrent " +
    'par monkey-patch de',
  'workbench.docs.body.execution.script1And': 'et',
  'workbench.docs.body.execution.script1Suffix':
    "depuis l'intérieur de la page. Elles peuvent transformer le trafic initié par JavaScript de manières " +
    'que DNR ne peut pas exprimer — y compris lire et réécrire les corps de réponse, auxquels DNR ' +
    "n'a aucun accès.",
  'workbench.docs.body.execution.scriptCaption':
    'Deux colonnes — ce que le moteur de script intercepte réellement, et ce qui passe sans changement.',
  'workbench.docs.body.execution.limitPrefix': 'Les ressources statiques (',
  'workbench.docs.body.execution.limitSuffix':
    '), les navigations de page et les requêtes internes du navigateur contournent entièrement ce moteur. ' +
    'Utilisez une règle basée sur DNR pour celles-ci.',

  // ── Concepts: Limitations ───────────────────────────────────────────
  'workbench.docs.body.limitations.intro':
    'Référence rapide des comportements qui surprennent. Chaque élément est aussi signalé en ligne dans la ' +
    "section qu'il affecte.",
  'workbench.docs.body.limitations.overviewCaption':
    "Quatre pièges courants d'un coup d'œil — chaque encadré ci-dessous a les détails.",
  'workbench.docs.body.limitations.devtoolsTitle': "Les en-têtes modifiés n'apparaissent pas dans DevTools",
  'workbench.docs.body.limitations.devtoolsBody':
    "Les actions d'en-tête sont appliquées correctement, mais l'onglet Network de Chrome affiche toujours " +
    "les en-têtes d'origine du serveur.",
  'workbench.docs.body.limitations.scriptTitle': 'Règles à base de scripts — portée étroite',
  'workbench.docs.body.limitations.scriptPrefix':
    "Injection, Délai, Corps, Mock et Fusion d'en-têtes n'interceptent que",
  'workbench.docs.body.limitations.scriptAnd': 'et',
  'workbench.docs.body.limitations.scriptMiddle':
    '. Les ressources statiques et les navigations de page les contournent. Voir',
  'workbench.docs.body.limitations.executionRef': "Comment les règles s'exécutent",
  'workbench.docs.body.limitations.scriptSuffix': '.',
  'workbench.docs.body.limitations.mergeTitle': 'Fusionner ne peut pas lire les en-têtes par défaut du navigateur',
  'workbench.docs.body.limitations.mergeBody':
    "L'opération Fusionner ne voit que les en-têtes explicitement définis par le code de la page — Accept, " +
    'User-Agent et les autres en-têtes par défaut du navigateur lui sont invisibles.',
  'workbench.docs.body.limitations.chromeTitle': "La correspondance d'en-têtes nécessite Chrome 128+",
  'workbench.docs.body.limitations.chromeBody':
    "Les conditions qui portent sur les valeurs d'en-têtes de requête / réponse nécessitent Chrome 128 ou " +
    'plus récent. Les navigateurs plus anciens ignorent la condition en silence.',

  // ── Concepts: Multi-tab Behavior ────────────────────────────────────
  'workbench.docs.body.multiTab.intro1Prefix':
    "Plusieurs onglets d'espace de travail ouverts à la fois est un état de premier ordre. Les données " +
    'persistées se synchronisent via',
  'workbench.docs.body.multiTab.intro1Suffix':
    ", l'état de disposition reste par onglet, et les intentions de navigation réutilisent les onglets " +
    "existants de la même fenêtre avant d'en ouvrir de nouveaux.",
  'workbench.docs.body.multiTab.syncCaption':
    "L'onglet A enregistre, le SW diffuse, l'onglet B se réhydrate. L'état de disposition reste dans " +
    'chaque onglet.',
  'workbench.docs.body.multiTab.navHeading': 'La navigation réutilise les onglets existants',
  'workbench.docs.body.multiTab.nav1':
    "Même fenêtre d'abord : si un onglet d'espace de travail est déjà ouvert dans la fenêtre d'où vous " +
    "cliquez, il s'active et reçoit l'intention (section de docs à atteindre, règle à modifier). Fenêtre " +
    "différente : un nouvel onglet s'ouvre dans votre fenêtre actuelle plutôt que de tirer le focus à " +
    "travers les fenêtres de Chrome — à l'image des DevTools de Chrome eux-mêmes, avec un panneau par " +
    'fenêtre.',
  'workbench.docs.body.multiTab.navCaption':
    "Le chemin chaud active l'onglet de la même fenêtre ; le chemin froid ouvre un nouvel onglet dans la " +
    "fenêtre de l'appelant.",
  'workbench.docs.body.multiTab.numberingHeading': 'Numérotation des onglets',
  'workbench.docs.body.multiTab.numbering1Prefix':
    "Avec deux onglets d'espace de travail ou plus, le titre de chaque onglet est préfixé de son ordinal —",
  'workbench.docs.body.multiTab.numbering1Suffix': '. Quand le compte retombe à un, le survivant perd son préfixe.',
  'workbench.docs.body.multiTab.numbering2Prefix': "Les ordinaux sont stables pendant la vie d'un onglet : fermer",
  'workbench.docs.body.multiTab.numbering2While': 'pendant que',
  'workbench.docs.body.multiTab.numbering2And': 'et',
  'workbench.docs.body.multiTab.numbering2Middle':
    'restent ne renumérote pas les survivants. Le prochain onglet ouvert reçoit',
  'workbench.docs.body.multiTab.numbering2Middle2': ' ; la numérotation ne revient à',
  'workbench.docs.body.multiTab.numbering2Suffix': "qu'après la fermeture de chaque onglet d'espace de travail.",
  'workbench.docs.body.multiTab.numberingCaption':
    'Les survivants gardent leurs numéros à travers les fermetures ; le prochain onglet est toujours max + 1.',
  'workbench.docs.body.multiTab.syncsHeading': 'Ce qui se synchronise, ce qui ne se synchronise pas',
  'workbench.docs.body.multiTab.syncs1Prefix':
    'Chaque entité persistée — règles, collections, dossiers, environnements, variables ' +
    "d'espace de travail, vault, requêtes, modèles — vit dans",
  'workbench.docs.body.multiTab.syncs1Suffix':
    "comme source de vérité unique. Les enregistrements de l'onglet A diffusent via l'arrière-plan et " +
    "l'onglet B se réhydrate. Les changements d'espace de travail et d'environnement se propagent de la " +
    'même façon.',
  'workbench.docs.body.multiTab.syncedCaption':
    'Un seul chrome.storage partagé ; les deux onglets lisent et écrivent les mêmes données persistées.',
  'workbench.docs.body.multiTab.localCaption':
    'Les glissements de disposition et la saisie non enregistrée vivent dans chaque onglet — ' +
    "l'autre onglet ne les voit jamais.",
  'workbench.docs.body.multiTab.layoutTitle': 'La disposition ne se synchronise pas en direct',
  'workbench.docs.body.multiTab.layout1Prefix':
    "Les ratios de volets et l'état d'ancrage des fenêtres d'outils sont par espace de travail, mais les " +
    "changements ne se propagent pas aux onglets déjà ouverts. Glisser un séparateur dans l'onglet A laisse " +
    "l'onglet B intact jusqu'au rechargement — une synchronisation de disposition en direct serait " +
    'déroutante pendant la saisie. Un onglet ouvert',
  'workbench.docs.body.multiTab.layoutAfter': 'après',
  'workbench.docs.body.multiTab.layout1Suffix': 'le glissement hérite de la nouvelle disposition.',
  'workbench.docs.body.multiTab.draftsTitle': "Les brouillons non enregistrés sont locaux à l'onglet",
  'workbench.docs.body.multiTab.drafts1':
    "Les brouillons d'éditeur vivent dans la mémoire de leur propre onglet. Si l'onglet A enregistre la " +
    "même règle que l'onglet B est en train de modifier, l'onglet A gagne l'écriture en stockage — il n'y " +
    "a pas aujourd'hui d'invite inter-onglets « modifié, recharger ? ». Ne compte que lorsque deux onglets " +
    'modifient la même entité simultanément.',

  // ── Concepts: Request Tracking ──────────────────────────────────────
  'workbench.docs.body.requestTracking.intro1Prefix': "L'onglet",
  'workbench.docs.body.requestTracking.thisPage': 'Cette page',
  'workbench.docs.body.requestTracking.intro1Suffix':
    'du popup montre quelles règles sont actives pour la page actuelle et quelles requêtes elles ont fait ' +
    'correspondre. Le suivi couvre les phases requête et réponse de chaque connexion établie par la page.',
  'workbench.docs.body.requestTracking.phasesCaption':
    'Une même connexion a deux phases — les deux contribuent au compte de la pastille.',
  'workbench.docs.body.requestTracking.howHeading': 'Comment ça marche',
  'workbench.docs.body.requestTracking.how1Prefix': "L'extension observe les requêtes HTTP via",
  'workbench.docs.body.requestTracking.how1Middle':
    "— l'API du navigateur. Quand l'URL d'une requête correspond aux conditions d'une règle (domaines, motif d'URL " +
    "ou regex d'URL), elle est enregistrée avec son type de ressource. L'enregistrement se fait en direct " +
    "dans le service worker ; ouvrir l'onglet",
  'workbench.docs.body.requestTracking.how1Suffix': 'ne fait que relire cet enregistrement.',
  'workbench.docs.body.requestTracking.howCaption':
    "Le navigateur émet les événements webRequest ; l'extension fait correspondre et enregistre ; le popup " +
    'lit plus tard.',
  'workbench.docs.body.requestTracking.badge1':
    'Chaque règle correspondante affiche une pastille numérotée égale au nombre de requêtes ' +
    "qu'elle a fait correspondre. Cliquez sur la pastille pour développer une liste d'horodatages, d'URL, " +
    'de types de ressources et du motif qui a correspondu.',
  'workbench.docs.body.requestTracking.badgeCaption':
    'La pastille replie le compte ; cliquer dessus révèle la liste complète des correspondances.',
  'workbench.docs.body.requestTracking.directHeading': 'Correspondances directes vs indirectes',
  'workbench.docs.body.requestTracking.direct1Prefix': 'A',
  'workbench.docs.body.requestTracking.directTerm': 'direct',
  'workbench.docs.body.requestTracking.direct1Middle':
    "— correspondance directe — signifie que l'URL de la page elle-même a correspondu. Une correspondance",
  'workbench.docs.body.requestTracking.indirectTerm': 'indirecte',
  'workbench.docs.body.requestTracking.direct1Suffix':
    'signifie que seule une sous-ressource — script, feuille de style, XHR, image, police — a correspondu, ' +
    "sans que l'URL de la page corresponde. La même règle peut produire l'un ou l'autre type selon la page " +
    'où vous vous trouvez.',
  'workbench.docs.body.requestTracking.directCaption':
    'Une règle, deux contextes de page. Vert = correspondu. Pointillé = exclu.',
  'workbench.docs.body.requestTracking.typesHeading': 'Types de ressources',
  'workbench.docs.body.requestTracking.types1Prefix': 'Chaque requête correspondante porte son type Chrome',
  'workbench.docs.body.requestTracking.types1Middle':
    '— Page, Frame, Fetch/XHR, Script, CSS, Image, Font, Media, WebSocket, Ping ou Other. Voir la ' + 'référence',
  'workbench.docs.body.requestTracking.resourceTypesLink': 'Types de ressources',
  'workbench.docs.body.requestTracking.types1Suffix': 'pour la table complète avec exemples.',

  // ── Reference: Resource Types (section shell + table descriptions;
  //    tags/codes/example lines stay raw parity vocabulary) ────────────
  'workbench.docs.body.resourceTypes.introPrefix': 'Référence des valeurs Chrome',
  'workbench.docs.body.resourceTypes.introSuffix':
    'exposées par le suivi des requêtes et la condition Types de ressources. Chaque libellé ' +
    'correspond à un seul type sous-jacent — aucun chevauchement entre les lignes.',
  'workbench.docs.body.resourceTypes.anatomyCaption':
    "Quel genre de requête atterrit dans quel ResourceType — d'un coup d'œil.",
  'workbench.docs.body.resourceTypes.descPage':
    "Navigation de document de premier niveau — l'URL affichée dans la barre d'adresse.",
  'workbench.docs.body.resourceTypes.descFrame': 'Un iframe ou cadre imbriqué intégré dans la page.',
  'workbench.docs.body.resourceTypes.descXhr':
    'Appels API via fetch() ou XMLHttpRequest. Chrome rapporte les deux comme le même type — il est ' +
    'impossible de les distinguer.',
  'workbench.docs.body.resourceTypes.descScript': 'Fichiers JavaScript chargés par la page.',
  'workbench.docs.body.resourceTypes.descStylesheet': 'Feuilles de style chargées par la page.',
  'workbench.docs.body.resourceTypes.descImage': 'Images chargées par la page ou ses styles.',
  'workbench.docs.body.resourceTypes.descFont': 'Polices web chargées via les règles @font-face.',
  'workbench.docs.body.resourceTypes.descMedia': 'Ressources audio ou vidéo.',
  'workbench.docs.body.resourceTypes.descWebsocket':
    "Handshake WebSocket — la requête HTTP d'upgrade initiale. Seul le handshake est suivi, pas les " +
    'messages individuels.',
  'workbench.docs.body.resourceTypes.descPing':
    "Requêtes beacon et ping typiquement utilisées pour l'analytique et le pistage.",
  'workbench.docs.body.resourceTypes.descOther': "Tout ce qui n'entre pas dans les catégories ci-dessus.",

  // ── Concepts: Actions (overview) ────────────────────────────────────
  'workbench.docs.body.actions.intro1Prefix': 'Une action est la moitié «',
  'workbench.docs.body.actions.introDo': 'agir',
  'workbench.docs.body.actions.intro1Middle': "» d'une règle. Là où une",
  'workbench.docs.body.actions.conditionLink': 'condition',
  'workbench.docs.body.actions.intro1Middle2': 'décide',
  'workbench.docs.body.actions.introWhether': 'si',
  'workbench.docs.body.actions.intro1Middle3': "la règle se déclenche, l'action décide de",
  'workbench.docs.body.actions.introWhatChanges': 'ce qui change',
  'workbench.docs.body.actions.intro1Suffix':
    '. Chaque règle associe une pile de conditions à correspondance AND à exactement une action.',
  'workbench.docs.body.actions.categories1':
    'Les actions se répartissent en trois catégories — modifier la requête sortante, modifier la réponse ' +
    "entrante ou exécuter du code dans la page. Chaque action est mise en œuvre par l'un de deux moteurs :",
  'workbench.docs.body.actions.engineDnr': 'DNR',
  'workbench.docs.body.actions.categoriesDnrParen': "(l'API Chrome",
  'workbench.docs.body.actions.categoriesDnrSuffix': ', rapide et native) ou',
  'workbench.docs.body.actions.engineScript': 'Script',
  'workbench.docs.body.actions.categoriesScriptParen':
    "(le moteur en-page d'Open Headers, pour ce que DNR ne peut pas exprimer). Voir",
  'workbench.docs.body.actions.executionLink': "Comment les règles s'exécutent",
  'workbench.docs.body.actions.categories1Suffix': 'pour les compromis.',
  'workbench.docs.body.actions.ruleAnatomyCaption':
    'Une règle = des conditions à correspondance AND associées à exactement une action.',
  'workbench.docs.body.actions.taxonomyCaption': 'Trois catégories, chaque action avec son étiquette de moteur.',
  'workbench.docs.body.actions.modifyRequestTitle': 'Modifier la requête',
  'workbench.docs.body.actions.tagRequest': "avant qu'elle quitte le navigateur",
  'workbench.docs.body.actions.modifyRequest1':
    "Remodelez la requête sortante — ses en-têtes, ses paramètres d'URL, son corps, sa destination, ou son " +
    'départ tout court. La plupart des règles vivent ici.',
  'workbench.docs.body.actions.headerActionsLink': "Actions d'en-tête",
  'workbench.docs.body.actions.liHeaderActionsRequest':
    '— Ajouter / Remplacer / Ajouter à la suite / Retirer / Fusionner sur les en-têtes de requête.',
  'workbench.docs.body.actions.blockLink': 'Blocage',
  'workbench.docs.body.actions.liBlock': '— annuler la requête au niveau de la couche réseau.',
  'workbench.docs.body.actions.redirectLink': 'Redirection',
  'workbench.docs.body.actions.liRedirect': '— envoyer la requête vers une autre URL, statique ou regex.',
  'workbench.docs.body.actions.queryParamsLink': 'Paramètres de requête',
  'workbench.docs.body.actions.liQueryParams': "— ajouter, remplacer ou retirer des paramètres d'URL.",
  'workbench.docs.body.actions.requestBodyLink': 'Corps de requête',
  'workbench.docs.body.actions.liRequestBody':
    '— réécrire le corps fetch / XHR sortant (statique, dynamique ou filtré par GraphQL).',
  'workbench.docs.body.actions.modifyResponseTitle': 'Modifier la réponse',
  'workbench.docs.body.actions.tagResponse': 'avant que la page la voie',
  'workbench.docs.body.actions.modifyResponse1':
    'Remodelez la réponse sur le chemin du retour — en-têtes, corps ou statut HTTP. Utile pour mocker des ' +
    "points d'accès pas encore construits et forcer des modes d'échec en développement.",
  'workbench.docs.body.actions.liHeaderActionsResponse':
    "— les cinq mêmes opérations s'appliquent aux en-têtes de réponse.",
  'workbench.docs.body.actions.responseLink': 'Modifier la réponse',
  'workbench.docs.body.actions.liResponse': '— mocker ou modifier la réponse : corps, statut ou en-têtes synthétiques.',
  'workbench.docs.body.actions.runCodeTitle': 'Exécuter du code',
  'workbench.docs.body.actions.tagRunCode': 'dans la page ou son ordonnanceur',
  'workbench.docs.body.actions.runCode1':
    "Des effets qui n'entrent pas proprement dans « modifier une requête ou une réponse » — injection de " +
    "code et latence artificielle. Les deux passent par le moteur Script car DNR n'a pas d'équivalent.",
  'workbench.docs.body.actions.injectLink': 'Injecter JS / CSS',
  'workbench.docs.body.actions.liInject':
    '— exécuter du JavaScript ou du CSS dans le contexte de la page, avant les scripts de la page ou une ' +
    'fois le DOM prêt.',
  'workbench.docs.body.actions.delayLink': 'Délai',
  'workbench.docs.body.actions.liDelay':
    '— ajouter une latence artificielle aux navigations et aux fetch / XHR initiés par JS.',
  'workbench.docs.body.actions.oneActionTitle': 'Une action par règle',
  'workbench.docs.body.actions.oneAction1':
    'Chaque règle porte exactement une action. Pour faire deux choses à la fois — ajouter un en-tête ET ' +
    'rediriger, par exemple — écrivez deux règles avec les mêmes conditions. Les deux se déclenchent sur ' +
    'la même requête ; DNR les compose dans un ordre documenté.',

  // ── Actions: Header Actions ─────────────────────────────────────────
  'workbench.docs.body.headerActions.intro':
    'Quatre opérations sur les en-têtes de requête et de réponse — trois natives (Ajouter / Remplacer, ' +
    'Ajouter à la suite, Retirer) plus une à base de script (Fusionner) pour la concaténation de valeurs ' +
    'que DNR ne peut pas exprimer.',
  'workbench.docs.body.headerActions.opsCaption': 'Mêmes en-têtes de départ, quatre résultats différents',
  'workbench.docs.body.headerActions.overrideTitle': 'Ajouter / Remplacer',
  'workbench.docs.body.headerActions.override1':
    "Fixe l'en-tête à cette valeur. Remplace s'il est présent, ajoute s'il manque — toujours un seul " +
    'en-tête avec votre valeur.',
  'workbench.docs.body.headerActions.overrideCaption':
    'La même règle couvre les deux cas — remplace quand présent, ajoute quand absent.',
  'workbench.docs.body.headerActions.overrideWontApplyCaption':
    "Si les conditions de la règle ne correspondent pas à la requête, rien ne se passe — pas d'erreur, " +
    'aucune opération.',
  'workbench.docs.body.headerActions.appendTitle': 'Ajouter à la suite',
  'workbench.docs.body.headerActions.append1':
    "Ajoute une nouvelle entrée d'en-tête du même nom. L'original reste — des en-têtes dupliqués en " +
    'résultent. À utiliser pour Set-Cookie, Link, Via.',
  'workbench.docs.body.headerActions.appendCaption':
    "L'en-tête d'origine reste ; une seconde ligne du même nom est ajoutée. Les deux sont livrés.",
  'workbench.docs.body.headerActions.appendWontApplyCaption':
    'Certains en-têtes ne peuvent pas être dupliqués — le navigateur les replie. Préférez Ajouter / ' +
    'Remplacer ou Fusionner.',
  'workbench.docs.body.headerActions.removeTitle': 'Retirer',
  'workbench.docs.body.headerActions.remove1': 'Supprime toutes les instances de cet en-tête. Aucune valeur requise.',
  'workbench.docs.body.headerActions.removeCaption': 'La ligne ciblée disparaît ; tout le reste passe sans changement.',
  'workbench.docs.body.headerActions.removeWontApplyCaption':
    "Si l'en-tête n'est pas là, rien ne se passe — pas d'erreur, juste aucune opération.",
  'workbench.docs.body.headerActions.mergeTitle': 'Fusionner',
  'workbench.docs.body.headerActions.merge1Prefix':
    "Lit la valeur existante à l'exécution et ajoute la vôtre après un séparateur. Par défaut",
  'workbench.docs.body.headerActions.merge1Middle': 'pour Cookie et',
  'workbench.docs.body.headerActions.merge1Suffix':
    'pour les autres. Le séparateur peut être vide pour une concaténation directe.',
  'workbench.docs.body.headerActions.mergeCaption':
    'La valeur existante reste ; la vôtre est ajoutée après le séparateur.',
  'workbench.docs.body.headerActions.mergeWontApplyCaption':
    'Moteur script uniquement — les navigations de page et les ressources statiques passent intactes.',
  'workbench.docs.body.headerActions.mergeLimitation':
    'Fusionner est invisible dans DevTools et ne peut pas lire les en-têtes par défaut du navigateur ' +
    '(Accept, User-Agent) — seulement les en-têtes explicitement définis par le code de la page.',

  // ── Actions: Block ──────────────────────────────────────────────────
  'workbench.docs.body.block.intro':
    'Annule les requêtes correspondantes au niveau de la couche réseau. Le navigateur reçoit une erreur ' +
    'réseau et la page voit la requête échouer comme si le serveur était injoignable.',
  'workbench.docs.body.block.howTitle': 'Comment ça marche',
  'workbench.docs.body.block.how1Prefix': 'Se compile en une action DNR',
  'workbench.docs.body.block.how1Suffix':
    "sans corps. S'applique quel que soit le type de ressource — pages, sous-cadres, scripts, images, " +
    "polices, fetch, XHR — si bien qu'une seule règle couvre tout, sauf si vous la restreignez avec une " +
    'condition Types de ressources.',
  'workbench.docs.body.block.blockCaption':
    'La requête est tuée avant de quitter le navigateur ; la page voit une erreur réseau.',
  'workbench.docs.body.block.wontApplyCaption':
    "Les ressources déjà chargées restent chargées — Blocage n'attrape que les requêtes futures.",
  'workbench.docs.body.block.whenTitle': "Quand l'utiliser",
  'workbench.docs.body.block.when1Prefix':
    'Bloquer des domaines de publicité / analytique / pistage, simuler une panne pour un seul hôte, ou ' +
    "refuser l'accès à un point d'accès en laissant le reste d'une API joignable. Pour ne bloquer que le " +
    "document d'une page (pas ses sous-ressources), ajoutez une condition Types de ressources de",
  'workbench.docs.body.block.when1Suffix': '.',
  'workbench.docs.body.block.useCasesCaption':
    "Quatre motifs typiques — restreignez chacun avec des conditions (Domaines, Motif d'URL, Type de " + 'ressource).',
  'workbench.docs.body.block.note1Prefix': 'Bloquer une requête',
  'workbench.docs.body.block.note1Suffix':
    'affiche une page « ERR_BLOCKED_BY_CLIENT » dans Chrome. Les blocages de sous-ressources sont ' +
    "silencieux — ce que l'utilisateur voit dépend de la gestion d'erreur de la page elle-même.",

  // ── Actions: Redirect ───────────────────────────────────────────────
  'workbench.docs.body.redirect.intro':
    'Redirige les requêtes correspondantes vers une autre URL. Prend en charge les URL statiques et les ' +
    'groupes de capture regex.',
  'workbench.docs.body.redirect.staticTitle': 'Redirection statique',
  'workbench.docs.body.redirect.static1':
    'Saisissez une URL complète pour rediriger chaque requête correspondante vers la même destination.',
  'workbench.docs.body.redirect.staticCaption':
    "Même destination pour chaque requête correspondante — substitution d'URL complète.",
  'workbench.docs.body.redirect.regexTitle': 'Redirection regex',
  'workbench.docs.body.redirect.regex1Prefix': "Associez à une condition Regex d'URL. Utilisez",
  'workbench.docs.body.redirect.regex1Suffix':
    ", etc. pour référencer les groupes de capture dans l'URL de destination.",
  'workbench.docs.body.redirect.regexCaption':
    "Le texte capturé par le groupe est substitué dans l'URL de destination.",
  'workbench.docs.body.redirect.wontApplyCaption':
    "La redirection ne s'applique pas rétroactivement aux pages déjà chargées. Les boucles sont plafonnées " +
    'en silence par Chrome.',
  'workbench.docs.body.redirect.whenTitle': "Quand l'utiliser",
  'workbench.docs.body.redirect.when1':
    "Forcer HTTP → HTTPS, migrer les utilisateurs d'un ancien domaine, réécrire les versions d'API et " +
    'faire passer le trafic CDN par un serveur de développement local sont les quatre motifs typiques. ' +
    "Associez Statique aux URL complètes connues d'avance ; passez à Regex quand le chemin doit traverser " +
    'la redirection.',
  'workbench.docs.body.redirect.useCasesCaption':
    'Quatre motifs typiques — choisissez Regex quand le chemin de destination dépend de la correspondance.',

  // ── Actions: Query Params ───────────────────────────────────────────
  'workbench.docs.body.queryParam.introPrefix':
    "Modifiez les paramètres de requête d'URL avant que la requête quitte le navigateur. Se compile en une " + 'action',
  'workbench.docs.body.queryParam.introSuffix': 'de DNR.',
  'workbench.docs.body.queryParam.addTitle': 'Ajouter / Remplacer',
  'workbench.docs.body.queryParam.add1':
    "Ajoute le paramètre s'il manque, ou remplace sa valeur s'il est déjà présent.",
  'workbench.docs.body.queryParam.addCaption':
    'Ajoute quand absent, remplace quand présent — toujours un seul paramètre correspondant avec votre ' + 'valeur.',
  'workbench.docs.body.queryParam.replaceOnlyTitle': 'Remplacer uniquement',
  'workbench.docs.body.queryParam.replaceOnly1Prefix': 'Remplace la valeur',
  'workbench.docs.body.queryParam.replaceOnlyStrong': 'seulement quand le paramètre est déjà présent',
  'workbench.docs.body.queryParam.replaceOnly1Middle':
    '. Les URL sans le paramètre sont laissées intactes. Utilisez-le pour canoniser une valeur (p. ex. ' + 'forcer',
  'workbench.docs.body.queryParam.replaceOnly1Suffix':
    "sur les URL portant déjà une région quelconque) sans l'injecter dans les URL qui ne l'avaient pas.",
  'workbench.docs.body.queryParam.replaceOnlyCaption':
    'Ne remplace que les valeurs existantes — les URL sans le paramètre sont intactes.',
  'workbench.docs.body.queryParam.removeTitle': 'Retirer',
  'workbench.docs.body.queryParam.remove1': 'Retire des paramètres précis par nom. La valeur est ignorée.',
  'workbench.docs.body.queryParam.removeCaption':
    'Le paramètre nommé disparaît ; chaque autre paramètre de requête passe.',
  'workbench.docs.body.queryParam.removeAllTitle': 'Tout retirer',
  'workbench.docs.body.queryParam.removeAll1':
    'Supprime toute la chaîne de requête. Ne peut pas être combiné avec Ajouter / Remplacer dans la même ' + 'règle.',
  'workbench.docs.body.queryParam.removeAllCaption': "Supprime toute la requête en une étape — l'URL finit nue.",
  'workbench.docs.body.queryParam.wontApplyCaption':
    'Tout retirer entre en conflit avec Ajouter / Remplacer au niveau DNR — scindez en deux règles.',
  'workbench.docs.body.queryParam.whenTitle': "Quand l'utiliser",
  'workbench.docs.body.queryParam.when1':
    'Forcer un drapeau de débogage, canoniser la région ou la locale, purger les paramètres de pistage, ou ' +
    "retirer toutes les chaînes de requête pour la confidentialité. Chacun correspond proprement à l'une " +
    'des quatre opérations ci-dessus.',
  'workbench.docs.body.queryParam.useCasesCaption':
    "Quatre motifs typiques — choisissez l'opération qui correspond à votre intention.",

  // ── Actions: Inject JS / CSS ────────────────────────────────────────
  'workbench.docs.body.inject.intro':
    "Injectez du JavaScript ou du CSS dans les pages correspondantes. Le code s'exécute dans le contexte " +
    'de la page via un content script.',
  'workbench.docs.body.inject.timingCaption':
    "Moment d'insertion — avant les scripts de la page (Dès que possible) vs sûr pour le DOM (Après le " +
    'chargement de la page).',
  'workbench.docs.body.inject.scriptTitle': 'Injection de script',
  'workbench.docs.body.inject.script1': "Code en ligne ou URL externe. Choisissez le moment d'insertion :",
  'workbench.docs.body.inject.asapStrong': 'Dès que possible',
  'workbench.docs.body.inject.asap1':
    "— s'exécute avant les propres scripts de la page. Utile pour les monkey-patchs qui doivent gagner la " +
    'course (p. ex. envelopper',
  'workbench.docs.body.inject.asap1Suffix': 'avant que le code applicatif en capture une référence).',
  'workbench.docs.body.inject.afterStrong': 'Après le chargement de la page',
  'workbench.docs.body.inject.after1':
    "— s'exécute une fois la page analysée. Défaut plus sûr pour le code qui lit le DOM, puisque les " +
    "éléments sont garantis d'exister.",
  'workbench.docs.body.inject.scriptCaption':
    'Le script atterrit comme balise <script> dans la page — il voit les mêmes globales que le JS de la ' + 'page.',
  'workbench.docs.body.inject.cssTitle': 'Injection de CSS',
  'workbench.docs.body.inject.css1Prefix': 'Injectez du CSS personnalisé comme balise',
  'workbench.docs.body.inject.css1Suffix':
    "ajoutée à la page. Utile pour les substitutions de mode sombre, le masquage d'éléments bruyants ou la " +
    'thématisation par environnement.',
  'workbench.docs.body.inject.cssCaption': 'Le CSS est ajouté comme balise <style> avec la spécificité CSS normale.',
  'workbench.docs.body.inject.wontApplyCaption':
    'Les iframes sandboxés et les pages à CSP strict bloquent les scripts injectés.',
  'workbench.docs.body.inject.whenTitle': "Quand l'utiliser",
  'workbench.docs.body.inject.when1':
    'Monkey-patcher les API du navigateur avant que le code applicatif les saisisse, forcer un thème ' +
    "sombre, masquer des éléments d'interface bruyants et semer des drapeaux de fonctionnalités au niveau " +
    "window avant l'initialisation de la page.",
  'workbench.docs.body.inject.useCasesCaption':
    'Quatre motifs typiques — le moment Dès que possible est requis pour le premier et le quatrième.',

  // ── Actions: Delay ──────────────────────────────────────────────────
  'workbench.docs.body.delay.intro':
    "Ajoute une latence artificielle aux requêtes correspondantes. Trois voies s'exécutent en parallèle " +
    'selon le genre de requête.',
  'workbench.docs.body.delay.routingCaption': 'Routage du délai — trois voies pour trois genres de requêtes.',
  'workbench.docs.body.delay.navHeading': "Navigations de document et d'iframe",
  'workbench.docs.body.delay.nav1Prefix': "Routées via une page d'attente locale. Honore les délais jusqu'à",
  'workbench.docs.body.delay.navMs': '30 000 ms',
  'workbench.docs.body.delay.nav1Suffix': '— le plafond de redirection DNR de Chrome.',
  'workbench.docs.body.delay.navCaption':
    "Une page d'attente locale retient la navigation N ms, puis la transmet à la vraie cible.",
  'workbench.docs.body.delay.xhrHeading': 'XHR / fetch initiés par JS',
  'workbench.docs.body.delay.xhr1Prefix': 'Interceptés par un monkey-patch de',
  'workbench.docs.body.delay.xhr1Middle': 'au niveau de la page. Plafonné à',
  'workbench.docs.body.delay.xhrMs': '5 000 ms',
  'workbench.docs.body.delay.xhr1Suffix':
    "pour éviter d'affamer le pool de connexions HTTP de Chrome — les valeurs au-dessus sont écrêtées sur " + 'le fil.',
  'workbench.docs.body.delay.xhrCaption':
    "Un setTimeout dans le patch au niveau de la page retient l'appel avant de le transmettre au réseau.",
  'workbench.docs.body.delay.wontApplyCaption':
    'Les sous-ressources et les fetch de service worker échappent au monkey-patch au niveau de la page.',
  'workbench.docs.body.delay.whenTitle': "Quand l'utiliser",
  'workbench.docs.body.delay.when1':
    "Faire remonter les régressions d'état de chargement, exercer les chemins de code debounce/throttle, " +
    'exposer les situations de concurrence entre requêtes simultanées et approximer des conditions de ' +
    'réseau lent pendant le développement local.',
  'workbench.docs.body.delay.useCasesCaption':
    "Quatre motifs typiques — associez à Motif d'URL ou Domaines pour restreindre.",
  'workbench.docs.body.delay.desktopNoteTitle': 'Application de bureau — note produit',
  'workbench.docs.body.delay.desktopNote1':
    'Limiter le débit des ressources statiques (images, scripts, feuilles de style, polices) exige une ' +
    'vraie couche réseau locale capable de garder les connexions ouvertes et de streamer les octets — hors ' +
    "de portée d'une extension. L'application de bureau prendra bientôt le relais.",

  // ── Actions: Request Body ───────────────────────────────────────────
  'workbench.docs.body.requestBody.introPrefix':
    "Substituez ou transformez les corps de requête avant qu'ils quittent le navigateur. À base de script " +
    '— intercepte',
  'workbench.docs.body.requestBody.introAnd': 'et',
  'workbench.docs.body.requestBody.introDot': '.',
  'workbench.docs.body.requestBody.interceptCaption':
    'La règle se déclenche entre page.js et le réseau — trois formes de transformation',
  'workbench.docs.body.requestBody.staticTitle': 'Corps statique',
  'workbench.docs.body.requestBody.static1':
    'Remplace tout le corps de la requête par une chaîne fixe. Fonctionne pour REST comme pour GraphQL — ' +
    "la règle n'analyse pas le corps, elle le substitue en bloc.",
  'workbench.docs.body.requestBody.staticCaption': "Corps entier remplacé — l'original est jeté.",
  'workbench.docs.body.requestBody.dynamicTitle': 'Corps dynamique',
  'workbench.docs.body.requestBody.dynamic1':
    'Écrivez une fonction qui reçoit le corps original et le contexte de la requête, puis renvoie le corps ' +
    'modifié. La fonction reçoit',
  'workbench.docs.body.requestBody.dynamicDot': '.',
  'workbench.docs.body.requestBody.dynamicCaption':
    "La fonction voit l'original ; elle renvoie ce qui doit être envoyé.",
  'workbench.docs.body.requestBody.graphqlTitle': 'Filtre GraphQL',
  'workbench.docs.body.requestBody.graphql1Prefix':
    'Quand le type de ressource est GraphQL, la règle ne se déclenche que sur les requêtes dont le champ ' +
    'configuré de la charge JSON correspond à la valeur. Le runtime analyse le corps de la requête comme ' +
    'JSON, lit le champ nommé par',
  'workbench.docs.body.requestBody.graphql1Middle': ', et le teste contre',
  'workbench.docs.body.requestBody.graphql1Middle2': "avec l'opérateur choisi (",
  'workbench.docs.body.requestBody.graphql1Middle3': 'pour la correspondance exacte,',
  'workbench.docs.body.requestBody.graphql1Suffix': 'pour la sous-chaîne).',
  'workbench.docs.body.requestBody.graphql2Prefix': 'Clés courantes :',
  'workbench.docs.body.requestBody.graphql2Middle': "pour l'opération nommée,",
  'workbench.docs.body.requestBody.graphql2Suffix':
    'pour une sous-chaîne du texte de la requête. Les requêtes sans corps JSON, ou dont le champ manque ou ' +
    'ne correspond pas, passent intactes.',
  'workbench.docs.body.requestBody.graphqlCaption':
    'Barrière au niveau du champ — les opérations qui ne correspondent pas passent intactes.',
  'workbench.docs.body.requestBody.wontApplyCaption':
    "GET/HEAD n'ont rien à remplacer ; les ressources statiques n'entrent pas dans l'interception script.",
  'workbench.docs.body.requestBody.whenTitle': "Quand l'utiliser",
  'workbench.docs.body.requestBody.when1':
    'Forcer des données de test, estampiller chaque charge de métadonnées (drapeaux de débogage, ' +
    'identifiants de requête), mocker des opérations GraphQL précises et anonymiser les PII avant rejeu ' +
    'sont les quatre motifs typiques.',
  'workbench.docs.body.requestBody.useCasesCaption':
    "Quatre motifs typiques — associez à Motif d'URL ou Domaines pour restreindre.",

  // ── Actions: Modify Response ────────────────────────────────────────
  'workbench.docs.body.response.introPrefix':
    'Interceptez les appels API et renvoyez des réponses personnalisées — contrôle total du code de ' +
    'statut, du corps et des en-têtes de réponse. À base de script — intercepte',
  'workbench.docs.body.response.introAnd': 'et',
  'workbench.docs.body.response.introDot': '.',
  'workbench.docs.body.response.flowCaption':
    "Statique saute entièrement le réseau ; Dynamique le touche d'abord, puis transforme.",
  'workbench.docs.body.response.staticTitle': 'Réponse statique',
  'workbench.docs.body.response.static1':
    'Renvoie un corps fixe avec un contrôle total de la réponse synthétique — code de statut, ' +
    'Content-Type et tout en-tête de réponse supplémentaire (Set-Cookie, en-têtes CORS, drapeaux ' +
    "personnalisés). La vraie requête n'est jamais émise. Utile pour le développement hors ligne contre " +
    'des données connues.',
  'workbench.docs.body.response.staticCaption':
    "Le serveur n'est jamais contacté — la page reçoit les données comme si elles venaient du fil.",
  'workbench.docs.body.response.dynamicTitle': 'Réponse dynamique',
  'workbench.docs.body.response.dynamic1':
    "La vraie requête est émise d'abord. Votre fonction reçoit la réponse et le contexte de la requête, " +
    'puis renvoie la réponse modifiée. La fonction reçoit',
  'workbench.docs.body.response.dynamicDot': '.',
  'workbench.docs.body.response.dynamic2':
    "Le code de statut, le Content-Type et les champs d'en-tête de réponse définis sur la règle " +
    "s'appliquent toujours par-dessus la valeur renvoyée par la fonction, si bien que vous pouvez muter le " +
    "corps tout en laissant la règle contrôler les en-têtes d'enveloppe.",
  'workbench.docs.body.response.dynamicCaption': "Le vrai appel a lieu d'abord ; la fonction réécrit ce qui revient.",
  'workbench.docs.body.response.graphqlTitle': 'Filtre GraphQL',
  'workbench.docs.body.response.graphql1':
    'Quand le type de ressource est GraphQL, la règle ne se déclenche que sur les requêtes dont le champ ' +
    'configuré de la charge JSON correspond à la valeur définie (Equals ou Contains) — un point ' +
    "d'accès unique qui multiplexe de nombreuses opérations peut donc être intercepté une opération à la " +
    'fois. Les requêtes dont la charge ne correspond pas passent directement au réseau, intactes.',
  'workbench.docs.body.response.wontApplyCaption':
    "Les ressources statiques et les navigations de page n'entrent jamais dans l'interception script.",
  'workbench.docs.body.response.whenTitle': "Quand l'utiliser",
  'workbench.docs.body.response.when1':
    "Le développement hors ligne contre des données fixes, la simulation de réponses d'erreur précises, le " +
    "caviardage des PII avant qu'elles atteignent la page et l'exercice de formes de charge limites " +
    'difficiles à reproduire contre un vrai backend.',
  'workbench.docs.body.response.useCasesCaption':
    'Quatre motifs typiques — choisissez Statique pour les données fixes, Dynamique pour transformer de ' +
    'vraies données.',

  // ── Reference: Conditions ───────────────────────────────────────────
  'workbench.docs.body.conditions.intro1Prefix':
    "Une condition est un filtre sur un attribut d'une requête sortante. Empilez plusieurs conditions et " +
    'elles se combinent en logique AND — chaque condition doit correspondre pour que la règle se ' +
    'déclenche. Chaque condition correspond directement à un champ Chrome',
  'workbench.docs.body.conditions.intro1Suffix': 'sous-jacent.',
  'workbench.docs.body.conditions.intro2Prefix': 'La plupart des conditions ont aussi une variante',
  'workbench.docs.body.conditions.exclStrong': 'Excl.',
  'workbench.docs.body.conditions.intro2Suffix':
    "dans l'éditeur de règle — Excl. méthodes, Excl. ressources, Excl. initiateur, Excl. en-tête rép. — " +
    'qui inverse la correspondance (p. ex. « tout sauf ces méthodes »). Utilisez-les chaque fois que ' +
    "l'ensemble négatif est plus petit que le positif.",
  'workbench.docs.body.conditions.anatomyCaption':
    'Une règle associe des conditions à correspondance AND à une action — les conditions décident si la ' +
    'règle se déclenche.',
  'workbench.docs.body.conditions.matchingCaption':
    'Chaque condition vérifie un attribut de la requête. Toutes doivent correspondre pour que la règle se ' +
    'déclenche.',
  'workbench.docs.body.conditions.hostVsOriginCaption':
    "L'URL de la page et l'URL de destination du fetch sont suivies séparément — voilà pourquoi il y a " +
    'deux conditions de domaine.',
  'workbench.docs.body.conditions.urlPatternTitle': "Motif d'URL",
  'workbench.docs.body.conditions.urlPattern1Prefix': "Motif à jokers sur l'URL complète. Utilisez",
  'workbench.docs.body.conditions.urlPattern1Middle':
    "pour correspondre à n'importe quels caractères. Le protocole doit être précisé :",
  'workbench.docs.body.conditions.urlPattern1Middle2': 'pour tous,',
  'workbench.docs.body.conditions.urlPattern1Suffix': 'pour HTTPS uniquement.',
  'workbench.docs.body.conditions.urlPatternCaption':
    'Or = joker, vert = littéral. Chaque URL de test ci-dessous montre si le motif lui correspond.',
  'workbench.docs.body.conditions.urlRegexTitle': "Regex d'URL",
  'workbench.docs.body.conditions.urlRegex1':
    "Expression régulière RE2 sur l'URL complète, protocole compris. Pour les correspondances que les " +
    "jokers ne peuvent pas exprimer. Ne peut pas être combinée avec Motif d'URL dans la même règle.",
  'workbench.docs.body.conditions.urlRegexCaption':
    'Violet = vraie syntaxe regex. Vert = caractères littéraux. Chaque URL de test ci-dessous montre si ' +
    'la regex correspond.',
  'workbench.docs.body.conditions.requestDomainsTitle': 'Domaines de requête',
  'workbench.docs.body.conditions.requestDomains1Prefix':
    'Correspond à un domaine plus chacun de ses sous-domaines, automatiquement. Saisissez le domaine apex ' +
    'une fois ; la règle couvre',
  'workbench.docs.body.conditions.requestDomains1Suffix': ', et toute imbrication plus profonde, sans jokers.',
  'workbench.docs.body.conditions.requestDomainsCaption':
    'Une valeur, tous les sous-domaines. Les cas limites ci-dessous montrent ce qui compte comme vrai ' +
    'sous-domaine.',
  'workbench.docs.body.conditions.excludeDomainsTitle': 'Exclure des domaines',
  'workbench.docs.body.conditions.excludeDomains1':
    "Soustrait des hôtes aux correspondances d'une autre condition — mêmes sémantiques de sous-domaines " +
    'que Domaines de requête, donc exclure un hôte exclut aussi ses sous-domaines. Ne correspond à rien ' +
    'par lui-même.',
  'workbench.docs.body.conditions.excludeDomainsCaption':
    "L'inclusion verte réduit à un ensemble candidat ; l'exclusion rouge en retire certains. Les " +
    'sous-domaines suivent.',
  'workbench.docs.body.conditions.initiatorDomainsTitle': 'Domaines initiateurs',
  'workbench.docs.body.conditions.initiatorDomains1':
    "Correspond selon la page ouverte au moment de la requête — l'origine de la requête, pas sa " +
    'destination. Le même appel fetch vers la même URL peut correspondre ou non selon ' +
    "l'onglet où navigue l'utilisateur.",
  'workbench.docs.body.conditions.initiatorDomainsCaption':
    "Même destination, deux contextes de page différents. L'initiateur décide lequel correspond.",
  'workbench.docs.body.conditions.methodsTitle': 'Méthodes',
  'workbench.docs.body.conditions.methods1':
    'Filtrez par verbe HTTP. Multi-sélection — choisissez les méthodes qui doivent correspondre ; les ' +
    'autres ne déclenchent pas la règle. Laissez la condition entièrement désactivée pour correspondre à ' +
    'chaque méthode.',
  'workbench.docs.body.conditions.methodsCaption':
    'Les pilules orange sont sélectionnées ; les grises sont sautées. Les requêtes de test ci-dessous ' +
    'tracent chaque verbe vers son résultat.',
  'workbench.docs.body.conditions.resourceTypesTitle': 'Types de ressources',
  'workbench.docs.body.conditions.resourceTypes1Prefix':
    'Filtrez par le genre de ressource chargée — navigations de page, XHR/fetch, scripts, images, polices ' +
    'et plus. Multi-sélection comme Méthodes. Voir la référence',
  'workbench.docs.body.conditions.resourceTypesLink': 'Types de ressources',
  'workbench.docs.body.conditions.resourceTypes1Suffix':
    'pour la liste complète avec noms de code et exemples concrets.',
  'workbench.docs.body.conditions.resourceTypesCaption':
    'Les genres violets correspondent ; les gris sont sautés. Chaque requête de test montre son genre en ' + 'ligne.',
  'workbench.docs.body.conditions.domainTypeTitle': 'Type de domaine',
  'workbench.docs.body.conditions.domainType1Prefix': 'Classe chaque requête selon sa relation à la page —',
  'workbench.docs.body.conditions.domainType1Middle':
    'quand la destination partage le domaine enregistrable de la page,',
  'workbench.docs.body.conditions.domainType1Suffix':
    "quand ce n'est pas le cas. Usage courant : bloquer les pisteurs (ne faire correspondre que " +
    'thirdParty) ou restreindre une règle à vos propres services (ne faire correspondre que firstParty).',
  'workbench.docs.body.conditions.domainTypeCaption':
    "Le bandeau de page fixe l'origine ; le sélecteur choisit le type qui correspond ; le tableau montre " +
    'le verdict par destination.',
  'workbench.docs.body.conditions.headersTitle': 'En-têtes de réponse',
  'workbench.docs.body.conditions.headers1':
    'Fait correspondre les réponses portant un en-tête précis avec une valeur précise. Le DNR de Chrome ' +
    "n'expose pas la correspondance d'en-têtes de requête — cette condition est côté réponse uniquement. " +
    "Le nom de l'en-tête et la valeur sont comparés comme chaînes exactes (pas de jokers, pas de " +
    "correspondance partielle) et l'en-tête doit réellement être présent sur la réponse.",
  'workbench.docs.body.conditions.headersCaption':
    'Deux pilules (nom + valeur) jointes par =, puis des en-têtes de réponse de test frappant chaque mode ' +
    "d'échec.",

  // ── Open Headers: Paradigm ──────────────────────────────────────────
  'workbench.docs.body.paradigm.oneExtensionHeading': 'Tout dans une seule extension',
  'workbench.docs.body.paradigm.oneExtension1':
    'Trois catégories de produits se sont historiquement partagé cette surface : les proxys de bureau ' +
    "gèrent l'interception HTTP, les plateformes API cloud détiennent vos requêtes et collections, et les " +
    "extensions d'en-têtes légères couvrent le cas « juste réécrire un en-tête ». Aucune ne livre les " +
    "autres. Open Headers, si — dans une seule extension de navigateur, avec un seul magasin d'espaces de " +
    'travail alimentant chaque surface.',
  'workbench.docs.body.paradigm.convergenceCaption':
    "Trois catégories héritées convergent en une seule installation. Personne d'autre ne livre cette " +
    "combinaison dans l'extension.",
  'workbench.docs.body.paradigm.ruleEngineHeading': 'Moteur de règles de classe entreprise',
  'workbench.docs.body.paradigm.ruleEngine1Prefix':
    "Le moteur de règles n'est pas un tour unique étiré sur neuf interfaces — ce sont deux vrais chemins " +
    "d'exécution avec un langage partagé au-dessus. Les règles",
  'workbench.docs.body.paradigm.dnrNativeStrong': 'natives DNR',
  'workbench.docs.body.paradigm.ruleEngine1Middle': 'se compilent vers Chrome via',
  'workbench.docs.body.paradigm.ruleEngine1Middle2':
    "— l'API qui attrape chaque requête émise par le navigateur (pages, sous-cadres, fetch, XHR, " +
    'images, polices, scripts). Le',
  'workbench.docs.body.paradigm.scriptEngineStrong': 'moteur de script',
  'workbench.docs.body.paradigm.ruleEngine1Suffix':
    "reprend là où DNR n'atteint pas — fusionner des valeurs d'en-têtes, transformer des corps, mocker " +
    'des réponses, injecter du code, retarder des appels. Les deux moteurs lisent le même langage de ' +
    "conditions et les mêmes cinq portées de variables, si bien qu'une règle écrite contre DNR passe au " +
    "moteur de script en changeant un seul type d'action.",
  'workbench.docs.body.paradigm.ruleEngineCaption':
    "Deux chemins d'exécution, neuf catégories de règles, un langage partagé de conditions + variables.",
  'workbench.docs.body.paradigm.apiCatalogHeading': 'Catalogue complet de requêtes API',
  'workbench.docs.body.paradigm.apiCatalog1':
    "Chaque capacité qu'un client API de bureau livre — construction de requêtes, environnements, OAuth " +
    '2.0 (y compris PKCE + Client Credentials + refresh), scripts pré- et post-réponse, multipart avec ' +
    'blobs de fichiers adressés par contenu, collections + dossiers, GraphQL avec introspection de schéma ' +
    "— vit dans l'extension. Même magasin d'espaces de travail que les règles, mêmes cinq portées de " +
    "variables, mêmes surfaces. Apportez vos collections d'une autre plateforme et continuez de " +
    'travailler ; rien ne repart vers un cloud que vous ne contrôlez pas.',
  'workbench.docs.body.paradigm.apiCatalogCaption':
    "L'éditeur de requête, avec la prise en charge des protocoles, chaque type d'authentification, les " +
    "scripts, les fichiers et les collections — dans l'extension.",
  'workbench.docs.body.paradigm.localFirstHeading': "Local d'abord, par conception",
  'workbench.docs.body.paradigm.localFirst1Prefix':
    "« Local d'abord » est une posture, pas une fonctionnalité. L'extension n'a ni système de compte, ni " +
    "relais cloud, ni traçage — la seule donnée d'usage est un comptage de fonctionnalités anonyme, " +
    'inspectable octet par octet et désactivable en un geste — et vous avez un vrai choix sur',
  'workbench.docs.body.paradigm.localFirstWhere': 'où',
  'workbench.docs.body.paradigm.localFirst1Suffix':
    "vit le back-end. Quatre options d'hébergement, toutes locales uniquement, toutes sous votre " +
    "contrôle : le service worker dans le navigateur (aujourd'hui, zéro configuration), le back-end " +
    "embarqué de l'application de bureau, un serveur local autonome servant chaque surface Open Headers " +
    'sur une machine, ou un back-end auto-hébergé sur votre propre VM. Chaque option préserve les mêmes ' +
    'garanties ; le compromis est la portée, pas la propriété.',
  'workbench.docs.body.paradigm.localFirst2':
    "La collaboration d'équipe passe par des stockages contrôlés par l'utilisateur (Git) — pas par un " +
    "serveur d'éditeur.",
  'workbench.docs.body.paradigm.frontEnds1Prefix': 'Le même principe vaut pour',
  'workbench.docs.body.paradigm.frontEndsHow': 'comment',
  'workbench.docs.body.paradigm.frontEnds1Suffix':
    "vous atteignez ces données. L'extension de navigateur est le front-end par défaut — " +
    'quatre surfaces dans le navigateur. Une application de bureau native, une CLI et une application web ' +
    "distante l'accompagnent. Chaque front-end parle au back-end de votre choix ; " +
    "choisissez n'importe quelle combinaison, et chaque surface reste synchronisée.",
  'workbench.docs.body.paradigm.autoSyncHeading': 'Auto-Sync sans perdre votre travail',
  'workbench.docs.body.paradigm.autoSync1Prefix':
    "La synchronisation multi-appareils est d'ordinaire l'endroit où les produits local d'abord plient et " +
    'vous demandent de faire confiance à leur cloud. Open Headers la résout au niveau',
  'workbench.docs.body.paradigm.perFieldStrong': 'par champ',
  'workbench.docs.body.paradigm.autoSync1Middle': ': le popup qui bascule le drapeau',
  'workbench.docs.body.paradigm.autoSync1Suffix':
    "d'une règle et le workbench qui réécrit une valeur d'en-tête dans la même règle atterrissent tous " +
    "les deux, dans n'importe quel ordre, sans bannière de brouillon périmé et sans écrasement. La même " +
    "approche passe des quatre surfaces d'une extension à un serveur local derrière extension " +
    "+ bureau + CLI, et aux espaces de travail d'équipe multi-utilisateurs via un dépôt Git " +
    "distant — sans jamais avoir besoin d'un serveur d'éditeur au milieu.",
  'workbench.docs.body.paradigm.fieldSyncCaption':
    "Deux surfaces, une règle, des champs différents — les deux modifications atterrissent, rien n'est " + 'écrasé.',
  'workbench.docs.body.paradigm.noteCalloutPrefix':
    'Envie de voir comment cela se compare aux autres outils que vous avez pu essayer ?',
  'workbench.docs.body.paradigm.comparisonLink': 'Comment nous nous comparons',
  'workbench.docs.body.paradigm.noteCalloutMiddle':
    'vient ensuite. Envie de voir toute la plateforme en une vue ? Sautez à',
  'workbench.docs.body.paradigm.roadmapLink': 'Chaque surface, livrée',
  'workbench.docs.body.paradigm.noteCalloutSuffix': '.',

  // ── Open Headers: Comparison ────────────────────────────────────────
  'workbench.docs.body.comparison.intro1':
    'La version la plus courte : Open Headers est ce que vous construiriez en prenant la puissance de ' +
    "façonnage des requêtes d'un proxy de bureau, la bibliothèque de règles d'une plateforme API cloud et " +
    "la surface toujours active d'une extension d'en-têtes seuls, et en leur demandant de partager un " +
    'seul magasin.',
  'workbench.docs.body.comparison.matrixCaption':
    'Trois catégories de produits, un jeu de compromis chacune — et où se situe Open Headers.',
  'workbench.docs.body.comparison.vsCloudHeading': 'vs plateformes API cloud',
  'workbench.docs.body.comparison.vsCloud1':
    'Les outils hébergés dans le cloud attendent que votre trafic, vos identifiants et vos définitions de ' +
    'règles vivent sur leurs serveurs. Ce modèle suppose que ces données puissent quitter votre machine — ' +
    'et que vous mainteniez un compte pour accéder à votre propre travail. Open Headers ne fait aucune de ' +
    "ces deux hypothèses. Tout reste local ; la collaboration d'équipe passe par un stockage contrôlé par " +
    "l'utilisateur (Git), pas par la base de données d'un éditeur.",
  'workbench.docs.body.comparison.vsProxiesHeading': 'vs proxys de bureau',
  'workbench.docs.body.comparison.vsProxies1Prefix':
    'Les proxys routent tout votre trafic par un processus séparé. Puissants mais lourds : installer un ' +
    'binaire, installer un certificat CA, configurer chaque application vers le port du proxy. Open ' +
    "Headers s'appuie sur Chrome :",
  'workbench.docs.body.comparison.vsProxies1Suffix':
    "— l'API pour le trafic statique — et un moteur de script par page pour les transformations " +
    'dynamiques. Pas de port proxy, pas de certificat CA, pas de configuration par application — et les ' +
    "règles correspondantes s'appliquent avec les permissions de la page elle-même, pas celles d'un homme " +
    'du milieu.',
  'workbench.docs.body.comparison.vsHeaderOnlyHeading': "vs extensions d'en-têtes seuls",
  'workbench.docs.body.comparison.vsHeaderOnly1Prefix':
    "Les extensions d'en-têtes seuls gèrent exactement un type de règle et s'arrêtent là. Open Headers " + 'en gère',
  'workbench.docs.body.comparison.nineLink': 'neuf',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle':
    '— en-tête Ajouter / Remplacer / Ajouter à la suite / Retirer / Fusionner,',
  'workbench.docs.body.comparison.blockLink': 'Blocage',
  'workbench.docs.body.comparison.redirectLink': 'Redirection',
  'workbench.docs.body.comparison.queryParamsLink': 'Paramètres de requête',
  'workbench.docs.body.comparison.injectLink': 'Injection',
  'workbench.docs.body.comparison.delayLink': 'Délai',
  'workbench.docs.body.comparison.requestBodyLink': 'Corps de requête',
  'workbench.docs.body.comparison.responseLink': 'Réponse',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle2': '— tous pilotés par le même',
  'workbench.docs.body.comparison.conditionLanguageLink': 'langage de conditions',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle3': ', tous observables via',
  'workbench.docs.body.comparison.requestTrackingLink': 'le suivi des requêtes',
  'workbench.docs.body.comparison.vsHeaderOnly1Suffix': 'sur la même surface.',
  'workbench.docs.body.comparison.whyMattersTitle': 'Pourquoi cela compte en pratique',
  'workbench.docs.body.comparison.whyMatters1':
    "La plupart des flux de travail touchent plus d'une de ces catégories. Mocker une réponse API, " +
    'bloquer un pisteur tiers et forcer un en-tête de débogage sur un seul environnement sont trois types ' +
    'de règles différents — trois installations différentes dans le monde hérité. Ici, ils partagent un ' +
    'seul espace de travail.',

  // ── Open Headers: Roadmap ───────────────────────────────────────────
  'workbench.docs.body.roadmap.intro1Prefix':
    'Open Headers a commencé local uniquement — une extension sur un appareil. Chaque jalon ci-dessous ' +
    'étend cette forme sans la casser, et chacun est livré. La synchronisation entre utilisateurs passe ' +
    'par des moyens',
  'workbench.docs.body.roadmap.userControlledStrong': "contrôlés par l'utilisateur",
  'workbench.docs.body.roadmap.intro1Suffix':
    '— des dépôts Git et des déploiements auto-hébergés — jamais un cloud hébergé par un éditeur.',
  'workbench.docs.body.roadmap.gitHeading': "Collaboration d'espace de travail via Git (prêt pour les équipes)",
  'workbench.docs.body.roadmap.git1Prefix':
    'Les espaces de travail se sérialisent en YAML dans un dépôt Git que vous contrôlez. Pull ' +
    'synchronise ; push partage ; les conflits de fusion se résolvent avec ' +
    "l'outillage existant de Git. Pas de serveur central, pas de compte, pas de verrouillage éditeur. La " +
    "présence en temps réel, c'est",
  'workbench.docs.body.roadmap.gitAnd': 'et',
  'workbench.docs.body.roadmap.git1Suffix': '— durable, auditable, déjà compris.',
  'workbench.docs.body.roadmap.desktopHeading': 'Application de bureau',
  'workbench.docs.body.roadmap.desktop1':
    "Un binaire natif qui fait tourner le même magasin d'espaces de travail que l'extension. Utile pour " +
    "les surfaces qu'une extension ne peut pas atteindre — façonnage du trafic au niveau système, édition " +
    'multi-fenêtres, intégration plus profonde au système de fichiers. Les deux partagent le même format ' +
    "sur disque : ouvrir l'application de bureau sur un espace de travail que l'extension possède est une " +
    'lecture, pas une migration.',
  'workbench.docs.body.roadmap.mcpHeading': 'Serveur MCP — contrôle par agents IA',
  'workbench.docs.body.roadmap.mcp1Prefix': "Open Headers s'expose via le",
  'workbench.docs.body.roadmap.mcpStrong': 'Model Context Protocol',
  'workbench.docs.body.roadmap.mcp1Suffix':
    'pour que tout client IA compatible MCP — Claude Desktop, Claude Code, Cursor, VS Code, Cline et ' +
    "l'écosystème grandissant derrière — puisse piloter votre espace de travail directement. Demandez à " +
    "l'agent en langage courant d'ajouter une règle d'en-tête, d'exécuter une requête enregistrée contre " +
    "le staging, de changer d'environnement, de comparer deux espaces de travail ou d'importer une " +
    "collection Postman ; l'agent traduit cela en appels d'outils MCP et votre workbench reflète le " +
    'résultat.',
  'workbench.docs.body.roadmap.mcp2Prefix': 'Le serveur tourne',
  'workbench.docs.body.roadmap.mcpLocalOnlyStrong': 'en local uniquement par défaut',
  'workbench.docs.body.roadmap.mcp2Middle': '(transport stdio, appairé un à un avec un client sur la même machine) et',
  'workbench.docs.body.roadmap.mcpRemoteStrong': 'en HTTP/SSE pour le distant',
  'workbench.docs.body.roadmap.mcp2Suffix':
    "quand vous auto-hébergez. Aucun relais d'éditeur ; votre agent parle directement à votre " +
    "installation. Les appels d'outils s'exécutent avec les mêmes permissions d'espace de travail que " +
    'vous — les secrets restent derrière le vault, les opérations sensibles restent en opt-in.',
  'workbench.docs.body.roadmap.serverHeading': 'Serveur local / LAN pour la synchronisation multi-appareils',
  'workbench.docs.body.roadmap.server1':
    'Un serveur à exécuter sur votre machine, votre LAN ou un hôte tunnelisé. ' +
    'Extension, application de bureau et CLI deviennent tous clients du même serveur — mêmes espaces de ' +
    'travail, mêmes règles, même vault, sur chaque appareil que vous utilisez. Le serveur reste sur le ' +
    "réseau local ; il n'y a pas de chemin cloud opt-in par-dessus.",
  'workbench.docs.body.roadmap.cliHeading': 'CLI',
  'workbench.docs.body.roadmap.cli1':
    'Scripting headless et intégration CI. Lister les règles, basculer les environnements, exécuter une ' +
    'seule requête enregistrée depuis le shell, comparer un espace de travail à un autre. La CLI parle au ' +
    "même serveur que l'extension et l'application de bureau, donc l'automatisation reste en phase avec ce " +
    "que vous voyez dans l'interface.",
  'workbench.docs.body.roadmap.webAppHeading': 'Déploiement VM auto-hébergé + application web',
  'workbench.docs.body.roadmap.webApp1':
    'La même interface livrée comme bundle web à servir depuis votre propre origine. Pour les navigateurs ' +
    "d'entreprise verrouillés, les appareils kiosque, ou tout environnement où installer une extension " +
    "n'est pas une option — et pour les utilisateurs qui veulent un déploiement d'Open Headers à leur " +
    'marque sous leur propre domaine.',
  'workbench.docs.body.roadmap.importersHeading': 'Importateurs',
  'workbench.docs.body.roadmap.importers1':
    'Aux côtés des importateurs cURL / HAR / Postman : collections Insomnia, spécifications ' +
    'OpenAPI et imports de requêtes HAR complets (pas seulement les en-têtes) — tous disponibles ' +
    "aujourd'hui. La parité d'import est la " +
    "façon dont Open Headers gagne l'adoption de gens déjà investis dans un autre outil — faites " +
    'traverser votre collection en une étape, continuez de travailler.',
  'workbench.docs.body.roadmap.cloudCalloutTitle': 'Et un back-end cloud hébergé ?',
  'workbench.docs.body.roadmap.cloudCallout1':
    "Pas au menu pour l'instant — si vous voulez un back-end hébergé dans le cloud, vous pouvez " +
    "l'auto-héberger sur votre propre VM (voir ci-dessus). La priorité est le produit, pas " +
    "d'exploiter et de maintenir une infrastructure cloud gratuite pour les utilisateurs " +
    "finaux. Ravi d'aider si vous montez un déploiement auto-hébergé et rencontrez un problème ; " +
    "simplement pas en position de fournir l'hébergement lui-même.",

  // ── Docs sub-anchor (i) popovers (DOC_ANCHOR_INFO) ──────────────────
  'workbench.docs.anchor.override.title': 'Ajouter / Remplacer',
  'workbench.docs.anchor.override.summary':
    "Fixe l'en-tête à cette valeur — ajouté s'il manque, en remplaçant toute valeur existante.",
  'workbench.docs.anchor.append.title': 'Ajouter à la suite',
  'workbench.docs.anchor.append.summary':
    "Ajoute cette valeur à la suite de la valeur existante de l'en-tête. Seuls les en-têtes standard à " +
    "valeurs de liste prennent en charge l'ajout à la suite — sur les autres, la règle est enregistrée " +
    'comme brouillon.',
  'workbench.docs.anchor.remove.title': 'Retirer',
  'workbench.docs.anchor.remove.summary':
    "Retire entièrement l'en-tête du trafic correspondant ; le champ valeur est inutilisé.",
  'workbench.docs.anchor.merge.title': 'Fusionner',
  'workbench.docs.anchor.merge.summary':
    "Fusionne cette valeur dans la liste existante de l'en-tête, en sautant les valeurs déjà présentes.",
  'workbench.docs.anchor.qpAdd.title': 'Ajouter / Remplacer',
  'workbench.docs.anchor.qpAdd.summary':
    "Fixe le paramètre sur l'URL — ajouté s'il manque, remplacé s'il est déjà présent.",
  'workbench.docs.anchor.qpOverride.title': 'Remplacer uniquement',
  'workbench.docs.anchor.qpOverride.summary':
    "Ne remplace la valeur du paramètre que quand l'URL le porte déjà ; les URL sans lui passent " + 'inchangées.',
  'workbench.docs.anchor.qpRemove.title': 'Retirer',
  'workbench.docs.anchor.qpRemove.summary': 'Retire le paramètre des URL correspondantes.',
  'workbench.docs.anchor.qpRemoveAll.title': 'Tout retirer',
  'workbench.docs.anchor.qpRemoveAll.summary':
    'Supprime toute la chaîne de requête des URL correspondantes. Les autres opérations de la même règle ' +
    "sont ignorées tant qu'il est présent.",
  'workbench.docs.anchor.urlPattern.title': "Motif d'URL",
  'workbench.docs.anchor.urlPattern.summary':
    "Fait correspondre l'URL de la requête à un motif urlFilter — jokers *, ancres de domaine ||, " + 'séparateurs ^.',
  'workbench.docs.anchor.urlRegex.title': "Regex d'URL",
  'workbench.docs.anchor.urlRegex.summary':
    "Fait correspondre l'URL de la requête à une expression régulière ; les groupes de capture " +
    'alimentent les substitutions \\1, \\2 dans les cibles de redirection.',
  'workbench.docs.anchor.requestDomains.title': 'Domaines de requête',
  'workbench.docs.anchor.requestDomains.summary':
    "Correspond aux requêtes dont l'hôte cible est l'un des domaines listés, sous-domaines compris.",
  'workbench.docs.anchor.excludeDomains.title': 'Exclure des domaines',
  'workbench.docs.anchor.excludeDomains.summary':
    "Correspond à chaque requête sauf celles dont l'hôte cible est listé.",
  'workbench.docs.anchor.initiatorDomains.title': 'Domaines initiateurs',
  'workbench.docs.anchor.initiatorDomains.summary':
    "Correspond selon la page qui a émis la requête plutôt que l'URL de la requête elle-même. La variante " +
    'Excl. inverse la liste.',
  'workbench.docs.anchor.methods.title': 'Méthodes',
  'workbench.docs.anchor.methods.summary':
    'Correspond selon la méthode HTTP (GET, POST, …). La variante Excl. inverse la liste.',
  'workbench.docs.anchor.conditionResourceTypes.title': 'Types de ressources',
  'workbench.docs.anchor.conditionResourceTypes.summary':
    'Correspond selon ce que le navigateur récupère — documents, scripts, XHR/fetch, images, … La ' +
    'variante Excl. inverse la liste.',
  'workbench.docs.anchor.domainType.title': 'Type de domaine',
  'workbench.docs.anchor.domainType.summary':
    'First-party correspond aux requêtes vers le même site que la page ; third-party correspond aux ' +
    'requêtes inter-sites.',
  'workbench.docs.anchor.headers.title': 'En-tête de réponse',
  'workbench.docs.anchor.headers.summary':
    'Correspond sur un en-tête de la réponse reçue — par présence, ou par valeur quand une est donnée.',
  'workbench.docs.anchor.redirectRegex.title': 'Substitution regex',
  'workbench.docs.anchor.redirectRegex.summary':
    "Avec une condition Regex d'URL, \\1, \\2 … insèrent les groupes capturés dans la cible de " + 'redirection.',
  'workbench.docs.anchor.requestBodyDynamic.title': 'Dynamique (JavaScript)',
  'workbench.docs.anchor.requestBodyDynamic.summary':
    'Exécute votre JavaScript contre chaque requête correspondante pour construire le corps sortant à ' +
    "partir de l'original.",
  'workbench.docs.anchor.responseDynamic.title': 'Dynamique (JavaScript)',
  'workbench.docs.anchor.responseDynamic.summary':
    'Exécute votre JavaScript pour chaque réponse correspondante — en transformant la vraie réponse ' +
    '(réseau) ou en en construisant une de zéro (mock).',
  'workbench.docs.anchor.requestBodyGraphql.title': "Filtre d'opération GraphQL",
  'workbench.docs.anchor.requestBodyGraphql.summary':
    "Conditionne en plus la règle au nom d'opération GraphQL trouvé dans la charge de la requête.",
  'workbench.docs.anchor.responseGraphql.title': "Filtre d'opération GraphQL",
  'workbench.docs.anchor.responseGraphql.summary':
    "Conditionne en plus la règle au nom d'opération GraphQL trouvé dans la charge de la requête.",
} as const satisfies Catalog;
