/**
 * TUI namespace — the `oh tui` terminal dashboard — Japanese. Mirrors
 * `catalogs/en/tui.ts` key for key. Data stays data: workspace /
 * environment / rule names, uids, URLs, kinds, and daemon-provided copy
 * render verbatim; `env`, `uid`, `vars`, `{seconds}s` and the
 * `oh status` command ride raw (de/es precedent). daemon = デーモン per
 * the shared mint ledger. File mints: ダッシュボード = dashboard; 切替
 * = toggle (terse footer/palette verb — 切り替え stays switch per the
 * referent-split law); マスク = masked; footer verbs terse forms. The
 * park screen's double space before `oh status` is layout — keep it.
 */

import type { Catalog } from '../../types';

export const tui = {
  // ── Header context strip ───────────────────────────────────────────
  'tui.header.product': 'OpenHeaders',
  'tui.header.env': 'env: {name}',
  'tui.header.envNone': 'env: なし',
  'tui.header.connected': '接続済み',
  'tui.header.unreachable': 'デーモンに到達できません',
  'tui.header.synced': '{ago} 前に同期',
  'tui.header.syncedJustNow': 'たった今同期',
  'tui.header.syncing': '同期中…',

  // ── Pane titles and summaries ──────────────────────────────────────
  'tui.pane.workspaces': 'ワークスペース',
  'tui.pane.environments': '環境',
  'tui.pane.rules': 'ルール',
  'tui.pane.rules.summary': '{on} オン {sep} {off} オフ {sep} {draft} 下書き',

  // ── Row vocabulary (format.ts markers, catalog-keyed) ──────────────
  'tui.row.on': 'オン',
  'tui.row.off': 'オフ',
  'tui.row.draft': '（下書き）',
  'tui.row.notLoaded': '未読み込み',
  'tui.row.vars': '{count} vars',
  'tui.row.noEnvironment': '環境なし',
  'tui.row.masked': '（マスク）',

  // ── Footer legend verbs (priority-dropped right to left) ───────────
  'tui.footer.move': '移動',
  'tui.footer.open': '開く',
  'tui.footer.filter': 'フィルター',
  'tui.footer.refresh': '更新',
  'tui.footer.yank': 'uid をコピー',
  'tui.footer.quit': '終了',
  'tui.footer.back': '戻る',
  'tui.footer.scroll': 'スクロール',
  'tui.footer.retryNow': '今すぐ再試行',
  'tui.footer.palette': 'パレット',
  'tui.footer.help': 'ヘルプ',
  'tui.footer.toggle': '切替',
  'tui.footer.publish': '公開',
  'tui.footer.switch': '切り替え',

  // ── Help overlay (`?` cheatsheet) ──────────────────────────────────
  'tui.help.title': 'キーボード',
  'tui.help.group.navigate': 'ナビゲーション',
  'tui.help.group.act': '操作',
  'tui.help.group.find': '検索',
  'tui.help.group.session': 'セッション',
  'tui.help.topBottom': '先頭 / 末尾',
  'tui.help.page': 'ページ',
  'tui.help.focusPane': 'ペインにフォーカス',
  'tui.help.backClear': '戻る / クリア',
  'tui.help.filterPane': 'ペインをフィルター',
  'tui.help.thisHelp': 'このヘルプ',
  'tui.help.palette': 'コマンドパレット',
  'tui.help.openSwitch': '開く / 切り替え',
  'tui.help.toggleRule': 'ルールを切替',
  'tui.help.publish': '公開 / 公開解除',
  'tui.help.note': 'ターミナルが許す範囲で、アプリと同じキーです。',
  'tui.help.close': '閉じる',

  // ── Command palette (Ctrl+K) ───────────────────────────────────────
  'tui.palette.action.refresh': '今すぐ更新',
  'tui.palette.action.help': 'ヘルプを開く',
  'tui.palette.action.switchWorkspace': 'ワークスペースを切り替え…',
  'tui.palette.action.switchEnvironment': '環境を切り替え…',
  'tui.palette.action.toggleRule': 'ルールの有効化を切替',
  'tui.palette.action.publishRule': 'ルールを公開 / 公開解除',
  'tui.palette.picker.workspace': 'ワークスペースを切り替え',
  'tui.palette.picker.environment': '環境を切り替え',
  'tui.palette.empty': '一致するコマンドはありません',
  'tui.palette.run': '実行',

  // ── Filter line ────────────────────────────────────────────────────
  'tui.filter.line': 'フィルター: /{query} {sep} {count} 件一致',

  // ── Notices ────────────────────────────────────────────────────────
  'tui.notice.yanked': 'uid をクリップボードにコピーしました',
  'tui.notice.staleData': '最後に取得したデータを表示中。再接続しています…',
  'tui.notice.writeLost': '変更は適用されませんでした。デーモンに到達できません',

  // ── Empty states ───────────────────────────────────────────────────
  'tui.empty.rules.title': 'このワークスペースにルールはまだありません。',
  'tui.empty.rules.body':
    'ルールは OpenHeaders アプリで作成します。ダッシュボードは作成され次第それを拾います。r を押すと更新します。',
  'tui.empty.environments.title': 'このワークスペースに環境はまだありません。',
  'tui.empty.environments.body': '環境は OpenHeaders アプリで作成します。それまでは「環境なし」が選択できます。',

  // ── Rule drill-in (read-only detail) ───────────────────────────────
  'tui.detail.rule.title': 'ルール：{name}',
  'tui.detail.state': '状態',
  'tui.detail.type': '種類',
  'tui.detail.uid': 'uid',
  'tui.detail.state.published': '公開済み：接続中のブラウザー拡張機能でライブ',
  'tui.detail.state.draft': '下書き：ライブトラフィックへの効果なし',
  'tui.detail.editingNote': '編集は OpenHeaders アプリで行います。TUI は読み取りと切替を行います。',
  'tui.detail.loading': '読み込み中…',

  // ── Environment drill-in ───────────────────────────────────────────
  'tui.detail.env.title': '環境：{name}',

  // ── Daemon-unreachable park screen ─────────────────────────────────
  'tui.park.title': 'デーモンに到達できないか、MCP が無効です',
  'tui.park.body1': 'OpenHeaders デーモンに次の場所で到達できないか、',
  'tui.park.body2': '{url}、またはその MCP の面がオフになっています。',
  'tui.park.hint1': 'OpenHeaders アプリ（またはデーモンのホスト）を起動するか、',
  'tui.park.hint2': '次のコマンドで面をプローブしてください：  oh status',
  'tui.park.hint3': 'その後、r を押して再試行してください。',
  'tui.park.retryIn': '自動的に再試行中 {sep} 次の試行まで {seconds}s',
  'tui.park.retrying': '再試行中…',
} as const satisfies Catalog;
