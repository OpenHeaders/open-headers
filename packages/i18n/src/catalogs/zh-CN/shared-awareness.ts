/**
 * Awareness family — Simplified Chinese. Mirrors
 * `catalogs/en/shared-awareness.ts` key for key; browser brand names,
 * profile names, device-id fragments and `labelContext` data stay raw.
 * Mints: 界面 = surface（个 as its measure word — counts read
 * {count} 个其他界面）; Workbench kind label = 工作区编辑器 (fr/es
 * precedent); 标签页 = tab (Chrome zh-CN vocabulary); 侧边栏 = side
 * panel (Chrome vocabulary); 实体 = entity; 字段 = field; 区域 =
 * section; 对等 = peer (adjectival).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const sharedAwareness = {
  // ── Surface kinds (badge dots, chips, kind-only display labels) ────
  'shared.awareness.kind.workbench': '工作区编辑器',
  'shared.awareness.kind.popup': '弹窗',
  'shared.awareness.kind.devpanel': 'DevTools 面板',
  'shared.awareness.kind.sidepanel': '侧边栏',

  // ── Display-label composition (viewer-side) ────────────────────────
  'shared.awareness.surface.devpanelContext': 'DevTools — {title}',

  // ── Popover grouping headers (presence tree levels) ────────────────
  'shared.awareness.group.local': '本地',
  'shared.awareness.group.thisDevice': '此设备',
  'shared.awareness.group.device': '设备 {id}',
  'shared.awareness.group.browserWeb': '{browser} (Web)',
  'shared.awareness.group.desktopApp': '桌面应用',
  'shared.awareness.group.web': 'Web',
  'shared.awareness.group.cli': 'CLI',
  'shared.awareness.group.thisBrowser': '此浏览器',

  // ── Local-group hint chips ─────────────────────────────────────────
  'shared.awareness.hint.you': '你',
  'shared.awareness.hint.thisDevice': '此设备',
  'shared.awareness.hostTag.thisBrowser': '此浏览器',
  'shared.awareness.hostTag.thisApp': '此应用',
  'shared.awareness.hostTag.thisTab': '此标签页',
  'shared.awareness.hostTag.thisSurface': '此界面',

  // ── Popover peer rows ──────────────────────────────────────────────
  'shared.awareness.row.alreadyOnTab': '已在此标签页',
  'shared.awareness.row.switchToSurface': '切换到此界面',
  'shared.awareness.row.notAddressable': '不可对等寻址',
  'shared.awareness.row.thisTab': '此标签页',

  // ── Entity-level badge ─────────────────────────────────────────────
  'shared.awareness.badge.otherSurfaces': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个其他界面' }),
  'shared.awareness.badge.editingEntityAria': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个其他界面正在编辑此实体' }),

  // ── Field-level chip ───────────────────────────────────────────────
  'shared.awareness.field.title': '正在编辑此字段',
  'shared.awareness.field.editingAria': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个其他界面正在编辑此字段' }),

  // ── Section-level badge ────────────────────────────────────────────
  'shared.awareness.section.title': '正在编辑此区域',
  'shared.awareness.section.editingAria': ({ count }, locale) =>
    plural(locale, Number(count), { other: '{count} 个其他界面正在此区域中编辑' }),
} as const satisfies Catalog;
