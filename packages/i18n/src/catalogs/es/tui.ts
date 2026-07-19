/**
 * TUI namespace — the `oh tui` terminal dashboard — Spanish. Mirrors
 * `catalogs/en/tui.ts` key for key. Data stays data: workspace /
 * environment / rule names, uids, URLs, kinds, and daemon-provided
 * copy render verbatim; `daemon`, `uid`, `vars`, `env` and the
 * `oh status` command ride raw. Footer verbs terse lowercase;
 * environment = entorno; dashboard = panel de control; la TUI (f.,
 * interfaz); host (m.) loanword.
 */

import type { Catalog } from '../../types';

export const tui = {
  // ── Header context strip ───────────────────────────────────────────
  'tui.header.product': 'OpenHeaders',
  'tui.header.env': 'env: {name}',
  'tui.header.envNone': 'env: ninguno',
  'tui.header.connected': 'conectado',
  'tui.header.unreachable': 'daemon inaccesible',
  'tui.header.synced': 'sincronizado hace {ago}',
  'tui.header.syncedJustNow': 'sincronizado justo ahora',
  'tui.header.syncing': 'sincronizando…',

  // ── Pane titles and summaries ──────────────────────────────────────
  'tui.pane.workspaces': 'Espacios de trabajo',
  'tui.pane.environments': 'Entornos',
  'tui.pane.rules': 'Reglas',
  'tui.pane.rules.summary': '{on} activas {sep} {off} inactivas {sep} {draft} borradores',

  // ── Row vocabulary (format.ts markers, catalog-keyed) ──────────────
  'tui.row.on': 'activa',
  'tui.row.off': 'inactiva',
  'tui.row.draft': '(borrador)',
  'tui.row.notLoaded': 'no cargado',
  'tui.row.vars': '{count} vars',
  'tui.row.noEnvironment': 'Sin entorno',
  'tui.row.masked': '(enmascarado)',

  // ── Footer legend verbs (priority-dropped right to left) ───────────
  'tui.footer.move': 'mover',
  'tui.footer.open': 'abrir',
  'tui.footer.filter': 'filtrar',
  'tui.footer.refresh': 'actualizar',
  'tui.footer.yank': 'copiar uid',
  'tui.footer.quit': 'salir',
  'tui.footer.back': 'volver',
  'tui.footer.scroll': 'desplazar',
  'tui.footer.retryNow': 'reintentar',
  'tui.footer.palette': 'paleta',
  'tui.footer.help': 'ayuda',
  'tui.footer.toggle': 'alternar',
  'tui.footer.publish': 'publicar',
  'tui.footer.switch': 'cambiar',

  // ── Help overlay (`?` cheatsheet) ──────────────────────────────────
  'tui.help.title': 'Teclado',
  'tui.help.group.navigate': 'Navegar',
  'tui.help.group.act': 'Actuar',
  'tui.help.group.find': 'Buscar',
  'tui.help.group.session': 'Sesión',
  'tui.help.topBottom': 'inicio / fin',
  'tui.help.page': 'página',
  'tui.help.focusPane': 'enfocar panel',
  'tui.help.backClear': 'volver / limpiar',
  'tui.help.filterPane': 'filtrar panel',
  'tui.help.thisHelp': 'esta ayuda',
  'tui.help.palette': 'paleta de comandos',
  'tui.help.openSwitch': 'abrir / cambiar',
  'tui.help.toggleRule': 'alternar regla',
  'tui.help.publish': 'publicar/despublicar',
  'tui.help.note': 'Las mismas teclas que la aplicación cuando el terminal lo permite.',
  'tui.help.close': 'cerrar',

  // ── Command palette (Ctrl+K) ───────────────────────────────────────
  'tui.palette.action.refresh': 'Actualizar ahora',
  'tui.palette.action.help': 'Abrir la ayuda',
  'tui.palette.action.switchWorkspace': 'Cambiar de espacio de trabajo…',
  'tui.palette.action.switchEnvironment': 'Cambiar de entorno…',
  'tui.palette.action.toggleRule': 'Activar/desactivar la regla',
  'tui.palette.action.publishRule': 'Publicar / despublicar la regla',
  'tui.palette.picker.workspace': 'Cambiar de espacio de trabajo',
  'tui.palette.picker.environment': 'Cambiar de entorno',
  'tui.palette.empty': 'ningún comando coincide',
  'tui.palette.run': 'ejecutar',

  // ── Filter line ────────────────────────────────────────────────────
  'tui.filter.line': 'filtro: /{query} {sep} {count} coincidencias',

  // ── Notices ────────────────────────────────────────────────────────
  'tui.notice.yanked': 'uid copiado al portapapeles',
  'tui.notice.staleData': 'mostrando los últimos datos conocidos — reconectando…',
  'tui.notice.writeLost': 'cambio no aplicado — daemon inaccesible',

  // ── Empty states ───────────────────────────────────────────────────
  'tui.empty.rules.title': 'Aún no hay reglas en este espacio de trabajo.',
  'tui.empty.rules.body':
    'Las reglas se crean en la aplicación OpenHeaders — el panel de control las recoge en cuanto existen. ' +
    'Pulsa r para actualizar.',
  'tui.empty.environments.title': 'Aún no hay entornos en este espacio de trabajo.',
  'tui.empty.environments.body':
    'Los entornos se crean en la aplicación OpenHeaders. «Sin entorno» sigue siendo seleccionable mientras tanto.',

  // ── Rule drill-in (read-only detail) ───────────────────────────────
  'tui.detail.rule.title': 'Regla: {name}',
  'tui.detail.state': 'estado',
  'tui.detail.type': 'tipo',
  'tui.detail.uid': 'uid',
  'tui.detail.state.published': 'publicada — activa en las extensiones de navegador conectadas',
  'tui.detail.state.draft': 'borrador — sin efecto en el tráfico real',
  'tui.detail.editingNote': 'La edición se hace en la aplicación OpenHeaders — la TUI lee y alterna.',
  'tui.detail.loading': 'cargando…',

  // ── Environment drill-in ───────────────────────────────────────────
  'tui.detail.env.title': 'Entorno: {name}',

  // ── Daemon-unreachable park screen ─────────────────────────────────
  'tui.park.title': 'Daemon inaccesible o MCP desactivado',
  'tui.park.body1': 'El daemon OpenHeaders no está accesible en',
  'tui.park.body2': '{url}, o su superficie MCP está desactivada.',
  'tui.park.hint1': 'Inicia la aplicación OpenHeaders (o tu host daemon),',
  'tui.park.hint2': 'o sondea la superficie con:  oh status',
  'tui.park.hint3': 'Luego pulsa r para reintentar.',
  'tui.park.retryIn': 'reintento automático {sep} próximo intento en {seconds}s',
  'tui.park.retrying': 'reintentando…',
} as const satisfies Catalog;
