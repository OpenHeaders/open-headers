/**
 * Workflow graph mode — slices 1+2+3+4 e2e (the workflow-graph plan §7).
 *
 * Seeds a fan-out/fan-in workflow via real RPC (request + workflow +
 * one bound LV for the exposure mark), opens its editor from the
 * Workflows sidebar, and drives the graph half of its one view:
 *
 *   - Graph pane renders one node per step (`wf-graph-node-<stepId>`),
 *     one edge per resolved dependsOn (`wf-graph-edge-<from>-<to>`),
 *     the gated step's condition on its line, and the exposed capture's
 *     live name.
 *   - Layout is layered: the two fan-out children share a row below
 *     the root; the sink sits below both.
 *   - Selection: a node click selects it and the panel beside the
 *     graph opens that step's card; another node replaces the card;
 *     closing the step shows the workflow's own panel again. Save
 *     stays disabled (selection never dirties the draft).
 *   - Run overlay (slice 3): a never-run workflow shows `not-run` dots
 *     + the never-run summary; a real run through the playground
 *     backend (gate-skip scenario) shows completed/skipped per node,
 *     the masked-by-default captured-value popover with explicit
 *     reveal, and the publication split — the produced capture's LV
 *     is live, the skipped step's LV stays "pending first run".
 *   - Editing (slice 4): rubber-band connect adds a dependsOn edge
 *     (the step's card shows the new parent, isDirty flips, Save persists);
 *     would-be-cycle targets tint during the drag but the drop still
 *     commits and the validation badge flags it; edge select + remove;
 *     "+ Step" opens the step picker, whose Call row appends a step with
 *     nothing picked.
 *   - The bar of the selected step and a node's menu: "Add step after"
 *     with a request found by search and taken by Enter, Duplicate from
 *     the menu, Delete from the bar.
 *   - The start mark on the step that waits on no other; the minimap's
 *     rectangle a step, and a press on it moving the view.
 *   - Undo and redo: the connect is taken back and brought back by the
 *     two buttons of the graph's row and by the shortcut; taken back,
 *     the draft reads as saved.
 */

