/**
 * Workbench Docs panel — SVG diagram labels — Spanish. Mirrors
 * `catalogs/en/workbench-docs-diagrams.ts` key for key. Vocabulary is
 * quoted from the shipped es catalogs: ámbito = scope, referencia sin
 * prefijo = bare reference, ocultado = shadowed, la escalera = the
 * ladder, el recorrido = the walk (all from
 * `es/workbench-docs-variables.ts`); sidebar entry names copy
 * `es/workbench-chrome-sidebar.ts` verbatim (Vault, Variables del
 * espacio de trabajo, Variables Live); Exponer = expose and Enviar =
 * Send reuse the shipped editor mints. Monospace wire fragments and
 * `{{ns.*}}` tokens are whole-raw values copied verbatim. Sample
 * identifiers (staging, production, api_host) ride raw.
 */

import type { Catalog } from '../../types';

export const workbenchDocsDiagrams = {
  // ── Variables: la escalera de resolución ────────────────────────────
  'workbench.docs.diagrams.variables.ladder.aria':
    'Una referencia sin prefijo se resuelve a través del vault, el entorno, la colección y luego el espacio de ' +
    'trabajo — la primera coincidencia gana. Live, step, file y dynamic solo son accesibles por su prefijo de ' +
    'espacio de nombres.',
  'workbench.docs.diagrams.variables.ladder.title': 'Referencia sin prefijo — gana el primer ámbito que la define',
  'workbench.docs.diagrams.variables.ladder.vault': 'Vault',
  'workbench.docs.diagrams.variables.ladder.vaultSub': 'secretos · solo este dispositivo',
  'workbench.docs.diagrams.variables.ladder.environment': 'Entorno',
  'workbench.docs.diagrams.variables.ladder.environmentSub': 'el activo, luego el por defecto',
  'workbench.docs.diagrams.variables.ladder.collection': 'Colección',
  'workbench.docs.diagrams.variables.ladder.collectionSub': 'solo la colección activa',
  'workbench.docs.diagrams.variables.ladder.workspace': 'Espacio de trabajo',
  'workbench.docs.diagrams.variables.ladder.workspaceSub': 'compartido con todos',
  'workbench.docs.diagrams.variables.ladder.miss': 'ausente',
  'workbench.docs.diagrams.variables.ladder.railHeading': 'SOLO ESPACIO DE NOMBRES',
  'workbench.docs.diagrams.variables.ladder.railFoot1': 'accesibles solo por prefijo —',
  'workbench.docs.diagrams.variables.ladder.railFoot2': 'nunca en el recorrido sin prefijo',
  'workbench.docs.diagrams.variables.ladder.pinExamples': '{{vault.token}} · {{env.token}} · {{collection.token}}',
  'workbench.docs.diagrams.variables.ladder.pinNote': '{{workspace.token}} — el prefijo fija un ámbito.',

  // ── Variables: mapa de creación ─────────────────────────────────────
  'workbench.docs.diagrams.variables.creation.aria':
    'Mapa de la barra lateral — las variables de colección viven en la colección, los entornos bajo Entornos, ' +
    'y Vault, Variables del espacio de trabajo y Variables Live son entradas de primer nivel',
  'workbench.docs.diagrams.variables.creation.title': 'Dónde se crea cada ámbito',
  'workbench.docs.diagrams.variables.creation.workspaceName': 'EQUIPO DE PAGOS',
  'workbench.docs.diagrams.variables.creation.collections': '▾ Colecciones',
  'workbench.docs.diagrams.variables.creation.collectionName': '▾ API de Pagos',
  'workbench.docs.diagrams.variables.creation.variables': 'Variables',
  'workbench.docs.diagrams.variables.creation.environments': '▾ Entornos',
  'workbench.docs.diagrams.variables.creation.envStaging': 'staging  ●',
  'workbench.docs.diagrams.variables.creation.envProduction': 'production',
  'workbench.docs.diagrams.variables.creation.vault': 'Vault',
  'workbench.docs.diagrams.variables.creation.workspaceVariables': 'Variables del espacio de trabajo',
  'workbench.docs.diagrams.variables.creation.liveVariables': 'Variables Live',
  'workbench.docs.diagrams.variables.creation.footer1': 'Las colecciones llevan su propia página Variables;',
  'workbench.docs.diagrams.variables.creation.footer2': 'todo lo demás es una entrada de la barra lateral.',

  // ── Variables: ocultación ───────────────────────────────────────────
  'workbench.docs.diagrams.variables.shadowing.aria':
    'api_host definido en el entorno y en el espacio de trabajo — la referencia sin prefijo se resuelve al ' +
    'valor del entorno; la forma con espacio de nombres sigue leyendo el valor del espacio de trabajo',
  'workbench.docs.diagrams.variables.shadowing.title': 'El mismo nombre en dos ámbitos — gana el más alto',
  'workbench.docs.diagrams.variables.shadowing.wins': '✓ gana',
  'workbench.docs.diagrams.variables.shadowing.shadowed': 'ocultado',
  'workbench.docs.diagrams.variables.shadowing.envLabel': 'Entorno · staging',
  'workbench.docs.diagrams.variables.shadowing.wsLabel': 'Espacio de trabajo',
  'workbench.docs.diagrams.variables.shadowing.footer': 'El prefijo se salta la escalera y lee un ámbito directamente.',

  // ── Variables: ciclo de vida Live ───────────────────────────────────
  'workbench.docs.diagrams.variables.live.aria':
    'Un Live Workflow ejecuta sus pasos, publica la captura expuesta como variable live, y las reglas y ' +
    'solicitudes la consumen; la actualización automática vuelve a ejecutar el workflow',
  'workbench.docs.diagrams.variables.live.title': 'Una ejecución con éxito publica el valor',
  'workbench.docs.diagrams.variables.live.workflowTitle': 'Live Workflow',
  'workbench.docs.diagrams.variables.live.step1': 'Paso 1 · iniciar sesión',
  'workbench.docs.diagrams.variables.live.step2': 'Paso 2 · obtener el token',
  'workbench.docs.diagrams.variables.live.expose': 'exponer: token',
  'workbench.docs.diagrams.variables.live.runSucceeds': 'la ejecución tiene éxito',
  'workbench.docs.diagrams.variables.live.publishes': 'publica',
  'workbench.docs.diagrams.variables.live.rules': 'Reglas',
  'workbench.docs.diagrams.variables.live.requests': 'Solicitudes',
  'workbench.docs.diagrams.variables.live.autoRefresh': 'la actualización automática lo relanza',
  'workbench.docs.diagrams.variables.live.footer1': 'Guardar activa el workflow — el valor solo aparece tras',
  'workbench.docs.diagrams.variables.live.footer2':
    'una ejecución con éxito, y se refresca según la programación del workflow.',

  // ── Variables: consumidores ─────────────────────────────────────────
  'workbench.docs.diagrams.variables.consumers.aria':
    'Un solo valor con plantilla — Authorization: Bearer token — consumido por reglas, solicitudes y workflows',
  'workbench.docs.diagrams.variables.consumers.title': 'Define una vez, referencia en todas partes',
  'workbench.docs.diagrams.variables.consumers.template': 'Authorization: Bearer {{token}}',
  'workbench.docs.diagrams.variables.consumers.rules': 'Reglas',
  'workbench.docs.diagrams.variables.consumers.rulesLine1': 'encabezados, redirección,',
  'workbench.docs.diagrams.variables.consumers.rulesLine2': 'cuerpos, inyección',
  'workbench.docs.diagrams.variables.consumers.rulesWhen': 'cuando aplica una regla',
  'workbench.docs.diagrams.variables.consumers.requests': 'Solicitudes',
  'workbench.docs.diagrams.variables.consumers.requestsLine1': 'URL, parámetros,',
  'workbench.docs.diagrams.variables.consumers.requestsLine2': 'encabezados, auth, cuerpo',
  'workbench.docs.diagrams.variables.consumers.requestsWhen': 'al Enviar',
  'workbench.docs.diagrams.variables.consumers.workflows': 'Workflows',
  'workbench.docs.diagrams.variables.consumers.workflowsLine1': 'cada paso,',
  'workbench.docs.diagrams.variables.consumers.workflowsLine2': 'capturas encadenadas',
  'workbench.docs.diagrams.variables.consumers.workflowsWhen': 'por ejecución',
  'workbench.docs.diagrams.variables.consumers.footer1':
    'Los valores se sustituyen al usarse — cambia la variable una vez,',
  'workbench.docs.diagrams.variables.consumers.footer2': 'y cada regla, solicitud y workflow la recoge.',

  // ── Variables: referencias por ámbito ───────────────────────────────
  'workbench.docs.diagrams.variables.refs.shared.dont': 'Evita:',
  'workbench.docs.diagrams.variables.refs.vault.aria':
    'Vault: referencia los secretos desde las entidades sincronizadas mediante plantillas vault; nunca pegues ' +
    'claves en bruto en reglas o variables del espacio de trabajo',
  'workbench.docs.diagrams.variables.refs.vault.title': 'Vault — secretos que nunca salen de este dispositivo',
  'workbench.docs.diagrams.variables.refs.vault.chipSub': 'Vault · kind: string',
  'workbench.docs.diagrams.variables.refs.vault.arrowCaption': 'resuelto localmente',
  'workbench.docs.diagrams.variables.refs.vault.good1Note':
    'regla sincronizada — se rellena con la clave propia de cada compañero',
  'workbench.docs.diagrams.variables.refs.vault.good2Note':
    'entrada TOTP — resuelve el código actual, nunca la semilla',
  'workbench.docs.diagrams.variables.refs.vault.goodFootnote':
    'las entradas del vault quedan fuera de la sincronización, las exportaciones y git',
  'workbench.docs.diagrams.variables.refs.vault.bad1Text': 'Bearer sk-live-9f3d… en una regla',
  'workbench.docs.diagrams.variables.refs.vault.bad1Reason':
    'el texto plano pegado se sincroniza a todo el espacio de trabajo',
  'workbench.docs.diagrams.variables.refs.vault.bad2Text': 'api_key como variable del espacio de trabajo',
  'workbench.docs.diagrams.variables.refs.vault.bad2Reason': 'también sincronizada — el vault es el único ámbito local',
  'workbench.docs.diagrams.variables.refs.vault.footer1':
    'El Vault está por encima de todo ámbito — un {{api_key}} sin prefijo',
  'workbench.docs.diagrams.variables.refs.vault.footer2': 'elige siempre el valor del vault cuando existe.',
  'workbench.docs.diagrams.variables.refs.environment.aria':
    'Entorno: un mismo nombre de variable se resuelve a un valor distinto por etapa; cambia de entorno en lugar ' +
    'de duplicar reglas, y guarda los secretos en el vault',
  'workbench.docs.diagrams.variables.refs.environment.title': 'Entorno — un nombre, un valor por etapa',
  'workbench.docs.diagrams.variables.refs.environment.chipSub': 'Entornos · staging (activo)',
  'workbench.docs.diagrams.variables.refs.environment.arrowCaption': 'gana el entorno activo',
  'workbench.docs.diagrams.variables.refs.environment.good1Note': 'mientras staging está activo',
  'workbench.docs.diagrams.variables.refs.environment.good2Note': 'cambia de entorno — mismas reglas, cero ediciones',
  'workbench.docs.diagrams.variables.refs.environment.goodFootnote': 'un fallo recurre primero al entorno por defecto',
  'workbench.docs.diagrams.variables.refs.environment.bad1Text': 'clave sk-live escrita en production',
  'workbench.docs.diagrams.variables.refs.environment.bad1Reason':
    'los entornos se sincronizan — los secretos van en el Vault',
  'workbench.docs.diagrams.variables.refs.environment.bad2Text': 'una copia staging de cada regla',
  'workbench.docs.diagrams.variables.refs.environment.bad2Reason':
    'no dupliques las reglas por etapa — cambia el entorno',
  'workbench.docs.diagrams.variables.refs.environment.footer1':
    '¿El mismo valor en cada etapa? Usa Espacio de trabajo.',
  'workbench.docs.diagrams.variables.refs.environment.footer2':
    '¿Secreto por usuario? El Vault está por encima de todo entorno.',
  'workbench.docs.diagrams.variables.refs.collection.aria':
    'Colección: las variables solo se resuelven para las reglas y solicitudes de su colección; mueve los ' +
    'valores comunes a todo el espacio de trabajo al ámbito de espacio de trabajo',
  'workbench.docs.diagrams.variables.refs.collection.title': 'Colección — limitada a una sola API',
  'workbench.docs.diagrams.variables.refs.collection.chipSub': 'API de Pagos · Variables',
  'workbench.docs.diagrams.variables.refs.collection.arrowCaption': 'se resuelve dentro de la API de Pagos',
  'workbench.docs.diagrams.variables.refs.collection.good1Note': 'solicitud en la colección API de Pagos',
  'workbench.docs.diagrams.variables.refs.collection.good2Note': 'regla en la colección API de Pagos',
  'workbench.docs.diagrams.variables.refs.collection.badsLabel': 'No se resuelve:',
  'workbench.docs.diagrams.variables.refs.collection.bad1Text': '{{base_url}} en la API de Facturación',
  'workbench.docs.diagrams.variables.refs.collection.bad1Reason': 'otra colección — defínela allí',
  'workbench.docs.diagrams.variables.refs.collection.bad2Text': '{{base_url}} en una regla sin colección',
  'workbench.docs.diagrams.variables.refs.collection.bad2Reason':
    'sin colección → la referencia pasa de largo este ámbito',
  'workbench.docs.diagrams.variables.refs.collection.footer1':
    '¿La necesitan todas las colecciones? Muévela a Espacio de trabajo.',
  'workbench.docs.diagrams.variables.refs.collection.footer2':
    'Una variable de entorno con el mismo nombre está por encima.',
  'workbench.docs.diagrams.variables.refs.workspace.aria':
    'Espacio de trabajo: las variables del espacio de trabajo se resuelven en todas partes y tienen el rango ' +
    'más bajo; guarda los secretos en el vault y los valores por etapa en los entornos',
  'workbench.docs.diagrams.variables.refs.workspace.title': 'Espacio de trabajo — la capa base compartida',
  'workbench.docs.diagrams.variables.refs.workspace.chipSub': 'Variables del espacio de trabajo',
  'workbench.docs.diagrams.variables.refs.workspace.arrowCaption': 'se resuelve en todas partes',
  'workbench.docs.diagrams.variables.refs.workspace.good1Note':
    'regla de encabezado — cualquier colección, cualquier entorno',
  'workbench.docs.diagrams.variables.refs.workspace.good2Note': 'URL de solicitud',
  'workbench.docs.diagrams.variables.refs.workspace.good3Note':
    'fijada — incluso cuando un ámbito más alto oculta el nombre',
  'workbench.docs.diagrams.variables.refs.workspace.bad1Reason':
    'sincronizado con todos — guarda los secretos en el Vault',
  'workbench.docs.diagrams.variables.refs.workspace.bad2Reason': 'cambia por etapa — defínela en cada Entorno',
  'workbench.docs.diagrams.variables.refs.workspace.footer1':
    '¿Secreto? Usa el Vault. ¿Distinto por etapa? Usa Entorno.',
  'workbench.docs.diagrams.variables.refs.workspace.footer2':
    'El Espacio de trabajo es para valores válidos en todas partes.',
  'workbench.docs.diagrams.variables.refs.live.aria':
    'Live: referencia los valores publicados por un workflow con el prefijo live; una referencia sin prefijo ' +
    'nunca resuelve live, y los tokens pegados a mano caducan',
  'workbench.docs.diagrams.variables.refs.live.title': 'Live — producido por una ejecución de workflow',
  'workbench.docs.diagrams.variables.refs.live.chipSub': 'Variables Live · workflow de inicio de sesión OAuth',
  'workbench.docs.diagrams.variables.refs.live.arrowCaption': 'publicado por la última ejecución',
  'workbench.docs.diagrams.variables.refs.live.good1Note': 'regla de encabezado que nunca caduca',
  'workbench.docs.diagrams.variables.refs.live.good2Text': '{{live.token}} en solicitudes y workflows',
  'workbench.docs.diagrams.variables.refs.live.good2Note': 'siempre el último valor publicado',
  'workbench.docs.diagrams.variables.refs.live.bad1Text': '{{token}} — sin prefijo',
  'workbench.docs.diagrams.variables.refs.live.bad1Reason':
    'live nunca entra en el recorrido sin prefijo — escribe {{live.token}}',
  'workbench.docs.diagrams.variables.refs.live.bad2Text': 'un token pegado en una variable de entorno',
  'workbench.docs.diagrams.variables.refs.live.bad2Reason': 'caduca en silencio — respáldalo con un workflow',
  'workbench.docs.diagrams.variables.refs.live.footer1': '¿Editaste el workflow? El valor se muestra caducado —',
  'workbench.docs.diagrams.variables.refs.live.footer2': 'solo la próxima ejecución con éxito lo vuelve a publicar.',

  // ── Multipestaña: vista de sincronización ───────────────────────────
  'workbench.docs.diagrams.multiTab.sync.aria':
    'Dos pestañas del espacio de trabajo abiertas lado a lado — espacios de trabajo distintos o disposiciones ' +
    'distintas, en paralelo',
  'workbench.docs.diagrams.multiTab.sync.title': 'Dos pestañas, dos contextos — al mismo tiempo',
  'workbench.docs.diagrams.multiTab.sync.tabTitle': '{ordinal} Open Headers',
  'workbench.docs.diagrams.multiTab.sync.workspaceProduction': 'Producción',
  'workbench.docs.diagrams.multiTab.sync.workspaceStaging': 'Staging',
  'workbench.docs.diagrams.multiTab.sync.sidebarRules': 'Reglas',
  'workbench.docs.diagrams.multiTab.sync.sidebarRequests': 'Solicitudes',
  'workbench.docs.diagrams.multiTab.sync.sidebarEnv': 'Ent',
  'workbench.docs.diagrams.multiTab.sync.ruleRow1': 'Encabezado de auth',
  'workbench.docs.diagrams.multiTab.sync.ruleRow2': 'Bypass de CORS',
  'workbench.docs.diagrams.multiTab.sync.ruleRow3': 'Bloquear anuncios',
  'workbench.docs.diagrams.multiTab.sync.rulesEditor': 'Editor de reglas',
  'workbench.docs.diagrams.multiTab.sync.envEditor': 'Editor de entornos',
  'workbench.docs.diagrams.multiTab.sync.footer1': 'Reglas + colecciones se sincronizan a través del almacenamiento.',
  'workbench.docs.diagrams.multiTab.sync.footer2': 'Cada pestaña conserva su espacio de trabajo + su disposición.',

  // ── Multipestaña: cronología de numeración ──────────────────────────
  'workbench.docs.diagrams.multiTab.numbering.aria':
    'Cronología de numeración — los ordinales se mantienen estables durante la vida de una pestaña; cerrar #1 ' +
    'no renumera, la siguiente recibe #4',
  'workbench.docs.diagrams.multiTab.numbering.title':
    'Los ordinales se mantienen estables durante la vida de una pestaña',
  'workbench.docs.diagrams.multiTab.numbering.step1': '1 pestaña abierta',
  'workbench.docs.diagrams.multiTab.numbering.note1': 'sin prefijo',
  'workbench.docs.diagrams.multiTab.numbering.step2': 'abrir otra',
  'workbench.docs.diagrams.multiTab.numbering.note2': 'aparecen prefijos',
  'workbench.docs.diagrams.multiTab.numbering.step3': 'abrir una tercera',
  'workbench.docs.diagrams.multiTab.numbering.step4': 'cerrar #1',
  'workbench.docs.diagrams.multiTab.numbering.note4': '#2 #3 sin cambios',
  'workbench.docs.diagrams.multiTab.numbering.step5': 'abrir una más',
  'workbench.docs.diagrams.multiTab.numbering.note5': 'la siguiente es #4',
  'workbench.docs.diagrams.multiTab.numbering.footer':
    'La numeración solo vuelve a #1 cuando se han cerrado todas las pestañas del espacio de trabajo.',

  // ── Multipestaña: reutilización al navegar ──────────────────────────
  'workbench.docs.diagrams.multiTab.navigation.aria':
    'Reutilización al navegar — primero la misma ventana. Arriba: la misma ventana tiene una pestaña del ' +
    'espacio de trabajo, el clic la activa. Abajo: solo otra ventana la tiene, una nueva se abre en la ventana ' +
    'de origen.',
  'workbench.docs.diagrams.multiTab.navigation.title': 'Haz clic en «Editar regla» en el popup —',
  'workbench.docs.diagrams.multiTab.navigation.subtitle':
    'el popup busca primero una pestaña del espacio de trabajo en TU ventana',
  'workbench.docs.diagrams.multiTab.navigation.sameWindow': 'Misma ventana',
  'workbench.docs.diagrams.multiTab.navigation.sameWindowHint': '— ya tiene una pestaña del espacio de trabajo',
  'workbench.docs.diagrams.multiTab.navigation.window1': 'Ventana 1',
  'workbench.docs.diagrams.multiTab.navigation.window1Caller': 'Ventana 1 (origen)',
  'workbench.docs.diagrams.multiTab.navigation.window2': 'Ventana 2',
  'workbench.docs.diagrams.multiTab.navigation.workspaceTab': '#1 Open Headers',
  'workbench.docs.diagrams.multiTab.navigation.otherTab': 'gmail',
  'workbench.docs.diagrams.multiTab.navigation.popup': 'popup',
  'workbench.docs.diagrams.multiTab.navigation.editRule': 'Editar regla ▸',
  'workbench.docs.diagrams.multiTab.navigation.activates': 'la pestaña existente se activa · sin pestaña nueva',
  'workbench.docs.diagrams.multiTab.navigation.otherWindow': 'Otra ventana',
  'workbench.docs.diagrams.multiTab.navigation.otherWindowHint': '— la tuya no tiene ninguna',
  'workbench.docs.diagrams.multiTab.navigation.newTab': '+ pestaña nueva',
  'workbench.docs.diagrams.multiTab.navigation.untouched': 'intacta · sin robo de foco',
  'workbench.docs.diagrams.multiTab.navigation.footer1': 'Igual que las DevTools de Chrome se acoplan por ventana —',
  'workbench.docs.diagrams.multiTab.navigation.footer2': 'te quedas en la ventana en la que ya estabas.',

  // ── Multipestaña: qué se sincroniza ─────────────────────────────────
  'workbench.docs.diagrams.multiTab.synced.aria':
    'Qué se sincroniza entre pestañas — chrome.storage contiene reglas, colecciones, carpetas, entornos, ' +
    'variables, vault, solicitudes, plantillas. Ambas pestañas leen y escriben a través de él.',
  'workbench.docs.diagrams.multiTab.synced.title': '✓ Se sincroniza entre pestañas',
  'workbench.docs.diagrams.multiTab.synced.subtitle': 'cada pestaña lee y escribe el mismo chrome.storage',
  'workbench.docs.diagrams.multiTab.synced.sourceOfTruth': 'única fuente de verdad',
  'workbench.docs.diagrams.multiTab.synced.pillRules': 'reglas',
  'workbench.docs.diagrams.multiTab.synced.pillCollections': 'colecciones',
  'workbench.docs.diagrams.multiTab.synced.pillFolders': 'carpetas',
  'workbench.docs.diagrams.multiTab.synced.pillEnvironments': 'entornos',
  'workbench.docs.diagrams.multiTab.synced.pillVariables': 'variables',
  'workbench.docs.diagrams.multiTab.synced.pillVault': 'vault',
  'workbench.docs.diagrams.multiTab.synced.pillRequests': 'solicitudes',
  'workbench.docs.diagrams.multiTab.synced.pillTemplates': 'plantillas',
  'workbench.docs.diagrams.multiTab.synced.tab1': 'Pestaña #1',
  'workbench.docs.diagrams.multiTab.synced.tab2': 'Pestaña #2',
  'workbench.docs.diagrams.multiTab.synced.liveData': 'datos en vivo',
  'workbench.docs.diagrams.multiTab.synced.footer':
    'Guarda en cualquiera de las dos — la otra se rehidrata al instante.',

  // ── Multipestaña: qué se queda local ────────────────────────────────
  'workbench.docs.diagrams.multiTab.local.aria':
    'Qué se queda en cada pestaña — proporción del divisor y borradores sin guardar. Dos pestañas visiblemente ' +
    'distintas: divisiones 25/75 y 65/35, una con borrador y otra sin él.',
  'workbench.docs.diagrams.multiTab.local.title': '✗ Se queda en cada pestaña',
  'workbench.docs.diagrams.multiTab.local.subtitle':
    'proporción del divisor + escritura sin guardar — privados donde los hiciste',
  'workbench.docs.diagrams.multiTab.local.tabTitle': 'Pestaña {ordinal}',
  'workbench.docs.diagrams.multiTab.local.layoutLabel': 'disposición',
  'workbench.docs.diagrams.multiTab.local.draftLabel': 'borrador sin guardar',
  'workbench.docs.diagrams.multiTab.local.unsavedBadge': '● sin guardar',
  'workbench.docs.diagrams.multiTab.local.noUnsaved': 'sin cambios sin guardar',
  'workbench.docs.diagrams.multiTab.local.footer1': 'Cada pestaña conserva su divisor + su borrador.',
  'workbench.docs.diagrams.multiTab.local.footer2':
    'Una pestaña abierta DESPUÉS de tu arrastre hereda la nueva disposición.',

  // ── Header actions: shared kickers ──────────────────────────────────
  'workbench.docs.diagrams.headerActions.shared.ruleKicker': 'REGLA',
  'workbench.docs.diagrams.headerActions.shared.beforeKicker': 'ANTES',
  'workbench.docs.diagrams.headerActions.shared.afterKicker': 'DESPUÉS',
  'workbench.docs.diagrams.headerActions.shared.wontFireKicker': 'CUANDO NO SE DISPARA',
  'workbench.docs.diagrams.headerActions.shared.suggestion': 'Sugerencia',

  // ── Header actions: operations overview ─────────────────────────────
  'workbench.docs.diagrams.headerActions.overview.aria':
    'Cuatro operaciones aplicadas al mismo encabezado inicial — Reemplazar sustituye el valor, Anexar añade un ' +
    'duplicado, Quitar elimina, Fusionar concatena.',
  'workbench.docs.diagrams.headerActions.overview.title': 'Mismo encabezado de partida → cuatro resultados',
  'workbench.docs.diagrams.headerActions.overview.before': 'Cookie: a=1',
  'workbench.docs.diagrams.headerActions.overview.opOverride': 'Reemplazar',
  'workbench.docs.diagrams.headerActions.overview.opAppend': 'Anexar',
  'workbench.docs.diagrams.headerActions.overview.opRemove': 'Quitar',
  'workbench.docs.diagrams.headerActions.overview.opMerge': 'Fusionar',
  'workbench.docs.diagrams.headerActions.overview.engineDnr': 'DNR',
  'workbench.docs.diagrams.headerActions.overview.engineScript': 'Script',
  'workbench.docs.diagrams.headerActions.overview.afterOverrideNew': 'Z',
  'workbench.docs.diagrams.headerActions.overview.afterAppendKept': 'a=1 ·',
  'workbench.docs.diagrams.headerActions.overview.afterAppendNew': '+Cookie: Z',
  'workbench.docs.diagrams.headerActions.overview.afterRemoveGone': '(encabezado eliminado)',
  'workbench.docs.diagrams.headerActions.overview.afterMergeNew': '; new=val',
  'workbench.docs.diagrams.headerActions.overview.legendDnr': 'DNR — nativo, aplicado por Chrome',
  'workbench.docs.diagrams.headerActions.overview.legendScript': 'Script — fetch / XHR parcheados (solo Fusionar)',

  // ── Header actions: add / replace ───────────────────────────────────
  'workbench.docs.diagrams.headerActions.override.aria':
    'Añadir / Reemplazar — la misma regla cubre ambos casos. Reemplaza el valor de un encabezado X-Auth existente, ' +
    'o añade el encabezado si falta. Ambos llegan al mismo resultado.',
  'workbench.docs.diagrams.headerActions.override.rule': 'Override X-Auth: Bearer token',
  'workbench.docs.diagrams.headerActions.override.replaceLabel': 'Reemplazar',
  'workbench.docs.diagrams.headerActions.override.addLabel': 'Añadir',
  'workbench.docs.diagrams.headerActions.override.replaceSub': 'encabezado ya presente',
  'workbench.docs.diagrams.headerActions.override.addSub': 'aún sin encabezado X-Auth',
  'workbench.docs.diagrams.headerActions.override.beforeOld': 'X-Auth: old-value',
  'workbench.docs.diagrams.headerActions.override.lineContentType': 'Content-Type: html',
  'workbench.docs.diagrams.headerActions.override.afterNew': 'X-Auth: Bearer token',
  'workbench.docs.diagrams.headerActions.override.noHeaderNote': '(sin X-Auth)',
  'workbench.docs.diagrams.headerActions.override.arrowReplaced': 'valor reemplazado',
  'workbench.docs.diagrams.headerActions.override.arrowAdded': 'encabezado añadido',
  'workbench.docs.diagrams.headerActions.override.stamp': 'En ambos casos → un único encabezado X-Auth con tu valor',
  'workbench.docs.diagrams.headerActions.override.wontAria':
    'Añadir / Reemplazar no se aplica cuando las condiciones de la regla no coinciden con la solicitud — ninguna ' +
    'operación, en silencio. Sugerencia: revisa las condiciones Dominios de solicitud o Patrón de URL.',
  'workbench.docs.diagrams.headerActions.override.wontTitle': 'Solicitud a un dominio que no coincide',
  'workbench.docs.diagrams.headerActions.override.wontDetail':
    'Las condiciones cierran el paso a la acción — sin coincidencia, ninguna operación.',
  'workbench.docs.diagrams.headerActions.override.wontSuggestion':
    'Revisa los Dominios de solicitud o el Patrón de URL de la regla.',

  // ── Header actions: append ──────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.append.aria':
    'Anexar añade una segunda fila de encabezado con el mismo nombre — ambas se entregan. ANTES muestra una fila ' +
    'Set-Cookie; DESPUÉS muestra dos, la nueva resaltada.',
  'workbench.docs.diagrams.headerActions.append.rule': 'Append Set-Cookie: tracking=xyz',
  'workbench.docs.diagrams.headerActions.append.lineSession': 'Set-Cookie: session=abc',
  'workbench.docs.diagrams.headerActions.append.arrowLabel': '+1 fila duplicada',
  'workbench.docs.diagrams.headerActions.append.afterNew': 'Set-Cookie: tracking=xyz',
  'workbench.docs.diagrams.headerActions.append.stamp1': 'Dos filas Set-Cookie — ambas se entregan.',
  'workbench.docs.diagrams.headerActions.append.stamp2':
    'Úsalo para Set-Cookie, Link, Via — encabezados que admiten duplicados.',
  'workbench.docs.diagrams.headerActions.append.wontAria':
    'Anexar no se aplica limpiamente a los encabezados que no admiten duplicados — el navegador conserva solo uno. ' +
    'Usa Añadir / Reemplazar para reemplazar o Fusionar para concatenar.',
  'workbench.docs.diagrams.headerActions.append.wontTitle': 'Encabezados que no admiten duplicados',
  'workbench.docs.diagrams.headerActions.append.wontDetail':
    'p. ej. Authorization, Host, Content-Type — el navegador conserva solo uno.',
  'workbench.docs.diagrams.headerActions.append.wontSuggestion1': 'Usa Añadir / Reemplazar para reemplazar el valor.',
  'workbench.docs.diagrams.headerActions.append.wontSuggestion2': 'Usa Fusionar para anexar al valor existente.',

  // ── Header actions: remove ──────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.remove.aria':
    'Quitar elimina el encabezado objetivo. ANTES muestra X-Frame-Options tachado; DESPUÉS muestra solo el ' +
    'encabezado Content-Type superviviente.',
  'workbench.docs.diagrams.headerActions.remove.rule': 'Remove X-Frame-Options',
  'workbench.docs.diagrams.headerActions.remove.beforeStruck': 'X-Frame-Options: DENY',
  'workbench.docs.diagrams.headerActions.remove.lineContentType': 'Content-Type: text/html',
  'workbench.docs.diagrams.headerActions.remove.arrowLabel': 'objetivo eliminado',
  'workbench.docs.diagrams.headerActions.remove.stamp1': 'Todas las instancias de X-Frame-Options quedan eliminadas.',
  'workbench.docs.diagrams.headerActions.remove.stamp2':
    'Las filas duplicadas del mismo encabezado se quitan todas a la vez.',
  'workbench.docs.diagrams.headerActions.remove.wontAria':
    'Quitar no hace nada cuando el encabezado objetivo no está presente — sin error. Usa Añadir / Reemplazar si ' +
    'querías establecer otro valor.',
  'workbench.docs.diagrams.headerActions.remove.wontTitle': 'Encabezado ya ausente',
  'workbench.docs.diagrams.headerActions.remove.wontDetail':
    'Ninguna operación — sin error, la solicitud simplemente pasa sin cambios.',
  'workbench.docs.diagrams.headerActions.remove.wontSuggestion':
    'Usa Añadir / Reemplazar si querías establecer el valor, no quitarlo.',

  // ── Header actions: merge ───────────────────────────────────────────
  'workbench.docs.diagrams.headerActions.merge.aria':
    'Fusionar lee el valor existente del encabezado en tiempo de ejecución, une el tuyo con un separador y ' +
    'reemplaza el original.',
  'workbench.docs.diagrams.headerActions.merge.rule': "Merge Cookie + new=val  (sep: '; ')",
  'workbench.docs.diagrams.headerActions.merge.lineSession': 'Cookie: session=abc',
  'workbench.docs.diagrams.headerActions.merge.arrowLabel': 'unión con el separador',
  'workbench.docs.diagrams.headerActions.merge.afterNew': 'new=val',
  'workbench.docs.diagrams.headerActions.merge.stamp1': 'Valor existente + tu valor, unidos por el separador.',
  'workbench.docs.diagrams.headerActions.merge.stamp2':
    "Separador por defecto: '; ' para Cookie, ', ' para los demás encabezados.",
  'workbench.docs.diagrams.headerActions.merge.wontAria':
    'Fusionar solo intercepta los fetch / XHR iniciados por JS — las navegaciones de página y los recursos ' +
    'estáticos pasan sin cambios. Usa Añadir / Reemplazar o Anexar (DNR) para esos casos.',
  'workbench.docs.diagrams.headerActions.merge.wontTitle1': 'Navegaciones de página',
  'workbench.docs.diagrams.headerActions.merge.wontDetail1':
    'Solo los fetch / XHR iniciados por JS pasan por el motor Script.',
  'workbench.docs.diagrams.headerActions.merge.wontTitle2': 'Recursos estáticos (img, script, link)',
  'workbench.docs.diagrams.headerActions.merge.wontDetail2': 'Emitidos por el navegador — nunca tocan fetch / XHR.',
  'workbench.docs.diagrams.headerActions.merge.wontSuggestion':
    'Para encabezados a nivel de página, usa Añadir / Reemplazar o Anexar (DNR).',

  // ── Conditions: shared ──────────────────────────────────────────────
  'workbench.docs.diagrams.conditions.shared.ruleLabel': 'Regla:',
  'workbench.docs.diagrams.conditions.shared.testRequests': 'Solicitudes de prueba:',
  'workbench.docs.diagrams.conditions.shared.testedAgainst': 'Probado contra estas URL:',
  'workbench.docs.diagrams.conditions.shared.beforeKicker': 'ANTES',
  'workbench.docs.diagrams.conditions.shared.afterKicker': 'DESPUÉS',
  'workbench.docs.diagrams.conditions.shared.legendLiteral': 'literal — coincidencia exacta',
  'workbench.docs.diagrams.conditions.shared.usePrefix': 'Usa ',
  'workbench.docs.diagrams.conditions.shared.useSuffix': ' en su lugar.',
  'workbench.docs.diagrams.conditions.shared.requestDomainsName': 'Dominios de solicitud',
  'workbench.docs.diagrams.conditions.shared.urlPatternName': 'Patrón de URL',
  'workbench.docs.diagrams.conditions.shared.initiatorDomainsName': 'Dominios iniciadores',

  // ── Conditions: host vs origin ──────────────────────────────────────
  'workbench.docs.diagrams.conditions.hostVsOrigin.aria':
    'Dos URL en un mismo fetch — la URL de la barra de direcciones es el origen (Dominios iniciadores); la URL de ' +
    'destino del fetch es el host (Dominios de solicitud)',
  'workbench.docs.diagrams.conditions.hostVsOrigin.title': 'Dos URL, dos condiciones',
  'workbench.docs.diagrams.conditions.hostVsOrigin.pageDoes': 'El JS de esta página hace:',
  'workbench.docs.diagrams.conditions.hostVsOrigin.fetchOpen': "fetch('",
  'workbench.docs.diagrams.conditions.hostVsOrigin.sameFetch': 'Mismo fetch — dos URL distintas.',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendOriginTerm': 'origen',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendOriginRest': ' — la URL de la página → la comprueba ',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendHostTerm': 'host',
  'workbench.docs.diagrams.conditions.hostVsOrigin.legendHostRest': ' — el destino del fetch → lo comprueba ',

  // ── Conditions: matching attributes ─────────────────────────────────
  'workbench.docs.diagrams.conditions.matching.aria':
    'Cada condición comprueba un atributo de la solicitud — las píldoras de color de la derecha nombran el tipo ' +
    'de condición que comprueba el atributo de cada fila. Todas las condiciones se combinan con AND.',
  'workbench.docs.diagrams.conditions.matching.title': 'Cada condición comprueba un atributo de la solicitud',
  'workbench.docs.diagrams.conditions.matching.colAttribute': 'ATRIBUTO DE LA SOLICITUD',
  'workbench.docs.diagrams.conditions.matching.colCheckedBy': 'COMPROBADO POR',
  'workbench.docs.diagrams.conditions.matching.attrMethod': 'método:',
  'workbench.docs.diagrams.conditions.matching.attrUrl': 'URL:',
  'workbench.docs.diagrams.conditions.matching.attrHost': 'host:',
  'workbench.docs.diagrams.conditions.matching.attrOrigin': 'origen:',
  'workbench.docs.diagrams.conditions.matching.attrType': 'tipo:',
  'workbench.docs.diagrams.conditions.matching.attrParty': 'parte:',
  'workbench.docs.diagrams.conditions.matching.attrHeader': 'cabecera:',
  'workbench.docs.diagrams.conditions.matching.condMethods': 'Métodos',
  'workbench.docs.diagrams.conditions.matching.condUrlPattern': 'Patrón de URL',
  'workbench.docs.diagrams.conditions.matching.condRequestDomains': 'Dominios de solicitud',
  'workbench.docs.diagrams.conditions.matching.condInitiatorDomains': 'Dominios iniciadores',
  'workbench.docs.diagrams.conditions.matching.condResourceTypes': 'Tipos de recurso',
  'workbench.docs.diagrams.conditions.matching.condDomainType': 'Tipo de dominio',
  'workbench.docs.diagrams.conditions.matching.condHeaders': 'Encabezados',
  'workbench.docs.diagrams.conditions.matching.allMustMatch': 'Todas deben coincidir (AND)',
  'workbench.docs.diagrams.conditions.matching.ruleFires': '→ la regla se dispara',

  // ── Conditions: rule fires ──────────────────────────────────────────
  'workbench.docs.diagrams.conditions.ruleFires.aria':
    'Cuando todas las condiciones coinciden, la regla se dispara — el encabezado Authorization se reemplaza antes ' +
    'de que la solicitud salga del navegador',
  'workbench.docs.diagrams.conditions.ruleFires.title': 'Las condiciones coinciden → se dispara → la solicitud cambia',
  'workbench.docs.diagrams.conditions.ruleFires.opOverride': 'Reemplazar',
  'workbench.docs.diagrams.conditions.ruleFires.ruleValue': 'Authorization: Bearer NEW',
  'workbench.docs.diagrams.conditions.ruleFires.beforeOld': 'Bearer OLD',
  'workbench.docs.diagrams.conditions.ruleFires.afterNew': 'Bearer NEW',
  'workbench.docs.diagrams.conditions.ruleFires.lineSession': 'session=abc',
  'workbench.docs.diagrams.conditions.ruleFires.arrowRule': 'la regla',
  'workbench.docs.diagrams.conditions.ruleFires.arrowFires': 'se dispara',
  'workbench.docs.diagrams.conditions.ruleFires.footer': 'La regla solo cambia su objetivo — el resto pasa sin tocar.',

  // ── Conditions: request domains ─────────────────────────────────────
  'workbench.docs.diagrams.conditions.requestDomains.aria':
    'Dominios de solicitud: una entrada incluye automáticamente el dominio raíz y cada subdominio, en cualquier ' +
    'ruta o consulta',
  'workbench.docs.diagrams.conditions.requestDomains.title':
    'Dominios de solicitud — una entrada, todos los subdominios',
  'workbench.docs.diagrams.conditions.requestDomains.autoIncludes': 'incluye automáticamente',
  'workbench.docs.diagrams.conditions.requestDomains.hostOnly':
    'coincide solo el host — vale cualquier ruta o consulta',
  'workbench.docs.diagrams.conditions.requestDomains.doesntMatch': 'No coincide:',
  'workbench.docs.diagrams.conditions.requestDomains.reasonTld': 'TLD distinto (.com ≠ .io)',
  'workbench.docs.diagrams.conditions.requestDomains.reasonNotSub':
    'no es un subdominio real — sin punto antes de «openheaders.com»',
  'workbench.docs.diagrams.conditions.requestDomains.footerPathPrefix': '¿Acotar por ruta? Añade ',
  'workbench.docs.diagrams.conditions.requestDomains.footerPathSuffix': ' a la regla.',
  'workbench.docs.diagrams.conditions.requestDomains.footerCross':
    '¿Varios dominios? Añade cada dominio como entrada aparte.',

  // ── Conditions: exclude domains ─────────────────────────────────────
  'workbench.docs.diagrams.conditions.excludeDomains.aria':
    'Excluir dominios resta hosts de las coincidencias de otra condición; por sí solo no coincide con nada',
  'workbench.docs.diagrams.conditions.excludeDomains.title': 'Excluir dominios — resta de otra condición',
  'workbench.docs.diagrams.conditions.excludeDomains.subtitle': 'Resta de las coincidencias de otra condición',
  'workbench.docs.diagrams.conditions.excludeDomains.includeKicker': '+ DOMINIOS DE SOLICITUD',
  'workbench.docs.diagrams.conditions.excludeDomains.excludeKicker': '− EXCLUIR DOMINIOS',
  'workbench.docs.diagrams.conditions.excludeDomains.finalHosts': 'Hosts finales coincidentes:',
  'workbench.docs.diagrams.conditions.excludeDomains.excluded': 'excluido',
  'workbench.docs.diagrams.conditions.excludeDomains.excludedSub':
    'excluido — la regla de subdominios también aplica a Excluir',
  'workbench.docs.diagrams.conditions.excludeDomains.warnTitle': 'Excluir por sí solo no coincide con nada.',
  'workbench.docs.diagrams.conditions.excludeDomains.warnBody': 'Solo resta de las coincidencias de otra condición.',

  // ── Conditions: initiator domains ───────────────────────────────────
  'workbench.docs.diagrams.conditions.initiatorDomains.aria':
    'Dominios iniciadores: mismo destino, páginas de origen distintas, resultados opuestos',
  'workbench.docs.diagrams.conditions.initiatorDomains.title':
    'Dominios iniciadores — según la página que hace la llamada',
  'workbench.docs.diagrams.conditions.initiatorDomains.subtitle':
    'Mismo fetch, dos contextos de página → resultados distintos',
  'workbench.docs.diagrams.conditions.initiatorDomains.ruleBanner': 'Dominios iniciadores: portal.openheaders.com',
  'workbench.docs.diagrams.conditions.initiatorDomains.openPage': 'PÁGINA ABIERTA',
  'workbench.docs.diagrams.conditions.initiatorDomains.fetches': '↓ hace fetch a',
  'workbench.docs.diagrams.conditions.initiatorDomains.matches': '✓ COINCIDE',
  'workbench.docs.diagrams.conditions.initiatorDomains.noMatch': '✗ NO COINCIDE',
  'workbench.docs.diagrams.conditions.initiatorDomains.initiatorEq': 'iniciador =',
  'workbench.docs.diagrams.conditions.initiatorDomains.footerQ': '¿Quieres coincidir por destino, no por origen?',

  // ── Conditions: methods ─────────────────────────────────────────────
  'workbench.docs.diagrams.conditions.methods.aria':
    'Métodos — verbos HTTP de selección múltiple; solo coinciden los métodos seleccionados (naranja)',
  'workbench.docs.diagrams.conditions.methods.title': 'Métodos — elige qué verbos HTTP coinciden',
  'workbench.docs.diagrams.conditions.methods.subtitle':
    'Selección múltiple — el naranja coincide; el resto no dispara la regla',
  'workbench.docs.diagrams.conditions.methods.testGet': 'GET /api/users',
  'workbench.docs.diagrams.conditions.methods.testPost': 'POST /api/login',
  'workbench.docs.diagrams.conditions.methods.testPut': 'PUT /api/users/1',
  'workbench.docs.diagrams.conditions.methods.testDelete': 'DELETE /api/users/1',
  'workbench.docs.diagrams.conditions.methods.notSelected': 'método fuera de la selección',
  'workbench.docs.diagrams.conditions.methods.footerQ': '¿Quieres todos los métodos?',
  'workbench.docs.diagrams.conditions.methods.footerA': 'Quita esta condición — todos los métodos por defecto.',

  // ── Conditions: resource types ──────────────────────────────────────
  'workbench.docs.diagrams.conditions.resourceTypes.aria':
    'Tipos de recurso — clases de solicitud de selección múltiple; los tipos seleccionados (morado) coinciden, ' +
    'el resto se omite',
  'workbench.docs.diagrams.conditions.resourceTypes.title': 'Tipos de recurso — selección múltiple',
  'workbench.docs.diagrams.conditions.resourceTypes.subtitle': 'El morado coincide; el resto no dispara la regla',
  'workbench.docs.diagrams.conditions.resourceTypes.testVisit': 'visita /dashboard',
  'workbench.docs.diagrams.conditions.resourceTypes.testImage': 'GET /img/logo.png',
  'workbench.docs.diagrams.conditions.resourceTypes.testScript': 'GET /js/app.js',
  'workbench.docs.diagrams.conditions.resourceTypes.kindXhr': 'xhr',
  'workbench.docs.diagrams.conditions.resourceTypes.kindPage': 'página',
  'workbench.docs.diagrams.conditions.resourceTypes.kindImageSkipped': 'imagen — omitida',
  'workbench.docs.diagrams.conditions.resourceTypes.kindScriptSkipped': 'script — omitido',
  'workbench.docs.diagrams.conditions.resourceTypes.footerQ': '¿Quieres todos los tipos de recurso?',
  'workbench.docs.diagrams.conditions.resourceTypes.footerA': 'Quita esta condición — todos los tipos por defecto.',

  // ── Conditions: domain type ─────────────────────────────────────────
  'workbench.docs.diagrams.conditions.domainType.aria':
    'Tipo de dominio — cada solicitud se clasifica como primera parte (mismo dominio registrable) o terceros; el ' +
    'selector de la regla decide qué tipo coincide',
  'workbench.docs.diagrams.conditions.domainType.title': 'Tipo de dominio — primera parte vs terceros',
  'workbench.docs.diagrams.conditions.domainType.subtitle':
    'Clasificado por la relación entre la página y la URL de la solicitud',
  'workbench.docs.diagrams.conditions.domainType.pageLabel': 'Página:',
  'workbench.docs.diagrams.conditions.domainType.ruleSelection': 'Selección de regla:',
  'workbench.docs.diagrams.conditions.domainType.pillFirstParty': 'firstParty',
  'workbench.docs.diagrams.conditions.domainType.pillThirdParty': 'thirdParty',
  'workbench.docs.diagrams.conditions.domainType.colDestination': 'DESTINO',
  'workbench.docs.diagrams.conditions.domainType.colType': 'TIPO',
  'workbench.docs.diagrams.conditions.domainType.colMatch': 'COINCIDE',
  'workbench.docs.diagrams.conditions.domainType.partyFirst': 'primera parte',
  'workbench.docs.diagrams.conditions.domainType.partyThird': 'terceros',
  'workbench.docs.diagrams.conditions.domainType.footerBoth': '¿Ambos? Selecciona firstParty Y thirdParty.',
  'workbench.docs.diagrams.conditions.domainType.footerRemove': 'O quita la condición — ambos por defecto.',

  // ── Conditions: response headers ────────────────────────────────────
  'workbench.docs.diagrams.conditions.headers.aria':
    'Condición Encabezados de respuesta — nombre exacto más valor exacto, solo del lado de la respuesta (Chrome ' +
    'DNR no filtra encabezados de solicitud)',
  'workbench.docs.diagrams.conditions.headers.title': 'Encabezados de respuesta — nombre y valor exactos',
  'workbench.docs.diagrams.conditions.headers.subtitle':
    'Solo respuesta — Chrome DNR no filtra encabezados de solicitud',
  'workbench.docs.diagrams.conditions.headers.exactName': 'nombre exacto',
  'workbench.docs.diagrams.conditions.headers.exactValue': 'valor exacto',
  'workbench.docs.diagrams.conditions.headers.testHeaders': 'Encabezados de respuesta probados:',
  'workbench.docs.diagrams.conditions.headers.testJson': 'Content-Type: application/json',
  'workbench.docs.diagrams.conditions.headers.testHtml': 'Content-Type: text/html',
  'workbench.docs.diagrams.conditions.headers.testServer': 'Server: nginx',
  'workbench.docs.diagrams.conditions.headers.reasonValue': 'el nombre coincide, pero el valor difiere',
  'workbench.docs.diagrams.conditions.headers.reasonName': 'nombre de encabezado distinto',
  'workbench.docs.diagrams.conditions.headers.absentLine': '(respuesta sin Content-Type)',
  'workbench.docs.diagrams.conditions.headers.reasonAbsent': 'encabezado ausente — debe estar presente para coincidir',
  'workbench.docs.diagrams.conditions.headers.footer':
    'Uso común: filtrar por Content-Type de respuesta o marcas propias',

  // ── Conditions: URL pattern ─────────────────────────────────────────
  'workbench.docs.diagrams.conditions.urlPattern.aria':
    'Patrón de URL usa comodines sobre la URL completa — anatomía del patrón más ejemplos que coinciden y que no',
  'workbench.docs.diagrams.conditions.urlPattern.title': 'Patrón de URL — comodines (*) sobre la URL completa',
  'workbench.docs.diagrams.conditions.urlPattern.labelAny': 'cualquier',
  'workbench.docs.diagrams.conditions.urlPattern.labelProtocol': 'protocolo',
  'workbench.docs.diagrams.conditions.urlPattern.labelLiteralHost': 'host literal',
  'workbench.docs.diagrams.conditions.urlPattern.labelNoWildcards': '(sin comodines)',
  'workbench.docs.diagrams.conditions.urlPattern.labelAnyPath': 'cualquier ruta',
  'workbench.docs.diagrams.conditions.urlPattern.labelQueryString': '+ cadena de consulta',
  'workbench.docs.diagrams.conditions.urlPattern.legendWildcard': 'comodín — coincide con todo',
  'workbench.docs.diagrams.conditions.urlPattern.reasonSubdomain': '«cdn» ≠ «api» — subdominio distinto',
  'workbench.docs.diagrams.conditions.urlPattern.reasonHost': 'host totalmente distinto',
  'workbench.docs.diagrams.conditions.urlPattern.footerQ': '¿Necesitas todos los subdominios a la vez?',
  'workbench.docs.diagrams.conditions.urlPattern.footerExample': 'Dominios de solicitud: openheaders.com',

  // ── Conditions: URL regex ───────────────────────────────────────────
  'workbench.docs.diagrams.conditions.urlRegex.aria':
    'Anatomía de la regex de URL más ejemplos — lo morado es regex real; todo lo demás es literal',
  'workbench.docs.diagrams.conditions.urlRegex.title': 'Regex de URL — regex RE2 sobre la URL completa',
  'workbench.docs.diagrams.conditions.urlRegex.labelStart': 'ancla',
  'workbench.docs.diagrams.conditions.urlRegex.labelAnchor': 'de inicio',
  'workbench.docs.diagrams.conditions.urlRegex.labelLiteralChars': 'caracteres literales',
  'workbench.docs.diagrams.conditions.urlRegex.labelDotNote': '(\\. coincide con el carácter .)',
  'workbench.docs.diagrams.conditions.urlRegex.labelOneOrMore': 'uno o más',
  'workbench.docs.diagrams.conditions.urlRegex.labelDigits': 'dígitos',
  'workbench.docs.diagrams.conditions.urlRegex.legendRegex': 'sintaxis regex — significado especial',
  'workbench.docs.diagrams.conditions.urlRegex.reasonHttp': 'la regex exige https:// — http no coincide',
  'workbench.docs.diagrams.conditions.urlRegex.reasonLatest': '«latest» no coincide con /v[0-9]+',
  'workbench.docs.diagrams.conditions.urlRegex.footerQ': '¿Quieres http y https?',
  'workbench.docs.diagrams.conditions.urlRegex.footerUsePrefix': 'Usa ',
  'workbench.docs.diagrams.conditions.urlRegex.footerMid': ' — el ',
  'workbench.docs.diagrams.conditions.urlRegex.footerEnd': ' hace opcional la s.',

  // ── Actions: rule anatomy ───────────────────────────────────────────
  'workbench.docs.diagrams.actions.ruleAnatomy.aria':
    'Anatomía de una regla — una solicitud HTTP saliente se compara con las condiciones de la regla (unidas por ' +
    'AND); si todas coinciden, la acción modifica la solicitud antes de que salga del navegador.',
  'workbench.docs.diagrams.actions.ruleAnatomy.title': 'Una regla = Condiciones + Acción',
  'workbench.docs.diagrams.actions.ruleAnatomy.subtitle':
    'Las condiciones deciden si la regla se dispara. La acción decide qué cambia.',
  'workbench.docs.diagrams.actions.ruleAnatomy.outgoingRequest': 'Solicitud saliente',
  'workbench.docs.diagrams.actions.ruleAnatomy.sideBefore': 'antes',
  'workbench.docs.diagrams.actions.ruleAnatomy.sideAfter': 'después',
  'workbench.docs.diagrams.actions.ruleAnatomy.addedTag': 'AÑADIDO',
  'workbench.docs.diagrams.actions.ruleAnatomy.arrowCheck': 'comprobar',
  'workbench.docs.diagrams.actions.ruleAnatomy.arrowApply': 'aplicar',
  'workbench.docs.diagrams.actions.ruleAnatomy.ruleLabel': 'Regla',
  'workbench.docs.diagrams.actions.ruleAnatomy.editorEntity': 'entidad del editor',
  'workbench.docs.diagrams.actions.ruleAnatomy.conditionsKicker': 'CONDICIONES',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionKicker': 'ACCIÓN',
  'workbench.docs.diagrams.actions.ruleAnatomy.condMethods': 'Métodos',
  'workbench.docs.diagrams.actions.ruleAnatomy.condRequestDomains': 'Dominios de solicitud',
  'workbench.docs.diagrams.actions.ruleAnatomy.condHeaders': 'Encabezados',
  'workbench.docs.diagrams.actions.ruleAnatomy.allMustMatch': 'TODAS DEBEN COINCIDIR (AND)',
  'workbench.docs.diagrams.actions.ruleAnatomy.onePerRule': 'una por regla',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionCard': 'Encabezado · Añadir',
  'workbench.docs.diagrams.actions.ruleAnatomy.actionValue': 'Bearer abc123…',
  'workbench.docs.diagrams.actions.ruleAnatomy.categoryLine': 'categoría: Modificar la solicitud',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictConditions': 'Condiciones filtran',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictAction': 'acción transforma',
  'workbench.docs.diagrams.actions.ruleAnatomy.verdictResult': 'solicitud sale modificada',

  // ── Actions: taxonomy ───────────────────────────────────────────────
  'workbench.docs.diagrams.actions.taxonomy.aria':
    'Taxonomía de acciones — tres categorías (Modificar la solicitud, Modificar la respuesta, Ejecutar código) ' +
    'que listan cada acción con su motor de ejecución (DNR o Script).',
  'workbench.docs.diagrams.actions.taxonomy.title': 'Acciones — por categoría',
  'workbench.docs.diagrams.actions.taxonomy.subtitle':
    'Cada acción pertenece a una de las tres categorías. La etiqueta del motor indica dónde se ejecuta.',
  'workbench.docs.diagrams.actions.taxonomy.catModifyRequest': 'Modificar la solicitud',
  'workbench.docs.diagrams.actions.taxonomy.catModifyRequestSub': 'antes de que salga del navegador',
  'workbench.docs.diagrams.actions.taxonomy.catModifyResponse': 'Modificar la respuesta',
  'workbench.docs.diagrams.actions.taxonomy.catModifyResponseSub': 'antes de que la página la vea',
  'workbench.docs.diagrams.actions.taxonomy.catRunCode': 'Ejecutar código',
  'workbench.docs.diagrams.actions.taxonomy.catRunCodeSub': 'en la página o su planificador',
  'workbench.docs.diagrams.actions.taxonomy.nameHeaderActions': 'Acciones de encabezado',
  'workbench.docs.diagrams.actions.taxonomy.subHeaderOps': 'Añadir · Anexar · Quitar · Fusionar',
  'workbench.docs.diagrams.actions.taxonomy.nameBlock': 'Bloquear',
  'workbench.docs.diagrams.actions.taxonomy.subBlock': 'cancelar en la capa de red',
  'workbench.docs.diagrams.actions.taxonomy.nameRedirect': 'Redirigir',
  'workbench.docs.diagrams.actions.taxonomy.subRedirect': 'URL estática o regex',
  'workbench.docs.diagrams.actions.taxonomy.nameQueryParams': 'Parámetros de consulta',
  'workbench.docs.diagrams.actions.taxonomy.subQueryParams': 'añadir · reemplazar · quitar',
  'workbench.docs.diagrams.actions.taxonomy.nameRequestBody': 'Cuerpo de solicitud',
  'workbench.docs.diagrams.actions.taxonomy.subRequestBody': 'estático · dinámico · GraphQL',
  'workbench.docs.diagrams.actions.taxonomy.subHeaderResponse': 'encabezados de respuesta',
  'workbench.docs.diagrams.actions.taxonomy.nameResponseBody': 'Cuerpo de respuesta',
  'workbench.docs.diagrams.actions.taxonomy.subResponseBody': 'cuerpo/estado/encabezados simulados',
  'workbench.docs.diagrams.actions.taxonomy.nameInject': 'Inyectar JS / CSS',
  'workbench.docs.diagrams.actions.taxonomy.subInject': 'antes de los scripts o tras el DOM',
  'workbench.docs.diagrams.actions.taxonomy.nameDelay': 'Retraso',
  'workbench.docs.diagrams.actions.taxonomy.subDelay': 'navegaciones + fetch / XHR',
  'workbench.docs.diagrams.actions.taxonomy.verdict':
    'Elige una categoría · elige una acción · combínala con condiciones',

  // ── System status: shared ───────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.shared.sync': 'Sincronización',
  'workbench.docs.diagrams.systemStatus.shared.rules': 'Reglas',
  'workbench.docs.diagrams.systemStatus.shared.requests': 'Solicitudes',
  'workbench.docs.diagrams.systemStatus.shared.permissions': 'Permisos',
  'workbench.docs.diagrams.systemStatus.shared.secrets': 'Secretos',
  'workbench.docs.diagrams.systemStatus.shared.live': 'Live',
  'workbench.docs.diagrams.systemStatus.shared.systemStatus': 'Estado del sistema',
  'workbench.docs.diagrams.systemStatus.shared.noEventsYet': 'Aún no hay eventos',
  'workbench.docs.diagrams.systemStatus.shared.green': 'verde',
  'workbench.docs.diagrams.systemStatus.shared.yellow': 'amarillo',
  'workbench.docs.diagrams.systemStatus.shared.red': 'rojo',
  'workbench.docs.diagrams.systemStatus.shared.desktopApp': 'App de escritorio',
  'workbench.docs.diagrams.systemStatus.shared.swWakes': 'el SW despierta',

  // ── System status: surfaces ─────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.aria':
    'Superficie del Workbench — la pestaña workbench de OpenHeaders. La fila de estado vive en el pie de ' +
    'página, con una píldora por subsistema.',
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.title': 'Workbench: la fila de estado en el pie',
  'workbench.docs.diagrams.systemStatus.surfacesWorkbench.callout':
    '↑ seis píldoras — una por subsistema; haz clic en cualquiera para abrir el popover.',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.aria':
    'Superficie del popup — el popup de la extensión cuelga del icono de la barra de herramientas. La píldora ' +
    'de estado vive en el pie del popup: un punto más la etiqueta «Estado del sistema».',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.title': 'Popup: la píldora Estado del sistema en el pie',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.wsChip': 'ws ▾',
  'workbench.docs.diagrams.systemStatus.surfacesPopup.callout':
    '↑ punto + etiqueta «Estado del sistema» en la franja del pie del popup.',

  // ── System status: worst-level aggregator ───────────────────────────
  'workbench.docs.diagrams.systemStatus.worstLevel.aria':
    'Agregador del peor estado — seis estados de subsistemas alimentan un solo punto compuesto. Gana el peor ' +
    'color: rojo vence a amarillo y amarillo a verde.',
  'workbench.docs.diagrams.systemStatus.worstLevel.title': 'Gana el peor color',
  'workbench.docs.diagrams.systemStatus.worstLevel.subtitle':
    'rojo > amarillo > verde · gris = aún sin eventos (se trata como verde)',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgConnected': 'conectada',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgActive': '12 activas',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgNoEvents': 'aún sin eventos',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgHostNarrowed': 'host restringido',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgCipher': 'descifrado',
  'workbench.docs.diagrams.systemStatus.worstLevel.msgFresh': '3 frescos',
  'workbench.docs.diagrams.systemStatus.worstLevel.maxFn': 'max()',
  'workbench.docs.diagrams.systemStatus.worstLevel.composite': 'punto',
  'workbench.docs.diagrams.systemStatus.worstLevel.dot': 'compuesto',
  'workbench.docs.diagrams.systemStatus.worstLevel.footer':
    'Un rojo en cualquier parte → compuesto rojo. Gobierna el punto del popup / panel lateral.',

  // ── System status: popover ──────────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.popover.aria':
    'Disposición del popover de estado — las filas grises (sin eventos) aparecen encima de las filas de color ' +
    '(las que ya han informado).',
  'workbench.docs.diagrams.systemStatus.popover.title': 'Orden del popover: primero los grises, luego los de color',
  'workbench.docs.diagrams.systemStatus.popover.subtitle':
    'Dentro de cada nivel se preserva el orden canónico de subsistemas',
  'workbench.docs.diagrams.systemStatus.popover.header': '● Estado del sistema',
  'workbench.docs.diagrams.systemStatus.popover.msgConnected': 'Conectada',
  'workbench.docs.diagrams.systemStatus.popover.msgActiveRules': '12 reglas activas',
  'workbench.docs.diagrams.systemStatus.popover.msgHostsNarrowed': 'Hosts restringidos',
  'workbench.docs.diagrams.systemStatus.popover.msgCipherFailed': 'Fallo al descifrar',
  'workbench.docs.diagrams.systemStatus.popover.dividerNote': '↑ sin eventos · ↓ ya informaron',
  'workbench.docs.diagrams.systemStatus.popover.footer':
    'Al primer informe, una fila migra de gris a color, una sola vez.',

  // ── System status: sync topology ────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.syncTopology.aria':
    'Topología de sincronización — el service worker de la extensión mantiene un WebSocket con la aplicación ' +
    'de escritorio en 127.0.0.1:8137, intercambiando espacios de trabajo, variables y sincronización de equipo.',
  'workbench.docs.diagrams.systemStatus.syncTopology.title': 'Cómo se conecta el subsistema Sincronización',
  'workbench.docs.diagrams.systemStatus.syncTopology.extension': 'Extensión',
  'workbench.docs.diagrams.systemStatus.syncTopology.serviceWorker': 'service worker',
  'workbench.docs.diagrams.systemStatus.syncTopology.wsClient': 'cliente WS',
  'workbench.docs.diagrams.systemStatus.syncTopology.onYourMachine': 'en tu máquina',
  'workbench.docs.diagrams.systemStatus.syncTopology.wsServer': 'servidor WS',
  'workbench.docs.diagrams.systemStatus.syncTopology.webSocket': 'WebSocket',
  'workbench.docs.diagrams.systemStatus.syncTopology.carries':
    'Transporta: variables dinámicas · espacios de trabajo · sincronización de equipo',
  'workbench.docs.diagrams.systemStatus.syncTopology.loopback': 'Solo loopback — nunca sale de tu máquina.',

  // ── System status: sync lifecycle ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.syncLifecycle.aria':
    'Ciclo de vida de la conexión de sincronización como diagrama de secuencia — el service worker de la ' +
    'extensión se conecta a la aplicación de escritorio; la píldora pasa de verde a amarillo y vuelve a verde',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.title': 'Cómo cambia la píldora Sincronización con el tiempo',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.extensionSw': 'SW extensión',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.syncPill': 'Píldora Sync',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.readsSettings': 'lee los ajustes',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.autoConnectOff': 'si conexión auto = off →',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateDisabled': 'Desactivado',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateConnecting': 'Conectando',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.stateConnected': 'Conectado',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retry1': 'Intento #1',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retry2': 'Intento #2',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.otherwise': 'si no →',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.wsConnect': 'conexión WebSocket',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.handshakeOk': 'handshake OK',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.pingPong': 'ping ⇄ pong',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.connectionDrops': '✗ la conexión cae',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.backoff': 'espera',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.retryConnect': 'reintento',
  'workbench.docs.diagrams.systemStatus.syncLifecycle.footer':
    'Backoff exponencial entre reintentos · los pings detectan cortes silenciosos de proxy',

  // ── System status: rules pipeline ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.rulesPipeline.aria':
    'Pipeline de reglas — la regla se compila, resuelve sus variables, pasa el control de tope y Chrome la ' +
    'aplica. Cada etapa puede emitir un nivel de estado si algo falla.',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.title': 'Cómo una regla se convierte en entrada DNR activa',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageYourRule': 'Tu regla',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageCompile': 'Compilar',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageResolve': 'Resolver {{VAR}}',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageCapCheck': 'Control de tope',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageChromeApply': 'Chrome aplica',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.stageLiveRule': 'Regla activa',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subToDnrJson': 'a JSON DNR',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subResolveScopes': 'vault · env · espacio de trabajo',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.subMatches': 'coincide con solicitudes',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outUnresolved': 'sin resolver → amarillo',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outOverCap': 'sobre el tope → amarillo',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outRejected': 'rechazada → rojo',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.outActive': 'N activas → verde',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.footerRebuild': 'La reconstrucción se dispara en cada guardado.',
  'workbench.docs.diagrams.systemStatus.rulesPipeline.footerPaused':
    'En pausa sigue verde («Ejecución de reglas en pausa»).',

  // ── System status: rules capacity ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.rulesCapacity.aria':
    'Barra de capacidad DNR — verde hasta el umbral de aviso, amarillo hasta el tope de truncado, rojo más ' +
    'allá. Las reglas sobre el tope se descartan: la zona roja nunca se alcanza en ejecución.',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.title': 'Capacidad de reglas — dónde cae cada recuento',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneHealthy': '✓ sano',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneApproach': 'se acerca',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.zoneTruncated': 'truncado',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countHealthy': '1,200',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countApproaching': '4,500',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.countOver': '5,600',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.warnLabel': 'aviso',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.capLabel': 'tope',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.warnValue': '4,000',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.capValue': '5,000',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.footerDrop':
    'Sobre el tope, las reglas se descartan en orden de coincidencia (gana la de arriba).',
  'workbench.docs.diagrams.systemStatus.rulesCapacity.footerCeiling':
    'El techo duro de Chrome queda mucho más lejos, en 30.000.',

  // ── System status: request outcomes ─────────────────────────────────
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.aria':
    'Resultados del ejecutor de solicitudes — cualquier respuesta HTTP, incluidas 4xx y 5xx, pone la píldora ' +
    'en verde. Solo los fallos de red sin respuesta la ponen en amarillo.',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.title': '¿Qué pone la píldora Solicitudes de cada color?',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.requestEditor': 'Editor de solicitudes',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.sendButton': 'Enviar ▸',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.executorFires': 'Ejecución',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.gotResponse': '✓ respuesta HTTP recibida',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.anyStatus': 'cualquier código de estado cuenta',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exOk': 'OK',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exNotFound': 'No encontrado',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exServerError': 'Error del servidor',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exAborted': 'Abortada',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.exOffline': 'Sin conexión / DNS',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.pillGreen': 'Píldora → verde',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.pillYellow': 'Píldora → amarillo',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.noResponse': '✗ sin respuesta',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.networkFailure': 'fallo a nivel de red',
  'workbench.docs.diagrams.systemStatus.requestsOutcomes.footer':
    'Un 500 sigue siendo «verde» — la solicitud terminó, solo que recibiste un 500.',

  // ── System status: request scope ────────────────────────────────────
  'workbench.docs.diagrams.systemStatus.requestsScope.aria':
    'Alcance del ejecutor — solo las solicitudes del botón Enviar actualizan la píldora. Los refrescos Live ' +
    'son silenciosos; el tráfico de las páginas pasa por el motor de reglas.',
  'workbench.docs.diagrams.systemStatus.requestsScope.title': '¿Qué actualiza la píldora Solicitudes?',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcSend': 'Enviar ▸ en el editor',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcLive': 'Refresco de workflow Live',
  'workbench.docs.diagrams.systemStatus.requestsScope.srcWebpage': 'fetch / XHR de la página',
  'workbench.docs.diagrams.systemStatus.requestsScope.subUser': 'iniciada por el usuario',
  'workbench.docs.diagrams.systemStatus.requestsScope.subBackground': 'tic en segundo plano',
  'workbench.docs.diagrams.systemStatus.requestsScope.subObserved': 'observado por el motor de reglas',
  'workbench.docs.diagrams.systemStatus.requestsScope.updatesPill': 'actualiza la píldora',
  'workbench.docs.diagrams.systemStatus.requestsScope.differentSystem': 'otro sistema',
  'workbench.docs.diagrams.systemStatus.requestsScope.noUpdate': 'sin actualización',
  'workbench.docs.diagrams.systemStatus.requestsScope.footer':
    'Solo el tráfico ad hoc del botón Enviar moldea esta píldora.',

  // ── System status: permissions impact ───────────────────────────────
  'workbench.docs.diagrams.systemStatus.permissionsImpact.aria':
    'Misma regla, dos estados de permisos. Con all_urls concedido, la regla DNR se dispara. Con el host ' +
    'revocado, la regla no hace nada en silencio y el encabezado nunca llega.',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.title': 'Misma regla, dos estados de permisos',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.granted': 'Concedido',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.narrowed': 'Restringido',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.hostRevoked': 'host revocado',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.addHeader': 'Añadir encabezado',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.page': 'Página',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.fetchCall': 'fetch()',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.applies': 'se aplica',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.noOp': 'no-op',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.headerArrives': '✓ el encabezado llega',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.headerMissing': '✗ encabezado ausente',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.ruleFired': 'regla disparada',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.silentNoOp': 'no-op silencioso',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.footer1':
    'Los hosts restringidos no dan error — las reglas simplemente no hacen nada.',
  'workbench.docs.diagrams.systemStatus.permissionsImpact.footer2':
    'El rojo de la píldora es la única pista hasta que restauras el acceso.',

  // ── System status: permissions audit ────────────────────────────────
  'workbench.docs.diagrams.systemStatus.permissionsAudit.aria':
    'Cuándo se ejecuta la auditoría y qué nivel de estado informa cada rama.',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.title':
    '¿Cuándo se ejecuta la auditoría y qué informa cada rama?',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.firstHydration': 'primera hidratación',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.happyPath': 'camino feliz',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.userRevoked': 'se revocó un host',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.apiUnavailable': 'API no disponible',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.throws': 'lanza excepción',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgAllGranted': '«Todo concedido»',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgHostsNarrowed': '«Hosts restringidos»',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.msgAuditFailed': '«Auditoría fallida»',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.footer1': 'MV3 no tiene observador de cambios de permisos —',
  'workbench.docs.diagrams.systemStatus.permissionsAudit.footer2':
    'la re-comprobación se dispara en cada despertar del SW.',

  // ── System status: vault hydration ──────────────────────────────────
  'workbench.docs.diagrams.systemStatus.vaultHydration.aria':
    'Hidratación del vault — el blob se carga del almacenamiento y cada entrada pasa por el esquema. Las ' +
    'conformes se conservan; las entradas con deriva se descartan y se informan en amarillo.',
  'workbench.docs.diagrams.systemStatus.vaultHydration.title': 'Hidratación del vault al despertar el SW',
  'workbench.docs.diagrams.systemStatus.vaultHydration.blobSuffix': ' (blob cifrado)',
  'workbench.docs.diagrams.systemStatus.vaultHydration.schemaValidator': 'Validador de esquema',
  'workbench.docs.diagrams.systemStatus.vaultHydration.matchesSchema': 'coincide con el esquema',
  'workbench.docs.diagrams.systemStatus.vaultHydration.driftOldShape': 'deriva: forma antigua',
  'workbench.docs.diagrams.systemStatus.vaultHydration.kept': '✓ conservada',
  'workbench.docs.diagrams.systemStatus.vaultHydration.dropped': '✗ descartada',
  'workbench.docs.diagrams.systemStatus.vaultHydration.secretsYellow': 'Secretos · amarillo',
  'workbench.docs.diagrams.systemStatus.vaultHydration.keptEntries': 'las entradas conservadas',
  'workbench.docs.diagrams.systemStatus.vaultHydration.hydrateCleanly': 'se hidratan limpiamente',

  // ── System status: vault drift detail ───────────────────────────────
  'workbench.docs.diagrams.systemStatus.vaultDrift.aria':
    'Cómo se ve la deriva de esquema en concreto — una entrada válida tiene uid, label y cipher; una entrada ' +
    'con deriva puede carecer del campo cipher. El validador descarta la fila mala y emite estado amarillo.',
  'workbench.docs.diagrams.systemStatus.vaultDrift.title': 'Cómo se ve la «deriva de esquema»',
  'workbench.docs.diagrams.systemStatus.vaultDrift.validEntry': 'Entrada válida',
  'workbench.docs.diagrams.systemStatus.vaultDrift.driftEntry': 'Entrada con deriva',
  'workbench.docs.diagrams.systemStatus.vaultDrift.apiToken': 'token de API',
  'workbench.docs.diagrams.systemStatus.vaultDrift.oldToken': 'token antiguo',
  'workbench.docs.diagrams.systemStatus.vaultDrift.missing': '— ausente —',
  'workbench.docs.diagrams.systemStatus.vaultDrift.issue': '2 problemas de esquema → descartada',
  'workbench.docs.diagrams.systemStatus.vaultDrift.footer1':
    'Las entradas con deriva se descartan al hidratar y la píldora pasa a amarillo.',
  'workbench.docs.diagrams.systemStatus.vaultDrift.footer2':
    'Volver a guardar desde el editor del Vault devuelve a la entrada su forma actual.',

  // ── System status: live freshness ───────────────────────────────────
  'workbench.docs.diagrams.systemStatus.liveFreshness.aria':
    'Reglas de estado por workflow — fresco, caducado/vacilante, fallando — ancladas a los umbrales reales.',
  'workbench.docs.diagrams.systemStatus.liveFreshness.title': 'Reglas de estado por workflow',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateFresh': 'fresco',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateStale': 'caducado / vacilante',
  'workbench.docs.diagrams.systemStatus.liveFreshness.stateFailing': 'fallando',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleFresh':
    'última ejecución OK · dentro de 2× la cadencia · 0 fallos',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleStale': 'más de 2× la cadencia · O 1–4 fallos consecutivos',
  'workbench.docs.diagrams.systemStatus.liveFreshness.ruleFailing': '≥ 5 fallos consecutivos',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egFresh': 'p. ej. cada refresco obtiene el 200',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egStale': 'p. ej. un timeout, reintentando',
  'workbench.docs.diagrams.systemStatus.liveFreshness.egFailing': 'p. ej. la API caída una hora',
  'workbench.docs.diagrams.systemStatus.liveFreshness.footer':
    'Cadencia = el intervalo de refresco configurado del workflow.',

  // ── System status: live aggregation ─────────────────────────────────
  'workbench.docs.diagrams.systemStatus.liveAggregation.aria':
    'Agregación de la píldora Live — tres workflows del espacio de trabajo activo se pliegan en un compuesto ' +
    'vía max; los workflows de espacios inactivos quedan excluidos.',
  'workbench.docs.diagrams.systemStatus.liveAggregation.title':
    'Los workflows del espacio activo se pliegan en una píldora',
  'workbench.docs.diagrams.systemStatus.liveAggregation.activeWorkspace': 'Espacio de trabajo activo',
  'workbench.docs.diagrams.systemStatus.liveAggregation.contributes': 'contribuye a la píldora',
  'workbench.docs.diagrams.systemStatus.liveAggregation.msgFresh': 'fresco',
  'workbench.docs.diagrams.systemStatus.liveAggregation.msgConsecFails': '2 fallos consecutivos',
  'workbench.docs.diagrams.systemStatus.liveAggregation.otherWorkspaces': 'Otros espacios de trabajo',
  'workbench.docs.diagrams.systemStatus.liveAggregation.excluded': 'excluidos a propósito',
  'workbench.docs.diagrams.systemStatus.liveAggregation.skipped': '✗ no accionables — omitidos',
  'workbench.docs.diagrams.systemStatus.liveAggregation.livePill': 'Píldora Live',
  'workbench.docs.diagrams.systemStatus.liveAggregation.maxYellow': 'max() = amarillo',
  'workbench.docs.diagrams.systemStatus.liveAggregation.footer1':
    'Un solo workflow en el peor estado voltea toda la píldora.',
  'workbench.docs.diagrams.systemStatus.liveAggregation.footer2':
    'Cambia de espacio de trabajo y la píldora se recalcula con las ejecuciones de ese espacio.',

  // ── Open Headers: shared ────────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.shared.openHeaders': 'Open Headers',
  'workbench.docs.diagrams.openHeaders.shared.stampBestInClass': 'EL MEJOR DE SU CLASE',
  'workbench.docs.diagrams.openHeaders.shared.badgeToday': 'HOY',
  'workbench.docs.diagrams.openHeaders.shared.badgeRoadmap': 'HOJA DE RUTA',
  'workbench.docs.diagrams.openHeaders.shared.supports': 'COMPATIBLE CON',
  'workbench.docs.diagrams.openHeaders.shared.inBrowser': 'En el navegador',
  'workbench.docs.diagrams.openHeaders.shared.desktopApp': 'App de escritorio',
  'workbench.docs.diagrams.openHeaders.shared.localServer': 'Servidor local',
  'workbench.docs.diagrams.openHeaders.shared.yourVm': 'Tu VM',
  'workbench.docs.diagrams.openHeaders.shared.workbench': 'Workbench',
  'workbench.docs.diagrams.openHeaders.shared.devtools': 'DevTools',
  'workbench.docs.diagrams.openHeaders.shared.soon': 'pronto',

  // ── Open Headers: paradigm shift ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.shift.aria':
    'El cambio de paradigma: contrastes agrupados entre Open Headers y todas las demás herramientas del sector. ' +
    'Todo en una sola extensión de navegador, sin cuenta, solo local, sin rastreo, un motor para nueve tipos de ' +
    'reglas, sincronización a nivel de campo, un nivel gratuito completo sin funciones bloqueadas, precios por ' +
    'asiento y sin bloqueo por impago, frente al resto del mercado.',
  'workbench.docs.diagrams.openHeaders.shift.title': 'EL CAMBIO DE PARADIGMA',
  'workbench.docs.diagrams.openHeaders.shift.everyoneElse': 'Todos los demás',
  'workbench.docs.diagrams.openHeaders.shift.groupArchitecture': 'Arquitectura y alcance',
  'workbench.docs.diagrams.openHeaders.shift.groupPrivacy': 'Privacidad y propiedad',
  'workbench.docs.diagrams.openHeaders.shift.groupCapability': 'Capacidades',
  'workbench.docs.diagrams.openHeaders.shift.groupSync': 'Sincronización y resiliencia',
  'workbench.docs.diagrams.openHeaders.shift.groupPricing': 'Precios y confianza',
  'workbench.docs.diagrams.openHeaders.shift.stampUnique': 'ÚNICO',
  'workbench.docs.diagrams.openHeaders.shift.stampUserControlled': 'TÚ DECIDES',
  'workbench.docs.diagrams.openHeaders.shift.stampNoGates': 'SIN BLOQUEOS',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserPrimary': 'Todo dentro del navegador',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserSub': 'back-end + front-end',
  'workbench.docs.diagrams.openHeaders.shift.usBrowserTag': '- en la extensión',
  'workbench.docs.diagrams.openHeaders.shift.themBrowserPrimary': 'Back-end fuera del navegador',
  'workbench.docs.diagrams.openHeaders.shift.themBrowserSub': 'app de escritorio / nube, requiere internet',
  'workbench.docs.diagrams.openHeaders.shift.usSelfHostPrimary': 'Back-end autoalojado',
  'workbench.docs.diagrams.openHeaders.shift.usSelfHostSub': 'navegador · app de escritorio · servidor · VM',
  'workbench.docs.diagrams.openHeaders.shift.themSelfHostPrimary': 'Solo su nube',
  'workbench.docs.diagrams.openHeaders.shift.themSelfHostSub': 'sin elegir dónde viven tus datos',
  'workbench.docs.diagrams.openHeaders.shift.usOfflinePrimary': 'Front-end nativo sin conexión',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineSub': 'extensión · escritorio · CLI · web',
  'workbench.docs.diagrams.openHeaders.shift.themOfflinePrimary': 'Front-end solo en la nube (online)',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineSub': 'necesita internet para llegar al back-end',
  'workbench.docs.diagrams.openHeaders.shift.usAccountPrimary': 'Sin cuenta',
  'workbench.docs.diagrams.openHeaders.shift.usAccountSub': 'sin inicio de sesión, sin muro de login',
  'workbench.docs.diagrams.openHeaders.shift.themAccountPrimary': 'Inicio de sesión obligatorio',
  'workbench.docs.diagrams.openHeaders.shift.themAccountSub': 'para usar tus propios datos',
  'workbench.docs.diagrams.openHeaders.shift.usLocalPrimary': 'Solo local',
  'workbench.docs.diagrams.openHeaders.shift.usLocalSub': 'sin relé en la nube',
  'workbench.docs.diagrams.openHeaders.shift.themLocalPrimary': 'Relevado por la nube',
  'workbench.docs.diagrams.openHeaders.shift.themLocalSub': 'tu tráfico pasa por ellos',
  'workbench.docs.diagrams.openHeaders.shift.usTrackingPrimary': 'Sin rastreo',
  'workbench.docs.diagrams.openHeaders.shift.usTrackingSub': 'contadores anónimos · un solo interruptor',
  'workbench.docs.diagrams.openHeaders.shift.themTrackingPrimary': 'Rastreado por defecto',
  'workbench.docs.diagrams.openHeaders.shift.themTrackingSub': 'datos de uso enviados a casa',
  'workbench.docs.diagrams.openHeaders.shift.usEnginePrimary': 'Motor de reglas',
  'workbench.docs.diagrams.openHeaders.shift.usEngineSub': 'interceptar y modificar solicitudes',
  'workbench.docs.diagrams.openHeaders.shift.themEnginePrimary': 'Sin motor en el navegador',
  'workbench.docs.diagrams.openHeaders.shift.themEngineSub': 'requiere proxy o app aparte',
  'workbench.docs.diagrams.openHeaders.shift.usCatalogPrimary': 'Catálogo de solicitudes API',
  'workbench.docs.diagrams.openHeaders.shift.usCatalogSub': 'HTTP, WS, GraphQL — todo en el navegador',
  'workbench.docs.diagrams.openHeaders.shift.themCatalogPrimary': 'Inicia sesión en una plataforma',
  'workbench.docs.diagrams.openHeaders.shift.themCatalogSub': 'e instala su app',
  'workbench.docs.diagrams.openHeaders.shift.usAutomatePrimary': 'Automatiza tu espacio de trabajo',
  'workbench.docs.diagrams.openHeaders.shift.usAutomateSub': 'tu agente de IA, local o remoto',
  'workbench.docs.diagrams.openHeaders.shift.usAutomateTag': '- tú decides',
  'workbench.docs.diagrams.openHeaders.shift.themAutomatePrimary': 'Privado o solo su IA en la nube',
  'workbench.docs.diagrams.openHeaders.shift.themAutomateSub': 'sin acceso abierto ni programático',
  'workbench.docs.diagrams.openHeaders.shift.usSyncPrimary': 'Motor de sincronización en tiempo real',
  'workbench.docs.diagrams.openHeaders.shift.usSyncSub': 'multidispositivo, navegador, superficie',
  'workbench.docs.diagrams.openHeaders.shift.themSyncPrimary': 'Gana la última escritura',
  'workbench.docs.diagrams.openHeaders.shift.themSyncSub': 'o ninguna sincronización',
  'workbench.docs.diagrams.openHeaders.shift.usSavePrimary': 'Guardado concurrente sin conflictos',
  'workbench.docs.diagrams.openHeaders.shift.usSaveSub': 'a nivel de campo, todo cambio se conserva',
  'workbench.docs.diagrams.openHeaders.shift.themSavePrimary': 'Sobrescritura a nivel de entidad',
  'workbench.docs.diagrams.openHeaders.shift.themSaveSub': 'los guardados se borran entre sí',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineEditPrimary': 'Funciona sin conexión, editable',
  'workbench.docs.diagrams.openHeaders.shift.usOfflineEditSub': 'sincroniza solo cuando vuelves',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineEditPrimary': 'Necesita conexión',
  'workbench.docs.diagrams.openHeaders.shift.themOfflineEditSub': 'o ningún acceso',
  'workbench.docs.diagrams.openHeaders.shift.usTierPrimary': 'Todo hoy, en cada nivel',
  'workbench.docs.diagrams.openHeaders.shift.usTierSub': 'gratis ≤ 6 usuarios · pago = asientos de equipo',
  'workbench.docs.diagrams.openHeaders.shift.themTierPrimary': 'Niveles con funciones bloqueadas',
  'workbench.docs.diagrams.openHeaders.shift.themTierSub': 'capacidades clave tras upsells',
  'workbench.docs.diagrams.openHeaders.shift.usSsoPrimary': 'SSO y seguridad siempre gratis',
  'workbench.docs.diagrams.openHeaders.shift.usSsoSub': 'SSO/OIDC · RBAC · auditoría · SIEM',
  'workbench.docs.diagrams.openHeaders.shift.themSsoPrimary': 'El impuesto SSO',
  'workbench.docs.diagrams.openHeaders.shift.themSsoSub': 'seguridad vendida como extra enterprise',
  'workbench.docs.diagrams.openHeaders.shift.usLapsePrimary': 'Un impago nunca te deja fuera',
  'workbench.docs.diagrams.openHeaders.shift.usLapseSub': 'gracia, luego nivel gratis — los datos son tuyos',
  'workbench.docs.diagrams.openHeaders.shift.themLapsePrimary': 'Deja de pagar, pierde el acceso',
  'workbench.docs.diagrams.openHeaders.shift.themLapseSub': 'muro de pago sobre tus propios datos',
  'workbench.docs.diagrams.openHeaders.shift.footer': 'Local-first. Por diseño. No como añadido.',

  // ── Open Headers: API catalog ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.apiCatalog.aria':
    'Catálogo de solicitudes API: maqueta estilizada de un editor de solicitud (selector de método, barra de URL, ' +
    'franja de pestañas y vista previa del cuerpo), más una franja de funciones que cubre protocolos, ' +
    'autenticación, scripts, variables, archivos, colecciones y cookies.',
  'workbench.docs.diagrams.openHeaders.apiCatalog.title': 'Catálogo de solicitudes API',
  'workbench.docs.diagrams.openHeaders.apiCatalog.subtitle':
    'Construcción, envío y gestión de colecciones — dentro de la extensión.',
  'workbench.docs.diagrams.openHeaders.apiCatalog.send': 'Enviar ▸',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabParams': 'Params',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabAuth': 'Autorización',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabHeaders': 'Encabezados',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabBody': 'Cuerpo',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabScripts': 'Scripts',
  'workbench.docs.diagrams.openHeaders.apiCatalog.tabSettings': 'Configuración',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featAuth': 'Auth',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featAuthSub': 'OAuth 2.0 · Basic · Bearer · clave API',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featScripts': 'Scripts',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featScriptsSub': 'pre-solicitud + pos-respuesta',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featVariables': 'Variables',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featVariablesSub': '5 ámbitos · diagnósticos estructurados',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featFiles': 'Archivos',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featFilesSub': 'multipart · resolución {{file.X}}',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCollections': 'Colecciones',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCollectionsSub': 'carpetas · entornos · por solicitud',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCookies': 'Cookies',
  'workbench.docs.diagrams.openHeaders.apiCatalog.featCookiesSub': 'credentialsMode opcional',
  'workbench.docs.diagrams.openHeaders.apiCatalog.kicker':
    'TODO LO QUE OFRECE UN CLIENTE API DE ESCRITORIO — EN LA EXTENSIÓN',
  'workbench.docs.diagrams.openHeaders.apiCatalog.footer': 'Una plataforma API completa — sin la plataforma.',

  // ── Open Headers: rule engine ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.ruleEngine.aria':
    'Motor de reglas de Open Headers: dos rutas de ejecución (DNR nativo e intercepción por script), nueve ' +
    'categorías de tipos de regla agrupadas por motor, más el lenguaje de condiciones compartido y la cadena de ' +
    'ámbitos de variables que consulta cada regla.',
  'workbench.docs.diagrams.openHeaders.ruleEngine.title': 'Motor de reglas',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subtitle': 'nativo MV3 · dos motores · nueve categorías de reglas',
  'workbench.docs.diagrams.openHeaders.ruleEngine.headerDnr': 'DNR · nativo',
  'workbench.docs.diagrams.openHeaders.ruleEngine.headerScript': 'Script · intercepción',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameHeaders': 'Encabezados',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subHeaders': 'Reemplazar · Anexar · Quitar',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameBlock': 'Bloquear',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subBlock': 'cancelar en la capa de red',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameRedirect': 'Redirigir',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subRedirect': 'URL estática o regex',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameQueryParams': 'Params de consulta',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subQueryParams': 'añadir · reemplazar · quitar · quitar todos',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameHeadersMerge': 'Encabezados (Fusionar)',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subHeadersMerge': 'concatenación de valores',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameInject': 'Inyectar',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subInject': 'JS o CSS, dos momentos',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameDelay': 'Retraso',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subDelay': 'navegación + fetch/XHR',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameRequestBody': 'Cuerpo de solicitud',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subRequestBody': 'estático · dinámico · filtro GraphQL',
  'workbench.docs.diagrams.openHeaders.ruleEngine.nameResponseBody': 'Cuerpo de respuesta',
  'workbench.docs.diagrams.openHeaders.ruleEngine.subResponseBody': 'cuerpo + estado + encabezados',
  'workbench.docs.diagrams.openHeaders.ruleEngine.captionDnr': 'capta cada solicitud emitida por el navegador',
  'workbench.docs.diagrams.openHeaders.ruleEngine.captionScript': 'capta los fetch / XHR iniciados por JS',
  'workbench.docs.diagrams.openHeaders.ruleEngine.conditionsKicker': 'UN SOLO LENGUAJE DE CONDICIONES',
  'workbench.docs.diagrams.openHeaders.ruleEngine.conditionsList':
    'Request Domains · URL Pattern · URL Regex · Métodos · Recurso · Iniciador · Encabezados · Tipo de dominio',
  'workbench.docs.diagrams.openHeaders.ruleEngine.scopesKicker': 'CINCO ÁMBITOS DE VARIABLES',
  'workbench.docs.diagrams.openHeaders.ruleEngine.footer':
    'Un motor. Dos rutas de ejecución. Condiciones y variables completas. Dentro de la extensión.',

  // ── Open Headers: convergence ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.convergence.aria':
    'Tres categorías de productos históricos (proxies de escritorio, plataformas API en la nube, extensiones de ' +
    'solo encabezados) convergen en una sola extensión Open Headers. Un navegador Chromium estilizado muestra la ' +
    'página workbench de la extensión abierta, y cada capacidad que aportaban las tres categorías vive dentro de ' +
    'esa única pestaña.',
  'workbench.docs.diagrams.openHeaders.convergence.title': 'Tres categorías de herramientas. Una extensión.',
  'workbench.docs.diagrams.openHeaders.convergence.subtitle':
    'Lo que exigía tres instalaciones separadas ahora vive en una sola pestaña.',
  'workbench.docs.diagrams.openHeaders.convergence.legacyProxies': 'Proxies de escritorio',
  'workbench.docs.diagrams.openHeaders.convergence.legacyProxiesSub': 'intercepción HTTP · cert CA · binario aparte',
  'workbench.docs.diagrams.openHeaders.convergence.legacyPlatforms': 'Plataformas API',
  'workbench.docs.diagrams.openHeaders.convergence.legacyPlatformsSub':
    'solicitudes + colecciones · en la nube · cuenta',
  'workbench.docs.diagrams.openHeaders.convergence.legacyExtensions': 'Extensiones de encabezados',
  'workbench.docs.diagrams.openHeaders.convergence.legacyExtensionsSub':
    'un solo tipo de regla · sin scripts · sin auth',
  'workbench.docs.diagrams.openHeaders.convergence.allInOneTab': '▼ TODO ABIERTO EN UNA SOLA PESTAÑA',
  'workbench.docs.diagrams.openHeaders.convergence.tabTitle': '#1 Open Headers',
  'workbench.docs.diagrams.openHeaders.convergence.workbenchSurface': 'la superficie workbench',
  'workbench.docs.diagrams.openHeaders.convergence.mv3Chip': 'nativo MV3',
  'workbench.docs.diagrams.openHeaders.convergence.pillRuleEngine': 'Motor de reglas',
  'workbench.docs.diagrams.openHeaders.convergence.pillApiCatalog': 'Catálogo de solicitudes API',
  'workbench.docs.diagrams.openHeaders.convergence.pillSync': 'Sincronización en tiempo real',
  'workbench.docs.diagrams.openHeaders.convergence.pillSave': 'Guardado sin conflictos',
  'workbench.docs.diagrams.openHeaders.convergence.pillNoAccount': 'Sin cuenta · sin inicio de sesión',
  'workbench.docs.diagrams.openHeaders.convergence.pillLocalOnly': 'Solo local · sin relé en la nube',
  'workbench.docs.diagrams.openHeaders.convergence.pillNoTracking': 'Sin rastreo · sin datos personales',
  'workbench.docs.diagrams.openHeaders.convergence.pillMultiSurface': 'UI multisuperficie',
  'workbench.docs.diagrams.openHeaders.convergence.footerStrip':
    'Multisuperficie · sincronización entre dispositivos · solo local por diseño',
  'workbench.docs.diagrams.openHeaders.convergence.caption':
    'Azul = capacidades · morado = postura · las ocho viven en una sola pestaña',

  // ── Open Headers: field sync ────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.fieldSync.aria':
    'Dos superficies editan la misma regla a la vez. DevTools añade, modifica y quita encabezados; el Workbench ' +
    'edita otros tres campos de la misma regla. Las seis ediciones aterrizan en la regla fusionada sin banner ni ' +
    'sobrescritura.',
  'workbench.docs.diagrams.openHeaders.fieldSync.title': 'Dos superficies, misma regla, ambas ediciones aterrizan',
  'workbench.docs.diagrams.openHeaders.fieldSync.subtitle':
    'Sincronización por campo — sin banner, sin sobrescritura, sin pérdidas',
  'workbench.docs.diagrams.openHeaders.fieldSync.surfaceA': 'superficie A',
  'workbench.docs.diagrams.openHeaders.fieldSync.surfaceB': 'superficie B',
  'workbench.docs.diagrams.openHeaders.fieldSync.editingHeaders': 'editando encabezados',
  'workbench.docs.diagrams.openHeaders.fieldSync.ruleX': 'Regla X',
  'workbench.docs.diagrams.openHeaders.fieldSync.headersTag': 'encabezados',
  'workbench.docs.diagrams.openHeaders.fieldSync.syncBand': 'MOTOR DE SINCRONIZACIÓN · fusión por campo',
  'workbench.docs.diagrams.openHeaders.fieldSync.mergedTag': 'instantánea fusionada · encabezados',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupAdded': 'Añadido',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupModified': 'Modificado',
  'workbench.docs.diagrams.openHeaders.fieldSync.groupRemoved': 'Quitado',
  'workbench.docs.diagrams.openHeaders.fieldSync.fromPrefix': '← desde ',
  'workbench.docs.diagrams.openHeaders.fieldSync.verdict1': '✓ ambas ediciones aplicadas — ni banner, ni conflicto',
  'workbench.docs.diagrams.openHeaders.fieldSync.verdict2':
    'El mismo camino escala: extensión hoy → extensión + escritorio + CLI mañana',

  // ── Open Headers: front-ends ────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.frontEnds.aria':
    'Elige tu front-end: cómo accedes a tus datos y los gestionas. Cuatro formatos apilados: extensión de ' +
    'navegador, app de escritorio, app CLI y app web. Cada tarjeta lista las superficies que expone, los ' +
    'back-ends a los que puede conectarse (la primera ficha es el predeterminado) y las plataformas donde corre.',
  'workbench.docs.diagrams.openHeaders.frontEnds.title': 'Elige tu front-end — tu acceso a tus datos',
  'workbench.docs.diagrams.openHeaders.frontEnds.subtitle':
    'Mismos datos, cualquier front-end — elige uno o todos, cada superficie sigue en sincronía.',
  'workbench.docs.diagrams.openHeaders.frontEnds.titleExtension': 'Extensión de navegador',
  'workbench.docs.diagrams.openHeaders.frontEnds.subExtension': 'dentro de un navegador',
  'workbench.docs.diagrams.openHeaders.frontEnds.subDesktop': 'ventana nativa',
  'workbench.docs.diagrams.openHeaders.frontEnds.subCli': 'línea de comandos',
  'workbench.docs.diagrams.openHeaders.frontEnds.titleWeb': 'App web',
  'workbench.docs.diagrams.openHeaders.frontEnds.subWeb': 'pestaña de navegador',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfPopup': 'Popup',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfSidePanel': 'Panel lateral',
  'workbench.docs.diagrams.openHeaders.frontEnds.surfCommandLine': 'Línea de comandos',
  'workbench.docs.diagrams.openHeaders.frontEnds.chipEmbedded': 'Integrado',
  'workbench.docs.diagrams.openHeaders.frontEnds.sectSurfaces': 'SUPERFICIES',
  'workbench.docs.diagrams.openHeaders.frontEnds.sectBackEnds': 'SE CONECTA AL BACK-END',
  'workbench.docs.diagrams.openHeaders.frontEnds.strip1': 'UN FRONT-END O TODOS — SON LOS MISMOS DATOS',
  'workbench.docs.diagrams.openHeaders.frontEnds.strip2':
    '✓ extensión · ✓ escritorio · ✓ CLI · ✓ web — todos leen las mismas entidades canónicas',
  'workbench.docs.diagrams.openHeaders.frontEnds.footer':
    'Mismos datos, llegues por donde llegues — cada superficie sigue en sincronía.',

  // ── Open Headers: local-first ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.localFirst.aria':
    'Elige tu back-end: dónde viven tus datos. Cuatro opciones de alojamiento apiladas. Cada nivel hereda todas ' +
    'las capacidades del anterior y añade nuevas, resaltadas en un rectángulo verde punteado. Una columna ' +
    'COMPATIBLE CON lista los navegadores, sistemas operativos y nubes de cada nivel. Los cuatro niveles son ' +
    'solo locales.',
  'workbench.docs.diagrams.openHeaders.localFirst.title': 'Elige tu back-end — dónde viven tus datos',
  'workbench.docs.diagrams.openHeaders.localFirst.subtitle':
    'Cada nivel hereda del anterior — el recuadro verde muestra lo nuevo — la columna derecha dice dónde corre.',
  'workbench.docs.diagrams.openHeaders.localFirst.subBrowser': 'service worker de la extensión',
  'workbench.docs.diagrams.openHeaders.localFirst.subDesktop': 'back-end integrado',
  'workbench.docs.diagrams.openHeaders.localFirst.subServer': 'proceso independiente',
  'workbench.docs.diagrams.openHeaders.localFirst.subVm': 'alójalo donde quieras',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletZeroSetup': 'cero configuración',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletSingleDevice': 'un solo dispositivo',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletPerBrowser': 'instancia por navegador',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiSurface': 'edición concurrente multisuperficie',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiWindow': 'edición concurrente multiventana',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletLocalhostOnly': 'solo localhost',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiBrowser': 'instancias multinavegador',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletPerApp': 'instancia por app',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletFilesystem': 'sistema de archivos nativo',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletYaml': 'YAML en disco',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletGit': 'integración git (local/remoto)',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMinimalSetup': 'configuración mínima',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletLan': 'accesible en LAN',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiApp': 'instancias multiapp',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletMultiDevice': 'varios dispositivos',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletFrontEnds': 'ext. de navegador · app escritorio · CLI',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletStandardSetup': 'configuración estándar',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletWan': 'accesible por WAN/Internet',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletTeamReady': 'listo para equipos',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletSso': 'auth SSO',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletRbac': 'gestión de usuarios RBAC',
  'workbench.docs.diagrams.openHeaders.localFirst.bulletAudit': 'registros de auditoría e informes',
  'workbench.docs.diagrams.openHeaders.localFirst.platAllOs': 'Todos los SO',
  'workbench.docs.diagrams.openHeaders.localFirst.platEmbedded': 'Integrado',
  'workbench.docs.diagrams.openHeaders.localFirst.platHyperscalers': 'Hiperescaladores',
  'workbench.docs.diagrams.openHeaders.localFirst.platEuNative': 'Nativos de la UE',
  'workbench.docs.diagrams.openHeaders.localFirst.platOther': 'Otros',
  'workbench.docs.diagrams.openHeaders.localFirst.platEnterprise': 'Enterprise',
  'workbench.docs.diagrams.openHeaders.localFirst.itemMiniPc': 'Mini PC',
  'workbench.docs.diagrams.openHeaders.localFirst.itemHomeServer': 'Servidor casero',
  'workbench.docs.diagrams.openHeaders.localFirst.itemOldLaptop': 'Portátil viejo',
  'workbench.docs.diagrams.openHeaders.localFirst.itemYourCloud': 'Tu nube',
  'workbench.docs.diagrams.openHeaders.localFirst.itemOnPrem': 'On-prem',
  'workbench.docs.diagrams.openHeaders.localFirst.inheritsFrom': 'HEREDA DE {tier}',
  'workbench.docs.diagrams.openHeaders.localFirst.newInTier': '+ NUEVO EN ESTE NIVEL',
  'workbench.docs.diagrams.openHeaders.localFirst.strip1': 'ELIJAS LO QUE ELIJAS — ES TUYO, DE EXTREMO A EXTREMO',
  'workbench.docs.diagrams.openHeaders.localFirst.strip2':
    '✓ sin cuenta · ✓ sin relé en la nube · ✓ sin rastreo · ✓ sin datos personales',
  'workbench.docs.diagrams.openHeaders.localFirst.footer': 'Tus datos, tu back-end, tu elección — en cada paso.',

  // ── Open Headers: comparison matrix ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.matrix.aria':
    'Cuatro tarjetas de categorías que comparan plataformas API SaaS, proxies de escritorio y extensiones de solo ' +
    'encabezados con Open Headers.',
  'workbench.docs.diagrams.openHeaders.matrix.title': 'DÓNDE SE SITÚA OPEN HEADERS',
  'workbench.docs.diagrams.openHeaders.matrix.catSaas': 'Plataformas API SaaS',
  'workbench.docs.diagrams.openHeaders.matrix.catProxies': 'Proxies de escritorio',
  'workbench.docs.diagrams.openHeaders.matrix.catHeaderOnly': 'Extensiones de solo encabezados',
  'workbench.docs.diagrams.openHeaders.matrix.tagCloud': 'nube',
  'workbench.docs.diagrams.openHeaders.matrix.tagNative': 'nativo',
  'workbench.docs.diagrams.openHeaders.matrix.tagLite': 'ligero',
  'workbench.docs.diagrams.openHeaders.matrix.tagUs': 'nosotros',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasData': 'Tus datos viven en sus servidores',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasAccount': 'Cuenta + inicio de sesión obligatorios',
  'workbench.docs.diagrams.openHeaders.matrix.rowSaasFeatures': 'Amplio conjunto de funciones',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyBinary': 'Binario aparte que instalar + ejecutar',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyCert': 'Cert CA + config de proxy por app',
  'workbench.docs.diagrams.openHeaders.matrix.rowProxyTraffic': 'Ve todo tipo de tráfico',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteNoSetup': 'En el navegador, sin configuración',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteOneRule': 'Un solo tipo de regla — solo encabezados',
  'workbench.docs.diagrams.openHeaders.matrix.rowLiteNoScripts': 'Sin scripts, sin auth, sin editar cuerpos',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsLocal': 'En el navegador · solo local · sin cuenta',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsNine': 'Nueve tipos de reglas · un lenguaje de condiciones',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsScripts': 'Scripts + OAuth + archivos en la extensión',
  'workbench.docs.diagrams.openHeaders.matrix.rowUsSurfaces': 'Cuatro superficies comparten los mismos datos',

  // ── Open Headers: vs cloud ──────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsCloud.aria':
    'Frente a las plataformas API en la nube. Estas guardan credenciales, definiciones de reglas y registros de ' +
    'solicitudes en un servidor del proveedor. Open Headers guarda los tres en tu dispositivo.',
  'workbench.docs.diagrams.openHeaders.vsCloud.title': 'Dónde acaban tus datos',
  'workbench.docs.diagrams.openHeaders.vsCloud.subtitle':
    'Credenciales, definiciones de reglas, registros de solicitudes — ¿en local o en remoto?',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowCredentials': 'credenciales',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowRules': 'reglas',
  'workbench.docs.diagrams.openHeaders.vsCloud.rowLogs': 'registros',
  'workbench.docs.diagrams.openHeaders.vsCloud.onDevice': 'en tu dispositivo',
  'workbench.docs.diagrams.openHeaders.vsCloud.onVendor': 'en su servidor',
  'workbench.docs.diagrams.openHeaders.vsCloud.cloudPlatform': 'Plataforma API en la nube',
  'workbench.docs.diagrams.openHeaders.vsCloud.you': 'tú',
  'workbench.docs.diagrams.openHeaders.vsCloud.yourData': 'tus datos',
  'workbench.docs.diagrams.openHeaders.vsCloud.cloud': 'nube',
  'workbench.docs.diagrams.openHeaders.vsCloud.yourDevice': 'tu dispositivo',
  'workbench.docs.diagrams.openHeaders.vsCloud.deviceContents': 'datos · reglas · logs',
  'workbench.docs.diagrams.openHeaders.vsCloud.allInOnePlace': 'todo en un solo lugar',
  'workbench.docs.diagrams.openHeaders.vsCloud.verdict': 'Tus datos nunca salen de tu máquina',

  // ── Open Headers: vs header-only ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.aria':
    'Frente a las extensiones de solo encabezados. Estas manejan un único tipo de regla. Open Headers maneja ' +
    'nueve — encabezados, bloquear, redirigir, params de consulta, fusión de encabezados, inyectar, retraso, ' +
    'cuerpo de solicitud, cuerpo de respuesta.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.title': 'Cuántos tipos de reglas',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.subtitle':
    'Una herramienta que hace una cosa — o una que hace nueve.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.headerOnlyExtension': 'Extensión de solo encabezados',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileHeaders': 'Encabezados',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileHeadersSub': 'reemplazar',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileBlock': 'Bloquear',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileBlockSub': 'cancelar',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileRedirect': 'Redirigir',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileRedirectSub': 'estática / regex',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileQuery': 'Params',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileQuerySub': 'añadir · quitar',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileMerge': 'Fusión',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileMergeSub': 'encabezados ⊕',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileInject': 'Inyectar',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileInjectSub': 'JS / CSS',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileDelay': 'Retraso',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileDelaySub': 'nav / fetch',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileReqBody': 'Cuerpo sol.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileReqBodySub': 'estático · din.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileResBody': 'Cuerpo resp.',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.tileResBodySub': 'cuerpo / estado',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.captionLeft': '¿Necesitas las otras 8? — instala otra extensión',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.captionRight':
    'Mismas condiciones, misma superficie, un solo espacio de trabajo',
  'workbench.docs.diagrams.openHeaders.vsHeaderOnly.verdict':
    'Nueve tipos de reglas, un lenguaje de condiciones, una superficie observable',

  // ── Open Headers: vs proxy ──────────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.vsProxy.aria':
    'Frente a los proxies de escritorio. Los proxies desvían el tráfico por un proceso aparte tras un certificado ' +
    'CA. Open Headers aplica las reglas en línea mediante las API nativas del navegador — sin puerto proxy y sin ' +
    'certificado.',
  'workbench.docs.diagrams.openHeaders.vsProxy.title': 'Cómo se moldean las solicitudes',
  'workbench.docs.diagrams.openHeaders.vsProxy.subtitle':
    'Reglas en línea en el navegador — sin puerto proxy, sin certificado CA, sin config por app.',
  'workbench.docs.diagrams.openHeaders.vsProxy.desktopProxy': 'Proxy de escritorio',
  'workbench.docs.diagrams.openHeaders.vsProxy.stampDetour': 'DESVÍO',
  'workbench.docs.diagrams.openHeaders.vsProxy.stampInline': 'EN LÍNEA',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeApp': 'App',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeAppSub': 'configurada',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodePortSub': 'puerto proxy',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeProxy': 'Proxy',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeProxySub': 'cert CA',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeInternet': 'Internet',
  'workbench.docs.diagrams.openHeaders.vsProxy.nodeBrowser': 'Navegador',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallBinary': 'instalar el binario',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallCert': 'instalar el cert CA',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipPerApp': 'config por app',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipInstallExtension': 'instalar la extensión',
  'workbench.docs.diagrams.openHeaders.vsProxy.chipThatsIt': 'y ya está',
  'workbench.docs.diagrams.openHeaders.vsProxy.verdict':
    'Una instalación · cero certificados · reglas con los permisos de la página',

  // ── Open Headers: roadmap CLI ───────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapCli.aria':
    'Hito de la hoja de ruta — CLI. Una ventana de terminal con comandos de ejemplo para listar reglas, cambiar ' +
    'de entorno y enviar una solicitud guardada — todos hablando con el mismo servidor que la UI.',
  'workbench.docs.diagrams.openHeaders.roadmapCli.title': 'CLI · scripting sin interfaz',
  'workbench.docs.diagrams.openHeaders.roadmapCli.subtitle':
    'El mismo servidor que la UI — la automatización va en sincronía con lo que ves.',
  'workbench.docs.diagrams.openHeaders.roadmapCli.termTitle': 'oh · terminal',
  'workbench.docs.diagrams.openHeaders.roadmapCli.comment': '# mismo servidor · mismo espacio de trabajo que la UI',
  'workbench.docs.diagrams.openHeaders.roadmapCli.verdict':
    'Listar · alternar · enviar · diff — directo desde la shell',

  // ── Open Headers: roadmap daemon ────────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapServer.aria':
    'Hito de la hoja de ruta — servidor local / LAN. Un servidor en el centro; extensión, app de escritorio y ' +
    'CLI se conectan como clientes a través de tu LAN.',
  'workbench.docs.diagrams.openHeaders.roadmapServer.title': 'Servidor local / LAN · un solo hub de sync',
  'workbench.docs.diagrams.openHeaders.roadmapServer.subtitle':
    'Extensión · escritorio · CLI — todos clientes del mismo servidor, todos en tu red.',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackWorkspaces': 'espacios de trabajo',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackRules': 'reglas · vault',
  'workbench.docs.diagrams.openHeaders.roadmapServer.stackSync': 'motor de sync',
  'workbench.docs.diagrams.openHeaders.roadmapServer.lanReachable': 'accesible en LAN',
  'workbench.docs.diagrams.openHeaders.roadmapServer.clientExtension': 'Ext. navegador',
  'workbench.docs.diagrams.openHeaders.roadmapServer.sideLaptop': 'portátil',
  'workbench.docs.diagrams.openHeaders.roadmapServer.sideWorkstation': 'estación de trabajo',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfExtension': 'Popup · Workbench · DevTools',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfDesktop': 'Workbench · multiventana',
  'workbench.docs.diagrams.openHeaders.roadmapServer.surfCli': 'cualquier equipo · $ oh rules · $ oh env',
  'workbench.docs.diagrams.openHeaders.roadmapServer.verdict': 'Un servidor · muchos clientes · se queda en tu red',

  // ── Open Headers: roadmap desktop app ───────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.aria':
    'Hito de la hoja de ruta — app de escritorio. La extensión de navegador y la app de escritorio nativa exponen ' +
    'la misma superficie Workbench sobre el mismo store en disco. La app de escritorio añade protocolos que una ' +
    'extensión de navegador no puede alojar de forma nativa: AI, MCP, gRPC, MQTT.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.title': 'Ventana nativa · mismo store · más alcance',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.subtitle':
    'Mismo Workbench, mismo workspace — el escritorio añade protocolos que el navegador no puede alojar.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.cardExtension': 'Extensión de navegador',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.tagToday': 'hoy',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerSurface': 'SUPERFICIE',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerFeatures': 'FUNCIONES',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.kickerApiCatalog': 'CATÁLOGO API',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featHttpRules': 'Interceptor',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featVariables': 'Variables',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featWorkflows': 'Workflows',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.featApiCatalog': 'Catálogo API',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.noteLocalRemote': 'local / remoto',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.desktopOnly': '+ SOLO ESCRITORIO',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.browserFeasible': 'Los cuatro caben en el navegador.',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.storePill': 'mismo store del espacio de trabajo en disco',
  'workbench.docs.diagrams.openHeaders.roadmapDesktop.verdict':
    'Un workspace, dos front-ends, el alcance extra donde el navegador no llega',

  // ── Open Headers: roadmap git workspaces ────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapGit.aria':
    'Hito de la hoja de ruta — espacios de trabajo en equipo vía Git. Dos dispositivos con un espacio de trabajo ' +
    'cada uno; ambos hacen push y pull contra un repositorio Git compartido. El repo es la capa de sync; sin ' +
    'servidor del proveedor en medio.',
  'workbench.docs.diagrams.openHeaders.roadmapGit.title': 'Espacios de trabajo como repositorios Git',
  'workbench.docs.diagrams.openHeaders.roadmapGit.subtitle':
    'pull sincroniza · push comparte · merge vía Git — sin servidor del proveedor.',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceA': 'dispositivo A',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceB': 'dispositivo B',
  'workbench.docs.diagrams.openHeaders.roadmapGit.workspace': 'Espacio de trabajo',
  'workbench.docs.diagrams.openHeaders.roadmapGit.deviceContents': 'reglas · entornos · vault',
  'workbench.docs.diagrams.openHeaders.roadmapGit.verdict': 'Tus datos, tu repositorio, tu historial auditable',

  // ── Open Headers: roadmap importers ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.roadmapImporters.aria':
    'Importadores. Seis formatos de origen desembocan en un solo espacio de trabajo Open Headers — cURL, ' +
    'encabezados HAR, Postman, solicitudes HAR completas, Insomnia, OpenAPI — todos disponibles hoy.',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.title': 'Importadores · tráete tu colección',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.subtitle':
    'cURL, HAR, Postman, Insomnia, OpenAPI, solicitudes HAR completas — todo disponible hoy.',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcHarNote': 'encabezados',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcPostman': 'Colección de Postman',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcHarFull': 'HAR completo',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcInsomnia': 'Colección de Insomnia',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.srcOpenApi': 'Espec. OpenAPI',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.tagToday': 'HOY',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.tagNext': 'PRÓXIMO',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.sideWorkspace': 'espacio de trabajo',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.kickerImported': 'IMPORTADO EN',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetRules': 'Interceptor',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetCollections': 'Colecciones de solicitudes API',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetEnvironments': 'Entornos',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.targetVault': 'Entradas de vault',
  'workbench.docs.diagrams.openHeaders.roadmapImporters.verdict': 'Tráelo todo en un paso — y sigue trabajando',

  // ── Open Headers: roadmap MCP architecture ──────────────────────────
  'workbench.docs.diagrams.openHeaders.mcpArch.aria':
    'Hito de la hoja de ruta — arquitectura del servidor MCP. Un cliente de IA se conecta a Open Headers mediante ' +
    'el Model Context Protocol (stdio en local, HTTP/SSE en remoto). El servidor MCP de OH modifica el espacio de ' +
    'trabajo del usuario; el resultado aparece en el Workbench.',
  'workbench.docs.diagrams.openHeaders.mcpArch.title': 'Servidor MCP · tu espacio de trabajo, cualquier cliente de IA',
  'workbench.docs.diagrams.openHeaders.mcpArch.subtitle':
    'Open Headers habla Model Context Protocol — cualquier agente compatible con MCP puede controlar tu espacio ' +
    'de trabajo.',
  'workbench.docs.diagrams.openHeaders.mcpArch.clientTitle': 'Cliente de IA',
  'workbench.docs.diagrams.openHeaders.mcpArch.clientSideTag': 'tu agente',
  'workbench.docs.diagrams.openHeaders.mcpArch.kickerAnyClient': 'CUALQUIER CLIENTE MCP',
  'workbench.docs.diagrams.openHeaders.mcpArch.serverTitle': 'Servidor MCP OH',
  'workbench.docs.diagrams.openHeaders.mcpArch.sideTagOpenHeaders': 'open headers',
  'workbench.docs.diagrams.openHeaders.mcpArch.kickerExposes': 'EXPONE',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeRules': 'Reglas · CRUD',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeRequests': 'Solicitudes API',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeEnvironments': 'Entornos',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeVariables': 'Variables · Vault',
  'workbench.docs.diagrams.openHeaders.mcpArch.exposeWorkflows': 'Workflows',
  'workbench.docs.diagrams.openHeaders.mcpArch.transportLocal': 'local',
  'workbench.docs.diagrams.openHeaders.mcpArch.transportRemote': 'remoto',
  'workbench.docs.diagrams.openHeaders.mcpArch.mutates': 'modifica',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbTitle': 'Workbench · tu espacio de trabajo',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbLive': 'en directo',
  'workbench.docs.diagrams.openHeaders.mcpArch.wbContents': 'reglas · entornos · variables · workflows · vault',
  'workbench.docs.diagrams.openHeaders.mcpArch.verdict':
    'Controla tu espacio de trabajo con cualquier agente de IA · local o remoto',

  // ── Open Headers: roadmap MCP tools ─────────────────────────────────
  'workbench.docs.diagrams.openHeaders.mcpTools.aria':
    'Hito de la hoja de ruta — catálogo de herramientas del servidor MCP. Siete dominios que exponen {n} ' +
    'herramientas en total: reglas, solicitudes, entornos, variables, workflows, espacios de trabajo, actividad.',
  'workbench.docs.diagrams.openHeaders.mcpTools.title': 'Qué puede hacer el agente de IA',
  'workbench.docs.diagrams.openHeaders.mcpTools.subtitle':
    'Siete dominios — CRUD completo donde tiene sentido, solo lectura acotada donde no.',
  'workbench.docs.diagrams.openHeaders.mcpTools.domRules': 'Reglas',
  'workbench.docs.diagrams.openHeaders.mcpTools.subRules': 'encab. · bloquear · redirigir · resp.',
  'workbench.docs.diagrams.openHeaders.mcpTools.domRequests': 'Solicitudes',
  'workbench.docs.diagrams.openHeaders.mcpTools.subRequests': 'Catálogo API',
  'workbench.docs.diagrams.openHeaders.mcpTools.domEnvironments': 'Entornos',
  'workbench.docs.diagrams.openHeaders.mcpTools.subEnvironments': 'por espacio de trabajo',
  'workbench.docs.diagrams.openHeaders.mcpTools.domVariables': 'Variables',
  'workbench.docs.diagrams.openHeaders.mcpTools.subVariables': 'todos los ámbitos · vault',
  'workbench.docs.diagrams.openHeaders.mcpTools.domWorkflows': 'Workflows',
  'workbench.docs.diagrams.openHeaders.mcpTools.subWorkflows': 'llamadas API encadenadas',
  'workbench.docs.diagrams.openHeaders.mcpTools.domWorkspaces': 'Espacios',
  'workbench.docs.diagrams.openHeaders.mcpTools.subWorkspaces': 'multiespacio',
  'workbench.docs.diagrams.openHeaders.mcpTools.toolsCount': '{n} HERRAM.',
  'workbench.docs.diagrams.openHeaders.mcpTools.toolsCountOne': '1 HERRAM.',
  'workbench.docs.diagrams.openHeaders.mcpTools.activityTitle': 'Actividad',
  'workbench.docs.diagrams.openHeaders.mcpTools.activityNote':
    'el feed de cambios — el agente ve qué cambió antes de actuar',
  'workbench.docs.diagrams.openHeaders.mcpTools.verdict':
    '{n} herramientas · siete dominios · toda la superficie de Open Headers',

  // ── Open Headers: roadmap milestones ────────────────────────────────
  'workbench.docs.diagrams.openHeaders.milestones.aria':
    'Hitos — tarjetas ordenadas dentro de una ventana de navegador: espacios de trabajo Git, app de escritorio, ' +
    'servidor MCP, servidor local, CLI, app web autoalojada, importadores — todos disponibles.',
  'workbench.docs.diagrams.openHeaders.milestones.chromeTitle': 'Cada superficie, entregada',
  'workbench.docs.diagrams.openHeaders.milestones.addrSubtitle':
    'Entregados en secuencia — solo-local siguió siendo el producto en cada hito.',
  'workbench.docs.diagrams.openHeaders.milestones.tagLive': 'DISPONIBLE',
  'workbench.docs.diagrams.openHeaders.milestones.badgeUserControlled': 'TÚ DECIDES',
  'workbench.docs.diagrams.openHeaders.milestones.msGit': 'Espacios de trabajo vía Git (listo para equipos)',
  'workbench.docs.diagrams.openHeaders.milestones.descGit':
    'YAML en un repo Git que tú controlas — pull, push, merge vía Git.',
  'workbench.docs.diagrams.openHeaders.milestones.descDesktop':
    'Binario nativo sobre el mismo store — llega adonde una extensión no puede.',
  'workbench.docs.diagrams.openHeaders.milestones.msMcp': 'Servidor MCP (control por agente de IA)',
  'workbench.docs.diagrams.openHeaders.milestones.descMcp':
    'Open Headers sobre MCP — deja que un agente de IA controle tu espacio de trabajo.',
  'workbench.docs.diagrams.openHeaders.milestones.msServer': 'Servidor local / LAN',
  'workbench.docs.diagrams.openHeaders.milestones.descServer':
    'Servidor en tu máquina o LAN — extensión, escritorio y CLI como clientes.',
  'workbench.docs.diagrams.openHeaders.milestones.descCli':
    'Scripting sin interfaz y CI — listar, alternar, enviar desde el shell.',
  'workbench.docs.diagrams.openHeaders.milestones.msVm': 'Despliegue en VM autoalojado + app web',
  'workbench.docs.diagrams.openHeaders.milestones.descVm':
    'Bundle web en tu VM — navegadores restringidos o despliegues con tu marca.',
  'workbench.docs.diagrams.openHeaders.milestones.msImporters': 'Más importadores',
  'workbench.docs.diagrams.openHeaders.milestones.descImporters':
    'Más allá de Postman — Insomnia, especificaciones OpenAPI, HAR completo.',
  'workbench.docs.diagrams.openHeaders.milestones.footer':
    'La sync entre usuarios llega vía Git y despliegues autoalojados — sin cloud del proveedor.',

  // ── Open Headers: roadmap web app ───────────────────────────────────
  'workbench.docs.diagrams.openHeaders.webApp.aria':
    'Hito de la hoja de ruta — app web autoalojada. Tu origen sirve el mismo bundle de UI; los usuarios la abren ' +
    'como una pestaña en un dominio que tú controlas. La misma superficie Workbench, sin extensión.',
  'workbench.docs.diagrams.openHeaders.webApp.title': 'Despliegue en VM autoalojado + app web',
  'workbench.docs.diagrams.openHeaders.webApp.subtitle':
    'Tu VM sirve el bundle web — tu origen, tu dominio, tus usuarios.',
  'workbench.docs.diagrams.openHeaders.webApp.serves': 'sirve',
  'workbench.docs.diagrams.openHeaders.webApp.chromeTitle': 'Open Headers · web',
  'workbench.docs.diagrams.openHeaders.webApp.bodySub': 'la misma superficie que extensión + escritorio',
  'workbench.docs.diagrams.openHeaders.webApp.verdict': 'La misma UI · tu origen · sin extensión',

  // ── Root shared — kickers recurring across root-level diagrams ──────
  'workbench.docs.diagrams.shared.ruleKicker': 'REGLA',
  'workbench.docs.diagrams.shared.useCasesKicker': 'CASOS DE USO COMUNES',
  'workbench.docs.diagrams.shared.wontFireKicker': 'CUANDO NO SE DISPARA',
  'workbench.docs.diagrams.shared.suggestion': 'Sugerencia',
  'workbench.docs.diagrams.shared.beforeKicker': 'ANTES',
  'workbench.docs.diagrams.shared.afterKicker': 'DESPUÉS',

  // ── Block ───────────────────────────────────────────────────────────
  'workbench.docs.diagrams.block.aria':
    'Bloquear cancela las solicitudes coincidentes en la capa de red — la página ve un error de red. Un bloqueo ' +
    'main_frame muestra ERR_BLOCKED_BY_CLIENT; un bloqueo de subrecurso falla en silencio.',
  'workbench.docs.diagrams.block.rule': 'Block · Request Domains: ads.openheaders.com',
  'workbench.docs.diagrams.block.pageTitle': 'Página',
  'workbench.docs.diagrams.block.dnrBlock': 'Bloqueo DNR',
  'workbench.docs.diagrams.block.network': 'Red',
  'workbench.docs.diagrams.block.neverReached': 'nunca se alcanza',
  'workbench.docs.diagrams.block.requestCancelled': 'solicitud cancelada',
  'workbench.docs.diagrams.block.pageSeesKicker': 'LO QUE VE LA PÁGINA',
  'workbench.docs.diagrams.block.chromeBlockPage': 'página de bloqueo de Chrome',
  'workbench.docs.diagrams.block.silentFailure': 'Fallo silencioso',
  'workbench.docs.diagrams.block.pageHandlesError': 'la página gestiona su propio error',
  'workbench.docs.diagrams.block.useCasesAria':
    'Bloquear — casos de uso comunes: anuncios y trackers, simular una caída, denegar un endpoint y bloqueo ' +
    'solo de página.',
  'workbench.docs.diagrams.block.card1Title': 'Anuncios y trackers',
  'workbench.docs.diagrams.block.card1Example': 'Bloquear ads.openheaders.com',
  'workbench.docs.diagrams.block.card2Title': 'Simular una caída',
  'workbench.docs.diagrams.block.card2Example': 'Poner un host offline',
  'workbench.docs.diagrams.block.card3Title': 'Denegar endpoint',
  'workbench.docs.diagrams.block.card3Example': 'Bloquear solo /api/admin',
  'workbench.docs.diagrams.block.card4Title': 'Bloqueo solo de página',
  'workbench.docs.diagrams.block.card4Example': 'Añadir condición main_frame',
  'workbench.docs.diagrams.block.useCasesFooter': 'Combina Bloquear con condiciones para acotar el alcance.',
  'workbench.docs.diagrams.block.wontApplyAria':
    'Bloquear no cancela retroactivamente los recursos ya cargados. Recarga la página tras activar la regla ' +
    'para capturar las solicitudes futuras.',
  'workbench.docs.diagrams.block.alreadyLoaded': 'Recursos ya cargados',
  'workbench.docs.diagrams.block.alreadyLoadedSub': 'Solo se intercepta lo futuro — lo ya cargado permanece.',
  'workbench.docs.diagrams.block.suggestionText': 'Recarga la página tras activar la regla.',

  // ── Redirect ────────────────────────────────────────────────────────
  'workbench.docs.diagrams.redirect.staticAria':
    'Redirección estática — cada solicitud coincidente se reescribe a la misma URL de destino.',
  'workbench.docs.diagrams.redirect.ruleStatic': 'Redirect → https://openheaders.com/new-page',
  'workbench.docs.diagrams.redirect.originalRequestKicker': 'SOLICITUD ORIGINAL',
  'workbench.docs.diagrams.redirect.urlRewritten': 'URL reescrita',
  'workbench.docs.diagrams.redirect.redirectedToKicker': 'REDIRIGIDO A',
  'workbench.docs.diagrams.redirect.staticStamp': 'Cada coincidencia → la misma URL de destino.',
  'workbench.docs.diagrams.redirect.staticStampSub':
    'El navegador actúa como si el servidor devolviera una redirección.',
  'workbench.docs.diagrams.redirect.regexAria':
    'Redirección por regex — los grupos de captura del patrón de URL se referencian como \\1, \\2 en la URL ' +
    'de destino.',
  'workbench.docs.diagrams.redirect.ruleRegexLine1': 'URL Regex: ^http://(openheaders\\.io/.*)$',
  'workbench.docs.diagrams.redirect.ruleRegexLine2': 'Redirect → https://\\1',
  'workbench.docs.diagrams.redirect.originalUrlKicker': 'URL ORIGINAL',
  'workbench.docs.diagrams.redirect.captureChip': '\\1 = openheaders.com/page',
  'workbench.docs.diagrams.redirect.substituted': '\\1 sustituido',
  'workbench.docs.diagrams.redirect.regexStamp': '\\1 hereda lo que coincidió en el grupo de captura.',
  'workbench.docs.diagrams.redirect.useCasesAria':
    'Redirigir — casos de uso comunes: subida HTTP→HTTPS, migración de dominio, reescritura de ruta, proxy ' +
    'de dev local.',
  'workbench.docs.diagrams.redirect.card1Example': 'Forzar todo http a https',
  'workbench.docs.diagrams.redirect.card2Title': 'Migración de dominio',
  'workbench.docs.diagrams.redirect.card3Title': 'Reescritura de ruta',
  'workbench.docs.diagrams.redirect.card4Title': 'Proxy de dev local',
  'workbench.docs.diagrams.redirect.useCasesFooter': 'Usa Regex de URL con backreferences para conservar la ruta.',
  'workbench.docs.diagrams.redirect.wontApplyAria':
    'Redirigir no se aplica retroactivamente a páginas cargadas, y Chrome limita los bucles de redirección.',
  'workbench.docs.diagrams.redirect.pageLoaded': 'Página ya cargada',
  'workbench.docs.diagrams.redirect.pageLoadedSub': 'Solo se interceptan las navegaciones y fetch futuros.',
  'workbench.docs.diagrams.redirect.loops': 'Bucles de redirección',
  'workbench.docs.diagrams.redirect.loopsSub': 'Chrome lo limita — ERR_TOO_MANY_REDIRECTS.',
  'workbench.docs.diagrams.redirect.suggestionText': 'Recarga. Asegúrate de que las condiciones no formen bucle.',

  // ── Inject JS / CSS ─────────────────────────────────────────────────
  'workbench.docs.diagrams.inject.timingAria':
    'Momento de inyección — Lo antes posible corre antes de los scripts; Tras la carga corre con el DOM ' +
    'analizado.',
  'workbench.docs.diagrams.inject.timeAxis': 'tiempo →',
  'workbench.docs.diagrams.inject.navigation': 'navegación',
  'workbench.docs.diagrams.inject.domParsed': 'DOM analizado',
  'workbench.docs.diagrams.inject.loadEvent': 'evento load',
  'workbench.docs.diagrams.inject.asap': 'Lo antes posible',
  'workbench.docs.diagrams.inject.prePageScript': 'antes de los scripts',
  'workbench.docs.diagrams.inject.afterLoad': 'Tras la carga',
  'workbench.docs.diagrams.inject.domSafe': 'seguro para el DOM',
  'workbench.docs.diagrams.inject.timingFooter': 'Lo antes posible para races · Tras la carga para el DOM',
  'workbench.docs.diagrams.inject.scriptAria':
    'Inyección de script — el JavaScript corre dentro de la página, Lo antes posible (antes de los scripts) ' +
    'o Tras la carga (seguro para el DOM).',
  'workbench.docs.diagrams.inject.ruleScript': 'Script (ASAP): trazar cada llamada fetch',
  'workbench.docs.diagrams.inject.injectedComment': '<script> // inyectado por la extensión',
  'workbench.docs.diagrams.inject.runsInPage': 'Corre en la página — mismas globales que su JS.',
  'workbench.docs.diagrams.inject.scriptFooter':
    'Lo antes posible gana races a la app; Tras la carga lee el DOM listo.',
  'workbench.docs.diagrams.inject.cssAria':
    'Inyección CSS — se añade una etiqueta <style> al head de la página, ocultando el banner.',
  'workbench.docs.diagrams.inject.ruleCss': 'CSS: header.banner { display: none }',
  'workbench.docs.diagrams.inject.ruleApplied1': 'regla',
  'workbench.docs.diagrams.inject.ruleApplied2': 'activa',
  'workbench.docs.diagrams.inject.hidden': '(oculto)',
  'workbench.docs.diagrams.inject.cssFooter':
    'Inyectado como <style> — la misma especificidad que el CSS de la página.',
  'workbench.docs.diagrams.inject.wontApplyAria':
    'Inyectar no se aplica a iframes en sandbox ni a páginas cuya CSP estricta bloquea los scripts inline.',
  'workbench.docs.diagrams.inject.sandboxed': 'Iframes en sandbox',
  'workbench.docs.diagrams.inject.sandboxedSub': 'Páginas con sandbox="" que desactiva los scripts.',
  'workbench.docs.diagrams.inject.strictCsp': "CSP estricta (script-src 'self')",
  'workbench.docs.diagrams.inject.strictCspSub': 'Los scripts inline inyectados los bloquea la página.',
  'workbench.docs.diagrams.inject.suggestionText': 'Inyecta en la página padre; postMessage hacia el iframe.',
  'workbench.docs.diagrams.inject.useCasesAria':
    'Inyectar JS / CSS — casos de uso comunes: monkey-patch, modo oscuro, ocultar elementos, feature flags.',
  'workbench.docs.diagrams.inject.card1Title': 'Monkey-patch',
  'workbench.docs.diagrams.inject.card1Example': 'Envolver fetch / XHR (ASAP)',
  'workbench.docs.diagrams.inject.card2Title': 'Modo oscuro',
  'workbench.docs.diagrams.inject.card2Example': 'Forzar un tema CSS',
  'workbench.docs.diagrams.inject.card3Title': 'Ocultar ruido',
  'workbench.docs.diagrams.inject.card3Example': 'Banners con display: none',
  'workbench.docs.diagrams.inject.card4Title': 'Feature flags',
  'workbench.docs.diagrams.inject.card4Example': 'Flags en window cuanto antes',
  'workbench.docs.diagrams.inject.useCasesFooter':
    'Lo antes posible para correr primero; Tras la carga para leer el DOM.',

  // ── Delay ───────────────────────────────────────────────────────────
  'workbench.docs.diagrams.delay.routingAria':
    'Enrutado del retraso entre navegación, fetch y subrecursos — solo las dos primeras vías se interceptan; ' +
    'los subrecursos pasan.',
  'workbench.docs.diagrams.delay.matchedRequest': 'Coincidencia',
  'workbench.docs.diagrams.delay.document': 'Documento',
  'workbench.docs.diagrams.delay.documentSub': 'nav de iframe',
  'workbench.docs.diagrams.delay.navCap': '≤ 30,000 ms',
  'workbench.docs.diagrams.delay.viaWaitingPage': 'vía página de espera',
  'workbench.docs.diagrams.delay.fetchXhr': 'Fetch / XHR',
  'workbench.docs.diagrams.delay.jsInitiated': 'iniciado por JS',
  'workbench.docs.diagrams.delay.xhrCap': '≤ 5,000 ms',
  'workbench.docs.diagrams.delay.monkeyPatched': 'con monkey-patch',
  'workbench.docs.diagrams.delay.subResource': 'Subrecurso',
  'workbench.docs.diagrams.delay.subResourceSub': 'img / css / js',
  'workbench.docs.diagrams.delay.notDelayed': 'sin retraso',
  'workbench.docs.diagrams.delay.passesThrough': 'pasa de largo',
  'workbench.docs.diagrams.delay.routingFooter': 'Límites mayores requieren un proxy local real',
  'workbench.docs.diagrams.delay.navAria':
    'Retraso de navegación — el navegador se redirige a una página de espera local que retiene N ms antes de ' +
    'reenviar a la URL de destino real.',
  'workbench.docs.diagrams.delay.ruleNav': 'Delay 8,000 ms · navegación de página',
  'workbench.docs.diagrams.delay.click': 'Clic',
  'workbench.docs.diagrams.delay.waitingPage': 'Página de espera',
  'workbench.docs.diagrams.delay.holds8s': '⏱ retiene 8 s',
  'workbench.docs.diagrams.delay.loadsNow': 'carga ahora',
  'workbench.docs.diagrams.delay.navStamp': 'Se respeta hasta 30,000 ms — el techo de redirección de Chrome.',
  'workbench.docs.diagrams.delay.navStampSub': 'Implementado como redirección DNR a una página de espera local.',
  'workbench.docs.diagrams.delay.xhrAria':
    'Retraso de fetch/XHR iniciados por JS — un setTimeout con monkey-patch retiene la resolución. Limitado ' +
    'a 5000 ms.',
  'workbench.docs.diagrams.delay.ruleXhr': 'Delay 3,000 ms · fetch / XHR de JS',
  'workbench.docs.diagrams.delay.intercept': 'intercepta',
  'workbench.docs.diagrams.delay.network': 'red',
  'workbench.docs.diagrams.delay.hold3000': 'espera de 3,000 ms',
  'workbench.docs.diagrams.delay.realRequest': 'solicitud real',
  'workbench.docs.diagrams.delay.responseDelayed': 'respuesta (retrasada 3 s)',
  'workbench.docs.diagrams.delay.xhrStamp': 'Limitado a 5,000 ms — los valores mayores se recortan al techo.',
  'workbench.docs.diagrams.delay.wontApplyAria':
    'El retraso no se aplica a subrecursos (img/css/js) ni a fetch de service worker que esquivan el parche ' +
    'de página.',
  'workbench.docs.diagrams.delay.subResources': 'Subrecursos (img, css, js, fonts)',
  'workbench.docs.diagrams.delay.subResourcesSub': 'Los emite el navegador — ningún monkey-patch puede retenerlos.',
  'workbench.docs.diagrams.delay.swFetches': 'Fetch de service worker',
  'workbench.docs.diagrams.delay.swFetchesSub': 'Corren en otro scope; los parches de página no llegan.',
  'workbench.docs.diagrams.delay.suggestionText': 'El throttling de subrecursos llega con la app de escritorio.',
  'workbench.docs.diagrams.delay.useCasesAria':
    'Retraso — casos de uso comunes: QA de estados de carga, pruebas de debounce, descubrir races, simular ' +
    'red lenta.',
  'workbench.docs.diagrams.delay.card1Title': 'Estados de carga',
  'workbench.docs.diagrams.delay.card1Example': 'Ver los spinners con fiabilidad',
  'workbench.docs.diagrams.delay.card2Title': 'Pruebas de debounce',
  'workbench.docs.diagrams.delay.card2Example': 'Probar límites de tecleo',
  'workbench.docs.diagrams.delay.card3Title': 'Race conditions',
  'workbench.docs.diagrams.delay.card3Example': 'Ver el orden de solicitudes',
  'workbench.docs.diagrams.delay.card4Title': 'Simular red lenta',
  'workbench.docs.diagrams.delay.card4Example': 'Latencia aproximada tipo 3G',
  'workbench.docs.diagrams.delay.useCasesFooter': 'Recursos estáticos: hace falta un proxy real, no una extensión.',

  // ── Query Params ────────────────────────────────────────────────────
  'workbench.docs.diagrams.queryParams.ruleAdd': 'Add / Replace · debug = true',
  'workbench.docs.diagrams.queryParams.addArrow': 'parámetro añadido o reemplazado',
  'workbench.docs.diagrams.queryParams.addStamp': 'Añade si falta, reemplaza si ya está.',
  'workbench.docs.diagrams.queryParams.replaceOnlyAria':
    'Solo reemplazar — reemplaza el valor de los parámetros existentes, pero deja intactas las URL sin el ' +
    'parámetro.',
  'workbench.docs.diagrams.queryParams.ruleReplaceOnly': 'Replace only · region = eu',
  'workbench.docs.diagrams.queryParams.present': 'Presente',
  'workbench.docs.diagrams.queryParams.presentSub': 'el parámetro ya está',
  'workbench.docs.diagrams.queryParams.absent': 'Ausente',
  'workbench.docs.diagrams.queryParams.absentSub': 'sin parámetro region',
  'workbench.docs.diagrams.queryParams.valueReplaced': 'valor reemplazado',
  'workbench.docs.diagrams.queryParams.unchanged': 'sin cambios',
  'workbench.docs.diagrams.queryParams.replaceOnlyStamp':
    'Reemplaza, nunca añade — las URL sin el parámetro pasan tal cual.',
  'workbench.docs.diagrams.queryParams.ruleRemove': 'Remove · utm_source',
  'workbench.docs.diagrams.queryParams.removeArrow': 'parámetro eliminado',
  'workbench.docs.diagrams.queryParams.removeStamp': 'El parámetro nombrado se quita; todo lo demás pasa tal cual.',
  'workbench.docs.diagrams.queryParams.ruleRemoveAll': 'Remove All',
  'workbench.docs.diagrams.queryParams.noQueryString': '(sin cadena de consulta)',
  'workbench.docs.diagrams.queryParams.removeAllArrow': 'cadena de consulta eliminada',
  'workbench.docs.diagrams.queryParams.removeAllStamp': 'Toda la cadena de consulta se quita en un solo paso.',
  'workbench.docs.diagrams.queryParams.wontApplyAria':
    'Trampa de los parámetros de consulta — Quitar todo no puede combinarse con Añadir / Reemplazar en la ' +
    'misma regla.',
  'workbench.docs.diagrams.queryParams.watchForKicker': 'A QUÉ ESTAR ATENTO',
  'workbench.docs.diagrams.queryParams.combining': 'Combinar Quitar todo con Añadir / Reemplazar',
  'workbench.docs.diagrams.queryParams.combiningSub':
    'DNR rechaza reglas que vacían la consulta y añaden parámetros nuevos.',
  'workbench.docs.diagrams.queryParams.suggestionText':
    'Usa dos reglas — primero Quitar todo, luego Añadir / Reemplazar.',
  'workbench.docs.diagrams.queryParams.suggestionSub':
    'El orden de las reglas importa; ambas deben coincidir con la misma solicitud.',
  'workbench.docs.diagrams.queryParams.useCasesAria':
    'Parámetros de consulta — casos de uso comunes: forzar un flag, canonizar un valor, quitar trackers, ' +
    'quitarlo todo en modo privado.',
  'workbench.docs.diagrams.queryParams.card1Title': 'Forzar un flag',
  'workbench.docs.diagrams.queryParams.card1Example': 'Añadir debug=true',
  'workbench.docs.diagrams.queryParams.card2Title': 'Canonizar',
  'workbench.docs.diagrams.queryParams.card2Example': 'Reemplazar solo region',
  'workbench.docs.diagrams.queryParams.card3Title': 'Quitar trackers',
  'workbench.docs.diagrams.queryParams.card3Example': 'Quitar params utm_*',
  'workbench.docs.diagrams.queryParams.card4Title': 'Modo privado',
  'workbench.docs.diagrams.queryParams.card4Example': 'Vaciar la cadena de consulta',
  'workbench.docs.diagrams.queryParams.useCasesFooter':
    'Combina Patrón de URL o Dominios para acotar a rutas concretas.',

  // ── Request Body ────────────────────────────────────────────────────
  'workbench.docs.diagrams.requestBody.interceptAria':
    'Pipeline de interceptación del cuerpo — la llamada de page.js entra en la interceptación del motor de ' +
    'scripts, se ramifica en transformaciones Estático / Dinámico / GraphQL y sale hacia la red real.',
  'workbench.docs.diagrams.requestBody.pageSub': 'llamada fetch / XHR',
  'workbench.docs.diagrams.requestBody.intercept': 'Interceptación',
  'workbench.docs.diagrams.requestBody.interceptSub': 'monkey-patch de la extensión',
  'workbench.docs.diagrams.requestBody.branchStatic': 'Estático',
  'workbench.docs.diagrams.requestBody.branchStaticSub1': 'reemplaza el cuerpo',
  'workbench.docs.diagrams.requestBody.branchStaticSub2': 'por completo',
  'workbench.docs.diagrams.requestBody.branchDynamic': 'Dinámico',
  'workbench.docs.diagrams.requestBody.branchDynamicSub1': 'fn(orig) →',
  'workbench.docs.diagrams.requestBody.branchDynamicSub2': 'cuerpo modificado',
  'workbench.docs.diagrams.requestBody.branchGraphqlSub1': '¿op coincide? →',
  'workbench.docs.diagrams.requestBody.branchGraphqlSub2': 'aplica : omite',
  'workbench.docs.diagrams.requestBody.realNetwork': 'red real',
  'workbench.docs.diagrams.requestBody.originalBodyKicker': 'CUERPO ORIGINAL',
  'workbench.docs.diagrams.requestBody.bodySentKicker': 'CUERPO ENVIADO',
  'workbench.docs.diagrams.requestBody.ruleStatic': 'Static body: { "userId": "test-1" }',
  'workbench.docs.diagrams.requestBody.staticArrow': 'cuerpo sustituido por completo',
  'workbench.docs.diagrams.requestBody.staticStamp': 'Cuerpo entero reemplazado; la regla nunca mira el original.',
  'workbench.docs.diagrams.requestBody.ruleDynamic': 'Dynamic body: fn(orig) → sellado',
  'workbench.docs.diagrams.requestBody.fnReads': '→ fn lee y reescribe',
  'workbench.docs.diagrams.requestBody.dynamicArrow': 'la función transforma',
  'workbench.docs.diagrams.requestBody.dynamicStamp': 'La función recibe el original; devuelve el cuerpo nuevo.',
  'workbench.docs.diagrams.requestBody.graphqlAria':
    'Filtro GraphQL — la regla solo se dispara cuando el campo nombrado del cuerpo JSON coincide. Las demás ' +
    'operaciones pasan intactas.',
  'workbench.docs.diagrams.requestBody.ruleGraphql': 'GraphQL: operationName Equals "GetUser"',
  'workbench.docs.diagrams.requestBody.ruleGraphqlAction': '→ sustitución de cuerpo estático',
  'workbench.docs.diagrams.requestBody.match': 'Coincide',
  'workbench.docs.diagrams.requestBody.noMatch': 'No coincide',
  'workbench.docs.diagrams.requestBody.noMatchSub': 'cualquier otra operación',
  'workbench.docs.diagrams.requestBody.ruleFires': 'la regla se dispara',
  'workbench.docs.diagrams.requestBody.passesThrough': 'pasa de largo',
  'workbench.docs.diagrams.requestBody.graphqlStamp': 'Filtro a nivel de campo — solo las op que coinciden.',
  'workbench.docs.diagrams.requestBody.graphqlStampSub': 'Campos ausentes o cuerpos no JSON: la regla se omite.',
  'workbench.docs.diagrams.requestBody.wontApplyAria':
    'Las reglas de cuerpo solo se disparan en fetch/XHR iniciados por JS con cuerpo. GET y HEAD no tienen ' +
    'nada que reemplazar; los recursos estáticos nunca entran en la interceptación de scripts.',
  'workbench.docs.diagrams.requestBody.getHead': 'Solicitudes GET / HEAD',
  'workbench.docs.diagrams.requestBody.getHeadSub': 'Sin cuerpo según la spec — nada que reemplazar.',
  'workbench.docs.diagrams.requestBody.staticResources': 'Recursos estáticos (img, script, link)',
  'workbench.docs.diagrams.requestBody.staticResourcesSub': 'Los emite el navegador — nunca pasan por fetch / XHR.',
  'workbench.docs.diagrams.requestBody.suggestionText':
    'Confirma que la solicitud es un POST/PUT/PATCH del JS de la página.',
  'workbench.docs.diagrams.requestBody.useCasesAria':
    'Cuerpo de solicitud — casos de uso comunes: fixtures de prueba, sellado de metadatos, mock de una ' +
    'operación GraphQL, anonimización de PII.',
  'workbench.docs.diagrams.requestBody.card1Title': 'Fixtures de prueba',
  'workbench.docs.diagrams.requestBody.card1Example': 'Forzar un payload conocido',
  'workbench.docs.diagrams.requestBody.card2Title': 'Sellar metadatos',
  'workbench.docs.diagrams.requestBody.card2Example': 'Añadir debug: true',
  'workbench.docs.diagrams.requestBody.card3Title': 'Ops GraphQL',
  'workbench.docs.diagrams.requestBody.card3Example': 'Mockear un operationName',
  'workbench.docs.diagrams.requestBody.card4Title': 'Moldear replays',
  'workbench.docs.diagrams.requestBody.card4Example': 'Anonimizar campos PII',
  'workbench.docs.diagrams.requestBody.useCasesFooter':
    'Solo motor de scripts — aplica a fetch / XHR iniciados por JS.',

  // ── Sequence primitives ─────────────────────────────────────────────
  'workbench.docs.diagrams.sequence.later': 'más tarde',

  // ── Debug mode ──────────────────────────────────────────────────────
  'workbench.docs.diagrams.debugMode.surfaceAria':
    'El modo de depuración vive en el pie — un interruptor en línea lo activa; el punto y la etiqueta abren ' +
    'un popover con el alcance, el pin por pestaña y la lista de pestañas adjuntas.',
  'workbench.docs.diagrams.debugMode.surfaceTitle': 'El modo de depuración vive en el pie',
  'workbench.docs.diagrams.debugMode.surfaceCaption': 'El interruptor lo activa · punto + etiqueta abren el popover.',
  'workbench.docs.diagrams.debugMode.debugMode': 'Modo de depuración',
  'workbench.docs.diagrams.debugMode.systemStatus': 'Estado del sistema',
  'workbench.docs.diagrams.debugMode.inspectLabel': 'Inspeccionar',
  'workbench.docs.diagrams.debugMode.scopeBoth': 'Ambas ▾',
  'workbench.docs.diagrams.debugMode.includeThisTab': 'Incluir esta pestaña',
  'workbench.docs.diagrams.debugMode.attachedTabs': 'Pestañas adjuntas (1)',
  'workbench.docs.diagrams.debugMode.tabRow': 'Pestaña #11 · example.com',
  'workbench.docs.diagrams.debugMode.scopeAria':
    'El conjunto adjunto se deriva: el alcance elegido unido a las pestañas fijadas, intersectado con el ' +
    'interruptor maestro. Con el modo apagado, nada se adjunta.',
  'workbench.docs.diagrams.debugMode.scopeTitle': 'Qué se adjunta',
  'workbench.docs.diagrams.debugMode.scopeFormula': '( alcance ∪ pines ) ∩ interruptor maestro',
  'workbench.docs.diagrams.debugMode.inspectBoth': 'Inspeccionar: Ambas',
  'workbench.docs.diagrams.debugMode.devtoolsUnion': 'DevTools ∪ pestaña con foco',
  'workbench.docs.diagrams.debugMode.pinnedTab': 'Fijada: Pestaña #11',
  'workbench.docs.diagrams.debugMode.candidates': 'candidatas',
  'workbench.docs.diagrams.debugMode.gateLabel': '∩ Depuración ON',
  'workbench.docs.diagrams.debugMode.attached': 'Adjuntas',
  'workbench.docs.diagrams.debugMode.attachedTab1': 'Pestaña #7',
  'workbench.docs.diagrams.debugMode.attachedTab2': 'Pestaña #11',
  'workbench.docs.diagrams.debugMode.scopeFooter1': 'Depuración OFF → nada se adjunta, sea cual sea el alcance.',
  'workbench.docs.diagrams.debugMode.scopeFooter2': 'Re-adjuntar reproduce desde aquí — nunca una instantánea.',
  'workbench.docs.diagrams.debugMode.reachAria':
    'El modo estándar solo alcanza fetch y XHR de la página. Una pestaña adjunta en modo de depuración ' +
    'alcanza además navegaciones, workers, iframes cross-origin y el entorno de la pestaña.',
  'workbench.docs.diagrams.debugMode.reachTitle': 'Qué puede tocar cada modo',
  'workbench.docs.diagrams.debugMode.standardMode': 'Modo estándar',
  'workbench.docs.diagrams.debugMode.rowFetch': 'Fetch / XHR de página',
  'workbench.docs.diagrams.debugMode.rowNavigations': 'Navegaciones',
  'workbench.docs.diagrams.debugMode.rowWorkers': 'Workers',
  'workbench.docs.diagrams.debugMode.rowIframes': 'Iframes cross-origin',
  'workbench.docs.diagrams.debugMode.rowTabEnv': 'Entorno de la pestaña',
  'workbench.docs.diagrams.debugMode.bannerFree': 'sin banner',
  'workbench.docs.diagrams.debugMode.showsBanner': 'muestra el banner',
  'workbench.docs.diagrams.debugMode.statesAria':
    'El punto tiene cuatro estados: gris apagado, verde adjunto y sano, amarillo replegado a la heurística ' +
    'al cerrar el banner, y rojo cuando una pestaña no pudo adjuntarse.',
  'workbench.docs.diagrams.debugMode.statesTitle': 'El punto de un vistazo',
  'workbench.docs.diagrams.debugMode.stateOff': 'Apagado',
  'workbench.docs.diagrams.debugMode.stateOffMsg': 'modo de depuración desactivado',
  'workbench.docs.diagrams.debugMode.stateOn': 'Activo · 2 pestañas',
  'workbench.docs.diagrams.debugMode.stateOnMsg': 'adjunto y sano',
  'workbench.docs.diagrams.debugMode.stateFellBack': 'Replegado',
  'workbench.docs.diagrams.debugMode.stateFellBackMsg': 'banner cerrado → heurística',
  'workbench.docs.diagrams.debugMode.stateFailed': 'Fallo al adjuntar',
  'workbench.docs.diagrams.debugMode.stateFailedMsg': 'no pudo activar el protocolo',

  // ── Request Tracking ────────────────────────────────────────────────
  'workbench.docs.diagrams.requestTracking.phasesAria':
    'Las dos fases de cada conexión — solicitud y respuesta — cada una con sus campos capturados.',
  'workbench.docs.diagrams.requestTracking.phasesTitle': 'Cada conexión tiene dos fases',
  'workbench.docs.diagrams.requestTracking.phaseRequest': 'SOLICITUD',
  'workbench.docs.diagrams.requestTracking.phaseRequestDir': 'Página → Red',
  'workbench.docs.diagrams.requestTracking.outbound': 'saliente',
  'workbench.docs.diagrams.requestTracking.capMethod': 'Método',
  'workbench.docs.diagrams.requestTracking.capHeaders': 'Encabezados',
  'workbench.docs.diagrams.requestTracking.capBody': 'Cuerpo',
  'workbench.docs.diagrams.requestTracking.phaseResponse': 'RESPUESTA',
  'workbench.docs.diagrams.requestTracking.phaseResponseDir': 'Red → Página',
  'workbench.docs.diagrams.requestTracking.inbound': 'entrante',
  'workbench.docs.diagrams.requestTracking.capStatus': 'Código de estado',
  'workbench.docs.diagrams.requestTracking.capTimings': 'Tiempos',
  'workbench.docs.diagrams.requestTracking.perRoundtrip': 'por ida y vuelta HTTP',
  'workbench.docs.diagrams.requestTracking.capturedKicker': 'CAPTURADO',
  'workbench.docs.diagrams.requestTracking.sameConnection': 'misma conexión',
  'workbench.docs.diagrams.requestTracking.phasesFooter': 'Ambas fases alimentan el contador del badge en Esta página.',
  'workbench.docs.diagrams.requestTracking.seqAria':
    'Diagrama de secuencia: solicitud observada, coincidida, registrada y luego leída por el popup',
  'workbench.docs.diagrams.requestTracking.pBrowser': 'Navegador',
  'workbench.docs.diagrams.requestTracking.pBrowserSub': 'pila de red',
  'workbench.docs.diagrams.requestTracking.pExtension': 'Extensión',
  'workbench.docs.diagrams.requestTracking.pExtensionSub': 'service worker',
  'workbench.docs.diagrams.requestTracking.pPopup': 'Popup',
  'workbench.docs.diagrams.requestTracking.pPopupSub': 'pestaña Esta página',
  'workbench.docs.diagrams.requestTracking.msgRequest': 'webRequest (solicitud)',
  'workbench.docs.diagrams.requestTracking.noteMatch': 'cotejar con las reglas',
  'workbench.docs.diagrams.requestTracking.noteRecord1': 'registrar (regla + URL +',
  'workbench.docs.diagrams.requestTracking.noteRecord2': 'tipo de recurso)',
  'workbench.docs.diagrams.requestTracking.msgResponse': 'webRequest (respuesta)',
  'workbench.docs.diagrams.requestTracking.noteResponse': 'registrar la fase de respuesta',
  'workbench.docs.diagrams.requestTracking.msgOpenPopup': 'el usuario abre el popup',
  'workbench.docs.diagrams.requestTracking.msgReadBack': 'reglas coincididas + badges',
  'workbench.docs.diagrams.requestTracking.seqFooter': 'El registro ocurre en directo; el popup solo lo relee.',
  'workbench.docs.diagrams.requestTracking.uiAria':
    'Anatomía de la UI — el badge plegado se expande en una lista de solicitudes coincidentes',
  'workbench.docs.diagrams.requestTracking.uiTitle': 'Fila de regla en el popup',
  'workbench.docs.diagrams.requestTracking.uiRule': 'Block ads.openheaders.com',
  'workbench.docs.diagrams.requestTracking.clickBadge': 'clic en el badge',
  'workbench.docs.diagrams.requestTracking.matchedPattern': 'coincidió: ads.openheaders.com',
  'workbench.docs.diagrams.requestTracking.legendFields':
    'marca de tiempo · URL · tipo de recurso · patrón coincidente',
  'workbench.docs.diagrams.requestTracking.legendBadge': 'contador del badge = número de filas',

  // ── Resource Types ──────────────────────────────────────────────────
  'workbench.docs.diagrams.resourceTypes.anatomyAria':
    'Anatomía de los tipos de recursos — una maqueta de página estilizada con llamadas a cada ' +
    'ResourceType de Chrome: Page, Frame, Script, CSS, Image, Font, Media, Fetch/XHR, WebSocket, Ping, Other.',
  'workbench.docs.diagrams.resourceTypes.anatomyTitle': 'Cada clase de solicitud corresponde a un ResourceType',
  'workbench.docs.diagrams.resourceTypes.otherExamples': 'favicon, manifest, …',
  'workbench.docs.diagrams.resourceTypes.legendKicker': 'LEYENDA',
  'workbench.docs.diagrams.resourceTypes.footer': 'Cada entrada corresponde 1:1 — sin solapamiento entre filas.',

  // ── Limitations ─────────────────────────────────────────────────────
  'workbench.docs.diagrams.limitations.overviewAria':
    'Limitaciones comunes — DevTools no muestra los encabezados modificados; el motor de scripts solo ve ' +
    'fetch/XHR; Fusionar solo ve encabezados puestos por la página; la coincidencia de encabezados ' +
    'necesita Chrome 128+.',
  'workbench.docs.diagrams.limitations.gotchasKicker': 'TRAMPAS HABITUALES',
  'workbench.docs.diagrams.limitations.devtoolsTitle': 'DevTools ciego',
  'workbench.docs.diagrams.limitations.devtoolsLine1': 'La pestaña Network muestra',
  'workbench.docs.diagrams.limitations.devtoolsLine2': 'los encabezados originales.',
  'workbench.docs.diagrams.limitations.scriptTitle': 'Alcance del script',
  'workbench.docs.diagrams.limitations.scriptLine1': 'Solo fetch / XHR —',
  'workbench.docs.diagrams.limitations.scriptLine2': 'ni nav, ni estáticos.',
  'workbench.docs.diagrams.limitations.mergeTitle': 'Alcance de Fusionar',
  'workbench.docs.diagrams.limitations.mergeLine1': 'Solo ve los encabezados',
  'workbench.docs.diagrams.limitations.mergeLine2': 'del código de la página.',
  'workbench.docs.diagrams.limitations.chromeTitle': 'Chrome 128+',
  'workbench.docs.diagrams.limitations.chromeLine1': 'Navegadores antiguos: sin',
  'workbench.docs.diagrams.limitations.chromeLine2': 'coincidencia de encabezados.',
  'workbench.docs.diagrams.limitations.seeCallout': 'Ver el aviso de abajo.',
  'workbench.docs.diagrams.limitations.footer': 'Cada trampa también se señala en la sección afectada.',

  // ── How rules execute ───────────────────────────────────────────────
  'workbench.docs.diagrams.execution.stackAria':
    'Dónde intercepta cada motor el flujo de solicitudes — JS pasa por Script y luego DNR; lo estático y ' +
    'la navegación saltan Script',
  'workbench.docs.diagrams.execution.stackTitle': 'Dónde intercepta cada motor',
  'workbench.docs.diagrams.execution.stackJsLane': 'Iniciadas por JS',
  'workbench.docs.diagrams.execution.stackStaticLane': 'Estático / navegación',
  'workbench.docs.diagrams.execution.stackPageJs': 'JS de página',
  'workbench.docs.diagrams.execution.stackPageJsSub': 'fetch / XHR',
  'workbench.docs.diagrams.execution.stackBrowser': 'Navegador',
  'workbench.docs.diagrams.execution.stackBrowserSub': '<img>, nav, etc.',
  'workbench.docs.diagrams.execution.stackScriptEngine': 'Motor Script',
  'workbench.docs.diagrams.execution.stackScriptEngineSub': 'monkey-patch',
  'workbench.docs.diagrams.execution.stackBypasses1': 'esquiva el',
  'workbench.docs.diagrams.execution.stackBypasses2': 'motor Script',
  'workbench.docs.diagrams.execution.stackDnrEngine': 'Motor DNR',
  'workbench.docs.diagrams.execution.stackDnrEngineSub': 'red de Chrome — lo atrapa todo',
  'workbench.docs.diagrams.execution.stackNetwork': 'Red',
  'workbench.docs.diagrams.execution.stackFooter': 'DNR es amplio; Script es estrecho pero lee cuerpos de respuesta.',
  'workbench.docs.diagrams.execution.dnrAria':
    'El amplio alcance de DNR — se intercepta cada tipo de recurso que carga el navegador',
  'workbench.docs.diagrams.execution.dnrTitle': 'DNR atrapa todo tipo de solicitud',
  'workbench.docs.diagrams.execution.dnrItemNav': 'navegación de página',
  'workbench.docs.diagrams.execution.dnrItemSubFrame': 'sub-frame',
  'workbench.docs.diagrams.execution.dnrItemFetch': 'fetch / XHR',
  'workbench.docs.diagrams.execution.dnrItemScripts': 'scripts',
  'workbench.docs.diagrams.execution.dnrItemStylesheets': 'hojas de estilo',
  'workbench.docs.diagrams.execution.dnrItemImages': 'imágenes',
  'workbench.docs.diagrams.execution.dnrItemFonts': 'fuentes',
  'workbench.docs.diagrams.execution.dnrItemMedia': 'medios',
  'workbench.docs.diagrams.execution.dnrItemWebsocket': 'websocket',
  'workbench.docs.diagrams.execution.dnrItemPing': 'ping / beacon',
  'workbench.docs.diagrams.execution.dnrFooter': 'cada tipo de recurso que carga el navegador',
  'workbench.docs.diagrams.execution.reachAria': 'Alcance del motor Script — qué atrapa y qué lo esquiva',
  'workbench.docs.diagrams.execution.reachTitle': 'Lo que el motor Script ve de verdad',
  'workbench.docs.diagrams.execution.reachCaught': '✓ atrapado',
  'workbench.docs.diagrams.execution.reachCaughtSub': 'el motor ve esto',
  'workbench.docs.diagrams.execution.reachFetch': 'fetch()',
  'workbench.docs.diagrams.execution.reachXhr': 'XMLHttpRequest',
  'workbench.docs.diagrams.execution.reachSwFetch': 'SW fetch',
  'workbench.docs.diagrams.execution.reachInScope': '(dentro del alcance)',
  'workbench.docs.diagrams.execution.reachMissed': '✗ perdido',
  'workbench.docs.diagrams.execution.reachMissedSub': 'lo esquiva del todo',
  'workbench.docs.diagrams.execution.reachImgSrc': '<img src>',
  'workbench.docs.diagrams.execution.reachScriptSrc': '<script src>',
  'workbench.docs.diagrams.execution.reachPageNav': 'navegación de página',
  'workbench.docs.diagrams.execution.reachBrowserInternal': 'interno del navegador',
  'workbench.docs.diagrams.execution.reachFaviconEtc': '(favicon, etc.)',

  // ── Direct vs Indirect ──────────────────────────────────────────────
  'workbench.docs.diagrams.directVsIndirect.aria':
    'Coincidencias directas vs indirectas — misma regla, dos contextos de página',
  'workbench.docs.diagrams.directVsIndirect.ruleLabel': 'Regla',
  'workbench.docs.diagrams.directVsIndirect.ruleBanner': 'Request Domains: openheaders.com',
  'workbench.docs.diagrams.directVsIndirect.directTitle': 'Directa',
  'workbench.docs.diagrams.directVsIndirect.directSub': 'la URL de la página coincide',
  'workbench.docs.diagrams.directVsIndirect.pageLabel': 'página',
  'workbench.docs.diagrams.directVsIndirect.directCaption1': 'Página + sub-recursos',
  'workbench.docs.diagrams.directVsIndirect.directCaption2': 'del mismo host seguidos',
  'workbench.docs.diagrams.directVsIndirect.badgePrefix': 'insignia:',
  'workbench.docs.diagrams.directVsIndirect.badgeDirect': 'direct',
  'workbench.docs.diagrams.directVsIndirect.badgeIndirect': 'indirect',
  'workbench.docs.diagrams.directVsIndirect.indirectTitle': 'Indirecta',
  'workbench.docs.diagrams.directVsIndirect.indirectSub': 'solo coincide un sub-recurso',
  'workbench.docs.diagrams.directVsIndirect.indirectCaption1': 'Solo se sigue el sub-recurso',
  'workbench.docs.diagrams.directVsIndirect.indirectCaption2': 'que coincide',
  'workbench.docs.diagrams.directVsIndirect.legendMatches': 'coincide con la regla',
  'workbench.docs.diagrams.directVsIndirect.legendNoMatch': 'no coincide',

  // ── Response Body + Status (Mock) ───────────────────────────────────
  'workbench.docs.diagrams.mock.flowAria':
    'Estático salta la red por completo; Dinámico la toca primero y luego transforma la respuesta real.',
  'workbench.docs.diagrams.mock.flowStatic': 'Estático',
  'workbench.docs.diagrams.mock.flowDynamic': 'Dinámico',
  'workbench.docs.diagrams.mock.flowIntercept': 'Interceptación',
  'workbench.docs.diagrams.mock.flowNeverHit1': '(la red real',
  'workbench.docs.diagrams.mock.flowNeverHit2': 'nunca se toca)',
  'workbench.docs.diagrams.mock.flowRealNetwork': 'red real',
  'workbench.docs.diagrams.mock.flowRealNetworkSub': 'respuesta real',
  'workbench.docs.diagrams.mock.flowSynthetic': 'cuerpo sintético',
  'workbench.docs.diagrams.mock.flowFnResponse': 'fn(response)',
  'workbench.docs.diagrams.mock.flowPageReceives': 'la página recibe',
  'workbench.docs.diagrams.mock.staticRule': 'Static response: 200 { "users": [] }',
  'workbench.docs.diagrams.mock.staticBeforeKicker': 'RED REAL',
  'workbench.docs.diagrams.mock.staticNever1': '(nunca alcanzada)',
  'workbench.docs.diagrams.mock.staticNever2': '— solicitud cortocircuitada',
  'workbench.docs.diagrams.mock.pageReceivesKicker': 'LA PÁGINA RECIBE',
  'workbench.docs.diagrams.mock.staticAfterLine1': '200 OK · Content-Type: application/json',
  'workbench.docs.diagrams.mock.staticAfterBody': '{ "users": [] }',
  'workbench.docs.diagrams.mock.staticArrow': 'respuesta sintética servida',
  'workbench.docs.diagrams.mock.staticStamp': 'Cuerpo + estado + encabezados fijos — el servidor nunca se contacta.',
  'workbench.docs.diagrams.mock.dynamicRule': 'Dynamic response: ocultar campos PII',
  'workbench.docs.diagrams.mock.dynamicBeforeKicker': 'RESPUESTA REAL',
  'workbench.docs.diagrams.mock.dynBodyOpen': '{ "user":',
  'workbench.docs.diagrams.mock.dynBodyEmail': '  { "email": "alice@openheaders.com" } }',
  'workbench.docs.diagrams.mock.dynAfterPrefix': '  { "email": ',
  'workbench.docs.diagrams.mock.dynRedacted': '"[oculto]"',
  'workbench.docs.diagrams.mock.dynamicArrow': 'fn(real response) →',
  'workbench.docs.diagrams.mock.dynamicStamp': 'La llamada real ocurre igual; tu función reescribe el cuerpo.',
  'workbench.docs.diagrams.mock.wontAria':
    'Los mocks solo interceptan fetch / XHR iniciados por JS — los recursos estáticos pasan sin cambios. ' +
    'Usa un proxy local real para fixtures de sub-recursos.',
  'workbench.docs.diagrams.mock.wontStatic': 'Recursos estáticos (img, script, link)',
  'workbench.docs.diagrams.mock.wontStaticSub': 'Los emite el navegador — nunca pasan por fetch / XHR.',
  'workbench.docs.diagrams.mock.wontNav': 'Navegaciones de página',
  'workbench.docs.diagrams.mock.wontNavSub': 'El HTML de nivel superior esquiva el motor Script.',
  'workbench.docs.diagrams.mock.suggestionText': 'Usa un proxy local real para fixtures de sub-recursos.',
  'workbench.docs.diagrams.mock.useCasesAria':
    'Cuerpo + estado de respuesta — casos de uso comunes: dev sin conexión, simulación de errores, ' +
    'ocultación de PII, payloads límite.',
  'workbench.docs.diagrams.mock.caseOffline': 'Dev sin conexión',
  'workbench.docs.diagrams.mock.caseOfflineEx': 'Simula toda la API',
  'workbench.docs.diagrams.mock.caseError': 'Simular errores',
  'workbench.docs.diagrams.mock.caseErrorEx': 'Forzar 500 en una ruta',
  'workbench.docs.diagrams.mock.casePii': 'Ocultación de PII',
  'workbench.docs.diagrams.mock.casePiiEx': 'Enmascara e-mails al vuelo',
  'workbench.docs.diagrams.mock.caseEdge': 'Casos límite',
  'workbench.docs.diagrams.mock.caseEdgeEx': 'Arrays vacíos, gran payload',
  'workbench.docs.diagrams.mock.useCasesFooter': 'Estático = modo fixture · Dinámico = paso real + edición.',

  // ── Keyboard Shortcuts ──────────────────────────────────────────────
  'workbench.docs.diagrams.keyboardShortcuts.aria':
    'Regiones de foco del workbench — barra lateral izquierda, editor, barra lateral derecha y panel ' +
    'inferior — cada una etiquetada con su combinación de foco.',
  'workbench.docs.diagrams.keyboardShortcuts.title': 'Cada combinación de foco te lleva a una de cuatro regiones',
  'workbench.docs.diagrams.keyboardShortcuts.windowTitle': 'Open Headers — Workbench',
  'workbench.docs.diagrams.keyboardShortcuts.leftSidebar': 'Barra izquierda',
  'workbench.docs.diagrams.keyboardShortcuts.editor': 'Editor',
  'workbench.docs.diagrams.keyboardShortcuts.rightSidebar': 'Barra derecha',
  'workbench.docs.diagrams.keyboardShortcuts.bottomPanel': 'Panel inferior',
  'workbench.docs.diagrams.keyboardShortcuts.footer': 'Reasigna cualquier combinación en Configuración → Teclado.',

  // ── Wire mirrors (whole-raw copies of en) ───────────────────────────
  'workbench.docs.diagrams.block.wireFetch': 'fetch()',
  'workbench.docs.diagrams.delay.wireFetch': 'fetch()',
  'workbench.docs.diagrams.delay.wireSetTimeout': 'setTimeout',
  'workbench.docs.diagrams.inject.wireDoctype': '<!doctype html>',
  'workbench.docs.diagrams.inject.wireHookLine': 'const _f = window.fetch;',
  'workbench.docs.diagrams.inject.wireBodyOpen': '<body>',
  'workbench.docs.diagrams.inject.wireScriptSrc': '<script src="app.js"></script>',
  'workbench.docs.diagrams.limitations.wireFn': 'fn',
  'workbench.docs.diagrams.multiTab.sync.wireStagingEnv': 'staging',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wirePush': 'push',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wirePull': 'pull',
  'workbench.docs.diagrams.openHeaders.roadmapGit.wireRepoName': '⎇ workspace.git',
  'workbench.docs.diagrams.openHeaders.mcpArch.wireStdio': 'stdio',
  'workbench.docs.diagrams.openHeaders.mcpArch.wireHttpSse': 'HTTP / SSE',
  'workbench.docs.diagrams.openHeaders.mcpTools.wireList': 'list',
  'workbench.docs.diagrams.queryParams.wirePage': '?page=1',
  'workbench.docs.diagrams.queryParams.wireDebugParam': '&debug=true',
  'workbench.docs.diagrams.queryParams.wireAmpPage': '&page=1',
  'workbench.docs.diagrams.requestBody.wirePostSave': 'POST /api/save  body:',
  'workbench.docs.diagrams.requestBody.wireBodyAbc': '{ "userId": "abc" }',
  'workbench.docs.diagrams.requestBody.wireBodyTest': '{ "userId": "test-1" }',
  'workbench.docs.diagrams.requestBody.wireBodyAbcOpen': '{ "userId": "abc", ',
  'workbench.docs.diagrams.requestBody.wireDebugTrue': '"debug": true',
  'workbench.docs.diagrams.requestBody.wireOpEquals': 'operationName = GetUser',
  'workbench.docs.diagrams.requestBody.wireGetUser': '  "GetUser", ...',
  'workbench.docs.diagrams.requestBody.wireListPosts': '  "ListPosts", ...',
  'workbench.docs.diagrams.requestTracking.wireTagXhr': 'xhr',
  'workbench.docs.diagrams.requestTracking.wireTagImage': 'image',
  'workbench.docs.diagrams.requestTracking.wireTagPing': 'ping',
  'workbench.docs.diagrams.resourceTypes.wireAa': 'Aa',
  'workbench.docs.diagrams.resourceTypes.wireScriptTag': '<script>',
  'workbench.docs.diagrams.resourceTypes.wireLinkCss': '<link css>',
  'workbench.docs.diagrams.resourceTypes.wireImgTag': '<img>',
  'workbench.docs.diagrams.resourceTypes.wireVideoTag': '<video>',
  'workbench.docs.diagrams.resourceTypes.wireIframeTag': '<iframe>',
  'workbench.docs.diagrams.resourceTypes.wireNewWebSocket': "new WebSocket('wss://…')",
  'workbench.docs.diagrams.systemStatus.permissionsAudit.wireOrigins': "{ origins: ['<all_urls>'] }",
  'workbench.docs.diagrams.systemStatus.vaultHydration.wireId': '<id>',
} as const satisfies Catalog;
