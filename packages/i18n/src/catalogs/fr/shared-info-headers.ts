/**
 * Shared info-popover corpus — HTTP headers — French. Mirrors
 * `catalogs/en/shared-info-headers.ts` key for key; wire vocabulary
 * (header names, directive keys, common values, backticked code) stays
 * raw — only prose translates.
 */

import type { Catalog } from '../../types';

export const sharedInfoHeaders = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.header.kicker': '{direction} · {category}',
  'shared.info.header.direction.request': 'En-tête de requête',
  'shared.info.header.direction.response': 'En-tête de réponse',
  'shared.info.header.direction.both': 'En-tête de requête / réponse',
  'shared.info.header.section.directives': 'Directives',
  'shared.info.header.section.commonValues': 'Valeurs courantes',
  'shared.info.header.fallback.customCategory': 'Personnalisé ou non standard',
  'shared.info.header.fallback.customSummary':
    'Cet en-tête est personnalisé ou non standard — aucune documentation dans notre registre.',
  'shared.info.header.fallback.unknownSummary':
    "{name} n'est pas encore documenté dans notre registre. La ligne le classe comme {category}.",

  // ── auth ──────────────────────────────────────────────────────────────
  'shared.info.header.authorization.summary': 'Identifiants authentifiant le client auprès du serveur.',
  'shared.info.header.authorization.body1':
    'Format : `<scheme> <credentials>`. Schémas courants : `Bearer <token>` (OAuth, JWT), ' +
    '`Basic <base64(user:pass)>`, `Digest`.',
  'shared.info.header.proxyAuthorization.summary':
    "Identifiants pour un proxy intermédiaire (pas le serveur d'origine).",
  'shared.info.header.proxyAuthorization.body1': 'Même syntaxe que `Authorization`, portée distincte.',
  'shared.info.header.wwwAuthenticate.summary':
    "Défi 401 du serveur — indique au client quel schéma d'authentification utiliser.",
  'shared.info.header.wwwAuthenticate.body1':
    "Envoyé avec `401 Unauthorized`. Déclenche la boîte de dialogue d'authentification basique du navigateur " +
    'quand le schéma est `Basic`.',
  'shared.info.header.proxyAuthenticate.summary':
    'Équivalent proxy de `WWW-Authenticate`, envoyé avec `407 Proxy Authentication Required`.',
  'shared.info.header.authenticationInfo.summary':
    "Achève l'authentification mutuelle en cas de succès — l'authentification Digest s'en sert pour confirmer " +
    'aussi le serveur.',

  // ── caching ───────────────────────────────────────────────────────────
  'shared.info.header.cacheControl.summary':
    "Directives qui régissent la mise en cache et la revalidation d'une réponse.",
  'shared.info.header.cacheControl.body1':
    'Requête et réponse portent toutes deux des directives. Les jetons multiples séparés par des virgules se ' +
    "combinent en ET. Le comportement est par directive — l'en-tête n'est pas un mode unique.",
  'shared.info.header.cacheControl.directive.noStore': 'Ne jamais mettre en cache, nulle part.',
  'shared.info.header.cacheControl.directive.noCache': 'Peut être mis en cache, mais revalider à chaque réutilisation.',
  'shared.info.header.cacheControl.directive.public': "N'importe quel cache peut stocker, y compris partagé/CDN.",
  'shared.info.header.cacheControl.directive.private': "Seul le navigateur de l'utilisateur peut stocker.",
  'shared.info.header.cacheControl.directive.maxAgeN':
    "Frais pendant N secondes ; réutiliser sans contacter l'origine.",
  'shared.info.header.cacheControl.directive.sMaxageN': 'Comme max-age mais uniquement pour les caches partagés.',
  'shared.info.header.cacheControl.directive.mustRevalidate': 'Une fois périmé, revalider avant de servir.',
  'shared.info.header.cacheControl.directive.immutable': 'Promet que le corps ne changera pas pendant max-age.',
  'shared.info.header.cacheControl.directive.staleWhileRevalidateN':
    "Autorise la réutilisation périmée pendant qu'une revalidation s'exécute en arrière-plan.",
  'shared.info.header.pragma.summary': 'Contrôle de cache HTTP/1.0 hérité — de fait supplanté par Cache-Control.',
  'shared.info.header.pragma.body1':
    '`Pragma: no-cache` est encore émis par certains clients par compatibilité. Les serveurs modernes devraient ' +
    'honorer `Cache-Control` et ignorer `Pragma`.',
  'shared.info.header.expires.summary': 'Date/heure absolue après laquelle la réponse est considérée comme périmée.',
  'shared.info.header.expires.body1':
    'Supplanté par `Cache-Control: max-age`. Si les deux sont présents, `max-age` gagne. Utilisez une date ' +
    'passée (ou `0`) pour forcer un rechargement.',
  'shared.info.header.etag.summary':
    'Identifiant opaque du corps de la réponse — sert à revalider les copies en cache.',
  'shared.info.header.etag.body1':
    'Les clients le renvoient dans `If-None-Match`. Si la valeur correspond toujours, le serveur répond ' +
    '`304 Not Modified` sans corps.',
  'shared.info.header.ifMatch.summary':
    "Requête conditionnelle : ne procéder que si l'ETag actuel de la ressource correspond.",
  'shared.info.header.ifMatch.body1':
    "Utilisé par les écritures pour éviter d'écraser les modifications de quelqu'un d'autre (concurrence optimiste).",
  'shared.info.header.ifNoneMatch.summary':
    "Requête conditionnelle : ne procéder que si l'ETag de la ressource a changé.",
  'shared.info.header.ifNoneMatch.body1':
    'Utilisé par les lectures pour éviter de télécharger une réponse inchangée — le serveur répond ' +
    '`304 Not Modified`.',
  'shared.info.header.ifModifiedSince.summary':
    'Requête conditionnelle : ne procéder que si la ressource a changé après la date donnée.',
  'shared.info.header.ifModifiedSince.body1':
    'Moins précis que `If-None-Match`/ETag ; préférez les ETags quand ils sont disponibles.',
  'shared.info.header.ifUnmodifiedSince.summary':
    "Requête conditionnelle : ne procéder que si la ressource n'a pas été modifiée depuis la date donnée.",
  'shared.info.header.lastModified.summary': 'Date/heure de la dernière modification de la ressource.',
  'shared.info.header.lastModified.body1': 'Associé à `If-Modified-Since` pour la revalidation.',
  'shared.info.header.age.summary': 'Secondes passées par la réponse dans un cache partagé.',
  'shared.info.header.age.body1':
    'Renvoyé par les CDN et les proxys ; aide les clients à évaluer la fraîcheur de la réponse.',
  'shared.info.header.xCache.summary':
    'Résultat de cache CDN / reverse-proxy — format propre au fournisseur (Varnish, Fastly, CloudFront).',
  'shared.info.header.xCache.value.hit': 'Servi depuis le cache.',
  'shared.info.header.xCache.value.miss': "Pas en cache ; récupéré depuis l'origine.",
  'shared.info.header.xCache.value.hitHit': 'Plusieurs niveaux de cache ont tous répondu (p. ex. shield + edge).',
  'shared.info.header.xCacheHits.summary':
    'Compteur de hits de cache par niveau — propre au fournisseur, courant chez Fastly.',
  'shared.info.header.xCacheHits.body1':
    'Séparé par des virgules quand plusieurs niveaux de cache sont en jeu. Des comptes élevés indiquent des ' +
    'lignes de cache très sollicitées.',
  'shared.info.header.warning.summary':
    'Contexte de cache additionnel (périmé, transformation appliquée, etc.). Déprécié en HTTP/1.1 depuis la ' +
    'RFC 7234 mais encore émis.',
  'shared.info.header.surrogateControl.summary':
    'Contrôle de cache Edge Side Includes — pilote les CDN tout en laissant le cache navigateur à `Cache-Control`.',
  'shared.info.header.surrogateControl.body1':
    'Spécifique aux caches compatibles ESI (Fastly, Akamai, Varnish dans certaines configurations).',
  'shared.info.header.surrogateCapability.summary':
    'Indication Edge vers origine : quelles fonctionnalités ESI le surrogate prend en charge.',
  'shared.info.header.cfCacheStatus.summary': 'Résultat du cache Cloudflare pour cette requête.',
  'shared.info.header.cfCacheStatus.value.hit': 'Servi depuis le cache Cloudflare.',
  'shared.info.header.cfCacheStatus.value.miss': "Pas en cache ; récupéré depuis l'origine.",
  'shared.info.header.cfCacheStatus.value.expired': "Était en cache mais expiré ; rafraîchi depuis l'origine.",
  'shared.info.header.cfCacheStatus.value.bypass': 'Cache contourné (règles de page / en-tête no-cache).',
  'shared.info.header.cfCacheStatus.value.dynamic': 'Non mis en cache par défaut (cookies, chaîne de requête, etc.).',
  'shared.info.header.cfCacheStatus.value.revalidated': "En cache et revalidé auprès de l'origine (304).",

  // ── client-hints ──────────────────────────────────────────────────────
  'shared.info.header.secChUa.summary': 'Client Hint : la liste de marques du navigateur.',
  'shared.info.header.secChUa.body1':
    'Remplace le `User-Agent` libre pour les parties dont les serveurs devraient réellement dépendre.',
  'shared.info.header.secChUaMobile.summary': 'Client Hint : `?1` sur mobile, `?0` sur ordinateur.',
  'shared.info.header.secChUaPlatform.summary':
    'Client Hint : l\'OS de l\'utilisateur (`"Windows"`, `"macOS"`, `"Linux"`, etc.).',
  'shared.info.header.userAgent.summary': "Chaîne libre héritée identifiant le navigateur, l'OS et le moteur.",
  'shared.info.header.userAgent.body1':
    'Toujours envoyée par chaque requête. Le remplaçant structuré est la famille `Sec-CH-UA-*` — préférez-la ' +
    "quand les serveurs se soucient de l'identité du navigateur.",
  'shared.info.header.acceptCh.summary':
    'Liste les en-têtes Client Hint que le serveur souhaite sur les requêtes suivantes.',
  'shared.info.header.acceptCh.body1':
    "Les navigateurs n'envoient que les indications auxquelles le serveur a souscrit ici (hormis les valeurs " +
    'par défaut à faible entropie).',
  'shared.info.header.criticalCh.summary':
    "Sous-ensemble d'`Accept-CH` que le serveur juge critique — les navigateurs relanceront la requête pour " +
    'les inclure.',
  'shared.info.header.criticalCh.body1':
    'À utiliser avec parcimonie : chaque manque Critical-CH coûte un aller-retour.',
  'shared.info.header.saveData.summary':
    "`on` quand l'utilisateur a activé un mode économie de données dans son navigateur/OS.",
  'shared.info.header.saveData.body1':
    "Servez-vous-en pour livrer des ressources plus légères (qualité d'image réduite, report du travail sous " +
    'la ligne de flottaison, etc.).',
  'shared.info.header.deviceMemory.summary':
    "RAM approximative de l'appareil en GiB, arrondie à un petit ensemble de valeurs (`0.25`, `0.5`, `1`, `2`, " +
    '`4`, `8`).',
  'shared.info.header.downlink.summary': 'Bande passante descendante estimée en Mbps, arrondie.',
  'shared.info.header.ect.summary': 'Effective Connection Type — `slow-2g`, `2g`, `3g` ou `4g`.',
  'shared.info.header.rtt.summary': 'Temps aller-retour estimé en millisecondes, arrondi.',

  // ── connection ────────────────────────────────────────────────────────
  'shared.info.header.connection.summary': 'Contrôles de connexion saut par saut (`keep-alive`, `close`, `upgrade`).',
  'shared.info.header.connection.body1':
    'Retiré par les proxys entre les sauts. En HTTP/2+, cet en-tête est interdit — la gestion de connexion est ' +
    'intégrée au protocole.',
  'shared.info.header.keepAlive.summary': 'Indications de pool de connexions — typiquement `timeout=N, max=N`.',
  'shared.info.header.keepAlive.body1': "N'a de sens qu'avec `Connection: keep-alive` en HTTP/1.1. Ignoré en HTTP/2+.",
  'shared.info.header.upgrade.summary':
    'Demande de changer de protocole sur la même connexion (WebSocket, HTTP/2 en clair).',
  'shared.info.header.upgrade.body1': 'Utilisé avec `Connection: upgrade`. WebSocket : `Upgrade: websocket`.',
  'shared.info.header.te.summary': 'Encodages de transfert que le client acceptera (`trailers`, `gzip`, …).',
  'shared.info.header.te.body1':
    "La plupart des clients modernes n'envoient que `TE: trailers` pour accepter les en-têtes de fin.",
  'shared.info.header.expect.summary': 'Préconditions côté serveur que le client attend (`100-continue`).',
  'shared.info.header.expect.body1':
    "`Expect: 100-continue` permet au client de n'envoyer le corps qu'après le signal `100 Continue` du serveur.",
  'shared.info.header.altSvc.summary': "Annonce d'autres moyens d'atteindre la même origine (p. ex. HTTP/3 sur QUIC).",
  'shared.info.header.altSvc.body1':
    "Les navigateurs mettent l'annonce en cache et peuvent basculer vers l'alternative pour les requêtes suivantes.",
  'shared.info.header.secWebsocketKey.summary':
    'Nonce aléatoire encodé en base64 envoyé lors de la poignée de main WebSocket.',
  'shared.info.header.secWebsocketKey.body1':
    "Le serveur répond avec `Sec-WebSocket-Accept` dérivé de cette clé + un GUID fixe, prouvant qu'il comprend " +
    'WebSocket.',
  'shared.info.header.secWebsocketAccept.summary':
    'Preuve du serveur pour la poignée de main WebSocket — `SHA-1(Sec-WebSocket-Key + GUID)` encodé en base64.',
  'shared.info.header.secWebsocketVersion.summary':
    'Version du protocole WebSocket demandée par le client. Presque toujours `13` (RFC 6455).',
  'shared.info.header.secWebsocketProtocol.summary':
    'Négociation de sous-protocole pour WebSocket — liste séparée par des virgules en requête, valeur unique ' +
    'retenue en réponse.',
  'shared.info.header.secWebsocketExtensions.summary':
    'Extensions WebSocket négociées (compression, etc.) — le plus souvent `permessage-deflate`.',

  // ── content ───────────────────────────────────────────────────────────
  'shared.info.header.contentType.summary': 'Type de média du corps de la requête ou de la réponse.',
  'shared.info.header.contentType.body1':
    'Détermine comment le navigateur analyse le corps — de mauvaises valeurs causent des échecs silencieux ' +
    '(JSON analysé comme HTML, etc.).',
  'shared.info.header.contentType.body2': 'Pour les types `text/*`, incluez `charset=utf-8` sauf raison contraire.',
  'shared.info.header.contentType.value.applicationJson': 'Corps JSON.',
  'shared.info.header.contentType.value.applicationXWwwFormUrlencoded': 'Champs de formulaire encodés en URL.',
  'shared.info.header.contentType.value.multipartFormData': 'Formulaire multipart / envois de fichiers.',
  'shared.info.header.contentType.value.textHtmlCharsetUtf8': 'Document HTML.',
  'shared.info.header.contentType.value.applicationOctetStream': 'Binaire opaque.',
  'shared.info.header.contentLength.summary': 'Taille du corps en octets (décodé).',
  'shared.info.header.contentLength.body1':
    'Mutuellement exclusif avec `Transfer-Encoding: chunked`. De mauvaises valeurs désynchronisent la connexion.',
  'shared.info.header.contentEncoding.summary':
    "Compression appliquée au corps — le navigateur décode avant de l'exposer au JS.",
  'shared.info.header.contentEncoding.body1':
    'Courants : `gzip`, `br` (Brotli), `zstd` (plus récent). La taille décodée est ce que voit `response.body`.',
  'shared.info.header.contentDisposition.summary':
    'Indique au navigateur si la réponse est affichée en ligne ou téléchargée.',
  'shared.info.header.contentDisposition.body1':
    '`inline` (par défaut) est rendu dans le navigateur. `attachment; filename="x"` déclenche un téléchargement ' +
    'avec ce nom de fichier par défaut.',
  'shared.info.header.accept.summary': 'Types de média que le client est prêt à recevoir.',
  'shared.info.header.accept.body1':
    'Les q-values expriment la préférence (`text/html;q=0.9`). La plupart des serveurs ignorent ' +
    "aujourd'hui tout sauf le premier type.",
  'shared.info.header.acceptEncoding.summary': 'Compressions que le client sait décoder.',
  'shared.info.header.acceptEncoding.body1':
    'Valeur navigateur typique : `gzip, deflate, br, zstd`. Les serveurs en choisissent une et répondent avec ' +
    '`Content-Encoding`.',
  'shared.info.header.acceptLanguage.summary': 'Langues humaines que le client préfère.',
  'shared.info.header.acceptLanguage.body1':
    'Le serveur sélectionne un `Content-Language` dans cette liste, avec souvent un repli par défaut.',
  'shared.info.header.transferEncoding.summary':
    "Encodage appliqué au transport uniquement — retiré avant que le corps n'atteigne l'application.",
  'shared.info.header.transferEncoding.body1':
    'Presque toujours `chunked`. Mutuellement exclusif avec `Content-Length`.',
  'shared.info.header.range.summary': "Demande une plage d'octets de la ressource au lieu du corps entier.",
  'shared.info.header.range.body1':
    'Format : `bytes=<start>-<end>` (inclusif). Le serveur répond `206 Partial Content` avec `Content-Range`.',
  'shared.info.header.contentRange.summary': "Identifie quelle plage d'octets de la ressource se trouve dans le corps.",
  'shared.info.header.contentRange.body1':
    'Format : `bytes <start>-<end>/<total>`. Renvoyé avec `206 Partial Content`.',
  'shared.info.header.acceptRanges.summary':
    'Indique au client si les requêtes de plage sont prises en charge (`bytes`) ou non (`none`).',
  'shared.info.header.contentMd5.summary':
    "Empreinte MD5 du corps encodée en Base64, pour contrôle d'intégrité. Obsolète en HTTP/1.1 (RFC 7231) mais " +
    'encore émis par certains serveurs.',
  'shared.info.header.contentMd5.body1': "L'intégrité moderne passe par `Digest` / `Want-Digest` ou par TLS lui-même.",
  'shared.info.header.contentLanguage.summary': 'Langue(s) naturelle(s) du corps de la réponse.',
  'shared.info.header.contentLanguage.body1':
    "Négocié face à l'`Accept-Language` de la requête. Les valeurs sont des étiquettes BCP-47 (`en-US`, " +
    '`de-DE`, etc.).',
  'shared.info.header.contentLocation.summary':
    "URL alternative identifiant de façon unique l'entité de cette réponse.",
  'shared.info.header.contentLocation.body1':
    'Distinct de `Location` : `Content-Location` décrit la ressource obtenue, pas une destination de redirection.',
  'shared.info.header.acceptCharset.summary':
    'Encodages de caractères acceptés par le client. Déprécié — les navigateurs modernes envoient toujours ' +
    "UTF-8 et ne l'émettent pas.",
  'shared.info.header.acceptCharset.body1': "La plupart des serveurs peuvent l'ignorer sans risque.",
  'shared.info.header.ifRange.summary':
    'Requête de plage conditionnelle : ne servir la plage que si la ressource correspond toujours à ' +
    "l'ETag ou à la date donnés.",
  'shared.info.header.ifRange.body1':
    'Si la ressource a changé, le serveur renvoie le corps complet avec `200 OK` au lieu de `206 Partial Content`.',
  'shared.info.header.trailer.summary':
    "Déclare quels noms d'en-têtes apparaîtront dans le trailer après un corps chunked.",
  'shared.info.header.trailer.body1':
    "N'a de sens qu'avec `Transfer-Encoding: chunked`. Le client doit y consentir via `TE: trailers`.",

  // ── cookies ───────────────────────────────────────────────────────────
  'shared.info.header.cookie.summary':
    'Cookies que le navigateur envoie avec cette requête, séparés par des points-virgules.',
  'shared.info.header.cookie.body1':
    'Défini par le navigateur depuis sa réserve de cookies. Ne peut pas être défini par JS directement sur ' +
    "`fetch` — utilisez `credentials: 'include'`.",
  'shared.info.header.setCookie.summary': 'Définition de cookie émise par le serveur.',
  'shared.info.header.setCookie.body1':
    'Un cookie par ligne `Set-Cookie`. Les navigateurs stockent la dernière valeur par triplet ' +
    '(nom, domaine, chemin).',
  'shared.info.header.setCookie.body2':
    'Les cookies de production devraient toujours porter `Secure`, `HttpOnly` et un `SameSite` explicite ' +
    '(Lax ou Strict).',
  'shared.info.header.setCookie.directive.secure': 'Envoyé uniquement via HTTPS.',
  'shared.info.header.setCookie.directive.httpOnly': 'Caché de JavaScript (document.cookie).',
  'shared.info.header.setCookie.directive.sameSiteStrictLaxNone':
    "Politique d'envoi inter-site. `None` exige `Secure`.",
  'shared.info.header.setCookie.directive.domainHost': 'Envoyer à cet hôte et à tous ses sous-domaines.',
  'shared.info.header.setCookie.directive.pathPath': 'Envoyer uniquement aux URL commençant par ce chemin.',
  'shared.info.header.setCookie.directive.maxAgeN': 'TTL en secondes (prime sur Expires).',
  'shared.info.header.setCookie.directive.expiresDate': 'Expiration absolue ; omise = cookie de session.',
  'shared.info.header.setCookie.directive.partitioned': 'CHIPS — partitionné par site de premier niveau.',

  // ── cors ──────────────────────────────────────────────────────────────
  'shared.info.header.accessControlAllowOrigin.summary':
    'Indique au navigateur quelles origines peuvent lire cette réponse.',
  'shared.info.header.accessControlAllowOrigin.body1':
    "Défini sur la réponse par le serveur. Le navigateur le compare à l'en-tête `Origin` de la requête et " +
    "empêche JavaScript de lire le corps s'ils ne correspondent pas.",
  'shared.info.header.accessControlAllowOrigin.body2':
    '`*` accepte toute origine mais est incompatible avec les identifiants — si la requête porte des cookies ' +
    "ou une authentification, la réponse doit renvoyer l'origine demandeuse exacte à la place.",
  'shared.info.header.accessControlAllowOrigin.value.wildcard':
    "N'importe quelle origine peut lire (sans identifiants).",
  'shared.info.header.accessControlAllowOrigin.value.httpsAppOpenheadersIo': "Seule l'origine nommée peut lire.",
  'shared.info.header.accessControlAllowCredentials.summary':
    'Autorise le navigateur à exposer la réponse quand la requête portait des identifiants.',
  'shared.info.header.accessControlAllowCredentials.body1':
    'Doit être `true` (en minuscules). Dans ce cas, `Access-Control-Allow-Origin` ne doit PAS être `*` — il ' +
    "doit renvoyer l'origine exacte.",
  'shared.info.header.accessControlAllowMethods.summary':
    'Liste les méthodes HTTP que le serveur accepte pour les requêtes cross-origin.',
  'shared.info.header.accessControlAllowMethods.body1':
    'Renvoyé sur les réponses de preflight (`OPTIONS`). Le navigateur met la réponse en cache pendant ' +
    '`Access-Control-Max-Age` secondes.',
  'shared.info.header.accessControlAllowHeaders.summary':
    'Liste les en-têtes de requête que le serveur accepte sur les requêtes cross-origin.',
  'shared.info.header.accessControlAllowHeaders.body1':
    "Requis quand le navigateur fait un preflight pour des en-têtes non simples (tout au-delà d'`Accept`, " +
    '`Accept-Language`, `Content-Language` et des valeurs `Content-Type` simples).',
  'shared.info.header.accessControlExposeHeaders.summary': 'Liste les en-têtes de réponse que JavaScript peut lire.',
  'shared.info.header.accessControlExposeHeaders.body1':
    'Par défaut, JS ne voit que les en-têtes de réponse de la liste sûre CORS (`Cache-Control`, ' +
    '`Content-Language`, `Content-Type`, `Expires`, `Last-Modified`, `Pragma`). Tout autre en-tête doit être ' +
    'nommé ici pour que `response.headers.get(...)` le renvoie.',
  'shared.info.header.accessControlMaxAge.summary':
    'Durée pendant laquelle le navigateur peut mettre en cache la réponse de preflight, en secondes.',
  'shared.info.header.accessControlMaxAge.body1':
    'De grandes valeurs réduisent le bavardage de preflight — 86400 (1 jour) est courant. Chrome plafonne à ' +
    '7200 secondes ; Firefox à 86400.',
  'shared.info.header.accessControlRequestMethod.summary':
    'Envoyé lors du preflight pour déclarer la méthode que la vraie requête utilisera.',
  'shared.info.header.accessControlRequestMethod.body1':
    'Le serveur répond avec `Access-Control-Allow-Methods` pour confirmer.',
  'shared.info.header.accessControlRequestHeaders.summary':
    'Envoyé lors du preflight pour déclarer les en-têtes que la vraie requête portera.',
  'shared.info.header.accessControlRequestHeaders.body1': 'Reflété via `Access-Control-Allow-Headers` si accepté.',
  'shared.info.header.origin.summary': "Identifie l'origine à l'initiative d'une requête cross-origin ou POST.",
  'shared.info.header.origin.body1':
    'Envoyé automatiquement par le navigateur. Ne peut pas être défini par JS. Utilisé par les serveurs pour ' +
    'décider des réponses CORS et par les défenses CSRF.',
  'shared.info.header.vary.summary':
    'Indique aux caches quels en-têtes de requête influencent la réponse, pour faire varier la clé de cache.',
  'shared.info.header.vary.body1':
    'Critique pour CORS : incluez `Vary: Origin` dès que `Access-Control-Allow-Origin` est calculé depuis ' +
    "l'origine de la requête, sinon un cache servira la réponse d'une origine à une autre.",
  'shared.info.header.timingAllowOrigin.summary':
    'Permet aux origines étrangères de lire les métriques de timing détaillées (`PerformanceResourceTiming`) ' +
    'de cette ressource.',
  'shared.info.header.timingAllowOrigin.body1':
    "Sans cet en-tête, les ressources cross-origin n'exposent que des timings grossiers.",

  // ── fetch-metadata ────────────────────────────────────────────────────
  'shared.info.header.secFetchSite.summary':
    "Défini par le navigateur : relation entre l'initiateur de la requête et la cible.",
  'shared.info.header.secFetchSite.body1':
    'Valeurs : `same-origin`, `same-site`, `cross-site`, `none` (navigation directe).',
  'shared.info.header.secFetchMode.summary': 'Défini par le navigateur : le mode fetch de la requête.',
  'shared.info.header.secFetchMode.body1': 'Valeurs : `cors`, `no-cors`, `same-origin`, `navigate`, `websocket`.',
  'shared.info.header.secFetchDest.summary':
    'Défini par le navigateur : où la réponse sera utilisée (document, script, image, etc.).',
  'shared.info.header.secFetchDest.body1':
    'Permet au serveur de détecter des récupérations surprenantes — p. ex. une réponse HTML demandée comme ' +
    '`Sec-Fetch-Dest: script`.',
  'shared.info.header.secFetchUser.summary':
    "Défini par le navigateur : `?1` quand la navigation vient d'une activation utilisateur directe.",
  'shared.info.header.secFetchUser.body1':
    'Absent sinon. Utile pour distinguer les clics utilisateur de la navigation programmatique.',
  'shared.info.header.secPurpose.summary':
    'Défini par le navigateur quand la requête est spéculative — p. ex. `prefetch`, `prerender`.',
  'shared.info.header.secPurpose.body1':
    "Permet au serveur d'éviter les effets de bord (analytique, journaux d'écriture) pour les récupérations " +
    "que l'utilisateur n'a pas encore réellement demandées.",

  // ── performance ───────────────────────────────────────────────────────
  'shared.info.header.priority.summary':
    "Indique au serveur (ou au client) l'urgence et le caractère incrémental de ce transfert.",
  'shared.info.header.priority.body1':
    'Format : `u=<0-7>` (urgence, plus bas = plus prioritaire) et `, i` optionnel (incrémental — peut être ' +
    "traité au fil de l'arrivée).",
  'shared.info.header.upgradeInsecureRequests.summary':
    '`1` défini par le navigateur — indique au serveur que le client préfère HTTPS pour les ressources embarquées.',
  'shared.info.header.upgradeInsecureRequests.body1':
    'Associé côté réponse à la directive CSP `upgrade-insecure-requests`.',
  'shared.info.header.earlyData.summary': '`1` — défini par les clients envoyant des données en mode 0-RTT de TLS 1.3.',
  'shared.info.header.earlyData.body1':
    'Les serveurs devraient rejeter les données précoces sur les méthodes non idempotentes (POST, etc.) pour ' +
    'éviter les attaques par rejeu.',
  'shared.info.header.link.summary': 'Indications de ressources — preload / prefetch / preconnect / dns-prefetch.',
  'shared.info.header.link.body1':
    'Mêmes sémantiques que `<link rel="...">` en HTML ; utile depuis des réponses non HTML (API, redirections).',
  'shared.info.header.link.value.styleCssRelPreloadAsStyle': 'Précharger une feuille de style.',
  'shared.info.header.link.value.httpsCdnExampleComRelPreconnect': "Ouvrir une connexion à l'avance.",
  'shared.info.header.xDnsPrefetchControl.summary':
    'Active/désactive le préchargement DNS du navigateur pour les liens de la page (`on` / `off`).',

  // ── privacy ───────────────────────────────────────────────────────────
  'shared.info.header.dnt.summary': "Do Not Track — `1` si l'utilisateur a refusé le pistage. Largement déprécié.",
  'shared.info.header.dnt.body1':
    "La plupart des grands sites l'ignorent ; le W3C a abandonné la spécification en 2019. La conformité est " +
    'volontaire.',
  'shared.info.header.secGpc.summary':
    "Global Privacy Control — `1` signale que l'utilisateur ne veut pas que ses données soient vendues ou " +
    'partagées.',
  'shared.info.header.secGpc.body1':
    'Juridiquement contraignant sous le CCPA en Californie ; honoré par certains navigateurs axés ' +
    'confidentialité (Brave, Firefox, DuckDuckGo).',

  // ── proxy ─────────────────────────────────────────────────────────────
  'shared.info.header.via.summary': 'Liste les proxys / passerelles traversés par le message.',
  'shared.info.header.via.body1':
    'Chaque proxy ajoute son identifiant afin que la chaîne puisse être reconstituée pour le débogage.',
  'shared.info.header.xForwardedFor.summary':
    "Non standard mais omniprésent : chaîne d'IP clientes séparées par des virgules à travers les proxys.",
  'shared.info.header.xForwardedFor.body1':
    "L'entrée la plus à gauche est le client d'origine. L'en-tête `Forwarded` de la RFC 7239 est l'alternative " +
    'normalisée.',
  'shared.info.header.xForwardedProto.summary':
    "Schéma d'origine (`http` ou `https`) utilisé par le client pour atteindre le premier proxy.",
  'shared.info.header.xForwardedHost.summary':
    "En-tête `Host` d'origine envoyé par le client avant réécriture par le proxy.",
  'shared.info.header.xRealIp.summary':
    "IP d'origine du client vue par le premier proxy. Valeur unique, pas une chaîne.",
  'shared.info.header.forwarded.summary':
    'Chaîne de proxys normalisée par la RFC 7239 — remplace la famille `X-Forwarded-*`.',
  'shared.info.header.forwarded.body1':
    'Format : `for=client; proto=https; by=proxy; host=original-host`. Plusieurs proxys séparés par des virgules.',
  'shared.info.header.trueClientIp.summary':
    "IP d'origine du client transmise par Akamai / Cloudflare Enterprise — valeur unique, pas une chaîne.",

  // ── routing ───────────────────────────────────────────────────────────
  'shared.info.header.authority.summary':
    'Pseudo-en-tête HTTP/2+ — équivalent de `Host` en HTTP/1.1. Identifie le serveur cible.',
  'shared.info.header.authority.body1':
    'Les pseudo-en-têtes commencent par `:` et doivent précéder les en-têtes ordinaires. Le navigateur les ' +
    'définit ; JavaScript ne le peut pas.',
  'shared.info.header.method.summary': 'Pseudo-en-tête HTTP/2+ — la méthode de la requête (`GET`, `POST`, …).',
  'shared.info.header.path.summary': 'Pseudo-en-tête HTTP/2+ — le chemin de la requête + la chaîne de requête.',
  'shared.info.header.scheme.summary': 'Pseudo-en-tête HTTP/2+ — `https` ou `http`.',
  'shared.info.header.status.summary': 'Pseudo-en-tête HTTP/2+ — le statut numérique de la réponse (p. ex. `200`).',
  'shared.info.header.status.body1': 'Les pseudo-en-têtes remplacent la ligne de statut HTTP/1.1 en HTTP/2 et HTTP/3.',
  'shared.info.header.host.summary': 'Hôte cible HTTP/1.1 (et port optionnel). Remplacé par `:authority` en HTTP/2+.',
  'shared.info.header.host.body1':
    "Requis sur chaque requête HTTP/1.1. Les serveurs s'en servent pour router entre les hôtes virtuels d'une " +
    'même IP.',
  'shared.info.header.location.summary':
    "Cible de redirection — envoyée avec les réponses `3xx` ou comme résultat d'une ressource créée.",
  'shared.info.header.location.body1':
    "Les URL absolues sont universellement honorées ; les URL relatives se résolvent par rapport à l'URL de " +
    'la requête.',
  'shared.info.header.allow.summary': 'Liste les méthodes HTTP que la ressource accepte.',
  'shared.info.header.allow.body1':
    'Requis dans une réponse `405 Method Not Allowed`. Valeurs courantes : `GET, HEAD, POST, OPTIONS`.',
  'shared.info.header.referer.summary': "URL de la page à l'initiative de cette requête.",
  'shared.info.header.referer.body1':
    "Notez la faute d'orthographe historique — la spécification la conserve. Certaines destinations retirent " +
    'ou dégradent `Referer` selon la `Referrer-Policy` de la page.',
  'shared.info.header.retryAfter.summary': 'Indique au client quand réessayer — secondes (delta) ou date HTTP absolue.',
  'shared.info.header.retryAfter.body1':
    "Courant sur `503 Service Unavailable` et `429 Too Many Requests`. Les robots d'indexation l'honorent.",
  'shared.info.header.maxForwards.summary':
    'Limite le nombre de proxys pouvant transmettre une requête `TRACE` ou `OPTIONS`.',
  'shared.info.header.maxForwards.body1':
    'Décrémenté par chaque proxy de transfert. Atteint 0 → le proxy répond lui-même.',
  'shared.info.header.serviceWorker.summary':
    '`script`, défini par le navigateur quand la requête récupère un fichier de script de service worker.',
  'shared.info.header.serviceWorker.body1':
    "Permet aux serveurs de détecter les récupérations d'enregistrement de SW et de répondre avec le bon " +
    'en-tête `Service-Worker-Allowed`.',
  'shared.info.header.serviceWorkerAllowed.summary':
    'Outrepasse la restriction de chemin par défaut pour la portée du service worker.',
  'shared.info.header.serviceWorkerAllowed.body1':
    "Par défaut, un worker ne peut contrôler que son répertoire et en dessous. Cet en-tête permet d'élargir " +
    'cela — p. ex. contrôler `/` depuis un worker à `/sw.js`.',
  'shared.info.header.protocol.summary':
    'Pseudo-en-tête du mécanisme Extended CONNECT (RFC 8441) — utilisé par WebSocket sur HTTP/2 / 3.',
  'shared.info.header.protocol.body1':
    'Défini à `websocket` quand le client fait passer un WebSocket par HTTP/2 ou HTTP/3.',

  // ── security ──────────────────────────────────────────────────────────
  'shared.info.header.contentSecurityPolicy.summary':
    'Liste blanche des sources depuis lesquelles la page peut charger des ressources ou exécuter du code.',
  'shared.info.header.contentSecurityPolicy.body1':
    'Les directives sont séparées par des espaces, avec un point-virgule entre directives. La plupart des ' +
    'applications ont besoin au minimum de `default-src`, `script-src`, `style-src` et `connect-src`.',
  'shared.info.header.contentSecurityPolicy.body2':
    'Utilisez `Content-Security-Policy-Report-Only` pour observer les violations avant de les faire respecter.',
  'shared.info.header.contentSecurityPolicy.directive.defaultSrc': 'Repli pour tout -src non défini explicitement.',
  'shared.info.header.contentSecurityPolicy.directive.scriptSrc': 'Sources autorisées pour `<script>` et le JS inline.',
  'shared.info.header.contentSecurityPolicy.directive.styleSrc':
    'Sources autorisées pour les feuilles de style et le CSS inline.',
  'shared.info.header.contentSecurityPolicy.directive.imgSrc': "Sources d'images autorisées.",
  'shared.info.header.contentSecurityPolicy.directive.connectSrc': 'Cibles fetch/XHR/WebSocket autorisées.',
  'shared.info.header.contentSecurityPolicy.directive.frameAncestors':
    'Qui peut intégrer cette page dans une iframe (remplace X-Frame-Options).',
  'shared.info.header.contentSecurityPolicy.directive.reportUriReportTo':
    'Où envoyer (POST) les rapports de violation.',
  'shared.info.header.contentSecurityPolicyReportOnly.summary':
    'Même syntaxe que la CSP, mais les violations sont signalées sans être bloquées.',
  'shared.info.header.contentSecurityPolicyReportOnly.body1':
    'Utilisez-le pour tester une politique en production avant de la faire respecter.',
  'shared.info.header.strictTransportSecurity.summary':
    'Force le navigateur à utiliser HTTPS pour cet hôte pendant une durée donnée.',
  'shared.info.header.strictTransportSecurity.body1':
    'Réglez `max-age` à au moins 6 mois en production. Ajoutez `includeSubDomains` pour couvrir tous les hôtes ' +
    'du domaine.',
  'shared.info.header.strictTransportSecurity.body2':
    '`preload` permet de soumettre le domaine à la liste de préchargement HSTS intégrée aux navigateurs ' +
    '(décision à sens unique — difficile à annuler).',
  'shared.info.header.strictTransportSecurity.directive.maxAgeN':
    'Durée pendant laquelle le navigateur retient « HTTPS uniquement ».',
  'shared.info.header.strictTransportSecurity.directive.includeSubDomains': 'Appliquer à chaque sous-domaine.',
  'shared.info.header.strictTransportSecurity.directive.preload':
    'Éligibilité à la liste de préchargement des navigateurs.',
  'shared.info.header.xContentTypeOptions.summary': 'Désactive le reniflage de type MIME.',
  'shared.info.header.xContentTypeOptions.body1':
    "Une seule valeur valide : `nosniff`. Recommandé sur chaque réponse — empêche l'exécution de JS en " +
    '`text/plain`.',
  'shared.info.header.xFrameOptions.summary': 'Contrôle si la page peut être intégrée dans une iframe.',
  'shared.info.header.xFrameOptions.body1':
    'Largement supplanté par `Content-Security-Policy: frame-ancestors`. Gardez les deux pendant la transition ' +
    'pour couvrir les navigateurs plus anciens.',
  'shared.info.header.xFrameOptions.value.deny': 'Jamais intégrable.',
  'shared.info.header.xFrameOptions.value.sameorigin': 'Intégrable uniquement par des pages de même origine.',
  'shared.info.header.xXssProtection.summary': 'Bascule du filtre XSS hérité — obsolète dans les navigateurs modernes.',
  'shared.info.header.xXssProtection.body1':
    "La valeur recommandée est `0` pour désactiver le filtre (il causait plus de tort qu'il n'en prévenait). " +
    'Utilisez la CSP à la place.',
  'shared.info.header.referrerPolicy.summary':
    "Contrôle quelle part de l'URL est envoyée dans `Referer` sur les navigations et requêtes sortantes.",
  'shared.info.header.referrerPolicy.body1':
    'Envoyé comme en-tête de réponse par la destination, ou défini par page via `<meta>` / par requête via ' +
    "l'attribut `referrerpolicy`.",
  'shared.info.header.referrerPolicy.value.noReferrer': 'Ne jamais envoyer de referer.',
  'shared.info.header.referrerPolicy.value.origin': "N'envoyer que le schéma + l'hôte.",
  'shared.info.header.referrerPolicy.value.strictOriginWhenCrossOrigin':
    'Par défaut — URL complète en même origine, origine seule en cross-origin, rien lors ' +
    "d'un déclassement HTTPS→HTTP.",
  'shared.info.header.referrerPolicy.value.unsafeUrl': "Toujours envoyer l'URL complète. À éviter.",
  'shared.info.header.permissionsPolicy.summary':
    "Liste d'autorisation des fonctionnalités du navigateur (géolocalisation, caméra, USB, paiement, etc.).",
  'shared.info.header.permissionsPolicy.body1':
    "Chaque fonctionnalité est restreinte à `self`, une liste d'origines ou `*`. Remplace l'ancien en-tête " +
    '`Feature-Policy`.',
  'shared.info.header.crossOriginOpenerPolicy.summary':
    "Isole la page des relations d'ouverture cross-origin (window.opener).",
  'shared.info.header.crossOriginOpenerPolicy.body1':
    '`same-origin` active le mode crossOriginIsolated — requis pour SharedArrayBuffer et les minuteurs haute ' +
    'résolution.',
  'shared.info.header.crossOriginEmbedderPolicy.summary':
    'Exige que chaque sous-ressource chargée accorde la permission cross-origin.',
  'shared.info.header.crossOriginEmbedderPolicy.body1':
    'Réglez à `require-corp` pour crossOriginIsolated. Se combine avec `Cross-Origin-Opener-Policy: same-origin`.',
  'shared.info.header.crossOriginResourcePolicy.summary':
    "Empêche la ressource d'être chargée par des origines étrangères.",
  'shared.info.header.crossOriginResourcePolicy.body1':
    'Valeurs : `same-site`, `same-origin`, `cross-origin`. Critique pour les ressources que vous ne voulez pas ' +
    'voir récupérées par hotlink.',
  'shared.info.header.clearSiteData.summary':
    "Demande au navigateur d'effacer cookies / cache / stockage pour cette origine.",
  'shared.info.header.clearSiteData.body1': 'Utile pour les flux de déconnexion.',
  'shared.info.header.clearSiteData.value.cookies': "Effacer les cookies de l'origine.",
  'shared.info.header.clearSiteData.value.cache': "Effacer les caches HTTP et d'images.",
  'shared.info.header.clearSiteData.value.storage':
    'Effacer localStorage / IndexedDB / les enregistrements de Service Worker.',
  'shared.info.header.clearSiteData.value.wildcard': 'Tout effacer.',
  'shared.info.header.originAgentCluster.summary':
    '`?1` demande au navigateur de donner à cette origine son propre agent cluster (processus).',
  'shared.info.header.originAgentCluster.body1':
    'Offre une meilleure isolation pour `SharedArrayBuffer`, performance.measureUserAgentSpecificMemory, etc.',
  'shared.info.header.xRobotsTag.summary': "Directives d'indexation pour les robots (`noindex`, `nofollow`, …).",
  'shared.info.header.xRobotsTag.body1':
    'Mêmes sémantiques que la balise `<meta name="robots">`, mais s\'applique aux réponses non HTML ' +
    '(PDF, JSON, images).',
  'shared.info.header.xUaCompatible.summary':
    'Directive héritée IE/Edge (`IE=edge`) — choisit le moteur de rendu. Obsolète dans les navigateurs modernes.',

  // ── server-id ─────────────────────────────────────────────────────────
  'shared.info.header.server.summary':
    "Identification logicielle du serveur d'origine (p. ex. `nginx/1.27`, `cloudflare`).",
  'shared.info.header.server.body1':
    'Souvent retiré ou fixé à une valeur constante en production pour raisons de sécurité opérationnelle.',
  'shared.info.header.xPoweredBy.summary':
    'En-tête non standard identifiant le framework / runtime derrière la réponse.',
  'shared.info.header.xPoweredBy.body1':
    'Couramment émis par Express, PHP, ASP.NET, etc. Souvent supprimé en production.',
  'shared.info.header.date.summary': "Horodatage du serveur d'origine à la génération du message.",
  'shared.info.header.date.body1':
    "Utilisé par les caches pour calculer l'âge de la réponse. Format : IMF-fixdate " +
    '(`Mon, 18 May 2026 15:05:25 GMT`).',
  'shared.info.header.xServedBy.summary': 'Identifie quel nœud edge / cache du CDN a servi la réponse.',
  'shared.info.header.xServedBy.body1':
    'Séparé par des virgules quand plusieurs niveaux ont traité la requête (shield → edge). Le format varie ' +
    'selon le fournisseur (POP Fastly, edges AWS CloudFront, etc.).',

  // ── tracing ───────────────────────────────────────────────────────────
  'shared.info.header.serverTiming.summary': 'Métriques de performance que le serveur attache à la réponse.',
  'shared.info.header.serverTiming.body1':
    'Visible dans DevTools et l\'API JS `PerformanceServerTiming`. Format : `<name>;dur=<ms>[;desc="..."]`, ' +
    'séparé par des virgules.',
  'shared.info.header.traceparent.summary': 'Trace-context W3C : identifie un span dans une trace distribuée.',
  'shared.info.header.traceparent.body1':
    'Format : `<version>-<trace-id>-<parent-id>-<flags>`. Transporté entre services pour permettre le ' +
    'réassemblage des traces.',
  'shared.info.header.tracestate.summary': 'Compagnon trace-context propre au fournisseur de `traceparent`.',
  'shared.info.header.tracestate.body1':
    'Paires `vendor=value` séparées par des virgules. Chaque fournisseur de traçage y stocke son propre état.',
  'shared.info.header.xRequestId.summary':
    'Identifiant attribué par le serveur à cette requête — répercuté dans les journaux et entre services.',
  'shared.info.header.xRequestId.body1':
    'Non standard mais omniprésent. Utile pour corréler le comportement client avec les journaux serveur ' +
    'pendant le débogage.',
  'shared.info.header.xFastlyRequestId.summary':
    'Identifiant de requête Fastly — à corréler avec les journaux / le débogage Fastly.',
  'shared.info.header.reportingEndpoints.summary':
    'Nomme les destinations des rapports générés par le navigateur (violations CSP, dépréciations, NEL, …).',
  'shared.info.header.reportingEndpoints.body1':
    'Format : `name="https://reports.example.com", name2="https://..."`. Remplace l\'ancien en-tête `Report-To`.',
  'shared.info.header.reportTo.summary':
    'Ancienne déclaration de points de collecte au format JSON — supplantée par `Reporting-Endpoints`.',
  'shared.info.header.nel.summary':
    'Politique Network Error Logging — configuration JSON nommant un point de collecte pour les échecs de ' +
    'connexion et erreurs de protocole.',
  'shared.info.header.nel.body1':
    "Le point de collecte doit déjà être enregistré via `Reporting-Endpoints` (ou l'ancien `Report-To`).",
  'shared.info.header.cfRay.summary':
    'Identifiant de requête Cloudflare — sert à corréler la requête dans les journaux Cloudflare.',
  'shared.info.header.cfRay.body1':
    'Format : `<request-id>-<colo-id>` où colo-id identifie le centre de données Cloudflare qui a servi la requête.',
} as const satisfies Catalog;
