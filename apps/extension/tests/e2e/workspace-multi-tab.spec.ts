/**
 * Multi-tab behavior e2e — exercises the full Phase 9 step-4 stack:
 * SW `workspace-tab-registry` → `getWorkspaceTabOrdinal` RPC →
 * `workspaceTabsChanged` broadcast → `useWorkspaceTabTitle` →
 * `document.title`.
 *
 * Scenarios come straight from the v5 foundation plan §Phase 9
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
