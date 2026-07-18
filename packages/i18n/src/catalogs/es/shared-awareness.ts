/**
 * Awareness family — Spanish. Mirrors `catalogs/en/shared-awareness.ts`
 * key for key; browser brand names, profile names, device-id fragments
 * and `labelContext` data stay raw. Mints: Workbench kind label =
 * Editor del espacio de trabajo (fr precedent); surface = superficie;
 * "other surface" counts read `{count} superficie más`.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const sharedAwareness = {
  // ── Surface kinds (badge dots, chips, kind-only display labels) ────
  'shared.awareness.kind.workbench': 'Editor del espacio de trabajo',
  'shared.awareness.kind.popup': 'Popup',
  'shared.awareness.kind.devpanel': 'Panel de DevTools',
  'shared.awareness.kind.sidepanel': 'Panel lateral',

  // ── Display-label composition (viewer-side) ────────────────────────
  'shared.awareness.surface.devpanelContext': 'DevTools — {title}',

  // ── Popover grouping headers (presence tree levels) ────────────────
  'shared.awareness.group.local': 'Local',
  'shared.awareness.group.thisDevice': 'Este dispositivo',
  'shared.awareness.group.device': 'Dispositivo {id}',
  'shared.awareness.group.browserWeb': '{browser} (web)',
  'shared.awareness.group.desktopApp': 'Aplicación de escritorio',
  'shared.awareness.group.web': 'Web',
  'shared.awareness.group.cli': 'CLI',
  'shared.awareness.group.thisBrowser': 'Este navegador',

  // ── Local-group hint chips ─────────────────────────────────────────
  'shared.awareness.hint.you': 'tú',
  'shared.awareness.hint.thisDevice': 'este dispositivo',
  'shared.awareness.hostTag.thisBrowser': 'este navegador',
  'shared.awareness.hostTag.thisApp': 'esta aplicación',
  'shared.awareness.hostTag.thisTab': 'esta pestaña',
  'shared.awareness.hostTag.thisSurface': 'esta superficie',

  // ── Popover peer rows ──────────────────────────────────────────────
  'shared.awareness.row.alreadyOnTab': 'Ya en esta pestaña',
  'shared.awareness.row.switchToSurface': 'Cambiar a esta superficie',
  'shared.awareness.row.notAddressable': 'No direccionable entre pares',
  'shared.awareness.row.thisTab': 'esta pestaña',

  // ── Entity-level badge ─────────────────────────────────────────────
  'shared.awareness.badge.otherSurfaces': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} superficie más',
      many: '{count} superficies más',
      other: '{count} superficies más',
    }),
  'shared.awareness.badge.editingEntityAria': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} superficie más edita esta entidad',
      many: '{count} superficies más editan esta entidad',
      other: '{count} superficies más editan esta entidad',
    }),

  // ── Field-level chip ───────────────────────────────────────────────
  'shared.awareness.field.title': 'Editando este campo',
  'shared.awareness.field.editingAria': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} superficie más edita este campo',
      many: '{count} superficies más editan este campo',
      other: '{count} superficies más editan este campo',
    }),

  // ── Section-level badge ────────────────────────────────────────────
  'shared.awareness.section.title': 'Editando en esta sección',
  'shared.awareness.section.editingAria': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} superficie más edita en esta sección',
      many: '{count} superficies más editan en esta sección',
      other: '{count} superficies más editan en esta sección',
    }),
} as const satisfies Catalog;
