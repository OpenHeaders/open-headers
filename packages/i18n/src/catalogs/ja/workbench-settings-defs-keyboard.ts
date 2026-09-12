/**
 * Workbench settings — keyboard-category setting definitions —
 * Japanese. Mirrors `catalogs/en/workbench-settings-defs-keyboard.ts`
 * key for key. Chord notation and physical key names (ArrowDown,
 * Enter, Space, ⌘K, Alt+C, …) ride raw inside keyed values —
 * localized key names are a deferred Phase I workstream (ja ships raw
 * too, S46). Action labels reuse the shipped `popup.shortcuts.*` ja
 * wording (S35 reuse law): デバッグモードを切り替え / テーマを順に切り替え
 * / コンパクトモード / 展開 / サブ行に入る etc.; popup tab names quote
 * the shipped ja labels（「このページ」「すべてのルール」「コレクション」）;
 * the `Popup —` label prefix restructures into ポップアップ：.
 * アクティビティフィード = Activity Feed (chrome mint); ツアーガイド =
 * tour guide (popup mint). MINTS: コマンドパレット = Command Palette;
 * チートシート = cheatsheet; プリセット = preset; インポートハブ = the
 * import hub (`workbench-import-export.ts` must reuse); spacebar in
 * prose = スペースキー. Brand tokens never compounded: OpenHeaders
 * デフォルト、VS Code 風.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefsKeyboard = {
  // ── Keyboard category defs ─────────────────────────────────────────
  'workbench.settings.def.keyboard.toggleDebugMode.label': 'デバッグモードを切り替え',
  'workbench.settings.def.keyboard.toggleDebugMode.description':
    'どの面からでもデバッグモードをオンまたはオフにします。テキストフィールドにフォーカスがないときにのみ発火します。',
  'workbench.settings.def.keyboard.toggleDebugMode.capabilityUnavailableHint':
    'デバッグモードは Chrome と Edge で利用できます。',
  'workbench.settings.def.keyboard.commandPalette.label': 'コマンドパレットを開く',
  'workbench.settings.def.keyboard.commandPalette.description': 'コマンドパレットのオーバーレイを表示します。',
  'workbench.settings.def.keyboard.openSettings.label': '設定を開く',
  'workbench.settings.def.keyboard.openSettings.description': '設定のモーダルを開きます。',
  'workbench.settings.def.keyboard.toggleLeftSidebar.label': '左サイドバーを切り替え',
  'workbench.settings.def.keyboard.toggleLeftSidebar.description': '左サイドバーを表示または非表示にします。',
  'workbench.settings.def.keyboard.toggleRightSidebar.label': '右サイドバーを切り替え',
  'workbench.settings.def.keyboard.toggleRightSidebar.description': '右サイドバーを表示または非表示にします。',
  'workbench.settings.def.keyboard.toggleBottomPanel.label': '下部パネルを切り替え',
  'workbench.settings.def.keyboard.toggleBottomPanel.description': '下部パネルを表示または非表示にします。',
  'workbench.settings.def.keyboard.toggleActivityFeed.label': 'アクティビティフィードを切り替え',
  'workbench.settings.def.keyboard.toggleActivityFeed.description':
    'アクティビティフィードパネルを表示または非表示にします。',
  'workbench.settings.def.keyboard.newRule.label': 'アイテムを作成',
  'workbench.settings.def.keyboard.newRule.description': 'ルールと API リクエストの作成メニューを開きます。',
  'workbench.settings.def.keyboard.newTab.label': '新しいタブ',
  'workbench.settings.def.keyboard.newTab.description': '新しい下書き API リクエストのタブを開きます。',
  'workbench.settings.def.keyboard.import.label': 'インポート',
  'workbench.settings.def.keyboard.import.description': 'curl、HAR、ワークスペースファイルのインポートハブを開きます。',
  'workbench.settings.def.keyboard.save.label': '保存',
  'workbench.settings.def.keyboard.save.description': 'アクティブなエディタータブを保存します。',
  'workbench.settings.def.keyboard.closeTab.label': 'タブを閉じる',
  'workbench.settings.def.keyboard.closeTab.description': 'フォーカスされたエディタータブを閉じます。',
  'workbench.settings.def.keyboard.previousTab.label': '前のタブ',
  'workbench.settings.def.keyboard.previousTab.description': '前のエディタータブにフォーカスします。',
  'workbench.settings.def.keyboard.nextTab.label': '次のタブ',
  'workbench.settings.def.keyboard.nextTab.description': '次のエディタータブにフォーカスします。',
  'workbench.settings.def.keyboard.tabSearch.label': 'タブを検索',
  'workbench.settings.def.keyboard.tabSearch.description':
    '開いているすべてのタブを横断する検索オーバーレイを開きます。',
  'workbench.settings.def.keyboard.focusSidebarFilter.label': 'アクティブなセクションのフィルターにフォーカス',
  'workbench.settings.def.keyboard.focusSidebarFilter.description':
    '現在いるサイドバーセクションのフィルター入力にフォーカスを移します。',
  'workbench.settings.def.keyboard.focusLeftSidebar.label': '左サイドバーにフォーカス',
  'workbench.settings.def.keyboard.focusLeftSidebar.description': 'キーボードフォーカスを左サイドバーに移します。',
  'workbench.settings.def.keyboard.focusEditor.label': 'エディターにフォーカス',
  'workbench.settings.def.keyboard.focusEditor.description': 'キーボードフォーカスをエディター領域に移します。',
  'workbench.settings.def.keyboard.focusRightSidebar.label': '右サイドバーにフォーカス',
  'workbench.settings.def.keyboard.focusRightSidebar.description': 'キーボードフォーカスを右サイドバーに移します。',
  'workbench.settings.def.keyboard.focusBottomPanel.label': '下部パネルにフォーカス',
  'workbench.settings.def.keyboard.focusBottomPanel.description':
    'キーボードフォーカスを下部パネルのタブ行に移します。',
  'workbench.settings.def.keyboard.terminalNewTab.label': '新しいターミナルタブ',
  'workbench.settings.def.keyboard.terminalNewTab.description':
    'ターミナルパネルにフォーカスがあるときに新しいターミナルタブを開始します。それ以外の場所では、このコードは通常の「新しいタブ」の動作のままです。デスクトップアプリのみ。',
  'workbench.settings.def.keyboard.showShortcutHelp.label': 'ショートカットのヘルプを表示',
  'workbench.settings.def.keyboard.showShortcutHelp.description':
    'キーボードショートカットのチートシートを表示します。',
  'workbench.settings.def.keyboard.find.label': 'エディター内を検索',
  'workbench.settings.def.keyboard.find.description':
    'フォーカスされたコードエディターで検索ウィジェットを開きます。エディターにフォーカスがあるときにのみ発火し、グローバルショートカットには干渉しません。',
  'workbench.settings.def.keyboard.replace.label': 'エディター内で置換',
  'workbench.settings.def.keyboard.replace.description':
    'フォーカスされたコードエディターで検索と置換のウィジェットを開きます。エディターにフォーカスがあるときにのみ発火し、グローバルショートカットには干渉しません。',
  'workbench.settings.def.keyboard.formatCode.label': 'コードを整形',
  'workbench.settings.def.keyboard.formatCode.description':
    'フォーカスされたコードエディターのバッファを整形します。エディターにフォーカスがあるときにのみ発火し、グローバルショートカットには干渉しません。',
  'workbench.settings.def.keyboard.preset.label': 'プリセット',
  'workbench.settings.def.keyboard.preset.description':
    'ショートカットの基本セットです。カスタマイズしたショートカットはプリセットの上に重なり、切り替えても保持されます。',
  'workbench.settings.def.keyboard.preset.option.openheaders.label': 'OpenHeaders デフォルト',
  'workbench.settings.def.keyboard.preset.option.vscode.label': 'VS Code 風',

  // ── Keyboard popup defs ────────────────────────────────────────────
  'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.label': 'ポップアップ：ショートカットのヘルプを切り替え',
  'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.description':
    'ポップアップのキーボードショートカットのチートシートを表示または非表示にします。',
  'workbench.settings.def.keyboard.popup.toggleOptionsMenu.label': 'ポップアップ：オプションメニューを切り替え',
  'workbench.settings.def.keyboard.popup.toggleOptionsMenu.description':
    'フッターのオプションドロップダウンを開閉します。',
  'workbench.settings.def.keyboard.popup.focusSearch.label': 'ポップアップ：検索にフォーカス',
  'workbench.settings.def.keyboard.popup.focusSearch.description':
    'キーボードフォーカスをアクティブなタブの検索入力に移します。',
  'workbench.settings.def.keyboard.popup.prevPage.label': 'ポップアップ：前のページ',
  'workbench.settings.def.keyboard.popup.prevPage.description': 'アクティブなタブでルールの前のページに移動します。',
  'workbench.settings.def.keyboard.popup.nextPage.label': 'ポップアップ：次のページ',
  'workbench.settings.def.keyboard.popup.nextPage.description': 'アクティブなタブでルールの次のページに移動します。',
  'workbench.settings.def.keyboard.popup.moveDown.label': 'ポップアップ：下へ移動',
  'workbench.settings.def.keyboard.popup.moveDown.description':
    'フォーカスされた行を進めます。ArrowDown は常にエイリアスとして使えます。',
  'workbench.settings.def.keyboard.popup.moveUp.label': 'ポップアップ：上へ移動',
  'workbench.settings.def.keyboard.popup.moveUp.description':
    'フォーカスを前の行に移します。ArrowUp は常にエイリアスとして使えます。',
  'workbench.settings.def.keyboard.popup.expandRow.label': 'ポップアップ：展開 / サブ行に入る',
  'workbench.settings.def.keyboard.popup.expandRow.description':
    'フォーカスされた行を展開します。ArrowRight と Enter は常にエイリアスとして使えます。',
  'workbench.settings.def.keyboard.popup.collapseRow.label': 'ポップアップ：折りたたみ / サブ行から出る',
  'workbench.settings.def.keyboard.popup.collapseRow.description':
    'フォーカスされた行を折りたたみます。ArrowLeft は常にエイリアスとして使えます。',
  'workbench.settings.def.keyboard.popup.toggleRow.label': 'ポップアップ：行を切り替え',
  'workbench.settings.def.keyboard.popup.toggleRow.description':
    'フォーカスされたルールのオン / オフを切り替えます。デフォルトはスペースキーです。',
  'workbench.settings.def.keyboard.popup.editRow.label': 'ポップアップ：行を編集',
  'workbench.settings.def.keyboard.popup.editRow.description':
    'フォーカスされたルールをワークスペースエディターで開きます。',
  'workbench.settings.def.keyboard.popup.copyValue.label': 'ポップアップ：値をコピー',
  'workbench.settings.def.keyboard.popup.copyValue.description':
    'フォーカスされた行の主要な値をクリップボードにコピーします。',
  'workbench.settings.def.keyboard.popup.deleteRow.label': 'ポップアップ：行を削除',
  'workbench.settings.def.keyboard.popup.deleteRow.description':
    'フォーカスされた行を削除待ちにします。もう一度押す（または Enter）と確定します。',
  'workbench.settings.def.keyboard.popup.addRule.label': 'ポップアップ：ルールを追加',
  'workbench.settings.def.keyboard.popup.addRule.description': 'ポップアップから新しいルールを作成します。',
  'workbench.settings.def.keyboard.popup.toggleRulesPause.label':
    'ポップアップ：ルールの一時停止を切り替え（グローバル）',
  'workbench.settings.def.keyboard.popup.toggleRulesPause.description':
    'すべてのコレクションのすべてのルールを一時停止または再開します。',
  'workbench.settings.def.keyboard.popup.togglePauseFocused.label':
    'ポップアップ：一時停止を切り替え（フォーカスされたコレクション / フォルダー）',
  'workbench.settings.def.keyboard.popup.togglePauseFocused.description':
    '「コレクション」タブでフォーカスされたコレクションまたはフォルダーを一時停止または再開します。個々のルール行には効果がありません。ルールは代わりに有効化の切り替え（Space）を使います。',
  'workbench.settings.def.keyboard.popup.cycleTheme.label': 'ポップアップ：テーマを順に切り替え',
  'workbench.settings.def.keyboard.popup.cycleTheme.description': 'ライト、ダーク、自動のテーマを順に切り替えます。',
  'workbench.settings.def.keyboard.popup.toggleCompactMode.label': 'ポップアップ：コンパクトモードを切り替え',
  'workbench.settings.def.keyboard.popup.toggleCompactMode.description':
    'ポップアップの密度をコンパクトと快適の間で切り替えます。',
  'workbench.settings.def.keyboard.popup.openWorkspace.label': 'ポップアップ：ワークスペースを開く',
  'workbench.settings.def.keyboard.popup.openWorkspace.description': 'フルのワークスペースタブを開きます。',
  'workbench.settings.def.keyboard.popup.openSettings.label': 'ポップアップ：設定を開く',
  'workbench.settings.def.keyboard.popup.openSettings.description':
    '新しいワークスペースタブで設定ページを開きます。ワークスペースのバインディングと一致します。',
  'workbench.settings.def.keyboard.popup.tabThisPage.label': 'ポップアップ：「このページ」タブ',
  'workbench.settings.def.keyboard.popup.tabThisPage.description': '「このページ」のルールタブをアクティブにします。',
  'workbench.settings.def.keyboard.popup.tabAllRules.label': 'ポップアップ：「すべてのルール」タブ',
  'workbench.settings.def.keyboard.popup.tabAllRules.description': '「すべてのルール」タブをアクティブにします。',
  'workbench.settings.def.keyboard.popup.tabCollections.label': 'ポップアップ：「コレクション」タブ',
  'workbench.settings.def.keyboard.popup.tabCollections.description': '「コレクション」タブをアクティブにします。',
  'workbench.settings.def.keyboard.popup.toggleSurface.label':
    'ポップアップ：面を切り替え（ポップアップ ↔ サイドパネル）',
  'workbench.settings.def.keyboard.popup.toggleSurface.description':
    'ポップアップのヘッダーから、ポップアップとサイドパネルのレイアウトを切り替えます。',
  'workbench.settings.def.keyboard.popup.openTourGuide.label': 'ポップアップ：ツアーガイドを開く',
  'workbench.settings.def.keyboard.popup.openTourGuide.description':
    'どのポップアップタブからでもウェルカムツアーを再生します。',
} as const satisfies Catalog;
