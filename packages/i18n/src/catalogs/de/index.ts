/**
 * German. Files mirror `catalogs/en/` one-to-one and land file by
 * file; keys not yet translated fall back to English per key at
 * runtime (`createTranslator`'s fallback catalog). The locale-lint
 * gate (`scripts/lint-locales.mjs`) holds every present file to the
 * translation laws. The de register contract lives in `shared.ts`.
 */

import type { Catalog } from '../../types';
import { desktop } from './desktop';
import { extension } from './extension';
import { shared } from './shared';
import { sharedAwareness } from './shared-awareness';
import { sharedHeaderValidation } from './shared-header-validation';
import { sharedInfoCookies } from './shared-info-cookies';
import { sharedNotifications } from './shared-notifications';
import { sharedResolutionHints } from './shared-resolution-hints';
import { sharedWorkspace } from './shared-workspace';
import { web } from './web';

export const de = {
  ...desktop,
  ...extension,
  ...shared,
  ...sharedAwareness,
  ...sharedHeaderValidation,
  ...sharedInfoCookies,
  ...sharedNotifications,
  ...sharedResolutionHints,
  ...sharedWorkspace,
  ...web,
} as const satisfies Catalog;
