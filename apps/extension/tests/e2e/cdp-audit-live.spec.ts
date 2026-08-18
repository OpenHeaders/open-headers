/**
 * CDP control-plane audit — epic-end live-verification pass
 * (the CDP-control audit, the batched live milestone).
 *
 * Automates the per-phase live criteria the fix slices S36–S52 deferred
 * to "real Chromium", over the playground + the plain-tab panel recipe
 * (`panel.html?ohInspectTabId=N` + `setCdpTabPin` — a real DevTools
 * window is unreachable from Playwright). One test per criterion:
 *
 *   PG1  console error-subtype renders the description stack, not the preview
 *   PG2  format specifiers substitute; %c consumes its CSS without leaking it
 *   PD2  a CDP fire carries its matched pattern onto the panel "Pattern:" line
 *   X2   fire-uniqueness — one fetch mints exactly one fire record
 *   F1   a substituted network response exposes no body-framing headers, both planes
 *   X1   an initiator-gated debug response rule still realizes on an in-scope tab
 *   PD1  an empty-string body transforms out of scope; in scope it ANSWERS the
 *        carried postData:'' reachability question (either way is a pass — the
 *        observed plane behavior is recorded as a test annotation)
 *   PA1  a scheme-specific ws:// url-filter matches a RELATIVE socket endpoint
 *   PA2  injected WS frames / SSE events carry the endpoint ORIGIN, not the URL
 *   PE1  a mid-page arm swaps the fire dispatcher page-invisible (control first)
 *   PE2  bypassCSP is URL-gated per navigation (matched → unmatched → back)
 *   PF1  worker interception survives page-only Emulation overrides
 *   PF2  a mid-session cache-disable flip takes effect without a re-attach
 *   PC2  closing a pinned tab drops the pin — no phantom pin, no attach fault
 *   PB1/PB2 (Chrome leg) an invalid __Host- jar write resolves with a threaded
 *        reason instead of hanging the bridge
 *   PC3  the popup mounts the "Tab out of scope" dormancy chip
 *
 * NOT covered here (manual / out of e2e reach — recorded in the S53 ledger
 * block): PB1/PB2's Firefox leg (Playwright can't drive the Firefox
 * extension), PD2's popup matched-records column (the popup binds to the
 * ACTIVE tab), PC1's detach-mid-apply race (probe-covered, not
 * deterministically drivable), and the PD3/PD4 documented bounds (expected
 * behavior, not criteria).
 *
 * Rules are seeded through the SW parity seam (`__OH_PARITY_IMPORT_RULES__`,
 * the production addRule path) — the workbench page stays open the whole
 * run so the MV3 worker can't idle out under the seam calls.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test, type Worker } from '@playwright/test';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

const ORIGIN = 'http://127.0.0.1:3000';
const IN_URL = `${ORIGIN}/?oh-audit=in`;
const OUT_URL = `${ORIGIN}/?oh-audit=out`;
const PE1_URL = `${ORIGIN}/?oh-audit=pe1`;
const CSP_PATH = '/src/combinations/csp-bypass.html';

const F1_RULE = 'Audit · f1 · network response substitution';
const X1_RULE = 'Audit · x1 · initiator-gated mock';
const PD1_RULE = 'Audit · pd1 · empty-body dynamic';
const PA_WS_RULE = 'Audit · pa · ws inject on open';
const SSE_RULE = 'Audit · pa2 · sse inject on open';
const PE2_RULE = 'Audit · pe2 · bypassCSP inject';
const PF1_RULE = 'Audit · pf1 · worker mock';

/** Strict subset of the playground RuleSpec / core V5 rule shape the
 *  parity import seam completes into full rules. */
interface AuditRuleSpec {
  name: string;
  type: string;
  enabled: boolean;
  conditions: Array<{ type: string; values: string[] }>;
  action: Record<string, unknown>;
}

