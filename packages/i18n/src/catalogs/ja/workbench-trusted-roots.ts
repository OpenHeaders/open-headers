/**
 * Trusted-certificates family — Japanese. Mirrors
 * `catalogs/en/workbench-trusted-roots.ts` key for key; PEM / CA / PKI
 * / TLS / SHA-256 ride raw. Mints: 信頼された証明書 = trusted
 * certificate; 認証局 = certificate authority; フィンガープリント =
 * fingerprint; ピン留め = pin; 信頼ストア = trust store.
 */

import type { Catalog } from '../../types';

export const workbenchTrustedRoots = {
  'workbench.trustedRoots.title': '信頼された証明書',
  'workbench.trustedRoots.description':
    'このワークスペースのすべての TLS 接続が、組み込みのルートに加えて信頼する認証局です。公開情報であり、ワークスペースと同期されます。シークレットではありません。',
  'workbench.trustedRoots.count': '証明書（{count}）',
  'workbench.trustedRoots.empty': '信頼された証明書はまだありません',
  'workbench.trustedRoots.emptyHint':
    '検証をオフにせずに独自の PKI の背後にあるサーバーやブローカーへ到達するには、プライベート CA のルートを追加してください。',
  'workbench.trustedRoots.add': '証明書を追加',
  'workbench.trustedRoots.header.name': '名前',
  'workbench.trustedRoots.header.subject': 'サブジェクト',
  'workbench.trustedRoots.header.fingerprint': 'SHA-256 フィンガープリント',
  'workbench.trustedRoots.header.expires': '有効期限',
  'workbench.trustedRoots.row.chain': '{count} 件のチェーン',
  'workbench.trustedRoots.row.expired': '期限切れ',
  'workbench.trustedRoots.row.copyFingerprint': 'フィンガープリントをコピー',
  'workbench.trustedRoots.row.copied': 'コピーしました',
  'workbench.trustedRoots.row.remove': '削除',
  'workbench.trustedRoots.row.rename': '名前を変更',
  'workbench.trustedRoots.add.pemLabel': '証明書（PEM）',
  'workbench.trustedRoots.add.pemPlaceholder': 'PEM 証明書またはチェーンを貼り付けてください',
  'workbench.trustedRoots.add.nameLabel': '名前',
  'workbench.trustedRoots.add.namePlaceholder': 'Internal Root CA',
  'workbench.trustedRoots.add.summary.subject': 'サブジェクト',
  'workbench.trustedRoots.add.summary.issuer': '発行者',
  'workbench.trustedRoots.add.summary.fingerprint': 'SHA-256',
  'workbench.trustedRoots.add.summary.validFrom': '有効期間の開始',
  'workbench.trustedRoots.add.summary.validUntil': '有効期間の終了',
  'workbench.trustedRoots.add.summary.chain': 'チェーン',
  'workbench.trustedRoots.add.parsing': '証明書を読み取り中…',
  'workbench.trustedRoots.add.invalid': '証明書ではありません：{message}',
  'workbench.trustedRoots.add.notCa':
    'これはサーバー証明書であり、認証局ではありません。代わりに、これを発行したルートまたは中間証明書を追加してください。',
  'workbench.trustedRoots.add.confirm': '追加',
  'workbench.trustedRoots.add.cancel': 'キャンセル',
  'workbench.trustedRoots.saveFailed': '信頼された証明書の保存に失敗しました',
  'workbench.trustedRoots.saveFailedDetail': '信頼された証明書の保存に失敗しました：{message}',
  'workbench.trustedRoots.settings.label': '信頼された証明書（CA）',
  'workbench.trustedRoots.settings.count': 'このワークスペースから {count} 件',
  'workbench.trustedRoots.settings.none': 'このワークスペースからはなし',
  'workbench.trustedRoots.settings.manage': '信頼された証明書を管理',
  'workbench.trustedRoots.settings.empty': 'このワークスペースには信頼された証明書がまだありません。',
  'workbench.trustedRoots.settings.browserStore': 'ブラウザーのストア',
  'workbench.trustedRoots.settings.help':
    'このワークスペースが組み込みのルートに加えて信頼する認証局です。アプリのランタイムが行うすべての TLS 接続に適用され、1 行につきルート 1 件です。検証をオフにする代わりに、ここにプライベート CA を追加してください。',
  'workbench.trustedRoots.settings.deviceCount': 'このデバイスに {count} 件',
  'workbench.trustedRoots.settings.groupWorkspace': 'このワークスペース',
  'workbench.trustedRoots.settings.groupDevice': 'このデバイス',
  'workbench.trustedRoots.device.count': 'このデバイスにピン留め（{count}）',
  'workbench.trustedRoots.device.empty': 'このデバイスにピン留めされた証明書はありません',
  'workbench.trustedRoots.device.emptyHint':
    'ピンは通常、失敗した送信から追加されます。サーバーが提示した証明書を、このマシンでのみ信頼します。手動でピン留めするには、ここに貼り付けてください。',
  'workbench.trustedRoots.settings.browserNote':
    'ブラウザーは自身の信頼ストアで検証します。このワークスペースに追加した証明書は、アプリのランタイムが送信するときにのみ適用されます。',
  'workbench.trustedRoots.systemTrust.count':
    'このマシンの信頼ストアの証明書 {count} 件が、アプリのランタイムが行うすべての TLS 接続に適用されます',
  'workbench.trustedRoots.systemTrust.off': '組み込みのルートと上記の証明書のみが信頼されます',
  'workbench.trustedRoots.systemTrust.unsupported':
    'このランタイムはシステムの信頼ストアを読み取れません。Node 22.15 以降が必要です',
  'workbench.trustedRoots.systemTrust.browser': 'ブラウザーは自身の信頼ストアで検証します',
} as const satisfies Catalog;
