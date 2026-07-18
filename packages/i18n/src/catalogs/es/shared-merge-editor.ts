/**
 * Shared merge-editor family — Spanish. Mirrors
 * `catalogs/en/shared-merge-editor.ts` key for key; keyboard chords
 * (byte-faithful, double space included), the ✕ ▶ ◀ ↘ ↙ · glyphs and
 * the `+ − ~ =` kind-label prefixes stay raw. `hunk` (m.) stays raw as
 * merge vocabulary. Mints: incoming = entrante; current = actual;
 * pane = panel; side gutters = márgenes laterales; merge = fusión.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const sharedMergeEditor = {
  // ── Toolbar ────────────────────────────────────────────────────────
  'shared.mergeEditor.toolbar.prevHunk': 'Hunk anterior · Cmd/Ctrl+K  P',
  'shared.mergeEditor.toolbar.nextHunk': 'Hunk siguiente · Cmd/Ctrl+K  N',
  'shared.mergeEditor.toolbar.allResolved': 'Todos los hunks resueltos',
  'shared.mergeEditor.toolbar.hunksRemaining': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} hunk restante',
      many: '{count} hunks restantes',
      other: '{count} hunks restantes',
    }),
  'shared.mergeEditor.toolbar.conflictsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} conflicto',
      many: '{count} conflictos',
      other: '{count} conflictos',
    }),
  'shared.mergeEditor.toolbar.nonConflictingCount': '{count} sin conflicto',
  'shared.mergeEditor.toolbar.applyNonConflictingTooltip':
    'Aplica cada hunk que solo un lado tocó, en un único paso de deshacer. Los conflictos quedan para ' +
    'resolverse a mano. · Cmd/Ctrl+K  A',
  'shared.mergeEditor.toolbar.applyNonConflicting': 'Aplicar los sin conflicto',
  'shared.mergeEditor.toolbar.acceptAll': 'Aceptar todo',
  'shared.mergeEditor.toolbar.acceptAllIncomingFile': 'Aceptar todo lo entrante (este archivo)',
  'shared.mergeEditor.toolbar.acceptAllCurrentFile': 'Aceptar todo lo actual (este archivo)',
  'shared.mergeEditor.toolbar.acceptAllIncomingSession': 'Aceptar todo lo entrante (toda la sesión)',
  'shared.mergeEditor.toolbar.acceptAllCurrentSession': 'Aceptar todo lo actual (toda la sesión)',
  'shared.mergeEditor.toolbar.acceptAllIncoming': 'Aceptar todo lo entrante',
  'shared.mergeEditor.toolbar.acceptAllCurrent': 'Aceptar todo lo actual',
  'shared.mergeEditor.toolbar.baseUnavailable': 'Vista base no disponible — no hay ancestro común en esta sesión.',
  'shared.mergeEditor.toolbar.resetLayout': 'Restablecer los tamaños de panel de la disposición actual',

  // ── Layout segments ────────────────────────────────────────────────
  'shared.mergeEditor.layout.column': 'Columnas',
  'shared.mergeEditor.layout.baseOnTop': 'Base arriba',
  'shared.mergeEditor.layout.baseInCenter': 'Base en el centro',

  // ── View toggles ───────────────────────────────────────────────────
  'shared.mergeEditor.toggle.showNonConflicting': 'Mostrar los sin conflicto',
  'shared.mergeEditor.toggle.compactView': 'Vista compacta',
  'shared.mergeEditor.toggle.compactViewTooltip':
    'Colapsa las regiones sin cambios en todos los paneles — solo quedan visibles las zonas de hunk (más unas ' +
    'líneas de contexto). Útil en archivos donde la mayoría de las líneas no cambian.',
  'shared.mergeEditor.toggle.singleClickResolve': 'Resolver con un clic',
  'shared.mergeEditor.toggle.singleClickResolveTooltip':
    'Activado, aceptar un lado de un hunk descarta automáticamente el otro y el hunk se resuelve con un clic. ' +
    'Desactivado, se mantiene el añadido diagonal (↘ / ↙) para poder apilar ambos lados.',
  'shared.mergeEditor.toggle.inlineLabels': 'Etiquetas en línea',
  'shared.mergeEditor.toggle.inlineLabelsTooltip':
    "Muestra las etiquetas '{accept} | {combine} | {ignore}' sobre cada hunk pendiente en los paneles " +
    'laterales. Independiente de la disposición.',
  'shared.mergeEditor.toggle.sideGutters': 'Márgenes laterales',
  'shared.mergeEditor.toggle.sideGuttersTooltip': 'Muestra los glifos ✕ ▶ / ◀ ✕ a los lados del editor de resultado.',
  'shared.mergeEditor.toggle.sideGuttersUnavailable':
    'Los márgenes laterales solo están disponibles en la disposición Columnas — base-arriba y base-en-el-centro ' +
    'ponen el resultado en una fila separada de los suyos / los míos.',

  // ── Session-wide Accept-all confirms ───────────────────────────────
  'shared.mergeEditor.confirm.acceptIncomingTitle': 'Aceptar todo lo entrante (sesión)',
  'shared.mergeEditor.confirm.acceptCurrentTitle': 'Aceptar todo lo actual (sesión)',
  'shared.mergeEditor.confirm.replaceWithIncoming': 'Sustituye {scope} por la versión entrante.',
  'shared.mergeEditor.confirm.resetToCurrent': 'Restablece {scope} a tu versión actual.',
  'shared.mergeEditor.confirm.discardsLocal': 'Esto descarta tus ediciones locales de todos los archivos de la sesión.',
  'shared.mergeEditor.confirm.discardsIncoming':
    'Esto descarta todos los cambios entrantes de todos los archivos de la sesión.',
  'shared.mergeEditor.confirm.okIncoming': 'Aceptar todo lo entrante',
  'shared.mergeEditor.confirm.okCurrent': 'Aceptar todo lo actual',
  'shared.mergeEditor.confirm.cancel': 'Cancelar',
  'shared.mergeEditor.sessionScope.files': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} archivo',
      many: '{count} archivos',
      other: '{count} archivos',
    }),
  'shared.mergeEditor.groupOther': 'Otros',

  // ── Apply errors + footer + empty state ────────────────────────────
  'shared.mergeEditor.errors.applyReported': 'Al aplicar se señalaron errores:',
  'shared.mergeEditor.errors.unknown': 'error desconocido',
  'shared.mergeEditor.emptySession': 'No hay archivos en esta sesión de fusión.',
  'shared.mergeEditor.footer.cancel': 'Cancelar',
  'shared.mergeEditor.footer.completeMerge': 'Completar la fusión',

  // ── Pane headers + sash arias ──────────────────────────────────────
  'shared.mergeEditor.pane.incoming': 'Entrante (los suyos)',
  'shared.mergeEditor.pane.result': 'Resultado',
  'shared.mergeEditor.pane.yoursEditHere': 'Los tuyos (los míos, edita aquí)',
  'shared.mergeEditor.pane.current': 'Actual (los míos)',
  'shared.mergeEditor.pane.base': 'Base (ancestro común)',
  'shared.mergeEditor.sash.columns12': 'Redimensionar columna 1 / columna 2',
  'shared.mergeEditor.sash.columns23': 'Redimensionar columna 2 / columna 3',
  'shared.mergeEditor.sash.rows': 'Redimensionar fila superior / fila inferior',

  // ── File-list sidebar ──────────────────────────────────────────────
  'shared.mergeEditor.fileList.kindAdded': 'Añadido',
  'shared.mergeEditor.fileList.kindModified': 'Modificado',
  'shared.mergeEditor.fileList.kindRemoved': 'Eliminado',
  'shared.mergeEditor.fileList.statusUnresolved': 'sin resolver',
  'shared.mergeEditor.fileList.statusPartial': 'parcial',
  'shared.mergeEditor.fileList.statusResolved': 'resuelto',
  'shared.mergeEditor.fileList.statusFailed': 'fallido',
  'shared.mergeEditor.fileList.pairedWith': 'Emparejado con: {label}',
  'shared.mergeEditor.fileList.hunksRemaining': '{count} hunks restantes',

  // ── Monaco view-zone plane ─────────────────────────────────────────
  'shared.mergeEditor.zone.acceptIncoming': 'Aceptar entrante',
  'shared.mergeEditor.zone.acceptCurrent': 'Aceptar actual',
  'shared.mergeEditor.zone.acceptCombination': 'Aceptar combinación',
  'shared.mergeEditor.zone.ignore': 'Ignorar',
  'shared.mergeEditor.zone.combineTooltip': 'Apilar ambos lados — primero lo entrante, luego lo actual',
  'shared.mergeEditor.zone.removeIncoming': 'Quitar entrante',
  'shared.mergeEditor.zone.removeCurrent': 'Quitar actual',
  'shared.mergeEditor.zone.revertIncomingTitle': 'Devolver lo entrante a pendiente para decidir de nuevo',
  'shared.mergeEditor.zone.revertCurrentTitle': 'Devolver lo actual a pendiente para decidir de nuevo',
  'shared.mergeEditor.zone.statusNoChanges': 'Ningún cambio aceptado',
  'shared.mergeEditor.zone.statusIncomingPlusCurrent': 'Entrante + actual',
  'shared.mergeEditor.zone.statusIncoming': 'Entrante',
  'shared.mergeEditor.zone.statusCurrent': 'Actual',
  'shared.mergeEditor.zone.statusIncomingSkipped': 'Entrante omitido',
  'shared.mergeEditor.zone.statusCurrentSkipped': 'Actual omitido',
  'shared.mergeEditor.zone.kindAdds': '+ Añade',
  'shared.mergeEditor.zone.kindRemoves': '− Elimina',
  'shared.mergeEditor.zone.kindModifies': '~ Modifica',
  'shared.mergeEditor.zone.kindUnchanged': '= Sin cambios',

  // ── Monaco command-palette actions ─────────────────────────────────
  'shared.mergeEditor.action.nextHunk': 'Fusión: ir al hunk siguiente',
  'shared.mergeEditor.action.prevHunk': 'Fusión: ir al hunk anterior',
  'shared.mergeEditor.action.acceptIncomingAtCursor': 'Fusión: aceptar el hunk entrante en el cursor',
  'shared.mergeEditor.action.acceptCurrentAtCursor': 'Fusión: aceptar el hunk actual en el cursor',
  'shared.mergeEditor.action.applyNonConflicting': 'Fusión: aplicar los cambios sin conflicto',
  'shared.mergeEditor.action.acceptAllIncoming': 'Fusión: aceptar todo lo entrante',
  'shared.mergeEditor.action.acceptAllCurrent': 'Fusión: aceptar todo lo actual',
  'shared.mergeEditor.action.undo': 'Fusión: deshacer (búfer + estado de elecciones)',
  'shared.mergeEditor.action.redo': 'Fusión: rehacer (búfer + estado de elecciones)',

  // ── Result-pane action gutter ──────────────────────────────────────
  'shared.mergeEditor.gutter.acceptIncoming': 'Aceptar entrante',
  'shared.mergeEditor.gutter.acceptCurrent': 'Aceptar actual',
  'shared.mergeEditor.gutter.appendIncoming': 'Añadir también lo entrante después de lo actual',
  'shared.mergeEditor.gutter.appendCurrent': 'Añadir también lo actual después de lo entrante',
  'shared.mergeEditor.gutter.skipIncoming': 'Omitir lo entrante en este hunk',
  'shared.mergeEditor.gutter.skipCurrent': 'Omitir lo actual en este hunk',

  // ── ARIA live announcements ────────────────────────────────────────
  'shared.mergeEditor.announce.allResolved': 'Todos los hunks resueltos.',
  'shared.mergeEditor.announce.remaining': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} hunk restante.',
      many: '{count} hunks restantes.',
      other: '{count} hunks restantes.',
    }),
  'shared.mergeEditor.announce.acceptedIncoming': 'Hunk entrante aceptado.',
  'shared.mergeEditor.announce.acceptedCurrent': 'Hunk actual aceptado.',
  'shared.mergeEditor.announce.appliedNonConflicting': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Aplicado {count} hunk sin conflicto.',
      many: 'Aplicados {count} hunks sin conflicto.',
      other: 'Aplicados {count} hunks sin conflicto.',
    }),
  'shared.mergeEditor.announce.acceptedAllIncoming': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Aceptado {count} hunk entrante.',
      many: 'Aceptados los {count} hunks entrantes.',
      other: 'Aceptados los {count} hunks entrantes.',
    }),
  'shared.mergeEditor.announce.acceptedAllCurrent': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Aceptado {count} hunk actual.',
      many: 'Aceptados los {count} hunks actuales.',
      other: 'Aceptados los {count} hunks actuales.',
    }),
} as const satisfies Catalog;