const AUDIT_RULES: AuditRuleSpec[] = [
  {
    name: F1_RULE,
    type: 'response',
    enabled: true,
    conditions: [{ type: 'url-filter', values: [`*://127.0.0.1:3000/echo?oh=f1*`] }],
    action: {
      responseSource: 'network',
      statusCode: 0,
      contentType: '',
      bodyType: 'static',
      responseBody: '{"oh":"f1-sub"}',
      responseHeaders: {},
      resourceType: 'rest',
    },
  },
  {
    name: X1_RULE,
    type: 'response',
    enabled: true,
    conditions: [
      { type: 'url-filter', values: [`*://127.0.0.1:3000/echo?oh=x1*`] },
      { type: 'initiator-domains', values: ['127.0.0.1'] },
    ],
    action: {
      responseSource: 'mock',
      statusCode: 200,
      contentType: 'application/json',
      bodyType: 'static',
      responseBody: '{"oh":"x1-inject"}',
      responseHeaders: {},
      resourceType: 'rest',
    },
  },
  {
    name: PD1_RULE,
    type: 'request-body',
    enabled: true,
    conditions: [{ type: 'url-filter', values: [`*://127.0.0.1:3000/echo?oh=pd1*`] }],
    action: {
      bodyType: 'dynamic',
      resourceType: 'rest',
      requestBody: `function modifyRequestBody(args) {
  return 'pd1-saw:' + JSON.stringify(args.body);
}`,
    },
  },
  {
    name: PA_WS_RULE,
    type: 'ws',
    enabled: true,
    // Deliberately SCHEME-SPECIFIC (ws://, not *://) — PA1's criterion is
    // that a relative `new WebSocket('/net/ws-echo…')` resolves to its ws
    // form before this filter tests it.
    conditions: [{ type: 'url-filter', values: ['ws://127.0.0.1:3000/net/ws-echo?case=audit-pa*'] }],
    action: {
      operation: 'inject',
      direction: 'receive',
      payload: '{"auditInjected":true}',
      injectTrigger: 'open',
    },
  },
  {
    name: SSE_RULE,
    type: 'sse',
    enabled: true,
    conditions: [{ type: 'url-filter', values: ['*://127.0.0.1:3000/net/sse/2?ms=100&case=audit-sse*'] }],
    action: {
      operation: 'inject',
      eventName: 'synthetic',
      payload: '{"sseInjected":true}',
      injectTrigger: 'open',
    },
  },
  {
    name: PE2_RULE,
    type: 'inject',
    enabled: true,
    // Origin-gated on 127.0.0.1 — the localhost:3000 sibling serves the same
    // page but must NOT match, so PE2's unmatched-origin leg keeps its CSP.
    conditions: [{ type: 'url-filter', values: [`*://127.0.0.1:3000${CSP_PATH}*`] }],
    action: {
      injectType: 'script',
      source: 'code',
      code: 'window.__OH_AUDIT_PE2_INJECT__ = true;',
      position: 'head',
      bypassCSP: true,
    },
  },
  {
    name: PF1_RULE,
    type: 'response',
    enabled: true,
    conditions: [{ type: 'url-filter', values: [`*://127.0.0.1:3000/echo?oh=pf1*`] }],
    action: {
      responseSource: 'mock',
      statusCode: 200,
      contentType: 'application/json',
      bodyType: 'static',
      responseBody: '{"oh":"pf1-mock"}',
      responseHeaders: {},
      resourceType: 'rest',
    },
  },
];

interface ParityImportResult {
  ok: boolean;
  error?: string;
  rules?: Array<{ uid: string; name: string; complete: boolean }>;
}

interface ParityFiresResult {
  ok: boolean;
  error?: string;
  counters?: Record<string, number>;
}

interface CdpSnapshotEntry {
  state?: string;
  message?: string;
  context?: {
    tabs?: Array<{ tabId: number }>;
    pinnedTabs?: number[];
  };
}

interface EchoReflection {
  body: string;
  headers: Record<string, string | null>;
}

interface FrameProbe {
  data?: string;
  origin?: string;
  timeout?: boolean;
}

declare global {
  interface Window {
    __ohAuditFires?: unknown[];
    __ohAuditPe2?: number;
  }
}

let context: BrowserContext;
let extensionId: string;
let sw: Worker;
let workbench: WorkbenchPage;
let workbenchPage: Page;
let inScopePage: Page;
let outScopePage: Page;
let panelPage: Page;
let inScopeTabId: number;
let ruleUids: Map<string, string>;

