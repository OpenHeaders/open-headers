/**
 * Simplified Chinese catalog — assembled file by file as translation
 * lands (the per-key English fallback covers the rest). The register
 * contract lives in `shared.ts`'s header.
 */

import type { Catalog } from '../../types';
import { shared } from './shared';

export const zhCN = {
  ...shared,
} as const satisfies Catalog;
