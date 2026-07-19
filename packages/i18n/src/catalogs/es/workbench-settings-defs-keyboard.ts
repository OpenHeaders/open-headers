/**
 * Workbench settings — keyboard-category setting definitions — Spanish.
 * Mirrors `catalogs/en/workbench-settings-defs-keyboard.ts` key for
 * key; extends the es register contract (`es/shared.ts`). Chord
 * notation and physical key names (ArrowDown, Enter, Space, ⌘K,
 * Alt+C, …) ride raw inside keyed values — localized key names are a
 * deferred Phase I workstream. Action labels reuse the shipped
 * `popup.shortcuts.*` es wording where the same action exists there;
 * popup tab names quote the shipped es labels («Esta página», «Todas
 * las reglas», «Colecciones»). MINTS: Activity Feed = `flujo de
 * actividad` and Command Palette = `paleta de comandos` —
 * `workbench-chrome.ts` must reuse both; import hub = `centro de
 * importación` (`workbench-import-export.ts` must reuse); cheatsheet =
 * `guía rápida`; preset = `preajuste`.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefsKeyboard = {
  // ── Keyboard category defs ─────────────────────────────────────────
  'workbench.settings.def.keyboard.toggleDebugMode.label': 'Alternar el modo de depuración',
  'workbench.settings.def.keyboard.toggleDebugMode.description':
    'Activa o desactiva el modo de depuración desde cualquier superficie. Solo se dispara cuando ningún campo ' +
    'de texto tiene el foco.',
  'workbench.settings.def.keyboard.toggleDebugMode.capabilityUnavailableHint':
    'El modo de depuración está disponible en Chrome y Edge.',
  'workbench.settings.def.keyboard.commandPalette.label': 'Abrir la paleta de comandos',
  'workbench.settings.def.keyboard.commandPalette.description': 'Mostrar la paleta de comandos superpuesta.',
  'workbench.settings.def.keyboard.openSettings.label': 'Abrir la configuración',
  'workbench.settings.def.keyboard.openSettings.description': 'Abrir la ventana modal de configuración.',
  'workbench.settings.def.keyboard.toggleLeftSidebar.label': 'Alternar la barra lateral izquierda',
  'workbench.settings.def.keyboard.toggleLeftSidebar.description': 'Mostrar u ocultar la barra lateral izquierda.',
  'workbench.settings.def.keyboard.toggleRightSidebar.label': 'Alternar la barra lateral derecha',
  'workbench.settings.def.keyboard.toggleRightSidebar.description': 'Mostrar u ocultar la barra lateral derecha.',
  'workbench.settings.def.keyboard.toggleBottomPanel.label': 'Alternar el panel inferior',
  'workbench.settings.def.keyboard.toggleBottomPanel.description': 'Mostrar u ocultar el panel inferior.',
  'workbench.settings.def.keyboard.toggleActivityFeed.label': 'Alternar el flujo de actividad',
  'workbench.settings.def.keyboard.toggleActivityFeed.description': 'Mostrar u ocultar el panel Flujo de actividad.',
  'workbench.settings.def.keyboard.newRule.label': 'Crear elemento',
  'workbench.settings.def.keyboard.newRule.description': 'Abrir el menú de creación para reglas y solicitudes API.',
  'workbench.settings.def.keyboard.newTab.label': 'Nueva pestaña',
  'workbench.settings.def.keyboard.newTab.description': 'Abrir una nueva pestaña de borrador de solicitud API.',
  'workbench.settings.def.keyboard.import.label': 'Importar',
  'workbench.settings.def.keyboard.import.description':
    'Abrir el centro de importación para curl, HAR y archivos de espacio de trabajo.',
  'workbench.settings.def.keyboard.save.label': 'Guardar',
  'workbench.settings.def.keyboard.save.description': 'Guardar la pestaña de editor activa.',
  'workbench.settings.def.keyboard.closeTab.label': 'Cerrar la pestaña',
  'workbench.settings.def.keyboard.closeTab.description': 'Cerrar la pestaña de editor con el foco.',
  'workbench.settings.def.keyboard.previousTab.label': 'Pestaña anterior',
  'workbench.settings.def.keyboard.previousTab.description': 'Enfocar la pestaña de editor anterior.',
  'workbench.settings.def.keyboard.nextTab.label': 'Pestaña siguiente',
  'workbench.settings.def.keyboard.nextTab.description': 'Enfocar la pestaña de editor siguiente.',
  'workbench.settings.def.keyboard.tabSearch.label': 'Buscar en las pestañas',
  'workbench.settings.def.keyboard.tabSearch.description':
    'Abrir una búsqueda superpuesta sobre todas las pestañas abiertas.',
  'workbench.settings.def.keyboard.focusSidebarFilter.label': 'Enfocar el filtro de la sección activa',
  'workbench.settings.def.keyboard.focusSidebarFilter.description':
    'Mover el foco al campo de filtro de la sección de la barra lateral en la que estés.',
  'workbench.settings.def.keyboard.focusLeftSidebar.label': 'Enfocar la barra lateral izquierda',
  'workbench.settings.def.keyboard.focusLeftSidebar.description':
    'Mover el foco del teclado a la barra lateral izquierda.',
  'workbench.settings.def.keyboard.focusEditor.label': 'Enfocar el editor',
  'workbench.settings.def.keyboard.focusEditor.description': 'Mover el foco del teclado al área del editor.',
  'workbench.settings.def.keyboard.focusRightSidebar.label': 'Enfocar la barra lateral derecha',
  'workbench.settings.def.keyboard.focusRightSidebar.description':
    'Mover el foco del teclado a la barra lateral derecha.',
  'workbench.settings.def.keyboard.focusBottomPanel.label': 'Enfocar el panel inferior',
  'workbench.settings.def.keyboard.focusBottomPanel.description':
    'Mover el foco del teclado a la fila de pestañas del panel inferior.',
  'workbench.settings.def.keyboard.terminalNewTab.label': 'Nueva pestaña de terminal',
  'workbench.settings.def.keyboard.terminalNewTab.description':
    'Iniciar una pestaña de terminal nueva cuando el panel Terminal tiene el foco; en el resto, el atajo ' +
    'conserva su acción habitual de Nueva pestaña. Solo en la aplicación de escritorio.',
  'workbench.settings.def.keyboard.showShortcutHelp.label': 'Mostrar la ayuda de atajos',
  'workbench.settings.def.keyboard.showShortcutHelp.description': 'Mostrar la guía rápida de atajos de teclado.',
  'workbench.settings.def.keyboard.find.label': 'Buscar en el editor',
  'workbench.settings.def.keyboard.find.description':
    'Abrir el widget de búsqueda en el editor de código con el foco. Solo se dispara cuando el editor tiene el ' +
    'foco — no interfiere con los atajos globales.',
  'workbench.settings.def.keyboard.replace.label': 'Reemplazar en el editor',
  'workbench.settings.def.keyboard.replace.description':
    'Abrir el widget de buscar y reemplazar en el editor de código con el foco. Solo se dispara cuando el ' +
    'editor tiene el foco — no interfiere con los atajos globales.',
  'workbench.settings.def.keyboard.formatCode.label': 'Formatear el código',
  'workbench.settings.def.keyboard.formatCode.description':
    'Formatear el contenido del editor de código con el foco. Solo se dispara cuando el editor tiene el foco — ' +
    'no interfiere con los atajos globales.',
  'workbench.settings.def.keyboard.preset.label': 'Preajuste de atajos',
  'workbench.settings.def.keyboard.preset.description':
    'El conjunto base de atajos. Los atajos que personalices se mantienen por encima del preajuste y sobreviven ' +
    'al cambiarlo.',
  'workbench.settings.def.keyboard.preset.option.openheaders.label': 'Valores por defecto de OpenHeaders',
  'workbench.settings.def.keyboard.preset.option.vscode.label': 'Estilo VS Code',

  // ── Keyboard popup defs ────────────────────────────────────────────
  'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.label': 'Popup — Alternar la ayuda de atajos',
  'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.description':
    'Mostrar u ocultar la guía rápida de atajos de teclado del popup.',
  'workbench.settings.def.keyboard.popup.toggleOptionsMenu.label': 'Popup — Alternar el menú de opciones',
  'workbench.settings.def.keyboard.popup.toggleOptionsMenu.description':
    'Abrir o cerrar el menú desplegable de opciones del pie de página.',
  'workbench.settings.def.keyboard.popup.focusSearch.label': 'Popup — Enfocar la búsqueda',
  'workbench.settings.def.keyboard.popup.focusSearch.description':
    'Mover el foco del teclado al campo de búsqueda de la pestaña activa.',
  'workbench.settings.def.keyboard.popup.prevPage.label': 'Popup — Página anterior',
  'workbench.settings.def.keyboard.popup.prevPage.description':
    'Ir a la página anterior de reglas en la pestaña activa.',
  'workbench.settings.def.keyboard.popup.nextPage.label': 'Popup — Página siguiente',
  'workbench.settings.def.keyboard.popup.nextPage.description':
    'Ir a la página siguiente de reglas en la pestaña activa.',
  'workbench.settings.def.keyboard.popup.moveDown.label': 'Popup — Bajar',
  'workbench.settings.def.keyboard.popup.moveDown.description':
    'Avanzar la fila con el foco. ArrowDown siempre está disponible como alias.',
  'workbench.settings.def.keyboard.popup.moveUp.label': 'Popup — Subir',
  'workbench.settings.def.keyboard.popup.moveUp.description':
    'Mover el foco a la fila anterior. ArrowUp siempre está disponible como alias.',
  'workbench.settings.def.keyboard.popup.expandRow.label': 'Popup — Expandir / entrar en las subfilas',
  'workbench.settings.def.keyboard.popup.expandRow.description':
    'Expandir la fila con el foco. ArrowRight y Enter siempre están disponibles como alias.',
  'workbench.settings.def.keyboard.popup.collapseRow.label': 'Popup — Contraer / salir de las subfilas',
  'workbench.settings.def.keyboard.popup.collapseRow.description':
    'Contraer la fila con el foco. ArrowLeft siempre está disponible como alias.',
  'workbench.settings.def.keyboard.popup.toggleRow.label': 'Popup — Alternar la fila',
  'workbench.settings.def.keyboard.popup.toggleRow.description':
    'Activar o desactivar la regla con el foco. Por defecto: la barra espaciadora.',
  'workbench.settings.def.keyboard.popup.editRow.label': 'Popup — Editar la fila',
  'workbench.settings.def.keyboard.popup.editRow.description':
    'Abrir la regla con el foco en el editor del espacio de trabajo.',
  'workbench.settings.def.keyboard.popup.copyValue.label': 'Popup — Copiar el valor',
  'workbench.settings.def.keyboard.popup.copyValue.description':
    'Copiar el valor principal de la fila con el foco al portapapeles.',
  'workbench.settings.def.keyboard.popup.deleteRow.label': 'Popup — Eliminar la fila',
  'workbench.settings.def.keyboard.popup.deleteRow.description':
    'Preparar la eliminación de la fila con el foco. Pulsa de nuevo (o Enter) para confirmar.',
  'workbench.settings.def.keyboard.popup.addRule.label': 'Popup — Añadir regla',
  'workbench.settings.def.keyboard.popup.addRule.description': 'Crear una regla nueva desde el popup.',
  'workbench.settings.def.keyboard.popup.toggleRulesPause.label': 'Popup — Alternar la pausa de las reglas (global)',
  'workbench.settings.def.keyboard.popup.toggleRulesPause.description':
    'Pausar o reanudar todas las reglas de todas las colecciones.',
  'workbench.settings.def.keyboard.popup.togglePauseFocused.label':
    'Popup — Alternar la pausa (colección/carpeta con el foco)',
  'workbench.settings.def.keyboard.popup.togglePauseFocused.description':
    'Pausar o reanudar la colección o carpeta con el foco en la pestaña Colecciones. No tiene efecto sobre las ' +
    'filas de regla individuales — las reglas usan el conmutador de activación (Space).',
  'workbench.settings.def.keyboard.popup.cycleTheme.label': 'Popup — Cambiar de tema',
  'workbench.settings.def.keyboard.popup.cycleTheme.description':
    'Alternar entre los temas claro, oscuro y automático.',
  'workbench.settings.def.keyboard.popup.toggleCompactMode.label': 'Popup — Alternar el modo compacto',
  'workbench.settings.def.keyboard.popup.toggleCompactMode.description':
    'Cambiar el popup entre densidad compacta y cómoda.',
  'workbench.settings.def.keyboard.popup.openWorkspace.label': 'Popup — Abrir el espacio de trabajo',
  'workbench.settings.def.keyboard.popup.openWorkspace.description':
    'Abrir la pestaña completa del espacio de trabajo.',
  'workbench.settings.def.keyboard.popup.openSettings.label': 'Popup — Abrir la configuración',
  'workbench.settings.def.keyboard.popup.openSettings.description':
    'Abrir la página de configuración en una nueva pestaña del espacio de trabajo. Coincide con el atajo del ' +
    'espacio de trabajo.',
  'workbench.settings.def.keyboard.popup.tabThisPage.label': 'Popup — Pestaña Esta página',
  'workbench.settings.def.keyboard.popup.tabThisPage.description': 'Activar la pestaña de reglas «Esta página».',
  'workbench.settings.def.keyboard.popup.tabAllRules.label': 'Popup — Pestaña Todas las reglas',
  'workbench.settings.def.keyboard.popup.tabAllRules.description': 'Activar la pestaña «Todas las reglas».',
  'workbench.settings.def.keyboard.popup.tabCollections.label': 'Popup — Pestaña Colecciones',
  'workbench.settings.def.keyboard.popup.tabCollections.description': 'Activar la pestaña «Colecciones».',
  'workbench.settings.def.keyboard.popup.toggleSurface.label': 'Popup — Alternar la superficie (popup ↔ panel lateral)',
  'workbench.settings.def.keyboard.popup.toggleSurface.description':
    'Cambiar entre las disposiciones de popup y panel lateral desde el encabezado del popup.',
  'workbench.settings.def.keyboard.popup.openTourGuide.label': 'Popup — Abrir la visita guiada',
  'workbench.settings.def.keyboard.popup.openTourGuide.description':
    'Repetir la visita de bienvenida desde cualquier pestaña del popup.',
} as const satisfies Catalog;
