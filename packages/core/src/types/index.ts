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
