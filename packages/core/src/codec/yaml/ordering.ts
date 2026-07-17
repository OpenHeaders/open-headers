/**
 * Canonical top-level field ordering for every persisted entity.
 *
 * Matches invariant #6 — metadata top, payload nested — from
 * docs/V5_FOUNDATION_PLAN.md §Phase 0. The codec serializes known
 * fields in this order; unknown keys (preserve-unknown, invariant #4)
 * retain their original position beneath the known block.
 */

export const WORKSPACE_FIELD_ORDER = ['schemaVersion', 'uid', 'name', 'description', 'defaultEnvironmentId'] as const;

export const COLLECTION_FIELD_ORDER = [
  'schemaVersion',
  'uid',
  'name',
  'description',
  'order',
  'pinnedEnvironmentIds',
  'defaultEnvironmentId',
  'auth',
  'specLink',
  'variables',
] as const;

export const FOLDER_FIELD_ORDER = ['schemaVersion', 'uid', 'name', 'order', 'auth'] as const;

/**
 * Rule entries — shared across all 8 variants. Each variant carries its
 * own `type` literal + type-specific `action`, but the base fields
 * always serialize in this order.
 */
export const RULE_FIELD_ORDER = [
  'schemaVersion',
  'uid',
  'name',
  'type',
  'enabled',
  'published',
  'conditions',
  'action',
] as const;

export const TEMPLATE_FIELD_ORDER = [
  'schemaVersion',
  'uid',
  'name',
  'ruleType',
  'icon',
  'description',
  'includes',
  'conditions',
  'formValues',
  'createdAt',
  'updatedAt',
] as const;

/**
 * Spec manifest (`spec.yaml`): identity + scalar metadata, then the
 * file catalog. Source text never serializes into the manifest — each
 * `files[]` row's content fans out into its own verbatim sibling file
 * (see `spec.ts`).
 */
export const SPEC_FIELD_ORDER = [
  'schemaVersion',
  'uid',
  'name',
  'description',
  'format',
  'rootFileUid',
  'files',
] as const;

export const WORKSPACE_VARIABLES_FIELD_ORDER = ['schemaVersion', 'variables'] as const;

export const VAULT_FIELD_ORDER = ['schemaVersion', 'secrets'] as const;

export const ENVIRONMENT_FIELD_ORDER = ['schemaVersion', 'uid', 'name', 'variables'] as const;

export const REQUEST_FIELD_ORDER = [
  'schemaVersion',
  'uid',
  'name',
  'description',
  'method',
  'url',
  'headers',
  'params',
  'auth',
  'credentialsMode',
  'followRedirects',
  'sslVerification',
  'tlsMinVersion',
  'tlsMaxVersion',
  'tlsCipherSuites',
  'allowHttp2',
  'resolveToAddress',
  'clientCertificateRef',
  'proxyUrl',
  'proxyCredentialRef',
  'unixSocketPath',
  'cookieJar',
  'timeoutMs',
  'maxResponseBytes',
  'maxRedirects',
  'followOriginalHttpMethod',
  'followAuthorizationHeader',
  'body',
] as const;

/**
 * gRPC request manifest (`grpc.yaml`): identity + target + method +
 * metadata + spec binding. The message text never serializes into the
 * manifest — it fans out into the `message.json` sibling (see
 * `grpc-request.ts`).
 */
export const GRPC_REQUEST_FIELD_ORDER = [
  'schemaVersion',
  'uid',
  'name',
  'description',
  'url',
  'tls',
  'method',
  'metadata',
  'auth',
  'specLink',
  'timeoutMs',
  'sslVerification',
] as const;

/**
 * `path` is excluded from persisted YAML on purpose — it's the folder
 * name on disk (slug-uid), derivable from the filesystem. The runtime
 * Rule / Collection / Request value carries `path`; the codec strips it
 * on serialize and re-populates it on parse (the caller tells the codec
 * what path the document came from).
 */
export const RUNTIME_ONLY_FIELDS = ['path'] as const;

/**
 * Live Workflow manifest (`workflow.yaml`): metadata top, payload nested.
 * `steps` is a structured array — the codec carries it inline rather
 * than splitting each step into its own sibling file (kept simple for
 * v1; the typical workflow has 1–5 steps).
 *
 * Phase I — `parallelExecution` reserved field is serialized AFTER
 * `enabled` and BEFORE `refresh` so the orchestration flags cluster
 * together visually. Within each `WorkflowStep`, the step-level field
 * order is controlled by valibot's shape output and codec round-trip
 * preserves insertion; we don't re-order nested step fields.
 */
export const LIVE_WORKFLOW_FIELD_ORDER = [
  'schemaVersion',
  'uid',
  'name',
  'description',
  'enabled',
  'published',
  'parallelExecution',
  'refresh',
  'steps',
] as const;

/**
 * Live Variable manifest (`variable.yaml`): thin binding to one
 * workflow step capture.
 */
export const LIVE_VARIABLE_FIELD_ORDER = [
  'schemaVersion',
  'uid',
  'name',
  'description',
  'enabled',
  'published',
  'workflowUid',
  'stepId',
  'captureName',
  'requireFreshOnRuleBuild',
  'manualOverride',
] as const;
