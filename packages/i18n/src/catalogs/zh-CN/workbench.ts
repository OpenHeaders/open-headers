/**
 * Workbench namespace — Simplified Chinese. Mirrors
 * `catalogs/en/workbench.ts` key for key; the `@modified` search
 * operator rides raw. Settings-tab word = 设置 per the shared mint.
 */

import type { Catalog } from '../../types';

export const workbench = {
  'workbench.settings.search.placeholder': '搜索设置（试试 @modified）',
  'workbench.settings.search.filter.modified': '已修改',
  'workbench.settings.search.filter.experimental': '实验性',
} as const satisfies Catalog;
