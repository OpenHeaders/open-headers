/**
 * DevTools panel — inspector Headers tab — French. Mirrors
 * `catalogs/en/panel-inspector-headers.ts` key for key. Header names,
 * category names, directive tokens, filter grammar tokens (name: /
 * value: / is:), Set-Cookie / SameSite / JWT / alg / scheme
 * vocabulary, and wire values stay raw.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorHeaders = {
  // ── Headers tab (inspector detail) ──────────────────────────────────
  'panel.inspector.headers.filterPlaceholder':
    'Filtrer — texte, name:cookie, value:no-cache, is:rule, is:security, is:overridable, …',
  'panel.inspector.headers.filterAria': 'Filtrer les en-têtes',
  'panel.inspector.headers.footprintTitle': '{rules} — cliquez pour ouvrir Règles correspondantes',

  // General section + the rule-creation CTAs on its summary.
  'panel.inspector.headers.generalSection': 'Général',
  'panel.inspector.headers.createApiRequest': 'Créer une requête API',
  'panel.inspector.headers.createApiRequestTitle':
    "Ouvrir cette requête dans le client API de l'espace de travail comme brouillon prérempli — rien n'est " +
    "enregistré tant que vous ne l'enregistrez pas",
  'panel.inspector.headers.redirect.label': 'Rediriger',
  'panel.inspector.headers.redirect.title':
    'Envoyer les requêtes correspondantes ailleurs — choisissez comment la cible est préremplie',
  'panel.inspector.headers.redirect.url': 'URL de redirection…',
  'panel.inspector.headers.redirect.urlTitle':
    'Envoyer les requêtes correspondantes vers une autre URL — la cible est semée comme variable par domaine',
  'panel.inspector.headers.redirect.replaceHost': "Remplacer l'hôte…",
  'panel.inspector.headers.redirect.replaceHostTitle':
    "Conserver le chemin et les paramètres, changer l'hôte — sème une variable d'hôte par domaine",
  'panel.inspector.headers.redirect.localhost': 'Pointer vers localhost…',
  'panel.inspector.headers.redirect.localhostTitle':
    'Conserver le chemin et les paramètres, envoyer vers votre serveur de dev local en http — sème une ' +
    'variable de port par domaine',
  'panel.inspector.headers.overrideQueryParamsTitle':
    'Ajouter, remplacer ou supprimer les paramètres de requête de cette requête',
  'panel.inspector.headers.more.label': 'Plus',
  'panel.inspector.headers.more.title': "Plus d'actions sur la requête",
  'panel.inspector.headers.more.delay': 'Retarder la requête',
  'panel.inspector.headers.more.delayTitle': 'Retarder cette requête',
  'panel.inspector.headers.more.block': 'Bloquer la requête',
  'panel.inspector.headers.more.blockTitle': 'Bloquer / annuler cette requête',

  // General rows. The (i) corpus titles reuse these row-label keys and
  // the kicker reuses `generalSection` (names-its-control).
  'panel.inspector.headers.general.requestUrl': 'URL de la requête',
  'panel.inspector.headers.general.requestMethod': 'Méthode de la requête',
  'panel.inspector.headers.general.statusCode': 'Code de statut',
  'panel.inspector.headers.general.remoteAddress': 'Adresse distante',
  'panel.inspector.headers.general.httpVersion': 'Version HTTP',
  'panel.inspector.headers.general.compression': 'Compression',
  'panel.inspector.headers.general.transferred': 'Transféré',
  'panel.inspector.headers.general.referrerPolicy': 'Politique de referrer',
  'panel.inspector.headers.general.decodedSuffix': '(décodé {size})',

  // General (i) corpus.
  'panel.inspector.headers.generalInfo.requestUrl.summary':
    "L'URL complète contre laquelle le navigateur a émis la requête — schéma, hôte, chemin et chaîne de requête.",
  'panel.inspector.headers.generalInfo.requestMethod.summary':
    'La méthode HTTP utilisée (`GET`, `POST`, `PUT`, `DELETE`, …).',
  'panel.inspector.headers.generalInfo.statusCode.summary': 'Le code de réponse numérique renvoyé par le serveur.',
  'panel.inspector.headers.generalInfo.statusCode.ranges': 'Plages',
  'panel.inspector.headers.generalInfo.statusCode.r1xx': 'Informationnel (rare — `100 Continue`, `103 Early Hints`).',
  'panel.inspector.headers.generalInfo.statusCode.r2xx': 'Succès.',
  'panel.inspector.headers.generalInfo.statusCode.r3xx': "Redirection (regardez l'en-tête `Location`).",
  'panel.inspector.headers.generalInfo.statusCode.r4xx':
    'Erreur client — la requête était mal formée ou non autorisée.',
  'panel.inspector.headers.generalInfo.statusCode.r5xx':
    "Erreur serveur — le serveur n'a pas pu satisfaire une requête valide.",
  'panel.inspector.headers.generalInfo.remoteAddress.summary':
    "L'adresse IP et le port auxquels la requête a réellement été envoyée.",
  'panel.inspector.headers.generalInfo.remoteAddress.description':
    "Diffère de l'hôte de l'URL quand le DNS résout vers plusieurs IP, qu'un CDN route par anycast ou qu'un " +
    'proxy local intercepte la connexion.',
  'panel.inspector.headers.generalInfo.httpVersion.summary': 'La version du protocole HTTP négociée par la connexion.',
  'panel.inspector.headers.generalInfo.httpVersion.description':
    "Choisie au moment du TLS via ALPN. La valeur réelle sur le réseau (p. ex. `h2`, `h3`) s'affiche dans " +
    "l'infobulle quand elle diffère du libellé convivial.",
  'panel.inspector.headers.generalInfo.httpVersion.http11': 'Textuel, une requête par connexion par défaut.',
  'panel.inspector.headers.generalInfo.httpVersion.http2': 'Binaire, multiplexé sur une seule connexion TCP.',
  'panel.inspector.headers.generalInfo.httpVersion.http3':
    "Bâti sur QUIC au-dessus d'UDP — handshakes plus rapides, meilleure récupération des pertes.",
  'panel.inspector.headers.generalInfo.compression.summary':
    "L'encodage appliqué par le serveur au corps de la réponse — le navigateur décode avant de l'exposer à " +
    'JavaScript.',
  'panel.inspector.headers.generalInfo.compression.gzip':
    'Universellement pris en charge, taux de compression modeste.',
  'panel.inspector.headers.generalInfo.compression.br':
    'Brotli — meilleur taux que gzip, pris en charge par tous les navigateurs modernes.',
  'panel.inspector.headers.generalInfo.compression.zstd':
    'Compression à haut taux plus récente ; prise en charge navigateur croissante.',
  'panel.inspector.headers.generalInfo.compression.deflate': "Hérité, rarement utilisé aujourd'hui.",
  'panel.inspector.headers.generalInfo.transferred.summary':
    'Les octets qui ont réellement traversé le réseau, surcoût de compression compris.',
  'panel.inspector.headers.generalInfo.transferred.description':
    'La taille décodée entre parenthèses est ce que JavaScript voit après décompression du corps par le ' +
    'navigateur. Un grand écart entre les deux est le gain de compression.',
  'panel.inspector.headers.generalInfo.referrerPolicy.summary':
    "Quelle part de l'URL le navigateur envoie dans `Referer` sur les navigations et requêtes sortantes de " +
    'cette page.',
  'panel.inspector.headers.generalInfo.referrerPolicy.description':
    'Défini via l\'en-tête de réponse `Referrer-Policy`, la balise `<meta name="referrer">`, ou par requête ' +
    "via l'attribut `referrerpolicy`.",

  // Provisional request headers — banner variants are whole sentences.
  'panel.inspector.headers.provisional.bannerCached':
    'En-têtes provisoires affichés — servie depuis le cache, les en-têtes réellement envoyés ne sont donc pas ' +
    'stockés.',
  'panel.inspector.headers.provisional.bannerPending':
    "En-têtes provisoires affichés — l'ensemble parti sur le réseau n'a pas encore été confirmé.",
  'panel.inspector.headers.provisional.title': 'En-têtes provisoires',
  'panel.inspector.headers.provisional.kicker': 'Requête',
  'panel.inspector.headers.provisional.summary':
    'Ce sont les en-têtes que le navigateur a assemblés et comptait envoyer — pas une capture confirmée de ce ' +
    "qui a traversé le réseau. L'ensemble réel peut différer (la pile réseau ajoute cookies, identifiants et " +
    'en-têtes de connexion plus tard).',
  'panel.inspector.headers.provisional.whyHeading': "Pourquoi une requête n'affiche que des en-têtes provisoires",
  'panel.inspector.headers.provisional.cacheLabel': 'Servie depuis le cache',
  'panel.inspector.headers.provisional.cacheDesc':
    "Résolue localement (cache mémoire/disque ou service worker) — rien n'est parti sur le réseau cette fois, " +
    "les en-têtes réellement envoyés n'ont donc jamais été stockés.",
  'panel.inspector.headers.provisional.blockedLabel': "N'a jamais atteint le réseau",
  'panel.inspector.headers.provisional.blockedDesc':
    "Bloquée ou échouée avant la fin d'un échange d'en-têtes (URL invalide, blocage CORS/CSP, erreur de " +
    'connexion).',
  'panel.inspector.headers.provisional.inFlightLabel': 'Encore en vol',
  'panel.inspector.headers.provisional.inFlightDesc':
    "L'ensemble parti sur le réseau n'a pas encore été rapporté ; il se résout une fois la requête terminée.",

  // Header sections. The `SectionLabel` identifiers stay raw (the
  // search plane compares against them — S36 doc-identifier law);
  // these are their display forms, mapped at the render site.
  'panel.inspector.headers.section.responseHeaders': 'En-têtes de réponse',
  'panel.inspector.headers.section.requestHeaders': 'En-têtes de requête',
  'panel.inspector.headers.section.countAria': "nombre d'en-têtes visibles",
  'panel.inspector.headers.section.addHeader': 'Ajouter un en-tête',
  'panel.inspector.headers.section.raw': 'Brut',
  'panel.inspector.headers.section.rawTitle': 'Afficher en texte brut (Name: Value)',
  'panel.inspector.headers.section.copy': 'Copier',
  'panel.inspector.headers.section.copyAll': 'Tout copier',
  'panel.inspector.headers.section.copyFiltered': 'Copier les filtrés',
  'panel.inspector.headers.section.copyCurl': 'Copier en cURL',
  'panel.inspector.headers.section.copyFetch': 'Copier en fetch',
  'panel.inspector.headers.section.noneCaptured': 'Aucun capturé.',
  'panel.inspector.headers.section.noFilterMatch': 'Aucun en-tête ne correspond au filtre.',
  'panel.inspector.headers.section.noiseHidden': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} en-tête de bruit masqué — survolez pour les noms',
      many: '{count} en-têtes de bruit masqués — survolez pour les noms',
      other: '{count} en-têtes de bruit masqués — survolez pour les noms',
    }),

  // More filters ▾ / View ▾ menus — this tab's own menus, separate
  // referents from the network toolbar's.
  'panel.inspector.headers.moreFilters.label': 'Filtres supplémentaires',
  'panel.inspector.headers.moreFilters.ruleOnly': 'Modifiés par une règle uniquement',
  'panel.inspector.headers.moreFilters.securityOnly': 'En-têtes de sécurité uniquement',
  'panel.inspector.headers.moreFilters.overridableOnly': 'Substituables uniquement',
  'panel.inspector.headers.moreFilters.hideNoise': 'Masquer le bruit (Accept-*, Sec-Fetch-*, User-Agent, …)',
  'panel.inspector.headers.view.label': 'Vue',
  'panel.inspector.headers.view.layout': 'Disposition',
  'panel.inspector.headers.view.layoutGrouped': 'Groupée',
  'panel.inspector.headers.view.layoutFlat': 'À plat',
  'panel.inspector.headers.view.sort': 'Tri',
  'panel.inspector.headers.view.sortOriginal': 'Original',
  'panel.inspector.headers.view.sortAz': 'A → Z',
  'panel.inspector.headers.view.sortRuleFirst': 'Modifiés par une règle en premier',
  'panel.inspector.headers.view.nameCase': 'Casse des noms',
  'panel.inspector.headers.view.nameCaseTrain': 'Train-Case',
  'panel.inspector.headers.view.nameCaseOriginal': 'Originale (brute)',
  'panel.inspector.headers.view.showTags': 'Afficher les étiquettes',
  'panel.inspector.headers.view.showSuggestions': 'Afficher les suggestions',

  // Header rows. Since-fire chips render `· ` raw before the keyed
  // label. Header names ride the override titles as {name} holes.
  'panel.inspector.headers.row.expandValue': 'Développer la valeur',
  'panel.inspector.headers.row.collapseValue': 'Réduire la valeur',
  'panel.inspector.headers.row.copyValue': 'Copier la valeur',
  'panel.inspector.headers.row.copied': 'Copié',
  'panel.inspector.headers.row.edit': 'Modifier',
  'panel.inspector.headers.row.editTitle': 'Modifier la règle qui a défini cet en-tête',
  'panel.inspector.headers.row.override': 'Substituer',
  'panel.inspector.headers.row.overrideTitle': 'Créer une règle pour substituer cet en-tête',
  'panel.inspector.headers.row.overrideProtectedTitle':
    "{name} est un en-tête protégé — le moteur Declarative Net Request du navigateur refuse qu'une extension " +
    'le substitue. Les noms protégés courants incluent host, content-length, connection, sec-fetch-*, ' +
    'sec-ch-ua-*.',
  'panel.inspector.headers.row.overrideSystemTitle':
    "{name} est injecté par {feature}, une fonctionnalité système d'Open Headers — non substituable par une " +
    'règle.',
  'panel.inspector.headers.row.overrideManagedTitle':
    '{name} est déjà géré par une de vos règles — modifiez la règle depuis son popover plutôt que de le ' +
    'substituer.',
  'panel.inspector.headers.row.systemTitle': "Injecté par {feature} (fonctionnalité système d'Open Headers)",
  'panel.inspector.headers.row.sinceFire.deleted': 'règle supprimée depuis',
  'panel.inspector.headers.row.sinceFire.deletedTitle':
    "La règle a été supprimée depuis cette requête — elle ne s'appliquera pas aux requêtes futures",
  'panel.inspector.headers.row.sinceFire.disabled': 'règle désactivée depuis',
  'panel.inspector.headers.row.sinceFire.disabledTitle':
    "La règle a été désactivée depuis cette requête — elle ne s'appliquera pas aux requêtes futures",
  'panel.inspector.headers.row.sinceFire.edited': 'règle modifiée depuis',
  'panel.inspector.headers.row.sinceFire.editedTitle':
    "La règle a été modifiée depuis cette requête — la règle actuelle ne s'applique qu'aux requêtes futures",
  'panel.inspector.headers.row.sinceFire.value': 'variable modifiée depuis',
  'panel.inspector.headers.row.sinceFire.valueTitle':
    "Une variable référencée par cette règle se résout maintenant vers une autre valeur — ne s'applique " +
    "qu'aux requêtes futures",

  // Value chips.
  'panel.inspector.headers.chips.expires': 'expire {duration}',
  'panel.inspector.headers.chips.session': 'session',
  'panel.inspector.headers.chips.missingFlag': 'sans {flag}',
  'panel.inspector.headers.chips.expired': 'expiré',

  // Chip (i) corpora.
  'panel.inspector.headers.chipInfo.setCookieFlagKicker': 'Attribut Set-Cookie',
  'panel.inspector.headers.chipInfo.httpOnly.summary':
    'Le Cookie est caché de JavaScript (illisible via `document.cookie`).',
  'panel.inspector.headers.chipInfo.httpOnly.description':
    "Atténue les XSS — un script injecté ne peut plus exfiltrer le cookie. N'aide pas contre le CSRF.",
  'panel.inspector.headers.chipInfo.secure.summary':
    'Cookie envoyé uniquement en HTTPS. Ne fuit jamais en HTTP simple.',
  'panel.inspector.headers.chipInfo.partitioned.summary':
    'CHIPS — le cookie est partitionné par site de premier niveau.',
  'panel.inspector.headers.chipInfo.partitioned.description':
    'Chaque site de premier niveau reçoit sa propre copie du cookie, les contextes intégrés ne peuvent donc ' +
    "pas utiliser les cookies pour suivre l'utilisateur d'un site à l'autre.",
  'panel.inspector.headers.chipInfo.sameSiteStrict':
    'Cookie envoyé uniquement sur les requêtes same-site. Protection CSRF la plus forte — même les liens ' +
    "venant d'un autre site arrivent sans cookie.",
  'panel.inspector.headers.chipInfo.sameSiteLax':
    'Cookie envoyé sur les requêtes same-site et les navigations cross-site de premier niveau (clics de ' +
    'lien). Défaut des navigateurs modernes.',
  'panel.inspector.headers.chipInfo.sameSiteNone':
    'Cookie envoyé sur toutes les requêtes cross-site. Exige `Secure`. À utiliser sciemment — les ' +
    "destinataires peuvent corréler le cookie d'un site à l'autre.",
  'panel.inspector.headers.chipInfo.cookieExpiry.title': 'Expiration du Cookie',
  'panel.inspector.headers.chipInfo.cookieExpiry.expiredSummary':
    "Le Cookie a déjà expiré. Le navigateur ne l'enverra pas.",
  'panel.inspector.headers.chipInfo.cookieExpiry.expiresSummary': 'Le Cookie expire dans {duration} (le {date}).',
  'panel.inspector.headers.chipInfo.cookieExpiry.description':
    'Les cookies sans `Max-Age` ni `Expires` sont des cookies de session et disparaissent à la fermeture du ' +
    'navigateur. Définissez-en un pour rendre le cookie persistant.',
  'panel.inspector.headers.chipInfo.sessionCookie.title': 'Cookie de session',
  'panel.inspector.headers.chipInfo.sessionCookie.summary':
    'Pas de `Max-Age` ni `Expires` — le navigateur jette ce cookie à sa fermeture.',
  'panel.inspector.headers.chipInfo.sessionCookie.description':
    'Ajoutez `Max-Age=<seconds>` ou `Expires=<date>` pour le rendre persistant entre les sessions du navigateur.',
  'panel.inspector.headers.chipInfo.missingFlag.title': '{flag} manquant',
  'panel.inspector.headers.chipInfo.missingFlag.kicker': 'Bonne pratique',
  'panel.inspector.headers.chipInfo.missingFlag.secure':
    'Sans `Secure`, ce cookie peut fuiter en HTTP simple. Toujours le définir sur les cookies HTTPS.',
  'panel.inspector.headers.chipInfo.missingFlag.httpOnly':
    "Sans `HttpOnly`, JavaScript peut lire ce cookie via `document.cookie` — un bug XSS l'exfiltre.",
  'panel.inspector.headers.chipInfo.missingFlag.sameSite':
    'Sans `SameSite` explicite, les navigateurs retombent sur `Lax`. Soyez explicite pour que la politique ' +
    'soit évidente en revue de code.',
  'panel.inspector.headers.chipInfo.missingFlag.description':
    'La plupart des cookies de production devraient porter `Secure`, `HttpOnly` et un `SameSite` explicite.',
  'panel.inspector.headers.chipInfo.cacheKicker': 'Directive de cache',
  'panel.inspector.headers.chipInfo.rawValue': 'Valeur brute : `{value}`.',
  'panel.inspector.headers.chipInfo.activeDirectives': 'Directives actives',
  'panel.inspector.headers.chipInfo.maxAge': 'Fraîche pendant {duration}.',
  'panel.inspector.headers.chipInfo.sMaxage': 'Fraîcheur en cache partagé : {duration}.',
  'panel.inspector.headers.chipInfo.staleWhileRevalidate':
    "Autorise la réutilisation périmée pendant {duration} pendant qu'une revalidation tourne en arrière-plan.",
  'panel.inspector.headers.chipInfo.contentTypeParamKicker': 'Paramètre Content-Type',
  'panel.inspector.headers.chipInfo.charset.summary': 'Encodage de caractères utilisé par le corps.',
  'panel.inspector.headers.chipInfo.charset.description':
    'Pour les types `text/*`, les piles modernes prennent `utf-8` par défaut. Une mauvaise valeur produit du ' +
    'mojibake.',
  'panel.inspector.headers.chipInfo.boundary.title': 'Frontière multipart',
  'panel.inspector.headers.chipInfo.boundary.summary':
    "Jeton qui sépare les parties d'un corps multipart (envois de fichiers, multipart/form-data).",
  'panel.inspector.headers.chipInfo.boundary.description':
    "Généré par le client ; ne doit apparaître dans le corps d'aucune partie.",
  'panel.inspector.headers.chipInfo.hsts.kicker': 'Politique de sécurité',
  'panel.inspector.headers.chipInfo.hsts.summary': 'Le navigateur utilisera HTTPS pour cet hôte pendant {duration}.',
  'panel.inspector.headers.chipInfo.authSchemeKicker': "Schéma d'autorisation",
  'panel.inspector.headers.chipInfo.jwt.summary':
    'JSON Web Token — un triplet `<header>.<payload>.<signature>` encodé en base64.',
  'panel.inspector.headers.chipInfo.jwt.description':
    "La signature prouve que le jeton a été émis par un détenteur de la clé de signature. L'en-tête (alg, " +
    'typ) et la charge utile (claims) ne sont PAS chiffrés — simplement encodés en base64 et lisibles par ' +
    'quiconque.',
  'panel.inspector.headers.chipInfo.jwtHeaderKicker': 'En-tête JWT',
  'panel.inspector.headers.chipInfo.jwtClaimKicker': 'Claim JWT',
  'panel.inspector.headers.chipInfo.jwtAlg.summary': "Algorithme de signature déclaré dans l'en-tête JWT.",
  'panel.inspector.headers.chipInfo.jwtAlg.description':
    'Valeurs courantes : `HS256` (HMAC-SHA256, symétrique), `RS256` (RSA, asymétrique), `ES256` (ECDSA). ' +
    '`none` (sans signature) devrait toujours être rejeté par les validateurs.',
  'panel.inspector.headers.chipInfo.jwtExpired.title': 'JWT expiré',
  'panel.inspector.headers.chipInfo.jwtExpired.summary':
    'Jeton expiré il y a {duration}. Le serveur devrait le rejeter.',
  'panel.inspector.headers.chipInfo.jwtExpires.title': 'JWT expire dans {duration}',
  'panel.inspector.headers.chipInfo.jwtExpires.soonSummary':
    "Le jeton approche de l'expiration — rafraîchissez-le ou attendez-vous à un 401 bientôt.",
  'panel.inspector.headers.chipInfo.jwtExpires.summary': "Temps restant avant d'atteindre le claim `exp` du JWT.",
  'panel.inspector.headers.chipInfo.scheme.bearer':
    "Identifiant bearer opaque (OAuth 2.0 / jeton d'API). Traitez-le comme un mot de passe — quiconque le " +
    "détient peut s'authentifier comme l'utilisateur.",
  'panel.inspector.headers.chipInfo.scheme.basic':
    'Authentification HTTP Basic — `base64(username:password)`. Sûre uniquement en HTTPS.',
  'panel.inspector.headers.chipInfo.scheme.other':
    "Nom du schéma d'authentification. Le format de l'identifiant dépend du schéma.",

  // Header insights (t-fed `computeHeaderInsights`).
  'panel.inspector.headers.insights.corsWildcard.title': 'CORS mal configuré',
  'panel.inspector.headers.insights.corsWildcard.detail':
    '`Access-Control-Allow-Origin: *` ne peut pas se combiner avec des identifiants — le navigateur rejettera ' +
    'cette réponse.',
  'panel.inspector.headers.insights.corsWildcard.action': 'Substituer par {origin}',
  'panel.inspector.headers.insights.corsMissingAcao.title': 'Requête CORS sans Access-Control-Allow-Origin',
  'panel.inspector.headers.insights.corsMissingAcao.detail':
    "La requête portait `Origin: {origin}` mais la réponse n'a pas d'`Access-Control-Allow-Origin`. Le " +
    'navigateur bloquera la réponse.',
  'panel.inspector.headers.insights.corsMissingAcao.action': 'Ajouter Access-Control-Allow-Origin: {origin}',
  'panel.inspector.headers.insights.cookieMissingSecure.titleOne': 'Cookie `{name}` sans `Secure`',
  'panel.inspector.headers.insights.cookieMissingSecure.titleMany': '{count} cookies sans `Secure`',
  'panel.inspector.headers.insights.cookieMissingSecure.detail':
    'Les cookies définis en HTTPS devraient porter `Secure` pour ne pas pouvoir être envoyés en HTTP simple.',
  'panel.inspector.headers.insights.missingCsp.title': 'Pas de Content-Security-Policy sur une réponse HTML',
  'panel.inspector.headers.insights.missingCsp.action': 'Ajouter une CSP de base',
  'panel.inspector.headers.insights.hstsShort.title': 'Le max-age HSTS est très court ({summary})',
  'panel.inspector.headers.insights.hstsShort.detail':
    'La plupart des politiques recommandent au moins 6 mois ; le preload exige 1 an.',
  'panel.inspector.headers.insights.jwtExpired.title': "Le JWT de l'en-tête Authorization est expiré",
  'panel.inspector.headers.insights.jwtExpired.detail': 'Expiré il y a {duration}.',
  'panel.inspector.headers.insights.jwtExpiring.title': 'Le JWT expire dans {duration}',
  'panel.inspector.headers.insights.missingContentType.title': "La réponse n'a pas de Content-Type",
  'panel.inspector.headers.insights.missingContentType.action': 'Ajouter Content-Type',
} as const satisfies Catalog;
