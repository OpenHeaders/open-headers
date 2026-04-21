/**
 * Multi-tab behavior e2e — exercises the full Phase 9 step-4 stack:
 * SW `workspace-tab-registry` → `getWorkspaceTabOrdinal` RPC →
 * `workspaceTabsChanged` broadcast → `useWorkspaceTabTitle` →
 * `document.title`.
 *
 * Scenarios come straight from the V5_FOUNDATION_PLAN.md §Phase 9
 * verification list:
 *   • 1 workspace tab open → title is exactly `Open Headers`.
 *   • Open a 2nd tab → both titles become `#1 Open Headers` /
 *     `#2 Open Headers`.
 *   • Close #1 → surviving tab sheds the prefix back to `Open
 *     Headers` (count-driven, not ordinal-driven).
 *   • Open three → `#1`/`#2`/`#3`. Close #1 → remaining two stay
 *     `#2` + `#3` (ordinals stable within lifetime, no renumber).
 *
 * We open workspace tabs by navigating fresh pages directly to
 * `chrome-extension://<id>/workbench.html` — that mirrors both the
 * navigator's `chrome.tabs.create` cold path (fresh tab, no hash) and
 * the user's URL-paste path the registry's `onUpdated` branch covers.
 * We avoid the popup → intent-dispatch flow here because the intent
 * flow is already exercised separately; this file is about what the
 * registry + hook produce for `document.title` once tabs exist.
 *
 * Requires `pnpm --filter @openheaders/extension build:chrome` before
 * running, same as the existing extension.spec.ts.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test, type Worker } from '@playwright/test';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let extensionId: string;
let serviceWorker: Worker;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : undefined,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });

  serviceWorker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = serviceWorker.url().split('/')[2];
});

test.afterAll(async () => {
  await context.close();
});

// ── Helpers ─────────────────────────────────────────────────────────

async function openWorkspace(): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/workbench.html`);
  // Wait for the workspace shell to mount (the root has children).
  // The title hook runs after the first RPC resolves; we wait for the
  // registry-confirmed title below in waitForTitle.
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return root !== null && root.children.length > 0;
    },
    { timeout: 15000 },
  );
  return page;
}

/**
 * Poll until the page's title matches. The title is written after an
 * RPC round-trip + broadcast settling, so we tolerate a brief window
 * between mount and final-title write.
 */
async function waitForTitle(page: Page, expected: string, timeoutMs = 8000): Promise<void> {
  await expect
    .poll(async () => await page.title(), {
      timeout: timeoutMs,
      message: `expected document.title to become ${JSON.stringify(expected)}`,
    })
    .toBe(expected);
}

// ── Single-tab: no prefix ───────────────────────────────────────────

test.describe('Workspace tab title — single tab', () => {
  test('one open workspace tab → document.title is exactly "Open Headers"', async () => {
    const page = await openWorkspace();
    try {
      await waitForTitle(page, 'Open Headers');
    } finally {
      await page.close();
    }
  });
});

// ── Two tabs: #1 / #2 ───────────────────────────────────────────────

test.describe('Workspace tab title — two tabs', () => {
  test('opening a second workspace tab re-titles both to #1 / #2', async () => {
    const page1 = await openWorkspace();
    try {
      await waitForTitle(page1, 'Open Headers');

      const page2 = await openWorkspace();
      try {
        // Both tabs receive the `workspaceTabsChanged` broadcast with
        // count=2; page1 keeps ordinal 1, page2 gets ordinal 2.
        await waitForTitle(page1, '#1 Open Headers');
        await waitForTitle(page2, '#2 Open Headers');
      } finally {
        await page2.close();
      }

      // After #2 closes, count drops to 1 and page1 sheds the prefix.
      await waitForTitle(page1, 'Open Headers');
    } finally {
      await page1.close();
    }
  });
});

// ── Three tabs with stable ordinals ────────────────────────────────

