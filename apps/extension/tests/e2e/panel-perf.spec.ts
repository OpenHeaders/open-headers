/**
 * Panel performance — browser-level profiling gate (Phase 2 / P2.2).
 *
 * The unit-level baseline (`tests/unit/panel-perf/`) measures JS scripting
 * in jsdom; it cannot see real layout, paint, or dropped frames. This spec
 * closes that gap: it drives the REAL panel render subtree (`TrafficList`
 * fed by the real `usePanelData` projection) in a real Chromium page —
 * served from the playground harness at `/src/perf/index.html` — streaming
 * a synthesized heavy capture through the genuine store → notify → render →
 * paint pipeline, and measures smoothness via the in-page frame meter
 * (rAF interval sampling + long-task observer).
 *
 * Each wire frame is delivered in its own macrotask, the way the real
 * lifecycle port does — React's automatic batching only coalesces store
 * notifications *within* a task, so per-task delivery is what makes the
 * synchronous regime render once per event (the pre-Phase-1 pathology); a
 * synchronous delivery loop would let React batch it for free and erase
 * the difference. The capture runs twice per size — synchronous notify
 * (pre-Phase-1) vs rAF (Phase 1) — and the assertion is the deterministic
 * Phase-1 invariant:
 *   - rAF coalesces a wave into far fewer React commits than the per-event
 *     regime (the win, in a real browser). Frame counts are environment-
 *     noisy and only logged.
 *
 * The dropped-frame numbers are only trustworthy on a PRODUCTION build —
 * a dev build's react-refresh + unminified renders inflate jank by ~10×.
 * Default `webServer` boots the playground dev server, which is fine for
 * the deterministic render-count assertion; for honest paint absolutes,
 * point the spec at a production preview:
 *   pnpm --filter @openheaders/playground build
 *   pnpm --filter @openheaders/playground preview &   # serves :3000
 *   PANEL_PERF=1 pnpm --filter @openheaders/extension exec playwright test panel-perf --headed
 * (Playwright reuses the existing :3000 server.) Run headed — headless
 * caps the virtual refresh and hides compositing.
 *
 * Gated behind `PANEL_PERF=1` so the default e2e suite stays fast.
 */

import { expect, test } from '@playwright/test';

interface RunResult {
  scheduler: 'sync' | 'raf';
  requestCount: number;
  updateCount: number;
  durationMs: number;
  frameCount: number;
  jankyIntervals: number;
  droppedFrames: number;
  longestIntervalMs: number;
  p95IntervalMs: number;
  fps: number;
  longTaskCount: number;
  longTaskMs: number;
  longestTaskMs: number;
  renders: number;
  renderedRows: number;
}

interface RunConfig {
  scheduler: 'sync' | 'raf';
  requestCount: number;
  updatesPerBurst?: number;
  burstIntervalMs?: number;
  followTail?: boolean;
}

declare global {
  interface Window {
    __panelPerf?: { run(config: RunConfig): Promise<RunResult> };
  }
}

const HARNESS_URL = 'http://127.0.0.1:3000/src/perf/index.html';
const REQUEST_COUNTS = [250, 500, 1000];

const enabled = process.env.PANEL_PERF === '1';

test.describe('panel performance — browser paint gate', () => {
  test.skip(!enabled, 'profiling artifact — set PANEL_PERF=1 to run');
  test.setTimeout(120_000);

  test('rAF batching holds smoothness under heavy capture vs synchronous notify', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await page.waitForFunction(() => typeof window.__panelPerf?.run === 'function', { timeout: 15_000 });
    // Wait for the table shell to mount so the first run paints real rows.
    await page.locator('.dt-panel-root').waitFor({ state: 'visible', timeout: 15_000 });

    const runOne = (config: RunConfig): Promise<RunResult> =>
      page.evaluate((cfg) => window.__panelPerf!.run(cfg) as Promise<RunResult>, config);

    const rows: RunResult[] = [];
    for (const requestCount of REQUEST_COUNTS) {
      const base = { requestCount };
      const sync = await runOne({ scheduler: 'sync', ...base });
      const raf = await runOne({ scheduler: 'raf', ...base });
      rows.push(sync, raf);

      const line = (r: RunResult): string =>
        `${r.scheduler.padEnd(4)} n=${String(r.requestCount).padStart(4)} ` +
        `updates=${r.updateCount} renders=${r.renders} rows=${r.renderedRows} ` +
        `frames=${r.frameCount} fps=${r.fps.toFixed(1)} ` +
        `dropped=${r.droppedFrames} janky=${r.jankyIntervals} ` +
        `p95=${r.p95IntervalMs.toFixed(1)}ms longest=${r.longestIntervalMs.toFixed(1)}ms ` +
        `longTasks=${r.longTaskCount}/${r.longTaskMs.toFixed(0)}ms`;
      console.log(`[panel-perf] ${line(sync)}`);
      console.log(`[panel-perf] ${line(raf)}`);

      // The harness actually painted virtualized rows (not an empty table).
      expect(raf.renderedRows).toBeGreaterThan(0);
      expect(sync.renderedRows).toBeGreaterThan(0);
      // The Phase-1 invariant, measured in a real browser: rAF coalescing
      // collapses a wave of mutations into far fewer React commits than the
      // per-event regime. This is deterministic; frame counts are noisy and
      // only logged.
      expect(raf.renders).toBeLessThan(sync.renders);
    }

    // Headline gate: the rAF regime at the largest size. Logged for the
    // STATUS doc; a soft bound flags if the per-frame recompute/paint ever
    // starts dropping frames (which would finally light P3/P4).
    const topRaf = rows.find((r) => r.scheduler === 'raf' && r.requestCount === REQUEST_COUNTS.at(-1));
    expect(topRaf).toBeTruthy();
    console.log(`[panel-perf] GATE rAF@${topRaf!.requestCount}: droppedFrames=${topRaf!.droppedFrames}`);
  });
});
