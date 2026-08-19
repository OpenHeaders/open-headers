/**
 * DevTools panel — rule quick-editor popover + rule hover snapshot
 * plane — Spanish. Mirrors `catalogs/en/panel-quick-editor.ts` key
 * for key. Raw by design: rule/collection/folder/header/param names,
 * URLs, `{{template}}` chips, status codes + MIME values, code/JSON
 * example placeholders, direction glyphs (⬇ ⬆), `mergeSeparator` and
 * DNR schema vocabulary, and core validator sentences riding as
 * holes. Mints: template prose = `plantilla`; `listeners` ride raw
 * (m., JS vocabulary, frame precedent); snapshot op words render as
 * nouns (inyección / sustitución / adición / fusión / eliminación).
 */

import type { Catalog } from '../../types';

export const panelQuickEditor = {
  // ── Quick-editor popovers (station: quick-editor popover family) ────
  'panel.quickEditor.clearRuleNameAria': 'Borrar el nombre de la regla',
  'panel.quickEditor.renameTitle': '{name} — haz clic para renombrar',
  'panel.quickEditor.enabledOn': 'Activada',
  'panel.quickEditor.enabledOff': 'Desactivada',
  'panel.quickEditor.ruleEnabledAria': 'Regla activada',
  'panel.quickEditor.openInTab': 'Abrir en una pestaña',
  'panel.quickEditor.openInWorkspace': 'Abrir en el espacio de trabajo →',
  'panel.quickEditor.saveButton': 'Guardar',
  'panel.quickEditor.openToInspect': 'Abre en el espacio de trabajo para inspeccionar o cambiar esta regla.',
  'panel.quickEditor.variableMissing':
    'Falta la variable — pasa el cursor por la referencia roja para crearla y activar Guardar.',
  'panel.quickEditor.retargetHint': 'Ajusta las condiciones de abajo para reorientar la regla.',

  // Save/toggle toasts (create + edit chains share the not-found case).
  'panel.quickEditor.toast.ruleUpdated': 'Regla actualizada',
  'panel.quickEditor.toast.ruleNotFound': 'Regla no encontrada — puede que se haya eliminado.',
  'panel.quickEditor.toast.saveFailed': 'Fallo al guardar',
  'panel.quickEditor.toast.toggleFailed': 'No se pudo conmutar la regla',
  'panel.quickEditor.toast.changedElsewhere': 'La regla cambió en otro sitio — cierra y vuelve a abrir el popover.',
  'panel.quickEditor.toast.noWorkspace': 'No hay espacio de trabajo activo',
  'panel.quickEditor.toast.collectionCreateFailed': 'No se pudo crear una colección para la regla',
  'panel.quickEditor.toast.folderCreateFailed':
    'No se pudo crear la carpeta «{name}» — se guarda en la raíz de la colección.',
  'panel.quickEditor.toast.createFailed': 'No se pudo crear la regla',
  'panel.quickEditor.toast.createdDraft': 'Regla creada como borrador — publícala desde el espacio de trabajo.',
  'panel.quickEditor.toast.created': 'Regla creada',

  // Destination row ("Saving to" label + raw collection/folder names).
  'panel.quickEditor.destination.title': 'Elegir dónde se guarda la regla',
  'panel.quickEditor.destination.savingTo': 'Se guarda en',
  'panel.quickEditor.destination.newTag': 'nueva',
  'panel.quickEditor.destination.autoNamed': 'Auto — {folder}',
  'panel.quickEditor.destination.autoRoot': 'Auto — raíz de la colección',
  'panel.quickEditor.destination.root': 'Raíz de la colección',

  // Conditions row ("Conditions" label + raw digest of the list).
  'panel.quickEditor.conditions.title': 'Ver y editar cuándo se dispara esta regla',
  'panel.quickEditor.conditions.label': 'Condiciones',
  'panel.quickEditor.conditions.none': 'ninguna — no coincide con ninguna solicitud',

  // Header quick editors (single-mod hover + whole-list + create).
  'panel.quickEditor.header.addHeader': 'Añadir un encabezado',
  'panel.quickEditor.header.mergeSeparatorTitle': 'Separador de fusión',
  'panel.quickEditor.header.directionRequest': 'Solicitud',
  'panel.quickEditor.header.directionResponse': 'Respuesta',
  'panel.quickEditor.validation.nameRequired': 'El nombre del encabezado es obligatorio.',
  'panel.quickEditor.validation.invalidName': 'Nombre de encabezado no válido.',
  'panel.quickEditor.validation.invalidValue': 'Valor de encabezado no válido.',
  // {operation} interpolates the raw schema operation the one-click fix
  // would switch to (e.g. add).
  'panel.quickEditor.validation.switchTo': 'Cambiar a {operation}',

  // Typed bodies — popover-only copy.
  'panel.quickEditor.redirect.targetPlaceholder': 'p. ej. https://openheaders.com/redirected',
  'panel.quickEditor.redirect.hint': 'Las solicitudes coincidentes se envían a esta URL antes de llegar a la red.',
  'panel.quickEditor.delay.hint':
    'Las navegaciones se retrasan hasta 30 000 ms; XHR/fetch se limita a 5 000 ms. Los subrecursos no se ' +
    'retrasan.',
  'panel.quickEditor.block.editHint': 'Las solicitudes coincidentes se bloquean antes de llegar a la red.',
  'panel.quickEditor.block.blockRequestsTo': 'Bloquear las solicitudes hacia',
  'panel.quickEditor.block.createHint':
    'Las solicitudes coincidentes se cancelan antes de salir del navegador — la página ve un error de red.',
  'panel.quickEditor.response.tagModify': 'Modificación',
  'panel.quickEditor.response.tagMock': 'Mock',
  'panel.quickEditor.response.dynamicBody':
    'Esta regla construye su respuesta con JavaScript. Abre en el espacio de trabajo para editar el script.',
  'panel.quickEditor.requestBody.hint':
    'Las solicitudes coincidentes se envían con este cuerpo en lugar del de la página.',
  'panel.quickEditor.requestBody.dynamicBody':
    'Esta regla construye su cuerpo con JavaScript. Abre en el espacio de trabajo para editar el script.',
  'panel.quickEditor.inject.sourceUrlLabel': 'URL de origen',
  'panel.quickEditor.inject.loadsStylesheetHint':
    'Las páginas coincidentes cargan esta hoja de estilos mientras se cargan.',
  'panel.quickEditor.inject.loadsScriptHint': 'Las páginas coincidentes cargan este script mientras se cargan.',
  'panel.quickEditor.inject.injectedHint': 'Inyectado en las páginas coincidentes mientras se cargan.',
  'panel.quickEditor.message.incoming': 'Entrante ⬇',
  'panel.quickEditor.message.outgoing': 'Saliente ⬆',
  'panel.quickEditor.message.injectedConnectionsHint':
    'Inyectado en las conexiones coincidentes antes de que los listeners lo vean.',
  'panel.quickEditor.message.injectedStreamsHint':
    'Inyectado en los flujos coincidentes antes de que los listeners lo vean.',
  'panel.quickEditor.message.replacedFramesHint':
    'Los frames coincidentes se reemplazan por esta carga útil antes de ser vistos.',
  'panel.quickEditor.message.replacedEventsHint':
    'Los eventos coincidentes se reemplazan por esta carga útil antes de ser vistos.',
  'panel.quickEditor.message.droppedFramesHint': 'Los frames coincidentes se descartan antes de ser vistos.',
  'panel.quickEditor.message.droppedEventsHint': 'Los eventos coincidentes se descartan antes de ser vistos.',
  'panel.quickEditor.queryParam.addAction': 'Añadir una acción',
  'panel.quickEditor.queryParam.removeAllWarning':
    'Quitar todo elimina la cadena de consulta entera — las demás operaciones de esta regla se ignorarán.',
  'panel.quickEditor.auth.challengesHint':
    'Responde a los desafíos de autenticación de servidor (401) y de proxy (407) en las solicitudes ' + 'coincidentes.',

  // ── Rule hover popover (fire-snapshot plane) ─────────────────────────
  'panel.ruleHover.tagRuleEdited': 'Regla editada',
  'panel.ruleHover.tagVariableChanged': 'Variable cambiada',
  'panel.ruleHover.tagDeleted': 'Eliminada',
  'panel.ruleHover.tagDisabled': 'Desactivada',
  'panel.ruleHover.tagModRemoved': 'Mod quitada',
  'panel.ruleHover.tagConditionsMismatch': 'Las condiciones no coinciden',
  'panel.ruleHover.tagWontFire': 'No se disparará',
  'panel.ruleHover.tagTitle.ruleDisabled':
    'El indicador de activación de la regla está desactivado — no se disparará en ninguna solicitud futura.',
  'panel.ruleHover.tagTitle.modGone': 'La modificación correspondiente se quitó de la regla.',
  'panel.ruleHover.tagTitle.conditionsMismatch': 'Las condiciones de la regla ya no cubren esta URL.',
  'panel.ruleHover.tagTitle.nameUnresolved':
    'La plantilla del nombre de encabezado no se puede resolver por completo (p. ej. referencia un TOTP). DNR ' +
    'rechaza los caracteres de plantilla literales en los nombres de encabezado.',
  'panel.ruleHover.tagTitle.valueUnresolved': 'La plantilla del valor de encabezado no se puede resolver por completo.',
  'panel.ruleHover.tagTitle.separatorUnresolved':
    'La plantilla del separador de fusión no se puede resolver por completo.',
  'panel.ruleHover.deletedBody':
    'Esta regla se ha eliminado. La captura de arriba muestra lo que hizo cuando se disparó.',
  'panel.ruleHover.modRemovedBody':
    'La modificación correspondiente se ha quitado de la regla. Abre en el espacio de trabajo para recrearla ' +
    'o ajustarla.',

  // Snapshot block (Original / Now / Future rows + byline).
  'panel.ruleHover.snapshot.opInject': 'inyección',
  'panel.ruleHover.snapshot.opOverride': 'sustitución',
  'panel.ruleHover.snapshot.opAppend': 'adición',
  'panel.ruleHover.snapshot.opMerge': 'fusión',
  'panel.ruleHover.snapshot.opRemove': 'eliminación',
  'panel.ruleHover.snapshot.templateTitle': 'Plantilla antes de la resolución de variables en el momento del disparo',
  'panel.ruleHover.snapshot.nameDriftTitle':
    'La misma plantilla — una variable referenciada ahora se resuelve en otro nombre de encabezado',
  'panel.ruleHover.snapshot.cancels': 'cancela «{rule}»',
  'panel.ruleHover.snapshot.original': 'Original',
  'panel.ruleHover.snapshot.now': 'Ahora',
  'panel.ruleHover.snapshot.future': 'Futuro',
  'panel.ruleHover.snapshot.futureTitle': 'Lo que recibiría la próxima solicitud coincidente',
  'panel.ruleHover.snapshot.removed': 'quitado',
  'panel.ruleHover.snapshot.empty': '(vacío)',
  'panel.ruleHover.snapshot.totpNote':
    'Las referencias TOTP / diferidas se resuelven en el momento de la solicitud y no se capturan aquí.',
  'panel.ruleHover.snapshot.alsoByRule': 'También por esta regla en esta solicitud',

  // Future-row variants (one key per FutureKind wording).
  'panel.ruleHover.future.ruleDeleted': 'la regla se eliminó — no se disparará',
  'panel.ruleHover.future.ruleDisabled': 'la regla está desactivada — no se disparará',
  'panel.ruleHover.future.modGone': 'esta modificación se quitó de la regla',
  'panel.ruleHover.future.conditionsMismatch': 'las condiciones de la regla ya no coinciden con esta URL',
  'panel.ruleHover.future.nameUnresolved':
    'la plantilla del nombre de encabezado no se puede resolver — la regla no se disparará',
  'panel.ruleHover.future.valueUnresolved': 'la plantilla del valor no se puede resolver — la regla no se disparará',
  'panel.ruleHover.future.separatorUnresolved':
    'la plantilla mergeSeparator no se puede resolver — la regla no se disparará',
  'panel.ruleHover.future.templateTitle': 'Plantilla: {template}',
} as const satisfies Catalog;
