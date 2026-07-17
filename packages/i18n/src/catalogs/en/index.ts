/**
 * English — the source catalog. Every other locale translates exactly
 * this key set (enforced by the catalog-parity test), and `MessageKey`
 * derives from it so a typo'd key is a compile error at every `t()`
 * call site.
 */

import type { Catalog } from '../../types';
import { desktop } from './desktop';
import { extension } from './extension';
import { panel } from './panel';
import { panelConsole } from './panel-console';
import { panelDocs } from './panel-docs';
import { panelInspector } from './panel-inspector';
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
import { web } from './web';
import { workbench } from './workbench';
import { workbenchChrome } from './workbench-chrome';
import { workbenchDaemonAdmin } from './workbench-daemon-admin';
import { workbenchDocs } from './workbench-docs';
import { workbenchDocsDebugMode } from './workbench-docs-debug-mode';
import { workbenchDocsSystemStatus } from './workbench-docs-system-status';
import { workbenchDocsVariables } from './workbench-docs-variables';
import { workbenchEditors } from './workbench-editors';
import { workbenchImportExport } from './workbench-import-export';
import { workbenchLive } from './workbench-live';
import { workbenchScriptPackages } from './workbench-script-packages';
import { workbenchSettings } from './workbench-settings';
import { workbenchSettingsDefs } from './workbench-settings-defs';
import { workbenchSettingsPanes } from './workbench-settings-panes';
import { workbenchVariables } from './workbench-variables';

export const en = {
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
  ...desktop,
  ...extension,
  ...panel,
  ...panelConsole,
  ...panelDocs,
  ...panelInspector,
  ...panelNetwork,
  ...panelQuickEditor,
  ...panelStorage,
  ...popup,
  ...web,
  ...workbench,
  ...workbenchChrome,
  ...workbenchDaemonAdmin,
  ...workbenchDocs,
  ...workbenchDocsDebugMode,
  ...workbenchDocsSystemStatus,
  ...workbenchDocsVariables,
  ...workbenchEditors,
  ...workbenchImportExport,
  ...workbenchLive,
  ...workbenchScriptPackages,
  ...workbenchSettings,
  ...workbenchSettingsDefs,
  ...workbenchSettingsPanes,
  ...workbenchVariables,
} as const satisfies Catalog;

export type MessageKey = keyof typeof en;
