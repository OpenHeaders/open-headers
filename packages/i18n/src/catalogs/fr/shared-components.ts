/**
 * Shared component families — French. Mirrors
 * `catalogs/en/shared-components.ts` key for key; see that file for the
 * family rules and the raw-by-design technical plane.
 */

import type { Catalog } from '../../types';

export const sharedComponents = {
  // ── TemplateInput field chrome ─────────────────────────────────────
  'shared.templateInput.editValue': 'Modifier la valeur',
  'shared.templateInput.showValue': 'Afficher la valeur',
  'shared.templateInput.hideValue': 'Masquer la valeur',
  'shared.templateInput.clearValue': 'Effacer la valeur',
  'shared.templateInput.unresolvedDot': 'Contient une variable non résolue',

  // ── Suggestion popover ─────────────────────────────────────────────
  'shared.templateInput.createNamed': 'Créer la variable « {name} »',
  'shared.templateInput.createNamedInScope': 'Créer la variable « {name} » dans {scope}',
  'shared.templateInput.noMatches': 'Aucune correspondance',
  'shared.templateInput.footerNavigate': '↑↓ naviguer',
  'shared.templateInput.footerSelect': '↵ sélectionner',
  'shared.templateInput.footerClose': 'esc fermer',

  // ── Suggestion rows (previews + badges) ────────────────────────────
  'shared.templateInput.capturedAtRuntime': "Capturée à l'exécution",
  'shared.templateInput.totpPreview': 'TOTP à {digits} chiffres · {period}s',
  'shared.templateInput.totpPreviewIssuer': 'TOTP à {digits} chiffres · {period}s · {issuer}',
  'shared.templateInput.emptyValue': '(vide)',
  'shared.templateInput.staleBadge': 'périmée',
  'shared.templateInput.needsRerunBadge': 'réexécution requise',
  'shared.templateInput.disabledBadge': 'désactivée',
  'shared.templateInput.scaffold.vault': 'Ajouter un secret',
  'shared.templateInput.scaffold.env': "Ajouter une variable d'environnement",
  'shared.templateInput.scaffold.collection': 'Ajouter une variable de collection',
  'shared.templateInput.scaffold.workspace': "Ajouter une variable d'espace de travail",
  'shared.templateInput.scaffold.dynamic': 'Générateurs intégrés — uuid, timestamp, …',
  'shared.templateInput.reservedFile': 'Références de fichiers bientôt disponibles',

  // ── Variable hover / create popover ────────────────────────────────
  'shared.templateInput.enterValue': 'Saisir une valeur',
  'shared.templateInput.foundIn': 'Trouvée dans :',
  'shared.templateInput.scopeFixedTooltip':
    'La portée est fixée par le préfixe {prefix} — modifiez la référence pour la changer.',
  'shared.templateInput.addToScope': 'Ajouter à : {scope}',
  'shared.templateInput.addToPickScope': 'Ajouter à : choisir la portée',
  'shared.templateInput.resolvedDefault': 'Résolue : par défaut',
  'shared.templateInput.resolvedDefaultNoEnv': 'Résolue : par défaut (aucun env actif)',
  'shared.templateInput.noActiveEnvHint':
    "Aucun environnement sélectionné — choisissez-en un dans le sélecteur d'environnements pour ajouter une " +
    "variable d'environnement.",
  'shared.templateInput.noCollectionHint':
    'Aucune collection active — ouvrez une collection pour ajouter une variable de collection.',

  // Resolved-scope labels (badge line in the hover popover).
  'shared.templateInput.scope.vault': 'Vault',
  'shared.templateInput.scope.vaultTotp': 'Vault · TOTP',
  'shared.templateInput.scope.environmentNamed': 'Environnement · {name}',
  'shared.templateInput.scope.collectionNamed': 'Collection · {name}',
  'shared.templateInput.scope.workspace': 'Espace de travail',
  'shared.templateInput.scope.live': 'Live',
  'shared.templateInput.scope.liveOverride': 'Live · substitution',
  'shared.templateInput.scope.stepNamed': 'Étape · {capture}',
  'shared.templateInput.scope.fileNamed': 'Fichier · {name}',
  'shared.templateInput.scope.dynamic': 'Dynamique',
  'shared.templateInput.scope.unresolved': 'Non résolue',

  // Create-flow destination scopes ("Add to" picker).
  'shared.templateInput.createScope.environment': 'Environnement',
  'shared.templateInput.createScope.collection': 'Collection',
  'shared.templateInput.createScope.workspace': 'Espace de travail',
  'shared.templateInput.createScope.vault': 'Vault',
  'shared.templateInput.createScope.noActiveEnvHint': 'aucun env actif',

  // Why a reference is unresolved.
  'shared.templateInput.unresolved.emptyReference': 'Référence vide',
  'shared.templateInput.unresolved.unknownNamespace': 'Espace de noms inconnu',
  'shared.templateInput.unresolved.dynamic':
    'Aucun générateur intégré de ce nom. Choisissez-en un dans la liste de suggestions {{dynamic.…}}.',
  'shared.templateInput.unresolved.step': "Ne se résout que lorsqu'une chaîne Live Workflow est en cours d'exécution.",
  'shared.templateInput.unresolved.envNotSet': "Non définie dans l'environnement « {name} ».",
  'shared.templateInput.unresolved.noActiveEnv': "Aucun environnement actif n'est sélectionné.",
  'shared.templateInput.unresolved.live': 'Aucune variable Live de ce nom (ou aucune valeur en cache pour le moment).',
  'shared.templateInput.unresolved.notDefined': "N'est définie dans aucune portée.",

  // Save dispatch results (update + create + toast surface).
  'shared.templateInput.save.pickScope': 'Choisissez une portée dans « Ajouter à »',
  'shared.templateInput.save.totpInVaultEditor': "Les secrets TOTP se modifient dans l'éditeur du Vault",
  'shared.templateInput.save.vaultKindChanged': "Le type de l'entrée du Vault a changé entre-temps",
  'shared.templateInput.save.notEditable': 'Non modifiable',
  'shared.templateInput.save.noActiveEnv': 'Aucun environnement actif',
  'shared.templateInput.save.noCollection': 'Aucune collection dans ce contexte',
  'shared.templateInput.save.saved': 'Enregistré',
  'shared.templateInput.save.duplicateName': 'Une variable de ce nom existe déjà dans cette portée.',
  'shared.templateInput.save.notFound': 'Variable introuvable — elle a peut-être été supprimée.',
  'shared.templateInput.save.failed': "Échec de l'enregistrement",

  // ── Set-as-variable popover + selection context menu ───────────────
  'shared.templateInput.setAsVariable': 'Définir comme variable',
  'shared.templateInput.setAsNewVariable': 'Définir comme nouvelle variable',
  'shared.templateInput.variableName': 'Nom de la variable',
  'shared.templateInput.variableValue': 'Valeur de la variable',
  'shared.templateInput.valuePlaceholder': 'Valeur',
  'shared.templateInput.menu.cut': 'Couper',
  'shared.templateInput.menu.paste': 'Coller',

  // ── Monaco variable completions (detail + hover documentation) ─────
  'shared.templateInput.completion.scope.vault': 'Secret du Vault',
  'shared.templateInput.completion.scope.env': 'Environnement',
  'shared.templateInput.completion.scope.collection': 'Collection',
  'shared.templateInput.completion.scope.workspace': 'Espace de travail',
  'shared.templateInput.completion.scope.live': 'Source',
  'shared.templateInput.completion.scope.step': "Capture d'étape du flux de la source",
  'shared.templateInput.completion.scope.file': 'Référence de fichier',
  'shared.templateInput.completion.scope.dynamic': 'Générateur dynamique',
  'shared.templateInput.completion.staleSuffix': '(périmée)',
  'shared.templateInput.completion.comingSoon': 'bientôt disponible',
  'shared.templateInput.completion.capturedAtRuntime': "capturée à l'exécution",
  'shared.templateInput.completion.totpDetail': 'Code TOTP ({digits} chiffres, {period}s)',
  'shared.templateInput.completion.valueHiddenSensitive': 'Valeur masquée (portée sensible).',
  'shared.templateInput.completion.valueHiddenStale': 'Valeur masquée (variable Live périmée).',
  'shared.templateInput.completion.valueDoc': '**Valeur :** `{value}`',
  'shared.templateInput.completion.staleValueDoc': '**Valeur périmée :** `{value}`',
  'shared.templateInput.completion.capturedWhenRuns': "Capturée à l'exécution du workflow.",
  'shared.templateInput.completion.totpDoc':
    '**Code TOTP** — {algorithm}, {digits} chiffres, se renouvelle toutes les {period}s.',
  'shared.templateInput.completion.totpDocIssuer':
    '**Code TOTP** pour **{issuer}** — {algorithm}, {digits} chiffres, se renouvelle toutes les {period}s.',

  // ── Value editors: shared chrome ───────────────────────────────────
  'shared.valueEditors.decoded': 'Décodé',
  'shared.valueEditors.encodedPreview': 'Aperçu encodé',
  'shared.valueEditors.cannotEncode': "Encodage impossible — la valeur modifiée n'est pas valide pour ce type",
  'shared.valueEditors.encodedCopied': 'Valeur encodée copiée dans le presse-papiers',
  'shared.valueEditors.copyFailed': 'Échec de la copie dans le presse-papiers',
  'shared.valueEditors.openAsDocument': 'Ouvrir comme document',
  'shared.valueEditors.decode': 'Décoder',
  'shared.valueEditors.decodeChipView': 'Afficher le décodage — {title}',
  'shared.valueEditors.decodeChipEdit': 'Décoder et modifier — {title}',
  'shared.valueEditors.editJwt': 'Modifier le JWT',
  'shared.valueEditors.viewJwt': 'Afficher le JWT',

  // ── Value editors: glance popover ──────────────────────────────────
  'shared.valueEditors.glance.title': 'Valeur décodée',
  'shared.valueEditors.glance.openTab': 'Ouvrir dans un nouvel onglet',
  'shared.valueEditors.glance.openModal': 'Ouvrir en fenêtre modale',
  'shared.valueEditors.glance.moreClaims': '+{count} autres',
  'shared.valueEditors.glance.signatureElided':
    'Signature masquée — ouvrez le document ou la fenêtre modale pour le jeton complet.',

  // ── Value editors: pair grid ───────────────────────────────────────
  'shared.valueEditors.grid.name': 'Nom',
  'shared.valueEditors.grid.key': 'Clé',
  'shared.valueEditors.grid.value': 'Valeur',
  'shared.valueEditors.grid.flag': 'indicateur',
  'shared.valueEditors.grid.ariaNamePairs': 'Paires nom/valeur',
  'shared.valueEditors.grid.ariaKeyPairs': 'Paires clé/valeur',
  'shared.valueEditors.grid.ariaRowName': 'Nom de la ligne {row}',
  'shared.valueEditors.grid.ariaRowKey': 'Clé de la ligne {row}',
  'shared.valueEditors.grid.ariaRowValue': 'Valeur de la ligne {row}',
  'shared.valueEditors.grid.moveRowUp': 'Monter la ligne {row}',
  'shared.valueEditors.grid.moveRowDown': 'Descendre la ligne {row}',
  'shared.valueEditors.grid.deleteRow': 'Supprimer la ligne {row}',
  'shared.valueEditors.grid.addRow': 'Ajouter une ligne',

  // ── Value editors: JWT modal ───────────────────────────────────────
  'shared.valueEditors.jwt.title': 'Éditeur JWT',
  'shared.valueEditors.jwt.titleViewer': 'JWT',
  'shared.valueEditors.jwt.modified': 'Modifié',
  'shared.valueEditors.jwt.decodeErrorTitle': 'Impossible de décoder le jeton',
  'shared.valueEditors.jwt.decoded': 'Décodé',
  'shared.valueEditors.jwt.encoded': 'Encodé',
  'shared.valueEditors.jwt.header': 'Header',
  'shared.valueEditors.jwt.payload': 'Payload',
  'shared.valueEditors.jwt.claims': 'Claims :',
  'shared.valueEditors.jwt.rawToken': 'Jeton brut',
  'shared.valueEditors.jwt.pasteOrEdit': 'Collez ou modifiez le jeton brut',
  'shared.valueEditors.jwt.notDecodable': "Ce n'est pas un JWT décodable",
  'shared.valueEditors.jwt.structure': 'Structure :',
  'shared.valueEditors.jwt.resignWithSecret': 'Re-signer avec un secret',
  'shared.valueEditors.jwt.algFromHeader': '{algorithm} depuis le header',
  'shared.valueEditors.jwt.signingSecret': 'Secret de signature',
  'shared.valueEditors.jwt.secretMemoryNote': "Conservé en mémoire uniquement et effacé à la fermeture de l'éditeur.",
  'shared.valueEditors.jwt.tokenExpired': 'Jeton expiré',
  'shared.valueEditors.jwt.tokenNotExpired': 'Jeton non expiré',
  'shared.valueEditors.jwt.expiredOn': 'Expiré le {date}',
  'shared.valueEditors.jwt.expiresOn': 'Expire le {date}',
  'shared.valueEditors.jwt.resigned': 'Jeton re-signé avec {algorithm}',
  'shared.valueEditors.jwt.resignedDescription':
    "Enregistrer écrit le jeton signé avec votre secret — l'aperçu ci-dessus est exactement ce qui sera enregistré.",
  'shared.valueEditors.jwt.cannotResign': 'Impossible de re-signer cet algorithme',
  'shared.valueEditors.jwt.cannotResignDescription':
    'Seuls les algorithmes HMAC (HS256, HS384, HS512) peuvent être re-signés ici. La signature ' +
    "d'origine est conservée à la place.",
  'shared.valueEditors.jwt.signError': 'Impossible de signer le jeton',
  'shared.valueEditors.jwt.signatureInvalid': "La signature n'est plus valide",
  'shared.valueEditors.jwt.signatureInvalidDescription':
    "La signature d'origine est conservée telle quelle : les serveurs qui la vérifient rejetteront le jeton " +
    'modifié. Saisissez un secret de signature pour le re-signer.',
  'shared.valueEditors.jwt.copied': 'JWT copié dans le presse-papiers',

  // ── Value editors: detected-value titles ───────────────────────────
  'shared.valueEditors.valueTitle.jwt': 'Payload JWT',
  'shared.valueEditors.valueTitle.urlEncoded': 'Valeur encodée en URL',
  'shared.valueEditors.valueTitle.base64': 'Valeur Base64',
  'shared.valueEditors.valueTitle.hex': 'Valeur encodée en hexadécimal',
  'shared.valueEditors.valueTitle.timestamp': 'Horodatage Unix',
  'shared.valueEditors.valueTitle.json': 'Valeur JSON',
  'shared.valueEditors.valueTitle.jsonString': 'Chaîne entre guillemets',
  'shared.valueEditors.valueTitle.dataUri': 'Data URI',
  'shared.valueEditors.valueTitle.cookie': 'Valeur de Cookie',
  'shared.valueEditors.valueTitle.csp': 'Content Security Policy',
  'shared.valueEditors.valueTitle.httpDate': 'Date HTTP',
  'shared.valueEditors.valueTitle.queryString': 'Chaîne de requête',
  'shared.valueEditors.valueTitle.cacheControl': 'Cache-Control',
  'shared.valueEditors.valueTitle.hsts': 'Strict-Transport-Security',
  'shared.valueEditors.valueTitle.contentDisposition': 'Content-Disposition',
  'shared.valueEditors.valueTitle.link': 'En-tête Link',
  'shared.valueEditors.valueTitle.authParams': "Paramètres d'autorisation",
  'shared.valueEditors.valueTitle.acceptList': 'Liste Accept',

  // ── Scope-colors registry (canonical scope labels — badges, rows) ──
  'shared.scopeColors.vault': 'Secret du Vault',
  'shared.scopeColors.environment': "Variable d'environnement",
  'shared.scopeColors.collection': 'Variable de collection',
  'shared.scopeColors.workspace': "Variable d'espace de travail",
  'shared.scopeColors.live': 'Variable Live (adossée à un workflow)',
  'shared.scopeColors.step': "Capture d'étape de workflow",
  'shared.scopeColors.file': 'Référence de fichier',
  'shared.scopeColors.dynamic': 'Générateur dynamique',

  // ── Value editors: in-field edit tooltips ──────────────────────────
  'shared.valueEditors.editTooltip.jwt': 'Modifier comme JWT',
  'shared.valueEditors.editTooltip.urlEncoded': 'Modifier la valeur encodée en URL',
  'shared.valueEditors.editTooltip.base64': 'Modifier la valeur Base64',
  'shared.valueEditors.editTooltip.hex': 'Modifier la valeur hexadécimale',
  'shared.valueEditors.editTooltip.timestamp': "Modifier l'horodatage",
  'shared.valueEditors.editTooltip.json': 'Modifier comme JSON',
  'shared.valueEditors.editTooltip.jsonString': 'Modifier la chaîne entre guillemets',
  'shared.valueEditors.editTooltip.dataUri': 'Modifier le contenu du Data URI',
  'shared.valueEditors.editTooltip.cookie': 'Modifier les paires du cookie',
  'shared.valueEditors.editTooltip.csp': 'Modifier les directives CSP',
  'shared.valueEditors.editTooltip.httpDate': 'Modifier la date HTTP',
  'shared.valueEditors.editTooltip.queryString': 'Modifier les paires de requête',
  'shared.valueEditors.editTooltip.cacheControl': 'Modifier les directives de cache',
  'shared.valueEditors.editTooltip.hsts': 'Modifier les directives HSTS',
  'shared.valueEditors.editTooltip.contentDisposition': 'Modifier les paramètres de disposition',
  'shared.valueEditors.editTooltip.link': 'Modifier les liens',
  'shared.valueEditors.editTooltip.authParams': "Modifier les paramètres d'authentification",
  'shared.valueEditors.editTooltip.acceptList': 'Modifier la liste Accept',

  // ── Default entity names ───────────────────────────────────────────
  'shared.defaults.newRulesCollection': 'Nouvelle collection de règles',
  'shared.defaults.newRequestsCollection': 'Nouvelle collection de requêtes',
  'shared.defaults.newEnvironment': 'Nouvel environnement',
  'shared.defaults.newSpec': 'Nouvelle spécification',

  // ── Rule-type registry ─────────────────────────────────────────────
  'shared.ruleTypes.header.label': 'Modifier les en-têtes',
  'shared.ruleTypes.header.description': 'Ajouter, remplacer ou supprimer des en-têtes HTTP',
  'shared.ruleTypes.requestBody.label': 'Modifier le corps de requête API',
  'shared.ruleTypes.requestBody.description':
    'Remplacer ou transformer le corps des requêtes API (fetch/XHR uniquement)',
  'shared.ruleTypes.response.label': 'Modifier la réponse API',
  'shared.ruleTypes.response.description':
    'Simuler ou modifier le statut, le corps et les en-têtes des réponses API (fetch/XHR uniquement)',
  'shared.ruleTypes.queryParam.label': 'Modifier les paramètres de requête',
  'shared.ruleTypes.queryParam.description': "Ajouter, remplacer ou supprimer des paramètres d'URL",
  'shared.ruleTypes.inject.label': 'Injecter un script/une feuille de style',
  'shared.ruleTypes.inject.description': 'Injecter du JavaScript ou du CSS dans les pages',
  'shared.ruleTypes.ws.label': 'Modifier les messages WebSocket',
  'shared.ruleTypes.ws.description':
    'Remplacer, injecter ou supprimer des trames WebSocket (sockets de page uniquement)',
  'shared.ruleTypes.sse.label': 'Modifier les Server-Sent Events',
  'shared.ruleTypes.sse.description': 'Remplacer, injecter ou supprimer des événements SSE (flux de page uniquement)',
  'shared.ruleTypes.block.label': 'Bloquer des requêtes',
  'shared.ruleTypes.block.description': "Empêcher les requêtes d'aboutir",
  'shared.ruleTypes.redirect.label': 'Rediriger des requêtes',
  'shared.ruleTypes.redirect.description': 'Rediriger vers une autre URL',
  'shared.ruleTypes.delay.label': 'Retarder des requêtes',
  'shared.ruleTypes.delay.description': 'Ajouter de la latence aux requêtes réseau (fetch/XHR uniquement)',
  'shared.ruleTypes.auth.label': "Répondre à un défi d'authentification",
  'shared.ruleTypes.auth.description':
    "Fournir des identifiants pour un défi d'authentification HTTP/proxy (nécessite le mode débogage)",

  // ── System rule-template registry ──────────────────────────────────
  'shared.ruleTemplates.blankRule': 'Règle vierge',

  'shared.ruleTemplates.folder.corsSecurity': 'CORS et sécurité',
  'shared.ruleTemplates.folder.authentication': 'Authentification',
  'shared.ruleTemplates.folder.privacy': 'Confidentialité',
  'shared.ruleTemplates.folder.testing': 'Tests',
  'shared.ruleTemplates.folder.urlHandling': "Gestion d'URL",
  'shared.ruleTemplates.folder.tracking': 'Suivi',
  'shared.ruleTemplates.folder.debugging': 'Débogage',
  'shared.ruleTemplates.folder.appearance': 'Apparence',
  'shared.ruleTemplates.folder.rest': 'REST',
  'shared.ruleTemplates.folder.graphql': 'GraphQL',
  'shared.ruleTemplates.folder.statusCodes': 'Codes de statut',
  'shared.ruleTemplates.folder.dynamic': 'Dynamique',

  'shared.ruleTemplates.corsBypass.name': 'Contournement CORS',
  'shared.ruleTemplates.corsBypass.description':
    'Supprimer les en-têtes CORS restrictifs pour autoriser les requêtes cross-origin pendant le développement',
  'shared.ruleTemplates.removeCsp.name': 'Supprimer la CSP',
  'shared.ruleTemplates.removeCsp.description': 'Retirer les en-têtes Content-Security-Policy pour le développement',
  'shared.ruleTemplates.allowEmbedding.name': "Autoriser l'intégration",
  'shared.ruleTemplates.allowEmbedding.description': "Supprimer X-Frame-Options pour autoriser l'affichage en iframe",
  'shared.ruleTemplates.apiAuth.name': "Injection d'authentification API",
  'shared.ruleTemplates.apiAuth.description': "Injecter automatiquement l'en-tête Authorization dans les appels API",
  'shared.ruleTemplates.customUa.name': 'User-Agent personnalisé',
  'shared.ruleTemplates.customUa.description': "Remplacer l'en-tête User-Agent pour des domaines spécifiques",
  'shared.ruleTemplates.blockCookies.name': 'Bloquer les cookies',
  'shared.ruleTemplates.blockCookies.description': "Supprimer l'en-tête Cookie des requêtes sortantes",
  'shared.ruleTemplates.testMerge.name': 'Test Merge (httpbin)',
  'shared.ruleTemplates.testMerge.description':
    "Testez l'opération Merge en ajoutant à un en-tête de réponse.\n1. Activez cette règle\n2. Ouvrez httpbin.org " +
    'dans un nouvel onglet\n3. Exécutez dans la console : fetch("https://httpbin.org/get").then(r=>{console.log(' +
    '"Content-Type:",r.headers.get("Content-Type"))})\n4. Content-Type doit afficher "application/json, ' +
    'x-openheaders-merged"',
  'shared.ruleTemplates.blockTrackers.name': 'Bloquer les traqueurs',
  'shared.ruleTemplates.blockTrackers.description': "Bloquer les scripts d'analyse et de pistage",
  'shared.ruleTemplates.blockAds.name': 'Bloquer les publicités',
  'shared.ruleTemplates.blockAds.description': 'Bloquer les domaines des régies publicitaires courantes',
  'shared.ruleTemplates.redirectDomain.name': 'Rediriger un domaine',
  'shared.ruleTemplates.redirectDomain.description': "Rediriger tout le trafic d'un domaine vers un autre",
  'shared.ruleTemplates.forceHttps.name': 'Forcer HTTPS',
  'shared.ruleTemplates.forceHttps.description':
    'Passer de HTTP à HTTPS — utilise un groupe de capture regex pour préserver le chemin complet',
  'shared.ruleTemplates.removeUtm.name': 'Supprimer les paramètres UTM',
  'shared.ruleTemplates.removeUtm.description': 'Retirer les paramètres de suivi UTM des URL',
  'shared.ruleTemplates.addDebug.name': 'Ajouter un indicateur de débogage',
  'shared.ruleTemplates.addDebug.description': 'Ajouter un paramètre de requête debug=true aux appels API',
  'shared.ruleTemplates.darkMode.name': 'CSS mode sombre',
  'shared.ruleTemplates.darkMode.description': 'Injecter une feuille de style basique de mode sombre',
  'shared.ruleTemplates.consoleLogger.name': 'Journalisation console',
  'shared.ruleTemplates.consoleLogger.description': 'Journaliser toutes les requêtes fetch dans la console',
  'shared.ruleTemplates.slowApi.name': 'API lente (2s)',
  'shared.ruleTemplates.slowApi.description':
    'Ajouter un délai de 2 secondes aux appels API — tester les états de chargement',
  'shared.ruleTemplates.timeoutTest.name': 'Test de timeout (5s)',
  'shared.ruleTemplates.timeoutTest.description': 'Ajouter un délai de 5 secondes — tester la gestion des timeouts',
  'shared.ruleTemplates.restBodyOverride.name': 'Substitution de corps REST',
  'shared.ruleTemplates.restBodyOverride.description':
    'Remplacer le corps de la requête par une charge utile JSON statique',
  'shared.ruleTemplates.graphqlOverride.name': 'Substitution GraphQL',
  'shared.ruleTemplates.graphqlOverride.description':
    "Remplacer le corps d'une requête GraphQL par une requête et des variables personnalisées",
  'shared.ruleTemplates.mock200.name': 'Mock 200 JSON',
  'shared.ruleTemplates.mock200.description': 'Renvoyer une réponse JSON réussie pour un point de terminaison API REST',
  'shared.ruleTemplates.mock404.name': 'Mock 404',
  'shared.ruleTemplates.mock404.description': 'Renvoyer une réponse 404 Not Found',
  'shared.ruleTemplates.mock500.name': 'Mock erreur serveur',
  'shared.ruleTemplates.mock500.description':
    'Renvoyer une erreur 500 Internal Server Error — tester la gestion des erreurs',
  'shared.ruleTemplates.mockGraphql.name': 'Mock de réponse GraphQL',
  'shared.ruleTemplates.mockGraphql.description':
    'Renvoyer une réponse personnalisée pour une opération GraphQL spécifique',
  'shared.ruleTemplates.mockDynamic.name': 'Réponse REST dynamique',
  'shared.ruleTemplates.mockDynamic.description':
    "Intercepter la vraie réponse de l'API REST et la modifier avec du JavaScript — injecter des données de test, " +
    'retirer des champs ou transformer la forme de la réponse',
  'shared.ruleTemplates.mockDynamicGraphql.name': 'Réponse GraphQL dynamique',
  'shared.ruleTemplates.mockDynamicGraphql.description':
    "Intercepter la réponse d'une opération GraphQL spécifique et la modifier avec du JavaScript — remodeler les " +
    'données, injecter des champs fictifs ou simuler des erreurs',

  // ── Dock-layout chrome ─────────────────────────────────────────────
  'shared.dock.slot.leftTop': 'Gauche haut',
  'shared.dock.slot.leftBottom': 'Gauche bas',
  'shared.dock.slot.rightTop': 'Droite haut',
  'shared.dock.slot.rightBottom': 'Droite bas',
  'shared.dock.slot.bottomLeft': 'Bas gauche',
  'shared.dock.slot.bottomRight': 'Bas droite',
  'shared.dock.hide': 'Masquer',
  'shared.dock.moveTo': 'Déplacer vers',
  'shared.dock.currentSlot': 'emplacement actuel',
  'shared.dock.showToolWindowNames': "Afficher les noms des fenêtres d'outils",
  'shared.dock.hideThisDock': 'Masquer ce dock',
  'shared.dock.closeDock': 'Fermer le dock',
  'shared.dock.panelOptions': 'Options du panneau',
  'shared.dock.hidePanel': 'Masquer le panneau',

  // ── Docs panel chrome ──────────────────────────────────────────────
  'shared.docs.title': 'Docs',
  'shared.docs.contents': 'Sommaire',
  'shared.docs.ariaOpenToc': 'Ouvrir le sommaire',
  'shared.docs.ariaCloseToc': 'Fermer le sommaire',
  'shared.docs.filterPlaceholder': 'Filtrer les sections',
  'shared.docs.noMatches': 'Aucune correspondance',
  'shared.docs.hint.navigate': 'naviguer',
  'shared.docs.hint.open': 'ouvrir',
  'shared.docs.hint.back': 'retour',
  'shared.docs.hint.contents': 'sommaire',
  'shared.docs.previous': 'Précédent',
  'shared.docs.next': 'Suivant',
  'shared.docs.previousTooltip': 'Précédent : {title}',
  'shared.docs.nextTooltip': 'Suivant : {title}',

  // ── Docs section primitives ────────────────────────────────────────
  'shared.docs.callout.note': 'Note',
  'shared.docs.callout.warning': 'Avertissement',
  'shared.docs.callout.tip': 'Astuce',
  'shared.docs.callout.limitation': 'Limitation',
  'shared.docs.example.rule': 'Règle :',
  'shared.docs.example.before': 'Avant :',
  'shared.docs.example.after': 'Après :',
  'shared.docs.example.appliesTo': "S'applique à :",
  'shared.docs.example.wontApply': "Ne s'appliquera pas :",
  'shared.docs.example.suggestion': 'Suggestion :',
  'shared.docs.onThisPage': 'Sur cette page',
  'shared.docs.copyCode': 'Copier le code',
  'shared.docs.surfaces.header': 'Où vous verrez ceci',
  'shared.docs.surfaces.popup': 'Popup',
  'shared.docs.surfaces.sidePanel': 'Panneau latéral',
  'shared.docs.surfaces.workbench': "Éditeur d'espace de travail",
  'shared.docs.surfaces.devtools': 'DevTools',
  'shared.docs.engineScript': 'Par script',

  // ── Split-layout orientation ───────────────────────────────────────
  'shared.splitLayout.horizontal': 'Disposition horizontale — côte à côte',
  'shared.splitLayout.vertical': 'Disposition verticale — empilée',
} as const satisfies Catalog;
