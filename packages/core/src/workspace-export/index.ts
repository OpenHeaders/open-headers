/**
 * Workspace export / import — envelope format, builder, crypto.
 *
 * One file shape, three callers, one importer (see
 * docs/V5_WORKSPACE_EXPORT_DESIGN.md). The envelope is consumed by both
 * the extension and (eventually) the desktop app — this package has
 * zero platform deps.
 *
 * PR 1 ships: schema + ordering + builder + crypto helpers (encryption
 * not yet wired into the builder; lands in PR 4).
 */

export type {
  BuildWorkspaceExportInput,
  BuildWorkspaceExportOptions,
  DecryptVaultBlockResult,
  EncryptVaultBlockOptions,
  EncryptVaultBlockResult,
  ExportDestination,
} from './build';
export {
  buildWorkspaceExport,
  decryptVaultBlock,
  encryptVaultBlock,
  MissingSecretsBlockError,
  PlaintextDeepLinkRefusedError,
  VaultDecryptionFailedError,
  VaultPayloadShapeError,
} from './build';
export type { EncryptedEnvelope } from './crypto';
export {
  base64UrlToBytes,
  bytesToBase64Url,
  ciphertextFingerprint,
  DEFAULT_PBKDF2_ITERATIONS,
  decryptWithPassphrase,
  deriveKey,
  encryptWithPassphrase,
  keyFingerprint,
  MIN_PBKDF2_ITERATIONS,
} from './crypto';
export type {
  DeepCopyContext,
  DeepCopyHierarchyParams,
  DeepCopyHierarchyResult,
  LocalFolder,
} from './deep-copy-hierarchy';
export { deepCopyHierarchy } from './deep-copy-hierarchy';
export type { DecodeDeepLinkOptions, EncodeDeepLinkOptions } from './deep-link';
export {
  DEFAULT_DEEP_LINK_MAX_DECOMPRESSED_BYTES,
  DeepLinkDecompressionBombError,
  DeepLinkPayloadTooLargeError,
  decodeWorkspaceExportDeepLink,
  encodeWorkspaceExportDeepLink,
} from './deep-link';
export type {
  CollisionState,
  CollisionStrategy,
  DiffEntry,
  DiffResult,
  DiffSingleton,
  TargetWorkspaceState,
} from './diff';
export { applyBackupRestoreToggle, COLLISION_STRATEGIES, CollisionStrategySchema, diffWorkspaceExport } from './diff';
export type { ImportDiffEntityType, ImportDiffSection, ImportSinceLastDiff } from './import-diff';
export { diffIncomingAgainstPriorImport } from './import-diff';
export type {
  ImporterOptions,
  ImportPlan,
  PlanAction,
  PlanEntry,
  PlanSingletonAction,
  PlanVault,
  PlanWorkspaceVariables,
  StrategyMap,
} from './importer';
export { buildImportPlan } from './importer';
export type { MissingDep, MissingDepType } from './missing-deps';
export { MISSING_DEP_TYPES, MissingDepSchema, MissingDepTypeSchema, walkMissingDeps } from './missing-deps';
export {
  WORKSPACE_EXPORT_ENTITIES_FIELD_ORDER,
  WORKSPACE_EXPORT_FIELD_ORDER,
  WORKSPACE_EXPORT_META_FIELD_ORDER,
  WORKSPACE_EXPORT_SECRETS_FIELD_ORDER,
  WORKSPACE_EXPORT_SOURCE_FIELD_ORDER,
} from './ordering';
export type { ImportDrop, ParseOptions, ParseResult } from './parse';
export { DEFAULT_SIZE_CAP_BYTES, parseWorkspaceExport, YAML_MAX_ALIAS_COUNT } from './parse';
export { type RuleSummary, summarizeRule } from './rule-summary';
export type {
  ExportEncryption,
  ExportEntities,
  ExportRedactionMode,
  ExportScope,
  ExportSecrets,
  ExportSourceApp,
  ExportSourcePlatform,
  ExportWorkspaceMeta,
  WorkspaceExport,
} from './schema';
export {
  CURRENT_EXPORT_FORMAT_VERSION,
  ExportEncryptionKindSchema,
  ExportEncryptionSchema,
  ExportEntitiesSchema,
  ExportFormatVersionSchema,
  ExportKindSchema,
  ExportMetaSchema,
  ExportPbkdf2AesGcmSchema,
  ExportRedactionModeSchema,
  ExportSchemaVersionSchema,
  ExportScopeSchema,
  ExportSecretsSchema,
  ExportSourceAppSchema,
  ExportSourcePlatformSchema,
  ExportSourceSchema,
  ExportWorkspaceSchema,
  WorkspaceExportSchema,
} from './schema';
export { serializeWorkspaceExport } from './yaml';
