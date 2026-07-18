/**
 * Workbench live/workflows station — Spanish. Mirrors
 * `catalogs/en/workbench-live.ts` key for key; extends the es register
 * contract (`es/shared.ts`). Reuses the live register shipped in
 * es/workbench-variables + the panel/popup mints: Refresh =
 * `Actualizar`, Override = `sustitución`, step = `paso` (docs mint),
 * binding = `vinculación`, resolver = `el resolvedor`, pin = `fijar`,
 * wake = `reactivación`, retry = `reintentar` (TUI footer verb), tier
 * = `nivel`; `workflow` and `backoff` stay dev loanwords (m.), `Live`
 * rides raw. MINTS: expire = `caducar`; lead = `margen`; probe =
 * `sondeo`/`sondear`. Technical plane stays raw inside keyed
 * sentences: `{{live.NAME}}` syntax, policy kind ids (expires-in /
 * expires-at), `lead` / `dependsOn` / oh.* field tokens, step ids /
 * capture names, code examples, MV3, AND/OR/OPEN, the `(e.g.` abbrev
 * fragment (S57 whole-raw, fr precedent), server error text
 * ({error}).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchLive = {
  // ── live-display: circuit descriptors ───────────────────────────────
  'workbench.editors.live.circuit.idleLabel': 'en reposo',
  'workbench.editors.live.circuit.idleHint': 'Aún no hay caché — lanza una actualización para llenarla.',
  'workbench.editors.live.circuit.pausedLabel': 'pausado',
  'workbench.editors.live.circuit.pausedHint': ({ count }, locale) =>
    plural(locale, Number(count), {
      one:
        'El circuito está abierto tras {count} fallo consecutivo. El reintento automático está aplazado. ' +
        'Haz clic en Reintentar ahora para saltarte el backoff.',
      many:
        'El circuito está abierto tras {count} fallos consecutivos. El reintento automático está aplazado. ' +
        'Haz clic en Reintentar ahora para saltarte el backoff.',
      other:
        'El circuito está abierto tras {count} fallos consecutivos. El reintento automático está aplazado. ' +
        'Haz clic en Reintentar ahora para saltarte el backoff.',
    }),
  'workbench.editors.live.circuit.probingLabel': 'sondeando…',
  'workbench.editors.live.circuit.probingHint': 'Intento de sondeo en curso — un solo éxito cierra el circuito.',
  'workbench.editors.live.circuit.retryLabel': 'reintento {attempt} de 3',
  'workbench.editors.live.circuit.retryHint':
    'Nivel de reintentos previo al disyuntor — reintentos rápidos con un backoff de 5–10s entre intentos. El ' +
    'circuito se abre tras 3 fallos consecutivos.',
  'workbench.editors.live.circuit.healthyLabel': 'sano',
  'workbench.editors.live.circuit.healthyHint': 'Circuito cerrado, sin fallos recientes.',

  // ── live-display: schedule + policy wording ─────────────────────────
  'workbench.editors.live.schedule.last': 'última actualización {when}',
  'workbench.editors.live.schedule.manualOnly': 'solo actualización manual',
  'workbench.editors.live.schedule.autoRefresh': 'actualización automática {when}',
  'workbench.editors.live.schedule.expires': 'caduca {when}',
  'workbench.editors.live.policy.interval': 'cada {seconds}s',
  'workbench.editors.live.policy.expiresIn': 'expires-in desde {source} (margen {lead}s)',
  'workbench.editors.live.policy.expiresAt': 'expires-at desde {source} (margen {lead}s)',
  'workbench.editors.live.policy.manual': 'actualización manual',

  // ── live-display: per-step run states ───────────────────────────────
  'workbench.editors.live.stepRun.completed': 'Completado en la última ejecución',
  'workbench.editors.live.stepRun.failed': 'La última ejecución falló en este paso',
  'workbench.editors.live.stepRun.extractFailed': 'Recuperado, pero un extractor de captura no coincidió',
  'workbench.editors.live.stepRun.skipped': 'Omitido por su condición de ejecución en la última ejecución',
  'workbench.editors.live.stepRun.notRun': 'Aún no forma parte de una ejecución correcta',
  'workbench.editors.live.maskEmpty': '(vacío)',

  // ── Shared live form chrome (live/layout) ───────────────────────────
  'workbench.editors.live.form.namePlaceholder': 'Nombre',
  'workbench.editors.live.form.descriptionPlaceholder': 'Descripción (opcional)',

  // ── Live-variable editor: edit mode ─────────────────────────────────
  'workbench.editors.live.variable.sourceNotFound': 'Fuente no encontrada.',
  'workbench.editors.live.variable.liveTag': 'Live',
  'workbench.editors.live.variable.disabledTag': 'Desactivada',
  'workbench.editors.live.variable.overrideTag': 'sustitución',
  'workbench.editors.live.variable.refresh': 'Actualizar',
  'workbench.editors.live.variable.valueLabel': 'Valor',
  'workbench.editors.live.variable.neverRefreshed': '(nunca actualizada)',
  'workbench.editors.live.variable.nameLabel': 'Nombre',
  'workbench.editors.live.variable.nameHint': 'Referénciala como {{live.NAME}}',
  'workbench.editors.live.variable.descriptionLabel': 'Descripción',
  'workbench.editors.live.variable.bindingSection': 'Vinculación',
  'workbench.editors.live.variable.workflowLabel': 'Workflow',
  'workbench.editors.live.variable.stepLabel': 'Paso',
  'workbench.editors.live.variable.captureLabel': 'Captura',
  'workbench.editors.live.variable.selectWorkflow': 'Selecciona un workflow',
  'workbench.editors.live.variable.selectStep': 'Selecciona un paso',
  'workbench.editors.live.variable.selectCapture': 'Selecciona una captura',
  'workbench.editors.live.variable.stepOption': '{id} ({count} capturas)',
  'workbench.editors.live.variable.openFlow': 'Abrir el flujo',
  'workbench.editors.live.variable.overrideSection': 'Sustitución manual',
  'workbench.editors.live.variable.overrideValuePlaceholder': 'Valor fijo de sustitución',
  'workbench.editors.live.variable.overrideExpiresLabel': 'Caduca (ms)',
  'workbench.editors.live.variable.overrideExpiresHint':
    'Epoch en ms de reloj — déjalo en blanco para una sustitución permanente',
  'workbench.editors.live.variable.applyOverride': 'Aplicar la sustitución',
  'workbench.editors.live.variable.clearOverride': 'Borrar',
  'workbench.editors.live.variable.setOverride': 'Definir una sustitución manual',
  'workbench.editors.live.variable.overrideNote':
    'El resolvedor sirve el valor fijado; el planificador sigue actualizando el workflow subyacente.',
  'workbench.editors.live.variable.deletedElsewhere': 'La fuente se eliminó desde otra pestaña',
  'workbench.editors.live.variable.saveFailed': 'No se pudo guardar la variable live',
  'workbench.editors.live.variable.refreshFailed': 'Falló la actualización: {error}',
  'workbench.editors.live.variable.refreshed': 'Actualizada',
  'workbench.editors.live.variable.overrideSaveFailed': 'No se pudo guardar la sustitución.',
  'workbench.editors.live.variable.overrideApplied': 'Sustitución aplicada',
  'workbench.editors.live.variable.overrideCleared': 'Sustitución borrada',

  // ── Live-variable editor: create mode ───────────────────────────────
  'workbench.editors.live.create.title': 'Nueva variable Live',
  'workbench.editors.live.create.namePlaceholder': 'Nombre (p. ej. accessToken)',
  'workbench.editors.live.create.referenceAs': 'Referénciala como {{live.{name}}}',
  'workbench.editors.live.create.createWorkflow': 'Crear un workflow',
  'workbench.editors.live.create.noWorkflows': 'Aún no hay workflows.',
  'workbench.editors.live.create.nameRequired': 'El nombre es obligatorio',
  'workbench.editors.live.create.bindingRequired': 'Selecciona un workflow, un paso y una captura',
  'workbench.editors.live.create.createFailed': 'No se pudo crear la variable live',

  // ── Toggles row (Enabled / Wait for fresh value) ────────────────────
  'workbench.editors.live.toggles.enabled': 'Activada',
  'workbench.editors.live.toggles.enabledTooltip':
    'Cuando está desactivada, las referencias {{live.NAME}} dejan de resolverse en reglas y solicitudes.',
  'workbench.editors.live.toggles.waitForFresh': 'Esperar un valor fresco',
  'workbench.editors.live.toggles.waitForFreshTooltip':
    'Antes de aplicar las reglas, espera a que el workflow subyacente termine una actualización (hasta ~5s). ' +
    'Desactivado: las reglas usan el último valor en caché y la actualización ocurre en segundo plano — más ' +
    'rápido, pero el valor puede quedar brevemente obsoleto tras la reactivación de la extensión.',

  // ── Refresh-policy picker ───────────────────────────────────────────
  'workbench.editors.live.refreshPolicy.manual': 'Solo manual',
  'workbench.editors.live.refreshPolicy.interval': 'Intervalo fijo',
  'workbench.editors.live.refreshPolicy.expiresIn': 'Caduca en N segundos (relativo)',
  'workbench.editors.live.refreshPolicy.expiresAt': 'Caduca en epoch ms (absoluto)',
  'workbench.editors.live.refreshPolicy.secondsUnit': 'segundos',
  'workbench.editors.live.refreshPolicy.leadUnit': 'margen s',
  'workbench.editors.live.refreshPolicy.selectCapture': 'Seleccionar la captura',
  'workbench.editors.live.refreshPolicy.noCaptures': 'Aún no hay capturas definidas.',
  'workbench.editors.live.refreshPolicy.subMinuteWarning':
    'Los intervalos por debajo del minuto chocan con el suelo de alarmas de MV3 y queman la cuota rápido. ' +
    'Úsalos solo cuando sea necesario.',
  'workbench.editors.live.refreshPolicy.expiresInHelpPrefix':
    'Valor de la captura = segundos hasta la caducidad (p. ej. OAuth',
  'workbench.editors.live.refreshPolicy.expiresInHelpMid': '). La actualización se dispara `lead` segundos antes',
  'workbench.editors.live.refreshPolicy.expiresInHelpSuffix': '.',
  'workbench.editors.live.refreshPolicy.expiresAtHelpPrefix': 'Valor de la captura = epoch unix absoluto en',
  'workbench.editors.live.refreshPolicy.expiresAtHelpMilliseconds': 'milisegundos',
  'workbench.editors.live.refreshPolicy.expiresAtHelpMid': '(e.g.',
  'workbench.editors.live.refreshPolicy.expiresAtHelpSuffix':
    '). La actualización se dispara `lead` segundos antes de ese momento.',
  'workbench.editors.live.refreshPolicy.noCapturesWarning':
    'Añade primero una captura al workflow para que el cálculo de caducidad tenga una fuente.',

  // ── Workflow editor shell (LiveWorkflowEditor) ──────────────────────
  'workbench.editors.live.workflow.viewEditor': 'Editor',
  'workbench.editors.live.workflow.viewPreview': 'Vista previa',
  'workbench.editors.live.workflow.refresh': 'Actualizar',
  'workbench.editors.live.workflow.disabledTag': 'Desactivado',
  'workbench.editors.live.workflow.notFound': 'Workflow no encontrado.',
  'workbench.editors.live.workflow.deletedElsewhere': 'El workflow se eliminó desde otra pestaña',
  'workbench.editors.live.workflow.saveFailed': 'No se pudo guardar el workflow',
  'workbench.editors.live.workflow.createFailed': 'No se pudo crear el workflow',
  'workbench.editors.live.workflow.refreshed': 'Actualizado',
  'workbench.editors.live.workflow.refreshFailed': 'Falló la actualización: {error}',
  'workbench.editors.live.workflow.defaultName': 'Workflow',
  'workbench.editors.live.workflow.newDraftName': 'Nuevo workflow',

  // ── Workflow form body ──────────────────────────────────────────────
  'workbench.editors.live.form.structuralIssues': 'El workflow tiene problemas estructurales',
  'workbench.editors.live.form.stepsTitle': 'Pasos ({count})',
  'workbench.editors.live.form.addStepButton': 'Paso',
  'workbench.editors.live.form.noSteps':
    'Aún no hay pasos — añade uno para conectar una solicitud + una extracción en este workflow.',
  'workbench.editors.live.form.enabledAria': 'Workflow activado',
  'workbench.editors.live.form.enabled': 'Activado',
  'workbench.editors.live.form.disabled': 'Desactivado',
  'workbench.editors.live.form.parallelLabel': 'Ejecutar los pasos independientes en paralelo',
  'workbench.editors.live.form.parallelTooltip':
    'Solo secuencial en v1. La ejecución en paralelo llegará en una versión futura.',
  'workbench.editors.live.form.refreshPolicySection': 'Política de actualización',

  // ── Workflow step editor ────────────────────────────────────────────
  'workbench.editors.live.step.title': 'Paso {number}',
  'workbench.editors.live.step.idPrefix': 'id',
  'workbench.editors.live.step.namePrefix': 'nombre',
  'workbench.editors.live.step.typeTooltip': 'Tipo de paso — Foreach y Composite llegarán en una versión futura.',
  'workbench.editors.live.step.typeRequest': 'Solicitud',
  'workbench.editors.live.step.typeForeach': 'Foreach',
  'workbench.editors.live.step.typeComposite': 'Composite',
  'workbench.editors.live.step.runsIfTag': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'se ejecuta si {count} condición',
      many: 'se ejecuta si {count} condiciones',
      other: 'se ejecuta si {count} condiciones',
    }),
  'workbench.editors.live.step.priorityTag': 'prioridad: {ref}',
  'workbench.editors.live.step.scriptsTag': 'scripts',
  'workbench.editors.live.step.selectRequest': 'Selecciona una solicitud',
  'workbench.editors.live.step.descriptionPlaceholder': 'Descripción opcional del paso',
  'workbench.editors.live.step.capturesHeader': 'CAPTURAS ({count})',
  'workbench.editors.live.step.addCapture': '+ Captura',
  'workbench.editors.live.step.captureRequired':
    'Se necesita al menos una captura antes de que una LV pueda vincularse a este paso.',
  'workbench.editors.live.step.removeCaptureAria': 'Quitar la captura {name}',
  'workbench.editors.live.step.exposeAria': 'Exponer la captura {name} como variable live',
  'workbench.editors.live.step.exposeAs': 'Exponer como',
  'workbench.editors.live.step.exposeTooltip':
    'Cuando está activado, guardar el workflow crea una variable Live que resuelve `{{live.<name>}}` desde ' +
    'esta captura. Desactívalo para usar la captura solo dentro de este workflow (p. ej. vía ' +
    '{{step.<stepId>.<captureName>}}).',
  'workbench.editors.live.step.afterChip': '↳ después de {parents}',
  'workbench.editors.live.step.implicitMark': '(implícito)',
  'workbench.editors.live.step.implicitTooltip':
    'Dependencia implícita del paso anterior (sin dependsOn explícito declarado). Define un dependsOn ' +
    'explícito para fijar la relación.',

  // ── Step collapse sections (depends on / run condition / priority / retry / timeout / scripts) ──
  'workbench.editors.live.sections.dependsOn': 'Depende de',
  'workbench.editors.live.sections.dependsOnImplicit': '(implícito — paso anterior)',
  'workbench.editors.live.sections.dependsOnRoot': '(raíz)',
  'workbench.editors.live.sections.dependsOnPlaceholder': 'Selecciona el o los pasos ancestros — vacío = paso raíz',
  'workbench.editors.live.sections.dependsOnImplicitHint':
    'Sin dependsOn explícito — depende implícitamente del paso anterior en el orden declarado.',
  'workbench.editors.live.sections.dependsOnRootHint': 'Raíz explícita — se ejecuta en cuanto arranca el workflow.',
  'workbench.editors.live.sections.useImplicit': 'Usar el implícito',
  'workbench.editors.live.sections.waitsFor': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'El paso espera a que {count} ancestro se complete o se omita.',
      many: 'El paso espera a que {count} ancestros se completen o se omitan.',
      other: 'El paso espera a que {count} ancestros se completen o se omitan.',
    }),
  'workbench.editors.live.sections.reset': 'Restablecer',
  'workbench.editors.live.sections.runCondition': 'Condición de ejecución',
  'workbench.editors.live.sections.none': '(ninguna)',
  'workbench.editors.live.sections.priority': 'Prioridad',
  'workbench.editors.live.sections.priorityStepPlaceholder': 'Paso ancestro',
  'workbench.editors.live.sections.priorityCapturePlaceholder': 'Nombre de la captura',
  'workbench.editors.live.sections.sortNumeric': 'Numérico',
  'workbench.editors.live.sections.sortLexicographic': 'Lexicográfico',
  'workbench.editors.live.sections.priorityTooltip':
    'Cuando varios pasos pueden ejecutarse a continuación, arranca primero el que tiene el valor de prioridad ' +
    'más bajo. Los valores ausentes se ordenan al final.',
  'workbench.editors.live.sections.clear': 'Borrar',
  'workbench.editors.live.sections.retryPolicy': 'Política de reintentos',
  'workbench.editors.live.sections.retrySummary': '({count} intentos)',
  'workbench.editors.live.sections.retrySummaryExponential': '({count} intentos, exponencial)',
  'workbench.editors.live.sections.attemptsPlaceholder': 'Intentos',
  'workbench.editors.live.sections.attemptsPrefix': 'intentos',
  'workbench.editors.live.sections.delayPrefix': 'retraso ms',
  'workbench.editors.live.sections.backoffFixed': 'Fijo',
  'workbench.editors.live.sections.backoffExponential': 'Exponencial',
  'workbench.editors.live.sections.retryOnNetwork': 'Solo errores de red',
  'workbench.editors.live.sections.retryOn5xx': 'Red + 5xx',
  'workbench.editors.live.sections.retryOn429': 'Red + 429',
  'workbench.editors.live.sections.retryOn4xx': 'Red + 4xx',
  'workbench.editors.live.sections.retryOnCustom': 'Personalizado (editado como datos)',
  'workbench.editors.live.sections.retryTooltip':
    'Los fallos de red (DNS, conexión, tiempo agotado) siempre se reintentan mientras queden intentos. Añadir ' +
    'una coincidencia de estado reintenta también las respuestas coincidentes; los errores de extracción ' +
    'nunca se reintentan. Vacía el campo de intentos para desactivar los reintentos.',
  'workbench.editors.live.sections.timeout': 'Tiempo de espera',
  'workbench.editors.live.sections.noTimeoutPlaceholder': 'Sin tiempo de espera',
  'workbench.editors.live.sections.timeoutTooltip':
    'Por intento — la solicitud (incluida la lectura del cuerpo) se aborta al superar este tope. Un paso que ' +
    'reintenta dispone del tiempo completo en cada intento. Vacía el campo para no tener tope.',
  'workbench.editors.live.sections.scripts': 'Scripts',
  'workbench.editors.live.sections.scriptsOn': '(activados)',
  'workbench.editors.live.sections.scriptsOff': '(desactivados)',
  'workbench.editors.live.sections.runScriptsAria': 'Ejecutar los scripts de la solicitud en este paso',
  'workbench.editors.live.sections.runScriptsLabel':
    'Ejecutar los scripts pre-solicitud / pos-respuesta de la solicitud',
  'workbench.editors.live.sections.scriptsTooltip':
    'Se ejecuta en cada intento de la cadena. Los scripts de paso reciben una superficie oh.* de solo lectura ' +
    '(oh.sendRequest y oh.variables.set se rechazan). Un error de script o una aserción oh.test fallida hace ' +
    'fallar el paso, de modo que los últimos valores buenos se conservan — las aserciones condicionan lo que ' +
    'este workflow publica. Necesita un runtime capaz de ejecutar scripts; en hosts sin uno, el paso se ' +
    'ejecuta sin scripts.',

  // ── Step gate editor (run-condition clauses) ────────────────────────
  'workbench.editors.live.gate.kindStatus': 'Estado',
  'workbench.editors.live.gate.kindCaptureExists': 'La captura existe',
  'workbench.editors.live.gate.kindCaptureEquals': 'La captura es igual a',
  'workbench.editors.live.gate.kindCaptureMatches': 'La captura coincide',
  'workbench.editors.live.gate.kindNumericCompare': 'Comparación numérica de captura',
  'workbench.editors.live.gate.kindInList': 'Captura en una lista',
  'workbench.editors.live.gate.kindHeaderContains': 'El encabezado contiene',
  'workbench.editors.live.gate.futureNumericCompare': 'Comparación numérica — en una versión futura.',
  'workbench.editors.live.gate.futureInList': 'Coincidencia en lista — en una versión futura.',
  'workbench.editors.live.gate.futureHeaderContains': '«El encabezado contiene» — en una versión futura.',
  'workbench.editors.live.gate.status2xx': '2xx (cualquier éxito)',
  'workbench.editors.live.gate.status3xx': '3xx (redirección)',
  'workbench.editors.live.gate.status4xx': '4xx (error de cliente)',
  'workbench.editors.live.gate.status5xx': '5xx (error de servidor)',
  'workbench.editors.live.gate.statusEquals': 'igual a…',
  'workbench.editors.live.gate.statusNotEquals': 'distinto de…',
  'workbench.editors.live.gate.statusOneOf': 'uno de…',
  'workbench.editors.live.gate.allAnd': 'Todas (AND)',
  'workbench.editors.live.gate.anyOr': 'Alguna (OR)',
  'workbench.editors.live.gate.orTooltip':
    'La lógica OR llegará en una versión futura. De momento usa varios pasos con condiciones mutuamente ' +
    'excluyentes.',
  'workbench.editors.live.gate.matchModesAria': 'Acerca de los modos de coincidencia',
  'workbench.editors.live.gate.noConditions':
    'Sin condiciones — el paso se ejecuta en cuanto sus dependencias terminan.',
  'workbench.editors.live.gate.conditionCount': '{count} condición(es)',
  'workbench.editors.live.gate.addCondition': 'Añadir condición',
  'workbench.editors.live.gate.andTag': 'AND',
  'workbench.editors.live.gate.stepPlaceholder': 'Paso',
  'workbench.editors.live.gate.capturePlaceholder': 'Nombre de la captura',
  'workbench.editors.live.gate.equalsPlaceholder': 'Valor de igualdad',
  'workbench.editors.live.gate.removeClauseAria': 'Quitar la cláusula {number}',
  'workbench.editors.live.gate.statusClassTooltip': 'Coincide con cualquier estado de la clase (p. ej. 2xx = 200-299).',

  // ── Workflow graph view ─────────────────────────────────────────────
  'workbench.editors.live.graph.clauseStatusIs': 'El estado de {stepId} es {value}',
  'workbench.editors.live.graph.clauseStatusIsNot': 'El estado de {stepId} no es {value}',
  'workbench.editors.live.graph.clauseStatusIn': 'El estado de {stepId} está en [{list}]',
  'workbench.editors.live.graph.clauseCaptureExists': '{ref} existe',
  'workbench.editors.live.graph.clauseCaptureMatches': '{ref} coincide con /{pattern}/',
  'workbench.editors.live.graph.menuAddStep': 'Añadir paso',
  'workbench.editors.live.graph.menuEditStep': 'Editar el paso',
  'workbench.editors.live.graph.menuDeleteStep': 'Eliminar el paso',
  'workbench.editors.live.graph.connectTitle': 'Arrastra hasta otro paso para añadir una dependencia',
  'workbench.editors.live.graph.removeDependency': 'Quitar la dependencia',
  'workbench.editors.live.graph.zoomIn': 'Acercar',
  'workbench.editors.live.graph.zoomOut': 'Alejar',
  'workbench.editors.live.graph.recenter': 'Recentrar',
  'workbench.editors.live.graph.legendClick': 'clic',
  'workbench.editors.live.graph.legendSelect': 'seleccionar',
  'workbench.editors.live.graph.legendEditKeys': '2×clic / ⏎',
  'workbench.editors.live.graph.legendEdit': 'editar',
  'workbench.editors.live.graph.legendDelete': 'eliminar',
  'workbench.editors.live.graph.legendConnectKeys': 'arrastrar ○',
  'workbench.editors.live.graph.legendConnect': 'conectar',
  'workbench.editors.live.graph.legendRightClick': 'clic derecho',
  'workbench.editors.live.graph.legendMenu': 'menú',
  'workbench.editors.live.graph.legendDragNode': 'arrastrar el nodo',
  'workbench.editors.live.graph.legendMove': 'mover',
  'workbench.editors.live.graph.legendDragBg': 'arrastrar el fondo',
  'workbench.editors.live.graph.legendPan': 'panorámica',
  'workbench.editors.live.graph.legendScroll': 'desplazar',
  'workbench.editors.live.graph.legendZoom': 'zoom',
  'workbench.editors.live.graph.editStepInForm': 'Editar el paso en el formulario',
  'workbench.editors.live.graph.requestNotFound': 'Solicitud no encontrada',
  'workbench.editors.live.graph.noRequestSelected': 'Ninguna solicitud seleccionada',
  'workbench.editors.live.graph.noCaptures': 'Sin capturas',
  'workbench.editors.live.graph.orderedBy': 'Ordenado por {ref}',
  'workbench.editors.live.graph.exposedAs': 'Expuesta como {{live.{name}}}',
  'workbench.editors.live.graph.exposedAsPending':
    'Expuesta como {{live.{name}}} — a la espera de la primera ejecución',

  // ── Workflow status panel + run status strip ────────────────────────
  'workbench.editors.live.status.title': 'Estado de los workflows',
  'workbench.editors.live.status.noEnvironment': 'Sin entorno',
  'workbench.editors.live.status.unknownEnv': 'Env desconocido',
  'workbench.editors.live.status.activeSuffix': '(activo)',
  'workbench.editors.live.status.pillPaused': 'PAUSADO',
  'workbench.editors.live.status.pillProbing': 'SONDEO',
  'workbench.editors.live.status.pillRetrying': 'REINTENTO',
  'workbench.editors.live.status.pillHealthy': 'SANO',
  'workbench.editors.live.status.summaryHealthy': '{count} sanos',
  'workbench.editors.live.status.summaryRetrying': '{count} en reintento',
  'workbench.editors.live.status.summaryProbing': '{count} en sondeo',
  'workbench.editors.live.status.summaryPaused': '{count} pausados',
  'workbench.editors.live.status.loading': 'Cargando…',
  'workbench.editors.live.status.empty':
    'Aún no hay ejecuciones de workflow. Crea un workflow y haz clic en Actualizar para llenarlo.',
  'workbench.editors.live.status.failuresCount': 'fallos: {count}',
  'workbench.editors.live.status.failuresTooltip': 'Fallos consecutivos desde la última actualización correcta.',
  'workbench.editors.live.status.openingsCount': 'aperturas: {count}',
  'workbench.editors.live.status.openingsTooltip':
    'Número de veces que el circuito ha pasado a OPEN en el ciclo actual. Se reduce a la mitad tras una ' +
    'recuperación bien asentada, y baja en uno tras una recuperación reciente.',
  'workbench.editors.live.status.nextAttempt': 'próximo intento {countdown}',
  'workbench.editors.live.status.nextAttemptTooltip':
    'Hora de reloj a la que se ejecutará el próximo sondeo automático. Haz clic en Actualizar ahora para ' +
    'saltártelo.',
  'workbench.editors.live.status.refreshNow': 'Actualizar ahora',
  'workbench.editors.live.status.resetCircuit': 'Restablecer el circuito',
  'workbench.editors.live.status.resetCircuitTooltip':
    'Borra los contadores de fallos + el backoff pendiente. No ejecuta un sondeo.',
  'workbench.editors.live.status.circuitReset': 'Circuito restablecido',
  'workbench.editors.live.status.resetFailed': 'Falló el restablecimiento: {error}',
  'workbench.editors.live.status.dragToResize': 'Arrastra para redimensionar',
  'workbench.editors.live.status.boundCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'vinculada: {count} variable',
      many: 'vinculadas: {count} variables',
      other: 'vinculadas: {count} variables',
    }),
  'workbench.editors.live.status.needsReRun': 'requiere reejecución',
  'workbench.editors.live.status.needsReRunTooltip':
    'El workflow o una entrada que resuelve cambió desde que se extrajo este valor — lanza Actualizar para ' +
    'volver a extraer.',
  'workbench.editors.live.status.neverRunForEnv':
    'nunca ejecutado para este env — haz clic en Actualizar para llenarlo',

  // ── Graph run overlay ───────────────────────────────────────────────
  'workbench.editors.live.runOverlay.valuesPreserved': 'valores conservados de una ejecución anterior',
  'workbench.editors.live.runOverlay.responseBytes': 'respuesta {bytes} bytes',

  // ── Create Workflow from requests modal ─────────────────────────────
  'workbench.editors.live.fromRequests.title': 'Crear un workflow desde «{name}»',
  'workbench.editors.live.fromRequests.createButton': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Crear workflow ({count} paso)',
      many: 'Crear workflow ({count} pasos)',
      other: 'Crear workflow ({count} pasos)',
    }),
  'workbench.editors.live.fromRequests.empty':
    'Este contenedor no tiene solicitudes con las que construir un workflow.',
  'workbench.editors.live.fromRequests.hint':
    'Cada solicitud seleccionada se convierte en un paso del workflow, en el orden mostrado.',

  // ── Extractor picker (capture extraction kinds) ─────────────────────
  'workbench.editors.live.extractor.groupPlaceholder': 'grupo',
  'workbench.editors.live.extractor.groupBody': 'Cuerpo de la respuesta',
  'workbench.editors.live.extractor.groupResponse': 'Respuesta',
  'workbench.editors.live.extractor.wholeBody': 'Cuerpo entero',
  'workbench.editors.live.extractor.jsonPath': 'Ruta JSON',
  'workbench.editors.live.extractor.regex': 'Regex',
  'workbench.editors.live.extractor.header': 'Encabezado',
  'workbench.editors.live.extractor.statusCode': 'Código de estado',
} as const satisfies Catalog;
