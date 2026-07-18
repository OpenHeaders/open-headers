/**
 * Awareness family — French. Mirrors `catalogs/en/shared-awareness.ts`
 * key for key; browser brand names, profile names, device-id fragments
 * and `labelContext` data stay raw.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const sharedAwareness = {
  // ── Surface kinds (badge dots, chips, kind-only display labels) ────
  'shared.awareness.kind.workbench': "Éditeur d'espace de travail",
  'shared.awareness.kind.popup': 'Popup',
  'shared.awareness.kind.devpanel': 'Panneau DevTools',
  'shared.awareness.kind.sidepanel': 'Panneau latéral',

  // ── Display-label composition (viewer-side) ────────────────────────
  'shared.awareness.surface.devpanelContext': 'DevTools — {title}',

  // ── Popover grouping headers (presence tree levels) ────────────────
  'shared.awareness.group.local': 'Local',
  'shared.awareness.group.thisDevice': 'Cet appareil',
  'shared.awareness.group.device': 'Appareil {id}',
  'shared.awareness.group.browserWeb': '{browser} (web)',
  'shared.awareness.group.desktopApp': 'Application de bureau',
  'shared.awareness.group.web': 'Web',
  'shared.awareness.group.cli': 'CLI',
  'shared.awareness.group.thisBrowser': 'Ce navigateur',

  // ── Local-group hint chips ─────────────────────────────────────────
  'shared.awareness.hint.you': 'vous',
  'shared.awareness.hint.thisDevice': 'cet appareil',
  'shared.awareness.hostTag.thisBrowser': 'ce navigateur',
  'shared.awareness.hostTag.thisApp': 'cette application',
  'shared.awareness.hostTag.thisTab': 'cet onglet',
  'shared.awareness.hostTag.thisSurface': 'cette surface',

  // ── Popover peer rows ──────────────────────────────────────────────
  'shared.awareness.row.alreadyOnTab': 'Déjà sur cet onglet',
  'shared.awareness.row.switchToSurface': 'Passer à cette surface',
  'shared.awareness.row.notAddressable': 'Non adressable entre pairs',
  'shared.awareness.row.thisTab': 'cet onglet',

  // ── Entity-level badge ─────────────────────────────────────────────
  'shared.awareness.badge.otherSurfaces': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} autre surface',
      many: '{count} autres surfaces',
      other: '{count} autres surfaces',
    }),
  'shared.awareness.badge.editingEntityAria': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} autre surface modifie cette entité',
      many: '{count} autres surfaces modifient cette entité',
      other: '{count} autres surfaces modifient cette entité',
    }),

  // ── Field-level chip ───────────────────────────────────────────────
  'shared.awareness.field.title': 'Modification de ce champ en cours',
  'shared.awareness.field.editingAria': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} autre surface modifie ce champ',
      many: '{count} autres surfaces modifient ce champ',
      other: '{count} autres surfaces modifient ce champ',
    }),

  // ── Section-level badge ────────────────────────────────────────────
  'shared.awareness.section.title': 'Modification dans cette section en cours',
  'shared.awareness.section.editingAria': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} autre surface modifie dans cette section',
      many: '{count} autres surfaces modifient dans cette section',
      other: '{count} autres surfaces modifient dans cette section',
    }),
} as const satisfies Catalog;
