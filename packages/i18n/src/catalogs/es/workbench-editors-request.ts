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
  'workbench.editors.request.toast.invalidSetting':
    '{label} no es válido — corrígelo en «Configuración» antes de guardar.',
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
  'workbench.editors.request.spec.selectLabel': 'Spec OpenAPI',
  'workbench.editors.request.spec.none': 'Ninguna spec OpenAPI está vinculada a esta solicitud.',
  'workbench.editors.request.spec.selectPlaceholder': 'Vincular una spec OpenAPI…',
  'workbench.editors.request.spec.inheritedPlaceholder': 'Heredada de la colección: {name}',
  'workbench.editors.request.spec.fromCollection': 'De la colección {name}',
  'workbench.editors.request.spec.missing': 'La spec vinculada ya no está en este espacio de trabajo.',
  'workbench.editors.request.spec.parseFailure': 'La spec no se pudo analizar: {message}',
  'workbench.editors.request.spec.drifted': 'La spec cambió después de generar esta colección.',
  'workbench.editors.request.spec.operation': 'Operación',
  'workbench.editors.request.spec.noOperation': 'Ninguna operación de la spec coincide con {method} {url}.',
  'workbench.editors.request.spec.inSync': 'Sincronizado con la spec.',
  'workbench.editors.request.spec.fieldDiffers': 'El campo {field} difiere de la spec.',
  'workbench.editors.request.spec.apply': 'Aplicar',
  'workbench.editors.request.spec.applyAll': 'Aplicar todo',

  // ── URL bar + method picker (method names stay raw parity vocab) ───
  'workbench.editors.request.url.placeholder': 'Introduce una URL o pega texto',
  'workbench.editors.request.url.socketCta':
    'URL de tipo socket — los envíos conectan a {path} mediante el ajuste de socket Unix.',
  'workbench.editors.request.url.socketCtaApply': 'Aplicar',
  'workbench.editors.request.method.customGroup': 'Personalizados',
  'workbench.editors.request.method.usePrefix': 'Usar',
  'workbench.editors.request.method.forbiddenSuffix': 'no se puede enviar desde un navegador.',
  'workbench.editors.request.method.invalidHint': 'Los métodos usan letras, dígitos y guiones (máx. 32).',
  'workbench.editors.request.method.removeCustomAria': 'Quitar el método personalizado {method}',

  // ── Params / Headers tabs ──────────────────────────────────────────
  'workbench.editors.request.goToAuthorization': 'Ir a la autorización',
  'workbench.editors.request.goToBody': 'Ir al cuerpo',
  'workbench.editors.request.headers.keyPlaceholder': 'Encabezado',
  'workbench.editors.request.headers.hideAuto': 'Ocultar los encabezados generados automáticamente',
  'workbench.editors.request.headers.hiddenCount': '{count} ocultos',
  'workbench.editors.request.headers.autoInfo':
    'Estos encabezados se añadirán y enviarán automáticamente con la solicitud. Haz clic en el icono de ' +
    'información de una fila para el detalle por encabezado.',
  'workbench.editors.request.headers.duplicateAuthOverride':
    'Este encabezado está duplicado y será reemplazado por el encabezado {header} generado por la configuración de autorización.',
  'workbench.editors.request.headers.calculated': '<calculado al enviar la solicitud>',
  'workbench.editors.request.headers.browserUserAgent': '<user agent del navegador>',
  'workbench.editors.request.headers.hint.cacheControl':
    '«Cache-Control: no-cache» sale con cada envío desde un host de navegador, para que el servidor nunca responda desde una caché obsoleta al repetir una solicitud. Añade tu propia fila Cache-Control para enviar otro valor.',
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
  'workbench.editors.request.headers.hint.node.host':
    'Derivado de la URL de destino al enviar. Una fila Host tuya lo reemplaza en el cable.',
  'workbench.editors.request.headers.hint.node.connection':
    'El runtime de node mantiene las conexiones vivas y las agrupa por origen. Una fila Connection tuya lo reemplaza.',
  'workbench.editors.request.headers.hint.node.acceptLanguage':
    'El cliente fetch del runtime de node envía un comodín. Una fila tuya lo reemplaza.',
  'workbench.editors.request.headers.hint.node.secFetchMode':
    'Añadido por el cliente fetch del runtime de node en cada envío. Una fila tuya lo reemplaza.',
  'workbench.editors.request.headers.hint.node.userAgent':
    'El runtime de node identifica esta aplicación en cada envío. Añade tu propia fila User-Agent para enviar otro.',
  'workbench.editors.request.headers.hint.node.acceptEncoding':
    'Compresión que el runtime de node acepta y descodifica por ti. Una fila tuya lo reemplaza — el cuerpo de la respuesta llega entonces tal como se envió.',

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
  'workbench.editors.request.authPreview.awsSigV4QueryValue': '<parámetros firmados>',
  'workbench.editors.request.authPreview.awsSigV4QueryHint':
    'Generado desde la pestaña Autorización (AWS Signature v4). Los parámetros X-Amz-* se añaden a la query de la URL al enviar la solicitud.',
  'workbench.editors.request.authPreview.edgeGridValue': 'EG1-HMAC-SHA256 <parámetros firmados>',
  'workbench.editors.request.authPreview.edgeGridHint':
    'Generado desde la pestaña Autorización (Akamai EdgeGrid). La solicitud se firma con tus credenciales al enviarla.',
  'workbench.editors.request.authPreview.asapValue': 'Bearer <JWT firmado>',
  'workbench.editors.request.authPreview.asapHint':
    'Generado desde la pestaña Autorización (ASAP). Se firma un token nuevo con tu clave privada y se añade a esta cabecera al enviar la solicitud.',
  'workbench.editors.request.authPreview.httpSignatureInputValue': 'sig1=(<componentes cubiertos>);created=…',
  'workbench.editors.request.authPreview.httpSignatureValue': 'sig1=:<firma>:',
  'workbench.editors.request.authPreview.httpSignatureHint':
    'Generado desde la pestaña Autorización (Firma de mensaje HTTP). La petición se firma con tu clave al enviarla.',
  'workbench.editors.request.authPreview.httpSignatureDigestValue': 'sha-256=:<resumen del cuerpo>:',
  'workbench.editors.request.authPreview.httpSignatureDigestHint':
    'Generado desde la pestaña Autorización (Firma de mensaje HTTP). El resumen del cuerpo se calcula al enviar.',
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
  'workbench.editors.request.authPreview.hawkValue': 'Hawk <parámetros firmados>',
  'workbench.editors.request.authPreview.hawkHint':
    'Generado desde la pestaña Autorización (Hawk Authentication). La solicitud se firma con tus ' +
    'credenciales al enviarla.',
  'workbench.editors.request.authPreview.jwtValue': '<JWT firmado>',
  'workbench.editors.request.authPreview.jwtHint':
    'Generado desde la pestaña Autorización (JWT Bearer). El token se firma y se añade a esta cabecera al ' +
    'enviar la solicitud.',
  'workbench.editors.request.authPreview.jwtQueryHint':
    'Generado desde la pestaña Autorización (JWT Bearer). El token se firma y se añade a este parámetro de ' +
    'consulta al enviar la solicitud.',
  'workbench.editors.request.authPreview.inheritedFrom': 'Heredado de {source} — edítalo en el elemento padre.',

  // ── Authorization tab ──────────────────────────────────────────────
  'workbench.editors.request.auth.typeLabel': 'Tipo de autenticación',
  'workbench.editors.request.auth.group.credentials': 'Credenciales',
  'workbench.editors.request.auth.group.token': 'Token',
  'workbench.editors.request.auth.group.signing': 'Firma',
  'workbench.editors.request.auth.group.consumer': 'Consumidor',
  'workbench.editors.request.auth.group.attributes': 'Atributos',
  'workbench.editors.request.auth.group.delivery': 'Entrega',
  'workbench.editors.request.auth.group.challenge': 'Desafío',
  'workbench.editors.request.auth.group.grant': 'Concesión',
  'workbench.editors.request.auth.group.advanced': 'Avanzado',
  'workbench.editors.request.auth.group.coverage': 'Cobertura',
  'workbench.editors.request.auth.group.parameters': 'Parámetros',
  'workbench.editors.request.auth.typeInfo.none':
    'No se añade nada \u2014 la solicitud sale exactamente como muestran sus pestañas Headers y Params.',
  'workbench.editors.request.auth.typeInfo.basic':
    'El usuario y la contraseña se unen con dos puntos, se codifican en base64 y se envían como cabecera Authorization: Basic en cada envío \u2014 codificados, no cifrados, así que solo por HTTPS.',
  'workbench.editors.request.auth.typeInfo.bearer':
    'El token se envía tal cual tras el esquema Bearer en la cabecera Authorization en cada envío.',
  'workbench.editors.request.auth.typeInfo.apiKey':
    'La clave nombra una cabecera o un parámetro de consulta y el valor viaja en él \u2014 el esquema de credencial simple que usan la mayoría de las API públicas.',
  'workbench.editors.request.auth.typeInfo.digest':
    'El primer envío provoca el desafío 401 del servidor (realm, nonce, qop); las credenciales se hashean con él en response= y la solicitud se reintenta \u2014 la contraseña en sí nunca viaja.',
  'workbench.editors.request.auth.typeInfo.oauth1':
    'Las credenciales de consumidor y token firman una cadena base con el método, la URL y los parámetros; los parámetros oauth_* firmados viajan en la cabecera Authorization o en la URL, con nonce, marca de tiempo y versión generados en cada envío.',
  'workbench.editors.request.auth.typeInfo.hawk':
    'Un MAC sobre el método, la URL, la marca de tiempo, el nonce y los atributos opcionales viaja en una cabecera Authorization: Hawk; la marca de tiempo y el nonce se generan en cada envío.',
  'workbench.editors.request.auth.typeInfo.jwt':
    'Se crea y firma un JWT nuevo en cada envío a partir del material de clave aquí \u2014 la cabecera, la carga útil y la firma de abajo \u2014 y se entrega como token bearer o parámetro de consulta.',
  'workbench.editors.request.auth.groupInfo.basic.credentials':
    'El par que se convierte en la credencial base64 \u2014 ambos se envían, codificados pero no cifrados.',
  'workbench.editors.request.auth.groupInfo.bearer.token':
    'El token tal como lo emitió el servidor; el esquema Bearer se antepone en la red.',
  'workbench.editors.request.auth.groupInfo.apiKey.credentials':
    'El nombre y el secreto \u2014 el nombre es la cabecera o el parámetro, el valor es lo que viaja en él.',
  'workbench.editors.request.auth.groupInfo.apiKey.delivery':
    'Dónde aterriza la clave: una cabecera de la solicitud, o un parámetro de consulta añadido a la URL.',
  'workbench.editors.request.auth.groupInfo.digest.credentials':
    'El par del que se calcula la respuesta al desafío \u2014 el usuario viaja, la contraseña solo como parte del hash de respuesta.',
  'workbench.editors.request.auth.groupInfo.digest.challenge':
    'Cómo se gestiona la etapa 401 en envíos de escritorio y CLI \u2014 respondida y reintentada automáticamente salvo que se desactive.',
  'workbench.editors.request.auth.groupInfo.oauth1.signing':
    'El método que firma la cadena base \u2014 HMAC con los secretos, RSA con la clave privada, o PLAINTEXT \u2014 y si el cuerpo se hashea en ella.',
  'workbench.editors.request.auth.groupInfo.oauth1.consumer':
    'Las credenciales de la aplicación \u2014 la clave viaja como oauth_consumer_key, el secreto (o la clave privada) solo a través de oauth_signature.',
  'workbench.editors.request.auth.groupInfo.oauth1.token':
    'El par de token de acceso del usuario del flujo de tres patas \u2014 deje ambos vacíos para llamadas de una pata.',
  'workbench.editors.request.auth.groupInfo.oauth1.delivery':
    'Dónde aterrizan los parámetros oauth_* \u2014 la cabecera Authorization (con un realm opcional) o la cadena de consulta de la URL.',
  'workbench.editors.request.auth.groupInfo.hawk.credentials':
    'El id viaja en la cabecera; la clave solo a través del MAC que calcula.',
  'workbench.editors.request.auth.groupInfo.hawk.signing':
    'El resumen del MAC, y si el cuerpo de la solicitud se hashea en él como hash=.',
  'workbench.editors.request.auth.groupInfo.hawk.attributes':
    'Los atributos opcionales del esquema \u2014 datos de aplicación (ext), el id de aplicación (app) y el delegante (dlg) \u2014 firmados cuando están presentes.',
  'workbench.editors.request.auth.groupInfo.jwt.signing':
    'El algoritmo nombrado en la cabecera JWT y el material de clave que la firma \u2014 un secreto compartido para HS, una clave privada para RS / PS / ES.',
  'workbench.editors.request.auth.groupInfo.jwt.token':
    'Lo que transporta el JWT \u2014 los claims de la carga útil, cabeceras protegidas extra y la vida útil opcional estampada como iat / exp.',
  'workbench.editors.request.auth.groupInfo.jwt.delivery':
    'Dónde aterriza el JWT firmado \u2014 la cabecera Authorization tras su prefijo, o un parámetro de consulta token.',
  'workbench.editors.request.auth.rowInfo.basicUsername': 'Viaja antes de los dos puntos en la credencial base64.',
  'workbench.editors.request.auth.rowInfo.basicPassword':
    'Viaja después de los dos puntos \u2014 codificada, nunca cifrada, así que solo por HTTPS.',
  'workbench.editors.request.auth.rowInfo.bearerToken':
    'Se envía tal cual tras Bearer; un «Bearer \u2026» pegado pierde aquí su prefijo.',
  'workbench.editors.request.auth.rowInfo.apiKeyKey':
    'El nombre de la cabecera o del parámetro de consulta en el que viaja el valor.',
  'workbench.editors.request.auth.rowInfo.apiKeyValue': 'El secreto enviado como valor de la cabecera o del parámetro.',
  'workbench.editors.request.auth.rowInfo.apiKeyAddTo':
    'Header pone la clave en la solicitud; Query Params la añade a la URL, donde acaba en los registros.',
  'workbench.editors.request.auth.rowInfo.digestUsername': 'Viaja como username= en la respuesta al desafío.',
  'workbench.editors.request.auth.rowInfo.digestPassword':
    'Nunca viaja \u2014 se hashea con el realm, el nonce y el método en response=.',
  'workbench.editors.request.auth.rowInfo.digestDisableRetry':
    'Detiene la segunda etapa automática: el 401 se devuelve como respuesta en lugar de responderse.',
  'workbench.editors.request.auth.rowInfo.oauth1SignatureMethod':
    'Nombra el algoritmo de firma en oauth_signature_method y elige el juego de credenciales de abajo.',
  'workbench.editors.request.auth.rowInfo.oauth1BodyHash':
    'Resume un cuerpo que no es formulario con el hash del método en oauth_body_hash, firmado con el resto.',
  'workbench.editors.request.auth.rowInfo.oauth1ConsumerKey':
    'Identifica la aplicación \u2014 viaja como oauth_consumer_key.',
  'workbench.editors.request.auth.rowInfo.oauth1ConsumerSecret':
    'Firma la solicitud junto con el secreto del token; nunca viaja, solo lo hace oauth_signature.',
  'workbench.editors.request.auth.rowInfo.oauth1PrivateKey':
    'La clave PEM que firma la cadena base para los métodos RSA \u2014 solo viaja la firma.',
  'workbench.editors.request.auth.rowInfo.oauth1Token':
    'El token de acceso del usuario, enviado como oauth_token; vacío para llamadas de una pata.',
  'workbench.editors.request.auth.rowInfo.oauth1TokenSecret':
    'La segunda mitad de la clave de firma; nunca viaja, solo lo hace oauth_signature.',
  'workbench.editors.request.auth.rowInfo.oauth1AddTo':
    'Header lleva los parámetros oauth_* en la cabecera Authorization; Query Params los añade a la URL.',
  'workbench.editors.request.auth.rowInfo.oauth1Realm':
    'Se repite como realm= al inicio de la cabecera, nombrando el espacio de protección.',
  'workbench.editors.request.auth.rowInfo.hawkAuthId': 'Identifica la credencial \u2014 viaja como id= en la cabecera.',
  'workbench.editors.request.auth.rowInfo.hawkAuthKey': 'El secreto compartido que calcula mac=; nunca viaja.',
  'workbench.editors.request.auth.rowInfo.hawkAlgorithm': 'El resumen HMAC que usan el MAC y el hash de carga útil.',
  'workbench.editors.request.auth.rowInfo.hawkPayloadHash':
    'Hashea el cuerpo y su tipo de contenido en hash=, ligando la carga útil a la firma.',
  'workbench.editors.request.auth.rowInfo.hawkExt':
    'Datos propios de la aplicación \u2014 viajan como ext= y se firman.',
  'workbench.editors.request.auth.rowInfo.hawkApp': 'El id de aplicación \u2014 viaja como app= y se firma.',
  'workbench.editors.request.auth.rowInfo.hawkDlg':
    'El id de la aplicación delegante \u2014 viaja como dlg= tras app= y se firma.',
  'workbench.editors.request.auth.rowInfo.jwtAlgorithm':
    'Se escribe como alg en la cabecera protegida y elige el campo de clave de abajo.',
  'workbench.editors.request.auth.rowInfo.jwtSecret': 'El secreto HMAC compartido que produce la firma; nunca viaja.',
  'workbench.editors.request.auth.rowInfo.jwtSecretBase64':
    'Decodifica el secreto desde base64 antes de firmar, para secretos emitidos en esa forma.',
  'workbench.editors.request.auth.rowInfo.jwtPrivateKey':
    'La clave privada PEM que produce la firma para RS / PS / ES; solo viaja la firma.',
  'workbench.editors.request.auth.rowInfo.jwtPayload':
    'Los claims en JSON \u2014 las plantillas se resuelven en cada envío; un iat o exp fijado aquí gana sobre la vida útil.',
  'workbench.editors.request.auth.rowInfo.jwtHeaders':
    'Cabeceras protegidas extra en JSON (kid es la habitual); alg y typ se añaden automáticamente.',
  'workbench.editors.request.auth.rowInfo.jwtExpiresIn':
    'Estampa iat y exp en la carga útil al firmar para que cada envío lleve una vida útil fresca.',
  'workbench.editors.request.auth.rowInfo.jwtAddTo':
    'Header envía el JWT en la cabecera Authorization; Query Params lo añade como token= en la URL.',
  'workbench.editors.request.auth.rowInfo.jwtHeaderPrefix':
    'El esquema delante del JWT en la cabecera Authorization \u2014 Bearer por defecto; vacío envía el token desnudo.',
  'workbench.editors.request.auth.typeInfo.awsSigV4':
    'La clave secreta firma el método, la ruta, la query, las cabeceras y el hash del cuerpo; la firma viaja en una cabecera Authorization: AWS4-HMAC-SHA256 con X-Amz-Date, o como parámetros de query X-Amz-* \u2014 nada secreto viaja.',
  'workbench.editors.request.auth.groupInfo.awsSigV4.credentials':
    'La access key viaja en Credential=, la secret key solo a través de la firma que calcula; el session token viaja como X-Amz-Security-Token para credenciales temporales.',
  'workbench.editors.request.auth.groupInfo.awsSigV4.signing':
    'El ámbito de credencial del que se deriva la clave de firma \u2014 servicio y región; deja cualquiera en blanco y se deduce del nombre de host de AWS (la región recae en us-east-1).',
  'workbench.editors.request.auth.groupInfo.awsSigV4.delivery':
    'Dónde aterriza la firma \u2014 la cabecera Authorization con X-Amz-Date, o parámetros de query X-Amz-* para endpoints que no aceptan cabeceras.',
  'workbench.editors.request.auth.rowInfo.awsAccessKey':
    'Identifica el par de claves \u2014 viaja en Credential= antes del ámbito.',
  'workbench.editors.request.auth.rowInfo.awsSecretKey':
    'El material de clave del que se deriva la clave de firma; nunca viaja.',
  'workbench.editors.request.auth.rowInfo.awsSessionToken':
    'El session token de STS \u2014 viaja como X-Amz-Security-Token, firmado, solo para credenciales temporales.',
  'workbench.editors.request.auth.rowInfo.awsService':
    'El servicio del ámbito de credencial (s3, execute-api, \u2026); en blanco se deduce del nombre de host de AWS. s3 firma además el hash del cuerpo como cabecera.',
  'workbench.editors.request.auth.rowInfo.awsRegion':
    'La región del ámbito de credencial; en blanco se deduce del nombre de host de AWS, si no us-east-1.',
  'workbench.editors.request.auth.rowInfo.awsAddTo':
    'Una cabecera (por defecto), o la query de la URL \u2014 la forma prefirmada para endpoints que no aceptan cabeceras.',
  'workbench.editors.request.auth.typeInfo.edgeGrid':
    'El client secret firma el método, el esquema, el host, la ruta, las cabeceras listadas y un hash del cuerpo POST; los tokens, una marca de tiempo y un nonce por envío, y la firma viajan en una cabecera Authorization: EG1-HMAC-SHA256 \u2014 el secreto nunca viaja.',
  'workbench.editors.request.auth.groupInfo.edgeGrid.credentials':
    'Los dos tokens viajan en la cabecera como client_token= y access_token=; el client secret solo a través de la firma que deriva.',
  'workbench.editors.request.auth.groupInfo.edgeGrid.signing':
    'Lo que la firma cubre más allá de la línea de solicitud \u2014 las cabeceras que nombra una API, en ese orden, y el hash del cuerpo POST acotado por la ventana de bytes (los 128 KiB del esquema salvo que la API indique otra cosa).',
  'workbench.editors.request.auth.rowInfo.edgeGridClientToken':
    'Identifica el cliente de la API \u2014 viaja como client_token=.',
  'workbench.editors.request.auth.rowInfo.edgeGridAccessToken':
    'Identifica la credencial \u2014 viaja como access_token=.',
  'workbench.editors.request.auth.rowInfo.edgeGridClientSecret':
    'El material de clave del que se deriva la clave de firma por envío; nunca viaja.',
  'workbench.editors.request.auth.rowInfo.edgeGridHeadersToSign':
    'Nombres de cabecera plegados en la firma, separados por comas, en orden de firma; una cabecera listada que la solicitud no lleva se omite y las no listadas nunca se firman.',
  'workbench.editors.request.auth.rowInfo.edgeGridMaxBodySize':
    'La ventana de bytes de un cuerpo POST que cubre el hash; en blanco = los 131072 del esquema.',
  'workbench.editors.request.auth.typeInfo.asap':
    'Se acuña un JWT nuevo en cada envío \u2014 emisor, audiencia y sujeto como claims, iat / exp del reloj, un nonce jti único \u2014 firmado con la clave privada bajo la cabecera kid y entregado como token bearer; la clave nunca viaja.',
  'workbench.editors.request.auth.groupInfo.asap.signing':
    'La familia asimétrica nombrada en la cabecera JWT, el id de clave con el que el receptor busca la clave pública, y la clave privada que firma.',
  'workbench.editors.request.auth.groupInfo.asap.token':
    'Lo que el token afirma \u2014 quién lo emitió, para quién, en nombre de quién, claims extra y cuánto vive (el techo de una hora del esquema por defecto).',
  'workbench.editors.request.auth.rowInfo.asapAlgorithm':
    'Nombra la familia de firma en la cabecera; el esquema no permite HS.',
  'workbench.editors.request.auth.rowInfo.asapKeyId':
    'Viaja como kid \u2014 emisor/nombre-de-clave según el esquema; el receptor obtiene la clave pública con él.',
  'workbench.editors.request.auth.rowInfo.asapPrivateKey':
    'El PEM (o la forma data:application/pkcs8 de Atlassian) que firma; nunca viaja.',
  'workbench.editors.request.auth.rowInfo.asapIssuer': 'El identificador de servicio registrado \u2014 viaja como iss.',
  'workbench.editors.request.auth.rowInfo.asapAudience':
    'Para quién es el token \u2014 viaja como aud; un array vía claims adicionales.',
  'workbench.editors.request.auth.rowInfo.asapSubject':
    'En nombre de quién \u2014 viaja como sub; en blanco envía el emisor.',
  'workbench.editors.request.auth.rowInfo.asapClaims':
    'Claims extra fusionados al final \u2014 ganan sobre todo claim compuesto, jti / iat / exp incluidos.',
  'workbench.editors.request.auth.rowInfo.asapExpiresIn':
    'La vida estampada como exp \u2212 iat; en blanco = 3600, el techo del esquema.',
  'workbench.editors.request.auth.typeInfo.httpSignature':
    'La petición se firma al enviarla (RFC 9421): se construye una base de firma con los componentes cubiertos — el método, el destino, las cabeceras nombradas, un Content-Digest del cuerpo — más los parámetros de firma, se firma con la clave y viaja en Signature-Input y Signature; la clave nunca viaja.',
  'workbench.editors.request.auth.groupInfo.httpSignature.signing':
    'El algoritmo registrado, el ID de clave con el que el verificador localiza la clave, y la clave que firma — una clave privada PEM, o el secreto compartido bajo hmac-sha256.',
  'workbench.editors.request.auth.groupInfo.httpSignature.coverage':
    'Lo que cubre la firma: los componentes en orden de firma — los derivados como @method y @target-uri, cabeceras por nombre — y si se genera un Content-Digest del cuerpo para cubrirlo.',
  'workbench.editors.request.auth.groupInfo.httpSignature.parameters':
    'Los metadatos @signature-params: la etiqueta que llevan ambas cabeceras, los instantes created / expires, un nonce por envío, el parámetro alg, un tag de aplicación.',
  'workbench.editors.request.auth.rowInfo.httpSigAlgorithm':
    'Uno de los seis algoritmos registrados; el verificador debe tener la clave correspondiente. rsa-pss-sha512 encabeza los ejemplos de la RFC.',
  'workbench.editors.request.auth.rowInfo.httpSigKeyId':
    'Viaja como keyid — el verificador obtiene la clave pública (o el secreto) por él. En blanco omite el parámetro.',
  'workbench.editors.request.auth.rowInfo.httpSigPrivateKey': 'El PEM que firma — PKCS#8, PKCS#1 o SEC1; nunca viaja.',
  'workbench.editors.request.auth.rowInfo.httpSigSecret':
    'El secreto compartido con el verificador — es la clave del HMAC; nunca viaja.',
  'workbench.editors.request.auth.rowInfo.httpSigSecretBase64':
    'El secreto es texto base64 — se decodifica a los bytes de clave antes de firmar.',
  'workbench.editors.request.auth.rowInfo.httpSigComponents':
    'Separados por espacios, en orden de firma: @method, @target-uri, @authority, @scheme, @request-target, @path, @query y nombres de cabecera. Una cabecera cubierta que la petición no lleva hace fallar el envío.',
  'workbench.editors.request.auth.rowInfo.httpSigContentDigest':
    'Genera Content-Digest sobre los bytes del cuerpo (RFC 9530) para que content-digest pueda cubrirse; un envío sin cuerpo resume el contenido vacío. Los cuerpos multipart no pueden resumirse.',
  'workbench.editors.request.auth.rowInfo.httpSigLabel':
    'La clave de diccionario bajo la que Signature-Input y Signature llevan esta firma; en blanco = sig1.',
  'workbench.editors.request.auth.rowInfo.httpSigCreated':
    'Escribe created = el instante de firma; los verificadores rechazan firmas caducadas con él. Desactivado omite el parámetro (y expires con él).',
  'workbench.editors.request.auth.rowInfo.httpSigExpiresIn':
    'Escribe expires = created + estos segundos; en blanco no escribe caducidad.',
  'workbench.editors.request.auth.rowInfo.httpSigNonce':
    'Escribe un nonce aleatorio por envío — la protección contra repetición de los verificadores que los registran.',
  'workbench.editors.request.auth.rowInfo.httpSigIncludeAlg':
    'Escribe alg con el algoritmo; desactivado lo deja a la clave que el verificador resuelve (el valor por defecto de la RFC).',
  'workbench.editors.request.auth.rowInfo.httpSigTag':
    'Un parámetro tag propio de la aplicación para distinguir firmas; en blanco lo omite.',
  'workbench.editors.request.auth.typeInfo.oauth2':
    'El cliente obtiene un token de acceso del proveedor \u2014 una autorización en el navegador y luego un intercambio de token, o un intercambio directo para las concesiones de máquina y contraseña \u2014 y cada envío lo lleva como token bearer, renovado al caducar si se emitió un token de renovación.',
  'workbench.editors.request.auth.groupInfo.oauth2.token':
    'El token que esta configuración tiene ahora mismo \u2014 lo que el envío lleva tras Bearer, y si se renueva solo.',
  'workbench.editors.request.auth.groupInfo.oauth2.grant':
    'Cómo se obtiene un token nuevo \u2014 la concesión, los endpoints del proveedor, la identidad del cliente y lo que se solicita.',
  'workbench.editors.request.auth.groupInfo.oauth2.advanced':
    'La etapa de renovación y los parámetros extra que lleva cada una de las tres solicitudes al proveedor.',
  'workbench.editors.request.auth.groupInfo.oauth2.signing':
    'El JWT que emite esta configuración — como aserción de cliente en cada solicitud de token, o como la propia concesión JWT bearer.',
  'workbench.editors.request.auth.rowInfo.oauth2Token':
    'El token de acceso que guardó el último flujo \u2014 enviado tras Bearer en cada envío; vacío hasta que se ejecute un flujo.',
  'workbench.editors.request.auth.rowInfo.oauth2TokenBinding':
    'DPoP (RFC 9449) vincula el token a un par de claves generado en el intercambio: cada solicitud de token y cada envío llevan una prueba firmada para el método y la URL de esa solicitud, el proveedor emite el token como DPoP y se envía bajo ese esquema — el prefijo del encabezado y el modo URL se apartan. La clave permanece junto al token almacenado, nunca en la configuración.',
  'workbench.editors.request.auth.rowInfo.oauth2DpopAlgorithm':
    'La familia de firma de la prueba — el par de claves se genera para coincidir. ES256 es lo que acepta todo despliegue DPoP.',
  'workbench.editors.request.auth.rowInfo.oauth2HeaderPrefix':
    'El esquema antes del token en la cabecera Authorization — vacío, se envía el token_type emitido por el proveedor (Bearer por defecto); definido, gana en el cable.',
  'workbench.editors.request.auth.rowInfo.oauth2AutoRefresh':
    'Un token de acceso caducado se renueva antes del envío — con el token de actualización si el proveedor emitió uno, o repitiendo una concesión que no necesita navegador.',
  'workbench.editors.request.auth.rowInfo.oauth2Status':
    'Cuánto sigue siendo válido el token guardado; Renovar lo intercambia ahora, Desconectar lo olvida.',
  'workbench.editors.request.auth.rowInfo.oauth2TokenName':
    'Una etiqueta para este token en la aplicación \u2014 nada en la red.',
  'workbench.editors.request.auth.rowInfo.oauth2GrantType':
    'El grant_type del intercambio de token y los pasos previos — una autorización en el navegador para las concesiones por código, ninguna para cliente, contraseña o JWT bearer.',
  'workbench.editors.request.auth.rowInfo.oauth2CallbackUrl':
    'El redirect_uri al que el proveedor devuelve el navegador con el código \u2014 regístrelo en el proveedor.',
  'workbench.editors.request.auth.rowInfo.oauth2AuthUrl':
    'El endpoint de autorización del proveedor al que se envía primero el navegador.',
  'workbench.editors.request.auth.rowInfo.oauth2DeviceAuthUrl':
    'El endpoint de autorización de dispositivo del proveedor (RFC 8628): devuelve el código de usuario y la URL de verificación que apruebas en cualquier dispositivo mientras este host sondea el endpoint de token.',
  'workbench.editors.request.auth.rowInfo.oauth2Issuer':
    'El identificador del emisor del proveedor, o su URL de metadatos /.well-known/. Descubrir lee el documento de metadatos (RFC 8414 / OpenID Connect Discovery), rellena las filas de endpoints de abajo y lista lo que el documento dice de tus elecciones — nada más cambia, y las filas siguen siendo tuyas después.',
  'workbench.editors.request.auth.rowInfo.oauth2AccessTokenUrl':
    'El endpoint de token del proveedor donde se intercambia el código (o las credenciales).',
  'workbench.editors.request.auth.rowInfo.oauth2Username':
    'El usuario del propietario del recurso, enviado en el cuerpo de la solicitud de token \u2014 solo la concesión por contraseña.',
  'workbench.editors.request.auth.rowInfo.oauth2Password':
    'La contraseña del propietario del recurso, enviada en el cuerpo de la solicitud de token \u2014 solo la concesión por contraseña.',
  'workbench.editors.request.auth.rowInfo.oauth2ClientId':
    'Identifica la aplicación \u2014 en la URL de autorización y en la solicitud de token.',
  'workbench.editors.request.auth.rowInfo.oauth2ClientSecret':
    'Autentica la aplicación en el endpoint de token \u2014 en el cuerpo, o como cabecera Basic según Autenticación de cliente.',
  'workbench.editors.request.auth.rowInfo.oauth2CodeChallengeMethod':
    'PKCE: el code_challenge en la URL de autorización es el resumen S256 de un verificador generado en cada flujo.',
  'workbench.editors.request.auth.rowInfo.oauth2CodeVerifier':
    'Generado en cada flujo y enviado como code_verifier en el intercambio de token para probar que lo inició el mismo cliente.',
  'workbench.editors.request.auth.rowInfo.oauth2Scope':
    'Los scopes solicitados \u2014 enviados separados por espacios como scope en la URL de autorización o en la solicitud de token.',
  'workbench.editors.request.auth.rowInfo.oauth2State':
    'Generado en cada flujo y devuelto por el proveedor para asociar la respuesta a esta autorización.',
  'workbench.editors.request.auth.rowInfo.oauth2ClientAuthentication':
    'Cómo se acredita el cliente en la solicitud de token — las credenciales en el cuerpo del formulario o en un encabezado Authorization: Basic, o un client_assertion firmado en lugar del secreto.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionIssuer':
    'El claim iss de la aserción de concesión — la cuenta de servicio o clave de consumidor registrada en el proveedor.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionSubject':
    'El claim sub opcional — el usuario en cuyo nombre actúa el token (delegación, suplantación); vacío no envía ninguno.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionClaims':
    'Claims adicionales fusionados en la aserción de concesión, con prioridad sobre los compuestos — claims del proveedor o un scope propio.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionAlgorithm':
    'La familia JWS que firma la aserción — asimétrica para la clave privada, HS256/384/512 para el secreto de cliente.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionKeyId':
    'El encabezado kid que nombra la clave registrada, para que el proveedor elija la mitad pública correcta.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionPrivateKey':
    'La clave de firma — PEM, DER en bruto o la forma data:application/pkcs8; nunca se exporta.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionAudience':
    'El claim aud — vacío envía la URL del token de acceso; FAPI y Keycloak esperan el identificador del emisor.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionLifetime':
    'exp menos iat, estampado al firmar — 300 segundos por defecto; el proveedor puede limitarlo (Google: una hora).',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionHeaders':
    'JSON de encabezados protegidos adicionales fusionado en la aserción — la huella de certificado x5t#S256 de Azure.',
  'workbench.editors.request.auth.rowInfo.oauth2RefreshTokenUrl':
    'El endpoint al que se envía el intercambio de renovación \u2014 vacío significa la URL del token de acceso.',
  'workbench.editors.request.auth.rowInfo.oauth2AuthRequest':
    'Parámetros extra añadidos a la URL de autorización (audience, prompt, \u2026).',
  'workbench.editors.request.auth.rowInfo.oauth2TokenRequest':
    'Parámetros extra de la solicitud de token \u2014 cada uno viaja en el cuerpo, una cabecera o la URL según su Enviar en.',
  'workbench.editors.request.auth.rowInfo.oauth2RefreshRequest':
    'Parámetros extra de la solicitud de renovación \u2014 cada uno viaja en el cuerpo, una cabecera o la URL según su Enviar en.',
  'workbench.editors.request.auth.rowInfo.oauth2SendAs':
    'Cabeceras de solicitud envía el token tras Bearer en la cabecera Authorization; URL de solicitud lo añade como access_token \u2014 obsoleto, solo para proveedores antiguos.',
  'workbench.editors.request.auth.type.inherit': 'Heredar la autenticación del padre',
  'workbench.editors.request.auth.type.none': 'Sin autenticación',
  'workbench.editors.request.auth.type.basic': 'Basic Auth',
  'workbench.editors.request.auth.type.bearer': 'Bearer Token',
  'workbench.editors.request.auth.type.apiKey': 'API Key',
  'workbench.editors.request.auth.type.oauth2': 'OAuth 2.0',
  'workbench.editors.request.auth.type.awsSigV4': 'AWS Signature v4',
  'workbench.editors.request.auth.type.edgeGrid': 'Akamai EdgeGrid',
  'workbench.editors.request.auth.type.asap': 'ASAP (Atlassian)',
  'workbench.editors.request.auth.type.digest': 'Digest Auth',
  'workbench.editors.request.auth.type.oauth1': 'OAuth 1.0',
  'workbench.editors.request.auth.type.hawk': 'Hawk Authentication',
  'workbench.editors.request.auth.type.jwtBearer': 'JWT Bearer',
  'workbench.editors.request.auth.type.httpSignature': 'Firma de mensaje HTTP',
  'workbench.editors.request.auth.oauth1ConsumerKey': 'Consumer Key',
  'workbench.editors.request.auth.oauth1ConsumerKeyPlaceholder': 'consumer key',
  'workbench.editors.request.auth.oauth1ConsumerSecret': 'Consumer Secret',
  'workbench.editors.request.auth.oauth1ConsumerSecretPlaceholder': 'consumer secret',
  'workbench.editors.request.auth.oauth1Token': 'Token de acceso',
  'workbench.editors.request.auth.oauth1TokenPlaceholder': 'opcional — vacío para llamadas one-legged',
  'workbench.editors.request.auth.oauth1TokenSecret': 'Token Secret',
  'workbench.editors.request.auth.oauth1TokenSecretPlaceholder': 'opcional — vacío para llamadas one-legged',
  'workbench.editors.request.auth.oauth1SignatureMethod': 'Método de firma',
  'workbench.editors.request.auth.oauth1PrivateKey': 'Clave privada',
  'workbench.editors.request.auth.oauth1PrivateKeyPlaceholder': '{{vault.private_key}} o PEM',
  'workbench.editors.request.auth.oauth1IncludeBodyHash': 'Incluir hash del cuerpo',
  'workbench.editors.request.auth.oauth1Realm': 'Realm',
  'workbench.editors.request.auth.oauth1RealmPlaceholder': 'opcional',
  'workbench.editors.request.auth.hawkAuthId': 'Hawk Auth ID',
  'workbench.editors.request.auth.hawkAuthIdPlaceholder': 'hawk auth id',
  'workbench.editors.request.auth.hawkAuthKey': 'Hawk Auth Key',
  'workbench.editors.request.auth.hawkAuthKeyPlaceholder': 'hawk auth key',
  'workbench.editors.request.auth.hawkAlgorithm': 'Algoritmo',
  'workbench.editors.request.auth.hawkExt': 'ext',
  'workbench.editors.request.auth.hawkExtPlaceholder': 'opcional — datos específicos de la aplicación',
  'workbench.editors.request.auth.hawkApp': 'app',
  'workbench.editors.request.auth.hawkAppPlaceholder': 'opcional — ID de la aplicación',
  'workbench.editors.request.auth.hawkDlg': 'dlg',
  'workbench.editors.request.auth.hawkDlgPlaceholder': 'opcional — ID de la aplicación delegante',
  'workbench.editors.request.auth.hawkIncludePayloadHash': 'Incluir hash del payload',
  'workbench.editors.request.auth.jwtAddTo': 'Añadir el token JWT a',
  'workbench.editors.request.auth.jwtAlgorithm': 'Algoritmo',
  'workbench.editors.request.auth.jwtSecret': 'Secreto',
  'workbench.editors.request.auth.jwtSecretPlaceholder': 'secreto',
  'workbench.editors.request.auth.jwtSecretBase64': 'Secreto codificado en Base64',
  'workbench.editors.request.auth.jwtPrivateKey': 'Clave privada',
  'workbench.editors.request.auth.jwtPrivateKeyPlaceholder': '{{vault.private_key}} o PEM',
  'workbench.editors.request.auth.jwtPayload': 'Payload',
  'workbench.editors.request.auth.jwtPayloadPlaceholder': '{}',
  'workbench.editors.request.auth.jwtHeaders': 'Cabeceras JWT',
  'workbench.editors.request.auth.jwtHeadersPlaceholder': '{}',
  'workbench.editors.request.auth.jwtHeadersNote': 'Las cabeceras específicas del algoritmo se añaden automáticamente.',
  'workbench.editors.request.auth.jwtHeaderPrefix': 'Prefijo de la cabecera',
  'workbench.editors.request.auth.jwtExpiresIn': 'Caduca en (segundos)',
  'workbench.editors.request.auth.jwtExpiresInPlaceholder': 'opcional',
  'workbench.editors.request.auth.jwtExpiresInNote':
    'Si se define, iat y exp se estampan en el payload al enviar. Los claims definidos en el payload ganan.',
  'workbench.editors.request.auth.digestBrowserNote':
    'Digest Auth responde al desafío del servidor con una segunda solicitud, que se ejecuta en la ' +
    'aplicación de escritorio y la CLI. Los envíos desde esta superficie salen sin ella — el servidor ' +
    'responde 401.',
  'workbench.editors.request.auth.digestRetryNote':
    'Por defecto, el desafío 401 se responde y la solicitud se reintenta automáticamente. ¿Quieres desactivarlo?',
  'workbench.editors.request.auth.digestDisableRetry': 'Sí, desactivar el reintento de la solicitud',
  'workbench.editors.request.auth.authAutoGeneratedNote':
    'El encabezado de autorización se generará automáticamente al enviar la solicitud.',
  'workbench.editors.request.auth.inheritNote':
    'El encabezado de autorización se generará automáticamente al enviar la solicitud.',
  'workbench.editors.request.auth.noneNote': 'Esta solicitud no usa ninguna autorización.',
  'workbench.editors.request.auth.inheritDetail':
    'Esta solicitud usa el asistente de autorización de su colección padre. Edita la pestaña Autorización ' +
    'de la colección para cambiarlo.',
  'workbench.editors.request.auth.inheritedNone':
    'Sin autorización — no hay nada configurado en la carpeta ni en la colección.',
  'workbench.editors.request.auth.sourceCollection': 'Colección «{name}»',
  'workbench.editors.request.auth.sourceFolder': 'Carpeta «{name}»',
  'workbench.editors.request.auth.groupInherited': 'Heredado',
  'workbench.editors.request.auth.refusalQualifier.inQuery': 'en consulta',
  'workbench.editors.request.auth.refusalQualifier.inHeader': 'en encabezado',
  'workbench.editors.request.auth.refusalQualifier.dpopBound': 'vinculado a una clave DPoP',
  'workbench.editors.request.auth.groupOwn': 'Esta solicitud',
  'workbench.editors.request.auth.optionMissingEntry': 'Entrada faltante',
  'workbench.editors.request.auth.danglingPick':
    'La entrada elegida por esta solicitud ya no existe — se aplica el predeterminado más cercano.',
  'workbench.editors.request.auth.editInParent': 'Editar en el elemento padre',
  'workbench.editors.request.auth.resetToInheritedAuth': 'Restablecer la autorización heredada',
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
  'workbench.editors.request.auth.awsServicePlaceholder': 'auto desde un host de AWS \u2014 p. ej. s3, execute-api',
  'workbench.editors.request.auth.awsRegionPlaceholder': 'auto desde un host de AWS, si no us-east-1',
  'workbench.editors.request.auth.edgeGridClientToken': 'Client Token',
  'workbench.editors.request.auth.edgeGridAccessToken': 'Access Token',
  'workbench.editors.request.auth.edgeGridClientSecret': 'Client Secret',
  'workbench.editors.request.auth.edgeGridHeadersToSign': 'Cabeceras a firmar',
  'workbench.editors.request.auth.edgeGridMaxBodySize': 'Tamaño máx. del cuerpo',
  'workbench.editors.request.auth.edgeGridClientTokenPlaceholder': 'p. ej. akab-client-token-xxx',
  'workbench.editors.request.auth.edgeGridAccessTokenPlaceholder': 'p. ej. akab-access-token-xxx',
  'workbench.editors.request.auth.edgeGridClientSecretPlaceholder': 'client secret',
  'workbench.editors.request.auth.edgeGridHeadersToSignPlaceholder':
    'opcional \u2014 separadas por comas, p. ej. X-Test1, X-Test2',
  'workbench.editors.request.auth.edgeGridMaxBodySizePlaceholder': '131072',
  'workbench.editors.request.auth.asapAlgorithm': 'Algoritmo',
  'workbench.editors.request.auth.asapKeyId': 'ID de clave',
  'workbench.editors.request.auth.asapPrivateKey': 'Clave privada',
  'workbench.editors.request.auth.asapIssuer': 'Emisor',
  'workbench.editors.request.auth.asapAudience': 'Audiencia',
  'workbench.editors.request.auth.asapSubject': 'Sujeto',
  'workbench.editors.request.auth.asapClaims': 'Claims adicionales',
  'workbench.editors.request.auth.asapExpiresIn': 'Expiración (segundos)',
  'workbench.editors.request.auth.asapKeyIdPlaceholder': 'p. ej. my-service/key-1',
  'workbench.editors.request.auth.asapPrivateKeyPlaceholder':
    '-----BEGIN PRIVATE KEY----- \u2026 o la forma data:application/pkcs8',
  'workbench.editors.request.auth.asapIssuerPlaceholder': 'p. ej. my-service',
  'workbench.editors.request.auth.asapAudiencePlaceholder': 'p. ej. api.openheaders.io',
  'workbench.editors.request.auth.asapSubjectPlaceholder': 'opcional \u2014 en blanco envía el emisor',
  'workbench.editors.request.auth.asapClaimsPlaceholder': 'opcional \u2014 JSON, p. ej. {"scope":"read"}',
  'workbench.editors.request.auth.asapExpiresInPlaceholder': '3600',
  'workbench.editors.request.auth.httpSigAlgorithm': 'Algoritmo',
  'workbench.editors.request.auth.httpSigKeyId': 'ID de clave',
  'workbench.editors.request.auth.httpSigPrivateKey': 'Clave privada',
  'workbench.editors.request.auth.httpSigSecret': 'Secreto compartido',
  'workbench.editors.request.auth.httpSigSecretBase64': 'El secreto está codificado en base64',
  'workbench.editors.request.auth.httpSigComponents': 'Componentes cubiertos',
  'workbench.editors.request.auth.httpSigContentDigest': 'Content Digest',
  'workbench.editors.request.auth.httpSigDigestNone': 'Ninguno',
  'workbench.editors.request.auth.httpSigLabel': 'Etiqueta',
  'workbench.editors.request.auth.httpSigCreated': 'Marca de tiempo created',
  'workbench.editors.request.auth.httpSigExpiresIn': 'Expira tras (segundos)',
  'workbench.editors.request.auth.httpSigNonce': 'Nonce',
  'workbench.editors.request.auth.httpSigIncludeAlg': 'Parámetro de algoritmo (alg)',
  'workbench.editors.request.auth.httpSigTag': 'Tag',
  'workbench.editors.request.auth.httpSigKeyIdPlaceholder': 'p. ej. my-service-key-1',
  'workbench.editors.request.auth.httpSigPrivateKeyPlaceholder': '-----BEGIN PRIVATE KEY----- (PEM)',
  'workbench.editors.request.auth.httpSigSecretPlaceholder': 'el secreto compartido con el verificador',
  'workbench.editors.request.auth.httpSigLabelPlaceholder': 'sig1',
  'workbench.editors.request.auth.httpSigExpiresInPlaceholder': 'opcional — p. ej. 300',
  'workbench.editors.request.auth.httpSigTagPlaceholder': 'opcional — un tag de aplicación',
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
  'workbench.editors.request.oauth.tokenLabel': 'Token',
  'workbench.editors.request.oauth.noTokenPlaceholder': 'Aún no hay token — usa Obtener un token de acceso nuevo abajo',
  'workbench.editors.request.oauth.headerPrefix': 'Prefijo del encabezado',
  'workbench.editors.request.oauth.tokenBinding': 'Vinculación del token',
  'workbench.editors.request.oauth.tokenBindingNone': 'Ninguna (bearer)',
  'workbench.editors.request.oauth.tokenBindingDpop': 'DPoP',
  'workbench.editors.request.oauth.dpopAlgorithm': 'Algoritmo de la prueba',
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
  'workbench.editors.request.oauth.noTokenNote':
    'Aún no hay token — ejecuta un flujo abajo para obtener uno. Para un token emitido fuera de banda, usa la autenticación Bearer Token.',
  'workbench.editors.request.oauth.authorizeBrowserInfoSummary':
    'El inicio de sesión se abre en tu navegador predeterminado — conserva tu sesión con el proveedor, tu gestor de contraseñas y tus passkeys, y los proveedores de identidad bloquean los inicios de sesión incrustados en aplicaciones (RFC 8252).',
  'workbench.editors.request.oauth.authorizeBrowserInfoDetail':
    'El proveedor devuelve el navegador a la URL de retorno en el puerto del backend de la aplicación — cambiar el puerto en Ajustes cambia la URL a registrar.',
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
    'Cómo se acredita el cliente en los POST de token — id y secreto en el cuerpo o en un encabezado Basic, o un JWT firmado con una clave privada (private_key_jwt) o con el secreto (client_secret_jwt).',
  'workbench.editors.request.oauth.clientAuthBody': 'Enviar las credenciales del cliente en el cuerpo',
  'workbench.editors.request.oauth.clientAuthBasicHeader': 'Enviar como encabezado Basic Auth',
  'workbench.editors.request.oauth.clientAuthPrivateKeyJwt': 'Enviar un JWT firmado (private_key_jwt)',
  'workbench.editors.request.oauth.clientAuthClientSecretJwt': 'Enviar un JWT HMAC (client_secret_jwt)',
  'workbench.editors.request.oauth.assertionIssuer': 'Emisor',
  'workbench.editors.request.oauth.assertionIssuerPlaceholder': 'p. ej. service-account@openheaders.com',
  'workbench.editors.request.oauth.assertionSubject': 'Sujeto',
  'workbench.editors.request.oauth.assertionSubjectPlaceholder': 'opcional — el usuario en cuyo nombre actúa el token',
  'workbench.editors.request.oauth.assertionClaims': 'Claims adicionales',
  'workbench.editors.request.oauth.assertionClaimsPlaceholder': 'opcional — JSON, p. ej. {"box_sub_type":"enterprise"}',
  'workbench.editors.request.oauth.assertionAlgorithm': 'Algoritmo',
  'workbench.editors.request.oauth.assertionKeyId': 'ID de clave',
  'workbench.editors.request.oauth.assertionKeyIdPlaceholder': 'opcional — el encabezado kid, p. ej. key-1',
  'workbench.editors.request.oauth.assertionPrivateKey': 'Clave privada',
  'workbench.editors.request.oauth.assertionPrivateKeyPlaceholder':
    '-----BEGIN PRIVATE KEY----- … (PEM, o la forma data:application/pkcs8)',
  'workbench.editors.request.oauth.assertionAudience': 'Audiencia',
  'workbench.editors.request.oauth.assertionAudiencePlaceholder': 'vacío = la URL del token de acceso',
  'workbench.editors.request.oauth.assertionLifetime': 'Vigencia (segundos)',
  'workbench.editors.request.oauth.assertionHeaders': 'Encabezados adicionales',
  'workbench.editors.request.oauth.assertionHeadersPlaceholder': 'opcional — JSON, p. ej. {"x5t#S256":"…"}',
  'workbench.editors.request.oauth.advancedIntro':
    'Aquí puedes añadir personalizaciones más específicas a tus solicitudes OAuth2.',
  'workbench.editors.request.oauth.advancedLearnMore': 'Más información sobre la configuración',
  'workbench.editors.request.oauth.refreshTokenUrl': 'URL de renovación del token',
  'workbench.editors.request.oauth.refreshTokenUrlDesc':
    'La mayoría de los proveedores reutilizan la URL del token de acceso para renovar; indica una distinta ' +
    'solo cuando el proveedor exponga una ruta propia.',
  'workbench.editors.request.oauth.sendInColumn': 'Enviar en',
  'workbench.editors.request.oauth.sendInBody': 'Cuerpo',
  'workbench.editors.request.oauth.sendInHeader': 'Cabecera',
  'workbench.editors.request.oauth.sendInUrl': 'URL',
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
  'workbench.editors.request.oauth.deviceAuthUrl': 'URL de autorización de dispositivo',
  'workbench.editors.request.oauth.deviceWaitingTitle': 'Esperando tu aprobación en {host}',
  'workbench.editors.request.oauth.deviceWaitingDesc':
    'Abre el enlace en cualquier dispositivo, introduce el código y aprueba. Esta página se actualiza sola.',
  'workbench.editors.request.oauth.deviceCode': 'Código',
  'workbench.editors.request.oauth.deviceOpen': 'Abrir',
  'workbench.editors.request.oauth.deviceCancel': 'Cancelar',
  'workbench.editors.request.oauth.deviceExpiresIn': 'Caduca en {duration}',
  'workbench.editors.request.oauth.deviceCheckEvery': 'Comprobando cada {seconds} s',
  'workbench.editors.request.oauth.toast.deviceStarted': 'OAuth: aprueba en {host} con el código {code}',
  'workbench.editors.request.oauth.toast.deviceGranted': 'OAuth: autorización de dispositivo aprobada',
  'workbench.editors.request.oauth.toast.deviceDenied': 'OAuth: la autorización fue rechazada — {error}',
  'workbench.editors.request.oauth.toast.deviceExpired': 'OAuth: el código de dispositivo caducó — {error}',
  'workbench.editors.request.oauth.toast.deviceFailed': 'Error en la autorización de dispositivo OAuth: {error}',
  'workbench.editors.request.oauth.toast.deviceCancelled': 'OAuth: autorización de dispositivo cancelada',
  'workbench.editors.request.oauth.toast.codeCopied': 'Código copiado',
  'workbench.editors.request.oauth.issuerUrl': 'URL del emisor',
  'workbench.editors.request.oauth.issuerUrlPlaceholder':
    'https://accounts.example.com — o la URL de metadatos /.well-known/…',
  'workbench.editors.request.oauth.discover': 'Descubrir',
  'workbench.editors.request.oauth.toast.discovered': 'OAuth: endpoints descubiertos',
  'workbench.editors.request.oauth.toast.discoveryFailed': 'Fallo en el descubrimiento: {error}',
  'workbench.editors.request.oauth.discoveryTitle': 'Descubierto desde {url}',
  'workbench.editors.request.oauth.discoveryFilled': 'Rellenado: {rows}',
  'workbench.editors.request.oauth.discoveryFilledNone': 'El documento no nombra ningún endpoint — nada rellenado',
  'workbench.editors.request.oauth.discoveryListed': '{pick} figura en la lista del proveedor',
  'workbench.editors.request.oauth.discoveryUnlisted':
    '{pick} no figura en la lista — el proveedor anuncia {supported}',
  'workbench.editors.request.oauth.discoveryPickClientAuth': 'La autenticación de cliente {value}',
  'workbench.editors.request.oauth.discoveryPickGrant': 'El grant {value}',
  'workbench.editors.request.oauth.discoveryPickPkce': 'PKCE {value}',
  'workbench.editors.request.oauth.discoveryPickDpop': 'El algoritmo DPoP {value}',
  'workbench.editors.request.oauth.discoveryPickAssertionAlg': 'El algoritmo de la aserción {value}',
  'workbench.editors.request.oauth.discoveryAudience':
    'El identificador del emisor es {issuer} — algunos proveedores lo esperan como Audience de la aserción en lugar de la URL del token de acceso',
  'workbench.editors.request.oauth.discoveryScopes': 'Scopes ofrecidos: {supported} — sugeridos en la fila Scope',

  // ── Body tab (encoding radios + format labels stay raw) ────────────
  'workbench.editors.request.body.noBody': 'Esta solicitud no tiene cuerpo',
  'workbench.editors.request.body.modeNoneInfo':
    'La solicitud se envía sin carga útil — sin bytes de cuerpo y sin cabecera Content-Type.',
  'workbench.editors.request.body.modeFormDataInfo':
    'Envía las partes como una sola carga útil multipart/form-data — cada fila es un campo de texto o un ' + 'archivo.',
  'workbench.editors.request.body.modeFormDataDescription':
    'El Content-Type con delimitador se genera al enviar; un Content-Type multipart puesto a mano se ' +
    'reemplaza para que el delimitador siempre coincida con la carga útil.',
  'workbench.editors.request.body.modeFormUrlencodedInfo':
    'Envía los campos como pares clave=valor codificados en porcentaje con un Content-Type ' +
    'application/x-www-form-urlencoded. Las filas desactivadas permanecen en el editor pero nunca llegan ' +
    'al cable.',
  'workbench.editors.request.body.modeRawInfo':
    'Envía el contenido del editor tal cual — los bytes en el cable son exactamente lo que escribiste.',
  'workbench.editors.request.body.modeRawDescription':
    'El selector de formato controla el resaltado de sintaxis y el Content-Type por defecto ' +
    '(application/json, application/xml, text/plain, text/javascript, text/html); un Content-Type definido ' +
    'en la pestaña Headers gana.',
  'workbench.editors.request.body.modeGraphqlInfo':
    'Envía la consulta y las variables como una sola carga útil application/json — { query, variables } — ' +
    'según el transporte HTTP de GraphQL.',
  'workbench.editors.request.body.modeGraphqlDescription':
    'Las variables deben ser JSON válido; un panel de variables no analizable se omite del cuerpo enviado ' +
    'y la consulta va sola.',
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
  'workbench.editors.request.scripts.preRequest': 'Antes de la solicitud',
  'workbench.editors.request.scripts.postResponse': 'Después de la respuesta',
  'workbench.editors.request.scripts.preInfoTitle': 'Script antes de la solicitud',
  'workbench.editors.request.scripts.preInfoSummary':
    'Se ejecuta una vez antes de que la solicitud salga. Reescribe la URL, las cabeceras, los parámetros ' +
    'y el cuerpo con la API oh.',
  'workbench.editors.request.scripts.postInfoTitle': 'Script después de la respuesta',
  'workbench.editors.request.scripts.postInfoSummary':
    'Se ejecuta una vez cuando llega la respuesta. Lee el estado, las cabeceras y el cuerpo; los ' +
    'resultados de las aserciones aterrizan en el panel Respuesta.',
  'workbench.editors.request.scripts.apiHeading': 'API',
  'workbench.editors.request.scripts.apiSetHeader': 'añadir o reemplazar un encabezado',
  'workbench.editors.request.scripts.apiSetQueryParam': 'añadir o reemplazar un parámetro de consulta',
  'workbench.editors.request.scripts.apiSetUrl': 'reescribir la URL de destino',
  'workbench.editors.request.scripts.apiSetBody': 'reemplazar el cuerpo de la solicitud',
  'workbench.editors.request.scripts.apiRequire': 'cargar un paquete de scripts de la biblioteca de paquetes',
  'workbench.editors.request.scripts.apiTest': 'registrar una aserción',
  'workbench.editors.request.scripts.runsAfter': 'Se ejecuta después de {count} scripts:',
  'workbench.editors.request.scripts.runsAfterOne': 'Se ejecuta después de 1 script:',
  'workbench.editors.request.scripts.prePlaceholderContainer':
    'Escribe scripts que se ejecuten antes de enviar cada solicitud HTTP.',
  'workbench.editors.request.scripts.postPlaceholderContainer':
    'Escribe scripts que se ejecuten al final de cada respuesta HTTP.',
  'workbench.editors.request.scripts.prePlaceholder': 'Usa JavaScript para modificar esta solicitud antes de enviarla.',
  'workbench.editors.request.scripts.postPlaceholder':
    'Usa JavaScript para probar y leer esta respuesta cuando llegue.',
  // ── Session script slots (gRPC · WebSocket · MQTT) ─────────────────
  'workbench.editors.request.scripts.grpcBeforeInvoke': 'Antes de invocar',
  'workbench.editors.request.scripts.grpcOnMessage': 'Al recibir mensaje',
  'workbench.editors.request.scripts.grpcAfterResponse': 'Después de la respuesta',
  'workbench.editors.request.scripts.wsBeforeConnect': 'Antes de conectar',
  'workbench.editors.request.scripts.wsBeforeSend': 'Antes de enviar',
  'workbench.editors.request.scripts.wsOnMessage': 'Al recibir mensaje',
  'workbench.editors.request.scripts.wsAfterClose': 'Después de cerrar',
  'workbench.editors.request.scripts.mqttBeforeConnect': 'Antes de conectar',
  'workbench.editors.request.scripts.mqttBeforePublish': 'Antes de publicar',
  'workbench.editors.request.scripts.mqttOnMessage': 'Al recibir mensaje',
  'workbench.editors.request.scripts.mqttAfterClose': 'Después de cerrar',
  'workbench.editors.request.scripts.grpcBeforeInvokePlaceholder':
    'Usa JavaScript para modificar los metadatos y el mensaje antes de invocar esta llamada.',
  'workbench.editors.request.scripts.grpcOnMessagePlaceholder':
    'Usa JavaScript para leer cada trama de mensaje cuando llegue.',
  'workbench.editors.request.scripts.grpcAfterResponsePlaceholder':
    'Usa JavaScript para probar y leer la respuesta cuando termine esta llamada.',
  'workbench.editors.request.scripts.wsBeforeConnectPlaceholder':
    'Usa JavaScript para modificar el handshake antes de que esta sesión se conecte.',
  'workbench.editors.request.scripts.wsBeforeSendPlaceholder':
    'Usa JavaScript para modificar o descartar cada mensaje antes de enviarlo.',
  'workbench.editors.request.scripts.wsOnMessagePlaceholder':
    'Usa JavaScript para reaccionar a cada mensaje cuando llegue.',
  'workbench.editors.request.scripts.wsAfterClosePlaceholder':
    'Usa JavaScript para probar y leer esta sesión después de cerrarse.',
  'workbench.editors.request.scripts.mqttBeforeConnectPlaceholder':
    'Usa JavaScript para modificar el CONNECT antes de que esta sesión se conecte.',
  'workbench.editors.request.scripts.mqttBeforePublishPlaceholder':
    'Usa JavaScript para modificar o descartar cada mensaje antes de publicarlo.',
  'workbench.editors.request.scripts.mqttOnMessagePlaceholder':
    'Usa JavaScript para reaccionar a cada mensaje cuando llegue.',
  'workbench.editors.request.scripts.mqttAfterClosePlaceholder':
    'Usa JavaScript para probar y leer esta sesión después de desconectarse.',
  'workbench.editors.request.scripts.grpcBeforeInvokePlaceholderContainer':
    'Escribe scripts que se ejecuten antes de invocar cada llamada gRPC.',
  'workbench.editors.request.scripts.grpcOnMessagePlaceholderContainer':
    'Escribe scripts que se ejecuten en cada trama de mensaje gRPC.',
  'workbench.editors.request.scripts.grpcAfterResponsePlaceholderContainer':
    'Escribe scripts que se ejecuten al final de cada llamada gRPC.',
  'workbench.editors.request.scripts.wsBeforeConnectPlaceholderContainer':
    'Escribe scripts que se ejecuten antes de que cada sesión WebSocket se conecte.',
  'workbench.editors.request.scripts.wsBeforeSendPlaceholderContainer':
    'Escribe scripts que se ejecuten antes de enviar cada mensaje WebSocket.',
  'workbench.editors.request.scripts.wsOnMessagePlaceholderContainer':
    'Escribe scripts que se ejecuten en cada mensaje WebSocket recibido.',
  'workbench.editors.request.scripts.wsAfterClosePlaceholderContainer':
    'Escribe scripts que se ejecuten después de cerrarse cada sesión WebSocket.',
  'workbench.editors.request.scripts.mqttBeforeConnectPlaceholderContainer':
    'Escribe scripts que se ejecuten antes de que cada sesión MQTT se conecte.',
  'workbench.editors.request.scripts.mqttBeforePublishPlaceholderContainer':
    'Escribe scripts que se ejecuten antes de publicar cada mensaje MQTT.',
  'workbench.editors.request.scripts.mqttOnMessagePlaceholderContainer':
    'Escribe scripts que se ejecuten en cada mensaje MQTT recibido.',
  'workbench.editors.request.scripts.mqttAfterClosePlaceholderContainer':
    'Escribe scripts que se ejecuten después de desconectarse cada sesión MQTT.',
  'workbench.editors.request.scripts.grpcBeforeInvokeInfoTitle': 'Script antes de invocar',
  'workbench.editors.request.scripts.grpcBeforeInvokeInfoSummary':
    'Se ejecuta una vez antes de invocar la llamada. Reescribe los metadatos y el mensaje de solicitud con la API oh; oh.session lleva el estado a los siguientes hooks de la llamada.',
  'workbench.editors.request.scripts.grpcOnMessageInfoTitle': 'Script al recibir mensaje',
  'workbench.editors.request.scripts.grpcOnMessageInfoSummary':
    'Se ejecuta en cada trama de mensaje que captura la llamada, en ambas direcciones, después de la captura. Lee el mensaje decodificado; la captura nunca se retrasa.',
  'workbench.editors.request.scripts.grpcAfterResponseInfoTitle': 'Script después de la respuesta',
  'workbench.editors.request.scripts.grpcAfterResponseInfoSummary':
    'Se ejecuta cuando termina la llamada. Lee el estado, los encabezados, los trailers y los mensajes; los resultados de las aserciones aterrizan en el panel de respuesta.',
  'workbench.editors.request.scripts.wsBeforeConnectInfoTitle': 'Script antes de conectar',
  'workbench.editors.request.scripts.wsBeforeConnectInfoSummary':
    'Se ejecuta en cada intento de conexión, reconexiones incluidas. Reescribe la URL, los encabezados, los parámetros y los subprotocolos con la API oh; un fallo se registra y la conexión sigue sin cambios.',
  'workbench.editors.request.scripts.wsBeforeSendInfoTitle': 'Script antes de enviar',
  'workbench.editors.request.scripts.wsBeforeSendInfoSummary':
    'Se ejecuta antes de cada mensaje que envías. Reescribe o descarta el mensaje saliente; las tramas de heartbeat y de protocolo nunca pasan por aquí.',
  'workbench.editors.request.scripts.wsOnMessageInfoTitle': 'Script al recibir mensaje',
  'workbench.editors.request.scripts.wsOnMessageInfoSummary':
    'Se ejecuta en cada mensaje recibido, después de la captura. Reacciona: responde con oh.send, guarda estado en oh.session, registra aserciones.',
  'workbench.editors.request.scripts.wsAfterCloseInfoTitle': 'Script después de cerrar',
  'workbench.editors.request.scripts.wsAfterCloseInfoSummary':
    'Se ejecuta cuando termina la sesión, si llegó a abrirse. Lee el registro de cierre y los contadores de la sesión; los resultados de las aserciones aterrizan en el panel de sesión.',
  'workbench.editors.request.scripts.mqttBeforeConnectInfoTitle': 'Script antes de conectar',
  'workbench.editors.request.scripts.mqttBeforeConnectInfoSummary':
    'Se ejecuta en cada intento de conexión, reconexiones incluidas. Reescribe el id de cliente, las credenciales, el testamento y las suscripciones con la API oh; un fallo se registra y la conexión sigue sin cambios.',
  'workbench.editors.request.scripts.mqttBeforePublishInfoTitle': 'Script antes de publicar',
  'workbench.editors.request.scripts.mqttBeforePublishInfoSummary':
    'Se ejecuta antes de cada mensaje que publicas. Reescribe el tema, la carga útil, la QoS, la marca retain y las propiedades, o descarta la publicación.',
  'workbench.editors.request.scripts.mqttOnMessageInfoTitle': 'Script al recibir mensaje',
  'workbench.editors.request.scripts.mqttOnMessageInfoSummary':
    'Se ejecuta en cada mensaje recibido, después de la captura. Reacciona: responde con oh.publish, guarda estado en oh.session, registra aserciones.',
  'workbench.editors.request.scripts.mqttAfterCloseInfoTitle': 'Script después de cerrar',
  'workbench.editors.request.scripts.mqttAfterCloseInfoSummary':
    'Se ejecuta cuando termina la sesión, si llegó a abrirse. Lee el registro de fin, el CONNACK y los contadores de la sesión; los resultados de las aserciones aterrizan en el panel de sesión.',

  // ── Settings tab — wired knobs ─────────────────────────────────────
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
    'incluidos los autofirmados y caducados.',
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
  'workbench.editors.request.settings.tlsCipherSuitesExample':
    'p. ej. TLS_AES_256_GCM_SHA384:ECDHE-RSA-AES128-GCM-SHA256',
  'workbench.editors.request.settings.maxRedirectsPlaceholder': '20 saltos (por defecto)',
  'workbench.editors.request.settings.maxRedirectsHops': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} salto', many: '{count} saltos', other: '{count} saltos' }),
  'workbench.editors.request.settings.responseSizeLimitPlaceholder': '2 MB (por defecto)',
  'workbench.editors.request.settings.resetToDefault': 'Restablecer los valores por defecto',
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
  'workbench.editors.request.settings.resolveToAddressExample': 'p. ej. 10.0.0.12 o 2001:db8::1',
  'workbench.editors.request.settings.sni': 'Nombre de servidor SNI',
  'workbench.editors.request.settings.sniInfo':
    'Nombre de servidor presentado en el handshake TLS en lugar del host de la URL: una pasarela que sirve varios nombres de host en una sola dirección, o un certificado emitido para un nombre que el DNS no resuelve. Vacío envía el host de la URL.',
  'workbench.editors.request.settings.sniPlaceholder': 'Auto — el host de la URL',
  'workbench.editors.request.settings.sniExample': 'p. ej. api.openheaders.com',
  'workbench.editors.request.settings.clientCertificate': 'Certificado de cliente (mTLS)',
  'workbench.editors.request.settings.clientCertificateInfo':
    'Presenta un certificado de cliente durante el handshake TLS — TLS mutuo (mTLS) — para APIs detrás de pasarelas de TLS ' +
    'mutuo que autentican al llamante por certificado. Elige una entrada de certificado del vault — la ' +
    'solicitud guarda solo el nombre de la entrada, y cada dispositivo presenta su propia entrada del vault ' +
    'con ese nombre; el certificado y la clave nunca salen del vault. Déjalo vacío para conectar sin ' +
    'certificado de cliente.',
  'workbench.editors.request.settings.clientCertificatePlaceholder': 'Sin certificado de cliente',
  'workbench.editors.request.settings.clientCertificateEmpty':
    'Aún no hay entradas de certificado de cliente en el vault de este dispositivo.',
  'workbench.editors.request.settings.vaultManageCertificates': 'Gestionar certificados en el vault',
  'workbench.editors.request.settings.clientCertificateDangling':
    'No hay ninguna entrada de certificado del vault llamada «{name}» en este dispositivo — los envíos ' +
    'fallarán hasta que la entrada exista o se borre este ajuste.',
  'workbench.editors.request.settings.proxy': 'Proxy',
  'workbench.editors.request.settings.proxySummary':
    'Cómo alcanza la red este envío. Por defecto hereda el entorno del dispositivo que lo ejecuta — ' +
    'ajustes de proxy del sistema, PAC o variables de entorno de proxy — así el proxy impuesto en una ' +
    'máquina corporativa simplemente funciona; Directo excluye solo esta solicitud de cualquier proxy ' +
    'ambiental, y URL personalizada la enruta por un proxy propio.',
  'workbench.editors.request.settings.proxyDescription':
    'Los metadatos de la respuesta siempre registran la ruta que el envío tomó realmente — qué proxy, y si ' +
    'lo decidió la solicitud o el entorno. Se admiten proxys HTTP(S) y SOCKS5 — una URL socks5:// funciona ' +
    'como proxy personalizado y como respuesta del entorno; solo la familia SOCKS4 recibe un error claro ' +
    'que la nombra.',
  'workbench.editors.request.settings.proxyModesHeading': 'Modos',
  'workbench.editors.request.settings.proxyModePlaceholder': 'Heredar — el entorno decide',
  'workbench.editors.request.settings.proxyModeDirect': 'Directo — sin proxy',
  'workbench.editors.request.settings.proxyModeCustom': 'URL personalizada',
  'workbench.editors.request.settings.proxyModeInheritDesc':
    'El entorno del dispositivo que ejecuta decide por URL — un proxy donde la máquina tenga uno ' +
    'configurado, directo en caso contrario. Un proxy heredado se retira para los envíos que fijan HTTP/3, ' +
    'marcan un socket local o resuelven a una dirección fija.',
  'workbench.editors.request.settings.proxyModeDirectDesc':
    'Nunca un proxy para esta solicitud, diga lo que diga el entorno de la máquina.',
  'workbench.editors.request.settings.proxyModeCustomDesc':
    'Túnel por la URL de proxy propia de esta solicitud — sincronizada con la solicitud, la misma ruta en ' +
    'cada dispositivo.',
  'workbench.editors.request.settings.proxyUrl': 'URL del proxy',
  'workbench.editors.request.settings.proxyUrlInfo':
    'Enruta esta solicitud por este proxy HTTP(S). La conexión al destino atraviesa el proxy en túnel, así ' +
    'que un intercambio https sigue cifrado de extremo a extremo y la verificación del certificado sigue ' +
    "ejecutándose contra el destino. Las credenciales van en el ajuste 'Credenciales del proxy' de abajo, " +
    'nunca en esta URL.',
  'workbench.editors.request.settings.proxyUrlPlaceholder': 'http://proxy.example:8080',
  'workbench.editors.request.settings.proxyUrlMissing':
    'El modo URL personalizada necesita una URL de proxy — introduce una, o vuelve al otro modo.',
  'workbench.editors.request.settings.proxyError':
    'Solo URL http://, https:// o socks5:// con host y puerto — sin credenciales en la URL.',
  'workbench.editors.request.settings.proxyUrlExample': 'p. ej. http://127.0.0.1:8080 o socks5://127.0.0.1:1080',
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
  'workbench.editors.request.settings.proxyCredentialsEmpty':
    'Aún no hay entradas de cadena en el vault de este dispositivo.',
  'workbench.editors.request.settings.vaultManageCredentials': 'Gestionar credenciales en el vault',
  'workbench.editors.request.settings.proxyCredentialsDangling':
    'No hay ninguna entrada de texto del vault llamada «{name}» en este dispositivo — los envíos fallarán ' +
    'hasta que la entrada exista o se borre este ajuste.',
  // ── Bloque de resiliencia de sesión (WebSocket / Socket.IO / MQTT) ──
  'workbench.editors.request.settings.autoReconnect': 'Reconectar automáticamente',
  'workbench.editors.request.settings.autoReconnectInfo':
    'Reabre la sesión cuando una conexión abierta se cae — socket cortado, cierre del servidor, tiempo de inactividad agotado — volviendo a marcar cada periodo de reconexión hasta que abra de nuevo o desconectes. Una primera conexión que falla nunca reintenta. Desactivado por defecto.',
  'workbench.editors.request.settings.reconnectPeriod': 'Periodo de reconexión',
  'workbench.editors.request.settings.reconnectPeriodInfo':
    'Espera entre intentos de reconexión. Vacío usa los 5 s por defecto.',
  'workbench.editors.request.settings.reconnectPeriodPlaceholder': '5 s (por defecto)',
  'workbench.editors.request.settings.reconnectMaxAttempts': 'Intentos de reconexión',
  'workbench.editors.request.settings.reconnectMaxAttemptsInfo':
    'Tope de intentos de reconexión consecutivos tras una caída — una reconexión que abre reinicia la cuenta; un tope agotado termina la sesión como Reconexión abandonada. Vacío sigue intentando hasta que el servidor vuelva o desconectes.',
  'workbench.editors.request.settings.reconnectMaxAttemptsPlaceholder': 'Sin límite (por defecto)',
  'workbench.editors.request.settings.reconnectBackoff': 'Espera exponencial',
  'workbench.editors.request.settings.reconnectBackoffInfo':
    'Duplica la espera tras cada intento fallido — el periodo, luego 2×, 4× … hasta 60 s — con una pequeña variación aleatoria para que los clientes nunca reconecten al unísono. Activado por defecto; desactivado, cada intento espera exactamente el periodo.',
  'workbench.editors.request.settings.idleTimeout': 'Tiempo de inactividad',
  'workbench.editors.request.settings.idleTimeoutInfo':
    'Cierra la conexión como perdida cuando no llega nada durante este tiempo — la comprobación de vida que un cliente no puede hacer con un frame ping. Con Reconectar automáticamente activado, la sesión vuelve a marcar. Vacío no fija ningún plazo de inactividad.',
  'workbench.editors.request.settings.idleTimeoutSocketioInfo':
    'Cierra la conexión como perdida cuando no llega nada durante este tiempo. Con Reconectar automáticamente activado, la sesión vuelve a marcar. Vacío sigue el handshake del servidor — un ping toca cada pingInterval y puede retrasarse pingTimeout, la regla del cliente oficial.',
  'workbench.editors.request.settings.idleTimeoutPlaceholder': 'Desactivado (por defecto)',
  'workbench.editors.request.settings.idleTimeoutSocketioPlaceholder': 'Cadencia de ping del servidor (por defecto)',
  'workbench.editors.request.settings.heartbeatMessage': 'Mensaje de latido',
  'workbench.editors.request.settings.heartbeatMessageInfo':
    'Un frame de texto enviado en cada intervalo de latido para mantener viva una sesión inactiva a través de balanceadores y proxies — lo que tu servidor espere. Ningún cliente WebSocket puede enviar un frame ping de protocolo, así que el keepalive es un mensaje de aplicación; se captura como cualquier frame enviado. Se admiten plantillas. Vacío no envía latido.',
  'workbench.editors.request.settings.heartbeatMessagePlaceholder': 'Sin latido',
  'workbench.editors.request.settings.heartbeatMessageExample': 'p. ej. ping o {"type":"ping"}',
  'workbench.editors.request.settings.heartbeatInterval': 'Intervalo de latido',
  'workbench.editors.request.settings.heartbeatIntervalInfo':
    'Espera entre mensajes de latido. Vacío usa los 30 s por defecto — por debajo del corte de inactividad de 60 s que aplican la mayoría de balanceadores.',
  'workbench.editors.request.settings.heartbeatIntervalPlaceholder': '30 s (por defecto)',
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
  'workbench.editors.request.settings.unixSocketExample': 'p. ej. /var/run/docker.sock',
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
  'workbench.editors.request.settings.maxMessageSize': 'Tamaño máx. de mensaje',
  'workbench.editors.request.settings.maxMessageSizeInfo':
    'Mensaje entrante más grande que acepta la sesión. Un mensaje que supera el límite nunca se captura: la sesión se cierra con el código 1009 (Message Too Big) nombrando ambos tamaños, y la reconexión automática no la reabre — lo pidió el cliente. Déjalo vacío para no aplicar límite por solicitud; el runtime de escritorio ensambla mensajes de hasta 128 MB, el navegador no impone límite.',
  'workbench.editors.request.settings.maxMessageSizePlaceholder': 'Sin límite (predeterminado)',
  'workbench.editors.request.settings.followRedirectsWsInfo':
    'Sigue una respuesta 3xx al handshake y marca su Location — la forma en que una pasarela de autenticación rebota los upgrades. Desactivado por defecto, la regla del propio estándar WebSocket: un handshake redirigido falla nombrando la redirección. Se aplica cuando la sesión se ejecuta en la app de escritorio o el servidor; los navegadores nunca siguen.',
  'workbench.editors.request.settings.maxRedirectsWsInfo':
    'Cuántas redirecciones del handshake puede seguir una conexión antes de fallar con un error que nombra el límite. Déjalo vacío para el valor predeterminado de 20.',
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
  'workbench.editors.request.settings.managed.browserStore': 'Almacén del navegador',
  'workbench.editors.request.settings.managed.about20': '~20',
  'workbench.editors.request.settings.managed.notSent': 'No se envía',
  'workbench.editors.request.settings.managed.offered': 'Ofrecida',
  'workbench.editors.request.settings.managed.none': 'Ninguna',
  'workbench.editors.request.settings.managed.never': 'Nunca',
  'workbench.editors.request.settings.managed.websocketOnly': 'Solo WebSocket',
  'workbench.editors.request.settings.managed.http2': 'HTTP/2',
  'workbench.editors.request.settings.managed.compression': 'Compresión',
  'workbench.editors.request.settings.managed.compressionWsDesc':
    'permessage-deflate se ofrece en cada handshake y el servidor decide si las tramas se comprimen; la fila Conectado muestra lo negociado. La oferta no puede retenerse por solicitud.',
  'workbench.editors.request.settings.managed.compressionGrpcDesc':
    'Los mensajes salen sin comprimir y no se negocia ningún grpc-encoding; una trama comprimida del servidor se muestra como comprimida, no decodificada.',
  'workbench.editors.request.settings.managed.transport': 'Transporte',
  'workbench.editors.request.settings.managed.transportSocketioDesc':
    'La sesión marca directamente el transporte WebSocket, saltándose el handshake HTTP de long-polling con el que empieza el cliente oficial antes de hacer el upgrade.',
  'workbench.editors.request.settings.managed.httpVersionGrpcDesc':
    'gRPC viaja solo sobre HTTP/2: los canales TLS negocian h2 mediante ALPN, los canales en texto claro hablan h2 con conocimiento previo.',
  'workbench.editors.request.settings.managed.connectionReuse': 'Reutilización de conexión',
  'workbench.editors.request.settings.managed.onePerCall': 'Una por llamada',
  'workbench.editors.request.settings.managed.connectionReuseGrpcDesc':
    'Cada llamada abre su propia conexión HTTP/2 y la cierra al terminar; nada se agrupa ni se mantiene vivo entre llamadas, así que un keepalive solo corre mientras hay una llamada abierta.',
  'workbench.editors.request.settings.managed.followRedirectsBrowserDesc':
    'El navegador nunca sigue un handshake redirigido; una respuesta 3xx hace fallar la conexión. Ejecuta la sesión en la app de escritorio o el servidor para seguir redirecciones.',
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
  'workbench.editors.request.response.meta.noteRequestHeadersNode':
    'Los encabezados de solicitud cuentan solo lo que definió este envío; el entorno de ejecución añade ' +
    'los suyos (Host, Accept-Encoding, …).',
  'workbench.editors.request.response.meta.noteTruncatedAtCap':
    'Cuerpo truncado en el límite de tamaño de respuesta de {cap}; el tamaño completo se contabiliza.',
  'workbench.editors.request.response.meta.noteTruncated':
    'Vista del cuerpo truncada; el tamaño completo se contabiliza.',
  'workbench.editors.request.response.meta.noteBodyApproximate':
    'El tamaño del cuerpo de la solicitud es aproximado — el boundary multipart lo genera el navegador.',
  'workbench.editors.request.response.meta.noteWireHidden':
    'Tamaños en el cable (comprimido, transferido) ocultos: el servidor no envió Timing-Allow-Origin.',
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
  'workbench.editors.request.response.meta.tlsProtocol': 'Protocolo TLS',
  'workbench.editors.request.response.meta.tlsCipher': 'Nombre del cifrado',
  'workbench.editors.request.response.meta.tlsCertificate': 'CN del certificado',
  'workbench.editors.request.response.meta.tlsIssuer': 'CN del emisor',
  'workbench.editors.request.response.meta.tlsValidUntil': 'Válido hasta',
  'workbench.editors.request.response.meta.tlsUnverifiedVerdict': 'Certificado no verificado ({code})',
  'workbench.editors.request.response.meta.trustPinned':
    'Certificado fijado en este dispositivo — vuelve a enviar para verificar.',
  'workbench.editors.request.response.meta.noteNoTls':
    'La dirección local y los detalles de TLS y del certificado no se exponen al código de extensiones en ' +
    'Chromium.',
  'workbench.editors.request.response.meta.tlsSelfSigned': 'Certificado autofirmado',
  'workbench.editors.request.response.meta.tlsUnverified': 'Certificado no verificado',
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
  'workbench.editors.request.response.meta.authTitle': 'Autorización',
  'workbench.editors.request.response.meta.authSummaryRequest':
    'Enviado con la configuración {type} propia de la solicitud.',
  'workbench.editors.request.response.meta.authSummaryInherited': '{type} — heredado de {source}.',
  'workbench.editors.request.response.meta.authSummaryNone':
    'Enviado sin autorización — no hay nada configurado por encima de la solicitud.',
  'workbench.editors.request.response.meta.authDangling':
    'La entrada elegida por la solicitud ya no existe — se aplicó el predeterminado en su lugar.',
  'workbench.editors.request.response.meta.scriptsTag': 'Scripts · {count}',
  'workbench.editors.request.response.meta.scriptsTitle': 'Cadena de scripts',
  'workbench.editors.request.response.meta.scriptsSummary':
    'Todos los niveles de la cadena se ejecutaron correctamente: los scripts de la colección y de la carpeta antes de los de la propia solicitud, tanto en pre-solicitud como en post-respuesta. Registrado a partir de lo que la ejecución hizo realmente.',
  'workbench.editors.request.response.meta.scriptsSummaryFailed':
    'Un nivel de la cadena falló: las filas siguientes indican cuál y por qué.',
  'workbench.editors.request.response.meta.scriptsLevelRequest': 'Solicitud',
  'workbench.editors.request.response.meta.scriptsDuration': '{ms} ms',
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
  'workbench.editors.request.response.meta.proxyTag': 'Vía proxy',
  'workbench.editors.request.response.meta.proxyTitle': 'Ruta del proxy',
  'workbench.editors.request.response.meta.proxySummaryRequest':
    'Esta ejecución pasó en túnel por el proxy definido en la configuración de la propia solicitud — ' +
    'registrado a partir de lo que el envío hizo realmente.',
  'workbench.editors.request.response.meta.proxySummarySystem':
    'Esta ejecución pasó en túnel por el proxy que nombra el sistema del dispositivo que la ejecuta — ' +
    'registrado a partir de lo que la ejecución hizo realmente, nunca una lectura en vivo de los ajustes.',
  'workbench.editors.request.response.meta.proxyRowUrl': 'Proxy',
  'workbench.editors.request.response.meta.proxyRowSource': 'Decidido por',
  'workbench.editors.request.response.meta.proxySourceRequest': 'Configuración de la solicitud',
  'workbench.editors.request.response.meta.proxySourceDevice': 'Ajustes de proxy del dispositivo',
  'workbench.editors.request.response.meta.proxySourceEnv': 'Variables de entorno',
  'workbench.editors.request.response.meta.proxySourceSystem': 'Ajustes de proxy del sistema',
  'workbench.editors.request.response.meta.proxySourceManual': 'Configuración manual del proxy',
  'workbench.editors.request.response.meta.proxySourcePac': 'Script PAC',
  'workbench.editors.request.response.meta.proxyStandDownTag': 'Proxy omitido',
  'workbench.editors.request.response.meta.proxyStandDownTitle': 'El proxy del sistema se retiró',
  'workbench.editors.request.response.meta.proxyStandDownUnixSocket':
    'El sistema nombra un proxy, pero esta ejecución apunta a un socket local que un túnel de proxy no ' +
    'puede marcar — continuó en directo.',
  'workbench.editors.request.response.meta.proxyStandDownResolveToAddress':
    'El sistema nombra un proxy, pero esta ejecución fija su propia resolución de dirección, que un proxy ' +
    'sobrescribiría — continuó en directo.',
  'workbench.editors.request.response.meta.proxyStandDownHttpVersion3':
    'El sistema nombra un proxy, pero esta ejecución está fijada a HTTP/3, que marca su propia vía QUIC — ' +
    'continuó en directo.',
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
  'workbench.editors.request.response.body.limitHint': 'El límite se ajusta en los ajustes de Solicitudes API.',
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
  'workbench.editors.spec.tab': 'Spec',
  'workbench.editors.spec.noSpecs': 'Todavía no hay ninguna especificación {format} en este espacio de trabajo.',
  'workbench.editors.spec.goToSpecs': 'Ir a Especificaciones',
  'workbench.editors.timelineViewer.format': 'Formato del mensaje',
  'workbench.editors.timelineViewer.showMessage': 'Mostrar el mensaje',
  'workbench.editors.timelineViewer.showHexdump': 'Mostrar el volcado hexadecimal',
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
  'workbench.editors.request.response.console.preRequest': 'Antes de la solicitud',
  'workbench.editors.request.response.console.postResponse': 'Después de la respuesta',

  // ── Response empty / error states (executor error text stays raw) ──
  'workbench.editors.request.response.empty.sending': 'Enviando la solicitud…',
  'workbench.editors.request.response.empty.prompt': 'Envía la solicitud para ver aquí la respuesta.',
  'workbench.editors.request.response.error.title': 'No se pudo enviar la solicitud',
  'workbench.editors.request.response.error.openInTab': 'Abrir en una pestaña nueva',
  'workbench.editors.request.response.error.trust.title': 'Confiar en el certificado que presentó {origin}',
  'workbench.editors.request.response.error.trust.probing': 'Leyendo el certificado que presenta el servidor…',
  'workbench.editors.request.response.error.trust.probeFailed':
    'No se pudo leer el certificado del servidor: {message}',
  'workbench.editors.request.response.error.trust.retryProbe': 'Reintentar',
  'workbench.editors.request.response.error.trust.failure': 'Fallo',
  'workbench.editors.request.response.error.trust.noAnchor':
    'El servidor no presenta su certificado raíz, así que nada de esto se puede fijar. Añade la CA emisora en Ajustes › Peticiones API › TLS.',
  'workbench.editors.request.response.error.trust.trustOnDevice': 'Confiar en este dispositivo',
  'workbench.editors.request.response.error.trust.addToWorkspace': 'Añadir al espacio de trabajo',
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
  'workbench.editors.request.scripts.apiConnect':
    'la conexión tal como se compuso — URL, cabeceras, parámetros, subprotocolos, intento',
  'workbench.editors.request.scripts.apiSetSubprotocols': 'reemplazar la oferta de subprotocolos',
  'workbench.editors.request.scripts.apiMessage': 'el mensaje — texto, tipo de trama, índice de captura',
  'workbench.editors.request.scripts.apiSetMessage': 'reemplazar el texto saliente',
  'workbench.editors.request.scripts.apiSetEvent': 'renombrar el evento Socket.IO',
  'workbench.editors.request.scripts.apiDrop': 'descartar el mensaje — nada llega a la red',
  'workbench.editors.request.scripts.apiSend': 'enviar una trama de texto a la sesión',
  'workbench.editors.request.scripts.apiSendBinary': 'enviar una trama binaria (base64)',
  'workbench.editors.request.scripts.apiEmit': 'emitir un evento Socket.IO',
  'workbench.editors.request.scripts.apiClose': 'el registro de cierre — código, motivo, recuentos, duración',
  'workbench.editors.request.scripts.apiSession': 'estado compartido por cada hook de esta sesión',
  'workbench.editors.request.scripts.apiMqttConnect':
    'el CONNECT tal como se compuso — client id, credenciales, testamento, suscripciones, propiedades de usuario, intento',
  'workbench.editors.request.scripts.apiSetClientId': 'reemplazar el client id',
  'workbench.editors.request.scripts.apiSetUsername': 'reemplazar el nombre de usuario',
  'workbench.editors.request.scripts.apiSetPassword': 'reemplazar la contraseña',
  'workbench.editors.request.scripts.apiSetWill': 'reemplazar el testamento (null no registra ninguno)',
  'workbench.editors.request.scripts.apiAddSubscription': 'suscribir un filtro de tema al abrir',
  'workbench.editors.request.scripts.apiSetUserProperty': 'definir una propiedad de usuario 5.0',
  'workbench.editors.request.scripts.apiMqttMessage': 'el mensaje — tema, carga útil, QoS, retain, índice de captura',
  'workbench.editors.request.scripts.apiSetTopic': 'redirigir la publicación',
  'workbench.editors.request.scripts.apiSetPayload': 'reemplazar la carga útil (texto, o bytes base64)',
  'workbench.editors.request.scripts.apiSetQos': 'definir la QoS',
  'workbench.editors.request.scripts.apiSetRetain': 'definir el indicador RETAIN',
  'workbench.editors.request.scripts.apiPublish': 'publicar un mensaje en la sesión',
  'workbench.editors.request.scripts.apiMqttClose':
    'el registro de cierre — cómo terminó, el CONNACK, los conteos, la duración',
  'workbench.editors.request.scripts.apiInvoke':
    'la llamada tal como se compuso — destino, método, forma de llamada, metadatos, texto del mensaje',
  'workbench.editors.request.scripts.apiSetMetadata': 'establecer un par de metadatos',
  'workbench.editors.request.scripts.apiRemoveMetadata': 'quitar un par de metadatos',
  'workbench.editors.request.scripts.apiGrpcSetMessage': 'reemplazar el texto del mensaje (JSON)',
  'workbench.editors.request.scripts.apiGrpcMessage':
    'el frame capturado — dirección, tipo, el mensaje decodificado, índice de captura',
  'workbench.editors.request.scripts.apiGrpcResponse':
    'el registro de cierre — estado, metadatos, trailers, conteos en ambas direcciones, duración',
} as const satisfies Catalog;
