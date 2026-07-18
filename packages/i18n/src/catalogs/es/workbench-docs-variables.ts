/**
 * Workbench Docs panel — the Variables section body — Spanish. Mirrors
 * `catalogs/en/workbench-docs-variables.ts` key for key. `{{ns.NAME}}`
 * reference tokens ride raw as code chips composed by the section
 * body; `Vault` / `Live` / `Live Workflow` stay raw as product and
 * scope names; the `string` / `TOTP` vault kinds ride raw. Mints:
 * variable scope = ámbito (S59 law — alcance is debug reach only);
 * bare reference = referencia sin prefijo; ladder = escalera; walk =
 * recorrido; shadowing = ocultación; step = paso. Sidebar entry names
 * referenced in prose mint the sidebar translations (`Variables del
 * espacio de trabajo`, `Variables Live`, `Entornos`, `Variables`) —
 * `workbench-chrome-sidebar.ts` must reuse them verbatim.
 */

import type { Catalog } from '../../types';

export const workbenchDocsVariables = {
  // ── Concepts: Variables ─────────────────────────────────────────────
  'workbench.docs.body.variables.intro1Prefix':
    'Cualquier campo que acepte plantillas — un valor de encabezado, una URL de redirección, un cuerpo de ' +
    'solicitud, un paso de workflow — puede referenciar una variable con',
  'workbench.docs.body.variables.intro1Suffix':
    '. El valor se sustituye en el momento del uso, así que una sola definición alimenta cada regla, solicitud ' +
    'y workflow que la mencione. Las variables viven en cinco ámbitos, cada uno con su propio lugar en la ' +
    'aplicación y su propio rango cuando el mismo nombre existe en más de uno.',
  'workbench.docs.body.variables.ladderCaptionPrefix': 'Una referencia sin prefijo',
  'workbench.docs.body.variables.ladderCaptionSuffix':
    'recorre cuatro ámbitos de arriba abajo y se detiene en la primera coincidencia. Live y los demás ámbitos ' +
    'con espacio de nombres quedan fuera del recorrido.',
  'workbench.docs.body.variables.scopesHeading': 'Los cinco ámbitos',
  'workbench.docs.body.variables.vaultHeading': 'Vault — secretos, solo en este dispositivo',
  'workbench.docs.body.variables.vault1Prefix':
    'El vault guarda los secretos propios del dispositivo: claves de API, contraseñas, semillas TOTP. Las ' +
    'entradas del vault nunca se sincronizan y nunca salen del dispositivo — quedan fuera de las exportaciones ' +
    'del espacio de trabajo y del historial de git. Existen dos tipos: las entradas',
  'workbench.docs.body.variables.vaultKindString': 'string',
  'workbench.docs.body.variables.vault1Middle': 'se resuelven tal cual, y las entradas',
  'workbench.docs.body.variables.vaultKindTotp': 'TOTP',
  'workbench.docs.body.variables.vault1Suffix':
    'se resuelven en el código actual de 6–8 dígitos calculado a partir de la semilla almacenada — la semilla ' +
    'en sí nunca se expone a través de una plantilla. El vault tiene el rango más alto, así que un secreto del ' +
    'vault siempre gana a una referencia sin prefijo.',
  'workbench.docs.body.variables.vaultCaptionPrefix': 'Referencia el secreto con',
  'workbench.docs.body.variables.vaultCaptionSuffix':
    'desde las entidades sincronizadas — nunca pegues el valor sin procesar.',
  'workbench.docs.body.variables.environmentHeading': 'Entorno — conjuntos de valores conmutables',
  'workbench.docs.body.variables.environment1Prefix':
    'Los entornos son conjuntos de variables con nombre que intercambias como una unidad —',
  'workbench.docs.body.variables.environment1Suffix':
    ', la configuración local de un compañero de equipo. El entorno activo se elige en el selector del ' +
    'encabezado; un nombre que el entorno activo no define recurre al entorno por defecto antes de que el ' +
    'recorrido continúe hacia abajo. Trabajar sin entorno seleccionado es un estado válido — la resolución ' +
    'simplemente se salta el ámbito. Las filas pueden marcarse como secretas para que sus valores se muestren ' +
    'enmascarados en el editor.',
  'workbench.docs.body.variables.environmentCaption':
    'Un mismo nombre, un valor por etapa — cambia de entorno en lugar de duplicar reglas.',
  'workbench.docs.body.variables.collectionHeading': 'Colección — limitada a una colección',
  'workbench.docs.body.variables.collection1':
    'Las variables de colección se definen en una colección y se resuelven solo para las reglas y solicitudes ' +
    'que le pertenecen. Son el lugar adecuado para valores que son ciertos para una API pero no para todo el ' +
    'espacio de trabajo — una URL base, un id de tenant, un prefijo de versión.',
  'workbench.docs.body.variables.collectionCaption':
    'Las variables de colección se resuelven solo dentro de su propia colección — en otros sitios el recorrido ' +
    'las pasa de largo.',
  'workbench.docs.body.variables.workspaceHeading': 'Espacio de trabajo — compartido con todos',
  'workbench.docs.body.variables.workspace1':
    'Las variables de espacio de trabajo son las globales de todo el espacio de trabajo — visibles para cada ' +
    'regla, solicitud y workflow, y sincronizadas con el espacio de trabajo. Tienen el rango más bajo, lo que ' +
    'las convierte en la capa base natural: pon aquí el valor común y deja que un entorno o una colección lo ' +
    'sustituya donde haga falta.',
  'workbench.docs.body.variables.workspaceCaption':
    'La capa base — para valores ciertos en todas partes. No para secretos, no para valores por etapa.',
  'workbench.docs.body.variables.liveHeading': 'Live — publicada por una ejecución de workflow',
  'workbench.docs.body.variables.live1Prefix':
    'Una variable live está respaldada por un Live Workflow — una cadena de solicitudes que inicia sesión, ' +
    'obtiene un token y expone un valor capturado. Guardar el workflow lo activa; una ejecución con éxito ' +
    '(manual o programada) publica el valor expuesto, y la actualización automática vuelve a ejecutar el ' +
    'workflow para mantenerlo fresco. Los valores live solo son accesibles como',
  'workbench.docs.body.variables.live1Suffix':
    '— nunca a través de una referencia sin prefijo — para que una plantilla de regla no pueda recoger en ' +
    'silencio un valor a mitad de actualización cuando una variable de espacio de trabajo o de entorno ' +
    'comparte el nombre. Editar la receta del workflow marca el valor publicado como obsoleto hasta la ' +
    'siguiente ejecución.',
  'workbench.docs.body.variables.liveRefCaptionPrefix': 'Siempre el prefijo —',
  'workbench.docs.body.variables.liveRefCaptionSuffix':
    '— y siempre respaldada por un workflow, nunca un token pegado.',
  'workbench.docs.body.variables.liveLifecycleCaptionPrefix':
    'La ejecución tiene éxito → la captura expuesta se publica como',
  'workbench.docs.body.variables.liveLifecycleCaptionSuffix':
    '→ las reglas y solicitudes la consumen. La programación vuelve a ejecutar el workflow.',
  'workbench.docs.body.variables.priorityHeading': 'Prioridad y ocultación',
  'workbench.docs.body.variables.priority1Prefix': 'Una referencia sin prefijo',
  'workbench.docs.body.variables.priority1Suffix':
    'se resuelve a través de los cuatro ámbitos reales en orden estricto — el vault, luego el entorno activo ' +
    '(con retorno al entorno por defecto), luego la colección, luego el espacio de trabajo — y se detiene en ' +
    'el primer ámbito que define el nombre. Las definiciones inferiores siguen existiendo; solo quedan ' +
    'ocultadas.',
  'workbench.docs.body.variables.shadowingCaptionPrefix':
    'El entorno gana al espacio de trabajo para la referencia sin prefijo;',
  'workbench.docs.body.variables.shadowingCaptionSuffix': 'sigue leyendo el valor ocultado.',
  'workbench.docs.body.variables.namespacePin1Prefix':
    'Cada ámbito tiene además un espacio de nombres que fija la resolución en él, saltándose la escalera por ' +
    'completo:',
  'workbench.docs.body.variables.namespacePin1Suffix':
    '. Usa la forma sin prefijo para el caso normal y la forma con espacio de nombres cuando te refieres a un ' +
    'ámbito concreto, independientemente de lo que esté definido por encima.',
  'workbench.docs.body.variables.tipTitle': 'Guarda los secretos en el vault',
  'workbench.docs.body.variables.tip1Prefix':
    'Las reglas, las solicitudes y los workflows se sincronizan con el espacio de trabajo — el vault no. ' +
    'Referencia',
  'workbench.docs.body.variables.tip1Suffix':
    'desde una entidad sincronizada y cada compañero de equipo aporta su propio valor localmente; nada ' +
    'sensible acaba nunca en los datos compartidos.',
  'workbench.docs.body.variables.rulesHeading': 'Variables en las reglas',
  'workbench.docs.body.variables.rules1':
    'Casi cada cadena que lleva una regla acepta plantillas: valores de condición (dominios, patrones de URL, ' +
    'nombres de encabezado), valores de encabezado, URL de redirección, nombres y valores de parámetros de ' +
    'consulta, cuerpos estáticos de solicitud y respuesta, código inyectado, cargas útiles WS / SSE y ' +
    'credenciales de Basic-auth. El editor de reglas resalta cada referencia, muestra el valor resuelto al ' +
    'pasar el cursor y señala con un aviso toda referencia que no se resuelve — una regla sin resolver no ' +
    'puede surtir efecto hasta que cada referencia tenga un valor.',
  'workbench.docs.body.variables.consumersCaption':
    'Un solo valor con plantilla alimenta las tres superficies consumidoras — sustituido donde corresponde a ' +
    'cada una.',
  'workbench.docs.body.variables.dynamicNoteTitle': 'Los cuerpos dinámicos (JS) no usan plantillas',
  'workbench.docs.body.variables.dynamicNote1Prefix': 'Las reglas de cuerpo de solicitud y de respuesta en modo',
  'workbench.docs.body.variables.dynamicWord': 'dinámico',
  'workbench.docs.body.variables.dynamicNote1Middle':
    'ejecutan tu JavaScript en lugar de sustituir plantillas — el código calcula sus valores por sí mismo. ' +
    'Solo los cuerpos',
  'workbench.docs.body.variables.staticWord': 'estáticos',
  'workbench.docs.body.variables.dynamicNote1Middle2': 'ven sus referencias',
  'workbench.docs.body.variables.dynamicNote1Suffix': 'sustituidas.',
  'workbench.docs.body.variables.requestsHeading': 'Variables en las solicitudes',
  'workbench.docs.body.variables.requests1Prefix':
    'En el cliente API, la URL, los parámetros de consulta, los encabezados, los campos de autenticación y el ' +
    'cuerpo se resuelven todos al pulsar Enviar — incluidas las variables de colección de la colección donde ' +
    'vive la solicitud. Una referencia que no se puede resolver bloquea el envío con un error que nombra la ' +
    'variable que falta, en lugar de poner un',
  'workbench.docs.body.variables.requests1Suffix': 'literal por la red.',
  'workbench.docs.body.variables.workflowsHeading': 'Variables en los workflows',
  'workbench.docs.body.variables.workflows1Prefix':
    'Cada paso de un Live Workflow se resuelve como una solicitud, más un ámbito adicional:',
  'workbench.docs.body.variables.workflows1Suffix':
    'referencia un valor capturado por un paso anterior de la misma ejecución — inicia sesión en el paso 1, ' +
    'gasta el token de sesión en el paso 2. Las referencias de paso solo existen mientras la cadena se está ' +
    'ejecutando; las capturas marcadas como expuestas son lo que se publica como variables live cuando la ' +
    'ejecución tiene éxito.',
  'workbench.docs.body.variables.namespacesHeading': 'Ayudantes solo con espacio de nombres',
  'workbench.docs.body.variables.helpers1':
    'Tres espacios de nombres más resuelven valores que no son variables almacenadas en absoluto.',
  'workbench.docs.body.variables.helpersDynamicMiddle': 'ejecuta un generador integrado —',
  'workbench.docs.body.variables.helpersFriends':
    ', y compañía — produciendo un valor nuevo en cada resolución: por envío en el cliente API, por ' +
    'compilación para las reglas estáticas (el valor queda incrustado hasta la siguiente recompilación).',
  'workbench.docs.body.variables.helpersFileMiddle': 'referencia un archivo almacenado por su nombre. Y',
  'workbench.docs.body.variables.helpersStepSuffix':
    ', visto arriba, solo tiene sentido dentro de una cadena de workflow en ejecución. Ninguno participa en ' +
    'el recorrido sin prefijo — solo son accesibles a través de su prefijo.',
  'workbench.docs.body.variables.inspectingHeading': 'Crear e inspeccionar',
  'workbench.docs.body.variables.create1Prefix': 'Cada ámbito se crea desde la barra lateral:',
  'workbench.docs.body.variables.sidebarVault': 'Vault',
  'workbench.docs.body.variables.sidebarWorkspaceVars': 'Variables del espacio de trabajo',
  'workbench.docs.body.variables.createAnd': ', y',
  'workbench.docs.body.variables.sidebarLiveVars': 'Variables Live',
  'workbench.docs.body.variables.create1Middle': 'son entradas de primer nivel; los entornos se añaden bajo',
  'workbench.docs.body.variables.sidebarEnvironments': 'Entornos',
  'workbench.docs.body.variables.create1Middle2': '; y cada colección lleva su propia página',
  'workbench.docs.body.variables.sidebarVariables': 'Variables',
  'workbench.docs.body.variables.create1Suffix': 'dedicada.',
  'workbench.docs.body.variables.creationMapCaption':
    'Cada lugar de variables en la barra lateral, anotado con el espacio de nombres que alimenta.',
  'workbench.docs.body.variables.inspect1Prefix': 'La ventana de herramientas',
  'workbench.docs.body.variables.inspect1Middle': 'es la superficie de inspección.',
  'workbench.docs.body.variables.inScopeLabel': 'En el ámbito',
  'workbench.docs.body.variables.inspect1Middle2':
    'lista las variables que la regla, la solicitud o la plantilla con el foco referencia realmente — cada una ' +
    'resuelta a través de la escalera completa, para que veas el valor exacto que se aplicará.',
  'workbench.docs.body.variables.allScopesLabel': 'Todos los ámbitos',
  'workbench.docs.body.variables.inspect1Middle3':
    'lista todo lo definido en cualquier parte, agrupado por prioridad. En cualquier campo que acepte ' +
    'plantillas, escribir',
  'workbench.docs.body.variables.inspect1Suffix':
    'abre la lista de sugerencias con cada nombre resoluble, y pasar el cursor por una referencia muestra su ' +
    'valor resuelto y el ámbito ganador.',
} as const satisfies Catalog;
