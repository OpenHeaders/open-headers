/**
 * Workbench namespace — Romanian. Mirrors `catalogs/en/workbench.ts`
 * key for key (the settings-search strings).
 */

import type { Catalog } from '../../types';

export const workbench = {
  'workbench.settings.search.placeholder': 'Căutare în setări',
  'workbench.settings.search.filter.modified': 'Modificate',
} as const satisfies Catalog;
