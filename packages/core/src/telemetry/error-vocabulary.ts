/**
 * Crash-and-error-report vocabulary — the typed allowlist of the error
 * reports plan §4.3, pinned by slice 2 (2026-10-19).
 *
 * The usage channel bans the `string` type outright. A report needs
 * code identifiers, so this channel admits strings ONLY under a pinned
 * regex per field (plan §4.2 law 2) — each unable to express a URL, a
 * path, a header, whitespace, or a quote. The message never travels
 * (law 3): a report carries the error's class and the TEMPLATE its
 * message matched, never a character of the message itself. The guard
 * test (`tests/telemetry/error-report-grammar-pins.test.ts`) walks
 * these schemas and fails if a string field without a pin — or an
 * install identity on the envelope — ever appears.
 *
 * Growing a union is a deliberate, compile-checked addition; shrinking
 * one is a disclosure question. The telemetry worker reuses these
 * schemas to validate inbound envelopes and drop anything outside the
 * allowlist.
 */

import * as v from 'valibot';
import {
  TelemetryAppVersionSchema,
  TelemetryArchSchema,
  TelemetryBrowserKindSchema,
  TelemetryChannelIdSchema,
  TelemetryHostKindSchema,
  TelemetryLocaleSchema,
  TelemetryPlatformSchema,
  TelemetrySessionAgeBucketSchema,
  TelemetrySessionIdSchema,
} from './vocabulary';

export const ERROR_REPORT_SCHEMA_VERSION = 1 as const;

/** A function or component name (law 2): no dot, no slash, no space, no quote — never a path or a URL. */
export const ERROR_REPORT_IDENTIFIER_PATTERN = /^[A-Za-z_$][\w$]{0,63}$/;

/** A bundle file's basename (law 2): the release grammar's `.js` / `.mjs`, never a directory, a query, or a `.tsx` source. */
export const ERROR_REPORT_BUNDLE_PATTERN = /^[\w.-]{1,80}\.m?js$/;

/** The first 16 hex chars of a SHA-256 — a group key, not an identity. */
export const ERROR_REPORT_FINGERPRINT_PATTERN = /^[0-9a-f]{16}$/;

export const ErrorReportIdentifierSchema = v.pipe(v.string(), v.regex(ERROR_REPORT_IDENTIFIER_PATTERN));
export const ErrorReportBundleSchema = v.pipe(v.string(), v.regex(ERROR_REPORT_BUNDLE_PATTERN));
export const ErrorReportFingerprintSchema = v.pipe(v.string(), v.regex(ERROR_REPORT_FINGERPRINT_PATTERN));

/**
 * How the failure surfaced. The first three are the UI funnel's
 * origins folded onto the wire (`render` covers the uncaught, the
 * boundary-caught and the recoverable render paths — the boundary that
 * caught it is the `surface`); the last four are the desktop main
 * process's ring-0 observations (plan §3.3).
 */
export const ErrorReportKindSchema = v.picklist([
  'render-error',
  'uncaught-exception',
  'unhandled-rejection',
  'renderer-gone',
  'child-process-gone',
  'unresponsive',
  'abnormal-exit',
]);

/** The process the failure happened in — the funnel's document kinds plus the desktop's process types and the CLI. */
export const ErrorReportProcessSchema = v.picklist([
  'main',
  'renderer',
  'service-worker',
  'popup',
  'sidepanel',
  'devtools-panel',
  'offscreen',
  'gpu',
  'utility',
  'cli',
]);

/**
 * The workbench unit a render error happened in — the ring-2 boundary
 * that caught it. Mirrors the shared UI's `TabMode` ∪ `ToolWindowId`
 * (`packages/ui/src/workbench/types.ts`) as its own list so a new unit
 * is also a deliberate disclosure addition here; the extension's
 * `error-report-surface-mirror` test pins the two in sync at the type
 * level (core never imports ui). `server-admin` is both a tab mode and
 * a tool window and is one member.
 */
