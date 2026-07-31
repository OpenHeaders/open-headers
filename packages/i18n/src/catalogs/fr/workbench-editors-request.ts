/**
 * Workbench editors — the API request editor — French. Mirrors
 * `catalogs/en/workbench-editors-request.ts` key for key. Raw by
 * design: HTTP methods, header names, MIME types, auth scheme names
 * (Basic Auth / Bearer Token / API Key / OAuth 2.0 / AWS Signature
 * v4 / Digest Auth / OAuth 1.0), OAuth/PKCE spec params (client_id,
 * Code Verifier, State, refresh_token, oauth_*), body-mode enums,
 * `Docs` / `Params` tab names (`Paramètres` = Settings, gRPC/WebSocket
 * precedent), wire tokens (Timing-Allow-Origin, resource-timing,
 * Referer, Host, User-Agent, SSE `ID`/`Retry` fields) and the phase
 * ladder's DNS/TCP/TLS/TTFB tokens. Reuses the fr mints: `Envoyer`,
 * `Arrêter`, `Sans limite`, `Chronologie`-family timeline vocabulary,
 * `Plus récents en premier`, `Enregistrer la réponse` +
 * `Exemple « {name} » enregistré` (gRPC), `Nom d'utilisateur` /
 * `Mot de passe` (editors-rule), `préréglage`, `pastille`,
 * `back-end` (m.) / `workflow` / `handshake` (m.) / `runtime` loans.
 * MINTS: cookie jar = « jarre à cookies » (f., bare "jar" =
 * « la jarre ») in prose; where en capitalizes `Cookie jar` the raw
 * phrase rides verbatim (m.) so the Cookie token stays. Script modes =
 * `Mode sûr` / `Mode développeur`. Browser cert-interstitial paths
 * quote the browsers' own fr UI (both localize fr): Chrome
 * `Paramètres avancés → Continuer (dangereux)`, Firefox
 * `Avancé… → Accepter le risque et poursuivre`.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsRequest = {
  // ── Request editor shell ───────────────────────────────────────────
  'workbench.editors.request.notFound': 'Requête introuvable.',
  'workbench.editors.request.loading': 'Chargement de la requête…',
  'workbench.editors.request.toast.deletedOtherTab': 'La requête a été supprimée depuis un autre onglet',
  'workbench.editors.request.toast.updateFailed': 'Échec de la mise à jour de la requête',
  'workbench.editors.request.toast.updateFailedDetail': 'Échec de la mise à jour de la requête : {message}',
  'workbench.editors.request.toast.savedExample': 'Exemple « {name} » enregistré',
  'workbench.editors.request.toast.saveExampleFailed': "Échec de l'enregistrement de l'exemple",
  'workbench.editors.request.toast.saveExampleFailedDetail': "Échec de l'enregistrement de l'exemple : {message}",
  'workbench.editors.request.send.label': 'Envoyer',
  'workbench.editors.request.send.sending': 'Envoi…',
  'workbench.editors.request.send.unresolvedTooltip':
    "La requête comporte des variables non résolues. Définissez-les dans le vault, l'environnement, la " +
    "collection, l'espace de travail ou un workflow Live avant l'envoi.",
  'workbench.editors.request.send.remoteDispatchHint': "S'exécute sur {host} — le back-end connecté",
  'workbench.editors.request.send.stop': 'Arrêter',
  'workbench.editors.request.send.stopTooltip': 'Arrêter la requête et conserver ce qui est arrivé',
  'workbench.editors.request.menu.copyAsCurl': 'Copier en cURL',
  'workbench.editors.request.menu.copyAsFetch': 'Copier en fetch',
  'workbench.editors.request.schemeHint':
    "Votre URL n'a pas de schéma. Elle sera envoyée en https:// — cliquez sur la barre d'URL et appuyez sur " +
    'Tab ou Entrée pour la fixer.',

  // ── Request editor tab registry ────────────────────────────────────
  'workbench.editors.request.tab.docs': 'Docs',
  'workbench.editors.request.tab.params': 'Params',
  'workbench.editors.request.tab.authorization': 'Autorisation',
  'workbench.editors.request.tab.headers': 'En-têtes',
  'workbench.editors.request.tab.body': 'Corps',
  'workbench.editors.request.tab.scripts': 'Scripts',
  'workbench.editors.request.tab.settings': 'Paramètres',

  // ── URL bar + method picker (method names stay raw parity vocab) ───
  'workbench.editors.request.url.placeholder': 'Saisissez une URL ou collez du texte',
  'workbench.editors.request.url.socketCta':
    'URL de type socket — les envois se connectent à {path} via le réglage Socket Unix.',
  'workbench.editors.request.url.socketCtaApply': 'Appliquer',
  'workbench.editors.request.method.customGroup': 'Personnalisées',
  'workbench.editors.request.method.usePrefix': 'Utiliser',
  'workbench.editors.request.method.forbiddenSuffix': 'ne peut pas être envoyée depuis un navigateur.',
  'workbench.editors.request.method.invalidHint':
    "Les méthodes utilisent lettres, chiffres et traits d'union (32 max).",
  'workbench.editors.request.method.removeCustomAria': 'Retirer la méthode personnalisée {method}',

  // ── Params / Headers tabs ──────────────────────────────────────────
  'workbench.editors.request.goToAuthorization': "Aller à l'autorisation",
  'workbench.editors.request.goToBody': 'Aller au corps',
  'workbench.editors.request.goToSettings': 'Aller aux paramètres',
  'workbench.editors.request.headers.keyPlaceholder': 'En-tête',
  'workbench.editors.request.headers.hideAuto': 'Masquer les en-têtes générés automatiquement',
  'workbench.editors.request.headers.hiddenCount': '{count} masqués',
  'workbench.editors.request.headers.autoInfo':
    "Ces en-têtes seront ajoutés et envoyés automatiquement avec la requête. Cliquez sur l'icône info d'une " +
    'ligne pour le détail par en-tête.',
  'workbench.editors.request.headers.duplicateAuthOverride':
    "Doublon — remplacé à l'envoi par l'en-tête {header} généré depuis l'onglet Autorisation.",
  'workbench.editors.request.headers.calculated': "<calculé à l'envoi de la requête>",
  'workbench.editors.request.headers.browserUserAgent': '<user agent du navigateur>',
  'workbench.editors.request.headers.hint.cacheControl':
    '« Cache-Control: no-cache » est ajouté par précaution pour empêcher le serveur de renvoyer des réponses ' +
    'périmées quand vous répétez des requêtes. Vous pouvez retirer cet en-tête dans les paramètres de la ' +
    'requête ou en saisir un nouveau avec une autre valeur.',
  'workbench.editors.request.headers.hint.contentType':
    "Le runtime calcule le Content-Type à partir de l'encodage du corps (form-data → multipart/form-data avec " +
    'un boundary ; x-www-form-urlencoded → application/x-www-form-urlencoded ; JSON brut → application/json ; ' +
    'etc.). Définissez votre propre en-tête pour le remplacer.',
  'workbench.editors.request.headers.hint.contentLength':
    "Content-Length est calculé à partir de la taille en octets du corps sérialisé avant l'envoi de la " +
    "requête. Le navigateur refuse d'honorer un Content-Length défini par l'utilisateur qui ne correspond pas " +
    'à la longueur réelle du corps.',
  'workbench.editors.request.headers.hint.host':
    "Le navigateur dérive Host de l'URL cible et refuse de laisser le code utilisateur le remplacer.",
  'workbench.editors.request.headers.hint.userAgent':
    'Le User-Agent identifie le client. Les requêtes partent avec le User-Agent propre du navigateur ; ' +
    'ajoutez votre propre ligne User-Agent ci-dessous pour le remplacer.',
  'workbench.editors.request.headers.hint.accept':
    'Accept indique au serveur les types de média que le client sait analyser. `*/*` laisse le serveur ' +
    'choisir ; remplacez par un ensemble plus étroit (p. ex. `application/json`) pour contraindre les réponses.',
  'workbench.editors.request.headers.hint.acceptEncoding':
    'Les algorithmes de compression pris en charge par le navigateur. Défini par le navigateur et négocié ' +
    'par connexion ; non remplaçable depuis le code utilisateur.',
  'workbench.editors.request.headers.hint.connection':
    'Réutilisation de connexion HTTP/1.1. Le navigateur gère le pool de connexions et ne laisse pas le code ' +
    'utilisateur remplacer cet en-tête.',

  // ── Auth preview rows (Headers/Params generated rows) ──────────────
  'workbench.editors.request.authPreview.basicValue': 'Basic <identifiants>',
  'workbench.editors.request.authPreview.bearerValue': 'Bearer <jeton>',
  'workbench.editors.request.authPreview.apiKeyValue': '<valeur>',
  'workbench.editors.request.authPreview.accessTokenValue': "<jeton d'accès>",
  'workbench.editors.request.authPreview.bearerAccessTokenValue': "Bearer <jeton d'accès>",
  'workbench.editors.request.authPreview.basicHint':
    "Généré depuis l'onglet Autorisation (Basic Auth). Le nom d'utilisateur et le mot de passe sont encodés " +
    "en base64 dans cet en-tête à l'envoi de la requête.",
  'workbench.editors.request.authPreview.bearerHint':
    "Généré depuis l'onglet Autorisation (Bearer Token). Le jeton est ajouté à cet en-tête à l'envoi de la requête.",
  'workbench.editors.request.authPreview.apiKeyHeaderHint':
    "Généré depuis l'onglet Autorisation (API Key). La valeur est ajoutée à cet en-tête à l'envoi de la requête.",
  'workbench.editors.request.authPreview.apiKeyQueryHint':
    "Généré depuis l'onglet Autorisation (API Key). La valeur est ajoutée à ce paramètre de requête à l'envoi " +
    'de la requête.',
  'workbench.editors.request.authPreview.oauth2HeaderHint':
    "Généré depuis l'onglet Autorisation (OAuth 2.0). Le jeton d'accès est ajouté à cet en-tête à l'envoi de " +
    'la requête.',
  'workbench.editors.request.authPreview.oauth2QueryHint':
    "Généré depuis l'onglet Autorisation (OAuth 2.0). Le jeton d'accès est ajouté à l'URL de la requête à " +
    "l'envoi de la requête.",
  'workbench.editors.request.authPreview.awsSigV4Value': 'AWS4-HMAC-SHA256 <signature>',
  'workbench.editors.request.authPreview.awsSigV4DateValue': '<horodatage de la requête>',
  'workbench.editors.request.authPreview.awsSigV4Hint':
    "Généré depuis l'onglet Autorisation (AWS Signature v4). La requête est signée avec vos identifiants au " +
    "moment de l'envoi.",
  'workbench.editors.request.authPreview.awsSigV4DateHint':
    "Généré depuis l'onglet Autorisation (AWS Signature v4). L'horodatage de signature est ajouté à cet " +
    "en-tête à l'envoi de la requête.",
  'workbench.editors.request.authPreview.digestValue': 'Digest <réponse au défi>',
  'workbench.editors.request.authPreview.digestHint':
    "Généré depuis l'onglet Autorisation (Digest Auth). La valeur est calculée à partir du défi du serveur à " +
    "l'envoi de la requête, puis la requête est renvoyée avec elle.",
  'workbench.editors.request.authPreview.oauth1Value': 'OAuth <paramètres signés>',
  'workbench.editors.request.authPreview.oauth1Hint':
    "Généré depuis l'onglet Autorisation (OAuth 1.0). La requête est signée avec vos identifiants au moment " +
    "de l'envoi.",
  'workbench.editors.request.authPreview.oauth1QueryValue': '<paramètres signés>',
  'workbench.editors.request.authPreview.oauth1QueryHint':
    "Généré depuis l'onglet Autorisation (OAuth 1.0). Les paramètres oauth_* sont ajoutés à la chaîne de " +
    "requête de l'URL à l'envoi de la requête.",

  // ── Authorization tab ──────────────────────────────────────────────
  'workbench.editors.request.auth.typeLabel': "Type d'auth",
  'workbench.editors.request.auth.type.inherit': "Hériter l'auth du parent",
  'workbench.editors.request.auth.type.none': 'Aucune auth',
  'workbench.editors.request.auth.type.basic': 'Basic Auth',
  'workbench.editors.request.auth.type.bearer': 'Bearer Token',
  'workbench.editors.request.auth.type.apiKey': 'API Key',
  'workbench.editors.request.auth.type.oauth2': 'OAuth 2.0',
  'workbench.editors.request.auth.type.awsSigV4': 'AWS Signature v4',
  'workbench.editors.request.auth.type.digest': 'Digest Auth',
  'workbench.editors.request.auth.type.oauth1': 'OAuth 1.0',
  'workbench.editors.request.auth.oauth1ConsumerKey': 'Clé consommateur',
  'workbench.editors.request.auth.oauth1ConsumerKeyPlaceholder': 'clé consommateur',
  'workbench.editors.request.auth.oauth1ConsumerSecret': 'Secret consommateur',
  'workbench.editors.request.auth.oauth1ConsumerSecretPlaceholder': 'secret consommateur',
  'workbench.editors.request.auth.oauth1Token': "Jeton d'accès",
  'workbench.editors.request.auth.oauth1TokenPlaceholder': 'facultatif — vide pour les appels one-legged',
  'workbench.editors.request.auth.oauth1TokenSecret': 'Secret du jeton',
  'workbench.editors.request.auth.oauth1TokenSecretPlaceholder': 'facultatif — vide pour les appels one-legged',
  'workbench.editors.request.auth.oauth1SignatureMethod': 'Méthode de signature',
  'workbench.editors.request.auth.oauth1Realm': 'Realm',
  'workbench.editors.request.auth.oauth1RealmPlaceholder': 'facultatif',
  'workbench.editors.request.auth.digestBrowserNote':
    "Digest Auth répond au défi du serveur par une seconde requête, qui s'exécute sur l'application de bureau " +
    'et la CLI. Les envois depuis cette surface partent sans elle — le serveur répond 401.',
  'workbench.editors.request.auth.inheritNote':
    "Les données d'autorisation seront configurées automatiquement d'après la collection parente.",
  'workbench.editors.request.auth.noneNote': "Cette requête n'utilise aucune autorisation.",
  'workbench.editors.request.auth.inheritDetail':
    "Cette requête utilise l'assistant d'autorisation de sa collection parente. Modifiez l'onglet " +
    'Autorisation de la collection pour le changer.',
  'workbench.editors.request.auth.resizeRailAria': "Redimensionner le rail des types d'auth",
  'workbench.editors.request.auth.username': "Nom d'utilisateur",
  'workbench.editors.request.auth.password': 'Mot de passe',
  'workbench.editors.request.auth.token': 'Jeton',
  'workbench.editors.request.auth.key': 'Clé',
  'workbench.editors.request.auth.keyPlaceholder': 'p. ex. X-API-Key',
  'workbench.editors.request.auth.value': 'Valeur',
  'workbench.editors.request.auth.addTo': 'Ajouter à',
  'workbench.editors.request.auth.addToHeader': 'En-tête',
  'workbench.editors.request.auth.addToQuery': 'Paramètres de requête',
  'workbench.editors.request.auth.usernamePlaceholder': "nom d'utilisateur",
  'workbench.editors.request.auth.passwordPlaceholder': 'mot de passe',
  'workbench.editors.request.auth.tokenPlaceholder': 'jeton bearer',
  'workbench.editors.request.auth.valuePlaceholder': 'valeur de la clé API',
  'workbench.editors.request.auth.awsAccessKey': "Clé d'accès",
  'workbench.editors.request.auth.awsSecretKey': 'Clé secrète',
  'workbench.editors.request.auth.awsSessionToken': 'Jeton de session',
  'workbench.editors.request.auth.awsService': 'Nom du service',
  'workbench.editors.request.auth.awsRegion': 'Région',
  'workbench.editors.request.auth.awsAccessKeyPlaceholder': 'p. ex. AKIAIOSFODNN7EXAMPLE',
  'workbench.editors.request.auth.awsSecretKeyPlaceholder': "clé d'accès secrète",
  'workbench.editors.request.auth.awsSessionTokenPlaceholder': 'facultatif — identifiants temporaires (STS) uniquement',
  'workbench.editors.request.auth.awsServicePlaceholder': 'p. ex. s3, execute-api',
  'workbench.editors.request.auth.awsRegionPlaceholder': 'p. ex. us-east-1',
  'workbench.editors.request.auth.sendAsLabel': "Ajouter les données d'autorisation à",
  'workbench.editors.request.auth.sendAsHeaders': 'En-têtes de requête',
  'workbench.editors.request.auth.sendAsUrl': 'URL de la requête',
  'workbench.editors.request.auth.presetLabel': 'Préréglage de fournisseur',
  'workbench.editors.request.auth.presetInfo':
    "Choisir un fournisseur pré-remplit ses points d'accès d'autorisation/de jeton, ses portées par défaut et " +
    'son flux recommandé. Choisissez Personnalisé pour tout configurer manuellement.',
  'workbench.editors.request.auth.presetCustom': 'Personnalisé (aucun préréglage)',

  // ── OAuth 2.0 editor (grant-type names stay raw spec vocabulary) ───
  'workbench.editors.request.oauth.queryWarningTitle': "L'envoi du jeton d'accès dans l'URL est déprécié",
  'workbench.editors.request.oauth.queryWarningBefore':
    "RFC 6750 §2.3 laisse la méthode du paramètre de requête d'URI disponible mais la déconseille : les " +
    "jetons fuient dans les journaux des serveurs, les en-têtes HTTP `Referer`, l'historique du navigateur et " +
    "les caches intermédiaires. Préférez la valeur par défaut — l'en-tête",
  'workbench.editors.request.oauth.queryWarningAfter':
    '— sauf si le fournisseur exige la forme en paramètre de requête.',
  'workbench.editors.request.oauth.currentToken': 'Jeton actuel',
  'workbench.editors.request.oauth.configureNewToken': 'Configurer un nouveau jeton',
  'workbench.editors.request.oauth.tokenLabel': 'Jeton',
  'workbench.editors.request.oauth.noTokenPlaceholder':
    "Aucun jeton pour l'instant — utilisez Obtenir un nouveau jeton d'accès ci-dessous",
  'workbench.editors.request.oauth.headerPrefix': "Préfixe d'en-tête",
  'workbench.editors.request.oauth.autoRefresh': 'Rafraîchissement auto du jeton',
  'workbench.editors.request.oauth.autoRefreshDesc':
    "Votre jeton expiré sera rafraîchi automatiquement avant l'envoi d'une requête.",
  'workbench.editors.request.oauth.status': 'Statut',
  'workbench.editors.request.oauth.statusExpired':
    'Expiré — le prochain envoi rafraîchira automatiquement quand un refresh_token est stocké.',
  'workbench.editors.request.oauth.statusValid': 'Valide · {duration}',
  'workbench.editors.request.oauth.refreshNow': 'Rafraîchir maintenant',
  'workbench.editors.request.oauth.disconnect': 'Déconnecter',
  'workbench.editors.request.oauth.tokenName': 'Nom du jeton',
  'workbench.editors.request.oauth.tokenNameDesc':
    'Libellé libre, affiché dans la liste des identifiants quand un espace de travail détient plusieurs ' +
    'jetons auprès du même fournisseur.',
  'workbench.editors.request.oauth.tokenNamePlaceholder': 'Saisissez un nom de jeton…',
  'workbench.editors.request.oauth.grantType': "Type d'octroi",
  'workbench.editors.request.oauth.callbackUrl': 'URL de rappel',
  'workbench.editors.request.oauth.detecting': 'Détection…',
  'workbench.editors.request.oauth.callbackTipBeforeExtUrl':
    "Enregistrez cette URL auprès de votre fournisseur OAuth. Elle ne ressemble pas à l'URL",
  'workbench.editors.request.oauth.callbackTipBeforeHost':
    "de votre barre d'adresse : pour ces URL, Chrome expose un hôte de redirection dédié",
  'workbench.editors.request.oauth.callbackTipBeforeApi': 'destiné à',
  'workbench.editors.request.oauth.callbackTipAfterApi':
    ". L'ID de l'extension est le même ; seuls l'hôte et le schéma diffèrent.",
  'workbench.editors.request.oauth.authorizeUsingBrowser': 'Autoriser via le navigateur',
  'workbench.editors.request.oauth.authUrl': "URL d'autorisation",
  'workbench.editors.request.oauth.accessTokenUrl': "URL du jeton d'accès",
  'workbench.editors.request.oauth.clientId': 'ID client',
  'workbench.editors.request.oauth.clientSecret': 'Secret client',
  'workbench.editors.request.oauth.codeChallengeMethod': 'Méthode du Code Challenge',
  'workbench.editors.request.oauth.codeVerifier': 'Code Verifier',
  'workbench.editors.request.oauth.codeVerifierPlaceholder': 'Généré automatiquement si laissé vide',
  'workbench.editors.request.oauth.scope': 'Portée',
  'workbench.editors.request.oauth.scopePlaceholder': 'p. ex. read:org',
  'workbench.editors.request.oauth.state': 'State',
  'workbench.editors.request.oauth.stateAuto': "Généré automatiquement à chaque requête d'autorisation",
  'workbench.editors.request.oauth.clientAuthentication': 'Authentification du client',
  'workbench.editors.request.oauth.clientAuthenticationDesc':
    'Où client_id / client_secret voyagent sur les POST de jeton. Les fournisseurs varient — Auth0 / Keycloak ' +
    "exigent typiquement la forme d'en-tête Basic.",
  'workbench.editors.request.oauth.clientAuthBody': 'Envoyer les identifiants client dans le corps',
  'workbench.editors.request.oauth.clientAuthBasicHeader': 'Envoyer comme en-tête Basic Auth',
  'workbench.editors.request.oauth.advanced': 'Avancé',
  'workbench.editors.request.oauth.advancedIntro':
    'Vous pouvez ajouter ici des personnalisations plus spécifiques à vos requêtes OAuth2.',
  'workbench.editors.request.oauth.advancedLearnMore': 'En savoir plus sur la configuration',
  'workbench.editors.request.oauth.refreshTokenUrl': 'URL du jeton de rafraîchissement',
  'workbench.editors.request.oauth.refreshTokenUrlDesc':
    "La plupart des fournisseurs réutilisent l'URL du jeton d'accès pour le rafraîchissement ; ne fournissez " +
    'une valeur que si le fournisseur expose un chemin distinct.',
  'workbench.editors.request.oauth.authRequest': "Requête d'autorisation",
  'workbench.editors.request.oauth.tokenRequest': 'Requête de jeton',
  'workbench.editors.request.oauth.refreshRequest': 'Requête de rafraîchissement',
  'workbench.editors.request.oauth.getNewToken': "Obtenir un nouveau jeton d'accès",
  'workbench.editors.request.oauth.clearCookies': 'Effacer les cookies',
  'workbench.editors.request.oauth.storedFootnoteBefore': 'Les jetons sont stockés par espace de travail sous',
  'workbench.editors.request.oauth.storedFootnoteAfter': ". Supprimez l'espace de travail pour les purger.",
  'workbench.editors.request.oauth.toast.tokenReceived': 'OAuth : jeton reçu',
  'workbench.editors.request.oauth.toast.authorizationComplete': 'OAuth : autorisation terminée',
  'workbench.editors.request.oauth.toast.failed': 'Échec OAuth : {error}',
  'workbench.editors.request.oauth.toast.refreshed': "OAuth : jeton d'accès rafraîchi",
  'workbench.editors.request.oauth.toast.refreshFailed': 'Échec du rafraîchissement : {error}',
  'workbench.editors.request.oauth.toast.disconnected': 'OAuth : déconnecté',
  'workbench.editors.request.oauth.toast.callbackCopied': 'URL de rappel copiée',
  'workbench.editors.request.oauth.toast.copyUnsupported':
    "Copie non prise en charge — sélectionnez l'URL manuellement",

  // ── Body tab (encoding radios + format labels stay raw) ────────────
  'workbench.editors.request.body.noBody': "Cette requête n'a pas de corps",
  'workbench.editors.request.body.modeNoneInfo':
    "La requête est envoyée sans charge utile — pas d'octets de corps ni d'en-tête Content-Type.",
  'workbench.editors.request.body.modeFormDataInfo':
    'Envoie les parties comme une seule charge utile multipart/form-data — chaque ligne est un champ texte ' +
    'ou un fichier.',
  'workbench.editors.request.body.modeFormDataDescription':
    "Le Content-Type avec délimiteur est généré au moment de l'envoi ; un Content-Type multipart défini à " +
    'la main est remplacé pour que le délimiteur corresponde toujours à la charge utile.',
  'workbench.editors.request.body.modeFormUrlencodedInfo':
    'Envoie les champs comme des paires clé=valeur encodées en pourcent avec un Content-Type ' +
    "application/x-www-form-urlencoded. Les lignes désactivées restent dans l'éditeur mais n'atteignent " +
    'jamais le réseau.',
  'workbench.editors.request.body.modeRawInfo':
    "Envoie le contenu de l'éditeur tel quel — les octets sur le réseau sont exactement ce que vous avez " + 'saisi.',
  'workbench.editors.request.body.modeRawDescription':
    'Le sélecteur de format pilote la coloration syntaxique et le Content-Type par défaut ' +
    '(application/json, application/xml, text/plain, text/javascript, text/html) ; un Content-Type défini ' +
    "dans l'onglet Headers l'emporte.",
  'workbench.editors.request.body.modeGraphqlInfo':
    'Envoie la requête et les variables comme une seule charge utile application/json — ' +
    '{ query, variables } — selon le transport HTTP GraphQL.',
  'workbench.editors.request.body.modeGraphqlDescription':
    'Les variables doivent être du JSON valide ; un panneau de variables non analysable est omis du corps ' +
    'envoyé et la requête part seule.',
  'workbench.editors.request.body.beautify': 'Embellir',
  'workbench.editors.request.body.format': 'Formater',
  'workbench.editors.request.body.formatAria': 'Formater le corps',
  'workbench.editors.request.body.queryTitle': 'Requête',
  'workbench.editors.request.body.queryInfoTitle': 'Requête GraphQL',
  'workbench.editors.request.body.queryInfoSummary':
    "Envoyée comme un simple POST avec un corps JSON de la forme { query, variables }. L'introspection de " +
    "schéma et l'autocomplétion de requête ne sont pas encore disponibles.",
  'workbench.editors.request.body.variablesTitle': 'Variables GraphQL',
  'workbench.editors.request.body.variablesInfoTitle': 'Variables GraphQL',
  'workbench.editors.request.body.variablesInfoSummary':
    'Définissez des variables au format JSON à référencer depuis la requête (p. ex. $id).',
  'workbench.editors.request.body.kindText': 'Texte',
  'workbench.editors.request.body.kindFile': 'Fichier',
  'workbench.editors.request.body.newFile': 'Nouveau fichier depuis la machine locale',
  'workbench.editors.request.body.uploadedFiles': 'Fichiers téléversés',
  'workbench.editors.request.body.allAttached': 'Tous les fichiers téléversés sont déjà joints',
  'workbench.editors.request.body.selectFiles': 'Sélectionnez des fichiers',
  'workbench.editors.request.body.loadingFiles': 'Chargement des fichiers…',
  'workbench.editors.request.body.addFile': '+ Ajouter un fichier',
  'workbench.editors.request.body.uploadRequired': 'Téléversement requis',
  'workbench.editors.request.body.deleteFileAria': "Supprimer {filename} de l'espace de travail",

  // ── Docs tab ───────────────────────────────────────────────────────
  'workbench.editors.request.docs.write': 'Rédiger',
  'workbench.editors.request.docs.preview': 'Aperçu',
  'workbench.editors.request.docs.infoTitle': 'Docs',
  'workbench.editors.request.docs.infoSummary':
    "Documentez cette requête — pourquoi elle existe, quand l'exécuter, la portée d'auth attendue. Markdown " +
    'pris en charge : titres, listes, tableaux, blocs de code, liens. Les références {{variable}} ' +
    "s'affichent comme des pastilles dans l'aperçu.",
  'workbench.editors.request.docs.placeholder':
    "Que fait cette requête ?\nPourquoi elle existe, quand l'exécuter, la portée d'auth attendue.",
  'workbench.editors.request.docs.empty': "Rien de documenté pour l'instant — passez à Rédiger pour ajouter des notes.",

  // ── Scripts tab (oh.* API labels + Monaco menu plane stay raw) ─────
  'workbench.editors.request.scripts.preRequest': 'Pré-requête',
  'workbench.editors.request.scripts.postResponse': 'Post-réponse',
  'workbench.editors.request.scripts.preInfoTitle': 'Script pré-requête',
  'workbench.editors.request.scripts.preInfoSummary':
    "S'exécute dans une iframe sandboxée avant l'envoi de la requête. Modifiez la requête sortante avec " +
    "l'API oh :",
  'workbench.editors.request.scripts.postInfoTitle': 'Script post-réponse',
  'workbench.editors.request.scripts.postInfoSummary':
    "S'exécute dans une iframe sandboxée après l'arrivée de la réponse. Les résultats d'assertion " +
    'atterrissent dans le panneau Réponse :',
  'workbench.editors.request.scripts.apiHeading': 'API',
  'workbench.editors.request.scripts.apiSetHeader': 'ajouter ou remplacer un en-tête',
  'workbench.editors.request.scripts.apiSetQueryParam': 'ajouter ou remplacer un paramètre de requête',
  'workbench.editors.request.scripts.apiSetUrl': "réécrire l'URL cible",
  'workbench.editors.request.scripts.apiSetBody': 'remplacer le corps de la requête',
  'workbench.editors.request.scripts.apiRequire': 'charger un package de script depuis la bibliothèque de packages',
  'workbench.editors.request.scripts.apiTest': 'déclarer une assertion',
  'workbench.editors.request.scripts.prePlaceholder':
    'Utilisez JavaScript pour modifier cette requête avant son envoi.',
  'workbench.editors.request.scripts.postPlaceholder':
    'Utilisez JavaScript pour tester et lire cette réponse après son arrivée.',

  // ── Settings tab — wired knobs ─────────────────────────────────────
  'workbench.editors.request.settings.enabled': 'Activé',
  'workbench.editors.request.settings.disabled': 'Désactivé',
  'workbench.editors.request.settings.followRedirects': 'Suivre automatiquement les redirections',
  'workbench.editors.request.settings.followRedirectsInfo':
    'Suivre les réponses HTTP 3xx vers leur cible. Désactivez pour vous arrêter à la redirection elle-même — ' +
    'la réponse apparaît comme une redirection opaque sans en-têtes ni corps, utile pour confirmer ' +
    "qu'une redirection a bien lieu.",
  'workbench.editors.request.settings.maxRedirects': 'Redirections maximum',
  'workbench.editors.request.settings.maxRedirectsInfo':
    "Le nombre de redirections qu'un envoi peut suivre avant d'échouer avec une erreur nommant la limite. " +
    'Laissez vide pour le défaut de 20. Mettez 0 pour échouer à la moindre redirection.',
  'workbench.editors.request.settings.followOriginalMethod': "Suivre la méthode HTTP d'origine",
  'workbench.editors.request.settings.followOriginalMethodInfo':
    "Conserver la méthode et le corps d'origine quand une redirection 301, 302 ou 303 ferait normalement " +
    'basculer la requête en GET. Les redirections 307 et 308 conservent toujours la méthode, quoi ' +
    "qu'il arrive.",
  'workbench.editors.request.settings.followAuthHeader': "Suivre l'en-tête Authorization",
  'workbench.editors.request.settings.followAuthHeaderInfo':
    "Conserver l'en-tête Authorization quand une redirection passe à une autre origine. Normalement il est " +
    "abandonné lors d'un saut inter-origines pour que les identifiants ne voyagent jamais vers un hôte que " +
    'la requête ne visait pas.',
  'workbench.editors.request.settings.followAuthHeaderWarning':
    "Les identifiants voyagent vers l'hôte, quel qu'il soit, où atterrit la chaîne de redirections. Une " +
    'réponse dont la chaîne a réellement traversé les origines est marquée.',
  'workbench.editors.request.settings.sendBrowserCookies': 'Envoyer les cookies du navigateur',
  'workbench.editors.request.settings.sendBrowserCookiesInfo':
    'Joindre à cette requête les cookies existants du navigateur pour le site cible. Désactivé est le défaut ' +
    'sûr : la requête est envoyée sans cookies, les résultats ne dépendent donc pas de votre état de ' +
    'connexion dans le navigateur.',
  'workbench.editors.request.settings.sslVerification': 'Vérification du certificat SSL',
  'workbench.editors.request.settings.sslVerificationSummary':
    "Vérifier le certificat TLS du serveur contre le magasin d'AC de confiance du runtime — activé par défaut.",
  'workbench.editors.request.settings.sslVerificationDescription':
    'Un hôte au certificat auto-signé, expiré ou autrement non fiable échoue avec une erreur de certificat ' +
    "TLS — désactivez la vérification pour l'atteindre quand même, p. ex. un serveur de développement au " +
    'certificat auto-signé.',
  'workbench.editors.request.settings.sslVerificationWarning':
    "Les envois sautent la vérification d'identité du serveur — tout certificat est accepté, y compris " +
    'auto-signés et expirés. La réponse est marquée comme non vérifiée.',
  'workbench.editors.request.settings.tlsMin': 'Version TLS minimum',
  'workbench.editors.request.settings.tlsMinSummary':
    "La version de protocole TLS la plus basse qu'un envoi peut négocier — vide garde le défaut du runtime, " +
    'TLS 1.2.',
  'workbench.editors.request.settings.tlsMinDescription':
    'Choisir 1.0 ou 1.1 abaisse le plancher sous le défaut pour atteindre des serveurs anciens — une réponse ' +
    'envoyée avec un plancher abaissé est marquée.',
  'workbench.editors.request.settings.tlsMinPlaceholder': '1.2 (défaut)',
  'workbench.editors.request.settings.tlsMinWarning':
    'Les envois peuvent négocier TLS sous 1.2 — des versions de protocole aux faiblesses connues. La réponse ' +
    'est marquée.',
  'workbench.editors.request.settings.tlsMax': 'Version TLS maximum',
  'workbench.editors.request.settings.tlsMaxSummary':
    "La version de protocole TLS la plus haute qu'un envoi peut négocier — vide garde le défaut du runtime, " +
    'TLS 1.3.',
  'workbench.editors.request.settings.tlsMaxDescription':
    'Abaissez-la pour vérifier comment un serveur se comporte sur un protocole plus ancien — le minimum peut ' +
    'devoir être abaissé aussi, sinon les deux ne se chevaucheront pas.',
  'workbench.editors.request.settings.tlsVersionsHeading': 'Versions',
  'workbench.editors.request.settings.tlsVersionLegacyDesc':
    'Anciennes, aux faiblesses connues — les envois sont marqués.',
  'workbench.editors.request.settings.tlsVersion12Desc': 'Le plancher par défaut.',
  'workbench.editors.request.settings.tlsVersion13Desc': 'Le plafond par défaut — la bonne pratique actuelle.',
  'workbench.editors.request.settings.tlsMaxPlaceholder': '1.3 (défaut)',
  'workbench.editors.request.settings.tlsCipherSuites': 'Suites de chiffrement TLS',
  'workbench.editors.request.settings.tlsCipherSuitesSummary':
    'Les suites de chiffrement offertes pendant le handshake TLS, en une liste séparée par des deux-points — ' +
    'vide offre les suites par défaut du runtime.',
  'workbench.editors.request.settings.tlsCipherSuitesDescription':
    'Le serveur choisit la suite parmi ce qui est offert, dans son propre ordre de préférence.',
  'workbench.editors.request.settings.tlsCipherSuitesFormatHeading': 'Format',
  'workbench.editors.request.settings.tlsCipherSuitesIanaDesc': 'Une suite TLS 1.3 par son nom IANA.',
  'workbench.editors.request.settings.tlsCipherSuitesOpensslDesc':
    'Une suite plus ancienne par son nom OpenSSL — les deux genres vont dans la même liste.',
  'workbench.editors.request.settings.tlsCipherSuitesJoinDesc': "Relie les entrées — pas d'espaces.",
  'workbench.editors.request.settings.tlsCipherSuitesPlaceholder': 'Suites par défaut du runtime',
  'workbench.editors.request.settings.tlsCipherSuitesError':
    "Noms de suites OpenSSL séparés par des deux-points uniquement — pas d'espaces.",
  'workbench.editors.request.settings.maxRedirectsPlaceholder': '20 sauts (défaut)',
  'workbench.editors.request.settings.maxRedirectsHops': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} saut', many: '{count} sauts', other: '{count} sauts' }),
  'workbench.editors.request.settings.responseSizeLimitPlaceholder': '2 MB (défaut)',
  'workbench.editors.request.settings.resetToDefault': 'Rétablir les valeurs par défaut',
  'workbench.editors.request.settings.resetRow': 'Rétablir la valeur par défaut de {label}',
  'workbench.editors.request.settings.group.redirects': 'Redirections',
  'workbench.editors.request.settings.group.tls': 'TLS et confiance',
  'workbench.editors.request.settings.group.connection': 'Connexion',
  'workbench.editors.request.settings.group.cookies': 'Cookies',
  'workbench.editors.request.settings.group.execution': 'Exécution et limites',
  'workbench.editors.request.settings.groupInfo.connection':
    "Comment l'envoi atteint le serveur — le protocole HTTP qu'il parle et la voie qu'il emprunte : " +
    'directe, via un proxy, vers une adresse figée ou dans un socket local.',
  'workbench.editors.request.settings.groupInfo.tls':
    "Ce que l'envoi vérifie et offre pendant le handshake TLS — la vérification du certificat, la fenêtre " +
    'de protocole, les suites de chiffrement et un certificat client.',
  'workbench.editors.request.settings.groupInfo.redirects':
    "Ce qui se passe quand le serveur répond par une redirection — si la chaîne est suivie, jusqu'où, et " +
    'ce que portent les requêtes suivantes.',
  'workbench.editors.request.settings.groupInfo.cookies':
    "Si des cookies accompagnent l'envoi — désactivé par défaut, pour que les résultats ne dépendent " +
    "jamais de l'état de connexion ambiant.",
  'workbench.editors.request.settings.groupInfo.execution':
    "Comment l'exécution elle-même est bornée — le mode des scripts, le budget de temps et le plafond de " +
    'taille de réponse.',
  'workbench.editors.request.settings.httpVersion': 'Version HTTP',
  'workbench.editors.request.settings.httpVersionSummary':
    "Comment l'envoi parle HTTP — Auto (par défaut) propose HTTP/2 aux côtés de HTTP/1.1 et le serveur choisit.",
  'workbench.editors.request.settings.httpVersionDescription':
    'Une version figée que le serveur ne parle pas échoue avec une erreur claire, jamais par un repli ' +
    'silencieux. Le popover « Réseau » de la réponse affiche toujours le protocole réellement négocié sur ' +
    'le fil.',
  'workbench.editors.request.settings.httpVersionValuesHeading': 'Valeurs',
  'workbench.editors.request.settings.httpVersionAutoDesc':
    'Propose HTTP/2 + HTTP/1.1 pendant la négociation TLS et le serveur choisit — le http:// simple reste ' +
    'en HTTP/1.1.',
  'workbench.editors.request.settings.httpVersion11Desc': 'Fige la sémantique classique HTTP/1.1.',
  'workbench.editors.request.settings.httpVersion2Desc': "Fige HTTP/2 via l'offre de la négociation.",
  'workbench.editors.request.settings.httpVersionPkDesc':
    'Parle HTTP/2 immédiatement sans négocier — la voie pour les serveurs HTTP/2 en clair.',
  'workbench.editors.request.settings.httpVersion3Desc':
    'Contacte le serveur directement en QUIC, sans repli vers TCP.',
  'workbench.editors.request.settings.exampleCaption': "Exemple d'envoi",
  'workbench.editors.request.settings.httpVersionPlaceholder': 'Auto — le serveur choisit',
  'workbench.editors.request.settings.httpVersionPriorKnowledge': 'HTTP/2 (prior knowledge)',
  'workbench.editors.request.settings.resolveToAddress': "Résoudre vers l'adresse",
  'workbench.editors.request.settings.resolveToAddressInfo':
    'Envoyer cette requête à une adresse de serveur précise au lieu de ce que répond le DNS — le nom ' +
    "d'hôte de l'URL sert toujours pour TLS et l'en-tête Host, donc avec la vérification activée le " +
    'certificat doit toujours lui correspondre. Utile pour tester un backend précis derrière un répartiteur ' +
    "de charge. L'URL garde son propre port, et une redirection vers un autre hôte atterrit aussi sur cette " +
    "adresse. Laissez vide pour résoudre via le DNS comme d'habitude.",
  'workbench.editors.request.settings.resolveToAddressPlaceholder': 'DNS du système',
  'workbench.editors.request.settings.resolveToAddressError':
    "Adresse IPv4 ou IPv6 uniquement — pas de nom d'hôte, pas de port.",
  'workbench.editors.request.settings.clientCertificate': 'Certificat client',
  'workbench.editors.request.settings.clientCertificateInfo':
    'Présenter un certificat client pendant le handshake TLS, pour les API derrière des passerelles TLS ' +
    "mutuel qui authentifient l'appelant par certificat. Choisissez une entrée de certificat du vault — la " +
    "requête n'enregistre que le nom de l'entrée, et chaque appareil présente sa propre entrée de vault de " +
    'ce nom ; le certificat et la clé ne quittent jamais le vault. Laissez vide pour vous connecter sans ' +
    'certificat client.',
  'workbench.editors.request.settings.clientCertificatePlaceholder': 'Aucun certificat client',
  'workbench.editors.request.settings.clientCertificateDangling':
    'Aucune entrée de certificat du vault nommée « {name} » sur cet appareil — les envois échoueront ' +
    "jusqu'à ce que l'entrée existe ou que ce réglage soit effacé.",
  'workbench.editors.request.settings.proxy': 'Proxy',
  'workbench.editors.request.settings.proxySummary':
    "Comment cet envoi atteint le réseau. Par défaut il hérite de l'environnement de l'appareil exécutant " +
    "— réglages de proxy système, PAC ou variables d'environnement de proxy — ainsi le proxy poussé d'une " +
    "machine d'entreprise fonctionne sans rien faire ; Direct exclut cette seule requête de tout proxy " +
    'ambiant, et URL personnalisée la fait passer par un proxy qui lui est propre.',
  'workbench.editors.request.settings.proxyDescription':
    "Les métadonnées de réponse enregistrent toujours la route réellement prise par l'envoi — quel proxy, " +
    "et si c'est la requête ou l'environnement qui a décidé. Les proxys HTTP(S) et SOCKS5 sont pris en " +
    "charge — une URL socks5:// fonctionne comme proxy personnalisé et comme réponse d'environnement ; " +
    'seule la famille SOCKS4 reçoit une erreur claire qui la nomme.',
  'workbench.editors.request.settings.proxyModesHeading': 'Modes',
  'workbench.editors.request.settings.proxyModePlaceholder': "Hériter — l'environnement décide",
  'workbench.editors.request.settings.proxyModeDirect': 'Direct — pas de proxy',
  'workbench.editors.request.settings.proxyModeCustom': 'URL personnalisée',
  'workbench.editors.request.settings.proxyModeInheritDesc':
    "L'environnement de l'appareil exécutant décide par URL — un proxy là où la machine en a un de " +
    "configuré, direct sinon. Un proxy hérité s'efface pour les envois qui épinglent HTTP/3, se connectent " +
    'à une socket locale ou résolvent vers une adresse fixe.',
  'workbench.editors.request.settings.proxyModeDirectDesc':
    "Jamais de proxy pour cette requête, quoi qu'en dise l'environnement de la machine.",
  'workbench.editors.request.settings.proxyModeCustomDesc':
    'Passe par le tunnel du proxy propre à cette requête — synchronisé avec la requête, la même route sur ' +
    'chaque appareil.',
  'workbench.editors.request.settings.proxyUrl': 'URL du proxy',
  'workbench.editors.request.settings.proxyUrlInfo':
    'Fait passer cette requête par ce proxy HTTP(S). La connexion vers la cible traverse le proxy en ' +
    'tunnel, donc un échange https reste chiffré de bout en bout et la vérification du certificat ' +
    "s'exécute toujours contre la cible. Les identifiants vont dans le réglage « Identifiants du proxy » " +
    'ci-dessous, jamais dans cette URL.',
  'workbench.editors.request.settings.proxyUrlPlaceholder': 'http://proxy.example:8080',
  'workbench.editors.request.settings.proxyUrlMissing':
    "Le mode URL personnalisée a besoin d'une URL de proxy — saisissez-en une, ou revenez à l'autre mode.",
  'workbench.editors.request.settings.proxyError':
    "URL en http://, https:// ou socks5:// avec hôte et port uniquement — pas d'identifiants dans l'URL.",
  'workbench.editors.request.settings.proxyResolveConflict':
    "Définit aussi la résolution vers une adresse, mais un proxy résout lui-même le nom d'hôte — les envois " +
    "échoueront jusqu'à ce que l'un des deux soit effacé.",
  'workbench.editors.request.settings.proxyCredentials': 'Identifiants du proxy',
  'workbench.editors.request.settings.proxyCredentialsInfo':
    "S'authentifier auprès du proxy avec des identifiants du vault, sous la forme user:password dans une " +
    "entrée de type chaîne. La requête n'enregistre que le nom de l'entrée, et chaque appareil le résout " +
    'contre son propre vault local — les identifiants ne quittent jamais le vault et ne sont envoyés ' +
    "qu'au proxy, jamais à la cible. Laissez vide pour un proxy sans authentification.",
  'workbench.editors.request.settings.proxyCredentialsPlaceholder': 'Aucune authentification',
  'workbench.editors.request.settings.proxyCredentialsDangling':
    'Aucune entrée de type chaîne du vault nommée « {name} » sur cet appareil — les envois échoueront ' +
    "jusqu'à ce que l'entrée existe ou que ce réglage soit effacé.",
  'workbench.editors.request.settings.unixSocket': 'Socket Unix',
  'workbench.editors.request.settings.unixSocketInfo':
    'Composer ce socket local — un chemin de socket Unix absolu, ou un tube nommé Windows comme ' +
    "\\\\.\\pipe\\name — au lieu d'ouvrir une connexion TCP, p. ex. un daemon Docker ou un service de " +
    "développement local à l'écoute sur un socket. L'hôte de l'URL ne décide plus où va la connexion, mais " +
    "l'en-tête Host, le nom de serveur TLS et la vérification du certificat l'utilisent toujours, et une " +
    'redirection vers un autre hôte compose aussi ce même socket. Laissez vide pour une connexion ' +
    'TCP normale.',
  'workbench.editors.request.settings.unixSocketPlaceholder': 'Aucun socket — connexion TCP',
  'workbench.editors.request.settings.unixSocketError':
    'Chemin de socket Unix absolu (/…) ou tube nommé Windows (\\\\.\\pipe\\…) uniquement.',
  'workbench.editors.request.settings.unixSocketProxyConflict':
    'Définit aussi un proxy, mais un tunnel proxy ne peut pas composer un socket local — les envois ' +
    "échoueront jusqu'à ce que l'un des deux soit effacé.",
  'workbench.editors.request.settings.unixSocketResolveConflict':
    'Définit aussi la résolution vers une adresse, mais une composition de socket ne résout aucun nom ' +
    "d'hôte — les envois échoueront jusqu'à ce que l'un des deux soit effacé.",
  'workbench.editors.request.settings.cookieJar': 'Utiliser la jarre à cookies',
  'workbench.editors.request.settings.cookieJarInfo':
    "Stocker les réponses Set-Cookie de cette requête dans la jarre à cookies propre à l'application et " +
    "joindre automatiquement les cookies correspondants — ainsi une requête de connexion suivie d'un appel " +
    'authentifié fonctionne sans copier les valeurs de cookies à la main. La jarre vit en mémoire par ' +
    "espace de travail, n'est utilisée que par les requêtes avec ce réglage activé, ne se synchronise " +
    "jamais et est vidée à la fermeture de l'application. Un en-tête Cookie que vous définissez vous-même " +
    "gagne toujours. Désactivé est le défaut : aucun cookie n'est joint et les réponses Set-Cookie sont " +
    'ignorées.',
  'workbench.editors.request.settings.timeout': 'Délai de la requête',
  'workbench.editors.request.settings.timeoutInfo':
    'Le temps maximum que la requête entière peut prendre — connexion, attente de la réponse et lecture du ' +
    "corps. Quand la limite expire, l'envoi est interrompu et échoue avec une erreur de délai qui la nomme. " +
    'Laissez vide pour aucune limite par requête ; seuls les délais propres à la pile réseau ' +
    "s'appliquent.",
  'workbench.editors.request.settings.timeoutPlaceholder': 'Sans limite',
  'workbench.editors.request.settings.responseSizeLimit': 'Limite de taille de réponse',
  'workbench.editors.request.settings.responseSizeLimitInfo':
    'La taille maximale de corps de réponse lue sur le réseau ; tout ce qui dépasse est coupé et la réponse ' +
    'est marquée comme tronquée. Laissez vide pour la limite par défaut de 2 048 KB (2 MB). Montez ' +
    "jusqu'à 10 240 KB (10 MB) pour des charges utiles plus grandes, ou abaissez-la pour tester l'apparence " +
    "d'une réponse tronquée.",

  // ── Settings tab — runtime-managed fact sheets ─────────────────────
  'workbench.editors.request.settings.managed.browserKicker': 'Géré par le navigateur',
  'workbench.editors.request.settings.managed.nodeKicker': 'Géré par le runtime',
  'workbench.editors.request.settings.managed.browserIntro':
    'Fixé par le navigateur pour chaque requête envoyée depuis une extension — affiché pour que vous ' +
    "sachiez ce qui n'est pas négociable.",
  'workbench.editors.request.settings.managed.nodeIntro':
    "Fixé par le runtime réseau de l'application pour chaque requête — affiché pour que vous sachiez ce qui " +
    "n'est pas négociable.",
  'workbench.editors.request.settings.managed.hideBrowser': 'Masquer les réglages gérés par le navigateur',
  'workbench.editors.request.settings.managed.hideNode': 'Masquer les réglages gérés par le runtime',
  'workbench.editors.request.settings.managed.countBrowser': '{count} gérés par le navigateur',
  'workbench.editors.request.settings.managed.countNode': '{count} gérés par le runtime',
  'workbench.editors.request.settings.managed.on': 'Activé',
  'workbench.editors.request.settings.managed.off': 'Désactivé',
  'workbench.editors.request.settings.managed.auto': 'Auto',
  'workbench.editors.request.settings.managed.policy': 'Politique',
  'workbench.editors.request.settings.managed.browser': 'Navigateur',
  'workbench.editors.request.settings.managed.about20': '~20',
  'workbench.editors.request.settings.managed.notSent': 'Non envoyé',
  'workbench.editors.request.settings.managed.httpVersion': 'Version HTTP',
  'workbench.editors.request.settings.managed.httpVersionDesc':
    "Le navigateur négocie HTTP/1.1, HTTP/2 ou HTTP/3 par connexion ; l'API fetch n'expose pas de sélecteur " +
    'de version.',
  'workbench.editors.request.settings.managed.sslVerificationDesc':
    'Les certificats sont vérifiés selon la politique du navigateur. Une requête vers un hôte au certificat ' +
    'invalide échoue ; la vérification ne peut pas être désactivée par requête.',
  'workbench.editors.request.settings.managed.followOriginalMethodDesc':
    'Sur une redirection 301/302/303, le navigateur bascule les méthodes non-GET en GET selon la spec ' +
    'fetch. 307/308 préservent toujours la méthode.',
  'workbench.editors.request.settings.managed.followAuthHeaderDesc':
    "Le navigateur retire l'en-tête Authorization quand une redirection passe à une autre origine ; ce " +
    "comportement de sécurité n'est pas contournable.",
  'workbench.editors.request.settings.managed.refererRedirect': "Retirer l'en-tête Referer à la redirection",
  'workbench.editors.request.settings.managed.refererRedirectDesc':
    'La gestion du Referer à travers les redirections suit la politique de référent du navigateur pour le ' +
    "contexte d'extension.",
  'workbench.editors.request.settings.managed.strictParser': 'Analyseur HTTP strict',
  'workbench.editors.request.settings.managed.strictParserBrowserDesc':
    "La pile réseau du navigateur rejette toujours les en-têtes de réponse malformés ; il n'existe pas de " +
    'mode tolérant.',
  'workbench.editors.request.settings.managed.strictParserNodeDesc':
    "L'analyseur HTTP du runtime rejette les en-têtes de réponse malformés ; il n'existe pas de mode tolérant.",
  'workbench.editors.request.settings.managed.encodeUrl': "Encoder l'URL automatiquement",
  'workbench.editors.request.settings.managed.encodeUrlDesc':
    "Le chemin et la chaîne de requête de l'URL sont encodés en pourcent par l'analyseur d'URL avant que la " +
    'requête parte sur le réseau. Saisissez des séquences déjà encodées pour les garder telles quelles.',
  'workbench.editors.request.settings.managed.cipherOrder': 'Ordre des suites de chiffrement du serveur',
  'workbench.editors.request.settings.managed.cipherOrderDesc':
    'La négociation de chiffrement TLS appartient au navigateur ; ni la liste des suites ni ' +
    "l'ordre ne sont configurables.",
  'workbench.editors.request.settings.managed.maxRedirectsDesc':
    "L'API fetch plafonne la chaîne de redirections à environ 20 sauts. Un plafond par requête n'est pas " +
    'implémentable : le mode de redirection manuel renvoie une réponse opaque sans en-têtes à suivre.',
  'workbench.editors.request.settings.managed.tlsVersions': 'Versions de protocole TLS/SSL',
  'workbench.editors.request.settings.managed.tlsVersionsDesc':
    'Les versions de protocole TLS activées sont fixées par le navigateur ; la sélection par requête ' +
    "n'est pas exposée.",
  'workbench.editors.request.settings.managed.referer': 'En-tête Referer',
  'workbench.editors.request.settings.managed.refererDesc':
    "Le runtime n'a pas de contexte de page, aucun Referer ne part donc sur le réseau sauf si vous en " +
    'ajoutez un vous-même comme en-tête.',
  'workbench.editors.request.settings.managed.scripts': 'Scripts pré-requête / post-réponse',
  'workbench.editors.request.settings.managed.scriptsNotRun': "Ne s'exécutent pas ici",
  'workbench.editors.request.settings.managed.scriptsNotRunDesc':
    "L'hôte qui répond aux envois de cette surface n'a pas de runtime de script, les scripts pré-requête et " +
    'post-réponse sont donc sautés et la réponse ne porte aucun résultat de script.',
  'workbench.editors.request.settings.managed.scriptsSafeForwarded': 'Mode sûr',
  'workbench.editors.request.settings.managed.scriptsSafeForwardedDesc':
    "Les envois de cette surface s'exécutent sur le back-end connecté, qui exécute les scripts pré-requête " +
    "et post-réponse dans son runtime sûr sandboxé : l'API de script oh.* uniquement — pas de système de " +
    "fichiers, pas d'accès aux processus, pas de chargeur de modules. Les envois transférés ne " +
    "s'exécutent jamais en Mode développeur, et chaque exécution enregistre sur la réponse le mode sous " +
    "lequel elle s'est exécutée.",

  // ── Settings tab — script execution chooser (per-workspace,
  //    host-local — never syncs) ───────────────────────────────────────
  'workbench.editors.request.settings.scriptMode': 'Exécution des scripts',
  'workbench.editors.request.settings.scriptModeSummary':
    "Comment les scripts pré-requête et post-réponse de cet espace de travail s'exécutent sur cet appareil.",
  'workbench.editors.request.settings.scriptModeDescription':
    "Le choix s'applique à chaque requête de l'espace de travail, reste sur cet appareil et ne se " +
    "synchronise jamais — chaque exécution enregistre sur la réponse le mode sous lequel elle s'est exécutée.",
  'workbench.editors.request.settings.scriptModeModesHeading': 'Modes',
  'workbench.editors.request.settings.scriptModeSafe': 'Mode sûr',
  'workbench.editors.request.settings.scriptModeDeveloper': 'Mode développeur',
  'workbench.editors.request.settings.scriptModeWarning':
    'Le Mode développeur exécute les scripts de cet espace de travail avec un accès complet au système — ' +
    'système de fichiers, processus et réseau. Activez-le seulement si vous faites confiance à tous ceux ' +
    'qui peuvent modifier les scripts de cet espace de travail. Les étapes de workflow et les requêtes ' +
    "transférées par d'autres appareils continuent de s'exécuter en Mode sûr.",

  // ── Request editor — script-mode tag (tab-bar chip + chooser popover;
  //    same per-workspace host-local slot as the Settings row) ─────────
  'workbench.editors.request.settings.scriptModeTagAria': 'Exécution des scripts : {mode}',
  'workbench.editors.request.settings.scriptModeRecommended': 'Recommandé',
  'workbench.editors.request.settings.scriptModeSafeCard':
    "Les scripts s'exécutent dans le runtime de script sandboxé de l'application — l'API de script oh.* " +
    'uniquement, sans système de fichiers, sans accès aux processus et sans chargeur de modules.',
  'workbench.editors.request.settings.scriptModeDeveloperCard':
    "Les scripts s'exécutent dans un runtime Node.js complet — require, système de fichiers, processus et " +
    'accès réseau.',
  'workbench.editors.request.settings.scriptModeDeveloperTrust':
    "À n'utiliser que si vous faites confiance à tous ceux qui peuvent modifier les scripts de cet espace " +
    'de travail',
  'workbench.editors.request.settings.scriptModeScopeNote':
    "S'applique à chaque requête de cet espace de travail, sur cet appareil uniquement — le choix ne se " +
    'synchronise jamais.',

  // ── Settings tab — cookie jar row ──────────────────────────────────
  'workbench.editors.request.settings.jar.count': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie dans la jarre de cet espace de travail',
      many: '{count} cookies dans la jarre de cet espace de travail',
      other: '{count} cookies dans la jarre de cet espace de travail',
    }),
  'workbench.editors.request.settings.jar.infoTitle': 'Contenu du Cookie jar',
  'workbench.editors.request.settings.jar.infoSummary':
    'Les cookies actuellement détenus par la jarre en mémoire de cet espace de travail — stockés par les ' +
    'envois avec jarre activée, joints aux envois avec jarre activée qui correspondent, et disparus à la ' +
    "fermeture de l'application. Les valeurs sont des identifiants de session et restent dans le runtime " +
    "réseau de l'application ; seuls le nom, la portée et l'expiration sont affichés.",
  'workbench.editors.request.settings.jar.storedHeading': 'Cookies stockés',
  'workbench.editors.request.settings.jar.clear': 'Vider',
  'workbench.editors.request.settings.jar.delete': 'Supprimer {name}',
  'workbench.editors.request.settings.jar.expires': 'expire {date}',
  'workbench.editors.request.settings.jar.session': 'session',
  'workbench.editors.request.settings.jar.httpsOnly': 'https uniquement',

  // ── Response panel shell (status/duration/size VALUES stay raw —
  //    parity vocabulary and diagnostic measurement, plan §3) ─────────
  'workbench.editors.request.response.title': 'Réponse',
  'workbench.editors.request.response.clear': 'Effacer',
  'workbench.editors.request.response.saveResponse': 'Enregistrer la réponse',
  'workbench.editors.request.response.createWorkflow': 'Créer un workflow',
  'workbench.editors.request.response.createWorkflowNew': 'Créer un nouveau workflow',
  'workbench.editors.request.response.createWorkflowAttach': 'Attacher à un workflow existant',
  'workbench.editors.request.response.createWorkflowNeedsSave':
    'Enregistrez la requête et utilisez-la dans un workflow',
  'workbench.editors.request.response.copyBody': 'Copier le corps',
  'workbench.editors.request.response.saveBodyToFile': 'Enregistrer le corps dans un fichier',
  'workbench.editors.request.response.saveBodyToFileTruncated':
    'Enregistrer le corps dans un fichier (tronqué — enregistre ce qui a été conservé)',
  'workbench.editors.request.response.clearResponse': 'Effacer la réponse',
  'workbench.editors.request.response.moreActionsAria': "Plus d'actions de réponse",
  'workbench.editors.request.response.copied': 'Copié',
  // View-tab nouns are DevTools parity vocabulary — keyed for uniform
  // lookup, glossary-protected on translator handoff (S4 precedent).
  'workbench.editors.request.response.tab.body': 'Corps',
  'workbench.editors.request.response.tab.headers': 'En-têtes ({count})',
  'workbench.editors.request.response.tab.cookies': 'Cookies ({count})',
  'workbench.editors.request.response.tab.assertions': 'Assertions',
  'workbench.editors.request.response.tab.assertionsFailed': 'Assertions ({count} en échec)',
  'workbench.editors.request.response.tab.assertionsPassed': 'Assertions ({count} réussies)',
  'workbench.editors.request.response.tab.console': 'Console ({count})',

  // ── Response meta strip (values raw; chip labels + popovers keyed) ──
  'workbench.editors.request.response.meta.kicker': 'Méta de la réponse',
  'workbench.editors.request.response.meta.timingTitle': 'Timing',
  'workbench.editors.request.response.meta.timingSummary': "Mesuré autour de l'appel fetch : {duration}.",
  'workbench.editors.request.response.meta.timingNoEntry':
    "La plateforme n'a enregistré aucune entrée resource-timing pour cette requête, aucune décomposition " +
    "par phase n'est donc disponible.",
  'workbench.editors.request.response.meta.timingTotalOnly':
    "Total réseau {duration}. Le serveur n'a pas exposé le détail des temps à cette requête inter-origines " +
    "(pas d'en-tête Timing-Allow-Origin), les phases DNS / connexion / TTFB / téléchargement sont " +
    'donc masquées.',
  // Phase-ladder labels — devtools waterfall parity vocabulary,
  // glossary-protected on translator handoff.
  'workbench.editors.request.response.meta.phase.redirect': 'Redirections',
  'workbench.editors.request.response.meta.phase.stalled': 'Blocage',
  'workbench.editors.request.response.meta.phase.dns': 'Résolution DNS',
  'workbench.editors.request.response.meta.phase.connect': 'Connexion TCP',
  'workbench.editors.request.response.meta.phase.tls': 'Handshake TLS',
  'workbench.editors.request.response.meta.phase.waiting': 'Attente (TTFB)',
  'workbench.editors.request.response.meta.phase.download': 'Téléchargement du contenu',
  'workbench.editors.request.response.meta.totalNetwork': 'Total (réseau)',
  'workbench.editors.request.response.meta.noteNodePhaseLegs':
    "DNS, connexion et TLS ne sont pas observables par envoi depuis le runtime réseau de l'application — " +
    'ils sont inclus dans Attente.',
  'workbench.editors.request.response.meta.sizeTitle': 'Taille',
  'workbench.editors.request.response.meta.sizeSummary': 'Les octets dans chaque direction de cet échange.',
  'workbench.editors.request.response.meta.responseSize': 'Taille de la réponse',
  'workbench.editors.request.response.meta.requestSize': 'Taille de la requête',
  'workbench.editors.request.response.meta.rowHeaders': 'En-têtes',
  'workbench.editors.request.response.meta.rowBody': 'Corps',
  'workbench.editors.request.response.meta.rowCompressed': 'Compressé',
  'workbench.editors.request.response.meta.rowTransferred': 'Transféré',
  'workbench.editors.request.response.meta.noteHeaderBytes':
    "Octets d'en-têtes tels que visibles — HTTP/2+ les compresse sur le réseau.",
  'workbench.editors.request.response.meta.noteRequestHeaders':
    'Les en-têtes de requête ne comptent que ce que cet envoi a défini ; le navigateur ajoute les siens ' +
    '(Host, User-Agent, …).',
  'workbench.editors.request.response.meta.noteRequestHeadersNode':
    "Les en-têtes de requête ne comptent que ce que cet envoi a défini ; l'environnement d'exécution " +
    'ajoute les siens (Host, Accept-Encoding, …).',
  'workbench.editors.request.response.meta.noteTruncatedAtCap':
    'Corps tronqué à la limite de taille de réponse de {cap} ; la taille complète est comptée.',
  'workbench.editors.request.response.meta.noteTruncated': 'Vue du corps tronquée ; la taille complète est comptée.',
  'workbench.editors.request.response.meta.noteBodyApproximate':
    'La taille du corps de requête est approximative — le boundary multipart est généré par le navigateur.',
  'workbench.editors.request.response.meta.noteWireHidden':
    "Tailles sur le réseau (compressé, transféré) masquées : le serveur n'a envoyé aucun Timing-Allow-Origin.",
  'workbench.editors.request.response.meta.networkTitle': 'Réseau',
  'workbench.editors.request.response.meta.networkSummary': 'Les faits au niveau connexion pour cet échange.',
  'workbench.editors.request.response.meta.httpVersion': 'Version HTTP',
  'workbench.editors.request.response.meta.localAddress': 'Adresse locale',
  'workbench.editors.request.response.meta.remoteAddress': 'Adresse distante',
  'workbench.editors.request.response.meta.noteVersionHiddenNode':
    "Version HTTP masquée : le protocole négocié n'était pas observable pour cet envoi (les envois via " +
    'proxy négocient dans le tunnel).',
  'workbench.editors.request.response.meta.noteVersionHiddenBrowser':
    "Version HTTP masquée : la plateforme n'a enregistré aucune entrée de temps pour cette requête.",
  'workbench.editors.request.response.meta.noteNoIp':
    "Adresse distante indisponible : la capture réseau n'a rien vu pour ce fetch.",
  'workbench.editors.request.response.meta.noteNoTls':
    "L'adresse locale, les détails TLS et de certificat ne sont pas exposés au code d'extension " + 'sur Chromium.',
  'workbench.editors.request.response.meta.tagUnverifiedTls': 'TLS non vérifié',
  'workbench.editors.request.response.meta.unverifiedTlsTitle': 'Vérification SSL désactivée',
  'workbench.editors.request.response.meta.unverifiedTlsSummary':
    'Cette requête a été envoyée avec la vérification du certificat désactivée dans ses Paramètres. La ' +
    "connexion était chiffrée, mais l'identité du serveur n'a pas été vérifiée — tout certificat était " +
    'accepté, y compris auto-signés et expirés.',
  'workbench.editors.request.response.meta.tlsFloorLowered': 'Plancher TLS abaissé',
  'workbench.editors.request.response.meta.tlsFloorLoweredSummary':
    'Cette requête a été envoyée avec sa version TLS minimum réglée sous 1.2 dans ses Paramètres, la ' +
    'connexion était donc autorisée à négocier TLS 1.0 ou 1.1 — des versions de protocole aux faiblesses ' +
    'connues que les runtimes désactivent par défaut.',
  'workbench.editors.request.response.meta.authForwarded': 'Authorization transféré',
  'workbench.editors.request.response.meta.authForwardedSummary':
    "Une redirection a mené cette requête vers une autre origine, et ses Paramètres conservent l'en-tête " +
    'Authorization à travers les origines — les identifiants ont donc été renvoyés au nouvel hôte. ' +
    "Normalement l'en-tête est abandonné quand une redirection quitte l'origine de départ.",
  'workbench.editors.request.response.meta.executedOnTag': 'Envoyé depuis {name}',
  'workbench.editors.request.response.meta.executedOnTitle': 'Exécuté sur le back-end connecté',
  'workbench.editors.request.response.meta.executedOnSummary':
    'Cette requête a été envoyée par « {name} » — le back-end auquel cette surface est connectée — pas ' +
    "depuis cet appareil. Le serveur cible a vu l'adresse IP et l'emplacement réseau de cette machine, les " +
    "comportements géo-dépendants ou fondés sur l'IP reflètent donc l'endroit où s'exécute le back-end. " +
    "Enregistré sur cette exécution par l'hôte qui l'a exécutée.",
  'workbench.editors.request.response.meta.cookieJar': 'Cookie jar',
  'workbench.editors.request.response.meta.cookieJarSummary':
    "Cette requête a utilisé la jarre à cookies en mémoire de l'espace de travail : les cookies stockés " +
    'correspondants ont été joints automatiquement, et les réponses Set-Cookie ont été conservées pour de ' +
    'futurs envois avec jarre activée.',
  'workbench.editors.request.response.meta.jarAttachedLabel': 'Joint à la première requête',
  'workbench.editors.request.response.meta.jarAttachedNone':
    'Rien — aucun cookie stocké ne correspondait, ou un en-tête Cookie défini sur la requête a gagné.',
  'workbench.editors.request.response.meta.jarStoredLabel': 'Stockés depuis les réponses Set-Cookie',
  'workbench.editors.request.response.meta.jarStoredNone': "Rien — aucune réponse n'a défini de cookie.",
  'workbench.editors.request.response.meta.redirects': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} redirection',
      many: '{count} redirections',
      other: '{count} redirections',
    }),
  'workbench.editors.request.response.meta.redirectsTitle': 'Chaîne de redirections',
  'workbench.editors.request.response.meta.redirectsSummary':
    'Les sauts que cette requête a suivis avant la réponse finale — chacun montre la requête envoyée et la ' +
    "redirection reçue en réponse, enregistrés au moment de l'envoi.",
  'workbench.editors.request.response.meta.redirectMethodChanged':
    'Méthode changée en {method} pour la requête suivante',
  'workbench.editors.request.response.meta.redirectAuthStripped':
    'En-tête Authorization abandonné — la requête suivante est passée à une autre origine',
  'workbench.editors.request.response.meta.redirectAuthForwarded':
    'En-tête Authorization renvoyé à travers les origines — conservé par les Paramètres de cette requête',
  'workbench.editors.request.response.meta.redirectFinal': 'Réponse finale',
  'workbench.editors.request.response.meta.streamedEnd': 'Flux terminé',
  'workbench.editors.request.response.meta.streamedStop': 'Arrêté',
  'workbench.editors.request.response.meta.streamedCap': 'Flux plafonné',
  'workbench.editors.request.response.meta.streamedTimeout': 'Délai dépassé en plein flux',
  'workbench.editors.request.response.meta.streamedError': 'Échec du flux',
  'workbench.editors.request.response.meta.streamedEndSummary':
    "Cette réponse est arrivée en flux continu jusqu'à ce que le serveur ferme le flux. Le corps ci-dessous " +
    'est la capture complète.',
  'workbench.editors.request.response.meta.streamedPartialSummary':
    "La réponse était encore en cours de diffusion quand l'échange s'est terminé, le corps ci-dessous est " +
    "donc la capture partielle jusqu'à ce point — tout ce qui est arrivé a été conservé.",
  'workbench.editors.request.response.streamReceiving': 'Réception du flux — {size}',

  // ── SSE event list (event names like `message`/`comment` are wire
  //    grammar terms and stay untranslated) ────────────────────────────
  'workbench.editors.request.response.sse.connected': 'Connecté à {url}',
  'workbench.editors.request.response.sse.closed': 'Connexion fermée',
  'workbench.editors.request.response.sse.stopped': 'Connexion arrêtée',
  'workbench.editors.request.response.sse.capped': 'Capture plafonnée — la limite de corps a été atteinte',
  'workbench.editors.request.response.sse.timedOut': 'Délai de connexion dépassé',
  'workbench.editors.request.response.sse.failed': 'Échec de la connexion',
  'workbench.editors.request.response.sse.searchEvents': 'Rechercher dans les événements',
  'workbench.editors.request.response.sse.noMatches': 'Aucun événement ne correspond.',
  'workbench.editors.request.response.sse.waiting': "En attente d'événements…",
  'workbench.editors.request.response.sse.eventCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} événement',
      many: '{count} événements',
      other: '{count} événements',
    }),
  'workbench.editors.request.response.sse.clearEvents': 'Effacer les événements (affichage uniquement)',
  'workbench.editors.request.response.sse.newEvents': 'Nouveaux événements',
  'workbench.editors.request.response.sse.sortOrder': 'Ordre de tri',
  'workbench.editors.request.response.sse.newestFirst': 'Plus récents en premier',
  'workbench.editors.request.response.sse.oldestFirst': 'Plus anciens en premier',
  'workbench.editors.request.response.sse.groupByName': "Grouper par nom d'événement",
  'workbench.editors.request.response.sse.rowsPerGroup': 'Lignes par groupe',
  'workbench.editors.request.response.sse.noLimit': 'Sans limite',
  'workbench.editors.request.response.sse.infoId': 'ID',
  'workbench.editors.request.response.sse.infoSize': 'Taille',
  'workbench.editors.request.response.sse.infoRetry': 'Retry',
  'workbench.editors.request.response.sse.eventInfoAria': "Détails de l'événement",

  // ── Response body view (filter syntax + format examples stay raw) ──
  'workbench.editors.request.response.body.truncatedNotice': "Réponse tronquée à {cap} ({size} à l'origine).",
  'workbench.editors.request.response.body.increaseLimit': 'Augmenter la limite',
  'workbench.editors.request.response.body.limitHint': 'La limite est réglable dans Paramètres → Requêtes API.',
  'workbench.editors.request.response.body.viewPickerAria': 'Vue du corps',
  'workbench.editors.request.response.body.preview': 'Aperçu',
  'workbench.editors.request.response.body.wrapLines': 'Activer le retour à la ligne',
  'workbench.editors.request.response.body.unwrapLines': 'Désactiver le retour à la ligne',
  'workbench.editors.request.response.body.renderAnsi': 'Afficher les couleurs ANSI',
  'workbench.editors.request.response.body.plainAnsi': 'Afficher le texte brut',
  'workbench.editors.request.response.body.filterJsonPathTooltip': 'Filtrer le corps (JSONPath)',
  'workbench.editors.request.response.body.filterXPathTooltip': 'Filtrer le corps (XPath)',
  'workbench.editors.request.response.body.filterMetricsTooltip': 'Filtrer le corps (familles de métriques)',
  'workbench.editors.request.response.body.filterAria': 'Filtrer le corps',
  'workbench.editors.request.response.body.invalidJsonPath': 'Expression JSONPath invalide.',
  'workbench.editors.request.response.body.invalidXPath': "Expression XPath invalide, ou le document ne s'analyse pas.",
  'workbench.editors.request.response.body.invalidMetricsFilter': 'Sélecteur de métrique invalide.',
  'workbench.editors.request.response.body.noMatches': 'Aucune correspondance pour ce chemin.',
  'workbench.editors.request.response.body.showingLastMatch': 'Affichage de la dernière correspondance.',
  'workbench.editors.request.response.body.hexCapNotice': 'La vue Hex montre les premiers {shown} sur {total}.',
  'workbench.editors.request.response.body.previewIframeTitle': 'Aperçu de la réponse',
  'workbench.editors.request.response.body.pdfPreviewIframeTitle': 'Aperçu PDF',
  'workbench.editors.request.response.body.imagePreviewAlt': 'Image de la réponse',
  'workbench.editors.request.response.body.imagePreviewFailed':
    "Les données de l'image ne se décodent pas — voir la vue Hex pour les octets bruts.",
  'workbench.editors.request.response.body.mediaPreviewAria': 'Aperçu du média',
  'workbench.editors.request.response.body.mediaPreviewFailed':
    'Les données du média ne se décodent pas — voir la vue Hex pour les octets bruts.',
  'workbench.editors.request.response.body.requestBodyOmittedNotice':
    'Corps de requête non envoyé — le navigateur ne peut pas joindre de corps aux requêtes GET ou HEAD.',
  'workbench.editors.request.response.body.duplicateJsonKeysNotice':
    'Clés JSON en double — la dernière valeur est affichée : {keys}',
  'workbench.editors.request.response.body.partialJsonNotice':
    'Corps tronqué — la vue Aperçu et le filtre ne montrent que les valeurs capturées entièrement.',
  'workbench.editors.request.response.body.schemalessDecodeNotice':
    "Décodage sans schéma (au mieux) — numéros de champs affichés ; l'imbrication et le texte sont déduits " +
    'des octets du réseau.',

  // ── Response headers view ──────────────────────────────────────────
  'workbench.editors.request.response.headers.name': 'Nom',
  'workbench.editors.request.response.headers.value': 'Valeur',
  'workbench.editors.request.response.headers.filterPlaceholder': 'Filtrer les en-têtes',
  'workbench.editors.request.response.headers.copyAll': 'Copier tous les en-têtes',
  'workbench.editors.request.response.headers.copyAria': 'Copier {name}',
  'workbench.editors.request.response.headers.copyTitle': "Copier l'en-tête",
  'workbench.editors.request.response.headers.empty': 'Aucun en-tête',
  'workbench.editors.request.response.headers.noMatch': 'Aucun en-tête ne correspond à « {query} »',
  'workbench.editors.request.response.headers.trailers': 'Trailers',

  // ── Response cookies view (Set-Cookie attribute column names stay
  //    raw wire vocabulary: Domain / Path / Expires / HttpOnly /
  //    Secure / SameSite) ─────────────────────────────────────────────
  'workbench.editors.request.response.cookies.name': 'Nom',
  'workbench.editors.request.response.cookies.value': 'Valeur',
  'workbench.editors.request.response.cookies.copyAria': 'Copier le Set-Cookie de {name}',
  'workbench.editors.request.response.cookies.copyTitle': 'Copier la ligne Set-Cookie',
  'workbench.editors.request.response.cookies.noteCredentialsInclude':
    "Cette requête s'est exécutée avec les identifiants inclus, le navigateur a donc pu stocker ces cookies " +
    '(selon les attributs propres à chaque cookie) et les enverra sur les futures requêtes avec identifiants.',
  'workbench.editors.request.response.cookies.noteCredentialsOmit':
    "Le serveur a envoyé ces cookies, mais cette requête s'est exécutée avec les identifiants omis (le " +
    "défaut), le navigateur les a donc rejetés — rien n'a été stocké.",
  'workbench.editors.request.response.cookies.noteJarOff':
    "Ces cookies n'ont pas été stockés — cette requête s'est exécutée sans la jarre à cookies (le défaut), " +
    "ou la jarre n'en a accepté aucun.",
  'workbench.editors.request.response.cookies.noteJarStored':
    "Cette requête s'est exécutée avec la jarre à cookies activée, qui a stocké {names} dans la jarre en " +
    "mémoire de l'espace de travail pour les futures requêtes avec jarre activée.",
  'workbench.editors.request.response.cookies.noteJarStoredMidChain':
    "Cette requête s'est exécutée avec la jarre à cookies activée, qui a stocké {names} dans la jarre en " +
    "mémoire de l'espace de travail pour les futures requêtes avec jarre activée. Certains ont été définis " +
    'sur des sauts de redirection intermédiaires, leurs lignes Set-Cookie ne sont donc pas listées ici — ' +
    'seuls les en-têtes de la réponse finale le sont.',

  // ── Response assertions / console views (log levels + script output
  //    stay raw; assertion durations are diagnostic timing — exempt) ──
  'workbench.editors.request.response.assertions.pass': 'RÉUSSI',
  'workbench.editors.request.response.assertions.fail': 'ÉCHEC',
  'workbench.editors.request.response.console.preRequest': 'Pré-requête',
  'workbench.editors.request.response.console.postResponse': 'Post-réponse',

  // ── Response empty / error states (executor error text stays raw) ──
  'workbench.editors.request.response.empty.sending': 'Envoi de la requête…',
  'workbench.editors.request.response.empty.prompt': 'Envoyez la requête pour voir la réponse ici.',
  'workbench.editors.request.response.error.title': "Impossible d'envoyer la requête",
  'workbench.editors.request.response.error.openInTab': 'Ouvrir dans un nouvel onglet',
  'workbench.editors.request.response.error.certSteps.summary':
    'Les serveurs de développement locaux tournent généralement avec un certificat auto-signé, que vous ' +
    'devez accepter.',
  'workbench.editors.request.response.error.certSteps.step1': "Ouvrir l'URL dans un nouvel onglet",
  'workbench.editors.request.response.error.certSteps.step2': "Accepter l'avertissement de certificat",
  'workbench.editors.request.response.error.certSteps.step2DetailChromium':
    'Paramètres avancés → Continuer (dangereux)',
  'workbench.editors.request.response.error.certSteps.step2DetailFirefox': 'Avancé… → Accepter le risque et poursuivre',
  'workbench.editors.request.response.error.certSteps.step3': 'Envoyer à nouveau la requête',
  'workbench.editors.request.response.error.certSteps.glyphNewTab': 'nouvel onglet',
  'workbench.editors.request.response.error.certSteps.glyphAdvanced': 'Avancé',
  'workbench.editors.request.response.error.certSteps.glyphSend': '▶ Envoyer',
  'workbench.editors.request.response.error.certSteps.glyphProceedChromium': 'Continuer (dangereux)',
  'workbench.editors.request.response.error.certSteps.glyphProceedFirefox': 'Accepter le risque et poursuivre',
} as const satisfies Catalog;
