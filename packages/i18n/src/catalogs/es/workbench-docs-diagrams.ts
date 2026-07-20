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
    'no es un subdominio real — sin punto antes de «openheaders.io»',
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
  'workbench.docs.diagrams.conditions.initiatorDomains.ruleBanner': 'Dominios iniciadores: portal.openheaders.io',
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
  'workbench.docs.diagrams.conditions.urlPattern.footerExample': 'Dominios de solicitud: openheaders.io',

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
} as const satisfies Catalog;
