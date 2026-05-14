/**
 * Shared types across the preview/ modules.
 */

/**
 * Where the import flow originated. The first three (file / clipboard /
 * menu) are local-trust sources — the user has the bytes locally and
 * could read them. The remaining three (link / playground /
 * context-menu) match `source.via` on the workspace-intent envelope and
 * generally indicate lower-trust paths (deep link, playground CTA).
 *
 * `context-menu` here matches the intent picklist; the in-extension
 * "Import from file…" entry stays under `'menu'`.
 */
export type ImportPreviewSource = 'file' | 'clipboard' | 'menu' | 'link' | 'playground' | 'context-menu';
