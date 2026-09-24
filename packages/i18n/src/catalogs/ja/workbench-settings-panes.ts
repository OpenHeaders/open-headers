/**
 * Workbench settings — custom pane components — Japanese. Extends
 * the ja register contract (`ja/shared.ts`). Mirrors
 * `catalogs/en/workbench-settings-panes.ts` key for key. Raw by
 * design: バックエンド keeps the back-end mint, デーモン = daemon, vault
 * / workflow-seed `seed` / `Org` as dev loanwords, networking
 * vocabulary (loopback, LAN, WAN, TLS, `ws://` / `wss://`), IANA port
 * constants (1024 / 49152 / 65535), IP literals, `MCP` / `SSO` /
 * `CLI` / `oh` / streamable HTTP, snippet filenames
 * (claude_desktop_config.json), the `oh-license.…` key prefix, git
 * command vocabulary (`git remote add`, `--no-verify`, HEAD), and the
 * {chord} / {token} / {url} holes. Settings paths quote the ja shell
 * mints（バックアップと同期 › 同期）; シート / ティア / 無料ティア /
 * 取り消し = revoke; 発行 = mint (a token) reuses the chrome mint;
 * プリセット and ショートカット reuse workbench-settings-defs-keyboard;
 * ペアリング = pair carries the shared mint（ペアリングコード = pairing
 * code）. MINTS: ローテーション = rotate (a token); スタッシュ = git
 * stash; 信頼ストア = trust store; 認証局 = certificate authority (CA
 * raw in chip contexts); 救援ブランチ = rescue branch; 特権ヘルパー =
 * privileged helper; ルートプレビュー = route preview.
 */