import path from 'node:path';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { launchExtensionContext } from './fixtures/launch-extension';
import { WorkbenchPage } from './pages/workbench-page';

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
    seed: {
      method: 'GET',
      url: 'https://api.openheaders.io/introspect',
      headers: [],
      params: [],
      auth: null,
      body: null,
    },
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
  await sectionHeader.waitFor({ state: 'visible', timeout: 5_000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') {
    await sectionHeader.click();
  }
  const row = page.locator(`[data-item-id="workflow-${workflowUid}"]`);
  await row.waitFor({ state: 'visible', timeout: 5_000 });
  await row.click();

  // The editor opens on its one view: the graph beside the workflow's
  // own panel, no step's card open.
  const saveButton = page.getByRole('button', { name: 'Save' }).filter({ visible: true }).first();
  await saveButton.waitFor({ state: 'visible', timeout: 5_000 });
  await expect(page.getByTestId('wf-graph-pane')).toBeVisible();
  await expect(page.locator('[data-step-card]')).toHaveCount(0);

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

  // The gated step's condition is on its line; a line with none reads "always".
  await expect(page.getByTestId('wf-graph-edge-label-root-left')).toHaveText('if token exists');
  await expect(page.getByTestId('wf-graph-edge-label-root-right')).toHaveText('always');

  // Run marks on a never-run workflow: the summary says so and every
  // node wears the empty ring. The exposed capture's LV exists but
  // is unpublished — pending first run, never presented as live.
  // Earlier tests' editor tabs stay mounted — scope to the visible strip.
  await expect(page.getByTestId('wf-run-status-strip').filter({ visible: true }).first()).toContainText(
    'never run for this env',
  );
  for (const stepId of ['root', 'left', 'right', 'sink']) {
    await expect(page.getByTestId(`wf-graph-run-${stepId}`)).toHaveAttribute('data-run-state', 'idle');
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
  const [rootBox, leftBox, rightBox, sinkBox] = await Promise.all([
    box('root'),
    box('left'),
    box('right'),
    box('sink'),
  ]);
  expect(leftBox.y).toBeCloseTo(rightBox.y, 1);
  expect(leftBox.y).toBeGreaterThan(rootBox.y);
  expect(sinkBox.y).toBeGreaterThan(leftBox.y);

  // ── Selection: the graph picks the step the panel shows ────────

  // A node click selects it, and the panel opens that step's card
  // beside the graph. Selection never dirties the draft.
  await page.getByTestId('wf-graph-node-left').click();
  await expect(page.getByTestId('wf-graph-node-left')).toHaveAttribute('data-selected', 'true');
  await expect(page.getByTestId('wf-graph-node-root')).not.toHaveAttribute('data-selected', 'true');
  await expect(page.getByTestId('wf-graph-pane')).toBeVisible();
  await expect(page.locator('[data-step-card]')).toHaveCount(1);
  await expect(page.locator('[data-step-card="left"]')).toBeInViewport();
  await expect(saveButton).toBeDisabled();

  // Another node replaces the card; the panel shows one step.
  await page.getByTestId('wf-graph-node-root').click();
  await expect(page.locator('[data-step-card="root"]')).toBeVisible();
  await expect(page.locator('[data-step-card]')).toHaveCount(1);
  await expect(page.getByTestId('wf-graph-node-left')).not.toHaveAttribute('data-selected', 'true');

  // Closing the step deselects it: the panel shows the workflow, the
  // graph stays, and Save stays disabled.
  await page.getByTestId('wf-panel-close').click();
  await expect(page.locator('[data-step-card]')).toHaveCount(0);
  await expect(page.getByTestId('wf-graph-node-root')).not.toHaveAttribute('data-selected', 'true');
  await expect(page.getByTestId('wf-graph-pane')).toBeVisible();
  await expect(saveButton).toBeDisabled();

  // ── The start mark and the minimap ─────────────────────────────

  // The bar is on the step that waits on no other, and only there.
  await expect(page.getByTestId('wf-graph-start-root')).toBeVisible();
  await expect(page.locator('[data-testid^="wf-graph-start-"]')).toHaveCount(1);

  // The minimap holds a rectangle a step, in the state its node wears;
  // a press on it moves the view, and never dirties the draft.
  const minimap = page.getByTestId('wf-graph-minimap');
  await expect(minimap.locator('[data-testid^="wf-graph-minimap-node-"]')).toHaveCount(4);
  await expect(page.getByTestId('wf-graph-minimap-node-sink')).toHaveAttribute('data-run-state', 'idle');
  await expect(page.getByTestId('wf-graph-minimap-view')).toHaveCount(1);
  const canvasTransform = () =>
    page.getByTestId('wf-graph-pane').evaluate((pane) => (pane.firstElementChild as HTMLElement).style.transform);
  const before = await canvasTransform();
  await minimap.click({ position: { x: 10, y: 10 } });
  expect(await canvasTransform()).not.toBe(before);
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
  await sectionHeader.waitFor({ state: 'visible', timeout: 5_000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') {
    await sectionHeader.click();
  }
  const row = page.locator(`[data-item-id="workflow-${workflowUid}"]`);
  await row.waitFor({ state: 'visible', timeout: 5_000 });
  await row.click();
  const saveButton = page.getByRole('button', { name: 'Save' }).filter({ visible: true }).first();
  await saveButton.waitFor({ state: 'visible', timeout: 5_000 });
  await expect(saveButton).toBeDisabled();
  await expect(page.getByTestId('wf-graph-pane').filter({ visible: true }).first()).toBeVisible();
  // The gestures below reach the second layer's lower edge: beside its panel the
  // graph has the pane's whole height, stacked over it only a short strip.
  await new WorkbenchPage(page).collapseRightSidebar();

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

  // ── Undo and redo ────────────────────────────────────────────────
  // The connect is one entry. Taken back, the draft is what is saved
  // again and nothing is left to undo; the buttons leave focus on the
  // graph, so the shortcut acts after them.
  const undoButton = page.getByTestId('wf-graph-undo');
  const redoButton = page.getByTestId('wf-graph-redo');
  await expect(redoButton).toBeDisabled();
  await undoButton.click();
  await expect(page.getByTestId('wf-graph-edge-b-c')).toHaveCount(0);
  await expect(saveButton).toBeDisabled();
  await expect(undoButton).toBeDisabled();
  await redoButton.click();
  await expect(page.getByTestId('wf-graph-edge-b-c')).toHaveCount(1);
  await expect(redoButton).toBeDisabled();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByTestId('wf-graph-edge-b-c')).toHaveCount(0);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+z' : 'Control+y');
  await expect(page.getByTestId('wf-graph-edge-b-c')).toHaveCount(1);
  await expect(saveButton).toBeEnabled();

  // Step c's Depends on card shows the materialized explicit parents, a row each.
  await page.getByTestId('wf-graph-node-c').click();
  const cDeps = page.locator('[data-step-card="c"]').getByTestId('wf-step-2-deps');
  await expect(cDeps.getByTestId('wf-step-2-dep-a')).toBeVisible();
  await expect(cDeps.getByTestId('wf-step-2-dep-b')).toBeVisible();
  await expect(cDeps).toContainText('Chosen for this step.');

  // Save persists the graph-made edit through the normal save path.
  await saveButton.click();
  await expect(saveButton).toBeDisabled();

  // ── Select + remove the edge ─────────────────────────────────────
  await expect(page.getByTestId('wf-graph-edge-hit-b-c')).toHaveCount(1);
  // The b→c edge is a vertical line here (c sits under b), so its hit
  // path has a zero-width bounding box — Playwright's locator click
  // refuses it as invisible. Click it by coordinates instead, a quarter
  // of the way down: the transparent hit stroke is 14px wide, and the
  // a→c line joins it only at the middle of the gap.
  const nodeB = (await page.getByTestId('wf-graph-node-b').boundingBox())!;
  const nodeCPost = (await page.getByTestId('wf-graph-node-c').boundingBox())!;
  const underB = nodeB.y + nodeB.height;
  await page.mouse.click(nodeB.x + nodeB.width / 2, underB + (nodeCPost.y - underB) / 4);
  await expect(page.getByTestId('wf-graph-edge-b-c')).toHaveAttribute('data-selected', 'true');
  await page.getByTestId('wf-graph-edge-remove-b-c').click();
  await expect(page.getByTestId('wf-graph-edge-b-c')).toHaveCount(0);
  await expect(saveButton).toBeEnabled();

  // ── Add step ─────────────────────────────────────────────────────
  // "+ Step" opens the picker and adds nothing by itself; its Call row is a step with nothing picked.
  await page.getByTestId('wf-graph-add-step').click();
  await expect(page.getByTestId('wf-step-picker')).toBeVisible();
  await expect(page.getByTestId('wf-graph-node-step4')).toHaveCount(0);
  await page.getByTestId('wf-step-picker-kind-call').click();
  await expect(page.getByTestId('wf-step-picker')).toHaveCount(0);
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

  // ── The bar of the selected step ─────────────────────────────────
  // By the selected node and off it: four actions, the last a delete.
  await page.getByTestId('wf-graph-fit').click();
  await page.getByTestId('wf-graph-node-a').click();
  const bar = page.getByTestId('wf-graph-bar');
  await expect(bar.locator('button')).toHaveCount(4);
  const barBox = (await bar.boundingBox())!;
  const selectedBox = (await page.getByTestId('wf-graph-node-a').boundingBox())!;
  expect(barBox.y + barBox.height <= selectedBox.y || barBox.y >= selectedBox.y + selectedBox.height).toBe(true);

  // "Add step after" opens the picker; a search finds the saved request,
  // Enter takes it: a call on it, named after it, waiting on the selected step.
  await page.getByTestId('wf-graph-bar-add-step-after').click();
  await page.getByTestId('wf-step-picker-search').fill('EDIT-E2E');
  await expect(page.getByTestId('wf-step-picker-kind-call')).toHaveCount(0);
  await expect(page.getByTestId(`wf-step-picker-request-${requestUid}`)).toHaveAttribute('data-first', 'true');
  await page.keyboard.press('Enter');
  const added = page.getByTestId('wf-graph-node-edit-e2e-request');
  await expect(added).toHaveAttribute('data-selected', 'true');
  await expect(page.getByTestId('wf-graph-edge-a-edit-e2e-request')).toHaveCount(1);
  await expect(page.locator('[data-step-card="edit-e2e-request"]')).toContainText('edit-e2e request');

  // Focus is back on the graph: the shortcut takes the step back in one.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(added).toHaveCount(0);

  // ── A node's menu ────────────────────────────────────────────────
  // A right-click selects the node and offers the bar's four. The undo
  // took the step back, not the pan that had brought it into view.
  await page.getByTestId('wf-graph-fit').click();
  await page.getByTestId('wf-graph-node-b').click({ button: 'right' });
  await expect(page.getByTestId('wf-graph-node-b')).toHaveAttribute('data-selected', 'true');
  await expect(page.getByTestId('wf-graph-context-menu').locator('button')).toHaveCount(4);
  await page.getByTestId('wf-graph-menu-duplicate-step').click();
  await expect(page.getByTestId('wf-graph-node-b-copy')).toHaveAttribute('data-selected', 'true');

  // The copy's bar deletes it.
  await page.getByTestId('wf-graph-bar-delete-step').click();
  await expect(page.getByTestId('wf-graph-node-b-copy')).toHaveCount(0);
  await expect(bar).toHaveCount(0);

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
  await sectionHeader.waitFor({ state: 'visible', timeout: 5_000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') {
    await sectionHeader.click();
  }
  const row = page.locator(`[data-item-id="workflow-${workflowUid}"]`);
  await row.waitFor({ state: 'visible', timeout: 5_000 });
  await row.click();
  await page
    .getByRole('button', { name: 'Save' })
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 5_000 });
  // An earlier case's tab may still be mounted behind this one.
  await expect(page.getByTestId('wf-graph-pane').filter({ visible: true }).first()).toBeVisible();

  // Summary reflects the successful run; per-node states carry the
  // runner's attestation: passed vs gate-skipped.
  await expect(page.getByTestId('wf-run-status-strip').filter({ visible: true }).first()).toContainText('last');
  await expect(page.getByTestId('wf-graph-run-introspect')).toHaveAttribute('data-run-state', 'passed');
  await expect(page.getByTestId('wf-graph-run-refresh')).toHaveAttribute('data-run-state', 'skipped');
  // The line into the skipped step was not taken, and says the condition that skipped it.
  await expect(page.getByTestId('wf-graph-edge-introspect-refresh')).toHaveAttribute('data-truth', 'not-taken');
  await expect(page.getByTestId('wf-graph-edge-label-introspect-refresh')).toHaveText('if active = "false"');

  // Captured values are the step's panel's to show, in its Captures card: masked
  // by default, the card's one eye an explicit click; the row names who reads it.
  await page.getByTestId('wf-graph-node-introspect').filter({ visible: true }).first().click();
  await expect(page.getByTestId('wf-step-0-capture-0-name')).toHaveValue('active');
  await expect(page.getByTestId('wf-step-0-capture-0-used-by')).toHaveText('refresh');
  const lastValue = page.getByTestId('wf-step-0-capture-0-last');
  await expect(lastValue).toContainText('••••••••');
  await page.getByTestId('wf-step-0-captures-reveal').click();
  await expect(lastValue).toContainText('true');
  // And the step that reads it says so, with the way back.
  await page.getByTestId('wf-graph-node-refresh').filter({ visible: true }).first().click();
  await expect(page.getByTestId('wf-step-1-use-0')).toContainText('introspect.active');
  await expect(page.getByTestId('wf-step-1-use-0')).toContainText('Run condition');
  await page.getByTestId('wf-step-1-use-0').getByRole('button', { name: 'Go to step' }).click();
  await expect(page.locator('[data-step-card="introspect"]').filter({ visible: true })).toBeVisible();

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
