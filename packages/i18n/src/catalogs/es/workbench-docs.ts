/**
 * Workbench Docs panel — anchor registry bodies — Spanish. Mirrors
 * `catalogs/en/workbench-docs.ts` key for key; the fr sibling's S59
 * raw/keyed split is followed exactly. Raw by design inside keyed
 * prose: wire/API tokens (declarativeNetRequest, webRequest,
 * ResourceType, queryTransform, block, main_frame, firstParty /
 * thirdParty, Equals / Contains, operationName / query / key / value,
 * chrome.storage(.local), fetch() / XMLHttpRequest, @font-face,
 * Set-Cookie, Accept, User-Agent, Content-Type, CORS,
 * ERR_BLOCKED_BY_CLIENT, RE2, stdio, HTTP/SSE, git log / git blame),
 * ResourceType enum labels (Page, Frame, Fetch/XHR, Script, …), the
 * S55 whole-raw one-letter fragment `'A'` (copied verbatim, sentence
 * reshaped around it), and DNR / AND / DOM / CA / PII / YAML / CDN /
 * MCP / endpoint / monkey-patch loanwords. Quoted UI labels copy
 * their es mints: header ops (Añadir / Reemplazar, Anexar, Quitar,
 * Fusionar, Solo reemplazar, Quitar todo), condition names and Excl.
 * variants (es/workbench-editors-rule), inject timing labels (`Lo
 * antes posible`, `Tras la carga de la página`), popup tab «Esta
 * página», docs nav titles (es/workbench-chrome), `Dinámico
 * (JavaScript)` mode label. MINTS: trade-off = `contrapartida`;
 * fixture = `datos de prueba`; en's `30,000 ms` / `5,000 ms` figures
 * take es grouping (`30 000 ms`).
 */

import type { Catalog } from '../../types';

