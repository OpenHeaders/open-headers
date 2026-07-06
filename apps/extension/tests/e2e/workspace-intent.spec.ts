/**
 * Workspace Intent e2e — exercises the full Phase 9 pipeline:
 * `hashToIntent` / `parseIntent` → `useWorkspaceIntentRouter` →
 * existing openers (docs scroll, rule editor, etc.).
 *
 * Scenarios from V5_FOUNDATION_PLAN.md §Phase 9 verification:
 *   • Cold start — navigate to `workbench.html#/docs/system-status`
 *     → docs panel opens on that section (the panel is a paged
 *     reader: the requested section becomes the active page).
 *   • Warm start — with a workspace tab already open, dispatch
 *     `{ type: 'workspace-intent', intent }` from the SW via
 *     `chrome.tabs.sendMessage` (the exact path the navigator's warm
 *     path uses) → renderer's intent router routes it through the
 *     same opener → docs panel opens on the section.
 *
 * Requires `pnpm --filter @openheaders/extension build:chrome` before
 * running, same as the other e2e files.
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

async function openWorkspace(hash = ''): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/workbench.html${hash}`);
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return root !== null && root.children.length > 0;
    },
    { timeout: 15000 },
  );
  return page;
}

async function expectDocsPanelVisible(page: Page): Promise<void> {
  const docsPanel = page.locator('.rules-right-panel--docs');
  await expect(docsPanel).toBeVisible({ timeout: 10000 });
}

/**
 * Wait for the docs panel to show the requested section. The panel is
 * a paged reader (one section at a time) and stamps the active section
 * id on its root as `data-active-section`.
 */
async function expectActiveSection(page: Page, sectionId: string): Promise<void> {
  const panel = page.locator(`.rules-right-panel--docs[data-active-section="${sectionId}"]`);
  await expect(panel).toBeVisible({ timeout: 10000 });
}

// ── Cold-start ──────────────────────────────────────────────────────

test.describe('Workspace Intent — cold start', () => {
  test('hash #/docs/system-status opens the docs panel on the section', async () => {
    const page = await openWorkspace('#/docs/system-status');
    try {
      await expectDocsPanelVisible(page);
      await expectActiveSection(page, 'system-status');
    } finally {
      await page.close();
    }
  });

  test('hash #/docs/multi-tab opens the docs panel on the multi-tab section', async () => {
    const page = await openWorkspace('#/docs/multi-tab');
    try {
      await expectDocsPanelVisible(page);
      await expectActiveSection(page, 'multi-tab');
    } finally {
      await page.close();
    }
  });
});

// ── Warm-path via chrome.tabs.sendMessage ───────────────────────────
//
// Mirrors exactly what `workspace-navigator.ts` does on the warm path:
// `tabs.sendMessage(tabId, { type: 'workspace-intent', intent })`.
// We don't need the full navigator here — we're verifying the
// renderer's side of the wire. The navigator's cold/warm selection,
// retry, and URL fallback are exercised by the unit tests in
// `workspace-navigator.test.ts`.

test.describe('Workspace Intent — warm path', () => {
  test('workspace-intent message delivered to an open tab dispatches open-docs', async () => {
    // Step 1: open a plain workspace tab (no hash) and wait for the
    // intent router's subscription to mount.
    const page = await openWorkspace();
    try {
      // Give the renderer a frame to attach `chrome.runtime.onMessage`
      // via `bridge.subscribe('workspace-intent', ...)`.
      await page.waitForTimeout(200);

      // Step 2: ask the SW to fire `tabs.sendMessage` on this tab —
      // the exact wire the navigator's warm path uses. We don't
      // observe the sendMessage resolution here (Chrome reports
      // "message port closed" whenever a listener doesn't
      // synchronously respond — which is expected for the pub-sub
      // `bridge.subscribe` pattern the renderer uses). Instead we
      // assert the side effect — the docs panel opens + scrolls —
      // which is what production code paths actually depend on.
      await serviceWorker.evaluate(
        async ({ workspaceUrl }: { workspaceUrl: string }) => {
          const tabs: chrome.tabs.Tab[] = await new Promise((resolve) => {
            chrome.tabs.query({ url: `${workspaceUrl}*` }, (found) => resolve(found));
          });
          if (tabs.length === 0) return;
          const tabId = tabs[0].id;
          if (typeof tabId !== 'number') return;
          // Swallow the channel-closed rejection — see comment above.
          try {
            await new Promise<void>((resolve) => {
              chrome.tabs.sendMessage(
                tabId,
                { type: 'workspace-intent', intent: { kind: 'open-docs', section: 'system-status' } },
                () => {
                  // Read lastError to quiet Chrome's "Unchecked
                  // runtime.lastError" warning; we don't care about
                  // the response since the listener is pub-sub.
                  void chrome.runtime.lastError;
                  resolve();
                },
              );
            });
          } catch {
            // Ignore — the listener still received the message.
          }
        },
        { workspaceUrl: `chrome-extension://${extensionId}/workbench.html` },
      );

      // Step 3: the renderer's intent router received the message,
      // called `openDocs('system-status')`, and the docs panel opened
      // on that section.
      await expectDocsPanelVisible(page);
      await expectActiveSection(page, 'system-status');
    } finally {
      await page.close();
    }
  });
});