/** The `cdp` Status entry via the production snapshot RPC. */
async function cdpStatus(): Promise<CdpSnapshotEntry> {
  const res = await workbench.rpc<{ snapshot?: { cdp?: CdpSnapshotEntry } }>('getStatusSnapshot');
  return res.snapshot?.cdp ?? {};
}

/** Poll until the tab shows in the attach roster. */
async function waitAttached(tabId: number): Promise<void> {
  await expect
    .poll(async () => ((await cdpStatus()).context?.tabs ?? []).some((t) => t.tabId === tabId), { timeout: 20_000 })
    .toBe(true);
}

/** Pin a tab into CDP scope via the production RPC. */
async function pin(tabId: number, pinned: boolean): Promise<void> {
  const res = await workbench.rpc<{ success: boolean }>('setCdpTabPin', { tabId, pinned });
  expect(res.success).toBe(true);
}

/** Fetch `/echo` from a page and reflect what the server received plus the
 *  RESPONSE headers the page's own JS can read. */
function echoProbe(page: Page, query: string, init?: { method?: string; body?: string }): Promise<EchoReflection> {
  return page.evaluate(
    async ({ query: q, init: i }: { query: string; init?: { method?: string; body?: string } }) => {
      const res = await fetch(`/echo?${q}`, i);
      const headers: Record<string, string | null> = {};
      for (const name of ['content-encoding', 'content-length', 'transfer-encoding', 'content-type']) {
        headers[name] = res.headers.get(name);
      }
      const body = await res.text();
      return { body, headers };
    },
    { query, init },
  );
}

/** Open a WebSocket (URL as given — RELATIVE stays relative) and resolve
 *  with the first incoming frame's data + origin. */
function wsProbe(page: Page, url: string): Promise<FrameProbe> {
  return page.evaluate(
    (u: string) =>
      new Promise<FrameProbe>((resolve) => {
        const ws = new WebSocket(u);
        const timer = setTimeout(() => resolve({ timeout: true }), 8_000);
        ws.addEventListener('message', (ev) => {
          clearTimeout(timer);
          resolve({ data: String(ev.data), origin: ev.origin });
          ws.close();
        });
        ws.addEventListener('error', () => {
          clearTimeout(timer);
          resolve({ timeout: true });
        });
      }),
    url,
  );
}

/** The panel Console rows carrying the given text. */
function consoleRows(text: string) {
  return panelPage.locator('.dt-console-row').filter({ has: panelPage.locator('.dt-console-msg', { hasText: text }) });
}

/** Activate a panel tool window by its stable id. */
async function openToolWindow(id: string): Promise<void> {
  const tab = panelPage.locator(`[data-tool-window="${id}"]`).first();
  if ((await tab.getAttribute('aria-selected')) !== 'true') {
    await tab.click();
  }
}

