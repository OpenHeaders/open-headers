/**
 * Awareness family — Korean. Mirrors `catalogs/en/shared-awareness.ts`
 * key for key; browser brand names, profile names, device-id
 * fragments, `labelContext` data and relative times ride raw. Mints:
 * 화면 = surface (the presence noun, as ja 画面); 피어 = peer; 기기 =
 * device; the `DevTools — {title}` label separator is structural and
 * keeps its dash (not an aside).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const sharedAwareness = {
  // ── Surface kinds ──────────────────────────────────────────────────
  'shared.awareness.kind.workbench': '워크벤치',
  'shared.awareness.kind.popup': '팝업',
  'shared.awareness.kind.devpanel': 'DevTools 패널',
  'shared.awareness.kind.sidepanel': '사이드 패널',

  // ── Display-label composition (viewer-side) ────────────────────────
  'shared.awareness.surface.devpanelContext': 'DevTools — {title}',

  // ── Popover grouping headers ───────────────────────────────────────
  'shared.awareness.group.local': '로컬',
  'shared.awareness.group.thisDevice': '이 기기',
  'shared.awareness.group.device': '기기 {id}',
  'shared.awareness.group.browserWeb': '{browser} (웹)',
  'shared.awareness.group.desktopApp': '데스크톱 앱',
  'shared.awareness.group.web': '웹',
  'shared.awareness.group.cli': 'CLI',
  'shared.awareness.group.thisBrowser': '이 브라우저',

  // ── Local-group hint chips ─────────────────────────────────────────
  'shared.awareness.hint.you': '나',
  'shared.awareness.hint.thisDevice': '이 기기',
  'shared.awareness.hostTag.thisBrowser': '이 브라우저',
  'shared.awareness.hostTag.thisApp': '이 앱',
  'shared.awareness.hostTag.thisTab': '이 탭',
  'shared.awareness.hostTag.thisSurface': '이 화면',

  // ── Popover peer rows ──────────────────────────────────────────────
  'shared.awareness.row.alreadyOnTab': '이미 이 탭에 있습니다',
  'shared.awareness.row.switchToSurface': '이 화면으로 전환',
  'shared.awareness.row.notAddressable': '피어 주소 지정 불가',
  'shared.awareness.row.thisTab': '이 탭',

  // ── Entity-level badge ─────────────────────────────────────────────
  'shared.awareness.badge.otherSurfaces': ({ count }, locale) =>
    plural(locale, Number(count), { other: '다른 화면 {count}개' }),
  'shared.awareness.badge.editingEntityAria': ({ count }, locale) =>
    plural(locale, Number(count), { other: '이 항목을 편집 중인 다른 화면 {count}개' }),

  // ── Field-level chip ───────────────────────────────────────────────
  'shared.awareness.field.title': '이 필드 편집 중',
  'shared.awareness.field.editingAria': ({ count }, locale) =>
    plural(locale, Number(count), { other: '이 필드를 편집 중인 다른 화면 {count}개' }),

  // ── Section-level badge ────────────────────────────────────────────
  'shared.awareness.section.title': '이 섹션에서 편집 중',
  'shared.awareness.section.editingAria': ({ count }, locale) =>
    plural(locale, Number(count), { other: '이 섹션에서 편집 중인 다른 화면 {count}개' }),
} as const satisfies Catalog;
