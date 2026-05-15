/**
 * Boot-time wiring: the Electron renderer loads its HTML via
 * `BrowserWindow.loadFile(...)`, so the document base URL is already a
 * `file://` pointing at the packaged renderer dir. Relative asset paths
 * resolve against that base unchanged, which is exactly the behavior of
 * `@openheaders/core/assets`'s identity default.
 *
 * No adapter install needed for the first cut — the seam stays on the
 * identity resolver. When packaged-resource lookups outside the
 * renderer dir become necessary (e.g. icons under `build/`), we'll
 * install a real resolver here.
 */

export {};
