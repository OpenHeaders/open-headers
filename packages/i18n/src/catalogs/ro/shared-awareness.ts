/**
 * Awareness family — Romanian. Mirrors `catalogs/en/shared-awareness.ts`
 * key for key; see that file for the viewer-side composition rules and
 * the raw plane (browser brand names, profile names, device-id
 * fragments, `labelContext` data). Mints: suprafață = surface (the
 * presence noun; încă {count} suprafață / suprafețe / de suprafețe);
 * Workbench / Popup / CLI / DevTools raw as surface names with a head
 * noun where prose needs one (panoul DevTools).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const sharedAwareness = {
  // ── Surface kinds (badge dots, chips, kind-only display labels) ────
  'shared.awareness.kind.workbench': 'Workbench',
  'shared.awareness.kind.popup': 'Popup',
  'shared.awareness.kind.devpanel': 'Panoul DevTools',
  'shared.awareness.kind.sidepanel': 'Panou lateral',

  // ── Display-label composition (viewer-side) ────────────────────────
  'shared.awareness.surface.devpanelContext': 'DevTools — {title}',

  // ── Popover grouping headers (presence tree levels) ────────────────
  'shared.awareness.group.local': 'Local',
  'shared.awareness.group.thisDevice': 'Acest dispozitiv',
  'shared.awareness.group.device': 'Dispozitivul {id}',
  'shared.awareness.group.browserWeb': '{browser} (web)',
  'shared.awareness.group.desktopApp': 'Aplicația desktop',
  'shared.awareness.group.web': 'Web',
  'shared.awareness.group.cli': 'CLI',
  'shared.awareness.group.thisBrowser': 'Acest browser',

  // ── Local-group hint chips ─────────────────────────────────────────
  'shared.awareness.hint.you': 'dvs.',
  'shared.awareness.hint.thisDevice': 'acest dispozitiv',
  'shared.awareness.hostTag.thisBrowser': 'acest browser',
  'shared.awareness.hostTag.thisApp': 'această aplicație',
  'shared.awareness.hostTag.thisTab': 'această filă',
  'shared.awareness.hostTag.thisSurface': 'această suprafață',

  // ── Popover peer rows ──────────────────────────────────────────────
  'shared.awareness.row.alreadyOnTab': 'Deja în această filă',
  'shared.awareness.row.switchToSurface': 'Comutare la această suprafață',
  'shared.awareness.row.notAddressable': 'Nu poate fi adresată ca peer',
  'shared.awareness.row.thisTab': 'această filă',

  // ── Entity-level badge ─────────────────────────────────────────────
  'shared.awareness.badge.otherSurfaces': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'încă {count} suprafață',
      few: 'încă {count} suprafețe',
      other: 'încă {count} de suprafețe',
    }),
  'shared.awareness.badge.editingEntityAria': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'încă {count} suprafață editează această entitate',
      few: 'încă {count} suprafețe editează această entitate',
      other: 'încă {count} de suprafețe editează această entitate',
    }),

  // ── Field-level chip ───────────────────────────────────────────────
  'shared.awareness.field.title': 'Editează acest câmp',
  'shared.awareness.field.editingAria': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'încă {count} suprafață editează acest câmp',
      few: 'încă {count} suprafețe editează acest câmp',
      other: 'încă {count} de suprafețe editează acest câmp',
    }),

  // ── Section-level badge ────────────────────────────────────────────
  'shared.awareness.section.title': 'Editează în această secțiune',
  'shared.awareness.section.editingAria': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'încă {count} suprafață editează în această secțiune',
      few: 'încă {count} suprafețe editează în această secțiune',
      other: 'încă {count} de suprafețe editează în această secțiune',
    }),
} as const satisfies Catalog;
