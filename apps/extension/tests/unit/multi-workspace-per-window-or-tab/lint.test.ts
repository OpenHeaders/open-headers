/**
 * Lint test for the multi-workspace-per-tab spike. Maps to the bug-class
 * predictions table in `docs/MULTI_WORKSPACE_PER_WINDOW_OR_TAB_DESIGN.md` § 11.2.
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
const SEAM_FILE = join(WORKBENCH_ROOT, 'hooks', 'useEditingScopeWorkspaceId.ts');
const BOOT_UTIL_FILE = join(WORKBENCH_ROOT, 'hooks', 'readBootIdentity.ts');
const RESPONSIVE_LAYOUT = join(WORKBENCH_ROOT, 'hooks', 'useResponsiveLayout.ts');
const PEER_NAVIGATE = join(REPO_ROOT, 'src', 'shared', 'awareness', 'peer-navigate.ts');
const RULE_CONTEXT = join(REPO_ROOT, 'src', 'context', 'RuleContext.tsx');
const TREE_BUILDER = join(REPO_ROOT, 'src', 'shared', 'local-tree-builder.ts');

/**
 * Files under `src/workbench/` that are still permitted to import
 * `useActiveWorkspaceId` directly. Each entry is a temporary migration
 * deferral — when the consumer is migrated to `useEditingScopeWorkspaceId`, drop
 * the entry and the lint becomes the progress meter.
 */
const BC_MWPT_3_ALLOWLIST: readonly string[] = [
  // The seam itself reads the global active id as the global-mode return value.
  'hooks/useEditingScopeWorkspaceId.ts',
  // The EditingScopeWorkspaceContext consumer hook falls back to the global read
  // for surfaces that don't mount the provider (popup, side-panel, panel).
  'hooks/EditingScopeWorkspaceContext.tsx',
  // The workspace switcher renders the DEFAULT badge on the global default's
  // row in per-window-or-tab mode — it needs both the editing-scope id (prop)
  // and the global default (this read) to compute the divergence axis.
  'components/WorkspaceSwitcher.tsx',
];