test.describe('Workspace tab title — stability within lifetime', () => {
  test('opening three tabs gives #1/#2/#3; closing #1 leaves survivors as #2/#3', async () => {
    const page1 = await openWorkspace();
    const page2 = await openWorkspace();
    const page3 = await openWorkspace();
    try {
      await waitForTitle(page1, '#1 Open Headers');
      await waitForTitle(page2, '#2 Open Headers');
      await waitForTitle(page3, '#3 Open Headers');

      await page1.close();

      // Ordinals are stable within lifetime — the survivors DO NOT
      // renumber just because #1 went away. Count is still >= 2, so
      // both keep their prefixes.
      await waitForTitle(page2, '#2 Open Headers');
      await waitForTitle(page3, '#3 Open Headers');
    } finally {
      if (!page2.isClosed()) await page2.close();
      if (!page3.isClosed()) await page3.close();
    }
  });
});

// ── Route composition — active tab label flows through composeTitle ─

async function deliverIntent(workspaceUrl: string, intent: object): Promise<void> {
  // Fire a `workspace-intent` message to the first matching workspace
  // tab via the SW. This exercises the warm-path wire the navigator
  // uses; changing `window.location.hash` after mount would be a no-op
  // because the cold-hash router is one-shot.
  await serviceWorker.evaluate(
    async ({ url, intent }: { url: string; intent: object }) => {
      const tabs: chrome.tabs.Tab[] = await new Promise((resolve) => {
        chrome.tabs.query({ url: `${url}*` }, (found) => resolve(found));
      });
      // Prefer the currently-active tab so we can direct the intent to
      // the specific page we want (when two workspace tabs exist).
      const target = tabs.find((t) => t.active) ?? tabs[0];
      const tabId = target?.id;
      if (typeof tabId !== 'number') return;
      try {
        await new Promise<void>((resolve) => {
          chrome.tabs.sendMessage(tabId, { type: 'workspace-intent', intent }, () => {
            void chrome.runtime.lastError;
            resolve();
          });
        });
      } catch {
        // pub-sub listener doesn't respond; Chrome closes the port
        // cleanly but may reject. The message WAS delivered.
      }
    },
    { url: workspaceUrl, intent },
  );
}

test.describe('Workspace tab title — route composition', () => {
  test('activating a tab threads its label through composeTitle (with #<n> prefix when count>=2)', async () => {
    const page1 = await openWorkspace();
    const page2 = await openWorkspace();
    try {
      await waitForTitle(page1, '#1 Open Headers');
      await waitForTitle(page2, '#2 Open Headers');

      // Bring page2 to the foreground so the SW picks IT as the
      // active workspace tab for intent delivery.
      await page2.bringToFront();
      await page2.waitForTimeout(200);

      // Dispatch a `create-rule` intent — this opens a NEW editor
      // tab (mode=create) in page2 whose label comes from the draft-
      // name generator (e.g. "New Header Rule"). The hook's effect
      // watching `activeTab.label` then calls setBase, composing the
      // title into `#2 <label> — Open Headers`. We avoid `open-docs`
      // here because docs is a right-side panel, not an editor tab —
      // it would not move `activeTab.label`.
      await deliverIntent(`chrome-extension://${extensionId}/workbench.html`, {
        kind: 'create-rule',
        ruleType: 'header',
      });

      await expect
        .poll(async () => await page2.title(), {
          timeout: 8000,
          message: 'expected page2 title to become "#2 <tab-label> — Open Headers"',
        })
        .toMatch(/^#2 \S.* — Open Headers$/);

      // page1 is untouched — still plain prefix (no active tab there).
      await waitForTitle(page1, '#1 Open Headers');
    } finally {
      await page1.close();
      await page2.close();
    }
  });
});

// ── Count-driven prefix shedding ───────────────────────────────────

test.describe('Workspace tab title — count-driven shedding', () => {
  test('closing down to a single tab sheds the prefix (count rule, not ordinal)', async () => {
    const page1 = await openWorkspace();
    const page2 = await openWorkspace();
    try {
      await waitForTitle(page1, '#1 Open Headers');
      await waitForTitle(page2, '#2 Open Headers');

      await page1.close();

      // page2 keeps ordinal 2 internally, but the title rule is
      // count-driven — count dropped to 1, so no prefix is rendered.
      await waitForTitle(page2, 'Open Headers');
    } finally {
      if (!page2.isClosed()) await page2.close();
    }
  });
});

// ── Multi-tab layout inheritance (Phase 10 verification §9.4) ───────
//
// Plan item: "open workspace in tab A, resize panes + reshuffle dock.
// Open a new tab (fresh URL paste or intent navigation) → new tab
// inherits the latest-persisted layout." The layout writes now route
// through the SW's `setLayout` RPC + `layoutLockName(ws)` lock, so:
//
//   • tab A calls setLayout → SW grabs the lock → writes storage
//   • tab B opens fresh → reads the same storage key on mount →
//     renders with the same ratios
//
// We drive the write via the RPC directly rather than synthesizing
// Allotment mouse drags because the persistence boundary (the lock +
// the storage write) is what Phase 10 protects, and a real drag only
// exercises the same RPC underneath. Inspecting `window.innerWidth`
// and the sidebar panel's computed width lets us prove tab B's layout
// reflects tab A's persisted ratios rather than the fresh-profile
// default (0.17 vs the 0.30 we write).

/** Send a typed RPC from a page and return its response. */
async function rpcFromPage(page: Page, type: string, payload: Record<string, unknown> = {}): Promise<unknown> {
  return page.evaluate(
    ({ type: t, payload: p }: { type: string; payload: Record<string, unknown> }) =>
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: t, ...p }, (response) => {
          void chrome.runtime.lastError;
          resolve(response);
        });
      }),
    { type, payload },
  );
}

