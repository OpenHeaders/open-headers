/**
 * Workbench settings — custom pane components — Spanish. Extends the
 * es register contract (`es/shared.ts`). Mirrors
 * `catalogs/en/workbench-settings-panes.ts` key for key. Raw by
 * design: `back-end` / `daemon` / `vault` / `workflow` / `seed` /
 * `Org` (f.) as dev loanwords, networking vocabulary (loopback, LAN,
 * WAN, RFC1918, mDNS, CGNAT, ULA, APIPA, TLS, `ws://` / `wss://`),
 * IANA port constants (1024 / 49152 / 65535), IP literals and range
 * notes' technical tokens (fd00::/8, 100.64/10, Docker, Tailscale,
 * Bonjour / Avahi), `MCP` / `SSO` / `RBAC` / `CLI` / `oh` /
 * `streamable HTTP`, snippet filenames (claude_desktop_config.json),
 * the `oh-license.…` key prefix and the {chord} / {token} / {url}
 * holes. Settings paths quote the es shell mints (`Configuración →
 * Backend`); `Administración del daemon` matches the es
 * daemon-admin title; `nivel` / `plaza` / `directorio` reuse the
 * daemon-admin + settings mints; `Preajuste de atajos` and `atajo`
 * reuse es/workbench-settings-defs-keyboard. MINTS: pairing =
 * `emparejar` family (`código de emparejamiento`); token rotation =
 * `rotar` (token = raw m.; `renovar` stays the seat-renewal word).
 */

