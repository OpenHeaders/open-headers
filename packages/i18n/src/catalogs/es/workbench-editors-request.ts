/**
 * Workbench editors — the API request editor — Spanish. Mirrors
 * `catalogs/en/workbench-editors-request.ts` key for key; extends the
 * es register contract (`es/shared.ts`). Raw by design: HTTP methods,
 * header names, MIME types, auth scheme names (Basic Auth / Bearer
 * Token / API Key / OAuth 2.0 / AWS Signature v4 / Digest Auth /
 * OAuth 1.0), OAuth/PKCE spec params (client_id, Code Verifier,
 * State, refresh_token, oauth_*), body-mode enums, `Docs` / `Params`
 * tab names (`Configuración` = Settings, S58 law), wire tokens
 * (Timing-Allow-Origin, resource-timing, Referer, Host, User-Agent,
 * SSE `ID`/`Retry` fields), and the phase ladder's DNS/TCP/TLS/TTFB
 * tokens; assertion verdicts translate caps-for-caps (`SUPERADA` /
 * `FALLIDA`, fr precedent). Reuses the es mints:
 * `Enviar`, `Detener` + `Guardar la respuesta` + `Se guardó el
 * ejemplo «{name}»` + `Sin límite` + `Los más recientes primero`
 * (editors-grpc), `Nombre de usuario` / `Contraseña` (editors-rule),
 * `Heredar` family, `preajuste`, `Embellecer`, `token` raw (m.),
 * `back-end` (m.) / `workflow` / `handshake` (m.) / `runtime` loans,
 * `Cronología`, `caché` (f.), `ámbito` (auth scope). MINTS: cookie
 * jar = `tarro de cookies` (m., bare jar = `el tarro`); script modes
 * = `Modo seguro` / `Modo desarrollador`. Browser cert-interstitial
 * paths quote the browsers' own es UI (both localize es): Chrome
 * `Configuración avanzada → Acceder (sitio no seguro)`, Firefox
 * `Avanzado… → Aceptar el riesgo y continuar`.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsRequest = {
  // ── Request editor shell ───────────────────────────────────────────
  'workbench.editors.request.notFound': 'Solicitud no encontrada.',
  'workbench.editors.request.loading': 'Cargando la solicitud…',
  'workbench.editors.request.toast.deletedOtherTab': 'La solicitud se eliminó desde otra pestaña',
  'workbench.editors.request.toast.updateFailed': 'No se pudo actualizar la solicitud',
  'workbench.editors.request.toast.updateFailedDetail': 'No se pudo actualizar la solicitud: {message}',
  'workbench.editors.request.toast.savedExample': 'Se guardó el ejemplo «{name}»',
  'workbench.editors.request.toast.saveExampleFailed': 'No se pudo guardar el ejemplo',
  'workbench.editors.request.toast.saveExampleFailedDetail': 'No se pudo guardar el ejemplo: {message}',
  'workbench.editors.request.send.label': 'Enviar',
  'workbench.editors.request.send.sending': 'Enviando…',
  'workbench.editors.request.send.unresolvedTooltip':
    'La solicitud tiene variables sin resolver. Defínelas en el vault, el entorno, la colección, el espacio ' +
    'de trabajo o un workflow live antes de enviar.',
  'workbench.editors.request.send.remoteDispatchHint': 'Se ejecuta en {host} — el back-end conectado',
  'workbench.editors.request.send.stop': 'Detener',
  'workbench.editors.request.send.stopTooltip': 'Detener la solicitud y conservar lo que haya llegado',
  'workbench.editors.request.menu.copyAsCurl': 'Copiar como cURL',
  'workbench.editors.request.menu.copyAsFetch': 'Copiar como fetch',
  'workbench.editors.request.schemeHint':
    'Tu URL no tiene esquema. Se enviará como https:// — haz clic en la barra de URL y pulsa Tab o Intro ' +
    'para fijarlo.',

  // ── Request editor tab registry ────────────────────────────────────
  'workbench.editors.request.tab.docs': 'Docs',
  'workbench.editors.request.tab.params': 'Params',
  'workbench.editors.request.tab.authorization': 'Autorización',
  'workbench.editors.request.tab.headers': 'Encabezados',
  'workbench.editors.request.tab.body': 'Cuerpo',
  'workbench.editors.request.tab.scripts': 'Scripts',
  'workbench.editors.request.tab.settings': 'Configuración',

  // ── URL bar + method picker (method names stay raw parity vocab) ───
  'workbench.editors.request.url.placeholder': 'Introduce una URL o pega texto',
  'workbench.editors.request.method.customGroup': 'Personalizados',
  'workbench.editors.request.method.usePrefix': 'Usar',
  'workbench.editors.request.method.forbiddenSuffix': 'no se puede enviar desde un navegador.',
  'workbench.editors.request.method.invalidHint': 'Los métodos usan letras, dígitos y guiones (máx. 32).',
  'workbench.editors.request.method.removeCustomAria': 'Quitar el método personalizado {method}',

  // ── Params / Headers tabs ──────────────────────────────────────────
  'workbench.editors.request.goToAuthorization': 'Ir a la autorización',
  'workbench.editors.request.goToBody': 'Ir al cuerpo',
  'workbench.editors.request.goToSettings': 'Ir a la configuración',
  'workbench.editors.request.headers.keyPlaceholder': 'Encabezado',
  'workbench.editors.request.headers.hideAuto': 'Ocultar los encabezados generados automáticamente',
  'workbench.editors.request.headers.hiddenCount': '{count} ocultos',
  'workbench.editors.request.headers.autoInfo':
    'Estos encabezados se añadirán y enviarán automáticamente con la solicitud. Haz clic en el icono de ' +
    'información de una fila para el detalle por encabezado.',
  'workbench.editors.request.headers.duplicateAuthOverride':
    'Duplicado — reemplazado al enviar por el encabezado {header} generado desde la pestaña Autorización.',
  'workbench.editors.request.headers.calculated': '<calculado al enviar la solicitud>',
  'workbench.editors.request.headers.browserUserAgent': '<user agent del navegador>',
  'workbench.editors.request.headers.hint.cacheControl':
    '«Cache-Control: no-cache» se añade como medida de precaución para evitar que el servidor devuelva ' +
    'respuestas obsoletas cuando repites solicitudes. Puedes quitar este encabezado en la configuración de ' +
    'la solicitud o introducir uno nuevo con otro valor.',
  'workbench.editors.request.headers.hint.contentType':
    'El runtime calcula el Content-Type a partir de la codificación del cuerpo (form-data → ' +
    'multipart/form-data con un boundary; x-www-form-urlencoded → application/x-www-form-urlencoded; JSON ' +
    'raw → application/json; etc.). Define tu propio encabezado para sustituirlo.',
  'workbench.editors.request.headers.hint.contentLength':
    'Content-Length se calcula a partir del tamaño en bytes del cuerpo serializado antes de enviar la ' +
    'solicitud. El navegador se niega a respetar un Content-Length definido por el usuario que no coincida ' +
    'con la longitud real del cuerpo.',
  'workbench.editors.request.headers.hint.host':
    'El navegador deriva Host de la URL de destino y no permite que el código de usuario lo sustituya.',
  'workbench.editors.request.headers.hint.userAgent':
    'El User-Agent identifica al cliente. Las solicitudes salen con el User-Agent propio del navegador; ' +
    'añade tu propia fila User-Agent abajo para sustituirlo.',
  'workbench.editors.request.headers.hint.accept':
    'Accept indica al servidor qué tipos de medio puede analizar el cliente. `*/*` deja elegir al servidor; ' +
    'sustitúyelo por un conjunto más estrecho (p. ej. `application/json`) para restringir las respuestas.',
  'workbench.editors.request.headers.hint.acceptEncoding':
    'Los algoritmos de compresión que admite el navegador. Lo define el navegador y se negocia por ' +
    'conexión; no se puede sustituir desde el código de usuario.',
  'workbench.editors.request.headers.hint.connection':
    'Reutilización de conexiones HTTP/1.1. El navegador gestiona el grupo de conexiones y no permite que el ' +
    'código de usuario sustituya este encabezado.',

  // ── Auth preview rows (Headers/Params generated rows) ──────────────
  'workbench.editors.request.authPreview.basicValue': 'Basic <credenciales>',
  'workbench.editors.request.authPreview.bearerValue': 'Bearer <token>',
  'workbench.editors.request.authPreview.apiKeyValue': '<valor>',
  'workbench.editors.request.authPreview.accessTokenValue': '<token de acceso>',
  'workbench.editors.request.authPreview.bearerAccessTokenValue': 'Bearer <token de acceso>',
  'workbench.editors.request.authPreview.basicHint':
    'Generado desde la pestaña Autorización (Basic Auth). El nombre de usuario y la contraseña se codifican ' +
    'en base64 en este encabezado al enviar la solicitud.',
  'workbench.editors.request.authPreview.bearerHint':
    'Generado desde la pestaña Autorización (Bearer Token). El token se añade a este encabezado al enviar ' +
    'la solicitud.',
  'workbench.editors.request.authPreview.apiKeyHeaderHint':
    'Generado desde la pestaña Autorización (API Key). El valor se añade a este encabezado al enviar la ' +
    'solicitud.',
  'workbench.editors.request.authPreview.apiKeyQueryHint':
    'Generado desde la pestaña Autorización (API Key). El valor se añade a este parámetro de consulta al ' +
    'enviar la solicitud.',
  'workbench.editors.request.authPreview.oauth2HeaderHint':
    'Generado desde la pestaña Autorización (OAuth 2.0). El token de acceso se añade a este encabezado al ' +
    'enviar la solicitud.',
  'workbench.editors.request.authPreview.oauth2QueryHint':
    'Generado desde la pestaña Autorización (OAuth 2.0). El token de acceso se anexa a la URL de la ' +
    'solicitud al enviarla.',
  'workbench.editors.request.authPreview.awsSigV4Value': 'AWS4-HMAC-SHA256 <firma>',
  'workbench.editors.request.authPreview.awsSigV4DateValue': '<marca de tiempo de la solicitud>',
  'workbench.editors.request.authPreview.awsSigV4Hint':
    'Generado desde la pestaña Autorización (AWS Signature v4). La solicitud se firma con tus credenciales ' +
    'al enviarla.',
  'workbench.editors.request.authPreview.awsSigV4DateHint':
    'Generado desde la pestaña Autorización (AWS Signature v4). La marca de tiempo de la firma se añade a ' +
    'este encabezado al enviar la solicitud.',
  'workbench.editors.request.authPreview.digestValue': 'Digest <respuesta al desafío>',
  'workbench.editors.request.authPreview.digestHint':
    'Generado desde la pestaña Autorización (Digest Auth). El valor se calcula a partir del desafío del ' +
    'servidor al enviar la solicitud, que se reenvía después con él.',
  'workbench.editors.request.authPreview.oauth1Value': 'OAuth <parámetros firmados>',
  'workbench.editors.request.authPreview.oauth1Hint':
    'Generado desde la pestaña Autorización (OAuth 1.0). La solicitud se firma con tus credenciales al ' + 'enviarla.',
  'workbench.editors.request.authPreview.oauth1QueryValue': '<parámetros firmados>',
  'workbench.editors.request.authPreview.oauth1QueryHint':
    'Generado desde la pestaña Autorización (OAuth 1.0). Los parámetros oauth_* se añaden a la consulta de ' +
    'la URL al enviar la solicitud.',

  // ── Authorization tab ──────────────────────────────────────────────
  'workbench.editors.request.auth.typeLabel': 'Tipo de autenticación',
  'workbench.editors.request.auth.type.inherit': 'Heredar la autenticación del padre',
  'workbench.editors.request.auth.type.none': 'Sin autenticación',
  'workbench.editors.request.auth.type.basic': 'Basic Auth',
  'workbench.editors.request.auth.type.bearer': 'Bearer Token',
  'workbench.editors.request.auth.type.apiKey': 'API Key',
  'workbench.editors.request.auth.type.oauth2': 'OAuth 2.0',
  'workbench.editors.request.auth.type.awsSigV4': 'AWS Signature v4',
  'workbench.editors.request.auth.type.digest': 'Digest Auth',
  'workbench.editors.request.auth.type.oauth1': 'OAuth 1.0',
  'workbench.editors.request.auth.oauth1ConsumerKey': 'Consumer Key',
  'workbench.editors.request.auth.oauth1ConsumerKeyPlaceholder': 'consumer key',
  'workbench.editors.request.auth.oauth1ConsumerSecret': 'Consumer Secret',
  'workbench.editors.request.auth.oauth1ConsumerSecretPlaceholder': 'consumer secret',
  'workbench.editors.request.auth.oauth1Token': 'Token de acceso',
  'workbench.editors.request.auth.oauth1TokenPlaceholder': 'opcional — vacío para llamadas one-legged',
  'workbench.editors.request.auth.oauth1TokenSecret': 'Token Secret',
  'workbench.editors.request.auth.oauth1TokenSecretPlaceholder': 'opcional — vacío para llamadas one-legged',
  'workbench.editors.request.auth.oauth1SignatureMethod': 'Método de firma',
  'workbench.editors.request.auth.oauth1Realm': 'Realm',
  'workbench.editors.request.auth.oauth1RealmPlaceholder': 'opcional',
  'workbench.editors.request.auth.digestBrowserNote':
    'Digest Auth responde al desafío del servidor con una segunda solicitud, que se ejecuta en la ' +
    'aplicación de escritorio y la CLI. Los envíos desde esta superficie salen sin ella — el servidor ' +
    'responde 401.',
  'workbench.editors.request.auth.inheritNote':
    'Los datos de autorización se configurarán automáticamente a partir de la colección padre.',
  'workbench.editors.request.auth.noneNote': 'Esta solicitud no usa ninguna autorización.',
  'workbench.editors.request.auth.inheritDetail':
    'Esta solicitud usa el asistente de autorización de su colección padre. Edita la pestaña Autorización ' +
    'de la colección para cambiarlo.',
  'workbench.editors.request.auth.resizeRailAria': 'Redimensionar el riel de tipos de autenticación',
  'workbench.editors.request.auth.username': 'Nombre de usuario',
  'workbench.editors.request.auth.password': 'Contraseña',
  'workbench.editors.request.auth.token': 'Token',
  'workbench.editors.request.auth.key': 'Clave',
  'workbench.editors.request.auth.keyPlaceholder': 'p. ej. X-API-Key',
  'workbench.editors.request.auth.value': 'Valor',
  'workbench.editors.request.auth.addTo': 'Añadir a',
  'workbench.editors.request.auth.addToHeader': 'Encabezado',
  'workbench.editors.request.auth.addToQuery': 'Parámetros de consulta',
  'workbench.editors.request.auth.usernamePlaceholder': 'nombre de usuario',
  'workbench.editors.request.auth.passwordPlaceholder': 'contraseña',
  'workbench.editors.request.auth.tokenPlaceholder': 'token bearer',
  'workbench.editors.request.auth.valuePlaceholder': 'valor de la api key',
  'workbench.editors.request.auth.awsAccessKey': 'Access Key',
  'workbench.editors.request.auth.awsSecretKey': 'Secret Key',
  'workbench.editors.request.auth.awsSessionToken': 'Session Token',
  'workbench.editors.request.auth.awsService': 'Nombre del servicio',
  'workbench.editors.request.auth.awsRegion': 'Región',
  'workbench.editors.request.auth.awsAccessKeyPlaceholder': 'p. ej. AKIAIOSFODNN7EXAMPLE',
  'workbench.editors.request.auth.awsSecretKeyPlaceholder': 'secret access key',
  'workbench.editors.request.auth.awsSessionTokenPlaceholder': 'opcional — solo credenciales temporales (STS)',
  'workbench.editors.request.auth.awsServicePlaceholder': 'p. ej. s3, execute-api',
  'workbench.editors.request.auth.awsRegionPlaceholder': 'p. ej. us-east-1',
  'workbench.editors.request.auth.sendAsLabel': 'Añadir los datos de autorización a',
  'workbench.editors.request.auth.sendAsHeaders': 'Encabezados de la solicitud',
  'workbench.editors.request.auth.sendAsUrl': 'URL de la solicitud',
  'workbench.editors.request.auth.presetLabel': 'Preajuste de proveedor',
  'workbench.editors.request.auth.presetInfo':
    'Elegir un proveedor prerrellena sus puntos de acceso de autorización/token, sus ámbitos por defecto y ' +
    'el flujo recomendado. Elige Personalizado para configurarlo todo a mano.',
  'workbench.editors.request.auth.presetCustom': 'Personalizado (sin preajuste)',

  // ── OAuth 2.0 editor (grant-type names stay raw spec vocabulary) ───
  'workbench.editors.request.oauth.queryWarningTitle': 'Enviar el token de acceso en la URL está obsoleto',
  'workbench.editors.request.oauth.queryWarningBefore':
    'RFC 6750 §2.3 mantuvo disponible el método del parámetro de consulta en la URI pero desaconseja ' +
    'usarlo: los tokens se filtran a los registros del servidor, los encabezados HTTP `Referer`, el ' +
    'historial del navegador y las cachés intermedias. Prefiere el encabezado',
  'workbench.editors.request.oauth.queryWarningAfter': 'por defecto salvo que el proveedor exija la forma de consulta.',
  'workbench.editors.request.oauth.currentToken': 'Token actual',
  'workbench.editors.request.oauth.configureNewToken': 'Configurar un token nuevo',
  'workbench.editors.request.oauth.tokenLabel': 'Token',
  'workbench.editors.request.oauth.noTokenPlaceholder': 'Aún no hay token — usa Obtener un token de acceso nuevo abajo',
  'workbench.editors.request.oauth.headerPrefix': 'Prefijo del encabezado',
  'workbench.editors.request.oauth.autoRefresh': 'Renovar el token automáticamente',
  'workbench.editors.request.oauth.autoRefreshDesc':
    'Tu token caducado se renovará automáticamente antes de enviar una solicitud.',
  'workbench.editors.request.oauth.status': 'Estado',
  'workbench.editors.request.oauth.statusExpired':
    'Caducado — el próximo envío lo renovará automáticamente cuando haya un refresh_token almacenado.',
  'workbench.editors.request.oauth.statusValid': 'Válido · {duration}',
  'workbench.editors.request.oauth.refreshNow': 'Renovar ahora',
  'workbench.editors.request.oauth.disconnect': 'Desconectar',
  'workbench.editors.request.oauth.tokenName': 'Nombre del token',
  'workbench.editors.request.oauth.tokenNameDesc':
    'Etiqueta libre, visible en la lista de credenciales cuando un espacio de trabajo tiene varios tokens ' +
    'contra el mismo proveedor.',
  'workbench.editors.request.oauth.tokenNamePlaceholder': 'Introduce un nombre para el token…',
  'workbench.editors.request.oauth.grantType': 'Tipo de concesión',
  'workbench.editors.request.oauth.callbackUrl': 'URL de retorno',
  'workbench.editors.request.oauth.detecting': 'Detectando…',
  'workbench.editors.request.oauth.callbackTipBeforeExtUrl':
    'Registra esta URL en tu proveedor de OAuth. Se ve distinta de la',
  'workbench.editors.request.oauth.callbackTipBeforeHost':
    'URL de tu barra de direcciones porque Chrome expone un host de redirección dedicado',
  'workbench.editors.request.oauth.callbackTipBeforeApi': 'para',
  'workbench.editors.request.oauth.callbackTipAfterApi':
    '. El ID de la extensión es el mismo; solo cambian el host y el esquema.',
  'workbench.editors.request.oauth.authorizeUsingBrowser': 'Autorizar con el navegador',
  'workbench.editors.request.oauth.authUrl': 'URL de autorización',
  'workbench.editors.request.oauth.accessTokenUrl': 'URL del token de acceso',
  'workbench.editors.request.oauth.clientId': 'Client ID',
  'workbench.editors.request.oauth.clientSecret': 'Client Secret',
  'workbench.editors.request.oauth.codeChallengeMethod': 'Code Challenge Method',
  'workbench.editors.request.oauth.codeVerifier': 'Code Verifier',
  'workbench.editors.request.oauth.codeVerifierPlaceholder': 'Se genera automáticamente si se deja en blanco',
  'workbench.editors.request.oauth.scope': 'Scope',
  'workbench.editors.request.oauth.scopePlaceholder': 'p. ej. read:org',
  'workbench.editors.request.oauth.state': 'State',
  'workbench.editors.request.oauth.stateAuto': 'Se genera automáticamente por cada solicitud de autorización',
  'workbench.editors.request.oauth.clientAuthentication': 'Autenticación del cliente',
  'workbench.editors.request.oauth.clientAuthenticationDesc':
    'Dónde viajan client_id / client_secret en los POST de token. Los proveedores varían — Auth0 / Keycloak ' +
    'suelen exigir la forma de encabezado Basic.',
  'workbench.editors.request.oauth.clientAuthBody': 'Enviar las credenciales del cliente en el cuerpo',
  'workbench.editors.request.oauth.clientAuthBasicHeader': 'Enviar como encabezado Basic Auth',
  'workbench.editors.request.oauth.advanced': 'Avanzado',
  'workbench.editors.request.oauth.advancedIntro':
    'Aquí puedes añadir personalizaciones más específicas a tus solicitudes OAuth2.',
  'workbench.editors.request.oauth.advancedLearnMore': 'Más información sobre la configuración',
  'workbench.editors.request.oauth.refreshTokenUrl': 'URL de renovación del token',
  'workbench.editors.request.oauth.refreshTokenUrlDesc':
    'La mayoría de los proveedores reutilizan la URL del token de acceso para renovar; indica una distinta ' +
    'solo cuando el proveedor exponga una ruta propia.',
  'workbench.editors.request.oauth.authRequest': 'Solicitud de autorización',
  'workbench.editors.request.oauth.tokenRequest': 'Solicitud de token',
  'workbench.editors.request.oauth.refreshRequest': 'Solicitud de renovación',
  'workbench.editors.request.oauth.getNewToken': 'Obtener un token de acceso nuevo',
  'workbench.editors.request.oauth.clearCookies': 'Borrar las cookies',
  'workbench.editors.request.oauth.storedFootnoteBefore': 'Los tokens se almacenan por espacio de trabajo bajo',
  'workbench.editors.request.oauth.storedFootnoteAfter': '. Elimina el espacio de trabajo para purgarlos.',
  'workbench.editors.request.oauth.toast.tokenReceived': 'OAuth: token recibido',
  'workbench.editors.request.oauth.toast.authorizationComplete': 'OAuth: autorización completada',
  'workbench.editors.request.oauth.toast.failed': 'OAuth falló: {error}',
  'workbench.editors.request.oauth.toast.refreshed': 'OAuth: token de acceso renovado',
  'workbench.editors.request.oauth.toast.refreshFailed': 'La renovación falló: {error}',
  'workbench.editors.request.oauth.toast.disconnected': 'OAuth: desconectado',
  'workbench.editors.request.oauth.toast.callbackCopied': 'URL de retorno copiada',
  'workbench.editors.request.oauth.toast.copyUnsupported': 'Copia no admitida — selecciona la URL manualmente',

  // ── Body tab (encoding radios + format labels stay raw) ────────────
  'workbench.editors.request.body.noBody': 'Esta solicitud no tiene cuerpo',
  'workbench.editors.request.body.beautify': 'Embellecer',
  'workbench.editors.request.body.format': 'Formatear',
  'workbench.editors.request.body.formatAria': 'Formatear el cuerpo',
  'workbench.editors.request.body.queryTitle': 'Consulta',
  'workbench.editors.request.body.queryInfoTitle': 'Consulta GraphQL',
  'workbench.editors.request.body.queryInfoSummary':
    'Se envía como un POST normal con un cuerpo JSON de { query, variables }. La introspección del esquema ' +
    'y el autocompletado de consultas aún no están disponibles.',
  'workbench.editors.request.body.variablesTitle': 'Variables GraphQL',
  'workbench.editors.request.body.variablesInfoTitle': 'Variables GraphQL',
  'workbench.editors.request.body.variablesInfoSummary':
    'Define variables en formato JSON para referenciarlas desde la consulta (p. ej. $id).',
  'workbench.editors.request.body.kindText': 'Texto',
  'workbench.editors.request.body.kindFile': 'Archivo',
  'workbench.editors.request.body.newFile': 'Archivo nuevo desde el equipo local',
  'workbench.editors.request.body.uploadedFiles': 'Archivos subidos',
  'workbench.editors.request.body.allAttached': 'Todos los archivos subidos ya están adjuntos',
  'workbench.editors.request.body.selectFiles': 'Seleccionar archivos',
  'workbench.editors.request.body.loadingFiles': 'Cargando los archivos…',
  'workbench.editors.request.body.addFile': '+ Añadir archivo',
  'workbench.editors.request.body.uploadRequired': 'Subida requerida',
  'workbench.editors.request.body.deleteFileAria': 'Eliminar {filename} del espacio de trabajo',

  // ── Docs tab ───────────────────────────────────────────────────────
  'workbench.editors.request.docs.write': 'Escribir',
  'workbench.editors.request.docs.preview': 'Vista previa',
  'workbench.editors.request.docs.infoTitle': 'Docs',
  'workbench.editors.request.docs.infoSummary':
    'Documenta esta solicitud — por qué existe, cuándo ejecutarla, el ámbito de autenticación esperado. ' +
    'Admite Markdown: títulos, listas, tablas, bloques de código, enlaces. Las referencias {{variable}} se ' +
    'muestran como chips en la vista previa.',
  'workbench.editors.request.docs.placeholder':
    '¿Qué hace esta solicitud?\nPor qué existe, cuándo ejecutarla, el ámbito de autenticación esperado.',
  'workbench.editors.request.docs.empty': 'Aún no hay nada documentado — cambia a Escribir para añadir notas.',

  // ── Scripts tab (oh.* API labels + Monaco menu plane stay raw) ─────
  'workbench.editors.request.scripts.preRequest': 'Pre-solicitud',
  'workbench.editors.request.scripts.postResponse': 'Post-respuesta',
  'workbench.editors.request.scripts.preInfoTitle': 'Script de pre-solicitud',
  'workbench.editors.request.scripts.preInfoSummary':
    'Se ejecuta en un iframe aislado antes de enviar la solicitud. Modifica la solicitud saliente con la ' + 'API oh:',
  'workbench.editors.request.scripts.postInfoTitle': 'Script de post-respuesta',
  'workbench.editors.request.scripts.postInfoSummary':
    'Se ejecuta en un iframe aislado cuando llega la respuesta. Los resultados de las aserciones aterrizan ' +
    'en el panel Respuesta:',
  'workbench.editors.request.scripts.apiHeading': 'API',
  'workbench.editors.request.scripts.apiSetHeader': 'añadir o reemplazar un encabezado',
  'workbench.editors.request.scripts.apiSetQueryParam': 'añadir o reemplazar un parámetro de consulta',
  'workbench.editors.request.scripts.apiSetUrl': 'reescribir la URL de destino',
  'workbench.editors.request.scripts.apiSetBody': 'reemplazar el cuerpo de la solicitud',
  'workbench.editors.request.scripts.apiRequire': 'cargar un paquete de scripts de la biblioteca de paquetes',
  'workbench.editors.request.scripts.apiTest': 'registrar una aserción',
  'workbench.editors.request.scripts.prePlaceholder': 'Usa JavaScript para modificar esta solicitud antes de enviarla.',
  'workbench.editors.request.scripts.postPlaceholder':
    'Usa JavaScript para probar y leer esta respuesta cuando llegue.',

  // ── Settings tab — wired knobs ─────────────────────────────────────
  'workbench.editors.request.settings.enabled': 'Activado',
  'workbench.editors.request.settings.disabled': 'Desactivado',
  'workbench.editors.request.settings.followRedirects': 'Seguir las redirecciones automáticamente',
  'workbench.editors.request.settings.followRedirectsInfo':
    'Sigue las respuestas HTTP 3xx hasta su destino. Desactívalo para detenerte en la propia redirección — ' +
    'la respuesta se muestra como una redirección opaca sin encabezados ni cuerpo, útil para confirmar que ' +
    'la redirección ocurre siquiera.',
  'workbench.editors.request.settings.maxRedirects': 'Máximo de redirecciones',
  'workbench.editors.request.settings.maxRedirectsInfo':
    'Cuántas redirecciones puede seguir un envío antes de fallar con un error que nombra el límite. Déjalo ' +
    'vacío para el valor por defecto de 20. Pon 0 para fallar ante cualquier redirección.',
  'workbench.editors.request.settings.followOriginalMethod': 'Seguir con el método HTTP original',
  'workbench.editors.request.settings.followOriginalMethodInfo':
    'Conserva el método y el cuerpo originales cuando una redirección 301, 302 o 303 normalmente cambiaría ' +
    'la solicitud a GET. Las redirecciones 307 y 308 siempre conservan el método de todos modos.',
  'workbench.editors.request.settings.followAuthHeader': 'Conservar el encabezado Authorization',
  'workbench.editors.request.settings.followAuthHeaderInfo':
    'Conserva el encabezado Authorization cuando una redirección cruza a otro origen. Normalmente se ' +
    'descarta en un salto entre orígenes para que las credenciales nunca viajen a un host al que la ' +
    'solicitud no se dirigía.',
  'workbench.editors.request.settings.followAuthHeaderWarning':
    'Las credenciales viajan al host en el que acabe la cadena de redirecciones. Una respuesta cuya cadena ' +
    'cruzó orígenes de verdad queda marcada.',
  'workbench.editors.request.settings.sendBrowserCookies': 'Enviar las cookies del navegador',
  'workbench.editors.request.settings.sendBrowserCookiesInfo':
    'Adjunta a esta solicitud las cookies que el navegador ya tiene para el sitio de destino. Desactivado ' +
    'es el valor seguro por defecto: la solicitud se envía sin cookies, así que los resultados no dependen ' +
    'de tu estado de sesión en el navegador.',
  'workbench.editors.request.settings.sslVerification': 'Verificación del certificado SSL',
  'workbench.editors.request.settings.sslVerificationSummary':
    'Verifica el certificado TLS del servidor contra el almacén de CA de confianza del runtime — activado ' +
    'por defecto.',
  'workbench.editors.request.settings.sslVerificationDescription':
    'Un host con un certificado autofirmado, caducado o no confiable falla con un error de certificado TLS ' +
    '— desactiva la verificación para alcanzarlo de todos modos, p. ej. un servidor de desarrollo con ' +
    'certificado autofirmado.',
  'workbench.editors.request.settings.sslVerificationWarning':
    'Los envíos omiten la comprobación de identidad del servidor — se acepta cualquier certificado, ' +
    'incluidos los autofirmados y caducados. La respuesta queda marcada como no verificada.',
  'workbench.editors.request.settings.tlsMin': 'Versión mínima de TLS',
  'workbench.editors.request.settings.tlsMinSummary':
    'La versión más baja del protocolo TLS que un envío puede negociar — vacío conserva el valor por ' +
    'defecto del runtime, TLS 1.2.',
  'workbench.editors.request.settings.tlsMinDescription':
    'Elegir 1.0 o 1.1 baja el suelo por debajo del valor por defecto para alcanzar servidores heredados — ' +
    'una respuesta enviada con el suelo bajado queda marcada.',
  'workbench.editors.request.settings.tlsMinPlaceholder': '1.2 (por defecto)',
  'workbench.editors.request.settings.tlsMinWarning':
    'Los envíos pueden negociar TLS por debajo de 1.2 — versiones del protocolo con debilidades conocidas. ' +
    'La respuesta queda marcada.',
  'workbench.editors.request.settings.tlsMax': 'Versión máxima de TLS',
  'workbench.editors.request.settings.tlsMaxSummary':
    'La versión más alta del protocolo TLS que un envío puede negociar — vacío conserva el valor por ' +
    'defecto del runtime, TLS 1.3.',
  'workbench.editors.request.settings.tlsMaxDescription':
    'Bájala para comprobar cómo se comporta un servidor con un protocolo más antiguo — puede que también ' +
    'haya que bajar la mínima, o las dos no se solaparán.',
  'workbench.editors.request.settings.tlsVersionsHeading': 'Versiones',
  'workbench.editors.request.settings.tlsVersionLegacyDesc':
    'Heredadas, con debilidades conocidas — los envíos quedan marcados.',
  'workbench.editors.request.settings.tlsVersion12Desc': 'El suelo por defecto.',
  'workbench.editors.request.settings.tlsVersion13Desc': 'El techo por defecto — la buena práctica actual.',
  'workbench.editors.request.settings.tlsMaxPlaceholder': '1.3 (por defecto)',
  'workbench.editors.request.settings.tlsCipherSuites': 'Suites de cifrado TLS',
  'workbench.editors.request.settings.tlsCipherSuitesSummary':
    'Las suites de cifrado ofrecidas durante el handshake TLS, como una lista separada por dos puntos — ' +
    'vacío ofrece las suites por defecto del runtime.',
  'workbench.editors.request.settings.tlsCipherSuitesDescription':
    'El servidor elige la suite entre lo ofrecido, en su propio orden de preferencia.',
  'workbench.editors.request.settings.tlsCipherSuitesFormatHeading': 'Formato',
  'workbench.editors.request.settings.tlsCipherSuitesIanaDesc': 'Una suite de TLS 1.3 por su nombre IANA.',
  'workbench.editors.request.settings.tlsCipherSuitesOpensslDesc':
    'Una suite más antigua por su nombre OpenSSL — ambos tipos van en la misma lista.',
  'workbench.editors.request.settings.tlsCipherSuitesJoinDesc': 'Une las entradas — sin espacios.',
  'workbench.editors.request.settings.tlsCipherSuitesPlaceholder': 'Suites por defecto del runtime',
  'workbench.editors.request.settings.tlsCipherSuitesError':
    'Solo nombres de suites OpenSSL separados por dos puntos — sin espacios.',
  'workbench.editors.request.settings.maxRedirectsPlaceholder': '20 saltos (por defecto)',
  'workbench.editors.request.settings.maxRedirectsHops': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} salto', many: '{count} saltos', other: '{count} saltos' }),
  'workbench.editors.request.settings.responseSizeLimitPlaceholder': '2 MB (por defecto)',
  'workbench.editors.request.settings.resetToDefault': 'Restablecer los valores por defecto',
  'workbench.editors.request.settings.resetRow': 'Restablecer {label} al valor por defecto',
  'workbench.editors.request.settings.group.redirects': 'Redirecciones',
  'workbench.editors.request.settings.group.tls': 'TLS y confianza',
  'workbench.editors.request.settings.group.connection': 'Conexión',
  'workbench.editors.request.settings.group.cookies': 'Cookies',
  'workbench.editors.request.settings.group.execution': 'Ejecución y límites',
  'workbench.editors.request.settings.groupInfo.connection':
    'Cómo alcanza el envío al servidor — el protocolo HTTP que habla y el tramo que marca: directo, a ' +
    'través de un proxy, a una dirección fijada o hacia un socket local.',
  'workbench.editors.request.settings.groupInfo.tls':
    'Qué verifica y ofrece el envío en el handshake TLS — la verificación del certificado, la ventana de ' +
    'protocolo, las suites de cifrado y un certificado de cliente.',
  'workbench.editors.request.settings.groupInfo.redirects':
    'Qué pasa cuando el servidor responde con una redirección — si se sigue la cadena, hasta dónde, y qué ' +
    'llevan las solicitudes siguientes.',
  'workbench.editors.request.settings.groupInfo.cookies':
    'Si las cookies acompañan al envío — desactivado por defecto, para que los resultados nunca dependan ' +
    'del estado de sesión ambiental.',
  'workbench.editors.request.settings.groupInfo.execution':
    'Cómo se acota la propia ejecución — el modo de scripts, el presupuesto de tiempo y el tope de tamaño ' +
    'de respuesta.',
  'workbench.editors.request.settings.httpVersion': 'Versión de HTTP',
  'workbench.editors.request.settings.httpVersionSummary':
    'Cómo habla HTTP el envío — Auto (el valor por defecto) ofrece HTTP/2 junto con HTTP/1.1 y el servidor ' + 'elige.',
  'workbench.editors.request.settings.httpVersionDescription':
    'Una versión fijada que el servidor no puede hablar falla con un error claro, nunca con una degradación ' +
    'silenciosa. El popover «Red» de la respuesta muestra siempre el protocolo realmente negociado en el ' +
    'cable.',
  'workbench.editors.request.settings.httpVersionValuesHeading': 'Valores',
  'workbench.editors.request.settings.httpVersionAutoDesc':
    'Ofrece HTTP/2 + HTTP/1.1 durante el handshake TLS y el servidor elige — el http:// plano se queda en ' +
    'HTTP/1.1.',
  'workbench.editors.request.settings.httpVersion11Desc': 'Fija la semántica clásica de HTTP/1.1.',
  'workbench.editors.request.settings.httpVersion2Desc': 'Fija HTTP/2 mediante la oferta del handshake.',
  'workbench.editors.request.settings.httpVersionPkDesc':
    'Habla HTTP/2 de inmediato sin negociar — la vía para servidores HTTP/2 en claro.',
  'workbench.editors.request.settings.httpVersion3Desc':
    'Se conecta al servidor directamente por QUIC, sin recurrir a TCP.',
  'workbench.editors.request.settings.exampleCaption': 'Envío de ejemplo',
  'workbench.editors.request.settings.httpVersionPlaceholder': 'Auto — el servidor elige',
  'workbench.editors.request.settings.httpVersionPriorKnowledge': 'HTTP/2 (prior knowledge)',
  'workbench.editors.request.settings.resolveToAddress': 'Resolver a una dirección',
  'workbench.editors.request.settings.resolveToAddressInfo':
    'Envía esta solicitud a una dirección de servidor concreta en lugar de a lo que responda el DNS — el ' +
    'nombre de host de la URL se sigue usando para TLS y el encabezado Host, así que con la verificación ' +
    'activada el certificado aún debe coincidir con él. Útil para probar un backend concreto detrás de un ' +
    'balanceador de carga. La URL conserva su propio puerto, y una redirección a otro host también aterriza ' +
    'en esta dirección. Déjalo vacío para resolver por DNS como de costumbre.',
  'workbench.editors.request.settings.resolveToAddressPlaceholder': 'DNS del sistema',
  'workbench.editors.request.settings.resolveToAddressError':
    'Solo direcciones IPv4 o IPv6 — sin nombre de host ni puerto.',
  'workbench.editors.request.settings.clientCertificate': 'Certificado de cliente',
  'workbench.editors.request.settings.clientCertificateInfo':
    'Presenta un certificado de cliente durante el handshake TLS, para APIs detrás de pasarelas de TLS ' +
    'mutuo que autentican al llamante por certificado. Elige una entrada de certificado del vault — la ' +
    'solicitud guarda solo el nombre de la entrada, y cada dispositivo presenta su propia entrada del vault ' +
    'con ese nombre; el certificado y la clave nunca salen del vault. Déjalo vacío para conectar sin ' +
    'certificado de cliente.',
  'workbench.editors.request.settings.clientCertificatePlaceholder': 'Sin certificado de cliente',
  'workbench.editors.request.settings.clientCertificateDangling':
    'No hay ninguna entrada de certificado del vault llamada «{name}» en este dispositivo — los envíos ' +
    'fallarán hasta que la entrada exista o se borre este ajuste.',
  'workbench.editors.request.settings.proxy': 'Proxy',
  'workbench.editors.request.settings.proxyInfo':
    'Encamina esta solicitud a través de un proxy HTTP(S) en lugar de conectar directamente. La conexión ' +
    'con el destino se tuneliza a través del proxy, así que un intercambio https sigue cifrado de extremo a ' +
    'extremo y la verificación del certificado se ejecuta igualmente contra el destino. Los proxies SOCKS ' +
    'no están admitidos. Las credenciales van en el ajuste «Credenciales del proxy» de abajo, nunca en esta ' +
    'URL. Déjalo vacío para una conexión directa.',
  'workbench.editors.request.settings.proxyPlaceholder': 'Sin proxy — conexión directa',
  'workbench.editors.request.settings.proxyError':
    'Solo URL http:// o https:// con host y puerto — sin credenciales en la URL, sin SOCKS.',
  'workbench.editors.request.settings.proxyResolveConflict':
    'También define resolver-a-dirección, pero un proxy resuelve el nombre de host por sí mismo — los ' +
    'envíos fallarán hasta que se borre uno de los dos.',
  'workbench.editors.request.settings.proxyCredentials': 'Credenciales del proxy',
  'workbench.editors.request.settings.proxyCredentialsInfo':
    'Autentícate contra el proxy con credenciales del vault, como user:password en una entrada de texto. La ' +
    'solicitud guarda solo el nombre de la entrada, y cada dispositivo lo resuelve contra su propio vault ' +
    'local — las credenciales nunca salen del vault y se envían solo al proxy, nunca al destino. Déjalo ' +
    'vacío para un proxy sin autenticación.',
  'workbench.editors.request.settings.proxyCredentialsPlaceholder': 'Sin autenticación',
  'workbench.editors.request.settings.proxyCredentialsDangling':
    'No hay ninguna entrada de texto del vault llamada «{name}» en este dispositivo — los envíos fallarán ' +
    'hasta que la entrada exista o se borre este ajuste.',
  'workbench.editors.request.settings.unixSocket': 'Socket Unix',
  'workbench.editors.request.settings.unixSocketInfo':
    'Marca este socket local — una ruta absoluta de socket Unix, o una tubería con nombre de Windows como ' +
    '\\\\.\\pipe\\nombre — en lugar de abrir una conexión TCP, p. ej. un daemon de Docker o un servicio de ' +
    'desarrollo local escuchando en un socket. El host de la URL ya no decide adónde va la conexión, pero ' +
    'el encabezado Host, el nombre de servidor TLS y la verificación del certificado siguen usándolo, y una ' +
    'redirección a otro host también marca este mismo socket. Déjalo vacío para una conexión TCP normal.',
  'workbench.editors.request.settings.unixSocketPlaceholder': 'Sin socket — conexión TCP',
  'workbench.editors.request.settings.unixSocketError':
    'Solo rutas absolutas de socket Unix (/…) o tuberías con nombre de Windows (\\\\.\\pipe\\…).',
  'workbench.editors.request.settings.unixSocketProxyConflict':
    'También define un proxy, pero un túnel de proxy no puede marcar un socket local — los envíos fallarán ' +
    'hasta que se borre uno de los dos.',
  'workbench.editors.request.settings.unixSocketResolveConflict':
    'También define resolver-a-dirección, pero una conexión por socket no resuelve ningún nombre de host — ' +
    'los envíos fallarán hasta que se borre uno de los dos.',
  'workbench.editors.request.settings.cookieJar': 'Usar el tarro de cookies',
  'workbench.editors.request.settings.cookieJarInfo':
    'Guarda las respuestas Set-Cookie de esta solicitud en el tarro de cookies propio de la aplicación y ' +
    'adjunta automáticamente las cookies que coincidan — así una solicitud de inicio de sesión seguida de ' +
    'una llamada autenticada funciona sin copiar valores de cookies a mano. El tarro vive en memoria por ' +
    'espacio de trabajo, solo lo usan las solicitudes con este ajuste activado, nunca se sincroniza y se ' +
    'vacía al salir de la aplicación. Un encabezado Cookie que definas tú siempre gana. Desactivado es el ' +
    'valor por defecto: no se adjunta ninguna cookie y las respuestas Set-Cookie se descartan.',
  'workbench.editors.request.settings.timeout': 'Tiempo límite de la solicitud',
  'workbench.editors.request.settings.timeoutInfo':
    'Tiempo máximo que puede tardar la solicitud completa — conectar, esperar la respuesta y leer el ' +
    'cuerpo. Cuando el límite se agota, el envío se aborta y falla con un error de tiempo agotado que lo ' +
    'nombra. Déjalo vacío para no tener límite por solicitud; solo se aplican los tiempos límite propios de ' +
    'la pila de red.',
  'workbench.editors.request.settings.timeoutPlaceholder': 'Sin límite',
  'workbench.editors.request.settings.responseSizeLimit': 'Límite de tamaño de la respuesta',
  'workbench.editors.request.settings.responseSizeLimitInfo':
    'Tamaño máximo del cuerpo de respuesta leído del cable; lo que pase de ahí se corta y la respuesta ' +
    'queda marcada como truncada. Déjalo vacío para el límite por defecto de 2 048 KB (2 MB). Súbelo hasta ' +
    '10 240 KB (10 MB) para cargas mayores, o bájalo para probar cómo se ve una respuesta truncada.',

  // ── Settings tab — runtime-managed fact sheets ─────────────────────
  'workbench.editors.request.settings.managed.browserKicker': 'Gestionado por el navegador',
  'workbench.editors.request.settings.managed.nodeKicker': 'Gestionado por el runtime',
  'workbench.editors.request.settings.managed.browserIntro':
    'Fijado por el navegador para cada solicitud enviada desde una extensión — se muestra para que sepas ' +
    'qué no es negociable.',
  'workbench.editors.request.settings.managed.nodeIntro':
    'Fijado por el runtime de red de la aplicación para cada solicitud — se muestra para que sepas qué no ' +
    'es negociable.',
  'workbench.editors.request.settings.managed.hideBrowser': 'Ocultar los ajustes gestionados por el navegador',
  'workbench.editors.request.settings.managed.hideNode': 'Ocultar los ajustes gestionados por el runtime',
  'workbench.editors.request.settings.managed.countBrowser': '{count} gestionados por el navegador',
  'workbench.editors.request.settings.managed.countNode': '{count} gestionados por el runtime',
  'workbench.editors.request.settings.managed.on': 'Activado',
  'workbench.editors.request.settings.managed.off': 'Desactivado',
  'workbench.editors.request.settings.managed.auto': 'Auto',
  'workbench.editors.request.settings.managed.policy': 'Política',
  'workbench.editors.request.settings.managed.browser': 'Navegador',
  'workbench.editors.request.settings.managed.about20': '~20',
  'workbench.editors.request.settings.managed.notSent': 'No se envía',
  'workbench.editors.request.settings.managed.httpVersion': 'Versión de HTTP',
  'workbench.editors.request.settings.managed.httpVersionDesc':
    'El navegador negocia HTTP/1.1, HTTP/2 o HTTP/3 por conexión; la API fetch no expone un selector de ' + 'versión.',
  'workbench.editors.request.settings.managed.sslVerificationDesc':
    'Los certificados se verifican según la política del navegador. Una solicitud a un host con un ' +
    'certificado no válido falla; la verificación no se puede desactivar por solicitud.',
  'workbench.editors.request.settings.managed.followOriginalMethodDesc':
    'En una redirección 301/302/303 el navegador cambia los métodos que no son GET a GET según la ' +
    'especificación de fetch. 307/308 siempre conservan el método.',
  'workbench.editors.request.settings.managed.followAuthHeaderDesc':
    'El navegador retira el encabezado Authorization cuando una redirección cruza a otro origen; este ' +
    'comportamiento de seguridad no se puede anular.',
  'workbench.editors.request.settings.managed.refererRedirect': 'Quitar el encabezado Referer al redirigir',
  'workbench.editors.request.settings.managed.refererRedirectDesc':
    'El tratamiento del Referer a través de redirecciones sigue la política de referencia del navegador ' +
    'para el contexto de la extensión.',
  'workbench.editors.request.settings.managed.strictParser': 'Analizador HTTP estricto',
  'workbench.editors.request.settings.managed.strictParserBrowserDesc':
    'La pila de red del navegador siempre rechaza los encabezados de respuesta malformados; no hay modo ' +
    'permisivo.',
  'workbench.editors.request.settings.managed.strictParserNodeDesc':
    'El analizador HTTP del runtime rechaza los encabezados de respuesta malformados; no hay modo permisivo.',
  'workbench.editors.request.settings.managed.encodeUrl': 'Codificar la URL automáticamente',
  'workbench.editors.request.settings.managed.encodeUrlDesc':
    'La ruta y la consulta de la URL se codifican con porcentajes por el analizador de URL antes de que la ' +
    'solicitud salga al cable. Escribe secuencias ya codificadas para conservarlas literales.',
  'workbench.editors.request.settings.managed.cipherOrder': 'Orden de suites de cifrado del servidor',
  'workbench.editors.request.settings.managed.cipherOrderDesc':
    'La negociación de cifrado TLS es del navegador; ni la lista de suites ni el orden son configurables.',
  'workbench.editors.request.settings.managed.maxRedirectsDesc':
    'La API fetch limita la cadena de redirecciones a unos 20 saltos. Un tope por solicitud no es ' +
    'implementable: el modo de redirección manual devuelve una respuesta opaca sin encabezados que seguir.',
  'workbench.editors.request.settings.managed.tlsVersions': 'Versiones del protocolo TLS/SSL',
  'workbench.editors.request.settings.managed.tlsVersionsDesc':
    'Las versiones de TLS habilitadas las fija el navegador; la selección por solicitud no está expuesta.',
  'workbench.editors.request.settings.managed.referer': 'Encabezado Referer',
  'workbench.editors.request.settings.managed.refererDesc':
    'El runtime no tiene contexto de página, así que ningún Referer sale al cable salvo que lo añadas tú ' +
    'mismo como encabezado.',
  'workbench.editors.request.settings.managed.scripts': 'Scripts de pre-solicitud / post-respuesta',
  'workbench.editors.request.settings.managed.scriptsNotRun': 'No se ejecutan aquí',
  'workbench.editors.request.settings.managed.scriptsNotRunDesc':
    'El host que responde a los envíos de esta superficie no tiene runtime de scripts, así que los scripts ' +
    'de pre-solicitud y post-respuesta se omiten y la respuesta no lleva resultados de scripts.',
  'workbench.editors.request.settings.managed.scriptsSafeForwarded': 'Modo seguro',
  'workbench.editors.request.settings.managed.scriptsSafeForwardedDesc':
    'Los envíos de esta superficie se ejecutan en el back-end conectado, que ejecuta los scripts de ' +
    'pre-solicitud y post-respuesta en su runtime seguro aislado: solo la API de scripts oh.* — sin sistema ' +
    'de archivos, sin acceso a procesos, sin cargador de módulos. Los envíos reenviados nunca se ejecutan ' +
    'en modo desarrollador, y cada ejecución registra en la respuesta el modo en el que se ejecutó.',

  // ── Settings tab — script execution chooser (per-workspace,
  //    host-local — never syncs) ───────────────────────────────────────
  'workbench.editors.request.settings.scriptMode': 'Ejecución de scripts',
  'workbench.editors.request.settings.scriptModeSummary':
    'Cómo se ejecutan en este dispositivo los scripts de pre-solicitud y post-respuesta de este espacio de ' +
    'trabajo.',
  'workbench.editors.request.settings.scriptModeDescription':
    'La elección se aplica a todas las solicitudes del espacio de trabajo, se queda en este dispositivo y ' +
    'nunca se sincroniza — cada ejecución registra en la respuesta el modo en el que se ejecutó.',
  'workbench.editors.request.settings.scriptModeModesHeading': 'Modos',
  'workbench.editors.request.settings.scriptModeSafe': 'Modo seguro',
  'workbench.editors.request.settings.scriptModeDeveloper': 'Modo desarrollador',
  'workbench.editors.request.settings.scriptModeWarning':
    'El modo desarrollador ejecuta los scripts de este espacio de trabajo con acceso total al sistema — ' +
    'sistema de archivos, procesos y red. Actívalo solo si confías en todos los que pueden editar los ' +
    'scripts de este espacio de trabajo. Los pasos de workflow y las solicitudes reenviadas por otros ' +
    'dispositivos siguen ejecutándose en modo seguro.',

  // ── Request editor — script-mode tag (tab-bar chip + chooser popover;
  //    same per-workspace host-local slot as the Settings row) ─────────
  'workbench.editors.request.settings.scriptModeTagAria': 'Ejecución de scripts: {mode}',
  'workbench.editors.request.settings.scriptModeRecommended': 'Recomendado',
  'workbench.editors.request.settings.scriptModeSafeCard':
    'Los scripts se ejecutan en el runtime de scripts aislado de la aplicación — solo la API de scripts ' +
    'oh.*, sin sistema de archivos ni acceso a procesos y sin cargador de módulos.',
  'workbench.editors.request.settings.scriptModeDeveloperCard':
    'Los scripts se ejecutan en un runtime Node.js completo — require, sistema de archivos, procesos y ' +
    'acceso a la red.',
  'workbench.editors.request.settings.scriptModeDeveloperTrust':
    'Úsalo solo si confías en todos los que pueden editar los scripts de este espacio de trabajo',
  'workbench.editors.request.settings.scriptModeScopeNote':
    'Se aplica a todas las solicitudes de este espacio de trabajo, solo en este dispositivo — la elección ' +
    'nunca se sincroniza.',

  // ── Settings tab — cookie jar row ──────────────────────────────────
  'workbench.editors.request.settings.jar.count': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie en el tarro de este espacio de trabajo',
      many: '{count} cookies en el tarro de este espacio de trabajo',
      other: '{count} cookies en el tarro de este espacio de trabajo',
    }),
  'workbench.editors.request.settings.jar.infoTitle': 'Contenido del Cookie jar',
  'workbench.editors.request.settings.jar.infoSummary':
    'Las cookies que el tarro en memoria de este espacio de trabajo contiene ahora — guardadas por los ' +
    'envíos con el tarro activado, adjuntadas a los envíos con el tarro activado que coincidan, y ' +
    'desaparecen al salir de la aplicación. Los valores son credenciales de sesión y se quedan dentro del ' +
    'runtime de red de la aplicación; solo se muestran el nombre, el ámbito y la caducidad.',
  'workbench.editors.request.settings.jar.storedHeading': 'Cookies almacenadas',
  'workbench.editors.request.settings.jar.clear': 'Vaciar',
  'workbench.editors.request.settings.jar.delete': 'Eliminar {name}',
  'workbench.editors.request.settings.jar.expires': 'caduca {date}',
  'workbench.editors.request.settings.jar.session': 'sesión',
  'workbench.editors.request.settings.jar.httpsOnly': 'solo https',

  // ── Response panel shell (status/duration/size VALUES stay raw —
  //    parity vocabulary and diagnostic measurement, plan §3) ─────────
  'workbench.editors.request.response.title': 'Respuesta',
  'workbench.editors.request.response.clear': 'Borrar',
  'workbench.editors.request.response.saveResponse': 'Guardar la respuesta',
  'workbench.editors.request.response.createWorkflow': 'Crear workflow',
  'workbench.editors.request.response.createWorkflowNew': 'Crear un workflow nuevo',
  'workbench.editors.request.response.createWorkflowAttach': 'Adjuntar a un workflow existente',
  'workbench.editors.request.response.createWorkflowNeedsSave': 'Guarda la solicitud y úsala en un workflow',
  'workbench.editors.request.response.copyBody': 'Copiar el cuerpo',
  'workbench.editors.request.response.saveBodyToFile': 'Guardar el cuerpo en un archivo',
  'workbench.editors.request.response.saveBodyToFileTruncated':
    'Guardar el cuerpo en un archivo (truncado — guarda lo conservado)',
  'workbench.editors.request.response.clearResponse': 'Borrar la respuesta',
  'workbench.editors.request.response.moreActionsAria': 'Más acciones de respuesta',
  'workbench.editors.request.response.copied': 'Copiado',
  // View-tab nouns are DevTools parity vocabulary — keyed for uniform
  // lookup, glossary-protected on translator handoff (S4 precedent).
  'workbench.editors.request.response.tab.body': 'Cuerpo',
  'workbench.editors.request.response.tab.headers': 'Encabezados ({count})',
  'workbench.editors.request.response.tab.cookies': 'Cookies ({count})',
  'workbench.editors.request.response.tab.assertions': 'Aserciones',
  'workbench.editors.request.response.tab.assertionsFailed': 'Aserciones ({count} fallidas)',
  'workbench.editors.request.response.tab.assertionsPassed': 'Aserciones ({count} superadas)',
  'workbench.editors.request.response.tab.console': 'Console ({count})',

  // ── Response meta strip (values raw; chip labels + popovers keyed) ──
  'workbench.editors.request.response.meta.kicker': 'Metadatos de la respuesta',
  'workbench.editors.request.response.meta.timingTitle': 'Tiempos',
  'workbench.editors.request.response.meta.timingSummary': 'Medido alrededor de la llamada fetch: {duration}.',
  'workbench.editors.request.response.meta.timingNoEntry':
    'La plataforma no registró ninguna entrada de resource-timing para esta solicitud, así que no hay ' +
    'desglose por fases disponible.',
  'workbench.editors.request.response.meta.timingTotalOnly':
    'Total de red {duration}. El servidor no expuso el detalle de tiempos a esta solicitud entre orígenes ' +
    '(sin encabezado Timing-Allow-Origin), así que las fases DNS / conexión / TTFB / descarga están ocultas.',
  // Phase-ladder labels — devtools waterfall parity vocabulary,
  // glossary-protected on translator handoff.
  'workbench.editors.request.response.meta.phase.redirect': 'Redirecciones',
  'workbench.editors.request.response.meta.phase.stalled': 'Bloqueo',
  'workbench.editors.request.response.meta.phase.dns': 'Búsqueda DNS',
  'workbench.editors.request.response.meta.phase.connect': 'Conexión TCP',
  'workbench.editors.request.response.meta.phase.tls': 'Handshake TLS',
  'workbench.editors.request.response.meta.phase.waiting': 'Espera (TTFB)',
  'workbench.editors.request.response.meta.phase.download': 'Descarga del contenido',
  'workbench.editors.request.response.meta.totalNetwork': 'Total (red)',
  'workbench.editors.request.response.meta.noteNodePhaseLegs':
    'DNS, conexión y TLS no son observables por envío desde el runtime de red de la aplicación — van ' +
    'incluidos en Espera.',
  'workbench.editors.request.response.meta.sizeTitle': 'Tamaño',
  'workbench.editors.request.response.meta.sizeSummary': 'Bytes en cada dirección de este intercambio.',
  'workbench.editors.request.response.meta.responseSize': 'Tamaño de la respuesta',
  'workbench.editors.request.response.meta.requestSize': 'Tamaño de la solicitud',
  'workbench.editors.request.response.meta.rowHeaders': 'Encabezados',
  'workbench.editors.request.response.meta.rowBody': 'Cuerpo',
  'workbench.editors.request.response.meta.rowCompressed': 'Comprimido',
  'workbench.editors.request.response.meta.rowTransferred': 'Transferido',
  'workbench.editors.request.response.meta.noteHeaderBytes':
    'Bytes de encabezados tal como se ven — HTTP/2+ los comprime en el cable.',
  'workbench.editors.request.response.meta.noteRequestHeaders':
    'Los encabezados de solicitud cuentan solo lo que definió este envío; el navegador añade los suyos ' +
    '(Host, User-Agent, …).',
  'workbench.editors.request.response.meta.noteTruncatedAtCap':
    'Cuerpo truncado en el límite de tamaño de respuesta de {cap}; el tamaño completo se contabiliza.',
  'workbench.editors.request.response.meta.noteTruncated':
    'Vista del cuerpo truncada; el tamaño completo se contabiliza.',
  'workbench.editors.request.response.meta.noteBodyApproximate':
    'El tamaño del cuerpo de la solicitud es aproximado — el boundary multipart lo genera el navegador.',
  'workbench.editors.request.response.meta.noteWireHidden':
    'Tamaños en el cable (comprimido, transferido) ocultos: el servidor no envió Timing-Allow-Origin.',
  'workbench.editors.request.response.meta.noteWireHiddenNode':
    'Tamaños en el cable (comprimido, transferido) no informados por el runtime de red de la aplicación.',
  'workbench.editors.request.response.meta.networkTitle': 'Red',
  'workbench.editors.request.response.meta.networkSummary': 'Datos a nivel de conexión de este intercambio.',
  'workbench.editors.request.response.meta.httpVersion': 'Versión de HTTP',
  'workbench.editors.request.response.meta.localAddress': 'Dirección local',
  'workbench.editors.request.response.meta.remoteAddress': 'Dirección remota',
  'workbench.editors.request.response.meta.noteVersionHiddenNode':
    'Versión de HTTP oculta: el protocolo negociado no fue observable para este envío (los envíos a través ' +
    'de proxy negocian dentro del túnel).',
  'workbench.editors.request.response.meta.noteVersionHiddenBrowser':
    'Versión de HTTP oculta: la plataforma no registró ninguna entrada de tiempos para esta solicitud.',
  'workbench.editors.request.response.meta.noteNoIp':
    'Dirección remota no disponible: la captura del cable no vio nada para este fetch.',
  'workbench.editors.request.response.meta.noteNoTls':
    'La dirección local y los detalles de TLS y del certificado no se exponen al código de extensiones en ' +
    'Chromium.',
  'workbench.editors.request.response.meta.tagUnverifiedTls': 'TLS sin verificar',
  'workbench.editors.request.response.meta.unverifiedTlsTitle': 'Verificación SSL desactivada',
  'workbench.editors.request.response.meta.unverifiedTlsSummary':
    'Esta solicitud se envió con la verificación del certificado desactivada en su Configuración. La ' +
    'conexión iba cifrada, pero la identidad del servidor no se comprobó — se aceptó cualquier certificado, ' +
    'incluidos los autofirmados y caducados.',
  'workbench.editors.request.response.meta.tlsFloorLowered': 'Suelo de TLS bajado',
  'workbench.editors.request.response.meta.tlsFloorLoweredSummary':
    'Esta solicitud se envió con su versión mínima de TLS por debajo de 1.2 en su Configuración, así que a ' +
    'la conexión se le permitió negociar TLS 1.0 o 1.1 — versiones del protocolo con debilidades conocidas ' +
    'que los runtimes desactivan por defecto.',
  'workbench.editors.request.response.meta.authForwarded': 'Authorization reenviado',
  'workbench.editors.request.response.meta.authForwardedSummary':
    'Una redirección llevó esta solicitud a otro origen, y su Configuración conserva el encabezado ' +
    'Authorization entre orígenes — así que las credenciales se reenviaron al host nuevo. Normalmente el ' +
    'encabezado se descarta cuando una redirección sale del origen original.',
  'workbench.editors.request.response.meta.executedOnTag': 'Enviado desde {name}',
  'workbench.editors.request.response.meta.executedOnTitle': 'Ejecutado en el back-end conectado',
  'workbench.editors.request.response.meta.executedOnSummary':
    'Esta solicitud la envió «{name}» — el back-end al que está conectada esta superficie — no este ' +
    'dispositivo. El servidor de destino vio la dirección IP y la ubicación de red de esa máquina, así que ' +
    'el comportamiento basado en geolocalización o IP refleja dónde se ejecuta el back-end. Registrado en ' +
    'esta ejecución por el host que la ejecutó.',
  'workbench.editors.request.response.meta.cookieJar': 'Cookie jar',
  'workbench.editors.request.response.meta.cookieJarSummary':
    'Esta solicitud usó el tarro de cookies en memoria del espacio de trabajo: las cookies almacenadas que ' +
    'coincidían se adjuntaron automáticamente, y las respuestas Set-Cookie se conservaron para futuros ' +
    'envíos con el tarro activado.',
  'workbench.editors.request.response.meta.jarAttachedLabel': 'Adjuntadas a la primera solicitud',
  'workbench.editors.request.response.meta.jarAttachedNone':
    'Nada — ninguna cookie almacenada coincidió, o ganó un encabezado Cookie definido en la solicitud.',
  'workbench.editors.request.response.meta.jarStoredLabel': 'Almacenadas desde respuestas Set-Cookie',
  'workbench.editors.request.response.meta.jarStoredNone': 'Nada — ninguna respuesta definió una cookie.',
  'workbench.editors.request.response.meta.redirects': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} redirección',
      many: '{count} redirecciones',
      other: '{count} redirecciones',
    }),
  'workbench.editors.request.response.meta.redirectsTitle': 'Cadena de redirecciones',
  'workbench.editors.request.response.meta.redirectsSummary':
    'Los saltos que siguió esta solicitud antes de la respuesta final — cada uno muestra la solicitud ' +
    'enviada y la redirección con la que respondió, registrados cuando se ejecutó el envío.',
  'workbench.editors.request.response.meta.redirectMethodChanged':
    'Método cambiado a {method} para la siguiente solicitud',
  'workbench.editors.request.response.meta.redirectAuthStripped':
    'Encabezado Authorization descartado — la siguiente solicitud cruzó a otro origen',
  'workbench.editors.request.response.meta.redirectAuthForwarded':
    'Encabezado Authorization reenviado entre orígenes — conservado por la Configuración de esta solicitud',
  'workbench.editors.request.response.meta.redirectFinal': 'Respuesta final',
  'workbench.editors.request.response.meta.streamedEnd': 'Flujo terminado',
  'workbench.editors.request.response.meta.streamedStop': 'Detenido',
  'workbench.editors.request.response.meta.streamedCap': 'Flujo limitado',
  'workbench.editors.request.response.meta.streamedTimeout': 'Tiempo agotado a mitad del flujo',
  'workbench.editors.request.response.meta.streamedError': 'El flujo falló',
  'workbench.editors.request.response.meta.streamedEndSummary':
    'Esta respuesta llegó en flujo en vivo hasta que el servidor cerró el flujo. El cuerpo de abajo es la ' +
    'captura completa.',
  'workbench.editors.request.response.meta.streamedPartialSummary':
    'La respuesta seguía llegando en flujo cuando terminó el intercambio, así que el cuerpo de abajo es la ' +
    'captura parcial hasta ese punto — todo lo que llegó se conservó.',
  'workbench.editors.request.response.streamReceiving': 'Recibiendo el flujo — {size}',

  // ── SSE event list (event names like `message`/`comment` are wire
  //    grammar terms and stay untranslated) ────────────────────────────
  'workbench.editors.request.response.sse.connected': 'Conectado a {url}',
  'workbench.editors.request.response.sse.closed': 'Conexión cerrada',
  'workbench.editors.request.response.sse.stopped': 'Conexión detenida',
  'workbench.editors.request.response.sse.capped': 'Captura limitada — se alcanzó el límite del cuerpo',
  'workbench.editors.request.response.sse.timedOut': 'Tiempo de conexión agotado',
  'workbench.editors.request.response.sse.failed': 'La conexión falló',
  'workbench.editors.request.response.sse.searchEvents': 'Buscar en los eventos',
  'workbench.editors.request.response.sse.noMatches': 'Ningún evento coincide.',
  'workbench.editors.request.response.sse.waiting': 'Esperando eventos…',
  'workbench.editors.request.response.sse.eventCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} evento', many: '{count} eventos', other: '{count} eventos' }),
  'workbench.editors.request.response.sse.clearEvents': 'Borrar los eventos (solo la vista)',
  'workbench.editors.request.response.sse.newEvents': 'Eventos nuevos',
  'workbench.editors.request.response.sse.sortOrder': 'Orden',
  'workbench.editors.request.response.sse.newestFirst': 'Los más recientes primero',
  'workbench.editors.request.response.sse.oldestFirst': 'Los más antiguos primero',
  'workbench.editors.request.response.sse.groupByName': 'Agrupar por nombre de evento',
  'workbench.editors.request.response.sse.rowsPerGroup': 'Filas por grupo',
  'workbench.editors.request.response.sse.noLimit': 'Sin límite',
  'workbench.editors.request.response.sse.infoId': 'ID',
  'workbench.editors.request.response.sse.infoSize': 'Tamaño',
  'workbench.editors.request.response.sse.infoRetry': 'Retry',
  'workbench.editors.request.response.sse.eventInfoAria': 'Detalles del evento',

  // ── Response body view (filter syntax + format examples stay raw) ──
  'workbench.editors.request.response.body.truncatedNotice': 'Respuesta truncada en {cap} (original {size}).',
  'workbench.editors.request.response.body.increaseLimit': 'Aumentar el límite',
  'workbench.editors.request.response.body.limitHint': 'El límite se ajusta en Configuración → Solicitudes API.',
  'workbench.editors.request.response.body.viewPickerAria': 'Vista del cuerpo',
  'workbench.editors.request.response.body.preview': 'Vista previa',
  'workbench.editors.request.response.body.wrapLines': 'Ajustar las líneas',
  'workbench.editors.request.response.body.unwrapLines': 'No ajustar las líneas',
  'workbench.editors.request.response.body.renderAnsi': 'Mostrar los colores ANSI',
  'workbench.editors.request.response.body.plainAnsi': 'Mostrar el texto plano',
  'workbench.editors.request.response.body.filterJsonPathTooltip': 'Filtrar el cuerpo (JSONPath)',
  'workbench.editors.request.response.body.filterXPathTooltip': 'Filtrar el cuerpo (XPath)',
  'workbench.editors.request.response.body.filterMetricsTooltip': 'Filtrar el cuerpo (familias de métricas)',
  'workbench.editors.request.response.body.filterAria': 'Filtrar el cuerpo',
  'workbench.editors.request.response.body.invalidJsonPath': 'Expresión JSONPath no válida.',
  'workbench.editors.request.response.body.invalidXPath': 'Expresión XPath no válida, o el documento no se analiza.',
  'workbench.editors.request.response.body.invalidMetricsFilter': 'Selector de métricas no válido.',
  'workbench.editors.request.response.body.noMatches': 'No hay coincidencias para esta ruta.',
  'workbench.editors.request.response.body.showingLastMatch': 'Mostrando la última coincidencia.',
  'workbench.editors.request.response.body.hexCapNotice': 'La vista Hex muestra los primeros {shown} de {total}.',
  'workbench.editors.request.response.body.previewIframeTitle': 'Vista previa de la respuesta',
  'workbench.editors.request.response.body.pdfPreviewIframeTitle': 'Vista previa del PDF',
  'workbench.editors.request.response.body.imagePreviewAlt': 'Imagen de la respuesta',
  'workbench.editors.request.response.body.imagePreviewFailed':
    'Los datos de la imagen no se decodifican — mira los bytes en bruto en la vista Hex.',
  'workbench.editors.request.response.body.mediaPreviewAria': 'Vista previa del medio',
  'workbench.editors.request.response.body.mediaPreviewFailed':
    'Los datos del medio no se decodifican — mira los bytes en bruto en la vista Hex.',
  'workbench.editors.request.response.body.requestBodyOmittedNotice':
    'Cuerpo de la solicitud no enviado — el navegador no puede adjuntar un cuerpo a solicitudes GET o HEAD.',
  'workbench.editors.request.response.body.duplicateJsonKeysNotice':
    'Claves JSON duplicadas — se muestra el último valor: {keys}',
  'workbench.editors.request.response.body.partialJsonNotice':
    'Cuerpo truncado — la vista previa y el filtro muestran solo los valores capturados por completo.',
  'workbench.editors.request.response.body.schemalessDecodeNotice':
    'Decodificación sin esquema (mejor esfuerzo) — se muestran los números de campo; el anidamiento y el ' +
    'texto se infieren de los bytes del cable.',

  // ── Response headers view ──────────────────────────────────────────
  'workbench.editors.request.response.headers.name': 'Nombre',
  'workbench.editors.request.response.headers.value': 'Valor',
  'workbench.editors.request.response.headers.filterPlaceholder': 'Filtrar los encabezados',
  'workbench.editors.request.response.headers.copyAll': 'Copiar todos los encabezados',
  'workbench.editors.request.response.headers.copyAria': 'Copiar {name}',
  'workbench.editors.request.response.headers.copyTitle': 'Copiar el encabezado',
  'workbench.editors.request.response.headers.empty': 'Sin encabezados',
  'workbench.editors.request.response.headers.noMatch': 'Ningún encabezado coincide con «{query}»',
  'workbench.editors.request.response.headers.trailers': 'Trailers',

  // ── Response cookies view (Set-Cookie attribute column names stay
  //    raw wire vocabulary: Domain / Path / Expires / HttpOnly /
  //    Secure / SameSite) ─────────────────────────────────────────────
  'workbench.editors.request.response.cookies.name': 'Nombre',
  'workbench.editors.request.response.cookies.value': 'Valor',
  'workbench.editors.request.response.cookies.copyAria': 'Copiar el Set-Cookie de {name}',
  'workbench.editors.request.response.cookies.copyTitle': 'Copiar la línea Set-Cookie',
  'workbench.editors.request.response.cookies.noteCredentialsInclude':
    'Esta solicitud se ejecutó con las credenciales incluidas, así que el navegador puede haber almacenado ' +
    'estas cookies (según los atributos de cada una) y las enviará en futuras solicitudes con credenciales.',
  'workbench.editors.request.response.cookies.noteCredentialsOmit':
    'El servidor envió estas cookies, pero esta solicitud se ejecutó con las credenciales omitidas (el ' +
    'valor por defecto), así que el navegador las descartó — no se almacenó nada.',
  'workbench.editors.request.response.cookies.noteJarOff':
    'Estas cookies no se almacenaron — esta solicitud se ejecutó sin el tarro de cookies (el valor por ' +
    'defecto), o el tarro no aceptó ninguna.',
  'workbench.editors.request.response.cookies.noteJarStored':
    'Esta solicitud se ejecutó con el tarro de cookies activado, que almacenó {names} en el tarro en ' +
    'memoria del espacio de trabajo para futuras solicitudes con el tarro activado.',
  'workbench.editors.request.response.cookies.noteJarStoredMidChain':
    'Esta solicitud se ejecutó con el tarro de cookies activado, que almacenó {names} en el tarro en ' +
    'memoria del espacio de trabajo para futuras solicitudes con el tarro activado. Algunas se definieron ' +
    'en saltos de redirección intermedios, así que sus líneas Set-Cookie no aparecen aquí — solo están los ' +
    'encabezados de la respuesta final.',

  // ── Response assertions / console views (log levels + script output
  //    stay raw; assertion durations are diagnostic timing — exempt) ──
  'workbench.editors.request.response.assertions.pass': 'SUPERADA',
  'workbench.editors.request.response.assertions.fail': 'FALLIDA',
  'workbench.editors.request.response.console.preRequest': 'Pre-solicitud',
  'workbench.editors.request.response.console.postResponse': 'Post-respuesta',

  // ── Response empty / error states (executor error text stays raw) ──
  'workbench.editors.request.response.empty.sending': 'Enviando la solicitud…',
  'workbench.editors.request.response.empty.prompt': 'Envía la solicitud para ver aquí la respuesta.',
  'workbench.editors.request.response.error.title': 'No se pudo enviar la solicitud',
  'workbench.editors.request.response.error.openInTab': 'Abrir en una pestaña nueva',
  'workbench.editors.request.response.error.certSteps.summary':
    'Los servidores de desarrollo locales suelen funcionar con un certificado autofirmado, que necesitas ' + 'aceptar.',
  'workbench.editors.request.response.error.certSteps.step1': 'Abre la URL en una pestaña nueva',
  'workbench.editors.request.response.error.certSteps.step2': 'Acepta la advertencia del certificado',
  'workbench.editors.request.response.error.certSteps.step2DetailChromium':
    'Configuración avanzada → Acceder (sitio no seguro)',
  'workbench.editors.request.response.error.certSteps.step2DetailFirefox': 'Avanzado… → Aceptar el riesgo y continuar',
  'workbench.editors.request.response.error.certSteps.step3': 'Envía la solicitud de nuevo',
  'workbench.editors.request.response.error.certSteps.glyphNewTab': 'pestaña nueva',
  'workbench.editors.request.response.error.certSteps.glyphAdvanced': 'Configuración avanzada',
  'workbench.editors.request.response.error.certSteps.glyphSend': '▶ Enviar',
  'workbench.editors.request.response.error.certSteps.glyphProceedChromium': 'Acceder (sitio no seguro)',
  'workbench.editors.request.response.error.certSteps.glyphProceedFirefox': 'Aceptar el riesgo y continuar',
} as const satisfies Catalog;
