/**
 * Storage constants for the git-based workspace format.
 *
 * Per-user state (active environment, pause markers, UI layout, response
 * history) lives under `.oh-local/` — gitignored. Per-user secrets live
 * in `*.secret.yaml` siblings — also gitignored, but the committed
 * `*.secret.yaml.template` mirror (empty values) keeps teammates aware
 * of which keys they need to populate.
 */

// ── Gitignore template ─────────────────────────────────────────────

export const GITIGNORE = `# OpenHeaders — local-only files
*.secret.yaml
!*.secret.yaml.template
.oh-local/
`;