export const ErrorReportSurfaceSchema = v.picklist([
  // TabMode
  'edit',
  'collection-overview',
  'folder-overview',
  'template-edit',
  'settings',
  'whats-new',
  'workspace-manager',
  'server-admin',
  'env-edit',
  'spec-edit',
  'workspace-vars',
  'vault',
  'script-packages',
  'live-vars',
  'collection-vars',
  'template-collection-vars',
  'request-edit',
  'request-create',
  'grpc-edit',
  'websocket-edit',
  'mqtt-edit',
  'graphql-edit',
  'response-example',
  'grpc-response-example',
  'ws-response-example',
  'mqtt-response-example',
  'rule-create',
  'live-variable-edit',
  'live-variable-create',
  'live-workflow-edit',
  'live-workflow-create',
  'proxy-request-inspect',
  'live-network-request-inspect',
  'live-storage-doc-inspect',
  'session-replay-request-inspect',
  // ToolWindowId (minus the shared `server-admin`)
  'http-rules',
  'commit',
  'api-requests',
  'variables',
  'workflows',
  'workflow-status',
  'docs',
  'var-scope',
  'traffic-monitor',
  'activity',
  'notifications',
  'terminal',
  'git',
]);

/** The built-in error classes; a DOMException reports its spec name through `template`, anything else is `other`. */
export const ErrorReportErrorNameSchema = v.picklist([
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'DOMException',
  'AggregateError',
  'Error',
  'other',
]);

/**
 * The V8 / SpiderMonkey message templates a report may name (law 3).
 * The matcher runs on the message and keeps no character of it: the
 * `'foo'` in `reading 'foo'` can be data in the computed-key case, and
 * the frames already pinpoint the line.
 */
export const ERROR_REPORT_ENGINE_TEMPLATES = [
  'cannot-read-property',
  'cannot-set-property',
  'not-a-function',
  'not-a-constructor',
  'not-defined',
  'not-iterable',
  'access-before-init',
  'assign-to-constant',
  'max-call-stack',
  'invalid-array-length',
  'json-parse',
  'out-of-memory',
] as const;

/**
 * The DOMException names of the WebIDL spec — a thrown DOMException
 * carries its spec name as `name`, so it reports as `errorName:
 * DOMException` with the name as its template. `SyntaxError` is absent
 * on purpose: it is also a built-in class, and the built-in reading
 * wins (a JSON parse failure is the common case, a DOM one is not).
 */
export const ERROR_REPORT_DOM_EXCEPTION_NAMES = [
  'IndexSizeError',
  'HierarchyRequestError',
  'WrongDocumentError',
  'InvalidCharacterError',
  'NoModificationAllowedError',
  'NotFoundError',
  'NotSupportedError',
  'InvalidStateError',
  'InUseAttributeError',
  'InvalidModificationError',
  'NamespaceError',
  'InvalidAccessError',
  'TypeMismatchError',
  'SecurityError',
  'NetworkError',
  'AbortError',
  'URLMismatchError',
  'QuotaExceededError',
  'TimeoutError',
  'InvalidNodeTypeError',
  'DataCloneError',
  'EncodingError',
  'NotReadableError',
  'UnknownError',
  'ConstraintError',
  'DataError',
  'TransactionInactiveError',
  'ReadOnlyError',
  'VersionError',
  'OperationError',
  'NotAllowedError',
  'OptOutError',
] as const;

export const ErrorReportTemplateSchema = v.picklist([
  ...ERROR_REPORT_ENGINE_TEMPLATES,
  // React's production throw: `Minified React error #NNN`; the number travels as `reactError`.
  'react-minified',
  ...ERROR_REPORT_DOM_EXCEPTION_NAMES,
  'other',
]);

/**
 * Codes our own thrown errors carry (law 5) — grown by design
 * discussion like `TelemetryErrorCodeSchema`; the message stays local.
 * `bridge-call-failed` is the extension bridge's typed failure
 * (`BridgeError`, a message type and a reason, never data).
 */
export const ErrorReportCodeSchema = v.picklist(['bridge-call-failed']);

/**
 * Electron's own `render-process-gone` / `child-process-gone` reason
 * union (law 6: the reason and the exit code, never a minidump).
 * `memory-eviction` is the member Electron added after the plan's
 * sketch — a renderer the OS reclaimed under memory pressure.
 */
export const ErrorReportReasonSchema = v.picklist([
  'clean-exit',
  'abnormal-exit',
  'killed',
  'crashed',
  'oom',
  'launch-failed',
  'integrity-failure',
  'memory-eviction',
]);

const wholeNumber = () => v.pipe(v.number(), v.integer());
const nonNegative = () => v.pipe(v.number(), v.integer(), v.minValue(0));

/**
 * One stack frame (law 4): an own-origin bundle frame carries its file,
 * position and function name; every other frame — a user script,
 * `eval`, `blob:`, another extension's content script, Node internals,
 * a dev server's `.tsx` source — is the one `external` marker, so no
 * code outside our bundles can ever contribute an identifier.
 */
