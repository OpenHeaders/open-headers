/**
 * Platform-agnostic YAML codec for v5 workspace entities.
 *
 * String-in / string-out — no filesystem access. Callers (desktop YAML
 * storage service, future team sync) layer filesystem concerns on top.
 *
 * Discipline:
 *   - Invariant #4 (preserve-unknown): parse captures the full YAML AST
 *     in `ParsedDocument.raw`; serialize of a merged document touches
 *     only known fields — unknown top-level keys round-trip unchanged.
 *   - Invariant #6 (metadata top, payload nested): known fields
 *     serialize in the canonical order declared in `ordering.ts`.
 *   - Invariant #16 (eemeli/yaml): single YAML lib in core — no custom
 *     parser, no stringify shims in consumers.
 *   - Invariant #17 (one codec): the same codec runs under the desktop
 *     filesystem reader/writer and under the future team-sync layer;
 *     both produce byte-identical output via `CANONICAL_STRINGIFY_OPTIONS`.
 *
 * Runtime-only fields (`Workspace.rootPath`, `{Collection,Folder,Rule,
 * Template}.path`) are excluded from persisted YAML. The caller
 * supplies them at parse time via the per-entity `CodecContext`.
 */

export { CANONICAL_STRINGIFY_OPTIONS } from './canonical';
export type { CollectionCodecContext } from './collection';
export { parseCollection, serializeCollection } from './collection';
export type { EnvironmentCodecInput, EnvironmentSerializeOutput } from './environment';
export { parseEnvironment, serializeEnvironment } from './environment';
export type { FolderCodecContext } from './folder';
export { parseFolder, serializeFolder } from './folder';
export type { LiveVariableCodecContext } from './live-variable';
export { parseLiveVariable, serializeLiveVariable } from './live-variable';
export type { LiveWorkflowCodecContext } from './live-workflow';
export { parseLiveWorkflow, serializeLiveWorkflow } from './live-workflow';
export { buildFreshDocument, mergeKnownFields } from './merge';
export {
  COLLECTION_FIELD_ORDER,
  ENVIRONMENT_FIELD_ORDER,
  FOLDER_FIELD_ORDER,
  LIVE_VARIABLE_FIELD_ORDER,
  LIVE_WORKFLOW_FIELD_ORDER,
  REQUEST_FIELD_ORDER,
  RULE_FIELD_ORDER,
  RUNTIME_ONLY_FIELDS,
  TEMPLATE_FIELD_ORDER,
  VAULT_FIELD_ORDER,
  WORKSPACE_FIELD_ORDER,
  WORKSPACE_VARIABLES_FIELD_ORDER,
} from './ordering';
export type { RequestCodecContext, RequestSerializeOutput, RequestSiblingFile } from './request';
export { parseRequest, serializeRequest } from './request';
export type { RuleCodecContext } from './rule';
export { parseRule, serializeRule } from './rule';
export type { TemplateCodecContext } from './template';
export { parseTemplate, serializeTemplate } from './template';
export { parseVault, parseWorkspaceVariables, serializeVault, serializeWorkspaceVariables } from './variables';
export { parseWorkspace, serializeWorkspace } from './workspace';
