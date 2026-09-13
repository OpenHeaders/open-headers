/**
 * Workbench namespace — Russian. Mirrors `catalogs/en/workbench.ts`
 * key for key (the settings-search seed pair).
 */

import type { Catalog } from '../../types';

export const workbench = {
  'workbench.settings.search.placeholder': 'Поиск по настройкам',
  'workbench.settings.search.filter.modified': 'Изменённые',
} as const satisfies Catalog;
