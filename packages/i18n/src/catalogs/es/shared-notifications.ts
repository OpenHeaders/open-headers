/**
 * Shared notifications family — Spanish. Mirrors
 * `catalogs/en/shared-notifications.ts` key for key; see that file for
 * the family rules (store copy is captured at push time — timeline
 * entries keep the locale they were pushed under). Mints: timeline =
 * cronología; keychain (macOS) = llavero; keyring (Linux) = anillo de
 * claves; credential store = almacén de credenciales.
 */

import type { Catalog } from '../../types';

export const sharedNotifications = {
  // ── Tool window chrome ─────────────────────────────────────────────
  'shared.notifications.title': 'Notificaciones',
  'shared.notifications.info.summary':
    'Sugerencias sobre tu configuración y una cronología de sesión con los eventos de la aplicación — ' +
    'disponibilidad de actualizaciones, resultados de tareas en segundo plano y otros avisos, reunidos aquí en ' +
    'lugar de interrumpir tu trabajo.',
  'shared.notifications.suggestionsHeading': 'Sugerencias',
  'shared.notifications.timelineHeading': 'Cronología',
  'shared.notifications.clearAll': 'Borrar todo',
  'shared.notifications.suggestionsEmpty.title': 'Sin sugerencias',
  'shared.notifications.suggestionsEmpty.description': 'Los consejos sobre tu configuración aparecerán aquí.',
  'shared.notifications.timelineEmpty.title': 'Sin notificaciones',
  'shared.notifications.timelineEmpty.description':
    'Los eventos de la aplicación y las actualizaciones aparecerán aquí.',
  'shared.notifications.dismiss': 'Descartar',
  'shared.notifications.moreActions': 'Más acciones',

  // ── Mute ("Don't show again") flow ─────────────────────────────────
  'shared.notifications.dontShowAgain': 'No volver a mostrar',
  'shared.notifications.muted.title': 'Notificaciones desactivadas',
  'shared.notifications.muted.description': '«{title}» no se volverá a mostrar.',
  'shared.notifications.muted.reEnable': 'Reactivar',
  'shared.notifications.muted.reEnableTooltip': 'Permitir que esta notificación se muestre de nuevo',

  // ── Seed nudges ────────────────────────────────────────────────────
  'shared.notifications.seed.website.title': 'Descubre Open Headers',
  'shared.notifications.seed.website.description':
    'Explora todas nuestras funciones de forma interactiva, además de las últimas novedades.',
  'shared.notifications.seed.website.action': 'Visita nuestro sitio web',
  'shared.notifications.seed.website.tooltip': 'Abrir el sitio web y borrar la notificación',
  'shared.notifications.seed.star.title': 'Ayúdanos a crecer',
  'shared.notifications.seed.star.description': 'Recomiéndanos a tus amigos y colegas',
  'shared.notifications.seed.star.action': 'Danos una estrella en GitHub',
  'shared.notifications.seed.star.tooltip': 'Abrir GitHub y borrar la notificación',

  // ── Desktop-app suggestion (browser hosts without the companion) ───
  'shared.notifications.desktopApp.title': 'Una experiencia de usuario unificada',
  'shared.notifications.desktopApp.rowTerminal': 'Terminal integrado — acceso completo al shell en tus espacios de trabajo',
  'shared.notifications.desktopApp.rowGit': 'Control de versiones — commits e historial de Git para tus espacios de trabajo',
  'shared.notifications.desktopApp.rowProxy': 'Captura el tráfico en vivo de tus pestañas del navegador o del sistema',
  'shared.notifications.desktopApp.rowMcp': 'Servidor MCP para asistentes de IA — análisis del tráfico en vivo y depuración',
  'shared.notifications.desktopApp.rowRequests': 'Crea y ejecuta solicitudes API nativas — gRPC, WebSocket, SSE y más',
  'shared.notifications.desktopApp.action': 'Descargar la aplicación de escritorio',
  'shared.notifications.desktopApp.tooltip': 'Descargar la app y borrar la sugerencia',

  // ── App-update timeline entries ────────────────────────────────────
  'shared.notifications.appUpdate.title': 'Open Headers {version} disponible',
  'shared.notifications.appUpdate.securityTitle': 'Actualización de seguridad Open Headers {version} disponible',
  'shared.notifications.appUpdate.securityDescription':
    'Esta versión corrige un problema de seguridad que afecta a la versión que estás usando. Actualiza lo antes ' +
    'posible.',
  'shared.notifications.appUpdate.download': 'Descargar…',

  // ── Update corner balloon (AppUpdateToast) ─────────────────────────
  'shared.notifications.toast.settings': 'Configuración…',
  'shared.notifications.toast.dontShowAgain': 'No volver a mostrar',
  'shared.notifications.toast.optionsTooltip': 'Desactivar o cambiar el comportamiento',
  'shared.notifications.toast.optionsAria': 'Opciones de notificación de actualizaciones',
  'shared.notifications.toast.close': 'Cerrar',
  'shared.notifications.toast.upToDateTitle': 'Estás al día',
  'shared.notifications.toast.upToDateDescription': 'Open Headers {version} es la última versión.',
  'shared.notifications.toast.checkFailed': 'La comprobación de actualizaciones falló',
  'shared.notifications.toast.downloadFailed': 'La descarga de la actualización falló',
  'shared.notifications.toast.available': 'Open Headers {version} disponible',
  'shared.notifications.toast.update': 'Actualizar…',
  'shared.notifications.toast.packageManager': 'Actualiza con tu gestor de paquetes de Linux.',
  'shared.notifications.toast.releaseNotes': 'Notas de la versión',
  'shared.notifications.toast.readyToInstall': 'Open Headers {version} listo para instalar',
  'shared.notifications.toast.restartToInstall': 'Reiniciar para instalar',
  'shared.notifications.toast.updatedTo': 'Actualizado a Open Headers {version}',
  'shared.notifications.toast.seeWhatsNew': 'Ver las novedades',

  // ── Security-floor entry banner ────────────────────────────────────
  'shared.notifications.securityBanner.messageWithVersion':
    'Open Headers {availableVersion} corrige un problema de seguridad que afecta a la versión que estás usando ' +
    '({currentVersion}). Actualiza lo antes posible.',
  'shared.notifications.securityBanner.messageNoVersion':
    'Hay publicada una corrección de seguridad para la versión que estás usando ({currentVersion}). Actualiza ' +
    'lo antes posible.',
  'shared.notifications.securityBanner.update': 'Actualizar…',

  // ── Secrets-storage suggestion ─────────────────────────────────────
  'shared.notifications.secrets.title': 'El almacenamiento de secretos está bloqueado',
  'shared.notifications.secrets.description':
    'Los secretos del Vault y los tokens de OAuth no se pueden leer ni guardar en esta sesión. {remedy}',
  'shared.notifications.secrets.relaunch': 'Relanzar la aplicación',
  'shared.notifications.secrets.remedy.darwin':
    'A Open Headers se le denegó el acceso al llavero del sistema. Relanza la aplicación y permite el acceso ' +
    'al llavero cuando se te pida.',
  'shared.notifications.secrets.remedy.linux':
    'No hay ningún anillo de claves utilizable. Configura uno (GNOME Keyring o KWallet) y luego relanza la ' +
    'aplicación.',
  'shared.notifications.secrets.remedy.other':
    'Open Headers no pudo acceder al almacén de credenciales del sistema. Relanza la aplicación para volver a ' +
    'intentarlo.',
} as const satisfies Catalog;
