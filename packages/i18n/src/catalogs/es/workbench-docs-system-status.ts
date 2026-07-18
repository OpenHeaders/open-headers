/**
 * Workbench Docs panel — the System Status section body — Spanish.
 * Mirrors `catalogs/en/workbench-docs-system-status.ts` key for key.
 * Subsystem wire literals, state tokens, and the popover status
 * messages the doc quotes (Connected to desktop, N workflows fresh, …)
 * ride RAW — they are untranslated wire output, same class as the
 * quoted browser phrasing law. Subsystem display names copy the
 * shipped `shared-chrome.ts` es labels (`Sincronización`, `Reglas`,
 * `Solicitudes`, `Permisos`, `Secretos`, `Live`, `Estado del
 * sistema`). `Enviar` (Send button) and the settings path
 * `Configuración → Datos → Exportar el registro de diagnóstico` are
 * minted here — the editors-request and settings es files must reuse
 * them. Workbench in prose = editor del espacio de trabajo (the
 * shared-components mint); wake = reactivación (shared-chrome).
 */

import type { Catalog } from '../../types';

export const workbenchDocsSystemStatus = {
  // ── Concepts: System Status ─────────────────────────────────────────
  'workbench.docs.body.systemStatus.term': 'El estado del sistema',
  'workbench.docs.body.systemStatus.intro1':
    'es una instantánea en vivo de la salud de la extensión. El pie de página del editor del espacio de ' +
    'trabajo lo muestra como una fila de seis píldoras — una píldora por subsistema, cada una con su propio ' +
    'punto de color. El popup y el panel lateral lo pliegan en una sola entrada',
  'workbench.docs.body.systemStatus.intro1Suffix':
    'en su pie de página inferior, con el color del punto siguiendo al subsistema en peor estado.',
  'workbench.docs.body.systemStatus.workbenchCaption':
    'En el editor del espacio de trabajo, la fila está en el pie de página, con una píldora por subsistema.',
  'workbench.docs.body.systemStatus.popupCaption':
    'Haz clic en el icono de la barra de herramientas y el mismo estado aparece como una única píldora ' +
    'etiquetada en el pie de página del popup.',
  'workbench.docs.body.systemStatus.worstLevel1':
    'Cada subsistema informa de un solo estado y gana el peor nivel: rojo > amarillo > verde. Un solo rojo en ' +
    'cualquier parte pone rojo el punto compuesto.',
  'workbench.docs.body.systemStatus.worstLevelCaption':
    'Seis estados de subsistema se pliegan en un compuesto vía max — el rojo gana al amarillo, que gana al ' + 'verde.',
  'workbench.docs.body.systemStatus.popover1':
    'Hacer clic en cualquier píldora abre el mismo popover de detalles. Las filas vienen en dos grupos: ' +
    'primero las grises (sin eventos todavía en esta vida del service worker) y después las de color (han ' +
    'informado al menos una vez). Dentro de cada grupo se conserva el orden canónico de los subsistemas. El ' +
    'historial completo vive en el registro de observabilidad — expórtalo desde',
  'workbench.docs.body.systemStatus.settingsExportPath': 'Configuración → Datos → Exportar el registro de diagnóstico',
  'workbench.docs.body.systemStatus.popover1Suffix': '.',
  'workbench.docs.body.systemStatus.popoverCaption':
    'Las grises encima del separador, las de color debajo; al primer informe, una fila migra una sola vez.',
  'workbench.docs.body.systemStatus.stateGreenLabel': 'verde',
  'workbench.docs.body.systemStatus.stateYellowLabel': 'amarillo',
  'workbench.docs.body.systemStatus.stateRedLabel': 'rojo',
  'workbench.docs.body.systemStatus.syncName': 'Sincronización',
  'workbench.docs.body.systemStatus.syncSubtitle': 'Conexión con la aplicación de escritorio',
  'workbench.docs.body.systemStatus.sync1Prefix':
    'Refleja la conexión WebSocket entre el service worker de la extensión y la aplicación de escritorio ' +
    'OpenHeaders que corre en tu máquina. El enlace es solo loopback (',
  'workbench.docs.body.systemStatus.sync1Suffix':
    ') y transporta variables dinámicas, datos de espacios de trabajo de equipo y presencia — nada sale de tu ' +
    'dispositivo.',
  'workbench.docs.body.systemStatus.syncTopologyCaption':
    'Un único WebSocket entre la extensión y la aplicación de escritorio en localhost.',
  'workbench.docs.body.systemStatus.sync2':
    'La píldora refleja el estado de conexión en vivo. Una caída dispara reconexiones con retroceso ' +
    'exponencial; pings periódicos detectan las desconexiones silenciosas detrás de proxies corporativos ' +
    'estrictos.',
  'workbench.docs.body.systemStatus.syncLifecycleCaption':
    'Disabled y Connected son verdes; Connecting, Reconnecting y URL rejected son amarillos.',
  'workbench.docs.body.systemStatus.syncGreenConnected': 'Connected to desktop',
  'workbench.docs.body.systemStatus.syncGreenMiddle': '(el handshake tuvo éxito) o',
  'workbench.docs.body.systemStatus.syncGreenDisabled': 'Desktop sync disabled',
  'workbench.docs.body.systemStatus.syncGreenSuffix': '(conexión automática desactivada).',
  'workbench.docs.body.systemStatus.syncYellowConnecting': 'Connecting…',
  'workbench.docs.body.systemStatus.syncYellowReconnecting': 'Reconnecting (attempt N)',
  'workbench.docs.body.systemStatus.syncYellowOr': ', o',
  'workbench.docs.body.systemStatus.syncYellowRejected': 'Desktop URL rejected by settings',
  'workbench.docs.body.systemStatus.syncYellowSuffix': '.',
  'workbench.docs.body.systemStatus.syncRed':
    'Reservado para fallos fatales de la sincronización con el escritorio; ningún camino del código lo emite ' + 'hoy.',
  'workbench.docs.body.systemStatus.rulesName': 'Reglas',
  'workbench.docs.body.systemStatus.rulesSubtitle': 'Motor declarativeNetRequest',
  'workbench.docs.body.systemStatus.rules1Prefix':
    'Informa de cada reconstrucción DNR. Cada guardado hace pasar tu regla por cuatro etapas antes de entrar ' +
    'en vigor: compilar a JSON DNR, resolver las referencias',
  'workbench.docs.body.systemStatus.rules1Middle':
    ', hacer cumplir el límite de reglas activas y luego aplicar en Chrome vía',
  'workbench.docs.body.systemStatus.rules1Suffix':
    '— la API del navegador. Cada etapa puede cambiar la píldora de estado.',
  'workbench.docs.body.systemStatus.rulesPipelineCaption':
    'Cuatro etapas — cada una puede emitir un nivel de estado si se tuerce.',
  'workbench.docs.body.systemStatus.rules2':
    'El número de reglas activas se corresponde con un estado en una barra de capacidad de tres zonas. Las ' +
    'reglas por encima del límite se descartan en orden de coincidencia (gana la de arriba), y el mensaje ' +
    'amarillo lleva el número de descartadas.',
  'workbench.docs.body.systemStatus.rulesCapacityCaption':
    'Verde hasta el umbral de aviso, amarillo hasta el límite, rojo más allá — pero el truncado te mantiene ' +
    'fuera de la zona roja en tiempo de ejecución.',
  'workbench.docs.body.systemStatus.rulesGreenActive': 'N active DNR rule(s)',
  'workbench.docs.body.systemStatus.rulesGreenOr': 'o',
  'workbench.docs.body.systemStatus.rulesGreenPaused': 'Rule execution paused',
  'workbench.docs.body.systemStatus.rulesGreenSuffix': '.',
  'workbench.docs.body.systemStatus.rulesYellowPrefix': 'Referencias',
  'workbench.docs.body.systemStatus.rulesYellowRefs': 'sin resolver (',
  'workbench.docs.body.systemStatus.rulesYellowMsgUnresolved': 'N unresolved variables in M rules',
  'workbench.docs.body.systemStatus.rulesYellowMiddle': '), se superó el límite de reglas (',
  'workbench.docs.body.systemStatus.rulesYellowMsgDropped': 'Dropped N rules over cap',
  'workbench.docs.body.systemStatus.rulesYellowMiddle2': '), o te estás acercando a la capacidad DNR (',
  'workbench.docs.body.systemStatus.rulesYellowMsgCapacity': 'Approaching DNR capacity (N ≥ threshold)',
  'workbench.docs.body.systemStatus.rulesYellowSuffix': ').',
  'workbench.docs.body.systemStatus.rulesRedPrefix':
    'Fallo de transporte — Chrome rechazó la actualización de reglas dinámicas o de sesión (',
  'workbench.docs.body.systemStatus.rulesRedMsg': 'Failed to apply [dynamic|session] DNR rules',
  'workbench.docs.body.systemStatus.rulesRedSuffix': ').',
  'workbench.docs.body.systemStatus.requestsName': 'Solicitudes',
  'workbench.docs.body.systemStatus.requestsSubtitle': 'Ejecutor de solicitudes de API',
  'workbench.docs.body.systemStatus.requests1Prefix':
    'Refleja la última solicitud de API ad hoc lanzada desde el botón',
  'workbench.docs.body.systemStatus.requestsSend': 'Enviar',
  'workbench.docs.body.systemStatus.requests1Middle': 'del editor de solicitudes. La píldora se pone verde con',
  'workbench.docs.body.systemStatus.requestsAny': 'cualquier',
  'workbench.docs.body.systemStatus.requests1Suffix':
    'respuesta HTTP — incluidas 4xx y 5xx — porque «la solicitud terminó» es una pregunta distinta de «al ' +
    'servidor le gustó». Solo los fallos a nivel de red sin respuesta la ponen amarilla.',
  'workbench.docs.body.systemStatus.requestsOutcomesCaption':
    'Cualquier código de estado = verde. El amarillo se reserva para fallos sin respuesta de vuelta.',
  'workbench.docs.body.systemStatus.requests2Prefix':
    'El tráfico en segundo plano no actualiza esta píldora: las actualizaciones de workflows Live pasan',
  'workbench.docs.body.systemStatus.requests2Suffix':
    ', y las solicitudes de las páginas web pasan por el motor de Reglas, no por el ejecutor.',
  'workbench.docs.body.systemStatus.requestsScopeCaption':
    'Solo el tráfico ad hoc del botón Enviar da forma a esta píldora — todo lo demás permanece en silencio.',
  'workbench.docs.body.systemStatus.requestsGreenLabel': 'Last request:',
  'workbench.docs.body.systemStatus.requestsGreenMiddle': '— cualquier respuesta HTTP (p. ej.',
  'workbench.docs.body.systemStatus.requestsGreenSuffix': ').',
  'workbench.docs.body.systemStatus.requestsYellowLabel': 'Last request failed:',
  'workbench.docs.body.systemStatus.requestsYellowMiddle':
    '— fallo a nivel de red antes de cualquier respuesta (p. ej.',
  'workbench.docs.body.systemStatus.requestsYellowSuffix': ', sin conexión/DNS).',
  'workbench.docs.body.systemStatus.permissionsName': 'Permisos',
  'workbench.docs.body.systemStatus.permissionsSubtitle': 'Auditoría de permisos de host',
  'workbench.docs.body.systemStatus.permissions1Prefix':
    'Las reglas DNR y los scripts de contenido que apuntan a un host revocado desde',
  'workbench.docs.body.systemStatus.permissions1Middle':
    'no dan error — simplemente no hacen nada en silencio. Todo el trabajo de esta auditoría es sacar a la ' +
    'luz ese estado oculto; de lo contrario pasarías 30 minutos depurando una regla que',
  'workbench.docs.body.systemStatus.permissionsLooks': 'parece',
  'workbench.docs.body.systemStatus.permissions1Suffix': 'correcta.',
  'workbench.docs.body.systemStatus.permissionsImpactCaption':
    'Concedido: la regla se dispara. Restringido: la regla no hace nada en silencio y el encabezado nunca ' + 'llega.',
  'workbench.docs.body.systemStatus.permissions2Prefix': 'La auditoría consulta',
  'workbench.docs.body.systemStatus.permissions2Suffix':
    'en cada reactivación del service worker. MV3 no tiene observador de cambios de permisos en Chromium, ' +
    'así que consultar en la reactivación es la señal más barata disponible.',
  'workbench.docs.body.systemStatus.permissionsAuditCaption':
    'Una llamada, tres ramas — verde si concedidos, rojo si restringidos, amarillo si la propia llamada a la ' +
    'API falla.',
  'workbench.docs.body.systemStatus.permissionsGreenLabel': 'All host permissions granted',
  'workbench.docs.body.systemStatus.permissionsGreenSuffix': 'sigue dentro del alcance.',
  'workbench.docs.body.systemStatus.permissionsYellowLabel': 'Could not audit host permissions',
  'workbench.docs.body.systemStatus.permissionsYellowMiddle': '— inusual; el navegador no expuso',
  'workbench.docs.body.systemStatus.permissionsYellowSuffix': '.',
  'workbench.docs.body.systemStatus.permissionsRedLabel': 'Host permissions narrowed',
  'workbench.docs.body.systemStatus.permissionsRedMiddle':
    '— algunas reglas no harán nada en silencio en los hosts revocados hasta que el acceso se restaure desde',
  'workbench.docs.body.systemStatus.permissionsRedSuffix': '.',
  'workbench.docs.body.systemStatus.secretsName': 'Secretos',
  'workbench.docs.body.systemStatus.secretsSubtitle': 'Integridad del vault',
  'workbench.docs.body.systemStatus.secrets1Prefix': 'Sigue el blob cifrado del vault por espacio de trabajo en',
  'workbench.docs.body.systemStatus.secrets1Suffix':
    '. En cada reactivación del service worker, cada secreto almacenado se valida contra el esquema actual; ' +
    'las entradas que fallan la validación se descartan del vault en memoria y la píldora se pone amarilla ' +
    'hasta que se vuelvan a guardar.',
  'workbench.docs.body.systemStatus.vaultHydrationCaption':
    'La hidratación carga el blob; el validador de esquema conserva las entradas conformes, descarta las ' +
    'derivas e informa de amarillo.',
  'workbench.docs.body.systemStatus.secrets2':
    '«Deriva» suele significar que una entrada almacenada fue escrita por un build más antiguo (falta un ' +
    'campo ahora obligatorio, o un campo tiene el tipo equivocado). El trabajo del validador es fallar con ' +
    'ruido — heredar en silencio formas desconocidas es lo que causa el bug seis versiones después.',
  'workbench.docs.body.systemStatus.vaultDriftCaption':
    'Los mismos dos campos lado a lado: una entrada válida frente a una entrada con deriva, con un cipher ' +
    'ausente y un createdAt mal tipado.',
  'workbench.docs.body.systemStatus.secretsGreen':
    'Por defecto — ningún evento de deriva de esquema en esta vida del service worker.',
  'workbench.docs.body.systemStatus.secretsYellowLabel': 'Schema drift: dropped entry from',
  'workbench.docs.body.systemStatus.secretsYellowMiddle':
    '— al menos una entrada almacenada del vault no coincidía con la forma actual y se descartó en la ' +
    'hidratación. Volver a guardarla desde el editor del Vault la restaura.',
  'workbench.docs.body.systemStatus.secretsRed':
    'Reservado para fallos de descifrado; ningún camino del código lo emite hoy.',
  'workbench.docs.body.systemStatus.liveName': 'Live',
  'workbench.docs.body.systemStatus.liveSubtitle': 'Actualización de workflows de variables Live',
  'workbench.docs.body.systemStatus.live1Prefix':
    'Cada workflow Live se actualiza a su propia cadencia. El estado por workflow depende de tres ' +
    'comprobaciones: si el último extractor tuvo éxito, si la ejecución está dentro de',
  'workbench.docs.body.systemStatus.live1Suffix':
    'de su cadencia, y cuántos fallos seguidos ha tenido. Los tres estados se pliegan en la píldora vía «el ' +
    'peor gana».',
  'workbench.docs.body.systemStatus.liveFreshnessCaption':
    'Fresh = ejecución limpia · stale = pasado 2× la cadencia o 1–4 fallos · failing = ≥ 5 fallos ' + 'consecutivos.',
  'workbench.docs.body.systemStatus.live2Prefix': 'Solo los workflows de',
  'workbench.docs.body.systemStatus.liveActiveWorkspace': 'el espacio de trabajo activo',
  'workbench.docs.body.systemStatus.live2Suffix':
    'contribuyen. Los espacios de trabajo inactivos quedan excluidos — ahora mismo no puedes ver esas reglas ' +
    'ni actuar sobre ellas, así que señalarlas haría aflorar ruido fuera de tu alcance. Cambiar de espacio ' +
    'de trabajo recalcula la píldora con el nuevo conjunto activo.',
  'workbench.docs.body.systemStatus.liveAggregationCaption':
    'Los workflows del espacio de trabajo activo se pliegan en una píldora vía max(); los demás espacios de ' +
    'trabajo se omiten.',
  'workbench.docs.body.systemStatus.liveGreenLabel': 'N workflows fresh',
  'workbench.docs.body.systemStatus.liveGreenMiddle':
    '— la última ejecución de cada workflow del espacio activo fue OK y dentro de 2× su cadencia. También se ' +
    'muestra como',
  'workbench.docs.body.systemStatus.liveGreenNone': 'No workflows configured',
  'workbench.docs.body.systemStatus.liveGreenSuffix': 'cuando no hay ninguno.',
  'workbench.docs.body.systemStatus.liveYellowLabel': 'N workflows stale or failing',
  'workbench.docs.body.systemStatus.liveYellowMiddle':
    '— al menos una ejecución supera 2× la cadencia, el último extractor falló, o hay 1–4 fallos consecutivos.',
  'workbench.docs.body.systemStatus.liveRedLabel': 'N workflows failing (5+ consecutive)',
  'workbench.docs.body.systemStatus.liveRedMiddle':
    '— un workflow cruzó cinco fallos consecutivos y ahora se considera en fallo.',
  'workbench.docs.body.systemStatus.desktopNoteTitle': 'Aplicación de escritorio — nota de producto',
  'workbench.docs.body.systemStatus.desktopNote1':
    'La aplicación de escritorio está en desarrollo y saldrá cuando la extensión se estabilice. Los espacios ' +
    'de trabajo, las variables y la sincronización de equipo que se integran con la aplicación de escritorio ' +
    'se desbloquearán entonces. El subsistema',
  'workbench.docs.body.systemStatus.desktopNote2':
    'pasa automáticamente de desactivado a conectando en el primer arranque — no hace falta reinstalar.',
} as const satisfies Catalog;
