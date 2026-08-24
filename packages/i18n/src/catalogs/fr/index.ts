/**
 * French. Files mirror `catalogs/en/` one-to-one and land file by file;
 * keys not yet translated fall back to English per key at runtime
 * (`createTranslator`'s fallback catalog). The locale-lint gate
 * (`scripts/lint-locales.mjs`) holds every present file to the
 * translation laws.
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
import { workbenchEditorsMqtt } from './workbench-editors-mqtt';
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
// outgrew tsc's declaration-emit ceiling (TS7056) — the en catalog's
// idiom applied to this locale.
type FrCatalog = typeof desktop &
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
  typeof shared &
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
  typeof tui &
  typeof web &
  typeof workbench &
  typeof workbenchChrome &
  typeof workbenchChromeSidebar &
  typeof workbenchChromeWorkspace &
  typeof workbenchDocs &
  typeof workbenchDocsDebugMode &
  typeof workbenchDocsDiagrams &
  typeof workbenchDocsSystemStatus &
  typeof workbenchDocsVariables &
  typeof workbenchEditors &
  typeof workbenchEditorsGrpc &
  typeof workbenchEditorsMqtt &
  typeof workbenchEditorsRequest &
  typeof workbenchEditorsRule &
  typeof workbenchEditorsSpec &
  typeof workbenchEditorsWebsocket &
  typeof workbenchImportExport &
  typeof workbenchLive &
  typeof workbenchScriptPackages &
  typeof workbenchServerAdmin &
  typeof workbenchSettings &
  typeof workbenchSettingsDefs &
  typeof workbenchSettingsDefsDevpanel &
  typeof workbenchSettingsDefsKeyboard &
  typeof workbenchSettingsPanes &
  typeof workbenchVariables;

export const fr: FrCatalog = {
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
  ...workbenchEditorsMqtt,
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
} as const satisfies Catalog;
