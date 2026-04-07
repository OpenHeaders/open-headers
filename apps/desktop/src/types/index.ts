/**
 * Desktop-only type re-exports.
 *
 * Shared types (Request, Rule, Environment, etc.) are imported
 * directly from '@openheaders/core/types'. This barrel only re-exports
 * types that are specific to the desktop app.
 */

export type {
  IpcFireEvent,
  IpcInvokeEvent,
} from './common';
export { toErrno } from './common';
export type {
  Environment,
  EnvironmentsState,
  Variable,
} from './environment';
export { cloneEnvironments } from './environment';
export type {
  EnvironmentContextLike,
  HttpProgressCallback,
  HttpRequestResult,
  HttpRequestSpec,
  TestResponseContent,
  TotpCooldownInfo,
} from './http';
export type {
  ProxyCertificateInfo,
  ProxyRule,
  ProxyStats,
  ProxyStatus,
} from './proxy';
export type { AppSettings, ScreenRecordingPermission } from './settings';
export type {
  AuthType,
  ServiceRegistryStatus,
  ServicesHealth,
  TeamWorkspaceInvite,
  Workspace,
  WorkspaceAuthData,
  WorkspaceDataUpdatedData,
  WorkspaceMetadata,
  WorkspaceSyncCompletedData,
  WorkspaceSyncStatus,
  WorkspaceType,
} from './workspace';