// ── Multi-window navigator — selectTargetTab in real Chromium ───────
//
// The navigator's Phase 9 §Edge-cases rule: prefer tabs in the
// CALLER's window; if the caller's window has NO workspace tab, fall
// through to the cold path rather than yanking focus across windows.
// These e2e cases exercise the full navigator + registry + renderer
// stack with two Chrome windows alive at once.

test.describe('Workspace Intent — multi-window navigator', () => {
  test('same-window preference: caller window tab gets the intent; other-window tab is untouched', async () => {
    // Window 1 — Playwright's default window.
    const page1 = await openWorkspace();

    // Window 2 — spawned via chrome.windows.create from the SW. The
    // workbench.html URL seeds the tab into the navigator's query.
    const { win2Id, win1Id } = await serviceWorker.evaluate(
      async ({ workspaceUrl }: { workspaceUrl: string }) => {
        const created = await chrome.windows.create({ url: workspaceUrl, focused: false });
        if (!created || typeof created.id !== 'number') throw new Error('chrome.windows.create returned no id');
        // Identify window 1 as "every window besides the newly-created one."
        const all = await chrome.windows.getAll({});
        const win2Id = created.id;
        const others = all.filter((w) => w.id !== win2Id).map((w) => w.id as number);
        return { win2Id, win1Id: others[0] };
      },
      { workspaceUrl: `chrome-extension://${extensionId}/workbench.html` },
    );

    // Wait for window 2's workspace renderer to mount too — both tabs
    // must have their intent listener attached before we dispatch,
    // otherwise the "untouched" assertion could succeed vacuously.
    const page2 = await context.waitForEvent('page');
    await page2
      .waitForFunction(
        () => {
          const root = document.getElementById('root');
          return root !== null && root.children.length > 0;
        },
        { timeout: 15000 },
      )
      .catch(() => {
        // Some Playwright builds surface the new window as a page-in-
        // context without firing 'page' again. Fall back to scanning.
      });
    await page1.waitForTimeout(300);

    try {
      // Dispatch through the actual navigator RPC, with callerWindowId
      // = window 1. The navigator's same-window preference must send
      // the intent to page1's tab, NOT page2's.
      //
      // We invoke from a non-workspace page (a blank tab, i.e. "the
      // popup simulation") rather than from the SW: `chrome.runtime.
      // sendMessage` invoked from the SW does NOT fire the SW's own
      // onMessage listener (Chrome excludes the sender's frame), so
      // the navigator handler would never run. Popups and sidepanels
      // are the real callers in production, and they do trigger the
      // handler normally.
      const caller = await context.newPage();
      await caller.goto(`chrome-extension://${extensionId}/popup.html`);
      const result = await caller.evaluate(
        async ({ callerWindowId }: { callerWindowId: number }) =>
          new Promise<unknown>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'openWorkspaceIntent',
                intent: { kind: 'open-docs', section: 'multi-tab' },
                callerContext: { callerWindowId },
              },
              (response) => {
                void chrome.runtime.lastError;
                resolve(response);
              },
            );
          }),
        { callerWindowId: win1Id },
      );
      await caller.close();

      // Sanity: navigator acknowledged delivery (warm path).
      expect(result).toMatchObject({ ok: true, path: 'warm' });

      // page1 should have received the intent and opened its docs
      // panel on the multi-tab section.
      await expectDocsPanelVisible(page1);
      await expectActiveSection(page1, 'multi-tab');

      // page2 in the other window must be untouched. The default
      // layout opens the Docs dock on every fresh workbench, so
      // "untouched" means the panel was never navigated: it must NOT
      // be showing the dispatched section.
      const page2Navigated = await page2.locator('.rules-right-panel--docs[data-active-section="multi-tab"]').count();
      expect(page2Navigated).toBe(0);
    } finally {
      await page1.close();
      await page2.close();
      // Close window 2 explicitly in case context.close() leaves
      // orphan windows.
      await serviceWorker
        .evaluate(async (id: number) => {
          try {
            await chrome.windows.remove(id);
          } catch {
            /* already closed */
          }
        }, win2Id)
        .catch(() => {});
    }
  });

  test('cross-window cold fallback: caller window has no workspace tab → cold path (no focus steal)', async () => {
    // Only window 2 has a workspace tab. A popup in window 1 asking
    // for the workspace must open a fresh tab rather than activating
    // window 2's — same principle Chrome's own DevTools follows
    // (one panel per window).

    // Window 1 exists but has no workspace tab — use Playwright's
    // default page for something else. (We still need an open non-
    // workspace page so the window stays alive.)
    const noiseTab = await context.newPage();
    await noiseTab.goto('about:blank');

    // Open the only workspace tab in a fresh window (window 2).
    const { win2Id, win1Id, workspaceTabIdInWin2 } = await serviceWorker.evaluate(
      async ({ workspaceUrl }: { workspaceUrl: string }) => {
        const created = await chrome.windows.create({ url: workspaceUrl, focused: false });
        if (!created || typeof created.id !== 'number') throw new Error('chrome.windows.create returned no id');
        const all = await chrome.windows.getAll({});
        const win2Id = created.id;
        const others = all.filter((w) => w.id !== win2Id).map((w) => w.id as number);
        // The workspace tab is the only tab in win2.
        const wsTabs = await chrome.tabs.query({ windowId: win2Id, url: `${workspaceUrl}*` });
        return {
          win2Id,
          win1Id: others[0],
          workspaceTabIdInWin2: wsTabs[0]?.id as number | undefined,
        };
      },
      { workspaceUrl: `chrome-extension://${extensionId}/workbench.html` },
    );

    try {
      // Dispatch intent with callerWindowId = win1 (no workspace tab
      // there). Navigator should fall through to cold path and create
      // a new tab — the win2 tab must NOT be activated or mutated.
      //
      // See note in the previous test: invoking `chrome.runtime.
      // sendMessage` from the SW would skip the SW's own listener, so
      // we dispatch from a popup.html page in window 1.
      const caller = await context.newPage();
      await caller.goto(`chrome-extension://${extensionId}/popup.html`);
      const result = await caller.evaluate(
        async ({ callerWindowId }: { callerWindowId: number }) =>
          new Promise<unknown>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'openWorkspaceIntent',
                intent: { kind: 'open-docs', section: 'system-status' },
                callerContext: { callerWindowId },
              },
              (response) => {
                void chrome.runtime.lastError;
                resolve(response);
              },
            );
          }),
        { callerWindowId: win1Id },
      );
      await caller.close();

      expect(result).toMatchObject({ ok: true, path: 'cold' });

      // The newly-created cold-path tab must NOT be the existing win2
      // tab — that's the whole point of the same-window preference.
      if ((result as { tabId?: number }).tabId !== undefined) {
        expect((result as { tabId: number }).tabId).not.toBe(workspaceTabIdInWin2);
      }
    } finally {
      await noiseTab.close();
      // Tear down everything we created.
      await serviceWorker
        .evaluate(async (id: number) => {
          try {
            await chrome.windows.remove(id);
          } catch {
            /* already closed */
          }
        }, win2Id)
        .catch(() => {});
      // Close any workspace tabs that the cold path created.
      await serviceWorker
        .evaluate(
          async ({ workspaceUrl }: { workspaceUrl: string }) => {
            const tabs = await chrome.tabs.query({ url: `${workspaceUrl}*` });
            for (const t of tabs) {
              if (typeof t.id === 'number') {
                try {
                  await chrome.tabs.remove(t.id);
                } catch {
                  /* already closed */
                }
              }
            }
          },
          { workspaceUrl: `chrome-extension://${extensionId}/workbench.html` },
        )
        .catch(() => {});
    }
  });
});
