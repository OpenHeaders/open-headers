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
 * `Aplicación › Datos › Exportar el registro de diagnóstico` are
 * minted here — the editors-request and settings es files must reuse
 * them. Workbench in prose = editor del espacio de trabajo (the
 * shared-components mint); wake = reactivación (shared-chrome).
 */

import type { Catalog } from '../../types';

export const workbenchDocsSystemStatus = {
  // ── Concepts: System Status ─────────────────────────────────────────
  'workbench.docs.body.systemStatus.term': 'El estado del sistema',
  'workbench.docs.body.systemStatus.intro1':
    'es una instantánea en vivo de la salud de la extensión. El pie de página del editor del espacio de trabajo lo muestra como una fila de ocho píldoras — una píldora por subsistema, cada una con su propio punto de color. El popup y el panel lateral lo pliegan en una sola entrada',
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
    'Ocho estados de subsistema se pliegan en un compuesto vía max — el rojo gana al amarillo, que gana al verde.',
  'workbench.docs.body.systemStatus.popover1':
    'Hacer clic en cualquier píldora abre el mismo popover de detalles. Las filas se agrupan bajo cuatro títulos — Conexión, Browser Interceptor, Solicitudes API y Aplicación — en un orden fijo. Una fila es gris hasta que su subsistema informa por primera vez en esta vida del service worker, y de color después. El historial completo vive en el registro de observabilidad — expórtalo desde',
  'workbench.docs.body.systemStatus.settingsExportPath': 'Aplicación › Datos › Exportar el registro de diagnóstico',
  'workbench.docs.body.systemStatus.popover1Suffix': '.',
  'workbench.docs.body.systemStatus.popoverCaption':
    'Cuatro grupos con título en orden fijo; al primer informe una fila pasa a color y conserva su sitio.',
  'workbench.docs.body.systemStatus.stateGreenLabel': 'verde',
  'workbench.docs.body.systemStatus.stateYellowLabel': 'amarillo',
  'workbench.docs.body.systemStatus.stateRedLabel': 'rojo',
  'workbench.docs.body.systemStatus.syncName': 'Sincronización',
  'workbench.docs.body.systemStatus.syncSubtitle': 'Conexiones con el back-end',
  'workbench.docs.body.systemStatus.sync1Prefix':
    'Reúne cada back-end del que esta superficie es cliente — la aplicación de escritorio en esta máquina (',
  'workbench.docs.body.systemStatus.sync1Suffix':
    ') y cualquier OpenHeaders Server — en una sola fila: la peor conexión decide la etiqueta, y cada back-end tiene su propia fila debajo en el popover. Sin ningún back-end configurado la fila dice «Ejecutándose en este navegador» — la extensión es su propio back-end.',
  'workbench.docs.body.systemStatus.syncTopologyCaption':
    'Un WebSocket por back-end — aquí la aplicación de escritorio en localhost; un servidor es el mismo enlace por la red.',
  'workbench.docs.body.systemStatus.sync2':
    'Cada cable informa de dos capas. El socket: conectando, reconectando con retroceso exponencial tras una caída, conectado — los pings periódicos detectan desconexiones silenciosas tras proxies corporativos estrictos. Encima, el handshake: en negociación, poniéndose al día con los cambios perdidos, sincronizado. Dentro de un back-end gana el informe más reciente; entre back-ends gana el peor estado.',
  'workbench.docs.body.systemStatus.syncLifecycleCaption':
    'Desactivado, Conectado y Sincronizado son verdes; Conectando, Reconectando, Poniéndose al día y URL rechazada son amarillos.',
  'workbench.docs.body.systemStatus.sync3':
    'Una aplicación de escritorio o un servidor también es back-end para otros, y ese rol entra en la misma agregación: el enlace de la tubería de extensiones — rojo cuando otra instancia tiene el puerto, amarillo mientras arranca — y, una vez enlazado, cuántas extensiones están conectadas y si desde este dispositivo o desde la LAN. Un espacio de trabajo vinculado a git añade su recuento de cambios sin confirmar.',
  'workbench.docs.body.systemStatus.syncGreenSynced': 'Sincronizado con el back-end',
  'workbench.docs.body.systemStatus.syncGreenConnected': 'Conectado al back-end',
  'workbench.docs.body.systemStatus.syncGreenDisabled': 'Sincronización con el back-end desactivada',
  'workbench.docs.body.systemStatus.syncGreenRunningHere': 'Ejecutándose en este navegador',
  'workbench.docs.body.systemStatus.syncGreenExplain':
    '— el handshake se completó, el socket está arriba con el handshake aún pendiente, la conexión automática está apagada, o no hay back-end configurado. Un host que sirve informa en su lugar de sus pares:',
  'workbench.docs.body.systemStatus.syncGreenIdle': 'Inactivo — ninguna extensión conectada',
  'workbench.docs.body.systemStatus.syncGreenPeers': 'Conectado a N extensiones en este dispositivo',
  'workbench.docs.body.systemStatus.syncGreenSuffix': '(o en la LAN).',
  'workbench.docs.body.systemStatus.syncYellowConnecting': 'Conectando al back-end…',
  'workbench.docs.body.systemStatus.syncYellowReconnecting': 'Reconectando (intento N)',
  'workbench.docs.body.systemStatus.syncYellowHandshaking': 'Negociando con el back-end…',
  'workbench.docs.body.systemStatus.syncYellowCatchingUp': 'Poniéndose al día con los cambios…',
  'workbench.docs.body.systemStatus.syncYellowRejected': 'URL de escritorio rechazada por los ajustes',
  'workbench.docs.body.systemStatus.syncYellowOff':
    '<back-end> está apagado — sus espacios de trabajo no se sincronizan',
  'workbench.docs.body.systemStatus.syncYellowExplain':
    '— un socket subiendo o volviendo, un handshake en curso, un registro sin URL utilizable, o un back-end unido que está apagado. Un host que sirve añade',
  'workbench.docs.body.systemStatus.syncYellowPipe': 'Iniciando la tubería de extensiones…',
  'workbench.docs.body.systemStatus.syncYellowGit': 'N cambios sin confirmar',
  'workbench.docs.body.systemStatus.syncYellowSuffix': 'para un espacio de trabajo vinculado a git.',
  'workbench.docs.body.systemStatus.syncRedRejected': 'El back-end rechazó el handshake',
  'workbench.docs.body.systemStatus.syncRedTimedOut': 'El back-end no respondió al handshake — reintentando',
  'workbench.docs.body.systemStatus.syncRedCatchUp': 'Falló la puesta al día',
  'workbench.docs.body.systemStatus.syncRedExplain':
    '— el servidor rechazó el handshake (protocolo incompatible, espacio de trabajo desconocido, falta autenticación; la fila nombra el motivo), nunca respondió, o falló la reproducción de puesta al día. Un host que sirve añade',
  'workbench.docs.body.systemStatus.syncRedPipe': 'Tubería de extensiones sin conexión — el puerto N ya está en uso',
  'workbench.docs.body.systemStatus.syncRedSuffix': 'cuando otra instancia tiene el puerto.',
  'workbench.docs.body.systemStatus.activityName': 'Actividad',
  'workbench.docs.body.systemStatus.activitySubtitle': 'Feed de actividad',
  'workbench.docs.body.systemStatus.activity1':
    'Cuenta las entradas sin leer del feed de actividad del espacio de trabajo activo — los cambios que llegaron por sincronización: una entidad creada, editada, eliminada o movida, una edición local reemplazada, un campo sensible rotado, un ámbito de permisos ampliado, un agente de IA observando tráfico.',
  'workbench.docs.body.systemStatus.activity2':
    'Solo cuenta el espacio de trabajo activo. Las entradas de otro espacio de trabajo siguen cayendo en su propio feed, y al cambiar a él se relee el recuento del registro, así que ningún espacio de trabajo lleva la insignia de otro.',
  'workbench.docs.body.systemStatus.activityGreenLabel': 'Actividad al día',
  'workbench.docs.body.systemStatus.activityGreenSuffix': '— nada sin leer en el espacio de trabajo activo.',
  'workbench.docs.body.systemStatus.activityYellowLabel': 'N nuevas · <titular>',
  'workbench.docs.body.systemStatus.activityYellowMiddle':
    '— entradas sin leer, encabezadas por la más reciente, hasta que se lea el feed.',
  'workbench.docs.body.systemStatus.activityRed': 'Reservado; hoy ninguna ruta de código lo emite.',
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
  'workbench.docs.body.systemStatus.debugModeName': 'Modo de depuración',
  'workbench.docs.body.systemStatus.debugModeSubtitle': 'Estado de conexión del depurador',
  'workbench.docs.body.systemStatus.debugMode1':
    'Refleja el depurador que el modo de depuración conecta a las pestañas para correlacionar las solicitudes con exactitud. Apagado informa verde — un fallo no importa mientras el interruptor esté apagado. Encendido, la fila cuenta las pestañas conectadas; una pestaña cuya conexión rechazó el navegador la pone en rojo, y una que cayó a la ruta heurística la pone en amarillo.',
  'workbench.docs.body.systemStatus.debugMode2':
    'Los navegadores sin API de depurador nunca instalan este reportero, así que allí la fila se queda en gris y la ruta heurística es la única.',
  'workbench.docs.body.systemStatus.debugModeGreenOff': 'Apagado',
  'workbench.docs.body.systemStatus.debugModeGreenOr': 'o',
  'workbench.docs.body.systemStatus.debugModeGreenOn': 'Encendido · N pestañas',
  'workbench.docs.body.systemStatus.debugModeGreenSuffix':
    '— el interruptor está apagado, o encendido con todas las pestañas conectadas sanas.',
  'workbench.docs.body.systemStatus.debugModeYellowLabel': 'La pestaña N cayó a la heurística',
  'workbench.docs.body.systemStatus.debugModeYellowMiddle':
    '— el depurador se desconectó de esa pestaña (un banner cancelado, por ejemplo) y la pestaña se correlaciona por la ruta heurística hasta que se vuelva a conectar.',
  'workbench.docs.body.systemStatus.debugModeRedLabel': 'Falló la conexión a la pestaña N',
  'workbench.docs.body.systemStatus.debugModeRedMiddle':
    '— el navegador rechazó la conexión, normalmente porque otro depurador ya tiene la pestaña.',
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
} as const satisfies Catalog;
