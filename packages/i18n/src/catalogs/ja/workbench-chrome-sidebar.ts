/**
 * Workbench chrome — the navigator plane — Japanese. Mirrors
 * `catalogs/en/workbench-chrome-sidebar.ts` key for key. Entity names,
 * collection names, and counts ride raw inside keyed values; `vars` /
 * `VAULT` / `Vault` / `delete-wins` / `cURL` / `fetch` / the Live
 * prefix ride raw. ja has no capitalization — section headers render
 * the plain nouns. Reuses mints: スクラッチ = Scratch, 下書き = Draft,
 * ブロック = Block, 上書き = override, コレクション / ワークフロー / 環境
 * / 仕様 carried; rule-type names align with the chrome registry
 * (ヘッダー / ブロック / リダイレクト / クエリパラメーター / 注入 / 遅延).
 * File mints: パッケージライブラリ = Package Library; 取り代え =
 * supersede (superseded local edit); 一致範囲 = rule-match coverage
 * (scope-widened — third referent beside スコープ and 範囲, S19 law);
 * 一時停止の上書き = pause override; 再開 = resume/unpause; 元に戻す =
 * revert; ミュート = mute; 秘匿解除 = unredacted; ピア = peer carried
 * from chrome.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchChromeSidebar = {
  // ── Sidebar: section headers (caps in the value) ────────────────────
  'workbench.sidebar.section.rules': 'ルール',
  'workbench.sidebar.section.templates': 'テンプレート',
  'workbench.sidebar.section.requests': 'リクエスト',
  'workbench.sidebar.section.workflows': 'ワークフロー',
  'workbench.sidebar.section.environments': '環境',
  'workbench.sidebar.section.vault': 'VAULT',
  'workbench.sidebar.section.workspaceVariables': 'ワークスペース変数',
  'workbench.sidebar.section.liveVariables': 'ライブ変数',
  'workbench.sidebar.section.packageLibrary': 'パッケージライブラリ',
  'workbench.sidebar.section.specs': '仕様',

  // ── Sidebar: per-view header title ──────────────────────────────────
  'workbench.sidebar.view.httpRules': 'ブラウザーインターセプター',
  'workbench.sidebar.view.apiRequests': 'API リクエスト',
  'workbench.sidebar.view.workflows': 'ワークフロー',
  'workbench.sidebar.view.variables': '変数',

  // ── Sidebar: header action cluster ──────────────────────────────────
  'workbench.sidebar.header.newRule': '新しいルール',
  'workbench.sidebar.header.addRequest': 'リクエストを追加',
  'workbench.sidebar.header.createNewEnvironment': '新しい環境を作成',
  'workbench.sidebar.header.createNewSpec': '新しい仕様を作成',
  'workbench.sidebar.header.newWorkflow': '新しいワークフロー',
  'workbench.sidebar.header.newTemplateCollection': '新しいテンプレートコレクション',
  'workbench.sidebar.header.exportSelected': '選択した {count} 件をエクスポート…',
  'workbench.sidebar.header.exportSelectedAria': '選択した {count} 件のアイテムをエクスポート',
  'workbench.sidebar.header.clearSelection': '選択を解除',
  'workbench.sidebar.header.clearSelectionAria': 'エクスポートの選択を解除',
  'workbench.sidebar.header.selectOpenedTab': '開いているタブを選択',
  'workbench.sidebar.header.selectOpenedTabAria': '開いているタブを選択',
  'workbench.sidebar.header.expandAll': 'すべて展開',
  'workbench.sidebar.header.expandAllAria': 'すべて展開',
  'workbench.sidebar.header.collapseAll': 'すべて折りたたむ',
  'workbench.sidebar.header.collapseAllAria': 'すべて折りたたむ',
  'workbench.sidebar.behavior.title': '動作',
  'workbench.sidebar.behavior.openEntriesSingleClick': 'シングルクリックでエントリを開く',
  'workbench.sidebar.behavior.openCollectionsSingleClick': 'シングルクリックでコレクションを開く',
  'workbench.sidebar.behavior.openFoldersSingleClick': 'シングルクリックでフォルダーを開く',
  'workbench.sidebar.behavior.alwaysSelectOpened': '開いているタブを常に選択',
  'workbench.sidebar.appearance.title': '外観',
  'workbench.sidebar.appearance.showIndentGuides': 'インデントガイドを表示',
  'workbench.sidebar.dnd.itemsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のアイテム' }),
  'workbench.sidebar.toast.itemsMoved': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のアイテムを移動しました' }),
  'workbench.sidebar.toast.moveFailed': '移動に失敗しました',
  'workbench.sidebar.filterPlaceholder': 'フィルター',

  // ── Sidebar: speed-search bar (on-demand, dual filter/search mode) ──
  'workbench.sidebar.menu.search': '検索',
  'workbench.sidebar.search.searchPlaceholder': '検索',
  'workbench.sidebar.search.modeSearch': '検索：一致する行をハイライト',
  'workbench.sidebar.search.modeFilter': 'フィルター：一致しない行を隠す',
  'workbench.sidebar.search.noMatches': '一致なし',
  'workbench.sidebar.search.close': '検索を閉じる',

  // ── Sidebar: container + row menus ──────────────────────────────────
  'workbench.sidebar.menu.newCollection': '新しいコレクション',
  'workbench.sidebar.menu.newRequest': '新しいリクエスト',
  'workbench.sidebar.menu.import': 'インポート…',
  'workbench.sidebar.menu.addRule': 'ルールを追加',
  'workbench.sidebar.menu.addRequest': 'リクエストを追加',
  'workbench.sidebar.menu.addFolder': 'フォルダーを追加',
  'workbench.sidebar.menu.rename': '名前を変更',
  'workbench.sidebar.menu.editVariables': '変数を編集',
  'workbench.sidebar.menu.createWorkflow': 'ワークフローを作成…',
  'workbench.sidebar.menu.export': 'エクスポート…',
  'workbench.sidebar.menu.delete': '削除',
  'workbench.sidebar.menu.duplicate': '複製',
  'workbench.sidebar.menu.copyAs': '形式を指定してコピー',
  'workbench.sidebar.menu.copyAsCurl': 'cURL',
  'workbench.sidebar.menu.copyAsFetch': 'fetch',
  'workbench.sidebar.menu.convertToGraphql': 'GraphQL リクエストに変換',
  'workbench.sidebar.menu.pauseCollection': 'コレクションを一時停止',
  'workbench.sidebar.menu.unpauseCollection': 'コレクションを再開',
  'workbench.sidebar.menu.pauseFolder': 'フォルダーを一時停止',
  'workbench.sidebar.menu.unpauseFolder': 'フォルダーを再開',
  'workbench.sidebar.menu.resetCollectionPauseOverride': 'コレクションの一時停止の上書きをリセット',
  'workbench.sidebar.menu.resetFolderPauseOverride': 'フォルダーの一時停止の上書きをリセット',
  'workbench.sidebar.menu.clearNestedPauseOverrides': '配下の一時停止の上書きをクリア',

  // ── Sidebar: row badges + hover actions ─────────────────────────────
  'workbench.sidebar.badge.paused': '一時停止中',
  'workbench.sidebar.badge.draft': '下書き',
  'workbench.sidebar.badge.unresolved': '未解決',
  'workbench.sidebar.badge.off': 'オフ',
  'workbench.sidebar.badge.incomplete': '未完了',
  'workbench.sidebar.badge.scratch': 'スクラッチ',
  'workbench.sidebar.badge.scripts': 'スクリプト',
  'workbench.sidebar.badge.specDrift': '変更あり',
  'workbench.sidebar.badge.scriptsTooltip':
    'このインポートされたリクエストは実行時に JavaScript を実行します。開いてスクリプトを確認してください。',
  'workbench.sidebar.badge.dirtyAria': '未保存の変更',
  'workbench.sidebar.rule.enable': 'ルールを有効化',
  'workbench.sidebar.rule.disable': 'ルールを無効化',
  'workbench.sidebar.env.setActive': 'アクティブに設定',
  'workbench.sidebar.env.setInactive': '非アクティブに設定',
  'workbench.sidebar.env.setDefault': 'デフォルトに設定',
  'workbench.sidebar.env.unsetDefault': 'デフォルトを解除',
  'workbench.sidebar.workflow.bindingsCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} vars' }),
  'workbench.sidebar.workflow.bindingsTooltip': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'このワークフローに束縛されたライブ変数 {count} 件' }),

  // ── Sidebar: empty placeholders ─────────────────────────────────────
  'workbench.sidebar.placeholder.folderEmptyTitle': 'フォルダーは空です',
  'workbench.sidebar.placeholder.collectionEmptyTitle': 'コレクションは空です',
  'workbench.sidebar.placeholder.requestsEmptyTitle': 'リクエストはまだありません',
  'workbench.sidebar.placeholder.templatesEmptyTitle': 'テンプレートはまだありません',
  'workbench.sidebar.placeholder.addRuleOrFolder': 'ルールまたはフォルダーを追加して始めましょう。',
  'workbench.sidebar.placeholder.addRequestOrFolder': 'リクエストまたはフォルダーを追加して始めましょう。',
  'workbench.sidebar.placeholder.templateFolderEmptyMessage': 'ルールをテンプレートとして保存すると、ここに並びます。',
  'workbench.sidebar.placeholder.templatesEmptyMessage': 'エディターからルールをテンプレートとして保存してください。',
  'workbench.sidebar.placeholder.addRule': 'ルールを追加',
  'workbench.sidebar.placeholder.addFolder': 'フォルダーを追加',
  'workbench.sidebar.placeholder.addRequest': 'リクエストを追加',
  'workbench.sidebar.emptySection': 'このセクションにアイテムはありません',
  'workbench.sidebar.emptySectionCreate': '作成',

  // ── Sidebar: templates view ─────────────────────────────────────────
  'workbench.sidebar.templates.systemGroup': 'システムテンプレート',
  'workbench.sidebar.ruleType.header': 'ヘッダー',
  'workbench.sidebar.ruleType.block': 'ブロック',
  'workbench.sidebar.ruleType.redirect': 'リダイレクト',
  'workbench.sidebar.ruleType.queryParam': 'クエリパラメーター',
  'workbench.sidebar.ruleType.inject': '注入',
  'workbench.sidebar.ruleType.delay': '遅延',
  'workbench.sidebar.ruleType.requestBody': 'API リクエストボディ',
  'workbench.sidebar.ruleType.response': 'API レスポンス',

  // ── Sidebar: variables-view singleton rows ──────────────────────────
  'workbench.sidebar.singleton.vault': 'Vault',
  'workbench.sidebar.singleton.workspaceVariables': 'ワークスペース変数',
  'workbench.sidebar.singleton.liveVariables': 'ライブ変数',
  'workbench.sidebar.singleton.packageLibrary': 'パッケージライブラリ',

  // ── Sidebar: default entity names ───────────────────────────────────
  // (New Rules/Requests Collection promoted to `shared.defaults.*` when
  // the save modals became their second converted consumer; New
  // Environment followed when App's env-selector create flow converted.)
  'workbench.sidebar.defaults.newFolder': '新しいフォルダー',

  // ── Sidebar: confirm-delete modal + toasts ──────────────────────────
  'workbench.sidebar.confirmDelete.title': 'アイテムを削除しますか？',
  'workbench.sidebar.confirmDelete.bodyPrefix': '本当に ',
  'workbench.sidebar.confirmDelete.bodySuffix': ' を削除しますか？この操作は元に戻せません。',
  'workbench.sidebar.confirmDelete.ok': '削除',
  'workbench.sidebar.toast.toggleRuleFailed': 'ルールの切り替えに失敗しました',
  'workbench.sidebar.toast.renameExampleFailed': '例の名前変更に失敗しました',
  'workbench.sidebar.toast.duplicateExampleFailed': '例の複製に失敗しました',
  'workbench.sidebar.toast.deleteExampleFailed': '例の削除に失敗しました',
  'workbench.sidebar.toast.createRequestCollectionFailed': 'リクエストコレクションの作成に失敗しました',
  'workbench.sidebar.toast.createEnvironmentFailed': '環境の作成に失敗しました',
  'workbench.sidebar.toast.createSpecFailed': '仕様の作成に失敗しました',
  'workbench.sidebar.toast.renameSpecFailed': '仕様の名前変更に失敗しました',
  'workbench.sidebar.toast.deleteSpecFailed': '仕様の削除に失敗しました',

  // ── Sidebar: folder drag-and-drop ───────────────────────────────────

  // ── Activity feed panel + cards ─────────────────────────────────────
  'workbench.activityFeed.reverted': '変更を元に戻しました',
  'workbench.activityFeed.revertFailed': '元に戻せませんでした：{reason}',
  'workbench.activityFeed.emptyTitle': 'アクティビティはまだありません',
  'workbench.activityFeed.emptyHint': 'ピアからの受信変更がここに表示されます。',
  'workbench.activityFeed.view': '表示',
  'workbench.activityFeed.mute': 'ミュート',
  'workbench.activityFeed.unmute': 'ミュート解除',
  'workbench.activityFeed.muteTip': 'このエンティティの以降の受信アクティビティ行を抑止します。過去の行は残ります。',
  'workbench.activityFeed.unmuteTip': 'このエンティティの受信アクティビティの抑止をやめます。',
  'workbench.activityFeed.revert': '元に戻す',
  'workbench.activityFeed.revertTip':
    'この変更の逆を適用します。エンティティを受信前の状態に戻す新しい変更を発行します。',
  'workbench.activityFeed.revertUnavailableDelete': '削除は恒久的で、元に戻せません（§7.2 delete-wins）。',
  'workbench.activityFeed.revertUnavailable': 'この変更は元に戻せません。',
  'workbench.activityFeed.revertUnavailableParentGone': 'このアイテムの元のフォルダーはもう存在しません。',
  'workbench.activityFeed.kind.created': '作成',
  'workbench.activityFeed.kind.createdTip': 'ピアから新しいエンティティが届きました。',
  'workbench.activityFeed.kind.edited': '編集',
  'workbench.activityFeed.kind.editedTip': 'ピアがこのエンティティのフィールドを編集しました。',
  'workbench.activityFeed.kind.deleted': '削除',
  'workbench.activityFeed.kind.deletedTip': 'ピアがこのエンティティを削除しました。',
  'workbench.activityFeed.kind.superseded': 'ローカル編集を上書き',
  'workbench.activityFeed.kind.supersededTip': '受信した変更が、進行中のローカル編集を上書きしました。',
  'workbench.activityFeed.kind.sensitiveRotation': '機微フィールドをローテーション',
  'workbench.activityFeed.kind.sensitiveRotationTip':
    '機微フィールド（シークレット / token / 機微なヘッダー）が置き換えられました。',
  'workbench.activityFeed.kind.scopeWidened': '一致範囲が拡大',
  'workbench.activityFeed.kind.scopeWidenedTip':
    'ルールの条件が緩められました。ルールはより広い URL / メソッドの集合に一致するようになりました。',
  'workbench.activityFeed.kind.agentObserved': 'エージェントが読み取り',
  'workbench.activityFeed.kind.agentObservedTip':
    'エージェントが MCP の observe 層を通じてライブトラフィックを読み取りました。有効化されたソースからの秘匿済みの投影です。',
  'workbench.activityFeed.kind.rehomed': 'コレクションのルートへ移動',
  'workbench.activityFeed.kind.rehomedTip':
    'そのフォルダーが別のピアによって削除されるか自身の中へ移動されたため、このアイテムはコレクションのルートに付け直されました。',
  'workbench.activityFeed.rawRead': '秘匿解除',
  'workbench.activityFeed.rawReadTip':
    'この読み取りは生の値を投影しました。ツール › トラフィックのセッション秘匿解除読み取りの付与がオンでした。',

  // ── Overview tabs (collection / folder, all three families). The
  // folder-suffix chunks carry their leading '· ' — the JSX supplies
  // only the separating space. ────────────────────────────────────────
  'workbench.overview.stats.rules': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のルール' }),
  'workbench.overview.stats.requests': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のリクエスト' }),
  'workbench.overview.stats.templates': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のテンプレート' }),
  'workbench.overview.stats.foldersSuffix': ({ count }, locale) =>
    plural(locale, Number(count), { other: '· {count} 個のフォルダー' }),
  'workbench.overview.stats.subfoldersSuffix': ({ count }, locale) =>
    plural(locale, Number(count), { other: '· {count} 個のサブフォルダー' }),
  'workbench.overview.stats.activeTag': '{count} 件アクティブ',
  'workbench.overview.stats.disabledTag': '{count} 件無効',
  'workbench.overview.stats.draftTag': '{count} 件下書き',
  'workbench.overview.stats.pausedTag': '一時停止中',
  'workbench.overview.cell.folderRules': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'フォルダー · {count} 件のルール' }),
  'workbench.overview.cell.folderRequests': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'フォルダー · {count} 件のリクエスト' }),
  'workbench.overview.cell.folderTemplates': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'フォルダー · {count} 件のテンプレート' }),
  'workbench.overview.status.draft': '下書き',
  'workbench.overview.status.incomplete': '未完了',
  'workbench.overview.status.disabled': '無効',
  'workbench.overview.status.paused': '一時停止中',
  'workbench.overview.status.active': 'アクティブ',
  'workbench.overview.action.addRule': 'ルールを追加',
  'workbench.overview.action.addRequest': 'リクエストを追加',
  'workbench.overview.action.pause': '一時停止',
  'workbench.overview.action.resume': '再開',
  'workbench.overview.action.pauseCollectionTooltip': 'このコレクションのすべてのルールを一時停止',
  'workbench.overview.action.resumeCollectionTooltip': 'このコレクションのすべてのルールを再開',
  'workbench.overview.action.pauseFolderTooltip': 'このフォルダーのすべてのルールを一時停止',
  'workbench.overview.action.resumeFolderTooltip': 'このフォルダーのすべてのルールを再開',
  'workbench.overview.action.variables': '変数',
  'workbench.overview.action.variablesTooltip': 'このコレクションをスコープとする変数を編集',
  'workbench.overview.action.variablesTooltipTemplate': 'このテンプレートコレクションをスコープとする変数を編集',
  'workbench.overview.caption.description': '説明',
  'workbench.overview.caption.contents': '内容',
  'workbench.overview.empty.collectionNotFound': 'コレクションが見つかりません',
  'workbench.overview.empty.folderNotFound': 'フォルダーが見つかりません',
  'workbench.overview.empty.requestCollectionNotFound': 'リクエストコレクションが見つかりません',
  'workbench.overview.empty.templateCollectionNotFound': 'テンプレートコレクションが見つかりません',
  'workbench.overview.empty.noItems': 'アイテムはまだありません',
  'workbench.overview.empty.noRequests': 'リクエストはまだありません',
  'workbench.overview.empty.templatesCollection':
    'このコレクションにテンプレートはありません。ルールをテンプレートとして保存すると、このコレクションに並びます。',
  'workbench.overview.empty.templatesFolder':
    'テンプレートはまだありません。ルールエディターからルールをテンプレートとして保存すると、このフォルダーに並びます。',

  // ── Collection picker panel (import flows) ──────────────────────────
  'workbench.collectionPicker.searchPlaceholder': 'コレクションを検索',
  'workbench.collectionPicker.empty': 'コレクションはまだありません。インポート時に 1 つ作成されます。',
  'workbench.collectionPicker.noMatch': '一致するコレクションはありません。',
  'workbench.collectionPicker.newCollection': '新しいコレクション',
} as const satisfies Catalog;
