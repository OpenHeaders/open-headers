/**
 * Lint test for the multi-workspace-per-tab spike. Maps to the bug-class
 * predictions table in `docs/MULTI_WORKSPACE_PER_TAB_DESIGN.md` § 11.2.
 *
 * Asserted bug classes:
 *
 *   - **BC-MWPT-1** — `WorkspaceSwitcher` switch handler branches on
 *     `getSetting('general.workspaceSwitchScope')`; the per-tab branch
 *     does NOT call `setActiveWorkspace`.
 *   - **BC-MWPT-2 / BC-MWPT-8** — slice-owner's `workspaceChanged`
 *     callback reads the mode via `getSetting(` *inside* the callback
 *     body and returns early on per-tab mode BEFORE calling
 *     `readWorkspaceFallThrough` / `onPersist`.
 *   - **BC-MWPT-3** — no direct `useActiveWorkspaceId` import inside
 *     `apps/extension/src/workbench/**` outside the seam (with an
 *     explicit allowlist for files awaiting migration).
 *   - **KNOWN_BOOT_COUPLING_READS** (design § 9.1) — only allowlisted
 *     files import `readGlobalActiveWorkspaceId` /
 *     `readWorkspaceTabSession`. New mount-time identity reads must
 *     touch this enumeration.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..');
const WORKBENCH_ROOT = join(REPO_ROOT, 'src', 'workbench');
const SLICE_OWNER = join(WORKBENCH_ROOT, 'hooks', 'useWorkbenchWorkspaceSlice.ts');
const APP_TSX = join(WORKBENCH_ROOT, 'App.tsx');
const SEAM_FILE = join(WORKBENCH_ROOT, 'hooks', 'useTabWorkspaceId.ts');
const BOOT_UTIL_FILE = join(WORKBENCH_ROOT, 'hooks', 'readBootIdentity.ts');

/**
 * Files under `src/workbench/` that are still permitted to import
 * `useActiveWorkspaceId` directly. Each entry is a temporary migration
 * deferral — when the consumer is migrated to `useTabWorkspaceId`, drop
 * the entry and the lint becomes the progress meter.
 */
const BC_MWPT_3_ALLOWLIST: readonly string[] = [
  // The seam itself reads the global active id as the global-mode return value.
  'hooks/useTabWorkspaceId.ts',
  // The TabWorkspaceContext consumer hook falls back to the global read
  // for surfaces that don't mount the provider (popup, side-panel, panel).
  'hooks/TabWorkspaceContext.tsx',
  // The divergence pill reads the global default explicitly to compute
  // the diff — that's the whole point of the component.
  'components/WorkspaceDivergencePill.tsx',
];

/**
 * Mount-time direct reads of oracle-owned identity (`OH.activeWorkspaceId`
 * / `wsKeys(...)` shadows) — design § 9.1 + design § 11.2 BC-MWPT-10.
 * Only files in this set may import `readGlobalActiveWorkspaceId` or
 * `readWorkspaceTabSession`. Adding a new boot-coupling read site means
 * extending this list AND the comment in `readBootIdentity.ts`.
 */
const KNOWN_BOOT_COUPLING_READS: readonly string[] = [
  'hooks/useToolLayout.ts',
  'hooks/readBootIdentity.ts',
];

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (st.isFile() && /\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

function rel(absPath: string): string {
  return relative(WORKBENCH_ROOT, absPath).split('\\').join('/');
}

describe('multi-workspace-per-tab lint', () => {
  it('BC-MWPT-1 — App.tsx workspace gesture branches on the mode setting and the per-tab branch skips setActiveWorkspace', () => {
    const text = readFileSync(APP_TSX, 'utf8');
    // Find the handleSwitchWorkspace callback body. Cheap balanced-paren
    // walk: locate the function start and read until the first balanced
    // close at depth 0. The lint shape is "the body branches on
    // workspaceSwitchScope; the per-tab arm does not call setActiveWorkspace".
    const startIdx = text.indexOf('handleSwitchWorkspace');
    expect(startIdx).toBeGreaterThan(-1);
    const slice = text.slice(startIdx, startIdx + 4000);
    expect(slice).toMatch(/getSetting\(\s*['"]general\.workspaceSwitchScope['"]\s*\)/);
    expect(slice).toMatch(/===\s*['"]per-tab['"]/);
    // Per-tab branch must hit perTab.onPersist (slice write) — not the oracle.
    expect(slice).toMatch(/perTab\.onPersist/);
  });

  it('BC-MWPT-2 / BC-MWPT-8 — slice owner reads the mode inside the callback and returns early on per-tab', () => {
    const text = readFileSync(SLICE_OWNER, 'utf8');
    // The `subscribe('workspaceChanged', (payload) => { ... })` body must:
    //   (a) reference getSetting('general.workspaceSwitchScope') BEFORE
    //   (b) any call to readWorkspaceFallThrough / onPersist.
    const subStart = text.indexOf("subscribe('workspaceChanged'");
    expect(subStart).toBeGreaterThan(-1);
    const body = text.slice(subStart);
    const modeIdx = body.search(/getSetting\(\s*['"]general\.workspaceSwitchScope['"]\s*\)/);
    const fallThroughIdx = body.indexOf('readWorkspaceFallThrough');
    const persistIdx = body.indexOf('onPersist');
    expect(modeIdx).toBeGreaterThan(-1);
    expect(fallThroughIdx).toBeGreaterThan(-1);
    expect(persistIdx).toBeGreaterThan(-1);
    expect(modeIdx).toBeLessThan(fallThroughIdx);
    expect(modeIdx).toBeLessThan(persistIdx);
    // The early-return line must mention 'per-tab' near the mode read.
    expect(body.slice(modeIdx, modeIdx + 200)).toMatch(/per-tab/);
  });

  it('BC-MWPT-3 — workbench tree imports useActiveWorkspaceId only via the seam or allowlist', () => {
    const allowSet = new Set(BC_MWPT_3_ALLOWLIST);
    const offenders: string[] = [];
    for (const file of walk(WORKBENCH_ROOT)) {
      const r = rel(file);
      if (allowSet.has(r)) continue;
      const text = readFileSync(file, 'utf8');
      // Match the literal import — comments mentioning the hook name
      // are ignored. We require the `import` keyword in the same line.
      const importMatch = text.match(/^[^\n]*import[^\n]*useActiveWorkspaceId[^\n]*$/m);
      if (importMatch) offenders.push(`${r}: ${importMatch[0].trim()}`);
    }
    expect(offenders).toEqual([]);
  });

  it('KNOWN_BOOT_COUPLING_READS — only allowlisted files import the boot-identity utility', () => {
    const allowSet = new Set(KNOWN_BOOT_COUPLING_READS);
    const offenders: string[] = [];
    for (const file of walk(WORKBENCH_ROOT)) {
      const r = rel(file);
      if (file === BOOT_UTIL_FILE) continue;
      const text = readFileSync(file, 'utf8');
      if (/import[^\n]*\breadGlobalActiveWorkspaceId\b/.test(text)) {
        if (!allowSet.has(r)) offenders.push(r);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the seam file exists and exports useTabWorkspaceId', () => {
    const text = readFileSync(SEAM_FILE, 'utf8');
    expect(text).toMatch(/export function useTabWorkspaceId/);
  });
});
