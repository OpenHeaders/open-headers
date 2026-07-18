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

  // ── Filter line ────────────────────────────────────────────────────
  'tui.filter.line': 'filtro: /{query} {sep} {count} coincidencias',

  // ── Notices ────────────────────────────────────────────────────────
  'tui.notice.yanked': 'uid copiado al portapapeles',
  'tui.notice.staleData': 'mostrando los últimos datos conocidos — reconectando…',

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
  'tui.detail.editingNote': 'La edición se hace en la aplicación OpenHeaders — la TUI lee.',
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
