/**
 * Shared info-popover corpus — HTTP headers — Spanish. Mirrors
 * `catalogs/en/shared-info-headers.ts` key for key; wire vocabulary
 * (header names, directive keys, common values, backticked code) stays
 * raw — only prose translates. Mints: handshake rides raw (m.);
 * preflight rides raw (m.); MIME sniffing = rastreo de tipos MIME;
 * hotlink rides raw; edge/shield CDN tier names ride raw.
 */

import type { Catalog } from '../../types';

export const sharedInfoHeaders = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.header.kicker': '{direction} · {category}',
  'shared.info.header.direction.request': 'Encabezado de solicitud',
  'shared.info.header.direction.response': 'Encabezado de respuesta',
  'shared.info.header.direction.both': 'Encabezado de solicitud / respuesta',
  'shared.info.header.section.directives': 'Directivas',
  'shared.info.header.section.commonValues': 'Valores comunes',
  'shared.info.header.fallback.customCategory': 'Personalizado o no estándar',
  'shared.info.header.fallback.customSummary':
    'Este encabezado es personalizado o no estándar — sin documentación en nuestro registro.',
  'shared.info.header.fallback.unknownSummary':
    '{name} aún no está documentado en nuestro registro. La fila lo clasifica como {category}.',

  // ── auth ──────────────────────────────────────────────────────────────
  'shared.info.header.authorization.summary': 'Credenciales que autentican al cliente ante el servidor.',
  'shared.info.header.authorization.body1':
    'Formato: `<scheme> <credentials>`. Esquemas comunes: `Bearer <token>` (OAuth, JWT), ' +
    '`Basic <base64(user:pass)>`, `Digest`.',
  'shared.info.header.proxyAuthorization.summary': 'Credenciales para un proxy intermedio (no el servidor de origen).',
  'shared.info.header.proxyAuthorization.body1': 'Misma sintaxis que `Authorization`, ámbito distinto.',
  'shared.info.header.wwwAuthenticate.summary':
    'Desafío 401 del servidor — indica al cliente qué esquema de autenticación usar.',
  'shared.info.header.wwwAuthenticate.body1':
    'Se envía con `401 Unauthorized`. Abre el diálogo de autenticación básica del navegador cuando el esquema ' +
    'es `Basic`.',
  'shared.info.header.proxyAuthenticate.summary':
    'Equivalente para proxy de `WWW-Authenticate`, enviado con `407 Proxy Authentication Required`.',
  'shared.info.header.authenticationInfo.summary':
    'Completa la autenticación mutua en caso de éxito — la autenticación Digest lo usa para confirmar también ' +
    'al servidor.',

  // ── caching ───────────────────────────────────────────────────────────
  'shared.info.header.cacheControl.summary':
    'Directivas que gobiernan cómo se guarda en caché y se revalida una respuesta.',
  'shared.info.header.cacheControl.body1':
    'Tanto la solicitud como la respuesta llevan directivas. Los tokens múltiples separados por comas se ' +
    'combinan con Y. El comportamiento es por directiva — el encabezado no es un modo único.',
  'shared.info.header.cacheControl.directive.noStore': 'No guardar en caché en absoluto, en ningún sitio.',
  'shared.info.header.cacheControl.directive.noCache': 'Puede guardarse, pero revalidar cada vez antes de reutilizar.',
  'shared.info.header.cacheControl.directive.public': 'Cualquier caché puede almacenar, incluidas compartidas/CDN.',
  'shared.info.header.cacheControl.directive.private': 'Solo el navegador del usuario puede almacenar.',
  'shared.info.header.cacheControl.directive.maxAgeN': 'Fresco durante N segundos; reutilizar sin contactar al origen.',
  'shared.info.header.cacheControl.directive.sMaxageN': 'Como max-age pero solo para cachés compartidas.',
  'shared.info.header.cacheControl.directive.mustRevalidate': 'Una vez obsoleto, revalidar antes de servir.',
  'shared.info.header.cacheControl.directive.immutable': 'Promete que el cuerpo no cambiará durante max-age.',
  'shared.info.header.cacheControl.directive.staleWhileRevalidateN':
    'Permite reutilizar lo obsoleto mientras una revalidación corre en segundo plano.',
  'shared.info.header.pragma.summary':
    'Control de caché heredado de HTTP/1.0 — en la práctica reemplazado por Cache-Control.',
  'shared.info.header.pragma.body1':
    '`Pragma: no-cache` todavía lo envían algunos clientes por compatibilidad. Los servidores modernos ' +
    'deberían respetar `Cache-Control` e ignorar `Pragma`.',
  'shared.info.header.expires.summary': 'Fecha/hora absoluta a partir de la cual la respuesta se considera obsoleta.',
  'shared.info.header.expires.body1':
    'Reemplazado por `Cache-Control: max-age`. Si ambos están presentes, gana `max-age`. Usa una fecha pasada ' +
    '(o `0`) para forzar una recarga.',
  'shared.info.header.etag.summary':
    'Identificador opaco del cuerpo de la respuesta — sirve para revalidar las copias en caché.',
  'shared.info.header.etag.body1':
    'Los clientes lo devuelven en `If-None-Match`. Si el valor sigue coincidiendo, el servidor responde ' +
    '`304 Not Modified` sin cuerpo.',
  'shared.info.header.ifMatch.summary': 'Solicitud condicional: proceder solo si el ETag actual del recurso coincide.',
  'shared.info.header.ifMatch.body1':
    'Lo usan las escrituras para no sobrescribir cambios hechos por otra persona (concurrencia optimista).',
  'shared.info.header.ifNoneMatch.summary': 'Solicitud condicional: proceder solo si el ETag del recurso ha cambiado.',
  'shared.info.header.ifNoneMatch.body1':
    'Lo usan las lecturas para no descargar una respuesta sin cambios — el servidor responde ' + '`304 Not Modified`.',
  'shared.info.header.ifModifiedSince.summary':
    'Solicitud condicional: proceder solo si el recurso cambió después de la fecha dada.',
  'shared.info.header.ifModifiedSince.body1':
    'Menos preciso que `If-None-Match`/ETag; prefiere los ETags cuando estén disponibles.',
  'shared.info.header.ifUnmodifiedSince.summary':
    'Solicitud condicional: proceder solo si el recurso no se ha modificado desde la fecha dada.',
  'shared.info.header.lastModified.summary': 'Fecha/hora del último cambio del recurso.',
  'shared.info.header.lastModified.body1': 'Emparejado con `If-Modified-Since` para la revalidación.',
  'shared.info.header.age.summary': 'Segundos que la respuesta lleva en una caché compartida.',
  'shared.info.header.age.body1':
    'Lo devuelven los CDN y los proxys; ayuda a los clientes a evaluar la frescura de la respuesta.',
  'shared.info.header.xCache.summary':
    'Resultado de caché de CDN / proxy inverso — formato propio de cada proveedor (Varnish, Fastly, CloudFront).',
  'shared.info.header.xCache.value.hit': 'Servido desde la caché.',
  'shared.info.header.xCache.value.miss': 'No estaba en caché; recuperado del origen.',
  'shared.info.header.xCache.value.hitHit': 'Varios niveles de caché acertaron todos (p. ej. shield + edge).',
  'shared.info.header.xCacheHits.summary':
    'Contador de aciertos de caché por nivel — propio de cada proveedor, común en Fastly.',
  'shared.info.header.xCacheHits.body1':
    'Separado por comas cuando hay varios niveles de caché en juego. Cifras altas indican líneas de caché muy ' +
    'solicitadas.',
  'shared.info.header.warning.summary':
    'Contexto de caché adicional (obsoleto, transformación aplicada, etc.). Obsoleto en HTTP/1.1 desde la ' +
    'RFC 7234 pero aún se emite.',
  'shared.info.header.surrogateControl.summary':
    'Control de caché de Edge Side Includes — dirige a los CDN dejando la caché del navegador a `Cache-Control`.',
  'shared.info.header.surrogateControl.body1':
    'Específico de cachés compatibles con ESI (Fastly, Akamai, Varnish en algunas configuraciones).',
  'shared.info.header.surrogateCapability.summary':
    'Indicación Edge hacia el origen: qué funciones ESI admite el surrogate.',
  'shared.info.header.cfCacheStatus.summary': 'Resultado de la caché de Cloudflare para esta solicitud.',
  'shared.info.header.cfCacheStatus.value.hit': 'Servido desde la caché de Cloudflare.',
  'shared.info.header.cfCacheStatus.value.miss': 'No estaba en caché; recuperado del origen.',
  'shared.info.header.cfCacheStatus.value.expired': 'Estaba en caché pero caducó; refrescado desde el origen.',
  'shared.info.header.cfCacheStatus.value.bypass': 'Caché omitida (reglas de página / encabezado no-cache).',
  'shared.info.header.cfCacheStatus.value.dynamic': 'No cacheable por defecto (cookies, query string, etc.).',
  'shared.info.header.cfCacheStatus.value.revalidated': 'En caché y revalidado con el origen (304).',

  // ── client-hints ──────────────────────────────────────────────────────
  'shared.info.header.secChUa.summary': 'Client Hint: la lista de marcas del navegador.',
  'shared.info.header.secChUa.body1':
    'Sustituye al `User-Agent` libre en las partes de las que los servidores deberían depender realmente.',
  'shared.info.header.secChUaMobile.summary': 'Client Hint: `?1` en móvil, `?0` en escritorio.',
  'shared.info.header.secChUaPlatform.summary':
    'Client Hint: el SO del usuario (`"Windows"`, `"macOS"`, `"Linux"`, etc.).',
  'shared.info.header.userAgent.summary': 'Cadena libre heredada que identifica el navegador, el SO y el motor.',
  'shared.info.header.userAgent.body1':
    'Todavía se envía en cada solicitud. El sustituto estructurado es la familia `Sec-CH-UA-*` — prefiérela ' +
    'cuando a los servidores les importe la identidad del navegador.',
  'shared.info.header.acceptCh.summary':
    'Lista los encabezados Client Hint que el servidor quiere en las solicitudes siguientes.',
  'shared.info.header.acceptCh.body1':
    'Los navegadores solo envían las indicaciones que el servidor haya aceptado aquí (salvo las de baja ' +
    'entropía por defecto).',
  'shared.info.header.criticalCh.summary':
    'Subconjunto de `Accept-CH` que el servidor considera crítico — los navegadores relanzarán la solicitud ' +
    'para incluirlas.',
  'shared.info.header.criticalCh.body1':
    'Úsalo con moderación: cada falta de Critical-CH cuesta un viaje de ida y vuelta.',
  'shared.info.header.saveData.summary': '`on` cuando el usuario activó un modo de ahorro de datos en su navegador/SO.',
  'shared.info.header.saveData.body1':
    'Úsalo para servir recursos más ligeros (menor calidad de imagen, aplazar el trabajo bajo el pliegue, etc.).',
  'shared.info.header.deviceMemory.summary':
    'RAM aproximada del dispositivo en GiB, redondeada a un conjunto pequeño de valores (`0.25`, `0.5`, `1`, ' +
    '`2`, `4`, `8`).',
  'shared.info.header.downlink.summary': 'Ancho de banda de bajada estimado en Mbps, redondeado.',
  'shared.info.header.ect.summary': 'Effective Connection Type — `slow-2g`, `2g`, `3g` o `4g`.',
  'shared.info.header.rtt.summary': 'Tiempo de ida y vuelta estimado en milisegundos, redondeado.',

  // ── connection ────────────────────────────────────────────────────────
  'shared.info.header.connection.summary': 'Controles de conexión salto a salto (`keep-alive`, `close`, `upgrade`).',
  'shared.info.header.connection.body1':
    'Los proxys lo retiran entre saltos. En HTTP/2+ este encabezado está prohibido — la gestión de la conexión ' +
    'va integrada en el protocolo.',
  'shared.info.header.keepAlive.summary': 'Indicaciones del pool de conexiones — típicamente `timeout=N, max=N`.',
  'shared.info.header.keepAlive.body1':
    'Solo tiene sentido con `Connection: keep-alive` en HTTP/1.1. Ignorado en HTTP/2+.',
  'shared.info.header.upgrade.summary': 'Pide cambiar de protocolo en la misma conexión (WebSocket, HTTP/2 en claro).',
  'shared.info.header.upgrade.body1': 'Se usa junto con `Connection: upgrade`. WebSocket: `Upgrade: websocket`.',
  'shared.info.header.te.summary': 'Codificaciones de transferencia que el cliente aceptará (`trailers`, `gzip`, …).',
  'shared.info.header.te.body1':
    'La mayoría de los clientes modernos solo envían `TE: trailers` para aceptar encabezados finales.',
  'shared.info.header.expect.summary': 'Precondiciones del lado del servidor que el cliente espera (`100-continue`).',
  'shared.info.header.expect.body1':
    '`Expect: 100-continue` permite al cliente enviar el cuerpo solo después de que el servidor señale ' +
    '`100 Continue`.',
  'shared.info.header.altSvc.summary':
    'Anuncia formas alternativas de alcanzar el mismo origen (p. ej. HTTP/3 sobre QUIC).',
  'shared.info.header.altSvc.body1':
    'Los navegadores guardan el anuncio en caché y pueden cambiar a la alternativa en solicitudes posteriores.',
  'shared.info.header.secWebsocketKey.summary':
    'Nonce aleatorio codificado en base64 enviado en el handshake WebSocket.',
  'shared.info.header.secWebsocketKey.body1':
    'El servidor responde con `Sec-WebSocket-Accept` derivado de esta clave + un GUID fijo, demostrando que ' +
    'entiende WebSocket.',
  'shared.info.header.secWebsocketAccept.summary':
    'Prueba del servidor para el handshake WebSocket — `SHA-1(Sec-WebSocket-Key + GUID)` codificado en base64.',
  'shared.info.header.secWebsocketVersion.summary':
    'Versión del protocolo WebSocket que pide el cliente. Casi siempre `13` (RFC 6455).',
  'shared.info.header.secWebsocketProtocol.summary':
    'Negociación de subprotocolo para WebSocket — lista separada por comas en la solicitud, un único valor ' +
    'elegido en la respuesta.',
  'shared.info.header.secWebsocketExtensions.summary':
    'Extensiones WebSocket negociadas (compresión, etc.) — la más común, `permessage-deflate`.',

  // ── content ───────────────────────────────────────────────────────────
  'shared.info.header.contentType.summary': 'Tipo de medio del cuerpo de la solicitud o la respuesta.',
  'shared.info.header.contentType.body1':
    'Determina cómo analiza el navegador el cuerpo — valores incorrectos causan fallos silenciosos (JSON ' +
    'analizado como HTML, etc.).',
  'shared.info.header.contentType.body2':
    'Para los tipos `text/*`, incluye `charset=utf-8` salvo que tengas motivo para no hacerlo.',
  'shared.info.header.contentType.value.applicationJson': 'Cuerpo JSON.',
  'shared.info.header.contentType.value.applicationXWwwFormUrlencoded': 'Campos de formulario codificados como URL.',
  'shared.info.header.contentType.value.multipartFormData': 'Formulario multipart / subida de archivos.',
  'shared.info.header.contentType.value.textHtmlCharsetUtf8': 'Documento HTML.',
  'shared.info.header.contentType.value.applicationOctetStream': 'Binario opaco.',
  'shared.info.header.contentLength.summary': 'Tamaño del cuerpo en bytes (decodificado).',
  'shared.info.header.contentLength.body1':
    'Mutuamente excluyente con `Transfer-Encoding: chunked`. Valores incorrectos desincronizan la conexión.',
  'shared.info.header.contentEncoding.summary':
    'Compresión aplicada al cuerpo — el navegador la decodifica antes de exponerlo al JS.',
  'shared.info.header.contentEncoding.body1':
    'Comunes: `gzip`, `br` (Brotli), `zstd` (más reciente). El tamaño decodificado es lo que ve `response.body`.',
  'shared.info.header.contentDisposition.summary':
    'Indica al navegador si la respuesta se muestra en línea o se descarga.',
  'shared.info.header.contentDisposition.body1':
    '`inline` (por defecto) se muestra en el navegador. `attachment; filename="x"` desencadena una descarga ' +
    'con ese nombre de archivo por defecto.',
  'shared.info.header.accept.summary': 'Tipos de medio que el cliente está dispuesto a recibir.',
  'shared.info.header.accept.body1':
    'Los q-values expresan preferencia (`text/html;q=0.9`). Hoy la mayoría de los servidores ignoran todo ' +
    'salvo el primer tipo.',
  'shared.info.header.acceptEncoding.summary': 'Compresiones que el cliente sabe decodificar.',
  'shared.info.header.acceptEncoding.body1':
    'Valor típico del navegador: `gzip, deflate, br, zstd`. Los servidores eligen una y responden con ' +
    '`Content-Encoding`.',
  'shared.info.header.acceptLanguage.summary': 'Idiomas humanos que el cliente prefiere.',
  'shared.info.header.acceptLanguage.body1':
    'El servidor selecciona un `Content-Language` de esta lista, a menudo con un valor por defecto de respaldo.',
  'shared.info.header.transferEncoding.summary':
    'Codificación aplicada solo al transporte — se retira antes de que el cuerpo llegue a la aplicación.',
  'shared.info.header.transferEncoding.body1': 'Casi siempre `chunked`. Mutuamente excluyente con `Content-Length`.',
  'shared.info.header.range.summary': 'Pide un rango de bytes del recurso en lugar del cuerpo entero.',
  'shared.info.header.range.body1':
    'Formato: `bytes=<start>-<end>` (inclusivo). El servidor responde `206 Partial Content` con `Content-Range`.',
  'shared.info.header.contentRange.summary': 'Identifica qué rango de bytes del recurso está en el cuerpo.',
  'shared.info.header.contentRange.body1':
    'Formato: `bytes <start>-<end>/<total>`. Devuelto con `206 Partial Content`.',
  'shared.info.header.acceptRanges.summary':
    'Indica al cliente si las solicitudes por rango están admitidas (`bytes`) o no (`none`).',
  'shared.info.header.contentMd5.summary':
    'Resumen MD5 del cuerpo codificado en Base64, para comprobar la integridad. Obsoleto en HTTP/1.1 ' +
    '(RFC 7231) pero algunos servidores aún lo emiten.',
  'shared.info.header.contentMd5.body1':
    'La integridad moderna se hace vía `Digest` / `Want-Digest` o mediante el propio TLS.',
  'shared.info.header.contentLanguage.summary': 'Idioma(s) natural(es) del cuerpo de la respuesta.',
  'shared.info.header.contentLanguage.body1':
    'Se negocia frente al `Accept-Language` de la solicitud. Los valores son etiquetas BCP-47 (`en-US`, ' +
    '`de-DE`, etc.).',
  'shared.info.header.contentLocation.summary':
    'URL alternativa que identifica de forma única la entidad de esta respuesta.',
  'shared.info.header.contentLocation.body1':
    'Distinto de `Location`: `Content-Location` describe el recurso obtenido, no adónde redirigir.',
  'shared.info.header.acceptCharset.summary':
    'Codificaciones de caracteres que el cliente acepta. Obsoleto — los navegadores modernos siempre envían ' +
    'UTF-8 y no lo emiten.',
  'shared.info.header.acceptCharset.body1': 'La mayoría de los servidores pueden ignorarlo sin riesgo.',
  'shared.info.header.ifRange.summary':
    'Solicitud de rango condicional: servir el rango solo si el recurso aún coincide con el ETag o la fecha ' +
    'dados.',
  'shared.info.header.ifRange.body1':
    'Si el recurso cambió, el servidor devuelve el cuerpo completo con `200 OK` en lugar de ' +
    '`206 Partial Content`.',
  'shared.info.header.trailer.summary':
    'Declara qué nombres de encabezado aparecerán en el trailer tras un cuerpo chunked.',
  'shared.info.header.trailer.body1':
    'Solo tiene sentido con `Transfer-Encoding: chunked`. El cliente debe aceptarlo vía `TE: trailers`.',

  // ── cookies ───────────────────────────────────────────────────────────
  'shared.info.header.cookie.summary': 'Cookies que el navegador envía con esta solicitud, separadas por punto y coma.',
  'shared.info.header.cookie.body1':
    'Lo define el navegador desde su tarro de cookies. El JS no puede definirlo directamente en `fetch` — usa ' +
    "`credentials: 'include'`.",
  'shared.info.header.setCookie.summary': 'Definición de cookie emitida por el servidor.',
  'shared.info.header.setCookie.body1':
    'Una cookie por línea `Set-Cookie`. Los navegadores guardan el último valor por tupla (nombre, dominio, ' +
    'ruta).',
  'shared.info.header.setCookie.body2':
    'Las cookies de producción deberían llevar siempre `Secure`, `HttpOnly` y un `SameSite` explícito ' +
    '(Lax o Strict).',
  'shared.info.header.setCookie.directive.secure': 'Solo se envía por HTTPS.',
  'shared.info.header.setCookie.directive.httpOnly': 'Oculta para JavaScript (document.cookie).',
  'shared.info.header.setCookie.directive.sameSiteStrictLaxNone':
    'Política de envío entre sitios. `None` exige `Secure`.',
  'shared.info.header.setCookie.directive.domainHost': 'Enviar a este host y a todos sus subdominios.',
  'shared.info.header.setCookie.directive.pathPath': 'Enviar solo a las URL que empiecen por esta ruta.',
  'shared.info.header.setCookie.directive.maxAgeN': 'TTL en segundos (prevalece sobre Expires).',
  'shared.info.header.setCookie.directive.expiresDate': 'Caducidad absoluta; omitida = cookie de sesión.',
  'shared.info.header.setCookie.directive.partitioned': 'CHIPS — particionada por sitio de nivel superior.',

  // ── cors ──────────────────────────────────────────────────────────────
  'shared.info.header.accessControlAllowOrigin.summary': 'Indica al navegador qué orígenes pueden leer esta respuesta.',
  'shared.info.header.accessControlAllowOrigin.body1':
    'Lo define el servidor en la respuesta. El navegador lo compara con el encabezado `Origin` de la solicitud ' +
    'e impide que JavaScript lea el cuerpo si no coinciden.',
  'shared.info.header.accessControlAllowOrigin.body2':
    '`*` acepta cualquier origen pero es incompatible con credenciales — si la solicitud lleva cookies o ' +
    'autenticación, la respuesta debe devolver el origen solicitante exacto en su lugar.',
  'shared.info.header.accessControlAllowOrigin.value.wildcard': 'Cualquier origen puede leer (sin credenciales).',
  'shared.info.header.accessControlAllowOrigin.value.httpsAppOpenheadersIo': 'Solo el origen nombrado puede leer.',
  'shared.info.header.accessControlAllowCredentials.summary':
    'Permite al navegador exponer la respuesta cuando la solicitud llevaba credenciales.',
  'shared.info.header.accessControlAllowCredentials.body1':
    'Debe ser `true` (en minúsculas). En ese caso, `Access-Control-Allow-Origin` NO debe ser `*` — tiene que ' +
    'devolver el origen exacto.',
  'shared.info.header.accessControlAllowMethods.summary':
    'Lista los métodos HTTP que el servidor acepta en solicitudes cross-origin.',
  'shared.info.header.accessControlAllowMethods.body1':
    'Devuelto en las respuestas de preflight (`OPTIONS`). El navegador guarda la respuesta en caché durante ' +
    '`Access-Control-Max-Age` segundos.',
  'shared.info.header.accessControlAllowHeaders.summary':
    'Lista los encabezados de solicitud que el servidor acepta en solicitudes cross-origin.',
  'shared.info.header.accessControlAllowHeaders.body1':
    'Necesario cuando el navegador hace preflight de encabezados no simples (cualquiera más allá de `Accept`, ' +
    '`Accept-Language`, `Content-Language` y los valores `Content-Type` simples).',
  'shared.info.header.accessControlExposeHeaders.summary':
    'Lista los encabezados de respuesta que JavaScript puede leer.',
  'shared.info.header.accessControlExposeHeaders.body1':
    'Por defecto el JS solo ve los encabezados de respuesta de la lista segura CORS (`Cache-Control`, ' +
    '`Content-Language`, `Content-Type`, `Expires`, `Last-Modified`, `Pragma`). Cualquier otro encabezado hay ' +
    'que nombrarlo aquí para que `response.headers.get(...)` lo devuelva.',
  'shared.info.header.accessControlMaxAge.summary':
    'Cuánto tiempo puede el navegador guardar en caché la respuesta de preflight, en segundos.',
  'shared.info.header.accessControlMaxAge.body1':
    'Valores grandes reducen el tráfico de preflight — 86400 (1 día) es común. Chrome limita a 7200 segundos; ' +
    'Firefox a 86400.',
  'shared.info.header.accessControlRequestMethod.summary':
    'Enviado en el preflight para declarar el método que usará la solicitud real.',
  'shared.info.header.accessControlRequestMethod.body1':
    'El servidor responde con `Access-Control-Allow-Methods` para confirmar.',
  'shared.info.header.accessControlRequestHeaders.summary':
    'Enviado en el preflight para declarar los encabezados que llevará la solicitud real.',
  'shared.info.header.accessControlRequestHeaders.body1':
    'Reflejado de vuelta vía `Access-Control-Allow-Headers` si se acepta.',
  'shared.info.header.origin.summary': 'Identifica el origen que inició una solicitud cross-origin o POST.',
  'shared.info.header.origin.body1':
    'Lo envía automáticamente el navegador. El JS no puede definirlo. Los servidores lo usan para decidir las ' +
    'respuestas CORS y las defensas CSRF también.',
  'shared.info.header.vary.summary':
    'Indica a las cachés qué encabezados de solicitud afectan a la respuesta, para variar la clave de caché.',
  'shared.info.header.vary.body1':
    'Crítico para CORS: incluye `Vary: Origin` siempre que `Access-Control-Allow-Origin` se calcule a partir ' +
    'del origen de la solicitud; si no, una caché servirá la respuesta de un origen a otro.',
  'shared.info.header.timingAllowOrigin.summary':
    'Permite a orígenes ajenos leer las métricas de tiempo detalladas (`PerformanceResourceTiming`) de este ' +
    'recurso.',
  'shared.info.header.timingAllowOrigin.body1':
    'Sin este encabezado, los recursos cross-origin solo exponen tiempos de grano grueso.',

  // ── fetch-metadata ────────────────────────────────────────────────────
  'shared.info.header.secFetchSite.summary':
    'Definido por el navegador: relación entre el iniciador de la solicitud y el destino.',
  'shared.info.header.secFetchSite.body1':
    'Valores: `same-origin`, `same-site`, `cross-site`, `none` (navegación directa).',
  'shared.info.header.secFetchMode.summary': 'Definido por el navegador: el modo fetch de la solicitud.',
  'shared.info.header.secFetchMode.body1': 'Valores: `cors`, `no-cors`, `same-origin`, `navigate`, `websocket`.',
  'shared.info.header.secFetchDest.summary':
    'Definido por el navegador: dónde se usará la respuesta (document, script, image, etc.).',
  'shared.info.header.secFetchDest.body1':
    'Permite al servidor detectar cargas sorprendentes — p. ej. una respuesta HTML solicitada como ' +
    '`Sec-Fetch-Dest: script`.',
  'shared.info.header.secFetchUser.summary':
    'Definido por el navegador: `?1` cuando la navegación fue una activación directa del usuario.',
  'shared.info.header.secFetchUser.body1':
    'Ausente en el resto de casos. Útil para distinguir los clics del usuario de la navegación programática.',
  'shared.info.header.secPurpose.summary':
    'Definido por el navegador cuando la solicitud es especulativa — p. ej. `prefetch`, `prerender`.',
  'shared.info.header.secPurpose.body1':
    'Permite al servidor evitar efectos secundarios (analítica, registros de escritura) en cargas que el ' +
    'usuario aún no ha pedido realmente.',

  // ── performance ───────────────────────────────────────────────────────
  'shared.info.header.priority.summary':
    'Indica al servidor (o al cliente) cuán urgente e incremental es esta transferencia.',
  'shared.info.header.priority.body1':
    'Formato: `u=<0-7>` (urgencia, más bajo = mayor prioridad) y `, i` opcional (incremental — puede ' +
    'procesarse según llega).',
  'shared.info.header.upgradeInsecureRequests.summary':
    '`1` definido por el navegador — indica al servidor que el cliente prefiere HTTPS para los recursos ' +
    'incrustados.',
  'shared.info.header.upgradeInsecureRequests.body1':
    'Se empareja con la directiva CSP `upgrade-insecure-requests` en las respuestas.',
  'shared.info.header.earlyData.summary': '`1` — lo definen los clientes que envían datos en modo 0-RTT de TLS 1.3.',
  'shared.info.header.earlyData.body1':
    'Los servidores deberían rechazar los datos tempranos en métodos no idempotentes (POST, etc.) para evitar ' +
    'ataques de repetición.',
  'shared.info.header.link.summary': 'Indicaciones de recursos — preload / prefetch / preconnect / dns-prefetch.',
  'shared.info.header.link.body1':
    'Misma semántica que `<link rel="...">` en HTML; útil desde respuestas no HTML (API, redirecciones).',
  'shared.info.header.link.value.styleCssRelPreloadAsStyle': 'Precargar una hoja de estilos.',
  'shared.info.header.link.value.httpsCdnExampleComRelPreconnect': 'Abrir una conexión por adelantado.',
  'shared.info.header.xDnsPrefetchControl.summary':
    'Activa o desactiva la precarga DNS del navegador para los enlaces de la página (`on` / `off`).',

  // ── privacy ───────────────────────────────────────────────────────────
  'shared.info.header.dnt.summary': 'Do Not Track — `1` si el usuario rechazó el rastreo. Mayormente en desuso.',
  'shared.info.header.dnt.body1':
    'La mayoría de los grandes sitios lo ignoran; el W3C abandonó la especificación en 2019. Cumplirlo es ' +
    'voluntario.',
  'shared.info.header.secGpc.summary':
    'Global Privacy Control — `1` señala que el usuario no quiere que sus datos se vendan ni se compartan.',
  'shared.info.header.secGpc.body1':
    'Jurídicamente vinculante bajo la CCPA en California; lo respetan algunos navegadores centrados en la ' +
    'privacidad (Brave, Firefox, DuckDuckGo).',

  // ── proxy ─────────────────────────────────────────────────────────────
  'shared.info.header.via.summary': 'Lista los proxys / pasarelas por los que pasó el mensaje.',
  'shared.info.header.via.body1': 'Cada proxy añade su identificador para poder reconstruir la cadena al depurar.',
  'shared.info.header.xForwardedFor.summary':
    'No estándar pero omnipresente: cadena de IPs de cliente separadas por comas a través de los proxys.',
  'shared.info.header.xForwardedFor.body1':
    'La entrada más a la izquierda es el cliente original. El encabezado `Forwarded` de la RFC 7239 es la ' +
    'alternativa estandarizada.',
  'shared.info.header.xForwardedProto.summary':
    'Esquema original (`http` o `https`) que usó el cliente para llegar al primer proxy.',
  'shared.info.header.xForwardedHost.summary':
    'Encabezado `Host` original que envió el cliente antes de que el proxy lo reescribiera.',
  'shared.info.header.xRealIp.summary':
    'IP original del cliente vista por el primer proxy. Valor único, no una cadena.',
  'shared.info.header.forwarded.summary':
    'Cadena de proxys estandarizada por la RFC 7239 — sustituye a la familia `X-Forwarded-*`.',
  'shared.info.header.forwarded.body1':
    'Formato: `for=client; proto=https; by=proxy; host=original-host`. Varios proxys separados por comas.',
  'shared.info.header.trueClientIp.summary':
    'IP original del cliente reenviada por Akamai / Cloudflare Enterprise — valor único, no una cadena.',

  // ── routing ───────────────────────────────────────────────────────────
  'shared.info.header.authority.summary':
    'Pseudoencabezado HTTP/2+ — equivalente a `Host` en HTTP/1.1. Identifica el servidor de destino.',
  'shared.info.header.authority.body1':
    'Los pseudoencabezados empiezan por `:` y deben ir antes que los encabezados normales. Los define el ' +
    'navegador; JavaScript no puede.',
  'shared.info.header.method.summary': 'Pseudoencabezado HTTP/2+ — el método de la solicitud (`GET`, `POST`, …).',
  'shared.info.header.path.summary': 'Pseudoencabezado HTTP/2+ — la ruta de la solicitud + el query string.',
  'shared.info.header.scheme.summary': 'Pseudoencabezado HTTP/2+ — `https` o `http`.',
  'shared.info.header.status.summary': 'Pseudoencabezado HTTP/2+ — el estado numérico de la respuesta (p. ej. `200`).',
  'shared.info.header.status.body1':
    'Los pseudoencabezados sustituyen a la línea de estado de HTTP/1.1 en HTTP/2 y HTTP/3.',
  'shared.info.header.host.summary':
    'Host de destino de HTTP/1.1 (y puerto opcional). Sustituido por `:authority` en HTTP/2+.',
  'shared.info.header.host.body1':
    'Obligatorio en toda solicitud HTTP/1.1. Los servidores lo usan para enrutar entre hosts virtuales de una ' +
    'misma IP.',
  'shared.info.header.location.summary':
    'Destino de la redirección — enviado con las respuestas `3xx` o como resultado de un recurso creado.',
  'shared.info.header.location.body1':
    'Las URL absolutas se respetan universalmente; las relativas se resuelven contra la URL de la solicitud.',
  'shared.info.header.allow.summary': 'Lista los métodos HTTP que el recurso acepta.',
  'shared.info.header.allow.body1':
    'Obligatorio en una respuesta `405 Method Not Allowed`. Valores comunes: `GET, HEAD, POST, OPTIONS`.',
  'shared.info.header.referer.summary': 'URL de la página que inició esta solicitud.',
  'shared.info.header.referer.body1':
    'Nota la errata histórica — la especificación la conserva. Algunos destinos retiran o recortan `Referer` ' +
    'según la `Referrer-Policy` de la página.',
  'shared.info.header.retryAfter.summary':
    'Indica al cliente cuándo reintentar — segundos (delta) o fecha HTTP absoluta.',
  'shared.info.header.retryAfter.body1':
    'Común en `503 Service Unavailable` y `429 Too Many Requests`. Los rastreadores lo respetan.',
  'shared.info.header.maxForwards.summary':
    'Limita el número de proxys que pueden reenviar una solicitud `TRACE` u `OPTIONS`.',
  'shared.info.header.maxForwards.body1':
    'Cada proxy que reenvía lo decrementa. Llega a 0 → el proxy responde por sí mismo.',
  'shared.info.header.serviceWorker.summary':
    '`script`, definido por el navegador cuando la solicitud recupera un archivo de script de service worker.',
  'shared.info.header.serviceWorker.body1':
    'Permite a los servidores detectar las cargas de registro de SW y responder con el encabezado ' +
    '`Service-Worker-Allowed` adecuado.',
  'shared.info.header.serviceWorkerAllowed.summary':
    'Anula la restricción de ruta por defecto del alcance del service worker.',
  'shared.info.header.serviceWorkerAllowed.body1':
    'Por defecto, un worker solo puede controlar su directorio y los inferiores. Este encabezado permite ' +
    'ampliarlo — p. ej. controlar `/` desde un worker en `/sw.js`.',
  'shared.info.header.protocol.summary':
    'Pseudoencabezado del mecanismo Extended CONNECT (RFC 8441) — usado por WebSocket sobre HTTP/2 / 3.',
  'shared.info.header.protocol.body1':
    'Se define a `websocket` cuando el cliente canaliza un WebSocket por HTTP/2 o HTTP/3.',

  // ── security ──────────────────────────────────────────────────────────
  'shared.info.header.contentSecurityPolicy.summary':
    'Lista de fuentes permitidas desde las que la página puede cargar recursos o ejecutar código.',
  'shared.info.header.contentSecurityPolicy.body1':
    'Las directivas van separadas por espacios, con punto y coma entre directivas. La mayoría de las ' +
    'aplicaciones necesitan como mínimo `default-src`, `script-src`, `style-src` y `connect-src`.',
  'shared.info.header.contentSecurityPolicy.body2':
    'Usa `Content-Security-Policy-Report-Only` para observar las violaciones antes de imponer la política.',
  'shared.info.header.contentSecurityPolicy.directive.defaultSrc':
    'Respaldo para cualquier -src no definido explícitamente.',
  'shared.info.header.contentSecurityPolicy.directive.scriptSrc':
    'Fuentes permitidas para `<script>` y el JS en línea.',
  'shared.info.header.contentSecurityPolicy.directive.styleSrc':
    'Fuentes permitidas para hojas de estilos y CSS en línea.',
  'shared.info.header.contentSecurityPolicy.directive.imgSrc': 'Fuentes de imágenes permitidas.',
  'shared.info.header.contentSecurityPolicy.directive.connectSrc': 'Destinos fetch/XHR/WebSocket permitidos.',
  'shared.info.header.contentSecurityPolicy.directive.frameAncestors':
    'Quién puede incrustar esta página en un iframe (sustituye a X-Frame-Options).',
  'shared.info.header.contentSecurityPolicy.directive.reportUriReportTo':
    'Adónde enviar (POST) los informes de violación.',
  'shared.info.header.contentSecurityPolicyReportOnly.summary':
    'Misma sintaxis que la CSP, pero las violaciones se informan sin bloquearse.',
  'shared.info.header.contentSecurityPolicyReportOnly.body1':
    'Úsalo para probar una política en producción antes de imponerla.',
  'shared.info.header.strictTransportSecurity.summary':
    'Obliga al navegador a usar HTTPS para este host durante un tiempo dado.',
  'shared.info.header.strictTransportSecurity.body1':
    'Pon `max-age` en al menos 6 meses en producción. Añade `includeSubDomains` para cubrir todos los hosts ' +
    'del dominio.',
  'shared.info.header.strictTransportSecurity.body2':
    '`preload` permite enviar el dominio a la lista de precarga HSTS integrada en los navegadores (decisión ' +
    'de sentido único — difícil de revertir).',
  'shared.info.header.strictTransportSecurity.directive.maxAgeN': 'Cuánto tiempo recuerda el navegador «solo HTTPS».',
  'shared.info.header.strictTransportSecurity.directive.includeSubDomains': 'Aplicar a todos los subdominios.',
  'shared.info.header.strictTransportSecurity.directive.preload':
    'Elegibilidad para la lista de precarga de los navegadores.',
  'shared.info.header.xContentTypeOptions.summary': 'Desactiva el rastreo de tipos MIME.',
  'shared.info.header.xContentTypeOptions.body1':
    'Un solo valor válido: `nosniff`. Recomendado en toda respuesta — impide que se ejecute JS servido como ' +
    '`text/plain`.',
  'shared.info.header.xFrameOptions.summary': 'Controla si la página puede incrustarse en un iframe.',
  'shared.info.header.xFrameOptions.body1':
    'Mayormente sustituido por `Content-Security-Policy: frame-ancestors`. Mantén ambos durante la transición ' +
    'para cubrir navegadores antiguos.',
  'shared.info.header.xFrameOptions.value.deny': 'Nunca incrustable.',
  'shared.info.header.xFrameOptions.value.sameorigin': 'Incrustable solo por páginas del mismo origen.',
  'shared.info.header.xXssProtection.summary':
    'Interruptor del filtro XSS heredado — obsoleto en los navegadores modernos.',
  'shared.info.header.xXssProtection.body1':
    'El valor recomendado es `0` para desactivar el filtro (causaba más daño del que evitaba). Usa la CSP en ' +
    'su lugar.',
  'shared.info.header.referrerPolicy.summary':
    'Controla cuánta parte de la URL se envía en `Referer` en las navegaciones y solicitudes salientes.',
  'shared.info.header.referrerPolicy.body1':
    'Enviado como encabezado de respuesta por el destino, o definido por página vía `<meta>` / por solicitud ' +
    'vía el atributo `referrerpolicy`.',
  'shared.info.header.referrerPolicy.value.noReferrer': 'No enviar nunca un referer.',
  'shared.info.header.referrerPolicy.value.origin': 'Enviar solo el esquema + el host.',
  'shared.info.header.referrerPolicy.value.strictOriginWhenCrossOrigin':
    'Por defecto — URL completa en el mismo origen, solo el origen en cross-origin, nada en una degradación ' +
    'HTTPS→HTTP.',
  'shared.info.header.referrerPolicy.value.unsafeUrl': 'Enviar siempre la URL completa. Evítalo.',
  'shared.info.header.permissionsPolicy.summary':
    'Lista de permisos de funciones del navegador (geolocalización, cámara, USB, pagos, etc.).',
  'shared.info.header.permissionsPolicy.body1':
    'Cada función se limita a `self`, una lista de orígenes o `*`. Sustituye al antiguo encabezado ' +
    '`Feature-Policy`.',
  'shared.info.header.crossOriginOpenerPolicy.summary':
    'Aísla la página de las relaciones de apertura cross-origin (window.opener).',
  'shared.info.header.crossOriginOpenerPolicy.body1':
    '`same-origin` activa el modo crossOriginIsolated — necesario para SharedArrayBuffer y los temporizadores ' +
    'de alta resolución.',
  'shared.info.header.crossOriginEmbedderPolicy.summary':
    'Exige que cada subrecurso cargado conceda permiso cross-origin.',
  'shared.info.header.crossOriginEmbedderPolicy.body1':
    'Ponlo en `require-corp` para crossOriginIsolated. Se combina con ' + '`Cross-Origin-Opener-Policy: same-origin`.',
  'shared.info.header.crossOriginResourcePolicy.summary': 'Impide que orígenes ajenos carguen el recurso.',
  'shared.info.header.crossOriginResourcePolicy.body1':
    'Valores: `same-site`, `same-origin`, `cross-origin`. Crítico para recursos que no quieres que se enlacen ' +
    'por hotlink.',
  'shared.info.header.clearSiteData.summary':
    'Pide al navegador borrar cookies / caché / almacenamiento de este origen.',
  'shared.info.header.clearSiteData.body1': 'Útil en los flujos de cierre de sesión.',
  'shared.info.header.clearSiteData.value.cookies': 'Borrar las cookies del origen.',
  'shared.info.header.clearSiteData.value.cache': 'Borrar las cachés HTTP y de imágenes.',
  'shared.info.header.clearSiteData.value.storage':
    'Borrar localStorage / IndexedDB / los registros de Service Worker.',
  'shared.info.header.clearSiteData.value.wildcard': 'Borrarlo todo.',
  'shared.info.header.originAgentCluster.summary':
    '`?1` pide al navegador dar a este origen su propio agent cluster (proceso).',
  'shared.info.header.originAgentCluster.body1':
    'Ofrece mejor aislamiento para `SharedArrayBuffer`, performance.measureUserAgentSpecificMemory, etc.',
  'shared.info.header.xRobotsTag.summary': 'Directivas de indexación para los rastreadores (`noindex`, `nofollow`, …).',
  'shared.info.header.xRobotsTag.body1':
    'Misma semántica que la etiqueta `<meta name="robots">`, pero se aplica a respuestas no HTML (PDF, JSON, ' +
    'imágenes).',
  'shared.info.header.xUaCompatible.summary':
    'Directiva heredada de IE/Edge (`IE=edge`) — elige el motor de renderizado. Obsoleta en los navegadores ' +
    'modernos.',

  // ── server-id ─────────────────────────────────────────────────────────
  'shared.info.header.server.summary':
    'Identificación del software del servidor de origen (p. ej. `nginx/1.27`, `cloudflare`).',
  'shared.info.header.server.body1':
    'A menudo se retira o se fija a un valor constante en producción por seguridad operacional.',
  'shared.info.header.xPoweredBy.summary':
    'Encabezado no estándar que identifica el framework / runtime detrás de la respuesta.',
  'shared.info.header.xPoweredBy.body1':
    'Lo emiten habitualmente Express, PHP, ASP.NET, etc. A menudo se suprime en producción.',
  'shared.info.header.date.summary': 'Marca de tiempo del servidor de origen al generar el mensaje.',
  'shared.info.header.date.body1':
    'Las cachés lo usan para calcular la edad de la respuesta. Formato: IMF-fixdate ' +
    '(`Mon, 18 May 2026 15:05:25 GMT`).',
  'shared.info.header.xServedBy.summary': 'Identifica qué nodo edge / de caché del CDN sirvió la respuesta.',
  'shared.info.header.xServedBy.body1':
    'Separado por comas cuando varios niveles atendieron la solicitud (shield → edge). El formato varía según ' +
    'el proveedor (POP de Fastly, edges de AWS CloudFront, etc.).',

  // ── tracing ───────────────────────────────────────────────────────────
  'shared.info.header.serverTiming.summary': 'Métricas de rendimiento que el servidor adjunta a la respuesta.',
  'shared.info.header.serverTiming.body1':
    'Aparece en DevTools y en la API JS `PerformanceServerTiming`. Formato: `<name>;dur=<ms>[;desc="..."]`, ' +
    'separado por comas.',
  'shared.info.header.traceparent.summary': 'Trace-context del W3C: identifica un span en una traza distribuida.',
  'shared.info.header.traceparent.body1':
    'Formato: `<version>-<trace-id>-<parent-id>-<flags>`. Viaja entre servicios para poder reensamblar las ' +
    'trazas.',
  'shared.info.header.tracestate.summary': 'Compañero de trace-context propio de cada proveedor para `traceparent`.',
  'shared.info.header.tracestate.body1':
    'Pares `vendor=value` separados por comas. Cada proveedor de trazado guarda ahí su propio estado.',
  'shared.info.header.xRequestId.summary':
    'Identificador asignado por el servidor a esta solicitud — repetido en los registros y entre servicios.',
  'shared.info.header.xRequestId.body1':
    'No estándar pero omnipresente. Útil para correlacionar el comportamiento del cliente con los registros ' +
    'del servidor al depurar.',
  'shared.info.header.xFastlyRequestId.summary':
    'Identificador de solicitud de Fastly — correlaciónalo con los registros / la depuración de Fastly.',
  'shared.info.header.reportingEndpoints.summary':
    'Nombra los destinos de los informes generados por el navegador (violaciones CSP, obsolescencias, NEL, …).',
  'shared.info.header.reportingEndpoints.body1':
    'Formato: `name="https://reports.example.com", name2="https://..."`. Sustituye al antiguo encabezado ' +
    '`Report-To`.',
  'shared.info.header.reportTo.summary':
    'Antigua declaración de destinos de informes en JSON — reemplazada por `Reporting-Endpoints`.',
  'shared.info.header.nel.summary':
    'Política de Network Error Logging — configuración JSON que nombra un destino para recibir fallos de ' +
    'conexión y errores de protocolo.',
  'shared.info.header.nel.body1':
    'El destino debe estar ya registrado vía `Reporting-Endpoints` (o el antiguo `Report-To`).',
  'shared.info.header.cfRay.summary':
    'Identificador de solicitud de Cloudflare — sirve para correlacionar la solicitud en los registros de ' +
    'Cloudflare.',
  'shared.info.header.cfRay.body1':
    'Formato: `<request-id>-<colo-id>`, donde colo-id identifica el centro de datos de Cloudflare que sirvió ' +
    'la solicitud.',
} as const satisfies Catalog;
