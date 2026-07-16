/**
 * Awareness family — presence pills/badges/chips and their grouping
 * labels (`packages/ui/src/shared/awareness/`). Surface display labels
 * are composed viewer-side: the wire carries a structured
 * `surfaceKind` plus a raw `labelContext` (tab title / inspected-page
 * title / hostname), and viewers render the kind through these keys so
 * peers appear in the viewer's locale, never the author's.
 *
 * Raw by design inside keyed values: browser brand names (Chrome,
 * Firefox, …), profile names, device-id fragments, user ids,
 * `labelContext` data (tab titles, hostnames), and relative times
 * (`format-ago` rides with Phase I).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const sharedAwareness = {
  // ── Surface kinds (badge dots, chips, kind-only display labels) ────
  'shared.awareness.kind.workbench': 'Workbench',
  'shared.awareness.kind.popup': 'Popup',
  'shared.awareness.kind.devpanel': 'DevTools panel',
  'shared.awareness.kind.sidepanel': 'Side panel',

  // ── Display-label composition (viewer-side) ────────────────────────
  'shared.awareness.surface.devpanelContext': 'DevTools — {title}',

  // ── Popover grouping headers (presence tree levels) ────────────────
  'shared.awareness.group.local': 'Local',
  'shared.awareness.group.thisDevice': 'This device',
  'shared.awareness.group.device': 'Device {id}',
  'shared.awareness.group.browserWeb': '{browser} (web)',
  'shared.awareness.group.desktopApp': 'Desktop app',
  'shared.awareness.group.web': 'Web',
  'shared.awareness.group.cli': 'CLI',
  'shared.awareness.group.thisBrowser': 'This browser',

  // ── Local-group hint chips ─────────────────────────────────────────
  'shared.awareness.hint.you': 'you',
  'shared.awareness.hint.thisDevice': 'this device',
  'shared.awareness.hostTag.thisBrowser': 'this browser',
  'shared.awareness.hostTag.thisApp': 'this app',
  'shared.awareness.hostTag.thisTab': 'this tab',
  'shared.awareness.hostTag.thisSurface': 'this surface',

  // ── Popover peer rows ──────────────────────────────────────────────
  'shared.awareness.row.alreadyOnTab': 'Already on this tab',
  'shared.awareness.row.switchToSurface': 'Switch to this surface',
  'shared.awareness.row.notAddressable': 'Not peer-addressable',
  'shared.awareness.row.thisTab': 'this tab',

  // ── Entity-level badge ─────────────────────────────────────────────
  'shared.awareness.badge.otherSurfaces': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} other surface', other: '{count} other surfaces' }),
  'shared.awareness.badge.editingEntityAria': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} other surface editing this entity',
      other: '{count} other surfaces editing this entity',
    }),

  // ── Field-level chip ───────────────────────────────────────────────
  'shared.awareness.field.title': 'Editing this field',
  'shared.awareness.field.editingAria': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} other surface editing this field',
      other: '{count} other surfaces editing this field',
    }),

  // ── Section-level badge ────────────────────────────────────────────
  'shared.awareness.section.title': 'Editing in this section',
  'shared.awareness.section.editingAria': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} other surface editing in this section',
      other: '{count} other surfaces editing in this section',
    }),
} as const satisfies Catalog;
