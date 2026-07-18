/**
 * DevTools panel — inspector Headers tab — Spanish. Mirrors
 * `catalogs/en/panel-inspector-headers.ts` key for key. Header names,
 * category names, directive tokens, filter grammar tokens (name: /
 * value: / is:), Set-Cookie / SameSite / JWT / alg / scheme
 * vocabulary, and wire values stay raw. Where en capitalizes `Cookie`
 * the es sentence keeps the capital token (`La Cookie ya ha
 * caducado`) — the S60/S61 case-sensitive dodge, fr precedent.
 * Expiry rides the shared-info-cookies `caducar`/`caducidad` family.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorHeaders = {
  // ── Headers tab (inspector detail) ──────────────────────────────────
  'panel.inspector.headers.filterPlaceholder':
    'Filtrar — texto, name:cookie, value:no-cache, is:rule, is:security, is:overridable, …',
  'panel.inspector.headers.filterAria': 'Filtrar los encabezados',
  'panel.inspector.headers.footprintTitle': '{rules} — haz clic para abrir Reglas coincidentes',

  // General section + the rule-creation CTAs on its summary.
  'panel.inspector.headers.generalSection': 'General',
  'panel.inspector.headers.createApiRequest': 'Crear solicitud API',
  'panel.inspector.headers.createApiRequestTitle':
    'Abrir esta solicitud en el cliente API del espacio de trabajo como un borrador prerrellenado — no se ' +
    'guarda nada hasta que lo guardes',
  'panel.inspector.headers.redirect.label': 'Redirigir',
  'panel.inspector.headers.redirect.title':
    'Enviar las solicitudes coincidentes a otro sitio — elige cómo se prerrellena el destino',
  'panel.inspector.headers.redirect.url': 'URL de redirección…',
  'panel.inspector.headers.redirect.urlTitle':
    'Enviar las solicitudes coincidentes a una URL distinta — el destino se siembra como variable por dominio',
  'panel.inspector.headers.redirect.replaceHost': 'Reemplazar el host…',
  'panel.inspector.headers.redirect.replaceHostTitle':
    'Conservar la ruta y la consulta, cambiar el host — siembra una variable de host por dominio',
  'panel.inspector.headers.redirect.localhost': 'Apuntar a localhost…',
  'panel.inspector.headers.redirect.localhostTitle':
    'Conservar la ruta y la consulta, enviar a tu servidor de desarrollo local por http — siembra una ' +
    'variable de puerto por dominio',
  'panel.inspector.headers.overrideQueryParamsTitle':
    'Añadir, reemplazar o quitar los parámetros de consulta de esta solicitud',
  'panel.inspector.headers.more.label': 'Más',
  'panel.inspector.headers.more.title': 'Más acciones sobre la solicitud',
  'panel.inspector.headers.more.delay': 'Retrasar la solicitud',
  'panel.inspector.headers.more.delayTitle': 'Retrasar esta solicitud',
  'panel.inspector.headers.more.block': 'Bloquear la solicitud',
  'panel.inspector.headers.more.blockTitle': 'Bloquear / cancelar esta solicitud',

  // General rows. The (i) corpus titles reuse these row-label keys and
  // the kicker reuses `generalSection` (names-its-control).
  'panel.inspector.headers.general.requestUrl': 'URL de la solicitud',
  'panel.inspector.headers.general.requestMethod': 'Método de la solicitud',
  'panel.inspector.headers.general.statusCode': 'Código de estado',
  'panel.inspector.headers.general.remoteAddress': 'Dirección remota',
  'panel.inspector.headers.general.httpVersion': 'Versión HTTP',
  'panel.inspector.headers.general.compression': 'Compresión',
  'panel.inspector.headers.general.transferred': 'Transferido',
  'panel.inspector.headers.general.referrerPolicy': 'Política de referrer',
  'panel.inspector.headers.general.decodedSuffix': '(descodificado {size})',

  // General (i) corpus.
  'panel.inspector.headers.generalInfo.requestUrl.summary':
    'La URL completa contra la que el navegador emitió la solicitud — esquema, host, ruta y cadena de consulta.',
  'panel.inspector.headers.generalInfo.requestMethod.summary':
    'El método HTTP usado (`GET`, `POST`, `PUT`, `DELETE`, …).',
  'panel.inspector.headers.generalInfo.statusCode.summary': 'El código numérico de respuesta que devolvió el servidor.',
  'panel.inspector.headers.generalInfo.statusCode.ranges': 'Rangos',
  'panel.inspector.headers.generalInfo.statusCode.r1xx': 'Informativo (raro — `100 Continue`, `103 Early Hints`).',
  'panel.inspector.headers.generalInfo.statusCode.r2xx': 'Éxito.',
  'panel.inspector.headers.generalInfo.statusCode.r3xx': 'Redirección (mira el encabezado `Location`).',
  'panel.inspector.headers.generalInfo.statusCode.r4xx':
    'Error de cliente — la solicitud estaba mal formada o no autorizada.',
  'panel.inspector.headers.generalInfo.statusCode.r5xx':
    'Error de servidor — el servidor no pudo atender una solicitud válida.',
  'panel.inspector.headers.generalInfo.remoteAddress.summary':
    'La dirección IP y el puerto a los que realmente se envió la solicitud.',
  'panel.inspector.headers.generalInfo.remoteAddress.description':
    'Difiere del host de la URL cuando el DNS resuelve a varias IP, un CDN enruta por anycast o un proxy ' +
    'local intercepta la conexión.',
  'panel.inspector.headers.generalInfo.httpVersion.summary': 'La versión del protocolo HTTP que negoció la conexión.',
  'panel.inspector.headers.generalInfo.httpVersion.description':
    'Se elige en el momento del TLS vía ALPN. El valor real en la red (p. ej. `h2`, `h3`) se muestra en la ' +
    'descripción emergente cuando difiere de la etiqueta amigable.',
  'panel.inspector.headers.generalInfo.httpVersion.http11':
    'Textual, una solicitud por conexión de forma predeterminada.',
  'panel.inspector.headers.generalInfo.httpVersion.http2': 'Binario, multiplexado sobre una sola conexión TCP.',
  'panel.inspector.headers.generalInfo.httpVersion.http3':
    'Construido sobre QUIC encima de UDP — handshakes más rápidos, mejor recuperación de pérdidas.',
  'panel.inspector.headers.generalInfo.compression.summary':
    'La codificación que el servidor aplicó al cuerpo de la respuesta — el navegador descodifica antes de ' +
    'exponerlo a JavaScript.',
  'panel.inspector.headers.generalInfo.compression.gzip': 'Compatible universalmente, tasa de compresión modesta.',
  'panel.inspector.headers.generalInfo.compression.br':
    'Brotli — mejor tasa que gzip, compatible con todos los navegadores modernos.',
  'panel.inspector.headers.generalInfo.compression.zstd':
    'Compresión de alta tasa más reciente; compatibilidad creciente en navegadores.',
  'panel.inspector.headers.generalInfo.compression.deflate': 'Heredado, raramente usado hoy.',
  'panel.inspector.headers.generalInfo.transferred.summary':
    'Bytes que realmente cruzaron la red, incluido el sobrecoste de compresión.',
  'panel.inspector.headers.generalInfo.transferred.description':
    'El tamaño descodificado entre paréntesis es lo que ve JavaScript después de que el navegador ' +
    'descomprima el cuerpo. Una gran diferencia entre ambos es la ganancia de compresión.',
  'panel.inspector.headers.generalInfo.referrerPolicy.summary':
    'Cuánta parte de la URL envía el navegador en `Referer` en las navegaciones y solicitudes salientes de ' +
    'esta página.',
  'panel.inspector.headers.generalInfo.referrerPolicy.description':
    'Se define vía el encabezado de respuesta `Referrer-Policy`, la etiqueta `<meta name="referrer">`, o por ' +
    'solicitud vía el atributo `referrerpolicy`.',

  // Provisional request headers — banner variants are whole sentences.
  'panel.inspector.headers.provisional.bannerCached':
    'Se muestran encabezados provisionales — servida desde la caché, así que los encabezados enviados ' +
    'originales no se almacenan.',
  'panel.inspector.headers.provisional.bannerPending':
    'Se muestran encabezados provisionales — el conjunto enviado por la red aún no se ha confirmado.',
  'panel.inspector.headers.provisional.title': 'Encabezados provisionales',
  'panel.inspector.headers.provisional.kicker': 'Solicitud',
  'panel.inspector.headers.provisional.summary':
    'Estos son los encabezados que el navegador ensambló y pretendía enviar — no una captura confirmada de lo ' +
    'que cruzó la red. El conjunto real puede diferir (la pila de red añade cookies, credenciales y ' +
    'encabezados de conexión más tarde).',
  'panel.inspector.headers.provisional.whyHeading': 'Por qué una solicitud muestra solo encabezados provisionales',
  'panel.inspector.headers.provisional.cacheLabel': 'Servida desde la caché',
  'panel.inspector.headers.provisional.cacheDesc':
    'Respondida localmente (caché de memoria/disco o un service worker) — esta vez no salió nada a la red, ' +
    'así que los encabezados enviados originales nunca se almacenaron.',
  'panel.inspector.headers.provisional.blockedLabel': 'Nunca alcanzó la red',
  'panel.inspector.headers.provisional.blockedDesc':
    'Bloqueada o fallida antes de completarse un intercambio de encabezados (una URL no válida, un bloqueo ' +
    'CORS/CSP, un error de conexión).',
  'panel.inspector.headers.provisional.inFlightLabel': 'Todavía en vuelo',
  'panel.inspector.headers.provisional.inFlightDesc':
    'El conjunto enviado por la red aún no se ha comunicado; se resuelve cuando la solicitud termina.',

  // Header sections. The `SectionLabel` identifiers stay raw (the
  // search plane compares against them — S36 doc-identifier law);
  // these are their display forms, mapped at the render site.
  'panel.inspector.headers.section.responseHeaders': 'Encabezados de respuesta',
  'panel.inspector.headers.section.requestHeaders': 'Encabezados de solicitud',
  'panel.inspector.headers.section.countAria': 'recuento de encabezados visibles',
  'panel.inspector.headers.section.addHeader': 'Añadir encabezado',
  'panel.inspector.headers.section.raw': 'Sin procesar',
  'panel.inspector.headers.section.rawTitle': 'Mostrar como texto plano (Name: Value)',
  'panel.inspector.headers.section.copy': 'Copiar',
  'panel.inspector.headers.section.copyAll': 'Copiar todo',
  'panel.inspector.headers.section.copyFiltered': 'Copiar los filtrados',
  'panel.inspector.headers.section.copyCurl': 'Copiar como cURL',
  'panel.inspector.headers.section.copyFetch': 'Copiar como fetch',
  'panel.inspector.headers.section.noneCaptured': 'Ninguno capturado.',
  'panel.inspector.headers.section.noFilterMatch': 'Ningún encabezado coincide con el filtro.',
  'panel.inspector.headers.section.noiseHidden': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} encabezado de ruido oculto — pasa el cursor para ver los nombres',
      many: '{count} encabezados de ruido ocultos — pasa el cursor para ver los nombres',
      other: '{count} encabezados de ruido ocultos — pasa el cursor para ver los nombres',
    }),

  // More filters ▾ / View ▾ menus — this tab's own menus, separate
  // referents from the network toolbar's.
  'panel.inspector.headers.moreFilters.label': 'Filtros adicionales',
  'panel.inspector.headers.moreFilters.ruleOnly': 'Solo modificados por una regla',
  'panel.inspector.headers.moreFilters.securityOnly': 'Solo encabezados de seguridad',
  'panel.inspector.headers.moreFilters.overridableOnly': 'Solo sustituibles',
  'panel.inspector.headers.moreFilters.hideNoise': 'Ocultar el ruido (Accept-*, Sec-Fetch-*, User-Agent, …)',
  'panel.inspector.headers.view.label': 'Vista',
  'panel.inspector.headers.view.layout': 'Disposición',
  'panel.inspector.headers.view.layoutGrouped': 'Agrupada',
  'panel.inspector.headers.view.layoutFlat': 'Plana',
  'panel.inspector.headers.view.sort': 'Orden',
  'panel.inspector.headers.view.sortOriginal': 'Original',
  'panel.inspector.headers.view.sortAz': 'A → Z',
  'panel.inspector.headers.view.sortRuleFirst': 'Modificados por regla primero',
  'panel.inspector.headers.view.nameCase': 'Caja de los nombres',
  'panel.inspector.headers.view.nameCaseTrain': 'Train-Case',
  'panel.inspector.headers.view.nameCaseOriginal': 'Original (sin procesar)',
  'panel.inspector.headers.view.showTags': 'Mostrar las etiquetas',
  'panel.inspector.headers.view.showSuggestions': 'Mostrar las sugerencias',

  // Header rows. Since-fire chips render `· ` raw before the keyed
  // label. Header names ride the override titles as {name} holes.
  'panel.inspector.headers.row.expandValue': 'Expandir el valor',
  'panel.inspector.headers.row.collapseValue': 'Contraer el valor',
  'panel.inspector.headers.row.copyValue': 'Copiar el valor',
  'panel.inspector.headers.row.copied': 'Copiado',
  'panel.inspector.headers.row.edit': 'Editar',
  'panel.inspector.headers.row.editTitle': 'Editar la regla que estableció este encabezado',
  'panel.inspector.headers.row.override': 'Sustituir',
  'panel.inspector.headers.row.overrideTitle': 'Crear una regla para sustituir este encabezado',
  'panel.inspector.headers.row.overrideProtectedTitle':
    '{name} es un encabezado protegido — el motor Declarative Net Request del navegador no permite que las ' +
    'extensiones lo sustituyan. Los nombres protegidos comunes incluyen host, content-length, connection, ' +
    'sec-fetch-*, sec-ch-ua-*.',
  'panel.inspector.headers.row.overrideSystemTitle':
    '{name} lo inyecta {feature}, una función de sistema de Open Headers — no sustituible con una regla.',
  'panel.inspector.headers.row.overrideManagedTitle':
    '{name} ya lo gestiona una de tus reglas — edita la regla desde su popover en lugar de sustituirlo.',
  'panel.inspector.headers.row.systemTitle': 'Inyectado por {feature} (función de sistema de Open Headers)',
  'panel.inspector.headers.row.sinceFire.deleted': 'regla eliminada desde entonces',
  'panel.inspector.headers.row.sinceFire.deletedTitle':
    'La regla se ha eliminado después de esta solicitud — no se aplicará a las solicitudes futuras',
  'panel.inspector.headers.row.sinceFire.disabled': 'regla desactivada desde entonces',
  'panel.inspector.headers.row.sinceFire.disabledTitle':
    'La regla se ha desactivado después de esta solicitud — no se aplicará a las solicitudes futuras',
  'panel.inspector.headers.row.sinceFire.edited': 'regla editada desde entonces',
  'panel.inspector.headers.row.sinceFire.editedTitle':
    'La regla se ha editado después de esta solicitud — la regla actual solo se aplica a las solicitudes futuras',
  'panel.inspector.headers.row.sinceFire.value': 'variable cambiada desde entonces',
  'panel.inspector.headers.row.sinceFire.valueTitle':
    'Una variable que referencia esta regla ahora se resuelve a otro valor — solo se aplica a las solicitudes ' +
    'futuras',

  // Value chips.
  'panel.inspector.headers.chips.expires': 'caduca {duration}',
  'panel.inspector.headers.chips.session': 'sesión',
  'panel.inspector.headers.chips.missingFlag': 'sin {flag}',
  'panel.inspector.headers.chips.expired': 'caducada',

  // Chip (i) corpora.
  'panel.inspector.headers.chipInfo.setCookieFlagKicker': 'Atributo de Set-Cookie',
  'panel.inspector.headers.chipInfo.httpOnly.summary':
    'La Cookie queda oculta a JavaScript (no se puede leer vía `document.cookie`).',
  'panel.inspector.headers.chipInfo.httpOnly.description':
    'Mitiga el XSS — un script inyectado ya no puede exfiltrar la cookie. No ayuda contra el CSRF.',
  'panel.inspector.headers.chipInfo.secure.summary': 'Cookie enviada solo por HTTPS. Nunca se filtra por HTTP plano.',
  'panel.inspector.headers.chipInfo.partitioned.summary':
    'CHIPS — la Cookie se particiona por sitio de nivel superior.',
  'panel.inspector.headers.chipInfo.partitioned.description':
    'Cada sitio de nivel superior recibe su propia copia de la cookie, así que los contextos incrustados no ' +
    'pueden usar cookies para rastrear al usuario entre sitios.',
  'panel.inspector.headers.chipInfo.sameSiteStrict':
    'Cookie enviada solo en solicitudes same-site. La protección CSRF más fuerte — incluso los enlaces desde ' +
    'otro sitio llegan sin cookie.',
  'panel.inspector.headers.chipInfo.sameSiteLax':
    'Cookie enviada en solicitudes same-site y navegaciones cross-site de nivel superior (clics en enlaces). ' +
    'Predeterminado en los navegadores modernos.',
  'panel.inspector.headers.chipInfo.sameSiteNone':
    'Cookie enviada en todas las solicitudes cross-site. Requiere `Secure`. Úsalo a propósito — los ' +
    'destinatarios pueden correlacionar la cookie entre sitios.',
  'panel.inspector.headers.chipInfo.cookieExpiry.title': 'Caducidad de la Cookie',
  'panel.inspector.headers.chipInfo.cookieExpiry.expiredSummary':
    'La Cookie ya ha caducado. El navegador no la enviará.',
  'panel.inspector.headers.chipInfo.cookieExpiry.expiresSummary': 'La Cookie caduca en {duration} (el {date}).',
  'panel.inspector.headers.chipInfo.cookieExpiry.description':
    'Las cookies sin `Max-Age` ni `Expires` son cookies de sesión y desaparecen cuando el navegador se ' +
    'cierra. Define uno para hacer la cookie persistente.',
  'panel.inspector.headers.chipInfo.sessionCookie.title': 'Cookie de sesión',
  'panel.inspector.headers.chipInfo.sessionCookie.summary':
    'Sin `Max-Age` ni `Expires` — el navegador descarta esta cookie al cerrarse.',
  'panel.inspector.headers.chipInfo.sessionCookie.description':
    'Añade `Max-Age=<seconds>` o `Expires=<date>` para hacerla persistente entre sesiones del navegador.',
  'panel.inspector.headers.chipInfo.missingFlag.title': 'Falta {flag}',
  'panel.inspector.headers.chipInfo.missingFlag.kicker': 'Buena práctica',
  'panel.inspector.headers.chipInfo.missingFlag.secure':
    'Sin `Secure`, esta cookie puede filtrarse por HTTP plano. Defínelo siempre en cookies HTTPS.',
  'panel.inspector.headers.chipInfo.missingFlag.httpOnly':
    'Sin `HttpOnly`, JavaScript puede leer esta cookie vía `document.cookie` — un fallo XSS la exfiltra.',
  'panel.inspector.headers.chipInfo.missingFlag.sameSite':
    'Sin un `SameSite` explícito, los navegadores recurren a `Lax`. Sé explícito para que la política sea ' +
    'evidente en la revisión de código.',
  'panel.inspector.headers.chipInfo.missingFlag.description':
    'La mayoría de las cookies de producción deberían llevar `Secure`, `HttpOnly` y un `SameSite` explícito.',
  'panel.inspector.headers.chipInfo.cacheKicker': 'Directiva de caché',
  'panel.inspector.headers.chipInfo.rawValue': 'Valor sin procesar: `{value}`.',
  'panel.inspector.headers.chipInfo.activeDirectives': 'Directivas activas',
  'panel.inspector.headers.chipInfo.maxAge': 'Fresca durante {duration}.',
  'panel.inspector.headers.chipInfo.sMaxage': 'Frescura en caché compartida: {duration}.',
  'panel.inspector.headers.chipInfo.staleWhileRevalidate':
    'Permite reutilizar la copia obsoleta durante {duration} mientras corre una revalidación en segundo plano.',
  'panel.inspector.headers.chipInfo.contentTypeParamKicker': 'Parámetro de Content-Type',
  'panel.inspector.headers.chipInfo.charset.summary': 'Codificación de caracteres que usa el cuerpo.',
  'panel.inspector.headers.chipInfo.charset.description':
    'Para los tipos `text/*`, las pilas modernas usan `utf-8` de forma predeterminada. Los valores ' +
    'incorrectos producen mojibake.',
  'panel.inspector.headers.chipInfo.boundary.title': 'Frontera multipart',
  'panel.inspector.headers.chipInfo.boundary.summary':
    'Token que separa las partes de un cuerpo multipart (subidas de archivos, multipart/form-data).',
  'panel.inspector.headers.chipInfo.boundary.description':
    'Lo genera el cliente; no debe aparecer dentro del cuerpo de ninguna parte.',
  'panel.inspector.headers.chipInfo.hsts.kicker': 'Política de seguridad',
  'panel.inspector.headers.chipInfo.hsts.summary': 'El navegador usará HTTPS para este host durante {duration}.',
  'panel.inspector.headers.chipInfo.authSchemeKicker': 'Esquema de autorización',
  'panel.inspector.headers.chipInfo.jwt.summary':
    'JSON Web Token — un triple `<header>.<payload>.<signature>` codificado en base64.',
  'panel.inspector.headers.chipInfo.jwt.description':
    'La firma demuestra que el token lo emitió alguien que posee la clave de firma. El header (alg, typ) y el ' +
    'payload (claims) NO están cifrados — simplemente van codificados en base64 y cualquiera puede leerlos.',
  'panel.inspector.headers.chipInfo.jwtHeaderKicker': 'Header del JWT',
  'panel.inspector.headers.chipInfo.jwtClaimKicker': 'Claim del JWT',
  'panel.inspector.headers.chipInfo.jwtAlg.summary': 'Algoritmo de firma declarado en el header del JWT.',
  'panel.inspector.headers.chipInfo.jwtAlg.description':
    'Valores comunes: `HS256` (HMAC-SHA256, simétrico), `RS256` (RSA, asimétrico), `ES256` (ECDSA). `none` ' +
    '(sin firma) siempre debería ser rechazado por los validadores.',
  'panel.inspector.headers.chipInfo.jwtExpired.title': 'JWT caducado',
  'panel.inspector.headers.chipInfo.jwtExpired.summary':
    'Token caducado hace {duration}. El servidor debería rechazarlo.',
  'panel.inspector.headers.chipInfo.jwtExpires.title': 'El JWT caduca en {duration}',
  'panel.inspector.headers.chipInfo.jwtExpires.soonSummary':
    'El token está cerca de caducar — refréscalo o espera un 401 pronto.',
  'panel.inspector.headers.chipInfo.jwtExpires.summary': 'Tiempo hasta alcanzar el claim `exp` del JWT.',
  'panel.inspector.headers.chipInfo.scheme.bearer':
    'Credencial bearer opaca (OAuth 2.0 / token de API). Trátala como una contraseña — cualquiera que la ' +
    'tenga puede autenticarse como el usuario.',
  'panel.inspector.headers.chipInfo.scheme.basic':
    'Autenticación HTTP Basic — `base64(username:password)`. Segura solo por HTTPS.',
  'panel.inspector.headers.chipInfo.scheme.other':
    'Nombre del esquema de autenticación. El formato de la credencial depende del esquema.',

  // Header insights (t-fed `computeHeaderInsights`).
  'panel.inspector.headers.insights.corsWildcard.title': 'CORS mal configurado',
  'panel.inspector.headers.insights.corsWildcard.detail':
    '`Access-Control-Allow-Origin: *` no puede combinarse con credenciales — el navegador rechazará esta ' +
    'respuesta.',
  'panel.inspector.headers.insights.corsWildcard.action': 'Sustituir por {origin}',
  'panel.inspector.headers.insights.corsMissingAcao.title': 'Solicitud CORS sin Access-Control-Allow-Origin',
  'panel.inspector.headers.insights.corsMissingAcao.detail':
    'La solicitud llevaba `Origin: {origin}` pero la respuesta no tiene `Access-Control-Allow-Origin`. El ' +
    'navegador bloqueará la respuesta.',
  'panel.inspector.headers.insights.corsMissingAcao.action': 'Añadir Access-Control-Allow-Origin: {origin}',
  'panel.inspector.headers.insights.cookieMissingSecure.titleOne': 'Cookie `{name}` sin `Secure`',
  'panel.inspector.headers.insights.cookieMissingSecure.titleMany': '{count} cookies sin `Secure`',
  'panel.inspector.headers.insights.cookieMissingSecure.detail':
    'Las cookies definidas por HTTPS deberían llevar `Secure` para que no puedan enviarse por HTTP plano.',
  'panel.inspector.headers.insights.missingCsp.title': 'Sin Content-Security-Policy en una respuesta HTML',
  'panel.inspector.headers.insights.missingCsp.action': 'Añadir una CSP básica',
  'panel.inspector.headers.insights.hstsShort.title': 'El max-age de HSTS es muy corto ({summary})',
  'panel.inspector.headers.insights.hstsShort.detail':
    'La mayoría de las políticas recomiendan al menos 6 meses; el preload exige 1 año.',
  'panel.inspector.headers.insights.jwtExpired.title': 'El JWT del encabezado Authorization está caducado',
  'panel.inspector.headers.insights.jwtExpired.detail': 'Caducado hace {duration}.',
  'panel.inspector.headers.insights.jwtExpiring.title': 'El JWT caduca en {duration}',
  'panel.inspector.headers.insights.missingContentType.title': 'La respuesta no tiene Content-Type',
  'panel.inspector.headers.insights.missingContentType.action': 'Añadir Content-Type',
} as const satisfies Catalog;
