/**
 * Workflow graph mode — slice 1 e2e (WORKFLOW_GRAPH_PLAN.md §7).
 *
 * Seeds a fan-out/fan-in workflow via real RPC (request + workflow +
 * one bound LV for the exposure mark), opens its editor from the
 * Workflows sidebar, and drives the Form | Graph toggle:
 *
 *   - Graph pane renders one node per step (`wf-graph-node-<stepId>`),
 *     one edge per resolved dependsOn (`wf-graph-edge-<from>-<to>`),
 *     the gate marker on the gated step, and the exposed capture's
 *     live name.
 *   - Layout is layered: the two fan-out children share a row below
 *     the root; the sink sits below both.
 *   - Toggling back to Form is loss-free: step editors reappear and
 *     Save stays disabled (the toggle never dirties the draft).
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';

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

test('graph toggle renders the step DAG and returns to the form loss-free', async () => {
  const page = await context.newPage();
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(`chrome-extension://${extensionId}/workbench.html`);
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root !== null && root.children.length > 0;
  });

  // Seed through the real RPC boundary: a request (for the node's
  // method + name line), a fan-out/fan-in workflow, and one LV bound
  // to the root capture so its chip renders the exposed live name.
  const reqRes = await rpc<{ success: boolean; request?: { uid: string } }>(page, 'createLocalRequest', {
    name: 'Token introspection',
    seed: { method: 'GET', url: 'https://api.openheaders.io/introspect', headers: [], params: [], auth: null, body: null },
  });
  expect(reqRes.success).toBe(true);
  const requestUid = reqRes.request!.uid;

  const wfRes = await rpc<{ success: boolean; workflow?: { uid: string; name: string } }>(page, 'createLiveWorkflow', {
    name: 'graph-e2e',
    enabled: true,
    refresh: { kind: 'manual' },
    steps: [
      {
        id: 'root',
        requestUid,
        captures: [{ name: 'token', extractor: { kind: 'json-path', path: '$.access_token' } }],
      },
      {
        id: 'left',
        requestUid,
        dependsOn: ['root'],
        runIf: { all: [{ kind: 'capture-exists', stepId: 'root', captureName: 'token' }] },
        captures: [],
      },
      { id: 'right', requestUid, dependsOn: ['root'], captures: [] },
      { id: 'sink', requestUid, dependsOn: ['left', 'right'], captures: [] },
    ],
  });
  expect(wfRes.success).toBe(true);
  const workflowUid = wfRes.workflow!.uid;

  const lvRes = await rpc<{ success: boolean }>(page, 'createLiveVariable', {
    name: 'introspection_token',
    workflowUid,
    stepId: 'root',
    captureName: 'token',
    enabled: true,
  });
  expect(lvRes.success).toBe(true);

  // Open the workflow's editor from the Workflows sidebar. State-driven:
  // activate the tool window only if it isn't selected, expand the
  // WORKFLOWS section only if it's collapsed.
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

  // The editor opens on the Form view: step editors visible, no pane.
  const saveButton = page.getByRole('button', { name: 'Save' }).filter({ visible: true }).first();
  await saveButton.waitFor({ state: 'visible', timeout: 10000 });
  await expect(page.getByTestId('wf-graph-pane')).toHaveCount(0);

  await page.getByText('Graph', { exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByTestId('wf-graph-pane')).toBeVisible();

  // One node per step, one edge per resolved dependsOn parent.
  for (const stepId of ['root', 'left', 'right', 'sink']) {
    await expect(page.getByTestId(`wf-graph-node-${stepId}`)).toBeVisible();
  }
  for (const [from, to] of [
    ['root', 'left'],
    ['root', 'right'],
    ['left', 'sink'],
    ['right', 'sink'],
  ]) {
    await expect(page.getByTestId(`wf-graph-edge-${from}-${to}`)).toHaveCount(1);
  }

  // Gate marker on the gated step only.
  await expect(page.getByTestId('wf-graph-gate-left')).toBeVisible();
  await expect(page.getByTestId('wf-graph-gate-right')).toHaveCount(0);

  // Node content: request line + the exposed capture's live name.
  const rootNode = page.getByTestId('wf-graph-node-root');
  await expect(rootNode).toContainText('Token introspection');
  await expect(rootNode).toContainText('introspection_token');

  // Layered layout: fan-out children share a row below the root; the
  // sink sits below both.
  const box = async (id: string) => (await page.getByTestId(`wf-graph-node-${id}`).boundingBox())!;
  const [rootBox, leftBox, rightBox, sinkBox] = await Promise.all([box('root'), box('left'), box('right'), box('sink')]);
  expect(leftBox.y).toBeCloseTo(rightBox.y, 1);
  expect(leftBox.y).toBeGreaterThan(rootBox.y);
  expect(sinkBox.y).toBeGreaterThan(leftBox.y);

  // Back to Form: step editors return, the toggle never dirtied the
  // draft, so Save stays disabled.
  await page.getByText('Form', { exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByTestId('wf-graph-pane')).toHaveCount(0);
  await expect(page.getByText('Steps (4)', { exact: false }).first()).toBeVisible();
  await expect(saveButton).toBeDisabled();

  expect(pageErrors).toEqual([]);
  await page.close();
});
