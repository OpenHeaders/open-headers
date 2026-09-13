/**
 * Russian catalog — assembled file by file as translation lands (the
 * per-key English fallback covers the rest). The register contract
 * lives in `shared.ts`'s header.
 */

import type { Catalog } from '../../types';
import { desktop } from './desktop';
import { extension } from './extension';
import { shared } from './shared';
import { sharedAwareness } from './shared-awareness';
import { sharedComponents } from './shared-components';
import { sharedHeaderValidation } from './shared-header-validation';
import { sharedInfoCookies } from './shared-info-cookies';
import { sharedNotifications } from './shared-notifications';
import { sharedResolutionHints } from './shared-resolution-hints';
import { sharedWorkspace } from './shared-workspace';
import { workbench } from './workbench';
import { workbenchScriptPackages } from './workbench-script-packages';
import { workbenchTrustedRoots } from './workbench-trusted-roots';

export const ru: Catalog = {
  ...desktop,
  ...extension,
  ...shared,
  ...sharedAwareness,
  ...sharedComponents,
  ...sharedHeaderValidation,
  ...sharedInfoCookies,
  ...sharedNotifications,
  ...sharedResolutionHints,
  ...sharedWorkspace,
  ...workbench,
  ...workbenchScriptPackages,
  ...workbenchTrustedRoots,
};
