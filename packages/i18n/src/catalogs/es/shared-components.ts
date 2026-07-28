/**
 * Shared component families — Spanish. Mirrors
 * `catalogs/en/shared-components.ts` key for key; see that file for the
 * family rules and the raw-by-design technical plane. Mints: stale =
 * obsoleta; override (Live) = sustitución; mock verbs = simular; dock
 * rides raw (m.); JWT Header/Payload/Claims ride raw (RFC 7519
 * structure vocabulary, fr precedent).
 */

import type { Catalog } from '../../types';

export const sharedComponents = {
  // ── TemplateInput field chrome ─────────────────────────────────────
  'shared.templateInput.editValue': 'Editar el valor',
  'shared.templateInput.showValue': 'Mostrar el valor',
  'shared.templateInput.hideValue': 'Ocultar el valor',
  'shared.templateInput.clearValue': 'Borrar el valor',
  'shared.templateInput.unresolvedDot': 'Contiene una variable sin resolver',

  // ── Suggestion popover ─────────────────────────────────────────────
  'shared.templateInput.createNamed': 'Crear la variable «{name}»',
  'shared.templateInput.createNamedInScope': 'Crear la variable «{name}» en {scope}',
  'shared.templateInput.noMatches': 'Sin coincidencias',
  'shared.templateInput.footerNavigate': '↑↓ navegar',
  'shared.templateInput.footerSelect': '↵ seleccionar',
  'shared.templateInput.footerClose': 'esc cerrar',

  // ── Suggestion rows (previews + badges) ────────────────────────────
  'shared.templateInput.capturedAtRuntime': 'Capturada en tiempo de ejecución',
  'shared.templateInput.totpPreview': 'TOTP de {digits} dígitos · {period}s',
  'shared.templateInput.totpPreviewIssuer': 'TOTP de {digits} dígitos · {period}s · {issuer}',
  'shared.templateInput.emptyValue': '(vacío)',
  'shared.templateInput.staleBadge': 'obsoleta',
  'shared.templateInput.needsRerunBadge': 'requiere reejecución',
  'shared.templateInput.disabledBadge': 'desactivada',
  'shared.templateInput.scaffold.vault': 'Añadir un secreto',
  'shared.templateInput.scaffold.env': 'Añadir una variable de entorno',
  'shared.templateInput.scaffold.collection': 'Añadir una variable de colección',
  'shared.templateInput.scaffold.workspace': 'Añadir una variable de espacio de trabajo',
  'shared.templateInput.scaffold.dynamic': 'Generadores integrados — uuid, timestamp, …',
  'shared.templateInput.reservedFile': 'Referencias de archivo próximamente',

  // ── Variable hover / create popover ────────────────────────────────
  'shared.templateInput.enterValue': 'Introducir un valor',
  'shared.templateInput.foundIn': 'Encontrada en:',
  'shared.templateInput.scopeFixedTooltip':
    'El ámbito lo fija el prefijo {prefix} — edita la referencia para cambiarlo.',
  'shared.templateInput.addToScope': 'Añadir a: {scope}',
  'shared.templateInput.addToPickScope': 'Añadir a: elegir ámbito',
  'shared.templateInput.resolvedDefault': 'Resuelta: por defecto',
  'shared.templateInput.resolvedDefaultNoEnv': 'Resuelta: por defecto (sin env activo)',
  'shared.templateInput.noActiveEnvHint':
    'No hay ningún entorno seleccionado — elige uno en el selector de entornos para añadir una variable de ' +
    'entorno.',
  'shared.templateInput.noCollectionHint':
    'No hay colección activa — abre una colección para añadir una variable de colección.',

  // Resolved-scope labels (badge line in the hover popover).
  'shared.templateInput.scope.vault': 'Vault',
  'shared.templateInput.scope.vaultTotp': 'Vault · TOTP',
  'shared.templateInput.scope.environmentNamed': 'Entorno · {name}',
  'shared.templateInput.scope.collectionNamed': 'Colección · {name}',
  'shared.templateInput.scope.workspace': 'Espacio de trabajo',
  'shared.templateInput.scope.live': 'Live',
  'shared.templateInput.scope.liveOverride': 'Live · sustitución',
  'shared.templateInput.scope.stepNamed': 'Paso · {capture}',
  'shared.templateInput.scope.fileNamed': 'Archivo · {name}',
  'shared.templateInput.scope.dynamic': 'Dinámica',
  'shared.templateInput.scope.unresolved': 'Sin resolver',

  // Create-flow destination scopes ("Add to" picker).
  'shared.templateInput.createScope.environment': 'Entorno',
  'shared.templateInput.createScope.collection': 'Colección',
  'shared.templateInput.createScope.workspace': 'Espacio de trabajo',
  'shared.templateInput.createScope.vault': 'Vault',
  'shared.templateInput.createScope.noActiveEnvHint': 'sin env activo',

  // Why a reference is unresolved.
  'shared.templateInput.unresolved.emptyReference': 'Referencia vacía',
  'shared.templateInput.unresolved.unknownNamespace': 'Espacio de nombres desconocido',
  'shared.templateInput.unresolved.dynamic':
    'No hay ningún generador integrado con ese nombre. Elige uno de la lista de sugerencias {{dynamic.…}}.',
  'shared.templateInput.unresolved.step': 'Solo se resuelve mientras se ejecuta una cadena de Live Workflow.',
  'shared.templateInput.unresolved.envNotSet': 'No está definida en el entorno «{name}».',
  'shared.templateInput.unresolved.noActiveEnv': 'No hay ningún entorno activo seleccionado.',
  'shared.templateInput.unresolved.live': 'No hay ninguna variable Live con ese nombre (o aún no hay valor en caché).',
  'shared.templateInput.unresolved.notDefined': 'No está definida en ningún ámbito.',

  // Save dispatch results (update + create + toast surface).
  'shared.templateInput.save.pickScope': 'Elige un ámbito en «Añadir a»',
  'shared.templateInput.save.totpInVaultEditor': 'Los secretos TOTP se editan en el editor del Vault',
  'shared.templateInput.save.vaultKindChanged': 'El tipo de la entrada del Vault cambió entre tanto',
  'shared.templateInput.save.notEditable': 'No editable',
  'shared.templateInput.save.noActiveEnv': 'No hay entorno activo',
  'shared.templateInput.save.noCollection': 'No hay colección en este contexto',
  'shared.templateInput.save.saved': 'Guardado',
  'shared.templateInput.save.duplicateName': 'Ya existe una variable con ese nombre en este ámbito.',
  'shared.templateInput.save.notFound': 'Variable no encontrada — puede que haya sido eliminada.',
  'shared.templateInput.save.failed': 'No se pudo guardar',

  // ── Set-as-variable popover + selection context menu ───────────────
  'shared.templateInput.setAsVariable': 'Definir como variable',
  'shared.templateInput.setAsNewVariable': 'Definir como variable nueva',
  'shared.templateInput.variableName': 'Nombre de la variable',
  'shared.templateInput.variableValue': 'Valor de la variable',
  'shared.templateInput.valuePlaceholder': 'Valor',
  'shared.templateInput.menu.cut': 'Cortar',
  'shared.templateInput.menu.paste': 'Pegar',

  // ── Monaco variable completions (detail + hover documentation) ─────
  'shared.templateInput.completion.scope.vault': 'Secreto del Vault',
  'shared.templateInput.completion.scope.env': 'Entorno',
  'shared.templateInput.completion.scope.collection': 'Colección',
  'shared.templateInput.completion.scope.workspace': 'Espacio de trabajo',
  'shared.templateInput.completion.scope.live': 'Fuente',
  'shared.templateInput.completion.scope.step': 'Captura de paso del flujo de la fuente',
  'shared.templateInput.completion.scope.file': 'Referencia de archivo',
  'shared.templateInput.completion.scope.dynamic': 'Generador dinámico',
  'shared.templateInput.completion.staleSuffix': '(obsoleta)',
  'shared.templateInput.completion.comingSoon': 'próximamente',
  'shared.templateInput.completion.capturedAtRuntime': 'capturada en tiempo de ejecución',
  'shared.templateInput.completion.totpDetail': 'Código TOTP ({digits} dígitos, {period}s)',
  'shared.templateInput.completion.valueHiddenSensitive': 'Valor oculto (ámbito sensible).',
  'shared.templateInput.completion.valueHiddenStale': 'Valor oculto (variable Live obsoleta).',
  'shared.templateInput.completion.valueDoc': '**Valor:** `{value}`',
  'shared.templateInput.completion.staleValueDoc': '**Valor obsoleto:** `{value}`',
  'shared.templateInput.completion.capturedWhenRuns': 'Se captura cuando se ejecuta el workflow.',
  'shared.templateInput.completion.totpDoc':
    '**Código TOTP** — {algorithm}, {digits} dígitos, se renueva cada {period}s.',
  'shared.templateInput.completion.totpDocIssuer':
    '**Código TOTP** para **{issuer}** — {algorithm}, {digits} dígitos, se renueva cada {period}s.',

  // ── Value editors: shared chrome ───────────────────────────────────
  'shared.valueEditors.decoded': 'Decodificado',
  'shared.valueEditors.encodedPreview': 'Vista previa codificada',
  'shared.valueEditors.cannotEncode': 'No se puede codificar — el valor editado no es válido para este tipo',
  'shared.valueEditors.encodedCopied': 'Valor codificado copiado al portapapeles',
  'shared.valueEditors.copyFailed': 'No se pudo copiar al portapapeles',
  'shared.valueEditors.openAsDocument': 'Abrir como documento',
  'shared.valueEditors.decode': 'Decodificar',
  'shared.valueEditors.decodeChipView': 'Ver decodificado — {title}',
  'shared.valueEditors.decodeChipEdit': 'Decodificar y editar — {title}',
  'shared.valueEditors.editJwt': 'Editar el JWT',
  'shared.valueEditors.viewJwt': 'Ver el JWT',

  // ── Value editors: glance popover ──────────────────────────────────
  'shared.valueEditors.glance.title': 'Valor decodificado',
  'shared.valueEditors.glance.openTab': 'Abrir en una pestaña nueva',
  'shared.valueEditors.glance.openModal': 'Abrir como modal',
  'shared.valueEditors.glance.moreClaims': '+{count} más',
  'shared.valueEditors.glance.signatureElided':
    'Firma no mostrada — abre el documento o el modal para ver el token completo.',

  // ── Value editors: pair grid ───────────────────────────────────────
  'shared.valueEditors.grid.name': 'Nombre',
  'shared.valueEditors.grid.key': 'Clave',
  'shared.valueEditors.grid.value': 'Valor',
  'shared.valueEditors.grid.flag': 'indicador',
  'shared.valueEditors.grid.ariaNamePairs': 'Pares nombre/valor',
  'shared.valueEditors.grid.ariaKeyPairs': 'Pares clave/valor',
  'shared.valueEditors.grid.ariaRowName': 'Nombre de la fila {row}',
  'shared.valueEditors.grid.ariaRowKey': 'Clave de la fila {row}',
  'shared.valueEditors.grid.ariaRowValue': 'Valor de la fila {row}',
  'shared.valueEditors.grid.moveRowUp': 'Subir la fila {row}',
  'shared.valueEditors.grid.moveRowDown': 'Bajar la fila {row}',
  'shared.valueEditors.grid.deleteRow': 'Eliminar la fila {row}',
  'shared.valueEditors.grid.addRow': 'Añadir fila',

  // ── Value editors: JWT modal ───────────────────────────────────────
  'shared.valueEditors.jwt.title': 'Editor JWT',
  'shared.valueEditors.jwt.titleViewer': 'JWT',
  'shared.valueEditors.jwt.modified': 'Modificado',
  'shared.valueEditors.jwt.decodeErrorTitle': 'No se pudo decodificar el token',
  'shared.valueEditors.jwt.decoded': 'Decodificado',
  'shared.valueEditors.jwt.encoded': 'Codificado',
  'shared.valueEditors.jwt.header': 'Header',
  'shared.valueEditors.jwt.payload': 'Payload',
  'shared.valueEditors.jwt.claims': 'Claims:',
  'shared.valueEditors.jwt.rawToken': 'Token sin procesar',
  'shared.valueEditors.jwt.pasteOrEdit': 'Pega o edita el token sin procesar',
  'shared.valueEditors.jwt.notDecodable': 'No es un JWT decodificable',
  'shared.valueEditors.jwt.structure': 'Estructura:',
  'shared.valueEditors.jwt.resignWithSecret': 'Volver a firmar con un secreto',
  'shared.valueEditors.jwt.algFromHeader': '{algorithm} del header',
  'shared.valueEditors.jwt.signingSecret': 'Secreto de firma',
  'shared.valueEditors.jwt.secretMemoryNote': 'Se guarda solo en memoria y se descarta al cerrar el editor.',
  'shared.valueEditors.jwt.tokenExpired': 'Token caducado',
  'shared.valueEditors.jwt.tokenNotExpired': 'Token no caducado',
  'shared.valueEditors.jwt.expiredOn': 'Caducó el {date}',
  'shared.valueEditors.jwt.expiresOn': 'Caduca el {date}',
  'shared.valueEditors.jwt.resigned': 'Token firmado de nuevo con {algorithm}',
  'shared.valueEditors.jwt.resignedDescription':
    'Guardar escribe el token firmado con tu secreto — la vista previa de arriba es exactamente lo que se ' + 'guarda.',
  'shared.valueEditors.jwt.cannotResign': 'No se puede volver a firmar este algoritmo',
  'shared.valueEditors.jwt.cannotResignDescription':
    'Aquí solo se pueden volver a firmar los algoritmos HMAC (HS256, HS384, HS512). En su lugar se conserva ' +
    'la firma original.',
  'shared.valueEditors.jwt.signError': 'No se pudo firmar el token',
  'shared.valueEditors.jwt.signatureInvalid': 'La firma ya no es válida',
  'shared.valueEditors.jwt.signatureInvalidDescription':
    'La firma original se conserva tal cual, así que los servidores que la verifiquen rechazarán el token ' +
    'editado. Introduce un secreto de firma para firmarlo de nuevo.',
  'shared.valueEditors.jwt.copied': 'JWT copiado al portapapeles',

  // ── Value editors: detected-value titles ───────────────────────────
  'shared.valueEditors.valueTitle.jwt': 'Payload JWT',
  'shared.valueEditors.valueTitle.urlEncoded': 'Valor codificado como URL',
  'shared.valueEditors.valueTitle.base64': 'Valor Base64',
  'shared.valueEditors.valueTitle.hex': 'Valor en hexadecimal',
  'shared.valueEditors.valueTitle.timestamp': 'Marca de tiempo Unix',
  'shared.valueEditors.valueTitle.json': 'Valor JSON',
  'shared.valueEditors.valueTitle.jsonString': 'Cadena entre comillas',
  'shared.valueEditors.valueTitle.dataUri': 'Data URI',
  'shared.valueEditors.valueTitle.cookie': 'Valor de Cookie',
  'shared.valueEditors.valueTitle.csp': 'Content Security Policy',
  'shared.valueEditors.valueTitle.httpDate': 'Fecha HTTP',
  'shared.valueEditors.valueTitle.queryString': 'Query string',
  'shared.valueEditors.valueTitle.cacheControl': 'Cache-Control',
  'shared.valueEditors.valueTitle.hsts': 'Strict-Transport-Security',
  'shared.valueEditors.valueTitle.contentDisposition': 'Content-Disposition',
  'shared.valueEditors.valueTitle.link': 'Encabezado Link',
  'shared.valueEditors.valueTitle.authParams': 'Parámetros de autorización',
  'shared.valueEditors.valueTitle.acceptList': 'Lista Accept',

  // ── Scope-colors registry (canonical scope labels — badges, rows) ──
  'shared.scopeColors.vault': 'Secreto del Vault',
  'shared.scopeColors.environment': 'Variable de entorno',
  'shared.scopeColors.collection': 'Variable de colección',
  'shared.scopeColors.workspace': 'Variable de espacio de trabajo',
  'shared.scopeColors.live': 'Variable Live (respaldada por un workflow)',
  'shared.scopeColors.step': 'Captura de paso de workflow',
  'shared.scopeColors.file': 'Referencia de archivo',
  'shared.scopeColors.dynamic': 'Generador dinámico',

  // ── Value editors: in-field edit tooltips ──────────────────────────
  'shared.valueEditors.editTooltip.jwt': 'Editar como JWT',
  'shared.valueEditors.editTooltip.urlEncoded': 'Editar el valor codificado como URL',
  'shared.valueEditors.editTooltip.base64': 'Editar el valor Base64',
  'shared.valueEditors.editTooltip.hex': 'Editar el valor hexadecimal',
  'shared.valueEditors.editTooltip.timestamp': 'Editar la marca de tiempo',
  'shared.valueEditors.editTooltip.json': 'Editar como JSON',
  'shared.valueEditors.editTooltip.jsonString': 'Editar la cadena entre comillas',
  'shared.valueEditors.editTooltip.dataUri': 'Editar el contenido del Data URI',
  'shared.valueEditors.editTooltip.cookie': 'Editar los pares de la cookie',
  'shared.valueEditors.editTooltip.csp': 'Editar las directivas CSP',
  'shared.valueEditors.editTooltip.httpDate': 'Editar la fecha HTTP',
  'shared.valueEditors.editTooltip.queryString': 'Editar los pares de consulta',
  'shared.valueEditors.editTooltip.cacheControl': 'Editar las directivas de caché',
  'shared.valueEditors.editTooltip.hsts': 'Editar las directivas HSTS',
  'shared.valueEditors.editTooltip.contentDisposition': 'Editar los parámetros de disposición',
  'shared.valueEditors.editTooltip.link': 'Editar los enlaces',
  'shared.valueEditors.editTooltip.authParams': 'Editar los parámetros de autenticación',
  'shared.valueEditors.editTooltip.acceptList': 'Editar la lista Accept',

  // ── Default entity names ───────────────────────────────────────────
  'shared.defaults.newRulesCollection': 'Nueva colección de reglas',
  'shared.defaults.newRequestsCollection': 'Nueva colección de solicitudes',
  'shared.defaults.newEnvironment': 'Nuevo entorno',
  'shared.defaults.newSpec': 'Nueva especificación',

  // ── Rule-type registry ─────────────────────────────────────────────
  'shared.ruleTypes.header.label': 'Modificar encabezados',
  'shared.ruleTypes.header.description': 'Añadir, sobrescribir o eliminar encabezados HTTP',
  'shared.ruleTypes.requestBody.label': 'Modificar el cuerpo de solicitudes API',
  'shared.ruleTypes.requestBody.description':
    'Sobrescribir o transformar el cuerpo de las solicitudes API (solo fetch/XHR)',
  'shared.ruleTypes.response.label': 'Modificar respuestas API',
  'shared.ruleTypes.response.description':
    'Simular o modificar el estado, el cuerpo y los encabezados de las respuestas API (solo fetch/XHR)',
  'shared.ruleTypes.queryParam.label': 'Modificar parámetros de consulta',
  'shared.ruleTypes.queryParam.description': 'Añadir, sobrescribir o eliminar parámetros de URL',
  'shared.ruleTypes.inject.label': 'Inyectar script/hoja de estilos',
  'shared.ruleTypes.inject.description': 'Inyectar JavaScript o CSS en las páginas',
  'shared.ruleTypes.ws.label': 'Modificar mensajes WebSocket',
  'shared.ruleTypes.ws.description': 'Sustituir, inyectar o descartar frames WebSocket (solo sockets de página)',
  'shared.ruleTypes.sse.label': 'Modificar Server-Sent Events',
  'shared.ruleTypes.sse.description': 'Sustituir, inyectar o descartar eventos SSE (solo streams de página)',
  'shared.ruleTypes.block.label': 'Bloquear solicitudes',
  'shared.ruleTypes.block.description': 'Impedir que las solicitudes se completen',
  'shared.ruleTypes.redirect.label': 'Redirigir solicitudes',
  'shared.ruleTypes.redirect.description': 'Redirigir a una URL distinta',
  'shared.ruleTypes.delay.label': 'Retrasar solicitudes',
  'shared.ruleTypes.delay.description': 'Añadir latencia a las solicitudes de red (solo fetch/XHR)',
  'shared.ruleTypes.auth.label': 'Responder a desafíos de autenticación',
  'shared.ruleTypes.auth.description':
    'Proporcionar credenciales para un desafío de autenticación HTTP/proxy (requiere el modo de depuración)',

  // ── System rule-template registry ──────────────────────────────────
  'shared.ruleTemplates.blankRule': 'Regla en blanco',

  'shared.ruleTemplates.folder.corsSecurity': 'CORS y seguridad',
  'shared.ruleTemplates.folder.authentication': 'Autenticación',
  'shared.ruleTemplates.folder.privacy': 'Privacidad',
  'shared.ruleTemplates.folder.testing': 'Pruebas',
  'shared.ruleTemplates.folder.urlHandling': 'Gestión de URL',
  'shared.ruleTemplates.folder.tracking': 'Rastreo',
  'shared.ruleTemplates.folder.debugging': 'Depuración',
  'shared.ruleTemplates.folder.appearance': 'Apariencia',
  'shared.ruleTemplates.folder.rest': 'REST',
  'shared.ruleTemplates.folder.graphql': 'GraphQL',
  'shared.ruleTemplates.folder.statusCodes': 'Códigos de estado',
  'shared.ruleTemplates.folder.dynamic': 'Dinámico',

  'shared.ruleTemplates.corsBypass.name': 'Omitir CORS',
  'shared.ruleTemplates.corsBypass.description':
    'Eliminar los encabezados CORS restrictivos para permitir solicitudes cross-origin durante el desarrollo',
  'shared.ruleTemplates.removeCsp.name': 'Quitar la CSP',
  'shared.ruleTemplates.removeCsp.description': 'Quitar los encabezados Content-Security-Policy para desarrollo',
  'shared.ruleTemplates.allowEmbedding.name': 'Permitir la inserción',
  'shared.ruleTemplates.allowEmbedding.description': 'Eliminar X-Frame-Options para permitir iframes',
  'shared.ruleTemplates.apiAuth.name': 'Inyección de autenticación API',
  'shared.ruleTemplates.apiAuth.description':
    'Inyectar automáticamente el encabezado Authorization en las llamadas API',
  'shared.ruleTemplates.customUa.name': 'User-Agent personalizado',
  'shared.ruleTemplates.customUa.description': 'Sobrescribir el encabezado User-Agent para dominios concretos',
  'shared.ruleTemplates.blockCookies.name': 'Bloquear cookies',
  'shared.ruleTemplates.blockCookies.description': 'Eliminar el encabezado Cookie de las solicitudes salientes',
  'shared.ruleTemplates.testMerge.name': 'Probar Fusionar (httpbin)',
  'shared.ruleTemplates.testMerge.description':
    'Prueba la operación Fusionar añadiendo al final de un encabezado de respuesta.\n1. Activa esta regla\n' +
    '2. Abre httpbin.org en una pestaña nueva\n3. Ejecuta en la consola: fetch("https://httpbin.org/get")' +
    '.then(r=>{console.log("Content-Type:",r.headers.get("Content-Type"))})\n4. Content-Type debería mostrar ' +
    '"application/json, x-openheaders-merged"',
  'shared.ruleTemplates.blockTrackers.name': 'Bloquear rastreadores',
  'shared.ruleTemplates.blockTrackers.description': 'Bloquear scripts de analítica y rastreo',
  'shared.ruleTemplates.blockAds.name': 'Bloquear anuncios',
  'shared.ruleTemplates.blockAds.description': 'Bloquear los dominios de redes publicitarias comunes',
  'shared.ruleTemplates.redirectDomain.name': 'Redirigir un dominio',
  'shared.ruleTemplates.redirectDomain.description': 'Redirigir todo el tráfico de un dominio a otro',
  'shared.ruleTemplates.forceHttps.name': 'Forzar HTTPS',
  'shared.ruleTemplates.forceHttps.description':
    'Pasar de HTTP a HTTPS — usa un grupo de captura regex para conservar la ruta completa',
  'shared.ruleTemplates.removeUtm.name': 'Quitar parámetros UTM',
  'shared.ruleTemplates.removeUtm.description': 'Quitar los parámetros de rastreo UTM de las URL',
  'shared.ruleTemplates.addDebug.name': 'Añadir indicador de depuración',
  'shared.ruleTemplates.addDebug.description': 'Añadir un parámetro de consulta debug=true a las llamadas API',
  'shared.ruleTemplates.darkMode.name': 'CSS de modo oscuro',
  'shared.ruleTemplates.darkMode.description': 'Inyectar una hoja de estilos básica de modo oscuro',
  'shared.ruleTemplates.consoleLogger.name': 'Registro en consola',
  'shared.ruleTemplates.consoleLogger.description': 'Registrar todas las solicitudes fetch en la consola',
  'shared.ruleTemplates.slowApi.name': 'API lenta (2s)',
  'shared.ruleTemplates.slowApi.description':
    'Añadir un retardo de 2 segundos a las llamadas API — probar los estados de carga',
  'shared.ruleTemplates.timeoutTest.name': 'Prueba de timeout (5s)',
  'shared.ruleTemplates.timeoutTest.description': 'Añadir un retardo de 5 segundos — probar la gestión de timeouts',
  'shared.ruleTemplates.restBodyOverride.name': 'Sustitución de cuerpo REST',
  'shared.ruleTemplates.restBodyOverride.description':
    'Sustituir el cuerpo de la solicitud por una carga útil JSON estática',
  'shared.ruleTemplates.graphqlOverride.name': 'Sustitución GraphQL',
  'shared.ruleTemplates.graphqlOverride.description':
    'Sustituir el cuerpo de una solicitud GraphQL por una consulta y variables personalizadas',
  'shared.ruleTemplates.mock200.name': 'Mock 200 JSON',
  'shared.ruleTemplates.mock200.description': 'Devolver una respuesta JSON de éxito para un endpoint de API REST',
  'shared.ruleTemplates.mock404.name': 'Mock 404',
  'shared.ruleTemplates.mock404.description': 'Devolver una respuesta 404 Not Found',
  'shared.ruleTemplates.mock500.name': 'Mock de error del servidor',
  'shared.ruleTemplates.mock500.description':
    'Devolver un error 500 Internal Server Error — probar la gestión de errores',
  'shared.ruleTemplates.mockGraphql.name': 'Mock de respuesta GraphQL',
  'shared.ruleTemplates.mockGraphql.description':
    'Devolver una respuesta personalizada para una operación GraphQL concreta',
  'shared.ruleTemplates.mockDynamic.name': 'Respuesta REST dinámica',
  'shared.ruleTemplates.mockDynamic.description':
    'Interceptar la respuesta real de la API REST y modificarla con JavaScript — inyectar datos de prueba, ' +
    'quitar campos o transformar la forma de la respuesta',
  'shared.ruleTemplates.mockDynamicGraphql.name': 'Respuesta GraphQL dinámica',
  'shared.ruleTemplates.mockDynamicGraphql.description':
    'Interceptar la respuesta de una operación GraphQL concreta y modificarla con JavaScript — remodelar los ' +
    'datos, inyectar campos simulados o simular errores',

  // ── Dock-layout chrome ─────────────────────────────────────────────
  'shared.dock.slot.leftTop': 'Izquierda arriba',
  'shared.dock.slot.leftBottom': 'Izquierda abajo',
  'shared.dock.slot.rightTop': 'Derecha arriba',
  'shared.dock.slot.rightBottom': 'Derecha abajo',
  'shared.dock.slot.bottomLeft': 'Abajo izquierda',
  'shared.dock.slot.bottomRight': 'Abajo derecha',
  'shared.dock.hide': 'Ocultar',
  'shared.dock.moveTo': 'Mover a',
  'shared.dock.currentSlot': 'posición actual',
  'shared.dock.showToolWindowNames': 'Mostrar los nombres de las ventanas de herramientas',
  'shared.dock.hideThisDock': 'Ocultar este dock',
  'shared.dock.closeDock': 'Cerrar el dock',
  'shared.dock.panelOptions': 'Opciones del panel',
  'shared.dock.hidePanel': 'Ocultar el panel',

  // ── Docs panel chrome ──────────────────────────────────────────────
  'shared.docs.title': 'Docs',
  'shared.docs.contents': 'Índice',
  'shared.docs.ariaOpenToc': 'Abrir el índice',
  'shared.docs.ariaCloseToc': 'Cerrar el índice',
  'shared.docs.filterPlaceholder': 'Filtrar secciones',
  'shared.docs.noMatches': 'Sin coincidencias',
  'shared.docs.hint.navigate': 'navegar',
  'shared.docs.hint.open': 'abrir',
  'shared.docs.hint.back': 'volver',
  'shared.docs.hint.contents': 'índice',
  'shared.docs.previous': 'Anterior',
  'shared.docs.next': 'Siguiente',
  'shared.docs.previousTooltip': 'Anterior: {title}',
  'shared.docs.nextTooltip': 'Siguiente: {title}',

  // ── Docs section primitives ────────────────────────────────────────
  'shared.docs.callout.note': 'Nota',
  'shared.docs.callout.warning': 'Advertencia',
  'shared.docs.callout.tip': 'Consejo',
  'shared.docs.callout.limitation': 'Limitación',
  'shared.docs.example.rule': 'Regla:',
  'shared.docs.example.before': 'Antes:',
  'shared.docs.example.after': 'Después:',
  'shared.docs.example.appliesTo': 'Se aplica a:',
  'shared.docs.example.wontApply': 'No se aplicará:',
  'shared.docs.example.suggestion': 'Sugerencia:',
  'shared.docs.onThisPage': 'En esta página',
  'shared.docs.copyCode': 'Copiar el código',
  'shared.docs.surfaces.header': 'Dónde verás esto',
  'shared.docs.surfaces.popup': 'Popup',
  'shared.docs.surfaces.sidePanel': 'Panel lateral',
  'shared.docs.surfaces.workbench': 'Editor del espacio de trabajo',
  'shared.docs.surfaces.devtools': 'DevTools',
  'shared.docs.engineScript': 'Basado en scripts',

  // ── Split-layout orientation ───────────────────────────────────────
  'shared.splitLayout.horizontal': 'Disposición horizontal — lado a lado',
  'shared.splitLayout.vertical': 'Disposición vertical — apilada',

  // Grouped-timeline row window — the per-group escape hatch when the
  // rows-per-group limit hides a group's older messages (gRPC + WS
  // message timelines share these).
  'shared.timelineGroup.showOlder': 'Mostrar {count} más antiguos',
  'shared.timelineGroup.showNewestOnly': 'Mostrar solo los {count} más recientes',
  // Compose-editor toolbar wrap toggle + the "Editor" dropdown.
  'shared.codeEditor.wrap': 'Ajuste de línea',
  'shared.editorMenu.label': 'Editor',
  'shared.editorMenu.thisEditor': 'Este editor',
  'shared.editorMenu.allEditors': 'Todos los editores',
  'shared.editorMenu.lineNumbers': 'Números de línea',
  'shared.editorMenu.whitespace': 'Espacios en blanco',
  'shared.editorMenu.lineEnds': 'Finales de línea',
  // Peer-execute refusal notice (the quoted phrases are the settings
  // rows' own labels, verbatim).
  'shared.peerExecute.localDisabled':
    'El envío desde los navegadores de este dispositivo está desactivado en la aplicación de escritorio. ' +
    'Activa «Permitir que los navegadores de este dispositivo envíen solicitudes» en Configuración → Backend.',
  'shared.peerExecute.remoteDisabled':
    'El envío desde otros dispositivos está desactivado en el host conectado. Activa «Permitir que otros ' +
    'dispositivos conectados envíen solicitudes» en su Configuración → Backend en esa máquina.',
  'shared.peerExecute.enableCta': 'Activar en la aplicación de escritorio',

  // ── Desktop teaser ─────────────────────────────────────────────────
  'shared.desktopTeaser.cta': 'Descargar la aplicación de escritorio',
  'shared.desktopTeaser.openApp': 'Abrir en la aplicación de escritorio',
  'shared.desktopTeaser.otherPlatforms': 'Otras plataformas y canales',
  'shared.desktopTeaser.terminal.title': 'Terminal integrado',
  'shared.desktopTeaser.terminal.body':
    'Abre un terminal real dentro de tu espacio de trabajo: tu propio shell, ejecutándose en local justo al lado de tus reglas y solicitudes.',
  'shared.desktopTeaser.git.title': 'Historial de Git',
  'shared.desktopTeaser.git.body':
    'Explora la cronología de commits de tu espacio de trabajo, con el detalle por commit y los diffs de archivos.',
  'shared.desktopTeaser.proxy.title': 'Proxy de captura',
  'shared.desktopTeaser.proxy.body':
    'Captura el tráfico HTTP(S) en vivo con el proxy integrado e inspecciona cada solicitud en el momento en que ocurre.',
  'shared.desktopTeaser.mcp.title': 'IA · Servidor MCP',
  'shared.desktopTeaser.mcp.body':
    'Conecta asistentes de IA a tus espacios de trabajo a través del servidor MCP integrado.',
  'shared.desktopTeaser.liveNetwork.title': 'Red en vivo',
  'shared.desktopTeaser.liveNetwork.body':
    'Observa en vivo el tráfico de una pestaña del navegador en la aplicación de escritorio, transmitido desde la ' +
    'extensión, sin DevTools.',
} as const satisfies Catalog;