import { formatMessage, plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchSettingsPanes = {
  // ── Backend pane body ──────────────────────────────────────────────
  'workbench.settings.backendPane.learnMore': '詳細',
  'workbench.settings.backendPane.rowMenuAria': '{label} の操作',
  'workbench.settings.backendPane.tierZero.title.extension': 'このブラウザー',
  'workbench.settings.backendPane.tierZero.title.desktop': 'このコンピューター',
  'workbench.settings.backendPane.tierZero.title.web': 'このサーバー',
  'workbench.settings.backendPane.tierZero.copy.extension':
    'ワークスペースはここにあります。バックアップと同期は下の場所を通じてのみ行われます。',
  'workbench.settings.backendPane.tierZero.copy.desktop':
    'ワークスペースはこのコンピューターのデスクトップアプリにあります。バックアップと同期は下の場所を通じてのみ行われます。',
  'workbench.settings.backendPane.tierZero.copy.web':
    'ワークスペースはこのサーバーにあります。ここにサインインするすべてのブラウザーとデバイスが同じコピーで作業します。',
  'workbench.settings.backendPane.tierZero.alwaysOn': '常にオン',
  'workbench.settings.backendPane.tierZero.administer': '管理…',
  'workbench.settings.backendPane.wizard.step.connect': '接続',
  'workbench.settings.backendPane.wizard.editTitle': '{label} を編集',
  'workbench.settings.backendPane.wizard.title.desktop': 'デスクトップアプリを接続',
  'workbench.settings.backendPane.wizard.title.server': 'サーバーにサインイン',
  'workbench.settings.backendPane.wizard.step.address': 'アドレス',
  'workbench.settings.backendPane.wizard.step.signIn': 'サインイン',
  'workbench.settings.backendPane.wizard.connect': '接続',
  'workbench.settings.backendPane.wizard.checkAgain': 'もう一度確認',
  'workbench.settings.backendPane.wizard.checking': '{host} を確認中…',
  'workbench.settings.backendPane.wizard.verdict.needsPairing': '{host} はこのデバイスにサインインを求めています。',
  'workbench.settings.backendPane.wizard.verdict.signedIn': '{name} にサインインしました。',
  'workbench.settings.backendPane.wizard.verdict.signedInUnnamed': 'サインインしました。',
  'workbench.settings.backendPane.wizard.verdict.signedInAs': '{person} として {name} にサインインしました。',
  'workbench.settings.backendPane.wizard.verdict.signedInAsUnnamed': '{person} としてサインインしました。',
  'workbench.settings.backendPane.wizard.signIn.primary': '{host} でサインイン',
  'workbench.settings.backendPane.wizard.signIn.intro':
    '{host} のページがブラウザーで開きます。そこでご自身のアカウントでサインインし、このデバイスを承認してください。ここでは何も入力しません。',
  'workbench.settings.backendPane.wizard.signIn.codeLabel': 'サインインコード',
  'workbench.settings.backendPane.wizard.signIn.waiting': 'ブラウザーでこのデバイスが承認されるのを待っています…',
  'workbench.settings.backendPane.wizard.signIn.openAgain': 'ページをもう一度開く',
  'workbench.settings.backendPane.wizard.signIn.waitingBrowser':
    'ブラウザーでサインインを完了してから、ここに戻ってください…',
  'workbench.settings.backendPane.wizard.signIn.linkHint':
    'ブラウザーが開かない場合は、このリンクを任意のブラウザーで開いてください：',
  'workbench.settings.backendPane.wizard.signIn.tryAgain': '再試行',
  'workbench.settings.backendPane.wizard.signIn.cancelSignIn': 'サインインをキャンセル',
  'workbench.settings.backendPane.wizard.signIn.unclaimed':
    'このサーバーにはまだ管理者がいません。まず {url} でセットアップしてから、ここでサインインしてください。',
  'workbench.settings.backendPane.wizard.signIn.noLogin':
    'ブラウザーから {host} にサインインできる人はいません。管理者からのペアリングコードまたは token だけが唯一の方法です。',
  'workbench.settings.backendPane.wizard.signIn.secondary': '管理者からのペアリングコードまたは token をお持ちですか？',
  'workbench.settings.backendPane.wizard.signIn.fail.denied': 'サーバーのページでサインインが拒否されました。',
  'workbench.settings.backendPane.wizard.signIn.fail.expired': 'サインイン要求は承認される前に期限切れになりました。',
  'workbench.settings.backendPane.wizard.signIn.fail.lost':
    'サーバーはこのサインイン要求を保持していません。もう一度開始してください。',
  'workbench.settings.backendPane.wizard.signIn.fail.abandoned':
    'ブラウザーでサインインが完了しませんでした。もう一度お試しください。',
  'workbench.settings.backendPane.wizard.signIn.fail.tooManyPending':
    '{host} では待機中のサインインが多すぎます。数分後にもう一度お試しください。',
  'workbench.settings.backendPane.wizard.signIn.fail.throttled':
    '{host} は現在このデバイスからの要求を拒否しています。しばらくしてからもう一度お試しください。',
  'workbench.settings.backendPane.wizard.signIn.fail.forbidden':
    '{host} はこのデバイスからのサインイン要求を拒否しました。',
  'workbench.settings.backendPane.wizard.signIn.fail.offline':
    '{host} からは何も応答がありませんでした。そのアドレスで動作していますか？',
  'workbench.settings.backendPane.wizard.signIn.fail.generic':
    'サインインを開始できませんでした。もう一度お試しください。',
  'workbench.settings.backendPane.wizard.next': '次へ',
  'workbench.settings.backendPane.wizard.connectIntro':
    'このデバイスが接続するアドレスです。最後のステップで検証するまで何も接続されません。',
  'workbench.settings.backendPane.wizard.autoPairFallback':
    'デスクトップアプリとの自動ペアリングが通りませんでした。アプリが動作していないか、このブラウザーを検証できなかった可能性があります。代わりにコードまたは token でペアリングしてください。',
  'workbench.settings.backendPane.wizard.readyIntroPaired':
    '準備完了：{url} の {label}、サインイン済み。接続はまずアドレスとサインインを検証し、その後ワークスペースが同期され、オフラインでも使えるようになります。',
  'workbench.settings.backendPane.wizard.readyIntroPairedUnnamed':
    '準備完了：{url}、サインイン済み。接続はまずアドレスとサインインを検証し、その後ワークスペースが同期され、オフラインでも使えるようになります。',
  'workbench.settings.backendPane.wizard.additionalConnection':
    'これは追加の接続です。そのワークスペースはワークスペース切り替えに新しいグループとして現れ、ステータスポップオーバーにその行が加わり、各グループは正確に 1 つの場所から同期します。別の接続が既に提供しているグループは二重には参加しません。',
  'workbench.settings.backendPane.wizard.disableFirst':
    '{label} は接続中です。接続の編集は生きた配線を動かすことなので、まず切断します。設定とペアリングは保持され、再びオンにすると新しい構成を検証してから接続します。',
  'workbench.settings.backendPane.wizard.disconnectEdit': '切断して編集',

  // ── Backend pane: connections list ─────────────────────────────────
  'workbench.settings.backendPane.connections.title': '同期先',
  'workbench.settings.backendPane.connections.connectDesktop': 'デスクトップアプリを接続',
  'workbench.settings.backendPane.connections.signInServer': 'サーバーにサインイン…',
  'workbench.settings.backendPane.connections.emptyDesktopLine':
    'このコンピューターのブラウザー間で同期：デスクトップアプリを接続します。',
  'workbench.settings.backendPane.connections.emptyServerLine':
    'デバイス間やチームと同期：OpenHeaders Server にサインインします。',
  'workbench.settings.backendPane.connections.menu.connect': '接続',
  'workbench.settings.backendPane.connections.menu.disconnect': '切断',
  'workbench.settings.backendPane.connections.menu.edit': '編集…',
  'workbench.settings.backendPane.connections.menu.remove': '削除…',
  'workbench.settings.backendPane.connections.place.desktopApp': 'このコンピューターのデスクトップアプリ',
  'workbench.settings.backendPane.placement.section': '新しいワークスペース',
  'workbench.settings.backendPane.placement.label': '置き先',
  'workbench.settings.backendPane.placement.description':
    'いつでも変更できます。既存のワークスペースはそのままの場所に残ります。',
  'workbench.settings.backendPane.connections.writeFailed': '接続を保存できませんでした',
  'workbench.settings.backendPane.connections.status.connected': '接続済み',
  'workbench.settings.backendPane.connections.status.connecting': '接続中…',
  'workbench.settings.backendPane.connections.status.authRequired': '再ペアリングが必要',
  'workbench.settings.backendPane.connections.status.error': '接続断',
  'workbench.settings.backendPane.connections.status.off': 'オフ',
  'workbench.settings.backendPane.connections.repair': '再ペアリング',
  'workbench.settings.backendPane.connections.autoConnect': '自動接続',
  'workbench.settings.backendPane.connections.orgConflict':
    'Org「{org}」は既に {provider} が提供しています。参加しません',
  'workbench.settings.backendPane.connections.removedBackend': '削除された接続',

  // ── Backend pane: probe-gated enable ───────────────────────────────
  'workbench.settings.backendPane.enable.connectingTo': '{label} に接続中…',
  'workbench.settings.backendPane.enable.connected': '{label} に接続しました。',
  'workbench.settings.backendPane.enable.orgNotJoined':
    '{label} は接続しましたが、その Org には参加していません。接続の行を確認してください。',

  // ── Backend pane: remove flow ──────────────────────────────────────
  'workbench.settings.backendPane.remove.confirmTitle': '{label} を削除しますか？',
  'workbench.settings.backendPane.remove.confirmBody':
    'そのアドレスとペアリングは忘れられます。そこからはまだ何も同期されていません。',
  'workbench.settings.backendPane.remove.aria': '{label} を削除',
  'workbench.settings.backendPane.remove.removed': '{label} を削除しました。',
  'workbench.settings.backendPane.remove.workspaceCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 個のワークスペース' }),
  'workbench.settings.backendPane.remove.body.prefix': 'この接続は',
  'workbench.settings.backendPane.remove.body.suffix':
    'を提供し、{workspaces}がこのデバイスに同期されています。接続側のデータには決して触れません。ローカルのコピーをどうするかを選んでください。',
  'workbench.settings.backendPane.remove.outcomeAria': '削除の結果',
  'workbench.settings.backendPane.remove.recommendedBadge': '推奨',
  'workbench.settings.backendPane.remove.keep.title': 'ローカルのコピーを保持',
  'workbench.settings.backendPane.remove.keep.description':
    '{orgs} の同期が止まります。{workspaces}はオフラインのローカルデータとしてこのデバイスに残ります。',
  'workbench.settings.backendPane.remove.discard.title': 'ローカルのコピーを破棄',
  'workbench.settings.backendPane.remove.discard.description':
    '各ワークスペースはまずダウンロードファイルにバックアップされ、その後このデバイスから削除されます。後で再び接続すると再度同期されます。',
  'workbench.settings.backendPane.remove.discard.includeSecrets':
    'バックアップファイルに vault のシークレットを含める（平文です。ファイルを安全に保管してください）',
  'workbench.settings.backendPane.remove.removeBackend': '接続を削除',
  'workbench.settings.backendPane.remove.backupThenRemove': 'バックアップしてから削除',
  'workbench.settings.backendPane.remove.progress.removing': '接続を削除中…',
  'workbench.settings.backendPane.remove.progress.preparing': 'バックアップを準備中…',
  'workbench.settings.backendPane.remove.progress.backingUp': '「{name}」をバックアップ中…',
  'workbench.settings.backendPane.remove.progress.deleting': '「{name}」を削除中…',
  'workbench.settings.backendPane.remove.keepDone':
    '{label} を削除しました。{orgs} の同期が止まり、{workspaces}はこのデバイスに残ります。',
  'workbench.settings.backendPane.remove.discardDone':
    '{label} を削除しました。{workspaces}をバックアップして削除し、{orgs} のバインドを解除しました。',
  'workbench.settings.backendPane.remove.discardStayedTitle': ({ label, count }, locale) =>
    plural(locale, Number(count), {
      other: `${String(label)} を削除しましたが、{count} 個のワークスペースが残りました`,
    }),
  'workbench.settings.backendPane.remove.discardStayedBody':
    '削除できませんでした：{names}。ローカルデータとして残ります。',
  'workbench.settings.backendPane.remove.backupFailedTitle': '「{name}」のバックアップに失敗しました',
  'workbench.settings.backendPane.remove.backupFailedBody':
    'エクスポートが完了しませんでした。何も削除されていません。',

  // ── Backend pane: pair with a code ─────────────────────────────────
  'workbench.settings.backendPane.pair.pairWithCode': 'コードでペアリング',
  'workbench.settings.backendPane.pair.pasteTokenTitle': 'token を貼り付け',
  'workbench.settings.backendPane.pair.codeBlurb':
    'デスクトップアプリまたはサーバーに表示されるコードを入力してください。このデバイスをサインインさせる token と交換されます。',
  'workbench.settings.backendPane.pair.tokenBlurb':
    'デスクトップアプリまたはサーバーに表示される token を貼り付けてください。ローテーションでは新しいシークレットが一度だけ表示されます。このデバイスの資格情報として保存されます。',
  'workbench.settings.backendPane.pair.codePlaceholder': '6 桁のコード',
  'workbench.settings.backendPane.pair.deviceNamePlaceholder': 'デバイス名（省略可）',
  'workbench.settings.backendPane.pair.codeRequired':
    'デスクトップアプリまたはサーバーに表示されるペアリングコードを入力してください。',
  'workbench.settings.backendPane.pair.pasteTokenRequired':
    'デスクトップアプリまたはサーバーに表示される token を貼り付けてください。',
  'workbench.settings.backendPane.pair.pairAction': 'ペアリング',
  'workbench.settings.backendPane.pair.saveToken': 'token を保存',
  'workbench.settings.backendPane.pair.tokenSaved': '認証 token を保存しました。',
  'workbench.settings.backendPane.pair.pairedSaved': 'ペアリング完了。認証 token を保存しました。',
  'workbench.settings.backendPane.pair.switchToToken': 'token をお持ちですか？代わりに貼り付ける',
  'workbench.settings.backendPane.pair.switchToCode': 'ペアリングコードをお持ちですか？',
  'workbench.settings.backendPane.pair.fail.unknown':
    'そのコードは不明か、期限切れです。新しいコードを求めてもう一度お試しください。',
  'workbench.settings.backendPane.pair.fail.expired':
    'そのペアリングコードは期限切れです。デスクトップアプリまたはサーバーで新しいものを生成してください。',
  'workbench.settings.backendPane.pair.fail.consumed':
    'そのコードは既に使われています。デスクトップアプリまたはサーバーで新しいものを生成してください。',
  'workbench.settings.backendPane.pair.fail.unreachable':
    '{url} で何も応答しませんでした。そのアドレスで動作していますか？',
  'workbench.settings.backendPane.pair.fail.generic': 'ペアリングに失敗しました。もう一度お試しください。',
  'workbench.settings.backendPane.pair.nmRequired':
    'デスクトップアプリとの手動ペアリングはオフです。このブラウザーは検証済みのペアリングでのみ接続します。「検証済みのペアリングを必須にする」の設定を参照してください。',

  // ── Backend pane: record field editors ─────────────────────────────
  'workbench.settings.backendPane.field.label.label': '名前',
  'workbench.settings.backendPane.field.label.description':
    'アプリ全体でこの接続が呼ばれる名前です。デフォルトはそのアドレスです。',
  'workbench.settings.backendPane.field.label.placeholder': '仕事用 VM',
  'workbench.settings.backendPane.field.label.aria': '接続名',
  'workbench.settings.backendPane.field.url.label': 'サーバーのアドレス',
  'workbench.settings.backendPane.field.url.description':
    '管理者から伝えられたアドレスまたは URL です。このコンピューターやネットワークには `http` か `ws`、リモートのサーバーには `https` か `wss` を使います。',
  'workbench.settings.backendPane.field.url.invalid': 'ホスト、ホスト:ポート、または URL を入力してください。',
  'workbench.settings.backendPane.field.auth.label': 'サインイン',
  'workbench.settings.backendPane.field.auth.description':
    'このデバイスのサインイン方法です。コードでペアリングするか、token を直接貼り付けます。',
  'workbench.settings.backendPane.field.auth.codeAria': 'ペアリングコード',
  'workbench.settings.backendPane.field.auth.tokenAria': '認証 token',
  'workbench.settings.backendPane.field.auth.tokenPlaceholder': 'token を貼り付け',
  'workbench.settings.backendPane.field.auth.paired': 'ペアリング済み。アクセス token を保存しました',
  'workbench.settings.backendPane.field.auth.useToken': '代わりに認証 token を使う',
  'workbench.settings.backendPane.field.auth.useCode': '代わりにコードでペアリング',

  // ── Backend pane: port validation hints ────────────────────────────
  // The IANA boundary numbers (1024 / 49152 / 65535) are protocol
  // constants, embedded literally rather than interpolated.
  'workbench.settings.backendPane.port.missing': 'ポートを入力してください。',
  'workbench.settings.backendPane.port.notInteger': 'ポートは整数である必要があります。',
  'workbench.settings.backendPane.port.privileged':
    '1024 未満のポートは特権ポートで、昇格した権限が必要です。1024 以上を選んでください。',
  'workbench.settings.backendPane.port.aboveMax': 'ポートは 65535 以下である必要があります。',
  'workbench.settings.backendPane.port.ephemeral':
    'ポート 49152–65535 は OS が送信接続用に配る範囲で、ここのリスナーは断続的にバインドに失敗することがあります。1024–49151 のポートのほうが確実です。',

  // ── Backend pane: LAN-peers confirm ────────────────────────────────
  'workbench.settings.backendPane.lan.confirmTitle': 'LAN のピアを許可しますか？',
  'workbench.settings.backendPane.lan.confirmOk': 'LAN のピアを許可',
  'workbench.settings.backendPane.lan.confirmCancel': 'ループバックのみのまま',
  'workbench.settings.backendPane.lan.confirmBody':
    'デスクトップアプリはすべてのローカルネットワークインターフェースでリッスンし、ネットワーク上の他のデバイスが接続できるようになります。ネットワークからでもこのコンピューターからでも、すべての接続はペアリング済みの token を提示する必要があり、token なしの経路はありません。デバイスはアプリが表示するコードでペアリングします（またはバックアップと同期 › 同期に token を貼り付けます）。',

  // ── Backend pane: offline fallback order ───────────────────────────
  'workbench.settings.backendPane.fallback.empty':
    'まだ登録されたホストはありません。このワークスペースの排他的なライブワークフローの seed を保持すると、ブラウザーはこの一覧に加わります。',
  'workbench.settings.backendPane.fallback.saveFailed': '新しい順序を保存できませんでした',
  'workbench.settings.backendPane.fallback.removeFailed': 'ホストを削除できませんでした',
  'workbench.settings.backendPane.fallback.dragAria': 'ドラッグして並べ替え',
  'workbench.settings.backendPane.fallback.selfTag': 'このブラウザー',
  'workbench.settings.backendPane.fallback.pruneTitle': 'このホストを削除しますか？',
  'workbench.settings.backendPane.fallback.pruneBody':
    '排他的なワークフローの seed をまだ保持していれば、自動的に再び加わります。',

  // ── Keymap pane body ───────────────────────────────────────────────
  'workbench.settings.keymapPane.searchPlaceholder': 'ショートカットを検索',
  'workbench.settings.keymapPane.noMatches': '検索に一致するショートカットはありません。',
  'workbench.settings.keymapPane.recording': 'キーを押してください…',
  'workbench.settings.keymapPane.unbound': '未割り当て',
  'workbench.settings.keymapPane.recordTip': 'クリックして新しいショートカットを記録',
  'workbench.settings.keymapPane.recordAria': '{label} のショートカットを変更',
  'workbench.settings.keymapPane.unbind': 'ショートカットを削除',
  'workbench.settings.keymapPane.unbindAria': '{label} のショートカットを削除',
  'workbench.settings.keymapPane.resetAria': '{label} のショートカットをリセット',
  'workbench.settings.keymapPane.conflictSummary': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件のショートカットに競合する割り当てがあります' }),
  'workbench.settings.keymapPane.conflictShowOnly': '競合を表示',
  'workbench.settings.keymapPane.conflictShowAll': 'すべてのショートカットを表示',
  'workbench.settings.keymapPane.conflictBadgeAria': 'ショートカットの競合',
  'workbench.settings.keymapPane.conflictTooltip': '次にも割り当て済み：{labels}',
  'workbench.settings.keymapPane.reservedBadgeAria': '予約済みのショートカット',
  'workbench.settings.keymapPane.reservedBrowser':
    'ブラウザーがこのショートカットを予約しています。アプリに届く前にブラウザーが処理することがあります。',
  'workbench.settings.keymapPane.reservedSystem':
    'オペレーティングシステムがこのショートカットを予約しています。アプリに届く前にシステムが処理することがあります。',
  'workbench.settings.keymapPane.lookupTip': 'ショートカットを押してアクションを探す',
  'workbench.settings.keymapPane.lookupAria': 'ショートカットでアクションを探す',
  'workbench.settings.keymapPane.lookupEmpty': '{chord} に割り当てられたアクションはありません。',
  'workbench.settings.keymapPane.conflictPrompt': '{chord} は既に次に割り当てられています：{labels}',
  'workbench.settings.keymapPane.conflictReassign': '割り当て直す',
  'workbench.settings.keymapPane.conflictKeepBoth': '両方を保持',
  'workbench.settings.keymapPane.presetAria': 'キーマップのプリセット',
  'workbench.settings.keymapPane.presetSection': 'キーマップ',
  'workbench.settings.keymapPane.presetRestore': ({ count }, locale) =>
    plural(locale, Number(count), { other: 'プリセットを復元（{count} 件のカスタマイズ）' }),
  'workbench.settings.keymapPane.presetRestoreTip':
    'カスタマイズしたすべてのショートカットをアクティブなプリセットにリセットします。',

  // ── Daemon token ledger (shared by Backend + MCP panes) ────────────
  'workbench.settings.backendTokens.sectionTitle': 'ペアリング済みデバイス',
  'workbench.settings.backendTokens.sectionBlurb':
    'このバックエンドに接続する各デバイスはアクセス token で認証します。接続中のデバイスは強調表示されます。token をローテーションすると新しいシークレットが発行され、古いものは退役します。',
  'workbench.settings.backendTokens.labelPlaceholder': 'ラベル（省略可）。例：「alice のスマートフォン」',
  'workbench.settings.backendTokens.bindUserPlaceholder': 'ユーザーにバインド（省略可）',
  'workbench.settings.backendTokens.generate': 'token を生成',
  'workbench.settings.backendTokens.pairDevice': 'デバイスをペアリング',
  'workbench.settings.backendTokens.explainer.intro': 'どちらも下に token を追加します。',
  'workbench.settings.backendTokens.explainer.generateText':
    'は、自分でデバイスにコピーして貼り付けるシークレットを表示します。',
  'workbench.settings.backendTokens.explainer.pairText':
    'は、デバイスがバックアップと同期 › 同期 › コードでペアリングで入力する短いコードを表示します（フォールバックとしてリンクも開きます）。他の人がデバイスをセットアップするときに使ってください。',
  'workbench.settings.backendTokens.empty':
    'デバイスはまだありません。token を生成してデバイスのバックアップと同期 › 同期に貼り付けるか、デバイスをペアリングしてそこでコードを入力させてください。',
  'workbench.settings.backendTokens.mintFailed': 'token の発行に失敗しました：{message}',
  'workbench.settings.backendTokens.rotateFailed': 'ローテーションに失敗しました：{message}',
  'workbench.settings.backendTokens.revokeFailed': '取り消しに失敗しました：{message}',
  'workbench.settings.backendTokens.revokedDevice':
    'token を取り消しました。それを使っていたデバイスは切断されました。',
  'workbench.settings.backendTokens.revokedSession': 'セッションを取り消しました。ユーザーはサインアウトされました。',
  'workbench.settings.backendTokens.rotate': 'ローテーション',
  'workbench.settings.backendTokens.revoke': '取り消し',
  'workbench.settings.backendTokens.rotateConfirmTitle': 'この token をローテーションしますか？',
  'workbench.settings.backendTokens.rotateConfirmBody':
    '新しいシークレットが発行され、現在のものは取り消されます。デバイスが再接続するには新しい token を渡す必要があります。',
  'workbench.settings.backendTokens.revokeConfirmTitle': 'この token を取り消しますか？',
  'workbench.settings.backendTokens.revokeConfirmBody':
    '現在それを使っているデバイスは直ちに切断され、再接続できません。',
  'workbench.settings.backendTokens.revokeSessionConfirmTitle': 'このセッションを取り消しますか？',
  'workbench.settings.backendTokens.revokeSessionConfirmBody':
    'ユーザーは直ちにサインアウトされ、切断されます。ID プロバイダーを通じて再度ログインする必要があります。',
  'workbench.settings.backendTokens.revokedTag': '{when} に取り消し',
  'workbench.settings.backendTokens.connectedTag': '接続済み',
  'workbench.settings.backendTokens.expiredTag': '期限切れ',
  'workbench.settings.backendTokens.unlabeled': '（ラベルなし）',
  'workbench.settings.backendTokens.unbound': '（未バインド）',
  'workbench.settings.backendTokens.meta.device': 'id {id} · 作成 {created} · 最終使用 {lastUsed}',
  'workbench.settings.backendTokens.meta.boundUser': 'ユーザー {user}',
  'workbench.settings.backendTokens.meta.session':
    'サインイン {signedIn} · 期限 {expires} · 最終確認 {lastSeen} · id {id}',
  'workbench.settings.backendTokens.ssoTitle': 'SSO セッション',
  'workbench.settings.backendTokens.ssoBlurb':
    '各 SSO ログインは自動的に期限切れになるセッションを発行します。取り消すとユーザーは直ちにサインアウトされ、ID プロバイダーを通じて再度ログインする必要があります。',
  'workbench.settings.backendTokens.secretTitle': 'この token を今すぐコピーしてください',
  'workbench.settings.backendTokens.secretTitleRotated': 'ローテーションした token を今すぐコピーしてください',
  'workbench.settings.backendTokens.secretBody':
    'バックエンドはこの値のハッシュだけを保存します。このダイアログを閉じるとシークレットは復元できません。失った場合は token を取り消して新しいものを発行してください。',
  'workbench.settings.backendTokens.secretBodyRotated':
    '以前の token は取り消されました。デバイスが再接続できるよう、この新しいシークレットを渡してください。バックエンドはこの値のハッシュだけを保存します。このダイアログを閉じるとシークレットは復元できません。失った場合は token を取り消して新しいものを発行してください。',
  'workbench.settings.backendTokens.secretSaved': '保存しました',

  // ── Daemon pairing modal ────────────────────────────────────────────
  'workbench.settings.backendTokens.pairModal.done': '完了',
  'workbench.settings.backendTokens.pairModal.allocating': 'コードを割り当て中…',
  'workbench.settings.backendTokens.pairModal.startFailed': 'ペアリングを開始できませんでした',
  'workbench.settings.backendTokens.pairModal.expiredTitle': 'ペアリングの期限切れ',
  'workbench.settings.backendTokens.pairModal.expiredBody':
    '確認のないまま 5 分の期限が過ぎました。このダイアログを閉じ、もう一度「デバイスをペアリング」をクリックしてやり直してください。',
  'workbench.settings.backendTokens.pairModal.pairedTitle': 'ペアリング完了',
  'workbench.settings.backendTokens.pairModal.pairedBody':
    'デバイスがコードを確認しました。新しいアクセス token が発行されてそのデバイスに保存され、下の一覧に表示されます。デバイスが接続できない場合は、エントリを取り消してもう一度ペアリングしてください。',
  'workbench.settings.backendTokens.pairModal.intro.part1': 'もう一方のデバイスで',
  'workbench.settings.backendTokens.pairModal.intro.settingsPath': 'バックアップと同期 › 同期',
  'workbench.settings.backendTokens.pairModal.intro.part2': 'を開き、その',
  'workbench.settings.backendTokens.pairModal.intro.address': 'バックエンドアドレス',
  'workbench.settings.backendTokens.pairModal.intro.part3': 'をこのアプリに向け、次に',
  'workbench.settings.backendTokens.pairModal.intro.part4': 'をクリックして次を入力してください：',
  'workbench.settings.backendTokens.pairModal.codeLabel': 'ペアリングコード',
  'workbench.settings.backendTokens.pairModal.expiresIn': '有効期限まで {remaining}',
  'workbench.settings.backendTokens.pairModal.addressListLabel': 'このアプリのバックエンドアドレス',
  'workbench.settings.backendTokens.pairModal.fallback.prefix': 'そのデバイスに',
  'workbench.settings.backendTokens.pairModal.fallback.suffix':
    'の選択肢がありませんか？代わりにそこでこれらのリンクのいずれかを開いてください。手動で貼り付ける token を渡すページが表示されます。',

  // ── Command-line access card (MCP pane) ────────────────────────────
  'workbench.settings.cliAccess.sectionTitle': 'CLI アクセス',
  'workbench.settings.cliAccess.sectionBlurb':
    'ワンクリックでこのマシンの oh コマンドラインツールをアプリに接続します。アクセス token が作成されて保存され、コピーは不要です。',
  'workbench.settings.cliAccess.statusUnconfigured': 'このマシンの CLI はまだ接続されていません。',
  'workbench.settings.cliAccess.statusConfigured': 'CLI は {label} として接続済みです。',
  'workbench.settings.cliAccess.statusStale':
    '保存された CLI の token はもう有効ではありません。再接続するにはアクセスをもう一度セットアップしてください。',
  'workbench.settings.cliAccess.statusExternal':
    'CLI は現在別のバックエンド（{url}）に接続されています。ここでアクセスをセットアップすると、代わりにこのアプリを指すようになります。',
  'workbench.settings.cliAccess.statusMalformed': 'CLI の設定ファイルを読み取れません：{message}',
  'workbench.settings.cliAccess.pathNote': '{path} に保存',
  'workbench.settings.cliAccess.setUp': 'CLI アクセスをセットアップ',
  'workbench.settings.cliAccess.rotate': 'CLI アクセスをローテーション',
  'workbench.settings.cliAccess.connectHere': 'このアプリに接続',
  'workbench.settings.cliAccess.provisioned':
    'CLI アクセスをセットアップしました。このマシンのどのターミナルでも oh が使えます。',
  'workbench.settings.cliAccess.rotated': 'CLI の token をローテーションしました。以前の token は取り消されました。',
  'workbench.settings.cliAccess.provisionFailed': 'CLI のセットアップに失敗しました：{message}',

  // ── MCP pane body ──────────────────────────────────────────────────
  'workbench.settings.mcpPane.connect.title': 'クライアントを接続',
  'workbench.settings.mcpPane.connect.blurb':
    'クライアントを選び、token のプレースホルダーをアクセス token に置き換え、別の場所にインストールした場合はアプリのパスを調整してください。クライアントが接続するにはアプリが動作している必要があります。',
  'workbench.settings.mcpPane.tokensHome': 'アクセス token の発行と取り消しは次の場所で行います：',
  'workbench.settings.mcpPane.snippet.claudeDesktopTitle': 'claude_desktop_config.json：既存のファイルにマージ',
  'workbench.settings.mcpPane.snippet.runOnceTitle': 'ターミナルで一度だけ実行',
  'workbench.settings.mcpPane.snippet.cliTitle': 'ターミナルで一度だけ実行。以後の oh の実行にフラグは不要です',
  'workbench.settings.mcpPane.snippet.httpTitle': 'streamable HTTP を直接話すクライアント向け',

  // ── MCP consent (Add-ons popover dialog + TUI-gate checkbox info) ──
  'workbench.settings.mcpConsent.title': 'MCP サーバーをオンにする',
  'workbench.settings.mcpConsent.body':
    'エージェントクライアントと oh TUI は MCP サーバーを通じてこのアプリと話しますが、現在はオフです。',
  'workbench.settings.mcpConsent.info.title': 'MCP サーバー',
  'workbench.settings.mcpConsent.info.summary':
    'MCP クライアントはバックエンドの /mcp エンドポイント（streamable HTTP 上の Model Context Protocol）を通じてこのアプリに到達します。mcp.enabled の設定がそのエンドポイントを制御し、オフの間は 404 を返します。クライアントは他のすべての接続と同じアクセス token で認証します。',
  'workbench.settings.mcpConsent.ok': 'オンにする',

  // ── License pane body ──────────────────────────────────────────────
  'workbench.settings.licensePane.invalid.malformed': 'インストールされたファイルはライセンスキーではありません。',
  'workbench.settings.licensePane.invalid.schema-mismatch':
    'インストールされたライセンスは、このバージョンが対応するどのスキーマにも一致しません。',
  'workbench.settings.licensePane.invalid.unknown-kid':
    'インストールされたライセンスは、このビルドが信頼しない鍵で署名されています。',
  'workbench.settings.licensePane.invalid.bad-signature':
    'インストールされたライセンスは署名検証に失敗しました。署名後にテキストが改変されています。',
  'workbench.settings.licensePane.installed': 'ライセンスをインストールしました',
  'workbench.settings.licensePane.removed': 'ライセンスを削除しました。無料ティアに戻りました',
  'workbench.settings.licensePane.removeFailed': 'ライセンスの削除に失敗しました：{message}',
  'workbench.settings.licensePane.freeTier.title': '無料ティア',
  'workbench.settings.licensePane.freeTier.body':
    '現在の Open Headers のすべての機能が含まれています。無料ティアはサーバーごとに最大 {limit} 人のアクティブユーザーを受け入れます。シートの上限を上げるにはライセンスキーをインストールしてください。',
  'workbench.settings.licensePane.invalidAlert.title': 'インストールされたライセンスは使用できません',
  'workbench.settings.licensePane.invalidAlert.body':
    'アプリは無料ティア（最大 {limit} 人のアクティブユーザー）で動作し続けます。下に新しいキーを貼り付けるか、サポートにお問い合わせください。',
  'workbench.settings.licensePane.grace.title': 'ライセンスの期限切れ。猶予期間中です',
  'workbench.settings.licensePane.grace.body':
    'このライセンスは {expiredOn} に期限切れになりました。{graceEndsOn} までに更新してください。それ以降、ユーザーの作成と再有効化は無料の上限 {limit} に戻ります。既存のユーザーは引き続きログインでき、データが影響を受けることはありません。',
  'workbench.settings.licensePane.expired.title': 'ライセンスと猶予期間が終了しました',
  'workbench.settings.licensePane.expired.body':
    '新しいユーザーの作成と再有効化は、無料の上限であるアクティブユーザー {limit} 人に従います。既存のユーザーは引き続きログインでき、既存のワークスペースは動作し続け、データが影響を受けることはありません。ライセンス済みのシート数を戻すには、更新したキーをインストールしてください。',
  'workbench.settings.licensePane.getLicenseCta': 'ライセンスを入手',
  'workbench.settings.licensePane.renewLicenseCta': 'ライセンスを更新',
  'workbench.settings.licensePane.detailsSection': 'ライセンス',
  'workbench.settings.licensePane.detail.licensedTo': 'ライセンス先',
  'workbench.settings.licensePane.detail.contact': '連絡先',
  'workbench.settings.licensePane.detail.seats': 'シート',
  'workbench.settings.licensePane.detail.validUntil': '有効期限',
  'workbench.settings.licensePane.detail.licenseId': 'ライセンス id',
  'workbench.settings.licensePane.tag.active': '有効',
  'workbench.settings.licensePane.tag.offline': 'オフラインライセンス',
  'workbench.settings.licensePane.removeConfirm.title': 'このライセンスを削除しますか？',
  'workbench.settings.licensePane.removeConfirm.body':
    'アプリは無料ティア（最大 {limit} 人のアクティブユーザー）に戻ります。データは影響を受けません。',
  'workbench.settings.licensePane.removeConfirm.ok': '削除',
  'workbench.settings.licensePane.removeButton': 'ライセンスを削除',
  'workbench.settings.licensePane.replaceTitle': 'ライセンスを置き換え',
  'workbench.settings.licensePane.installTitle': 'ライセンスをインストール',
  'workbench.settings.licensePane.pastePlaceholder': 'ライセンスキーを貼り付け（oh-license.…）',
  'workbench.settings.licensePane.installButton': 'インストール',
  'workbench.settings.licensePane.loadFromFile': 'ファイルから読み込む…',

  // ── System-plane proxy section (the request-engine proxy design P3) ─
  'workbench.settings.systemProxy.section': 'プロキシ',
  'workbench.settings.systemProxy.previewSection': 'ルートプレビュー',
  'workbench.settings.systemProxy.introNote':
    'デバイスローカルで同期されません。リクエストが独自のプロキシモードを設定しない限り、すべてがこれに従います。',
  'workbench.settings.systemProxy.mode.label': 'モード',
  'workbench.settings.systemProxy.mode.infoTitle': 'プロキシモード',
  'workbench.settings.systemProxy.mode.infoSummary':
    'このデバイスが各リクエスト、WebSocket セッション、gRPC 呼び出しの経路をどう決めるかです。',
  'workbench.settings.systemProxy.mode.infoHeading': 'モード',
  'workbench.settings.systemProxy.mode.system': 'システム',
  'workbench.settings.systemProxy.mode.systemDesc':
    'ブラウザーと同じように、このマシン自身のプロキシ構成（システム設定、PAC ファイル、自動検出）に従います。デフォルトで、管理されていないマシンは単に直接接続します。',
  'workbench.settings.systemProxy.system.valuesLabel': 'システムの値',
  'workbench.settings.systemProxy.system.sourcedNote':
    'このマシン（{source}）から読み取りました。解決は引き続き URL ごとに行われます。',
  'workbench.settings.systemProxy.system.unavailable': 'システム構成を読み取れませんでした：{message}',
  'workbench.settings.systemProxy.mode.manual': '手動',
  'workbench.settings.systemProxy.mode.manualDesc':
    'すべてに対して 1 つのプロキシ（URL スキームに応じて HTTP、HTTPS、または SOCKS5）で、vault の資格情報とバイパス一覧を伴います。',
  'workbench.settings.systemProxy.mode.pac': 'PAC',
  'workbench.settings.systemProxy.mode.pacDesc':
    'URL またはローカルパスで指定した PAC ファイルが URL ごとに決めます。スクリプトはサンドボックス化されたブラウザーのネットワークスタック内でのみ実行され、アプリ内では決して実行されません。',
  'workbench.settings.systemProxy.mode.off': 'オフ',
  'workbench.settings.systemProxy.mode.offDesc': 'マシンの設定にかかわらず、常に直接接続します。',
  'workbench.settings.systemProxy.manual.url': 'プロキシ',
  'workbench.settings.systemProxy.manual.urlPlaceholder': 'プロキシなし：直接接続',
  'workbench.settings.systemProxy.manual.urlExample':
    '例：http://proxy.example:8080 または socks5://proxy.example:1080',
  'workbench.settings.systemProxy.manual.urlError':
    'host:port または http://、https://、socks5:// のプロキシ URL を入力してください。SOCKS4 には対応していません。',
  'workbench.settings.systemProxy.manual.credentials': '資格情報',
  'workbench.settings.systemProxy.manual.credentialsPlaceholder': '認証なし',
  'workbench.settings.systemProxy.manual.credentialsEmpty':
    'このデバイスの vault にはまだ文字列のエントリがありません。',
  'workbench.settings.systemProxy.manual.credentialsManage': 'vault で資格情報を管理',
  'workbench.settings.systemProxy.manual.bypass': 'バイパス一覧',
  'workbench.settings.systemProxy.manual.bypassPlaceholder': 'バイパスなし：すべてのホストがプロキシを使います',
  'workbench.settings.systemProxy.manual.bypassExample': '例：localhost, .internal.example, 10.0.0.0/8',
  'workbench.settings.systemProxy.manual.bypassError':
    'カンマ区切りのエントリのみです。エントリ内に空白を入れず、スキームは付けないでください。',
  'workbench.settings.systemProxy.manual.supported': '対応',
  'workbench.settings.systemProxy.pac.source': 'PAC',
  'workbench.settings.systemProxy.pac.sourcePlaceholder': 'PAC URL なし：直接接続',
  'workbench.settings.systemProxy.pac.sourceExample': '例：https://proxy.example/proxy.pac',
  'workbench.settings.systemProxy.pac.sourceError': 'http:// または https:// の PAC URL である必要があります。',
  'workbench.settings.systemProxy.pac.kindUrl': 'URL',
  'workbench.settings.systemProxy.pac.kindFile': 'ファイル',
  'workbench.settings.systemProxy.pac.filePlaceholder': 'PAC ファイルなし：直接接続',
  'workbench.settings.systemProxy.pac.fileExample': '例：/path/to/proxy.pac',
  'workbench.settings.systemProxy.pac.fileError': '絶対ファイルパスである必要があります。',
  'workbench.settings.systemProxy.pac.browse': '参照…',
  'workbench.settings.systemProxy.saveFailed': '設定を保存できませんでした：{message}',
  'workbench.settings.systemProxy.previewPlaceholder': 'URL をプレビュー：どの経路を取りますか？',
  'workbench.settings.systemProxy.previewButton': '解決',

  // ── Proxy trust pane body (the proxy-security design §2.3 consent posture) ─
  'workbench.settings.proxyTrustPane.intro':
    'HTTPS トラフィックの復号には、このマシンで作成された認証局が必要です。ここで信頼をセットアップするまで何もインストールされず、ここでインストールしたものはすべてここで削除できます。',
  'workbench.settings.proxyTrustPane.refresh': '再確認',
  'workbench.settings.proxyTrustPane.loadFailed': '信頼状態を読み取れませんでした：{message}',
  'workbench.settings.proxyTrustPane.ca.title': '認証局',
  'workbench.settings.proxyTrustPane.ca.none':
    '認証局はまだ存在しません。初めて信頼をセットアップするときにこのマシンで作成されます。アプリに同梱されることはなく、秘密鍵はこのコンピューターから決して出ません。',
  'workbench.settings.proxyTrustPane.ca.subject': 'サブジェクト',
  'workbench.settings.proxyTrustPane.ca.fingerprint': 'SHA-256 フィンガープリント',
  'workbench.settings.proxyTrustPane.ca.validity': '有効期間',
  'workbench.settings.proxyTrustPane.ca.validityRange': '{from} から {until} まで',
  'workbench.settings.proxyTrustPane.ca.deleteButton': '認証局を削除',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.title': '認証局を削除しますか？',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.body':
    '鍵ペアがこのマシンから削除されます。もう一度信頼をセットアップすると新しい認証局が作成されます。',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.ok': '削除',
  'workbench.settings.proxyTrustPane.ca.deleted': '認証局を削除しました',
  'workbench.settings.proxyTrustPane.ca.deleteFailed': '認証局を削除できませんでした：{message}',
  'workbench.settings.proxyTrustPane.stores.title': '信頼ストア',
  'workbench.settings.proxyTrustPane.stores.loginKeychain': 'ログインキーチェーン',
  'workbench.settings.proxyTrustPane.stores.systemKeychain': 'システムキーチェーン',
  'workbench.settings.proxyTrustPane.stores.firefoxProfile': 'Firefox プロファイル',
  'workbench.settings.proxyTrustPane.stores.firefox': 'Firefox',
  'workbench.settings.proxyTrustPane.stores.state.trusted': '信頼済み',
  'workbench.settings.proxyTrustPane.stores.state.absent': '未インストール',
  'workbench.settings.proxyTrustPane.stores.state.untrusted': '存在するが未信頼',
  'workbench.settings.proxyTrustPane.stores.state.mismatch': '別の証明書',
  'workbench.settings.proxyTrustPane.stores.state.unavailable': '読み取り不能',
  'workbench.settings.proxyTrustPane.stores.state.covered': 'OS のストアでカバー済み',
  'workbench.settings.proxyTrustPane.stores.empty': 'このマシンには見える信頼ストアがありません。',
  'workbench.settings.proxyTrustPane.mismatchAlert.title': '信頼ストアに別の証明書があります',
  'workbench.settings.proxyTrustPane.mismatchAlert.body':
    '当方の認証局の名前を持つ証明書がインストールされていますが、そのフィンガープリントはこのマシンの認証局のものではありません。このアプリはそれをインストールしておらず、決して使いません。それが置かれているストアを確認してください。',
  'workbench.settings.proxyTrustPane.recordedCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '記録されたインストール {count} 件' }),
  'workbench.settings.proxyTrustPane.installButton': '信頼をセットアップ…',
  'workbench.settings.proxyTrustPane.wizard.title': 'プロキシの認証局をインストール',
  'workbench.settings.proxyTrustPane.wizard.explain.whatTitle': 'インストールされるもの',
  'workbench.settings.proxyTrustPane.wizard.explain.whatBody':
    'このマシンで作成された、このインストールに固有のルート証明書です。秘密鍵は保存時に暗号化され、どこにも送られません。',
  'workbench.settings.proxyTrustPane.wizard.explain.enablesTitle': '可能になること',
  'workbench.settings.proxyTrustPane.wizard.explain.enablesBody':
    'それを保持する信頼ストアはキャプチャプロキシの証明書を受け入れるため、HTTPS を復号できます。対象は明示的にスコープに入れたホストだけで、それ以外はすべて手つかずで通過します。',
  'workbench.settings.proxyTrustPane.wizard.explain.removeTitle': '削除の方法',
  'workbench.settings.proxyTrustPane.wizard.explain.removeBody':
    'すべての変更が記録され、このページのワンクリックでまさにその変更を元に戻します。アプリのアンインストールでも同じです。',
  'workbench.settings.proxyTrustPane.wizard.explain.next': '信頼ストアを選択',
  'workbench.settings.proxyTrustPane.wizard.choose.blurb':
    'インストール先を選んでください。確定するまで何も変わりません。',
  'workbench.settings.proxyTrustPane.wizard.choose.loginNote':
    'あなたとして実行されるアプリ向け。管理者の承認は不要です。',
  'workbench.settings.proxyTrustPane.wizard.choose.systemNote':
    'このマシンのすべてのユーザー向け。管理者の承認を求めます。',
  'workbench.settings.proxyTrustPane.wizard.choose.systemUnavailable':
    'システム全体の信頼はこのビルドではまだ利用できません。OpenHeaders ヘルパーが必要です。当面はログインキーチェーンを使ってください。',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxNote':
    'Firefox は独自の信頼ストアを持ちます。見つかったすべてのプロファイルにインストールします。',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxNone':
    'このマシンに Firefox プロファイルは見つかりませんでした。',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxUnavailable':
    'Firefox プロファイルは見つかりましたが、certutil（NSS ツール）がインストールされていません。その信頼ストアはこのマシンから管理できません。',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxOsNote':
    'Firefox は OS のストアを自動的に信頼します（Firefox 120 以降）。上のキーチェーンがカバーします。',
  'workbench.settings.proxyTrustPane.wizard.choose.confirm': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 個のストアにインストール' }),
  'workbench.settings.proxyTrustPane.wizard.results.allOk': '選んだすべてのストアに信頼をインストールしました。',
  'workbench.settings.proxyTrustPane.wizard.results.partial':
    '一部のストアは変更されませんでした。自動で再試行はされません。原因を修正してもう一度信頼をセットアップするか、信頼を削除してロールバックしてください。',
  'workbench.settings.proxyTrustPane.wizard.results.ok': 'インストールして信頼済み',
  'workbench.settings.proxyTrustPane.wizard.results.elevation':
    '管理者の承認が拒否されました。ストアは変更されていません。',
  'workbench.settings.proxyTrustPane.wizard.results.residue':
    '証明書は追加されましたが信頼できませんでした。「信頼を削除」でクリーンアップしてください。',
  'workbench.settings.proxyTrustPane.wizard.results.failed': '失敗：{message}',
  'workbench.settings.proxyTrustPane.wizard.installFailed': '信頼のセットアップに失敗しました：{message}',
  'workbench.settings.proxyTrustPane.wizard.done': '完了',
  'workbench.settings.proxyTrustPane.removeButton': '信頼を削除',
  'workbench.settings.proxyTrustPane.removeConfirm.title': '記録されたすべてのストアから証明書を削除しますか？',
  'workbench.settings.proxyTrustPane.removeConfirm.body':
    '記録された各インストールが元に戻され、クリーンであることを検証してから記録が破棄されます。認証局そのものは後の再インストールのために保持されます。',
  'workbench.settings.proxyTrustPane.removeConfirm.ok': '削除',
  'workbench.settings.proxyTrustPane.removed':
    '信頼を削除しました。記録されたすべてのストアがクリーンであることを検証しました。',
  'workbench.settings.proxyTrustPane.removePartial':
    '一部のストアはクリーンであることを検証できませんでした。記録は保持されます。原因を修正したら削除をもう一度実行してください。',
  'workbench.settings.proxyTrustPane.removeFailed': '削除に失敗しました：{message}',
  'workbench.settings.proxyTrustPane.helper.title': '特権ヘルパー',
  'workbench.settings.proxyTrustPane.helper.blurb':
    'システムキーチェーンの信頼は、macOS にバックグラウンド項目として登録された署名済みヘルパーを介します。ヘルパーは証明書のバイト列を動かすだけで、すべての信頼の決定は引き続き macOS の管理者ダイアログを通ります。',
  'workbench.settings.proxyTrustPane.helper.notPresent':
    'このビルドには含まれていません。パッケージ化された macOS ビルドのみです。',
  'workbench.settings.proxyTrustPane.helper.registrationLabel': '登録',
  'workbench.settings.proxyTrustPane.helper.serverLabel': 'サーバー',
  'workbench.settings.proxyTrustPane.helper.state.enabled': '登録済み',
  'workbench.settings.proxyTrustPane.helper.state.requiresApproval': '承認待ち',
  'workbench.settings.proxyTrustPane.helper.state.notRegistered': '未登録',
  'workbench.settings.proxyTrustPane.helper.state.notFound': '見つかりません。macOS に記録がありません。もう一度登録してください',
  'workbench.settings.proxyTrustPane.helper.state.unknown': '不明',
  'workbench.settings.proxyTrustPane.helper.probe.ok': '応答あり',
  'workbench.settings.proxyTrustPane.helper.probe.down': '応答なし',
  'workbench.settings.proxyTrustPane.helper.approvalHint':
    'macOS が承認を待っています。ログイン項目 › “Allow in the Background” で OpenHeaders を有効にしてから、もう一度確認してください。',
  'workbench.settings.proxyTrustPane.helper.registerButton': '登録',
  'workbench.settings.proxyTrustPane.helper.unregisterButton': '登録解除',
  'workbench.settings.proxyTrustPane.helper.loginItemsButton': 'ログイン項目を開く',
  'workbench.settings.proxyTrustPane.helper.actionFailed': 'ヘルパーの操作に失敗しました：{message}',

  // ── Git pane (workspace-tree binding card, the git-sync plan §9) ─────────
  'workbench.settings.gitPane.notBound.title': 'フォルダーがバインドされていません',
  'workbench.settings.gitPane.notBound.body':
    'このワークスペースをフォルダーにバインドすると、すべてのルール、リクエスト、環境のライブの YAML ツリーが保たれます。バックアップ、差分、手編集、そして（まもなく）git に備えられます。',
  'workbench.settings.gitPane.pathPlaceholder': 'フォルダーの絶対パス',
  'workbench.settings.gitPane.chooseFolder': 'フォルダーを選択…',
  'workbench.settings.gitPane.bindButton': 'フォルダーをバインド',
  'workbench.settings.gitPane.bound': 'フォルダーをバインドしました。',
  'workbench.settings.gitPane.boundInitialized': 'フォルダーを新しいワークスペースツリーとして初期化しました。',
  'workbench.settings.gitPane.boundBody':
    '編集は継続的にこのフォルダーに書き出され、ファイルへの変更はアプリに戻ります。',
  'workbench.settings.gitPane.unbindButton': 'バインド解除',
  'workbench.settings.gitPane.unbindConfirm.title': 'このフォルダーのバインドを解除しますか？',
  'workbench.settings.gitPane.unbindConfirm.body':
    'フォルダーはディスク上で有効なワークスペースツリーのままです。アプリがその読み書きをやめるだけです。',
  'workbench.settings.gitPane.unbindConfirm.ok': 'バインド解除',
  'workbench.settings.gitPane.unbound': 'フォルダーのバインドを解除しました。',
  'workbench.settings.gitPane.issuesTitle': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 個のファイルを読み取れず、手つかずのままです' }),
  'workbench.settings.gitPane.refusal.locked':
    'このフォルダーは既に別の実行中のエンジン（プロセス {pid}）にバインドされています。',
  'workbench.settings.gitPane.refusal.uuidCollision':
    'このフォルダーには、別のソース経由でこのホストに既に存在するワークスペースが入っています。',
  'workbench.settings.gitPane.refusal.identityMismatch': 'このフォルダーは別のワークスペース（{uid}）のものです。',
  'workbench.settings.gitPane.refusal.invalidManifest': 'フォルダーの workspace.yaml を読み取れませんでした：{message}',
  'workbench.settings.gitPane.refusal.alreadyBound': 'このワークスペースは既にフォルダーにバインドされています。',
  'workbench.settings.gitPane.refusal.unknownWorkspace': 'バインドするアクティブなワークスペースがありません。',
  'workbench.settings.gitPane.git.available': 'Git {version} が見つかりました',
  'workbench.settings.gitPane.needsRepo':
    'このページにはリポジトリを持つバインド済みフォルダーが必要です。次の場所でバインドしてください：',
  'workbench.settings.gitPane.section.workingTree': '作業ツリー',
  'workbench.settings.gitPane.section.branches': 'ブランチ',
  'workbench.settings.gitPane.section.commit': 'コミット',
  'workbench.settings.gitPane.section.history': '履歴',
  'workbench.settings.gitPane.git.missing.title': 'Git がインストールされていません',
  'workbench.settings.gitPane.git.missing.body':
    'このフォルダーの履歴をコミットするには git をインストールしてください。それ以外はすべて git なしで動作し続けます。',
  'workbench.settings.gitPane.git.belowFloor.body':
    'インストールされている git（{version}）はこの機能には古すぎます。コミットを有効にするには git を更新してください。',
  'workbench.settings.gitPane.git.dirtyCount': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 件の未コミットの変更' }),
  'workbench.settings.gitPane.git.clean': '作業ツリーはクリーンです',
  'workbench.settings.gitPane.git.indexBusy':
    'あなた自身の git インデックスにステージ済みの変更がある間、自動コミットは一時停止します。',
  'workbench.settings.gitPane.git.messagePlaceholder': 'コミットメッセージ',
  'workbench.settings.gitPane.git.commitButton': 'コミット',
  'workbench.settings.gitPane.git.committed': '{sha} をコミットしました。',
  'workbench.settings.gitPane.git.nothingToCommit':
    'コミットするものはありません。ツリーは最後のコミットと一致しています。',
  'workbench.settings.gitPane.git.commitFailed': 'コミットに失敗しました：{detail}',
  'workbench.settings.gitPane.git.cadenceLabel': '自動コミット',
  'workbench.settings.gitPane.git.cadenceDescription':
    'エンジンが編集を自動的にコミットとして記録するタイミングです。オフにするとすべてのコミットが明示的な操作になります。',
  'workbench.settings.gitPane.git.cadenceOff': 'オフ：手動でコミット',
  'workbench.settings.gitPane.git.cadenceAuto': '編集が落ち着いた後',
  'workbench.settings.gitPane.git.cadenceOnBlur': 'フォーカスがアプリを離れたとき',
  'workbench.settings.gitPane.git.cadenceEvery': '{minutes} 分ごと',
  'workbench.settings.gitPane.git.bypassHooksLabel': 'git フックをバイパス',
  'workbench.settings.gitPane.git.bypassHooksDescription':
    'エンジンのコミットを --no-verify で実行し、pre-commit と commit-msg のフックをスキップします。',
  'workbench.settings.gitPane.git.bypassHooksWarning':
    'これがオンの間、エンジンのコミットは pre-commit と commit-msg のフックをスキップします。',
  'workbench.settings.gitPane.git.remoteInSync': '{upstream}：同期済み',
  'workbench.settings.gitPane.git.remoteStatus': '{upstream}：{ahead} 件先行、{behind} 件遅れ',
  'workbench.settings.gitPane.git.noUpstream':
    'リモートが設定されていません。git remote add と git push -u で追加すると「プル」が有効になります。',
  'workbench.settings.gitPane.git.pullButton': 'プル',
  'workbench.settings.gitPane.git.pulled': '{sha} をマージしました。',
  'workbench.settings.gitPane.git.upToDate': '既に最新です。',
  'workbench.settings.gitPane.git.pullFailed': 'プルに失敗しました：{detail}',
  'workbench.settings.gitPane.git.pushButton': 'プッシュ',
  'workbench.settings.gitPane.git.pushed': '{sha} をプッシュしました。',
  'workbench.settings.gitPane.git.nothingToPush': 'プッシュするものはありません。既に同期済みです。',
  'workbench.settings.gitPane.git.pushFailed': 'プッシュに失敗しました：{detail}',
  'workbench.settings.gitPane.git.pushRejected':
    'リモートに新しいコミットがあります。まずプルしてから、もう一度プッシュしてください。',
  'workbench.settings.gitPane.git.pushNoPermission.title': 'プッシュ権限がありません',
  'workbench.settings.gitPane.git.pushNoPermission.body':
    'このリモートはあなたには読み取り専用です。コミットはローカルに留まります。新しいブランチとして公開し、git ホストからマージリクエストを開けます。',
  'workbench.settings.gitPane.git.exportBranchPlaceholder': 'new-branch-name',
  'workbench.settings.gitPane.git.exportBranchButton': '新しいブランチとしてプッシュ',
  'workbench.settings.gitPane.git.exportedBranch': 'ブランチ {branch} をプッシュしました。',
  'workbench.settings.gitPane.git.autoPushLabel': 'コミットのたびにプッシュ',
  'workbench.settings.gitPane.git.autoPushDescription':
    'エンジンがコミットを記録するたびに、現在のブランチをその上流に直ちにプッシュします。',
  'workbench.settings.gitPane.git.branch.current': 'ブランチ {branch} 上',
  'workbench.settings.gitPane.git.branch.detached':
    'Detached HEAD です。この履歴を保つにはブランチを作成してください。',
  'workbench.settings.gitPane.git.branch.switchLabel': '切り替え先',
  'workbench.settings.gitPane.git.branch.switched': '{branch} に切り替えました。',
  'workbench.settings.gitPane.git.branch.switchFailed': '切り替えに失敗しました：{detail}',
  'workbench.settings.gitPane.git.branch.dirtyTitle': '未コミットの変更があります',
  'workbench.settings.gitPane.git.branch.dirtyBody': ({ count, branch }, locale) =>
    formatMessage(
      plural(locale, Number(count), {
        other:
          '{branch} に切り替える前に、{count} 件の未コミットの変更をコミット、スタッシュ、または破棄してください。',
      }),
      { branch: String(branch) },
    ),
  'workbench.settings.gitPane.git.branch.dirtyCommit': 'コミットして切り替え',
  'workbench.settings.gitPane.git.branch.dirtyStash': 'スタッシュして切り替え',
  'workbench.settings.gitPane.git.branch.dirtyDiscard': '変更を破棄',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.title': '未コミットの変更を破棄しますか？',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.body':
    '新しいファイルを含め、すべての未コミットの変更が削除されます。この操作は元に戻せません。',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.ok': '破棄',
  'workbench.settings.gitPane.git.branch.createPlaceholder': 'new-branch-name',
  'workbench.settings.gitPane.git.branch.createButton': '作成して切り替え',
  'workbench.settings.gitPane.git.branch.created': 'ブランチ {branch} を作成しました。',
  'workbench.settings.gitPane.git.branch.createFailed': 'ブランチを作成できませんでした：{detail}',
  'workbench.settings.gitPane.git.branch.mergeLabel': '現在のブランチにマージ',
  'workbench.settings.gitPane.git.branch.mergeButton': 'マージ',
  'workbench.settings.gitPane.git.branch.merged': '{sha} をマージしました。',
  'workbench.settings.gitPane.git.branch.mergeUpToDate': '既に最新です。',
  'workbench.settings.gitPane.git.branch.mergeFailed': 'マージに失敗しました：{detail}',
  'workbench.settings.gitPane.git.forcePush.title': 'リモートの履歴が書き換えられました',
  'workbench.settings.gitPane.git.forcePush.body':
    'リモートのブランチには、最後に同期した履歴（{sha}）がもう含まれていません。進め方を選んでください。決めるまで何も変わりません。',
  'workbench.settings.gitPane.git.forcePush.abandon': 'ローカルの変更を放棄',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.title': 'ローカルの変更を放棄しますか？',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.body':
    '最後の同期以降のローカルのコミットは破棄され、書き換えられたリモートの履歴がワークスペースの状態になります。',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.ok': '放棄',
  'workbench.settings.gitPane.git.forcePush.rescue': '救援ブランチに保存',
  'workbench.settings.gitPane.git.forcePush.reapply': '上に再適用',
  'workbench.settings.gitPane.git.forcePush.resolved': '書き換えられた履歴を受け入れました（{sha}）。',
  'workbench.settings.gitPane.git.forcePush.rescued': 'ローカルの履歴を {branch} に保存しました。',
  'workbench.settings.gitPane.git.forcePush.failed': '解決できませんでした：{detail}',
  'workbench.settings.gitPane.git.history.show': '履歴を表示',
  'workbench.settings.gitPane.git.history.hide': '非表示',
  'workbench.settings.gitPane.git.history.empty': 'コミットはまだありません。',
  'workbench.settings.gitPane.git.history.loadFailed': '履歴を読み取れませんでした：{detail}',
  'workbench.settings.gitPane.git.history.authorLine': '{author} · {date}',
  'workbench.settings.gitPane.git.history.coAuthors': '共同作成者：{authors}',
  'workbench.settings.gitPane.git.history.fileTitle': '履歴：{path}',
  'workbench.settings.gitPane.git.history.fileEmpty': 'このファイルに触れたコミットはまだありません。',
} as const satisfies Catalog;
