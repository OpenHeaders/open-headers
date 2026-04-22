/**
 * Live-orchestration e2e — verifies Phase I end-to-end through the
 * real extension RPC + storage boundary, in two layers:
 *
 *   1. Schema round-trip — `dependsOn` / `runIf` / `priorityFrom` /
 *      `parallelExecution` persist through `createLiveWorkflow` →
 *      `updateLiveWorkflow` → storage → `listLiveWorkflows`. Pure
 *      contract check; no network hop.
 *
 *   2. Runtime branching — workflow steps point at the playground's
 *      `/live/*` JSON endpoints; `refreshLiveWorkflowNow` drives the
 *      chain adapter end-to-end (SW fetch → extractor → cache). Covers
 *      the observable behaviour that only surfaces when a real HTTP
 *      response threads through `runChain`:
 *
 *        - Gate false → step skipped; cache retains only the root's
 *          captures; observability log classifies the skip as `gate`.
 *        - Gate true → both steps run; cache has both steps' captures.
 *        - Cascade skip → a downstream step whose runIf references a
 *          skipped ancestor is skipped with `cascade` classification
 *          and the upstream stepId recorded in the log message.
 *
 * The playground's `/live/*` endpoints are fixed-body JSON fixtures
 * (see `playground/vite.config.ts` → `LIVE_WORKFLOW_RESPONSES`).
 * Playwright boots the playground as a `webServer` (see
 * `playwright.config.ts`), so the dev server is already up when these
 * tests run.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');
const PLAYGROUND_URL = 'http://127.0.0.1:3000';

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : undefined,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2];
});

test.afterAll(async () => {
  await context.close();
});

async function newRpcPage(): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return root !== null && root.children.length > 0;
    },
    { timeout: 15000 },
  );
  return page;
}

async function rpc(page: Page, type: string, payload: Record<string, unknown> = {}): Promise<unknown> {
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

interface WorkflowSummary {
  uid: string;
  version: number;
  steps: Array<{
    id: string;
    dependsOn?: string[];
    runIf?: { all: unknown[] };
    priorityFrom?: { stepId: string; captureName: string; sort?: string };
  }>;
  parallelExecution?: boolean;
}

test.describe('Phase I — DAG primitive round-trip', () => {
  test('dependsOn + runIf + priorityFrom persist through RPC + storage', async () => {
    const caller = await newRpcPage();
    try {
      const created = (await rpc(caller, 'createLiveWorkflow', {
        name: 'phase-i-dag',
        enabled: true,
        refresh: { kind: 'manual' },
        steps: [
          {
            id: 'introspect',
            requestUid: 'reqintro0',
            captures: [{ name: 'active', extractor: { kind: 'json-path', path: '$.active' } }],
          },
          {
            id: 'refresh',
            requestUid: 'reqrefrsh',
            dependsOn: ['introspect'],
            runIf: {
              all: [
                {
                  kind: 'capture-equals',
                  stepId: 'introspect',
                  captureName: 'active',
                  value: 'false',
                },
              ],
            },
            priorityFrom: { stepId: 'introspect', captureName: 'active', sort: 'numeric' },
            captures: [{ name: 'token', extractor: { kind: 'json-path', path: '$.access_token' } }],
          },
        ],
      })) as { success: true; workflow: WorkflowSummary };

      expect(created.success).toBe(true);
      const { workflow: w } = created;
      expect(w.steps).toHaveLength(2);
      expect(w.steps[1].dependsOn).toEqual(['introspect']);
      expect(w.steps[1].runIf?.all).toHaveLength(1);
      expect(w.steps[1].priorityFrom).toEqual({ stepId: 'introspect', captureName: 'active', sort: 'numeric' });

      // Second read via `listLiveWorkflows` — exercises the storage
      // round-trip (persist → readValidatedArray → parse) rather than
      // returning the in-memory reference.
      const listed = (await rpc(caller, 'listLiveWorkflows')) as { workflows: WorkflowSummary[] };
      const reloaded = listed.workflows.find((wf) => wf.uid === w.uid);
      expect(reloaded).toBeDefined();
      expect(reloaded!.steps[1].dependsOn).toEqual(['introspect']);
      expect(reloaded!.steps[1].runIf?.all).toHaveLength(1);
      expect(reloaded!.steps[1].priorityFrom?.sort).toBe('numeric');

      // Tidy up so concurrent specs sharing this persistent context
      // don't accumulate state.
      await rpc(caller, 'deleteLiveWorkflow', { uid: w.uid });
    } finally {
      await caller.close();
    }
  });

  test('explicit `dependsOn: []` survives the round-trip as an explicit root', async () => {
    const caller = await newRpcPage();
    try {
      const created = (await rpc(caller, 'createLiveWorkflow', {
        name: 'phase-i-explicit-root',
        enabled: true,
        refresh: { kind: 'manual' },
        steps: [
          {
            id: 'alpha',
            requestUid: 'reqalpha0',
            captures: [{ name: 'v', extractor: { kind: 'whole-body' } }],
          },
          {
            id: 'beta',
            requestUid: 'reqbeta00',
            // Explicit root — beta is parallel to alpha, not a linear chain.
            dependsOn: [],
            captures: [{ name: 'v', extractor: { kind: 'whole-body' } }],
          },
        ],
      })) as { success: true; workflow: WorkflowSummary };

      expect(created.success).toBe(true);
      expect(created.workflow.steps[1].dependsOn).toEqual([]);

      const listed = (await rpc(caller, 'listLiveWorkflows')) as { workflows: WorkflowSummary[] };
      const reloaded = listed.workflows.find((wf) => wf.uid === created.workflow.uid);
      expect(reloaded!.steps[1].dependsOn).toEqual([]);

      await rpc(caller, 'deleteLiveWorkflow', { uid: created.workflow.uid });
    } finally {
      await caller.close();
    }
  });

  test('parallelExecution reserved field round-trips without mutation', async () => {
    const caller = await newRpcPage();
    try {
      // Create a workflow without parallelExecution — schema allows
      // it absent or false.
      const created = (await rpc(caller, 'createLiveWorkflow', {
        name: 'phase-i-parallel-check',
        enabled: true,
        refresh: { kind: 'manual' },
        steps: [
          {
            id: 'only',
            requestUid: 'reqonlyxx',
            captures: [{ name: 'v', extractor: { kind: 'whole-body' } }],
          },
        ],
      })) as { success: true; workflow: WorkflowSummary };

      // Update with `parallelExecution: false` — should round-trip
      // without mutation.
      const updated = (await rpc(caller, 'updateLiveWorkflow', {
        uid: created.workflow.uid,
        updates: { parallelExecution: false },
        expectedVersion: created.workflow.version,
      })) as { success: true; workflow: WorkflowSummary };

      expect(updated.success).toBe(true);
      expect(updated.workflow.parallelExecution).toBe(false);

      await rpc(caller, 'deleteLiveWorkflow', { uid: created.workflow.uid });
    } finally {
      await caller.close();
    }
  });
});

// ── Runtime branching ───────────────────────────────────────────────
//
// Steps point at the playground's fixed-body `/live/*` endpoints. A
// successful `refreshLiveWorkflowNow` call drives the SW's chain
// adapter end-to-end: fetch → extractor → cache. We then assert both
// on the resulting run (which captures survived) and on the
// observability log (which skip classification was recorded).

interface ExecutedRun {
  workflowUid: string;
  environmentId: string | null;
  stepCaptures: Record<string, Record<string, string>>;
  extractedAt: number;
  expiresAt: number | null;
  consecutiveFailures: number;
  lastExtractorOk: boolean;
}

interface ObservabilityEntry {
  timestamp: number;
  subsystem: string;
  op: string;
  level: string;
  message: string;
  context: Record<string, unknown>;
}

async function createRequestForLive(
  page: Page,
  name: string,
  endpoint: string,
): Promise<{ uid: string; version: number }> {
  const res = (await rpc(page, 'createLocalRequest', {
    name,
    seed: { method: 'GET', url: `${PLAYGROUND_URL}${endpoint}` },
  })) as { success: true; request: { uid: string; version: number } };
  expect(res.success).toBe(true);
  return res.request;
}

async function bindLiveVariableToStep(
  page: Page,
  workflowUid: string,
  stepId: string,
  captureName: string,
  name: string,
): Promise<{ uid: string }> {
  const res = (await rpc(page, 'createLiveVariable', {
    name,
    workflowUid,
    stepId,
    captureName,
    enabled: true,
  })) as { success: true; variable: { uid: string } };
  expect(res.success).toBe(true);
  return res.variable;
}

test.describe('Phase I — Runtime branching', () => {
  test.beforeEach(async () => {
    // Clean slate for observability assertions across scenarios. The
    // log is capped + in-memory, so leftover entries from prior tests
    // would flake the "only one step-skipped entry" assertions.
    const page = await newRpcPage();
    try {
      await rpc(page, 'clearObservabilityLog');
    } finally {
      await page.close();
    }
  });

  test('gate-false skips the downstream step; cache retains only the root capture', async () => {
    const caller = await newRpcPage();
    try {
      const introspectReq = await createRequestForLive(caller, 'introspect-valid', '/live/introspect/valid');
      const refreshReq = await createRequestForLive(caller, 'refresh-fresh-token', '/live/refresh');

      const created = (await rpc(caller, 'createLiveWorkflow', {
        name: 'phase-i-runtime-skip',
        enabled: true,
        refresh: { kind: 'manual' },
        steps: [
          {
            id: 'introspect',
            requestUid: introspectReq.uid,
            captures: [{ name: 'active', extractor: { kind: 'json-path', path: '$.active' } }],
          },
          {
            id: 'refresh',
            requestUid: refreshReq.uid,
            dependsOn: ['introspect'],
            runIf: {
              all: [{ kind: 'capture-equals', stepId: 'introspect', captureName: 'active', value: 'false' }],
            },
            captures: [{ name: 'token', extractor: { kind: 'json-path', path: '$.access_token' } }],
          },
        ],
      })) as { success: true; workflow: { uid: string } };

      const lv = await bindLiveVariableToStep(caller, created.workflow.uid, 'refresh', 'token', 'lvRuntimeSkipToken');

      const refreshed = (await rpc(caller, 'refreshLiveWorkflowNow', {
        workflowUid: created.workflow.uid,
      })) as { success: true; run: ExecutedRun } | { success: false; error: string };

      expect(refreshed.success).toBe(true);
      if (!refreshed.success) return;

      expect(refreshed.run.consecutiveFailures).toBe(0);
      expect(refreshed.run.lastExtractorOk).toBe(true);
      expect(refreshed.run.stepCaptures.introspect).toEqual({ active: 'true' });
      // Skipped steps contribute no cache entry — stepCaptures has only
      // the completed root step, not the gated-false `refresh`.
      expect(refreshed.run.stepCaptures.refresh).toBeUndefined();

      const log = (await rpc(caller, 'getObservabilityLog')) as { entries: ObservabilityEntry[] };
      const skipEntries = log.entries.filter(
        (e) => e.subsystem === 'live' && e.op === 'step-skipped' && e.context.workflowUid === created.workflow.uid,
      );
      expect(skipEntries).toHaveLength(1);
      expect(skipEntries[0].message).toContain('"refresh"');
      expect(skipEntries[0].message).toContain('(gate)');

      await rpc(caller, 'deleteLiveVariable', { uid: lv.uid });
      await rpc(caller, 'deleteLiveWorkflow', { uid: created.workflow.uid });
      await rpc(caller, 'deleteLocalRequest', { requestUid: refreshReq.uid });
      await rpc(caller, 'deleteLocalRequest', { requestUid: introspectReq.uid });
    } finally {
      await caller.close();
    }
  });

  test('gate-true runs the downstream step; cache has both captures', async () => {
    const caller = await newRpcPage();
    try {
      const introspectReq = await createRequestForLive(caller, 'introspect-stale', '/live/introspect/stale');
      const refreshReq = await createRequestForLive(caller, 'refresh-new-token', '/live/refresh');

      const created = (await rpc(caller, 'createLiveWorkflow', {
        name: 'phase-i-runtime-run',
        enabled: true,
        refresh: { kind: 'manual' },
        steps: [
          {
            id: 'introspect',
            requestUid: introspectReq.uid,
            captures: [{ name: 'active', extractor: { kind: 'json-path', path: '$.active' } }],
          },
          {
            id: 'refresh',
            requestUid: refreshReq.uid,
            dependsOn: ['introspect'],
            runIf: {
              all: [{ kind: 'capture-equals', stepId: 'introspect', captureName: 'active', value: 'false' }],
            },
            captures: [{ name: 'token', extractor: { kind: 'json-path', path: '$.access_token' } }],
          },
        ],
      })) as { success: true; workflow: { uid: string } };

      const lv = await bindLiveVariableToStep(caller, created.workflow.uid, 'refresh', 'token', 'lvRuntimeRunToken');

      const refreshed = (await rpc(caller, 'refreshLiveWorkflowNow', {
        workflowUid: created.workflow.uid,
      })) as { success: true; run: ExecutedRun } | { success: false; error: string };

      expect(refreshed.success).toBe(true);
      if (!refreshed.success) return;

      expect(refreshed.run.stepCaptures.introspect).toEqual({ active: 'false' });
      expect(refreshed.run.stepCaptures.refresh).toEqual({ token: 'live-e2e-refreshed-token' });

      const log = (await rpc(caller, 'getObservabilityLog')) as { entries: ObservabilityEntry[] };
      const skipEntries = log.entries.filter(
        (e) => e.subsystem === 'live' && e.op === 'step-skipped' && e.context.workflowUid === created.workflow.uid,
      );
      expect(skipEntries).toHaveLength(0);

      await rpc(caller, 'deleteLiveVariable', { uid: lv.uid });
      await rpc(caller, 'deleteLiveWorkflow', { uid: created.workflow.uid });
      await rpc(caller, 'deleteLocalRequest', { requestUid: refreshReq.uid });
      await rpc(caller, 'deleteLocalRequest', { requestUid: introspectReq.uid });
    } finally {
      await caller.close();
    }
  });

  test('cascade skip: downstream clause referencing a skipped ancestor logs (cascade from ...)', async () => {
    const caller = await newRpcPage();
    try {
      const probeReq = await createRequestForLive(caller, 'probe-no-go', '/live/probe/no-go');
      const fetchReq = await createRequestForLive(caller, 'probe-follow-up', '/live/refresh');
      const extractReq = await createRequestForLive(caller, 'probe-finalize', '/live/refresh');

      const created = (await rpc(caller, 'createLiveWorkflow', {
        name: 'phase-i-runtime-cascade',
        enabled: true,
        refresh: { kind: 'manual' },
        steps: [
          {
            id: 'probe',
            requestUid: probeReq.uid,
            captures: [{ name: 'go', extractor: { kind: 'json-path', path: '$.go' } }],
          },
          {
            id: 'follow',
            requestUid: fetchReq.uid,
            dependsOn: ['probe'],
            runIf: {
              all: [{ kind: 'capture-equals', stepId: 'probe', captureName: 'go', value: 'true' }],
            },
            captures: [{ name: 'token', extractor: { kind: 'json-path', path: '$.access_token' } }],
          },
          {
            id: 'finalize',
            requestUid: extractReq.uid,
            dependsOn: ['follow'],
            runIf: {
              all: [{ kind: 'capture-exists', stepId: 'follow', captureName: 'token' }],
            },
            captures: [{ name: 'token', extractor: { kind: 'json-path', path: '$.access_token' } }],
          },
        ],
      })) as { success: true; workflow: { uid: string } };

      // Bind a live variable so the workflow is schedulable + the
      // `refreshLiveWorkflowNow` RPC path runs the chain.
      const lv = await bindLiveVariableToStep(caller, created.workflow.uid, 'probe', 'go', 'lvRuntimeCascade');

      const refreshed = (await rpc(caller, 'refreshLiveWorkflowNow', {
        workflowUid: created.workflow.uid,
      })) as { success: true; run: ExecutedRun } | { success: false; error: string };

      expect(refreshed.success).toBe(true);
      if (!refreshed.success) return;

      // Only `probe` ran — `follow` gated off, `finalize` cascaded from
      // its dependency on `follow`'s capture.
      expect(refreshed.run.stepCaptures.probe).toEqual({ go: 'false' });
      expect(refreshed.run.stepCaptures.follow).toBeUndefined();
      expect(refreshed.run.stepCaptures.finalize).toBeUndefined();

      const log = (await rpc(caller, 'getObservabilityLog')) as { entries: ObservabilityEntry[] };
      const skipEntries = log.entries.filter(
        (e) => e.subsystem === 'live' && e.op === 'step-skipped' && e.context.workflowUid === created.workflow.uid,
      );
      expect(skipEntries).toHaveLength(2);
      const byStep = Object.fromEntries(
        skipEntries.map((e) => {
          const m = e.message.match(/step "([^"]+)"/);
          return [m?.[1] ?? '', e.message];
        }),
      );
      expect(byStep.follow).toContain('(gate)');
      expect(byStep.finalize).toContain('(cascade from "follow")');

      await rpc(caller, 'deleteLiveVariable', { uid: lv.uid });
      await rpc(caller, 'deleteLiveWorkflow', { uid: created.workflow.uid });
      await rpc(caller, 'deleteLocalRequest', { requestUid: extractReq.uid });
      await rpc(caller, 'deleteLocalRequest', { requestUid: fetchReq.uid });
      await rpc(caller, 'deleteLocalRequest', { requestUid: probeReq.uid });
    } finally {
      await caller.close();
    }
  });
});
