/**
 * Dispatch table — merges every domain handler map into one
 * `message.type` → handler lookup consumed by the router (`index.ts`).
 *
 * Keys are disjoint across domains; a collision would silently shadow
 * (later spread wins), so keep each handler's type owned by one module.
 */

import { connectionHandlers } from './handlers/connection';
import { environmentHandlers } from './handlers/environments';
import { exportImportHandlers } from './handlers/export-import';
import { fileHandlers } from './handlers/files';
import { importReportHandlers } from './handlers/import-reports';
import { liveHandlers } from './handlers/live';
import { miscHandlers } from './handlers/misc';
import { navigationHandlers } from './handlers/navigation';
import { oauthHandlers } from './handlers/oauth';
import { observabilityHandlers } from './handlers/observability';
import { requestHandlers } from './handlers/requests';
import { ruleHandlers } from './handlers/rules';
import { storageInspectorHandlers } from './handlers/storage-inspector';
import { telemetryHandlers } from './handlers/telemetry';
import { templateHandlers } from './handlers/templates';
import { workspaceHandlers } from './handlers/workspaces';
import type { HandlerMap } from './types';

export const registry: HandlerMap = {
  ...connectionHandlers,
  ...workspaceHandlers,
  ...exportImportHandlers,
  ...navigationHandlers,
  ...environmentHandlers,
  ...requestHandlers,
  ...ruleHandlers,
  ...telemetryHandlers,
  ...templateHandlers,
  ...observabilityHandlers,
  ...importReportHandlers,
  ...fileHandlers,
  ...oauthHandlers,
  ...liveHandlers,
  ...storageInspectorHandlers,
  ...miscHandlers,
};
