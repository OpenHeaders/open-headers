/**
 * Shared notifications family — Japanese. Mirrors
 * `catalogs/en/shared-notifications.ts` key for key; see that file for
 * the push-time capture rule. Mints: 通知 = notification; 提案 =
 * suggestion; タイムライン = timeline; キーチェーン = keychain;
 * キーリング = keyring.
 */

import type { Catalog } from '../../types';

export const sharedNotifications = {
  // ── Tool window chrome ─────────────────────────────────────────────
  'shared.notifications.title': '通知',
  'shared.notifications.info.summary':
    'セットアップに関する提案と、アプリのイベントのセッションタイムラインです。アップデートの有無、バックグラウンドタスクの結果、その他の通知を、作業を妨げずにここに集めます。',
  'shared.notifications.suggestionsHeading': '提案',
  'shared.notifications.timelineHeading': 'タイムライン',
  'shared.notifications.clearAll': 'すべてクリア',
  'shared.notifications.suggestionsEmpty.title': '提案はありません',
  'shared.notifications.suggestionsEmpty.description': 'セットアップに関するアドバイスがここに表示されます。',
  'shared.notifications.timelineEmpty.title': '通知はありません',
  'shared.notifications.timelineEmpty.description': 'アプリのイベントとアップデートがここに表示されます。',
  'shared.notifications.dismiss': '閉じる',
  'shared.notifications.moreActions': 'その他の操作',

  // ── Mute ("Don't show again") flow ─────────────────────────────────
  'shared.notifications.dontShowAgain': '今後表示しない',
  'shared.notifications.muted.title': '通知を無効にしました',
  'shared.notifications.muted.description': '「{title}」は今後表示されません。',
  'shared.notifications.muted.reEnable': '再度有効にする',
  'shared.notifications.muted.reEnableTooltip': 'この通知を再び表示できるようにする',

  // ── Seed nudges ────────────────────────────────────────────────────
  'shared.notifications.seed.website.title': 'Open Headers を知る',
  'shared.notifications.seed.website.description':
    'すべての機能をインタラクティブに確認し、最新のアップデートもチェックできます。',
  'shared.notifications.seed.website.action': 'ウェブサイトを見る',
  'shared.notifications.seed.website.tooltip': 'ウェブサイトを開いて通知をクリア',
  'shared.notifications.seed.star.title': '成長にご協力ください',
  'shared.notifications.seed.star.description': '友人や同僚におすすめしてください',
  'shared.notifications.seed.star.action': 'GitHub でスターを付ける',
  'shared.notifications.seed.star.tooltip': 'GitHub を開いて通知をクリア',

  // ── Desktop-app suggestion (browser hosts without the companion) ───
  'shared.notifications.desktopApp.title': '統合された一つのユーザー体験',
  'shared.notifications.desktopApp.rowTerminal': '統合ターミナル：ワークスペース内でのフルシェルアクセス',
  'shared.notifications.desktopApp.rowGit': 'バージョン管理：ワークスペースの Git コミットと履歴',
  'shared.notifications.desktopApp.rowProxy': 'ブラウザータブやシステムからのライブトラフィックのキャプチャ',
  'shared.notifications.desktopApp.rowMcp': 'AI アシスタント向け MCP サーバー：ライブトラフィックの分析とデバッグ',
  'shared.notifications.desktopApp.rowRequests': 'ネイティブ API リクエストの作成と実行：gRPC、WebSocket、SSE など',
  'shared.notifications.desktopApp.action': 'デスクトップアプリをダウンロード',
  'shared.notifications.desktopApp.tooltip': 'アプリをダウンロードして提案をクリア',

  // ── App-update timeline entries ────────────────────────────────────
  'shared.notifications.appUpdate.title': '{version} が利用可能',
  'shared.notifications.appUpdate.securityTitle': '{version} セキュリティアップデートが利用可能',
  'shared.notifications.appUpdate.securityDescription':
    'このリリースは、実行中のバージョンに影響するセキュリティの問題を修正します。できるだけ早く更新してください。',
  'shared.notifications.appUpdate.download': 'ダウンロード…',

  // ── Update corner balloon (AppUpdateToast) ─────────────────────────
  'shared.notifications.toast.settings': '設定…',
  'shared.notifications.toast.dontShowAgain': '今後表示しない',
  'shared.notifications.toast.optionsTooltip': 'オフにするか動作を変更する',
  'shared.notifications.toast.optionsAria': 'アップデート通知のオプション',
  'shared.notifications.toast.close': '閉じる',
  'shared.notifications.toast.upToDateTitle': '最新の状態です',
  'shared.notifications.toast.upToDateDescription': '{version} が最新バージョンです。',
  'shared.notifications.toast.checkFailed': 'アップデートの確認に失敗しました',
  'shared.notifications.toast.downloadFailed': 'アップデートのダウンロードに失敗しました',
  'shared.notifications.toast.available': '{version} が利用可能',
  'shared.notifications.toast.update': '更新…',
  'shared.notifications.toast.packageManager': 'Linux のパッケージマネージャーから更新してください。',
  'shared.notifications.toast.releaseNotes': 'リリースノート',
  'shared.notifications.toast.readyToInstall': '{version} をインストールする準備ができました',
  'shared.notifications.toast.restartToInstall': '再起動してインストール',
  'shared.notifications.toast.updatedTo': '{version} に更新しました',
  'shared.notifications.toast.seeWhatsNew': '新機能を見る',

  // ── Security-floor entry banner ────────────────────────────────────
  'shared.notifications.securityBanner.messageWithVersion':
    '{availableVersion} は、実行中のバージョン（{currentVersion}）に影響するセキュリティの問題を修正します。できるだけ早く更新してください。',
  'shared.notifications.securityBanner.messageNoVersion':
    '実行中のバージョン（{currentVersion}）向けのセキュリティ修正が公開されています。できるだけ早く更新してください。',
  'shared.notifications.securityBanner.update': '更新…',

  // ── Secrets-storage suggestion ─────────────────────────────────────
  'shared.notifications.secrets.title': 'シークレットストレージがロックされています',
  'shared.notifications.secrets.description':
    'このセッションでは Vault のシークレットと OAuth token を読み書きできません。{remedy}',
  'shared.notifications.secrets.relaunch': 'アプリを再起動',
  'shared.notifications.secrets.remedy.darwin':
    'Open Headers はシステムのキーチェーンへのアクセスを拒否されました。アプリを再起動し、求められたらキーチェーンへのアクセスを許可してください。',
  'shared.notifications.secrets.remedy.linux':
    '使用可能なキーリングのバックエンドがありません。GNOME Keyring または KWallet を設定してから、アプリを再起動してください。',
  'shared.notifications.secrets.remedy.other':
    'Open Headers はシステムの資格情報ストアにアクセスできませんでした。アプリを再起動してもう一度お試しください。',
} as const satisfies Catalog;
