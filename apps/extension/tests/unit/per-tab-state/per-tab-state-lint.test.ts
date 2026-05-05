/**
 * Per-tab-state lint — runs as part of the test suite so CI catches
 * convention violations without requiring custom Biome plugin support.
 *
 * Three rules, mapping to bug-class predictions in
 * `docs/PER_TAB_VIEW_STATE_DESIGN.md` § 16:
 *
 *   1. **Publisher gates on the claim predicate (BC-V1).** The
 *      donor-record publish path inside `use-per-tab-state.ts` must
 *      gate on `isFocusedAndVisible()` AND have a debounce timer that
 *      re-checks at fire time — i.e. the predicate appears at *both*
 *      the schedule site and the publish site.
 *
 *   2. **No raw sessionStorage writes for view-state keys.** Outside
 *      the per-tab-state module itself, no source file may touch
 *      `oh.viewState.*` directly — every read/write goes through the
 *      hook.
 *
 *   3. **Adopters call `usePerTabState` (or the surface-wrapped hook)
 *      somewhere in the surface entry.** Workbench's `useToolLayout`
 *      and panel's `usePanelToolLayout` must take a `PerTabStateApi`
 *      argument; the entry components (`App.tsx` for both surfaces)
 *      must mount `useWorkbenchPerTabState` / `usePanelPerTabState`.
 *
 * Implementation is regex-based — sufficient for the spike measurement
 * and matches the dock-layout lint's shape (BC-D4 narrowed-by-design).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = path.resolve(__dirname, '../../../src');
const PER_TAB_MODULE = path.resolve(SRC_ROOT, 'shared/per-tab-state');

function readFile(rel: string): string {
  return readFileSync(path.resolve(SRC_ROOT, rel), 'utf8');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

describe('per-tab-state lint', () => {
  it('BC-V1: schedulePublish gates on isFocusedAndVisible() at the schedule site', () => {
    const source = readFileSync(path.join(PER_TAB_MODULE, 'use-per-tab-state.ts'), 'utf8');
    // Schedule site: `if (isFocusedAndVisible()) schedulePublish(next);`
    expect(source).toMatch(/if\s*\(\s*isFocusedAndVisible\s*\(\s*\)\s*\)\s*schedulePublish/);
  });

  it('BC-V1: publishDonor re-checks isFocusedAndVisible() at fire time', () => {
    const source = readFileSync(path.join(PER_TAB_MODULE, 'use-per-tab-state.ts'), 'utf8');
    // Publish site: must early-return when not focused+visible.
    // Match shape: `if (!isFocusedAndVisible()) return;`
    expect(source).toMatch(/if\s*\(\s*!\s*isFocusedAndVisible\s*\(\s*\)\s*\)\s*return\b/);
  });

  it('BC-V1: schemaVersion bootstrap-vs-mutation logic — readDonorRecord is consulted before publish during bootstrap', () => {
    const source = readFileSync(path.join(PER_TAB_MODULE, 'use-per-tab-state.ts'), 'utf8');
    expect(source).toMatch(/readDonorRecord\s*\(/);
    // Bootstrap path publishes only when no record exists.
    expect(source).toMatch(/if\s*\(\s*!\s*existing\s*\)/);
  });

  it('outside the per-tab-state module, no source touches the view-state sessionStorage keys', () => {
    const allSources = walk(SRC_ROOT);
    const violations: string[] = [];
    for (const file of allSources) {
      if (file.startsWith(PER_TAB_MODULE)) continue;
      const src = readFileSync(file, 'utf8');
      if (/oh\.viewState\.(workbench|panel)/.test(src)) {
        violations.push(path.relative(SRC_ROOT, file));
      }
    }
    expect(violations).toEqual([]);
  });

  it('useToolLayout takes a PerTabStateApi<WorkbenchViewState> argument', () => {
    const source = readFile('workbench/hooks/useToolLayout.ts');
    expect(source).toMatch(/PerTabStateApi<WorkbenchViewState>/);
    expect(source).toMatch(/usePerTabState</);
  });

  it('BC-V21-1 + BC-V21-3: workbench wires createWorkspaceAwareResolver with fallThrough builder', () => {
    const source = readFile('workbench/hooks/useToolLayout.ts');
    expect(source).toMatch(/createWorkspaceAwareResolver</);
    expect(source).toMatch(/fallThrough\s*:/);
    // Fall-through reads `wsKeys(workspaceId).tabSession` — the
    // workspaceId argument MUST come from the resolver, not a closed-
    // over variable (BC-V21-3 — wrong-workspace fall-through).
    expect(source).toMatch(/wsKeys\(\s*workspaceId\s*\)\.tabSession/);
  });

  it('BC-V21-4: WorkbenchViewState carries a workspace slice with workspaceId', () => {
    const source = readFile('workbench/hooks/useToolLayout.ts');
    // Slice shape: workspace: WorkspaceSlice<WorkbenchWorkspaceData> | null
    expect(source).toMatch(/workspace\s*:\s*WorkspaceSlice<WorkbenchWorkspaceData>\s*\|\s*null/);
  });

  it('BC-V21-6: useEditorGroups shadow-write reads workspaceId at fire time, not closed over', () => {
    const source = readFile('workbench/hooks/useEditorGroups.ts');
    // The shadow write site reads `activeWorkspaceIdRef.current` (or
    // similar fire-time read) inside the timer callback — not from a
    // captured closure variable.
    expect(source).toMatch(/activeWorkspaceIdRef\.current/);
    expect(source).toMatch(/wsKeys\(\s*workspaceId\s*\)\.tabSession/);
  });

  it('BC-V21-3: useEditorGroups workspaceChanged handler routes via the new workspace id', () => {
    const source = readFile('workbench/hooks/useEditorGroups.ts');
    expect(source).toMatch(/workspaceChanged/);
    expect(source).toMatch(/readWorkspaceFallThroughTabSession\s*\(\s*nextId\s*\)/);
  });

  it('usePanelToolLayout takes a PerTabStateApi<PanelViewState> argument', () => {
    const source = readFile('panel/data/use-panel-tool-layout.ts');
    expect(source).toMatch(/PerTabStateApi<PanelViewState>/);
    expect(source).toMatch(/usePerTabState</);
  });

  it('workbench App.tsx mounts useWorkbenchPerTabState before rendering the shell', () => {
    const source = readFile('workbench/App.tsx');
    expect(source).toMatch(/useWorkbenchPerTabState\s*\(\s*\)/);
  });

  it('panel App.tsx mounts usePanelPerTabState and gates on ready', () => {
    const source = readFile('panel/App.tsx');
    expect(source).toMatch(/usePanelPerTabState\s*\(\s*\)/);
    expect(source).toMatch(/perTab\.ready/);
  });
});
