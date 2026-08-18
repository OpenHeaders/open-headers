/**
 * Panel scroll crash repro — React #185 hunt on the REAL panel.
 *
 * Live report: the devtools window white-screens with React #185 when the
 * user wheel-scrolls (trackpad) the network table while a debug-mode
 * capture streams in. This spec reproduces that exact context: the real
 * built extension, a CDP-pinned (debug-mode) playground tab generating
 * continuous fetch traffic, the real panel opened via
 * `panel.html?ohInspectTabId=N`, and trackpad-style wheel input over the
 * table — alternating directions, small deltas, occasional horizontal
 * components.
 *
 * Diagnostic artifact, gated behind `PANEL_CRASH=1`. A green run means
 * "did not reproduce here", not "fixed".
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test, type Worker } from '@playwright/test';
import { seedPanelDebugFlags } from './fixtures/panel-seed';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');
const TRAFFIC_PAGE_URL = 'http://127.0.0.1:3000/';

const enabled = process.env.PANEL_CRASH === '1';

declare global {
  interface Window {
    __ohStopTraffic?: boolean;
  }
}

let context: BrowserContext;
let extensionId: string;
let sw: Worker;
let workbench: WorkbenchPage;
let workbenchPage: Page;
let trafficPage: Page;
let panelPage: Page;
let tabId: number;

test.describe('panel scroll crash repro — wheel scroll during debug-mode capture', () => {
  test.skip(!enabled, 'diagnostic artifact — set PANEL_CRASH=1 to run');
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    test.setTimeout(120_000);
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--silent-debugger-extension-api',
      ],
    });
    sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
    extensionId = sw.url().split('/')[2]!;
    sw = await seedPanelDebugFlags(context);

    workbenchPage = await context.newPage();
    workbench = await WorkbenchPage.open(workbenchPage, extensionId);

    trafficPage = await context.newPage();
    await trafficPage.goto(TRAFFIC_PAGE_URL);

    tabId = await workbench.tabIdForUrl(TRAFFIC_PAGE_URL);
    const pin = await workbench.rpc<{ success: boolean }>('setCdpTabPin', { tabId, pinned: true });
    expect(pin.success).toBe(true);

    panelPage = await context.newPage();
    await panelPage.goto(`chrome-extension://${extensionId}/panel.html?ohInspectTabId=${tabId}`);
    await panelPage.locator('.dt-panel-root').waitFor({ state: 'visible', timeout: 15_000 });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('wheel-scrolling a streaming debug capture provokes no page error', async () => {
    const pageErrors: string[] = [];
    panelPage.on('pageerror', (err) => pageErrors.push(err.stack ?? err.message));
    panelPage.on('console', (msg) => {
      if (msg.type() === 'error') pageErrors.push(`console.error: ${msg.text()}`);
    });

    // Continuous traffic from the inspected tab: ~60 req/s for ~30s, a mix
    // of echo and status endpoints so rows carry varied states.
    await trafficPage.evaluate(() => {
      window.__ohStopTraffic = false;
      void (async () => {
        for (let i = 0; i < 1800 && !window.__ohStopTraffic; i++) {
          void fetch(`/echo?i=${i}`).catch(() => {});
          if (i % 3 === 0) void fetch(`/net/status/204?i=${i}`).catch(() => {});
          if (i % 7 === 0) void fetch(`/net/status/404?i=${i}`).catch(() => {});
          await new Promise((r) => setTimeout(r, 16));
        }
      })();
    });

    // Wait until the table exists and carries some rows.
    const table = panelPage.locator('.dt-table');
    await expect(panelPage.locator('.dt-row').first()).toBeVisible({ timeout: 20_000 });

    const box = await table.boundingBox();
    expect(box).toBeTruthy();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    await panelPage.mouse.move(cx, cy);

    // Trackpad-style wheel: bursts of small deltas, alternating direction,
    // occasional horizontal component, while the capture streams.
    for (let burst = 0; burst < 120 && pageErrors.length === 0; burst++) {
      const down = burst % 2 === 0;
      for (let i = 0; i < 12; i++) {
        const dy = (down ? 1 : -1) * (40 + (i % 5) * 25);
        const dx = i % 4 === 0 ? (down ? 12 : -12) : 0;
        await panelPage.mouse.wheel(dx, dy);
      }
      await panelPage.waitForTimeout(50);
    }

    await trafficPage.evaluate(() => {
      window.__ohStopTraffic = true;
    });

    if (pageErrors.length > 0) {
      console.log(`[panel-crash] ${pageErrors.length} page error(s):`);
      for (const err of pageErrors) console.log(`[panel-crash] ${err}\n---`);
    } else {
      console.log('[panel-crash] no page errors provoked');
    }
    expect(pageErrors).toEqual([]);
  });
});
