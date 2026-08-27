/**
 * Workbench namespace — French. Mirrors `catalogs/en/workbench.ts`
 * key for key; the `@modified` search operator rides raw.
 */

import type { Catalog } from '../../types';

export const workbench = {
  'workbench.settings.search.placeholder': 'Rechercher dans les paramètres',
  'workbench.settings.search.filter.modified': 'Modifiés',
} as const satisfies Catalog;
