/**
 * Workbench editors — the rule editor, French. The quick editor reuses
 * the `workbench.editors.rule.fields.*` keys directly (S35 field-key
 * reuse law) — field labels here stay consistent with
 * `fr/panel-quick-editor.ts` (`Ajouter un en-tête`, `Tout retirer`,
 * `Passer à {operation}`, `Mock` / `Modification`). Rules are feminine
 * (`Activée` / `Désactivée`). Raw by design: gates AND/OR/NOT, DNR
 * schema vocabulary (`requestDomains`, `url-filter`, `firstParty`,
 * slot ids), `{{ns.NAME}}` reference syntax in placeholders, quoted
 * browser UI phrasing, scheme prefixes, HTTP method lists, `main-frame`
 * and `monkey-patch` loanwords, `frame` (m.) for wire frames.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsRule = {
  // ── Shared editor shell chrome (EditorHeader, SectionInfo) ─────────
  'workbench.editors.header.saved': 'Enregistré',
  'workbench.editors.header.onTop': 'En-tête en haut',
  'workbench.editors.header.atBottom': 'En-tête en bas',
  'workbench.editors.header.moreActions': "Plus d'actions",

  // ── Rule editor shell ──────────────────────────────────────────────
  'workbench.editors.rule.kicker': 'Éditeur de règles',
  'workbench.editors.rule.templates.title': 'Modèles',
  'workbench.editors.rule.templates.infoSummary': "Partez d'un préréglage plutôt que d'un formulaire vierge.",
  'workbench.editors.rule.templates.infoDescription':
    "Les modèles système sont fournis avec l'application ; les modèles utilisateur sont ceux que vous " +
    'enregistrez vous-même via ⋮ → Enregistrer comme modèle utilisateur. Appliquer un modèle ne fait que ' +
    "pré-remplir les champs — ajustez ce que vous voulez avant d'enregistrer.",
  'workbench.editors.rule.templates.blank': 'Vierge',
  'workbench.editors.rule.templates.system': 'Système',
  'workbench.editors.rule.templates.user': 'Utilisateur',
  'workbench.editors.rule.templates.emptyTitle': 'Aucun modèle utilisateur pour le moment',
  'workbench.editors.rule.templates.emptyBeforeMenu':
    'Les modèles utilisateur sont vos propres préréglages réutilisables pour ce type de règle. Configurez la ' +
    'règle comme vous le souhaitez, puis choisissez',
  'workbench.editors.rule.templates.emptyMenuPath': '⋮ → Enregistrer comme modèle utilisateur',
  'workbench.editors.rule.templates.emptyAfterMenu':
    "dans l'en-tête — il apparaîtra ici pour chaque nouvelle règle de ce type.",
  'workbench.editors.rule.saveAsTemplate': 'Enregistrer comme modèle utilisateur',
  'workbench.editors.rule.enabled': 'Activée',
  'workbench.editors.rule.disabled': 'Désactivée',
  'workbench.editors.rule.toast.unknownType': 'Type de règle inconnu',
  'workbench.editors.rule.toast.deletedOtherTab': 'La règle a été supprimée depuis un autre onglet',
  'workbench.editors.rule.toast.updateFailed': 'Échec de la mise à jour de la règle',
  'workbench.editors.rule.toast.updateFailedDetail': 'Échec de la mise à jour de la règle : {message}',
  'workbench.editors.rule.toast.publishFailed': 'Règle enregistrée mais la publication a échoué',
  'workbench.editors.rule.toast.updated': 'Règle mise à jour',
  'workbench.editors.rule.toast.published': 'Règle publiée',
  'workbench.editors.rule.toast.formatSkipped': "Formatage à l'enregistrement ignoré : {reason}",
  'workbench.editors.rule.toast.noCollection': 'Aucune collection trouvée',
  'workbench.editors.rule.toast.restoreFailed': 'Échec de la restauration de la règle',
  'workbench.editors.rule.toast.restored': 'Règle restaurée',
  'workbench.editors.rule.deleted.message': 'Cette règle a été supprimée depuis une autre surface.',
  'workbench.editors.rule.deleted.description':
    "Restaurer crée une copie fraîche avec un nouvel id (la tombstone d'origine est définitive — voir la spec " +
    'du moteur de sync, §7.2).',
  'workbench.editors.rule.deleted.restore': 'Restaurer',
  'workbench.editors.rule.conditionsPane.title': 'Conditions',
  'workbench.editors.rule.conditionsPane.infoSummary':
    "Les conditions décident des requêtes auxquelles cette règle s'applique.",
  'workbench.editors.rule.conditionsPane.infoAndBefore': 'Les lignes se combinent avec',
  'workbench.editors.rule.conditionsPane.infoAndAfter': '— chaque ligne doit correspondre.',
  'workbench.editors.rule.conditionsPane.infoOrBefore': "Les valeurs d'une même ligne se combinent avec",
  'workbench.editors.rule.conditionsPane.infoOrAfter':
    '(la pastille OR marque les lignes qui acceptent plusieurs valeurs).',
  'workbench.editors.rule.conditionsPane.infoAddOne': 'Ajoutez au moins une condition.',

  // ── Condition-type registry (workbench picker vocabulary) ──────────
  // Deliberately per-surface: the popup's popup.conditions.* short/full
  // chip vocabulary is a different rendering context; only the concepts
  // overlap. Duplicated English across per-context keys is fine (S5).
  'workbench.editors.rule.condition.group.urlMatching': "Correspondance d'URL",
  'workbench.editors.rule.condition.group.domainFiltering': 'Filtrage par domaine',
  'workbench.editors.rule.condition.group.requestFiltering': 'Filtrage des requêtes',
  'workbench.editors.rule.condition.group.headerMatching': "Correspondance d'en-têtes",
  'workbench.editors.rule.condition.type.urlFilter': "Motif d'URL",
  'workbench.editors.rule.condition.type.urlRegex': "Regex d'URL",
  'workbench.editors.rule.condition.type.requestDomains': 'Domaines de requête',
  'workbench.editors.rule.condition.type.excludeRequestDomains': 'Exclure des domaines',
  'workbench.editors.rule.condition.type.initiatorDomains': 'Domaines initiateurs',
  'workbench.editors.rule.condition.type.excludeInitiatorDomains': 'Excl. initiateur',
  'workbench.editors.rule.condition.type.requestMethods': 'Méthodes',
  'workbench.editors.rule.condition.type.excludeRequestMethods': 'Excl. méthodes',
  'workbench.editors.rule.condition.type.resourceTypes': 'Types de ressource',
  'workbench.editors.rule.condition.type.excludeResourceTypes': 'Excl. ressources',
  'workbench.editors.rule.condition.type.domainType': 'Type de domaine',
  'workbench.editors.rule.condition.type.responseHeader': 'En-tête de réponse',
  'workbench.editors.rule.condition.type.excludeResponseHeader': 'Excl. en-tête rép.',
  'workbench.editors.rule.condition.suffix.notSupported': ' — non pris en charge par Chrome DNR',
  'workbench.editors.rule.condition.suffix.alreadyUsed': ' — déjà utilisé',
  'workbench.editors.rule.condition.firstParty': 'Première partie',
  'workbench.editors.rule.condition.thirdParty': 'Tierce partie',

  // ── ConditionEditor ────────────────────────────────────────────────
  'workbench.editors.rule.condition.empty': 'Aucune condition — la règle ne correspondra à aucune requête',
  'workbench.editors.rule.condition.andTag': 'AND',
  'workbench.editors.rule.condition.andTooltip':
    'Les lignes se combinent avec AND — chaque ligne doit correspondre pour que la règle se déclenche. Chaque ' +
    'ligne cible un champ DNR différent, le AND entre lignes est donc exact. Pour combiner plusieurs valeurs ' +
    'en OR dans un même champ, listez-les dans une seule ligne (voir la pastille OR de la ligne).',
  'workbench.editors.rule.condition.notTag': 'NOT',
  'workbench.editors.rule.condition.notTooltip':
    "C'est une condition d'exclusion — la règle ne se déclenche que quand AUCUNE des valeurs listées ne correspond.",
  'workbench.editors.rule.condition.orTag': 'OR',
  'workbench.editors.rule.condition.orTooltip':
    "Plusieurs valeurs dans cette ligne correspondent si N'IMPORTE laquelle correspond (OR). Les lignes " +
    'ci-dessous se combinent avec AND.',
  'workbench.editors.rule.condition.oneValueTag': '1 valeur',
  'workbench.editors.rule.condition.oneValueTooltip':
    "Cette condition prend une seule valeur — séparer par des virgules n'a aucun effet. Les lignes ci-dessous " +
    'se combinent avec AND.',
  'workbench.editors.rule.condition.headerNamePlaceholder': "Nom d'en-tête égal à...",
  'workbench.editors.rule.condition.headerValuePlaceholder': "Valeur d'en-tête égale à...",
  'workbench.editors.rule.condition.selectMethods': 'Sélectionnez des méthodes',
  'workbench.editors.rule.condition.selectTypes': 'Sélectionnez des types',
  'workbench.editors.rule.condition.selectType': 'Sélectionnez un type',
  'workbench.editors.rule.condition.valuePlaceholder': 'valeur',
  'workbench.editors.rule.condition.add': 'Ajouter une condition',

  // ── Condition issue banners (kind → key; core message stays for logs) ─
  'workbench.editors.rule.issue.duplicateSlot':
    "Seule la dernière ligne {type} s'applique — la valeur de cette ligne n'atteindra pas Chrome. Retirez " +
    'cette ligne, ou déplacez ses valeurs dans la ligne qui gagne.',
  'workbench.editors.rule.issue.mutexConflict':
    "{type} et {winningType} partagent un même slot DNR — seul le dernier s'applique. Choisissez-en un.",
  'workbench.editors.rule.issue.unsupportedByDnr':
    "Ce type de condition n'est pas encore pris en charge par Chrome DNR — la règle s'enregistre quand même " +
    "mais cette ligne n'envoie rien sur le réseau.",
  'workbench.editors.rule.issue.emptyUrlFilter': "Le motif d'URL ne peut pas être vide.",
  'workbench.editors.rule.issue.emptyUrlRegex': "La regex d'URL ne peut pas être vide.",
  'workbench.editors.rule.issue.urlFilterWhitespace':
    "Le motif d'URL ne peut pas contenir d'espaces — Chrome rejette les règles avec des espaces dans url-filter.",
  'workbench.editors.rule.issue.urlFilterNonAscii':
    "Le motif d'URL contient des caractères non ASCII — Chrome les rejette. Utilisez le punycode (xn--…) pour " +
    "les noms d'hôte IDN.",
  'workbench.editors.rule.issue.urlFilterRegexSyntax':
    "Cela ressemble à une regex — dans Motif d'URL, les caractères comme `(`, `[`, `+`, `?`, `\\d` sont pris " +
    "littéralement. Passez à Regex d'URL si vous avez besoin de la syntaxe regex.",
  'workbench.editors.rule.issue.regexLookbehind':
    'Le moteur regex de Chrome (RE2) ne prend pas en charge les assertions lookbehind ((?<=…), (?<!…)). La ' +
    'règle peut échouer à se charger.',
  'workbench.editors.rule.issue.regexNamedGroup':
    'Le moteur regex de Chrome (RE2) ne prend pas en charge les groupes nommés de style Python ((?P<name>…)). ' +
    'La règle peut échouer à se charger.',
  'workbench.editors.rule.issue.invalidUrlRegex': 'Regex invalide : {reason}',
  'workbench.editors.rule.issue.invalidMethod':
    "« {value} » n'est pas une méthode HTTP valide. Autorisées : GET, POST, PUT, PATCH, DELETE, HEAD, " +
    'OPTIONS, CONNECT, TRACE.',
  'workbench.editors.rule.issue.invalidResourceType':
    "« {value} » n'est pas un type de ressource valide. Choisissez dans la liste déroulante.",
  'workbench.editors.rule.issue.invalidDomainType':
    "« {value} » n'est pas un type de domaine valide. Utilisez « firstParty » ou « thirdParty ».",
  'workbench.editors.rule.issue.headerNameRequired': "Le nom d'en-tête est requis.",
  // Domain-list issues — one key per DomainIssueKind.
  'workbench.editors.rule.issue.domain.whitespace':
    "Espace dans la valeur — séparez les noms d'hôte par une virgule. requestDomains prend un seul nom " +
    "d'hôte nu par entrée.",
  'workbench.editors.rule.issue.domain.scheme':
    "Retirez le schéma — le requestDomains de Chrome ne prend que des noms d'hôte, pas des URL.",
  'workbench.editors.rule.issue.domain.wildcard':
    'Retirez le joker — requestDomains couvre automatiquement tous les sous-domaines, « *.foo.com » est donc ' +
    'simplement « foo.com ».',
  'workbench.editors.rule.issue.domain.port':
    "Retirez le port — requestDomains ne compare que le nom d'hôte ; la règle couvre automatiquement tous les ports.",
  'workbench.editors.rule.issue.domain.uppercase':
    "Mettez le nom d'hôte en minuscules — Chrome n'accepte que l'ASCII minuscule dans requestDomains.",
  'workbench.editors.rule.issue.domain.nonAscii':
    "Le nom d'hôte contient des caractères que Chrome rejette dans requestDomains (probablement une entrée " +
    'non ASCII / IDN). Utilisez la forme punycode (xn--…).',
  'workbench.editors.rule.issue.domain.empty': "Nom d'hôte vide — retirez cette ligne.",
  'workbench.editors.rule.issue.domain.affected': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} entrée affectée',
      many: '{count} entrées affectées',
      other: '{count} entrées affectées',
    }),
  'workbench.editors.rule.issue.domain.cleanUp': 'Nettoyer',

  // ── Action issue banner (kind → key; header-plane kinds stay raw) ───
  'workbench.editors.rule.actionIssue.redirectWhitespace': "La cible de redirection ne peut pas contenir d'espaces.",
  'workbench.editors.rule.actionIssue.invalidRedirectUrl':
    'La cible de redirection doit être une URL complète (http://, https://, chrome-extension://) ou un chemin ' +
    'commençant par /.',
  'workbench.editors.rule.actionIssue.injectUrlScheme':
    "L'URL source doit utiliser http://, https:// ou chrome-extension://.",
  'workbench.editors.rule.actionIssue.injectUrlInvalid': "L'URL source n'est pas une URL valide.",
  'workbench.editors.rule.actionIssue.invalidStatusCode': 'Le code de statut doit être un entier entre 100 et 599.',
  'workbench.editors.rule.actionIssue.invalidParamName':
    "Le nom du paramètre ne peut pas contenir `&`, `=`, `#`, `?` ni d'espaces.",
  'workbench.editors.rule.actionIssue.delayAboveNavigationCap':
    'Le délai main-frame est plafonné à 30000ms ; les valeurs au-dessus sont écrêtées sur le réseau.',
  'workbench.editors.rule.actionIssue.delayAboveFetchCap':
    'Le monkey-patch XHR/fetch plafonne les délais à 5000ms pour éviter la famine du pool de connexions HTTP. ' +
    "Les redirections main-frame honorent jusqu'à 30000ms.",
  'workbench.editors.rule.actionIssue.invalidContentType':
    'Le type de contenu doit ressembler à « type/subtype » (p. ex. application/json).',
  'workbench.editors.rule.actionIssue.graphqlKeyRequired': 'La clé du filtre GraphQL est requise.',
  'workbench.editors.rule.actionIssue.messageFilterValueRequired':
    'La valeur du filtre de message est requise quand un filtre est configuré.',
  'workbench.editors.rule.actionIssue.messageFilterInvalidRegex':
    "Le filtre de message n'est pas une expression régulière valide.",
  'workbench.editors.rule.actionIssue.injectTriggerRequiresFilter':
    'Injecter après un message correspondant requiert un filtre de message.',

  // ── Resolution banner ──────────────────────────────────────────────
  'workbench.editors.rule.resolution.header': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} variable non résolue dans cette règle',
      many: '{count} variables non résolues dans cette règle',
      other: '{count} variables non résolues dans cette règle',
    }),
  'workbench.editors.rule.resolution.reason.unresolved': 'non résolu',
  'workbench.editors.rule.resolution.reason.unsetInScope': 'hors de portée',
  'workbench.editors.rule.resolution.reason.unknownNamespace': 'espace de noms inconnu',
  'workbench.editors.rule.resolution.reason.stepOutOfContext': "réf. d'étape hors de portée",
  'workbench.editors.rule.resolution.reason.empty': 'vide',
  'workbench.editors.rule.resolution.reason.invalidResolvedValue': 'valeur invalide',
  'workbench.editors.rule.resolution.reason.secretAuthorizationRequired': 'autorisation requise',
  'workbench.editors.rule.resolution.reason.secretNotFound': 'secret introuvable',
  'workbench.editors.rule.resolution.reason.secretUnavailable': 'gestionnaire indisponible',
  'workbench.editors.rule.resolution.hint.noCacheForEnv':
    "aucune exécution en cache pour l'env « {envName} » — ouvrez le workflow et cliquez sur Actualiser sous " +
    'cet env pour la remplir',
  'workbench.editors.rule.resolution.hint.disabledLv':
    "la variable Live est désactivée — activez-la dans l'éditeur de Variables Live",
  'workbench.editors.rule.resolution.hint.draftLv':
    'la variable Live est un brouillon — ouvrez-la et cliquez sur Enregistrer pour la publier',
  'workbench.editors.rule.resolution.noEnvironment': 'Aucun environnement',
  'workbench.editors.rule.resolution.activeEnvFallback': 'env actif',

  // ── Rule fields — cross-type vocabulary ────────────────────────────
  'workbench.editors.rule.fields.actionsTitle': 'Actions',
  'workbench.editors.rule.fields.addAction': 'Ajouter une action',
  'workbench.editors.rule.fields.reset': 'Réinitialiser',
  'workbench.editors.rule.fields.optionalTag': '(facultatif)',
  'workbench.editors.rule.fields.opAddReplace': 'Ajouter / Remplacer',
  'workbench.editors.rule.fields.opAppend': 'Ajouter à la suite',
  'workbench.editors.rule.fields.opRemove': 'Retirer',
  'workbench.editors.rule.fields.opMerge': 'Fusionner',
  'workbench.editors.rule.fields.opReplaceOnly': 'Remplacer uniquement',
  'workbench.editors.rule.fields.opRemoveAll': 'Tout retirer',
  'workbench.editors.rule.fields.operatorEquals': 'Égal à',
  'workbench.editors.rule.fields.operatorContains': 'Contient',
  'workbench.editors.rule.fields.restApi': 'API REST',
  'workbench.editors.rule.fields.graphqlApi': 'API GraphQL',
  'workbench.editors.rule.fields.staticData': 'Données statiques',
  'workbench.editors.rule.fields.dynamicJs': 'Dynamique (JavaScript)',
  'workbench.editors.rule.fields.formatAwareBody.formatted': 'Formaté',
  'workbench.editors.rule.fields.formatAwareBody.raw': 'Brut',
  'workbench.editors.rule.fields.formatAwareBody.unavailableTooltip':
    "La vue formatée n'est disponible que pour les corps de forme JSON.",
  'workbench.editors.rule.fields.formatAwareBody.infoTitle': 'Vue formatée',
  'workbench.editors.rule.fields.formatAwareBody.infoKicker': 'Corps',
  'workbench.editors.rule.fields.formatAwareBody.infoSummary':
    'Formaté et Brut sont deux vues du même corps — le texte réseau est ce que la règle sert.',
  'workbench.editors.rule.fields.formatAwareBody.infoExampleCaption': 'Exemple — une valeur, deux vues',
  'workbench.editors.rule.fields.formatAwareBody.infoModesHeading': 'Modes',
  'workbench.editors.rule.fields.formatAwareBody.infoFormattedDesc':
    'Une vue de lecture — seuls les espaces diffèrent. Les modifications sont réencodées dans le format réseau ' +
    "d'origine, et Enregistrer écrit ce texte réseau ; un enregistrement sans modification écrit les octets " +
    "d'origine exacts.",
  'workbench.editors.rule.fields.formatAwareBody.infoRawDesc':
    'Le texte réseau lui-même — exactement ce que la règle sert.',
  'workbench.editors.rule.fields.graphqlFilterLabel': 'Opération GraphQL (filtre de charge utile de requête)',
  'workbench.editors.rule.fields.graphqlKeyPlaceholder': 'Clé, p. ex. operationName',
  'workbench.editors.rule.fields.graphqlValuePlaceholder': 'valeur, p. ex. getUsers',

  // ── Header rule fields ─────────────────────────────────────────────
  'workbench.editors.rule.fields.header.kicker': "Règle d'en-tête",
  'workbench.editors.rule.fields.header.infoSummary':
    'Réécrit les en-têtes de requête et de réponse sur le trafic correspondant.',
  'workbench.editors.rule.fields.header.infoDescription':
    'Les combinaisons invalides (p. ex. Ajouter à la suite sur un en-tête personnalisé) marquent la règle ' +
    'comme brouillon. Les brouillons sont enregistrés mais pas exécutés.',
  'workbench.editors.rule.fields.header.requestTab': 'En-têtes de requête',
  'workbench.editors.rule.fields.header.requestTabSummary':
    "Actions d'en-tête appliquées à la requête sortante avant qu'elle ne quitte le navigateur.",
  'workbench.editors.rule.fields.header.responseTab': 'En-têtes de réponse',
  'workbench.editors.rule.fields.header.responseTabSummary':
    "Actions d'en-tête appliquées à la réponse avant que la page ne la voie.",
  'workbench.editors.rule.fields.header.responseTabDescription':
    "L'onglet Network des DevTools du navigateur montre toujours les en-têtes d'origine du serveur, ces " +
    "changements y sont donc invisibles bien qu'ils soient appliqués. La fenêtre DevTools d'Open Headers n'a " +
    'pas cette limite — elle montre les en-têtes exactement tels que servis à la page.',
  'workbench.editors.rule.fields.header.emptyRequest':
    'Aucune action — cette règle laisse les en-têtes de requête inchangés',
  'workbench.editors.rule.fields.header.emptyResponse':
    'Aucune action — cette règle laisse les en-têtes de réponse inchangés',
  'workbench.editors.rule.fields.header.namePlaceholder': "Nom d'en-tête",
  'workbench.editors.rule.fields.header.valuePlaceholder': "Valeur d'en-tête",
  'workbench.editors.rule.fields.header.appendValuePlaceholder': 'Valeur à ajouter à la suite',
  'workbench.editors.rule.fields.header.existingValue': 'valeur existante',
  'workbench.editors.rule.fields.header.switchTo': 'Passer à {operation}',
  'workbench.editors.rule.fields.header.dragToReorder': 'Glisser pour réordonner',

  // ── Block rule fields ──────────────────────────────────────────────
  'workbench.editors.rule.fields.block.kicker': 'Règle de blocage',
  'workbench.editors.rule.fields.block.infoSummary':
    "Le blocage annule les requêtes correspondantes avant qu'elles ne quittent le navigateur.",
  'workbench.editors.rule.fields.block.infoDescription':
    "Aucune configuration d'action n'est nécessaire — le blocage est l'action ; les conditions décident de ce " +
    'qui est bloqué.',
  'workbench.editors.rule.fields.block.title': 'Bloquer les requêtes',
  'workbench.editors.rule.fields.block.body':
    'Les requêtes correspondant aux conditions ci-dessous seront bloquées. Le navigateur montrera une erreur ' +
    'réseau à la page.',

  // ── Redirect rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.redirect.kicker': 'Règle de redirection',
  'workbench.editors.rule.fields.redirect.infoSummary':
    "Envoie les requêtes correspondantes vers une autre URL avant qu'elles n'atteignent le réseau.",
  'workbench.editors.rule.fields.redirect.infoDescription':
    "Avec une condition Regex d'URL, \\1, \\2 … substituent les groupes capturés dans l'URL cible.",
  'workbench.editors.rule.fields.redirect.redirectsTo': 'Redirige vers',
  'workbench.editors.rule.fields.redirect.anotherUrl': 'Une autre URL',
  'workbench.editors.rule.fields.redirect.localFile': 'Fichier local',
  'workbench.editors.rule.fields.redirect.desktopOnly': "Disponible dans l'application de bureau",
  'workbench.editors.rule.fields.redirect.targetPlaceholder':
    "p. ex. https://openheaders.com/redirected — utilisez \\1, \\2 avec des conditions Regex d'URL",

  // ── Query-param rule fields ────────────────────────────────────────
  'workbench.editors.rule.fields.queryParam.kicker': 'Règle de paramètre de requête',
  'workbench.editors.rule.fields.queryParam.infoSummary':
    'Ajoute, remplace ou retire des paramètres de requête sur les URL correspondantes.',
  'workbench.editors.rule.fields.queryParam.infoDescription':
    'Tout retirer supprime la chaîne de requête entière ; les entrées Ajouter / Remplacer de la même règle ' +
    "deviennent alors la nouvelle chaîne. Les entrées Remplacer uniquement et Retirer n'ont plus rien sur " +
    'quoi agir et sont ignorées avec Tout retirer.',
  'workbench.editors.rule.fields.queryParam.removeAllWarning':
    'Tout retirer supprime la chaîne de requête entière, les entrées Remplacer uniquement et Retirer ' +
    "n'ont donc plus rien sur quoi agir et sont ignorées. Les entrées Ajouter / Remplacer s'appliquent " +
    'toujours — elles deviennent la nouvelle chaîne de requête.',
  'workbench.editors.rule.fields.queryParam.removesAllNote': "Retire tous les paramètres de requête de l'URL",
  'workbench.editors.rule.fields.queryParam.namePlaceholder': 'Nom du paramètre',
  'workbench.editors.rule.fields.queryParam.valuePlaceholder': 'Valeur du paramètre',

  // ── Inject rule fields ─────────────────────────────────────────────
  'workbench.editors.rule.fields.inject.kicker': "Règle d'injection",
  'workbench.editors.rule.fields.inject.infoSummary':
    'Injecte un script ou une feuille de style dans les pages correspondantes pendant leur chargement.',
  'workbench.editors.rule.fields.inject.language': 'Langage :',
  'workbench.editors.rule.fields.inject.codeSource': 'Source du code :',
  'workbench.editors.rule.fields.inject.insert': 'Insertion :',
  'workbench.editors.rule.fields.inject.sourceCode': 'Code',
  'workbench.editors.rule.fields.inject.sourceUrl': 'URL',
  'workbench.editors.rule.fields.inject.afterPageLoad': 'Après le chargement de la page',
  'workbench.editors.rule.fields.inject.asSoonAsPossible': 'Dès que possible',
  'workbench.editors.rule.fields.inject.source': 'Source',
  'workbench.editors.rule.fields.inject.code': 'Code',
  'workbench.editors.rule.fields.inject.sourceUrlPlaceholder': "Saisissez l'URL source (relative ou absolue)",
  'workbench.editors.rule.fields.inject.bypassCsp':
    "Contourner Content-Security-Policy pour que les scripts injectés s'exécutent toujours",
  'workbench.editors.rule.fields.inject.cspBypassHint':
    "Couvre uniquement la CSP d'en-tête pour l'instant — une CSP <meta> peut encore bloquer ce script. Pour " +
    'contourner les deux, activez « Allow user scripts » pour cette extension dans les paramètres ' +
    "d'extensions de votre navigateur.",

  // ── Delay rule fields ──────────────────────────────────────────────
  'workbench.editors.rule.fields.delay.kicker': 'Règle de délai',
  'workbench.editors.rule.fields.delay.infoSummary':
    'Retient les requêtes correspondantes pendant la durée configurée avant de les laisser continuer.',
  'workbench.editors.rule.fields.delay.capsAlert':
    "Les navigations de document et d'iframe sont retardées jusqu'à 30 000 ms via une page d'attente locale. " +
    'Les XHR/Fetch initiés en JS sont plafonnés à 5 000 ms pour éviter la famine du pool de connexions HTTP. ' +
    'Les sous-ressources (CSS, JS, images) ne sont pas retardées.',
  'workbench.editors.rule.fields.delay.label': 'Délai',
  'workbench.editors.rule.fields.delay.maxNote': 'Max 30 000 ms',

  // ── Request-body rule fields ───────────────────────────────────────
  'workbench.editors.rule.fields.requestBody.kicker': 'Règle de corps de requête',
  'workbench.editors.rule.fields.requestBody.infoSummary':
    'Remplace le corps des requêtes correspondantes avant leur envoi.',
  'workbench.editors.rule.fields.requestBody.infoDescription':
    "Données statiques substitue une charge utile fixe ; Dynamique exécute du JavaScript sur le corps d'origine.",
  'workbench.editors.rule.fields.requestBody.interceptsAlert':
    'Intercepte les appels fetch() et XMLHttpRequest pour les requêtes API REST ou GraphQL.',
  'workbench.editors.rule.fields.requestBody.selectResourceType': 'Sélectionnez le type de ressource',
  'workbench.editors.rule.fields.requestBody.bodyLabel': 'Corps de requête',
  'workbench.editors.rule.fields.requestBody.dynamicHintBefore': 'Votre fonction reçoit',
  'workbench.editors.rule.fields.requestBody.dynamicHintAfter':
    'et doit renvoyer le corps modifié. Renvoyez une chaîne ou un objet (auto-sérialisé en JSON).',

  // ── Response rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.response.kicker': 'Règle de réponse',
  'workbench.editors.rule.fields.response.infoSummary':
    'Sert une réponse de substitution aux requêtes correspondantes à la place de ce que le serveur a renvoyé.',
  'workbench.editors.rule.fields.response.infoDescription':
    "Données statiques sert une charge utile fixe ; Dynamique exécute du JavaScript sur la réponse d'origine.",
  'workbench.editors.rule.fields.response.sourceLabel': 'Source de la réponse',
  'workbench.editors.rule.fields.response.sourceInfoSummary':
    'Agit sur les réponses fetch() et XMLHttpRequest des requêtes API REST ou GraphQL.',
  'workbench.editors.rule.fields.response.sourceInfoDescription':
    'Mock sert votre corps sans appeler le serveur ; Modification envoie la requête réelle et modifie la ' +
    'réponse avant que la page ne la voie.',
  'workbench.editors.rule.fields.response.sourceMock': '⚡ Mock — aucune requête envoyée',
  'workbench.editors.rule.fields.response.sourceNetwork': '🌐 Modification — modifier la réponse du serveur',
  'workbench.editors.rule.fields.response.sourceNoteNetwork':
    'La requête réelle est envoyée ; vos changements sont appliqués à la réponse avant que la page ne la voie.',
  'workbench.editors.rule.fields.response.sourceNoteMock':
    'La requête ne quitte jamais le navigateur — la page reçoit directement votre réponse.',
  'workbench.editors.rule.fields.response.resourceType': 'Type de ressource',
  'workbench.editors.rule.fields.response.resourceTypeInfoSummary':
    'La forme de charge utile API ciblée par la règle — REST ou GraphQL.',
  'workbench.editors.rule.fields.response.resourceTypeInfoDescription':
    "GraphQL débloque un filtre d'opération ci-dessous, la règle peut donc cibler une seule opération au sein " +
    "d'un point d'accès partagé.",
  'workbench.editors.rule.fields.response.statusCode': 'Code de statut',
  'workbench.editors.rule.fields.response.statusCodeInfoSummary': 'Le statut HTTP servi avec votre réponse.',
  'workbench.editors.rule.fields.response.statusCodeInfoDescription':
    "Choisissez un code à servir, ou conservez celui d'origine de la réponse du serveur quand le serveur est appelé.",
  'workbench.editors.rule.fields.response.keepOriginalStatus': "Conserver le code de statut d'origine",
  'workbench.editors.rule.fields.response.contentType': 'Content-Type',
  'workbench.editors.rule.fields.response.contentTypeInfoSummary':
    "L'en-tête Content-Type servi avec le corps — contrôle la façon dont le navigateur l'interprète.",
  'workbench.editors.rule.fields.response.contentTypeInfoDescription':
    "Saisissez n'importe quelle valeur ; les suggestions sont une commodité. Quand le serveur est appelé, il " +
    "ne remplace le Content-Type de la réponse réelle que s'il est défini.",
  'workbench.editors.rule.fields.response.headersLabel': 'En-têtes de réponse',
  'workbench.editors.rule.fields.response.headersInfoSummary':
    'En-têtes supplémentaires servis aux côtés de Content-Type.',
  'workbench.editors.rule.fields.response.headersInfoDescription':
    'Quand le serveur est appelé, ils fusionnent par-dessus les en-têtes de la réponse réelle ; en mode mock, ' +
    "ils deviennent les en-têtes de la réponse. Les lignes vides sont supprimées à l'enregistrement.",
  'workbench.editors.rule.fields.response.headerNamePlaceholder': "Nom d'en-tête (p. ex. X-Custom)",
  'workbench.editors.rule.fields.response.headerValuePlaceholder': "Valeur d'en-tête",
  'workbench.editors.rule.fields.response.addHeader': 'Ajouter un en-tête',
  'workbench.editors.rule.fields.response.bodyLabel': 'Corps de réponse',
  'workbench.editors.rule.fields.response.bodyInfoSummary':
    'La charge utile servie à la page pour les requêtes correspondantes.',
  'workbench.editors.rule.fields.response.bodyInfoDescription':
    'Données statiques sert un corps fixe ; Dynamique (JavaScript) le construit ou le transforme au moment de ' +
    'la requête.',
  'workbench.editors.rule.fields.response.dynNetworkBefore': "La requête réelle est d'abord envoyée. Votre",
  'workbench.editors.rule.fields.response.dynNetworkAfter':
    'fonction reçoit la réponse et le contexte de la requête, puis renvoie la réponse modifiée. Renvoyez une ' +
    'chaîne ou un objet (auto-sérialisé en JSON).',
  'workbench.editors.rule.fields.response.dynMockBefore': "Aucune requête n'est envoyée. Votre",
  'workbench.editors.rule.fields.response.dynMockMid': 'fonction reçoit',
  'workbench.editors.rule.fields.response.dynMockAfter':
    'et renvoie le corps de la réponse. Renvoyez une chaîne ou un objet (auto-sérialisé en JSON).',

  // ── WS / SSE rule fields ───────────────────────────────────────────
  'workbench.editors.rule.fields.message.wsKicker': 'Règle WebSocket',
  'workbench.editors.rule.fields.message.sseKicker': 'Règle SSE',
  'workbench.editors.rule.fields.message.wsInfoSummary':
    'Modifie, injecte ou abandonne des frames WebSocket sur les connexions correspondantes avant que la page ' +
    'ou le réseau ne les voie.',
  'workbench.editors.rule.fields.message.sseInfoSummary':
    'Modifie, injecte ou abandonne des événements serveur sur les flux correspondants avant que les écouteurs ' +
    'ne les voient.',
  'workbench.editors.rule.fields.message.wsIntro':
    "Intercepte les connexions WebSocket créées par la page dont l'URL du socket correspond aux conditions. " +
    "Les frames sont modifiés, injectés ou abandonnés dans la page avant d'atteindre le code de la page " +
    '(entrant) ou le réseau (sortant).',
  'workbench.editors.rule.fields.message.sseIntro':
    "Intercepte les flux EventSource créés par la page dont l'URL correspond aux conditions. Les événements " +
    'sont modifiés, injectés ou abandonnés dans la page avant que les écouteurs ne les voient.',
  'workbench.editors.rule.fields.message.operation': 'Opération',
  'workbench.editors.rule.fields.message.opReplace': 'Remplacer',
  'workbench.editors.rule.fields.message.opInject': 'Injecter',
  'workbench.editors.rule.fields.message.opDrop': 'Abandonner',
  'workbench.editors.rule.fields.message.direction': 'Direction',
  'workbench.editors.rule.fields.message.incoming': 'Entrant (serveur → page)',
  'workbench.editors.rule.fields.message.outgoing': 'Sortant (page → serveur)',
  'workbench.editors.rule.fields.message.eventName': "Nom d'événement",
  'workbench.editors.rule.fields.message.eventNamePlaceholder': 'Vide = événements message par défaut',
  'workbench.editors.rule.fields.message.eventFieldNoteBefore': 'Correspond au champ',
  'workbench.editors.rule.fields.message.eventFieldNoteAfter': 'du flux',
  'workbench.editors.rule.fields.message.frameFilter': 'Filtre de frames',
  'workbench.editors.rule.fields.message.dataFilter': 'Filtre de données',
  'workbench.editors.rule.fields.message.everyFrame': 'Chaque frame',
  'workbench.editors.rule.fields.message.everyEvent': 'Chaque événement',
  'workbench.editors.rule.fields.message.filterRegex': 'Regex',
  'workbench.editors.rule.fields.message.filterNoteWs':
    "Les filtres ne correspondent qu'aux frames texte — les frames binaires passent quand un filtre est défini.",
  'workbench.editors.rule.fields.message.filterNoteSse': "Les filtres ne correspondent qu'aux événements texte.",
  'workbench.editors.rule.fields.message.injectWhen': 'Injecter quand',
  'workbench.editors.rule.fields.message.connectionOpens': "La connexion s'ouvre",
  'workbench.editors.rule.fields.message.streamOpens': "Le flux s'ouvre",
  'workbench.editors.rule.fields.message.matchingFrameArrives': 'Un frame correspondant arrive',
  'workbench.editors.rule.fields.message.matchingEventArrives': 'Un événement correspondant arrive',
  'workbench.editors.rule.fields.message.injectedFrame': 'Frame injecté',
  'workbench.editors.rule.fields.message.injectedEvent': 'Événement injecté',
  'workbench.editors.rule.fields.message.replacementFrame': 'Frame de remplacement',
  'workbench.editors.rule.fields.message.replacementEvent': 'Événement de remplacement',

  // ── Auth rule fields ───────────────────────────────────────────────
  'workbench.editors.rule.fields.auth.kicker': "Règle d'authentification",
  'workbench.editors.rule.fields.auth.infoSummary':
    "Répond aux défis d'authentification HTTP ou proxy sur les requêtes correspondantes avec ces identifiants.",
  'workbench.editors.rule.fields.auth.infoDescription':
    'Les deux champs résolvent les {{templates}}, le vrai secret peut donc vivre dans le vault ({{vault.*}}) ' +
    'au lieu de figurer en clair sur la règle. Ne prend effet que sur les onglets dans le périmètre du mode ' +
    'débogage.',
  'workbench.editors.rule.fields.auth.introBefore':
    "Répond à un défi d'authentification serveur (401) ou proxy (407) sur les requêtes correspondantes. " +
    'Référencez un secret du vault — p. ex.',
  'workbench.editors.rule.fields.auth.introAfter': "— ainsi l'identifiant n'est pas stocké dans la règle.",
  'workbench.editors.rule.fields.auth.username': "Nom d'utilisateur",
  // Placeholder examples carry the `{{ns.NAME}}` reference syntax raw
  // inside the keyed value (args-less t() skips interpolation).
  'workbench.editors.rule.fields.auth.usernamePlaceholder': 'p. ex. dev-user ou {{env.PROXY_USER}}',
  'workbench.editors.rule.fields.auth.password': 'Mot de passe',
  'workbench.editors.rule.fields.auth.passwordPlaceholder': 'p. ex. {{vault.STAGING_PW}}',
} as const satisfies Catalog;
