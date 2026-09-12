/**
 * Workbench namespace — Korean. Mirrors `catalogs/en/workbench.ts`
 * key for key (the settings-search seed pair).
 */

import type { Catalog } from '../../types';

export const workbench = {
  'workbench.settings.search.placeholder': '설정 검색',
  'workbench.settings.search.filter.modified': '수정됨',
} as const satisfies Catalog;
