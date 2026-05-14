// ── Common ─────────────────────────────────────────────────────────
export type {
  JsonArray,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  OperationResult,
} from './common';
export { errorMessage, toError } from './common';

// ── Recording ──────────────────────────────────────────────────────
export type {
  ConsoleArg,
  ConsoleArgObject,
  ConsoleRecord,
  CookieAttributes,
  DomNode,
  NavigationEntry,
  NetworkRecord,
  NetworkTimingData,
  PageTransition,
  PreprocessedRecording,
  PreprocessOptions,
  PreprocessProgressDetails,
  RawRecordingRecord,
  Recording,
  RecordingEvent,
  RecordingEventData,
  RecordingMetadata,
  RRWebAdd,
  RRWebEvent,
  RRWebInnerData,
  RRWebPlayerConstructor,
  RRWebPlayerInstance,
  RRWebPlayerProps,
  Snapshot,
  StaticResources,
  StorageCookieMetadata,
  StorageRecord,
  TimeEvent,
  TimeEventType,
  WorkflowRecordingEntry,
  WorkflowRecordingFileMetadata,
  WorkflowTag,
} from './recording';

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

// ── Extension workspace (browser-side multi-workspace record) ─────
export type {
  ExtensionWorkspace,
  ExtensionWorkspaceKind,
  ExtensionWorkspaceSource,
} from './extension-workspace';

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

// ── Rule verdict (per-tab "applicable rule" rulings) ──────────────
export type { ActiveRule, RuleVerdict, SilentMatchRecord } from './verdict';

// ── Per-tab tracked-resource state ─────────────────────────────────
export type { ObservationSource, TrackedResource } from './tracking';

// ── Resource-timing wire projection ────────────────────────────────
export type { PerfResourceEntry } from './perf';

// ── Subsystem status snapshot ──────────────────────────────────────
export type { StatusEntry, StatusLevel, StatusSnapshot, StatusSubsystem } from './status';

// ── Test run ───────────────────────────────────────────────────────
export type {
  LoadedTestRun,
  StoredTestRun,
  TestFireEvent,
  TestRuleStatus,
  TestRunOwner,
  TestRunOwnerType,
} from './test-run';

// ── Request execution ──────────────────────────────────────────────
export type { ExecutedRequestSnapshot } from './request-execution';

// ── DevTools inspector wire ────────────────────────────────────────
export type {
  HarSourceMessage,
  InspectorHarBody,
  InspectorHarEntry,
  InspectorNavTiming,
  InspectorPortMessage,
} from './devtools-inspector';

// ── Workspace import dedup ─────────────────────────────────────────
export type { DedupMatchEntry, DedupMatchesResult, FindMatchesArgs } from './workspace-import';

// ── Workspace export selection ─────────────────────────────────────
export type { ExportSelection } from './workspace-export-selection';

// ── Live cache row ─────────────────────────────────────────────────
export type { WorkflowRunCache } from './live-cache';

// ── Observability (local-first log ring) ──────────────────────────
export type { LogEntry, LogEntryContext, LogLevel, LogSubsystem } from './observability';

// ── Storage ────────────────────────────────────────────────────────
export { GITIGNORE } from './storage';

// ── Template ──────────────────────────────────────────────────────
export type { Template } from './template';

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

// ── Workspace ──────────────────────────────────────────────────────
export type { Workspace, WorkspaceSection } from './workspace';

// ── View mode (popup vs sidepanel) ────────────────────────────────
export type { ViewMode } from './view-mode';
export { DEFAULT_VIEW_MODE, VIEW_MODE_STORAGE_KEY } from './view-mode';

// ── Editing-scope view state (per-tab snapshots + donor record) ──
export type {
  DonorRecord,
  EditingScopeViewStateApi,
  EditingScopeViewStateEnvelope,
  SurfaceType,
  UseEditingScopeViewStateOptions,
} from './editing-scope-view-state';
