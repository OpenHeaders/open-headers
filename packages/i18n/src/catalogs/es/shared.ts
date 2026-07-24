/**
 * Shared namespace — Spanish. Mirrors `catalogs/en/shared.ts` key for
 * key; see that file for the namespace rules. Register contract for the
 * es catalogs (pattern-setter, S53 idiom): informal `tú` imperative
 * (`copia`, `actualiza`), sentence-case labels, inverted marks `¿¡`
 * with no space before closing `?!`, `«»` without inner spaces when
 * quoting, en's `{percent}%` figure style kept unspaced. Loanwords
 * ride raw as in fr: `back-end` (m.), `handshake` (m.), `token` (m.),
 * `popup` (m.), `WebSocket`, `vault` (lowercase). Header = encabezado;
 * request = solicitud; workspace = espacio de trabajo; pair =
 * emparejar.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const shared = {
  'shared.action.save': 'Guardar',
  'shared.action.cancel': 'Cancelar',
  'shared.action.close': 'Cerrar',
  'shared.action.copy': 'Copiar',
  'shared.action.remove': 'Quitar',
  'shared.toast.copiedToClipboard': 'Copiado al portapapeles',
  'shared.toast.copyFailed': 'Acceso al portapapeles denegado — copia el valor manualmente',
  'shared.count.rules': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} regla', many: '{count} reglas', other: '{count} reglas' }),

  // ── Top-level error boundary ─────────────────────────────────────────
  'shared.errorBoundary.title': 'Algo salió mal',
  'shared.errorBoundary.subtitle': 'Hubo un error al cargar el popup. Ciérralo y vuelve a abrirlo.',
  'shared.errorBoundary.reload': 'Recargar',

  // ── Invalidated-context notice (DevTools panel orphan watch) ────────
  'shared.contextInvalidated.title': 'Open Headers se ha actualizado o recargado',
  'shared.contextInvalidated.body': 'Cierra y vuelve a abrir DevTools para continuar.',

  // ── Connection-probe notices ─────────────────────────────────────────
  'shared.probe.connectionOk': 'Conexión OK',
  'shared.probe.reachableDescription': '{label} está accesible.',
  'shared.probe.notReachable': 'No accesible',
  'shared.probe.title.authRequired': 'Accesible, pero requiere autenticación',
  'shared.probe.title.workspaceUnknown': 'Accesible, pero el espacio de trabajo no está compartido',
  'shared.probe.title.versionMismatch': 'Accesible, pero las versiones no coinciden',
  'shared.probe.title.notReady': 'Accesible, pero no está listo',
  'shared.probe.fail.invalidUrl': 'URL no válida.',
  'shared.probe.fail.invalidUrlDetail': 'URL no válida. {detail}',
  'shared.probe.fail.timeout': 'Se agotó el tiempo de espera — ¿está el back-end en marcha?',
  'shared.probe.fail.closedBeforeWelcome':
    'Conexión cerrada antes del handshake — probablemente el back-end no está en marcha en ese puerto.',
  'shared.probe.fail.openFailed': 'No se pudo abrir el WebSocket.',
  'shared.probe.fail.openFailedDetail': 'No se pudo abrir el WebSocket: {detail}.',
  'shared.probe.fail.protocolMismatch':
    'Accesible, pero las versiones de protocolo son incompatibles — actualiza ambas aplicaciones.',
  'shared.probe.fail.workspaceUnknown':
    'Accesible — el back-end está activo pero aún no comparte este espacio de trabajo. Cambiar emparejará los dos.',
  'shared.probe.fail.protocolTooOld':
    'Accesible — pero esta aplicación es más antigua que el back-end. Actualiza este lado.',
  'shared.probe.fail.protocolTooNew':
    'Accesible — pero el back-end es más antiguo que esta aplicación. Actualiza el back-end.',
  'shared.probe.fail.authRequired':
    'Accesible — pero este dispositivo aún no está autenticado. Empareja con un código o pega un token arriba ' +
    'y luego pulsa Cambiar.',
  'shared.probe.fail.rejected': 'Rechazado: {reason}',
  'shared.probe.fail.rejectedUnknown': 'Rechazado: motivo desconocido',
  'shared.probe.fail.malformedWelcome': 'Respondió un servidor, pero no habla el protocolo Open Headers.',
  'shared.probe.fail.generic': 'La prueba de conexión falló.',
} as const satisfies Catalog;
