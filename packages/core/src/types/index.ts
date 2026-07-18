// ── Common ─────────────────────────────────────────────────────────

// ── Backend connection (one joined back-end; MULTI_BACKEND_PLAN §2) ──
export type { BackendConnection } from './backend-connection';
// ── CDP attach-scope vocabulary ────────────────────────────────────
export type {
  CdpRosterTab,
  CdpScopeMode,
  NetworkThrottleConditions,
  TabEmulatedMedia,
  TabSystemOverrides,
} from './cdp';
export {
  cdpRosterTabSchema,
  cdpScopeModeSchema,
  networkThrottleConditionsSchema,
  readCdpPinnedTabs,
  readCdpRoster,
  readNetworkThrottleConditions,
  readTabSystemOverrides,
  tabEmulatedMediaSchema,
  tabSystemOverridesSchema,
} from './cdp';
// ── Collection ─────────────────────────────────────────────────────
export type {
  Collection,
  CollectionTree,
  Folder,
  FolderNode,
  GrpcRequestNode,
  RequestNode,
  RuleNode,
  SpecLink,
  TemplateNode,
  TreeNode,
  WebSocketRequestNode,
} from './collection';
export type {
  JsonArray,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  OperationResult,
} from './common';
export { errorMessage, toError } from './common';
// ── Daemon auth token (long-lived peer credential; hashed) ──────────
export type { DaemonAuthToken, DaemonAuthTokenKind } from './daemon-auth-token';
// ── Daemon config (per-host configuration; carries host-install-id) ────
export type { DaemonConfig } from './daemon-config';
// ── Daemon-local users (the daemon's directory; Phase 5 team tier) ──
export type { DaemonUserRecord } from './daemon-users';
// ── Editing-scope view state (per-tab snapshots + donor record) ──
export type {
  DonorRecord,
  EditingScopeViewStateApi,
  EditingScopeViewStateEnvelope,
  SurfaceType,
  UseEditingScopeViewStateOptions,
} from './editing-scope-view-state';
// ── Extension workspace (browser-side multi-workspace record) ─────
export type {
  ExtensionWorkspace,
  ExtensionWorkspaceImportedFrom,
  ExtensionWorkspaceKind,
  ExtensionWorkspaceSource,
} from './extension-workspace';
// ── gRPC request ───────────────────────────────────────────────────
export type { ExecutedGrpcMessageFrame, ExecutedGrpcSnapshot } from './grpc-execution';
export type {
  GrpcAuth,
  GrpcMetadataPair,
  GrpcMethodRef,
  GrpcRequest,
  GrpcRequestSeed,
  GrpcSpecLink,
} from './grpc-request';
export type {
  CapturedGrpcMessageFrame,
  CapturedGrpcRequest,
  CapturedGrpcResponse,
  GrpcResponseExample,
} from './grpc-response-example';
export type {
  HarEventSourceMessage,
  HarSourceMessage,
  HarWebSocketMessage,
  InspectorHarBody,
  InspectorHarEntry,
  InspectorHarEntrySource,
  InspectorHarHeaderCapture,
  InspectorHarLog,
  InspectorHarPage,
  InspectorHarPageTimings,
  InspectorNavTiming,
  InspectorRawTiming,
} from './har-source';
// ── DevTools HAR-source wire ───────────────────────────────────────
export {
  HAR_SOURCE_PORT_PREFIX,
  harSourcePortName,
  parseHarSourcePortName,
} from './har-source';
// ── Identity (universal schema; synthetic in Mode 1 / Mode 2 localhost) ─
export type {
  HostKind,
  Org,
  Session,
  SessionSource,
  SyntheticIdentityRecord,
  User,
  UserIdentity,
  UserIdentityKind,
} from './identity';
// ── Identity ACL (membership, principal, workspace-role, daemon-admin) ─
export type {
  AuditCapability,
  AuditCapabilityDenyReason,
  AuditDecision,
  AuditLogEntry,
  DaemonAdmin,
  OrgMembership,
  OrgPrimaryRole,
  Principal,
  WorkspaceRole,
  WorkspaceRoleAssignment,
  WorkspaceRoleOrigin,
} from './identity-acl';
// ── Live Variables + Workflows ────────────────────────────────────
export type {
  Capture,
  Extractor,
  ExtractorKind,
  LiveVariable,
  LiveVariableOverride,
  LiveWorkflow,
  PriorityRef,
  PrioritySortMode,
  RefreshPolicy,
  RefreshPolicyKind,
  RetryBackoff,
  StatusClass,
  StatusMatch,
  StepGate,
  StepGateClause,
  StepGateClauseKind,
  StepRetryPolicy,
  WorkflowStep,
} from './live';
// ── Live cache row ─────────────────────────────────────────────────
export type { LiveValueRecord, RefreshHealth, WorkflowRunCache, WorkflowStepOutcome } from './live-cache';
// ── Offline-fallback priority list (WS-C C14) ──────────────────────
export type { LiveFallbackPriorityMember, LiveFallbackPrioritySnapshot } from './live-fallback-priority';
// ── Observability (local-first log ring) ──────────────────────────
export type { LogEntry, LogEntryContext, LogLevel, LogSubsystem } from './observability';
// ── Resource-timing wire projection ────────────────────────────────
export type { PerfResourceEntry } from './perf';
// ── Request ────────────────────────────────────────────────────────
export type {
  AuthConfig,
  AuthType,
  BodyType,
  CredentialsMode,
  FileRef,
  FormField,
  HttpMethod,
  MultipartPart,
  OAuth2Auth,
  OAuth2Flow,
  QueryParam,
  Request,
  RequestBody,
  RequestHeader,
  RequestSeed,
  TlsVersion,
} from './request';

