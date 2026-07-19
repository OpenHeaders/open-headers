/**
 * Workbench namespace — German. Mirrors `catalogs/en/workbench.ts`
 * key for key; the `@modified` search operator rides raw. Settings =
 * Einstellungen (de mint, S58 law).
 */

import type { Catalog } from '../../types';

export const workbench = {
  'workbench.settings.search.placeholder': 'Einstellungen durchsuchen (probiere @modified)',
  'workbench.settings.search.filter.modified': 'Geändert',
  'workbench.settings.search.filter.experimental': 'Experimentell',
} as const satisfies Catalog;
