/**
 * Simplified Chinese catalog — assembled file by file as translation
 * lands (the per-key English fallback covers the rest). The register
 * contract lives in `shared.ts`'s header.
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
import { workbench } from './workbench';
import { workbenchChromeSidebar } from './workbench-chrome-sidebar';
import { workbenchChromeWorkspace } from './workbench-chrome-workspace';
import { workbenchDaemonAdmin } from './workbench-daemon-admin';
import { workbenchDocsDebugMode } from './workbench-docs-debug-mode';
import { workbenchDocsVariables } from './workbench-docs-variables';
import { workbenchEditors } from './workbench-editors';
import { workbenchEditorsSpec } from './workbench-editors-spec';
import { workbenchEditorsWebsocket } from './workbench-editors-websocket';
import { workbenchScriptPackages } from './workbench-script-packages';
import { workbenchSettingsDefsKeyboard } from './workbench-settings-defs-keyboard';

export const zhCN = {
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
  ...workbench,
  ...workbenchChromeSidebar,
  ...workbenchChromeWorkspace,
  ...workbenchDaemonAdmin,
  ...workbenchDocsDebugMode,
  ...workbenchDocsVariables,
  ...workbenchEditors,
  ...workbenchEditorsSpec,
  ...workbenchEditorsWebsocket,
  ...workbenchSettingsDefsKeyboard,
  ...workbenchScriptPackages,
} as const satisfies Catalog;
