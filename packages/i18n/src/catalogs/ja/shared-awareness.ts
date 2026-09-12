/**
 * Awareness family — Japanese. Mirrors `catalogs/en/shared-awareness.ts`
 * key for key; see that file for the viewer-side composition contract
 * and the raw plane (browser brands, profile names, device-id
 * fragments, `labelContext`). Mints: 画面 = surface; デバイス = device;
 * ワークベンチ = Workbench (shared mint).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const sharedAwareness = {
  // ── Surface kinds (badge dots, chips, kind-only display labels) ────
  'shared.awareness.kind.workbench': 'ワークベンチ',
  'shared.awareness.kind.popup': 'ポップアップ',
  'shared.awareness.kind.devpanel': 'DevTools パネル',
  'shared.awareness.kind.sidepanel': 'サイドパネル',

  // ── Display-label composition (viewer-side) ────────────────────────
  'shared.awareness.surface.devpanelContext': 'DevTools — {title}',

  // ── Popover grouping headers (presence tree levels) ────────────────
  'shared.awareness.group.local': 'ローカル',
  'shared.awareness.group.thisDevice': 'このデバイス',
  'shared.awareness.group.device': 'デバイス {id}',
  'shared.awareness.group.browserWeb': '{browser}（Web）',
  'shared.awareness.group.desktopApp': 'デスクトップアプリ',
  'shared.awareness.group.web': 'Web',
  'shared.awareness.group.cli': 'CLI',
  'shared.awareness.group.thisBrowser': 'このブラウザー',

  // ── Local-group hint chips ─────────────────────────────────────────
  'shared.awareness.hint.you': 'あなた',
  'shared.awareness.hint.thisDevice': 'このデバイス',
  'shared.awareness.hostTag.thisBrowser': 'このブラウザー',
  'shared.awareness.hostTag.thisApp': 'このアプリ',
  'shared.awareness.hostTag.thisTab': 'このタブ',
  'shared.awareness.hostTag.thisSurface': 'この画面',

  // ── Popover peer rows ──────────────────────────────────────────────
  'shared.awareness.row.alreadyOnTab': 'すでにこのタブにいます',
  'shared.awareness.row.switchToSurface': 'この画面に切り替える',
  'shared.awareness.row.notAddressable': 'ピアとしてアドレス指定できません',
  'shared.awareness.row.thisTab': 'このタブ',

  // ── Entity-level badge ─────────────────────────────────────────────
  'shared.awareness.badge.otherSurfaces': ({ count }, locale) =>
    plural(locale, Number(count), { other: '他 {count} 画面' }),
  'shared.awareness.badge.editingEntityAria': ({ count }, locale) =>
    plural(locale, Number(count), { other: '他 {count} 画面がこのエンティティを編集中' }),

  // ── Field-level chip ───────────────────────────────────────────────
  'shared.awareness.field.title': 'このフィールドを編集中',
  'shared.awareness.field.editingAria': ({ count }, locale) =>
    plural(locale, Number(count), { other: '他 {count} 画面がこのフィールドを編集中' }),

  // ── Section-level badge ────────────────────────────────────────────
  'shared.awareness.section.title': 'このセクションを編集中',
  'shared.awareness.section.editingAria': ({ count }, locale) =>
    plural(locale, Number(count), { other: '他 {count} 画面がこのセクションを編集中' }),
} as const satisfies Catalog;
