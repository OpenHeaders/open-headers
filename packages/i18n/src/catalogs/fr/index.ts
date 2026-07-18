/**
 * French. Files mirror `catalogs/en/` one-to-one and land file by file;
 * keys not yet translated fall back to English per key at runtime
 * (`createTranslator`'s fallback catalog). The locale-lint gate
 * (`scripts/lint-locales.mjs`) holds every present file to the
 * translation laws.
 */

import type { Catalog } from '../../types';
import { popup } from './popup';
import { shared } from './shared';
import { sharedChrome } from './shared-chrome';
import { sharedComponents } from './shared-components';
import { sharedNotifications } from './shared-notifications';

export const fr = {
  ...shared,
  ...sharedChrome,
  ...sharedComponents,
  ...sharedNotifications,
  ...popup,
} as const satisfies Catalog;