test.beforeAll(async () => {
  test.setTimeout(180_000);
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      // Suppress the debugging infobar so attach commits without layout shifts.
      '--silent-debugger-extension-api',
    ],
  });
  sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2]!;

  workbenchPage = await context.newPage();
  workbench = await WorkbenchPage.open(workbenchPage, extensionId);

  // Seed flags from the PAGE context (shared extension-origin storage).
  // `inspection.cdpEnabled` defaults OFF — the attach must be an explicit
  // user choice — so the spec opts in through the persisted user-settings
  // dict, the same write any settings surface makes.
  await workbenchPage.evaluate(
    () =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set(
          {
            onboardingCompleted: true,
            panelOnboardingCompleted: true,
            __oh_parity_hook__: true,
            'oh.settings.user': { 'inspection.cdpEnabled': true },
          },
          () => resolve(),
        );
      }),
  );

  // Import the audit rules through the parity seam (production addRule
  // path). On a fresh profile the SW's sync oracle bootstraps async and
  // the seam throws until it is up — retry that specific race, bounded.
  let imported: unknown;
  for (let attempt = 0; ; attempt++) {
    try {
      imported = await sw.evaluate(
        async (specs) => {
          const seam = (globalThis as Record<string, unknown>).__OH_PARITY_IMPORT_RULES__;
          if (typeof seam !== 'function') return { ok: false, error: '__OH_PARITY_IMPORT_RULES__ not installed' };
          return (seam as (s: unknown[]) => Promise<unknown>)(specs);
        },
        AUDIT_RULES as unknown as unknown[],
      );
      break;
    } catch (err) {
      if (attempt >= 15 || !String(err).includes('sync service not initialized')) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  const importResult = imported as ParityImportResult;
  if (!importResult.ok || !importResult.rules) throw new Error(`rule import failed: ${importResult.error}`);
  const incomplete = importResult.rules.filter((r) => !r.complete);
  if (incomplete.length > 0) throw new Error(`incomplete rules: ${incomplete.map((r) => r.name).join(' · ')}`);
  ruleUids = new Map(importResult.rules.map((r) => [r.name, r.uid]));

  // Rule compile + scriptable registration settle (no completion signal —
  // same stand-in the playground e2e runner uses).
  await new Promise((resolve) => setTimeout(resolve, 2_500));

  // The out-of-scope surface: never pinned, injection-plane only.
  outScopePage = await context.newPage();
  await outScopePage.goto(OUT_URL);

  // The in-scope surface: pinned into CDP, panel bound to it.
  inScopePage = await context.newPage();
  await inScopePage.goto(IN_URL);
  inScopeTabId = await workbench.tabIdForUrl(IN_URL);
  await pin(inScopeTabId, true);
  await waitAttached(inScopeTabId);

  panelPage = await context.newPage();
  panelPage.on('pageerror', (err) => console.error('[panel pageerror]', err.stack ?? err.message));
  await panelPage.goto(`chrome-extension://${extensionId}/panel.html?ohInspectTabId=${inScopeTabId}`);
  await panelPage.locator('.dt-panel-root').waitFor({ state: 'visible', timeout: 15_000 });
});

test.afterAll(async () => {
  const uids = ruleUids ? [...ruleUids.values()] : [];
  if (uids.length > 0) {
    await sw
      .evaluate(
        async (ids) => {
          const seam = (globalThis as Record<string, unknown>).__OH_PARITY_DELETE_RULES__;
          if (typeof seam === 'function') await (seam as (i: unknown[]) => Promise<unknown>)(ids);
        },
        uids as unknown as unknown[],
      )
      .catch(() => {});
  }
  await context.close();
});

test('PG1 — console error-subtype renders the description stack, not the preview body', async () => {
  await openToolWindow('console');
  await inScopePage.evaluate(() => console.error(new Error('pg1-boom')));

  const row = consoleRows('pg1-boom').first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  const text = (await row.locator('.dt-console-msg').innerText()).trim();
  expect(text).toContain('Error: pg1-boom');
  // The preview body would render `{stack: …, message: 'pg1-boom'}`.
  expect(text).not.toContain('message:');
  expect(text).not.toContain('{stack');
});

test('PG2 — %s/%d substitute; %c consumes its CSS argument without leaking it', async () => {
  await openToolWindow('console');
  await inScopePage.evaluate(() => {
    console.log('audit-pg2 user %s has %d pts', 'ana', 7.9);
    console.log('%caudit-pg2-styled', 'color:red', 'tail');
  });

  await expect(consoleRows('audit-pg2 user ana has 7 pts').first()).toBeVisible({ timeout: 15_000 });

  const styled = consoleRows('audit-pg2-styled').first();
  await expect(styled).toBeVisible({ timeout: 15_000 });
  const text = (await styled.locator('.dt-console-msg').innerText()).trim();
  expect(text).toContain('audit-pg2-styled tail');
  expect(text).not.toContain('color:red');
});

