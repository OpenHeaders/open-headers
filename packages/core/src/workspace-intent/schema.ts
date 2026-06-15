/**
 * Valibot schema for `WorkspaceIntent` — the navigation contract.
 *
 * Every kind is a schema-validated literal-tagged object. The `kind`
 * picklist is exported so the router's reducer can exhaust via a
 * `assertNever` guard, making "adding a new intent without handling it"
 * a compile error.
 *
 * All uid-bearing kinds use the shared 8-char `UidSchema` to match the
 * rest of the persisted data model (invariant #2 in the data-model plan).
 */

import * as v from 'valibot';
import { UidSchema } from '../schemas/common';

// ── Shared sub-schemas ──────────────────────────────────────────────

/** Rule-flow scope picklist — matches the workspace's `RuleFlowScope`. */
export const RuleFlowScopeSchema = v.picklist(['this-page', 'collection', 'folder', 'all-active']);

export type RuleFlowScope = v.InferOutput<typeof RuleFlowScopeSchema>;

/** The 11 extension rule types — matches `ExtensionRuleType`. */
export const IntentRuleTypeSchema = v.picklist([
  'header',
  'block',
  'redirect',
  'query-param',
  'inject',
  'delay',
  'request-body',
  'response',
  'ws',
  'sse',
  'auth',
]);

/**
 * Docs-section id — lowercase-with-hyphens, matches how InspectorDocs
 * declares its SectionTitle ids (e.g. `doc-system-status`,
 * `keyboard-shortcuts`, `actions-mock`). Enforced at the schema layer
 * so a malformed section id can't bypass sanitation on the renderer.
 */
export const DocsSectionIdSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(64), v.regex(/^[a-z0-9][a-z0-9-]*$/));

/** Non-empty string with a sane upper bound — for hosted URLs and similar. */
const BoundedStringSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(2048));

// ── Per-kind intent shapes ──────────────────────────────────────────

export const OpenWorkspaceIntentSchema = v.object({
  kind: v.literal('open-workspace'),
});

export const OpenDocsIntentSchema = v.object({
  kind: v.literal('open-docs'),
  section: DocsSectionIdSchema,
});

export const EditRuleIntentSchema = v.object({
  kind: v.literal('edit-rule'),
  uid: UidSchema,
});

export const CreateRuleIntentSchema = v.object({
  kind: v.literal('create-rule'),
  ruleType: IntentRuleTypeSchema,
  templateKey: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  draftNonce: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  context: v.optional(
    v.object({
      collectionId: UidSchema,
      folderPath: v.optional(BoundedStringSchema),
    }),
  ),
});

export const EditEnvironmentIntentSchema = v.object({
  kind: v.literal('edit-environment'),
  uid: UidSchema,
});

/**
 * `create-environment` — request that the workbench mint a new
 * environment, then open its editor tab. Carries no payload: the
 * workbench picks the next available "New Environment (N)" name on
 * receipt, so a stale link can't collide with a name the user has
 * since reused. Same pattern as `create-live-variable`.
 *
 * Dispatched primarily from surfaces that don't host the environments
 * list themselves (devpanel toolbar, popup), which previously had to
 * route via `open-workspace-vars` as a fallback — that opened the
 * Workspace Variables tab instead of creating an env, surfacing as a
 * mis-routing bug. With this kind, those surfaces wire `+ New env`
 * directly to a structurally correct destination.
 */
export const CreateEnvironmentIntentSchema = v.object({
  kind: v.literal('create-environment'),
});

export const OpenCollectionVarsIntentSchema = v.object({
  kind: v.literal('open-collection-vars'),
  uid: UidSchema,
});

export const OpenRequestCollectionVarsIntentSchema = v.object({
  kind: v.literal('open-request-collection-vars'),
  uid: UidSchema,
});

export const OpenTemplateCollectionVarsIntentSchema = v.object({
  kind: v.literal('open-template-collection-vars'),
  uid: UidSchema,
});

export const OpenRequestEditorIntentSchema = v.object({
  kind: v.literal('open-request-editor'),
  uid: UidSchema,
});

export const OpenSettingsIntentSchema = v.object({
  kind: v.literal('open-settings'),
  target: v.optional(
    v.union([
      v.object({ settingKey: v.pipe(v.string(), v.minLength(1), v.maxLength(128)) }),
      v.object({ categoryId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)) }),
    ]),
  ),
});

export const OpenWorkspaceManagerIntentSchema = v.object({
  kind: v.literal('open-workspace-manager'),
});

/**
 * Open the export modal for the recipient's *active* workspace, scoped
 * to the whole workspace. Dispatched from popup / sidepanel surfaces
 * where the export dialog cannot live (those views are too narrow for
 * the modal). The navigator focuses or creates the workspace tab; the
 * router then drives the modal open with `scope = 'workspace'`.
 */
export const OpenExportModalIntentSchema = v.object({
  kind: v.literal('open-export-modal'),
});

/**
 * Open the workspace's "Import from file…" modal (drop zone + Browse).
 * Same hand-off pattern as `open-export-modal`: popup / sidepanel
 * dispatches, navigator routes the user into the workspace tab, the
 * router triggers the modal.
 */
export const OpenImportModalIntentSchema = v.object({
  kind: v.literal('open-import-modal'),
});

export const OpenWorkspaceVarsIntentSchema = v.object({
  kind: v.literal('open-workspace-vars'),
});

export const OpenVaultIntentSchema = v.object({
  kind: v.literal('open-vault'),
});