export const workbenchDocs = {
  // ── Concepts: Execution (DNR vs Script) ─────────────────────────────
  'workbench.docs.body.execution.intro':
    'Las reglas se ejecutan a través de uno de dos motores según lo que hacen. Saber qué camino recorre una ' +
    'regla explica dónde se aplica — y dónde no puede.',
  'workbench.docs.body.execution.stackCaption':
    'Las solicitudes iniciadas por JS pasan por Script y luego DNR. El tráfico estático y de navegación ' +
    'evita Script por completo.',
  'workbench.docs.body.execution.dnrHeading': 'Nativo, rápido, amplio alcance',
  'workbench.docs.body.execution.dnr1Prefix':
    'Las reglas de encabezado (Añadir / Reemplazar, Anexar, Quitar), de bloqueo, de redirección y de ' +
    'parámetro de consulta se compilan en entradas',
  'workbench.docs.body.execution.dnr1Suffix':
    'que Chrome aplica en la capa de red, antes de que ninguna solicitud salga del navegador.',
  'workbench.docs.body.execution.dnr2':
    'El alcance es amplio: páginas, iframes, scripts, imágenes, fuentes, fetch, XHR — cada solicitud que el ' +
    'navegador emite en nombre de la página.',
  'workbench.docs.body.execution.dnrCaption':
    'Una sola lista enmarcada — el alcance de DNR es esencialmente universal.',
  'workbench.docs.body.execution.scriptHeading': 'Contexto JS, alcance estrecho',
  'workbench.docs.body.execution.script1Prefix':
    'Las reglas de inyección, retraso, cuerpo de solicitud, respuesta API y fusión de encabezados operan ' +
    'haciendo monkey-patch de',
  'workbench.docs.body.execution.script1And': 'y',
  'workbench.docs.body.execution.script1Suffix':
    'desde dentro de la página. Pueden transformar el tráfico iniciado por JavaScript de maneras que DNR no ' +
    'puede expresar — incluido leer y reescribir los cuerpos de respuesta, a los que DNR no tiene ningún ' +
    'acceso.',
  'workbench.docs.body.execution.scriptCaption':
    'Dos columnas — lo que el motor de scripts intercepta realmente, y lo que pasa sin cambios.',
  'workbench.docs.body.execution.limitPrefix': 'Los recursos estáticos (',
  'workbench.docs.body.execution.limitSuffix':
    '), las navegaciones de página y las solicitudes internas del navegador evitan este motor por completo. ' +
    'Usa una regla basada en DNR para esos casos.',

  // ── Concepts: Limitations ───────────────────────────────────────────
  'workbench.docs.body.limitations.intro':
    'Referencia rápida de los comportamientos que sorprenden. Cada elemento se señala también en línea en la ' +
    'sección a la que afecta.',
  'workbench.docs.body.limitations.overviewCaption':
    'Cuatro trampas habituales de un vistazo — cada aviso de abajo tiene los detalles.',
  'workbench.docs.body.limitations.devtoolsTitle': 'Los encabezados modificados no aparecen en DevTools',
  'workbench.docs.body.limitations.devtoolsBody':
    'Las acciones de encabezado se aplican correctamente, pero la pestaña Network de Chrome sigue mostrando ' +
    'los encabezados originales del servidor.',
  'workbench.docs.body.limitations.scriptTitle': 'Reglas basadas en scripts — alcance estrecho',
  'workbench.docs.body.limitations.scriptPrefix':
    'Inyección, Retraso, Cuerpo, Mock y Fusión de encabezados solo interceptan',
  'workbench.docs.body.limitations.scriptAnd': 'y',
  'workbench.docs.body.limitations.scriptMiddle':
    '. Los recursos estáticos y las navegaciones de página los evitan. Consulta',
  'workbench.docs.body.limitations.executionRef': 'Cómo se ejecutan las reglas',
  'workbench.docs.body.limitations.scriptSuffix': '.',
  'workbench.docs.body.limitations.mergeTitle': 'Fusionar no puede leer los encabezados por defecto del navegador',
  'workbench.docs.body.limitations.mergeBody':
    'La operación Fusionar solo ve los encabezados definidos explícitamente por el código de la página — ' +
    'Accept, User-Agent y los demás encabezados por defecto del navegador le resultan invisibles.',
  'workbench.docs.body.limitations.chromeTitle': 'La coincidencia de encabezados necesita Chrome 128+',
  'workbench.docs.body.limitations.chromeBody':
    'Las condiciones que coinciden sobre valores de encabezados de solicitud / respuesta requieren Chrome ' +
    '128 o más reciente. Los navegadores más antiguos ignoran la condición en silencio.',

  // ── Concepts: Multi-tab Behavior ────────────────────────────────────
  'workbench.docs.body.multiTab.intro1Prefix':
    'Varias pestañas de espacio de trabajo abiertas a la vez es un estado de primer orden. Los datos ' +
    'persistidos se sincronizan a través de',
  'workbench.docs.body.multiTab.intro1Suffix':
    ', el estado de disposición queda por pestaña, y las intenciones de navegación reutilizan las pestañas ' +
    'existentes de la misma ventana antes de abrir otras nuevas.',
  'workbench.docs.body.multiTab.syncCaption':
    'La pestaña A guarda, el SW difunde, la pestaña B se rehidrata. El estado de disposición se queda en ' +
    'cada pestaña.',
  'workbench.docs.body.multiTab.navHeading': 'La navegación reutiliza las pestañas existentes',
  'workbench.docs.body.multiTab.nav1':
    'Primero la misma ventana: si una pestaña de espacio de trabajo ya está abierta en la ventana desde la ' +
    'que haces clic, se activa y recibe la intención (sección de docs a la que desplazarse, regla a editar). ' +
    'Ventana distinta: se abre una pestaña nueva en tu ventana actual en lugar de arrastrar el foco entre ' +
    'ventanas de Chrome — a imagen de las propias DevTools de Chrome, con un panel por ventana.',
  'workbench.docs.body.multiTab.navCaption':
    'El camino caliente activa la pestaña de la misma ventana; el camino frío abre una pestaña nueva en la ' +
    'ventana del llamante.',
  'workbench.docs.body.multiTab.numberingHeading': 'Numeración de pestañas',
  'workbench.docs.body.multiTab.numbering1Prefix':
    'Con dos o más pestañas de espacio de trabajo, el título de cada pestaña se prefija con su ordinal —',
  'workbench.docs.body.multiTab.numbering1Suffix':
    '. Cuando el recuento vuelve a uno, la superviviente pierde su prefijo.',
  'workbench.docs.body.multiTab.numbering2Prefix': 'Los ordinales son estables durante la vida de una pestaña: cerrar',
  'workbench.docs.body.multiTab.numbering2While': 'mientras',
  'workbench.docs.body.multiTab.numbering2And': 'y',
  'workbench.docs.body.multiTab.numbering2Middle':
    'permanecen no renumera a las supervivientes. La siguiente pestaña abierta recibe',
  'workbench.docs.body.multiTab.numbering2Middle2': '; la numeración no vuelve a',
  'workbench.docs.body.multiTab.numbering2Suffix':
    'hasta que todas las pestañas de espacio de trabajo se hayan cerrado.',
  'workbench.docs.body.multiTab.numberingCaption':
    'Las supervivientes conservan sus números a través de los cierres; la siguiente pestaña es siempre ' + 'max + 1.',
  'workbench.docs.body.multiTab.syncsHeading': 'Qué se sincroniza y qué no',
  'workbench.docs.body.multiTab.syncs1Prefix':
    'Cada entidad persistida — reglas, colecciones, carpetas, entornos, variables de espacio de trabajo, ' +
    'vault, solicitudes, plantillas — vive en',
  'workbench.docs.body.multiTab.syncs1Suffix':
    'como única fuente de verdad. Los guardados de la pestaña A se difunden a través del segundo plano y la ' +
    'pestaña B se rehidrata. Los cambios de espacio de trabajo y de entorno se propagan de la misma forma.',
  'workbench.docs.body.multiTab.syncedCaption':
    'Un único chrome.storage compartido; ambas pestañas leen y escriben los mismos datos persistidos.',
  'workbench.docs.body.multiTab.localCaption':
    'Los arrastres de disposición y la escritura sin guardar viven en cada pestaña — la otra pestaña nunca ' +
    'los ve.',
  'workbench.docs.body.multiTab.layoutTitle': 'La disposición no se sincroniza en vivo',
  'workbench.docs.body.multiTab.layout1Prefix':
    'Las proporciones de los paneles y el estado de acoplamiento de las ventanas de herramientas son por ' +
    'espacio de trabajo, pero los cambios no se propagan a las pestañas ya abiertas. Arrastrar un divisor ' +
    'en la pestaña A deja la pestaña B intacta hasta recargar — una sincronización de disposición en vivo ' +
    'resultaría desconcertante mientras escribes. Una pestaña abierta',
  'workbench.docs.body.multiTab.layoutAfter': 'después',
  'workbench.docs.body.multiTab.layout1Suffix': 'del arrastre hereda la nueva disposición.',
  'workbench.docs.body.multiTab.draftsTitle': 'Los borradores sin guardar son locales a la pestaña',
  'workbench.docs.body.multiTab.drafts1':
    'Los borradores del editor viven en la memoria de su propia pestaña. Si la pestaña A guarda la misma ' +
    'regla que la pestaña B está editando, la pestaña A gana la escritura en almacenamiento — hoy no hay ' +
    'ningún aviso entre pestañas de «¿modificada, recargar?». Solo importa cuando dos pestañas editan la ' +
    'misma entidad a la vez.',

  // ── Concepts: Request Tracking ──────────────────────────────────────
  'workbench.docs.body.requestTracking.intro1Prefix': 'La pestaña',
  'workbench.docs.body.requestTracking.thisPage': 'Esta página',
  'workbench.docs.body.requestTracking.intro1Suffix':
    'del popup muestra qué reglas están activas para la página actual y con qué solicitudes coincidieron. ' +
    'El seguimiento abarca las fases de solicitud y de respuesta de cada conexión que la página establece.',
  'workbench.docs.body.requestTracking.phasesCaption':
    'Una misma conexión tiene dos fases — ambas contribuyen al recuento de la insignia.',
  'workbench.docs.body.requestTracking.howHeading': 'Cómo funciona',
  'workbench.docs.body.requestTracking.how1Prefix': 'La extensión observa las solicitudes HTTP vía',
  'workbench.docs.body.requestTracking.how1Middle':
    '— la API del navegador. Cuando la URL de una solicitud coincide con las condiciones de una regla ' +
    '(dominios, patrón de URL o regex de URL), se registra con su tipo de recurso. El registro ocurre en ' +
    'vivo dentro del service worker; el popup se limita a releer ese registro cuando abres la pestaña',
  'workbench.docs.body.requestTracking.how1Suffix': '.',
  'workbench.docs.body.requestTracking.howCaption':
    'El navegador emite los eventos webRequest; la extensión hace coincidir y registra; el popup lee más ' + 'tarde.',
  'workbench.docs.body.requestTracking.badge1':
    'Cada regla coincidente muestra una insignia numerada igual al número de solicitudes con las que ' +
    'coincidió. Haz clic en la insignia para desplegar una lista de marcas de tiempo, URL, tipos de recurso ' +
    'y el patrón que coincidió.',
  'workbench.docs.body.requestTracking.badgeCaption':
    'La insignia pliega el recuento; hacer clic en ella revela la lista completa de coincidencias.',
  'workbench.docs.body.requestTracking.directHeading': 'Coincidencias directas vs indirectas',
  'workbench.docs.body.requestTracking.direct1Prefix': 'A',
  'workbench.docs.body.requestTracking.directTerm': 'direct',
  'workbench.docs.body.requestTracking.direct1Middle':
    '— coincidencia directa — significa que la URL de la propia página coincidió. Una coincidencia',
  'workbench.docs.body.requestTracking.indirectTerm': 'indirecta',
  'workbench.docs.body.requestTracking.direct1Suffix':
    'significa que solo un subrecurso — script, hoja de estilos, XHR, imagen, fuente — coincidió sin que lo ' +
    'hiciera la URL de la página. La misma regla puede producir uno u otro tipo según la página en la que ' +
    'estés.',
  'workbench.docs.body.requestTracking.directCaption':
    'Una regla, dos contextos de página. Verde = coincidió. Discontinuo = excluido.',
  'workbench.docs.body.requestTracking.typesHeading': 'Tipos de recursos',
  'workbench.docs.body.requestTracking.types1Prefix': 'Cada solicitud coincidente lleva su tipo Chrome',
  'workbench.docs.body.requestTracking.types1Middle':
    '— Page, Frame, Fetch/XHR, Script, CSS, Image, Font, Media, WebSocket, Ping u Other. Consulta la ' + 'referencia',
  'workbench.docs.body.requestTracking.resourceTypesLink': 'Tipos de recursos',
  'workbench.docs.body.requestTracking.types1Suffix': 'para la tabla completa con ejemplos.',

  // ── Reference: Resource Types (section shell + table descriptions;
  //    tags/codes/example lines stay raw parity vocabulary) ────────────
  'workbench.docs.body.resourceTypes.introPrefix': 'Referencia de los valores Chrome',
  'workbench.docs.body.resourceTypes.introSuffix':
    'que muestran el seguimiento de solicitudes y la condición Tipos de recurso. Cada etiqueta corresponde ' +
    'a un único tipo subyacente — no hay solapamiento entre filas.',
  'workbench.docs.body.resourceTypes.anatomyCaption':
    'Qué clase de solicitud aterriza en qué ResourceType — de un vistazo.',
  'workbench.docs.body.resourceTypes.descPage':
    'Navegación de documento de nivel superior — la URL que se muestra en la barra de direcciones.',
  'workbench.docs.body.resourceTypes.descFrame': 'Un iframe o marco anidado incrustado en la página.',
  'workbench.docs.body.resourceTypes.descXhr':
    'Llamadas API vía fetch() o XMLHttpRequest. Chrome informa de ambas como el mismo tipo — no hay forma ' +
    'de distinguirlas.',
  'workbench.docs.body.resourceTypes.descScript': 'Archivos JavaScript cargados por la página.',
  'workbench.docs.body.resourceTypes.descStylesheet': 'Hojas de estilos cargadas por la página.',
  'workbench.docs.body.resourceTypes.descImage': 'Imágenes cargadas por la página o sus estilos.',
  'workbench.docs.body.resourceTypes.descFont': 'Fuentes web cargadas vía reglas @font-face.',
  'workbench.docs.body.resourceTypes.descMedia': 'Recursos de audio o vídeo.',
  'workbench.docs.body.resourceTypes.descWebsocket':
    'Handshake WebSocket — la solicitud HTTP de upgrade inicial. Solo se rastrea el handshake, no los ' +
    'mensajes individuales.',
  'workbench.docs.body.resourceTypes.descPing':
    'Solicitudes beacon y ping usadas típicamente para analítica y rastreo.',
  'workbench.docs.body.resourceTypes.descOther': 'Todo lo que no encaja en las categorías anteriores.',

  // ── Concepts: Actions (overview) ────────────────────────────────────
  'workbench.docs.body.actions.intro1Prefix': 'Una acción es la mitad «',
  'workbench.docs.body.actions.introDo': 'hacer',
  'workbench.docs.body.actions.intro1Middle': '» de una regla. Donde una',
  'workbench.docs.body.actions.conditionLink': 'condición',
  'workbench.docs.body.actions.intro1Middle2': 'decide',
  'workbench.docs.body.actions.introWhether': 'si',
  'workbench.docs.body.actions.intro1Middle3': 'la regla se dispara, la acción decide',
  'workbench.docs.body.actions.introWhatChanges': 'qué cambia',
  'workbench.docs.body.actions.intro1Suffix':
    '. Cada regla asocia una pila de condiciones combinadas con AND a exactamente una acción.',
  'workbench.docs.body.actions.categories1':
    'Las acciones se reparten en tres categorías — modificar la solicitud saliente, modificar la respuesta ' +
    'entrante o ejecutar código en la página. Cada acción la implementa uno de dos motores:',
  'workbench.docs.body.actions.engineDnr': 'DNR',
  'workbench.docs.body.actions.categoriesDnrParen': '(la API de Chrome',
  'workbench.docs.body.actions.categoriesDnrSuffix': ', rápida y nativa) o',
  'workbench.docs.body.actions.engineScript': 'Script',
  'workbench.docs.body.actions.categoriesScriptParen':
    '(el motor en página de Open Headers, para lo que DNR no puede expresar). Consulta',
  'workbench.docs.body.actions.executionLink': 'Cómo se ejecutan las reglas',
  'workbench.docs.body.actions.categories1Suffix': 'para las contrapartidas.',
  'workbench.docs.body.actions.ruleAnatomyCaption':
    'Una regla = condiciones combinadas con AND asociadas a exactamente una acción.',
  'workbench.docs.body.actions.taxonomyCaption': 'Tres categorías, cada acción con su etiqueta de motor.',
  'workbench.docs.body.actions.modifyRequestTitle': 'Modificar la solicitud',
  'workbench.docs.body.actions.tagRequest': 'antes de que salga del navegador',
  'workbench.docs.body.actions.modifyRequest1':
    'Remodela la solicitud saliente — sus encabezados, sus parámetros de URL, su cuerpo, su destino o si ' +
    'llega a salir siquiera. La mayoría de las reglas viven aquí.',
  'workbench.docs.body.actions.headerActionsLink': 'Acciones de encabezado',
  'workbench.docs.body.actions.liHeaderActionsRequest':
    '— Añadir / Reemplazar / Anexar / Quitar / Fusionar sobre los encabezados de solicitud.',
  'workbench.docs.body.actions.blockLink': 'Bloquear',
  'workbench.docs.body.actions.liBlock': '— cancelar la solicitud en la capa de red.',
  'workbench.docs.body.actions.redirectLink': 'Redirigir',
  'workbench.docs.body.actions.liRedirect': '— enviar la solicitud a una URL distinta, estática o regex.',
  'workbench.docs.body.actions.queryParamsLink': 'Parámetros de consulta',
  'workbench.docs.body.actions.liQueryParams': '— añadir, reemplazar o quitar parámetros de URL.',
  'workbench.docs.body.actions.requestBodyLink': 'Cuerpo de la solicitud',
  'workbench.docs.body.actions.liRequestBody':
    '— reescribir el cuerpo fetch / XHR saliente (estático, dinámico o filtrado por GraphQL).',
  'workbench.docs.body.actions.modifyResponseTitle': 'Modificar la respuesta',
  'workbench.docs.body.actions.tagResponse': 'antes de que la página la vea',
  'workbench.docs.body.actions.modifyResponse1':
    'Remodela la respuesta en su camino de vuelta — encabezados, cuerpo o estado HTTP. Útil para simular ' +
    'endpoints aún no construidos y forzar modos de fallo en desarrollo.',
  'workbench.docs.body.actions.liHeaderActionsResponse':
    '— las mismas cinco operaciones se aplican a los encabezados de respuesta.',
  'workbench.docs.body.actions.responseLink': 'Modificar la respuesta',
  'workbench.docs.body.actions.liResponse':
    '— simular o modificar la respuesta: cuerpo, estado o encabezados sintéticos.',
  'workbench.docs.body.actions.runCodeTitle': 'Ejecutar código',
  'workbench.docs.body.actions.tagRunCode': 'dentro de la página o su planificador',
  'workbench.docs.body.actions.runCode1':
    'Efectos que no encajan limpiamente en «modificar una solicitud o una respuesta» — inyección de código ' +
    'y latencia artificial. Ambos pasan por el motor Script porque DNR no tiene equivalente.',
  'workbench.docs.body.actions.injectLink': 'Inyectar JS / CSS',
  'workbench.docs.body.actions.liInject':
    '— ejecutar JavaScript o CSS en el contexto de la página, antes de los scripts de la página o con el ' +
    'DOM ya listo.',
  'workbench.docs.body.actions.delayLink': 'Retraso',
  'workbench.docs.body.actions.liDelay':
    '— añadir latencia artificial a las navegaciones y a los fetch / XHR iniciados por JS.',
  'workbench.docs.body.actions.oneActionTitle': 'Una acción por regla',
  'workbench.docs.body.actions.oneAction1':
    'Cada regla lleva exactamente una acción. Para hacer dos cosas a la vez — añadir un encabezado Y ' +
    'redirigir, por ejemplo — escribe dos reglas con las mismas condiciones. Ambas se disparan sobre la ' +
    'misma solicitud; DNR las compone en un orden documentado.',

  // ── Actions: Header Actions ─────────────────────────────────────────
  'workbench.docs.body.headerActions.intro':
    'Cuatro operaciones sobre los encabezados de solicitud y de respuesta — tres nativas (Añadir / ' +
    'Reemplazar, Anexar, Quitar) más una basada en script (Fusionar) para la concatenación de valores que ' +
    'DNR no puede expresar.',
  'workbench.docs.body.headerActions.opsCaption': 'Mismos encabezados de partida, cuatro resultados distintos',
  'workbench.docs.body.headerActions.overrideTitle': 'Añadir / Reemplazar',
  'workbench.docs.body.headerActions.override1':
    'Fija el encabezado a este valor. Reemplaza si está presente, añade si falta — siempre un único ' +
    'encabezado con tu valor.',
  'workbench.docs.body.headerActions.overrideCaption':
    'La misma regla cubre ambos casos — reemplaza cuando está presente, añade cuando falta.',
  'workbench.docs.body.headerActions.overrideWontApplyCaption':
    'Si las condiciones de la regla no coinciden con la solicitud, no pasa nada — sin error, ninguna ' + 'operación.',
  'workbench.docs.body.headerActions.appendTitle': 'Anexar',
  'workbench.docs.body.headerActions.append1':
    'Añade una nueva entrada de encabezado con el mismo nombre. El original se queda — resultan encabezados ' +
    'duplicados. Úsalo para Set-Cookie, Link, Via.',
  'workbench.docs.body.headerActions.appendCaption':
    'El encabezado original se queda; se añade una segunda fila con el mismo nombre. Ambos se entregan.',
  'workbench.docs.body.headerActions.appendWontApplyCaption':
    'Algunos encabezados no pueden duplicarse — el navegador los pliega. Recurre a Añadir / Reemplazar o ' +
    'Fusionar.',
  'workbench.docs.body.headerActions.removeTitle': 'Quitar',
  'workbench.docs.body.headerActions.remove1': 'Elimina todas las instancias de este encabezado. No requiere valor.',
  'workbench.docs.body.headerActions.removeCaption': 'La fila objetivo desaparece; todo lo demás pasa sin cambios.',
  'workbench.docs.body.headerActions.removeWontApplyCaption':
    'Si el encabezado no está, no pasa nada — sin error, simplemente ninguna operación.',
  'workbench.docs.body.headerActions.mergeTitle': 'Fusionar',
  'workbench.docs.body.headerActions.merge1Prefix':
    'Lee el valor existente en tiempo de ejecución y anexa el tuyo con un separador. Por defecto',
  'workbench.docs.body.headerActions.merge1Middle': 'para Cookie y',
  'workbench.docs.body.headerActions.merge1Suffix':
    'para los demás. El separador puede estar vacío para una concatenación directa.',
  'workbench.docs.body.headerActions.mergeCaption': 'El valor existente se queda; el tuyo se anexa tras el separador.',
  'workbench.docs.body.headerActions.mergeWontApplyCaption':
    'Solo motor de scripts — las navegaciones de página y los recursos estáticos pasan intactos.',
  'workbench.docs.body.headerActions.mergeLimitation':
    'Fusionar es invisible en DevTools y no puede leer los encabezados por defecto del navegador (Accept, ' +
    'User-Agent) — solo los encabezados definidos explícitamente por el código de la página.',

  // ── Actions: Block ──────────────────────────────────────────────────
  'workbench.docs.body.block.intro':
    'Cancela las solicitudes coincidentes en la capa de red. El navegador recibe un error de red y la ' +
    'página ve fallar la solicitud como si el servidor estuviera inaccesible.',
  'workbench.docs.body.block.howTitle': 'Cómo funciona',
  'workbench.docs.body.block.how1Prefix': 'Se compila en una acción DNR',
  'workbench.docs.body.block.how1Suffix':
    'sin cuerpo. Se aplica sea cual sea el tipo de recurso — páginas, iframes, scripts, imágenes, fuentes, ' +
    'fetch, XHR — de modo que una sola regla lo cubre todo, salvo que la acotes con una condición Tipos de ' +
    'recurso.',
  'workbench.docs.body.block.blockCaption':
    'La solicitud muere antes de salir del navegador; la página ve un error de red.',
  'workbench.docs.body.block.wontApplyCaption':
    'Los recursos ya cargados siguen cargados — Bloquear solo atrapa solicitudes futuras.',
  'workbench.docs.body.block.whenTitle': 'Cuándo usarlo',
  'workbench.docs.body.block.when1Prefix':
    'Bloquear dominios de publicidad / analítica / rastreo, simular una caída para un único host, o ' +
    'denegar el acceso a un endpoint dejando accesible el resto de una API. Para bloquear solo el documento ' +
    'de una página (no sus subrecursos), añade una condición Tipos de recurso de',
  'workbench.docs.body.block.when1Suffix': '.',
  'workbench.docs.body.block.useCasesCaption':
    'Cuatro patrones típicos — acota cada uno con condiciones (Dominios, Patrón de URL, Tipo de recurso).',
  'workbench.docs.body.block.note1Prefix': 'Bloquear una solicitud',
  'workbench.docs.body.block.note1Suffix':
    'muestra una página «ERR_BLOCKED_BY_CLIENT» en Chrome. Los bloqueos de subrecursos ocurren en silencio ' +
    '— lo que el usuario ve depende de la propia gestión de errores de la página.',

  // ── Actions: Redirect ───────────────────────────────────────────────
  'workbench.docs.body.redirect.intro':
    'Redirige las solicitudes coincidentes a una URL distinta. Admite URL estáticas y grupos de captura ' + 'regex.',
  'workbench.docs.body.redirect.staticTitle': 'Redirección estática',
  'workbench.docs.body.redirect.static1':
    'Introduce una URL completa para redirigir cada solicitud coincidente al mismo destino.',
  'workbench.docs.body.redirect.staticCaption':
    'Mismo destino para cada solicitud coincidente — sustitución de URL completa.',
  'workbench.docs.body.redirect.regexTitle': 'Redirección regex',
  'workbench.docs.body.redirect.regex1Prefix': 'Asóciala a una condición Regex de URL. Usa',
  'workbench.docs.body.redirect.regex1Suffix': ', etc. para referenciar los grupos de captura en la URL de destino.',
  'workbench.docs.body.redirect.regexCaption':
    'El texto coincidente del grupo de captura se sustituye en la URL de destino.',
  'workbench.docs.body.redirect.wontApplyCaption':
    'La redirección no se aplica retroactivamente a páginas ya cargadas. Chrome limita los bucles en ' + 'silencio.',
  'workbench.docs.body.redirect.whenTitle': 'Cuándo usarlo',
  'workbench.docs.body.redirect.when1':
    'Forzar HTTP → HTTPS, migrar usuarios desde un dominio antiguo, reescribir versiones de API y llevar ' +
    'el tráfico CDN a un servidor de desarrollo local son los cuatro patrones típicos. Asocia Estática a ' +
    'URL completas conocidas de antemano; recurre a Regex cuando la ruta deba atravesar la redirección.',
  'workbench.docs.body.redirect.useCasesCaption':
    'Cuatro patrones típicos — elige Regex cuando la ruta de destino dependa de la coincidencia.',

  // ── Actions: Query Params ───────────────────────────────────────────
  'workbench.docs.body.queryParam.introPrefix':
    'Modifica los parámetros de consulta de la URL antes de que la solicitud salga del navegador. Se ' +
    'compila en una acción',
  'workbench.docs.body.queryParam.introSuffix': 'de DNR.',
  'workbench.docs.body.queryParam.addTitle': 'Añadir / Reemplazar',
  'workbench.docs.body.queryParam.add1': 'Añade el parámetro si falta, o reemplaza su valor si ya está presente.',
  'workbench.docs.body.queryParam.addCaption':
    'Añade cuando falta, reemplaza cuando está presente — siempre un único parámetro coincidente con tu ' + 'valor.',
  'workbench.docs.body.queryParam.replaceOnlyTitle': 'Solo reemplazar',
  'workbench.docs.body.queryParam.replaceOnly1Prefix': 'Reemplaza el valor',
  'workbench.docs.body.queryParam.replaceOnlyStrong': 'solo cuando el parámetro ya está presente',
  'workbench.docs.body.queryParam.replaceOnly1Middle':
    '. Las URL sin el parámetro se dejan intactas. Úsalo para canonicalizar un valor (p. ej. forzar',
  'workbench.docs.body.queryParam.replaceOnly1Suffix':
    'en URL que ya llevan alguna región) sin inyectarlo en URL que no lo tenían.',
  'workbench.docs.body.queryParam.replaceOnlyCaption':
    'Solo reemplaza valores existentes — las URL sin el parámetro quedan intactas.',
  'workbench.docs.body.queryParam.removeTitle': 'Quitar',
  'workbench.docs.body.queryParam.remove1': 'Quita parámetros concretos por nombre. El valor se ignora.',
  'workbench.docs.body.queryParam.removeCaption':
    'El parámetro nombrado desaparece; todos los demás parámetros de consulta pasan.',
  'workbench.docs.body.queryParam.removeAllTitle': 'Quitar todo',
  'workbench.docs.body.queryParam.removeAll1':
    'Elimina la cadena de consulta entera. No puede combinarse con Añadir / Reemplazar en la misma regla.',
  'workbench.docs.body.queryParam.removeAllCaption': 'Elimina toda la consulta en un solo paso — la URL acaba desnuda.',
  'workbench.docs.body.queryParam.wontApplyCaption':
    'Quitar todo entra en conflicto con Añadir / Reemplazar en la capa DNR — divídelo en dos reglas.',
  'workbench.docs.body.queryParam.whenTitle': 'Cuándo usarlo',
  'workbench.docs.body.queryParam.when1':
    'Forzar un indicador de depuración, canonicalizar la región o la configuración regional, purgar ' +
    'parámetros de rastreo o quitar todas las cadenas de consulta por privacidad. Cada uno corresponde ' +
    'limpiamente a una de las cuatro operaciones anteriores.',
  'workbench.docs.body.queryParam.useCasesCaption':
    'Cuatro patrones típicos — elige la operación que corresponda a tu intención.',

  // ── Actions: Inject JS / CSS ────────────────────────────────────────
  'workbench.docs.body.inject.intro':
    'Inyecta JavaScript o CSS en las páginas coincidentes. El código se ejecuta en el contexto de la ' +
    'página vía un content script.',
  'workbench.docs.body.inject.timingCaption':
    'Momento de inserción — antes de los scripts de la página (Lo antes posible) vs seguro para el DOM ' +
    '(Tras la carga de la página).',
  'workbench.docs.body.inject.scriptTitle': 'Inyección de script',
  'workbench.docs.body.inject.script1': 'Código en línea o una URL externa. Elige el momento de inserción:',
  'workbench.docs.body.inject.asapStrong': 'Lo antes posible',
  'workbench.docs.body.inject.asap1':
    '— se ejecuta antes que los propios scripts de la página. Útil para los monkey-patches que necesitan ' +
    'ganar la carrera (p. ej. envolver',
  'workbench.docs.body.inject.asap1Suffix': 'antes de que el código de la aplicación capture una referencia).',
  'workbench.docs.body.inject.afterStrong': 'Tras la carga de la página',
  'workbench.docs.body.inject.after1':
    '— se ejecuta una vez que la página se ha analizado. Opción por defecto más segura para el código que ' +
    'lee el DOM, ya que la existencia de los elementos está garantizada.',
  'workbench.docs.body.inject.scriptCaption':
    'El script aterriza como etiqueta <script> en la página — ve las mismas globales que el JS de la ' + 'página.',
  'workbench.docs.body.inject.cssTitle': 'Inyección de CSS',
  'workbench.docs.body.inject.css1Prefix': 'Inyecta CSS personalizado como etiqueta',
  'workbench.docs.body.inject.css1Suffix':
    'añadida a la página. Útil para sustituciones de modo oscuro, para ocultar elementos ruidosos o para ' +
    'la tematización por entorno.',
  'workbench.docs.body.inject.cssCaption': 'El CSS se añade como etiqueta <style> con la especificidad CSS normal.',
  'workbench.docs.body.inject.wontApplyCaption':
    'Los iframes con sandbox y las páginas con CSP estricta bloquean los scripts inyectados.',
  'workbench.docs.body.inject.whenTitle': 'Cuándo usarlo',
  'workbench.docs.body.inject.when1':
    'Hacer monkey-patch de las API del navegador antes de que el código de la aplicación las capture, ' +
    'forzar un tema oscuro, ocultar elementos de interfaz ruidosos y sembrar indicadores de funcionalidad ' +
    'a nivel de window antes de que la página se inicialice.',
  'workbench.docs.body.inject.useCasesCaption':
    'Cuatro patrones típicos — el momento Lo antes posible es obligatorio para el primero y el cuarto.',

  // ── Actions: Delay ──────────────────────────────────────────────────
  'workbench.docs.body.delay.intro':
    'Añade latencia artificial a las solicitudes coincidentes. Tres carriles corren en paralelo según la ' +
    'clase de solicitud.',
  'workbench.docs.body.delay.routingCaption':
    'Enrutamiento del retraso — tres carriles para tres clases de solicitudes.',
  'workbench.docs.body.delay.navHeading': 'Navegaciones de documento e iframe',
  'workbench.docs.body.delay.nav1Prefix': 'Enrutadas a través de una página de espera local. Respeta retrasos de hasta',
  'workbench.docs.body.delay.navMs': '30 000 ms',
  'workbench.docs.body.delay.nav1Suffix': '— el techo de redirección DNR de Chrome.',
  'workbench.docs.body.delay.navCaption':
    'Una página de espera local retiene la navegación N ms y luego la reenvía al destino real.',
  'workbench.docs.body.delay.xhrHeading': 'XHR / fetch iniciados por JS',
  'workbench.docs.body.delay.xhr1Prefix': 'Interceptados por un monkey-patch de',
  'workbench.docs.body.delay.xhr1Middle': 'a nivel de página. Limitado a',
  'workbench.docs.body.delay.xhrMs': '5 000 ms',
  'workbench.docs.body.delay.xhr1Suffix':
    'para evitar agotar el pool de conexiones HTTP de Chrome — los valores por encima se recortan en el ' + 'envío.',
  'workbench.docs.body.delay.xhrCaption':
    'Un setTimeout dentro del parche a nivel de página retiene la llamada antes de reenviarla a la red.',
  'workbench.docs.body.delay.wontApplyCaption':
    'Los subrecursos y los fetch de service worker escapan al monkey-patch a nivel de página.',
  'workbench.docs.body.delay.whenTitle': 'Cuándo usarlo',
  'workbench.docs.body.delay.when1':
    'Hacer aflorar regresiones de estados de carga, ejercitar rutas de código debounce/throttle, exponer ' +
    'condiciones de carrera entre solicitudes concurrentes y aproximar condiciones de red lenta durante el ' +
    'desarrollo local.',
  'workbench.docs.body.delay.useCasesCaption':
    'Cuatro patrones típicos — asócialo a Patrón de URL o Dominios para acotar.',
  'workbench.docs.body.delay.desktopNoteTitle': 'Aplicación de escritorio — nota de producto',
  'workbench.docs.body.delay.desktopNote1':
    'Limitar la velocidad de los recursos estáticos (imágenes, scripts, hojas de estilos, fuentes) exige ' +
    'una capa de red local real capaz de mantener conexiones abiertas y transmitir bytes en streaming — ' +
    'fuera del alcance de una extensión. La aplicación de escritorio lo asumirá pronto.',

  // ── Actions: Request Body ───────────────────────────────────────────
  'workbench.docs.body.requestBody.introPrefix':
    'Sustituye o transforma los cuerpos de solicitud antes de que salgan del navegador. Basado en script — ' +
    'intercepta',
  'workbench.docs.body.requestBody.introAnd': 'y',
  'workbench.docs.body.requestBody.introDot': '.',
  'workbench.docs.body.requestBody.interceptCaption':
    'La regla se dispara entre page.js y la red — tres formas de transformación',
  'workbench.docs.body.requestBody.staticTitle': 'Cuerpo estático',
  'workbench.docs.body.requestBody.static1':
    'Reemplaza el cuerpo entero de la solicitud por una cadena fija. Funciona tanto para REST como para ' +
    'GraphQL — la regla no analiza el cuerpo, lo sustituye en bloque.',
  'workbench.docs.body.requestBody.staticCaption': 'Cuerpo entero reemplazado — el original se descarta.',
  'workbench.docs.body.requestBody.dynamicTitle': 'Cuerpo dinámico',
  'workbench.docs.body.requestBody.dynamic1':
    'Escribe una función que recibe el cuerpo original y el contexto de la solicitud, y devuelve el cuerpo ' +
    'modificado. La función recibe',
  'workbench.docs.body.requestBody.dynamicDot': '.',
  'workbench.docs.body.requestBody.dynamicCaption': 'La función ve el original; devuelve lo que debe enviarse.',
  'workbench.docs.body.requestBody.graphqlTitle': 'Filtro GraphQL',
  'workbench.docs.body.requestBody.graphql1Prefix':
    'Cuando el tipo de recurso es GraphQL, la regla solo se dispara sobre las solicitudes cuyo campo ' +
    'configurado de la carga JSON coincide con el valor. El runtime analiza el cuerpo de la solicitud como ' +
    'JSON, lee el campo nombrado por',
  'workbench.docs.body.requestBody.graphql1Middle': 'y lo compara con',
  'workbench.docs.body.requestBody.graphql1Middle2': 'con el operador elegido (',
  'workbench.docs.body.requestBody.graphql1Middle3': 'para la coincidencia exacta,',
  'workbench.docs.body.requestBody.graphql1Suffix': 'para la subcadena).',
  'workbench.docs.body.requestBody.graphql2Prefix': 'Claves habituales:',
  'workbench.docs.body.requestBody.graphql2Middle': 'para la operación nombrada,',
  'workbench.docs.body.requestBody.graphql2Suffix':
    'para una subcadena del texto de la consulta. Las solicitudes sin cuerpo JSON, o cuyo campo falta o no ' +
    'coincide, pasan intactas.',
  'workbench.docs.body.requestBody.graphqlCaption':
    'Puerta a nivel de campo — las operaciones que no coinciden pasan intactas.',
  'workbench.docs.body.requestBody.wontApplyCaption':
    'GET/HEAD no tienen nada que reemplazar; los recursos estáticos no entran en la interceptación de ' + 'script.',
  'workbench.docs.body.requestBody.whenTitle': 'Cuándo usarlo',
  'workbench.docs.body.requestBody.when1':
    'Forzar datos de prueba, estampar cada carga con metadatos (indicadores de depuración, identificadores ' +
    'de solicitud), simular operaciones GraphQL concretas y anonimizar PII antes de reenviar son los ' +
    'cuatro patrones típicos.',
  'workbench.docs.body.requestBody.useCasesCaption':
    'Cuatro patrones típicos — asócialo a Patrón de URL o Dominios para acotar.',

  // ── Actions: Modify Response ────────────────────────────────────────
  'workbench.docs.body.response.introPrefix':
    'Intercepta llamadas API y devuelve respuestas personalizadas — control total del código de estado, el ' +
    'cuerpo y los encabezados de respuesta. Basado en script — intercepta',
  'workbench.docs.body.response.introAnd': 'y',
  'workbench.docs.body.response.introDot': '.',
  'workbench.docs.body.response.flowCaption':
    'Estática se salta la red por completo; Dinámica la toca primero y luego transforma.',
  'workbench.docs.body.response.staticTitle': 'Respuesta estática',
  'workbench.docs.body.response.static1':
    'Devuelve un cuerpo fijo con control total de la respuesta sintética — código de estado, Content-Type ' +
    'y cualquier encabezado de respuesta adicional (Set-Cookie, encabezados CORS, indicadores ' +
    'personalizados). La solicitud real nunca se emite. Útil para el desarrollo sin conexión contra unos ' +
    'datos de prueba conocidos.',
  'workbench.docs.body.response.staticCaption':
    'El servidor nunca llega a contactarse — la página recibe los datos de prueba como si vinieran de la ' + 'red.',
  'workbench.docs.body.response.dynamicTitle': 'Respuesta dinámica',
  'workbench.docs.body.response.dynamic1':
    'La solicitud real se emite primero. Tu función recibe la respuesta y el contexto de la solicitud, y ' +
    'devuelve la respuesta modificada. La función recibe',
  'workbench.docs.body.response.dynamicDot': '.',
  'workbench.docs.body.response.dynamic2':
    'El código de estado, el Content-Type y los campos de encabezado de respuesta definidos en la regla se ' +
    'aplican igualmente por encima del valor devuelto por la función, de modo que puedes mutar el cuerpo ' +
    'dejando que la regla controle los encabezados de envoltura.',
  'workbench.docs.body.response.dynamicCaption': 'La llamada real ocurre primero; la función reescribe lo que vuelve.',
  'workbench.docs.body.response.graphqlTitle': 'Filtro GraphQL',
  'workbench.docs.body.response.graphql1':
    'Cuando el tipo de recurso es GraphQL, la regla solo se dispara sobre las solicitudes cuyo campo ' +
    'configurado de la carga JSON coincide con el valor definido (Equals o Contains) — así, un único ' +
    'endpoint que multiplexa muchas operaciones puede interceptarse una operación a la vez. Las ' +
    'solicitudes cuya carga no coincide pasan directas a la red, intactas.',
  'workbench.docs.body.response.wontApplyCaption':
    'Los recursos estáticos y las navegaciones de página nunca entran en la interceptación de script.',
  'workbench.docs.body.response.whenTitle': 'Cuándo usarlo',
  'workbench.docs.body.response.when1':
    'El desarrollo sin conexión contra datos de prueba, la simulación de respuestas de error concretas, la ' +
    'censura de PII antes de que llegue a la página y el ejercicio de formas de carga límite difíciles de ' +
    'reproducir contra un backend real.',
  'workbench.docs.body.response.useCasesCaption':
    'Cuatro patrones típicos — elige Estática para datos de prueba, Dinámica para transformar datos ' + 'reales.',

  // ── Reference: Conditions ───────────────────────────────────────────
  'workbench.docs.body.conditions.intro1Prefix':
    'Una condición es un filtro sobre un atributo de una solicitud saliente. Apila varias condiciones y se ' +
    'combinan con lógica AND — cada condición debe coincidir para que la regla se dispare. Cada condición ' +
    'corresponde directamente a un campo Chrome',
  'workbench.docs.body.conditions.intro1Suffix': 'subyacente.',
  'workbench.docs.body.conditions.intro2Prefix': 'La mayoría de las condiciones tienen además una variante',
  'workbench.docs.body.conditions.exclStrong': 'Excl.',
  'workbench.docs.body.conditions.intro2Suffix':
    'en el editor de reglas — Excl. métodos, Excl. recursos, Excl. iniciador, Excl. enc. resp. — que ' +
    'invierte la coincidencia (p. ej. «todo salvo estos métodos»). Úsalas siempre que el conjunto negativo ' +
    'sea más pequeño que el positivo.',
  'workbench.docs.body.conditions.anatomyCaption':
    'Una regla asocia condiciones combinadas con AND a una acción — las condiciones deciden si la regla se ' +
    'dispara.',
  'workbench.docs.body.conditions.matchingCaption':
    'Cada condición comprueba un atributo de la solicitud. Todas deben coincidir para que la regla se ' + 'dispare.',
  'workbench.docs.body.conditions.hostVsOriginCaption':
    'La URL de la página y la URL de destino del fetch se rastrean por separado — por eso hay dos ' +
    'condiciones de dominio.',
  'workbench.docs.body.conditions.urlPatternTitle': 'Patrón de URL',
  'workbench.docs.body.conditions.urlPattern1Prefix': 'Patrón con comodines sobre la URL completa. Usa',
  'workbench.docs.body.conditions.urlPattern1Middle':
    'para coincidir con cualquier carácter. El protocolo debe especificarse:',
  'workbench.docs.body.conditions.urlPattern1Middle2': 'para cualquiera,',
  'workbench.docs.body.conditions.urlPattern1Suffix': 'para HTTPS únicamente.',
  'workbench.docs.body.conditions.urlPatternCaption':
    'Dorado = comodín, verde = literal. Cada URL de prueba de abajo muestra si el patrón coincide con ' + 'ella.',
  'workbench.docs.body.conditions.urlRegexTitle': 'Regex de URL',
  'workbench.docs.body.conditions.urlRegex1':
    'Expresión regular RE2 sobre la URL completa, protocolo incluido. Para coincidencias que los comodines ' +
    'no pueden expresar. No puede combinarse con Patrón de URL en la misma regla.',
  'workbench.docs.body.conditions.urlRegexCaption':
    'Violeta = sintaxis regex real. Verde = caracteres literales. Cada URL de prueba de abajo muestra si ' +
    'la regex coincide.',
  'workbench.docs.body.conditions.requestDomainsTitle': 'Dominios de solicitud',
  'workbench.docs.body.conditions.requestDomains1Prefix':
    'Coincide con un dominio más cada uno de sus subdominios, automáticamente. Introduce el dominio apex ' +
    'una vez; la regla cubre',
  'workbench.docs.body.conditions.requestDomains1Suffix': 'y cualquier anidamiento más profundo, sin comodines.',
  'workbench.docs.body.conditions.requestDomainsCaption':
    'Un valor, todos los subdominios. Los casos límite de abajo muestran qué cuenta como subdominio de ' + 'verdad.',
  'workbench.docs.body.conditions.excludeDomainsTitle': 'Excluir dominios',
  'workbench.docs.body.conditions.excludeDomains1':
    'Resta hosts a las coincidencias de otra condición — misma semántica de subdominios que Dominios de ' +
    'solicitud, así que excluir un host excluye también sus subdominios. No coincide con nada por sí sola.',
  'workbench.docs.body.conditions.excludeDomainsCaption':
    'La inclusión verde reduce a un conjunto candidato; la exclusión roja retira algunos. Los subdominios ' + 'siguen.',
  'workbench.docs.body.conditions.initiatorDomainsTitle': 'Dominios iniciadores',
  'workbench.docs.body.conditions.initiatorDomains1':
    'Coincide según qué página está abierta cuando se hace la solicitud — el origen de la solicitud, no su ' +
    'destino. La misma llamada fetch a la misma URL puede coincidir o no según la pestaña en la que navega ' +
    'el usuario.',
  'workbench.docs.body.conditions.initiatorDomainsCaption':
    'Mismo destino, dos contextos de página distintos. El iniciador decide cuál coincide.',
  'workbench.docs.body.conditions.methodsTitle': 'Métodos',
  'workbench.docs.body.conditions.methods1':
    'Filtra por verbo HTTP. Multiselección — elige los métodos que deben coincidir; el resto no dispara la ' +
    'regla. Deja la condición completamente desactivada para coincidir con todos los métodos.',
  'workbench.docs.body.conditions.methodsCaption':
    'Las píldoras naranjas están seleccionadas; las grises se saltan. Las solicitudes de prueba de abajo ' +
    'trazan cada verbo hasta su resultado.',
  'workbench.docs.body.conditions.resourceTypesTitle': 'Tipos de recurso',
  'workbench.docs.body.conditions.resourceTypes1Prefix':
    'Filtra por la clase de recurso que se está cargando — navegaciones de página, XHR/fetch, scripts, ' +
    'imágenes, fuentes y más. Multiselección como Métodos. Consulta la referencia',
  'workbench.docs.body.conditions.resourceTypesLink': 'Tipos de recursos',
  'workbench.docs.body.conditions.resourceTypes1Suffix':
    'para la lista completa con nombres de código y ejemplos concretos.',
  'workbench.docs.body.conditions.resourceTypesCaption':
    'Las clases violetas coinciden; las grises se saltan. Cada solicitud de prueba muestra su clase en ' + 'línea.',
  'workbench.docs.body.conditions.domainTypeTitle': 'Tipo de dominio',
  'workbench.docs.body.conditions.domainType1Prefix': 'Clasifica cada solicitud según su relación con la página —',
  'workbench.docs.body.conditions.domainType1Middle': 'cuando el destino comparte el dominio registrable de la página,',
  'workbench.docs.body.conditions.domainType1Suffix':
    'cuando no. Uso común: bloquear rastreadores (coincidir solo con thirdParty) o acotar una regla a tus ' +
    'propios servicios (coincidir solo con firstParty).',
  'workbench.docs.body.conditions.domainTypeCaption':
    'El banner de la página fija el origen; el selector elige qué tipo coincide; la tabla muestra el ' +
    'veredicto por destino.',
  'workbench.docs.body.conditions.headersTitle': 'Encabezados de respuesta',
  'workbench.docs.body.conditions.headers1':
    'Hace coincidir las respuestas que llevan un encabezado concreto con un valor concreto. El DNR de ' +
    'Chrome no expone la coincidencia de encabezados de solicitud — esta condición es solo del lado de la ' +
    'respuesta. Tanto el nombre del encabezado como el valor se comparan como cadenas exactas (sin ' +
    'comodines, sin coincidencia parcial) y el encabezado debe estar realmente presente en la respuesta.',
  'workbench.docs.body.conditions.headersCaption':
    'Dos píldoras (nombre + valor) unidas por =, y luego encabezados de respuesta de prueba golpeando cada ' +
    'modo de fallo.',

  // ── Open Headers: Paradigm ──────────────────────────────────────────
  'workbench.docs.body.paradigm.oneExtensionHeading': 'Todo en una sola extensión',
  'workbench.docs.body.paradigm.oneExtension1':
    'Tres categorías de producto se han repartido históricamente esta superficie: los proxies de ' +
    'escritorio gestionan la interceptación HTTP, las plataformas API en la nube retienen tus solicitudes ' +
    'y colecciones, y las extensiones ligeras de encabezados cubren el caso «solo reescribir un ' +
    'encabezado». Ninguna incluye a las demás. Open Headers sí — dentro de una única extensión de ' +
    'navegador, con un solo almacén de espacios de trabajo alimentando cada superficie.',
  'workbench.docs.body.paradigm.convergenceCaption':
    'Tres categorías heredadas convergen en una sola instalación. Nadie más incluye esta combinación ' +
    'dentro de la extensión.',
  'workbench.docs.body.paradigm.ruleEngineHeading': 'Motor de reglas de clase empresarial',
  'workbench.docs.body.paradigm.ruleEngine1Prefix':
    'El motor de reglas no es un truco único estirado sobre nueve interfaces — son dos caminos de ' +
    'ejecución reales con un lenguaje compartido encima. Las reglas',
  'workbench.docs.body.paradigm.dnrNativeStrong': 'nativas de DNR',
  'workbench.docs.body.paradigm.ruleEngine1Middle': 'se compilan hacia Chrome vía',
  'workbench.docs.body.paradigm.ruleEngine1Middle2':
    '— la API que atrapa cada solicitud emitida por el navegador (páginas, iframes, fetch, XHR, imágenes, ' +
    'fuentes, scripts). El',
  'workbench.docs.body.paradigm.scriptEngineStrong': 'motor de scripts',
  'workbench.docs.body.paradigm.ruleEngine1Suffix':
    'toma el relevo donde DNR no llega — fusionar valores de encabezados, transformar cuerpos, simular ' +
    'respuestas, inyectar código, retrasar llamadas. Ambos motores leen el mismo lenguaje de condiciones y ' +
    'los mismos cinco ámbitos de variables, de modo que una regla escrita contra DNR pasa al motor de ' +
    'scripts cambiando un solo tipo de acción.',
  'workbench.docs.body.paradigm.ruleEngineCaption':
    'Dos caminos de ejecución, nueve categorías de reglas, un lenguaje compartido de condiciones + ' + 'variables.',
  'workbench.docs.body.paradigm.apiCatalogHeading': 'Catálogo completo de solicitudes API',
  'workbench.docs.body.paradigm.apiCatalog1':
    'Cada capacidad que incluye un cliente API de escritorio — construcción de solicitudes, entornos, ' +
    'OAuth 2.0 (incluidos PKCE + Client Credentials + refresh), scripts pre y post-respuesta, multipart ' +
    'con blobs de archivo direccionados por contenido, colecciones + carpetas, GraphQL con introspección ' +
    'de esquema — vive dentro de la extensión. El mismo almacén de espacios de trabajo que las reglas, los ' +
    'mismos cinco ámbitos de variables, las mismas superficies. Trae tus colecciones de otra plataforma y ' +
    'sigue trabajando; nada vuelve a salir hacia una nube que no controlas.',
  'workbench.docs.body.paradigm.apiCatalogCaption':
    'El editor de solicitudes, con soporte de protocolos, cada tipo de autenticación, scripts, archivos y ' +
    'colecciones — dentro de la extensión.',
  'workbench.docs.body.paradigm.localFirstHeading': 'Local primero, por diseño',
  'workbench.docs.body.paradigm.localFirst1Prefix':
    '«Local primero» es una postura, no una funcionalidad. La extensión no tiene sistema de cuentas, ni ' +
    'relé en la nube, ni rastreo — el único dato de uso es un conteo anónimo de funcionalidades, ' +
    'inspeccionable byte a byte y desactivable con un interruptor — y tienes una ' +
    'elección real sobre',
  'workbench.docs.body.paradigm.localFirstWhere': 'dónde',
  'workbench.docs.body.paradigm.localFirst1Suffix':
    'vive el back-end. Cuatro opciones de alojamiento, todas solo locales, todas bajo tu control: el ' +
    'service worker en el navegador (hoy, sin configuración alguna), el back-end embebido de la aplicación ' +
    'de escritorio, un servidor local autónomo sirviendo cada superficie de Open Headers en una máquina, o ' +
    'un back-end autoalojado en tu propia VM. Cada opción preserva las mismas garantías; la contrapartida ' +
    'es el alcance, no la propiedad.',
  'workbench.docs.body.paradigm.localFirst2':
    'La colaboración en equipo llega a través de almacenamiento controlado por el usuario (Git) — no a ' +
    'través de un servidor del proveedor.',
  'workbench.docs.body.paradigm.frontEnds1Prefix': 'El mismo principio se aplica a',
  'workbench.docs.body.paradigm.frontEndsHow': 'cómo',
  'workbench.docs.body.paradigm.frontEnds1Suffix':
    'llegas a esos datos. La extensión de navegador es el front-end por defecto — cuatro superficies ' +
    'dentro del navegador. Una aplicación de escritorio nativa, una CLI y una aplicación web remota la ' +
    'acompañan. Cada front-end habla con el back-end que elijas; escoge cualquier combinación, y ' +
    'cada superficie se mantiene sincronizada.',
  'workbench.docs.body.paradigm.autoSyncHeading': 'Auto-Sync sin perder tu trabajo',
  'workbench.docs.body.paradigm.autoSync1Prefix':
    'La sincronización entre dispositivos suele ser donde los productos local primero ceden y te piden ' +
    'confiar en su nube. Open Headers la resuelve a nivel',
  'workbench.docs.body.paradigm.perFieldStrong': 'por campo',
  'workbench.docs.body.paradigm.autoSync1Middle': ': el popup que conmuta el indicador',
  'workbench.docs.body.paradigm.autoSync1Suffix':
    'de una regla y el workbench que reescribe un valor de encabezado en la misma regla aterrizan los dos, ' +
    'en cualquier orden, sin banner de borrador obsoleto y sin sobrescritura. El mismo enfoque escala de ' +
    'las cuatro superficies de una extensión a un servidor local respaldando extensión + escritorio + ' +
    'CLI, y a espacios de trabajo de equipo multiusuario a través de un remoto Git — sin necesitar ' +
    'nunca un servidor del proveedor en medio.',
  'workbench.docs.body.paradigm.fieldSyncCaption':
    'Dos superficies, una regla, campos distintos — ambas ediciones aterrizan, nada se sobrescribe.',
  'workbench.docs.body.paradigm.noteCalloutPrefix':
    '¿Quieres ver cómo se compara esto con otras herramientas que hayas probado?',
  'workbench.docs.body.paradigm.comparisonLink': 'Cómo nos comparamos',
  'workbench.docs.body.paradigm.noteCalloutMiddle':
    'viene a continuación. ¿Quieres ver toda la plataforma en una vista? Salta a',
  'workbench.docs.body.paradigm.roadmapLink': 'Cada superficie, entregada',
  'workbench.docs.body.paradigm.noteCalloutSuffix': '.',

  // ── Open Headers: Comparison ────────────────────────────────────────
  'workbench.docs.body.comparison.intro1':
    'La versión más corta: Open Headers es lo que construirías si tomaras la potencia de modelado de ' +
    'solicitudes de un proxy de escritorio, la biblioteca de reglas de una plataforma API en la nube y la ' +
    'superficie siempre activa de una extensión de solo encabezados, y les pidieras compartir un único ' +
    'almacén.',
  'workbench.docs.body.comparison.matrixCaption':
    'Tres categorías de producto, un juego de contrapartidas cada una — y dónde aterriza Open Headers.',
  'workbench.docs.body.comparison.vsCloudHeading': 'vs plataformas API en la nube',
  'workbench.docs.body.comparison.vsCloud1':
    'Las herramientas alojadas en la nube esperan que tu tráfico, tus credenciales y tus definiciones de ' +
    'reglas vivan en sus servidores. Ese modelo asume que te parece bien que esos datos salgan de tu ' +
    'máquina — y mantener una cuenta para acceder a tu propio trabajo. Open Headers no hace ninguna de las ' +
    'dos suposiciones. Todo queda en local; la colaboración en equipo llega a través de almacenamiento ' +
    'controlado por el usuario (Git), no a través de la base de datos de un proveedor.',
  'workbench.docs.body.comparison.vsProxiesHeading': 'vs proxies de escritorio',
  'workbench.docs.body.comparison.vsProxies1Prefix':
    'Los proxies enrutan todo tu tráfico por un proceso separado. Son potentes pero pesados: instalar un ' +
    'binario, instalar un certificado CA, configurar cada aplicación hacia el puerto del proxy. Open ' +
    'Headers se apoya en Chrome:',
  'workbench.docs.body.comparison.vsProxies1Suffix':
    '— la API para el tráfico estático — y un motor de scripts por página para las transformaciones ' +
    'dinámicas. Sin puerto proxy, sin certificado CA, sin configuración por aplicación — y las reglas ' +
    'coincidentes se aplican con los permisos de la propia página, no con los de un intermediario.',
  'workbench.docs.body.comparison.vsHeaderOnlyHeading': 'vs extensiones de solo encabezados',
  'workbench.docs.body.comparison.vsHeaderOnly1Prefix':
    'Las extensiones de solo encabezados gestionan exactamente un tipo de regla y ahí se quedan. Open ' +
    'Headers gestiona',
  'workbench.docs.body.comparison.nineLink': 'nueve',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle':
    '— encabezado Añadir / Reemplazar / Anexar / Quitar / Fusionar,',
  'workbench.docs.body.comparison.blockLink': 'Bloquear',
  'workbench.docs.body.comparison.redirectLink': 'Redirigir',
  'workbench.docs.body.comparison.queryParamsLink': 'Parámetros de consulta',
  'workbench.docs.body.comparison.injectLink': 'Inyectar',
  'workbench.docs.body.comparison.delayLink': 'Retraso',
  'workbench.docs.body.comparison.requestBodyLink': 'Cuerpo de la solicitud',
  'workbench.docs.body.comparison.responseLink': 'Respuesta',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle2': '— todos guiados por el mismo',
  'workbench.docs.body.comparison.conditionLanguageLink': 'lenguaje de condiciones',
  'workbench.docs.body.comparison.vsHeaderOnly1Middle3': ', todos observables a través de',
  'workbench.docs.body.comparison.requestTrackingLink': 'el seguimiento de solicitudes',
  'workbench.docs.body.comparison.vsHeaderOnly1Suffix': 'en la misma superficie.',
  'workbench.docs.body.comparison.whyMattersTitle': 'Por qué esto importa en la práctica',
  'workbench.docs.body.comparison.whyMatters1':
    'La mayoría de los flujos de trabajo tocan más de una de estas categorías. Simular una respuesta API, ' +
    'bloquear un rastreador de terceros y forzar un encabezado de depuración en un único entorno son tres ' +
    'tipos de regla distintos — tres instalaciones distintas en el mundo heredado. Aquí comparten un solo ' +
    'espacio de trabajo.',

  // ── Open Headers: Roadmap ───────────────────────────────────────────
  'workbench.docs.body.roadmap.intro1Prefix':
    'Open Headers empezó siendo solo local — una extensión en un dispositivo. Cada hito de abajo extiende ' +
    'esa forma sin romperla, y todos están entregados. La sincronización entre usuarios llega por medios',
  'workbench.docs.body.roadmap.userControlledStrong': 'controlados por el usuario',
  'workbench.docs.body.roadmap.intro1Suffix':
    '— repositorios Git y despliegues autoalojados — nunca una nube alojada por el proveedor.',
  'workbench.docs.body.roadmap.gitHeading': 'Colaboración de espacios de trabajo vía Git (listo para equipos)',
  'workbench.docs.body.roadmap.git1Prefix':
    'Los espacios de trabajo se serializan a YAML en un repositorio Git que tú controlas. Pull sincroniza; ' +
    'push comparte; los conflictos de fusión se resuelven con las herramientas existentes de Git. Sin ' +
    'servidor central, sin cuenta, sin dependencia de un proveedor. La presencia en tiempo real es',
  'workbench.docs.body.roadmap.gitAnd': 'y',
  'workbench.docs.body.roadmap.git1Suffix': '— duradero, auditable, ya comprendido.',
  'workbench.docs.body.roadmap.desktopHeading': 'Aplicación de escritorio',
  'workbench.docs.body.roadmap.desktop1':
    'Un binario nativo que ejecuta el mismo almacén de espacios de trabajo que la extensión. Útil para ' +
    'superficies que una extensión no puede alcanzar — modelado del tráfico a nivel de sistema, edición ' +
    'multiventana, integración más profunda con el sistema de archivos. Ambos comparten el mismo formato ' +
    'en disco, así que abrir la aplicación de escritorio sobre un espacio de trabajo que la extensión ' +
    'posee es una lectura, no una migración.',
  'workbench.docs.body.roadmap.mcpHeading': 'Servidor MCP — control por agentes de IA',
  'workbench.docs.body.roadmap.mcp1Prefix': 'Open Headers se expone a través del',
  'workbench.docs.body.roadmap.mcpStrong': 'Model Context Protocol',
  'workbench.docs.body.roadmap.mcp1Suffix':
    'para que cualquier cliente de IA compatible con MCP — Claude Desktop, Claude Code, Cursor, VS Code, ' +
    'Cline y el ecosistema creciente detrás — pueda manejar tu espacio de trabajo directamente. Pídele al ' +
    'agente en lenguaje natural que añada una regla de encabezado, ejecute una solicitud guardada contra ' +
    'staging, cambie de entorno, compare dos espacios de trabajo o importe una colección de Postman; el ' +
    'agente lo traduce a llamadas de herramientas MCP y tu workbench refleja el resultado.',
  'workbench.docs.body.roadmap.mcp2Prefix': 'El servidor corre',
  'workbench.docs.body.roadmap.mcpLocalOnlyStrong': 'solo en local por defecto',
  'workbench.docs.body.roadmap.mcp2Middle':
    '(transporte stdio, emparejado uno a uno con un cliente en la misma máquina) y',
  'workbench.docs.body.roadmap.mcpRemoteStrong': 'por HTTP/SSE para el remoto',
  'workbench.docs.body.roadmap.mcp2Suffix':
    'cuando autoalojas. Sin relé del proveedor; tu agente habla directamente con tu instalación. Las ' +
    'llamadas de herramientas se ejecutan con los mismos permisos de espacio de trabajo que tú — los ' +
    'secretos quedan detrás del vault, las operaciones sensibles quedan en opt-in.',
  'workbench.docs.body.roadmap.serverHeading': 'Servidor local / LAN para sincronización entre dispositivos',
  'workbench.docs.body.roadmap.server1':
    'Un servidor que puedes ejecutar en tu máquina, tu LAN o un host tunelizado. ' +
    'Extensión, aplicación de escritorio y CLI se convierten todos en clientes del mismo servidor — mismos ' +
    'espacios de trabajo, mismas reglas, mismo vault, en cada dispositivo que uses. El servidor se queda en ' +
    'la red local; no hay un camino de nube opt-in por encima.',
  'workbench.docs.body.roadmap.cliHeading': 'CLI',
  'workbench.docs.body.roadmap.cli1':
    'Scripting headless e integración con CI. Listar reglas, conmutar entornos, ejecutar una única ' +
    'solicitud guardada desde el shell, comparar un espacio de trabajo con otro. La CLI habla con el mismo ' +
    'servidor que la extensión y la aplicación de escritorio, así que la automatización se mantiene en fase ' +
    'con lo que ves en la interfaz.',
  'workbench.docs.body.roadmap.webAppHeading': 'Despliegue en VM autoalojada + aplicación web',
  'workbench.docs.body.roadmap.webApp1':
    'La misma interfaz distribuida como bundle web que puedes servir desde tu propio origen. Para ' +
    'navegadores corporativos bloqueados, dispositivos de quiosco o cualquier entorno donde instalar una ' +
    'extensión no es una opción — y para usuarios que quieren un despliegue de Open Headers con su marca ' +
    'bajo su propio dominio.',
  'workbench.docs.body.roadmap.importersHeading': 'Importadores',
  'workbench.docs.body.roadmap.importers1':
    'Junto a los importadores cURL / HAR / Postman: colecciones de Insomnia, ' +
    'especificaciones OpenAPI e importaciones de solicitudes HAR completas (no solo los encabezados) — ' +
    'todos disponibles hoy. La ' +
    'paridad de importación es la forma en que Open Headers se gana la adopción de gente ya invertida en ' +
    'otra herramienta — cruza tu colección en un paso y sigue trabajando.',
  'workbench.docs.body.roadmap.cloudCalloutTitle': '¿Y un back-end alojado en la nube?',
  'workbench.docs.body.roadmap.cloudCallout1':
    'No está en el menú por ahora — si quieres un back-end alojado en la nube, puedes autoalojarlo en tu ' +
    'propia VM (mira arriba). El foco ahora mismo es el producto, no operar y mantener ' +
    'infraestructura en la nube gratuita para usuarios finales. Encantados de ayudar si estás montando un ' +
    'despliegue autoalojado y te encuentras con problemas; simplemente no estamos en posición de ' +
    'proporcionar el alojamiento en sí.',

  // ── Docs sub-anchor (i) popovers (DOC_ANCHOR_INFO) ──────────────────
  'workbench.docs.anchor.override.title': 'Añadir / Reemplazar',
  'workbench.docs.anchor.override.summary':
    'Fija el encabezado a este valor — añadido cuando falta, reemplazando cualquier valor existente.',
  'workbench.docs.anchor.append.title': 'Anexar',
  'workbench.docs.anchor.append.summary':
    'Anexa este valor al valor existente del encabezado. Solo los encabezados estándar con valores de ' +
    'lista admiten anexar — en los demás la regla se guarda como borrador.',
  'workbench.docs.anchor.remove.title': 'Quitar',
  'workbench.docs.anchor.remove.summary':
    'Elimina el encabezado del tráfico coincidente por completo; el campo de valor no se usa.',
  'workbench.docs.anchor.merge.title': 'Fusionar',
  'workbench.docs.anchor.merge.summary':
    'Fusiona este valor en la lista existente del encabezado, saltando los valores ya presentes.',
  'workbench.docs.anchor.qpAdd.title': 'Añadir / Reemplazar',
  'workbench.docs.anchor.qpAdd.summary':
    'Fija el parámetro en la URL — añadido cuando falta, reemplazado cuando ya está presente.',
  'workbench.docs.anchor.qpOverride.title': 'Solo reemplazar',
  'workbench.docs.anchor.qpOverride.summary':
    'Reemplaza el valor del parámetro solo cuando la URL ya lo lleva; las URL sin él pasan sin cambios.',
  'workbench.docs.anchor.qpRemove.title': 'Quitar',
  'workbench.docs.anchor.qpRemove.summary': 'Quita el parámetro de las URL coincidentes.',
  'workbench.docs.anchor.qpRemoveAll.title': 'Quitar todo',
  'workbench.docs.anchor.qpRemoveAll.summary':
    'Elimina la cadena de consulta entera de las URL coincidentes. Las demás operaciones de la misma regla ' +
    'se ignoran mientras esté presente.',
  'workbench.docs.anchor.urlPattern.title': 'Patrón de URL',
  'workbench.docs.anchor.urlPattern.summary':
    'Hace coincidir la URL de la solicitud con un patrón urlFilter — comodines *, anclas de dominio ||, ' +
    'separadores ^.',
  'workbench.docs.anchor.urlRegex.title': 'Regex de URL',
  'workbench.docs.anchor.urlRegex.summary':
    'Hace coincidir la URL de la solicitud con una expresión regular; los grupos de captura alimentan las ' +
    'sustituciones \\1, \\2 en los destinos de redirección.',
  'workbench.docs.anchor.requestDomains.title': 'Dominios de solicitud',
  'workbench.docs.anchor.requestDomains.summary':
    'Coincide con las solicitudes cuyo host de destino es uno de los dominios listados, subdominios ' + 'incluidos.',
  'workbench.docs.anchor.excludeDomains.title': 'Excluir dominios',
  'workbench.docs.anchor.excludeDomains.summary':
    'Coincide con cada solicitud salvo aquellas cuyo host de destino está listado.',
  'workbench.docs.anchor.initiatorDomains.title': 'Dominios iniciadores',
  'workbench.docs.anchor.initiatorDomains.summary':
    'Coincide según la página que emitió la solicitud en lugar de la propia URL de la solicitud. La ' +
    'variante Excl. invierte la lista.',
  'workbench.docs.anchor.methods.title': 'Métodos',
  'workbench.docs.anchor.methods.summary':
    'Coincide según el método HTTP (GET, POST, …). La variante Excl. invierte la lista.',
  'workbench.docs.anchor.conditionResourceTypes.title': 'Tipos de recurso',
  'workbench.docs.anchor.conditionResourceTypes.summary':
    'Coincide según lo que el navegador está recuperando — documentos, scripts, XHR/fetch, imágenes, … La ' +
    'variante Excl. invierte la lista.',
  'workbench.docs.anchor.domainType.title': 'Tipo de dominio',
  'workbench.docs.anchor.domainType.summary':
    'First-party coincide con las solicitudes al mismo sitio que la página; third-party coincide con las ' +
    'solicitudes entre sitios.',
  'workbench.docs.anchor.headers.title': 'Encabezado de respuesta',
  'workbench.docs.anchor.headers.summary':
    'Coincide sobre un encabezado de la respuesta recibida — por presencia, o por valor cuando se da uno.',
  'workbench.docs.anchor.redirectRegex.title': 'Sustitución regex',
  'workbench.docs.anchor.redirectRegex.summary':
    'Con una condición Regex de URL, \\1, \\2 … insertan los grupos capturados en el destino de la ' + 'redirección.',
  'workbench.docs.anchor.requestBodyDynamic.title': 'Dinámico (JavaScript)',
  'workbench.docs.anchor.requestBodyDynamic.summary':
    'Ejecuta tu JavaScript contra cada solicitud coincidente para construir el cuerpo saliente a partir ' +
    'del original.',
  'workbench.docs.anchor.responseDynamic.title': 'Dinámico (JavaScript)',
  'workbench.docs.anchor.responseDynamic.summary':
    'Ejecuta tu JavaScript para cada respuesta coincidente — transformando la respuesta real (red) o ' +
    'construyendo una desde cero (mock).',
  'workbench.docs.anchor.requestBodyGraphql.title': 'Filtro de operación GraphQL',
  'workbench.docs.anchor.requestBodyGraphql.summary':
    'Además, condiciona la regla al nombre de operación GraphQL encontrado en la carga de la solicitud.',
  'workbench.docs.anchor.responseGraphql.title': 'Filtro de operación GraphQL',
  'workbench.docs.anchor.responseGraphql.summary':
    'Además, condiciona la regla al nombre de operación GraphQL encontrado en la carga de la solicitud.',
} as const satisfies Catalog;
