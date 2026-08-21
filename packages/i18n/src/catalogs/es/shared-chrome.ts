/**
 * Shared chrome family — Spanish. Mirrors `catalogs/en/shared-chrome.ts`
 * key for key; see that file for the family rules and the raw-by-design
 * plane (browser banner quoted verbatim, nav / worker / OOPIF,
 * xhr/fetch, boot.interactive). Mints: Debug mode = Modo de depuración;
 * scope (debug reach) = alcance; layout = disposición; donor = donante;
 * Scratch = Boceto; cold wake = reactivación en frío.
 */

import type { Catalog } from '../../types';

export const sharedChrome = {
  // ── Debug mode pill + dormant notice ───────────────────────────────
  'shared.chrome.debug.title': 'Modo de depuración',
  'shared.chrome.debug.titleShort': 'Depuración',
  'shared.chrome.debug.unavailableHint': 'El modo de depuración está disponible en Chrome y Edge.',
  'shared.chrome.debug.toggleAria': 'Activar o desactivar el modo de depuración',
  'shared.chrome.debug.aboutTooltip': 'Acerca del modo de depuración',
  'shared.chrome.debug.openDocsAria': 'Abrir la documentación del modo de depuración',
  'shared.chrome.debug.controlsAria': 'Controles del modo de depuración',
  'shared.chrome.debug.turnOn': 'Activar el modo de depuración',
  'shared.chrome.debug.turnOff': 'Desactivar el modo de depuración',
  'shared.chrome.debug.scopeDevtools': 'Donde DevTools está abierto',
  'shared.chrome.debug.scopeActive': 'La pestaña con el foco',
  'shared.chrome.debug.scopeBoth': 'Ambas',
  'shared.chrome.debug.attachTo': 'Adjuntar a',
  'shared.chrome.debug.includeThisTab': 'Incluir esta pestaña del navegador',
  'shared.chrome.debug.pinThisTabAria': 'Fijar esta pestaña del navegador',
  'shared.chrome.debug.attachedTabs': 'Pestañas adjuntas',
  'shared.chrome.debug.noTabsAttached': 'Aún no hay pestañas adjuntas',
  'shared.chrome.debug.bannerNote':
    'Mientras el modo de depuración está activo, el aviso del navegador «OH started debugging this browser» ' +
    'se muestra en todas las pestañas — no solo en las que está adjunto.',
  'shared.chrome.debug.tabNumber': 'Pestaña #{number}',
  'shared.chrome.debug.tabFallback': 'Pestaña {id}',
  'shared.chrome.debug.onThisTab': 'Estás en esta pestaña',
  'shared.chrome.debug.switchTo': 'Cambiar a {target}',
  'shared.chrome.debug.dormantTooltip':
    'El modo de depuración está activo, pero esta pestaña queda fuera de su alcance — los efectos nav / worker ' +
    '/ OOPIF de tus reglas de nivel de depuración están dormidos aquí. Tráela al alcance desde el modo de ' +
    'depuración (cambia el alcance o fija esta pestaña). Siguen ejecutándose sobre las solicitudes de página ' +
    '(xhr/fetch).',
  'shared.chrome.debug.tabOutOfScope': 'Pestaña fuera de alcance',

  // ── System Status pill ─────────────────────────────────────────────
  'shared.chrome.status.title': 'Sistema',
  'shared.chrome.status.aria': 'Estado del sistema: {summary}',
  'shared.chrome.status.aboutTooltip': 'Acerca de este panel',
  'shared.chrome.status.openDocsAria': 'Abrir la documentación del estado del sistema',
  'shared.chrome.status.healthy': 'Correcto',
  'shared.chrome.status.failure': 'Fallo',
  'shared.chrome.status.issues': 'Problemas',
  'shared.chrome.status.noEvents': 'Aún no hay eventos',
  'shared.chrome.status.subsystemSync': 'Sincronización',
  'shared.chrome.status.subsystemRules': 'Reglas',
  'shared.chrome.status.subsystemRequests': 'Solicitudes',
  'shared.chrome.status.subsystemPermissions': 'Permisos',
  'shared.chrome.status.subsystemSecrets': 'Secretos',
  'shared.chrome.status.subsystemLive': 'Live',
  'shared.chrome.status.subsystemActivity': 'Actividad',
  'shared.chrome.status.subsystemDebugMode': 'Modo de depuración',
  'shared.chrome.status.buildLine': 'Open Headers · {version}',
  'shared.chrome.status.versionBeta': '{version} (beta)',
  'shared.chrome.status.buildNumber': 'build {build}',

  // ── Status popover product extras ──────────────────────────────────
  'shared.chrome.status.relaunchApp': 'Relanzar la aplicación',
  'shared.chrome.status.backendOff': 'Apagado',
  'shared.chrome.status.backendConnecting': 'Conectando…',
  'shared.chrome.status.companionDesktopApp': 'App de escritorio',
  'shared.chrome.status.companionExtensions': 'Extensiones',
  'shared.chrome.status.companionConnected': 'Conectada',
  'shared.chrome.status.companionNotConnected': 'No conectada',
  'shared.chrome.status.companionInstalledNotConnected': 'Instalada · no conectada',
  'shared.chrome.status.companionNotInstalled': 'No instalada',
  'shared.chrome.status.companionDownload': 'Descargar',
  'shared.chrome.status.companionPeersConnected': '{count} conectadas',
  'shared.chrome.status.companionNoPeers': 'Ninguna conectada',
  'shared.chrome.status.companionConnect': 'Conectar',
  'shared.chrome.status.companionOpenApp': 'Abrir app',
  'shared.chrome.addons.title': 'Complementos',
  'shared.chrome.addons.cli': 'CLI',
  'shared.chrome.addons.server': 'Servidor',
  'shared.chrome.addons.cliSetUp': 'Configurada',
  'shared.chrome.addons.cliNotSetUp': 'Sin configurar',
  'shared.chrome.addons.cliStale': 'Token revocado — configúrala de nuevo',
  'shared.chrome.addons.cliExternal': 'Config externa',
  'shared.chrome.addons.cliMalformed': 'Config malformada',
  'shared.chrome.addons.cliProvision': 'Configurar',
  'shared.chrome.addons.mcp': 'MCP',
  'shared.chrome.addons.mcpOn': 'Activado',
  'shared.chrome.addons.mcpTurnOn': 'Activar',
  'shared.chrome.addons.notConfigured': 'Sin configurar',
  'shared.chrome.addons.requiresDesktop': 'Requiere la aplicación de escritorio',
  'shared.chrome.addons.cliViaDesktop': 'Se configura desde la aplicación de escritorio',
  'shared.chrome.status.coldStart': 'Arranque en frío',
  'shared.chrome.status.coldStartMessage':
    'Regresión de rendimiento detectada — consulta la exportación de diagnóstico',
  'shared.chrome.status.coldStartTooltip':
    'Tres reactivaciones en frío consecutivas superaron la línea base en ≥20%. Muestras recientes de ' +
    'boot.interactive (ms): {samples}.',

  // ── Update dialog ──────────────────────────────────────────────────
  'shared.chrome.updates.title': 'Actualización de Open Headers',
  'shared.chrome.updates.downloading': 'Descargando…',
  'shared.chrome.updates.downloadingPercent': 'Descargando… {percent}%',
  'shared.chrome.updates.updateAndRestart': 'Actualizar y reiniciar',
  'shared.chrome.updates.ignore': 'Ignorar esta actualización',
  'shared.chrome.updates.remindLater': 'Recordármelo más tarde',
  'shared.chrome.updates.nowAvailableSuffix': 'ya está disponible.',
  'shared.chrome.updates.moreDetailsPrefix': 'Para más detalles, consulta las',
  'shared.chrome.updates.releaseNotes': 'notas de la versión',
  'shared.chrome.updates.updatingTo': 'Actualizando de {from} a {to}.',
  'shared.chrome.updates.configure': 'Configurar las actualizaciones…',

  // ── Settings gear menu ─────────────────────────────────────────────
  'shared.chrome.gearMenu.downloadVersion': 'Descargar {version}',
  'shared.chrome.gearMenu.versionAvailable': '{version} disponible…',
  'shared.chrome.gearMenu.updateAndRestartVersion': 'Actualizar a {version} y reiniciar',
  'shared.chrome.gearMenu.downloadingVersion': 'Descargando {version}…',
  'shared.chrome.gearMenu.restartToInstallVersion': 'Reiniciar para instalar {version}',
  'shared.chrome.gearMenu.settings': 'Configuración…',
  'shared.chrome.gearMenu.keyboardShortcuts': 'Atajos de teclado…',
  'shared.chrome.gearMenu.appearance': 'Apariencia…',
  'shared.chrome.gearMenu.about': 'Acerca de Open Headers',
  'shared.chrome.gearMenu.tourGuide': 'Visita guiada',
  'shared.chrome.gearMenu.signOut': 'Cerrar sesión',
  'shared.chrome.gearMenu.searchPlaceholder': 'Buscar',
  'shared.chrome.gearMenu.noMatches': 'Sin coincidencias',
  'shared.chrome.gearMenu.settingsTooltip': 'Configuración',
  'shared.chrome.gearMenu.settingsMenuAria': 'Menú de configuración',

  // ── Background tasks (Processes) ───────────────────────────────────
  'shared.chrome.tasks.processes': 'Procesos',
  'shared.chrome.tasks.hidePanelAria': 'Ocultar el panel de procesos',
  'shared.chrome.tasks.allCompleted': 'Todas las tareas en segundo plano han terminado',
  'shared.chrome.tasks.aboutNoteAria': 'Acerca de esta nota',
  'shared.chrome.tasks.stop': 'Detener',
  'shared.chrome.tasks.keepRunning': 'Dejar en ejecución',
  'shared.chrome.tasks.stopTaskAria': 'Detener la tarea en segundo plano',
  'shared.chrome.tasks.hideTaskAria': 'Ocultar la tarea en segundo plano',
  'shared.chrome.tasks.hideProcesses': 'Ocultar procesos',
  'shared.chrome.tasks.hideProcessesCount': 'Ocultar procesos ({count})',

  // ── Layout-donor pill ──────────────────────────────────────────────
  'shared.chrome.donor.defaultTooltip': '{unit} por defecto — los nuevos {units} heredan la disposición desde aquí.',
  'shared.chrome.donor.nonDefaultTooltip':
    'Otro {unit} es el donante por defecto — los nuevos {units} heredan desde allí.',
  'shared.chrome.donor.isDonorBody':
    'Este {unit} es el predeterminado actual. Los nuevos {units} heredan esta disposición.',
  'shared.chrome.donor.nonDonorBody':
    'Otro {unit} es el predeterminado actual. Los nuevos {units} heredan la disposición de ese {unit}.',
  'shared.chrome.donor.reset': 'Restablecer la disposición por defecto',
  'shared.chrome.donor.defaultAria': '{unit} por defecto para la herencia de nuevos {unit}',
  'shared.chrome.donor.nonDefaultAria': 'No es el {unit} por defecto para la herencia de nuevos {unit}',
  'shared.chrome.donor.defaultLabel': '{unit} por defecto',
  'shared.chrome.donor.inheritsLabel': 'Hereda la disposición',

  // ── Lifecycle pill ─────────────────────────────────────────────────
  'shared.chrome.lifecycle.title': 'Estados del ciclo de vida',
  'shared.chrome.lifecycle.scratch': 'Boceto',
  'shared.chrome.lifecycle.scratchBody': 'Borrador sin guardar. Nada se conserva hasta que guardes.',
  'shared.chrome.lifecycle.unresolved': 'Sin resolver',
  'shared.chrome.lifecycle.unresolvedBody': 'Contiene {{ref}} que no se resuelven en el ámbito activo.',
  'shared.chrome.lifecycle.draft': 'Borrador',
  'shared.chrome.lifecycle.draftBody':
    'Guardada pero aún no Live — faltan campos obligatorios, o aún no está publicada.',
  'shared.chrome.lifecycle.live': 'Live',
  'shared.chrome.lifecycle.liveBody': 'Publicada y activa.',
} as const satisfies Catalog;
