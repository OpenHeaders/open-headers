/**
 * Workbench chrome — the workspace plane — Japanese. Mirrors
 * `catalogs/en/workbench-chrome-workspace.ts` key for key. Workspace
 * and org names ride raw inside keyed values ({name} / {source} /
 * {org} / {orgs} / {hint} holes); Org stays the raw product noun
 * (shared-workspace precedent); バックエンド = back-end (register);
 * `OAuth`, `Logo`, format names (PNG, JPEG, WebP, SVG) and the `KB`
 * unit ride raw as en writes them; Vault raw per the ledger (Vault の
 * 内容). Runtime-quoted names use 「」. File mints: 複製 = duplicate /
 * ～のコピー = copy-of (コピー stays the copy action); 切り替え =
 * switcher (ワークスペース切り替え); 付与 = grant; 管理者 = admin;
 * 運用者 = server operator; メンバー = member; 所有者 = owner;
 * スナップショット = snapshot; 退出 = leave; アクティブなワークスペース
 * carries the アクティブ mint; organization prose = 組織 (Org the
 * product noun stays raw).
 */

import type { Catalog } from '../../types';

export const workbenchChromeWorkspace = {
  // ── Workspace: manager page ─────────────────────────────────────────
  'workbench.workspace.title': 'ワークスペース',
  'workbench.workspace.newWorkspace': '新しいワークスペース',
  'workbench.workspace.intro':
    '各ワークスペースは、それぞれ独自のルール、コレクション、フォルダー、テンプレート、変数、テスト実行履歴を持ちます。ドラッグして並べ替えられます。',
  'workbench.workspace.deleteTitle': '「{name}」を削除しますか？',
  'workbench.workspace.deleteBody':
    'ワークスペースと、そのすべてのルール、コレクション、フォルダー、テンプレート、変数、テスト実行履歴が恒久的に削除されます。この操作は元に戻せません。',
  'workbench.workspace.deleteOk': '削除',
  'workbench.workspace.deleteFailed': 'ワークスペースの削除に失敗しました',
  'workbench.workspace.deletedToast': '「{name}」を削除しました',
  'workbench.workspace.leaveTitle': '「{name}」から退出しますか？',
  'workbench.workspace.leaveBody':
    'このワークスペースへの自分のアクセスを手放します。開いているすべてのタブから消えます。他の全員のアクセスは保たれ、管理者が再び付与できます。',
  'workbench.workspace.leaveOk': '退出',
  'workbench.workspace.leaveFailed': 'ワークスペースからの退出に失敗しました',
  'workbench.workspace.leftToast': '「{name}」から退出しました',
  'workbench.workspace.leaveAria': 'ワークスペースから退出',
  'workbench.workspace.members.title': '「{name}」のメンバー',
  'workbench.workspace.members.openAria': 'メンバーを管理',
  'workbench.workspace.members.loadFailed': 'メンバーの読み込みに失敗しました',
  'workbench.workspace.members.updateFailed': 'メンバーの更新に失敗しました',
  'workbench.workspace.members.operatorTag': 'サーバー運用者',
  'workbench.workspace.members.managedTag': '管理対象',
  'workbench.workspace.members.managedTooltip': 'この付与は ID プロバイダーが管理しています。',
  'workbench.workspace.members.removeConfirm': '{name} をこのワークスペースから削除しますか？',
  'workbench.workspace.members.removeOk': '削除',
  'workbench.workspace.members.removeAria': 'メンバーを削除',
  'workbench.workspace.members.removedToast': '{name} を削除しました',
  'workbench.workspace.members.updatedToast': '{name} を更新しました',
  'workbench.workspace.members.addedToast': '{name} を追加しました',
  'workbench.workspace.members.addPlaceholder': 'ユーザーまたはサービスアカウントを追加…',
  'workbench.workspace.members.addButton': '追加',
  'workbench.workspace.members.noneToAdd': 'このサーバーの全員が既にアクセスできます。',
  'workbench.workspace.members.readOnlyHint': 'メンバーを変更できるのはワークスペースの所有者だけです。',
  'workbench.workspace.members.visibilityLabel': 'アクセス',
  'workbench.workspace.members.visibilityPrivate': 'プライベート',
  'workbench.workspace.members.visibilityInternal': '内部',
  'workbench.workspace.members.visibilityPrivateHint': '招待されたメンバーだけがこのワークスペースを見られます。',
  'workbench.workspace.members.visibilityInternalHint':
    'このサーバーのすべてのメンバーがこのワークスペースを閲覧できます。編集できるのは追加したメンバーだけです。',
  'workbench.workspace.members.visibilityUpdatedToast': 'ワークスペースのアクセスを更新しました',
  'workbench.workspace.members.visibilityPublic': '公開',
  'workbench.workspace.members.visibilityPublicHint':
    'リンクを知っている人は誰でも、このワークスペースの共有された読み取り専用スナップショットを閲覧できます。編集できるのは追加したメンバーだけです。',
  'workbench.workspace.publicShare.heading': '公開リンク',
  'workbench.workspace.publicShare.loadFailed': '公開共有の状態を読み込めませんでした',
  'workbench.workspace.publicShare.disabledHint':
    'このサーバーでは公開ワークスペースが無効です。運用者は daemon.json の publicWorkspaces で有効にできます。',
  'workbench.workspace.publicShare.notShared':
    'まだスナップショットは共有されていません。共有するとリンクが有効になります。',
  'workbench.workspace.publicShare.sharedAt': 'スナップショットを {when} に共有',
  'workbench.workspace.publicShare.shareButton': '公開で共有…',
  'workbench.workspace.publicShare.updateButton': '公開コピーを更新…',
  'workbench.workspace.publicShare.stopButton': '共有を停止',
  'workbench.workspace.publicShare.stopConfirm':
    'このワークスペースの共有を停止しますか？公開リンクは直ちに無効になります。',
  'workbench.workspace.publicShare.stopOk': '共有を停止',
  'workbench.workspace.publicShare.stoppedToast': '公開リンクを削除しました',
  'workbench.workspace.publicShare.sharedToast': '公開スナップショットを共有しました',
  'workbench.workspace.publicShare.copyLink': 'リンクをコピー',
  'workbench.workspace.publicShare.copiedToast': 'リンクをコピーしました',
  'workbench.workspace.publicShare.reviewTitle': '「{name}」を公開で共有',
  'workbench.workspace.publicShare.reviewIntro':
    'リンクを知っている人は誰でも、現時点のこのワークスペースの読み取り専用スナップショットを見られます。確定する前に、何が含まれるかを確認してください：',
  'workbench.workspace.publicShare.reviewUpdateNote': '再度共有すると、同じリンクの公開コピーが置き換えられます。',
  'workbench.workspace.publicShare.reviewStripped':
    '含まれないもの：vault のエントリ、OAuth token、ライブ値、ファイルの内容、シークレット型変数の値。',
  'workbench.workspace.publicShare.reviewStrippedCount':
    '{count} 件のシークレット変数の値は隠されたままです。名前は表示されます。',
  'workbench.workspace.publicShare.reviewContents': '内容',
  'workbench.workspace.publicShare.reviewEmpty':
    'このワークスペースは空です。公開されるスナップショットも空になります。',
  'workbench.workspace.publicShare.reviewVariables': '変数（{count}）',
  'workbench.workspace.publicShare.reviewNoVariables': '変数はありません。',
  'workbench.workspace.publicShare.reviewValueHidden': '非表示',
  'workbench.workspace.publicShare.confirmShare': 'スナップショットを共有',
  'workbench.workspace.publicShare.previewFailed': 'スナップショットのプレビューを準備できませんでした',
  'workbench.workspace.publicShare.shareFailed': 'スナップショットの共有に失敗しました',
  'workbench.workspace.publicShare.scope.workspace': 'ワークスペース',
  'workbench.workspace.publicShare.scope.environment': '環境',
  'workbench.workspace.publicShare.scope.collection': 'コレクション',
  'workbench.workspace.publicShare.cat.requests': '{count} 件のリクエスト',
  'workbench.workspace.publicShare.cat.collections': '{count} 個のコレクション',
  'workbench.workspace.publicShare.cat.folders': '{count} 個のフォルダー',
  'workbench.workspace.publicShare.cat.rules': '{count} 件のルール',
  'workbench.workspace.publicShare.cat.environments': '{count} 個の環境',
  'workbench.workspace.publicShare.cat.examples': '{count} 件のレスポンス例',
  'workbench.workspace.publicShare.cat.specs': '{count} 件の API 仕様',
  'workbench.workspace.publicShare.cat.scripts': '{count} 個のスクリプトパッケージ',
  'workbench.workspace.publicShare.cat.templates': '{count} 件のテンプレート',
  'workbench.workspace.publicShare.cat.live': '{count} 件のライブワークフロー',
  'workbench.workspace.publicShare.cat.files': '{count} 個のファイル',
  'workbench.workspace.publicView.bannerTag': '公開スナップショット',
  'workbench.workspace.publicView.banner':
    '「{name}」の読み取り専用の公開コピーです。ここで行った編集はどこにも保存されません。',
  'workbench.workspace.publicView.loadFailed': 'この公開ワークスペースのリンクは利用できません。',
  'workbench.workspace.createOk': '作成',
  'workbench.workspace.createFailed': 'ワークスペースの作成に失敗しました',
  'workbench.workspace.createdToastPrefix': 'ワークスペースを作成しました：',
  'workbench.workspace.duplicateTitle': '「{name}」を複製',
  'workbench.workspace.duplicateTitleFallback': 'ワークスペースを複製',
  'workbench.workspace.duplicateOk': '複製',
  'workbench.workspace.duplicateFailed': 'ワークスペースの複製に失敗しました',
  'workbench.workspace.duplicatedToast': '「{source}」→「{name}」に複製しました',
  'workbench.workspace.publishFailed': 'ワークスペースのコピーに失敗しました',
  'workbench.workspace.publishedToast': '「{name}」を {place} にコピーしました',
  'workbench.workspace.selectedOrgFallback': '選択した宛先',
  'workbench.workspace.editTitle': 'ワークスペースを編集',
  'workbench.workspace.saveOk': '保存',
  'workbench.workspace.updatedToast': '「{name}」を更新しました',
  'workbench.workspace.deletedElsewhere': 'このワークスペースは別のタブから削除されました',
  'workbench.workspace.updateFailed': 'ワークスペースの更新に失敗しました',
  'workbench.workspace.updateFailedWithMessage': 'ワークスペースの更新に失敗しました：{message}',
  'workbench.workspace.otherWorkspaces': 'その他のワークスペース',
  'workbench.workspace.dragToReorder': 'ドラッグして並べ替え',
  'workbench.workspace.activePill': 'アクティブ',
  'workbench.workspace.switch': '切り替え',
  'workbench.workspace.renameAria': 'ワークスペースの名前を変更',
  'workbench.workspace.duplicateAria': 'ワークスペースを複製',
  'workbench.workspace.publishAria': 'ワークスペースをデスクトップアプリまたはサーバーにコピー',
  'workbench.workspace.deleteAria': 'ワークスペースを削除',
  'workbench.workspace.prefixLabel': 'プレフィックス',
  'workbench.workspace.nameLabel': '名前',
  'workbench.workspace.nameRequired': '名前は必須です',
  'workbench.workspace.nameTooLong': '名前は 60 文字未満にしてください',
  'workbench.workspace.namePlaceholder': 'マイワークスペース',
  'workbench.workspace.descriptionLabel': '説明（省略可）',
  'workbench.workspace.copyOfName': '{name} のコピー',
  'workbench.workspace.copyOfPlaceholder': '… のコピー',
  'workbench.workspace.intoOrg': 'コピー先',
  'workbench.workspace.includeSecrets': 'vault の内容（シークレット）を含める',
  'workbench.workspace.includeSecretsHint':
    '必要ならコピー側でシークレットを再入力してください。OAuth 接続はどちらにせよ再認可が必要です。',

  // ── Workspace: switcher ─────────────────────────────────────────────
  'workbench.workspace.makeActiveTitle': '「{name}」をアクティブなワークスペースにしますか？',
  'workbench.workspace.makeActiveBody':
    'ポップアップ、サイドパネル、そして特定のワークスペースにピン留めされていない新しい{units}が「{name}」に切り替わります。',
  'workbench.workspace.makeActiveOk': 'アクティブにする',
  'workbench.workspace.cancel': 'キャンセル',
  'workbench.workspace.nowActiveToast': '「{name}」がアクティブなワークスペースになりました',
  'workbench.workspace.switcherAria': 'この{unit}はワークスペース「{name}」を編集中です。クリックで切り替えます。',

  // ── Workspace: publish modal — "Copy to <place>" to the user ────────
  'workbench.workspace.publishTitle': '「{name}」をコピー',
  'workbench.workspace.publishTitleFallback': 'ワークスペースをコピー',
  'workbench.workspace.publishToOk': '{place} にコピー',
  'workbench.workspace.publishOk': 'コピー',
  'workbench.workspace.publishIntro':
    'このワークスペースのコピーが、選んだデスクトップアプリまたはサーバーに置かれ、そこから同期されます。元のワークスペースはここに残ります。',
  'workbench.workspace.toOrg': 'コピー先',
  'workbench.workspace.pickTargetOrg': 'コピーの置き先を選んでください',

  // ── Workspace: home-Org identity card ───────────────────────────────
  'workbench.workspace.org.logoButton': 'Logo',
  'workbench.workspace.org.logoAria': 'この組織のロゴを変更',
  'workbench.workspace.org.renameButton': '名前を変更',
  'workbench.workspace.org.renameAria': 'この組織の名前を変更',
  'workbench.workspace.org.renameTitle': '{hint} の名前を変更',
  'workbench.workspace.org.renameTitleFallback': '名前を変更',
  'workbench.workspace.org.nameUpdated': '名前を更新しました',
  'workbench.workspace.org.identityLoading': 'ID をまだ読み込んでいます。しばらくしてからもう一度お試しください',
  'workbench.workspace.org.renameExtra': 'ワークスペース切り替えと、ワークスペースを共有する相手に表示されます。',
  'workbench.workspace.org.nameTooLong': '名前は {max} 文字未満にしてください',
  'workbench.workspace.org.namePlaceholder': '仕事用ノート PC',
  'workbench.workspace.org.logoTitle': '{hint} のロゴ',
  'workbench.workspace.org.logoTitleFallback': '組織のロゴ',
  'workbench.workspace.org.logoAlt': '現在の組織のロゴ',
  'workbench.workspace.org.replace': '置き換え…',
  'workbench.workspace.org.upload': 'アップロード…',
  'workbench.workspace.org.remove': '削除',
  'workbench.workspace.org.logoUpdated': 'ロゴを更新しました',
  'workbench.workspace.org.logoRemoved': 'ロゴを削除しました',
  'workbench.workspace.org.fileReadFailed': 'そのファイルを読み取れませんでした。',
  'workbench.workspace.org.logoHint':
    'PNG、JPEG、WebP、または SVG で、{kb} KB まで。正方形の画像が最もきれいに表示されます。この組織と同期する全員に表示されます。',
  'workbench.workspace.org.logoReject.notImage': 'そのファイルを画像として読み取れませんでした。',
  'workbench.workspace.org.logoReject.corruptImage': 'そのファイルは、宣言された種類の有効な画像ではありません。',
  'workbench.workspace.org.logoReject.unsupportedFormat': 'PNG、JPEG、WebP、または SVG ファイルを使ってください。',
  'workbench.workspace.org.logoReject.tooLarge': 'ロゴは {kb} KB 未満にしてください。',
  'workbench.workspace.org.logoReject.unsafeSvg':
    'この SVG にはスクリプトまたは外部参照が含まれています。単純で自己完結した SVG を書き出してください。',

  // ── Workspace: grant arrival + zero-grant banner ────────────────────
  'workbench.workspace.grant.arrivedActiveTitle': 'ワークスペースにアクセスできるようになりました',
  'workbench.workspace.grant.arrivedTitle': 'ワークスペースが利用可能になりました',
  'workbench.workspace.grant.open': 'ワークスペースを開く',
  'workbench.workspace.grant.notifTitleActive': '{name} にアクセスできるようになりました',
  'workbench.workspace.grant.notifTitle': 'ワークスペース {name} が利用可能になりました',
  'workbench.workspace.grant.notifBodyActive': '管理者がアクセスを付与しました。今はその中で作業しています。',
  'workbench.workspace.grant.notifBody': '管理者がアクセスを付与しました。ワークスペース切り替えに表示されます。',
  'workbench.workspace.grant.orgFallback': 'あなたの組織',
  'workbench.workspace.grant.zeroBanner':
    '{orgs} に接続していますが、まだワークスペースは付与されていません。今はローカルのワークスペースで作業しています。管理者がアクセスを付与すると、付与されたワークスペースが自動的にここに表示されます。',

  // ── Workspace: identity picker ──────────────────────────────────────
  'workbench.workspace.picker.colorAria': '色 {name}',
  'workbench.workspace.picker.searchIcons': 'アイコンを検索...',
  'workbench.workspace.picker.noIconTooltip': 'アイコンなし：色の四角だけを表示',
  'workbench.workspace.picker.noIconAria': 'アイコンなし',
  'workbench.workspace.picker.triggerAria': 'ワークスペースのプレフィックス（色またはアイコン）を選択',
} as const satisfies Catalog;
