/**
 * Workbench settings — the app-side setting-definition corpus —
 * Spanish. Mirrors `catalogs/en/workbench-settings-defs.ts` key for
 * key; extends the es register contract (`es/shared.ts`). Brand and
 * platform vocabulary rides raw (S48): browser names, font names
 * (Inter, JetBrains Mono, Press Start 2P, SF Pro/Mono, Segoe UI,
 * Roboto, Consolas, …), wire tokens (`Cache-Control: no-cache`,
 * declarativeNetRequest, INVALID_ARGUMENT, sha256, IndexedDB,
 * `{{env.X}}` syntax), panel-parity names (Network tab, DevTools),
 * log-level option labels (Error / Warn / Info / Debug), `chrome`
 * (m.) and `chip` (m.) loanwords. Quotes the shipped es mints
 * verbatim: `ajuste` (countable setting) + `Restablecer` +
 * settings surface = `Configuración` (workbench-settings), debug-mode
 * scope options «Donde DevTools está abierto» / «La pestaña con el
 * foco» / «Ambas» + banner = `aviso` (workbench-docs-debug-mode),
 * `Exportar el registro de diagnóstico` path mint + `registro de
 * auditoría` (workbench-docs-system-status, S64 separate-referent
 * law), merge strategies «añadir como nuevo» / «reemplazar el
 * existente» + `Omitir` (workbench-import-export S66),
 * env-switch option labels from es/workbench-chrome (S16), the
 * activity-bar/tool-window layout phrasing from
 * es/workbench-settings-defs-devpanel, popup tab «Esta página»,
 * `Enviar` (Send), `insignia` (badge), `Cronología`, `obsoleto`,
 * `disparo` family, `token` raw m., `cabecera` (editor header).
 * MINTS: theme variants translate as product vocabulary (`Cálido`,
 * `Frío`, `Rosa`, `Sepia`, `Atenuado`, `Medianoche`, `Bosque`,
 * `Ártico`); word wrap = `ajuste de línea`; path wildcard =
 * `comodín de ruta`; raw URL = `URL en bruto`.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefs = {
  // ── Backend category defs ──────────────────────────────────────────
  'workbench.settings.def.backend.bindAddress.label': 'Sincronizar con los dispositivos de tu red',
  'workbench.settings.def.backend.bindAddress.description':
    'Permite que otros ordenadores y navegadores de la misma red se conecten a esta aplicación y compartan ' +
    'sus espacios de trabajo. Desactivado por defecto — solo este ordenador puede alcanzarla.',
  'workbench.settings.def.backend.bindAddress.option.loopback.label': 'Solo loopback (127.0.0.1)',
  'workbench.settings.def.backend.bindAddress.option.loopback.description':
    'Solo esta máquina puede conectarse. Por defecto.',
  'workbench.settings.def.backend.bindAddress.option.all-interfaces.label': 'Todas las interfaces (LAN)',
  'workbench.settings.def.backend.bindAddress.option.all-interfaces.description':
    'Los demás dispositivos de la red local pueden conectarse. Requiere el token de autenticación de U3.2.',
  'workbench.settings.def.backend.bindPort.label': 'Puerto del daemon',
  'workbench.settings.def.backend.bindPort.description':
    'El puerto que esta aplicación abre para que navegadores y otros dispositivos se conecten. Cámbialo solo ' +
    'si otra cosa ya usa el puerto por defecto. Los clientes deben apuntar al mismo puerto.',
  'workbench.settings.def.backend.serveWebApp.label': 'Servir la aplicación web',
  'workbench.settings.def.backend.serveWebApp.description':
    'Sirve el Workbench como página web en el puerto del daemon, para que una pestaña del navegador pueda ' +
    'abrirlo directamente desde esta aplicación — sin necesidad de extensión. Cualquiera que alcance el ' +
    'puerto ve la puerta de inicio de sesión; sigue haciendo falta un token emparejado para acceder a los ' +
    'datos.',
  'workbench.settings.def.backend.allowPeerExecute.label':
    'Permitir que los dispositivos conectados envíen solicitudes',
  'workbench.settings.def.backend.allowPeerExecute.description':
    'Deja que los navegadores y dispositivos emparejados envíen solicitudes API a través de esta aplicación ' +
    '— su Enviar del workbench se ejecuta en esta máquina, con su acceso a la red. Desactivado por defecto; ' +
    'cada envío sigue exigiendo que el remitente tenga acceso de escritura al espacio de trabajo.',
  'workbench.settings.def.backend.reconnectDelayMs.label': 'Retraso inicial de reconexión',
  'workbench.settings.def.backend.reconnectDelayMs.description':
    'Cuánto esperar (ms) antes del primer intento de reconexión tras una desconexión.',
  'workbench.settings.def.backend.maxReconnectDelayMs.label': 'Retraso máximo de reconexión',
  'workbench.settings.def.backend.maxReconnectDelayMs.description':
    'Cota superior (ms) del backoff exponencial entre intentos de reconexión.',
  'workbench.settings.def.backend.pingIntervalMs.label': 'Intervalo de keep-alive',
  'workbench.settings.def.backend.pingIntervalMs.description':
    'Con qué frecuencia (ms) enviar un ping para que el WebSocket permanezca abierto tras proxies estrictos.',
  'workbench.settings.def.backend.showBadgeWhenDisconnected.label': 'Insignia al desconectarse',
  'workbench.settings.def.backend.showBadgeWhenDisconnected.description':
    'Muestra una insignia roja en el icono de la barra de herramientas cuando el enlace con el back-end está ' +
    'caído.',
  'workbench.settings.def.backend.showDiagrams.label': 'Mostrar los diagramas del back-end',
  'workbench.settings.def.backend.showDiagrams.description':
    'Muestra los paneles ilustrados de niveles y de flujo de datos en la configuración de Backend.',

  // ── MCP category defs ──────────────────────────────────────────────
  'workbench.settings.def.mcp.enabled.label': 'Activar el servidor MCP',
  'workbench.settings.def.mcp.enabled.description':
    'Responde a los clientes MCP en el puerto del daemon de esta aplicación. Mientras está desactivado, el ' +
    'punto de acceso no existe. Activado, los agentes con un token de acceso pueden leer tus espacios de ' +
    'trabajo.',
  'workbench.settings.def.mcp.allowWrite.label': 'Permitir las herramientas de escritura',
  'workbench.settings.def.mcp.allowWrite.description':
    'Los agentes pueden crear, editar y eliminar reglas, solicitudes, entornos, variables y workflows. Cada ' +
    'cambio aterriza en el Flujo de actividad y puede revertirse.',
  'workbench.settings.def.mcp.allowExecute.label': 'Permitir las herramientas de ejecución',
  'workbench.settings.def.mcp.allowExecute.description':
    'Los agentes pueden enviar solicitudes guardadas y ejecutar workflows — tráfico de red real sale de esta ' +
    'máquina en su nombre.',
  'workbench.settings.def.mcp.allowSecrets.label': 'Permitir revelar los secretos',
  'workbench.settings.def.mcp.allowSecrets.description':
    'Los agentes pueden leer los valores de los secretos del vault en claro. Mientras está desactivado, ' +
    'todos los secretos permanecen enmascarados.',

  // ── General category defs ──────────────────────────────────────────
  'workbench.settings.def.general.language.label': 'Idioma',
  'workbench.settings.def.general.language.description':
    'Idioma de la interfaz. Se aplica inmediatamente a todas las superficies abiertas — sin recargar. El ' +
    'vocabulario técnico (nombres de encabezados, métodos HTTP, términos de protocolo) permanece en inglés ' +
    'en todos los idiomas.',
  'workbench.settings.def.general.language.option.auto.label': 'Seguir el sistema',
  'workbench.settings.def.general.language.option.auto.description':
    'Sigue el idioma de tu navegador o sistema operativo',
  'workbench.settings.def.general.language.option.pseudo.description':
    'Inglés acentuado y alargado para detectar textos sin traducir o truncados',
  'workbench.settings.def.general.confirmOnDelete.label': 'Confirmar antes de eliminar',
  'workbench.settings.def.general.confirmOnDelete.description':
    'Muestra un diálogo de confirmación antes de eliminar reglas, carpetas o colecciones.',
  'workbench.settings.def.general.showEmptyStateHints.label': 'Mostrar las pistas de estado vacío',
  'workbench.settings.def.general.showEmptyStateHints.description':
    'Muestra guías y consejos en los paneles vacíos y las zonas de bienvenida.',
  'workbench.settings.def.general.restoreTabsOnStartup.label': 'Restaurar las pestañas al iniciar',
  'workbench.settings.def.general.restoreTabsOnStartup.description':
    'Reabre las pestañas de editor que estaban abiertas al final de la sesión anterior.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.label': 'Cambio de entorno por colección',
  'workbench.settings.def.general.collectionEnvAutoSwitch.description':
    'Cómo cambia el entorno activo cuando te mueves entre las colecciones y las entidades que contienen ' +
    '(reglas, solicitudes, carpetas). Se aplica tanto a las colecciones de reglas como a las colecciones de ' +
    'solicitudes API. Las colecciones pueden llevar un entorno por defecto y fijar una lista corta de ' +
    'entornos recomendados; este ajuste controla si esos valores por defecto toman el mando automáticamente.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.label':
    'Mantener el entorno seleccionado',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.description':
    'Lo que tengas seleccionado (incluido ningún entorno) sigue seleccionado mientras navegas entre las ' +
    'colecciones y sus subcarpetas, reglas o solicitudes. El valor por defecto de una colección solo se ' +
    'aplica cuando no hay entorno seleccionado.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.label':
    'Aplicar los valores por defecto de las colecciones',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.description':
    'El valor por defecto de una colección toma el mando mientras estás dentro (o en cualquier subcarpeta, ' +
    'regla o solicitud de su interior). Tu última elección manual es el entorno base — se restaura cuando ' +
    'sales de una colección o entras en una sin valor por defecto. Sin memoria por colección.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.label': 'Seguir cada colección',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.description':
    'Abrir una colección (o cualquier subcarpeta, regla o solicitud de su interior) con un entorno por ' +
    'defecto cambia a ese valor por defecto. Las elecciones que hagas dentro de una colección se recuerdan ' +
    'para esa colección. Las colecciones sin valor por defecto no cambian automáticamente.',
  'workbench.settings.def.general.settingsOpenMode.label': 'Modo de apertura de la configuración',
  'workbench.settings.def.general.settingsOpenMode.description':
    'Cómo se abre la página de Configuración desde la barra de herramientas, el popup o la paleta de comandos.',
  'workbench.settings.def.general.settingsOpenMode.option.modal.label': 'Modal',
  'workbench.settings.def.general.settingsOpenMode.option.modal.description':
    'Superposición centrada sobre la página actual',
  'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.label': 'Modal (maximizada)',
  'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.description':
    'Superposición que llena la mayor parte de la ventana',
  'workbench.settings.def.general.settingsOpenMode.option.tab.label': 'Pestaña de editor',
  'workbench.settings.def.general.settingsOpenMode.option.tab.description':
    'Se abre como una pestaña de editor completa en el espacio de trabajo',
  'workbench.settings.def.general.settingsShowCategoryLabels.label':
    'Mostrar los nombres de categoría en la barra lateral de la configuración',
  'workbench.settings.def.general.settingsShowCategoryLabels.description':
    'Muestra etiquetas de texto junto a los iconos de categoría en la barra lateral de Configuración. Haz ' +
    'clic derecho en la barra lateral para alternar. Desactívalo para un riel compacto de solo iconos.',

  // ── Appearance category defs ───────────────────────────────────────
  'workbench.settings.def.appearance.theme.label': 'Tema de color',
  'workbench.settings.def.appearance.theme.description': 'Controla el tema de color global de la aplicación.',
  'workbench.settings.def.appearance.theme.option.light.label': 'Claro',
  'workbench.settings.def.appearance.theme.option.dark.label': 'Oscuro',
  'workbench.settings.def.appearance.theme.option.auto.label': 'Seguir el sistema',
  'workbench.settings.def.appearance.theme.option.auto.description': 'Sigue tu sistema operativo',
  'workbench.settings.def.appearance.lightVariant.label': 'Variante del tema claro',
  'workbench.settings.def.appearance.lightVariant.description':
    'Paleta usada cuando el tema de color resuelto es claro.',
  'workbench.settings.def.appearance.lightVariant.option.default.label': 'Por defecto',
  'workbench.settings.def.appearance.lightVariant.option.default.description':
    'Tema claro neutro y equilibrado para el uso diario.',
  'workbench.settings.def.appearance.lightVariant.option.highContrast.label': 'Contraste alto',
  'workbench.settings.def.appearance.lightVariant.option.highContrast.description':
    'Legibilidad máxima — superficies blanco puro, texto casi negro, contraste AAA.',
  'workbench.settings.def.appearance.lightVariant.option.warm.label': 'Cálido',
  'workbench.settings.def.appearance.lightVariant.option.warm.description':
    'Superficies tipo papel con neutros cálidos y un acento ámbar — más descansado para la vista en sesiones ' +
    'largas.',
  'workbench.settings.def.appearance.lightVariant.option.cool.label': 'Frío',
  'workbench.settings.def.appearance.lightVariant.option.cool.description':
    'Tema claro con tinte azul pizarra — superficies nítidas con un acento azul acero.',
  'workbench.settings.def.appearance.lightVariant.option.rose.label': 'Rosa',
  'workbench.settings.def.appearance.lightVariant.option.rose.description':
    'Superficies rosadas suaves con un acento magenta — calidez delicada sin el tono ámbar de Cálido.',
  'workbench.settings.def.appearance.lightVariant.option.sepia.label': 'Sepia',
  'workbench.settings.def.appearance.lightVariant.option.sepia.description':
    'Paleta pergamino saturada con texto marrón profundo — la variante clara más teñida, ideal para la ' +
    'lectura prolongada.',
  'workbench.settings.def.appearance.darkVariant.label': 'Variante del tema oscuro',
  'workbench.settings.def.appearance.darkVariant.description':
    'Paleta usada cuando el tema de color resuelto es oscuro.',
  'workbench.settings.def.appearance.darkVariant.option.default.label': 'Por defecto',
  'workbench.settings.def.appearance.darkVariant.option.default.description':
    'Tema oscuro neutro y equilibrado para el uso diario.',
  'workbench.settings.def.appearance.darkVariant.option.highContrast.label': 'Contraste alto',
  'workbench.settings.def.appearance.darkVariant.option.highContrast.description':
    'Legibilidad máxima — superficies negro verdadero, texto brillante, contraste AAA.',
  'workbench.settings.def.appearance.darkVariant.option.dim.label': 'Atenuado',
  'workbench.settings.def.appearance.darkVariant.option.dim.description':
    'Superficies azul pizarra suaves con menos deslumbramiento — más descansado para la vista en entornos ' +
    'con poca luz.',
  'workbench.settings.def.appearance.darkVariant.option.midnight.label': 'Medianoche',
  'workbench.settings.def.appearance.darkVariant.option.midnight.description':
    'Superficies azul marino profundo con un acento azul vivo — más rico y saturado que Atenuado.',
  'workbench.settings.def.appearance.darkVariant.option.forest.label': 'Bosque',
  'workbench.settings.def.appearance.darkVariant.option.forest.description':
    'Superficies oscuras con tinte verde y un acento esmeralda — paleta tranquila y vegetal.',
  'workbench.settings.def.appearance.darkVariant.option.arctic.label': 'Ártico',
  'workbench.settings.def.appearance.darkVariant.option.arctic.description':
    'Tema oscuro gris azulado frío con un acento cian escarchado — más plano y menos saturado que Atenuado o ' +
    'Medianoche.',
  'workbench.settings.def.appearance.uiScale.label': 'Escala de la interfaz',
  'workbench.settings.def.appearance.uiScale.description':
    'Escala todo el chrome — botones, texto, márgenes, controles — sin cambiar el tamaño de fuente del editor.',
  'workbench.settings.def.appearance.uiScale.option.0.7.label': 'Diminuta (70%)',
  'workbench.settings.def.appearance.uiScale.option.0.7.description':
    'La disposición más densa — útil junto a la fuente de interfaz Press Start 2P, que se muestra ' +
    'inusualmente alta y ancha.',
  'workbench.settings.def.appearance.uiScale.option.0.8.label': 'Compacta (80%)',
  'workbench.settings.def.appearance.uiScale.option.0.8.description':
    'Chrome más ajustado que conserva objetivos de clic cómodos.',
  'workbench.settings.def.appearance.uiScale.option.0.9.label': 'Pequeña (90%)',
  'workbench.settings.def.appearance.uiScale.option.0.9.description':
    'Ligeramente más ajustada que la normal — cabe más en pantalla.',
  'workbench.settings.def.appearance.uiScale.option.1.label': 'Normal (100%)',
  'workbench.settings.def.appearance.uiScale.option.1.description': 'Tamaño de chrome por defecto.',
  'workbench.settings.def.appearance.uiScale.option.1.1.label': 'Grande (110%)',
  'workbench.settings.def.appearance.uiScale.option.1.1.description':
    'Ligeramente ampliada para leer con más facilidad.',
  'workbench.settings.def.appearance.uiScale.option.1.25.label': 'Muy grande (125%)',
  'workbench.settings.def.appearance.uiScale.option.1.25.description':
    'Escala máxima del chrome — la mejor para la accesibilidad.',
  'workbench.settings.def.appearance.fontFamilyPreset.label': 'Familia de fuente de la interfaz',
  'workbench.settings.def.appearance.fontFamilyPreset.description':
    'Pilas sans-serif seleccionadas para el chrome de la aplicación. Por defecto Inter en Windows / Linux ' +
    'por coherencia multiplataforma, y System Sans en macOS para conservar el dimensionado óptico nativo de ' +
    'SF Pro. Todas las opciones vienen empaquetadas con la extensión. Las superficies de edición tienen su ' +
    'propio ajuste de fuente.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.inter.description':
    'Sans de interfaz empaquetada diseñada para pantallas — se muestra idéntica en todos los sistemas ' +
    'operativos, así que la aplicación luce igual en macOS, Windows y Linux.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.system.description':
    'Sans de interfaz por defecto del sistema operativo — San Francisco en macOS, Segoe UI en Windows, ' +
    'Roboto en Linux. Úsala si prefieres el aspecto nativo a costa de la coherencia multiplataforma.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.atkinson-hyperlegible.description':
    'Sans diseñada para la legibilidad con baja visión — sus letras distintivas reducen las confusiones ' +
    'entre caracteres. Empaquetada — siempre disponible.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.press-start-2p.description':
    'La fuente de estilo píxel que incluimos con la aplicación. Empaquetada — siempre disponible. Una ' +
    'elección lúdica: legible pero alta y ancha; los márgenes del chrome parecerán generosos.',
  'workbench.settings.def.appearance.density.label': 'Densidad de la interfaz',
  'workbench.settings.def.appearance.density.description':
    'El modo compacto reduce los márgenes en listas, tablas y formularios.',
  'workbench.settings.def.appearance.density.option.comfortable.label': 'Cómoda',
  'workbench.settings.def.appearance.density.option.compact.label': 'Compacta',
  'workbench.settings.def.appearance.editorHeaderPosition.label': 'Posición de la cabecera del editor',
  'workbench.settings.def.appearance.editorHeaderPosition.description':
    'Dónde ancla cada editor su fila de título y acciones (nombre, conmutador de activación, Guardar). Abajo ' +
    'aligera la parte superior del editor y mantiene las acciones principales cerca del contenido que editas.',
  'workbench.settings.def.appearance.editorHeaderPosition.option.top.label': 'Arriba',
  'workbench.settings.def.appearance.editorHeaderPosition.option.top.description':
    'Colocación clásica encima del contenido del editor.',
  'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.label': 'Abajo',
  'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.description':
    'Anclada bajo el contenido del editor, encima de la barra de estado.',
  'workbench.settings.def.appearance.clockFormat.label': 'Formato de la hora',
  'workbench.settings.def.appearance.clockFormat.description':
    'Cómo se muestran las marcas de tiempo en la aplicación (notificaciones, registros). Explícito porque la ' +
    'configuración regional del navegador sigue el idioma del navegador, no el formato regional de tu sistema.',
  'workbench.settings.def.appearance.clockFormat.option.24h.label': '24 horas',
  'workbench.settings.def.appearance.clockFormat.option.12h.label': '12 horas',
  'workbench.settings.def.appearance.accentColor.label': 'Color de acento',
  'workbench.settings.def.appearance.accentColor.description':
    'El color principal de botones, enlaces y realces activos. Solo se aplica a las variantes Por defecto — ' +
    'las variantes de contraste alto y teñidas fijan su propio acento.',

  // ── Workspace Layout category defs ─────────────────────────────────
  'workbench.settings.def.workspaceLayout.footerShowVersion.label': 'Mostrar la versión en el pie de página',
  'workbench.settings.def.workspaceLayout.footerShowVersion.description':
    'Muestra el número de versión de la extensión en la barra de estado del espacio de trabajo.',
  'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.label':
    'Mostrar el selector de tema en el pie de página',
  'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.description':
    'Muestra el desplegable de tema claro/oscuro/auto en la barra de estado del espacio de trabajo.',
  'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.label':
    'Mostrar los conmutadores de panel en la barra superior',
  'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.description':
    'Muestra los iconos de alternancia de los paneles izquierdo / inferior / derecho en la barra superior ' +
    'del espacio de trabajo.',
  'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.label':
    'Mostrar el menú de disposición en la barra superior',
  'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.description':
    'Muestra el menú de disposición (panel inferior a ancho completo, nombres de las ventanas de ' +
    'herramientas, disposición de la barra de actividad) en la barra superior del espacio de trabajo.',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.label': 'Alineación del panel inferior',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.description':
    'Dónde se coloca el panel inferior en el shell. Izquierda/derecha lo alinea bajo una barra lateral + el ' +
    'editor; centrado lo anida en la columna central; justificado abarca todo el ancho de la ventana.',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.label': 'Centrado',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.description':
    'Panel inferior anidado en la columna central',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.label': 'Izquierda',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.description':
    'El panel inferior abarca la barra lateral izquierda + el editor',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.label': 'Derecha',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.description':
    'El panel inferior abarca el editor + la barra lateral derecha',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.label': 'Justificado',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.description':
    'El panel inferior abarca todo el ancho de la ventana',
  'workbench.settings.def.workspaceLayout.showToolWindowLabels.label':
    'Mostrar los nombres de las ventanas de herramientas',
  'workbench.settings.def.workspaceLayout.showToolWindowLabels.description':
    'Muestra etiquetas de texto junto a los iconos de la barra de actividad y de las pestañas del dock. ' +
    'Desactívalo para un shell compacto de solo iconos.',
  'workbench.settings.def.workspaceLayout.activityBarWidthLeft.label': 'Ancho de la barra de actividad izquierda',
  'workbench.settings.def.workspaceLayout.activityBarWidthLeft.description':
    'Ancho de la barra de actividad izquierda cuando los nombres de las ventanas de herramientas están ' +
    'visibles. Bloqueado a 36px en modo solo iconos.',
  'workbench.settings.def.workspaceLayout.activityBarWidthRight.label': 'Ancho de la barra de actividad derecha',
  'workbench.settings.def.workspaceLayout.activityBarWidthRight.description':
    'Ancho de la barra de actividad derecha cuando los nombres de las ventanas de herramientas están ' +
    'visibles. Bloqueado a 36px en modo solo iconos.',
  'workbench.settings.def.workspaceLayout.sidebarLayout.label': 'Disposición de la barra de actividad',
  'workbench.settings.def.workspaceLayout.sidebarLayout.description':
    'Cómo reparte la barra de actividad los grupos de ventanas de herramientas superior e inferior.',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.label': 'Proporcional',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.description':
    'Los grupos superior e inferior se reparten la barra de actividad al 50/50',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.label': 'Compacta',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.description':
    'El grupo superior se ajusta al contenido; el inferior queda fijado abajo',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.label': 'Apilada',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.description':
    'Todos los grupos agrupados arriba con separadores entre ellos',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.label': 'Dinámica',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.description':
    'Los grupos de chips reflejan las alturas de sus paneles adyacentes. Los docks cerrados se pliegan al ' +
    'contenido y los vecinos activos absorben el espacio.',

  // ── Debug mode (inspection) category defs ──────────────────────────
  'workbench.settings.def.inspection.cdpEnabled.label': 'Modo de depuración',
  'workbench.settings.def.inspection.cdpEnabled.description':
    'Inspecciona y modifica solicitudes con la misma profundidad que las herramientas de desarrollo ' +
    'integradas de tu navegador — cargas de página, workers e iframes, no solo los fetch a nivel de página. ' +
    'El navegador muestra un aviso de depuración en cada pestaña adjunta mientras está activado; viene ' +
    'activado por defecto en Chrome y Edge, y puedes desactivarlo en cualquier momento.',
  'workbench.settings.def.inspection.cdpEnabled.capabilityUnavailableHint':
    'El modo de depuración está disponible en Chrome y Edge.',
  'workbench.settings.def.inspection.cdpScope.label': 'A qué pestañas adjuntarse',
  'workbench.settings.def.inspection.cdpScope.description':
    'A qué pestañas se adjunta el modo de depuración mientras está activado. «Donde DevTools está abierto» ' +
    'se adjunta a las pestañas del navegador con sus herramientas de desarrollo abiertas. «La pestaña con el ' +
    'foco» sigue a la pestaña activa del navegador sin necesitar las herramientas de desarrollo abiertas — ' +
    'cambiar a una pestaña nueva o a una página interna deja adjunta la pestaña anterior en lugar de dar ' +
    'bandazos. «Ambas» combina las dos. Las pestañas individuales del navegador también pueden fijarse desde ' +
    'el pie de página sea cual sea esta elección.',
  'workbench.settings.def.inspection.cdpScope.capabilityUnavailableHint':
    'El modo de depuración está disponible en Chrome y Edge.',
  'workbench.settings.def.inspection.cdpScope.option.devtools.label': 'Donde DevTools está abierto',
  'workbench.settings.def.inspection.cdpScope.option.devtools.description':
    'Las pestañas del navegador con sus herramientas de desarrollo abiertas.',
  'workbench.settings.def.inspection.cdpScope.option.active.label': 'La pestaña con el foco',
  'workbench.settings.def.inspection.cdpScope.option.active.description':
    'La pestaña activa del navegador, siguiendo el foco — sin necesidad de herramientas de desarrollo.',
  'workbench.settings.def.inspection.cdpScope.option.both.label': 'Ambas',
  'workbench.settings.def.inspection.cdpScope.option.both.description':
    'Las pestañas con DevTools y la pestaña con el foco.',

  // ── Code Editor category defs ──────────────────────────────────────
  'workbench.settings.def.editor.fontSize.label': 'Tamaño de fuente',
  'workbench.settings.def.editor.fontSize.description': 'Tamaño de fuente en píxeles de las superficies de edición.',
  'workbench.settings.def.editor.fontFamilyPreset.label': 'Familia de fuente',
  'workbench.settings.def.editor.fontFamilyPreset.description':
    'Pilas monoespaciadas seleccionadas para el editor. Todas las opciones vienen empaquetadas con la ' +
    'extensión — sin instalación en el sistema. Por defecto JetBrains Mono en Windows / Linux por coherencia ' +
    'multiplataforma, y System Mono en macOS para conservar el renderizado nativo de SF Mono.',
  'workbench.settings.def.editor.fontFamilyPreset.option.system.description':
    'Monoespaciada por defecto del sistema operativo — SF Mono en macOS, Consolas en Windows, Liberation ' +
    'Mono en Linux.',
  'workbench.settings.def.editor.fontFamilyPreset.option.fira-code.description':
    'Monoespaciada con ligaduras de programación. Empaquetada — siempre disponible.',
  'workbench.settings.def.editor.fontFamilyPreset.option.jetbrains-mono.description':
    'Monoespaciada afinada para editores, con ligaduras. Empaquetada — siempre disponible.',
  'workbench.settings.def.editor.fontFamilyPreset.option.cascadia-code.description':
    'Monoespaciada con ligaduras de programación. Empaquetada — siempre disponible.',
  'workbench.settings.def.editor.fontFamilyPreset.option.source-code-pro.description':
    'Monoespaciada de Adobe afinada para código. Empaquetada — siempre disponible.',
  'workbench.settings.def.editor.fontFamilyPreset.option.press-start-2p.description':
    'La fuente de estilo píxel que incluimos con la aplicación. Empaquetada — siempre disponible. Una ' +
    'elección lúdica: legible pero alta y ancha.',
  'workbench.settings.def.editor.fontLigatures.label': 'Ligaduras de fuente',
  'workbench.settings.def.editor.fontLigatures.description':
    'Activa las ligaduras de programación — combina secuencias de caracteres como `=>` o `!=` en glifos ' +
    'únicos. Requiere una fuente con ligaduras (p. ej. Fira Code, JetBrains Mono).',
  'workbench.settings.def.editor.lineHeight.label': 'Altura de línea',
  'workbench.settings.def.editor.lineHeight.description':
    'Altura de línea del editor en píxeles. 0 deja que el editor elija una altura proporcional al tamaño de ' +
    'fuente; los valores de 8 en adelante se interpretan como píxeles explícitos.',
  'workbench.settings.def.editor.tabSize.label': 'Tamaño de tabulación',
  'workbench.settings.def.editor.tabSize.description': 'Número de columnas que ocupa un carácter de tabulación.',
  'workbench.settings.def.editor.insertSpaces.label': 'Insertar espacios',
  'workbench.settings.def.editor.insertSpaces.description':
    'Inserta espacios en lugar de caracteres de tabulación al pulsar Tab.',
  'workbench.settings.def.editor.wordWrap.label': 'Ajuste de línea',
  'workbench.settings.def.editor.wordWrap.description':
    'Si las líneas largas saltan a la línea siguiente en el editor.',
  'workbench.settings.def.editor.wordWrap.option.off.label': 'Desactivado',
  'workbench.settings.def.editor.wordWrap.option.on.label': 'Ancho de la ventana',
  'workbench.settings.def.editor.wordWrap.option.bounded.label': 'Columna limitada',
  'workbench.settings.def.editor.wordWrapColumn.label': 'Columna de ajuste de línea',
  'workbench.settings.def.editor.wordWrapColumn.description':
    'Columna en la que se ajustan las líneas cuando el ajuste de línea está en Columna limitada.',
  'workbench.settings.def.editor.lineNumbers.label': 'Números de línea',
  'workbench.settings.def.editor.lineNumbers.description': 'Muestra los números de línea en el margen izquierdo.',
  'workbench.settings.def.editor.renderWhitespace.label': 'Mostrar los espacios en blanco',
  'workbench.settings.def.editor.renderWhitespace.description':
    'Muestra visualmente los caracteres de espacio en blanco.',
  'workbench.settings.def.editor.renderWhitespace.option.none.label': 'Ninguno',
  'workbench.settings.def.editor.renderWhitespace.option.boundary.label': 'Solo en los límites',
  'workbench.settings.def.editor.renderWhitespace.option.all.label': 'Todos',
  'workbench.settings.def.editor.formatOnSave.label': 'Formatear al guardar',
  'workbench.settings.def.editor.formatOnSave.description':
    'Formatea automáticamente el contenido del editor cuando guardas una regla o plantilla.',
  'workbench.settings.def.editor.bracketPairColorization.label': 'Coloreado de pares de corchetes',
  'workbench.settings.def.editor.bracketPairColorization.description':
    'Resalta los corchetes emparejados en colores distintos.',

  // ── API Requests category defs ─────────────────────────────────────
  'workbench.settings.def.requests.responseBodyCapMB.label': 'Límite del cuerpo de respuesta (MB)',
  'workbench.settings.def.requests.responseBodyCapMB.description':
    'Cuánto de un cuerpo de respuesta conserva el ejecutor para mostrarlo. Los cuerpos más grandes se ' +
    'truncan en este límite — el tamaño completo se sigue midiendo e informando. Subir el límite aumenta la ' +
    'memoria usada por cada pestaña de solicitud abierta.',
  'workbench.settings.def.requests.sseEventsNewestFirst.label': 'Eventos SSE: más recientes primero',
  'workbench.settings.def.requests.sseEventsNewestFirst.description':
    'Orden de la lista de Server-Sent Events — los eventos más recientes arriba. Desactívalo para leer del ' +
    'más antiguo al más reciente. La barra de herramientas de la lista cambia este mismo ajuste.',
  'workbench.settings.def.requests.sseEventsGroupByName.label': 'Eventos SSE: agrupar por nombre de evento',
  'workbench.settings.def.requests.sseEventsGroupByName.description':
    'Agrupa la lista de Server-Sent Events bajo cabeceras plegables por nombre de evento, conservando el ' +
    'orden de llegada dentro de cada grupo. La barra de herramientas de la lista cambia este mismo ajuste.',
  'workbench.settings.def.requests.sseEventsGroupRowLimit.label': 'Eventos SSE: filas por grupo',
  'workbench.settings.def.requests.sseEventsGroupRowLimit.description':
    'Al agrupar por nombre de evento, muestra solo este número de los eventos más recientes de cada grupo — ' +
    'la ventana se desliza a medida que llegan eventos nuevos, así que varios grupos permanecen observables ' +
    'a la vez. 0 muestra todos los eventos. La barra de herramientas de la lista cambia este mismo ajuste.',
  'workbench.settings.def.requests.grpcMessagesNewestFirst.label': 'Mensajes gRPC: más recientes primero',
  'workbench.settings.def.requests.grpcMessagesNewestFirst.description':
    'Orden de la cronología de mensajes gRPC — los mensajes más recientes arriba. Desactívalo para leer del ' +
    'más antiguo al más reciente. La barra de herramientas de la cronología cambia este mismo ajuste.',
  'workbench.settings.def.requests.grpcMessagesShowTypes.label': 'Mensajes gRPC: mostrar los tipos de mensaje',
  'workbench.settings.def.requests.grpcMessagesShowTypes.description':
    'Etiqueta cada fila de la cronología con su tipo de mensaje protobuf declarado. Desactivado por defecto ' +
    '— los tipos de un rpc son fijos por dirección, así que la insignia de dirección ya distingue las filas. ' +
    'La barra de herramientas de la cronología cambia este mismo ajuste.',
  'workbench.settings.def.requests.grpcMessagesGroupByType.label': 'Mensajes gRPC: agrupar por tipo de mensaje',
  'workbench.settings.def.requests.grpcMessagesGroupByType.description':
    'Agrupa la cronología de mensajes gRPC bajo cabeceras plegables por tipo de mensaje, conservando el ' +
    'orden de llegada dentro de cada grupo. La barra de herramientas de la cronología cambia este mismo ' +
    'ajuste.',
  'workbench.settings.def.requests.grpcMessagesGroupRowLimit.label': 'Mensajes gRPC: filas por grupo',
  'workbench.settings.def.requests.grpcMessagesGroupRowLimit.description':
    'Al agrupar por tipo de mensaje, muestra solo este número de los mensajes más recientes de cada grupo — ' +
    'la ventana se desliza a medida que llegan mensajes nuevos, así que varios grupos permanecen observables ' +
    'a la vez. 0 muestra todos los mensajes. La barra de herramientas de la cronología cambia este mismo ' +
    'ajuste.',
  'workbench.settings.def.requests.wsMessagesNewestFirst.label': 'Mensajes WebSocket: más recientes primero',
  'workbench.settings.def.requests.wsMessagesNewestFirst.description':
    'Orden de la cronología de mensajes WebSocket — los mensajes más recientes arriba. Desactívalo para leer ' +
    'del más antiguo al más reciente. La barra de herramientas de la cronología cambia este mismo ajuste.',
  'workbench.settings.def.requests.grpcSendInvalidMessage.label': 'gRPC: enviar los mensajes no válidos',
  'workbench.settings.def.requests.grpcSendInvalidMessage.description':
    'Cuando el mensaje gRPC no es JSON válido, invoca de todos modos con un mensaje vacío y deja responder ' +
    'al servidor — normalmente INVALID_ARGUMENT. Desactivado por defecto: la invocación falla antes del ' +
    'cable con el error de análisis exacto.',

  // ── Rules Engine category defs ─────────────────────────────────────
  'workbench.settings.def.rulesEngine.paused.label': 'Pausar la ejecución de las reglas',
  'workbench.settings.def.rulesEngine.paused.description':
    'Deja de aplicar las reglas a las solicitudes de red en vivo. Las reglas siguen siendo editables.',
  'workbench.settings.def.rulesEngine.evaluationStrategy.label': 'Estrategia de evaluación',
  'workbench.settings.def.rulesEngine.evaluationStrategy.description':
    'Cómo elige el motor entre las reglas cuando varias coinciden con la misma solicitud.',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.label': 'Primera coincidencia',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.description':
    'Usar la primera regla en orden de prioridad',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.label': 'Coincidencia más cercana',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.description':
    'Preferir la regla coincidente más específica',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.label': 'Todas las coincidencias',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.description':
    'Aplicar todas las reglas coincidentes en orden',
  'workbench.settings.def.rulesEngine.updateDebounceMs.label': 'Debounce de las actualizaciones',
  'workbench.settings.def.rulesEngine.updateDebounceMs.description':
    'Retraso (ms) antes de que las ediciones de reglas se envíen a declarativeNetRequest.',
  'workbench.settings.def.rulesEngine.maxActiveRules.label': 'Máximo de reglas activas',
  'workbench.settings.def.rulesEngine.maxActiveRules.description':
    'Número máximo de reglas compiladas a la vez en el conjunto de reglas dinámico.',
  'workbench.settings.def.rulesEngine.visibleResourceTypes.label': 'Tipos de recursos visibles',
  'workbench.settings.def.rulesEngine.visibleResourceTypes.description':
    'Qué tipos de recursos de solicitud aparecen en la vista Esta página del popup. Todo se recopila ' +
    'siempre; esto solo cambia lo que muestra la interfaz. La fila de chips integrada del popup escribe en ' +
    'este mismo ajuste.',
  'workbench.settings.def.rulesEngine.showShadowWarnings.label': 'Mostrar las advertencias de ocultación',
  'workbench.settings.def.rulesEngine.showShadowWarnings.description':
    'Resalta las reglas cuyo efecto queda ocultado por una regla de prioridad superior (bloqueo, ' +
    'redirección, mock, retraso o conflicto de apilamiento de encabezados).',
  'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.label': 'Advertir con conjuntos de reglas grandes',
  'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.description':
    'Muestra una advertencia cuando el número de reglas activas se acerca al tope del navegador.',
  'workbench.settings.def.rulesEngine.largeRuleSetThreshold.label': 'Umbral de conjunto de reglas grande',
  'workbench.settings.def.rulesEngine.largeRuleSetThreshold.description':
    'Número de reglas activas a partir del cual se dispara la advertencia.',
  'workbench.settings.def.rulesEngine.liveRulesMode.label': 'Modo de reglas en vivo',
  'workbench.settings.def.rulesEngine.liveRulesMode.description':
    'Inyecta Cache-Control: no-cache en cada solicitud que coincide con una de tus reglas, forzando la ' +
    'revalidación con el servidor para que el efecto de la regla se aplique siempre en fresco. Evita que ' +
    'respuestas en caché obsoletas oculten una regla — útil cuando el valor de una regla cambia (como un ' +
    'token de autenticación) pero la página sigue sirviendo la respuesta antigua desde la caché.',
  'workbench.settings.def.rulesEngine.bypassHttpCache.label': 'Omitir la caché HTTP',
  'workbench.settings.def.rulesEngine.bypassHttpCache.description':
    'Añade Cache-Control: no-cache a cada solicitud de la pestaña inspeccionada — fuerza la revalidación con ' +
    'el servidor. El alcance es solo la caché HTTP; el propio Disable Cache de Chrome (pestaña Network) ' +
    'omite además la caché de memoria del renderizador. Las solicitudes que coinciden con una regla siempre ' +
    'se mantienen frescas automáticamente gracias al modo de reglas en vivo.',
  'workbench.settings.def.rulesEngine.variableAutocomplete.label': 'Autocompletado de variables',
  'workbench.settings.def.rulesEngine.variableAutocomplete.description':
    'Sugiere referencias `{{env.X}}` / `{{vault.X}}` / `{{live.X}}` / `{{workspace.X}}` / `{{collection.X}}` ' +
    '/ `{{step.X.Y}}` mientras escribes. Se abre con `{{` en cualquier campo de valor de regla y en los ' +
    'editores de cuerpo JSON/GraphQL/XML/texto plano. Desactívalo si prefieres editar en texto plano.',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.label': 'Estrategia de URL de los borradores',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.description':
    'Cómo las reglas prerrellenadas desde el Inspector de DevTools convierten una URL capturada en un patrón ' +
    'url-filter. Exacta (por defecto) conserva la URL literal para que la regla coincida solo con la ' +
    'solicitud inspeccionada. Comodín de ruta reemplaza el último segmento de la ruta por * para que ' +
    'coincidan los recursos hermanos. Solo el host amplía a todo el dominio.',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.label': 'URL exacta',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.description':
    'Coincidir con esta URL literal, normalizada (recomendado)',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.label': 'Comodín de ruta',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.description':
    'Poner un comodín en el último segmento de la ruta',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.label': 'Solo el host',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.description':
    'Coincidir con todas las solicitudes del host',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.label': 'URL en bruto',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.description':
    'Coincidir con esta URL literal sin normalización',

  // ── Workspace Sharing category defs ────────────────────────────────
  'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.label':
    'Mostrar la estrategia de fusión en las filas de la vista previa de importación',
  'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.description':
    'Cuando está activado, cada fila de entidad en la barra lateral izquierda de la vista previa de ' +
    'importación muestra la estrategia de fusión elegida (Añadir como nuevo, Reemplazar el existente, ' +
    'Omitir, …) junto a los recuentos de líneas. Desactívalo para liberar ancho de fila en los paneles ' +
    'estrechos.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.label':
    'Visor de diff de la vista previa de importación',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.description':
    'Muestra destino y entrante lado a lado o apilados en línea. Cambia automáticamente a unificado cuando ' +
    'el panel del diff es demasiado estrecho.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.side-by-side.label': 'Lado a lado',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.unified.label': 'Unificado',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.label':
    'Tratamiento de los espacios en el diff de la vista previa de importación',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.description':
    'Si el diff trata los cambios de solo espacios como ediciones o los oculta.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.none.label': 'No ignorar',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.ignore.label': 'Ignorar los espacios',
  'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.label':
    'Plegar las regiones sin cambios en el diff de la vista previa de importación',
  'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.description':
    'Oculta las series de líneas sin cambios y las reemplaza por un tramo que se expande al hacer clic.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.label':
    'Mostrar los caracteres de espacio en el diff de la vista previa de importación',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.description':
    'Muestra los espacios y tabulaciones como glifos visibles (·, →) en el diff.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.label':
    'Mostrar los números de línea en el diff de la vista previa de importación',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.description':
    'Muestra la columna de números de línea junto a cada lado del diff.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.label':
    'Mostrar las guías de sangría en el diff de la vista previa de importación',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.description':
    'Muestra guías de sangría verticales para recorrer más fácilmente el anidamiento YAML.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.label':
    'Ajustar las líneas largas en el diff de la vista previa de importación',
  'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.description':
    'Ajusta las líneas largas a la siguiente línea visual en lugar de desplazarse horizontalmente.',

  // ── Data category defs ─────────────────────────────────────────────
  'workbench.settings.def.data.logLevel.label': 'Nivel de registro',
  'workbench.settings.def.data.logLevel.description':
    'Verbosidad del registrador de la extensión. Los niveles superiores incluyen todos los niveles por ' +
    'encima de ellos.',
  'workbench.settings.def.data.logLevel.option.error.label': 'Error',
  'workbench.settings.def.data.logLevel.option.error.description': 'Solo los fallos',
  'workbench.settings.def.data.logLevel.option.warn.label': 'Warn',
  'workbench.settings.def.data.logLevel.option.warn.description': 'Anomalías y reintentos',
  'workbench.settings.def.data.logLevel.option.info.label': 'Info',
  'workbench.settings.def.data.logLevel.option.info.description': 'Eventos operativos',
  'workbench.settings.def.data.logLevel.option.debug.label': 'Debug',
  'workbench.settings.def.data.logLevel.option.debug.description': 'Detalles internos verbosos',
  'workbench.settings.def.data.exportSettings.label': 'Exportar los ajustes',
  'workbench.settings.def.data.exportSettings.description': 'Descarga todos los ajustes como archivo JSON.',
  'workbench.settings.def.data.exportSettings.action.label': 'Exportar',
  'workbench.settings.def.data.importSettings.label': 'Importar los ajustes',
  'workbench.settings.def.data.importSettings.description':
    'Carga los ajustes desde un archivo JSON exportado previamente.',
  'workbench.settings.def.data.importSettings.action.label': 'Importar…',
  'workbench.settings.def.data.exportObservabilityLog.label': 'Exportar el registro de diagnóstico',
  'workbench.settings.def.data.exportObservabilityLog.description':
    'Descarga los últimos 500 eventos estructurados (recompilaciones de reglas, errores de solicitudes, ' +
    'cambios de espacio de trabajo) como JSON. Solo local; nada sale del dispositivo salvo que tú mismo ' +
    'adjuntes el archivo a un informe de error.',
  'workbench.settings.def.data.exportObservabilityLog.action.label': 'Exportar el registro',
  'workbench.settings.def.data.clearObservabilityLog.label': 'Borrar el registro de diagnóstico',
  'workbench.settings.def.data.clearObservabilityLog.description':
    'Descarta todos los eventos almacenados. No afecta a las reglas, las solicitudes ni a ningún dato del ' +
    'espacio de trabajo.',
  'workbench.settings.def.data.clearObservabilityLog.action.label': 'Borrar',
  'workbench.settings.def.data.clearObservabilityLog.confirm':
    '¿Borrar el registro de diagnóstico? Esto descarta todos los eventos almacenados.',
  'workbench.settings.def.data.exportImportReports.label': 'Exportar los informes de importación',
  'workbench.settings.def.data.exportImportReports.description':
    'Descarga los informes estructurados de descartes/transformaciones de cada importación (curl hoy; HAR / ' +
    'Postman / Insomnia después) como JSON. Vive por espacio de trabajo — las 50 importaciones más recientes ' +
    'por espacio de trabajo. Nunca sale del dispositivo salvo que adjuntes el archivo.',
  'workbench.settings.def.data.exportImportReports.action.label': 'Exportar los informes',
  'workbench.settings.def.data.clearImportReports.label': 'Borrar los informes de importación',
  'workbench.settings.def.data.clearImportReports.description':
    'Descarta todos los informes de importación del espacio de trabajo activo. No afecta a las solicitudes ' +
    'en sí — solo al registro de auditoría de lo descartado/transformado durante la importación.',
  'workbench.settings.def.data.clearImportReports.action.label': 'Borrar',
  'workbench.settings.def.data.clearImportReports.confirm':
    '¿Borrar los informes de importación de este espacio de trabajo? Esto no se puede deshacer.',
  'workbench.settings.def.data.uploadFile.label': 'Subir un archivo',
  'workbench.settings.def.data.uploadFile.description':
    'Añade un archivo al espacio de trabajo activo para usarlo en cuerpos multipart y referencias ' +
    '`{{file.X}}`. Los archivos se direccionan por contenido (sha256), así que volver a subir los mismos ' +
    'bytes sigue siendo un solo blob. El almacenamiento es el IndexedDB local; nada sale del dispositivo.',
  'workbench.settings.def.data.uploadFile.action.label': 'Subir…',
  'workbench.settings.def.data.exportFilesManifest.label': 'Exportar el manifiesto de archivos',
  'workbench.settings.def.data.exportFilesManifest.description':
    'Descarga la lista de archivos del espacio de trabajo activo (nombre, hash, tamaño, tipo MIME) como ' +
    'JSON. Los bytes NO se incluyen — es un manifiesto para la auditoría y la resubida por compañeros, no ' +
    'una copia de seguridad del contenido.',
  'workbench.settings.def.data.exportFilesManifest.action.label': 'Exportar el manifiesto',
  'workbench.settings.def.data.filesBrowser.label': 'Archivos',
  'workbench.settings.def.data.filesBrowser.description':
    'Todos los blobs subidos al espacio de trabajo activo. Descarga los bytes, copia el hash corto o ' +
    'elimina. Los metadatos de archivo (nombre, tamaño, tipo MIME, hash) se pueden buscar en el índice de ' +
    'la configuración.',
  'workbench.settings.def.data.clearAllFiles.label': 'Borrar todos los archivos',
  'workbench.settings.def.data.clearAllFiles.description':
    'Elimina todos los blobs de archivo del espacio de trabajo activo. Las solicitudes que referencian ' +
    'estos archivos mediante partes multipart darán error al ejecutarse; tendrás que volver a subir los ' +
    'archivos o editar esas solicitudes.',
  'workbench.settings.def.data.clearAllFiles.action.label': 'Borrar todo',
  'workbench.settings.def.data.clearAllFiles.confirm':
    '¿Eliminar todos los archivos de este espacio de trabajo? Las partes multipart que los referencian ' +
    'darán error al enviar.',
  'workbench.settings.def.data.resetAllSettings.label': 'Restablecer todos los ajustes',
  'workbench.settings.def.data.resetAllSettings.description':
    'Devuelve cada ajuste de cada categoría a su valor por defecto.',
  'workbench.settings.def.data.resetAllSettings.action.label': 'Restablecer los valores por defecto',
  'workbench.settings.def.data.resetAllSettings.confirm':
    '¿Restablecer cada ajuste a su valor por defecto? Esto no se puede deshacer.',

  // ── Updates defs (About category) ──────────────────────────────────
  'workbench.settings.def.updates.state.label': 'Actualización de software',
  'workbench.settings.def.updates.state.description':
    'Estado actual de la actualización. Descargar e instalar siempre requieren tu clic explícito.',
  'workbench.settings.def.updates.check.label': 'Buscar actualizaciones',
  'workbench.settings.def.updates.check.description':
    'Busca versiones nuevas una vez al día y muestra un punto de notificación cuando hay una disponible. La ' +
    'comprobación no descarga nada y no envía nada sobre ti ni sobre esta instalación — lee una lista ' +
    'pública de versiones y compara localmente. «Solo correcciones de seguridad» permanece en silencio ' +
    'salvo que una versión corrija un problema de seguridad que afecte a la versión que ejecutas. Las ' +
    'actualizaciones nunca se instalan sin tu acción explícita.',
  'workbench.settings.def.updates.check.option.all.label': 'Todas las versiones',
  'workbench.settings.def.updates.check.option.security-only.label': 'Solo correcciones de seguridad',
  'workbench.settings.def.updates.check.option.off.label': 'Desactivado',
  'workbench.settings.def.updates.channel.label': 'Canal de actualización',
  'workbench.settings.def.updates.channel.description':
    'Qué línea de versiones siguen las comprobaciones. Beta recibe las novedades antes pero puede estar ' +
    'menos pulida. Volver a Estable nunca degrada — conservas la versión instalada hasta que la siguiente ' +
    'versión estable la supere. Los avisos de seguridad siguen siempre la línea estable en ambos canales.',
  'workbench.settings.def.updates.channel.option.stable.label': 'Estable',
  'workbench.settings.def.updates.channel.option.beta.label': 'Beta',
  'workbench.settings.def.updates.showWhatsNew.label': 'Mostrar las novedades tras actualizar',
  'workbench.settings.def.updates.showWhatsNew.description':
    'Abre una pestaña con lo más destacado de la versión la primera vez que abres el workbench tras una ' +
    'versión con funciones nuevas. Las versiones de parche nunca la abren — se quedan en la cronología de ' +
    'notificaciones. Las notas van incluidas en la aplicación; no se descarga nada.',
  'workbench.settings.def.updates.autoDownload.label': 'Descargar las actualizaciones automáticamente',
  'workbench.settings.def.updates.autoDownload.description':
    'Cuando se encuentra una actualización, la recupera enseguida en segundo plano para que instalar sea un ' +
    'solo reinicio — útil si quieres las correcciones preparadas cuanto antes. Desactivado, haces clic en ' +
    'Descargar tú mismo. En ambos casos, nada se instala hasta que reinicias la aplicación o lo decides.',

  // ── About category defs ────────────────────────────────────────────
  'workbench.settings.def.about.version.label': 'Versión',
  'workbench.settings.def.about.version.description': 'La versión de la extensión instalada actualmente.',
  'workbench.settings.def.about.build.label': 'Build',
  'workbench.settings.def.about.build.description': 'Número y fecha del build.',
  'workbench.settings.def.about.commit.label': 'Commit',
  'workbench.settings.def.about.commit.description': 'Commit de git del que se produjo este build.',
  'workbench.settings.def.about.protocol.label': 'Protocolo',
  'workbench.settings.def.about.protocol.description':
    'Versión del protocolo de cable que esta extensión habla con la aplicación de escritorio. Los pares con ' +
    'versiones desacompasadas se rechazan con un aviso claro de actualización.',
  'workbench.settings.def.about.browser.label': 'Navegador',
  'workbench.settings.def.about.browser.description': 'Navegador y plataforma detectados.',
} as const satisfies Catalog;