test('PD2 + X2 — a CDP fire carries its matched pattern onto the panel "Pattern:" line, exactly once', async () => {
  const echo = await echoProbe(inScopePage, 'oh=f1&leg=pd2');
  expect(JSON.parse(echo.body)).toEqual({ oh: 'f1-sub' });

  // X2 fire-uniqueness: the single fetch minted exactly ONE fire record.
  // Telemetry intake is async (MAIN→ISOLATED→SW + a 500ms observed-fire
  // buffer), so poll rather than read-once.
  const readF1Counter = async (): Promise<number | undefined> => {
    const fires = await sw.evaluate(async (u) => {
      const seam = (globalThis as Record<string, unknown>).__OH_PARITY_GET_FIRES__;
      if (typeof seam !== 'function') return { ok: false, error: '__OH_PARITY_GET_FIRES__ not installed' };
      return (seam as (url: string) => Promise<unknown>)(u);
    }, IN_URL);
    return (fires as ParityFiresResult).counters?.[ruleUids.get(F1_RULE) ?? ''];
  };
  await expect.poll(readF1Counter, { timeout: 10_000 }).toBe(1);
  // Settled — the count must hold at exactly one (no late double-report).
  await inScopePage.waitForTimeout(1_000);
  expect(await readF1Counter()).toBe(1);

  // The traffic row's Matched Rules panel shows the rule with its pattern —
  // on the FIRE row specifically ("would match" future rows compute their own
  // pattern projection, so they can't stand in for the PD2 threading).
  const row = panelPage.locator('.dt-row').filter({ hasText: 'oh=f1' }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  await openToolWindow('matched-rules');
  await expect(panelPage.locator('.dt-matched-rules-panel-body')).toContainText(F1_RULE, { timeout: 10_000 });
  const fireRow = panelPage
    .locator('.dt-matched-rule')
    .filter({ hasText: F1_RULE })
    .filter({ hasNot: panelPage.locator('.dt-matched-rule-future') })
    .first();
  await expect(fireRow).toBeVisible({ timeout: 10_000 });
  const pattern = fireRow.locator('.dt-matched-rule-pattern');
  await expect(pattern).toBeVisible();
  await expect(pattern).toContainText('Pattern:');
  await expect(pattern).toContainText('echo?oh=f1');
});

test('F1 — a substituted network response exposes no body-framing headers, in AND out of scope', async () => {
  for (const [label, page] of [
    ['in-scope (CDP fulfill)', inScopePage],
    ['out-of-scope (page injection)', outScopePage],
  ] as const) {
    const echo = await echoProbe(page, `oh=f1&leg=${label.slice(0, 2)}`);
    expect(JSON.parse(echo.body), label).toEqual({ oh: 'f1-sub' });
    expect(echo.headers['content-encoding'], label).toBeNull();
    expect(echo.headers['content-length'], label).toBeNull();
    expect(echo.headers['transfer-encoding'], label).toBeNull();
  }
});

test('X1 — an initiator-gated debug response rule still realizes on an in-scope tab', async () => {
  // initiator-domains is not CDP-evaluable, so the reaction declines; the
  // isCdpEvaluable gate keeps injection un-suppressed — the mock must land.
  const echo = await echoProbe(inScopePage, 'oh=x1');
  expect(JSON.parse(echo.body)).toEqual({ oh: 'x1-inject' });
});

test('PD1 — an empty-string body transforms out of scope; in scope answers the postData reachability question', async () => {
  // Out of scope the S48 fix owns the case outright: present-but-empty
  // transforms + the echo reflects the rewritten body.
  const out = await echoProbe(outScopePage, 'oh=pd1&leg=out', { method: 'POST', body: '' });
  expect(JSON.parse(out.body).body).toBe('pd1-saw:""');

  // In scope the CDP plane owns the rule. The carried question: does CDP
  // deliver postData:'' (transform runs) or omit it for an empty body
  // (released bodyless — documented no-regression)? Both are passes; the
  // observed answer is recorded on the test.
  const inScope = await echoProbe(inScopePage, 'oh=pd1&leg=in', { method: 'POST', body: '' });
  const observed = JSON.parse(inScope.body).body as string;
  expect(['pd1-saw:""', '']).toContain(observed);
  test.info().annotations.push({
    type: 'pd1-postdata-reachability',
    description:
      observed === 'pd1-saw:""'
        ? 'CDP delivers postData:"" for an empty body — the transform ran in scope'
        : 'CDP omits postData for an empty body — released bodyless (documented bound, no regression)',
  });
});

test('PA1 + PA2 — a ws:// url-filter matches a relative socket; injected frames carry the ORIGIN', async () => {
  // Relative endpoint: only the S47 scheme-faithful resolution lets the
  // scheme-specific ws:// filter match at all — the inject firing IS PA1.
  const frame = await wsProbe(outScopePage, '/net/ws-echo?case=audit-pa');
  expect(frame.timeout).toBeUndefined();
  expect(frame.data).toBe('{"auditInjected":true}');
  // PA2: the synthetic MessageEvent.origin is the socket ORIGIN, no path.
  expect(frame.origin).toBe('ws://127.0.0.1:3000');

  // SSE inject: the synthetic event's origin is the stream's origin.
  const sse = await outScopePage.evaluate(
    () =>
      new Promise<FrameProbe>((resolve) => {
        const es = new EventSource('/net/sse/2?ms=100&case=audit-sse');
        const timer = setTimeout(() => {
          es.close();
          resolve({ timeout: true });
        }, 8_000);
        es.addEventListener('synthetic', (ev) => {
          clearTimeout(timer);
          es.close();
          resolve({ data: String((ev as MessageEvent).data), origin: (ev as MessageEvent).origin });
        });
      }),
  );
  expect(sse.timeout).toBeUndefined();
  expect(sse.data).toBe('{"sseInjected":true}');
  expect(sse.origin).toBe('http://127.0.0.1:3000');
});

test('PE1 — a mid-page arm makes the next wrapper fire invisible to a page message listener', async () => {
  const pe1Page = await context.newPage();
  await pe1Page.goto(PE1_URL);

  // Record every FIRE postMessage the PAGE can see. Only `__ohFire` is the
  // criterion's subject — the `__ohMessageCapture` frames ride postMessage
  // by design on every tab (the fire dispatch is what the binding hides).
  await pe1Page.evaluate(() => {
    window.__ohAuditFires = [];
    window.addEventListener('message', (ev) => {
      const d = ev.data as Record<string, unknown> | null;
      if (d && typeof d === 'object' && d.__ohFire === true) {
        window.__ohAuditFires?.push(d);
      }
    });
  });

  // Control (out of scope): the wrapper fire IS page-visible postMessage.
  const control = await wsProbe(pe1Page, '/net/ws-echo?case=audit-pa&leg=pe1-control');
  expect(control.data).toBe('{"auditInjected":true}');
  await expect
    .poll(() => pe1Page.evaluate(() => window.__ohAuditFires?.length ?? 0), { timeout: 10_000 })
    .toBeGreaterThan(0);

  // Mid-page arm: pin the loaded tab — the reset path must re-capture the
  // dispatcher onto the page-invisible binding without a navigation.
  const pe1TabId = await workbench.tabIdForUrl(PE1_URL);
  await pin(pe1TabId, true);
  await waitAttached(pe1TabId);

  // The re-arm (reset + re-inject) is async after attach; poll until a fresh
  // fire is provably page-invisible: the injected frame still arrives, and
  // the page listener records NOTHING new for it.
  let socketSeq = 0;
  await expect(async () => {
    socketSeq += 1;
    await pe1Page.evaluate(() => {
      window.__ohAuditFires = [];
    });
    const frame = await wsProbe(pe1Page, `/net/ws-echo?case=audit-pa&leg=pe1-armed-${socketSeq}`);
    expect(frame.data).toBe('{"auditInjected":true}');
    // Give a stray postMessage dispatch a beat to land before reading.
    await pe1Page.waitForTimeout(500);
    expect(await pe1Page.evaluate(() => window.__ohAuditFires?.length ?? 0)).toBe(0);
  }).toPass({ timeout: 30_000 });

  await pin(pe1TabId, false);
  await pe1Page.close();
});

test('PE2 — bypassCSP is URL-gated: matched origin bypasses, unmatched keeps its CSP, back re-gains', async () => {
  const pe2Page = await context.newPage();
  await pe2Page.goto(`${ORIGIN}${CSP_PATH}`);
  const pe2TabId = await workbench.tabIdForUrl(`${ORIGIN}${CSP_PATH}`);
  await pin(pe2TabId, true);
  await waitAttached(pe2TabId);
  // Chromium consults the bypass flag at CSP INITIALIZATION, not per check —
  // a document loaded before the arm keeps its policy, so give every leg a
  // fresh document (the two navigations below are already fresh).
  await pe2Page.reload();

  // The page's meta CSP blocks inline scripts; with Page.setBypassCSP
  // engaged the appended inline script executes.
  const inlineProbe = () =>
    pe2Page.evaluate(() => {
      window.__ohAuditPe2 = 0;
      const s = document.createElement('script');
      s.textContent = 'window.__ohAuditPe2 = 1;';
      document.head.appendChild(s);
      s.remove();
      return window.__ohAuditPe2;
    });

  // Matched origin: the bypass engages (apply is async after attach — poll).
  await expect.poll(inlineProbe, { timeout: 15_000 }).toBe(1);

  // Unmatched origin (the localhost:3000 sibling serves the same page, the
  // url-filter names 127.0.0.1 only): CSP must be back in force.
  await pe2Page.goto(`http://localhost:3000${CSP_PATH}`);
  await pe2Page.waitForTimeout(1_000);
  // The first unmatched document races the async post-navigation re-derive
  // against its own CSP initialization — record it, but assert on the second
  // document, where the gate has deterministically settled.
  const firstUnmatchedDoc = await inlineProbe();
  test.info().annotations.push({
    type: 'pe2-first-unmatched-doc',
    description:
      firstUnmatchedDoc === 0
        ? 'the re-derive beat the first unmatched document — CSP intact immediately'
        : 'the first unmatched document still bypassed (re-derive landed after its CSP init); settled by the next document',
  });
  await pe2Page.reload();
  await pe2Page.waitForTimeout(1_000);
  expect(await inlineProbe()).toBe(0);

  // Back to the matched origin: the bypass re-engages. Same init-time
  // semantics in reverse — the returning document races its CSP init against
  // the post-navigation re-derive, so give the settled flag a fresh document.
  await pe2Page.goto(`${ORIGIN}${CSP_PATH}`);
  await pe2Page.waitForTimeout(1_000);
  const firstMatchedDocBack = await inlineProbe();
  test.info().annotations.push({
    type: 'pe2-first-matched-doc-back',
    description:
      firstMatchedDocBack === 1
        ? 'the re-derive beat the returning document — bypass re-gained immediately'
        : 'the first returning document kept its CSP (re-derive landed after its CSP init); bypass re-gained on the next document',
  });
  await pe2Page.reload();
  await expect.poll(inlineProbe, { timeout: 15_000 }).toBe(1);

  await pin(pe2TabId, false);
  await pe2Page.close();
});

test('PF1 — worker interception survives page-only Emulation overrides', async () => {
  // Page-only Emulation commands stand alongside the debug rule; the worker
  // child's apply batch must still reach Fetch.enable.
  // Timezone only — Playwright's own CDP session holds a locale override on
  // every page it drives, and a second client's Emulation.setLocaleOverride
  // rejects with "Another locale override is already in effect" (test-env
  // collision, not a product path). The timezone facet is an equally
  // page-only Emulation command, which is all PF1 needs standing.
  const set = await workbench.rpc<{ success: boolean }>('setTabOverrides', {
    tabId: inScopeTabId,
    overrides: { timezoneId: 'Europe/Berlin' },
  });
  expect(set.success).toBe(true);

  // The override provably applied to the PAGE (Emulation plane active) —
  // `Emulation.setTimezoneOverride` steers Intl immediately, unlike
  // `navigator.language` (which mirrors the UA-triple acceptLanguage).
  await expect
    .poll(() => inScopePage.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone), { timeout: 15_000 })
    .toBe('Europe/Berlin');

  // …while a WORKER-originated fetch is still intercepted (mock lands).
  const workerBody = await inScopePage.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        // Absolute URL — a blob worker has no hierarchical base, so a
        // relative fetch would throw a URL-parse TypeError before the wire.
        const src = `fetch('${location.origin}/echo?oh=pf1').then((r) => r.text()).then((t) => postMessage(t)).catch((e) => postMessage('ERR:' + e));`;
        const worker = new window.Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        const timer = setTimeout(() => reject(new Error('worker fetch timed out')), 15_000);
        worker.onmessage = (ev) => {
          clearTimeout(timer);
          worker.terminate();
          resolve(String(ev.data));
        };
      }),
  );
  expect(JSON.parse(workerBody)).toEqual({ oh: 'pf1-mock' });

  // Clear the overrides (empty bag clears).
  await workbench.rpc('setTabOverrides', { tabId: inScopeTabId, overrides: {} });
});

