/**
 * Workflow graph mode — slices 1+2+3+4 e2e (WORKFLOW_GRAPH_PLAN.md §7).
 *
 * Seeds a fan-out/fan-in workflow via real RPC (request + workflow +
 * one bound LV for the exposure mark), opens its editor from the
 * Workflows sidebar, and drives the Editor | Preview toggle:
 *
 *   - Graph pane renders one node per step (`wf-graph-node-<stepId>`),
 *     one edge per resolved dependsOn (`wf-graph-edge-<from>-<to>`),
 *     the gate marker on the gated step, and the exposed capture's
 *     live name.
 *   - Layout is layered: the two fan-out children share a row below
 *     the root; the sink sits below both.
 *   - Selection sync (slice 2): node click selects (highlight only,
 *     stays on Graph); the selected node's "Edit step" affordance
 *     jumps to the form scrolled to that step's card; focusing a
 *     field in another step moves the selection so returning to
 *     Graph highlights that node.
 *   - Toggling back to Form is loss-free: step editors reappear and
 *     Save stays disabled (toggle + selection never dirty the draft).
 *   - Run overlay (slice 3): a never-run workflow shows `not-run` dots
 *     + the never-run summary; a real run through the playground
 *     backend (gate-skip scenario) shows completed/skipped per node,
 *     the masked-by-default captured-value popover with explicit
 *     reveal, and the publication split — the produced capture's LV
 *     is live, the skipped step's LV stays "pending first run".
 *   - Editing (slice 4): rubber-band connect adds a dependsOn edge
 *     (form shows the new parent, isDirty flips, Save persists);
 *     would-be-cycle targets tint during the drag but the drop still
 *     commits and the validation badge flags it; edge select + remove;
 *     the add-step affordance appends a form-default step.
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
        uid: 'stpgrf01',
        id: 'root',
        requestUid,
        captures: [{ uid: 'capgrf01', name: 'token', extractor: { kind: 'json-path', path: '$.access_token' } }],
      },
      {
        uid: 'stpgrf02',
        id: 'left',
        requestUid,
        dependsOn: ['root'],
        runIf: { all: [{ uid: 'gatgrf01', kind: 'capture-exists', stepId: 'root', captureName: 'token' }] },
        captures: [],
      },
      { uid: 'stpgrf03', id: 'right', requestUid, dependsOn: ['root'], captures: [] },
      { uid: 'stpgrf04', id: 'sink', requestUid, dependsOn: ['left', 'right'], captures: [] },
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

  await page.getByText('Preview', { exact: true }).filter({ visible: true }).first().click();
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

  // Run overlay on a never-run workflow: the summary says so and every
  // node carries the not-run state. The exposed capture's LV exists but
  // is unpublished — pending first run, never presented as live.
  // Earlier tests' editor tabs stay mounted — scope to the visible strip.
  await expect(page.getByTestId('wf-run-status-strip').filter({ visible: true }).first()).toContainText(
    'never run for this env',
  );
  for (const stepId of ['root', 'left', 'right', 'sink']) {
    await expect(page.getByTestId(`wf-graph-run-${stepId}`)).toHaveAttribute('data-run-state', 'not-run');
  }
  await expect(page.getByTestId('wf-graph-node-root').locator('[data-lv-published]')).toHaveAttribute(
    'data-lv-published',
    'false',
  );

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

  // ── Slice 2: selection sync graph↔form ─────────────────────────

  // Node click selects — highlight only, the view stays on Graph.
  await page.getByTestId('wf-graph-node-left').click();
  await expect(page.getByTestId('wf-graph-node-left')).toHaveAttribute('data-selected', 'true');
  await expect(page.getByTestId('wf-graph-node-root')).not.toHaveAttribute('data-selected', 'true');
  await expect(page.getByTestId('wf-graph-pane')).toBeVisible();

  // The selected node grows the explicit "Edit step" affordance; the
  // jump lands on the form with that step's card highlighted and
  // scrolled into view. Selection never dirties the draft.
  await page.getByTestId('wf-graph-open-left').click();
  await expect(page.getByTestId('wf-graph-pane')).toHaveCount(0);
  const leftCard = page.locator('[data-step-card="left"]');
  await expect(leftCard).toHaveAttribute('data-selected', 'true');
  await expect(leftCard).toBeInViewport();
  await expect(saveButton).toBeDisabled();

  // Focusing a field in another step moves the selection; returning
  // to Graph highlights that node.
  await page.locator('[data-step-card="sink"] input').first().click();
  await page.getByText('Preview', { exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByTestId('wf-graph-node-sink')).toHaveAttribute('data-selected', 'true');
  await expect(page.getByTestId('wf-graph-node-left')).not.toHaveAttribute('data-selected', 'true');

  // Back to Form: step editors return, the toggle never dirtied the
  // draft, so Save stays disabled.
  await page.getByText('Editor', { exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByTestId('wf-graph-pane')).toHaveCount(0);
  await expect(page.getByText('Steps (4)', { exact: false }).first()).toBeVisible();
  await expect(saveButton).toBeDisabled();

  expect(pageErrors).toEqual([]);
  await page.close();
});

test('graph editing: connect adds a dependsOn edge, edge remove, add step, cycle warn', async () => {
  const page = await context.newPage();
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(`chrome-extension://${extensionId}/workbench.html`);
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root !== null && root.children.length > 0;
  });

  const reqRes = await rpc<{ success: boolean; request?: { uid: string } }>(page, 'createLocalRequest', {
    name: 'edit-e2e request',
    seed: {
      method: 'GET',
      url: 'https://api.openheaders.io/edit',
      headers: [],
      params: [],
      auth: null,
      body: null,
    },
  });
  expect(reqRes.success).toBe(true);
  const requestUid = reqRes.request!.uid;

  const wfRes = await rpc<{ success: boolean; workflow?: { uid: string } }>(page, 'createLiveWorkflow', {
    name: 'graph-edit-e2e',
    enabled: true,
    refresh: { kind: 'manual' },
    steps: [
      { uid: 'stpged01', id: 'a', requestUid, captures: [] },
      { uid: 'stpged02', id: 'b', requestUid, dependsOn: ['a'], captures: [] },
      { uid: 'stpged03', id: 'c', requestUid, dependsOn: ['a'], captures: [] },
    ],
  });
  expect(wfRes.success).toBe(true);
  const workflowUid = wfRes.workflow!.uid;

  // Open the workflow's editor and toggle to Graph.
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
  await expect(saveButton).toBeDisabled();
  await page.getByText('Preview', { exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByTestId('wf-graph-pane')).toBeVisible();

  // ── Connect b → c ────────────────────────────────────────────────
  const center = (box: { x: number; y: number; width: number; height: number }) => ({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  });
  const anchorB = (await page.getByTestId('wf-graph-connect-b').boundingBox())!;
  const nodeC = (await page.getByTestId('wf-graph-node-c').boundingBox())!;
  await page.mouse.move(center(anchorB).x, center(anchorB).y);
  await page.mouse.down();
  await page.mouse.move(center(nodeC).x, center(nodeC).y, { steps: 5 });

  // Mid-drag: the rubber band is live and cycle targets tint — from b,
  // that's its ancestor a (and b itself), never c.
  await expect(page.getByTestId('wf-graph-rubberband')).toBeVisible();
  await expect(page.getByTestId('wf-graph-node-a')).toHaveAttribute('data-cycle-target', 'true');
  await expect(page.getByTestId('wf-graph-node-c')).not.toHaveAttribute('data-cycle-target', 'true');

  await page.mouse.up();
  await expect(page.getByTestId('wf-graph-edge-b-c')).toHaveCount(1);
  await expect(page.getByTestId('wf-graph-rubberband')).toHaveCount(0);
  await expect(saveButton).toBeEnabled();
  // A dirty draft with no peer writes must never raise the
  // external-change banner (conflict tracking keys steps by uid).
  await expect(page.getByText('changed externally', { exact: false })).toHaveCount(0);

  // The form shows the materialized explicit parents on step c.
  await page.getByText('Editor', { exact: true }).filter({ visible: true }).first().click();
  await expect(page.locator('[data-step-card="c"]')).toContainText('after a, b');

  // Save persists the graph-made edit through the normal save path.
  await saveButton.click();
  await expect(saveButton).toBeDisabled();

  // ── Select + remove the edge ─────────────────────────────────────
  await page.getByText('Preview', { exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByTestId('wf-graph-edge-hit-b-c')).toHaveCount(1);
  // The b→c edge is a vertical line here (same column), so its hit
  // path has a zero-width bounding box — Playwright's locator click
  // refuses it as invisible. Click the edge midpoint by coordinates
  // instead; the transparent hit stroke is 14px wide there.
  const nodeB = (await page.getByTestId('wf-graph-node-b').boundingBox())!;
  const nodeCPost = (await page.getByTestId('wf-graph-node-c').boundingBox())!;
  await page.mouse.click(
    (nodeB.x + nodeB.width / 2 + nodeCPost.x + nodeCPost.width / 2) / 2,
    (nodeB.y + nodeB.height + nodeCPost.y) / 2,
  );
  await expect(page.getByTestId('wf-graph-edge-b-c')).toHaveAttribute('data-selected', 'true');
  await page.getByTestId('wf-graph-edge-remove-b-c').click();
  await expect(page.getByTestId('wf-graph-edge-b-c')).toHaveCount(0);
  await expect(saveButton).toBeEnabled();

  // ── Add step ─────────────────────────────────────────────────────
  await page.getByTestId('wf-graph-add-step').click();
  await expect(page.getByTestId('wf-graph-node-step4')).toBeVisible();
  await expect(page.getByTestId('wf-graph-node-step4')).toHaveAttribute('data-selected', 'true');

  // ── Cycle attempt: warn during drag, drop commits, badge flags ───
  const anchorC = (await page.getByTestId('wf-graph-connect-c').boundingBox())!;
  const nodeA = (await page.getByTestId('wf-graph-node-a').boundingBox())!;
  await page.mouse.move(center(anchorC).x, center(anchorC).y);
  await page.mouse.down();
  await page.mouse.move(center(nodeA).x, center(nodeA).y, { steps: 5 });
  await expect(page.getByTestId('wf-graph-node-a')).toHaveAttribute('data-cycle-target', 'true');
  await page.mouse.up();
  await expect(page.getByTestId('wf-graph-edge-c-a')).toHaveCount(1);
  await expect(page.locator('[data-testid^="wf-graph-error-"]').first()).toBeVisible();

  expect(pageErrors).toEqual([]);
  await page.close();
});

test('run overlay: per-node states, masked value reveal, publication split', async () => {
  const page = await context.newPage();
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(`chrome-extension://${extensionId}/workbench.html`);
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root !== null && root.children.length > 0;
  });

  // Gate-skip scenario against the real playground backend: introspect
  // completes (active: true), refresh's gate wants active === 'false'
  // so it skips. Two LVs: one on the produced capture (goes live on
  // the run), one on the skipped step's capture (stays pending).
  const introspectReq = await rpc<{ success: boolean; request?: { uid: string } }>(page, 'createLocalRequest', {
    name: 'overlay-introspect',
    seed: { method: 'GET', url: 'http://127.0.0.1:3000/live/introspect/valid' },
  });
  expect(introspectReq.success).toBe(true);
  const refreshReq = await rpc<{ success: boolean; request?: { uid: string } }>(page, 'createLocalRequest', {
    name: 'overlay-refresh',
    seed: { method: 'GET', url: 'http://127.0.0.1:3000/live/refresh' },
  });
  expect(refreshReq.success).toBe(true);

  const wfRes = await rpc<{ success: boolean; workflow?: { uid: string } }>(page, 'createLiveWorkflow', {
    name: 'graph-overlay-e2e',
    enabled: true,
    refresh: { kind: 'manual' },
    steps: [
      {
        uid: 'stpovl01',
        id: 'introspect',
        requestUid: introspectReq.request!.uid,
        captures: [{ uid: 'capovl01', name: 'active', extractor: { kind: 'json-path', path: '$.active' } }],
      },
      {
        uid: 'stpovl02',
        id: 'refresh',
        requestUid: refreshReq.request!.uid,
        dependsOn: ['introspect'],
        runIf: {
          all: [
            { uid: 'gatovl01', kind: 'capture-equals', stepId: 'introspect', captureName: 'active', value: 'false' },
          ],
        },
        captures: [{ uid: 'capovl02', name: 'token', extractor: { kind: 'json-path', path: '$.access_token' } }],
      },
    ],
  });
  expect(wfRes.success).toBe(true);
  const workflowUid = wfRes.workflow!.uid;

  for (const lv of [
    { name: 'overlayActive', stepId: 'introspect', captureName: 'active' },
    { name: 'overlayToken', stepId: 'refresh', captureName: 'token' },
  ]) {
    const lvRes = await rpc<{ success: boolean }>(page, 'createLiveVariable', { ...lv, workflowUid, enabled: true });
    expect(lvRes.success).toBe(true);
  }

  const refreshed = await rpc<{ success: boolean }>(page, 'refreshLiveWorkflowNow', { workflowUid });
  expect(refreshed.success).toBe(true);

  // Open the workflow's editor and toggle to Graph.
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
  await page
    .getByRole('button', { name: 'Save' })
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });
  await page.getByText('Preview', { exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByTestId('wf-graph-pane')).toBeVisible();

  // Summary reflects the successful run; per-node states carry the
  // runner's attestation: completed vs gate-skipped.
  await expect(page.getByTestId('wf-run-status-strip').filter({ visible: true }).first()).toContainText('last');
  await expect(page.getByTestId('wf-graph-run-introspect')).toHaveAttribute('data-run-state', 'completed');
  await expect(page.getByTestId('wf-graph-run-refresh')).toHaveAttribute('data-run-state', 'skipped');

  // Captured values are masked by default; reveal is an explicit click.
  await page.getByTestId('wf-graph-run-introspect').click();
  const pop = page.getByTestId('wf-graph-run-pop-introspect');
  await expect(pop).toBeVisible();
  await expect(pop).toContainText('active');
  await expect(pop).toContainText('••••••••');
  await page.getByTestId('wf-graph-reveal-introspect').click();
  await expect(pop).toContainText('true');

  // Publication split: the run produced introspect.active, so its LV is
  // live; refresh.token was never produced — pending first run.
  await expect(page.getByTestId('wf-graph-node-introspect').locator('[data-lv-published]')).toHaveAttribute(
    'data-lv-published',
    'true',
  );
  await expect(page.getByTestId('wf-graph-node-refresh').locator('[data-lv-published]')).toHaveAttribute(
    'data-lv-published',
    'false',
  );

  expect(pageErrors).toEqual([]);
  await page.close();
});
