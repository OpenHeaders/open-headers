/**
 * Shared chrome family — Japanese. Mirrors
 * `catalogs/en/shared-chrome.ts` key for key; see that file for the
 * family rules and the raw-by-design plane (browser banner quoted
 * verbatim raw en, nav / worker / OOPIF, xhr/fetch, boot.interactive).
 * Mints: デバッグモード = Debug mode (carried); debug scope (reach
 * referent, distinct from the variable-scope スコープ carried from
 * shared-components — here the reach also reads スコープ, disambiguated
 * by the デバッグモードの qualifier); アタッチ = attach (Chrome
 * DevTools ja vocabulary); レイアウト = layout; レイアウト元 = layout
 * donor; スクラッチ = Scratch (unsaved tier) vs 下書き = Draft (saved
 * tier); コールドスタート = cold start / コールドウェイク = cold wake;
 * プロセス = Processes; ライフサイクル = lifecycle; リリースノート =
 * release notes; サインアウト = sign out; {unit} holes carry
 * localized CJK host nouns, so they set tight without a separating
 * space.
 */

import type { Catalog } from '../../types';

export const sharedChrome = {
  // ── Debug mode pill + dormant notice ───────────────────────────────
  'shared.chrome.debug.title': 'デバッグモード',
  'shared.chrome.debug.titleShort': 'デバッグ',
  'shared.chrome.debug.unavailableHint': 'デバッグモードは Chrome と Edge で利用できます。',
  'shared.chrome.debug.toggleAria': 'デバッグモードを切り替え',
  'shared.chrome.debug.aboutTooltip': 'デバッグモードについて',
  'shared.chrome.debug.openDocsAria': 'デバッグモードのドキュメントを開く',
  'shared.chrome.debug.controlsAria': 'デバッグモードのコントロール',
  'shared.chrome.debug.turnOn': 'デバッグモードをオンにする',
  'shared.chrome.debug.turnOff': 'デバッグモードをオフにする',
  'shared.chrome.debug.scopeDevtools': 'DevTools が開いている場所',
  'shared.chrome.debug.scopeActive': 'フォーカス中のタブ',
  'shared.chrome.debug.scopeBoth': '両方',
  'shared.chrome.debug.attachTo': 'アタッチ先',
  'shared.chrome.debug.includeThisTab': 'このブラウザータブを含める',
  'shared.chrome.debug.pinThisTabAria': 'このブラウザータブをピン留め',
  'shared.chrome.debug.attachedTabs': 'アタッチ済みのタブ',
  'shared.chrome.debug.noTabsAttached': 'アタッチされたタブはまだありません',
  'shared.chrome.debug.bannerNote':
    'デバッグモードがオンの間、ブラウザーのバナー「OH started debugging this browser」はすべてのタブに表示されます。アタッチしたタブだけではありません。',
  'shared.chrome.debug.tabNumber': 'タブ #{number}',
  'shared.chrome.debug.tabFallback': 'タブ {id}',
  'shared.chrome.debug.onThisTab': '現在このタブにいます',
  'shared.chrome.debug.switchTo': '{target} に切り替え',
  'shared.chrome.debug.dormantTooltip':
    'デバッグモードはオンですが、このタブはそのスコープ外です。デバッグ層のルールの nav / worker / OOPIF への効果はここでは休止しています。デバッグモードからスコープに入れてください（スコープを変更するか、このタブをピン留めします）。ページのリクエスト（xhr/fetch）には引き続き作用します。',
  'shared.chrome.debug.tabOutOfScope': 'タブはスコープ外',

  // ── System Status pill ─────────────────────────────────────────────
  'shared.chrome.status.title': 'システム',
  'shared.chrome.status.aria': 'システムステータス：{summary}',
  'shared.chrome.status.aboutTooltip': 'このパネルについて',
  'shared.chrome.status.openDocsAria': 'システムステータスのドキュメントを開く',
  'shared.chrome.status.healthy': '正常',
  'shared.chrome.status.failure': '障害',
  'shared.chrome.status.issues': '問題あり',
  'shared.chrome.status.noEvents': 'イベントはまだありません',
  'shared.chrome.status.subsystemSync': '同期',
  'shared.chrome.status.subsystemRules': 'ルール',
  'shared.chrome.status.subsystemRequests': 'リクエスト',
  'shared.chrome.status.subsystemPermissions': '権限',
  'shared.chrome.status.subsystemSecrets': 'シークレット',
  'shared.chrome.status.subsystemLive': 'Live',
  'shared.chrome.status.subsystemActivity': 'アクティビティ',
  'shared.chrome.status.subsystemDebugMode': 'デバッグモード',
  'shared.chrome.status.buildLine': 'Open Headers · {version}',
  'shared.chrome.status.versionBeta': '{version} (beta)',
  'shared.chrome.status.buildNumber': 'ビルド {build}',

  // ── Status popover product extras ──────────────────────────────────
  'shared.chrome.status.relaunchApp': 'アプリを再起動',
  'shared.chrome.status.backendOff': 'オフ',
  'shared.chrome.status.backendConnecting': '接続中…',
  'shared.chrome.status.companionDesktopApp': 'デスクトップアプリ',
  'shared.chrome.status.companionExtensions': '拡張機能',
  'shared.chrome.status.companionConnected': '接続済み',
  'shared.chrome.status.companionRunsRequests': 'リクエストを実行',
  'shared.chrome.status.companionNotConnected': '未接続',
  'shared.chrome.status.companionInstalledNotConnected': 'インストール済み · 未接続',
  'shared.chrome.status.companionNotInstalled': '未インストール',
  'shared.chrome.status.companionDownload': 'ダウンロード',
  'shared.chrome.status.companionPeersConnected': '{count} 件接続中',
  'shared.chrome.status.companionNoPeers': '接続なし',
  'shared.chrome.status.companionConnect': '接続',
  'shared.chrome.status.companionOpenApp': 'アプリを開く',
  'shared.chrome.addons.title': 'アドオン',
  'shared.chrome.addons.cli': 'CLI',
  'shared.chrome.addons.server': 'サーバー',
  'shared.chrome.addons.cliSetUp': '設定済み',
  'shared.chrome.addons.cliNotSetUp': '未設定',
  'shared.chrome.addons.cliStale': 'token が失効しました。設定し直してください',
  'shared.chrome.addons.cliExternal': '外部設定',
  'shared.chrome.addons.cliMalformed': '設定が不正です',
  'shared.chrome.addons.cliProvision': '設定',
  'shared.chrome.addons.mcp': 'MCP',
  'shared.chrome.addons.mcpOn': 'オン',
  'shared.chrome.addons.mcpTurnOn': 'オンにする',
  'shared.chrome.addons.notConfigured': '未設定',
  'shared.chrome.addons.requiresDesktop': 'デスクトップアプリが必要です',
  'shared.chrome.addons.cliViaDesktop': 'デスクトップアプリから設定',
  'shared.chrome.status.coldStart': 'コールドスタート',
  'shared.chrome.status.coldStartMessage': 'パフォーマンスの低下を検出しました。診断エクスポートを参照してください',
  'shared.chrome.status.coldStartTooltip':
    '3 回連続のコールドウェイクがベースラインを 20% 以上上回りました。最近の boot.interactive サンプル（ms）：{samples}。',

  // ── Update dialog ──────────────────────────────────────────────────
  'shared.chrome.updates.title': '更新',
  'shared.chrome.updates.downloading': 'ダウンロード中…',
  'shared.chrome.updates.downloadingPercent': 'ダウンロード中… {percent}%',
  'shared.chrome.updates.updateAndRestart': '更新して再起動',
  'shared.chrome.updates.ignore': 'この更新を無視',
  'shared.chrome.updates.remindLater': '後で通知',
  'shared.chrome.updates.nowAvailableSuffix': 'が利用可能になりました！',
  'shared.chrome.updates.moreDetailsPrefix': '詳しくは次を参照してください：',
  'shared.chrome.updates.releaseNotes': 'リリースノート',
  'shared.chrome.updates.updatingTo': '{from} から {to} に更新しています。',
  'shared.chrome.updates.configure': '更新を設定…',

  // ── Settings gear menu ─────────────────────────────────────────────
  'shared.chrome.gearMenu.downloadVersion': '{version} をダウンロード',
  'shared.chrome.gearMenu.versionAvailable': '{version} が利用可能…',
  'shared.chrome.gearMenu.updateAndRestartVersion': '{version} に更新して再起動',
  'shared.chrome.gearMenu.downloadingVersion': '{version} をダウンロード中…',
  'shared.chrome.gearMenu.restartToInstallVersion': '再起動して {version} をインストール',
  'shared.chrome.gearMenu.settings': '設定…',
  'shared.chrome.gearMenu.keyboardShortcuts': 'キーボードショートカット…',
  'shared.chrome.gearMenu.appearance': '外観…',
  'shared.chrome.gearMenu.about': 'Open Headers について',
  'shared.chrome.gearMenu.tourGuide': 'ツアーガイド',
  'shared.chrome.gearMenu.signOut': 'サインアウト',
  'shared.chrome.gearMenu.searchPlaceholder': '検索',
  'shared.chrome.gearMenu.noMatches': '一致なし',
  'shared.chrome.gearMenu.settingsTooltip': '設定',
  'shared.chrome.gearMenu.settingsMenuAria': '設定メニュー',

  // ── Background tasks (Processes) ───────────────────────────────────
  'shared.chrome.tasks.processes': 'プロセス',
  'shared.chrome.tasks.hidePanelAria': 'プロセスパネルを隠す',
  'shared.chrome.tasks.allCompleted': 'すべてのバックグラウンドタスクが完了しました',
  'shared.chrome.tasks.aboutNoteAria': 'この注記について',
  'shared.chrome.tasks.stop': '停止',
  'shared.chrome.tasks.keepRunning': '実行を続ける',
  'shared.chrome.tasks.stopTaskAria': 'バックグラウンドタスクを停止',
  'shared.chrome.tasks.hideTaskAria': 'バックグラウンドタスクを隠す',
  'shared.chrome.tasks.hideProcesses': 'プロセスを隠す',
  'shared.chrome.tasks.hideProcessesCount': 'プロセスを隠す（{count}）',

  // ── Layout-donor pill ──────────────────────────────────────────────
  'shared.chrome.donor.defaultTooltip': 'デフォルトの{unit}。新しい{units}はここからレイアウトを継承します。',
  'shared.chrome.donor.nonDefaultTooltip':
    '別の{unit}がデフォルトのレイアウト元です。新しい{units}はそちらから継承します。',
  'shared.chrome.donor.isDonorBody': 'この{unit}が現在のデフォルトです。新しい{units}はこのレイアウトを継承します。',
  'shared.chrome.donor.nonDonorBody':
    '別の{unit}が現在のデフォルトです。新しい{units}はその{unit}のレイアウトを継承します。',
  'shared.chrome.donor.reset': 'レイアウトをデフォルトに戻す',
  'shared.chrome.donor.defaultAria': '新しい{unit}がレイアウトを継承するデフォルトの{unit}',
  'shared.chrome.donor.nonDefaultAria': '新しい{unit}がレイアウトを継承するデフォルトの{unit}ではありません',
  'shared.chrome.donor.defaultLabel': 'デフォルトの{unit}',
  'shared.chrome.donor.inheritsLabel': 'レイアウトを継承',

  // ── Lifecycle pill ─────────────────────────────────────────────────
  'shared.chrome.lifecycle.title': 'ライフサイクルの状態',
  'shared.chrome.lifecycle.scratch': 'スクラッチ',
  'shared.chrome.lifecycle.scratchBody': '未保存の下書きです。「保存」するまで何も永続化されません。',
  'shared.chrome.lifecycle.unresolved': '未解決',
  'shared.chrome.lifecycle.unresolvedBody': 'アクティブなスコープで解決できない {{ref}} を含んでいます。',
  'shared.chrome.lifecycle.draft': '下書き',
  'shared.chrome.lifecycle.draftBody':
    '保存済みですが、まだ Live ではありません。必須フィールドが不足しているか、まだ公開されていません。',
  'shared.chrome.lifecycle.live': 'Live',
  'shared.chrome.lifecycle.liveBody': '公開済みで有効です。',
} as const satisfies Catalog;
