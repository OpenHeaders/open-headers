/**
 * DevTools panel — console tool window — Spanish. Mirrors
 * `catalogs/en/panel-console.ts` key for key. Raw by design: level
 * wire names (debug/log/…), the › ‹ chevrons and ⚙ prefix, context
 * labels (top / frame names / script URLs), source locations,
 * "(anonymous)", the browser's synthesized network phrasing quoted
 * verbatim («finished loading», «Access to fetch at …»), key names
 * (Tab / arrows — the keyed Enter renders as the es `Intro`), and the
 * example-transcript rows in the (i) corpora. Mints: `prompt` rides
 * raw (m., JS vocabulary); log rides the S62 `registro`; scope rides
 * the debug-reach `alcance`.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelConsole = {
  // ── Console tool window (station: console family) ───────────────────
  'panel.console.clear': 'Borrar la consola',
  'panel.console.collapseAll': 'Contraer todo',
  'panel.console.expandAll': 'Expandir todo',
  'panel.console.filterAria': 'Filtrar los mensajes de la consola',
  'panel.console.levelTitle': 'Nivel de registro: {label}',
  'panel.console.settings': 'Configuración de la consola',
  'panel.console.settingsPaneAria': 'Configuración de la consola',
  'panel.console.contextTitle': 'Contexto JavaScript — donde se evalúan los comandos de la consola',

  // Level-filter menu (the browser's "Default levels ▾" ladder)
  'panel.console.levels.verbose': 'Detallado',
  'panel.console.levels.info': 'Info',
  'panel.console.levels.warnings': 'Advertencias',
  'panel.console.levels.errors': 'Errores',
  'panel.console.levels.all': 'Todos los niveles',
  'panel.console.levels.defaultLevels': 'Niveles predeterminados',
  'panel.console.levels.hideAll': 'Ocultar todos',
  'panel.console.levels.only': 'Solo {level}',
  'panel.console.levels.custom': 'Niveles personalizados',
  'panel.console.levels.default': 'Predeterminado',

  // Settings pane (labels + hover titles, browser pane order)
  'panel.console.setting.hideNetwork': 'Ocultar la red',
  'panel.console.setting.hideNetworkTitle':
    'Ocultar las entradas de registro de red del navegador (solicitudes fallidas y bloqueadas)',
  'panel.console.setting.logXhr': 'Registrar las XMLHttpRequests',
  'panel.console.setting.logXhrTitle':
    'Registrar un mensaje cuando una solicitud XHR, fetch o EventSource termina o falla',
  'panel.console.setting.preserveLog': 'Conservar el registro',
  'panel.console.setting.preserveLogTitle': 'No borrar el registro al navegar',
  'panel.console.setting.eagerEval': 'Evaluación anticipada',
  'panel.console.setting.eagerEvalTitle':
    'Evaluar sobre la marcha el texto del prompt (vista previa sin efectos secundarios)',
  'panel.console.setting.selectedContextOnly': 'Solo el contexto seleccionado',
  'panel.console.setting.selectedContextOnlyTitle': 'Mostrar solo los mensajes del contexto seleccionado',
  'panel.console.setting.autocompleteHistory': 'Autocompletar desde el historial',
  'panel.console.setting.autocompleteHistoryTitle': 'Sugerir comandos ya ejecutados mientras escribes en el prompt',
  'panel.console.setting.groupSimilar': 'Agrupar los mensajes similares en la consola',
  'panel.console.setting.groupSimilarTitle': 'Contraer los mensajes idénticos repetidos en una fila con un contador',
  'panel.console.setting.evalUserGesture': 'Tratar la evaluación de código como acción del usuario',
  'panel.console.setting.evalUserGestureTitle':
    'Evaluar con un gesto de usuario, para que las API condicionadas a la activación del usuario funcionen ' +
    'desde el prompt',
  'panel.console.setting.showCorsErrors': 'Mostrar los errores CORS en la consola',
  'panel.console.setting.showCorsErrorsTitle':
    'Mostrar los errores de política CORS junto a la salida propia de la página',

  // Per-setting (i) info corpora (titles reuse the setting label keys;
  // groupSimilar's popover title differs from its checkbox label)
  'panel.console.info.exampleCaption': 'Ejemplo de consola',
  'panel.console.info.hideNetwork.summary':
    'Oculta las entradas de registro de red propias del navegador — solicitudes fallidas y bloqueadas — ' +
    'mientras que la salida de consola de la página siempre permanece.',
  'panel.console.info.hideNetwork.description':
    'También oculta las filas «finished loading» sintetizadas por Registrar las XMLHttpRequests — también son ' +
    'mensajes de origen red.',
  'panel.console.info.logXhr.summary':
    'Registra una fila cada vez que una solicitud XHR, fetch o EventSource termina o falla.',
  'panel.console.info.logXhr.description':
    'Las filas se registran al nivel Info — los fallos también — y la URL enlaza a la fila de la solicitud en ' +
    'el panel Network. Ocultar la red también oculta estas filas.',
  'panel.console.info.preserveLog.summary': 'Conserva el registro entre navegaciones de página en lugar de borrarlo.',
  'panel.console.info.preserveLog.description':
    'Desactivado, una navegación — la recreación del contexto top de la página — recorta la vista a las ' +
    'entradas que llegan después de ella.',
  'panel.console.info.eagerEval.summary':
    'Previsualiza el resultado de la expresión que estás escribiendo en la línea gris bajo el prompt.',
  'panel.console.info.eagerEval.description':
    'La vista previa se evalúa sin efectos secundarios: una expresión que cambiaría el estado de la página no ' +
    'muestra nada en lugar de ejecutarse, y no se escribe nada en el registro hasta que pulsas Intro.',
  'panel.console.info.selectedContextOnly.summary':
    'Muestra solo los mensajes del contexto JavaScript elegido en el selector de contexto de la barra de ' +
    'herramientas.',
  'panel.console.info.selectedContextOnly.description':
    'Las entradas sin contexto — las entradas de registro propias del navegador — siempre permanecen visibles.',
  'panel.console.info.autocompleteHistory.summary':
    'Sugiere el comando más reciente que extiende lo que escribiste, como un autocompletado atenuado en el ' +
    'prompt.',
  'panel.console.info.autocompleteHistory.description':
    'Tab — o → al final de la entrada — lo acepta; ↑/↓ siguen recorriendo el historial. El historial vive ' +
    'durante la sesión actual del panel.',
  'panel.console.info.groupSimilar.title': 'Agrupar los mensajes similares',
  'panel.console.info.groupSimilar.summary':
    'Contrae los mensajes idénticos consecutivos en una fila con una insignia de contador.',
  'panel.console.info.groupSimilar.description':
    'Los comandos escritos y sus resultados nunca se agrupan — la transcripción se mantiene literal.',
  'panel.console.info.evalUserGesture.summary':
    'Ejecuta los comandos del prompt como si un gesto del usuario los hubiera activado.',
  'panel.console.info.evalUserGesture.description':
    'Las API condicionadas a la activación del usuario — abrir una ventana, escribir en el portapapeles, la ' +
    'pantalla completa — funcionan desde el prompt con esto activado.',
  'panel.console.info.showCorsErrors.summary':
    'Muestra las explicaciones CORS del navegador — «Access to fetch at … has been blocked by CORS ' +
    'policy: …» — junto a la salida de la página.',
  'panel.console.info.showCorsErrors.description':
    'Desactivado oculta solo esos mensajes de explicación; la solicitud bloqueada en sí sigue apareciendo en ' +
    'el panel Network.',

  // Capture-stopped banner + never-silent empty surfaces
  'panel.console.banner.leftScope':
    'Captura detenida — esta pestaña salió del alcance del modo de depuración. Se muestra la última salida ' +
    'capturada.',
  'panel.console.banner.debugOff':
    'Captura detenida — el modo de depuración está desactivado. Se muestra la última salida capturada.',
  'panel.console.enableDebug': 'Activar el modo de depuración',
  'panel.console.empty.noCdp.title': 'La captura de consola necesita el modo de depuración',
  'panel.console.empty.noCdp.sub': 'La inspección en modo de depuración no está disponible en este navegador.',
  'panel.console.empty.capturing.title': 'Aún no hay salida de consola',
  'panel.console.empty.capturing.sub':
    'Los mensajes de registro y las excepciones no capturadas de esta pestaña aparecerán aquí a medida que ' +
    'ocurran.',
  'panel.console.empty.debugOff.title': 'Activa el modo de depuración para ver los registros de la consola',
  'panel.console.empty.debugOff.sub':
    'Open Headers captura la salida de consola y las excepciones no capturadas de esta pestaña mientras el ' +
    'modo de depuración está activado.',
  'panel.console.empty.outOfScope.title': 'Esta pestaña está fuera del alcance del modo de depuración',
  'panel.console.empty.outOfScope.sub':
    'Tráela al alcance desde el modo de depuración — cambia el alcance o fija esta pestaña — para capturar su ' +
    'salida de consola.',
  'panel.console.noMatch': 'Ninguna entrada de consola coincide con tu filtro.',
  'panel.console.revealedHidden': 'El mensaje revelado está oculto por el filtro activo',

  // Log rows
  'panel.console.repeatTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} mensaje idéntico',
      many: '{count} mensajes idénticos',
      other: '{count} mensajes idénticos',
    }),
  'panel.console.expandStack': 'Expandir la pila de llamadas',
  'panel.console.collapseStack': 'Contraer la pila de llamadas',

  // REPL prompt
  'panel.console.prompt.waiting': 'Esperando un contexto JavaScript…',
  'panel.console.prompt.placeholder': 'Ejecuta JavaScript en el contexto seleccionado',
  'panel.console.prompt.aria': 'Prompt de la consola',
  'panel.console.prompt.previewAria': 'Vista previa de la evaluación anticipada',
} as const satisfies Catalog;
