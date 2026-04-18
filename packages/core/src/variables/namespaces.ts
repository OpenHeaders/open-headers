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
 * Postman's flat {{X}} model. See docs/V5_FOUNDATION_PLAN.md §Phase 0 #5.
 *
 * Pure function — no I/O, no framework deps.
 */

// ── Namespace registry ─────────────────────────────────────────────

export type VariableNamespace = 'env' | 'vault' | 'collection' | 'workspace' | 'dynamic' | 'file';

/**
 * Namespaces that resolve against the user's variable scopes (the ones
 * {@link VariableResolver} already handles).
 */
export const SCOPE_NAMESPACES = ['env', 'vault', 'collection', 'workspace'] as const;
export type ScopeNamespace = (typeof SCOPE_NAMESPACES)[number];

/** Namespaces reserved but not user-scoped (handled by dedicated resolvers). */
export const RESERVED_NAMESPACES = ['dynamic', 'file'] as const;
export type ReservedNamespace = (typeof RESERVED_NAMESPACES)[number];

const ALL_NAMESPACES: readonly string[] = [...SCOPE_NAMESPACES, ...RESERVED_NAMESPACES];

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
  /** The variable name (without namespace prefix). */
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
 *   "X"          → { namespace: null, name: "X" }
 *   "env.X"      → { namespace: "env", name: "X" }
 *   "dynamic.uuid" → { namespace: "dynamic", name: "uuid" }
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
 * (or when `{{file.X}}` is referenced before the file-refs feature ships).
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
      return 'built-in dynamic variables ($timestamp, $guid, …)';
    case 'file':
      return 'file and binary references (coming in v2)';
  }
}
