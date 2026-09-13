/**
 * Awareness family — Russian. Mirrors `catalogs/en/shared-awareness.ts`
 * key for key; browser brand names, profile names, device-id
 * fragments, `labelContext` data and relative times ride raw. Mints:
 * поверхность = surface (the presence noun); пир = peer; устройство =
 * device; the `DevTools — {title}` label separator is structural and
 * keeps its dash. Plurals one / few / many / other on поверхность
 * (ещё {count} поверхность / поверхности / поверхностей).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const sharedAwareness = {
  // ── Surface kinds (badge dots, chips, kind-only display labels) ────
  'shared.awareness.kind.workbench': 'Рабочая среда',
  'shared.awareness.kind.popup': 'Всплывающее окно',
  'shared.awareness.kind.devpanel': 'Панель DevTools',
  'shared.awareness.kind.sidepanel': 'Боковая панель',

  // ── Display-label composition (viewer-side) ────────────────────────
  'shared.awareness.surface.devpanelContext': 'DevTools — {title}',

  // ── Popover grouping headers (presence tree levels) ────────────────
  'shared.awareness.group.local': 'Локально',
  'shared.awareness.group.thisDevice': 'Это устройство',
  'shared.awareness.group.device': 'Устройство {id}',
  'shared.awareness.group.browserWeb': '{browser} (веб)',
  'shared.awareness.group.desktopApp': 'Настольное приложение',
  'shared.awareness.group.web': 'Веб',
  'shared.awareness.group.cli': 'CLI',
  'shared.awareness.group.thisBrowser': 'Этот браузер',

  // ── Local-group hint chips ─────────────────────────────────────────
  'shared.awareness.hint.you': 'вы',
  'shared.awareness.hint.thisDevice': 'это устройство',
  'shared.awareness.hostTag.thisBrowser': 'этот браузер',
  'shared.awareness.hostTag.thisApp': 'это приложение',
  'shared.awareness.hostTag.thisTab': 'эта вкладка',
  'shared.awareness.hostTag.thisSurface': 'эта поверхность',

  // ── Popover peer rows ──────────────────────────────────────────────
  'shared.awareness.row.alreadyOnTab': 'Уже на этой вкладке',
  'shared.awareness.row.switchToSurface': 'Перейти на эту поверхность',
  'shared.awareness.row.notAddressable': 'Недоступна для адресации между пирами',
  'shared.awareness.row.thisTab': 'эта вкладка',

  // ── Entity-level badge ─────────────────────────────────────────────
  'shared.awareness.badge.otherSurfaces': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'ещё {count} поверхность',
      few: 'ещё {count} поверхности',
      many: 'ещё {count} поверхностей',
      other: 'ещё {count} поверхностей',
    }),
  'shared.awareness.badge.editingEntityAria': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'ещё {count} поверхность редактирует эту сущность',
      few: 'ещё {count} поверхности редактируют эту сущность',
      many: 'ещё {count} поверхностей редактируют эту сущность',
      other: 'ещё {count} поверхностей редактируют эту сущность',
    }),

  // ── Field-level chip ───────────────────────────────────────────────
  'shared.awareness.field.title': 'Редактирует это поле',
  'shared.awareness.field.editingAria': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'ещё {count} поверхность редактирует это поле',
      few: 'ещё {count} поверхности редактируют это поле',
      many: 'ещё {count} поверхностей редактируют это поле',
      other: 'ещё {count} поверхностей редактируют это поле',
    }),

  // ── Section-level badge ────────────────────────────────────────────
  'shared.awareness.section.title': 'Редактирует в этом разделе',
  'shared.awareness.section.editingAria': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'ещё {count} поверхность редактирует в этом разделе',
      few: 'ещё {count} поверхности редактируют в этом разделе',
      many: 'ещё {count} поверхностей редактируют в этом разделе',
      other: 'ещё {count} поверхностей редактируют в этом разделе',
    }),
} as const satisfies Catalog;
