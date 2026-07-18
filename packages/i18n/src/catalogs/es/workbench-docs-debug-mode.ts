/**
 * Workbench Docs panel — the Debug Mode section body — Spanish. Mirrors
 * `catalogs/en/workbench-docs-debug-mode.ts` key for key. UI labels the
 * prose references copy the shipped `shared-chrome.ts` es strings
 * verbatim (`Adjuntar a`, `Donde DevTools está abierto`, `La pestaña
 * con el foco`, `Ambas`, `Incluir esta pestaña del navegador`,
 * `Pestañas adjuntas`, `Pestaña fuera de alcance`, `Estado del
 * sistema`); the browser banner quote rides verbatim inside «».
 * Raw by design: the `● Debug mode` pill chip and `fetch` / `XHR`
 * code chips composed by the section body, `CSP`, worker/cross-origin
 * vocabulary per the panel parity laws. Mints: pill = píldora (f.);
 * banner = aviso (the shared-chrome mint); pin (verb) = fijar;
 * badge = insignia; Overrides = Sustituciones (panel mint).
 */

import type { Catalog } from '../../types';

export const workbenchDocsDebugMode = {
  // ── Concepts: Debug mode ────────────────────────────────────────────
  'workbench.docs.body.debugMode.term': 'El modo de depuración',
  'workbench.docs.body.debugMode.intro1':
    'adjunta Open Headers al protocolo de depuración del navegador para poder inspeccionar y cambiar tráfico que ' +
    'las API de extensión ordinarias no alcanzan. Es la misma maquinaria que usan las propias herramientas de ' +
    'desarrollo del navegador — por eso, mientras está activado, el aviso',
  'workbench.docs.body.debugMode.introBanner': '«OH started debugging this browser»',
  'workbench.docs.body.debugMode.intro1Suffix': 'se muestra en el navegador.',
  'workbench.docs.body.debugMode.intro2':
    'El modo estándar (modo de depuración desactivado) ya cubre la mayoría de las reglas — encabezado, bloqueo, ' +
    'redirección, parámetros de consulta y las reglas de cuerpo / respuesta / inyección en contexto de página. ' +
    'El modo de depuración es la mejora que activas expresamente para lo que esas no alcanzan: navegaciones, ' +
    'workers, marcos cross-origin y cambios de entorno a nivel de pestaña.',
  'workbench.docs.body.debugMode.controlHeading': 'Dónde se controla',
  'workbench.docs.body.debugMode.control1Prefix': 'La píldora',
  'workbench.docs.body.debugMode.control1Middle':
    'está en el pie de página de cada superficie, justo a la izquierda de',
  'workbench.docs.body.debugMode.systemStatusLink': 'Estado del sistema',
  'workbench.docs.body.debugMode.control1Suffix':
    '. El conmutador integrado lo activa y lo desactiva, el punto de color sigue su salud, y el punto + etiqueta ' +
    'abren un popover con todo lo demás — alcance, pestañas fijadas y la lista de pestañas adjuntas en este ' +
    'momento.',
  'workbench.docs.body.debugMode.surfaceCaption':
    'El conmutador integrado lo activa; el punto + etiqueta abren el popover para todo lo demás.',
  'workbench.docs.body.debugMode.scopeHeading': 'Elegir qué inspeccionar',
  'workbench.docs.body.debugMode.scope1Prefix': 'El desplegable',
  'workbench.docs.body.debugMode.attachTo': 'Adjuntar a',
  'workbench.docs.body.debugMode.scope1Middle': 'decide a qué pestañas se adjunta el modo de depuración —',
  'workbench.docs.body.debugMode.scopeDevtools': 'Donde DevTools está abierto',
  'workbench.docs.body.debugMode.scope1DevtoolsParen':
    '(solo las pestañas con el panel Open Headers abierto; el valor por defecto más estrecho),',
  'workbench.docs.body.debugMode.scopeFocused': 'La pestaña con el foco',
  'workbench.docs.body.debugMode.scope1FocusedParen': '(sigue a la pestaña activa a medida que cambias), o',
  'workbench.docs.body.debugMode.scopeBoth': 'Ambas',
  'workbench.docs.body.debugMode.scope1BothParen': '(la unión de las dos).',
  'workbench.docs.body.debugMode.consent1Prefix': 'Elegir un alcance',
  'workbench.docs.body.debugMode.consentIs': 'es',
  'workbench.docs.body.debugMode.consent1Middle':
    'el consentimiento para el aviso del navegador — no hay ninguna petición aparte. Cuando la pestaña actual ' +
    'aún no está cubierta por el alcance, aparece la opción',
  'workbench.docs.body.debugMode.includeTabPin': 'Incluir esta pestaña del navegador',
  'workbench.docs.body.debugMode.consent1Suffix':
    'para fijar solo esa pestaña sin ampliar el alcance para todo lo demás.',
  'workbench.docs.body.debugMode.attached1Prefix': 'La lista',
  'workbench.docs.body.debugMode.attachedTabs': 'Pestañas adjuntas',
  'workbench.docs.body.debugMode.attached1Suffix':
    'muestra cada pestaña que el modo de depuración está dirigiendo en este momento, cada una con una acción ' +
    'para saltar a esa pestaña. El conjunto adjunto se recalcula siempre a partir de tu alcance, tus pestañas ' +
    'fijadas y los paneles abiertos — refleja el presente, nunca una instantánea obsoleta.',
  'workbench.docs.body.debugMode.scopeCaption':
    'El conjunto adjunto se deriva cada vez — volver a adjuntar lo reproduce, no se almacena nada.',
  'workbench.docs.body.debugMode.bannerCalloutTitle': 'El aviso abarca todo el navegador',
  'workbench.docs.body.debugMode.banner1Prefix':
    'Mientras el modo de depuración está activo, el aviso del navegador «OH started debugging this browser» ' +
    'se muestra en',
  'workbench.docs.body.debugMode.bannerEvery': 'todas',
  'workbench.docs.body.debugMode.banner1Suffix':
    'las pestañas — no solo en aquellas a las que está adjunto. Es el comportamiento del propio navegador; ' +
    'desactivar el modo de depuración lo quita de inmediato.',
  'workbench.docs.body.debugMode.unlocksHeading': 'Qué desbloquea',
  'workbench.docs.body.debugMode.unlocksIntro':
    'En una pestaña adjunta, las reglas y los controles van más allá del contexto de página:',
  'workbench.docs.body.debugMode.anyRequestLead': 'Cualquier solicitud, cualquier contexto.',
  'workbench.docs.body.debugMode.anyRequest1':
    'Simula o reescribe navegaciones de nivel superior, solicitudes de workers e iframes cross-origin — no solo ' +
    'los',
  'workbench.docs.body.debugMode.anyRequest2':
    ' de la página. Los cuerpos de solicitud y respuesta pueden leerse y transformarse en esos mismos contextos, ' +
    'y los desafíos de autenticación HTTP responderse automáticamente para proxies de desarrollo y staging.',
  'workbench.docs.body.debugMode.injectionLead': 'Inyección reforzada.',
  'workbench.docs.body.debugMode.injection1':
    'La inyección de scripts pasa a estar libre de carreras y a prueba de CSP, y llega dentro de los workers y ' +
    'los marcos cross-origin que la vía estándar del contexto de página no puede tocar.',
  'workbench.docs.body.debugMode.tabEnvLead': 'Entorno de pestaña.',
  'workbench.docs.body.debugMode.tabEnv1':
    'Desactivación exacta de la caché, limitación de red / sin conexión, y sustituciones de user-agent / locale ' +
    '/ zona horaria / medios — se establecen por pestaña desde la barra de herramientas del panel y desde',
  'workbench.docs.body.debugMode.overrides': 'Sustituciones',
  'workbench.docs.body.debugMode.tabEnv2': '(la superficie dedicada).',
  'workbench.docs.body.debugMode.reachCaption':
    'El modo estándar cubre los fetch / XHR de la página; una pestaña adjunta extiende las mismas reglas a todo ' +
    'lo demás.',
  'workbench.docs.body.debugMode.silentHeading': 'Las reglas nunca fallan en silencio',
  'workbench.docs.body.debugMode.silent1Prefix':
    'Una regla que necesita el modo de depuración para surtir pleno efecto muestra una insignia',
  'workbench.docs.body.debugMode.badgeOff': 'Modo de depuración desactivado',
  'workbench.docs.body.debugMode.silent1Middle': 'en la lista de reglas mientras está desactivado, y una nota',
  'workbench.docs.body.debugMode.badgeOutOfScope': 'Pestaña fuera de alcance',
  'workbench.docs.body.debugMode.silent1Middle2':
    'en el panel cuando está activado pero la pestaña no está en el alcance. La regla sigue ejecutando todo lo que',
  'workbench.docs.body.debugMode.silentCan': 'puede',
  'workbench.docs.body.debugMode.silent1Suffix':
    'por la vía estándar del contexto de página — armar el modo de depuración solo extiende la misma regla a los ' +
    'contextos que la inyección de página no alcanza.',
  'workbench.docs.body.debugMode.colorsHeading': 'Colores de estado',
  'workbench.docs.body.debugMode.colors1Prefix': 'El punto refleja la fila',
  'workbench.docs.body.debugMode.colors1Suffix': ':',
  'workbench.docs.body.debugMode.statesCaption':
    'Gris cuando está desactivado; verde / amarillo / rojo una vez activado.',
  'workbench.docs.body.debugMode.stateGreenLabel': 'verde',
  'workbench.docs.body.debugMode.stateOn': 'Activado',
  'workbench.docs.body.debugMode.stateOnRest':
    'y adjunto limpiamente. (Cuando está desactivado, el punto es simplemente gris.)',
  'workbench.docs.body.debugMode.stateYellowLabel': 'amarillo',
  'workbench.docs.body.debugMode.stateYellowPrefix': 'Una pestaña',
  'workbench.docs.body.debugMode.stateYellowTerm': 'recurrió a la heurística',
  'workbench.docs.body.debugMode.stateYellowSuffix':
    '— normalmente porque el aviso de depuración del navegador se cerró, así que esa pestaña vuelve a la ' +
    'observación estándar.',
  'workbench.docs.body.debugMode.stateRedLabel': 'rojo',
  'workbench.docs.body.debugMode.stateRedPrefix': 'Una pestaña',
  'workbench.docs.body.debugMode.stateRedTerm': 'no se pudo adjuntar',
  'workbench.docs.body.debugMode.stateRedSuffix': '— no se pudo iniciar el protocolo de depuración para ella.',
  'workbench.docs.body.debugMode.chromiumTitle': 'Solo Chromium',
  'workbench.docs.body.debugMode.chromium1':
    'El modo de depuración depende de un protocolo de depuración que solo los navegadores basados en Chromium ' +
    'exponen a las extensiones. En Firefox y Safari la píldora permanece oculta; las reglas del modo estándar ' +
    'de arriba funcionan en todas partes.',
} as const satisfies Catalog;
