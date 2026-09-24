/**
 * Workspace-org family — Japanese. Mirrors
 * `catalogs/en/shared-workspace.ts` key for key; see that file for the
 * viewer-side composition contract and the raw plane (Org names,
 * backend labels/URLs, LAN/WAN, the → glyph). Org rides raw (zh-CN
 * precedent). Mints: 同期 = sync; 再ペアリング = re-pair; 接続 =
 * connection; バックアップと同期 = Backup and Sync.
 */

import type { Catalog } from '../../types';

export const sharedWorkspace = {
  // ── Org host-kind hints (second-person home-Org sub-labels) ────────
  'shared.org.hint.browser': 'このブラウザー',
  'shared.org.hint.desktop': 'このコンピューター',
  'shared.org.hint.serverLocal': 'ローカルサーバー',
  'shared.org.hint.serverRemote': 'リモートサーバー',

  // ── Org places — what a joined Org's group header reads as ─────────
  'shared.org.place.desktopApp': 'このコンピューター · デスクトップアプリ',
  'shared.org.place.desktopAppNamed': '{name} · デスクトップアプリ',
  'shared.org.place.server': '{name} · サーバー',

  // ── Org sync-provenance annotations ("via <backend>") ──────────────
  'shared.org.sync.removed': '同期は停止しています',
  'shared.org.sync.off': '{label} 経由 — オフ、同期していません',
  'shared.org.sync.connecting': '{label} 経由 — 接続中…',
  'shared.org.sync.synced': '{label} 経由',
  'shared.org.sync.repair': '{label} 経由 — 再ペアリングが必要',
  'shared.org.sync.disconnected': '{label} 経由 — 切断',
  'shared.org.sync.orphaned': '接続が削除されました — ローカルコピー',

  // ── Org states beside a place (the switcher headers name the place) ─
  'shared.org.state.off': 'オフ、同期していません',
  'shared.org.state.repair': '再ペアリングが必要',
  'shared.org.state.disconnected': '切断',

  // ── Org scope descriptions (WorkspaceOrgBadge tooltip) ─────────────
  'shared.org.scope.local.browser': 'このデバイスの、このブラウザーの中にとどまります。どこにも同期されません。',
  'shared.org.scope.local.desktopClient':
    'このデバイスの、デスクトップアプリの中にとどまります。どこにも同期されません。',
  'shared.org.scope.local.desktopLan':
    'お使いのデバイスにとどまります。ローカルネットワーク（LAN）経由で同期されます。',
  'shared.org.scope.local.desktopLoopback':
    'このデバイスにとどまります。デスクトップアプリと接続中のブラウザーの間で同期されます。',
  'shared.org.scope.local.serverLan': 'このサーバーで共有されます。ローカルネットワーク（LAN）経由で同期されます。',
  'shared.org.scope.local.serverWan': 'このサーバーで共有されます。インターネット（WAN）経由で同期されます。',
  'shared.org.scope.local.serverLoopback': 'このサーバー上にあります。このマシンからのみ接続できます。',
  'shared.org.scope.local.generic': 'このデバイスにとどまります。',
  'shared.org.scope.personal.desktop':
    'このデバイスにとどまります。このブラウザーとデスクトップアプリの間で同期されます。',
  'shared.org.scope.personal.serverWan': 'インターネット（WAN）経由でお使いのサーバーと同期されます。',
  'shared.org.scope.personal.serverLan': 'ローカルネットワーク（LAN）経由でお使いのサーバーと同期されます。',
  'shared.org.scope.personal.generic': 'お使いのデバイス間で同期されます。',
  'shared.org.scope.team.wan': 'インターネット（WAN）経由でチームと共有されます。',
  'shared.org.scope.team.lan': 'ローカルネットワーク（LAN）経由でチームと共有されます。',
  'shared.org.scope.team.generic': 'このチームの全員と共有されます。',

  // ── Workspace dropdown body ─────────────────────────────────────────
  'shared.workspaceDropdown.searchPlaceholder': 'ワークスペースを検索…',
  'shared.workspaceDropdown.noMatch': '検索に一致するワークスペースはありません。',
  'shared.workspaceDropdown.empty': 'ワークスペースはまだありません。',
  'shared.workspaceDropdown.activeTag': 'アクティブ',
  'shared.workspaceDropdown.activePopoverTitle': 'アクティブなワークスペース',
  'shared.workspaceDropdown.activePopoverBody':
    'ルールエンジンは、ライブトラフィックを変更するためにこのワークスペースの HTTP ルールを注入しています。ブラウザーごとに、一度にアクティブにできるワークスペースは 1 つだけです。',
  'shared.workspaceDropdown.setActiveTooltip': 'アクティブにする',
  'shared.workspaceDropdown.checkActiveTooltip': 'アクティブなワークスペース',
  'shared.workspaceDropdown.makeActiveAria': '「{name}」をアクティブなワークスペースにする',
  'shared.workspaceDropdown.orphanedOrgHeader': '同期停止',
  'shared.workspaceDropdown.noAccessRow': 'ワークスペースなし。アクセスはまだ付与されていません',
  'shared.workspaceDropdown.openPlace': '{place} を開く',
  'shared.workspaceDropdown.activeFooterLabel': 'アクティブ：',
  'shared.workspaceDropdown.export': 'エクスポート',
  'shared.workspaceDropdown.import': 'インポート',
  'shared.workspaceDropdown.manage': 'ワークスペースを管理',

  // ── The one entry row into Backup and Sync (the plan D2) ────────────
  'shared.workspaceDropdown.backupAndSync': 'バックアップと同期…',

  // ── Org-switch header (inline landing annotation + why-tooltip) ─────
  'shared.workspaceDropdown.orgSwitch.aria': '{label} に切り替える',
  'shared.workspaceDropdown.orgSwitch.ariaWithTarget': '{label} → {name} に切り替える',
  'shared.workspaceDropdown.orgSwitch.landsOnInline': '→ {name}',
  'shared.workspaceDropdown.orgSwitch.landsOnLastUsed':
    'この Org で最後に使ったワークスペースのため、「{name}」に移動します。',
  'shared.workspaceDropdown.orgSwitch.landsOnDefault':
    'この Org のデフォルトのワークスペースのため、「{name}」に移動します。',
  'shared.workspaceDropdown.orgSwitch.landsOnFirst': 'この Org の最初のワークスペースのため、「{name}」に移動します。',
} as const satisfies Catalog;