test('PF2 — a mid-session cache-disable flip takes effect immediately, no re-attach', async () => {
  const url = '/net/cacheable/audit-pf2.txt';
  const fetchStats = (expectedCount: number) =>
    inScopePage.evaluate(
      async ({ u, n }: { u: string; n: number }) => {
        // Consume the body — the resource-timing entry lands only once the
        // load FINISHES, not when the fetch promise resolves at headers.
        await (await fetch(u)).text();
        const name = new URL(u, location.href).href;
        for (let i = 0; i < 40; i++) {
          const entries = performance.getEntriesByName(name) as PerformanceResourceTiming[];
          if (entries.length >= n) {
            const last = entries[entries.length - 1];
            return { transferSize: last?.transferSize ?? -1, count: entries.length };
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return { transferSize: -1, count: performance.getEntriesByName(name).length };
      },
      { u: url, n: expectedCount },
    );

  const first = await fetchStats(1);
  expect(first.transferSize).toBeGreaterThan(0);

  const second = await fetchStats(2);
  expect(second.transferSize).toBe(0); // served from cache

  // Flip "Disable cache" mid-session — the CDP-exact disable must apply NOW.
  const flip = await workbench.rpc<{ success: boolean }>('setCacheBypass', { tabId: inScopeTabId, enabled: true });
  expect(flip.success).toBe(true);
  await inScopePage.waitForTimeout(500); // apply-now replay settle

  const third = await fetchStats(3);
  expect(third.transferSize).toBeGreaterThan(0); // re-fetched from the network

  await workbench.rpc('setCacheBypass', { tabId: inScopeTabId, enabled: false });
});

test('PC2 — closing a pinned tab drops the pin: no phantom pin, no attach fault', async () => {
  const pc2Url = `${ORIGIN}/?oh-audit=pc2`;
  const pc2Page = await context.newPage();
  await pc2Page.goto(pc2Url);
  const pc2TabId = await workbench.tabIdForUrl(pc2Url);
  await pin(pc2TabId, true);
  await waitAttached(pc2TabId);

  await pc2Page.close();

  // The tab-forgotten fanout must drop the pin from the overlay…
  await expect
    .poll(async () => ((await cdpStatus()).context?.pinnedTabs ?? []).includes(pc2TabId), { timeout: 15_000 })
    .toBe(false);

  // …and a later reconcile (any input change) must not chase the dead tab
  // into a spurious red "attach failed".
  await pin(inScopeTabId, true); // no-op input poke on an existing pin
  await inScopePage.waitForTimeout(1_000);
  const status = await cdpStatus();
  expect(status.state).not.toBe('red');
  expect(status.message ?? '').not.toContain('attach failed');
});

test('PB1/PB2 (Chrome leg) — an invalid __Host- jar write resolves with a threaded reason, no hang', async () => {
  const res = await workbench.rpc<{ cookie: unknown; error?: string }>('setCookieForUrl', {
    cookie: {
      name: '__Host-audit',
      value: 'x',
      domain: '127.0.0.1',
      path: '/',
      hostOnly: true,
      httpOnly: false,
      secure: false, // __Host- requires Secure — the browser must reject
    },
  });
  // The bridge resolved (no dangling RPC) with the degrade sentinel + reason.
  expect(res.cookie).toBeNull();
  expect(typeof res.error).toBe('string');
  expect((res.error ?? '').length).toBeGreaterThan(0);
});

test('PC3 — the popup mounts the "Tab out of scope" dormancy chip for an out-of-scope active tab', async () => {
  // The popup opened as a plain tab resolves ITSELF as the active tab — a
  // chrome-extension:// page that is never in the attach roster, so with the
  // master on and a realizable debug rule present the chip must show.
  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popupPage.getByText('Tab out of scope')).toBeVisible({ timeout: 15_000 });
  await popupPage.close();
});
