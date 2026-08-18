/**
 * Platform-agnostic YAML codec for workspace entities.
 *
 * String-in / string-out — no filesystem access. Callers (desktop YAML
 * storage service, future team sync) layer filesystem concerns on top.
 *
 * Discipline:
 *   - Invariant #4 (preserve-unknown): parse captures unknown fields as
 *     serializable `{ path, value }` rows in `ParsedDocument.raw`
 *     (`unknown-fields.ts`); serialize re-emits them beneath the known
 *     block of their original parent map at every depth — never only
 *     the top level (the sync-engine design §13.2 pass-through reads).
 *   - Invariant #6 (metadata top, payload nested): top-level fields
 *     serialize in the canonical order declared in `ordering.ts`;
 *     nested maps follow the valibot schema's entry-definition order
 *     (`canonical-emit.ts`).
 *   - Invariant #16 (eemeli/yaml): single YAML lib in core — no custom
 *     parser, no stringify shims in consumers.
 *   - Invariant #17 (one codec): the same codec runs under the desktop
 *     filesystem reader/writer and under the git/team-sync layer; both
 *     produce byte-identical output for identical state regardless of
 *     parse history or key-insertion order (§23.3 determinism).
 *
 * Runtime-only fields (`Workspace.rootPath`, `{Collection,Folder,Rule,
 * Template}.path`) are excluded from persisted YAML. The caller
 * supplies them at parse time via the per-entity `CodecContext`.
 */

export { CANONICAL_STRINGIFY_OPTIONS } from './canonical';
export { emitCanonicalYaml } from './canonical-emit';
export type { CollectionCodecContext, CollectionSerializeOutput } from './collection';
export { parseCollection, serializeCollection } from './collection';
export type { EnvironmentCodecInput, EnvironmentSerializeOutput } from './environment';
export { parseEnvironment, serializeEnvironment } from './environment';
export type { FolderCodecContext, FolderSerializeOutput } from './folder';
export { parseFolder, serializeFolder } from './folder';
export type { GrpcRequestCodecContext, GrpcRequestSerializeOutput, GrpcRequestSiblingFile } from './grpc-request';
export { canonicalizeGrpcRequest, parseGrpcRequest, serializeGrpcRequest } from './grpc-request';
export type { LiveVariableCodecContext } from './live-variable';
export { parseLiveVariable, serializeLiveVariable } from './live-variable';
export type { LiveWorkflowCodecContext } from './live-workflow';
export { parseLiveWorkflow, serializeLiveWorkflow } from './live-workflow';
export {
  COLLECTION_FIELD_ORDER,
  ENVIRONMENT_FIELD_ORDER,
  FOLDER_FIELD_ORDER,
  GRPC_REQUEST_FIELD_ORDER,
  LIVE_VARIABLE_FIELD_ORDER,
  LIVE_WORKFLOW_FIELD_ORDER,
  REQUEST_FIELD_ORDER,
  RULE_FIELD_ORDER,
  RUNTIME_ONLY_FIELDS,
  SPEC_FIELD_ORDER,
  TEMPLATE_FIELD_ORDER,
  VAULT_FIELD_ORDER,
  WEBSOCKET_REQUEST_FIELD_ORDER,
  WORKSPACE_FIELD_ORDER,
  WORKSPACE_VARIABLES_FIELD_ORDER,
} from './ordering';
export type { RequestCodecContext, RequestSerializeOutput, RequestSiblingFile } from './request';
export { canonicalizeRequest, parseRequest, serializeRequest } from './request';
export type { RuleCodecContext } from './rule';
export { canonicalizeRule, parseRule, serializeRule } from './rule';
export type { ScriptFields, ScriptSiblingFile, ScriptSiblingOutputs } from './script-siblings';
export { POST_RESPONSE_SCRIPT_FILE, PRE_REQUEST_SCRIPT_FILE } from './script-siblings';
export type { SpecCodecContext, SpecSerializeOutput, SpecSiblingFile } from './spec';
export { parseSpec, parseSpecInline, serializeSpec } from './spec';
export type { TemplateCodecContext } from './template';
export { canonicalizeTemplate, parseTemplate, serializeTemplate } from './template';
export type { UnknownField } from './unknown-fields';
export { extractUnknownFields, unknownFieldsOf } from './unknown-fields';
export { parseVault, parseWorkspaceVariables, serializeVault, serializeWorkspaceVariables } from './variables';
export type {
  WebSocketRequestCodecContext,
  WebSocketRequestSerializeOutput,
  WebSocketRequestSiblingFile,
} from './websocket-request';
export {
  canonicalizeWebSocketRequest,
  parseWebSocketRequest,
  serializeWebSocketRequest,
} from './websocket-request';
export { parseWorkspace, serializeWorkspace } from './workspace';
