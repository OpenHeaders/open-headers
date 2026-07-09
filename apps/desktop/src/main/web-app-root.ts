/**
 * Where the desktop finds the Workbench web bundle it can serve on the
 * daemon bind (`backend.serveWebApp`). Packaged builds ship it as an
 * electron-builder extraResource (`<resources>/web`); dev/in-tree runs
 * resolve the monorepo sibling `apps/web/dist` directly, so a rebuilt
 * web bundle is picked up without repackaging.
 *
 * Pure path derivation + a plain-values setting read, kept apart from
 * the Electron wiring so both are unit-testable.
 */

import * as path from 'node:path';

export interface WebAppRootFacts {
  /** `app.isPackaged` — extraResource vs monorepo sibling. */
  isPackaged: boolean;
  /** `process.resourcesPath` — the packaged app's resources dir. */
  resourcesPath: string;
  /** `app.getAppPath()` — `apps/desktop` in dev. */
  appPath: string;
}

/** The directory expected to hold the web bundle's `index.html`. */
export function webAppRootCandidate(facts: WebAppRootFacts): string {
  if (facts.isPackaged) return path.join(facts.resourcesPath, 'web');
  return path.resolve(facts.appPath, '..', 'web', 'dist');
}

/** The `backend.serveWebApp` flag off a raw `OH.settingsUser` record. */
export function readServeWebApp(values: Record<string, unknown> | undefined): boolean {
  return values?.['backend.serveWebApp'] === true;
}
