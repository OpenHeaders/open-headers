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
 *   - Seeded combinations render in the step's panel: its cards (Depends
 *     on, Run condition, Request) carry the persisted values, as do the
 *     sections that are not cards yet — their summaries and expanded
 *     controls (including the read-only "Custom" retry-on entry for a
 *     data-authored shape the picker can't produce); they survive a step
 *     being closed and reopened without dirtying the draft.
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
import { type BrowserContext, expect, type Locator, type Page, test } from '@playwright/test';
import { launchExtensionContext } from './fixtures/launch-extension';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let extensionId: string;
const pageErrors: string[] = [];

test.beforeAll(async () => {
  context = await launchExtensionContext('', extensionPath);
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
      { timeout: 20_000 },
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
  await sectionHeader.waitFor({ state: 'visible', timeout: 5_000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') {
    await sectionHeader.click();
  }
  const row = page.locator(`[data-item-id="workflow-${workflowUid}"]`);
  await row.waitFor({ state: 'visible', timeout: 5_000 });
  await row.click();
  const saveButton = page.getByRole('button', { name: 'Save' }).filter({ visible: true }).first();
  await saveButton.waitFor({ state: 'visible', timeout: 5_000 });
  return saveButton;
}

function card(page: Page, stepId: string): Locator {
  return page.locator(`[data-step-card="${stepId}"]`);
}

/**
 * Open a step in the view's panel by its node on the graph — re-centred
 * first, so a node below the strip is in reach; its card is the one the
 * panel shows.
 */
async function openStep(page: Page, stepId: string): Promise<Locator> {
  await page.getByTestId('wf-graph-fit').filter({ visible: true }).first().click();
  await page.getByTestId(`wf-graph-node-${stepId}`).filter({ visible: true }).first().click();
  const stepCard = card(page, stepId).filter({ visible: true });
  await expect(stepCard).toBeVisible();
  return stepCard;
}

/** Open a tab of the open step's panel: the cards of its other tabs are not in the page. */
async function openTab(page: Page, tab: 'setup' | 'flow' | 'data' | 'last-run'): Promise<void> {
  const button = page.getByTestId(`wf-step-tab-${tab}`).filter({ visible: true }).first();
  await button.click();
  await expect(button).toHaveAttribute('aria-selected', 'true');
}

/** A step's Priority card, by the step's place among the steps. */
function priorityCard(page: Page, index: number): Locator {
  return page.getByTestId(`wf-step-${index}-priority`);
}

/** A step's Depends on card, by the step's place among the steps. */
function depsCard(page: Page, index: number): Locator {
  return page.getByTestId(`wf-step-${index}-deps`);
}

/** A step's Run condition card. */
function gateCard(page: Page, index: number): Locator {
  return page.getByTestId(`wf-step-${index}-runif`);
}

/** The checkbox of a call's Request card that runs the request's scripts. */
function scriptsCheckbox(page: Page, index: number): Locator {
  return page.getByTestId(`wf-step-${index}-run-scripts`);
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

test('seeded combinations render in the cards, and survive a step being closed and reopened', async () => {
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

  // The graph is there beside the panel; no step's card is open yet.
  await expect(page.getByTestId('wf-graph-pane')).toBeVisible();
  await expect(page.locator('[data-step-card]')).toHaveCount(0);

  // Every dimension per step: each card says its own, on its tab — a step
  // opens on Setup, and the next one on the tab the last was on.
  // s1's Request, Retry policy and Timeout cards carry the persisted policy and ceiling.
  await openStep(page, 's1');
  await expect(page.getByTestId('wf-step-tab-setup').filter({ visible: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(scriptsCheckbox(page, 0)).toBeChecked();
  await expect(page.getByTestId('wf-step-0-retry')).toBeVisible();
  await expect(numberInput(page, 'wf-step-0-retry-attempts')).toHaveValue('3');
  await expect(numberInput(page, 'wf-step-0-retry-delay')).toHaveValue('500');
  await expect(page.getByTestId('wf-step-0-retry-backoff')).toContainText('Exponential');
  await expect(page.getByTestId('wf-step-0-retry-on')).toContainText('Network + 5xx');
  await expect(numberInput(page, 'wf-step-0-timeout')).toHaveValue('5000');
  // A card of another tab is not in the page.
  await expect(depsCard(page, 0)).toHaveCount(0);

  // s1 names no dependency and no step is before it: it starts with the workflow.
  await openTab(page, 'flow');
  await expect(page.getByTestId('wf-step-0-retry')).toHaveCount(0);
  await expect(depsCard(page, 0)).toContainText('Nothing. This step starts with the workflow.');
  await expect(depsCard(page, 0).getByRole('button', { name: 'Reset' })).toHaveCount(0);
  await expect(gateCard(page, 0).getByTestId('gate-clause-0')).toHaveCount(0);
  await expect(gateCard(page, 0).getByTestId('gate-summary')).toHaveText(
    'No dependencies, so this step runs when the workflow starts.',
  );
  await expect(page.getByTestId('wf-step-0-priority-step')).toContainText('None');
  await expect(priorityCard(page, 0).getByRole('button', { name: 'Clear' })).toHaveCount(0);

  // The panel shows one step: opening another replaces the card, on the tab that was open.
  await openStep(page, 's2');
  await expect(page.locator('[data-step-card]')).toHaveCount(1);
  await expect(depsCard(page, 0)).toHaveCount(0);
  await expect(page.getByTestId('wf-step-1-dep-s1')).toBeVisible();
  await expect(depsCard(page, 1)).toContainText('Chosen for this step.');
  await expect(gateCard(page, 1).getByTestId('gate-clause-0')).toBeVisible();
  await expect(gateCard(page, 1).getByTestId('gate-clause-1')).toHaveCount(0);
  await expect(gateCard(page, 1).getByTestId('gate-summary')).toHaveText('Runs when every condition holds: s1 201.');
  await expect(page.getByTestId('wf-step-1-priority-step')).toContainText('s1');
  await expect(page.getByTestId('wf-step-1-priority-capture')).toContainText('token');
  await openTab(page, 'setup');
  await expect(page.getByTestId('wf-step-0-retry')).toHaveCount(0);
  await expect(numberInput(page, 'wf-step-1-retry-attempts')).toHaveValue('2');
  await expect(page.getByTestId('wf-step-1-retry-backoff')).toContainText('Fixed');
  await expect(numberInput(page, 'wf-step-1-timeout')).toHaveValue('');
  await expect(scriptsCheckbox(page, 1)).not.toBeChecked();

  // s3 names an empty list: a root by its own word, so Reset is offered.
  await openStep(page, 's3');
  await expect(numberInput(page, 'wf-step-2-timeout')).toHaveValue('100');
  await expect(numberInput(page, 'wf-step-2-retry-attempts')).toHaveValue('');
  await expect(numberInput(page, 'wf-step-2-retry-delay')).toBeDisabled();
  await openTab(page, 'flow');
  await expect(depsCard(page, 2)).toContainText('Nothing. This step starts with the workflow.');
  await expect(depsCard(page, 2).getByRole('button', { name: 'Reset' })).toBeVisible();

  await openStep(page, 's4');
  await expect(page.getByTestId('wf-step-3-dep-s2')).toBeVisible();
  await expect(page.getByTestId('wf-step-3-dep-s3')).toBeVisible();

  // s4's gate: both clause kinds render their persisted values.
  const s4Gate = gateCard(page, 3);
  await expect(s4Gate.getByTestId('gate-clause-0-value')).toHaveValue('abc');
  await expect(s4Gate.getByTestId('gate-clause-1-pattern')).toHaveValue('^on$');
  await expect(s4Gate.getByTestId('gate-clause-2')).toHaveCount(0);

  // s4's retry: the data-authored ['ne', 500] renders as the
  // read-only Custom entry — never silently rewritten.
  await openTab(page, 'setup');
  await expect(numberInput(page, 'wf-step-3-retry-attempts')).toHaveValue('5');
  await expect(page.getByTestId('wf-step-3-retry-on')).toContainText('Custom (edited as data)');

  // Reading never dirties the draft; what a step says survives its being closed and reopened.
  await expect(saveButton).toBeDisabled();
  await page.getByTestId('wf-panel-close').click();
  await expect(page.locator('[data-step-card]')).toHaveCount(0);
  await openStep(page, 's1');
  await expect(numberInput(page, 'wf-step-0-retry-attempts')).toHaveValue('3');
  await expect(page.getByTestId('wf-step-0-retry-backoff')).toContainText('Exponential');
  await openStep(page, 's3');
  await openTab(page, 'flow');
  await expect(depsCard(page, 2)).toContainText('Nothing. This step starts with the workflow.');
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
  await openStep(page, 'b');
  const retryCard = page.getByTestId('wf-step-1-retry');
  const timeoutCard = page.getByTestId('wf-step-1-timeout-section');

  // No policy yet — the dependent controls are disabled until the
  // attempts field bootstraps one, and there is nothing to clear.
  await expect(numberInput(page, 'wf-step-1-retry-delay')).toBeDisabled();
  await expect(page.getByTestId('wf-step-1-retry-backoff')).toHaveClass(/ant-select-disabled/);
  await expect(retryCard.getByRole('button', { name: 'Clear' })).toHaveCount(0);

  await numberInput(page, 'wf-step-1-retry-attempts').fill('4');
  await expect(retryCard.getByRole('button', { name: 'Clear' })).toBeVisible();
  await numberInput(page, 'wf-step-1-retry-delay').fill('2000');
  await pickOption(page, page.getByTestId('wf-step-1-retry-backoff'), 'Exponential');
  await pickOption(page, page.getByTestId('wf-step-1-retry-on'), 'Network + 429');
  await expect(page.getByTestId('wf-step-1-retry-backoff')).toContainText('Exponential');
  await expect(page.getByTestId('wf-step-1-retry-on')).toContainText('Network + 429');

  await expect(timeoutCard.getByRole('button', { name: 'Clear' })).toHaveCount(0);
  await numberInput(page, 'wf-step-1-timeout').fill('1500');
  await expect(timeoutCard.getByRole('button', { name: 'Clear' })).toBeVisible();

  await scriptsCheckbox(page, 1).check();
  await expect(scriptsCheckbox(page, 1)).toBeChecked();
  await expect(saveButton).toBeEnabled();

  // ── Step c (index 2): multi-parent deps + gate + priority ────────
  // c names no dependency, so it waits for b, the step before it. Add
  // takes one step a pick, and the first pick writes the list out.
  await openStep(page, 'c');
  await openTab(page, 'flow');
  await expect(page.getByTestId('wf-step-2-dep-b')).toBeVisible();
  await expect(depsCard(page, 2)).toContainText('By default it waits for the step before it.');
  await pickOption(page, page.getByTestId('wf-step-2-deps-select'), 'a');
  await expect(page.getByTestId('wf-step-2-dep-a')).toBeVisible();
  await expect(page.getByTestId('wf-step-2-dep-b')).toBeVisible();
  await expect(depsCard(page, 2)).toContainText('Chosen for this step.');

  const gate = gateCard(page, 2);
  await gate.getByTestId('gate-add-condition').click();
  await expect(gate.getByTestId('gate-clause-0')).toBeVisible();
  await pickOption(page, gate.getByTestId('gate-clause-0-step'), 'a');
  await pickOption(page, gate.getByTestId('gate-clause-0-kind'), 'Capture equals');
  await pickOption(page, gate.getByTestId('gate-clause-0-capture'), 'token');
  await gate.getByTestId('gate-clause-0-value').fill('yes');
  await expect(gate.getByTestId('gate-clause-1')).toHaveCount(0);

  await expect(page.getByTestId('wf-step-2-priority-capture')).toHaveClass(/ant-select-disabled/);
  await pickOption(page, page.getByTestId('wf-step-2-priority-step'), 'a');
  await pickOption(page, page.getByTestId('wf-step-2-priority-capture'), 'token');
  await expect(page.getByTestId('wf-step-2-priority-capture')).toContainText('token');
  await expect(priorityCard(page, 2).getByRole('button', { name: 'Clear' })).toBeVisible();

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
  await openStep(page, 'b');

  // Clearing the attempts field destroys the whole policy (bootstrap/
  // destroy semantics) and re-disables the dependent controls.
  await numberInput(page, 'wf-step-1-retry-attempts').fill('');
  await expect(page.getByTestId('wf-step-1-retry').getByRole('button', { name: 'Clear' })).toHaveCount(0);
  await expect(numberInput(page, 'wf-step-1-retry-delay')).toBeDisabled();
  await expect(numberInput(page, 'wf-step-1-retry-delay')).toHaveValue('');

  // Timeout + Priority go through their Clear buttons.
  await page.getByTestId('wf-step-1-timeout-section').getByRole('button', { name: 'Clear' }).click();
  await expect(numberInput(page, 'wf-step-1-timeout')).toHaveValue('');

  // Unticking scripts deletes the field (absent is canonical).
  await scriptsCheckbox(page, 1).uncheck();
  await expect(scriptsCheckbox(page, 1)).not.toBeChecked();

  // The rest is on the step's Flow tab.
  await openTab(page, 'flow');
  await priorityCard(page, 1).getByRole('button', { name: 'Clear' }).click();
  await expect(priorityCard(page, 1).getByRole('button', { name: 'Clear' })).toHaveCount(0);
  await expect(page.getByTestId('wf-step-1-priority-step')).toContainText('None');

  // Removing the last clause drops the gate entirely (never `{all: []}`).
  await gateCard(page, 1).getByRole('button', { name: 'Remove clause 1' }).click();
  await expect(gateCard(page, 1).getByTestId('gate-clause-0')).toHaveCount(0);
  await expect(gateCard(page, 1).getByTestId('gate-summary')).toHaveText(
    'No conditions — step runs whenever its dependencies complete.',
  );

  // Reset returns dependsOn to the implicit prior-step relationship.
  await depsCard(page, 1).getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByTestId('wf-step-1-dep-a')).toBeVisible();
  await expect(depsCard(page, 1)).toContainText('By default it waits for the step before it.');

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
    runScripts?: boolean;
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
        runScripts: b2.runScripts,
      };
    })
    .toEqual({
      dependsOn: undefined,
      runIf: undefined,
      priorityFrom: undefined,
      retry: undefined,
      timeoutMs: undefined,
      runScripts: undefined,
    });

  await page.close();
});

test('no page errors across the suite', () => {
  expect(pageErrors).toEqual([]);
});