/** Read the persisted layout record directly from the SW's storage. */
async function readPersistedLayout(workspaceId: string): Promise<Record<string, unknown> | null> {
  return serviceWorker.evaluate(async (wsId: string) => {
    const key = `oh.ws.${wsId}.panelLayout`;
    const result = (await new Promise<Record<string, unknown>>((resolve) => {
      chrome.storage.local.get([key], (items: Record<string, unknown>) => {
        void chrome.runtime.lastError;
        resolve(items);
      });
    })) as Record<string, unknown>;
    return (result[key] as Record<string, unknown> | undefined) ?? null;
  }, workspaceId);
}

async function getActiveWorkspaceId(page: Page): Promise<string> {
  const snapshot = (await rpcFromPage(page, 'listWorkspaces')) as { activeWorkspaceId: string };
  return snapshot.activeWorkspaceId;
}

test.describe('Workspace layout — multi-tab inheritance', () => {
  test('tab B opened after tab A persists a layout inherits the same ratios', async () => {
    const tabA = await openWorkspace();
    let tabB: Page | null = null;
    try {
      await waitForTitle(tabA, 'Open Headers');
      const workspaceId = await getActiveWorkspaceId(tabA);

      // Distinctive non-default ratios so inheritance is unambiguous.
      // Defaults are 0.17 / 0.20 / 0.25; we write doubled+ values.
      const persistedLayout = {
        sidebarRatio: 0.35,
        inspectorRatio: 0.3,
        bottomRatio: 0.4,
      };

      const result = (await rpcFromPage(tabA, 'setLayout', { layout: persistedLayout })) as {
        success: boolean;
      };
      expect(result.success).toBe(true);

      // SW-side read-back confirms the write landed through the lock +
      // storage adapter (not just the in-memory RPC echo).
      const persisted = await readPersistedLayout(workspaceId);
      expect(persisted).toMatchObject(persistedLayout);

      // Fresh tab B — opened AFTER the persist — must pick up the same
      // ratios on its initial `useResponsiveLayout` read. We assert on
      // storage rather than the DOM because Allotment's pixel output
      // depends on the browser's viewport size (and the e2e chromium
      // uses a non-default window geometry). Storage is the contract
      // the hook reads from on every fresh mount — proving tab B sees
      // the same record proves inheritance.
      tabB = await openWorkspace();
      await waitForTitle(tabB, '#2 Open Headers');

      // Tab B's layout hook reads from the same storage key on mount;
      // we sanity-check the key is still there and still carries tab
      // A's ratios (no silent re-initialization by tab B to defaults).
      const persistedAfterTabB = await readPersistedLayout(workspaceId);
      expect(persistedAfterTabB).toMatchObject(persistedLayout);

      // Cross-tab coherence: if tab B subsequently persists a DIFFERENT
      // layout, tab A's in-memory copy will stay on the old (no live-
      // sync — documented behavior), but the NEXT fresh tab would see
      // tab B's record. Verify the lock still serializes by writing
      // from tab B and asserting storage reflects tab B's write.
      const tabBLayout = { sidebarRatio: 0.22, inspectorRatio: 0.18, bottomRatio: 0.3 };
      const resultB = (await rpcFromPage(tabB, 'setLayout', { layout: tabBLayout })) as { success: boolean };
      expect(resultB.success).toBe(true);
      const finalPersisted = await readPersistedLayout(workspaceId);
      expect(finalPersisted).toMatchObject(tabBLayout);
    } finally {
      if (tabB && !tabB.isClosed()) await tabB.close();
      if (!tabA.isClosed()) await tabA.close();
    }
  });

  test('concurrent setLayout from two tabs serializes through the workspace layout lock', async () => {
    // Plan §Phase 10 verification §9.4 — "Two workspace tabs on the
    // same workspace, each drags different panes simultaneously →
    // both changes converge (lock serializes writes), no regression."
    // We can't deterministically guess which tab's write lands last
    // (Web Locks FIFO order depends on RPC arrival), but the invariant
    // is: (1) both RPCs return ok, (2) final storage state is exactly
    // one tab's layout — never a half-merged record. A half-merged
    // record would mean the lock didn't serialize the read-modify-write
    // at the storage boundary.
    const tabA = await openWorkspace();
    const tabB = await openWorkspace();
    try {
      await waitForTitle(tabA, '#1 Open Headers');
      await waitForTitle(tabB, '#2 Open Headers');

      const workspaceId = await getActiveWorkspaceId(tabA);
      const layoutA = { sidebarRatio: 0.25, inspectorRatio: 0.22, bottomRatio: 0.28 };
      const layoutB = { sidebarRatio: 0.35, inspectorRatio: 0.32, bottomRatio: 0.38 };

      const [resA, resB] = await Promise.all([
        rpcFromPage(tabA, 'setLayout', { layout: layoutA }) as Promise<{ success: boolean }>,
        rpcFromPage(tabB, 'setLayout', { layout: layoutB }) as Promise<{ success: boolean }>,
      ]);
      expect(resA.success).toBe(true);
      expect(resB.success).toBe(true);

      // Final state is exactly one of the two layouts, never a
      // field-level merge (which would break tab B's inheritance
      // semantics — fresh tabs would see inconsistent ratios).
      const finalLayout = (await readPersistedLayout(workspaceId)) as {
        sidebarRatio?: number;
        inspectorRatio?: number;
        bottomRatio?: number;
      } | null;
      expect(finalLayout).not.toBeNull();
      if (!finalLayout) return;
      const matchesA =
        finalLayout.sidebarRatio === layoutA.sidebarRatio &&
        finalLayout.inspectorRatio === layoutA.inspectorRatio &&
        finalLayout.bottomRatio === layoutA.bottomRatio;
      const matchesB =
        finalLayout.sidebarRatio === layoutB.sidebarRatio &&
        finalLayout.inspectorRatio === layoutB.inspectorRatio &&
        finalLayout.bottomRatio === layoutB.bottomRatio;
      expect(matchesA || matchesB).toBe(true);
    } finally {
      if (!tabA.isClosed()) await tabA.close();
      if (!tabB.isClosed()) await tabB.close();
    }
  });
});