export const ErrorReportFrameSchema = v.union([
  v.strictObject({
    file: ErrorReportBundleSchema,
    line: nonNegative(),
    col: nonNegative(),
    fn: v.optional(ErrorReportIdentifierSchema),
  }),
  v.strictObject({ external: v.literal(true) }),
]);

/** Twenty frames max; the React component stack is a list of identifiers, sixteen max (law 4). */
export const ERROR_REPORT_MAX_FRAMES = 20;
export const ERROR_REPORT_MAX_COMPONENT_STACK = 16;

/** Reports per envelope (law 7). */
export const ERROR_REPORT_MAX_PER_ENVELOPE = 10;

/** Reports per session per UTC day (law 7). */
export const ERROR_REPORT_MAX_PER_DAY = 20;

/** One report serialized (law 7); over = dropped and logged, never truncated into a lie. */
export const ERROR_REPORT_MAX_BYTES = 3 * 1024;

/**
 * The report (plan §4.3, pinned). Strict: a report carrying any
 * property outside the allowlist fails validation and is dropped.
 */
export const ErrorReportSchema = v.strictObject({
  kind: ErrorReportKindSchema,
  process: ErrorReportProcessSchema,
  surface: v.optional(ErrorReportSurfaceSchema),
  errorName: v.optional(ErrorReportErrorNameSchema),
  template: v.optional(ErrorReportTemplateSchema),
  reactError: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(9999))),
  code: v.optional(ErrorReportCodeSchema),
  reason: v.optional(ErrorReportReasonSchema),
  exitCode: v.optional(wholeNumber()),
  reopenCount: v.optional(nonNegative()),
  frames: v.pipe(v.array(ErrorReportFrameSchema), v.maxLength(ERROR_REPORT_MAX_FRAMES)),
  componentStack: v.optional(
    v.pipe(v.array(ErrorReportIdentifierSchema), v.maxLength(ERROR_REPORT_MAX_COMPONENT_STACK)),
  ),
  fingerprint: ErrorReportFingerprintSchema,
  /** Occurrences folded into this report since the last flush (law 7). */
  count: v.pipe(v.number(), v.integer(), v.minValue(1)),
});

/**
 * The report envelope (law 1): the product envelope minus `events` and
 * minus `installId` / `sinceInstall`, plus `reports`. The session id is
 * random, in memory, gone at exit — crash-free sessions and distinct
 * sessions per fingerprint read without any durable identity. The
 * per-process facts are the usage envelope's (S34 `arch`, S35 majors
 * included) so a stability read segments the way a usage read does.
 */
export const ErrorReportEnvelopeSchema = v.strictObject({
  schemaVersion: v.literal(ERROR_REPORT_SCHEMA_VERSION),
  host: TelemetryHostKindSchema,
  channel: TelemetryChannelIdSchema,
  appVersion: TelemetryAppVersionSchema,
  platform: v.optional(TelemetryPlatformSchema),
  arch: v.optional(TelemetryArchSchema),
  browser: v.optional(TelemetryBrowserKindSchema),
  locale: TelemetryLocaleSchema,
  osVersion: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(9999))),
  browserVersion: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(9999))),
  sessionId: TelemetrySessionIdSchema,
  sessionAge: v.optional(TelemetrySessionAgeBucketSchema),
  sentAt: wholeNumber(),
  reports: v.pipe(v.array(ErrorReportSchema), v.minLength(1), v.maxLength(ERROR_REPORT_MAX_PER_ENVELOPE)),
});

export type ErrorReportKind = v.InferOutput<typeof ErrorReportKindSchema>;
export type ErrorReportProcess = v.InferOutput<typeof ErrorReportProcessSchema>;
export type ErrorReportSurface = v.InferOutput<typeof ErrorReportSurfaceSchema>;
export type ErrorReportErrorName = v.InferOutput<typeof ErrorReportErrorNameSchema>;
export type ErrorReportTemplate = v.InferOutput<typeof ErrorReportTemplateSchema>;
export type ErrorReportCode = v.InferOutput<typeof ErrorReportCodeSchema>;
export type ErrorReportReason = v.InferOutput<typeof ErrorReportReasonSchema>;
export type ErrorReportFrame = v.InferOutput<typeof ErrorReportFrameSchema>;
export type ErrorReport = v.InferOutput<typeof ErrorReportSchema>;
export type ErrorReportEnvelope = v.InferOutput<typeof ErrorReportEnvelopeSchema>;
