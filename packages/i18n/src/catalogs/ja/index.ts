/**
 * Japanese catalog — assembled file by file as translation lands (the
 * per-key English fallback covers the rest). The register contract
 * lives in `shared.ts`'s header.
 */

import type { Catalog } from '../../types';
import { extension } from './extension';
import { shared } from './shared';
import { sharedComponents } from './shared-components';

export const ja: Catalog = {
  ...extension,
  ...shared,
  ...sharedComponents,
};