export const OpenRunReportIntentSchema = v.object({
  kind: v.literal('open-run-report'),
  // Test-run ids are generated via `generateUid` (8 chars) today.
  runId: UidSchema,
});

export const OpenRuleFlowIntentSchema = v.object({
  kind: v.literal('open-rule-flow'),
  scope: RuleFlowScopeSchema,
  /** Full URL the flow is scoped to; only used when `scope === 'this-page'`. */
  url: v.optional(BoundedStringSchema),
  /** Collection/folder uid when `scope` is `collection` or `folder`. */
  entityId: v.optional(UidSchema),
});

// ── Live Variables (Phase F) ───────────────────────────────────────

export const EditLiveVariableIntentSchema = v.object({
  kind: v.literal('edit-live-variable'),
  uid: UidSchema,
});

export const EditLiveWorkflowIntentSchema = v.object({
  kind: v.literal('edit-live-workflow'),
  uid: UidSchema,
});

export const CreateLiveVariableIntentSchema = v.object({
  kind: v.literal('create-live-variable'),
  /**
   * Optional pre-fill carrying a seed request for the workflow's first
   * step. Populated by the Response panel's "Capture response to live
   * variable" action so the LV editor opens with the current request
   * already bound, letting the user pick an extractor against the
   * displayed response without re-running it.
   */
  seedRequestUid: v.optional(UidSchema),
});

// ── Workspace Export — open import preview (PR 3) ──────────────────

/**
 * Inline-payload size cap. The payload is the raw base64url(gzip(YAML))
 * string carried in the hash. 32 KB is a balance: keeps URLs under most
 * browsers' 64 KB soft cap (with room for the rest of the URL) and
 * pushes anything larger through the handoff registry instead.
 *
 * Enforced on encode (refuse to mint an oversized link) and decode
 * (refuse to honor an oversized inbound link) so neither side becomes
 * a unilateral relaxation point.
 */
export const IMPORT_INLINE_PAYLOAD_MAX_BYTES = 32 * 1024;

const ImportSourceSchema = v.object({
  via: v.picklist(['link', 'playground', 'context-menu']),
});

/**
 * Open the import-preview modal with a workspace-export envelope.
 * Exactly one of `payload` / `handoffId` / `fetchUrl` must be set —
 * the three carry the YAML bytes in different ways:
 *
 *   - `payload`    — inline base64url(gzip(YAML)), bounded by
 *                    `IMPORT_INLINE_PAYLOAD_MAX_BYTES`
 *   - `handoffId`  — id pointing at an SW-registered payload (5min TTL)
 *   - `fetchUrl`   — https URL the SW will fetch (allowlisted; PR 4)
 *
 * The "exactly one" invariant is enforced via `v.check` so a malformed
 * link is rejected at the schema gate, not deeper in the renderer.
 */
export const OpenImportPreviewIntentSchema = v.pipe(
  v.object({
    kind: v.literal('open-import'),
    payload: v.optional(v.pipe(v.string(), v.maxLength(IMPORT_INLINE_PAYLOAD_MAX_BYTES))),
    handoffId: v.optional(UidSchema),
    fetchUrl: v.optional(BoundedStringSchema),
    source: v.optional(ImportSourceSchema),
  }),
  v.check(
    (i) => Number(i.payload !== undefined) + Number(i.handoffId !== undefined) + Number(i.fetchUrl !== undefined) === 1,
    'open-import requires exactly one of payload, handoffId, or fetchUrl',
  ),
);

// ── Union + kind picklist ───────────────────────────────────────────

export const WorkspaceIntentSchema = v.variant('kind', [
  OpenWorkspaceIntentSchema,
  OpenDocsIntentSchema,
  EditRuleIntentSchema,
  CreateRuleIntentSchema,
  EditEnvironmentIntentSchema,
  CreateEnvironmentIntentSchema,
  OpenCollectionVarsIntentSchema,
  OpenRequestCollectionVarsIntentSchema,
  OpenTemplateCollectionVarsIntentSchema,
  OpenRequestEditorIntentSchema,
  OpenSettingsIntentSchema,
  OpenWorkspaceManagerIntentSchema,
  OpenWorkspaceVarsIntentSchema,
  OpenVaultIntentSchema,
  OpenRunReportIntentSchema,
  OpenRuleFlowIntentSchema,
  EditLiveVariableIntentSchema,
  EditLiveWorkflowIntentSchema,
  CreateLiveVariableIntentSchema,
  OpenImportPreviewIntentSchema,
  OpenExportModalIntentSchema,
  OpenImportModalIntentSchema,
]);

export type WorkspaceIntent = v.InferOutput<typeof WorkspaceIntentSchema>;

/**
 * All valid intent kinds. Exported so the renderer reducer can exhaust
 * via `assertNever` — adding a new kind without handling it becomes a
 * compile error. Keep in sync with the variant members above.
 */
export const WORKSPACE_INTENT_KINDS = [
  'open-workspace',
  'open-docs',
  'edit-rule',
  'create-rule',
  'edit-environment',
  'create-environment',
  'open-collection-vars',
  'open-request-collection-vars',
  'open-template-collection-vars',
  'open-request-editor',
  'open-settings',
  'open-workspace-manager',
  'open-workspace-vars',
  'open-vault',
  'open-run-report',
  'open-rule-flow',
  'edit-live-variable',
  'edit-live-workflow',
  'create-live-variable',
  'open-import',
  'open-export-modal',
  'open-import-modal',
] as const;

export type WorkspaceIntentKind = (typeof WORKSPACE_INTENT_KINDS)[number];
