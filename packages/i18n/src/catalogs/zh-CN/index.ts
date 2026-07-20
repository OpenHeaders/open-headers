/**
 * Simplified Chinese catalog — assembled file by file as translation
 * lands (the per-key English fallback covers the rest). The register
 * contract lives in `shared.ts`'s header.
 */

import type { Catalog } from '../../types';
import { shared } from './shared';
import { sharedHeaderValidation } from './shared-header-validation';
import { sharedInfoCookies } from './shared-info-cookies';
import { sharedResolutionHints } from './shared-resolution-hints';

export const zhCN = {
  ...shared,
  ...sharedHeaderValidation,
  ...sharedInfoCookies,
  ...sharedResolutionHints,
} as const satisfies Catalog;
