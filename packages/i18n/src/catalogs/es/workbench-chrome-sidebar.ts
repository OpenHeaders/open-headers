/**
 * Workbench chrome — the navigator plane — Spanish. Mirrors
 * `catalogs/en/workbench-chrome-sidebar.ts` key for key; extends the
 * es register contract (`es/shared.ts`). Reuses the sidebar mints
 * recorded in `es/workbench-docs-variables.ts` (`Variables del
 * espacio de trabajo`, `Variables Live`, `Entornos`, `Variables`,
 * `Vault` raw) and the script-packages title (`Biblioteca de
 * paquetes`). Rule-type names quote the shipped es `popup.ruleType.*`
 * set (`Encabezado`, `Bloquear`, `Redirigir`, `Parámetro de
 * consulta`, `Inyectar`, `Retraso`); pause vocabulary follows popup
 * (`Pausar`/`Reanudar`); badges are invariant lowercase markers
 * (`borrador`, `inactiva`); Override = `sustitución`. MINT: rule-match
 * scope-widened = `cobertura` — a separate referent from `ámbito`
 * (variable/cookie scope) and `alcance` (debug reach), S59 two-word
 * law kept intact. Entity names, collection names, and counts ride
 * raw inside keyed values.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchChromeSidebar = {
  // ── Sidebar: section headers (caps in the value) ────────────────────
  'workbench.sidebar.section.rules': 'REGLAS',
  'workbench.sidebar.section.templates': 'PLANTILLAS',
  'workbench.sidebar.section.requests': 'SOLICITUDES',
  'workbench.sidebar.section.workflows': 'WORKFLOWS',
  'workbench.sidebar.section.environments': 'ENTORNOS',
  'workbench.sidebar.section.vault': 'VAULT',
  'workbench.sidebar.section.workspaceVariables': 'VARIABLES DEL ESPACIO DE TRABAJO',
  'workbench.sidebar.section.liveVariables': 'VARIABLES LIVE',
  'workbench.sidebar.section.packageLibrary': 'BIBLIOTECA DE PAQUETES',
  'workbench.sidebar.section.specs': 'ESPECIFICACIONES',

  // ── Sidebar: per-view header title ──────────────────────────────────
  'workbench.sidebar.view.httpRules': 'Reglas HTTP',
  'workbench.sidebar.view.apiRequests': 'Solicitudes API',
  'workbench.sidebar.view.workflows': 'Workflows',
  'workbench.sidebar.view.variables': 'Variables',

  // ── Sidebar: header action cluster ──────────────────────────────────
  'workbench.sidebar.header.newRule': 'Nueva regla',
  'workbench.sidebar.header.addRequest': 'Añadir solicitud',
  'workbench.sidebar.header.createNewEnvironment': 'Crear un entorno nuevo',
  'workbench.sidebar.header.createNewSpec': 'Crear una especificación nueva',
  'workbench.sidebar.header.newWorkflow': 'Nuevo workflow',
  'workbench.sidebar.header.newTemplateCollection': 'Nueva colección de plantillas',
  'workbench.sidebar.header.exportSelected': 'Exportar {count} seleccionados…',
  'workbench.sidebar.header.exportSelectedAria': 'Exportar los {count} elementos seleccionados',
  'workbench.sidebar.header.clearSelection': 'Borrar la selección',
  'workbench.sidebar.header.clearSelectionAria': 'Borrar la selección de exportación',
  'workbench.sidebar.header.selectOpenedTab': 'Seleccionar la pestaña abierta',
  'workbench.sidebar.header.selectOpenedTabAria': 'Seleccionar la pestaña abierta',
  'workbench.sidebar.header.expandAll': 'Expandir todo',
  'workbench.sidebar.header.expandAllAria': 'Expandir todo',
  'workbench.sidebar.header.collapseAll': 'Contraer todo',
  'workbench.sidebar.header.collapseAllAria': 'Contraer todo',
  'workbench.sidebar.behavior.title': 'Comportamiento',
  'workbench.sidebar.behavior.openEntriesSingleClick': 'Abrir las entradas con un solo clic',
  'workbench.sidebar.behavior.openCollectionsSingleClick': 'Abrir las colecciones con un solo clic',
  'workbench.sidebar.behavior.openFoldersSingleClick': 'Abrir las carpetas con un solo clic',
  'workbench.sidebar.behavior.alwaysSelectOpened': 'Seleccionar siempre la pestaña abierta',
  'workbench.sidebar.filterPlaceholder': 'Filtrar',

  // ── Sidebar: container + row menus ──────────────────────────────────
  'workbench.sidebar.menu.newCollection': 'Nueva colección',
  'workbench.sidebar.menu.newRequest': 'Nueva solicitud',
  'workbench.sidebar.menu.import': 'Importar…',
  'workbench.sidebar.menu.addRule': 'Añadir regla',
  'workbench.sidebar.menu.addRequest': 'Añadir solicitud',
  'workbench.sidebar.menu.addGrpcRequest': 'Añadir solicitud gRPC',
  'workbench.sidebar.menu.addWebSocketRequest': 'Añadir solicitud WebSocket',
  'workbench.sidebar.menu.addSocketIoRequest': 'Añadir solicitud Socket.IO',
  'workbench.sidebar.menu.addFolder': 'Añadir carpeta',
  'workbench.sidebar.menu.rename': 'Renombrar',
  'workbench.sidebar.menu.editVariables': 'Editar variables',
  'workbench.sidebar.menu.createWorkflow': 'Crear workflow…',
  'workbench.sidebar.menu.export': 'Exportar…',
  'workbench.sidebar.menu.delete': 'Eliminar',
  'workbench.sidebar.menu.duplicate': 'Duplicar',
  'workbench.sidebar.menu.copyAs': 'Copiar como',
  'workbench.sidebar.menu.copyAsCurl': 'cURL',
  'workbench.sidebar.menu.copyAsFetch': 'fetch',
  'workbench.sidebar.menu.pauseCollection': 'Pausar la colección',
  'workbench.sidebar.menu.unpauseCollection': 'Reanudar la colección',
  'workbench.sidebar.menu.pauseFolder': 'Pausar la carpeta',
  'workbench.sidebar.menu.unpauseFolder': 'Reanudar la carpeta',
  'workbench.sidebar.menu.resetCollectionPauseOverride': 'Restablecer la sustitución de pausa de la colección',
  'workbench.sidebar.menu.resetFolderPauseOverride': 'Restablecer la sustitución de pausa de la carpeta',
  'workbench.sidebar.menu.clearNestedPauseOverrides': 'Borrar las sustituciones de pausa anidadas',

  // ── Sidebar: row badges + hover actions ─────────────────────────────
  'workbench.sidebar.badge.paused': 'pausada',
  'workbench.sidebar.badge.draft': 'borrador',
  'workbench.sidebar.badge.unresolved': 'sin resolver',
  'workbench.sidebar.badge.off': 'inactiva',
  'workbench.sidebar.badge.incomplete': 'incompleta',
  'workbench.sidebar.badge.scratch': 'provisional',
  'workbench.sidebar.badge.scripts': 'scripts',
  'workbench.sidebar.badge.specDrift': 'modificada',
  'workbench.sidebar.badge.scriptsTooltip':
    'Esta solicitud importada ejecutará JavaScript al ejecutarse. Ábrela para revisar los scripts.',
  'workbench.sidebar.badge.dirtyAria': 'cambios sin guardar',
  'workbench.sidebar.rule.enable': 'Activar la regla',
  'workbench.sidebar.rule.disable': 'Desactivar la regla',
  'workbench.sidebar.env.setActive': 'Hacer activo',
  'workbench.sidebar.env.setInactive': 'Hacer inactivo',
  'workbench.sidebar.env.setDefault': 'Definir como por defecto',
  'workbench.sidebar.env.unsetDefault': 'Quitar como por defecto',
  'workbench.sidebar.workflow.bindingsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} var',
      many: '{count} vars',
      other: '{count} vars',
    }),
  'workbench.sidebar.workflow.bindingsTooltip': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} variable live vinculada a este workflow',
      many: '{count} variables live vinculadas a este workflow',
      other: '{count} variables live vinculadas a este workflow',
    }),

  // ── Sidebar: empty placeholders ─────────────────────────────────────
  'workbench.sidebar.placeholder.folderEmptyTitle': 'La carpeta está vacía',
  'workbench.sidebar.placeholder.collectionEmptyTitle': 'La colección está vacía',
  'workbench.sidebar.placeholder.requestsEmptyTitle': 'Aún no hay solicitudes',
  'workbench.sidebar.placeholder.templatesEmptyTitle': 'Aún no hay plantillas',
  'workbench.sidebar.placeholder.addRuleOrFolder': 'Añade una regla o una carpeta para empezar.',
  'workbench.sidebar.placeholder.addRequestOrFolder': 'Añade una solicitud o una carpeta para empezar.',
  'workbench.sidebar.placeholder.templateFolderEmptyMessage': 'Guarda una regla como plantilla para llenarla.',
  'workbench.sidebar.placeholder.templatesEmptyMessage': 'Guarda una regla como plantilla desde el editor.',
  'workbench.sidebar.placeholder.addRule': 'Añadir regla',
  'workbench.sidebar.placeholder.addFolder': 'Añadir carpeta',
  'workbench.sidebar.placeholder.addRequest': 'Añadir solicitud',
  'workbench.sidebar.emptySection': 'No hay elementos en esta sección',
  'workbench.sidebar.emptySectionCreate': 'Crear',

  // ── Sidebar: templates view ─────────────────────────────────────────
  'workbench.sidebar.templates.systemGroup': 'Plantillas del sistema',
  'workbench.sidebar.ruleType.header': 'Encabezado',
  'workbench.sidebar.ruleType.block': 'Bloquear',
  'workbench.sidebar.ruleType.redirect': 'Redirigir',
  'workbench.sidebar.ruleType.queryParam': 'Parámetro de consulta',
  'workbench.sidebar.ruleType.inject': 'Inyectar',
  'workbench.sidebar.ruleType.delay': 'Retraso',
  'workbench.sidebar.ruleType.requestBody': 'Cuerpo de solicitud API',
  'workbench.sidebar.ruleType.response': 'Respuesta API',

  // ── Sidebar: variables-view singleton rows ──────────────────────────
  'workbench.sidebar.singleton.vault': 'Vault',
  'workbench.sidebar.singleton.workspaceVariables': 'Variables del espacio de trabajo',
  'workbench.sidebar.singleton.liveVariables': 'Variables Live',
  'workbench.sidebar.singleton.packageLibrary': 'Biblioteca de paquetes',

  // ── Sidebar: default entity names ───────────────────────────────────
  'workbench.sidebar.defaults.newFolder': 'Nueva carpeta',

  // ── Sidebar: confirm-delete modal + toasts ──────────────────────────
  'workbench.sidebar.confirmDelete.title': '¿Eliminar el elemento?',
  'workbench.sidebar.confirmDelete.bodyPrefix': '¿Seguro que quieres eliminar ',
  'workbench.sidebar.confirmDelete.bodySuffix': '? Esta acción no se puede deshacer.',
  'workbench.sidebar.confirmDelete.ok': 'Eliminar',
  'workbench.sidebar.toast.toggleRuleFailed': 'No se pudo alternar la regla',
  'workbench.sidebar.toast.renameExampleFailed': 'No se pudo renombrar el ejemplo',
  'workbench.sidebar.toast.duplicateExampleFailed': 'No se pudo duplicar el ejemplo',
  'workbench.sidebar.toast.deleteExampleFailed': 'No se pudo eliminar el ejemplo',
  'workbench.sidebar.toast.createRequestCollectionFailed': 'No se pudo crear la colección de solicitudes',
  'workbench.sidebar.toast.createEnvironmentFailed': 'No se pudo crear el entorno',
  'workbench.sidebar.toast.createSpecFailed': 'No se pudo crear la especificación',
  'workbench.sidebar.toast.renameSpecFailed': 'No se pudo renombrar la especificación',
  'workbench.sidebar.toast.deleteSpecFailed': 'No se pudo eliminar la especificación',

  // ── Sidebar: folder drag-and-drop ───────────────────────────────────
  'workbench.sidebar.dnd.dragToReorderFolder': 'Arrastra para reordenar la carpeta',

  // ── Activity feed panel + cards ─────────────────────────────────────
  'workbench.activityFeed.reverted': 'Cambio revertido',
  'workbench.activityFeed.revertFailed': 'Falló la reversión: {reason}',
  'workbench.activityFeed.emptyTitle': 'Aún no hay actividad',
  'workbench.activityFeed.emptyHint': 'Los cambios entrantes de otros pares aparecerán aquí.',
  'workbench.activityFeed.view': 'Ver',
  'workbench.activityFeed.mute': 'Silenciar',
  'workbench.activityFeed.unmute': 'Dejar de silenciar',
  'workbench.activityFeed.muteTip':
    'Suprime las próximas filas de actividad entrante para esta entidad. Las filas pasadas se conservan.',
  'workbench.activityFeed.unmuteTip': 'Deja de suprimir la actividad entrante para esta entidad.',
  'workbench.activityFeed.revert': 'Revertir',
  'workbench.activityFeed.revertTip':
    'Aplica el inverso de este cambio. Emite una mutación nueva que devuelve la entidad a su estado previo a ' +
    'la entrada.',
  'workbench.activityFeed.revertUnavailableDelete':
    'Las eliminaciones son permanentes y no se pueden revertir (§7.2 delete-wins).',
  'workbench.activityFeed.revertUnavailable': 'Este cambio no se puede revertir.',
  'workbench.activityFeed.kind.created': 'Creada',
  'workbench.activityFeed.kind.createdTip': 'Llegó una entidad nueva desde un par.',
  'workbench.activityFeed.kind.edited': 'Editada',
  'workbench.activityFeed.kind.editedTip': 'Un par editó campos de esta entidad.',
  'workbench.activityFeed.kind.deleted': 'Eliminada',
  'workbench.activityFeed.kind.deletedTip': 'Un par eliminó esta entidad.',
  'workbench.activityFeed.kind.superseded': 'Sustituyó la edición local',
  'workbench.activityFeed.kind.supersededTip': 'Una mutación entrante sustituyó tu edición local en curso.',
  'workbench.activityFeed.kind.sensitiveRotation': 'Campo sensible rotado',
  'workbench.activityFeed.kind.sensitiveRotationTip':
    'Se reemplazó un campo sensible (secreto / token / encabezado sensible).',
  'workbench.activityFeed.kind.scopeWidened': 'Cobertura ampliada',
  'workbench.activityFeed.kind.scopeWidenedTip':
    'Se relajó una condición de la regla — la regla ahora coincide con un conjunto de URL/métodos más amplio.',
  'workbench.activityFeed.kind.agentObserved': 'Lectura por agente',
  'workbench.activityFeed.kind.agentObservedTip':
    'Un agente leyó tráfico en vivo a través del nivel MCP observe — proyecciones censuradas de una fuente armada.',
  'workbench.activityFeed.rawRead': 'Sin censurar',
  'workbench.activityFeed.rawReadTip':
    'Esta lectura proyectó los valores reales — el permiso de lectura sin censura de sesiones estaba activado en Ajustes → Monitor de tráfico.',

  // ── Overview tabs (collection / folder, all three families). The
  // folder-suffix chunks carry their leading '· ' — the JSX supplies
  // only the separating space. ────────────────────────────────────────
  'workbench.overview.stats.rules': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} regla',
      many: '{count} reglas',
      other: '{count} reglas',
    }),
  'workbench.overview.stats.requests': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} solicitud',
      many: '{count} solicitudes',
      other: '{count} solicitudes',
    }),
  'workbench.overview.stats.templates': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} plantilla',
      many: '{count} plantillas',
      other: '{count} plantillas',
    }),
  'workbench.overview.stats.foldersSuffix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '· {count} carpeta',
      many: '· {count} carpetas',
      other: '· {count} carpetas',
    }),
  'workbench.overview.stats.subfoldersSuffix': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '· {count} subcarpeta',
      many: '· {count} subcarpetas',
      other: '· {count} subcarpetas',
    }),
  'workbench.overview.stats.activeTag': '{count} activas',
  'workbench.overview.stats.disabledTag': '{count} desactivadas',
  'workbench.overview.stats.draftTag': '{count} en borrador',
  'workbench.overview.stats.pausedTag': 'Pausada',
  'workbench.overview.cell.folderRules': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Carpeta · {count} regla',
      many: 'Carpeta · {count} reglas',
      other: 'Carpeta · {count} reglas',
    }),
  'workbench.overview.cell.folderRequests': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Carpeta · {count} solicitud',
      many: 'Carpeta · {count} solicitudes',
      other: 'Carpeta · {count} solicitudes',
    }),
  'workbench.overview.cell.folderTemplates': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Carpeta · {count} plantilla',
      many: 'Carpeta · {count} plantillas',
      other: 'Carpeta · {count} plantillas',
    }),
  'workbench.overview.status.draft': 'Borrador',
  'workbench.overview.status.incomplete': 'Incompleta',
  'workbench.overview.status.disabled': 'Desactivada',
  'workbench.overview.status.paused': 'Pausada',
  'workbench.overview.status.active': 'Activa',
  'workbench.overview.action.addRule': 'Añadir regla',
  'workbench.overview.action.addRequest': 'Añadir solicitud',
  'workbench.overview.action.pause': 'Pausar',
  'workbench.overview.action.resume': 'Reanudar',
  'workbench.overview.action.pauseCollectionTooltip': 'Pausar todas las reglas de esta colección',
  'workbench.overview.action.resumeCollectionTooltip': 'Reanudar todas las reglas de esta colección',
  'workbench.overview.action.pauseFolderTooltip': 'Pausar todas las reglas de esta carpeta',
  'workbench.overview.action.resumeFolderTooltip': 'Reanudar todas las reglas de esta carpeta',
  'workbench.overview.action.variables': 'Variables',
  'workbench.overview.action.variablesTooltip': 'Editar las variables limitadas a esta colección',
  'workbench.overview.action.variablesTooltipRequest': 'Editar las variables limitadas a esta colección de solicitudes',
  'workbench.overview.action.variablesTooltipTemplate': 'Editar las variables limitadas a esta colección de plantillas',
  'workbench.overview.action.scripts': 'Scripts',
  'workbench.overview.action.scriptsTooltipCollection':
    'Editar los scripts que se ejecutan para cada solicitud de esta colección',
  'workbench.overview.action.scriptsTooltipFolder':
    'Editar los scripts que se ejecutan para cada solicitud de esta carpeta',
  'workbench.overview.action.auth': 'Autorización',
  'workbench.overview.action.authTooltipCollection':
    'Definir la autorización por defecto que hereda cada solicitud de esta colección',
  'workbench.overview.action.authTooltipFolder':
    'Definir la autorización por defecto que hereda cada solicitud de esta carpeta',
  'workbench.overview.caption.description': 'Descripción',
  'workbench.overview.caption.contents': 'Contenido',
  'workbench.overview.empty.collectionNotFound': 'Colección no encontrada',
  'workbench.overview.empty.folderNotFound': 'Carpeta no encontrada',
  'workbench.overview.empty.requestCollectionNotFound': 'Colección de solicitudes no encontrada',
  'workbench.overview.empty.templateCollectionNotFound': 'Colección de plantillas no encontrada',
  'workbench.overview.empty.noItems': 'Aún no hay elementos',
  'workbench.overview.empty.noRequests': 'Aún no hay solicitudes',
  'workbench.overview.empty.templatesCollection':
    'No hay plantillas en esta colección. Guarda una regla como plantilla para llenar esta colección.',
  'workbench.overview.empty.templatesFolder':
    'Aún no hay plantillas — guarda una regla como plantilla desde el editor de reglas para llenar esta carpeta.',

  // ── Collection picker panel (import flows) ──────────────────────────
  'workbench.collectionPicker.searchPlaceholder': 'Buscar una colección',
  'workbench.collectionPicker.empty': 'Aún no hay colecciones — se crea una automáticamente al importar.',
  'workbench.collectionPicker.noMatch': 'Ninguna colección coincide.',
  'workbench.collectionPicker.newCollection': 'Nueva colección',
} as const satisfies Catalog;
