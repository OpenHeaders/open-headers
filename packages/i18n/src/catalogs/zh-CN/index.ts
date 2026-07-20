/**
 * Simplified Chinese catalog — assembled file by file as translation
 * lands (the per-key English fallback covers the rest). The register
 * contract lives in `shared.ts`'s header.
 */

import type { Catalog } from '../../types';
import { shared } from './shared';
import { sharedAwareness } from './shared-awareness';
import { sharedChrome } from './shared-chrome';
import { sharedHeaderValidation } from './shared-header-validation';
import { sharedInfoCookies } from './shared-info-cookies';
import { sharedInfoStatus } from './shared-info-status';
import { sharedNotifications } from './shared-notifications';
import { sharedResolutionHints } from './shared-resolution-hints';
import { sharedWorkspace } from './shared-workspace';

export const zhCN = {
  ...shared,
  ...sharedAwareness,
  ...sharedChrome,
  ...sharedHeaderValidation,
  ...sharedInfoCookies,
  ...sharedInfoStatus,
  ...sharedNotifications,
  ...sharedResolutionHints,
  ...sharedWorkspace,
} as const satisfies Catalog;
