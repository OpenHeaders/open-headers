/**
 * Daemon-admin family — Japanese. Mirrors
 * `catalogs/en/workbench-server-admin.ts` key for key. Raw by design
 * inside keyed sentences: capability ids (`daemon.admin`),
 * admission-status enum values and audit `reason` strings ({status} /
 * {reason} holes carry server data), license ids ({id}), the
 * `oh-license.` key prefix and `openheaders.com/pricing` URL, `IdP` /
 * `SSO` / `JSONL` vocabulary, and the ` · ` separator glyphs. デーモン
 * = daemon; シート / 個人シート + 個人シートキー（oh-license.…） reused
 * verbatim from `ja/web.ts`; メール = email; 付与 = grant (shipped
 * mints). MINTS: プール = the seat pool; ソロティア / チームティア = solo
 * / team tier (ティア = tier); 受け入れ = admission; ディレクトリユーザー
 * = directory user; 吸収 = absorb (seat into pool); 無効化 =
 * deactivate; サービスアカウント = service account.
 */

import type { Catalog } from '../../types';

export const workbenchServerAdmin = {
  // ── Console shell ──────────────────────────────────────────────────
  'workbench.serverAdmin.title': 'サーバー管理',
  'workbench.serverAdmin.intro':
    'ディレクトリユーザーはバインドされた token または SSO でサインインし、ここで付与されたワークスペースだけを見ます。無効化するとユーザーの token が取り消され、直ちに切断されます。',
  'workbench.serverAdmin.deniedDescription': 'このサーバーの管理には daemon.admin ケイパビリティが必要です。',
  'workbench.serverAdmin.cancel': 'キャンセル',

  // ── Server admin panel (the administration nav — one row per
  //    domain, each opening its own slim tab) ─────────────────────────
  'workbench.serverAdmin.panel.users': 'ユーザー',
  'workbench.serverAdmin.panel.usersHint': 'ディレクトリ、ロール、ワークスペースのアクセス',
  'workbench.serverAdmin.panel.devices': 'ペアリング済みデバイス',
  'workbench.serverAdmin.panel.devicesHint': 'token、ペアリング、サインイン中のセッション',
  'workbench.serverAdmin.panel.git': 'Git',
  'workbench.serverAdmin.panel.gitHint': 'サーバーのワークスペースをリポジトリにバインド',
  'workbench.serverAdmin.panel.audit': '監査',
  'workbench.serverAdmin.panel.auditHint': 'サーバーの監査証跡を照会',
  'workbench.serverAdmin.panel.server': 'サーバー',
  'workbench.serverAdmin.panel.serverHint': 'ビルド、バージョン、リリースノート',

  // ── Release-notes card ─────────────────────────────────────────────
  'workbench.serverAdmin.build.sectionTitle': 'ビルド',
  'workbench.serverAdmin.build.sectionHint': 'このコンソールが管理するサーバービルド。',
  'workbench.serverAdmin.build.versionLabel': 'バージョン',
  'workbench.serverAdmin.build.versionUnknown': '不明',
  'workbench.serverAdmin.notes.sectionTitle': 'リリースノート',
  'workbench.serverAdmin.notes.sectionHint': 'このコンソールが管理するサーバービルドで出荷されたもの。',
  'workbench.serverAdmin.notes.empty': 'このビルドにはリリースノートが含まれていません。',

  // ── Users section ──────────────────────────────────────────────────
  'workbench.serverAdmin.users.sectionTitle': 'ユーザー',
  'workbench.serverAdmin.users.sectionHint':
    'ユーザーを受け入れ、下でワークスペースごとのロールを付与します。メールは SSO ログインをレコードに結び付けます。',
  'workbench.serverAdmin.users.nameRequired': '名前は必須です',
  'workbench.serverAdmin.users.workspaceRequired': 'ワークスペースを少なくとも 1 つ付与してください',
  'workbench.serverAdmin.users.displayNamePlaceholder': '表示名',
  'workbench.serverAdmin.users.emailPlaceholder': 'メール',
  'workbench.serverAdmin.users.emailRequired': 'メールは必須です。ユーザーはメールでサインインします。',
  'workbench.serverAdmin.users.emailInvalid': '有効なメールアドレスを入力してください',
  'workbench.serverAdmin.users.initialPasswordPlaceholder': '初期パスワード（省略可）',
  'workbench.serverAdmin.users.passwordTooShort': 'パスワードは 8 文字以上にしてください',
  'workbench.serverAdmin.users.seatKeyPlaceholder': '個人シートキー（oh-license.…）',
  'workbench.serverAdmin.users.addUser': 'ユーザーを追加',
  'workbench.serverAdmin.users.kindUser': 'ユーザー',
  'workbench.serverAdmin.users.kindService': 'サービスアカウント',
  'workbench.serverAdmin.users.serviceExplainer':
    'サービスアカウントは自動化のためにワークスペースの付与とバインドされた token を保持します。サインインすることはなく、シートも消費しません。その token は下のデバイスセクションで発行してください。',
  'workbench.serverAdmin.users.serviceNamePlaceholder': 'サービスアカウント名（例：CI deploy）',
  'workbench.serverAdmin.users.addService': 'サービスアカウントを追加',
  'workbench.serverAdmin.users.serviceTag': 'サービス',
  'workbench.serverAdmin.users.serviceLimit':
    '無料プランでは {limit} 個のサービスアカウントまで使えます。有料ライセンスがあれば上限はなくなります。',
  'workbench.serverAdmin.users.licensesSoldAt': 'ライセンスの販売先：',
  'workbench.serverAdmin.users.neverSeenService': '未使用',
  'workbench.serverAdmin.users.seatLimit':
    'このサーバーはシートの上限に達しています。チームライセンスにシートを追加するか、参加するユーザー自身の個人シートキーを上に貼り付けてください。プールのシートを使わずに受け入れられます。',
  'workbench.serverAdmin.users.seatsSoldAt': '個人シートの販売先：',
  'workbench.serverAdmin.users.emptyDirectory':
    'ディレクトリユーザーはまだいません。サーバーはソロティアで動作しています。ユーザーを追加するとチームティアが開きます。',
  'workbench.serverAdmin.users.deactivatedOn': '{date} に無効化',
  'workbench.serverAdmin.users.addedOn': '{date} に追加',
  'workbench.serverAdmin.users.lastSeenOn': '最終確認 {date}',
  'workbench.serverAdmin.users.neverSeen': 'サインイン履歴なし',
  'workbench.serverAdmin.users.sortByCreated': '新しい順',
  'workbench.serverAdmin.users.sortByLastSeen': '最終確認',
  'workbench.serverAdmin.users.loadFailed': 'ユーザーディレクトリの読み込みに失敗しました：{message}',
  'workbench.serverAdmin.users.addFailed': 'ユーザーの追加に失敗しました：{message}',

  // ── Personal-seat admission tag ────────────────────────────────────
  'workbench.serverAdmin.seat.tag': '個人シート',
  'workbench.serverAdmin.seat.healthyTooltip':
    '自身の個人シート（{id}）で受け入れられています。このサーバーのプールには数えられません。',
  'workbench.serverAdmin.seat.lapsedTooltip':
    'この個人シート（{id}）は {status} です。サインインは保たれ（失効で追い出されることはありません）、シートは更新されなくなります。',
  'workbench.serverAdmin.seat.absorbTitle': 'このシートをプールに吸収しますか？',
  'workbench.serverAdmin.seat.absorbDescription':
    'このユーザーは通常のプールシートになり、個人ライセンスはここでは更新されなくなります。この操作は元に戻せません。',
  'workbench.serverAdmin.seat.absorbOk': '吸収',
  'workbench.serverAdmin.seat.absorbCta': 'プールに吸収',
  'workbench.serverAdmin.seat.absorbed': 'シートをプールに吸収しました。',
  'workbench.serverAdmin.seat.absorbFailed': 'シートの吸収に失敗しました：{message}',

  // ── Deactivation ───────────────────────────────────────────────────
  'workbench.serverAdmin.deactivate.title': 'このユーザーを無効化しますか？',
  'workbench.serverAdmin.deactivate.description':
    'token が取り消され、ライブの接続が閉じられます。後で再び受け入れるには、同じメールを改めて追加してください。',
  'workbench.serverAdmin.deactivate.cta': '無効化',
  'workbench.serverAdmin.deactivate.done':
    'ユーザーを無効化しました。token は取り消され、ライブの接続は閉じられました。',
  'workbench.serverAdmin.deactivate.failed': '無効化に失敗しました：{message}',

  // ── Grants editor ──────────────────────────────────────────────────
  'workbench.serverAdmin.grants.roleViewer': '閲覧者',
  'workbench.serverAdmin.grants.roleEditor': '編集者',
  'workbench.serverAdmin.grants.roleOwner': '所有者',
  'workbench.serverAdmin.grants.none': 'ワークスペースへのアクセスはまだありません。',
  'workbench.serverAdmin.grants.idpTooltip':
    'ID プロバイダーのマッピングによって付与されています。取り消しは次の SSO ログインで再適用されるまでしか続きません。',
  'workbench.serverAdmin.grants.workspacePlaceholder': 'ワークスペース',
  'workbench.serverAdmin.grants.grantCta': '付与',
  'workbench.serverAdmin.grants.everyWorkspace': 'すべてのワークスペースに付与されています。',
  'workbench.serverAdmin.grants.grantFailed': '付与に失敗しました：{message}',
  'workbench.serverAdmin.grants.revokeFailed': '付与の取り消しに失敗しました：{message}',

  // ── Password modal ─────────────────────────────────────────────────
  'workbench.serverAdmin.password.setTitle': 'パスワードを設定：{name}',
  'workbench.serverAdmin.password.resetTitle': 'パスワードをリセット：{name}',
  'workbench.serverAdmin.password.explainer':
    'ユーザーはサーバーの Web ゲートで、メールとこのパスワードでサインインします。直接本人に伝えてください。サーバー上ではハッシュ化され、読み戻すことはできません。',
  'workbench.serverAdmin.password.placeholder': '新しいパスワード（8 文字以上）',
  'workbench.serverAdmin.password.setCta': 'パスワードを設定',
  'workbench.serverAdmin.password.resetCta': 'パスワードをリセット',
  'workbench.serverAdmin.password.removeCta': 'パスワードを削除',
  'workbench.serverAdmin.password.setDone': 'パスワードを設定しました。',
  'workbench.serverAdmin.password.removedDone': 'パスワードを削除しました。',
  'workbench.serverAdmin.password.updateFailed': 'パスワードの更新に失敗しました：{message}',
  'workbench.serverAdmin.password.needsEmail': '先にメールを設定してください。ユーザーはメールでサインインします。',

  // ── Email modal (the client sign-in plan D5) ────────────────────────
  'workbench.serverAdmin.email.setTitle': 'メールを設定：{name}',
  'workbench.serverAdmin.email.explainer':
    'ユーザーはサーバーのページと各クライアントからメールでサインインします。メールがないと、このユーザーはどの方法でもサインインできません。',
  'workbench.serverAdmin.email.setCta': 'メールを設定',
  'workbench.serverAdmin.email.setDone': 'メールを設定しました。',
  'workbench.serverAdmin.email.updateFailed': 'メールの設定に失敗しました：{message}',

  // ── Git email modal ────────────────────────────────────────────────
  'workbench.serverAdmin.gitEmail.setTitle': 'Git メールを設定：{name}',
  'workbench.serverAdmin.gitEmail.changeTitle': 'Git メールを変更：{name}',
  'workbench.serverAdmin.gitEmail.explainer':
    'このユーザーの作業を運ぶコミットはこのアドレスで作成されるため、ユーザーの Git ホスティングのプロファイルに結び付きます。設定がない場合はディレクトリのメール、次に noreply アドレスが使われます。',
  'workbench.serverAdmin.gitEmail.placeholder': 'コミット作成者のメール',
  'workbench.serverAdmin.gitEmail.setCta': 'Git メールを設定',
  'workbench.serverAdmin.gitEmail.changeCta': 'Git メールを変更',
  'workbench.serverAdmin.gitEmail.removeCta': '上書きを削除',
  'workbench.serverAdmin.gitEmail.setDone': 'Git メールを設定しました。',
  'workbench.serverAdmin.gitEmail.removedDone': 'Git メールの上書きを削除しました。',
  'workbench.serverAdmin.gitEmail.updateFailed': 'Git メールの更新に失敗しました：{message}',

  // ── Functional roles ───────────────────────────────────────────────
  'workbench.serverAdmin.roles.daemonAdmin': 'サーバー管理者',
  'workbench.serverAdmin.roles.daemonAdminTooltip':
    'このサーバーを管理します。ユーザー、ロール、付与、デバイス、レポート。それ自体はワークスペースへのアクセスを与えず、このユーザーは引き続き下で付与されたワークスペースだけを見ます。',
  'workbench.serverAdmin.roles.createWorkspaces': 'ワークスペースの作成',
  'workbench.serverAdmin.roles.createWorkspacesTooltip':
    'このユーザーがサーバー上に新しいワークスペースを作成できるようにします。作成したものは本人が所有します。既存のワークスペースには引き続き付与が必要です。',
  'workbench.serverAdmin.roles.daemonAdminGranted': 'サーバー管理者になりました。',
  'workbench.serverAdmin.roles.daemonAdminRevoked': 'サーバー管理者のロールを取り消しました。',
  'workbench.serverAdmin.roles.createWorkspacesGranted': 'ワークスペースを作成できるようになりました。',
  'workbench.serverAdmin.roles.createWorkspacesRevoked': 'ワークスペースを作成できなくなりました。',
  'workbench.serverAdmin.roles.lastAdmin': 'これが唯一のサーバー管理者です。先に別の人を管理者にしてください',
  'workbench.serverAdmin.roles.updateFailed': 'ロールの変更に失敗しました：{message}',

  // ── Git section ────────────────────────────────────────────────────
  'workbench.serverAdmin.git.sectionTitle': 'Git',
  'workbench.serverAdmin.git.sectionHint':
    'サーバーのワークスペースをリポジトリにバインドし、コミット、プル、プッシュ、ブランチをリモートから操作します。パスはサーバー自身のファイルシステム上のものです。',
  'workbench.serverAdmin.git.workspaceLabel': 'ワークスペース',

  // ── Audit reports ──────────────────────────────────────────────────
  'workbench.serverAdmin.audit.sectionTitle': 'レポート',
  'workbench.serverAdmin.audit.sectionHint':
    'このサーバーが下すすべての権限の決定と、各デバイスの受け入れを、フィルターできる監査証跡として表示します。エクスポートは有効なフィルターに従います。',
  'workbench.serverAdmin.audit.capAdmission': '受け入れ（接続）',
  'workbench.serverAdmin.audit.capAdminPlane': '管理プレーン',
  'workbench.serverAdmin.audit.capOperatorPlane': '運用者のみ',
  'workbench.serverAdmin.audit.capSsoGrant': 'SSO 付与（マッピング）',
  'workbench.serverAdmin.audit.capSsoRevoke': 'SSO 取り消し（マッピング）',
  'workbench.serverAdmin.audit.capSsoAdmin': 'SSO 管理者（宣言）',
  'workbench.serverAdmin.audit.capWorkspaceRead': 'ワークスペースの読み取り',
  'workbench.serverAdmin.audit.capWorkspaceWrite': 'ワークスペースの書き込み',
  'workbench.serverAdmin.audit.capWorkspaceList': 'ワークスペースの一覧',
  'workbench.serverAdmin.audit.rangeLastHour': '過去 1 時間',
  'workbench.serverAdmin.audit.rangeLast24Hours': '過去 24 時間',
  'workbench.serverAdmin.audit.rangeLast7Days': '過去 7 日間',
  'workbench.serverAdmin.audit.rangeLast30Days': '過去 30 日間',
  'workbench.serverAdmin.audit.colTime': '時刻',
  'workbench.serverAdmin.audit.colEvent': 'イベント',
  'workbench.serverAdmin.audit.colCapability': 'ケイパビリティ',
  'workbench.serverAdmin.audit.colWorkspace': 'ワークスペース',
  'workbench.serverAdmin.audit.colActor': 'アクター',
  'workbench.serverAdmin.audit.eventAdmission': '受け入れ',
  'workbench.serverAdmin.audit.eventAdmissionRefused': '受け入れ拒否',
  'workbench.serverAdmin.audit.eventSsoGrant': 'SSO 付与',
  'workbench.serverAdmin.audit.eventSsoRevoke': 'SSO 取り消し',
  'workbench.serverAdmin.audit.eventSsoAdmin': 'SSO 管理者',
  'workbench.serverAdmin.audit.eventAllow': '許可',
  'workbench.serverAdmin.audit.eventDeny': '拒否',
  'workbench.serverAdmin.audit.filterActor': 'アクター',
  'workbench.serverAdmin.audit.filterCapability': 'ケイパビリティ',
  'workbench.serverAdmin.audit.filterDecision': '決定',
  'workbench.serverAdmin.audit.filterWorkspace': 'ワークスペース',
  'workbench.serverAdmin.audit.filterAnyTime': '期間指定なし',
  'workbench.serverAdmin.audit.decisionAllow': '許可',
  'workbench.serverAdmin.audit.decisionDeny': '拒否',
  'workbench.serverAdmin.audit.refresh': '更新',
  'workbench.serverAdmin.audit.exportJsonl': 'JSONL をエクスポート',
  'workbench.serverAdmin.audit.emptyText': '一致する監査行はありません。',
  'workbench.serverAdmin.audit.loadMore': 'さらに読み込む',
} as const satisfies Catalog;
