/**
 * Workbench namespace. Phase A seeds only the settings-search strings
 * (the pattern-proof migration); the rest of the surface extracts in
 * Phase C.
 */

import type { Catalog } from '../../types';

export const workbench = {
  'workbench.settings.search.placeholder': 'Search settings',
  'workbench.settings.search.filter.modified': 'Modified',
} as const satisfies Catalog;
