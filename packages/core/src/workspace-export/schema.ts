/**
 * Valibot schema for the workspace-export envelope.
 *
 * One file shape, three callers, one importer (see
 * docs/V5_WORKSPACE_EXPORT_DESIGN.md §1). The envelope discriminator is
 * `kind: 'workspace-export'` literal; `schemaVersion: 5` matches the destination
 * entity baseline; `exportFormatVersion` bumps independently when this
 * envelope's shape evolves.
 *
 * Per-entity arrays embed the existing core entity schemas verbatim — no
 * parallel schema. Reuse `RuleSchema`, `RequestSchema`, etc. so a single
 * source of truth catches any future schema drift.
 */

import * as v from 'valibot';
import {
  CollectionSchema,
  EnvironmentSchema,
  FolderSchema,
  LiveVariableSchema,
  LiveWorkflowSchema,
  RequestSchema,
  RuleSchema,
  SpecSchema,
  TemplateSchema,
  UidSchema,
  UuidV7Schema,
  VaultSchema,
  WorkspaceVariablesSchema,
} from '../schemas/index';

/** Bounded string for free-form strings inside the envelope (notes, labels). */
const NotesSchema = v.pipe(v.string(), v.maxLength(2048));
const ShortStringSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const SemverShapedSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(64));

/** Base64url payload — alphabet: `A-Z a-z 0-9 - _`, no padding required. */
const Base64UrlSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(64 * 1024 * 1024),
  v.regex(/^[A-Za-z0-9_-]+={0,2}$/),
);

// ── Identity layers (see design §1.1.1) ─────────────────────────────

export const ExportSchemaVersionSchema = v.literal(5);
export const ExportKindSchema = v.literal('workspace-export');

/**
 * Independent version counter for the envelope's shape. Bumps when
 * top-level fields change without bumping the entity baseline.
 */
export const ExportFormatVersionSchema = v.pipe(v.number(), v.integer(), v.minValue(1));

// ── Source / scope / meta ───────────────────────────────────────────

export const ExportSourceAppSchema = v.picklist(['extension', 'desktop', 'daemon', 'web']);
export const ExportSourcePlatformSchema = v.picklist(['chrome', 'firefox', 'edge', 'safari', 'electron', 'node']);
export const ExportScopeSchema = v.picklist(['workspace', 'collection', 'selection']);

export const ExportSourceSchema = v.object({
  app: ExportSourceAppSchema,
  appVersion: SemverShapedSchema,
  platform: ExportSourcePlatformSchema,
  workspaceLabel: v.optional(ShortStringSchema),
});

/**
 * Redaction enum — three values per design §1.1 / §3.1:
 * - `omitted` (default for vault, always for ephemeral state)
 * - `encrypted` (passphrase-derived AES-GCM envelope; vault only)
 * - `plaintext` (advanced; vault only)
 */
export const ExportRedactionModeSchema = v.picklist(['omitted', 'encrypted', 'plaintext']);

export const ExportMetaSchema = v.object({
  redactions: v.object({
    vault: ExportRedactionModeSchema,
    liveCache: v.literal('omitted'),
    oauthTokens: v.literal('omitted'),
    totpCooldowns: v.literal('omitted'),
  }),
  counts: v.object({
    rules: v.pipe(v.number(), v.integer(), v.minValue(0)),
    requests: v.pipe(v.number(), v.integer(), v.minValue(0)),
    environments: v.pipe(v.number(), v.integer(), v.minValue(0)),
    liveWorkflows: v.pipe(v.number(), v.integer(), v.minValue(0)),
    liveVariables: v.pipe(v.number(), v.integer(), v.minValue(0)),
    templates: v.pipe(v.number(), v.integer(), v.minValue(0)),
    secrets: v.pipe(v.number(), v.integer(), v.minValue(0)),
    specs: v.pipe(v.number(), v.integer(), v.minValue(0)),
  }),
});

// ── Workspace metadata block (always present, even on selection) ────

