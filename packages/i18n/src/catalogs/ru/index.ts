/**
 * Russian catalog — assembled file by file as translation lands (the
 * per-key English fallback covers the rest). The register contract
 * lives in `shared.ts`'s header.
 */

import type { Catalog } from '../../types';
import { desktop } from './desktop';
import { extension } from './extension';
import { panel } from './panel';
import { panelConsole } from './panel-console';
import { panelDocs } from './panel-docs';
import { panelInspector } from './panel-inspector';
import { panelInspectorCookies } from './panel-inspector-cookies';
import { panelInspectorHeaders } from './panel-inspector-headers';
import { panelInspectorStreams } from './panel-inspector-streams';
import { panelNetwork } from './panel-network';
import { panelQuickEditor } from './panel-quick-editor';
import { panelStorage } from './panel-storage';
import { popup } from './popup';
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
  ...panel,
  ...panelConsole,
  ...panelDocs,
  ...panelInspector,
  ...panelInspectorCookies,
  ...panelInspectorHeaders,
  ...panelInspectorStreams,
  ...panelNetwork,
  ...panelQuickEditor,
  ...panelStorage,
  ...popup,
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
