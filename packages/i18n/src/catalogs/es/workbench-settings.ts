/**
 * Workbench settings — shell chrome — Spanish. Mirrors
 * `catalogs/en/workbench-settings.ts` key for key; extends the es
 * register contract (`es/shared.ts`). Raw by design: `Backend` /
 * `MCP` / `shell` as dev loanwords, the DevTools-panel tab names in
 * category labels (Network, Headers, Initiator, Cookies, Timing —
 * panel parity vocabulary), `MIME` / `Hash` / `LAN` / `multipart` /
 * `build` / `opt-in`, and the {version} / {when} / {message} /
 * {filename} / {sessionId} / {installId} holes. `Datos` (Data
 * category) matches the settings path quoted by the system-status doc
 * body (`Configuración → Datos → …`). MINTS: setting (countable) =
 * `ajuste` (the surface stays `Configuración`); reset =
 * `Restablecer`; DevTools panel = `Panel de DevTools`; tier = `nivel`
 * and seat = `plaza` reuse the daemon-admin mints; sort in category
 * prose = `orden`.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchSettings = {
  // ── Shell chrome ───────────────────────────────────────────────────
  'workbench.settings.shell.title': 'Configuración',
  'workbench.settings.shell.openInEditor': 'Abrir en el editor',
  'workbench.settings.shell.openInEditorSoon': 'Abrir en el editor (próximamente)',
  'workbench.settings.shell.maximize': 'Maximizar',
  'workbench.settings.shell.restoreWindow': 'Restaurar',
  'workbench.settings.shell.hint.search': 'Buscar',
  'workbench.settings.shell.hint.navigate': 'Navegar',
  'workbench.settings.shell.hint.select': 'Seleccionar',
  'workbench.settings.shell.hint.clearClose': 'Borrar / Cerrar',
  'workbench.settings.shell.noneRegistered': 'No hay ajustes registrados.',
  'workbench.settings.shell.resetAll': 'Restablecer todo',
  'workbench.settings.shell.resetAllCount': 'Restablecer todo ({count})',
  'workbench.settings.shell.resetAllTitle': '¿Restablecer todos los ajustes?',
  'workbench.settings.shell.resetAllNone': 'Nada que restablecer — todos los ajustes están en sus valores por defecto.',
  'workbench.settings.shell.resetAllDescription': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Restaurar {count} ajuste a su valor por defecto.',
      many: 'Restaurar {count} ajustes a sus valores por defecto.',
      other: 'Restaurar {count} ajustes a sus valores por defecto.',
    }),
  'workbench.settings.shell.resetConfirm': 'Restablecer',
  'workbench.settings.shell.searchResults': 'Resultados de la búsqueda',
  'workbench.settings.shell.matchesFor': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} coincidencia para',
      many: '{count} coincidencias para',
      other: '{count} coincidencias para',
    }),
  'workbench.settings.shell.noMatchesFor': 'Ningún ajuste coincide con',
  'workbench.settings.shell.jumpToCategory': 'Ir a la categoría',
  'workbench.settings.shell.navAria': 'Categorías de ajustes',
  'workbench.settings.shell.showCategoryNames': 'Mostrar los nombres de las categorías',
  'workbench.settings.shell.otherGroup': 'Otros',

  // ── Shared field-row chrome ────────────────────────────────────────
  'workbench.settings.row.modified': 'Modificado respecto al valor por defecto',
  'workbench.settings.row.modifiedAria': 'modificado',
  'workbench.settings.row.resetToDefault': 'Restablecer el valor por defecto',
  'workbench.settings.row.experimental': 'Experimental',
  'workbench.settings.row.desktopBadge': 'Escritorio',
  'workbench.settings.row.desktopTip':
    'Requiere una conexión activa con la aplicación de escritorio de Open Headers. La aplicación de escritorio ' +
    'almacena el valor de referencia.',
  'workbench.settings.row.capabilityUnavailable': 'Este navegador no admite este ajuste.',
  'workbench.settings.row.connectionRequired': 'Conecta la aplicación de escritorio para cambiar este ajuste.',
  'workbench.settings.row.aboutAria': 'Acerca de {label}',
  'workbench.settings.row.disabledCapabilityAria': 'Desactivado — no disponible en este navegador',
  'workbench.settings.row.disabledConnectionAria': 'Desactivado — requiere conexión con el escritorio',
  'workbench.settings.row.managed': 'Gestionado por tu organización',
  'workbench.settings.row.managedBadge': 'Gestionado',
  'workbench.settings.row.disabledManagedAria': 'Desactivado — gestionado por tu organización',
  'workbench.settings.row.run': 'Ejecutar',

  // ── Categories ─────────────────────────────────────────────────────
  'workbench.settings.category.backend.label': 'Backend',
  'workbench.settings.category.backend.description':
    'Donde viven tus espacios de trabajo, reglas, vault e historial. Elige el host que llegue tan lejos como ' +
    'necesites — solo local en cualquier caso.',
  'workbench.settings.category.backend.sub.connection': 'Conexión',
  'workbench.settings.category.backend.sub.reliability': 'Fiabilidad',
  'workbench.settings.category.backend.sub.notifications': 'Notificaciones',
  'workbench.settings.category.backend.sub.lan-peers': 'Pares LAN',
  'workbench.settings.category.mcp.label': 'IA · Servidor MCP',
  'workbench.settings.category.mcp.description':
    'Permite que los agentes de IA y otros clientes MCP lean y controlen esta aplicación. El acceso está ' +
    'escalonado — lectura, escritura, ejecución y revelación de secretos son interruptores separados, todos ' +
    'desactivados por defecto.',
  'workbench.settings.category.general.label': 'General',
  'workbench.settings.category.general.description':
    'Comportamiento global de la aplicación, arranque y configuración regional.',
  'workbench.settings.category.appearance.label': 'Apariencia',
  'workbench.settings.category.appearance.description': 'Tema, densidad y presentación visual.',
  'workbench.settings.category.workspaceLayout.label': 'Disposición del espacio de trabajo',
  'workbench.settings.category.workspaceLayout.description':
    'Affordances del pie de página y comportamiento del shell de las ventanas de herramientas.',
  'workbench.settings.category.terminal.label': 'Terminal',
  'workbench.settings.category.terminal.description':
    'Comportamiento de la ventana de herramientas Terminal integrada.',
  'workbench.settings.category.devpanel.label': 'Panel de DevTools',
  'workbench.settings.category.devpanel.description':
    'Valores por defecto del panel de DevTools del navegador — el shell de las ventanas de herramientas y cada ' +
    'pestaña de la superficie de solicitudes.',
  'workbench.settings.category.devpanelLayout.label': 'Panel de DevTools · Disposición',
  'workbench.settings.category.devpanelLayout.navLabel': 'Disposición',
  'workbench.settings.category.devpanelLayout.description':
    'Comportamiento del shell de las ventanas de herramientas para el panel de DevTools del navegador.',
  'workbench.settings.category.devpanelNetwork.label': 'Panel de DevTools · Network',
  'workbench.settings.category.devpanelNetwork.navLabel': 'Network',
  'workbench.settings.category.devpanelNetwork.description':
    'Valores por defecto de la tabla de solicitudes Network en el panel de DevTools — disposición, orden, ' +
    'columna de puntos.',
  'workbench.settings.category.devpanelHeaders.label': 'Panel de DevTools · Headers',
  'workbench.settings.category.devpanelHeaders.navLabel': 'Headers',
  'workbench.settings.category.devpanelHeaders.description':
    'Valores por defecto de la pestaña Headers en el panel de DevTools — disposición, orden, filtros, ' +
    'sugerencias.',
  'workbench.settings.category.devpanelInitiator.label': 'Panel de DevTools · Initiator',
  'workbench.settings.category.devpanelInitiator.navLabel': 'Initiator',
  'workbench.settings.category.devpanelInitiator.description':
    'Valores por defecto de la pestaña Initiator en el panel de DevTools — orden, filtros, sugerencias.',
  'workbench.settings.category.devpanelCookies.label': 'Panel de DevTools · Cookies',
  'workbench.settings.category.devpanelCookies.navLabel': 'Cookies',
  'workbench.settings.category.devpanelCookies.description':
    'Valores por defecto de la pestaña Cookies en el panel de DevTools — columnas, orden, filtros, sugerencias.',
  'workbench.settings.category.devpanelTiming.label': 'Panel de DevTools · Timing',
  'workbench.settings.category.devpanelTiming.navLabel': 'Timing',
  'workbench.settings.category.devpanelTiming.description':
    'Valores por defecto de la pestaña Timing en el panel de DevTools — qué bandas son visibles.',
  'workbench.settings.category.inspection.label': 'Modo de depuración',
  'workbench.settings.category.inspection.description':
    'La vía opt-in que adjunta el protocolo de depuración de tu navegador — inspecciona y modifica solicitudes ' +
    'con la misma profundidad que las herramientas de desarrollo integradas.',
  'workbench.settings.category.trafficMonitor.label': 'Tráfico',
  'workbench.settings.category.trafficMonitor.description':
    'Valores predeterminados del gesto «Empezar a observar» del panel de Tráfico y presupuesto de disco del ' +
    'archivo de sesiones.',
  'workbench.settings.category.editor.label': 'Editor de código',
  'workbench.settings.category.editor.description':
    'Fuente, sangría y opciones de vista para las superficies de edición de código.',
  'workbench.settings.category.requests.label': 'Solicitudes API',
  'workbench.settings.category.requests.description': 'Envío de solicitudes HTTP y tratamiento de las respuestas.',
  'workbench.settings.category.requests.sub.http': 'HTTP',
  'workbench.settings.category.requests.sub.sse': 'SSE',
  'workbench.settings.category.requests.sub.grpc': 'gRPC',
  'workbench.settings.category.requests.sub.websocket': 'WebSocket',
  'workbench.settings.category.rulesEngine.label': 'Motor de reglas',
  'workbench.settings.category.rulesEngine.description': 'Cómo se evalúan, compilan y arbitran las reglas.',
  'workbench.settings.category.keyboard.label': 'Teclado',
  'workbench.settings.category.keyboard.description': 'Personaliza los atajos de teclado.',
  'workbench.settings.category.keyboard.sub.global': 'Todas las superficies',
  'workbench.settings.category.keyboard.sub.workbench-general': 'Espacio de trabajo',
  'workbench.settings.category.keyboard.sub.workbench-layout': 'Espacio de trabajo · Disposición',
  'workbench.settings.category.keyboard.sub.workbench-tabs': 'Espacio de trabajo · Pestañas',
  'workbench.settings.category.keyboard.sub.workbench-focus': 'Espacio de trabajo · Foco',
  'workbench.settings.category.keyboard.sub.workbench-editor': 'Espacio de trabajo · Editor',
  'workbench.settings.category.keyboard.sub.popup-general': 'Popup y panel lateral',
  'workbench.settings.category.keyboard.sub.popup-navigation': 'Popup y panel lateral · Navegación',
  'workbench.settings.category.keyboard.sub.popup-rows': 'Popup y panel lateral · Acciones de fila',
  'workbench.settings.category.keyboard.sub.popup-tabs': 'Popup y panel lateral · Pestañas',
  'workbench.settings.category.workspaceSharing.label': 'Compartir el espacio de trabajo',
  'workbench.settings.category.workspaceSharing.description':
    'Preferencias de visualización para la vista previa de importación de las exportaciones de espacio de ' +
    'trabajo.',
  'workbench.settings.category.git.label': 'Git',
  'workbench.settings.category.git.description':
    'Vincula este espacio de trabajo a una carpeta en disco — un árbol YAML vivo y compatible con git.',
  'workbench.settings.category.proxy.label': 'Proxy',
  'workbench.settings.category.proxy.description':
    'El proxy de salida de este dispositivo — cómo alcanzan la red las solicitudes — y la configuración ' +
    'de confianza para el proxy de captura.',
  'workbench.settings.category.proxyOutbound.label': 'Proxy · Solicitudes salientes',
  'workbench.settings.category.proxyOutbound.navLabel': 'Solicitudes salientes',
  'workbench.settings.category.proxyOutbound.description':
    'El proxy de salida de este dispositivo — cómo alcanzan la red las solicitudes, sesiones WebSocket y ' +
    'llamadas gRPC.',
  'workbench.settings.category.proxyTrust.label': 'Proxy · Sistema',
  'workbench.settings.category.proxyTrust.navLabel': 'Proxy del sistema',
  'workbench.settings.category.proxyTrust.description':
    'La autoridad de certificación y los almacenes de confianza que permiten descifrar el tráfico HTTPS ' +
    'para inspección — creada en esta máquina, eliminable aquí.',
  'workbench.settings.category.data.label': 'Datos',
  'workbench.settings.category.data.description': 'Diagnósticos, importación/exportación y mantenimiento destructivo.',
  'workbench.settings.category.license.label': 'Licencia',
  'workbench.settings.category.license.description':
    'Todo lo que Open Headers ofrece hoy está incluido en todos los niveles — los planes de pago cubren las ' +
    'plazas de equipo. El nivel gratuito admite hasta 6 usuarios activos por servidor.',
  'workbench.settings.category.updates.label': 'Actualizaciones',
  'workbench.settings.category.updates.description': 'Búsqueda de actualizaciones, canal y comportamiento de descarga.',
  'workbench.settings.category.about.label': 'Acerca de',
  'workbench.settings.category.about.description': 'Versión, licencias e información del build.',

  // ── App-update row (updates.state custom editor) ───────────────────
  'workbench.settings.updatesRow.unsupported':
    'En este build, las actualizaciones las gestiona tu canal de instalación.',
  'workbench.settings.updatesRow.checking': 'Buscando actualizaciones…',
  'workbench.settings.updatesRow.securityFix':
    'La versión {version} corrige un problema de seguridad que afecta a esta versión.',
  'workbench.settings.updatesRow.available': 'La versión {version} está disponible.',
  'workbench.settings.updatesRow.packageManager': 'Instálala con tu gestor de paquetes de Linux.',
  'workbench.settings.updatesRow.updateAndRestart': 'Actualizar y reiniciar',
  'workbench.settings.updatesRow.downloading': 'Descargando {version}…',
  'workbench.settings.updatesRow.readyToInstall': 'La versión {version} está lista para instalarse.',
  'workbench.settings.updatesRow.restartToInstall': 'Reiniciar para instalar',
  'workbench.settings.updatesRow.checkFailed': 'Falló la búsqueda de actualizaciones: {message}',
  'workbench.settings.updatesRow.retry': 'Reintentar',
  'workbench.settings.updatesRow.upToDate': 'Estás en la última versión ({version}).',
  'workbench.settings.updatesRow.checkNow': 'Comprobar ahora',
  'workbench.settings.updatesRow.releaseNotes': 'Notas de la versión',
  'workbench.settings.updatesRow.lastChecked': 'Última comprobación {when}',

  'workbench.settings.terminalProfiles.systemDefault': 'Shell predeterminado del sistema',
  'workbench.settings.terminalProfiles.add': 'Añadir perfil',
  'workbench.settings.terminalProfiles.edit': 'Editar perfil',
  'workbench.settings.terminalProfiles.remove': 'Eliminar perfil',
  'workbench.settings.terminalProfiles.addTitle': 'Añadir perfil de terminal',
  'workbench.settings.terminalProfiles.editTitle': 'Editar perfil de terminal',
  'workbench.settings.terminalProfiles.name': 'Nombre',
  'workbench.settings.terminalProfiles.shell': 'Ruta del shell',
  'workbench.settings.terminalProfiles.args': 'Argumentos',
  'workbench.settings.terminalProfiles.cwd': 'Directorio inicial',
  'workbench.settings.terminalProfiles.cwdPlaceholder': 'Directorio personal',
  'workbench.settings.terminalProfiles.save': 'Guardar',

  // ── Settings field widgets ─────────────────────────────────────────
  'workbench.settings.fields.files.renameTooltip': 'Renombrar el archivo',
  'workbench.settings.fields.files.renameMissing': 'El archivo ya no existe en este espacio de trabajo',
  'workbench.settings.fields.files.renameFailed': 'No se pudo renombrar el archivo',
  'workbench.settings.fields.files.renameFailedReason': 'No se pudo renombrar el archivo: {message}',
  'workbench.settings.fields.files.colFilename': 'Nombre de archivo',
  'workbench.settings.fields.files.colSize': 'Tamaño',
  'workbench.settings.fields.files.colMime': 'MIME',
  'workbench.settings.fields.files.colHash': 'Hash',
  'workbench.settings.fields.files.colActions': 'Acciones',
  'workbench.settings.fields.files.download': 'Descargar',
  'workbench.settings.fields.files.deleteTitle': '¿Eliminar {filename}?',
  'workbench.settings.fields.files.deleteWarning':
    'Las partes multipart que referencien este archivo fallarán al enviar.',
  'workbench.settings.fields.files.loading': 'Cargando archivos…',
  'workbench.settings.fields.files.empty': 'Aún no hay archivos — usa la acción Subir archivo de arriba.',
  'workbench.settings.fields.keyValue.keyPlaceholder': 'clave',
  'workbench.settings.fields.keyValue.valuePlaceholder': 'valor',
  'workbench.settings.fields.keyValue.addEntry': 'Añadir entrada',
  'workbench.settings.fields.keybinding.pressCombo': 'Pulsa una combinación de teclas…',
  'workbench.settings.fields.keybinding.record': 'Grabar',
  'workbench.settings.fields.keybinding.cancel': 'Cancelar',

  // ── Product-telemetry toggle row ───────────────────────────────────
  'workbench.settings.telemetryRow.viewEvents': 'Ver los eventos',
  'workbench.settings.telemetryRow.modalTitle': 'Eventos de telemetría de esta sesión',
  'workbench.settings.telemetryRow.sessionOn': 'Sesión {sessionId} — el recuento está activado',
  'workbench.settings.telemetryRow.sessionOff': 'Sesión {sessionId} — el recuento está desactivado',
  'workbench.settings.telemetryRow.install':
    'Instalación {installId} (aleatorio — identifica esta instalación, no a ti)',
  'workbench.settings.telemetryRow.noInstall': 'Sin identificador de instalación — el recuento está desactivado',
  'workbench.settings.telemetryRow.empty': 'No se han registrado eventos de telemetría en esta sesión.',
  'workbench.settings.telemetryRow.confirmTitle': '¿Desactivar el recuento anónimo de uso?',
  'workbench.settings.telemetryRow.confirmHeading': 'Tu privacidad ya está protegida',
  'workbench.settings.telemetryRow.confirmIntro':
    'Un identificador aleatorio cuenta esta instalación — nunca a ti. Nunca se recogen datos personales. Esto es lo que hace el recuento:',
  'workbench.settings.telemetryRow.confirmPointFeatures': 'Muestra qué funcionalidades merecen seguir desarrollándose',
  'workbench.settings.telemetryRow.confirmPointScope':
    'Solo cuenta el uso de funcionalidades, la plataforma y la versión de la aplicación',
  'workbench.settings.telemetryRow.confirmPointInspect': 'Cada evento sigue visible byte a byte en «Ver los eventos»',
  'workbench.settings.telemetryRow.confirmBadgePersonal': 'Sin datos personales',
  'workbench.settings.telemetryRow.confirmBadgeUrls': 'Sin URLs ni cabeceras',
  'workbench.settings.telemetryRow.confirmBadgeContent': 'Sin contenido de peticiones',
  'workbench.settings.telemetryRow.confirmKeep': 'Mantener el recuento activado',
  'workbench.settings.telemetryRow.confirmDisable': 'Desactivar de todos modos',
} as const satisfies Catalog;