export const ExportWorkspaceSchema = v.object({
  // Workspace ids are canonically UUIDv7 on every host (see
  // `core/utils/workspace-id.ts`); only entity uids inside a workspace
  // use the 8-char form.
  uid: UuidV7Schema,
  name: ShortStringSchema,
  description: v.optional(v.pipe(v.string(), v.maxLength(2048))),
  color: v.optional(ShortStringSchema),
  icon: v.optional(ShortStringSchema),
  defaultEnvironmentId: v.optional(v.string()),
});

// ── Entity bag ──────────────────────────────────────────────────────

export const ExportEntitiesSchema = v.object({
  collections: v.array(CollectionSchema),
  folders: v.array(FolderSchema),
  rules: v.array(RuleSchema),
  requests: v.array(RequestSchema),
  templates: v.array(TemplateSchema),
  environments: v.array(EnvironmentSchema),
  workspaceVars: WorkspaceVariablesSchema,
  liveWorkflows: v.array(LiveWorkflowSchema),
  liveVariables: v.array(LiveVariableSchema),
  // Spec files export verbatim inside the entity — `content` is already
  // inline on every `files[]` row, so no sibling-file indirection here.
  specs: v.array(SpecSchema),
  vault: v.optional(VaultSchema),
});

// ── Crypto envelope ─────────────────────────────────────────────────

/** Discriminator on the encryption kind — extensible via picklist (§3.2). */
export const ExportEncryptionKindSchema = v.picklist(['pbkdf2-aes-gcm']);

export const ExportPbkdf2AesGcmSchema = v.object({
  kind: v.literal('pbkdf2-aes-gcm'),
  salt: Base64UrlSchema,
  iv: Base64UrlSchema,
  /**
   * Iteration count is parameterized so a future bump (e.g. 1_000_000)
   * doesn't require a `kind` change. Floor of 100_000 defends against
   * a downgrade attack that ships a low-cost iteration count.
   */
  iterations: v.pipe(v.number(), v.integer(), v.minValue(100_000), v.maxValue(10_000_000)),
  hint: v.optional(NotesSchema),
});

export const ExportEncryptionSchema = v.variant('kind', [ExportPbkdf2AesGcmSchema]);

export const ExportSecretsSchema = v.object({
  encryption: ExportEncryptionSchema,
  ciphertext: Base64UrlSchema,
});

// ── Top-level envelope ──────────────────────────────────────────────

export const WorkspaceExportSchema = v.object({
  kind: ExportKindSchema,
  schemaVersion: ExportSchemaVersionSchema,
  exportFormatVersion: ExportFormatVersionSchema,
  exportId: UidSchema,
  exportedAt: v.pipe(v.string(), v.isoTimestamp()),
  source: ExportSourceSchema,
  workspaceLabel: v.optional(ShortStringSchema),
  scope: ExportScopeSchema,
  notes: v.optional(NotesSchema),
  workspace: ExportWorkspaceSchema,
  entities: ExportEntitiesSchema,
  secrets: v.optional(ExportSecretsSchema),
  meta: ExportMetaSchema,
});

export type WorkspaceExport = v.InferOutput<typeof WorkspaceExportSchema>;
export type ExportEntities = v.InferOutput<typeof ExportEntitiesSchema>;
export type ExportScope = v.InferOutput<typeof ExportScopeSchema>;
export type ExportSourceApp = v.InferOutput<typeof ExportSourceAppSchema>;
export type ExportSourcePlatform = v.InferOutput<typeof ExportSourcePlatformSchema>;
export type ExportRedactionMode = v.InferOutput<typeof ExportRedactionModeSchema>;
export type ExportEncryption = v.InferOutput<typeof ExportEncryptionSchema>;
export type ExportSecrets = v.InferOutput<typeof ExportSecretsSchema>;
export type ExportWorkspaceMeta = v.InferOutput<typeof ExportWorkspaceSchema>;

/**
 * Current envelope version. Importer accepts ≤ this and refuses newer
 * (BACKWARD_TRANSITIVE per design §8.1). Bump when the envelope shape
 * changes; do not bump for entity-schema bumps (those move
 * `schemaVersion` instead).
 */
export const CURRENT_EXPORT_FORMAT_VERSION = 1;
