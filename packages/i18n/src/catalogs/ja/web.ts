/**
 * Web namespace — Japanese. Mirrors `catalogs/en/web.ts` key for key;
 * the 'OpenHeaders' brand, URLs and the `oh-license.` key prefix stay
 * raw. Mints: デーモン = daemon; シート = seat / 個人シート =
 * individual seat; メール = email; ペアリング = pairing; セットアップ
 * コード = setup code; ID プロバイダー = identity provider; リバース
 * プロキシ = reverse proxy; シングルサインオン = single sign-on;
 * Workbench raw as the surface name.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const web = {
  'web.gate.titleSignIn': 'このサーバーにサインイン',
  'web.gate.titleSetup': 'このサーバーをセットアップ',
  'web.gate.introSso': 'この OpenHeaders Server に到達するには {provider} でサインインしてください。',
  'web.gate.introPassword': 'サーバー管理者が設定したメールとパスワードでサインインしてください。',
  'web.gate.introSetup':
    'この OpenHeaders Server はまだ誰もセットアップしていません。最初のアカウントを作成してください。そのアカウントがサーバーを管理し、既にあるすべてのものを所有します。',
  'web.gate.introNoLogin':
    'このサーバーにはブラウザーからサインインする手段がありません。シングルサインオンは構成されておらず、パスワードを持つアカウントもありません。サーバーの運用者にパスワードの設定を依頼してください。',
  'web.gate.ssoButton': '{provider} でサインイン',
  'web.gate.emailPlaceholder': 'メール',
  'web.gate.passwordPlaceholder': 'パスワード',
  'web.gate.signIn': 'サインイン',
  'web.gate.setupNamePlaceholder': 'あなたの名前',
  'web.gate.setupConfirmPlaceholder': 'パスワードを確認',
  'web.gate.setupPasswordHint': '{min} 文字以上。パスワードのリセットはないため、安全な場所に保管してください。',
  'web.gate.setupCodePlaceholder': 'セットアップコード',
  'web.gate.setupCodeHint': 'サーバーの起動時にログに出力されます。再起動のたびに新しいコードが出力されます。',
  'web.gate.setupSubmit': 'アカウントを作成',
  'web.gate.setupDoneTitle': 'このサーバーはセットアップされました',
  'web.gate.setupDoneRepair': ({ count }, locale) =>
    plural(locale, Number(count), {
      other:
        'セットアップにより {count} 台のペアリング済みデバイスのペアリングが解除されたため、新しいアカウントを迂回してこのサーバーを管理し続けることはできません。設定からもう一度ペアリングしてください。',
    }),
  'web.gate.setupDoneContinue': 'サーバー管理へ進む',
  'web.gate.setupDoneReload': '再読み込み',
  'web.gate.setupErrorDisplayName': 'アカウントに付ける名前を入力してください。',
  'web.gate.setupErrorEmail': 'サインインに使うメールを入力してください。',
  'web.gate.setupErrorPasswordShort': '{min} 文字以上にしてください。',
  'web.gate.setupErrorPasswordMismatch': '2 つのパスワードが一致しません。',
  'web.gate.setupErrorMalformed':
    'サーバーがフォームを読み取れませんでした。ページを再読み込みしてもう一度お試しください。',
  'web.gate.setupErrorRefused':
    'サーバーがセットアップを拒否しました。既にセットアップ済みか、セットアップコードが誤っているか、以前の起動時のものが残っている可能性があります。サーバーは再起動のたびに新しいコードを出力します。',
  'web.gate.setupErrorSessionRefused':
    'アカウントは作成されましたが、このタブはセッションを開けませんでした。ページを再読み込みしてそのアカウントでサインインしてください。',
  'web.gate.clientsIntro':
    'クライアントはこのタブだけではありません。拡張機能とデスクトップアプリは、このサーバーに次の場所で直接到達します：',
  'web.gate.clientsExtension': '拡張機能を入手',
  'web.gate.clientsDesktop': 'デスクトップアプリを入手',
  'web.gate.errorServerOffline': 'サーバーが応答しませんでした。動作していることを確認して、もう一度お試しください。',
  'web.gate.errorPasswordRefused': 'サインインに失敗しました。メールとパスワードを確認して、もう一度お試しください。',
  'web.gate.errorSessionRefused': 'サーバーがセッションを受け入れませんでした。もう一度お試しください。',
  'web.gate.seatIntroPrefix':
    '個人シートをお持ちですか？そのキーを貼り付けると、空きのチームシートを待たずにサインインできます。購入時のメールを受け入れます。入手先：',
  'web.gate.seatIntroSuffix': '.',
  'web.gate.seatKeyPlaceholder': '個人シートキー（oh-license.…）',
  'web.gate.seatSignIn': '個人シートでサインイン',
  'web.overlay.signingIn': 'サインインしています…',
  'web.overlay.takingYouTo': '{provider} へ移動しています…',
  'web.oidcError.unknownUser':
    'サインインしましたが、このサーバーにはあなたのメールのユーザーがいません。サーバー管理者に追加を依頼してください。',
  'web.oidcError.userDeactivated':
    'サインインしましたが、このサーバー上のあなたのユーザーは無効化されています。サーバー管理者に連絡してください。',
  'web.oidcError.emailUnverified':
    'ID プロバイダーはこのメールを未確認と報告しています。確認してからもう一度お試しください。',
  'web.oidcError.providerUnavailable':
    'ID プロバイダーに到達できませんでした。しばらくしてからもう一度お試しください。',
  'web.oidcError.seatLimitReached':
    'サインインしましたが、このサーバーには新しいユーザーのための空きシートがありません。サーバー管理者に連絡するか、自分の個人シートで今すぐ入ってください。',
  'web.oidcError.personalSeatsDisabled':
    'このサーバーでは個人シートが無効です。シートについてサーバー管理者に連絡してください。',
  'web.oidcError.personalLicenseInvalid':
    'その個人シートキーは使用できません。無効、期限切れ、または個人シートではありません。キーを確認してもう一度お試しください。',
  'web.oidcError.personalLicenseIdentityMismatch':
    'その個人シートは別のメールのものです。購入時のアドレスだけを受け入れます。',
  'web.oidcError.personalLicenseNoIdentity':
    'サインインに個人シートと照合するメールが含まれていませんでした。サーバー管理者に連絡してください。',
  'web.oidcError.failed':
    'シングルサインオンに失敗しました。もう一度お試しいただくか、サーバーの運用者にプロバイダーの確認を依頼してください。',
  'web.access.title': 'まだワークスペースが付与されていません',
  'web.access.intro':
    '{org} にサインインしていますが、そこのワークスペースはまだ付与されていません。管理者がワークスペースへのアクセスを付与する必要があります。',
  'web.access.introNoOrg':
    'このサーバーにサインインしていますが、そこのワークスペースはまだ付与されていません。管理者がワークスペースへのアクセスを付与する必要があります。',
  'web.access.signedInAs': '{name} としてサインイン中',
  'web.access.signedInAsWithEmail': '{name}（{email}）としてサインイン中',
  'web.access.waiting': 'アクセスが付与された瞬間にこの画面は更新されます。再読み込みは不要です。',
  'web.access.signOut': 'サインアウト',
  'web.insecure.title': 'このページには安全な接続が必要です',
  'web.insecure.intro':
    'このタブはサーバーの薄いビューではなく Workbench 全体を実行するため、このデバイスの ID を作成する必要があります。ブラウザーは安全なオリジンでのみそれを許可します。',
  'web.insecure.optionLocal': 'サーバー自身の上で：',
  'web.insecure.optionTls': 'ここから HTTPS で：TLS を終端するリバースプロキシを前段に置いてください。',
  'web.insecure.optionClients': 'ここから TLS なしで：拡張機能とデスクトップアプリは次に直接接続します：',
} as const satisfies Catalog;
