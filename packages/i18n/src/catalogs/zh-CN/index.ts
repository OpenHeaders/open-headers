/**
 * Simplified Chinese catalog — assembled file by file as translation
 * lands (the per-key English fallback covers the rest). The register
 * contract lives in `shared.ts`'s header.
 */

import type { Catalog } from '../../types';
import { desktop } from './desktop';
import { extension } from './extension';
import { panelConsole } from './panel-console';
import { panelDocs } from './panel-docs';
import { panelInspector } from './panel-inspector';
import { panelInspectorCookies } from './panel-inspector-cookies';
import { panelInspectorHeaders } from './panel-inspector-headers';
import { panelInspectorStreams } from './panel-inspector-streams';
import { panelQuickEditor } from './panel-quick-editor';
import { panelStorage } from './panel-storage';
import { shared } from './shared';
import { sharedAwareness } from './shared-awareness';
import { sharedChrome } from './shared-chrome';
import { sharedComponents } from './shared-components';
import { sharedConflicts } from './shared-conflicts';
import { sharedHeaderValidation } from './shared-header-validation';
import { sharedInfoCookies } from './shared-info-cookies';
import { sharedInfoHeaders } from './shared-info-headers';
import { sharedInfoStatus } from './shared-info-status';
import { sharedMergeEditor } from './shared-merge-editor';
import { sharedNotifications } from './shared-notifications';
import { sharedResolutionHints } from './shared-resolution-hints';
import { sharedWorkspace } from './shared-workspace';
import { tui } from './tui';
import { web } from './web';
import { workbenchChromeSidebar } from './workbench-chrome-sidebar';
import { workbenchChromeWorkspace } from './workbench-chrome-workspace';

export const zhCN = {
  ...desktop,
  ...extension,
  ...panelConsole,
  ...panelDocs,
  ...panelInspector,
  ...panelInspectorCookies,
  ...panelInspectorHeaders,
  ...panelInspectorStreams,
  ...panelQuickEditor,
  ...panelStorage,
  ...shared,
  ...sharedAwareness,
  ...sharedChrome,
  ...sharedComponents,
  ...sharedConflicts,
  ...sharedHeaderValidation,
  ...sharedInfoCookies,
  ...sharedInfoHeaders,
  ...sharedInfoStatus,
  ...sharedMergeEditor,
  ...sharedNotifications,
  ...sharedResolutionHints,
  ...sharedWorkspace,
  ...tui,
  ...web,
  ...workbenchChromeSidebar,
  ...workbenchChromeWorkspace,
} as const satisfies Catalog;
