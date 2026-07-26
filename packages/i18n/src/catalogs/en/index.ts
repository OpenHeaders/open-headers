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
import { workbenchChrome } from './workbench-chrome';
import { workbenchChromeSidebar } from './workbench-chrome-sidebar';
import { workbenchChromeWorkspace } from './workbench-chrome-workspace';
import { workbenchDocs } from './workbench-docs';
import { workbenchDocsDebugMode } from './workbench-docs-debug-mode';
import { workbenchDocsDiagrams } from './workbench-docs-diagrams';
import { workbenchDocsSystemStatus } from './workbench-docs-system-status';
import { workbenchDocsVariables } from './workbench-docs-variables';
import { workbenchEditors } from './workbench-editors';
import { workbenchEditorsGrpc } from './workbench-editors-grpc';
import { workbenchEditorsRequest } from './workbench-editors-request';
import { workbenchEditorsRule } from './workbench-editors-rule';
import { workbenchEditorsSpec } from './workbench-editors-spec';
import { workbenchEditorsWebsocket } from './workbench-editors-websocket';
import { workbenchImportExport } from './workbench-import-export';
import { workbenchLive } from './workbench-live';
import { workbenchScriptPackages } from './workbench-script-packages';
import { workbenchServerAdmin } from './workbench-server-admin';
import { workbenchSettings } from './workbench-settings';
import { workbenchSettingsDefs } from './workbench-settings-defs';
import { workbenchSettingsDefsDevpanel } from './workbench-settings-defs-devpanel';
import { workbenchSettingsDefsKeyboard } from './workbench-settings-defs-keyboard';
import { workbenchSettingsPanes } from './workbench-settings-panes';
import { workbenchVariables } from './workbench-variables';

// Explicit intersection annotation: the merged literal's inferred type
// outgrew tsc's declaration-emit ceiling (TS7056). Intersecting the
// per-file types emits compact type references while `keyof` still
// yields the full literal key union.
type EnCatalog = typeof shared &
  typeof sharedAwareness &
  typeof sharedChrome &
  typeof sharedComponents &
  typeof sharedConflicts &
  typeof sharedHeaderValidation &
  typeof sharedInfoCookies &
  typeof sharedInfoHeaders &
  typeof sharedInfoStatus &
  typeof sharedMergeEditor &
  typeof sharedNotifications &
  typeof sharedResolutionHints &
  typeof sharedWorkspace &
  typeof desktop &
  typeof extension &
  typeof panel &
  typeof panelConsole &
  typeof panelDocs &
  typeof panelInspector &
  typeof panelInspectorCookies &
  typeof panelInspectorHeaders &
  typeof panelInspectorStreams &
  typeof panelNetwork &
  typeof panelQuickEditor &
  typeof panelStorage &
  typeof popup &
  typeof tui &
  typeof web &
  typeof workbench &
  typeof workbenchChrome &
  typeof workbenchChromeSidebar &
  typeof workbenchChromeWorkspace &
  typeof workbenchServerAdmin &
  typeof workbenchDocs &
  typeof workbenchDocsDebugMode &
  typeof workbenchDocsDiagrams &
  typeof workbenchDocsSystemStatus &
  typeof workbenchDocsVariables &
  typeof workbenchEditors &
  typeof workbenchEditorsGrpc &
  typeof workbenchEditorsRequest &
  typeof workbenchEditorsRule &
  typeof workbenchEditorsSpec &
  typeof workbenchEditorsWebsocket &
  typeof workbenchImportExport &
  typeof workbenchLive &
  typeof workbenchScriptPackages &
  typeof workbenchSettings &
  typeof workbenchSettingsDefs &
  typeof workbenchSettingsDefsDevpanel &
  typeof workbenchSettingsDefsKeyboard &
  typeof workbenchSettingsPanes &
  typeof workbenchVariables;

export const en: EnCatalog = {
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
  ...panelInspectorCookies,
  ...panelInspectorHeaders,
  ...panelInspectorStreams,
  ...panelNetwork,
  ...panelQuickEditor,
  ...panelStorage,
  ...popup,
  ...tui,
  ...web,
  ...workbench,
  ...workbenchChrome,
  ...workbenchChromeSidebar,
  ...workbenchChromeWorkspace,
  ...workbenchServerAdmin,
  ...workbenchDocs,
  ...workbenchDocsDebugMode,
  ...workbenchDocsDiagrams,
  ...workbenchDocsSystemStatus,
  ...workbenchDocsVariables,
  ...workbenchEditors,
  ...workbenchEditorsGrpc,
  ...workbenchEditorsRequest,
  ...workbenchEditorsRule,
  ...workbenchEditorsSpec,
  ...workbenchEditorsWebsocket,
  ...workbenchImportExport,
  ...workbenchLive,
  ...workbenchScriptPackages,
  ...workbenchSettings,
  ...workbenchSettingsDefs,
  ...workbenchSettingsDefsDevpanel,
  ...workbenchSettingsDefsKeyboard,
  ...workbenchSettingsPanes,
  ...workbenchVariables,
} satisfies Catalog;

export type MessageKey = keyof EnCatalog;
