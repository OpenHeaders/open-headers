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
  'workbench.editors.live.panel.noStep':
    'No hay ningún paso seleccionado, así que se muestra el workflow completo. Haz clic en un paso del grafo para abrirlo.',
  'workbench.editors.live.panel.stepOf': 'Paso {number} de {total}',
  'workbench.editors.live.panel.closeStep': 'Cerrar el paso y mostrar el workflow',
  'workbench.editors.live.panel.lastRun': 'Última ejecución',
  'workbench.editors.live.panel.stepName': 'Nombre del paso',
  'workbench.editors.live.panel.stepKind': 'Tipo de paso',
  'workbench.editors.live.panel.moveUp': 'Subir el paso',
  'workbench.editors.live.panel.moveDown': 'Bajar el paso',
  'workbench.editors.live.panel.duplicate': 'Duplicar',
  'workbench.editors.live.panel.delete': 'Eliminar',
  'workbench.editors.live.panel.response': 'Respuesta',
  'workbench.editors.live.panel.message': 'Mensaje',
  'workbench.editors.live.lastRun.stateIdle': 'Aún sin ejecutar',
  'workbench.editors.live.lastRun.stateRetrying': 'Reintentando',
  'workbench.editors.live.lastRun.stateOpen': 'Abierta',
  'workbench.editors.live.lastRun.idle': 'Pulsa {button} para ver qué hace este paso.',
  'workbench.editors.live.lastRun.waiting': 'Aún no le ha llegado el turno en esta ejecución.',
  'workbench.editors.live.lastRun.notRun': 'La ejecución terminó antes de este paso.',
  'workbench.editors.live.lastRun.returned': 'Devolvió {status}.',
  'workbench.editors.live.lastRun.ready': 'La sesión estaba lista para recibir.',
  'workbench.editors.live.lastRun.sent': 'El mensaje se envió.',
  'workbench.editors.live.lastRun.matched': 'Llegó un mensaje que coincide.',
  'workbench.editors.live.lastRun.status': 'Estado',
  'workbench.editors.live.lastRun.response': 'Respuesta',
  'workbench.editors.live.lastRun.duration': 'Duración',
  'workbench.editors.live.lastRun.size': 'Tamaño',
  'workbench.editors.live.lastRun.attempts': 'Intentos',
  'workbench.editors.live.lastRun.attemptOf': '{attempt} de {max}',
  'workbench.editors.live.lastRun.readyIn': 'Lista en',
  'workbench.editors.live.lastRun.limit': 'Límite',
  'workbench.editors.live.lastRun.matchedAfter': 'Coincidió tras',
  'workbench.editors.live.lastRun.acknowledgedIn': 'Confirmado en',
  'workbench.editors.live.lastRun.limitOf': 'límite {duration}',
  'workbench.editors.live.deps.description': 'Espera a que estos terminen.',
  'workbench.editors.live.deps.add': 'Añadir',
  'workbench.editors.live.deps.none': 'Nada. Este paso empieza con el workflow.',
  'workbench.editors.live.deps.byDefault': 'Por defecto espera al paso anterior.',
  'workbench.editors.live.deps.chosen': 'Elegido para este paso.',
  'workbench.editors.live.requiredBy.title': 'Requerido por',
  'workbench.editors.live.requiredBy.description': 'Estos esperan a este paso.',
  'workbench.editors.live.requiredBy.none': 'Nada espera a este paso.',
  'workbench.editors.live.gate.description': 'Se comprueba cuando terminan todas las dependencias.',
  'workbench.editors.live.gate.colCheck': 'Comprobación',
  'workbench.editors.live.gate.colExpected': 'Esperado',
  'workbench.editors.live.gate.truthTrue': 'Verdadero',
  'workbench.editors.live.gate.truthFalse': 'Falso',
  'workbench.editors.live.gate.summaryAll': 'Se ejecuta cuando se cumple cada condición: {conditions}.',
  'workbench.editors.live.gate.summaryRoot':
    'Sin dependencias, así que este paso se ejecuta cuando empieza el workflow.',
  'workbench.editors.live.request.title': 'Solicitud',
  'workbench.editors.live.request.description': 'La solicitud guardada que envía este paso.',
  'workbench.editors.live.request.open': 'Abrir solicitud',
  'workbench.editors.live.request.saved': 'Solicitud guardada',
  'workbench.editors.live.request.inCollection': 'en {path}',
  'workbench.editors.live.connection.title': 'Conexión',
  'workbench.editors.live.connection.description': 'Permanece abierta hasta que termina la ejecución.',
  'workbench.editors.live.connection.readyWithin': 'Lista en (ms)',
  'workbench.editors.live.expect.title': 'Esperar mensaje',
  'workbench.editors.live.expect.description': 'Qué espera este paso y durante cuánto tiempo.',
  'workbench.editors.live.expect.topic': 'Tema',
  'workbench.editors.live.expect.onlyAfter': 'Solo mensajes después de',
  'workbench.editors.live.expect.within': 'Dentro de (ms)',
  'workbench.editors.live.step.onConnection': 'En la conexión',
  'workbench.editors.live.send.title': 'Enviar mensaje',
  'workbench.editors.live.send.description': 'El mensaje guardado que publica este paso.',
  'workbench.editors.live.send.savedMessage': 'Mensaje guardado',
  'workbench.editors.live.criteria.matchTitle': 'Criterios de coincidencia',
  'workbench.editors.live.criteria.matchDescription': 'Un mensaje coincide cuando se cumplen todas las filas.',
  'workbench.editors.live.criteria.colSource': 'Origen',
  'workbench.editors.live.criteria.colPath': 'Ruta',
  'workbench.editors.live.criteria.colOperator': 'Operador',
  'workbench.editors.live.criteria.lastRun': 'Última ejecución: {outcome}',
  'workbench.editors.live.criteria.neverMatched': 'Nunca coincidió',
  'workbench.editors.live.run.empty':
    'Aún no hay ninguna ejecución en esta sesión. Pulsa {button} para ejecutar este workflow.',
  'workbench.editors.live.run.verdict.running': 'En ejecución',
  'workbench.editors.live.run.verdict.passed': 'Correcta',
  'workbench.editors.live.run.verdict.failed': 'Fallida',
  'workbench.editors.live.run.verdict.cannotRun': 'No se puede ejecutar aquí',
  'workbench.editors.live.run.total.passed': '{count} correctos',
  'workbench.editors.live.run.total.failed': '{count} fallidos',
  'workbench.editors.live.run.total.skipped': '{count} omitidos',
  'workbench.editors.live.run.total.notRun': '{count} sin ejecutar',
  'workbench.editors.live.run.total.cannotRun': '{count} no ejecutables',
  'workbench.editors.live.run.action.call': 'Llamada',
  'workbench.editors.live.run.row.waiting': 'En espera',
  'workbench.editors.live.run.row.sending': 'Enviando…',
  'workbench.editors.live.run.row.attempt': 'Intento {attempt} de {max}',
  'workbench.editors.live.run.row.passedOnAttempt': 'Correcto en el intento {attempt} de {max}',
  'workbench.editors.live.run.row.readyIn': 'Listo en {duration}',
  'workbench.editors.live.run.row.sent': 'Enviado',
  'workbench.editors.live.run.row.acknowledgedIn': 'Confirmado en {duration}',
  'workbench.editors.live.run.row.matchedAfter': 'Coincidencia tras {duration}',
  'workbench.editors.live.run.row.captures': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} captura',
      many: '{count} capturas',
      other: '{count} capturas',
    }),
  'workbench.editors.live.run.row.failed': 'Fallido',
  'workbench.editors.live.run.row.timedOut': 'Tiempo agotado',
  'workbench.editors.live.run.row.skipped': 'Omitido',
  'workbench.editors.live.run.row.skippedReason': 'Su condición de ejecución no se cumplió.',
  'workbench.editors.live.run.row.notRun': 'Sin ejecutar',
  'workbench.editors.live.run.row.cannotRun': 'No se puede ejecutar aquí',
  'workbench.editors.live.run.footer.failed': 'No se publicó nada. Se mantienen los últimos valores válidos.',
  'workbench.editors.live.run.footer.cannotRun': 'No se ejecutó ningún paso.',
  'workbench.editors.live.run.pane.none': 'Este paso no tiene nada que mostrar.',
  'workbench.editors.live.run.pane.gone': 'La respuesta de este paso ya no se conserva.',
  'workbench.editors.live.run.action.listen': 'Escucha',
  'workbench.editors.live.run.action.send': 'Envío',
  'workbench.editors.live.run.row.heldByRateLimit': 'Esperando el límite de frecuencia',
  'workbench.editors.live.run.row.connecting': 'Conectando…',
  'workbench.editors.live.run.row.waitingFor': 'Esperando {address}',
  'workbench.editors.live.run.row.waitingForMessage': 'Esperando un mensaje',
  'workbench.editors.live.run.row.elapsedOf': '{elapsed} de {deadline}',
  'workbench.editors.live.run.row.open': 'abierta',
  'workbench.editors.live.run.row.closedAfter': 'cerrada tras {duration}',
  'workbench.editors.live.run.row.identityGenerated': 'ID de cliente generado',
  'workbench.editors.live.run.row.identityOwn': 'ID de cliente definido en la solicitud',
  'workbench.editors.live.run.row.cleanStart': 'Inicio limpio',
  'workbench.editors.live.run.row.resumed': 'Sesión almacenada reanudada',
  'workbench.editors.live.run.row.granted': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} suscripción concedida',
      many: '{count} suscripciones concedidas',
      other: '{count} suscripciones concedidas',
    }),
  'workbench.editors.live.run.pane.window.since': 'Mensajes en la dirección desde que empezó «{step}»',
  'workbench.editors.live.run.pane.window.empty': 'No llegó ningún mensaje a la dirección.',
  'workbench.editors.live.run.pane.note.matched': 'Coincide',
  'workbench.editors.live.run.pane.note.notMatched': 'No coincide',
  'workbench.editors.live.run.pane.note.stored': 'Almacenado · omitido',
  'workbench.editors.live.run.pane.note.sent': 'Enviado',
  'workbench.editors.live.run.pane.note.reply': 'Respuesta',
  'workbench.editors.live.workflow.refresh': 'Actualizar',
  'workbench.editors.live.workflow.runUnavailable': 'Los workflows no se ejecutan en una copia pública.',
  'workbench.editors.live.workflow.disabledTag': 'Desactivado',
  'workbench.editors.live.workflow.notFound': 'Workflow no encontrado.',
  'workbench.editors.live.workflow.needsUpdate':
    'Este workflow tiene pasos que necesitan una versión más reciente de OpenHeaders. Actualiza para editarlo o ejecutarlo.',
  'workbench.editors.live.workflow.sessionRunsElsewhere':
    'Un workflow con pasos de sesión se ejecuta en la pestaña «{surface}».',
  'workbench.editors.live.workflow.deletedElsewhere': 'El workflow se eliminó desde otra pestaña',
  'workbench.editors.live.workflow.saveFailed': 'No se pudo guardar el workflow',
  'workbench.editors.live.workflow.createFailed': 'No se pudo crear el workflow',
  'workbench.editors.live.workflow.nothingPicked': 'El paso «{id}» aún no tiene nada seleccionado.',
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
  'workbench.editors.live.form.sessionPolicyInfo':
    'Un workflow con pasos de sesión se ejecuta cuando pulsas Actualizar.',
  'workbench.editors.live.form.sessionNoLiveVariables':
    'Un workflow con pasos de sesión da un veredicto; sus capturas no se exponen como variables live.',

  // ── Workflow step editor ────────────────────────────────────────────
  'workbench.editors.live.step.needsUpdate': 'Este paso necesita una versión más reciente de OpenHeaders.',
  'workbench.editors.live.step.namePrefix': 'nombre',
  'workbench.editors.live.step.typeTooltip': 'Tipo de paso — Foreach y Composite llegarán en una versión futura.',
  'workbench.editors.live.step.typeForeach': 'Foreach',
  'workbench.editors.live.step.typeComposite': 'Composite',
  'workbench.editors.live.step.selectRequest': 'Selecciona una solicitud',
  'workbench.editors.live.step.selectSessionRequest': 'Selecciona una solicitud MQTT',
  'workbench.editors.live.step.sessionScriptsLabel': 'Ejecutar los scripts de la solicitud',
  'workbench.editors.live.step.identityTitle': 'Identidad de la sesión',
  'workbench.editors.live.step.identityInfo':
    'La sesión se conecta tal como está configurada su solicitud MQTT. Cámbialo en la solicitud.',
  'workbench.editors.live.step.onPrefix': 'en',
  'workbench.editors.live.step.selectMessage': 'Selecciona un mensaje guardado',
  'workbench.editors.live.step.afterPrefix': 'tras',
  'workbench.editors.live.step.includeStored': 'Incluir mensajes almacenados',
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

  // ── Step collapse sections (depends on / run condition / priority / retry / timeout / scripts) ──
  'workbench.editors.live.sections.dependsOn': 'Depende de',
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
  'workbench.editors.live.sections.successCriteria': 'Criterios de éxito',
  'workbench.editors.live.criteria.noneForCall': 'Sin criterios — cualquier respuesta que llegue se da por válida.',
  'workbench.editors.live.criteria.noneForExpect': 'Sin filas — el primer mensaje que llegue coincide.',
  'workbench.editors.live.criteria.kindExists': 'Existe',
  'workbench.editors.live.criteria.kindEquals': 'Es igual a',
  'workbench.editors.live.criteria.kindMatches': 'Coincide con',
  'workbench.editors.live.criteria.add': 'Añadir criterio',
  'workbench.editors.live.criteria.removeAria': 'Quitar el criterio {number}',
  'workbench.editors.live.sections.poll': 'Sondeo',
  'workbench.editors.live.sections.pollSummary': '({count} × {delay} ms)',
  'workbench.editors.live.sections.pollInfo':
    'Vuelve a enviar la solicitud hasta que se cumplan sus criterios de éxito.',
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
  'workbench.editors.live.gate.addCondition': 'Añadir condición',
  'workbench.editors.live.gate.stepPlaceholder': 'Paso',
  'workbench.editors.live.gate.capturePlaceholder': 'Nombre de la captura',
  'workbench.editors.live.gate.equalsPlaceholder': 'Valor de igualdad',
  'workbench.editors.live.gate.removeClauseAria': 'Quitar la cláusula {number}',
  'workbench.editors.live.gate.statusClassTooltip': 'Coincide con cualquier estado de la clase (p. ej. 2xx = 200-299).',

  // ── Workflow graph view ─────────────────────────────────────────────
  'workbench.editors.live.graph.lineAlways': 'siempre',
  'workbench.editors.live.graph.lineIf': 'si {condition}',
  'workbench.editors.live.graph.lineStatusNot': 'no {value}',
  'workbench.editors.live.graph.lineCaptureExists': '{name} existe',
  'workbench.editors.live.graph.lineCaptureMatches': '{name} coincide con /{pattern}/',
  'workbench.editors.live.graph.capsuleAll': 'TODAS',
  'workbench.editors.live.graph.menuAddStep': 'Añadir paso',
  'workbench.editors.live.graph.menuDeleteStep': 'Eliminar el paso',
  'workbench.editors.live.graph.connectTitle': 'Arrastra hasta otro paso para añadir una dependencia',
  'workbench.editors.live.graph.removeDependency': 'Quitar la dependencia',
  'workbench.editors.live.graph.zoomIn': 'Acercar',
  'workbench.editors.live.graph.zoomOut': 'Alejar',
  'workbench.editors.live.graph.recenter': 'Recentrar',
  'workbench.editors.live.graph.legendClick': 'clic',
  'workbench.editors.live.graph.legendSelect': 'seleccionar',
  'workbench.editors.live.graph.legendDelete': 'eliminar',
  'workbench.editors.live.graph.legendConnectKeys': 'arrastrar ○',
  'workbench.editors.live.graph.legendConnect': 'conectar',
  'workbench.editors.live.graph.legendRightClick': 'clic derecho',
  'workbench.editors.live.graph.legendMenu': 'menú',
  'workbench.editors.live.graph.legendDragBg': 'arrastrar el fondo',
  'workbench.editors.live.graph.legendPan': 'panorámica',
  'workbench.editors.live.graph.legendScroll': 'desplazar',
  'workbench.editors.live.graph.legendZoom': 'zoom',
  'workbench.editors.live.graph.requestNotFound': 'Solicitud no encontrada',
  'workbench.editors.live.graph.noRequestSelected': 'Ninguna solicitud seleccionada',
  'workbench.editors.live.graph.capturesPrefix': 'captura',
  'workbench.editors.live.graph.usedByPrefix': 'usado por',
  'workbench.editors.live.graph.kindWait': 'Espera',
  'workbench.editors.live.graph.legendTitle': 'Atajos',
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
  'workbench.editors.live.status.notRunYet': 'aún no ejecutado — haz clic en Actualizar para ejecutarlo',

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
  'workbench.editors.live.extractor.groupPayload': 'Carga útil del mensaje',
  'workbench.editors.live.extractor.wholePayload': 'Carga útil entera',
  'workbench.editors.live.extractor.groupMessage': 'Mensaje',
  'workbench.editors.live.extractor.field': 'Campo',
} as const satisfies Catalog;
