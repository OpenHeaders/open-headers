/**
 * Shared info-popover corpus — HTTP status codes — Spanish. Mirrors
 * `catalogs/en/shared-info-status.ts` key for key; codes and canonical
 * reason phrases stay raw — only prose translates. Mints: e.g. =
 * p. ej.; gateway = pasarela; rate limit = límite de peticiones;
 * captive portal = portal cautivo; upstream server = servidor de
 * origen (amont).
 */

import type { Catalog } from '../../types';

export const sharedInfoStatus = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.status.kicker': 'Estado HTTP · {range}',
  'shared.info.status.undocumented':
    'Este código exacto no está documentado en nuestro registro — el rango de arriba da su significado estándar.',
  'shared.info.status.serverPhrase': 'El servidor envió la frase de motivo «{statusText}».',

  // ── Range kickers + fallback summaries ─────────────────────────────
  'shared.info.status.range1xx.kicker': '1xx Informativo',
  'shared.info.status.range1xx.fallback':
    'Respuesta provisional — el intercambio sigue en curso y después llega un estado final.',
  'shared.info.status.range2xx.kicker': '2xx Éxito',
  'shared.info.status.range2xx.fallback': 'La solicitud fue recibida, entendida y aceptada.',
  'shared.info.status.range3xx.kicker': '3xx Redirección',
  'shared.info.status.range3xx.fallback':
    'Hace falta una acción adicional para completar la solicitud — mira el encabezado de respuesta Location.',
  'shared.info.status.range4xx.kicker': '4xx Error del cliente',
  'shared.info.status.range4xx.fallback':
    'El servidor rechazó la solicitud tal como se envió — algo en la solicitud tiene que cambiar.',
  'shared.info.status.range5xx.kicker': '5xx Error del servidor',
  'shared.info.status.range5xx.fallback':
    'El servidor no logró satisfacer una solicitud aparentemente válida — el fallo está del lado del servidor.',
  'shared.info.status.rangeOther.kicker': 'No estándar',
  'shared.info.status.rangeOther.fallback': 'Este código está fuera de los rangos de estado HTTP estándar.',

  // ── Curated codes ──────────────────────────────────────────────────
  'shared.info.status.s100.summary':
    'Respuesta provisional — el servidor recibió los encabezados de la solicitud y el cliente debería enviar ' +
    'el cuerpo.',
  'shared.info.status.s101.summary':
    'El servidor aceptó cambiar de protocolo como se pidió mediante el encabezado Upgrade (p. ej. a WebSocket).',
  'shared.info.status.s102.summary':
    'Respuesta WebDAV provisional — el servidor aceptó la solicitud pero aún no la ha completado.',
  'shared.info.status.s103.summary':
    'Respuesta provisional que porta encabezados (típicamente precargas Link) por delante de la respuesta final.',
  'shared.info.status.s200.summary': 'La solicitud tuvo éxito y la respuesta lleva el resultado en su cuerpo.',
  'shared.info.status.s201.summary': 'La solicitud tuvo éxito y se creó un recurso nuevo.',
  'shared.info.status.s201.body': 'El encabezado de respuesta Location suele apuntar al recurso nuevo.',
  'shared.info.status.s202.summary':
    'La solicitud fue aceptada para procesarse, pero el procesamiento no ha terminado.',
  'shared.info.status.s202.body':
    'Común en trabajos asíncronos — el resultado hay que recuperarlo después, a menudo mediante una URL de ' +
    'estado en el cuerpo.',
  'shared.info.status.s203.summary':
    'La respuesta tuvo éxito pero fue modificada por un proxy transformador entre el servidor y el cliente.',
  'shared.info.status.s204.summary': 'La solicitud tuvo éxito y deliberadamente no hay cuerpo de respuesta.',
  'shared.info.status.s204.body': 'Aquí se espera una pestaña Body vacía, no es un error.',
  'shared.info.status.s205.summary':
    'La solicitud tuvo éxito y el cliente debería restablecer la vista que la envió (p. ej. vaciar el formulario).',
  'shared.info.status.s206.summary':
    'El servidor devolvió solo el rango de bytes pedido mediante el encabezado de solicitud Range.',
  'shared.info.status.s206.body': 'Content-Range describe qué porción del recurso completo es este cuerpo.',
  'shared.info.status.s207.summary':
    'Respuesta WebDAV por lotes — el cuerpo lleva un estado separado para cada suboperación.',
  'shared.info.status.s208.summary': 'WebDAV — este miembro ya fue listado antes en la misma respuesta multiestado.',
  'shared.info.status.s226.summary':
    'La respuesta es un diff (manipulación de instancia) respecto a una versión anterior, no el recurso completo.',
  'shared.info.status.s300.summary': 'Hay más de una representación disponible y el servidor no elige ninguna.',
  'shared.info.status.s301.summary': 'El recurso se movió permanentemente a la URL del encabezado Location.',
  'shared.info.status.s301.body':
    'Los clientes y las cachés lo recuerdan; actualiza la URL de la solicitud a la dirección nueva.',
  'shared.info.status.s302.summary': 'El recurso está temporalmente en la URL del encabezado Location.',
  'shared.info.status.s302.body':
    'Los navegadores suelen reescribir el método a GET al seguirla — usa 307 para conservar el método.',
  'shared.info.status.s303.summary': 'El resultado vive en la URL de Location y debería recuperarse con GET.',
  'shared.info.status.s303.body': 'Típico tras un POST, redirigiendo a la página creada o resultante.',
  'shared.info.status.s304.summary': 'La copia en caché sigue siendo válida — el servidor no envió cuerpo a propósito.',
  'shared.info.status.s304.body':
    'Se envía en respuesta a solicitudes condicionales (If-None-Match / If-Modified-Since).',
  'shared.info.status.s305.summary':
    'Obsoleto — el recurso debe accederse a través del proxy de Location. Los clientes modernos lo ignoran.',
  'shared.info.status.s307.summary':
    'Temporalmente en la URL de Location; el método y el cuerpo deben conservarse al seguirla.',
  'shared.info.status.s308.summary':
    'Permanentemente en la URL de Location; el método y el cuerpo deben conservarse al seguirla.',
  'shared.info.status.s400.summary': 'El servidor no pudo analizar ni aceptar la solicitud tal como se envió.',
  'shared.info.status.s400.body':
    'Comprueba la sintaxis del cuerpo, los parámetros de consulta y los encabezados requeridos — el cuerpo de ' +
    'la respuesta suele nombrar el campo problemático.',
  'shared.info.status.s401.summary': 'La solicitud carece de credenciales de autenticación válidas.',
  'shared.info.status.s401.body':
    'El encabezado de respuesta WWW-Authenticate nombra el esquema esperado. Comprueba la pestaña ' +
    'Authorization y la vigencia del token.',
  'shared.info.status.s402.summary': 'Código reservado, usado por algunas API para límites de cuota o facturación.',
  'shared.info.status.s403.summary':
    'El servidor entendió la solicitud y las credenciales, pero se niega a permitirla.',
  'shared.info.status.s403.body':
    'A diferencia del 401, volver a autenticarse no ayudará — esta identidad no tiene permiso para este recurso.',
  'shared.info.status.s404.summary': 'No existe ningún recurso en esta URL (o el servidor oculta si existe).',
  'shared.info.status.s404.body':
    'Comprueba la ruta y los IDs que contiene; algunas API también devuelven 404 en lugar de 403 para no ' +
    'revelar la existencia.',
  'shared.info.status.s405.summary': 'El recurso existe, pero no para este método HTTP.',
  'shared.info.status.s405.body': 'El encabezado de respuesta Allow lista los métodos que esta URL acepta.',
  'shared.info.status.s406.summary':
    'El servidor no puede producir una representación que coincida con los encabezados Accept de la solicitud.',
  'shared.info.status.s407.summary':
    'Un proxy entre tú y el servidor exige credenciales (Proxy-Authenticate nombra el esquema).',
  'shared.info.status.s408.summary': 'El servidor dejó de esperar el resto de la solicitud y cerró el intercambio.',
  'shared.info.status.s409.summary': 'La solicitud entra en conflicto con el estado actual del recurso.',
  'shared.info.status.s409.body':
    'Típico de ediciones concurrentes o creaciones duplicadas — vuelve a leer el recurso y reintenta.',
  'shared.info.status.s410.summary': 'El recurso existía, pero fue eliminado intencionada y permanentemente.',
  'shared.info.status.s411.summary':
    'El servidor exige un encabezado Content-Length y rechaza los cuerpos chunked o sin tamaño.',
  'shared.info.status.s412.summary':
    'Un encabezado condicional (If-Match, If-Unmodified-Since, …) no se cumplió, así que el servidor se negó ' +
    'a actuar.',
  'shared.info.status.s413.summary': 'El cuerpo de la solicitud excede lo que el servidor acepta.',
  'shared.info.status.s414.summary':
    'La URL de la solicitud excede el límite del servidor — normalmente datos de query string que deberían ir ' +
    'en un cuerpo.',
  'shared.info.status.s415.summary': 'El servidor rechaza el formato del cuerpo.',
  'shared.info.status.s415.body': 'Comprueba el encabezado de solicitud Content-Type frente a lo que la API espera.',
  'shared.info.status.s416.summary': 'El encabezado de solicitud Range pide bytes fuera del recurso.',
  'shared.info.status.s417.summary':
    'El servidor no puede satisfacer el encabezado de solicitud Expect (típicamente Expect: 100-continue).',
  'shared.info.status.s418.summary': 'Código RFC de April Fools; algunas API lo usan como negativa en tono de broma.',
  'shared.info.status.s421.summary':
    'La solicitud llegó a un servidor que no está configurado para responder por esta autoridad (común con ' +
    'conexiones HTTP/2 reutilizadas).',
  'shared.info.status.s422.summary':
    'El cuerpo es sintácticamente válido pero semánticamente incorrecto — la validación falló.',
  'shared.info.status.s422.body': 'El cuerpo de la respuesta suele listar los errores de validación por campo.',
  'shared.info.status.s423.summary': 'WebDAV — el recurso está bloqueado por otra operación.',
  'shared.info.status.s424.summary': 'WebDAV — esta acción falló porque falló una acción anterior de la que dependía.',
  'shared.info.status.s425.summary':
    'El servidor se niega a procesar una solicitud que podría reproducirse (datos TLS tempranos).',
  'shared.info.status.s426.summary':
    'El servidor insiste en un protocolo distinto — el encabezado de respuesta Upgrade lo nombra.',
  'shared.info.status.s428.summary':
    'El servidor exige un encabezado condicional (normalmente If-Match) para evitar actualizaciones perdidas.',
  'shared.info.status.s429.summary': 'Límite de peticiones alcanzado — reduce el ritmo.',
  'shared.info.status.s429.body':
    'El encabezado de respuesta Retry-After (cuando está presente) dice cuánto esperar; muchas API envían ' +
    'también encabezados RateLimit-*.',
  'shared.info.status.s431.summary':
    'Un encabezado de solicitud (o todos juntos) excede el límite de tamaño del servidor — a menudo una cookie ' +
    'demasiado grande.',
  'shared.info.status.s451.summary':
    'El servidor deniega el acceso por motivos legales (censura, orden judicial, retirada por RGPD).',
  'shared.info.status.s500.summary':
    'El servidor encontró una condición inesperada — el fallo está del lado del servidor.',
  'shared.info.status.s500.body':
    'Reintentar puede funcionar si el fallo es transitorio; si no, el arreglo está en los registros del ' +
    'servidor, no en la solicitud.',
  'shared.info.status.s501.summary':
    'El servidor no admite la funcionalidad requerida — a menudo un método no reconocido.',
  'shared.info.status.s502.summary': 'Una pasarela o proxy recibió una respuesta no válida del servidor de origen.',
  'shared.info.status.s502.body': 'El origen detrás del proxy está fallando o no responde — normalmente transitorio.',
  'shared.info.status.s503.summary':
    'El servidor no puede atender la solicitud temporalmente (sobrecarga o mantenimiento).',
  'shared.info.status.s503.body': 'Retry-After (cuando está presente) dice cuándo volver a intentarlo.',
  'shared.info.status.s504.summary': 'Una pasarela o proxy agotó el tiempo esperando al servidor de origen.',
  'shared.info.status.s505.summary': 'El servidor rechaza la versión del protocolo HTTP usada en la solicitud.',
  'shared.info.status.s506.summary':
    'Configuración errónea del servidor en la negociación de contenido — la variante elegida se negocia a sí ' +
    'misma.',
  'shared.info.status.s507.summary': 'WebDAV — el servidor no puede almacenar lo que la solicitud requiere.',
  'shared.info.status.s508.summary': 'WebDAV — el servidor encontró un bucle infinito al procesar la solicitud.',
  'shared.info.status.s510.summary':
    'La solicitud necesita una extensión adicional para que el servidor pueda satisfacerla.',
  'shared.info.status.s511.summary':
    'La red (típicamente un portal cautivo) exige autenticación antes de conceder el acceso.',
} as const satisfies Catalog;