/**
 * Mount-time direct reads of oracle-owned identity (`OH.runtimeActive`
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
    expect(slice).toMatch(/===\s*['"]per-window-or-tab['"]/);
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
    // The early-return line must mention 'per-window-or-tab' near the mode read.
    expect(body.slice(modeIdx, modeIdx + 200)).toMatch(/per-window-or-tab/);
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

  it('the seam file exists and exports useEditingScopeWorkspaceId', () => {
    const text = readFileSync(SEAM_FILE, 'utf8');
    expect(text).toMatch(/export function useEditingScopeWorkspaceId/);
  });

  it('BC-MWPT-5 — RuleProvider mount in App.tsx threads activeWorkspaceIdOverride from the tab seam', () => {
    // The workbench surface mounts `<RuleProvider>` with the per-tab
    // workspace id as the override. Mutator-options builders consume
    // `useRules().activeWorkspaceId`, which mirrors the override —
    // diverged tab edits land in `wsKeys(tabWorkspace).rules`, not
    // `wsKeys(globalDefault).rules`. The sibling popup / sidepanel
    // RuleProvider mounts NEVER pass the override.
    const text = readFileSync(APP_TSX, 'utf8');
    expect(text).toMatch(
      /<RuleProvider\s+surfaceId=["']workbench["']\s+activeWorkspaceIdOverride=\{editingScopeWorkspaceId\}/,
    );
  });

  it('BC-MWPT-10 — useResponsiveLayout takes a workspaceId argument and does not read the global oracle', () => {
    const text = readFileSync(RESPONSIVE_LAYOUT, 'utf8');
    // Signature accepts the editing-scope workspace id from the caller.
    expect(text).toMatch(/export function useResponsiveLayout\(\s*workspaceId:\s*string\s*\|\s*null\s*\)/);
    // No raw `OH.runtimeActive` read — the hook stops being a
    // KNOWN_BOOT_COUPLING_READS site post-MWPT.
    expect(text).not.toMatch(/OH\.activeWorkspaceId/);
    // No standalone `workspaceChanged` subscription either; the prop
    // change drives the rebind.
    expect(text).not.toMatch(/subscribe\(\s*['"]workspaceChanged['"]/);
  });

  it('BC-MWPT-9 — peer-navigate never touches workspace-switching primitives', () => {
    // The actual gesture only focuses an existing browser tab. The
    // target tab's workbench is already bound to whatever workspace
    // its slice owner stamped — by virtue of being that tab. No new
    // tab is opened, so "fresh tab boots on global default instead of
    // target workspace" can't fire. T-elimination by construction
    // (the v1.1 prediction filed this as HN against an imagined
    // navigation handler that never landed).
    const text = readFileSync(PEER_NAVIGATE, 'utf8');
    expect(text).not.toMatch(/applySetActiveWorkspace/);
    expect(text).not.toMatch(/setActiveWorkspace/);
    expect(text).not.toMatch(/workspacesApi/);
    expect(text).not.toMatch(/perTab\.onPersist/);
  });

  it('BC-MWPT-5-READ — RuleProvider override branch subscribes wsKeys(override).{rules,collections,folders,templates,templateCollections,templateFolders} directly', () => {
    // BC-MWPT-5 in v1.1 of the spike validated WRITE-path correctness
    // (diverged edits land in `wsKeys(tabWorkspace).rules`). The READ
    // path was a known follow-up beyond the spike's table — popup-RPC
    // returns global-default-scoped rules, so an override-mode tree
    // would render the wrong workspace's data even though writes were
    // routed correctly. This lint pins the read-path fix: in override
    // mode the provider reads materialized snapshots directly per
    // SYNC_ENGINE_DESIGN.md § 9.1, the same shape pause-markers
    // already used.
    const text = readFileSync(RULE_CONTEXT, 'utf8');
    const required = ['rules', 'collections', 'folders', 'templates', 'templateCollections', 'templateFolders'] as const;
    for (const key of required) {
      // Tolerant of line-wrapped argument lists.
      const re = new RegExp(`extensionStorage\\.subscribe\\(\\s*wsKeys\\(wsId\\)\\.${key}\\b`);
      expect(text).toMatch(re);
    }
    // The override branch must NOT take rules from the popupOpen response
    // (that path is reserved for popup / sidepanel — system surfaces).
    // We assert this structurally by walking the `if (isOverridden)` arm
    // and proving it never references `resp.rules`.
    const overrideArmStart = text.indexOf('if (isOverridden) {');
    expect(overrideArmStart).toBeGreaterThan(-1);
    // Take a generous window of the override arm; the system arm
    // begins after `return;`.
    const armEnd = text.indexOf('call(\'popupOpen\')', overrideArmStart);
    expect(armEnd).toBeGreaterThan(overrideArmStart);
    const armText = text.slice(overrideArmStart, armEnd);
    expect(armText).not.toMatch(/resp\.rules/);
    expect(armText).not.toMatch(/resp\.activeWorkspaceId/);
  });

  it('BC-MWPT-5-READ — local tree builder exports the two pure composition functions', () => {
    const text = readFileSync(TREE_BUILDER, 'utf8');
    expect(text).toMatch(/export function buildLocalCollectionTrees\(/);
    expect(text).toMatch(/export function buildTemplateCollectionTrees\(/);
  });

  it('BC-MWPT-5-READ — RuleProvider override branch ignores rulesUpdated / templatesUpdated broadcasts', () => {
    // Bridge broadcasts (`rulesUpdated` / `templatesUpdated`) carry the
    // SW oracle's active-workspace data — i.e. the global default. A
    // diverged tab MUST NOT consume them; otherwise a global-default
    // mutation overwrites the diverged tab's `rules` state with the
    // wrong workspace's rules. The override branch routes through
    // chrome.storage.local.onChanged via `extensionStorage.subscribe`
    // on the override workspace's keys instead.
    const text = readFileSync(RULE_CONTEXT, 'utf8');
    // Both subscribe sites must short-circuit on isOverridden.
    expect(text).toMatch(/const unsubRules = isOverridden\s*\?\s*\(\)\s*=>\s*undefined\s*:\s*subscribe\(\s*'rulesUpdated'/);
    expect(text).toMatch(
      /const unsubTemplates = isOverridden\s*\?\s*\(\)\s*=>\s*undefined\s*:\s*subscribe\(\s*'templatesUpdated'/,
    );
  });

  it('BC-MWPT-11 — SurfaceAwarenessPublisher mount in App.tsx publishes the tab workspace id', () => {
    // Awareness is editing-scope (design § 4.1 v1.1 commitment): peers
    // see what the user is *editing* in this tab, not the tab's host
    // browser default. The lint pins the prop wiring; the publisher
    // itself receives `workspaceId` and forwards it opaquely to
    // `useAwareness`, so mount-site verification is the right axis.
    const text = readFileSync(APP_TSX, 'utf8');
    const idx = text.indexOf('<SurfaceAwarenessPublisher');
    expect(idx).toBeGreaterThan(-1);
    const block = text.slice(idx, idx + 600);
    expect(block).toMatch(/workspaceId=\{editingScopeWorkspaceId\}/);
    expect(block).not.toMatch(/workspaceId=\{workspacesApi\.activeWorkspaceId\}/);
  });
});

// ────────────────────────────────────────────────────────────────────────
// MWPT-FULL foundation lint gates (sub-commit 1e)
//
// CI gates for the seventeen-invariant contract from
// `docs/MWPT_FULL_ENTITY_MIGRATION_DESIGN.md` § 0.1. Twelve invariants
// are lint-asserted (this block); four are runtime-tested in commit 3
// I-* rows; five are doc-only reading discipline. The lints below pin
// already-shipped 1a–1d state so future refactors can't quietly regress
// the contract.
// ────────────────────────────────────────────────────────────────────────

const SYNC_SERVICE_FILE = join(REPO_ROOT, 'src', 'background', 'sync', 'service.ts');
const STORAGE_KEYS_FILE = join(REPO_ROOT, 'src', 'shared', 'storage', 'keys.ts');
const WORKSPACE_STORE_FILE = join(REPO_ROOT, 'src', 'background', 'modules', 'workspace-store.ts');
const GENERAL_SCHEMA_FILE = join(REPO_ROOT, 'src', 'workbench', 'settings', 'schema', 'general.ts');
const BACKGROUND_FILE = join(REPO_ROOT, 'src', 'background', 'background.ts');
const POPUP_DIR = join(REPO_ROOT, 'src', 'popup');
const SIDEPANEL_DIR = join(REPO_ROOT, 'src', 'sidepanel');
const DEVTOOLS_DIR = join(REPO_ROOT, 'src', 'devtools');

describe('MWPT-FULL foundation lint gates (sub-commit 1e)', () => {
  it('lint #2 — applySyncRequest brackets the per-workspace ref via .finally(releaseWorkspaceService)', () => {
    const text = readFileSync(SYNC_SERVICE_FILE, 'utf8');
    const fnIdx = text.indexOf('export function applySyncRequest');
    expect(fnIdx).toBeGreaterThan(-1);
    const body = text.slice(fnIdx, fnIdx + 4000);
    // Lazy acquire, then a `.finally(() => releaseWorkspaceService(<id>))`
    // on the same Promise chain — structural refcount bracketing.
    const acquireIdx = body.indexOf('getOrCreateWorkspaceService(');
    expect(acquireIdx).toBeGreaterThan(-1);
    const tail = body.slice(acquireIdx);
    expect(tail).toMatch(/\.finally\(\s*\(\)\s*=>\s*releaseWorkspaceService\(/);
  });

  it('lint #3 — OH.tabBindings does NOT live in the chrome.storage.local namespace', () => {
    const text = readFileSync(STORAGE_KEYS_FILE, 'utf8');
    // Per design § 4.0.3 / § 4.0.7 the per-tab binding map is workbench
    // sessionStorage canonical + SW in-memory derived from lifelines.
    // No persisted chrome.storage.local key may exist for tabBindings.
    expect(text).not.toMatch(/['"]oh\.tabBindings['"]/);
    expect(text).not.toMatch(/\btabBindings\s*:\s*storageKey/);
  });

  it('lint #6 — TopBar workspace-switcher in global mode unconditionally writes Active', () => {
    const text = readFileSync(APP_TSX, 'utf8');
    const startIdx = text.indexOf('handleSwitchWorkspace');
    expect(startIdx).toBeGreaterThan(-1);
    const slice = text.slice(startIdx, startIdx + 4000);
    // The non-per-window-or-tab branch (global mode) reaches
    // `setActiveWorkspace` unconditionally — no checkbox guard, no
    // additional mode branch. The per-window-or-tab early return is the
    // only structural exit before the global write.
    const perTabReturnIdx = slice.indexOf("if (mode === 'per-window-or-tab')");
    expect(perTabReturnIdx).toBeGreaterThan(-1);
    const globalArm = slice.slice(perTabReturnIdx);
    expect(globalArm).toMatch(/setActiveWorkspace\(targetId\)/);
  });

  it('lint #8 — stale-Active boot fallback walks Active → Default → first', () => {
    const text = readFileSync(WORKSPACE_STORE_FILE, 'utf8');
    // The `validFor` helper composes the three-link fallback chain:
    // storedActive ?? storedDefault ?? sorted-first.
    expect(text).toMatch(/const\s+validFor\s*=\s*\(/);
    expect(text).toMatch(
      /validFor\(storedActive\)\s*\?\?\s*validFor\(storedDefault\)\s*\?\?\s*\[\.\.\.workspaces\]\.sort\(/,
    );
  });

  it('lint #10 — general.workspaceServiceGracePeriodMs registered as a tunable setting', () => {
    const text = readFileSync(GENERAL_SCHEMA_FILE, 'utf8');
    expect(text).toMatch(/key:\s*['"]general\.workspaceServiceGracePeriodMs['"]/);
    // Range pinned to a sensible band (0..600_000ms) so the production
    // 30s default isn't accidentally widened to a value that defeats
    // refcount disposal.
    expect(text).toMatch(/v\.minValue\(0\)/);
    expect(text).toMatch(/v\.maxValue\(600_000\)/);
  });

  it('lint #12 — setRuntimeActive single-flight chain swallows prior failures with .catch(() => undefined)', () => {
    const text = readFileSync(SYNC_SERVICE_FILE, 'utf8');
    const fnIdx = text.indexOf('export function setRuntimeActive');
    expect(fnIdx).toBeGreaterThan(-1);
    const body = text.slice(fnIdx, fnIdx + 1000);
    // The chain MUST start with `.catch(() => undefined)` so a transient
    // failure on the prior flip can't poison the subsequent flip.
    expect(body).toMatch(/activeFlipChain\.catch\(\s*\(\)\s*=>\s*undefined\s*\)\.then\(/);
    // And the chain handle MUST be re-anchored on settle (success OR
    // failure), not just on resolve — otherwise a rejected flip leaves
    // the chain stuck and the next call wedges.
    expect(body).toMatch(/activeFlipChain\s*=\s*next\.then\(\s*\(\)\s*=>\s*undefined,\s*\(\)\s*=>\s*undefined,?\s*\)/);
  });

  it('lint #13 — boot calls setRuntimeActive(persistedActive); does not reimplement runner-attach', () => {
    const text = readFileSync(BACKGROUND_FILE, 'utf8');
    expect(text).toMatch(/await\s+setRuntimeActive\(\s*getActiveWorkspaceId\(\)\s*\)/);
    // The boot path must NOT directly call attachActiveBoundRunners or
    // attach DNR/resolver subscriptions inline — those live behind
    // setRuntimeActive's atomicity contract.
    expect(text).not.toMatch(/attachActiveBoundRunners/);
    expect(text).not.toMatch(/createDnrIntentRunner/);
    expect(text).not.toMatch(/createResolverInvalidateRunner/);
  });

  it('lint #14 — workbench mount order: workspace slice resolver fires BEFORE awareness lifeline', () => {
    const text = readFileSync(APP_TSX, 'utf8');
    // useWorkbenchWorkspaceSlice corrects a stale per-tab binding (deleted
    // workspace → fall through to Default → first) BEFORE the lifeline
    // would carry the wrong workspaceId payload to the SW. Pin the
    // textual mount order; if a refactor inverts these the lint catches
    // the regression that would invalidate the lifeline trust contract
    // (design § 4.0.7).
    const sliceIdx = text.indexOf('useWorkbenchWorkspaceSlice(');
    const lifelineIdx = text.indexOf('<AwarenessIdentityProvider');
    expect(sliceIdx).toBeGreaterThan(-1);
    expect(lifelineIdx).toBeGreaterThan(-1);
    expect(sliceIdx).toBeLessThan(lifelineIdx);
  });

  it('lint #15 — SetActiveResult is the 5-reason structured union', () => {
    const text = readFileSync(SYNC_SERVICE_FILE, 'utf8');
    const typeIdx = text.indexOf('export type SetActiveResult');
    expect(typeIdx).toBeGreaterThan(-1);
    const decl = text.slice(typeIdx, typeIdx + 1000);
    expect(decl).toMatch(/\|\s*\{\s*ok:\s*true\s*\}/);
    for (const reason of [
      'workspace-disposed',
      'workspace-not-found',
      'hydration-failed',
      'runner-attach-failed',
      'storage-failed',
    ]) {
      expect(decl).toMatch(new RegExp(`reason:\\s*['"]${reason}['"]`));
    }
  });

  it('lint #17a — exactly one dnrSubscription bookkeeping slot on WorkspaceServiceState', () => {
    const text = readFileSync(SYNC_SERVICE_FILE, 'utf8');
    // Exactly one declaration site on the interface; runner attach/detach
    // is the single mutation surface (attachActiveBoundRunners /
    // detachActiveBoundRunners). The "≤1 DNR-writing runner at a time"
    // invariant becomes structural: there's only one slot to populate.
    const decls = text.match(/\bdnrSubscription:\s*\{\s*dispose\(\):\s*void\s*\}\s*\|\s*null/g) ?? [];
    expect(decls).toHaveLength(1);
    // Mutation sites: exactly the attach/detach pair.
    expect(text).toMatch(/svc\.dnrSubscription\s*=\s*createDnrIntentRunner/);
    expect(text).toMatch(/svc\.dnrSubscription\?\.dispose\(\)/);
    expect(text).toMatch(/svc\.dnrSubscription\s*=\s*null/);
  });

  it('lint #17b — outgoing-WS subscription path does not exist as a discrete runner module yet (sub-commit 1c framing)', () => {
    // Per status doc Session 1: outgoing-ws-handler is not a separate
    // subscription-bearing module today — the websocket out-path uses
    // imperative `sendViaWebSocket`. The `outgoingWsSubscription` slot
    // stays implicit until that path becomes broadcast-driven.
    // Lint: there must be NO outgoing-ws runner factory + NO slot named
    // outgoingWsSubscription on WorkspaceServiceState. When the path
    // lands, this lint flips to mirror #17a.
    const text = readFileSync(SYNC_SERVICE_FILE, 'utf8');
    expect(text).not.toMatch(/createOutgoingWsRunner/);
    expect(text).not.toMatch(/\boutgoingWsSubscription\s*:/);
  });

  it('lint F-15 — popup / side-panel / devtools surfaces never import lifeline state or workbench sessionStorage', () => {
    const offenders: string[] = [];
    for (const dir of [POPUP_DIR, SIDEPANEL_DIR, DEVTOOLS_DIR]) {
      let files: string[];
      try {
        files = walk(dir);
      } catch {
        // Directory may not exist (e.g. devtools is a single index.ts file).
        const st = (() => {
          try {
            return statSync(dir);
          } catch {
            return null;
          }
        })();
        if (st?.isFile()) files = [dir];
        else continue;
      }
      for (const file of files) {
        const text = readFileSync(file, 'utf8');
        // Lifeline server payload + workbench tab-session sessionStorage
        // are both workbench-canonical surfaces. System surfaces read
        // Active via standard storage subscriptions; reading lifeline
        // bookkeeping or workbench's per-tab slice would couple system
        // surfaces to workbench internals.
        if (/buildLifelinePortName|oh\.awareness\.lifeline|readWorkspaceTabSession/.test(text)) {
          offenders.push(relative(REPO_ROOT, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
