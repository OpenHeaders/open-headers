/**
 * Awareness family — German. Mirrors `catalogs/en/shared-awareness.ts`
 * key for key; browser brand names, profile names, device-id fragments
 * and `labelContext` data stay raw. Mints: Workbench kind label =
 * Arbeitsbereich-Editor (fr/es precedent); surface = Oberfläche (f.);
 * "other surface" counts read `{count} weitere Oberfläche(n)`.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const sharedAwareness = {
  // ── Surface kinds (badge dots, chips, kind-only display labels) ────
  'shared.awareness.kind.workbench': 'Arbeitsbereich-Editor',
  'shared.awareness.kind.popup': 'Popup',
  'shared.awareness.kind.devpanel': 'DevTools-Panel',
  'shared.awareness.kind.sidepanel': 'Seitenpanel',

  // ── Display-label composition (viewer-side) ────────────────────────
  'shared.awareness.surface.devpanelContext': 'DevTools — {title}',

  // ── Popover grouping headers (presence tree levels) ────────────────
  'shared.awareness.group.local': 'Lokal',
  'shared.awareness.group.thisDevice': 'Dieses Gerät',
  'shared.awareness.group.device': 'Gerät {id}',
  'shared.awareness.group.browserWeb': '{browser} (Web)',
  'shared.awareness.group.desktopApp': 'Desktop-App',
  'shared.awareness.group.web': 'Web',
  'shared.awareness.group.cli': 'CLI',
  'shared.awareness.group.thisBrowser': 'Dieser Browser',

  // ── Local-group hint chips ─────────────────────────────────────────
  'shared.awareness.hint.you': 'du',
  'shared.awareness.hint.thisDevice': 'dieses Gerät',
  'shared.awareness.hostTag.thisBrowser': 'dieser Browser',
  'shared.awareness.hostTag.thisApp': 'diese App',
  'shared.awareness.hostTag.thisTab': 'dieser Tab',
  'shared.awareness.hostTag.thisSurface': 'diese Oberfläche',

  // ── Popover peer rows ──────────────────────────────────────────────
  'shared.awareness.row.alreadyOnTab': 'Bereits auf diesem Tab',
  'shared.awareness.row.switchToSurface': 'Zu dieser Oberfläche wechseln',
  'shared.awareness.row.notAddressable': 'Nicht peer-adressierbar',
  'shared.awareness.row.thisTab': 'dieser Tab',

  // ── Entity-level badge ─────────────────────────────────────────────
  'shared.awareness.badge.otherSurfaces': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} weitere Oberfläche', other: '{count} weitere Oberflächen' }),
  'shared.awareness.badge.editingEntityAria': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} weitere Oberfläche bearbeitet dieses Element',
      other: '{count} weitere Oberflächen bearbeiten dieses Element',
    }),

  // ── Field-level chip ───────────────────────────────────────────────
  'shared.awareness.field.title': 'Bearbeitet dieses Feld',
  'shared.awareness.field.editingAria': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} weitere Oberfläche bearbeitet dieses Feld',
      other: '{count} weitere Oberflächen bearbeiten dieses Feld',
    }),

  // ── Section-level badge ────────────────────────────────────────────
  'shared.awareness.section.title': 'Bearbeitung in diesem Abschnitt',
  'shared.awareness.section.editingAria': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} weitere Oberfläche bearbeitet in diesem Abschnitt',
      other: '{count} weitere Oberflächen bearbeiten in diesem Abschnitt',
    }),
} as const satisfies Catalog;
