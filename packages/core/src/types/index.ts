// ── Common ─────────────────────────────────────────────────────────

// ── Collection ─────────────────────────────────────────────────────
export type {
  Collection,
  CollectionTree,
  Folder,
  FolderNode,
  RequestNode,
  RuleNode,
  TemplateNode,
  TreeNode,
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
export type { DaemonAuthToken } from './daemon-auth-token';
// ── Daemon config (per-host configuration; carries host-install-id) ────
export type { DaemonConfig } from './daemon-config';
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
  ExtensionWorkspaceKind,
  ExtensionWorkspaceSource,
} from './extension-workspace';
// ── DevTools HAR-source wire ───────────────────────────────────────
export type {
  HarSourceMessage,
  InspectorHarBody,
  InspectorHarEntry,
  InspectorNavTiming,
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
  StatusClass,
  StatusMatch,
  StepGate,
  StepGateClause,
  StepGateClauseKind,
  WorkflowStep,
} from './live';
// ── Live cache row ─────────────────────────────────────────────────
export type { LiveValueRecord, RefreshHealth, WorkflowRunCache } from './live-cache';
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
} from './request';

// ── Request execution ──────────────────────────────────────────────
export type { ExecutedRequestSnapshot } from './request-execution';
// ── Rule ───────────────────────────────────────────────────────────
export type {
  BlockAction,
  BlockRule,
  BodyAction,
  BodyModType,
  BodyResourceType,
  BodyRule,
  ConditionType,
  DelayAction,
  DelayRule,
  DnrRuleType,
  ExtensionRuleType,
  HeaderAction,
  HeaderModification,
  HeaderOperation,
  HeaderRule,
  InjectAction,
  InjectRule,
  InjectSource,
  InjectType,
  MockAction,
  MockBodyType,
  MockRule,
  QueryParamAction,
  QueryParamEntry,
  QueryParamOperation,
  QueryParamRule,
  RedirectAction,
  RedirectRule,
  ResourceType,
  Rule,
  RuleBase,
  RuleCondition,
  RuleType,
} from './rule';
// ── Rule draft (pre-fill handoff) ─────────────────────────────────
export type {
  BlockRuleDraft,
  BodyRuleDraft,
  DelayRuleDraft,
  HeaderRuleDraft,
  HeaderRuleDraftHeader,
  InjectRuleDraft,
  MockRuleDraft,
  QueryParamDraftEntry,
  QueryParamRuleDraft,
  RedirectRuleDraft,
  RuleDraft,
  RuleDraftBase,
  RuleDraftType,
} from './rule-draft';
// ── Shadow arbitration ─────────────────────────────────────────────
export type { ShadowAttribution, ShadowKind } from './shadow';
// ── Subsystem status snapshot ──────────────────────────────────────
export type { StatusEntry, StatusLevel, StatusSnapshot, StatusSubsystem } from './status';
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
// ── Test run ───────────────────────────────────────────────────────
export type {
  LoadedTestRun,
  StoredTestRun,
  TestFireEvent,
  TestRuleStatus,
  TestRunOwner,
  TestRunOwnerType,
} from './test-run';
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
// ── Workspace ──────────────────────────────────────────────────────
export type { Workspace, WorkspaceSection } from './workspace';
// ── Workspace export selection ─────────────────────────────────────
export type { ExportSelection } from './workspace-export-selection';
// ── Workspace import dedup ─────────────────────────────────────────
export type { DedupMatchEntry, DedupMatchesResult, FindMatchesArgs } from './workspace-import';
