/**
 * Shared namespace — Japanese. Mirrors `catalogs/en/shared.ts` key for
 * key; see that file for the namespace rules. Register contract for the
 * ja catalogs (pattern-setter): polite です・ます in every sentence
 * (never plain だ・である); labels, buttons and menu rows are bare
 * nouns or dictionary-form verbs (保存, 閉じる), never imperatives;
 * requests to the user read ～してください. Full-width punctuation
 * 、。：？！（） in prose; the en aside dash restructures into 。or ：
 * and, where kept, renders as an unspaced full-width —; half-width
 * punctuation stays inside code/wire fragments and raw tokens; a
 * half-width space separates Latin/digit tokens from Japanese text
 * (zh-CN law carries); UI labels quoted in prose use 「」 (en's “” and
 * "" alike); JSON-wire quotes stay ASCII. Katakana loanwords for dev
 * nouns with the JIS long-vowel mark kept (サーバー, ヘッダー, ブラウザー,
 * ユーザー, エディター, フォルダー — never サーバ); en's unspaced
 * `{percent}%` figure style kept. Plurals are `other`-only (CLDR ja);
 * counters mint per noun — 件 for rules. Dev nouns retain English
 * liberally: the glossary raw-token laws carry over unchanged
 * (WebSocket, URL, token lowercase raw). Mints: ワークスペース =
 * workspace; バックエンド = back-end; ハンドシェイク = handshake;
 * ペアリング = pair; 切り替え = Switch; 設定 = Settings; ポップアップ =
 * popup; プローブ = probe; デスクトップアプリ = desktop app.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const shared = {
  'shared.action.save': '保存',
  'shared.action.cancel': 'キャンセル',
  'shared.action.close': '閉じる',
  'shared.action.copy': 'コピー',
  'shared.action.remove': '削除',
  'shared.toast.copiedToClipboard': 'クリップボードにコピーしました',
  'shared.toast.copyFailed': 'クリップボードへのアクセスが拒否されました。値を手動でコピーしてください',
  'shared.count.rules': ({ count }, locale) => plural(locale, Number(count), { other: '{count} 件のルール' }),

  // ── Top-level error boundary ─────────────────────────────────────────
  'shared.errorBoundary.title': '問題が発生しました',
  'shared.errorBoundary.subtitle': 'ポップアップの読み込み中にエラーが発生しました。閉じてから開き直してください。',
  'shared.errorBoundary.reload': '再読み込み',

  // ── Invalidated-context notice (DevTools panel orphan watch) ────────
  'shared.contextInvalidated.title': 'Open Headers が更新または再読み込みされました',
  'shared.contextInvalidated.body': '続行するには DevTools を閉じてから開き直してください。',

  // ── Connection-probe notices ─────────────────────────────────────────
  'shared.probe.connectionOk': '接続 OK',
  'shared.probe.reachableDescription': '{label} に到達できます。',
  'shared.probe.notReachable': '到達できません',
  'shared.probe.title.authRequired': '到達できますが、認証が必要です',
  'shared.probe.title.workspaceUnknown': '到達できますが、ワークスペースが共有されていません',
  'shared.probe.title.versionMismatch': '到達できますが、バージョンが一致しません',
  'shared.probe.title.notReady': '到達できますが、まだ準備ができていません',
  'shared.probe.fail.invalidUrl': 'URL が無効です。',
  'shared.probe.fail.invalidUrlDetail': 'URL が無効です。{detail}',
  'shared.probe.fail.timeout': '応答待ちがタイムアウトしました。バックエンドは起動していますか？',
  'shared.probe.fail.closedBeforeWelcome':
    'ハンドシェイクの前に接続が閉じられました。そのポートでバックエンドが起動していない可能性があります。',
  'shared.probe.fail.openFailed': 'WebSocket を開けませんでした。',
  'shared.probe.fail.openFailedDetail': 'WebSocket を開けませんでした：{detail}。',
  'shared.probe.fail.protocolMismatch':
    '到達できますが、プロトコルのバージョンに互換性がありません。両方のアプリを更新してください。',
  'shared.probe.fail.workspaceUnknown':
    '到達できます。バックエンドは起動していますが、このワークスペースはまだ共有されていません。切り替えると両者がペアリングされます。',
  'shared.probe.fail.protocolTooOld':
    '到達できますが、このアプリはバックエンドより古いバージョンです。こちら側を更新してください。',
  'shared.probe.fail.protocolTooNew':
    '到達できますが、バックエンドはこのアプリより古いバージョンです。バックエンドを更新してください。',
  'shared.probe.fail.authRequired':
    '到達できますが、このデバイスはまだ認証されていません。コードでペアリングするか、上に token を貼り付けてから「切り替え」を押してください。',
  'shared.probe.fail.rejected': '拒否されました：{reason}',
  'shared.probe.fail.rejectedUnknown': '拒否されました：理由は不明です',
  'shared.probe.fail.malformedWelcome': 'サーバーには到達しましたが、Open Headers プロトコルを話しません。',
  'shared.probe.fail.generic': 'プローブに失敗しました。',
} as const satisfies Catalog;
