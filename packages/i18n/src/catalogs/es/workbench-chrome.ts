/**
 * Workbench chrome — the shell plane — Spanish. Mirrors
 * `catalogs/en/workbench-chrome.ts` key for key; extends the es
 * register contract (`es/shared.ts`). Reuses the es mints: `flujo de
 * actividad` + `paleta de comandos` + the shortcut action labels
 * (es/workbench-settings-defs-keyboard), the layout-menu wording
 * quoted verbatim from the shipped `es/panel.ts` twin (`Mostrar los
 * nombres de las ventanas de herramientas`, `Compacta (abajo
 * fijado)`, masculine {unit}/{units} per the chrome-workspace
 * precedent), rule-type nouns from the shipped `popup.ruleType.*`
 * set, pause/pin vocabulary (`fijar`; unpin = `Desfijar`, minted
 * here), circuit labels quoted from es/workbench-live (`Reintentar`,
 * `Restablecer el circuito`), header ops (`Añadir / Reemplazar`,
 * `Anexar`, `Quitar`, `Fusionar`), Override = `Sustituir`, peers =
 * `pares`, badge = `insignia`, pill = `píldora`, `ámbito` (variable
 * scope) vs `alcance` (debug reach) two-word law, «Sin entorno»
 * runtime quote (S57). MINTS: scratch = `provisional` (the sidebar
 * badge word as entity prefix); splitter = `divisor`, unsplit =
 * `Deshacer la división`; tier = `nivel` (settings-panes quote).
 * Raw by design: `Docs` / `Params` tab names (gRPC precedent), auth
 * scheme and body-mode enums (Basic, Bearer Token, Form data, raw,
 * GraphQL), Chrome ResourceType values (Page, Frame, Fetch/XHR,
 * Script), DNR / AND / DOM / L4 / L7 / TCP / TLS / RTT / regex /
 * `handshake` (m.), `workflow` / `workbench` / `shell` / `Vault` /
 * `Live` / `build` (m.) loanwords, footer key caps (↑↓ / ← / → / ↵ /
 * esc) and the {chord} / {unit} / {units} holes.
 */

import type { Catalog } from '../../types';

