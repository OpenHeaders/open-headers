/**
 * Workbench namespace. Phase A seeds only the settings-search strings
 * (the pattern-proof migration); the rest of the surface extracts in
 * Phase C.
 */

import type { Catalog } from '../../types';

export const workbench = {
  'workbench.settings.search.placeholder': 'Search settings (try @modified)',
  'workbench.settings.search.filter.modified': 'Modified',
  'workbench.settings.search.filter.experimental': 'Experimental',
} as const satisfies Catalog;
