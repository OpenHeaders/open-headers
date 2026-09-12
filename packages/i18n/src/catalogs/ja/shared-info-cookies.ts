/**
 * Shared info-popover corpus — Set-Cookie attributes — Japanese.
 * Mirrors `catalogs/en/shared-info-cookies.ts` key for key; attribute
 * names (Domain / Path / Expires / Max-Age / SameSite …) ride raw.
 */

import type { Catalog } from '../../types';

export const sharedInfoCookies = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.cookie.kicker': 'Set-Cookie 属性',
  'shared.info.cookie.fallbackSummary': 'この属性はレジストリに記載されていません。',
  'shared.info.cookie.fallbackDescription':
    'ベンダー固有または実験的な Set-Cookie 拡張の可能性があります。ブラウザーは認識できない属性を無視します。',

  // ── Curated attributes ─────────────────────────────────────────────
  'shared.info.cookie.domain.summary': 'Cookie の送信先ホスト。設定するとサブドメインも含みます。',
  'shared.info.cookie.domain.body':
    'Domain がない場合、Cookie は応答したホストそのものに限定され、サブドメインは含まれません。',
  'shared.info.cookie.path.summary': 'ブラウザーが Cookie を送信するために必要な URL パスのプレフィックス。',
  'shared.info.cookie.expires.summary': '絶対的な有効期限。Cookie はこの時刻まで保持されます。',
  'shared.info.cookie.expires.body':
    'Expires も Max-Age もない場合はセッション Cookie となり、ブラウザーのセッション終了時に破棄されます。',
  'shared.info.cookie.maxAge.summary': '受信からの生存時間（秒）。両方ある場合は Expires より優先されます。',
  'shared.info.cookie.maxAge.body': 'ゼロまたは負の値は Cookie を直ちに失効させます。削除の標準的な方法です。',
  'shared.info.cookie.secure.summary': 'Cookie は HTTPS 接続でのみ送信されます。',
  'shared.info.cookie.secure.body':
    'SameSite=None の Cookie には必須です。これがないとブラウザーはクロスサイト Cookie を拒否します。',
  'shared.info.cookie.httponly.summary':
    'Cookie はページの JavaScript（document.cookie）からは見えず、リクエストでのみ送信されます。',
  'shared.info.cookie.httponly.body': 'スクリプト注入によるセッション token の窃取に対する標準的な防御です。',
  'shared.info.cookie.samesite.summary':
    'Cookie がクロスサイトリクエストに乗るかどうかを制御します：Strict、Lax、None。',
  'shared.info.cookie.samesite.body':
    'Strict：同一サイトのみ。Lax（デフォルト）：加えてトップレベルのナビゲーション。None：どこでも。ただし Secure が必要です。',
  'shared.info.cookie.partitioned.summary':
    'Cookie をトップレベルサイトごとに保存します（CHIPS）。サイトをまたいで追跡できないサードパーティ Cookie です。',
  'shared.info.cookie.priority.summary':
    'Cookie ジャーが満杯になったときの Chromium 固有の削除優先度ヒント（Low / Medium / High）。',
} as const satisfies Catalog;
