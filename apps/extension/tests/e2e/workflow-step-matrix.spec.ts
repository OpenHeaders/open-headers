/**
 * Workflow step-editor combination matrix — slice 7 e2e
 * (the workflow-graph plan §7, follow-up to the retry/timeout slice).
 *
 * Pairwise coverage over the six per-step dimensions — dependsOn
 * (implicit / explicit root / multi-parent) × run condition (each
 * clause kind) × priority × retry (attempts / delay / backoff /
 * retry-on / clear) × timeout (set / clear) × scripts (on / off) —
 * plus the interaction cases that matter:
 *
 *   - Seeded combinations render the right section summaries and the
 *     expanded controls carry the persisted values (including the
 *     read-only "Custom" retry-on entry for a data-authored shape the
 *     picker can't produce); summaries survive Form↔Graph toggles
 *     without dirtying the draft.
 *   - Editing every knob through the real UI persists the exact step
 *     fields on Save (readback over RPC): explicit multi-parent
 *     dependsOn, a capture-equals gate, priorityFrom, a full retry
 *     policy (attempts + delay + exponential + retry-on 429), and a
 *     timeout — gate + retry + timeout coexisting on one step.
 *   - Clearing every knob removes the fields outright: clearing the
 *     attempts field destroys the retry policy (bootstrap/destroy
 *     semantics), Clear buttons drop timeout + priority, removing the
 *     last clause drops the gate, Reset returns dependsOn to implicit.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Locator, type Page, test } from '@playwright/test';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let extensionId: string;
const pageErrors: string[] = [];

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2];
  await sw.evaluate(
    async () =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set({ onboardingCompleted: true }, () => resolve());
      }),
  );

  // The request store hydrates async on a fresh profile and rejects
  // mutations until then — probe with a real create once (the
  // live-orchestration readiness idiom), so every test's seeding RPCs
  // run against the steady state.
  const readiness = await context.newPage();
  await readiness.goto(`chrome-extension://${extensionId}/workbench.html`);
  await readiness.waitForFunction(() => {
    const root = document.getElementById('root');
    return root !== null && root.children.length > 0;
  });
  let probeUid = '';
  await expect
    .poll(
      async () => {
        const res = await rpc<{ success: boolean; request?: { uid: string } }>(readiness, 'createLocalRequest', {
          name: 'readiness-probe',
          seed: { method: 'GET', url: 'https://api.openheaders.io/probe', headers: [], params: [] },
        });
        probeUid = res.request?.uid ?? '';
        return res.success === true;
      },
      { timeout: 30000 },
    )
    .toBe(true);
  await rpc(readiness, 'deleteLocalRequest', { requestUid: probeUid });
  await readiness.close();
});

test.afterAll(async () => {
  await context.close();
});

function rpc<T = unknown>(page: Page, type: string, payload: Record<string, unknown> = {}): Promise<T> {
  return page.evaluate(
    ({ type: t, payload: p }: { type: string; payload: Record<string, unknown> }) =>
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: t, ...p }, (response) => {
          void chrome.runtime.lastError;
          resolve(response);
        });
      }),
    { type, payload },
  ) as Promise<T>;
}

// ── Shared recipes ─────────────────────────────────────────────────

async function openWorkbench(page: Page): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/workbench.html`);
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root !== null && root.children.length > 0;
  });
}

async function seedRequest(page: Page, name: string): Promise<string> {
  const res = await rpc<{ success: boolean; request?: { uid: string } }>(page, 'createLocalRequest', {
    name,
    seed: { method: 'GET', url: 'https://api.openheaders.io/matrix', headers: [], params: [], auth: null, body: null },
  });
  expect(res.success).toBe(true);
  return res.request!.uid;
}

async function openWorkflowEditor(page: Page, workflowUid: string): Promise<Locator> {
  await page.reload();
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root !== null && root.children.length > 0;
  });
  const workflowsTab = page.locator('[data-tool-window="workflows"]').first();
  if ((await workflowsTab.getAttribute('aria-selected')) !== 'true') {
    await workflowsTab.click();
  }
  const sectionHeader = page
    .getByRole('button', { name: /WORKFLOWS/ })
    .filter({ visible: true })
    .first();
  await sectionHeader.waitFor({ state: 'visible', timeout: 10000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') {
    await sectionHeader.click();
  }
  const row = page.locator(`[data-item-id="workflow-${workflowUid}"]`);
  await row.waitFor({ state: 'visible', timeout: 10000 });
  await row.click();
  const saveButton = page.getByRole('button', { name: 'Save' }).filter({ visible: true }).first();
  await saveButton.waitFor({ state: 'visible', timeout: 10000 });
  return saveButton;
}

function card(page: Page, stepId: string): Locator {
  return page.locator(`[data-step-card="${stepId}"]`);
}

/** Collapse section header inside a step card — role button whose
 *  accessible name starts with the section label. */
