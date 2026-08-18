/**
 * Variable reference namespaces.
 *
 * A {{reference}} inside a URL/header/body/rule-value can be either:
 *   - **Implicit** — `{{X}}` walks the 4-scope resolution chain
 *     (vault → environment → collection → workspace).
 *   - **Explicit** — `{{<namespace>.X}}` restricts resolution to that
 *     namespace and fails loudly if the variable is absent from it.
 *
 * Explicit namespaces remove the "where does this value come from?"
 * ambiguity at the reference site — the single biggest UX failure of
 * Postman's flat {{X}} model. See the v5 foundation plan §Phase 0 #5.
 *
 * Pure function — no I/O, no framework deps.
 */

// ── Namespace registry ─────────────────────────────────────────────

export type VariableNamespace = 'env' | 'vault' | 'collection' | 'workspace' | 'dynamic' | 'file' | 'live' | 'step';

/**
 * Namespaces that resolve against the user's variable scopes (the ones
 * {@link VariableResolver} already handles).
 *
 * `file` resolves to the content-addressed hash (`sha256:<hex>`)
 * string — not the bytes. See `@openheaders/core/files`. It lives in
 * the scope list (not the reserved list) because v1 ships the
 * resolution; binary attachment is a separate concern handled by the
 * executor at send time.
 *
 * `live` resolves to the cached extracted value of a Live Variable —
 * see the live-variables plan. Callers provide a `LiveRegistry`
 * snapshot to the resolver; a missing or stale entry surfaces through
 * structured resolution errors.
 *
 * `step` resolves captured values from an in-flight Live Workflow
 * chain — `{{step.<stepId>.<captureName>}}`. Only meaningful while a
 * chain is executing. Outside that context (rules, regular requests),
 * the resolver surfaces a `step-out-of-context` structured error.
 *
 * `dynamic` resolves built-in generators (`{{dynamic.uuid}}`,
 * `{{dynamic.timestamp}}`, …) — see `./dynamic.ts`. A fresh value is
 * produced on every resolution pass.
 */
export const SCOPE_NAMESPACES = ['env', 'vault', 'collection', 'workspace', 'file', 'live', 'step', 'dynamic'] as const;
export type ScopeNamespace = (typeof SCOPE_NAMESPACES)[number];

const ALL_NAMESPACES: readonly string[] = SCOPE_NAMESPACES;

export function isVariableNamespace(s: string): s is VariableNamespace {
  return ALL_NAMESPACES.includes(s);
}

// ── Reference parsing ──────────────────────────────────────────────

/**
 * A single `{{...}}` reference. `namespace === null` means the flat form
 * `{{X}}` (caller walks the 4-scope chain). An explicit but unknown
 * namespace (e.g. `{{foo.X}}`) surfaces as a parse error — the
 * {@link parseReference} caller emits a structured resolution error
 * rather than silently falling through.
 */
export interface VariableReference {
  /** `null` = flat form; otherwise the explicit namespace. */
  namespace: VariableNamespace | null;
  /** The variable name (without namespace prefix). Note: for `step` refs this
   *  carries the combined `<stepId>.<captureName>` string — the resolver
   *  splits further on the remaining dot. */
  name: string;
  /** The full raw text between the braces (trimmed). Useful for diagnostics. */
  raw: string;
}

export type ParseResult =
  | { ok: true; ref: VariableReference }
  | { ok: false; reason: 'empty' | 'unknown-namespace'; raw: string; namespace?: string };

/**
 * Parse the contents of a {{…}} reference.
 *
 * Accepted forms:
 *   "X"                      → { namespace: null, name: "X" }
 *   "env.X"                  → { namespace: "env", name: "X" }
 *   "live.authToken"         → { namespace: "live", name: "authToken" }
 *   "step.login.sessionId"   → { namespace: "step", name: "login.sessionId" }
 *   "dynamic.uuid"           → { namespace: "dynamic", name: "uuid" }
 *
 * Rejected:
 *   ""           → empty
 *   "foo.X"      → unknown-namespace
 *
 * The parser is intentionally strict about the set of namespaces so
 * that typos fail loudly at resolution time, not silently at runtime.
 */
export function parseReference(inner: string): ParseResult {
  const raw = inner.trim();
  if (!raw) return { ok: false, reason: 'empty', raw };

  const dot = raw.indexOf('.');
  if (dot === -1) {
    return { ok: true, ref: { namespace: null, name: raw, raw } };
  }

  const namespace = raw.slice(0, dot);
  const name = raw.slice(dot + 1);

  // Dot present but name is empty (e.g. "env.") — treat as empty.
  if (!name) return { ok: false, reason: 'empty', raw };

  if (!isVariableNamespace(namespace)) {
    return { ok: false, reason: 'unknown-namespace', raw, namespace };
  }

  return { ok: true, ref: { namespace, name, raw } };
}

/**
 * Best-effort hint shown to users when they type an unknown namespace
 * (or when a namespace feature isn't available in the current context).
 */
export function describeNamespace(ns: VariableNamespace): string {
  switch (ns) {
    case 'env':
      return 'active environment';
    case 'vault':
      return 'local vault (per-user secrets)';
    case 'collection':
      return 'current collection';
    case 'workspace':
      return 'workspace-wide variables';
    case 'dynamic':
      return 'built-in dynamic generators ({{dynamic.uuid}}, {{dynamic.timestamp}}, …)';
    case 'file':
      return 'uploaded file references (by filename or sha256 hash)';
    case 'live':
      return 'auto-refreshing Live Variables (extracted from request responses)';
    case 'step':
      return 'Live Workflow step captures — {{step.<stepId>.<captureName>}}';
  }
}

// ── Step-reference helper ──────────────────────────────────────────

/**
 * Split a step-reference name into its `(stepId, captureName)` pair.
 *
 * `{{step.<stepId>.<captureName>}}` carries `stepId.captureName` in the
 * reference's `name` field. The helper returns `null` for malformed
 * names (missing dot, empty segment). stepIds and capture names must
 * not contain dots (enforced at the schema layer).
 */
export interface StepRefParts {
  stepId: string;
  captureName: string;
}

export function parseStepRefName(name: string): StepRefParts | null {
  const dot = name.indexOf('.');
  if (dot === -1) return null;
  const stepId = name.slice(0, dot);
  const captureName = name.slice(dot + 1);
  if (!stepId || !captureName) return null;
  if (captureName.includes('.')) {
    // Defensive — multiple dots in the name aren't supported. The
    // second segment must be a single capture name.
    return null;
  }
  return { stepId, captureName };
}