import { formatMessage, plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchSettingsPanes = {
  // ── Backend pane body ──────────────────────────────────────────────
  'workbench.settings.backendPane.intro.whoLabel': 'Quién:',
  'workbench.settings.backendPane.intro.whoText': 'procesa y almacena tus datos.',
  'workbench.settings.backendPane.intro.whereLabel': 'Dónde:',
  'workbench.settings.backendPane.intro.whereText': 'local o remoto.',
  'workbench.settings.backendPane.showDiagrams': 'Mostrar los diagramas',
  'workbench.settings.backendPane.learnMore': 'Más información',
  'workbench.settings.backendPane.subsection.reliability.blurb':
    'Comportamiento de reconexión automática sobre un cable inestable. Se aplica a todas las conexiones.',
  'workbench.settings.backendPane.subsection.notifications.blurb': 'Señales visuales cuando un enlace está caído.',
  'workbench.settings.backendPane.tierZero.title.extension': 'Este navegador',
  'workbench.settings.backendPane.tierZero.title.desktop': 'Esta aplicación',
  'workbench.settings.backendPane.tierZero.title.web': 'Esta aplicación',
  'workbench.settings.backendPane.tierZero.copy.extension':
    'La propia extensión procesa y almacena tus datos — los espacios de trabajo, las reglas y el vault viven ' +
    'en este navegador. Siempre activo; sin configuración.',
  'workbench.settings.backendPane.tierZero.copy.desktop':
    'El proceso de la aplicación de escritorio es el back-end. Los demás clientes locales se conectan a él; ' +
    'tus datos viven en esta máquina. Siempre activo; sin configuración.',
  'workbench.settings.backendPane.tierZero.copy.web':
    'La aplicación que sirvió esta página es el back-end. Tus datos viven en ese host. Siempre activo; sin ' +
    'configuración.',
  'workbench.settings.backendPane.tierZero.alwaysOn': 'Siempre activo',
  'workbench.settings.backendPane.tierZero.adminTitle': 'Administración del servidor',
  'workbench.settings.backendPane.tierZero.adminDescription':
    'Gestiona el directorio de usuarios y los accesos concedidos por espacio de trabajo.',
  'workbench.settings.backendPane.tierZero.adminOpen': 'Abrir la consola de administración',
  'workbench.settings.backendPane.scenario.desktop-app.title': 'Aplicación de escritorio',
  'workbench.settings.backendPane.scenario.desktop-app.hint': 'La aplicación de Open Headers en esta máquina',
  'workbench.settings.backendPane.scenario.local-self-hosted.title': 'Local / LAN',
  'workbench.settings.backendPane.scenario.local-self-hosted.hint': 'Un servidor en esta máquina o en tu red',
  'workbench.settings.backendPane.scenario.remote-self-hosted.title': 'Remoto / WAN',
  'workbench.settings.backendPane.scenario.remote-self-hosted.hint': 'Un servidor que autoalojas en tu propia VM',
  'workbench.settings.backendPane.wizard.step.scenario': 'Escenario',
  'workbench.settings.backendPane.wizard.step.connect': 'Conexión',
  'workbench.settings.backendPane.wizard.step.pair': 'Emparejar',
  'workbench.settings.backendPane.wizard.step.turnOn': 'Activar',
  'workbench.settings.backendPane.wizard.addTitle': 'Añadir un back-end',
  'workbench.settings.backendPane.wizard.editTitle': 'Editar {label}',
  'workbench.settings.backendPane.wizard.back': 'Atrás',
  'workbench.settings.backendPane.wizard.next': 'Siguiente',
  'workbench.settings.backendPane.wizard.comingSoon': 'Próximamente',
  'workbench.settings.backendPane.wizard.finishWithoutConnecting': 'Terminar sin conectar',
  'workbench.settings.backendPane.wizard.verifyConnect': 'Verificar y conectar',
  'workbench.settings.backendPane.wizard.scenarioIntro':
    '¿Qué clase de back-end es? Elige una tarjeta para ver lo que te da el nivel.',
  'workbench.settings.backendPane.wizard.scenarioAria': 'Escenario de back-end',
  'workbench.settings.backendPane.wizard.soonBadge': 'Pronto',
  'workbench.settings.backendPane.wizard.connectIntro':
    '¿Dónde marca este cliente al back-end? La conexión permanece apagada hasta que el paso final la ' + 'verifica.',
  'workbench.settings.backendPane.wizard.pairIntro':
    'Acredita este dispositivo ante el back-end — empareja con el código que muestra, o pega un token. ' +
    'Puedes probar la conexión antes de activarla.',
  'workbench.settings.backendPane.wizard.autoPairFallback':
    'El emparejamiento automático con la aplicación de escritorio no se completó — puede que no esté en ' +
    'ejecución, o que este navegador no se haya podido verificar. Empareja con el código o el token en su lugar.',
  'workbench.settings.backendPane.wizard.readyIntroPaired':
    'Listo: {label} en {url}, emparejado. Activarlo verifica primero la accesibilidad y la autenticación; si ' +
    'todo va bien, sus espacios de trabajo se sincronizan y quedan utilizables sin conexión.',
  'workbench.settings.backendPane.wizard.readyIntroNotPaired':
    'Listo: {label} en {url} — aún SIN emparejar. Activarlo verifica primero la accesibilidad y la ' +
    'autenticación; si todo va bien, sus espacios de trabajo se sincronizan y quedan utilizables sin ' +
    'conexión.',
  'workbench.settings.backendPane.wizard.additionalBackend':
    'Este es un back-end adicional. Sus Orgs aparecen como grupos nuevos en el selector de espacios de ' +
    'trabajo, el popover de estado gana una fila por back-end, y cada Org se sincroniza desde exactamente un ' +
    'back-end — una Org ya proporcionada por otra conexión no se une dos veces.',
  'workbench.settings.backendPane.wizard.disableFirst':
    '{label} está conectado. Editar la conexión es mover un cable con corriente, así que primero se ' +
    'desconecta — tus ajustes y el emparejamiento se conservan, y al reactivarla se verifica la nueva ' +
    'configuración antes de conectar nada.',
  'workbench.settings.backendPane.wizard.disconnectEdit': 'Desconectar y editar',
  'workbench.settings.backendPane.wizard.testConnection': 'Probar la conexión',

  // ── Backend pane: connections list ─────────────────────────────────
  'workbench.settings.backendPane.connections.title': 'Conexiones',
  'workbench.settings.backendPane.connections.blurbBrowser':
    'Los back-ends a los que este navegador se ha unido. Sus espacios de trabajo se sincronizan y quedan ' +
    'utilizables sin conexión.',
  'workbench.settings.backendPane.connections.blurbApp':
    'Los back-ends a los que esta aplicación se ha unido. Sus espacios de trabajo se sincronizan y quedan ' +
    'utilizables sin conexión.',
  'workbench.settings.backendPane.connections.add': 'Añadir un back-end',
  'workbench.settings.backendPane.connections.emptyBrowser':
    'Sin conexiones — todo se ejecuta en este navegador. Añade un back-end para sincronizar espacios de ' +
    'trabajo desde la aplicación de escritorio o un servidor autoalojado.',
  'workbench.settings.backendPane.connections.emptyApp':
    'Sin conexiones — todo se ejecuta en esta aplicación. Añade un back-end para sincronizar espacios de ' +
    'trabajo desde la aplicación de escritorio o un servidor autoalojado.',
  'workbench.settings.backendPane.connections.status.connected': 'Conectado',
  'workbench.settings.backendPane.connections.status.connecting': 'Conectando…',
  'workbench.settings.backendPane.connections.status.authRequired': 'Hace falta reemparejar',
  'workbench.settings.backendPane.connections.status.error': 'Conexión caída',
  'workbench.settings.backendPane.connections.status.off': 'Apagado',
  'workbench.settings.backendPane.connections.repair': 'Reemparejar',
  'workbench.settings.backendPane.connections.autoConnect': 'Conexión automática',
  'workbench.settings.backendPane.connections.editTooltipConnected': 'Editar (primero se desconecta)',
  'workbench.settings.backendPane.connections.editTooltip': 'Editar',
  'workbench.settings.backendPane.connections.editAria': 'Editar {label}',
  'workbench.settings.backendPane.connections.disconnectTooltip': 'Desconectar (los ajustes se conservan)',
  'workbench.settings.backendPane.connections.connectTooltip': 'Verificar y conectar',
  'workbench.settings.backendPane.connections.enabledAria': '{label} activado',
  'workbench.settings.backendPane.connections.orgConflict':
    'La Org «{org}» ya la proporciona {provider} — no se ha unido',
  'workbench.settings.backendPane.connections.removedBackend': 'un back-end eliminado',

  // ── Backend pane: probe-gated enable ───────────────────────────────
  'workbench.settings.backendPane.enable.connectingTo': 'Conectando con {label}…',
  'workbench.settings.backendPane.enable.connected': 'Conectado a {label}.',
  'workbench.settings.backendPane.enable.orgNotJoined':
    '{label} se conectó, pero su Org no se unió — mira la fila de la conexión.',

  // ── Backend pane: remove flow ──────────────────────────────────────
  'workbench.settings.backendPane.remove.confirmTitle': '¿Eliminar {label}?',
  'workbench.settings.backendPane.remove.confirmBody':
    'Su dirección y su emparejamiento se olvidan. Aún no se había sincronizado nada desde él.',
  'workbench.settings.backendPane.remove.aria': 'Eliminar {label}',
  'workbench.settings.backendPane.remove.removed': 'Se eliminó {label}.',
  'workbench.settings.backendPane.remove.tooltip':
    'Eliminar este back-end — tú eliges qué pasa con sus espacios de trabajo sincronizados',
  'workbench.settings.backendPane.remove.workspaceCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} espacio de trabajo',
      many: '{count} espacios de trabajo',
      other: '{count} espacios de trabajo',
    }),
  'workbench.settings.backendPane.remove.body.prefix': 'Este back-end proporciona',
  'workbench.settings.backendPane.remove.body.suffix':
    'con {workspaces} sincronizados en este dispositivo. Sus propios datos nunca se tocan — elige qué pasa ' +
    'con las copias locales.',
  'workbench.settings.backendPane.remove.outcomeAria': 'Resultado de la eliminación',
  'workbench.settings.backendPane.remove.recommendedBadge': 'Recomendado',
  'workbench.settings.backendPane.remove.keep.title': 'Conservar las copias locales',
  'workbench.settings.backendPane.remove.keep.description':
    '{orgs} dejan de sincronizarse. Los {workspaces} se quedan en este dispositivo como datos locales sin ' +
    'conexión.',
  'workbench.settings.backendPane.remove.discard.title': 'Descartar las copias locales',
  'workbench.settings.backendPane.remove.discard.description':
    'Cada espacio de trabajo se respalda primero en un archivo descargado y luego se elimina de este ' +
    'dispositivo. Volver a unirse al back-end más adelante los sincroniza de nuevo.',
  'workbench.settings.backendPane.remove.discard.includeSecrets':
    'Incluir los secretos del vault en los archivos de respaldo (en claro — guarda los archivos a salvo)',
  'workbench.settings.backendPane.remove.removeBackend': 'Eliminar el back-end',
  'workbench.settings.backendPane.remove.backupThenRemove': 'Respaldar y luego eliminar',
  'workbench.settings.backendPane.remove.progress.removing': 'Eliminando el back-end…',
  'workbench.settings.backendPane.remove.progress.preparing': 'Preparando los respaldos…',
  'workbench.settings.backendPane.remove.progress.backingUp': 'Respaldando «{name}»…',
  'workbench.settings.backendPane.remove.progress.deleting': 'Eliminando «{name}»…',
  'workbench.settings.backendPane.remove.keepDone':
    'Se eliminó {label}. {orgs} dejaron de sincronizarse; {workspaces} se quedan en este dispositivo.',
  'workbench.settings.backendPane.remove.discardDone':
    'Se eliminó {label}. Se respaldaron y eliminaron {workspaces}; {orgs} desvinculadas.',
  'workbench.settings.backendPane.remove.discardStayedTitle': ({ label, count }, locale) =>
    plural(locale, Number(count), {
      one: `Se eliminó ${String(label)}, pero {count} espacio de trabajo se quedó`,
      many: `Se eliminó ${String(label)}, pero {count} espacios de trabajo se quedaron`,
      other: `Se eliminó ${String(label)}, pero {count} espacios de trabajo se quedaron`,
    }),
  'workbench.settings.backendPane.remove.discardStayedBody':
    'No se pudieron eliminar: {names}. Permanecen como datos locales.',
  'workbench.settings.backendPane.remove.backupFailedTitle': 'El respaldo de «{name}» falló',
  'workbench.settings.backendPane.remove.backupFailedBody': 'La exportación no se completó. No se eliminó nada.',

  // ── Backend pane: pair with a code ─────────────────────────────────
  'workbench.settings.backendPane.pair.pairWithCode': 'Emparejar con un código',
  'workbench.settings.backendPane.pair.pasteTokenTitle': 'Pegar un token',
  'workbench.settings.backendPane.pair.codeBlurb':
    'Introduce el código que mostró el back-end. Lo cambiaremos por un token de autenticación y conectaremos ' +
    'este navegador.',
  'workbench.settings.backendPane.pair.tokenBlurb':
    'Pega el token que mostró el back-end — una rotación muestra el secreto nuevo una sola vez. Se guarda ' +
    'como la credencial de este navegador.',
  'workbench.settings.backendPane.pair.codePlaceholder': 'Código de 6 dígitos',
  'workbench.settings.backendPane.pair.deviceNamePlaceholder': 'Nombre del dispositivo (opcional)',
  'workbench.settings.backendPane.pair.codeRequired': 'Introduce el código de emparejamiento que muestra el back-end.',
  'workbench.settings.backendPane.pair.pasteTokenRequired': 'Pega el token que mostró el back-end.',
  'workbench.settings.backendPane.pair.pairAction': 'Emparejar',
  'workbench.settings.backendPane.pair.saveToken': 'Guardar el token',
  'workbench.settings.backendPane.pair.tokenSaved': 'Token de autenticación guardado.',
  'workbench.settings.backendPane.pair.pairedSaved': 'Emparejado — token de autenticación guardado.',
  'workbench.settings.backendPane.pair.switchToToken': '¿Tienes un token? Pégalo en su lugar',
  'workbench.settings.backendPane.pair.switchToCode': '¿Mejor un código de emparejamiento?',
  'workbench.settings.backendPane.pair.fail.unknown':
    'Ese código es desconocido o ha caducado. Pide un código nuevo y vuelve a intentarlo.',
  'workbench.settings.backendPane.pair.fail.expired':
    'Ese código de emparejamiento ha caducado. Genera uno nuevo en el back-end.',
  'workbench.settings.backendPane.pair.fail.consumed': 'Ese código ya se usó. Genera uno nuevo en el back-end.',
  'workbench.settings.backendPane.pair.fail.unreachable':
    'No se pudo alcanzar el back-end en {url}. ¿Está ejecutándose en esa dirección?',
  'workbench.settings.backendPane.pair.fail.generic': 'El emparejamiento falló. Vuelve a intentarlo.',
  'workbench.settings.backendPane.pair.nmRequired':
    'El emparejamiento manual con la aplicación de escritorio está desactivado: este navegador solo se conecta mediante emparejamiento verificado. Consulta el ajuste «Exigir emparejamiento verificado».',

  // ── Backend pane: record field editors ─────────────────────────────
  'workbench.settings.backendPane.field.label.label': 'Nombre',
  'workbench.settings.backendPane.field.label.description':
    'Cómo se llama este back-end en toda la aplicación. Por defecto, su dirección.',
  'workbench.settings.backendPane.field.label.placeholder': 'VM del trabajo',
  'workbench.settings.backendPane.field.label.aria': 'Nombre del back-end',
  'workbench.settings.backendPane.field.url.label': 'Dirección del back-end',
  'workbench.settings.backendPane.field.url.description':
    'Dónde marca este cliente al back-end. `ws://` para hosts locales / LAN, `wss://` para remotos.',
  'workbench.settings.backendPane.field.url.schemeAria': 'Esquema',
  'workbench.settings.backendPane.field.url.addressAria': 'Dirección',
  'workbench.settings.backendPane.field.url.portAria': 'Puerto',
  'workbench.settings.backendPane.field.auth.label': 'Autenticación',
  'workbench.settings.backendPane.field.auth.description':
    'Cómo se acredita este dispositivo ante el back-end. Empareja con un código, o pega un token ' + 'directamente.',
  'workbench.settings.backendPane.field.auth.codeAria': 'Código de emparejamiento',
  'workbench.settings.backendPane.field.auth.tokenAria': 'Token de autenticación',
  'workbench.settings.backendPane.field.auth.tokenPlaceholder': 'Pega un token',
  'workbench.settings.backendPane.field.auth.paired': 'Emparejado — token de acceso guardado',
  'workbench.settings.backendPane.field.auth.useToken': 'Usar un token de autenticación en su lugar',
  'workbench.settings.backendPane.field.auth.useCode': 'Emparejar con un código en su lugar',

  // ── Backend pane: port validation hints ────────────────────────────
  // The IANA boundary numbers (1024 / 49152 / 65535) are protocol
  // constants, embedded literally rather than interpolated.
  'workbench.settings.backendPane.port.missing': 'Introduce un puerto.',
  'workbench.settings.backendPane.port.notInteger': 'El puerto debe ser un número entero.',
  'workbench.settings.backendPane.port.privileged':
    'Los puertos por debajo de 1024 son privilegiados y necesitan permisos elevados — elige 1024 o superior.',
  'workbench.settings.backendPane.port.aboveMax': 'El puerto debe ser 65535 o inferior.',
  'workbench.settings.backendPane.port.ephemeral':
    'Los puertos 49152–65535 son el rango que el SO reparte para las conexiones salientes; un listener ahí ' +
    'puede fallar al vincularse de forma intermitente. Un puerto de 1024–49151 es más fiable.',

  // ── Backend pane: LAN-peers confirm ────────────────────────────────
  'workbench.settings.backendPane.lan.confirmTitle': '¿Permitir pares de la LAN?',
  'workbench.settings.backendPane.lan.confirmOk': 'Permitir pares de la LAN',
  'workbench.settings.backendPane.lan.confirmCancel': 'Mantener solo loopback',
  'workbench.settings.backendPane.lan.confirmBody':
    'El back-end de escritorio se vinculará a todas las interfaces de red locales para que otros dispositivos ' +
    'de tu red puedan conectarse. Toda conexión — LAN o loopback — debe presentar un token de autenticación ' +
    'emparejado; no existe ningún camino sin token. Los dispositivos se emparejan con el código que muestra ' +
    'la aplicación (o pega un token en Configuración → Backend → Token de autenticación).',

  // ── Backend pane: offline fallback order ───────────────────────────
  'workbench.settings.backendPane.fallback.title': 'Orden de respaldo sin conexión',
  'workbench.settings.backendPane.fallback.blurb':
    'Si el back-end queda sin conexión, el primer host alcanzable de esta lista refresca por sí mismo la ' +
    'credencial de un workflow exclusivo. Los hosts se alistan automáticamente; arrastra para reordenar el ' +
    'rango.',
  'workbench.settings.backendPane.fallback.empty':
    'Aún no se ha alistado ningún host. Un navegador se une a esta lista en cuanto posee el seed de un ' +
    'workflow Live exclusivo en este espacio de trabajo.',
  'workbench.settings.backendPane.fallback.saveFailed': 'No se pudo guardar el nuevo orden',
  'workbench.settings.backendPane.fallback.removeFailed': 'No se pudo quitar el host',
  'workbench.settings.backendPane.fallback.dragAria': 'Arrastra para reordenar',
  'workbench.settings.backendPane.fallback.selfTag': 'Este navegador',
  'workbench.settings.backendPane.fallback.pruneTitle': '¿Quitar este host?',
  'workbench.settings.backendPane.fallback.pruneBody':
    'Se vuelve a alistar automáticamente si aún posee el seed de un workflow exclusivo.',

  // ── Backend pane: tier cards ────────────────────────────────────────
  // The tier registry (`backend-tier-data.ts`) renders inside a
  // fixed-geometry SVG card. Titles, capability bullets, and range-
  // category labels are keyed; IP ranges, URL patterns, and platform
  // proper nouns stay literal (technical plane). Networking vocabulary
  // inside keyed labels (loopback, RFC1918, mDNS, …) is
  // glossary-protected on translator handoff.
  'workbench.settings.backendPane.tier.cardAria': 'Tarjeta del nivel {title}',
  'workbench.settings.backendPane.tier.badge.today': 'Hoy',
  'workbench.settings.backendPane.tier.badge.roadmap': 'Hoja de ruta',
  'workbench.settings.backendPane.tier.inheritsFrom': 'Hereda de {tier}',
  'workbench.settings.backendPane.tier.newInTier': '+ Nuevo en este nivel',
  'workbench.settings.backendPane.tier.supports': 'Admite',
  'workbench.settings.backendPane.tier.in-browser.title': 'En el navegador',
  'workbench.settings.backendPane.tier.in-browser.sub': 'service worker de la extensión',
  'workbench.settings.backendPane.tier.desktop-app.title': 'Aplicación de escritorio',
  'workbench.settings.backendPane.tier.desktop-app.sub': 'servidor integrado',
  'workbench.settings.backendPane.tier.local-self-hosted.title': 'Servidor local',
  'workbench.settings.backendPane.tier.local-self-hosted.sub': 'en tu LAN',
  'workbench.settings.backendPane.tier.remote-self-hosted.title': 'Servidor remoto',
  'workbench.settings.backendPane.tier.remote-self-hosted.sub': 'en la WAN',
  'workbench.settings.backendPane.tier.bullet.zeroSetup': 'cero configuración',
  'workbench.settings.backendPane.tier.bullet.minimalSetup': 'configuración mínima',
  'workbench.settings.backendPane.tier.bullet.standardSetup': 'configuración estándar',
  'workbench.settings.backendPane.tier.bullet.singleDevice': 'un solo dispositivo',
  'workbench.settings.backendPane.tier.bullet.multipleDevices': 'varios dispositivos',
  'workbench.settings.backendPane.tier.bullet.perBrowserInstance': 'instancia por navegador',
  'workbench.settings.backendPane.tier.bullet.perAppInstance': 'instancia por aplicación',
  'workbench.settings.backendPane.tier.bullet.multiBrowserInstances': 'instancias multinavegador',
  'workbench.settings.backendPane.tier.bullet.multiAppInstances': 'instancias multiaplicación',
  'workbench.settings.backendPane.tier.bullet.multiSurfaceEditing': 'edición concurrente multisuperficie',
  'workbench.settings.backendPane.tier.bullet.multiWindowEditing': 'edición concurrente multiventana',
  'workbench.settings.backendPane.tier.bullet.localhostOnly': 'Solo localhost',
  'workbench.settings.backendPane.tier.bullet.localhostSupported': 'Localhost admitido',
  'workbench.settings.backendPane.tier.bullet.lanReachable': 'Alcanzable en LAN',
  'workbench.settings.backendPane.tier.bullet.wanReachable': 'Alcanzable en WAN/Internet',
  'workbench.settings.backendPane.tier.bullet.nativeFilesystem': 'sistema de archivos nativo',
  'workbench.settings.backendPane.tier.bullet.yamlOnDisk': 'YAML en disco',
  'workbench.settings.backendPane.tier.bullet.gitIntegration': 'integración git (local/remoto)',
  'workbench.settings.backendPane.tier.bullet.clients': 'ext. de navegador · app de escritorio · CLI',
  'workbench.settings.backendPane.tier.bullet.headlessByDefault': 'headless por defecto · sitio web opcional',
  'workbench.settings.backendPane.tier.bullet.teamReady': 'listo para equipos',
  'workbench.settings.backendPane.tier.bullet.ssoAuth': 'Auth SSO',
  'workbench.settings.backendPane.tier.bullet.rbac': 'gestión de usuarios RBAC',
  'workbench.settings.backendPane.tier.bullet.auditLogs': 'registros de auditoría e informes',
  'workbench.settings.backendPane.tier.note.soon': 'pronto',
  'workbench.settings.backendPane.tier.group.allOs': 'Todos los SO',
  'workbench.settings.backendPane.tier.group.embedded': 'Integrado',
  'workbench.settings.backendPane.tier.group.hyperscalers': 'Hyperscalers',
  'workbench.settings.backendPane.tier.group.euNative': 'Nativo de la UE',
  'workbench.settings.backendPane.tier.group.other': 'Otros',
  'workbench.settings.backendPane.tier.group.enterprise': 'Empresa',
  'workbench.settings.backendPane.tier.platform.yourCloud': 'Tu nube',
  'workbench.settings.backendPane.tier.platform.onPrem': 'On-prem',
  'workbench.settings.backendPane.tier.platform.homeServer': 'Servidor doméstico',
  'workbench.settings.backendPane.tier.platform.oldLaptop': 'Portátil viejo',
  'workbench.settings.backendPane.tier.platform.miniPc': 'Mini PC',
  'workbench.settings.backendPane.tier.reach.none': 'N/A',
  'workbench.settings.backendPane.tier.reach.localhost': 'Localhost',
  'workbench.settings.backendPane.tier.reach.lan': 'Localhost/LAN',
  'workbench.settings.backendPane.tier.reach.wan': 'Internet/WAN',
  'workbench.settings.backendPane.tier.cat.whyNoWire': '¿Por qué no hay cable?',
  'workbench.settings.backendPane.tier.cat.sameBrowserSurfaces': 'Superficies del mismo navegador',
  'workbench.settings.backendPane.tier.cat.perBrowserInstance': 'Instancia por navegador',
  'workbench.settings.backendPane.tier.cat.ipv4Loopback': 'Loopback IPv4',
  'workbench.settings.backendPane.tier.cat.ipv6Loopback': 'Loopback IPv6',
  'workbench.settings.backendPane.tier.cat.defaultPort': 'Puerto por defecto',
  'workbench.settings.backendPane.tier.cat.localhostLoopback': 'Localhost / loopback',
  'workbench.settings.backendPane.tier.cat.rfc1918': 'IPv4 privada RFC1918',
  'workbench.settings.backendPane.tier.cat.ipv6Ula': 'IPv6 ULA',
  'workbench.settings.backendPane.tier.cat.cgnat': 'CGNAT / overlay',
  'workbench.settings.backendPane.tier.cat.zeroConfig': 'Zero-config / respaldo sin DHCP',
  'workbench.settings.backendPane.tier.cat.mdns': 'Nombres de host mDNS',
  'workbench.settings.backendPane.tier.cat.publicDns': 'Nombre de host DNS público',
  'workbench.settings.backendPane.tier.cat.publicIpv4': 'IPv4 pública',
  'workbench.settings.backendPane.tier.cat.publicIpv6': 'IPv6 pública',
  'workbench.settings.backendPane.tier.cat.transport': 'Transporte',
  'workbench.settings.backendPane.tier.rangeNote.backendIsSw':
    'sin puerto de escucha, sin superficie IPC expuesta a otros dispositivos',
  'workbench.settings.backendPane.tier.rangeNote.runtimeMessaging':
    'popup / workbench / DevTools / panel lateral hablan con el SW en el mismo proceso',
  'workbench.settings.backendPane.tier.rangeNote.storageLocal':
    'Chrome ≠ Firefox ≠ Edge — datos separados por navegador, sin cruce entre dispositivos ni navegadores',
  'workbench.settings.backendPane.tier.rangeNote.typicalLoopback': 'normalmente 127.0.0.1',
  'workbench.settings.backendPane.tier.rangeNote.portOverride': 'modificable en Backend → Conexión',
  'workbench.settings.backendPane.tier.rangeNote.serverOwnBox':
    'IPv4 — servidor en tu propia máquina (Docker, sidecar)',
  'workbench.settings.backendPane.tier.rangeNote.ipv6': 'IPv6',
  'workbench.settings.backendPane.tier.rangeNote.ulaPractically': 'en la práctica fd00::/8 — asignación privada IPv6',
  'workbench.settings.backendPane.tier.rangeNote.overlayVendors': 'Tailscale, etc.',
  'workbench.settings.backendPane.tier.rangeNote.ipv4LinkLocal': 'IPv4 de enlace local (APIPA)',
  'workbench.settings.backendPane.tier.rangeNote.ipv6LinkLocal':
    'IPv6 de enlace local — cada interfaz se autoasigna una',
  'workbench.settings.backendPane.tier.rangeNote.bonjour': 'Bonjour / Avahi',
  'workbench.settings.backendPane.tier.rangeNote.tlsCert': 'recomendado — certificado TLS',
  'workbench.settings.backendPane.tier.rangeNote.publicIpv4': 'todo lo que queda fuera de RFC1918 / 100.64/10',
  'workbench.settings.backendPane.tier.rangeNote.globallyRoutable': 'enrutable globalmente',
  'workbench.settings.backendPane.tier.rangeNote.tlsRequired':
    'obligatorio — los clientes rechazan ws:// hacia un host que no sea loopback',

  // ── Backend pane: scene-diagram aria labels ────────────────────────
  // The topology scenes themselves stay literal English (illustration
  // plane, S3 glyph precedent); only their accessible names localize.
  'workbench.settings.backendPane.detail.aria.in-browser': 'Back-end en el navegador',
  'workbench.settings.backendPane.detail.aria.desktop-app': 'Back-end de la aplicación de escritorio',
  'workbench.settings.backendPane.detail.aria.local-self-hosted': 'Back-end de servidor en la LAN local',
  'workbench.settings.backendPane.detail.aria.remote-self-hosted': 'Back-end remoto autoalojado',

  // ── Keymap pane body ───────────────────────────────────────────────
  'workbench.settings.keymapPane.searchPlaceholder': 'Buscar atajos',
  'workbench.settings.keymapPane.noMatches': 'Ningún atajo coincide con tu búsqueda.',
  'workbench.settings.keymapPane.recording': 'Pulsa las teclas…',
  'workbench.settings.keymapPane.unbound': 'Sin asignar',
  'workbench.settings.keymapPane.recordTip': 'Haz clic para capturar un atajo nuevo',
  'workbench.settings.keymapPane.recordAria': 'Cambiar el atajo de {label}',
  'workbench.settings.keymapPane.unbind': 'Quitar el atajo',
  'workbench.settings.keymapPane.unbindAria': 'Quitar el atajo de {label}',
  'workbench.settings.keymapPane.resetAria': 'Restablecer el atajo de {label}',
  'workbench.settings.keymapPane.conflictSummary': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} atajo tiene una asignación en conflicto',
      many: '{count} atajos tienen asignaciones en conflicto',
      other: '{count} atajos tienen asignaciones en conflicto',
    }),
  'workbench.settings.keymapPane.conflictShowOnly': 'Mostrar los conflictos',
  'workbench.settings.keymapPane.conflictShowAll': 'Mostrar todos los atajos',
  'workbench.settings.keymapPane.conflictBadgeAria': 'Conflicto de atajo',
  'workbench.settings.keymapPane.conflictTooltip': 'También asignado a: {labels}',
  'workbench.settings.keymapPane.reservedBadgeAria': 'Atajo reservado',
  'workbench.settings.keymapPane.reservedBrowser':
    'El navegador reserva este atajo — puede actuar sobre él antes de que llegue a la aplicación.',
  'workbench.settings.keymapPane.reservedSystem':
    'El sistema operativo reserva este atajo — puede actuar sobre él antes de que llegue a la aplicación.',
  'workbench.settings.keymapPane.lookupTip': 'Encuentra acciones pulsando su atajo',
  'workbench.settings.keymapPane.lookupAria': 'Encontrar una acción por su atajo',
  'workbench.settings.keymapPane.lookupEmpty': 'Ninguna acción está asignada a {chord}.',
  'workbench.settings.keymapPane.conflictPrompt': '{chord} ya está asignado a: {labels}',
  'workbench.settings.keymapPane.conflictReassign': 'Reasignar',
  'workbench.settings.keymapPane.conflictKeepBoth': 'Mantener ambos',
  'workbench.settings.keymapPane.presetAria': 'Preajuste de atajos',
  'workbench.settings.keymapPane.presetRestore': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Restaurar el preajuste ({count} personalización)',
      many: 'Restaurar el preajuste ({count} personalizaciones)',
      other: 'Restaurar el preajuste ({count} personalizaciones)',
    }),
  'workbench.settings.keymapPane.presetRestoreTip': 'Restablecer cada atajo personalizado al preajuste activo.',

  // ── Daemon token ledger (shared by Backend + MCP panes) ────────────
  'workbench.settings.backendTokens.sectionTitle': 'Dispositivos emparejados',
  'workbench.settings.backendTokens.sectionBlurb':
    'Cada dispositivo que se conecta a este back-end se autentica con un token de acceso. Los dispositivos ' +
    'conectados están resaltados; rota un token para emitir un secreto nuevo y retirar el antiguo.',
  'workbench.settings.backendTokens.labelPlaceholder': 'Etiqueta (opcional) — p. ej. «el teléfono de alice»',
  'workbench.settings.backendTokens.bindUserPlaceholder': 'Vincular a un usuario (opcional)',
  'workbench.settings.backendTokens.generate': 'Generar un token',
  'workbench.settings.backendTokens.pairDevice': 'Emparejar un dispositivo',
  'workbench.settings.backendTokens.explainer.intro': 'Ambos añaden un token abajo.',
  'workbench.settings.backendTokens.explainer.generateText':
    'te muestra el secreto para que lo copies y lo pegues tú mismo en el dispositivo.',
  'workbench.settings.backendTokens.explainer.pairText':
    'muestra un código corto que el dispositivo introduce en Configuración → Backend → Emparejar con un ' +
    'código (o abre un enlace, como respaldo) — úsalo cuando otra persona configura el dispositivo.',
  'workbench.settings.backendTokens.empty':
    'Aún no hay dispositivos. Genera un token y pégalo en Configuración → Backend del dispositivo, o ' +
    'empareja un dispositivo y que introduzca allí el código.',
  'workbench.settings.backendTokens.mintFailed': 'No se pudo acuñar el token: {message}',
  'workbench.settings.backendTokens.rotateFailed': 'No se pudo rotar: {message}',
  'workbench.settings.backendTokens.revokeFailed': 'No se pudo revocar: {message}',
  'workbench.settings.backendTokens.revokedDevice':
    'Token revocado. Cualquier dispositivo que lo usara quedó desconectado.',
  'workbench.settings.backendTokens.revokedSession': 'Sesión revocada. El usuario cerró sesión.',
  'workbench.settings.backendTokens.rotate': 'Rotar',
  'workbench.settings.backendTokens.revoke': 'Revocar',
  'workbench.settings.backendTokens.rotateConfirmTitle': '¿Rotar este token?',
  'workbench.settings.backendTokens.rotateConfirmBody':
    'Se acuña un secreto nuevo y el actual se revoca. Hay que dar el token nuevo al dispositivo antes de que ' +
    'pueda reconectarse.',
  'workbench.settings.backendTokens.revokeConfirmTitle': '¿Revocar este token?',
  'workbench.settings.backendTokens.revokeConfirmBody':
    'Cualquier dispositivo que lo esté usando se desconecta de inmediato y no puede reconectarse.',
  'workbench.settings.backendTokens.revokeSessionConfirmTitle': '¿Revocar esta sesión?',
  'workbench.settings.backendTokens.revokeSessionConfirmBody':
    'El usuario cierra sesión y se desconecta de inmediato. Debe iniciar sesión de nuevo a través del ' +
    'proveedor de identidad.',
  'workbench.settings.backendTokens.revokedTag': 'Revocado {when}',
  'workbench.settings.backendTokens.connectedTag': 'Conectado',
  'workbench.settings.backendTokens.expiredTag': 'Caducado',
  'workbench.settings.backendTokens.unlabeled': '(sin etiqueta)',
  'workbench.settings.backendTokens.unbound': '(sin vincular)',
  'workbench.settings.backendTokens.meta.device': 'id {id} · creado {created} · último uso {lastUsed}',
  'workbench.settings.backendTokens.meta.boundUser': 'usuario {user}',
  'workbench.settings.backendTokens.meta.session':
    'sesión iniciada {signedIn} · caduca {expires} · visto por última vez {lastSeen} · id {id}',
  'workbench.settings.backendTokens.ssoTitle': 'Sesiones SSO',
  'workbench.settings.backendTokens.ssoBlurb':
    'Cada inicio de sesión SSO acuña una sesión que caduca por sí sola. Revoca una para cerrar la sesión del ' +
    'usuario de inmediato — deberá iniciar sesión de nuevo a través del proveedor de identidad.',
  'workbench.settings.backendTokens.secretTitle': 'Copia este token ahora',
  'workbench.settings.backendTokens.secretTitleRotated': 'Copia el token rotado ahora',
  'workbench.settings.backendTokens.secretBody':
    'El back-end solo almacena un hash de este valor. Una vez cerrado este diálogo, el secreto no se puede ' +
    'recuperar — si lo pierdes, revoca el token y acuña uno nuevo.',
  'workbench.settings.backendTokens.secretBodyRotated':
    'El token anterior queda revocado — dale este secreto nuevo al dispositivo para que pueda reconectarse. ' +
    'El back-end solo almacena un hash de este valor. Una vez cerrado este diálogo, el secreto no se puede ' +
    'recuperar — si lo pierdes, revoca el token y acuña uno nuevo.',
  'workbench.settings.backendTokens.secretSaved': 'Lo he guardado',

  // ── Daemon pairing modal ────────────────────────────────────────────
  'workbench.settings.backendTokens.pairModal.done': 'Hecho',
  'workbench.settings.backendTokens.pairModal.allocating': 'Asignando el código…',
  'workbench.settings.backendTokens.pairModal.startFailed': 'No se pudo iniciar el emparejamiento',
  'workbench.settings.backendTokens.pairModal.expiredTitle': 'Emparejamiento caducado',
  'workbench.settings.backendTokens.pairModal.expiredBody':
    'La ventana de 5 minutos transcurrió sin confirmación. Cierra este diálogo y haz clic de nuevo en ' +
    'Emparejar un dispositivo para empezar de cero.',
  'workbench.settings.backendTokens.pairModal.pairedTitle': 'Emparejado',
  'workbench.settings.backendTokens.pairModal.pairedBody':
    'El dispositivo confirmó el código. Se emitió un token de acceso nuevo y se guardó en ese dispositivo; ' +
    'aparece en la lista de abajo. Si el dispositivo no puede conectarse, revoca la entrada y empareja de ' +
    'nuevo.',
  'workbench.settings.backendTokens.pairModal.intro.part1': 'En el otro dispositivo, abre',
  'workbench.settings.backendTokens.pairModal.intro.settingsPath': 'Configuración → Backend',
  'workbench.settings.backendTokens.pairModal.intro.part2': ', apunta su',
  'workbench.settings.backendTokens.pairModal.intro.address': 'Dirección del back-end',
  'workbench.settings.backendTokens.pairModal.intro.part3': 'a esta aplicación y haz clic en',
  'workbench.settings.backendTokens.pairModal.intro.part4': 'e introduce:',
  'workbench.settings.backendTokens.pairModal.codeLabel': 'Código de emparejamiento',
  'workbench.settings.backendTokens.pairModal.expiresIn': 'caduca en {remaining}',
  'workbench.settings.backendTokens.pairModal.addressListLabel': 'Dirección del back-end para esta aplicación',
  'workbench.settings.backendTokens.pairModal.fallback.prefix': '¿No hay opción',
  'workbench.settings.backendTokens.pairModal.fallback.suffix':
    'en ese dispositivo? Abre allí uno de estos enlaces en su lugar — sirve una página que entrega un token ' +
    'para pegarlo a mano.',

  // ── Command-line access card (MCP pane) ────────────────────────────
  'workbench.settings.cliAccess.sectionTitle': 'Acceso por línea de comandos',
  'workbench.settings.cliAccess.sectionBlurb':
    'Un clic conecta la herramienta de línea de comandos oh de esta máquina con la aplicación — se crea y ' +
    'guarda un token de acceso para ella, sin copiar nada.',
  'workbench.settings.cliAccess.statusUnconfigured': 'La CLI de esta máquina aún no está conectada.',
  'workbench.settings.cliAccess.statusConfigured': 'CLI conectada como {label}.',
  'workbench.settings.cliAccess.statusStale':
    'El token CLI guardado ya no es válido — configura el acceso de nuevo para reconectar.',
  'workbench.settings.cliAccess.statusExternal':
    'La CLI está conectada actualmente a otro back-end ({url}). Configurar el acceso aquí la apunta a esta ' +
    'aplicación en su lugar.',
  'workbench.settings.cliAccess.statusMalformed': 'El archivo de configuración de la CLI no se puede leer: {message}',
  'workbench.settings.cliAccess.pathNote': 'Guardado en {path}',
  'workbench.settings.cliAccess.setUp': 'Configurar acceso CLI',
  'workbench.settings.cliAccess.rotate': 'Rotar acceso CLI',
  'workbench.settings.cliAccess.connectHere': 'Conectar a esta aplicación',
  'workbench.settings.cliAccess.provisioned':
    'Acceso CLI configurado — oh ya funciona en cualquier terminal de esta máquina.',
  'workbench.settings.cliAccess.rotated': 'Token CLI rotado — el token anterior queda revocado.',
  'workbench.settings.cliAccess.provisionFailed': 'La configuración de la CLI falló: {message}',

  // ── MCP pane body ──────────────────────────────────────────────────
  'workbench.settings.mcpPane.serverOff':
    'El servidor MCP está apagado — los clientes no pueden conectarse hasta que lo actives.',
  'workbench.settings.mcpPane.connect.title': 'Conectar un cliente',
  'workbench.settings.mcpPane.connect.blurb':
    'Elige tu cliente, reemplaza {token} por un token generado arriba y ajusta la ruta de la aplicación si ' +
    'la instalaste en otro sitio. La aplicación debe estar en ejecución para que los clientes se conecten.',
  'workbench.settings.mcpPane.snippet.claudeDesktopTitle':
    'claude_desktop_config.json — fusiónalo con el archivo existente',
  'workbench.settings.mcpPane.snippet.runOnceTitle': 'Ejecútalo una vez en un terminal',
  'workbench.settings.mcpPane.snippet.cliTitle':
    'Ejecútalo una vez en un terminal — las siguientes ejecuciones de oh no necesitan opciones',
  'workbench.settings.mcpPane.snippet.httpTitle': 'Para clientes que hablan streamable HTTP directamente',

  // ── MCP consent (Add-ons popover dialog + TUI-gate checkbox info) ──
  'workbench.settings.mcpConsent.title': 'Activar el servidor MCP',
  'workbench.settings.mcpConsent.body':
    'Los clientes de agentes y la TUI de oh se comunican con esta aplicación a través del servidor MCP, que ' +
    'ahora está desactivado.',
  'workbench.settings.mcpConsent.info.title': 'Servidor MCP',
  'workbench.settings.mcpConsent.info.summary':
    'Los clientes MCP se conectan a esta aplicación a través del endpoint /mcp del back-end (Model Context ' +
    'Protocol sobre HTTP en streaming). El ajuste mcp.enabled controla ese endpoint — mientras está ' +
    'desactivado devuelve 404. Los clientes se autentican con los mismos tokens de acceso que cualquier otra ' +
    'conexión.',
  'workbench.settings.mcpConsent.ok': 'Activar',

  // ── License pane body ──────────────────────────────────────────────
  'workbench.settings.licensePane.invalid.malformed': 'El archivo instalado no es una clave de licencia.',
  'workbench.settings.licensePane.invalid.schema-mismatch':
    'La licencia instalada no coincide con ningún esquema que esta versión admita.',
  'workbench.settings.licensePane.invalid.unknown-kid':
    'La licencia instalada está firmada con una clave en la que este build no confía.',
  'workbench.settings.licensePane.invalid.bad-signature':
    'La licencia instalada no superó la verificación de firma — el texto se alteró después de firmarse.',
  'workbench.settings.licensePane.installed': 'Licencia instalada',
  'workbench.settings.licensePane.removed': 'Licencia eliminada — de vuelta al nivel gratuito',
  'workbench.settings.licensePane.removeFailed': 'No se pudo eliminar la licencia: {message}',
  'workbench.settings.licensePane.freeTier.title': 'Nivel gratuito',
  'workbench.settings.licensePane.freeTier.body':
    'Todo lo que Open Headers ofrece hoy está incluido — el nivel gratuito admite hasta {limit} usuarios ' +
    'activos por servidor. Instala una clave de licencia para elevar el límite de plazas.',
  'workbench.settings.licensePane.invalidAlert.title': 'La licencia instalada no es utilizable',
  'workbench.settings.licensePane.invalidAlert.body':
    'La aplicación sigue funcionando en el nivel gratuito (hasta {limit} usuarios activos). Pega una clave ' +
    'nueva abajo o contacta con el soporte.',
  'workbench.settings.licensePane.grace.title': 'Licencia caducada — periodo de gracia activo',
  'workbench.settings.licensePane.grace.body':
    'Esta licencia caducó el {expiredOn}. Renueva antes del {graceEndsOn} — a partir de ahí, crear o ' +
    'reactivar usuarios recae en el límite gratuito de {limit}. Los usuarios existentes siguen iniciando ' +
    'sesión y ningún dato se ve afectado jamás.',
  'workbench.settings.licensePane.expired.title': 'La licencia y el periodo de gracia han terminado',
  'workbench.settings.licensePane.expired.body':
    'Crear y reactivar usuarios sigue ahora el límite gratuito de {limit} usuarios activos. Los usuarios ' +
    'existentes siguen iniciando sesión, los espacios de trabajo existentes siguen funcionando y ningún dato ' +
    'se ve afectado jamás. Instala una clave renovada para restaurar el número de plazas con licencia.',
  'workbench.settings.licensePane.detail.licensedTo': 'Titular',
  'workbench.settings.licensePane.detail.contact': 'Contacto',
  'workbench.settings.licensePane.detail.seats': 'Plazas',
  'workbench.settings.licensePane.detail.validUntil': 'Válida hasta',
  'workbench.settings.licensePane.detail.licenseId': 'Id de licencia',
  'workbench.settings.licensePane.tag.active': 'Activa',
  'workbench.settings.licensePane.tag.offline': 'Licencia sin conexión',
  'workbench.settings.licensePane.removeConfirm.title': '¿Eliminar esta licencia?',
  'workbench.settings.licensePane.removeConfirm.body':
    'La aplicación vuelve al nivel gratuito (hasta {limit} usuarios activos). Ningún dato se ve afectado.',
  'workbench.settings.licensePane.removeConfirm.ok': 'Eliminar',
  'workbench.settings.licensePane.removeButton': 'Eliminar la licencia',
  'workbench.settings.licensePane.replaceTitle': 'Reemplazar la licencia',
  'workbench.settings.licensePane.installTitle': 'Instalar una licencia',
  'workbench.settings.licensePane.pastePlaceholder': 'Pega tu clave de licencia (oh-license.…)',
  'workbench.settings.licensePane.installButton': 'Instalar',
  'workbench.settings.licensePane.loadFromFile': 'Cargar desde un archivo…',

  // ── System-plane proxy section (REQUEST_ENGINE_PROXY_DESIGN.md P3) ─
  'workbench.settings.systemProxy.title': 'Proxy de salida — este dispositivo',
  'workbench.settings.systemProxy.intro':
    'Cómo alcanzan la red las solicitudes, sesiones WebSocket y llamadas gRPC de esta máquina.',
  'workbench.settings.systemProxy.introNote':
    'Local al dispositivo y nunca sincronizado — todo lo sigue, salvo que una solicitud defina su propio modo de proxy.',
  'workbench.settings.systemProxy.mode.label': 'Modo',
  'workbench.settings.systemProxy.mode.infoTitle': 'Modos de proxy',
  'workbench.settings.systemProxy.mode.infoSummary':
    'Cómo este dispositivo decide la ruta que toma cada solicitud, sesión WebSocket y llamada gRPC.',
  'workbench.settings.systemProxy.mode.infoHeading': 'Modos',
  'workbench.settings.systemProxy.mode.system': 'Sistema',
  'workbench.settings.systemProxy.mode.systemDesc':
    'Sigue la configuración de proxy de esta máquina — ajustes del sistema, archivos PAC y descubrimiento ' +
    'automático — exactamente como el navegador. El modo por defecto; una máquina sin administrar ' +
    'simplemente conecta en directo.',
  'workbench.settings.systemProxy.system.valuesLabel': 'Valores del sistema',
  'workbench.settings.systemProxy.system.sourcedNote':
    'Leídos de esta máquina ({source}) — la resolución sigue respondiendo por URL.',
  'workbench.settings.systemProxy.system.unavailable': 'No se pudo leer la configuración del sistema: {message}',
  'workbench.settings.systemProxy.mode.manual': 'Manual',
  'workbench.settings.systemProxy.mode.manualDesc':
    'Un proxy para todo — HTTP, HTTPS o SOCKS5 según el esquema de la URL — con credenciales del vault y lista de exclusión.',
  'workbench.settings.systemProxy.mode.pac': 'PAC',
  'workbench.settings.systemProxy.mode.pacDesc':
    'Un archivo PAC por URL o ruta local decide por URL. El script se ejecuta solo dentro de la pila de ' +
    'red del navegador, en un entorno aislado, nunca en la aplicación.',
  'workbench.settings.systemProxy.mode.off': 'Desactivado',
  'workbench.settings.systemProxy.mode.offDesc': 'Conectar siempre en directo, diga lo que diga la máquina.',
  'workbench.settings.systemProxy.manual.url': 'Proxy',
  'workbench.settings.systemProxy.manual.urlPlaceholder': 'Sin proxy — conexión directa',
  'workbench.settings.systemProxy.manual.urlExample': 'p. ej. http://proxy.example:8080 o socks5://proxy.example:1080',
  'workbench.settings.systemProxy.manual.urlError':
    'Introduce host:puerto o una URL de proxy http://, https:// o socks5:// — SOCKS4 no es compatible.',
  'workbench.settings.systemProxy.manual.credentials': 'Credenciales',
  'workbench.settings.systemProxy.manual.credentialsPlaceholder': 'Sin autenticación',
  'workbench.settings.systemProxy.manual.bypass': 'Lista de exclusión',
  'workbench.settings.systemProxy.manual.bypassPlaceholder': 'Sin exclusiones — todos los hosts usan el proxy',
  'workbench.settings.systemProxy.manual.bypassExample': 'p. ej. localhost, .internal.example, 10.0.0.0/8',
  'workbench.settings.systemProxy.manual.bypassError':
    'Entradas separadas por comas — sin espacios dentro de una entrada, sin esquema.',
  'workbench.settings.systemProxy.manual.supported': 'Compatibilidad',
  'workbench.settings.systemProxy.pac.source': 'PAC',
  'workbench.settings.systemProxy.pac.sourcePlaceholder': 'Sin URL PAC — conexión directa',
  'workbench.settings.systemProxy.pac.sourceExample': 'p. ej. https://proxy.example/proxy.pac',
  'workbench.settings.systemProxy.pac.sourceError': 'Debe ser una URL PAC http:// o https://.',
  'workbench.settings.systemProxy.pac.kindUrl': 'URL',
  'workbench.settings.systemProxy.pac.kindFile': 'Archivo',
  'workbench.settings.systemProxy.pac.filePlaceholder': 'Sin archivo PAC — conexión directa',
  'workbench.settings.systemProxy.pac.fileExample': 'p. ej. /ruta/al/proxy.pac',
  'workbench.settings.systemProxy.pac.fileError': 'Debe ser una ruta de archivo absoluta.',
  'workbench.settings.systemProxy.pac.browse': 'Examinar…',
  'workbench.settings.systemProxy.saveFailed': 'El ajuste no se pudo guardar: {message}',
  'workbench.settings.systemProxy.previewPlaceholder': 'Previsualiza una URL — ¿qué ruta tomaría?',
  'workbench.settings.systemProxy.previewButton': 'Resolver',

  // ── Proxy trust pane body (PROXY_SECURITY.md §2.3 consent posture) ─
  'workbench.settings.proxyTrustPane.intro':
    'Descifrar el tráfico HTTPS necesita una autoridad de certificación creada en esta máquina. No se ' +
    'instala nada hasta que configures aquí la confianza, y todo lo instalado aquí puede eliminarse aquí.',
  'workbench.settings.proxyTrustPane.refresh': 'Volver a comprobar',
  'workbench.settings.proxyTrustPane.loadFailed': 'El estado de confianza no se pudo leer: {message}',
  'workbench.settings.proxyTrustPane.ca.title': 'Autoridad de certificación',
  'workbench.settings.proxyTrustPane.ca.none':
    'Aún no existe ninguna autoridad de certificación. Se crea en esta máquina la primera vez que configuras ' +
    'la confianza — nunca se distribuye con la aplicación y su clave privada nunca sale de este equipo.',
  'workbench.settings.proxyTrustPane.ca.subject': 'Subject',
  'workbench.settings.proxyTrustPane.ca.fingerprint': 'Huella SHA-256',
  'workbench.settings.proxyTrustPane.ca.validity': 'Válida',
  'workbench.settings.proxyTrustPane.ca.validityRange': 'De {from} hasta {until}',
  'workbench.settings.proxyTrustPane.ca.deleteButton': 'Eliminar la autoridad de certificación',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.title': '¿Eliminar la autoridad de certificación?',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.body':
    'El par de claves se elimina de esta máquina. Configurar la confianza de nuevo crea una autoridad ' + 'fresca.',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.ok': 'Eliminar',
  'workbench.settings.proxyTrustPane.ca.deleted': 'Autoridad de certificación eliminada',
  'workbench.settings.proxyTrustPane.ca.deleteFailed': 'No se pudo eliminar la autoridad de certificación: {message}',
  'workbench.settings.proxyTrustPane.stores.title': 'Almacenes de confianza',
  'workbench.settings.proxyTrustPane.stores.loginKeychain': 'Llavero de inicio de sesión',
  'workbench.settings.proxyTrustPane.stores.systemKeychain': 'Llavero del sistema',
  'workbench.settings.proxyTrustPane.stores.firefoxProfile': 'Perfil de Firefox',
  'workbench.settings.proxyTrustPane.stores.state.trusted': 'De confianza',
  'workbench.settings.proxyTrustPane.stores.state.absent': 'No instalado',
  'workbench.settings.proxyTrustPane.stores.state.untrusted': 'Presente, sin confianza',
  'workbench.settings.proxyTrustPane.stores.state.mismatch': 'Certificado distinto',
  'workbench.settings.proxyTrustPane.stores.state.unavailable': 'Ilegible',
  'workbench.settings.proxyTrustPane.stores.state.covered': 'Cubierto vía almacén del sistema',
  'workbench.settings.proxyTrustPane.stores.state.optedOut': 'Desactivado en Firefox',
  'workbench.settings.proxyTrustPane.stores.empty': 'No hay almacenes de confianza visibles en esta máquina.',
  'workbench.settings.proxyTrustPane.mismatchAlert.title': 'Un almacén de confianza contiene un certificado distinto',
  'workbench.settings.proxyTrustPane.mismatchAlert.body':
    'Hay instalado un certificado con el nombre de nuestra autoridad, pero su huella no es la autoridad de ' +
    'esta máquina. Esta aplicación no lo instaló y nunca lo usa — revisa el almacén donde vive.',
  'workbench.settings.proxyTrustPane.recordedCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} instalación registrada',
      many: '{count} instalaciones registradas',
      other: '{count} instalaciones registradas',
    }),
  'workbench.settings.proxyTrustPane.installButton': 'Configurar la confianza…',
  'workbench.settings.proxyTrustPane.wizard.title': 'Instalar la autoridad de certificación del proxy',
  'workbench.settings.proxyTrustPane.wizard.explain.whatTitle': 'Qué se instala',
  'workbench.settings.proxyTrustPane.wizard.explain.whatBody':
    'Un certificado raíz creado en esta máquina, único para esta instalación. Su clave privada está cifrada ' +
    'en reposo y nunca se envía a ninguna parte.',
  'workbench.settings.proxyTrustPane.wizard.explain.enablesTitle': 'Qué permite',
  'workbench.settings.proxyTrustPane.wizard.explain.enablesBody':
    'Los almacenes de confianza que lo contienen aceptan los certificados del proxy de captura, así que ' +
    'puede descifrar HTTPS — solo para los hosts que delimites explícitamente. Todo lo demás pasa intacto.',
  'workbench.settings.proxyTrustPane.wizard.explain.removeTitle': 'Cómo se elimina',
  'workbench.settings.proxyTrustPane.wizard.explain.removeBody':
    'Cada cambio queda registrado, y un clic en esta página deshace exactamente esos cambios. Desinstalar ' +
    'la aplicación hace lo mismo.',
  'workbench.settings.proxyTrustPane.wizard.explain.next': 'Elegir almacenes de confianza',
  'workbench.settings.proxyTrustPane.wizard.choose.blurb': 'Elige dónde instalar. Nada cambia hasta que confirmes.',
  'workbench.settings.proxyTrustPane.wizard.choose.loginNote':
    'Aplicaciones que se ejecutan como tú — sin aprobación de administrador.',
  'workbench.settings.proxyTrustPane.wizard.choose.systemNote':
    'Todos los usuarios de esta máquina — pide aprobación de administrador.',
  'workbench.settings.proxyTrustPane.wizard.choose.systemUnavailable':
    'La confianza a nivel de sistema aún no está disponible en esta versión — requiere el asistente de ' +
    'OpenHeaders. Usa el llavero de inicio de sesión por ahora.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxNote':
    'Firefox mantiene su propio almacén de confianza — se instala en cada perfil encontrado.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxNone':
    'No se encontraron perfiles de Firefox en esta máquina.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxUnavailable':
    'Se encontraron perfiles de Firefox, pero certutil (herramientas NSS) no está instalado — sus almacenes de confianza no se pueden gestionar desde esta máquina.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxOsNote':
    'Firefox confía automáticamente en el almacén del sistema (Firefox 120+) — los llaveros de arriba lo cubren.',
  'workbench.settings.proxyTrustPane.wizard.choose.confirm': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Instalar en {count} almacén',
      many: 'Instalar en {count} almacenes',
      other: 'Instalar en {count} almacenes',
    }),
  'workbench.settings.proxyTrustPane.wizard.results.allOk':
    'La confianza está instalada en todos los almacenes que elegiste.',
  'workbench.settings.proxyTrustPane.wizard.results.partial':
    'Algunos almacenes quedaron sin cambios. Nada se reintenta solo — corrige la causa y configura la ' +
    'confianza de nuevo, o elimina la confianza para revertir.',
  'workbench.settings.proxyTrustPane.wizard.results.ok': 'Instalado y de confianza',
  'workbench.settings.proxyTrustPane.wizard.results.elevation':
    'La aprobación de administrador fue rechazada — el almacén quedó sin cambios.',
  'workbench.settings.proxyTrustPane.wizard.results.residue':
    'El certificado se añadió pero no se pudo aprobar. Usa «Eliminar la confianza» para limpiarlo.',
  'workbench.settings.proxyTrustPane.wizard.results.failed': 'Falló: {message}',
  'workbench.settings.proxyTrustPane.wizard.installFailed': 'La configuración de la confianza falló: {message}',
  'workbench.settings.proxyTrustPane.wizard.done': 'Hecho',
  'workbench.settings.proxyTrustPane.removeButton': 'Eliminar la confianza',
  'workbench.settings.proxyTrustPane.removeConfirm.title':
    '¿Eliminar el certificado de todos los almacenes registrados?',
  'workbench.settings.proxyTrustPane.removeConfirm.body':
    'Cada instalación registrada se deshace y se verifica limpia antes de descartar su registro. La ' +
    'autoridad de certificación en sí se conserva para una reinstalación posterior.',
  'workbench.settings.proxyTrustPane.removeConfirm.ok': 'Eliminar',
  'workbench.settings.proxyTrustPane.removed':
    'Confianza eliminada — todos los almacenes registrados se verificaron limpios.',
  'workbench.settings.proxyTrustPane.removePartial':
    'Algunos almacenes no se pudieron verificar limpios. Sus registros se conservan — vuelve a ejecutar la ' +
    'eliminación cuando la causa esté corregida.',
  'workbench.settings.proxyTrustPane.removeFailed': 'La eliminación falló: {message}',
  'workbench.settings.proxyTrustPane.helper.title': 'Asistente privilegiado',
  'workbench.settings.proxyTrustPane.helper.blurb':
    'La confianza del llavero del Sistema pasa por un asistente firmado, registrado en macOS como elemento en segundo plano. Solo mueve los bytes del certificado — cada decisión de confianza sigue pasando por el diálogo de administración de macOS.',
  'workbench.settings.proxyTrustPane.helper.notPresent':
    'No incluido en esta compilación — solo compilaciones macOS empaquetadas.',
  'workbench.settings.proxyTrustPane.helper.registrationLabel': 'Registro',
  'workbench.settings.proxyTrustPane.helper.serverLabel': 'Servidor',
  'workbench.settings.proxyTrustPane.helper.state.enabled': 'Registrado',
  'workbench.settings.proxyTrustPane.helper.state.requiresApproval': 'Esperando aprobación',
  'workbench.settings.proxyTrustPane.helper.state.notRegistered': 'No registrado',
  'workbench.settings.proxyTrustPane.helper.state.notFound':
    'No encontrado — primero instala la aplicación en Aplicaciones',
  'workbench.settings.proxyTrustPane.helper.state.unknown': 'Desconocido',
  'workbench.settings.proxyTrustPane.helper.probe.ok': 'Responde',
  'workbench.settings.proxyTrustPane.helper.probe.down': 'No responde',
  'workbench.settings.proxyTrustPane.helper.approvalHint':
    'macOS espera una aprobación: activa OpenHeaders en Ítems de inicio › «Permitir en segundo plano» y vuelve a comprobar.',
  'workbench.settings.proxyTrustPane.helper.registerButton': 'Registrar',
  'workbench.settings.proxyTrustPane.helper.unregisterButton': 'Anular registro',
  'workbench.settings.proxyTrustPane.helper.loginItemsButton': 'Abrir ítems de inicio',
  'workbench.settings.proxyTrustPane.helper.actionFailed': 'La acción del asistente falló: {message}',

  // ── Backend-details scene pills ────────────────────────────────────
  // Architecture component names (sync-engine · rule-engine · oracle ·
  // vault) are glossary vocabulary and ride raw inside the pills; only
  // the connective text keys here.
  'workbench.settings.backendDetails.backEndTitle': 'Back-end = {engine}',
  'workbench.settings.backendDetails.servedOn': 'servido en {via}',
  'workbench.settings.backendDetails.apiClientsTitle': 'Clientes API = {count}',
  'workbench.settings.backendDetails.frontEndTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Front-end = {count} superficie alojada',
      many: 'Front-end = {count} superficies alojadas',
      other: 'Front-end = {count} superficies alojadas',
    }),
  'workbench.settings.backendDetails.optIn': '(opcional)',

  // ── Backend-details device-frame labels ────────────────────────────
  // The scene diagrams' device-container labels are user-facing scene
  // vocabulary and key here. Inner window corners ("Browser" / "CLI"),
  // the CI/CD YAML mock, prompt glyphs, and engine/where pill args stay
  // raw as diagram internals. Browser window titles (Chrome / Firefox /
  // Edge) are glossary proper nouns; the in-browser combined title keys
  // with the brand vocabulary raw inside the value.
  'workbench.settings.backendDetails.device.laptop': 'Portátil',
  'workbench.settings.backendDetails.device.desktop': 'Ordenador de sobremesa',
  'workbench.settings.backendDetails.device.workstation': 'Estación de trabajo',
  'workbench.settings.backendDetails.device.localServer': 'Servidor local',
  'workbench.settings.backendDetails.device.remoteServer': 'Servidor remoto',
  'workbench.settings.backendDetails.device.yourDevice': 'Tu dispositivo',
  'workbench.settings.backendDetails.inBrowserTitle': 'Open Headers — Chrome / Edge / Firefox',

  // ── Git pane (workspace-tree binding card, GIT_PLAN.md §9) ─────────
  'workbench.settings.gitPane.notBound.title': 'Ninguna carpeta vinculada',
  'workbench.settings.gitPane.notBound.body':
    'Vincula este espacio de trabajo a una carpeta para mantener un árbol YAML vivo de cada regla, solicitud y ' +
    'entorno — listo para copias de seguridad, diffs, ediciones a mano y (pronto) git.',
  'workbench.settings.gitPane.pathPlaceholder': 'Ruta absoluta de la carpeta',
  'workbench.settings.gitPane.chooseFolder': 'Elegir carpeta…',
  'workbench.settings.gitPane.bindButton': 'Vincular carpeta',
  'workbench.settings.gitPane.bound': 'Carpeta vinculada.',
  'workbench.settings.gitPane.boundInitialized': 'Carpeta inicializada como un nuevo árbol de espacio de trabajo.',
  'workbench.settings.gitPane.boundTitle': 'Carpeta vinculada',
  'workbench.settings.gitPane.boundBody':
    'Las ediciones se materializan continuamente en esta carpeta; los cambios hechos en los archivos vuelven a ' +
    'la aplicación.',
  'workbench.settings.gitPane.unbindButton': 'Desvincular',
  'workbench.settings.gitPane.unbindConfirm.title': '¿Desvincular esta carpeta?',
  'workbench.settings.gitPane.unbindConfirm.body':
    'La carpeta sigue siendo un árbol de espacio de trabajo válido en disco; la aplicación simplemente deja de ' +
    'leerla y escribirla.',
  'workbench.settings.gitPane.unbindConfirm.ok': 'Desvincular',
  'workbench.settings.gitPane.unbound': 'Carpeta desvinculada.',
  'workbench.settings.gitPane.issuesTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} archivo no se pudo leer y se deja intacto',
      many: '{count} archivos no se pudieron leer y se dejan intactos',
      other: '{count} archivos no se pudieron leer y se dejan intactos',
    }),
  'workbench.settings.gitPane.refusal.locked':
    'Esta carpeta ya está vinculada a otro motor en ejecución (proceso {pid}).',
  'workbench.settings.gitPane.refusal.uuidCollision':
    'Esta carpeta contiene un espacio de trabajo que ya existe en este host a través de otra fuente.',
  'workbench.settings.gitPane.refusal.identityMismatch': 'Esta carpeta pertenece a otro espacio de trabajo ({uid}).',
  'workbench.settings.gitPane.refusal.invalidManifest': 'No se pudo leer el workspace.yaml de la carpeta: {message}',
  'workbench.settings.gitPane.refusal.alreadyBound': 'Este espacio de trabajo ya está vinculado a una carpeta.',
  'workbench.settings.gitPane.refusal.unknownWorkspace': 'No hay ningún espacio de trabajo activo que vincular.',
  'workbench.settings.gitPane.git.title': 'Git',
  'workbench.settings.gitPane.git.missing.title': 'Git no está instalado',
  'workbench.settings.gitPane.git.missing.body':
    'Instala git para confirmar el historial de esta carpeta. Todo lo demás sigue funcionando sin él.',
  'workbench.settings.gitPane.git.belowFloor.body':
    'La versión de git instalada ({version}) es demasiado antigua para esta función. Actualiza git para habilitar los commits.',
  'workbench.settings.gitPane.git.dirtyCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cambio sin confirmar',
      many: '{count} cambios sin confirmar',
      other: '{count} cambios sin confirmar',
    }),
  'workbench.settings.gitPane.git.clean': 'Árbol de trabajo limpio',
  'workbench.settings.gitPane.git.indexBusy':
    'El auto-commit está en pausa mientras tu propio índice de git tenga cambios preparados.',
  'workbench.settings.gitPane.git.messagePlaceholder': 'Mensaje del commit',
  'workbench.settings.gitPane.git.commitButton': 'Commit',
  'workbench.settings.gitPane.git.committed': 'Commit {sha} creado.',
  'workbench.settings.gitPane.git.nothingToCommit': 'Nada que confirmar — el árbol coincide con el último commit.',
  'workbench.settings.gitPane.git.commitFailed': 'El commit falló: {detail}',
  'workbench.settings.gitPane.git.cadenceLabel': 'Auto-commit',
  'workbench.settings.gitPane.git.cadenceOff': 'Desactivado — commit manual',
  'workbench.settings.gitPane.git.cadenceAuto': 'Tras una pausa de edición',
  'workbench.settings.gitPane.git.cadenceOnBlur': 'Cuando el foco sale de la aplicación',
  'workbench.settings.gitPane.git.cadenceEvery': 'Cada {minutes} minutos',
  'workbench.settings.gitPane.git.bypassHooksLabel': 'Omitir los hooks de git (--no-verify)',
  'workbench.settings.gitPane.git.bypassHooksWarning':
    'Mientras esta opción esté activa, los commits del motor omiten tus hooks pre-commit y commit-msg.',
  'workbench.settings.gitPane.git.remoteInSync': '{upstream}: sincronizado',
  'workbench.settings.gitPane.git.remoteStatus': '{upstream}: {ahead} por delante, {behind} por detrás',
  'workbench.settings.gitPane.git.noUpstream':
    'No hay remoto configurado — añade uno con git remote add y git push -u para activar Pull.',
  'workbench.settings.gitPane.git.pullButton': 'Pull',
  'workbench.settings.gitPane.git.pulled': 'Fusión {sha} completada.',
  'workbench.settings.gitPane.git.upToDate': 'Ya está actualizado.',
  'workbench.settings.gitPane.git.pullFailed': 'Error en el pull: {detail}',
  'workbench.settings.gitPane.git.pushButton': 'Push',
  'workbench.settings.gitPane.git.pushed': 'Push de {sha} completado.',
  'workbench.settings.gitPane.git.nothingToPush': 'Nada que enviar — ya está sincronizado.',
  'workbench.settings.gitPane.git.pushFailed': 'Error en el push: {detail}',
  'workbench.settings.gitPane.git.pushRejected':
    'El remoto tiene commits nuevos — haz pull primero y vuelve a hacer push.',
  'workbench.settings.gitPane.git.pushNoPermission.title': 'Sin acceso de escritura',
  'workbench.settings.gitPane.git.pushNoPermission.body':
    'Este remoto es de solo lectura para ti. Tus commits se quedan en local; puedes publicarlos como una rama nueva y abrir una merge request desde tu servidor git.',
  'workbench.settings.gitPane.git.exportBranchPlaceholder': 'nombre-de-rama',
  'workbench.settings.gitPane.git.exportBranchButton': 'Enviar como rama nueva',
  'workbench.settings.gitPane.git.exportedBranch': 'Rama {branch} enviada.',
  'workbench.settings.gitPane.git.autoPushLabel': 'Hacer push tras cada commit',
  'workbench.settings.gitPane.git.branch.title': 'Ramas',
  'workbench.settings.gitPane.git.branch.current': 'En la rama {branch}',
  'workbench.settings.gitPane.git.branch.detached': 'HEAD separado — crea una rama para conservar este historial.',
  'workbench.settings.gitPane.git.branch.switchLabel': 'Cambiar a',
  'workbench.settings.gitPane.git.branch.switched': 'Cambiado a {branch}.',
  'workbench.settings.gitPane.git.branch.switchFailed': 'No se pudo cambiar de rama: {detail}',
  'workbench.settings.gitPane.git.branch.dirtyTitle': 'Tienes cambios sin commit',
  'workbench.settings.gitPane.git.branch.dirtyBody': ({ count, branch }, locale) =>
    formatMessage(
      plural(locale, Number(count), {
        one: 'Haz commit, guarda en stash o descarta {count} cambio sin commit antes de cambiar a {branch}.',
        many: 'Haz commit, guarda en stash o descarta {count} cambios sin commit antes de cambiar a {branch}.',
        other: 'Haz commit, guarda en stash o descarta {count} cambios sin commit antes de cambiar a {branch}.',
      }),
      { branch: String(branch) },
    ),
  'workbench.settings.gitPane.git.branch.dirtyCommit': 'Commit y cambiar',
  'workbench.settings.gitPane.git.branch.dirtyStash': 'Stash y cambiar',
  'workbench.settings.gitPane.git.branch.dirtyDiscard': 'Descartar cambios',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.title': '¿Descartar los cambios sin commit?',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.body':
    'Se eliminan todos los cambios sin commit, incluidos los archivos nuevos. Esta acción no se puede deshacer.',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.ok': 'Descartar',
  'workbench.settings.gitPane.git.branch.createPlaceholder': 'nombre-de-rama',
  'workbench.settings.gitPane.git.branch.createButton': 'Crear y cambiar',
  'workbench.settings.gitPane.git.branch.created': 'Rama {branch} creada.',
  'workbench.settings.gitPane.git.branch.createFailed': 'No se pudo crear la rama: {detail}',
  'workbench.settings.gitPane.git.branch.mergeLabel': 'Fusionar en la rama actual',
  'workbench.settings.gitPane.git.branch.mergeButton': 'Fusionar',
  'workbench.settings.gitPane.git.branch.merged': 'Fusión {sha} completada.',
  'workbench.settings.gitPane.git.branch.mergeUpToDate': 'Ya está al día.',
  'workbench.settings.gitPane.git.branch.mergeFailed': 'La fusión falló: {detail}',
  'workbench.settings.gitPane.git.forcePush.title': 'El historial remoto fue reescrito',
  'workbench.settings.gitPane.git.forcePush.body':
    'La rama remota ya no contiene el historial sincronizado por última vez ({sha}). Elige cómo proceder — nada cambia hasta que decidas.',
  'workbench.settings.gitPane.git.forcePush.abandon': 'Abandonar los cambios locales',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.title': '¿Abandonar los cambios locales?',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.body':
    'Los commits locales desde la última sincronización se descartan y el historial remoto reescrito pasa a ser el estado del workspace.',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.ok': 'Abandonar',
  'workbench.settings.gitPane.git.forcePush.rescue': 'Preservar en una rama de rescate',
  'workbench.settings.gitPane.git.forcePush.reapply': 'Reaplicar encima',
  'workbench.settings.gitPane.git.forcePush.resolved': 'Historial reescrito aceptado ({sha}).',
  'workbench.settings.gitPane.git.forcePush.rescued': 'Historial local preservado en {branch}.',
  'workbench.settings.gitPane.git.forcePush.failed': 'No se pudo resolver: {detail}',
  'workbench.settings.gitPane.git.history.title': 'Historial',
  'workbench.settings.gitPane.git.history.show': 'Mostrar historial',
  'workbench.settings.gitPane.git.history.hide': 'Ocultar',
  'workbench.settings.gitPane.git.history.empty': 'Aún no hay commits.',
  'workbench.settings.gitPane.git.history.loadFailed': 'No se pudo leer el historial: {detail}',
  'workbench.settings.gitPane.git.history.authorLine': '{author} · {date}',
  'workbench.settings.gitPane.git.history.coAuthors': 'Coautoría de {authors}',
  'workbench.settings.gitPane.git.history.fileTitle': 'Historial — {path}',
  'workbench.settings.gitPane.git.history.fileEmpty': 'Aún no hay commits que toquen este archivo.',
} as const satisfies Catalog;