export const workbenchChrome = {
  // ── Tab strip: context menu ─────────────────────────────────────────
  'workbench.tabbar.menu.duplicateTab': 'Duplicar la pestaña',
  'workbench.tabbar.menu.close': 'Cerrar',
  'workbench.tabbar.menu.closeOther': 'Cerrar las demás pestañas',
  'workbench.tabbar.menu.closeAll': 'Cerrar todas las pestañas',
  'workbench.tabbar.menu.closeUnmodified': 'Cerrar las pestañas sin modificar',
  'workbench.tabbar.menu.closeLeft': 'Cerrar las pestañas a la izquierda',
  'workbench.tabbar.menu.closeRight': 'Cerrar las pestañas a la derecha',
  'workbench.tabbar.menu.splitAndMove': 'Dividir y mover',
  'workbench.tabbar.menu.right': 'A la derecha',
  'workbench.tabbar.menu.left': 'A la izquierda',
  'workbench.tabbar.menu.down': 'Abajo',
  'workbench.tabbar.menu.up': 'Arriba',
  'workbench.tabbar.menu.moveOpposite': 'Mover al grupo opuesto',
  'workbench.tabbar.menu.changeSplitterOrientation': 'Cambiar la orientación del divisor',
  'workbench.tabbar.menu.unsplit': 'Deshacer la división',
  'workbench.tabbar.menu.unsplitAll': 'Deshacer todas las divisiones',

  // ── Tab strip: close guard confirms (useTabLifecycle) ───────────────
  // The dialog bodies follow a bolded tab label in the JSX, so they key
  // as the sentence remainder (OnboardingTour bold-prefix idiom).
  'workbench.tabbar.closeGuard.unsavedTitle': '¿Guardar los cambios?',
  'workbench.tabbar.closeGuard.unsavedBody': 'tiene cambios sin guardar. Guárdalos para no perder tu trabajo.',
  'workbench.tabbar.closeGuard.dontSave': 'No guardar',
  'workbench.tabbar.closeGuard.cancel': 'Cancelar',
  'workbench.tabbar.closeGuard.save': 'Guardar los cambios',
  'workbench.tabbar.closeGuard.draftTitle': '¿Descartar el borrador?',
  'workbench.tabbar.closeGuard.draftBody':
    'aún no se ha publicado. Descartarlo elimina el borrador; conservarlo lo deja en tu barra lateral para ' +
    'terminarlo más tarde.',
  'workbench.tabbar.closeGuard.discard': 'Descartar',
  'workbench.tabbar.closeGuard.keep': 'Conservar como borrador',

  // ── Tab strip: bar chrome + search overlay ──────────────────────────
  'workbench.tabbar.createApiRequest': 'Crear una solicitud API',
  'workbench.tabbar.createItem': 'Crear elemento',
  'workbench.tabbar.searchTabs': 'Buscar en las pestañas',
  'workbench.tabbar.search.placeholder': 'Buscar en las pestañas...',
  'workbench.tabbar.search.noMatch': 'Ninguna pestaña abierta coincide con tu búsqueda',
  'workbench.tabbar.search.noOpenTabs': 'No hay pestañas abiertas',
  'workbench.tabbar.search.noClosedMatch': 'Ninguna pestaña cerrada coincide con tu búsqueda',
  'workbench.tabbar.search.recentlyClosed': 'Cerradas recientemente ({count})',
  'workbench.tabbar.search.recentlyClosedFiltered': 'Cerradas recientemente ({matched} de {total})',
  'workbench.tabbar.envPinnedAria': 'Entorno fijado',
  'workbench.tabbar.fromExample': 'desde «{name}»',

  // ── Scratch segment labels (tab tooltip + breadcrumb bar) ───────────
  'workbench.scratch.request': 'Solicitud provisional',
  'workbench.scratch.rule': 'Regla provisional',
  'workbench.scratch.variable': 'Variable provisional',
  'workbench.scratch.workflow': 'Workflow provisional',

  // ── Shell: command palette ──────────────────────────────────────────
  'workbench.shell.commandPalette.collectionsDivider': 'Colecciones',
  'workbench.shell.commandPalette.searchInGroup': 'Buscar en {name}...',
  'workbench.shell.commandPalette.placeholder': 'Busca reglas, colecciones o escribe > para los comandos...',
  'workbench.shell.commandPalette.noResults': 'No se encontraron resultados',
  'workbench.shell.commandPalette.emptyHint': 'Escribe para buscar o > para los comandos',
  'workbench.shell.commandPalette.footer.navigate': '↑↓ navegar',
  'workbench.shell.commandPalette.footer.back': '← atrás',
  'workbench.shell.commandPalette.footer.open': '→ abrir',
  'workbench.shell.commandPalette.footer.select': '↵ seleccionar',
  'workbench.shell.commandPalette.footer.close': 'esc cerrar',
  'workbench.shell.commandPalette.group.rules': 'Reglas',
  'workbench.shell.commandPalette.group.templates': 'Plantillas',
  'workbench.shell.commandPalette.group.requests': 'Solicitudes',
  'workbench.shell.commandPalette.group.systemTemplates': 'Plantillas de sistema',
  'workbench.shell.commandPalette.group.settings': 'Configuración',
  'workbench.shell.commandPalette.section.create': 'Crear',
  'workbench.shell.commandPalette.section.commands': 'Comandos',
  'workbench.shell.commandPalette.section.variables': 'Variables',
  'workbench.shell.commandPalette.cmd.createItem': 'Crear elemento...',
  'workbench.shell.commandPalette.cmd.newRuleType': 'Nueva {type}',
  'workbench.shell.commandPalette.cmd.toggleLeftSidebar': 'Alternar la barra lateral izquierda',
  'workbench.shell.commandPalette.cmd.toggleRightSidebar': 'Alternar la barra lateral derecha',
  'workbench.shell.commandPalette.cmd.toggleBottomPanel': 'Alternar el panel inferior',
  'workbench.shell.commandPalette.cmd.toggleActivityFeed': 'Alternar el flujo de actividad',
  'workbench.shell.commandPalette.cmd.keyboardShortcuts': 'Atajos de teclado',
  'workbench.shell.commandPalette.cmd.openSettings': 'Abrir la configuración',
  'workbench.shell.commandPalette.cmd.openWorkspaceVariables': 'Abrir las variables del espacio de trabajo',
  'workbench.shell.commandPalette.cmd.openVault': 'Abrir el Vault',
  'workbench.shell.commandPalette.cmd.openLiveVariables': 'Abrir las variables Live',
  'workbench.shell.commandPalette.cmd.openPackageLibrary': 'Abrir la biblioteca de paquetes',
  'workbench.shell.commandPalette.cmd.openEnvironment': 'Abrir el entorno: {name}',

  // ── Shell: top bar (search button, layout menu, panel toggles) ──────
  'workbench.shell.topbar.search': 'Busca o ejecuta un comando...',
  'workbench.shell.topbar.layout.bottomAlignment': 'Alineación del panel inferior',
  'workbench.shell.topbar.layout.alignCenter': 'Centrado (anidado)',
  'workbench.shell.topbar.layout.alignLeft': 'Izquierda',
  'workbench.shell.topbar.layout.alignRight': 'Derecha',
  'workbench.shell.topbar.layout.alignJustify': 'Justificado (ancho completo)',
  'workbench.shell.topbar.layout.showToolWindowNames': 'Mostrar los nombres de las ventanas de herramientas',
  'workbench.shell.topbar.layout.activityBarLayout': 'Disposición de la barra de actividad',
  'workbench.shell.topbar.layout.sidebarProportional': 'Proporcional (mitades iguales)',
  'workbench.shell.topbar.layout.sidebarCompact': 'Compacta (abajo fijado)',
  'workbench.shell.topbar.layout.sidebarStacked': 'Apilada (todo arriba)',
  'workbench.shell.topbar.layout.sidebarDynamic': 'Dinámica (sigue las alturas de los paneles)',
  'workbench.shell.topbar.layout.defaultLayoutDonor': '{unit} de disposición predeterminada',
  'workbench.shell.topbar.layout.inheritsDefault': 'Hereda la disposición predeterminada',
  'workbench.shell.topbar.layout.donorTooltip':
    'Este {unit} es el predeterminado — los nuevos {units} heredan esta disposición.',
  'workbench.shell.topbar.layout.nonDonorTooltip':
    'Otro {unit} es el predeterminado — los nuevos {units} heredan de allí.',
  'workbench.shell.topbar.layout.resetToDefaults': 'Restablecer la disposición predeterminada',
  'workbench.shell.topbar.layout.restoreHidden': 'Restaurar las herramientas ocultas de la barra de actividad',
  'workbench.shell.topbar.toggle.leftSidebar': 'Barra lateral izquierda',
  'workbench.shell.topbar.toggle.bottomPanel': 'Panel inferior',
  'workbench.shell.topbar.toggle.rightSidebar': 'Barra lateral derecha',
  'workbench.shell.topbar.bottomAlign.center': 'Panel inferior: centrado (anidado)',
  'workbench.shell.topbar.bottomAlign.left': 'Panel inferior: alineado a la izquierda',
  'workbench.shell.topbar.bottomAlign.right': 'Panel inferior: alineado a la derecha',
  'workbench.shell.topbar.bottomAlign.justify': 'Panel inferior: ancho completo',
  'workbench.shell.topbar.bottomAlign.chooseAria': 'Elegir la alineación del panel inferior',
  'workbench.shell.topbar.layoutOptions': 'Opciones de disposición',

  // ── Shell: status bar ───────────────────────────────────────────────
  'workbench.shell.statusbar.theme.light': 'Claro',
  'workbench.shell.statusbar.theme.dark': 'Oscuro',
  'workbench.shell.statusbar.theme.auto': 'Auto',
  'workbench.shell.statusbar.systemStatus': 'Estado del sistema',

  // ── Shell: activity bar ─────────────────────────────────────────────
  'workbench.shell.activityBar.hideLabels': 'Ocultar las etiquetas',
  'workbench.shell.activityBar.showLabels': 'Mostrar las etiquetas',

  // ── Shell: editor empty state ───────────────────────────────────────
  'workbench.shell.empty.createRule': 'Crear regla',
  'workbench.shell.empty.createRuleDesc': 'Encabezados, redirecciones, bloqueo y más',
  'workbench.shell.empty.createVariable': 'Crear variable',
  'workbench.shell.empty.createVariableDesc': 'Entorno, espacio de trabajo, live y más',
  'workbench.shell.empty.createRequest': 'Crear solicitud API',
  'workbench.shell.empty.createRequestDesc': 'Construye, envía y guarda solicitudes HTTP',
  'workbench.shell.empty.createWorkflow': 'Crear workflow',
  'workbench.shell.empty.createWorkflowDesc': 'Encadena y programa solicitudes API',
  'workbench.shell.empty.import': 'Importar',
  'workbench.shell.empty.importDesc': 'Curl, HAR, Postman y más',
  'workbench.shell.empty.migrate': 'Migrar desde otra herramienta',
  'workbench.shell.empty.migrateDesc': 'Trae tus datos de Postman, Insomnia o Bruno',
  'workbench.shell.empty.browseTemplates': 'Explorar todas las plantillas…',
  'workbench.shell.empty.varEnvironment': 'Variable de entorno',
  'workbench.shell.empty.varWorkspace': 'Variable del espacio de trabajo',
  'workbench.shell.empty.varLive': 'Variable live',
  'workbench.shell.empty.varVault': 'Secreto del vault',
  'workbench.shell.empty.varCollection': 'Variable de colección',
  'workbench.shell.empty.varCollectionTooltip': 'Las variables de colección se crean desde dentro de una colección.',

  // ── Shell: environment selector ─────────────────────────────────────
  'workbench.shell.envSelector.noEnvironment': 'Sin entorno',
  'workbench.shell.envSelector.defaultPill': 'POR DEFECTO',
  'workbench.shell.envSelector.defaultTooltip':
    'El entorno por defecto se selecciona automáticamente mientras trabajas con la colección.',
  'workbench.shell.envSelector.openEnv': 'Abrir {name}',
  'workbench.shell.envSelector.pinToTab': 'Fijar a esta pestaña',
  'workbench.shell.envSelector.unpinFromTab': 'Desfijar de esta pestaña',
  'workbench.shell.envSelector.pinToTabDesc': 'Cambia a este entorno cada vez que la pestaña recibe el foco.',
  'workbench.shell.envSelector.pinToCollection': 'Fijar a la colección',
  'workbench.shell.envSelector.unpinFromCollection': 'Desfijar de la colección',
  'workbench.shell.envSelector.pinToCollectionDesc': 'Muestra este entorno en la lista de fijados de la colección.',
  'workbench.shell.envSelector.pinAria': 'Fijar el entorno',
  'workbench.shell.envSelector.setCollectionDefault': 'Definir como por defecto de la colección',
  'workbench.shell.envSelector.clearCollectionDefault': 'Quitar el por defecto de la colección',
  'workbench.shell.envSelector.searchPlaceholder': 'Buscar entornos…',
  'workbench.shell.envSelector.modeLabel': 'Modo: {mode}',
  'workbench.shell.envSelector.switchBehavior.title': 'Al cambiar entre colecciones',
  'workbench.shell.envSelector.switchBehavior.keep': 'Mantener el entorno seleccionado',
  'workbench.shell.envSelector.switchBehavior.keepDesc':
    'Tu selección se mantiene a través de las colecciones y de todo lo que contienen.',
  'workbench.shell.envSelector.switchBehavior.applyDefaults': 'Aplicar los valores por defecto de las colecciones',
  'workbench.shell.envSelector.switchBehavior.applyDefaultsDesc':
    'Los valores por defecto toman el mando mientras estás dentro. Tu última elección manual se restaura en el ' +
    'resto.',
  'workbench.shell.envSelector.switchBehavior.follow': 'Seguir cada colección',
  'workbench.shell.envSelector.switchBehavior.followDesc':
    'Las colecciones que tienen un entorno por defecto cambian a él (y recuerdan tus elecciones). Las demás no ' +
    'cambian.',
  'workbench.shell.envSelector.switchBehavior.aria': 'Comportamiento al cambiar de entorno',
  'workbench.shell.envSelector.pinnedBanner': 'Fijado a la pestaña actual — elegir un entorno mueve la fijación.',
  'workbench.shell.envSelector.unpin': 'Desfijar',
  'workbench.shell.envSelector.createNew': 'Crear un entorno nuevo',
  'workbench.shell.envSelector.pinnedSection': 'Fijados a esta colección',
  'workbench.shell.envSelector.othersSection': 'Otros entornos',
  'workbench.shell.envSelector.noMatches': 'Ningún entorno coincidente',
  'workbench.shell.envSelector.footer.vault': 'Vault',
  'workbench.shell.envSelector.footer.collection': 'Colección',
  'workbench.shell.envSelector.footer.workspace': 'Espacio de trabajo',
  'workbench.shell.envSelector.footer.live': 'Live',
  'workbench.shell.envSelector.triggerAriaActive': 'Entorno activo: {name}',
  'workbench.shell.envSelector.triggerAriaActivePinned': 'Entorno activo: {name} (fijado por esta pestaña)',
  'workbench.shell.envSelector.triggerAriaNone': 'Ningún entorno seleccionado',
  'workbench.shell.envSelector.triggerAriaNonePinned': 'Ningún entorno seleccionado (fijado por esta pestaña)',

  // ── Shell: breadcrumb root nouns ────────────────────────────────────
  'workbench.shell.breadcrumbs.settings': 'Configuración',
  'workbench.shell.breadcrumbs.whatsNew': 'Novedades',
  'workbench.shell.breadcrumbs.workspaces': 'Espacios de trabajo',
  'workbench.shell.breadcrumbs.daemonAdmin': 'Administración del daemon',
  'workbench.shell.breadcrumbs.environments': 'Entornos',
  'workbench.shell.breadcrumbs.specs': 'Especificaciones',
  'workbench.shell.breadcrumbs.workspaceVariables': 'Variables del espacio de trabajo',
  'workbench.shell.breadcrumbs.vault': 'Vault',
  'workbench.shell.breadcrumbs.packageLibrary': 'Biblioteca de paquetes',
  'workbench.shell.breadcrumbs.rules': 'Reglas',
  'workbench.shell.breadcrumbs.requests': 'Solicitudes',
  'workbench.shell.breadcrumbs.templates': 'Plantillas',
  'workbench.shell.breadcrumbs.variables': 'Variables',
  'workbench.shell.breadcrumbs.apiRequests': 'Solicitudes API',
  'workbench.shell.breadcrumbs.workflows': 'Workflows',
  'workbench.shell.breadcrumbs.liveVariables': 'Variables Live',

  // ── Shell: fallback entity labels ───────────────────────────────────
  'workbench.shell.fallback.workflow': 'Workflow',
  'workbench.shell.fallback.template': 'Plantilla',
  'workbench.shell.fallback.environment': 'Entorno',

  // ── Shell: tab-label compositions + draft seeds. Singleton tab
  // labels resolve live through the breadcrumb root nouns; only copy
  // with no breadcrumb twin lives here. Draft seeds persist as entity
  // names BY DESIGN (V5 fresh start) — keyed at mint time. ────────────
  'workbench.shell.tabLabel.collectionVariables': '{name} · Variables',
  'workbench.shell.tabLabel.collectionScripts': '{name} · Scripts',
  'workbench.shell.tabLabel.collectionAuth': '{name} · Autorización',
  'workbench.shell.tabLabel.newRequest': 'Nueva solicitud',
  'workbench.shell.tabLabel.newGrpcRequest': 'Nueva solicitud gRPC',
  'workbench.shell.tabLabel.newWebSocketRequest': 'Nueva solicitud WebSocket',
  'workbench.shell.tabLabel.newSocketIoRequest': 'Nueva solicitud Socket.IO',
  'workbench.shell.tabLabel.newWorkflow': 'Nuevo workflow',
  'workbench.shell.tabLabel.newLiveVariable': 'Nueva variable live',

  // ── Shell: App glue — workspace-switch toast, dirty-close confirm,
  // create-flow toasts. `{unit}` interpolates the host-vocabulary
  // instance noun (tab / window). ─────────────────────────────────────
  'workbench.shell.appGlue.switchedTo': 'Este {unit} ha cambiado a',
  'workbench.shell.appGlue.andMadeActive': ' y lo ha activado',
  'workbench.shell.appGlue.discardTitle': '¿Descartar los borradores sin guardar?',
  'workbench.shell.appGlue.discardBody':
    'Cambiar de espacio de trabajo cerrará las pestañas del editor con cambios sin guardar.',
  'workbench.shell.appGlue.discardOk': 'Cambiar y descartar',
  'workbench.shell.appGlue.cancel': 'Cancelar',
  'workbench.shell.toast.createEnvironmentFailed': 'No se pudo crear el entorno',
  'workbench.shell.toast.noActiveWorkspace': 'No hay espacio de trabajo activo',
  'workbench.shell.toast.createRuleFailed': 'No se pudo crear la regla',

  // ── Save: collection modal chrome ───────────────────────────────────
  'workbench.save.title': 'GUARDAR',
  'workbench.save.newFolder': 'Nueva carpeta',
  'workbench.save.newFolderTooltip': 'Nueva carpeta ({chord})',
  'workbench.save.newCollection': 'Nueva colección',
  'workbench.save.newCollectionTooltip': 'Nueva colección ({chord})',
  'workbench.save.cancel': 'Cancelar',
  'workbench.save.save': 'Guardar',
  'workbench.save.selectCollectionFirst': 'Selecciona primero una colección',
  'workbench.save.enterName': 'Introduce un nombre',
  'workbench.save.saveWithChord': 'Guardar ({chord})',
  'workbench.save.footer.navigate': '↑↓ navegar',
  'workbench.save.footer.open': '→ abrir',
  'workbench.save.footer.back': '← atrás',
  'workbench.save.footer.new': '{chord} nuevo',
  'workbench.save.footer.save': '{chord} guardar',
  'workbench.save.footer.close': 'esc cerrar',
  'workbench.save.nameLabel': 'Nombre',
  'workbench.save.saveTo': 'Guardar en ',
  'workbench.save.rootCrumb': 'Reglas locales',
  'workbench.save.searchFolders': 'Buscar carpetas',
  'workbench.save.searchCollections': 'Buscar una colección',
  'workbench.save.nameYourCollection': 'Ponle nombre a tu colección',
  'workbench.save.create': 'Crear',
  'workbench.save.noCollections': 'Aún no hay colecciones.',
  'workbench.save.noMatchingCollections': 'No hay colecciones coincidentes.',
  'workbench.save.createCollection': 'Crear colección',
  'workbench.save.orPressPrefix': 'o pulsa',
  'workbench.save.nameYourFolder': 'Ponle nombre a tu carpeta',
  'workbench.save.folderEmpty': 'Esta carpeta está vacía.',
  'workbench.save.collectionEmpty': 'Esta colección está vacía.',
  'workbench.save.pressPrefix': 'Pulsa',
  'workbench.save.pressMiddle': 'para guardar aquí, o',
  'workbench.save.pressSuffix': 'para una carpeta nueva.',

  // ── Save: as-template step ──────────────────────────────────────────
  'workbench.save.template.title': 'Guardar como plantilla de usuario',
  'workbench.save.template.next': 'Siguiente',
  'workbench.save.template.intro': 'Guarda la configuración actual de {type} como una plantilla reutilizable.',
  'workbench.save.template.iconLabel': 'Icono',
  'workbench.save.template.nameLabel': 'Nombre *',
  'workbench.save.template.namePlaceholder': 'El nombre de mi plantilla',
  'workbench.save.template.descriptionLabel': 'Descripción',
  'workbench.save.template.descriptionPlaceholder': '¿Qué hace esta plantilla? (opcional)',
  'workbench.save.template.includeConditions': 'Incluir las condiciones',
  'workbench.save.template.includeActions': 'Incluir las acciones',
  'workbench.save.template.ruleFallback': 'Regla',

  // ── Save: per-surface rule-type vocabulary ──────────────────────────
  'workbench.save.ruleType.header': 'Encabezado',
  'workbench.save.ruleType.block': 'Bloquear',
  'workbench.save.ruleType.redirect': 'Redirigir',
  'workbench.save.ruleType.queryParam': 'Parámetro de consulta',
  'workbench.save.ruleType.inject': 'Inyectar',
  'workbench.save.ruleType.delay': 'Retraso',
  'workbench.save.ruleType.requestBody': 'Cuerpo de solicitud API',
  'workbench.save.ruleType.response': 'Respuesta API',

  // ── Shell: rule-type entity names ('New {name}' draft seeds, command
  //    palette scope column + New-rule rows). Draft names persist as
  //    entity names — keyed at mint time (V5 fresh start, no back-compat). ─
  'workbench.shell.ruleTypeName.header': 'Regla de encabezado',
  'workbench.shell.ruleTypeName.block': 'Regla de bloqueo',
  'workbench.shell.ruleTypeName.redirect': 'Regla de redirección',
  'workbench.shell.ruleTypeName.queryParam': 'Regla de parámetro de consulta',
  'workbench.shell.ruleTypeName.inject': 'Regla de inyección',
  'workbench.shell.ruleTypeName.delay': 'Regla de retraso',
  'workbench.shell.ruleTypeName.requestBody': 'Regla de cuerpo de solicitud API',
  'workbench.shell.ruleTypeName.response': 'Regla de respuesta API',
  'workbench.shell.ruleTypeName.ws': 'Regla WebSocket',
  'workbench.shell.ruleTypeName.sse': 'Regla SSE',
  'workbench.shell.ruleTypeName.fallback': 'Regla',
  'workbench.shell.ruleTypeName.draftName': 'Nueva {name}',

  // ── Tool-window registry (activity bars, dock tab strips, restore
  //    rows, drag previews) ───────────────────────────────────────────
  'workbench.toolWindows.httpRules': 'Reglas HTTP',
  'workbench.toolWindows.apiRequests': 'Solicitudes API',
  'workbench.toolWindows.workflows': 'Workflows',
  'workbench.toolWindows.notifications': 'Notificaciones',
  'workbench.toolWindows.docs': 'Docs',
  'workbench.toolWindows.varScope': 'Ámbito de las variables',
  'workbench.toolWindows.variables': 'Variables',
  'workbench.toolWindows.workflowStatus': 'Estado de los workflows',
  'workbench.toolWindows.activity': 'Actividad',
  'workbench.toolWindows.activityTooltip': 'Flujo de actividad — cambios entrantes de los pares',
  'workbench.toolWindows.deepNetworkInspection': 'Inspección profunda de red',
  'workbench.toolWindows.terminal': 'Terminal',

  // ── Tool-window `(i)` info popovers. `{{live.*}}` / `{{name}}`
  //    reference chips compose raw in JSX between the keyed prefix/
  //    suffix fragments; the Notifications entry stays on the shared
  //    NOTIFICATIONS_PANEL_INFO corpus (panel co-consumer, Phase D). ───
  'workbench.toolWindows.info.httpRules.summary':
    'Crea reglas que reescriben las solicitudes salientes y las respuestas entrantes. Las reglas viven en ' +
    'colecciones y pueden inyectar valores desde las variables, el vault y los workflows live.',
  'workbench.toolWindows.info.httpRules.ruleTypesHeading': 'Tipos de reglas',
  'workbench.toolWindows.info.workflows.summaryPrefix':
    'Un productor de variables con actualización programada: una cadena de solicitudes más una regla de ' +
    'extracción. Su salida aparece como una referencia',
  'workbench.toolWindows.info.workflows.summarySuffix': 'utilizable allí donde se acepte una variable.',
  'workbench.toolWindows.info.docs.summary':
    'Documentación integrada para las reglas, las variables, los workflows y el propio workbench — consulta ' +
    'sin salir de la aplicación.',
  'workbench.toolWindows.info.varScope.summaryPrefix':
    'Las variables que referencia la pestaña activa y cada ámbito contra el que se resuelven. Una referencia ' +
    'simple',
  'workbench.toolWindows.info.varScope.summaryMiddle':
    'recae por el orden de prioridad de abajo; las referencias con espacio de nombres como',
  'workbench.toolWindows.info.varScope.summarySuffix': 'apuntan directamente a un solo ámbito.',
  'workbench.toolWindows.info.varScope.priorityHeading': 'Orden de prioridad',
  'workbench.toolWindows.info.varScope.vaultLabel': 'Vault',
  'workbench.toolWindows.info.varScope.vaultDesc': 'Secretos por usuario, nunca sincronizados — la prioridad más alta.',
  'workbench.toolWindows.info.varScope.environmentLabel': 'Entorno',
  'workbench.toolWindows.info.varScope.environmentDesc': 'El entorno activo, que recae en el entorno por defecto.',
  'workbench.toolWindows.info.varScope.collectionLabel': 'Colección',
  'workbench.toolWindows.info.varScope.collectionDesc': 'La colección de la entidad activa.',
  'workbench.toolWindows.info.varScope.workspaceLabel': 'Espacio de trabajo',
  'workbench.toolWindows.info.varScope.workspaceDesc':
    'Compartidas por todo el espacio de trabajo — la prioridad más baja.',
  'workbench.toolWindows.info.varScope.namespacedHeading': 'Con espacio de nombres',
  'workbench.toolWindows.info.varScope.liveLabel': 'Live',
  'workbench.toolWindows.info.varScope.liveDescPrefix': 'Respaldadas por un workflow; accesibles solo vía',
  'workbench.toolWindows.info.varScope.liveDescSuffix': ', resueltas desde la última ejecución.',
  'workbench.toolWindows.info.variables.summary':
    'El catálogo de variables — todo lo definido en los entornos, las colecciones, el espacio de trabajo y el ' +
    'vault. Usa Ámbito para ver qué está realmente en ámbito para la pestaña activa.',
  'workbench.toolWindows.info.variables.typesHeading': 'Tipos de variables',
  'workbench.toolWindows.info.variables.vaultDesc':
    'Secretos por usuario — almacenados localmente, nunca sincronizados.',
  'workbench.toolWindows.info.variables.environmentDesc': 'Definidas por entorno; el activo aporta los valores.',
  'workbench.toolWindows.info.variables.collectionDesc':
    'Definidas en una colección; se aplican a las entidades que contiene.',
  'workbench.toolWindows.info.variables.workspaceDesc': 'Compartidas por todo el espacio de trabajo.',
  'workbench.toolWindows.info.variables.liveDescPrefix': 'Valores producidos por workflows, referenciados como',
  'workbench.toolWindows.info.variables.liveDescSuffix': '.',
  'workbench.toolWindows.info.apiRequests.summary':
    'Las solicitudes API guardadas y los entornos contra los que se ejecutan, organizados en colecciones y ' +
    'carpetas.',
  'workbench.toolWindows.info.apiRequests.editorHeading': 'Editor de solicitudes',
  'workbench.toolWindows.info.apiRequests.docsLabel': 'Docs',
  'workbench.toolWindows.info.apiRequests.docsDesc': 'Notas libres para la solicitud — admite Markdown.',
  'workbench.toolWindows.info.apiRequests.paramsLabel': 'Params',
  'workbench.toolWindows.info.apiRequests.paramsDesc': 'Parámetros de consulta anexados a la URL de la solicitud.',
  'workbench.toolWindows.info.apiRequests.authorizationLabel': 'Autorización',
  'workbench.toolWindows.info.apiRequests.authorizationDesc':
    'Heredar del padre, Basic, Bearer Token, API Key u OAuth 2.0 — se aplica al enviar.',
  'workbench.toolWindows.info.apiRequests.headersLabel': 'Encabezados',
  'workbench.toolWindows.info.apiRequests.headersDesc':
    'Encabezados de la solicitud, con las referencias a variables resueltas al enviar.',
  'workbench.toolWindows.info.apiRequests.bodyLabel': 'Cuerpo',
  'workbench.toolWindows.info.apiRequests.bodyDesc':
    'Form data, URL-encoded, raw (Text, JavaScript, JSON, HTML, XML) o GraphQL.',
  'workbench.toolWindows.info.apiRequests.scriptsLabel': 'Scripts',
  'workbench.toolWindows.info.apiRequests.scriptsDesc': 'Hooks de JavaScript pre-solicitud y post-respuesta.',
  'workbench.toolWindows.info.apiRequests.settingsLabel': 'Configuración',
  'workbench.toolWindows.info.apiRequests.settingsDesc':
    'Comportamiento por solicitud — verificación SSL, redirecciones y más.',
  'workbench.toolWindows.info.deepNetworkInspection.summary':
    'Inspección a nivel de conexión (L4) y HTTP (L7) en una sola vista — salud TCP/TLS (RTT, retransmisiones ' +
    'y tiempos del handshake) junto a visibilidad, modificación y repetición completas de las ' +
    'solicitudes/respuestas.',
  'workbench.toolWindows.info.workflowStatus.summary':
    'Panel de control del disyuntor por workflow — estado, fallos consecutivos, aperturas y cuenta atrás del ' +
    'siguiente intento, con las acciones manuales Reintentar y Restablecer el circuito.',
  'workbench.toolWindows.info.activity.summary':
    'Flujo de cambios entrantes de los pares a escala del espacio de trabajo, con realces del clasificador ' +
    'para rotaciones de campos sensibles, ampliaciones de ámbito de permisos y supersesiones de ediciones ' +
    'locales.',
  'workbench.terminal.sessionEnded': 'Sesión finalizada',
  'workbench.terminal.restart': 'Reiniciar el shell',
  'workbench.terminal.tabLocal': 'Local',
  'workbench.terminal.tabLocalN': 'Local ({n})',
  'workbench.terminal.newTab': 'Nueva pestaña de terminal',
  'workbench.terminal.newTabWithProfile': 'Nueva pestaña desde un perfil',
  'workbench.terminal.closeTab': 'Cerrar pestaña',
  'workbench.terminal.openTui': 'Abrir el modo TUI',
  'workbench.terminal.closeConfirm.title': 'Proceso en ejecución',
  'workbench.terminal.closeConfirm.bodyPrefix': 'Todavía se está ejecutando un proceso en ',
  'workbench.terminal.closeConfirm.bodySuffix': '. ¿Terminarlo?',
  'workbench.terminal.closeConfirm.ok': 'Terminar',
  'workbench.terminal.closeConfirm.bodyMany':
    'Todavía se están ejecutando procesos en {count} de las pestañas que se van a cerrar. ¿Terminarlos?',
  'workbench.terminal.menu.rename': 'Renombrar',
  'workbench.terminal.rename.title': 'Renombrar pestaña',
  'workbench.terminal.settings': 'Configuración',
  'workbench.terminal.cliGate.title': 'Conectar la CLI de OpenHeaders',
  'workbench.terminal.cliGate.body':
    'El modo TUI funciona con la herramienta de línea de comandos oh, que aún no está conectada a esta aplicación.',
  'workbench.terminal.cliGate.bodyInfo.title': 'Conexión de la CLI',
  'workbench.terminal.cliGate.bodyInfo.summary':
    'Conectar crea un token de acceso y lo escribe en {path}. La CLI oh lee ese archivo para autenticarse ' +
    'ante el daemon local — después de conectar, oh funciona en cualquier terminal de esta máquina. ' +
    'Cancelar no crea ningún token.',
  'workbench.terminal.cliGate.enableMcp': 'Activar el servidor MCP',
  'workbench.terminal.cliGate.enableMcpInfo.title': 'Servidor MCP',
  'workbench.terminal.cliGate.enableMcpInfo.summary':
    'oh se conecta a esta aplicación a través del endpoint /mcp del daemon (Model Context Protocol sobre ' +
    'HTTP en streaming). El ajuste mcp.enabled controla ese endpoint — mientras está desactivado devuelve ' +
    '404 y la TUI informa de que el daemon es inalcanzable. Desmarca para crear solo el token.',
  'workbench.terminal.cliGate.ok': 'Conectar y abrir',
  'workbench.terminal.cliGate.openSettings': 'Abrir la configuración',
  'workbench.toolWindows.info.terminal.summary':
    'Un terminal integrado que ejecuta tu shell en un pty real — todo lo que puedas ejecutar en un terminal ' +
    'independiente funciona aquí, incluida la CLI oh contra la aplicación local.',

  // ── Deep Network Inspection placeholder panel. The sample connection
  // feed (TCP/TLS lines, HPACK fields, stat figures) and the tier
  // roadmap's quoted scenario copy ride raw as illustration data —
  // only the panel chrome keys here. ──────────────────────────────────
  'workbench.deepNetwork.comingSoon': 'PRÓXIMAMENTE — APLICACIÓN DE ESCRITORIO',
  'workbench.deepNetwork.heading': 'Inspección de conexión (L4) + HTTP (L7)',
  'workbench.deepNetwork.description':
    'La salud de la conexión y el HTTP completo en una sola vista — las capas sobre las que realmente actúas, ' +
    'fáciles de inspeccionar y modificar. Aún no está activo; abajo se muestran datos de ejemplo.',
  'workbench.deepNetwork.viewTiers': 'Hoja de ruta de niveles',
  'workbench.deepNetwork.viewConnection': 'Vista de conexión',
  'workbench.deepNetwork.stats': 'Estadísticas',
  'workbench.deepNetwork.rowSolves': 'Resuelve',
  'workbench.deepNetwork.rowTrust': 'Confianza requerida',
  'workbench.deepNetwork.rowPower': 'Potencia',
  'workbench.deepNetwork.rowFriction': 'Fricción',
  'workbench.deepNetwork.wall': 'Te topas con un muro:',

  // ── Shared markdown widgets (toolbar + highlighted code block) ──────
  'workbench.markdown.heading': 'Título',
  'workbench.markdown.bold': 'Negrita',
  'workbench.markdown.italic': 'Cursiva',
  'workbench.markdown.strikethrough': 'Tachado',
  'workbench.markdown.codeBlock': 'Bloque de código',
  'workbench.markdown.link': 'Enlace',
  'workbench.markdown.bulletedList': 'Lista con viñetas',
  'workbench.markdown.numberedList': 'Lista numerada',
  'workbench.markdown.table': 'Tabla',
  'workbench.markdown.copyCode': 'Copiar el código',
  'workbench.markdown.copied': 'Copiado',

  // ── Two-tone icon picker ────────────────────────────────────────────
  'workbench.iconPicker.searchPlaceholder': 'Buscar iconos...',

  // ── Template editor ─────────────────────────────────────────────────
  'workbench.templateEditor.toast.saved': 'Plantilla guardada',
  'workbench.templateEditor.toast.saveFailed': 'No se pudo guardar la plantilla',
  'workbench.templateEditor.notFound': 'Plantilla no encontrada',
  'workbench.templateEditor.namePlaceholder': 'Nombre de la plantilla',
  'workbench.templateEditor.descriptionPlaceholder': 'Descripción (opcional)',
  'workbench.templateEditor.includeConditions': 'Incluir las condiciones',
  'workbench.templateEditor.includeActions': 'Incluir las acciones',
  'workbench.templateEditor.conditionsTitle': 'Condiciones',

  // ── What's New tab ──────────────────────────────────────────────────
  'workbench.whatsNew.title': 'Novedades de Open Headers {version}',
  'workbench.whatsNew.noNotes': 'Este build se distribuye sin notas de la versión.',

  // ── Keyboard shortcuts: SHORTCUTS registry action names + the docs
  // cheatsheet chrome around them. Chords, key caps (?, ⌘, Ctrl) and
  // the regions diagram internals stay raw. ──────────────────────────
  'workbench.shortcuts.action.toggleLeftSidebar': 'Alternar la barra lateral izquierda',
  'workbench.shortcuts.action.toggleRightSidebar': 'Alternar la barra lateral derecha',
  'workbench.shortcuts.action.toggleBottomPanel': 'Alternar el panel inferior',
  'workbench.shortcuts.action.toggleActivityFeed': 'Alternar el flujo de actividad',
  'workbench.shortcuts.action.terminalNewTab': 'Nueva pestaña de terminal',
  'workbench.shortcuts.action.closeTab': 'Cerrar la pestaña',
  'workbench.shortcuts.action.newTab': 'Nueva pestaña',
  'workbench.shortcuts.action.prevTab': 'Pestaña anterior',
  'workbench.shortcuts.action.nextTab': 'Pestaña siguiente',
  'workbench.shortcuts.action.tabSearch': 'Buscar en las pestañas',
  'workbench.shortcuts.action.commandPalette': 'Paleta de comandos',
  'workbench.shortcuts.action.focusFilter': 'Enfocar el filtro de la sección activa',
  'workbench.shortcuts.action.focusLeftSidebar': 'Enfocar la barra lateral izquierda',
  'workbench.shortcuts.action.focusEditor': 'Enfocar el editor',
  'workbench.shortcuts.action.focusRightSidebar': 'Enfocar la barra lateral derecha',
  'workbench.shortcuts.action.focusBottomPanel': 'Enfocar el panel inferior',
  'workbench.shortcuts.action.save': 'Guardar',
  'workbench.shortcuts.action.newRule': 'Crear elemento',
  'workbench.shortcuts.action.import': 'Importar',
  'workbench.shortcuts.action.showShortcuts': 'Atajos de teclado',
  'workbench.shortcuts.action.openSettings': 'Abrir la configuración',
  'workbench.shortcuts.action.find': 'Buscar en el editor',
  'workbench.shortcuts.action.replace': 'Reemplazar en el editor',
  'workbench.shortcuts.action.formatCode': 'Formatear el código',
  'workbench.shortcuts.category.panels': 'Paneles',
  'workbench.shortcuts.category.tabs': 'Pestañas',
  'workbench.shortcuts.category.navigation': 'Navegación',
  'workbench.shortcuts.category.actions': 'Acciones',
  'workbench.shortcuts.allSurfacesTitle': 'Todas las superficies',
  'workbench.shortcuts.toggleDebugMode': 'Alternar el modo de depuración',
  'workbench.shortcuts.goToTab': 'Ir a la pestaña 1–9 (9 = la última)',
  'workbench.shortcuts.introPrefix': 'Pulsa',
  'workbench.shortcuts.introMiddle': 'en cualquier momento para saltar aquí. Los atajos usan',
  'workbench.shortcuts.introSuffix': 'como tecla modificadora.',
  'workbench.shortcuts.regionsCaption': 'Cuatro combinaciones colocan tu foco en una de las cuatro regiones del shell.',

  // ── Docs navigator plane: group labels + section titles/summaries
  // from the workbench DOC_GROUPS registry (raw-or-key DocSection
  // idiom). Section body corpus + diagrams are their own station. ────
  'workbench.docs.nav.group.openHeaders': 'Open Headers',
  'workbench.docs.nav.group.concepts': 'Conceptos',
  'workbench.docs.nav.group.modifyRequests': 'Modificar solicitudes',
  'workbench.docs.nav.group.modifyResponses': 'Modificar respuestas',
  'workbench.docs.nav.group.runCode': 'Ejecutar código',
  'workbench.docs.nav.group.reference': 'Referencia',
  'workbench.docs.nav.paradigm.title': 'Qué hacemos (de forma diferente)',
  'workbench.docs.nav.paradigm.summary':
    'Una extensión de navegador que hace lo que antes exigía un proxy, un binario de escritorio o una cuenta ' +
    'en la nube.',
  'workbench.docs.nav.comparison.title': 'Cómo nos comparamos',
  'workbench.docs.nav.comparison.summary':
    'Cómo se sitúa Open Headers frente a las plataformas en la nube, los proxies de escritorio y las ' +
    'extensiones de solo encabezados.',
  'workbench.docs.nav.roadmap.title': 'Cada superficie, entregada',
  'workbench.docs.nav.roadmap.summary':
    'Los hitos entregados — espacios de trabajo Git, aplicación de escritorio, servidor MCP, daemon, CLI, ' +
    'aplicación web, importadores.',
  'workbench.docs.nav.conditions.title': 'Condiciones',
  'workbench.docs.nav.conditions.summary':
    'Filtros de coincidencia AND que condicionan cada regla — dominios, patrones de URL, métodos, encabezados.',
  'workbench.docs.nav.actions.title': 'Acciones',
  'workbench.docs.nav.actions.summary':
    'La mitad «hacer» de una regla — modificar la solicitud, modificar la respuesta o ejecutar código. Se ' +
    'combina con las condiciones.',
  'workbench.docs.nav.variables.title': 'Variables',
  'workbench.docs.nav.variables.summary':
    'Cinco ámbitos de variables — vault, entorno, colección, espacio de trabajo, live — y cómo se resuelven ' +
    'las referencias.',
  'workbench.docs.nav.requestTracking.title': 'Seguimiento de solicitudes',
  'workbench.docs.nav.requestTracking.summary':
    'Cómo las solicitudes coincidentes se observan, se registran y se muestran como insignias en el popup.',
  'workbench.docs.nav.execution.title': 'Cómo se ejecutan las reglas',
  'workbench.docs.nav.execution.summary':
    'Los dos motores (DNR y basado en scripts) que deciden dónde se aplica cada regla.',
  'workbench.docs.nav.multiTab.title': 'Comportamiento multipestaña',
  'workbench.docs.nav.multiTab.summary':
    'Qué se sincroniza entre las pestañas del espacio de trabajo (los datos) y qué queda por pestaña ' +
    '(disposición, borradores).',
  'workbench.docs.nav.systemStatus.title': 'Estado del sistema',
  'workbench.docs.nav.systemStatus.summary':
    'La píldora de semáforo — qué informa cada subsistema y qué significan el rojo / amarillo / verde.',
  'workbench.docs.nav.debugMode.title': 'Modo de depuración',
  'workbench.docs.nav.debugMode.summary':
    'Conectarse al protocolo de depuración del navegador — un alcance más profundo para las solicitudes, la ' +
    'inyección y el entorno de la pestaña.',
  'workbench.docs.nav.headerActions.title': 'Acciones de encabezado',
  'workbench.docs.nav.headerActions.summary':
    'Añadir, reemplazar, anexar, quitar o fusionar encabezados de solicitud y de respuesta.',
  'workbench.docs.nav.block.title': 'Bloquear',
  'workbench.docs.nav.block.summary': 'Cancelar las solicitudes coincidentes en la capa de red.',
  'workbench.docs.nav.redirect.title': 'Redirigir',
  'workbench.docs.nav.redirect.summary':
    'Enviar las solicitudes coincidentes a una URL distinta — estática o sustituida por regex.',
  'workbench.docs.nav.queryParam.title': 'Parámetros de consulta',
  'workbench.docs.nav.queryParam.summary':
    'Añadir, reemplazar o quitar parámetros de consulta de la URL antes de que la solicitud salga.',
  'workbench.docs.nav.requestBody.title': 'Cuerpo de la solicitud',
  'workbench.docs.nav.requestBody.summary':
    'Sustituir o transformar los cuerpos fetch / XHR salientes — estáticos, dinámicos o filtrados por GraphQL.',
  'workbench.docs.nav.response.title': 'Modificar la respuesta',
  'workbench.docs.nav.response.summary':
    'Simular o modificar respuestas API — cuerpo, estado y encabezados sintéticos o transformados.',
  'workbench.docs.nav.inject.title': 'Inyectar JS / CSS',
  'workbench.docs.nav.inject.summary':
    'Ejecutar JavaScript o CSS en el contexto de la página — antes de los scripts de la página o con el DOM ' +
    'ya listo.',
  'workbench.docs.nav.delay.title': 'Retraso',
  'workbench.docs.nav.delay.summary':
    'Añadir latencia artificial a las navegaciones y a los fetch / XHR iniciados por JS.',
  'workbench.docs.nav.resourceTypes.title': 'Tipos de recursos',
  'workbench.docs.nav.resourceTypes.summary':
    'Tabla de consulta de los valores ResourceType de Chrome — Page, Frame, Fetch/XHR, Script y el resto.',
  'workbench.docs.nav.keyboardShortcuts.title': 'Atajos de teclado',
  'workbench.docs.nav.keyboardShortcuts.summary':
    'Todos los atajos del workbench, agrupados por superficie — paneles, pestañas, navegación, acciones.',
  'workbench.docs.nav.limitations.title': 'Limitaciones',
  'workbench.docs.nav.limitations.summary':
    'Las sorpresas conocidas en un solo lugar — visibilidad en DevTools, alcance de los scripts, coincidencia ' +
    'de encabezados, Fusionar.',
} as const satisfies Catalog;
