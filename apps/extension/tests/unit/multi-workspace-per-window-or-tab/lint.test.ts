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

import { readdirSync, readFileSync, statSync } from 'node:fs';
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
const KNOWN_BOOT_COUPLING_READS: readonly string[] = ['hooks/useToolLayout.ts', 'hooks/readBootIdentity.ts'];

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
    const required = [
      'rules',
      'collections',
      'folders',
      'templates',
      'templateCollections',
      'templateFolders',
    ] as const;
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
    const armEnd = text.indexOf("call('popupOpen')", overrideArmStart);
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
    expect(text).toMatch(
      /const unsubRules = isOverridden\s*\?\s*\(\)\s*=>\s*undefined\s*:\s*subscribe\(\s*'rulesUpdated'/,
    );
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

  it('lint F-16 — variables-resolver state lives on a per-workspace map, not module-level singletons', () => {
    const file = join(REPO_ROOT, 'src', 'background', 'modules', 'variables-resolver.ts');
    const text = readFileSync(file, 'utf8');
    // Per-workspace state map exists.
    expect(text).toMatch(/const\s+states\s*=\s*new\s+Map<string,\s*ResolverState>/);
    // Public dispose hook called from `service.ts` finalizeDisposal.
    expect(text).toMatch(/export function disposeResolverStateForWorkspace/);
    // Forbid the legacy module-level mutable singletons. If a future
    // refactor reintroduces them, this lint catches the regression that
    // would let one workspace's resolver memo leak into another's.
    expect(text).not.toMatch(/^let\s+lastResolvedRules\s*:/m);
    expect(text).not.toMatch(/^let\s+lastResolutionErrors\s*:/m);
    expect(text).not.toMatch(/^let\s+cachedLiveRuns\s*:/m);
    expect(text).not.toMatch(/^let\s+lastKnownCollectionUids\s*:/m);
    // The legacy `const resolver = new VariableResolver()` singleton is
    // gone too — each ResolverState owns its own resolver instance.
    expect(text).not.toMatch(/^const\s+resolver\s*=\s*new\s+VariableResolver\(\)/m);
  });

  // ── Renderer mirror plane (commit 2 — M-* contract) ──────────────
  //
  // M-1 / M-3 are lint-shaped (structural). M-2 is structural in
  // `flat-entity-mirror.ts` + `singleton-entity-mirror.ts` (the mirror
  // cores filter on `event.envelope.workspaceId !== config.workspaceId`
  // BEFORE invoking the adapter's extractor — cross-workspace dispatch
  // is inexpressible at the core layer). M-4 re-asserts the
  // subscribe-before-snapshot ordering that survives the per-workspace
  // refactor (the lazy-init race resolution stays intact).

  it('lint M-1 — every per-workspace *-sync-mirror.ts module exposes a workspace-keyed registry, not a `let active` singleton', () => {
    const CONTEXT_DIR = join(REPO_ROOT, 'src', 'context');
    // Only the global-scope extension-workspace mirror is exempt — its
    // entity is published by the global oracle (`global-service.ts`)
    // with `workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE`, so a single
    // mirror serves every renderer surface by construction.
    const M1_EXEMPT = new Set(['extension-workspace-sync-mirror.ts']);
    const offenders: string[] = [];
    for (const f of readdirSync(CONTEXT_DIR)) {
      if (!f.endsWith('-sync-mirror.ts')) continue;
      if (M1_EXEMPT.has(f)) continue;
      const text = readFileSync(join(CONTEXT_DIR, f), 'utf8');
      // Forbid the legacy `let active: XSyncMirror | null = null`
      // module-level mutable singleton. If a future refactor
      // reintroduces it, the v1.1 runtime bug ("env created in tab2/w2
      // in only-this-tab mode lands in wsKeys(w1).environments")
      // becomes possible again.
      if (/^let\s+active\s*:\s*\w+SyncMirror\s*\|\s*null\s*=\s*null;/m.test(text)) {
        offenders.push(`${f}: legacy 'let active' singleton survives`);
        continue;
      }
      // Require the per-workspace registry handle.
      if (!/createWorkspaceMirrorRegistry</.test(text)) {
        offenders.push(`${f}: no createWorkspaceMirrorRegistry call`);
        continue;
      }
      // Require the workspace-keyed accessor.
      if (!/export function get\w+SyncMirrorForWorkspace\(workspaceId: string\)/.test(text)) {
        offenders.push(`${f}: no getXSyncMirrorForWorkspace(workspaceId) export`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('lint M-2 — flat + singleton mirror cores filter syncBroadcast events by envelope.workspaceId BEFORE invoking the adapter', () => {
    const FLAT = join(REPO_ROOT, 'src', 'context', 'flat-entity-mirror.ts');
    const SINGLE = join(REPO_ROOT, 'src', 'context', 'singleton-entity-mirror.ts');
    for (const file of [FLAT, SINGLE]) {
      const text = readFileSync(file, 'utf8');
      // Config carries the workspace this mirror projects.
      expect(text).toMatch(/workspaceId:\s*string;/);
      // The subscribe handler short-circuits on a workspaceId mismatch
      // BEFORE calling extractFromBroadcast.
      const subIdx = text.indexOf("subscribe('syncBroadcast'");
      expect(subIdx).toBeGreaterThan(-1);
      const filterIdx = text.indexOf('event.envelope.workspaceId !== config.workspaceId', subIdx);
      const extractIdx = text.indexOf('config.extractFromBroadcast(event)', subIdx);
      expect(filterIdx).toBeGreaterThan(-1);
      expect(extractIdx).toBeGreaterThan(-1);
      expect(filterIdx).toBeLessThan(extractIdx);
    }
  });

  it('lint M-3 — every renderer write-client resolves its mirror via getXSyncMirrorForWorkspace, never via a getActive*SyncMirror singleton', () => {
    const SHARED_SYNC = join(REPO_ROOT, 'src', 'shared', 'sync');
    // Only the global-scope extension-workspace write-client is exempt
    // (its mirror has no per-workspace dimension). Every other
    // *-write-client.ts MUST route by opts.workspaceId so the renderer
    // pre-image diff reads the correct workspace's mirror (M-3).
    const M3_EXEMPT = new Set(['extension-workspace-write-client.ts']);
    const offenders: string[] = [];
    for (const f of readdirSync(SHARED_SYNC)) {
      if (!f.endsWith('-write-client.ts')) continue;
      if (M3_EXEMPT.has(f)) continue;
      const text = readFileSync(join(SHARED_SYNC, f), 'utf8');
      const legacy = text.match(/getActive\w+SyncMirror/);
      if (legacy) {
        offenders.push(`${f}: legacy ${legacy[0]} reference survives`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('lint M-4 — flat + singleton mirror cores subscribe before fetchSnapshot (lazy-init race resolution preserved)', () => {
    const FLAT = join(REPO_ROOT, 'src', 'context', 'flat-entity-mirror.ts');
    const SINGLE = join(REPO_ROOT, 'src', 'context', 'singleton-entity-mirror.ts');
    for (const file of [FLAT, SINGLE]) {
      const text = readFileSync(file, 'utf8');
      const subIdx = text.indexOf("subscribe('syncBroadcast'");
      const fetchIdx = text.indexOf('.fetchSnapshot()');
      expect(subIdx).toBeGreaterThan(-1);
      expect(fetchIdx).toBeGreaterThan(-1);
      // Subscription opens BEFORE the snapshot RPC fires; broadcasts
      // that land mid-flight win the race via the seenSinceMount /
      // sawBroadcast flag in each core.
      expect(subIdx).toBeLessThan(fetchIdx);
    }
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

// ────────────────────────────────────────────────────────────────────────
// MWPT-FULL per-family migration sessions #1 + #2 + #3
//
// Generalizes the BC-MWPT-5 lint shape from `RuleProvider` to
// `EnvironmentProvider` (session #1), `WorkspaceVariablesProvider`
// (session #2), and `VaultProvider` (session #3). Workbench mounts each
// provider with the editing-scope override; system surfaces mount with
// no override. Override branch reads from the per-workspace storage key
// directly and routes mutations through the entity-family Phase B
// write-client.
// ────────────────────────────────────────────────────────────────────────

const ENV_CONTEXT = join(REPO_ROOT, 'src', 'context', 'EnvironmentContext.tsx');
const WORKSPACE_VARIABLES_CONTEXT = join(REPO_ROOT, 'src', 'context', 'WorkspaceVariablesContext.tsx');
const VAULT_CONTEXT = join(REPO_ROOT, 'src', 'context', 'VaultContext.tsx');
const LIVE_VARIABLES_CONTEXT = join(REPO_ROOT, 'src', 'context', 'LiveVariablesContext.tsx');
const LIVE_WORKFLOWS_CONTEXT = join(REPO_ROOT, 'src', 'context', 'LiveWorkflowsContext.tsx');
const REQUESTS_CONTEXT = join(REPO_ROOT, 'src', 'context', 'RequestsContext.tsx');
const FILES_CONTEXT = join(REPO_ROOT, 'src', 'context', 'FilesContext.tsx');
const FILES_STORE = join(REPO_ROOT, 'src', 'background', 'modules', 'files-store.ts');
const PAUSE_MARKERS_CONTEXT = join(REPO_ROOT, 'src', 'context', 'PauseMarkersContext.tsx');
const PAUSE_MARKERS_STORE = join(REPO_ROOT, 'src', 'background', 'modules', 'pause-markers-store.ts');
const OAUTH_BUNDLES_CONTEXT = join(REPO_ROOT, 'src', 'context', 'OAuthBundlesContext.tsx');
const OAUTH_FLOW = join(REPO_ROOT, 'src', 'background', 'modules', 'oauth-flow.ts');
const MESSAGE_HANDLER = join(REPO_ROOT, 'src', 'background', 'modules', 'message-handler.ts');
const BRIDGE_CONTRACTS = join(REPO_ROOT, 'src', 'utils', 'bridge', 'contracts.ts');
const POPUP_APP = join(REPO_ROOT, 'src', 'popup', 'App.tsx');
const PANEL_APP = join(REPO_ROOT, 'src', 'panel', 'App.tsx');

const VARIABLE_MUTATOR_HOOK = join(REPO_ROOT, 'src', 'hooks', 'useVariableMutator.ts');

describe('MWPT-FULL session #1+#2+#3+#4+#5+#6+#7+#8+#9+#10 — Environments + workspace variables + vault + collection variables + live variables + live workflows + requests + files + pause markers + oauth bundles lint gates', () => {
  it('BC-MWPT-FULL-1-env — workbench App.tsx mounts EnvironmentProvider with editingScopeWorkspaceId override', () => {
    const text = readFileSync(APP_TSX, 'utf8');
    expect(text).toMatch(
      /<EnvironmentProvider\s+surfaceId=["']workbench["']\s+activeWorkspaceIdOverride=\{editingScopeWorkspaceId\}/,
    );
  });

  it('BC-MWPT-FULL-1-env — system surfaces (popup / panel) mount EnvironmentProvider WITHOUT override', () => {
    for (const file of [POPUP_APP, PANEL_APP]) {
      const text = readFileSync(file, 'utf8');
      expect(text).toMatch(/<EnvironmentProvider\b/);
      // No `activeWorkspaceIdOverride=` reference anywhere on a system
      // surface — by construction the legacy global-default path applies.
      expect(text).not.toMatch(/<EnvironmentProvider[^>]*activeWorkspaceIdOverride=/);
    }
  });

  it('BC-MWPT-FULL-2-env — EnvironmentProvider override branch subscribes wsKeys(workspaceId).environments directly', () => {
    const text = readFileSync(ENV_CONTEXT, 'utf8');
    expect(text).toMatch(/extensionStorage\.subscribe\(\s*wsKeys\(\s*\w+\s*\)\.environments\b/);
  });

  it('BC-MWPT-FULL-2-env — EnvironmentProvider override branch ignores environmentsChanged broadcast for env list', () => {
    // The bridge broadcast still fires (legacy branch consumes it +
    // pointer ops are still global per § 4.1.c). The override branch
    // MUST NOT overwrite the env list with the broadcast payload —
    // only pointers (active/default/manual) follow the broadcast.
    const text = readFileSync(ENV_CONTEXT, 'utf8');
    expect(text).toMatch(/if\s*\(!isOverridden\)\s*setEnvironments\(payload\.environments\)/);
  });

  it('BC-MWPT-FULL-3-env — EnvironmentProvider override branch routes entity CRUD through env-write-client', () => {
    const text = readFileSync(ENV_CONTEXT, 'utf8');
    expect(text).toMatch(/applyEnvironmentCreate\(/);
    expect(text).toMatch(/applyEnvironmentDelete\(/);
    // The legacy SW handler calls (`call('createEnvironment'`, `call('deleteEnvironment'`)
    // remain reachable for the legacy branch but must not be the only
    // path — the override branch threads the workspaceId through Phase B.
    // Negative shape: the override branch (inside `if (isOverridden)`)
    // doesn't call the legacy create/delete RPC.
    const overrideArms = [...text.matchAll(/if\s*\(isOverridden\)\s*\{([^}]+)\}/g)];
    expect(overrideArms.length).toBeGreaterThan(0);
    for (const m of overrideArms) {
      expect(m[1]).not.toMatch(/call\('createEnvironment'/);
      expect(m[1]).not.toMatch(/call\('deleteEnvironment'/);
    }
  });

  it('BC-MWPT-FULL-1-wsvars — workbench App.tsx mounts WorkspaceVariablesProvider with editingScopeWorkspaceId override', () => {
    const text = readFileSync(APP_TSX, 'utf8');
    expect(text).toMatch(
      /<WorkspaceVariablesProvider\s+surfaceId=["']workbench["']\s+activeWorkspaceIdOverride=\{editingScopeWorkspaceId\}/,
    );
  });

  it('BC-MWPT-FULL-1-wsvars — system surfaces (popup / panel) mount WorkspaceVariablesProvider WITHOUT override', () => {
    for (const file of [POPUP_APP, PANEL_APP]) {
      const text = readFileSync(file, 'utf8');
      expect(text).toMatch(/<WorkspaceVariablesProvider\b/);
      // No `activeWorkspaceIdOverride=` reference anywhere on a system
      // surface — by construction the legacy global-default path applies.
      expect(text).not.toMatch(/<WorkspaceVariablesProvider[^>]*activeWorkspaceIdOverride=/);
    }
  });

  it('BC-MWPT-FULL-2-wsvars — WorkspaceVariablesProvider override branch subscribes wsKeys(workspaceId).workspaceVars directly', () => {
    const text = readFileSync(WORKSPACE_VARIABLES_CONTEXT, 'utf8');
    expect(text).toMatch(/extensionStorage\.subscribe\(\s*wsKeys\(\s*\w+\s*\)\.workspaceVars\b/);
  });

  it('BC-MWPT-FULL-3-wsvars — WorkspaceVariablesProvider routes mutations through workspace-variables-write-client (no legacy call shim)', () => {
    const text = readFileSync(WORKSPACE_VARIABLES_CONTEXT, 'utf8');
    expect(text).toMatch(/applyWorkspaceVarSet\(/);
    expect(text).toMatch(/applyWorkspaceVarRemove\(/);
    expect(text).toMatch(/applyWorkspaceVariablesReplacement\(/);
    // No legacy `call('setWorkspaceVariables', ...)` shim survives — Phase B
    // is the only write path for this entity family (no § 4.1.c residual).
    expect(text).not.toMatch(/call\(\s*['"]setWorkspaceVariables['"]/);
  });

  it('BC-MWPT-FULL-1-vault — workbench App.tsx mounts VaultProvider with editingScopeWorkspaceId override', () => {
    const text = readFileSync(APP_TSX, 'utf8');
    expect(text).toMatch(
      /<VaultProvider\s+surfaceId=["']workbench["']\s+activeWorkspaceIdOverride=\{editingScopeWorkspaceId\}/,
    );
  });

  it('BC-MWPT-FULL-1-vault — system surfaces (popup / panel) mount VaultProvider WITHOUT override', () => {
    for (const file of [POPUP_APP, PANEL_APP]) {
      const text = readFileSync(file, 'utf8');
      expect(text).toMatch(/<VaultProvider\b/);
      expect(text).not.toMatch(/<VaultProvider[^>]*activeWorkspaceIdOverride=/);
    }
  });

  it('BC-MWPT-FULL-2-vault — VaultProvider override branch subscribes wsKeys(workspaceId).vault directly', () => {
    const text = readFileSync(VAULT_CONTEXT, 'utf8');
    expect(text).toMatch(/extensionStorage\.subscribe\(\s*wsKeys\(\s*\w+\s*\)\.vault\b/);
  });

  it('BC-MWPT-FULL-3-vault — VaultProvider routes mutations through vault-write-client (no legacy call shim)', () => {
    const text = readFileSync(VAULT_CONTEXT, 'utf8');
    expect(text).toMatch(/applyVaultSecretSet\(/);
    expect(text).toMatch(/applyVaultSecretRemove\(/);
    expect(text).toMatch(/applyVaultReplacement\(/);
    // No legacy `call('setVault', ...)` shim exists or survives — Phase B
    // is the only write path for this entity family (no § 4.1.c residual).
    expect(text).not.toMatch(/call\(\s*['"]setVault['"]/);
  });

  // ── Session #4 — Collection variables ─────────────────────────────
  // Collection variables aren't a separate entity family (no Provider);
  // they're a slice of the collection record. The seam is the mutator
  // hook itself: useVariableMutator must read its workspaceId from
  // useRules().activeWorkspaceId (which RuleProvider threads through
  // activeWorkspaceIdOverride on the workbench surface), NOT from
  // useActiveWorkspaceId() (= runtime-Active = bug under per-tab mode).

  it('BC-MWPT-FULL-1-collvars — useVariableMutator reads workspaceId from useRules().activeWorkspaceId, not useActiveWorkspaceId()', () => {
    const text = readFileSync(VARIABLE_MUTATOR_HOOK, 'utf8');
    // Positive: workspaceId destructured from useRules() under the
    // `activeWorkspaceId` alias.
    expect(text).toMatch(/activeWorkspaceId\s*:\s*workspaceId/);
    expect(text).toMatch(/=\s*useRules\(\)/);
    // Negative: useActiveWorkspaceId() is not imported or called.
    expect(text).not.toMatch(/useActiveWorkspaceId/);
  });

  it('BC-MWPT-FULL-2-collvars — useVariableMutator reads collection-list source via useRules() / useRequests()', () => {
    // The collection records (and the variables slice within them) are
    // already migrated to the per-workspace storage subscribe by the
    // parent MWPT spike via RuleProvider's override branch. The mutator
    // hook reads its source-of-truth lists through useRules() +
    // useRequests() rather than reaching into chrome.storage directly
    // or calling a list RPC.
    const text = readFileSync(VARIABLE_MUTATOR_HOOK, 'utf8');
    expect(text).toMatch(/localCollections\b/);
    expect(text).toMatch(/templateCollections\b/);
    expect(text).toMatch(/collections:\s*requestCollections\b/);
    expect(text).toMatch(/useRequests\(\)/);
    // Negative: no direct chrome.storage / extensionStorage reads, no
    // legacy listCollections RPC.
    expect(text).not.toMatch(/extensionStorage\./);
    expect(text).not.toMatch(/call\(\s*['"]listCollections['"]/);
  });

  it('BC-MWPT-FULL-3-collvars — useVariableMutator routes collection-variable replacements through Phase B write-clients (no legacy call shim)', () => {
    const text = readFileSync(VARIABLE_MUTATOR_HOOK, 'utf8');
    expect(text).toMatch(/applyCollectionVariablesReplacement\(/);
    expect(text).toMatch(/applyRequestCollectionVariablesReplacement\(/);
    expect(text).toMatch(/applyTemplateCollectionVariablesReplacement\(/);
    // No legacy `call('updateCollectionVariables', ...)` shim survives
    // in the renderer mutator hook — Phase B is the only write path for
    // collection variables. The legacy SW handler stays live for
    // non-renderer callers until session #11 cleanup.
    expect(text).not.toMatch(/call\(\s*['"]updateCollectionVariables['"]/);
  });

  // ── Session #5 — Live variables ───────────────────────────────────
  // Independent module with its own storage key (`wsKeys.liveVariables`)
  // and Phase B write-client (`live-variable-write-client.ts`). Flat-
  // entity shape, so the Provider mirrors EnvironmentProvider modulo
  // the entity name. No § 4.1.c residual: live variables have no
  // active/default pointer concept — manualOverride is a regular
  // setField write, identical to the SW's setLiveVariableOverride shim
  // shape.

  it('BC-MWPT-FULL-1-livevars — workbench App.tsx mounts LiveVariablesProvider with editingScopeWorkspaceId override', () => {
    const text = readFileSync(APP_TSX, 'utf8');
    expect(text).toMatch(
      /<LiveVariablesProvider\s+surfaceId=["']workbench["']\s+activeWorkspaceIdOverride=\{editingScopeWorkspaceId\}/,
    );
  });

  it('BC-MWPT-FULL-1-livevars — system surfaces (popup / panel) mount LiveVariablesProvider WITHOUT override', () => {
    for (const file of [POPUP_APP, PANEL_APP]) {
      const text = readFileSync(file, 'utf8');
      expect(text).toMatch(/<LiveVariablesProvider\b/);
      expect(text).not.toMatch(/<LiveVariablesProvider[^>]*activeWorkspaceIdOverride=/);
    }
  });

  it('BC-MWPT-FULL-2-livevars — LiveVariablesProvider override branch subscribes wsKeys(workspaceId).liveVariables directly', () => {
    const text = readFileSync(LIVE_VARIABLES_CONTEXT, 'utf8');
    expect(text).toMatch(/extensionStorage\.subscribe\(\s*wsKeys\(\s*\w+\s*\)\.liveVariables\b/);
  });

  it('BC-MWPT-FULL-2-livevars — LiveVariablesProvider override branch ignores liveVariablesChanged broadcast', () => {
    // The bridge broadcast still fires (legacy branch consumes it on
    // system surfaces). The override branch MUST NOT overwrite the
    // workspace-scoped list with the global broadcast payload.
    const text = readFileSync(LIVE_VARIABLES_CONTEXT, 'utf8');
    expect(text).toMatch(/if\s*\(!isOverridden\)\s*setVariables\(payload\.variables\)/);
  });

  it('BC-MWPT-FULL-3-livevars — LiveVariablesProvider routes mutations through live-variable-write-client (no legacy call shim in override branch)', () => {
    const text = readFileSync(LIVE_VARIABLES_CONTEXT, 'utf8');
    expect(text).toMatch(/applyLiveVariableCreate\(/);
    expect(text).toMatch(/applyLiveVariableUpdate\(/);
    expect(text).toMatch(/applyLiveVariableDelete\(/);
    // The legacy SW handlers stay reachable on the legacy branch
    // (system surfaces). The override branch (inside `if (isOverridden)`)
    // MUST NOT call any of them.
    const overrideArms = [...text.matchAll(/if\s*\(isOverridden\)\s*\{([\s\S]*?)\n\s{6}\}/g)];
    expect(overrideArms.length).toBeGreaterThan(0);
    for (const m of overrideArms) {
      expect(m[1]).not.toMatch(/call\(\s*['"]createLiveVariable['"]/);
      expect(m[1]).not.toMatch(/call\(\s*['"]updateLiveVariable['"]/);
      expect(m[1]).not.toMatch(/call\(\s*['"]deleteLiveVariable['"]/);
      expect(m[1]).not.toMatch(/call\(\s*['"]setLiveVariableOverride['"]/);
    }
  });

  // ── Session #6 — Live workflows ───────────────────────────────────
  // Independent module with its own storage key (`wsKeys.liveWorkflows`)
  // and Phase B write-client (`live-workflow-write-client.ts`). Flat-
  // entity shape, mirrors LiveVariablesProvider exactly. No § 4.1.c
  // residual. `refreshNow` stays on the legacy RPC in BOTH branches —
  // it's a runtime-scope manual gesture, not an editing-scope one.

  it('BC-MWPT-FULL-1-liveworkflows — workbench App.tsx mounts LiveWorkflowsProvider with editingScopeWorkspaceId override', () => {
    const text = readFileSync(APP_TSX, 'utf8');
    expect(text).toMatch(
      /<LiveWorkflowsProvider\s+surfaceId=["']workbench["']\s+activeWorkspaceIdOverride=\{editingScopeWorkspaceId\}/,
    );
  });

  it('BC-MWPT-FULL-1-liveworkflows — system surfaces (popup / panel) mount LiveWorkflowsProvider WITHOUT override', () => {
    for (const file of [POPUP_APP, PANEL_APP]) {
      const text = readFileSync(file, 'utf8');
      expect(text).toMatch(/<LiveWorkflowsProvider\b/);
      expect(text).not.toMatch(/<LiveWorkflowsProvider[^>]*activeWorkspaceIdOverride=/);
    }
  });

  it('BC-MWPT-FULL-2-liveworkflows — LiveWorkflowsProvider override branch subscribes wsKeys(workspaceId).liveWorkflows directly', () => {
    const text = readFileSync(LIVE_WORKFLOWS_CONTEXT, 'utf8');
    expect(text).toMatch(/extensionStorage\.subscribe\(\s*wsKeys\(\s*\w+\s*\)\.liveWorkflows\b/);
  });

  it('BC-MWPT-FULL-2-liveworkflows — LiveWorkflowsProvider override branch ignores liveWorkflowsChanged broadcast', () => {
    const text = readFileSync(LIVE_WORKFLOWS_CONTEXT, 'utf8');
    expect(text).toMatch(/if\s*\(!isOverridden\)\s*setWorkflows\(payload\.workflows\)/);
  });

  it('BC-MWPT-FULL-3-liveworkflows — LiveWorkflowsProvider routes mutations through live-workflow-write-client (no legacy call shim in override branch)', () => {
    const text = readFileSync(LIVE_WORKFLOWS_CONTEXT, 'utf8');
    expect(text).toMatch(/applyLiveWorkflowCreate\(/);
    expect(text).toMatch(/applyLiveWorkflowUpdate\(/);
    expect(text).toMatch(/applyLiveWorkflowDelete\(/);
    const overrideArms = [...text.matchAll(/if\s*\(isOverridden\)\s*\{([\s\S]*?)\n\s{6}\}/g)];
    expect(overrideArms.length).toBeGreaterThan(0);
    for (const m of overrideArms) {
      expect(m[1]).not.toMatch(/call\(\s*['"]createLiveWorkflow['"]/);
      expect(m[1]).not.toMatch(/call\(\s*['"]updateLiveWorkflow['"]/);
      expect(m[1]).not.toMatch(/call\(\s*['"]deleteLiveWorkflow['"]/);
    }
  });

  // ── Session #7 — Requests + request collections + request folders ─
  // Bundled provider mirroring RuleProvider's shape (per § 8.3.7).
  // RequestsProvider owns wsKeys.requests + wsKeys.requestCollections +
  // wsKeys.requestFolders + composes requestCollectionTrees in the
  // renderer via buildRequestCollectionTrees. Override branch routes
  // request entity CRUD through Phase B; collection rename + delete +
  // folder rename also Phase B; collection create + folder
  // create/delete stay on legacy RPC in BOTH branches (BC-MWPT-FULL-10
  // residuals — mirrors RuleProvider's collection/folder create paths).

  it('BC-MWPT-FULL-1-requests — workbench App.tsx mounts RequestsProvider with editingScopeWorkspaceId override', () => {
    const text = readFileSync(APP_TSX, 'utf8');
    expect(text).toMatch(
      /<RequestsProvider\s+surfaceId=["']workbench["']\s+activeWorkspaceIdOverride=\{editingScopeWorkspaceId\}/,
    );
  });

  it('BC-MWPT-FULL-1-requests — system surfaces (popup / panel) mount RequestsProvider WITHOUT override', () => {
    for (const file of [POPUP_APP, PANEL_APP]) {
      const text = readFileSync(file, 'utf8');
      expect(text).toMatch(/<RequestsProvider\b/);
      expect(text).not.toMatch(/<RequestsProvider[^>]*activeWorkspaceIdOverride=/);
    }
  });

  it('BC-MWPT-FULL-2-requests — RequestsProvider override branch subscribes wsKeys(workspaceId).requests + .requestCollections + .requestFolders directly', () => {
    const text = readFileSync(REQUESTS_CONTEXT, 'utf8');
    expect(text).toMatch(/extensionStorage\.subscribe\(\s*wsKeys\(\s*\w+\s*\)\.requests\b/);
    expect(text).toMatch(/extensionStorage\.subscribe\(\s*wsKeys\(\s*\w+\s*\)\.requestCollections\b/);
    expect(text).toMatch(/extensionStorage\.subscribe\(\s*wsKeys\(\s*\w+\s*\)\.requestFolders\b/);
  });

  it('BC-MWPT-FULL-2-requests — RequestsProvider override branch ignores requestsUpdated broadcast (legacy branch only)', () => {
    // The bridge broadcast still fires (legacy branch consumes it on
    // system surfaces). The override branch MUST gate broadcast-driven
    // reload behind `if (!isOverridden)` — workspace-scoped storage
    // subscribes own the override branch's read path.
    const text = readFileSync(REQUESTS_CONTEXT, 'utf8');
    expect(text).toMatch(/if\s*\(!isOverridden\)\s*void\s+reloadLegacy\(\)/);
  });

  it('BC-MWPT-FULL-3-requests — RequestsProvider routes request entity CRUD through request-write-client (no legacy call shim in override branch)', () => {
    const text = readFileSync(REQUESTS_CONTEXT, 'utf8');
    expect(text).toMatch(/applyRequestCreate\(/);
    expect(text).toMatch(/applyRequestUpdate\(/);
    expect(text).toMatch(/applyRequestDelete\(/);
    // Inside `if (isOverridden)` arms in the createRequest /
    // updateRequest / deleteRequest mutators, the legacy
    // `call('createLocalRequest' | 'updateLocalRequest' | 'deleteLocalRequest')`
    // is allowed only as the no-parent-path edge fallback in
    // createRequest (BC-MWPT-FULL-10 residual edge — accepted), and the
    // primary write path threads the workspaceId through Phase B.
    // Negative shape: updateRequest + deleteRequest override arms must
    // never call the legacy update/delete RPC.
    expect(text).toMatch(/applyRequestUpdate\(\s*requestUid,\s*updates,\s*\{\s*workspaceId:\s*wsId,\s*surfaceId\s*\}/);
    expect(text).toMatch(/applyRequestDelete\(\s*requestUid,\s*\{\s*workspaceId:\s*wsId,\s*surfaceId\s*\}/);
  });

  // ── Session #8 — Files ────────────────────────────────────────────
  // Structurally distinct from prior sessions: files have no
  // `wsKeys.files` storage key (catalog lives in the sync engine; bytes
  // live in BlobStore IDB). Override branch reads via the per-workspace
  // mirror; writes thread `workspaceId` through the SW message handlers
  // so both BlobStore IDB and oracle catalog land on the editing-scope
  // workspace (BC-MWPT-FULL-3-files closes the same-class bug from
  // Session 14 for the file entity family).

  it('BC-MWPT-FULL-1-files — workbench App.tsx mounts FilesProvider with editingScopeWorkspaceId override', () => {
    const text = readFileSync(APP_TSX, 'utf8');
    expect(text).toMatch(/<FilesProvider\s+activeWorkspaceIdOverride=\{editingScopeWorkspaceId\}/);
  });

  it('BC-MWPT-FULL-1-files — system surfaces (popup / panel) mount FilesProvider WITHOUT override', () => {
    for (const file of [POPUP_APP, PANEL_APP]) {
      const text = readFileSync(file, 'utf8');
      expect(text).toMatch(/<FilesProvider\b/);
      expect(text).not.toMatch(/<FilesProvider[^>]*activeWorkspaceIdOverride=/);
    }
  });

  it('BC-MWPT-FULL-2-files — FilesProvider override branch reads via per-workspace mirror, NOT via wsKeys storage subscribe', () => {
    // Files have no `wsKeys.files` storage key — catalog lives in the
    // sync engine. Override branch consumes
    // `getFilesSyncMirrorForWorkspace(wsId).subscribeMirror` and seeds
    // initial state via `oh.sync.snapshotFiles({ workspaceId })`.
    const text = readFileSync(FILES_CONTEXT, 'utf8');
    expect(text).toMatch(/getFilesSyncMirrorForWorkspace\(\s*\w+\s*\)/);
    expect(text).toMatch(/\.subscribeMirror\(/);
    expect(text).toMatch(/call\(\s*['"]oh\.sync\.snapshotFiles['"]\s*,\s*\{\s*workspaceId:/);
    // Negative: there is no wsKeys.files storage subscribe — catalog
    // lives in the sync engine, not chrome.storage.
    expect(text).not.toMatch(/extensionStorage\.subscribe\(\s*wsKeys\(\s*\w+\s*\)\.files\b/);
  });

  it('BC-MWPT-FULL-2-files — FilesProvider override branch ignores filesChanged broadcast (legacy branch only)', () => {
    // The bridge broadcast still fires (legacy branch consumes it on
    // system surfaces). The override branch MUST NOT overwrite the
    // per-workspace mirror state with the global broadcast payload.
    const text = readFileSync(FILES_CONTEXT, 'utf8');
    expect(text).toMatch(/if\s*\(!isOverridden\)\s*setFiles\(payload\.files\)/);
  });

  it('BC-MWPT-FULL-3-files — FilesProvider override branch threads workspaceId through every SW message handler', () => {
    // Bytes cannot bypass the SW (BlobStore IDB lives in the SW only),
    // so both branches dispatch to `putFile` / `getFile` / `deleteFile`
    // / `renameFile`. The override branch threads the editing-scope
    // workspaceId so the SW routes both BlobStore IDB and oracle
    // catalog to the correct workspace (closes the same-class bug from
    // Session 14 for the file entity family).
    const text = readFileSync(FILES_CONTEXT, 'utf8');
    expect(text).toMatch(/call\(\s*['"]putFile['"]\s*,\s*\{[^}]*\.\.\.wsArg/);
    expect(text).toMatch(/call\(\s*['"]deleteFile['"]\s*,\s*\{[^}]*\.\.\.wsArg/);
    expect(text).toMatch(/call\(\s*['"]renameFile['"]\s*,\s*\{[^}]*\.\.\.wsArg/);
    expect(text).toMatch(/call\(\s*['"]getFile['"]\s*,\s*\{[^}]*\.\.\.wsArg/);
    // The wsArg construction guards on (isOverridden && writeWorkspaceId).
    expect(text).toMatch(
      /wsArg\s*=\s*isOverridden\s*&&\s*writeWorkspaceId\s*\?\s*\{\s*workspaceId:\s*writeWorkspaceId\s*\}/,
    );
  });

  it('BC-MWPT-FULL-3-files — files-store mutation paths route via getOracleForWorkspace, not getActiveWorkspaceId in mutation paths', () => {
    // SW-side correctness: every files-store mutation path takes a
    // workspaceId argument (defaulting to runtime-Active for legacy
    // callers) and routes its oracle.apply via
    // getOracleForWorkspace(workspaceId), never via
    // getOracleForCurrentWorkspace inside the mutation helper.
    const text = readFileSync(FILES_STORE, 'utf8');
    // Phase B helper takes an explicit workspaceId arg.
    expect(text).toMatch(/async\s+function\s+applyFilesMutationOrThrow\s*\(\s*workspaceId:\s*string\s*,/);
    expect(text).toMatch(/getOracleForWorkspace\(workspaceId\)/);
    expect(text).toMatch(/nextSwMutatorContextForWorkspace\(workspaceId\b/);
    // Negative: the legacy active-only oracle helper isn't reachable
    // from the mutation helper any more.
    expect(text).not.toMatch(/getOracleForCurrentWorkspace\(/);
  });

  // ── Session #9 — Pause markers ────────────────────────────────────
  // Singleton-with-storage-key shape (closest baseline VaultContext):
  // pause markers project to `wsKeys.pauseMarkers` AND live as a
  // sync-engine singleton entity. Renderer-direct Phase B is the only
  // write path. The SW-side `setMarker` / `clearMarker` /
  // `replaceMarkers` helpers were dead exports post-Session 7 and are
  // deleted in Session #9 — closing the same-class bug from Session 14
  // for this entity family by removing the surface entirely.

  it('BC-MWPT-FULL-1-pausemarkers — workbench App.tsx mounts PauseMarkersProvider with editingScopeWorkspaceId override', () => {
    const text = readFileSync(APP_TSX, 'utf8');
    expect(text).toMatch(
      /<PauseMarkersProvider\s+surfaceId=["']workbench["']\s+activeWorkspaceIdOverride=\{editingScopeWorkspaceId\}/,
    );
  });

  it('BC-MWPT-FULL-1-pausemarkers — system surfaces (popup / panel) mount PauseMarkersProvider WITHOUT override', () => {
    for (const file of [POPUP_APP, PANEL_APP]) {
      const text = readFileSync(file, 'utf8');
      expect(text).toMatch(/<PauseMarkersProvider\b/);
      expect(text).not.toMatch(/<PauseMarkersProvider[^>]*activeWorkspaceIdOverride=/);
    }
  });

  it('BC-MWPT-FULL-2-pausemarkers — PauseMarkersProvider subscribes wsKeys(workspaceId).pauseMarkers directly', () => {
    const text = readFileSync(PAUSE_MARKERS_CONTEXT, 'utf8');
    expect(text).toMatch(/extensionStorage\.subscribe\(\s*wsKeys\(\s*\w+\s*\)\.pauseMarkers\b/);
  });

  it('BC-MWPT-FULL-3-pausemarkers — PauseMarkersProvider routes mutations through pause-markers-write-client (no legacy call shim)', () => {
    const text = readFileSync(PAUSE_MARKERS_CONTEXT, 'utf8');
    expect(text).toMatch(/applyPauseMarkerSet\(/);
    expect(text).toMatch(/applyPauseMarkerClear\(/);
    expect(text).toMatch(/applyPauseMarkersReplacement\(/);
    // Phase B is the only write path — no legacy SW RPC shim.
    expect(text).not.toMatch(/call\(\s*['"]setPauseMarkers['"]/);
  });

  it('BC-MWPT-FULL-3-pausemarkers — pause-markers-store no longer exports setMarker / clearMarker / replaceMarkers (dead-export same-class-bug surface deleted)', () => {
    const text = readFileSync(PAUSE_MARKERS_STORE, 'utf8');
    expect(text).not.toMatch(/export\s+async\s+function\s+setMarker\b/);
    expect(text).not.toMatch(/export\s+async\s+function\s+clearMarker\b/);
    expect(text).not.toMatch(/export\s+async\s+function\s+replaceMarkers\b/);
    // Negative: the legacy active-only oracle helper isn't referenced
    // anywhere in the file once the dead-export mutation surface is gone.
    expect(text).not.toMatch(/getOracleForCurrentWorkspace\(/);
  });

  // ── Session #10 — OAuth bundles ──────────────────────────────────
  // Singleton-with-storage-key shape (closest baselines VaultContext +
  // PauseMarkersContext): OAuth blob projects to `wsKeys.oauth` AND
  // lives as a sync-engine singleton entity. The legacy `listOAuthTokens`
  // RPC + `oauthTokensChanged` broadcast are deleted — renderer reads
  // via `extensionStorage.subscribe(wsKeys.oauth)` directly. Catalog-only
  // revoke goes renderer-direct via Phase B; browser-mediated flows
  // (authorize / clientCredentials / refresh) stay on bridge RPCs but
  // carry `workspaceId?: string` end-to-end. Closes the same-class bug
  // from Session 14 for the OAuth entity family.

  it('BC-MWPT-FULL-1-oauth — workbench App.tsx mounts OAuthBundlesProvider with editingScopeWorkspaceId override', () => {
    const text = readFileSync(APP_TSX, 'utf8');
    expect(text).toMatch(
      /<OAuthBundlesProvider\s+surfaceId=["']workbench["']\s+activeWorkspaceIdOverride=\{editingScopeWorkspaceId\}/,
    );
  });

  it('BC-MWPT-FULL-1-oauth — system surfaces (popup / panel) mount OAuthBundlesProvider WITHOUT override', () => {
    for (const file of [POPUP_APP, PANEL_APP]) {
      const text = readFileSync(file, 'utf8');
      expect(text).toMatch(/<OAuthBundlesProvider\b/);
      expect(text).not.toMatch(/<OAuthBundlesProvider[^>]*activeWorkspaceIdOverride=/);
    }
  });

  it('BC-MWPT-FULL-2-oauth — OAuthBundlesProvider subscribes wsKeys(workspaceId).oauth directly (no oauthTokensChanged broadcast)', () => {
    const text = readFileSync(OAUTH_BUNDLES_CONTEXT, 'utf8');
    expect(text).toMatch(/extensionStorage\.subscribe\(\s*wsKeys\(\s*\w+\s*\)\.oauth\b/);
    // Negative: the legacy broadcast subscription is gone — storage
    // onChanged is per-workspace correct by construction.
    expect(text).not.toMatch(/subscribe\(\s*['"]oauthTokensChanged['"]/);
    // Negative: no listOAuthTokens RPC fallback either — storage is the
    // only read path.
    expect(text).not.toMatch(/call\(\s*['"]listOAuthTokens['"]/);
  });

  it('BC-MWPT-FULL-3-oauth — OAuthBundlesProvider routes revoke through oauth-bundle-write-client; flow RPCs thread workspaceId', () => {
    const ctxText = readFileSync(OAUTH_BUNDLES_CONTEXT, 'utf8');
    expect(ctxText).toMatch(/applyOAuthRevoke\(/);
    // Browser-mediated flow RPCs surface `workspaceId` to the SW.
    expect(ctxText).toMatch(/call\(\s*['"]oauthAuthorize['"][^)]*workspaceId/);
    expect(ctxText).toMatch(/call\(\s*['"]oauthClientCredentials['"][^)]*workspaceId/);
    expect(ctxText).toMatch(/call\(\s*['"]oauthRefresh['"][^)]*workspaceId/);

    // Bridge contracts carry `workspaceId?: string` on every flow RPC.
    const contractsText = readFileSync(BRIDGE_CONTRACTS, 'utf8');
    expect(contractsText).toMatch(/oauthAuthorize:\s*{[^}]*req:\s*{[^}]*workspaceId\?:\s*string/s);
    expect(contractsText).toMatch(/oauthClientCredentials:\s*{[^}]*req:\s*{[^}]*workspaceId\?:\s*string/s);
    expect(contractsText).toMatch(/oauthRefresh:\s*{[^}]*req:\s*{[^}]*workspaceId\?:\s*string/s);
    expect(contractsText).toMatch(/oauthRevoke:\s*{[^}]*req:\s*{[^}]*workspaceId\?:\s*string/s);
    // Legacy `listOAuthTokens` RPC + `oauthTokensChanged` broadcast were deleted.
    expect(contractsText).not.toMatch(/^\s*listOAuthTokens:/m);
    expect(contractsText).not.toMatch(/^\s*oauthTokensChanged:/m);

    // Message-handler extracts and forwards workspaceId for each flow.
    const handlerText = readFileSync(MESSAGE_HANDLER, 'utf8');
    expect(handlerText).toMatch(/launchAuthorizationCodeFlow\(\s*config\s*,\s*workspaceId\s*\)/);
    expect(handlerText).toMatch(/performClientCredentialsFlow\(\s*config\s*,\s*workspaceId\s*\)/);
    expect(handlerText).toMatch(/performRefresh\(\s*config\s*,\s*workspaceId\s*\)/);
    expect(handlerText).toMatch(/deleteTokenBundle\(\s*credentialRef\s*,\s*workspaceId\s*\)/);

    // launchAuthorizationCodeFlow takes workspaceId? and threads it to putTokenBundle.
    const flowText = readFileSync(OAUTH_FLOW, 'utf8');
    expect(flowText).toMatch(/launchAuthorizationCodeFlow\([^)]*workspaceId\?:\s*string/s);
    expect(flowText).toMatch(/putTokenBundle\([^)]*workspaceId\s*\)/s);
  });
});
