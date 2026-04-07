/**
 * Storage constants for the git-based workspace format.
 *
 * The reader/writer layer handles YAML serialization.
 * No per-file wrapper types needed — types in request.ts, rule.ts, etc.
 * represent the in-memory model directly.
 */

// ── Gitignore template ─────────────────────────────────────────────

export const V5_GITIGNORE = `# OpenHeaders — local-only files
*.secret.yaml
.active-environment
.responses/
`;
