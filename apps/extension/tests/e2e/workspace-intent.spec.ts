/**
 * Workspace Intent e2e — exercises the full Phase 9 pipeline:
 * `hashToIntent` / `parseIntent` → `useWorkspaceIntentRouter` →
 * existing openers (docs scroll, rule editor, etc.).
 *
 * Scenarios from V5_FOUNDATION_PLAN.md §Phase 9 verification:
 *   • Cold start — navigate to `workspace.html#/docs/doc-system-status`
 *     → docs panel opens + auto-scrolls to the section.
 *   • Warm start — with a workspace tab already open, dispatch
 *     `{ type: 'workspace-intent', intent }` from the SW via
 *     `chrome.tabs.sendMessage` (the exact path the navigator's warm
 *     path uses) → renderer's intent router routes it through the
 *     same opener → docs panel opens + scrolls.
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
  await page.goto(`chrome-extension://${extensionId}/workspace.html${hash}`);
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
 * Wait for a docs section to be scrolled into the visible viewport of
 * its scrolling container. The docs router's `pin` routine writes
 * `scrollTop` imperatively so we poll the section's bounding rect
 * against the panel's rect instead of relying on `scrollIntoView`
 * promises (which don't exist for imperative writes).
 */
async function expectSectionInViewport(page: Page, sectionId: string): Promise<void> {
  await expect
    .poll(
      async () =>
        await page.evaluate((id: string) => {
          const el = document.getElementById(id);
          if (!el) return false;
          // Find the nearest scrolling ancestor with vertical overflow —
          // in practice this is the DocsPanel's body div.
          let container: HTMLElement | null = el.parentElement;
          while (container && container !== document.body) {
            const style = window.getComputedStyle(container);
            if (style.overflowY === 'auto' || style.overflowY === 'scroll') break;
            container = container.parentElement;
          }
          if (!container) return false;
          const panelRect = container.getBoundingClientRect();
          const sectionRect = el.getBoundingClientRect();
          // Section's top edge must sit inside the panel's box.
          return sectionRect.top >= panelRect.top - 2 && sectionRect.top <= panelRect.bottom;
        }, sectionId),
      { timeout: 10000, message: `expected #${sectionId} to scroll into the docs panel viewport` },
    )
    .toBe(true);
}

// ── Cold-start ──────────────────────────────────────────────────────

test.describe('Workspace Intent — cold start', () => {
  test('hash #/docs/doc-system-status opens the docs panel + scrolls to the section', async () => {
    const page = await openWorkspace('#/docs/doc-system-status');
    try {
      await expectDocsPanelVisible(page);
      await expectSectionInViewport(page, 'doc-system-status');
    } finally {
      await page.close();
    }
  });

  test('hash #/docs/doc-multi-tab opens the docs panel + scrolls to the new multi-tab section', async () => {
    const page = await openWorkspace('#/docs/doc-multi-tab');
    try {
      await expectDocsPanelVisible(page);
      await expectSectionInViewport(page, 'doc-multi-tab');
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
                { type: 'workspace-intent', intent: { kind: 'open-docs', section: 'doc-system-status' } },
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
        { workspaceUrl: `chrome-extension://${extensionId}/workspace.html` },
      );

      // Step 3: the renderer's intent router received the message,
      // called `openDocs('doc-system-status')`, the docs panel opened,
      // and the scroll-pin effect brought the section into view.
      await expectDocsPanelVisible(page);
      await expectSectionInViewport(page, 'doc-system-status');
    } finally {
      await page.close();
    }
  });
});
