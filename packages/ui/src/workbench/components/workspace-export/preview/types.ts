/**
 * Shared types across the preview/ modules.
 */

/**
 * Where the import flow originated. All sources are local-trust — the
 * user has the bytes locally (dropped/picked a file, pasted, or used the
 * "Import from file…" menu) and could read them before importing.
 */
export type ImportPreviewSource = 'file' | 'clipboard' | 'menu';