// ── Request execution ──────────────────────────────────────────────
export type {
  ExecutedRedirectHop,
  ExecutedRequestErrorHint,
  ExecutedRequestSize,
  ExecutedRequestSnapshot,
  ExecutedWireCapture,
} from './request-execution';
// ── Response example ───────────────────────────────────────────────
export type { CapturedRequest, CapturedResponse, ResponseExample } from './response-example';
// ── Rule ───────────────────────────────────────────────────────────
export type {
  ApiResourceType,
  AuthAction,
  AuthRule,
  BlockAction,
  BlockRule,
  ConditionType,
  DelayAction,
  DelayRule,
  DnrRuleType,
  ExtensionRuleType,
  FetchCapableRuleType,
  HeaderAction,
  HeaderModification,
  HeaderOperation,
  HeaderRule,
  InjectAction,
  InjectRule,
  InjectSource,
  InjectTrigger,
  InjectType,
  MessageFilter,
  MessageOperation,
  QueryParamAction,
  QueryParamEntry,
  QueryParamOperation,
  QueryParamRule,
  RedirectAction,
  RedirectRule,
  RequestBodyAction,
  RequestBodyRule,
  RequestBodyType,
  ResourceType,
  ResponseAction,
  ResponseBodyType,
  ResponseRule,
  ResponseSource,
  Rule,
  RuleBase,
  RuleCondition,
  RuleType,
  SseAction,
  SseRule,
  WsAction,
  WsDirection,
  WsRule,
} from './rule';
// ── Rule draft (pre-fill handoff) ─────────────────────────────────
export type {
  BlockRuleDraft,
  DelayRuleDraft,
  HeaderRuleDraft,
  HeaderRuleDraftHeader,
  InjectRuleDraft,
  QueryParamDraftEntry,
  QueryParamRuleDraft,
  RedirectRuleDraft,
  RequestBodyRuleDraft,
  ResponseRuleDraft,
  RuleDraft,
  RuleDraftBase,
  RuleDraftType,
  SseRuleDraft,
  WsRuleDraft,
} from './rule-draft';
// ── Script packages ────────────────────────────────────────────────
export type { ScriptPackage } from './script-package';
// ── Shadow arbitration ─────────────────────────────────────────────
export type { ShadowAttribution, ShadowKind } from './shadow';
// ── Specs ──────────────────────────────────────────────────────────
export type { Spec, SpecFile, SpecFormat } from './spec';
// ── Subsystem status snapshot ──────────────────────────────────────
export type {
  BackendSyncStatus,
  BackendSyncStatusSnapshot,
  StatusEntry,
  StatusLevel,
  StatusSnapshot,
  StatusSubsystem,
} from './status';
// ── Storage ────────────────────────────────────────────────────────
export { GITIGNORE } from './storage';
// ── Telemetry ──────────────────────────────────────────────────────
export type {
  DeliveryMode,
  Evidence,
  RequestRecord,
  RuleSnapshot,
  RuleSnapshotHeaderMod,
  TabTelemetrySnapshot,
  TrackedResourceType,
} from './telemetry';

// ── Template ──────────────────────────────────────────────────────
export type { Template } from './template';
// ── Per-tab tracked-resource state ─────────────────────────────────
export type { ObservationSource, TrackedResource } from './tracking';
// ── Variable ───────────────────────────────────────────────────────
export type {
  Environment,
  ResolutionContext,
  ResolvedVariable,
  TotpAlgorithm,
  Variable,
  VariableScope,
  Vault,
  VaultSecret,
  VaultSecretClientCertificate,
  VaultSecretKind,
  VaultSecretString,
  VaultSecretTotp,
  WorkspaceVariables,
} from './variable';
// ── Rule verdict (per-tab "applicable rule" rulings) ──────────────
export type { ActiveRule, RuleVerdict, SilentMatchRecord } from './verdict';
// ── View mode (popup vs sidepanel) ────────────────────────────────
export type { ViewMode } from './view-mode';
export { DEFAULT_VIEW_MODE, VIEW_MODE_STORAGE_KEY } from './view-mode';
// ── WebSocket execution ────────────────────────────────────────────
export type { ExecutedWsClose, ExecutedWsMessage, ExecutedWsSnapshot } from './websocket-execution';
// ── WebSocket request ──────────────────────────────────────────────
export type {
  WebSocketFlavor,
  WebSocketHeaderPair,
  WebSocketMessageFormat,
  WebSocketQueryParam,
  WebSocketRequest,
  WebSocketRequestSeed,
  WebSocketSpecLink,
} from './websocket-request';
// ── Workspace ──────────────────────────────────────────────────────
export type { Workspace, WorkspaceSection } from './workspace';
// ── Workspace export selection ─────────────────────────────────────
export type { ExportSelection } from './workspace-export-selection';
// ── Workspace import dedup ─────────────────────────────────────────
export type { DedupMatchEntry, DedupMatchesResult, FindMatchesArgs } from './workspace-import';
// ── WebSocket response example ─────────────────────────────────────
export type {
  CapturedWsClose,
  CapturedWsMessage,
  CapturedWsRequest,
  CapturedWsResponse,
  WsResponseExample,
} from './ws-response-example';
