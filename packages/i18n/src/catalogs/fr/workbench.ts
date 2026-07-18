/**
 * Workbench namespace — French. Mirrors `catalogs/en/workbench.ts`
 * key for key; the `@modified` search operator rides raw.
 */

import type { Catalog } from '../../types';

export const workbench = {
  'workbench.settings.search.placeholder': 'Rechercher dans les paramètres (essayez @modified)',
  'workbench.settings.search.filter.modified': 'Modifiés',
  'workbench.settings.search.filter.experimental': 'Expérimentaux',
} as const satisfies Catalog;