function sectionHeader(stepCard: Locator, label: string): Locator {
  return stepCard.getByRole('button', { name: new RegExp(label) });
}

/** Resolve an InputNumber's editable `<input>` from its testid — AntD
 *  may stamp the data attribute on the inner input or on a wrapper. */
function numberInput(page: Page, testId: string): Locator {
  return page.getByTestId(testId).locator('xpath=descendant-or-self::input').first();
}

/** Open an AntD Select (by locator) and pick the option with `label`. */
async function pickOption(page: Page, select: Locator, label: string): Promise<void> {
  await select.click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.locator(`.ant-select-item-option[title="${label}"]`).click();
}

// ── Tests ──────────────────────────────────────────────────────────

test('seeded combinations render section summaries + controls, survive view toggles', async () => {
  const page = await context.newPage();
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await openWorkbench(page);

  const requestUid = await seedRequest(page, 'matrix render request');

  // Pairwise-seeded steps:
  //   s1 implicit-root × full retry (exponential, 5xx) × timeout
  //   s2 single parent × status-eq gate × priority × minimal retry
  //   s3 explicit root × min-bound timeout
  //   s4 multi-parent × two-clause capture gate × data-authored
  //      retry-on the picker can't produce (renders as "Custom")
  const wfRes = await rpc<{ success: boolean; workflow?: { uid: string } }>(page, 'createLiveWorkflow', {
    name: 'matrix-render-e2e',
    enabled: true,
    refresh: { kind: 'manual' },
    steps: [
      {
        uid: 'stpmtx01',
        id: 's1',
        requestUid,
        captures: [
          { uid: 'capmtx01', name: 'token', extractor: { kind: 'json-path', path: '$.access_token' } },
          { uid: 'capmtx02', name: 'flag', extractor: { kind: 'json-path', path: '$.flag' } },
        ],
        retry: { maxAttempts: 3, delayMs: 500, backoff: 'exponential', retryOn: '5xx' },
        timeoutMs: 5000,
        runScripts: true,
      },
      {
        uid: 'stpmtx02',
        id: 's2',
        requestUid,
        dependsOn: ['s1'],
        runIf: { all: [{ uid: 'gatmtx01', kind: 'status', stepId: 's1', match: ['eq', 201] }] },
        priorityFrom: { stepId: 's1', captureName: 'token' },
        retry: { maxAttempts: 2 },
        captures: [],
      },
      { uid: 'stpmtx03', id: 's3', requestUid, dependsOn: [], timeoutMs: 100, captures: [] },
      {
        uid: 'stpmtx04',
        id: 's4',
        requestUid,
        dependsOn: ['s2', 's3'],
        runIf: {
          all: [
            { uid: 'gatmtx02', kind: 'capture-equals', stepId: 's1', captureName: 'token', value: 'abc' },
            { uid: 'gatmtx03', kind: 'capture-matches', stepId: 's1', captureName: 'flag', pattern: '^on$' },
          ],
        },
        retry: { maxAttempts: 5, retryOn: ['ne', 500] },
        captures: [],
      },
    ],
  });
  expect(wfRes.success).toBe(true);

  const saveButton = await openWorkflowEditor(page, wfRes.workflow!.uid);
  await expect(saveButton).toBeDisabled();

  // Section summaries per card — every dimension's collapsed label.
  const s1 = card(page, 's1');
  await expect(sectionHeader(s1, 'Depends on')).toContainText('(implicit — prior step)');
  await expect(sectionHeader(s1, 'Run condition')).toContainText('(none)');
  await expect(sectionHeader(s1, 'Priority')).toContainText('(none)');
  await expect(sectionHeader(s1, 'Retry policy')).toContainText('(3 attempts, exponential)');
  await expect(sectionHeader(s1, 'Timeout')).toContainText('(5000 ms)');
  await expect(sectionHeader(s1, 'Scripts')).toContainText('(on)');
  // Opted-in step advertises itself in the card header chip row.
  await expect(s1.getByText('scripts', { exact: true })).toBeVisible();

  const s2 = card(page, 's2');
  await expect(sectionHeader(s2, 'Depends on')).toContainText('(s1)');
  await expect(sectionHeader(s2, 'Run condition')).toContainText('(1)');
  await expect(sectionHeader(s2, 'Priority')).toContainText('(s1.token)');
  await expect(sectionHeader(s2, 'Retry policy')).toContainText('(2 attempts)');
  await expect(sectionHeader(s2, 'Timeout')).toContainText('(none)');
  await expect(sectionHeader(s2, 'Scripts')).toContainText('(off)');

  const s3 = card(page, 's3');
  await expect(sectionHeader(s3, 'Depends on')).toContainText('(root)');
  await expect(sectionHeader(s3, 'Timeout')).toContainText('(100 ms)');
  await expect(sectionHeader(s3, 'Retry policy')).toContainText('(none)');

  const s4 = card(page, 's4');
  await expect(sectionHeader(s4, 'Depends on')).toContainText('(s2, s3)');
  await expect(sectionHeader(s4, 'Run condition')).toContainText('(2)');
  await expect(sectionHeader(s4, 'Retry policy')).toContainText('(5 attempts)');

  // Expanded s1 retry: controls carry the persisted policy.
  await sectionHeader(s1, 'Retry policy').click();
  await expect(page.getByTestId('wf-step-0-retry')).toBeVisible();
  await expect(numberInput(page, 'wf-step-0-retry-attempts')).toHaveValue('3');
  await expect(numberInput(page, 'wf-step-0-retry-delay')).toHaveValue('500');
  await expect(page.getByTestId('wf-step-0-retry-backoff')).toContainText('Exponential');
  await expect(page.getByTestId('wf-step-0-retry-on')).toContainText('Network + 5xx');

  // Expanded s4 retry: the data-authored ['ne', 500] renders as the
  // read-only Custom entry — never silently rewritten.
  await sectionHeader(s4, 'Retry policy').click();
  await expect(page.getByTestId('wf-step-3-retry-on')).toContainText('Custom (edited as data)');

  // Expanded s4 gate: both clause kinds render their persisted values.
  await sectionHeader(s4, 'Run condition').click();
  const s4Gate = page.getByTestId('wf-step-3-runif');
  await expect(s4Gate.getByTestId('gate-clause-0-value')).toHaveValue('abc');
  await expect(s4Gate.getByTestId('gate-clause-1-pattern')).toHaveValue('^on$');

  // Expansion never dirties the draft; summaries survive Form↔Graph.
  await expect(saveButton).toBeDisabled();
  await page.getByText('Preview', { exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByTestId('wf-graph-pane')).toBeVisible();
  await page.getByText('Editor', { exact: true }).filter({ visible: true }).first().click();
  await expect(sectionHeader(card(page, 's1'), 'Retry policy')).toContainText('(3 attempts, exponential)');
  await expect(sectionHeader(card(page, 's3'), 'Depends on')).toContainText('(root)');
  await expect(saveButton).toBeDisabled();

  await page.close();
});

test('editing every knob through the UI persists the exact step fields on Save', async () => {
  const page = await context.newPage();
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await openWorkbench(page);

  const requestUid = await seedRequest(page, 'matrix edit request');
  const wfRes = await rpc<{ success: boolean; workflow?: { uid: string } }>(page, 'createLiveWorkflow', {
    name: 'matrix-edit-e2e',
    enabled: true,
    refresh: { kind: 'manual' },
    steps: [
      {
        uid: 'stpedt01',
        id: 'a',
        requestUid,
        captures: [{ uid: 'capedt01', name: 'token', extractor: { kind: 'json-path', path: '$.access_token' } }],
      },
      { uid: 'stpedt02', id: 'b', requestUid, captures: [] },
      { uid: 'stpedt03', id: 'c', requestUid, captures: [] },
    ],
  });
  expect(wfRes.success).toBe(true);
  const workflowUid = wfRes.workflow!.uid;

  const saveButton = await openWorkflowEditor(page, workflowUid);
  await expect(saveButton).toBeDisabled();

  // ── Step b (index 1): retry + timeout on one step ────────────────
  const b = card(page, 'b');
  await sectionHeader(b, 'Retry policy').click();

  // No policy yet — the dependent controls are disabled until the
  // attempts field bootstraps one.
  await expect(numberInput(page, 'wf-step-1-retry-delay')).toBeDisabled();
  await expect(page.getByTestId('wf-step-1-retry-backoff')).toHaveClass(/ant-select-disabled/);

  await numberInput(page, 'wf-step-1-retry-attempts').fill('4');
  await expect(sectionHeader(b, 'Retry policy')).toContainText('(4 attempts)');
  await numberInput(page, 'wf-step-1-retry-delay').fill('2000');
  await pickOption(page, page.getByTestId('wf-step-1-retry-backoff'), 'Exponential');
  await pickOption(page, page.getByTestId('wf-step-1-retry-on'), 'Network + 429');
  await expect(sectionHeader(b, 'Retry policy')).toContainText('(4 attempts, exponential)');

  await sectionHeader(b, 'Timeout').click();
  await numberInput(page, 'wf-step-1-timeout').fill('1500');
  await expect(sectionHeader(b, 'Timeout')).toContainText('(1500 ms)');

  await sectionHeader(b, 'Scripts').click();
  await page.getByTestId('wf-step-1-run-scripts').click();
  await expect(sectionHeader(b, 'Scripts')).toContainText('(on)');
  await expect(saveButton).toBeEnabled();

  // ── Step c (index 2): multi-parent deps + gate + priority ────────
  const c = card(page, 'c');
  await sectionHeader(c, 'Depends on').click();
  await page.getByTestId('wf-step-2-deps-select').click();
  const depsDropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await depsDropdown.locator('.ant-select-item-option[title="a"]').click();
  await depsDropdown.locator('.ant-select-item-option[title="b"]').click();
  await page.keyboard.press('Escape');
  await expect(sectionHeader(c, 'Depends on')).toContainText('(a, b)');
  await expect(c).toContainText('after a, b');

  await sectionHeader(c, 'Run condition').click();
  const gate = page.getByTestId('wf-step-2-runif');
  await gate.getByTestId('gate-add-condition').click();
  await expect(gate.getByTestId('gate-clause-0')).toBeVisible();
  await pickOption(page, gate.getByTestId('gate-clause-0-step'), 'a');
  await pickOption(page, gate.getByTestId('gate-clause-0-kind'), 'Capture equals');
  await pickOption(page, gate.getByTestId('gate-clause-0-capture'), 'token');
  await gate.getByTestId('gate-clause-0-value').fill('yes');
  await expect(sectionHeader(c, 'Run condition')).toContainText('(1)');

  await sectionHeader(c, 'Priority').click();
  await pickOption(page, page.getByTestId('wf-step-2-priority-step'), 'a');
  await pickOption(page, page.getByTestId('wf-step-2-priority-capture'), 'token');
  await expect(sectionHeader(c, 'Priority')).toContainText('(a.token)');

  // ── Save → exact persisted shape over RPC readback ───────────────
  await saveButton.click();

  type PersistedStep = {
    id: string;
    dependsOn?: string[];
    runIf?: { all: Record<string, unknown>[] };
    priorityFrom?: { stepId: string; captureName: string };
    retry?: Record<string, unknown>;
    timeoutMs?: number;
    runScripts?: boolean;
  };
  await expect
    .poll(async () => {
      const res = await rpc<{ workflow: { steps: PersistedStep[] } | null }>(page, 'getLiveWorkflow', {
        uid: workflowUid,
      });
      return res.workflow?.steps ?? null;
    })
    .toMatchObject([
      { id: 'a' },
      {
        id: 'b',
        retry: { maxAttempts: 4, delayMs: 2000, backoff: 'exponential', retryOn: ['eq', 429] },
        timeoutMs: 1500,
        runScripts: true,
      },
      {
        id: 'c',
        dependsOn: ['a', 'b'],
        runIf: { all: [{ kind: 'capture-equals', stepId: 'a', captureName: 'token', value: 'yes' }] },
        priorityFrom: { stepId: 'a', captureName: 'token' },
      },
    ]);

  // A persisted save must also clear the derived-dirty state — the
  // echo comes back with chrome.storage-alphabetized keys, so this
  // pins the canonical fingerprint (a plain-JSON compare would stay
  // dirty forever and raise a phantom external-change banner).
  await expect(saveButton).toBeDisabled();
  await expect(page.getByText('changed externally', { exact: false })).toHaveCount(0);

  await page.close();
});

test('clearing every knob removes the fields and persists the deletions', async () => {
  const page = await context.newPage();
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await openWorkbench(page);

  const requestUid = await seedRequest(page, 'matrix clear request');
  const wfRes = await rpc<{ success: boolean; workflow?: { uid: string } }>(page, 'createLiveWorkflow', {
    name: 'matrix-clear-e2e',
    enabled: true,
    refresh: { kind: 'manual' },
    steps: [
      {
        uid: 'stpclr01',
        id: 'a',
        requestUid,
        captures: [{ uid: 'capclr01', name: 'token', extractor: { kind: 'json-path', path: '$.access_token' } }],
      },
      {
        uid: 'stpclr02',
        id: 'b',
        requestUid,
        dependsOn: ['a'],
        runIf: { all: [{ uid: 'gatclr01', kind: 'capture-exists', stepId: 'a', captureName: 'token' }] },
        priorityFrom: { stepId: 'a', captureName: 'token' },
        retry: { maxAttempts: 3, delayMs: 250, backoff: 'exponential', retryOn: '5xx' },
        timeoutMs: 3000,
        runScripts: true,
        captures: [],
      },
    ],
  });
  expect(wfRes.success).toBe(true);
  const workflowUid = wfRes.workflow!.uid;

  const saveButton = await openWorkflowEditor(page, workflowUid);
  await expect(saveButton).toBeDisabled();
  const b = card(page, 'b');

  // Clearing the attempts field destroys the whole policy (bootstrap/
  // destroy semantics) and re-disables the dependent controls.
  await sectionHeader(b, 'Retry policy').click();
  await numberInput(page, 'wf-step-1-retry-attempts').fill('');
  await expect(sectionHeader(b, 'Retry policy')).toContainText('(none)');
  await expect(numberInput(page, 'wf-step-1-retry-delay')).toBeDisabled();

  // Timeout + Priority go through their Clear buttons.
  await sectionHeader(b, 'Timeout').click();
  await page.getByTestId('wf-step-1-timeout-section').getByRole('button', { name: 'Clear' }).click();
  await expect(sectionHeader(b, 'Timeout')).toContainText('(none)');

  await sectionHeader(b, 'Priority').click();
  await page.getByTestId('wf-step-1-priority').getByRole('button', { name: 'Clear' }).click();
  await expect(sectionHeader(b, 'Priority')).toContainText('(none)');

  // Removing the last clause drops the gate entirely (never `{all: []}`).
  await sectionHeader(b, 'Run condition').click();
  await page.getByTestId('wf-step-1-runif').getByRole('button', { name: 'Remove clause 1' }).click();
  await expect(sectionHeader(b, 'Run condition')).toContainText('(none)');

  // Reset returns dependsOn to the implicit prior-step relationship.
  await sectionHeader(b, 'Depends on').click();
  await page.getByTestId('wf-step-1-deps').getByRole('button', { name: 'Reset' }).click();
  await expect(sectionHeader(b, 'Depends on')).toContainText('(implicit — prior step)');

  // Toggling scripts off deletes the field (absent is canonical).
  await sectionHeader(b, 'Scripts').click();
  await page.getByTestId('wf-step-1-run-scripts').click();
  await expect(sectionHeader(b, 'Scripts')).toContainText('(off)');

  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await expect(saveButton).toBeDisabled();

  type PersistedStep = {
    id: string;
    dependsOn?: string[];
    runIf?: unknown;
    priorityFrom?: unknown;
    retry?: unknown;
    timeoutMs?: number;
  };
  await expect
    .poll(async () => {
      const res = await rpc<{ workflow: { steps: PersistedStep[] } | null }>(page, 'getLiveWorkflow', {
        uid: workflowUid,
      });
      const b2 = res.workflow?.steps.find((s) => s.id === 'b');
      if (!b2) return null;
      return {
        dependsOn: b2.dependsOn,
        runIf: b2.runIf,
        priorityFrom: b2.priorityFrom,
        retry: b2.retry,
        timeoutMs: b2.timeoutMs,
      };
    })
    .toEqual({
      dependsOn: undefined,
      runIf: undefined,
      priorityFrom: undefined,
      retry: undefined,
      timeoutMs: undefined,
    });

  await page.close();
});

test('no page errors across the suite', () => {
  expect(pageErrors).toEqual([]);
});
