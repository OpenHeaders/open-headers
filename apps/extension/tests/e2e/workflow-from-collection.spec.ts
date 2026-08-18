/**
 * "Create Workflow from collection/folder" — e2e for the request
 * picker flow. Seeds a request collection with a folder + root
 * requests via real RPC, then drives the whole path through the UI:
 *
 *   - The collection row's `⋯` menu offers "Create Workflow…".
 *   - The picker modal lists the container's subtree with every
 *     request pre-checked; unchecking one drops the confirm button's
 *     step count.
 *   - Confirming opens a create-mode workflow draft named after the
 *     collection, one step per selected request in sidebar tree order
 *     (folders first, then root requests), chained sequentially — the
 *     graph view shows the implicit prior-step edges.
 *   - Save persists the workflow: steps carry the selected requests'
 *     uids in tree order; the unchecked request is absent.
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

  // The request store hydrates async on a fresh profile and rejects
  // mutations until then — probe with a real create once (the
  // live-orchestration readiness idiom), so the test's seeding RPCs
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

const REQUEST_SEED = {
  method: 'GET',
  url: 'https://api.openheaders.io/auth',
  headers: [],
  params: [],
  auth: null,
  body: null,
};

test('collection ⋯ → Create Workflow… picker seeds, opens, and saves a chained draft', async () => {
  const page = await context.newPage();
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(`chrome-extension://${extensionId}/workbench.html`);
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root !== null && root.children.length > 0;
  });

  // Seed through the real RPC boundary: a collection holding a folder
  // (two requests) plus two root requests. Tree order is folders
  // first, then root requests in insertion order:
  //   tokens/refresh, tokens/introspect, login, profile.
  const colRes = await rpc<{ success: boolean; collection?: { uid: string; path: string } }>(
    page,
    'createLocalRequestCollection',
    { name: 'Auth flow' },
  );
  expect(colRes.success).toBe(true);
  const collection = colRes.collection!;

  const folderRes = await rpc<{ success: boolean; folder?: { uid: string; path: string } }>(
    page,
    'createLocalRequestFolder',
    { name: 'tokens', parentPath: collection.path },
  );
  expect(folderRes.success).toBe(true);
  const folder = folderRes.folder!;

  const uids: Record<string, string> = {};
  for (const [name, payload] of [
    ['refresh', { name: 'refresh', parentPath: folder.path, seed: { ...REQUEST_SEED, method: 'POST' } }],
    ['introspect', { name: 'introspect', parentPath: folder.path, seed: REQUEST_SEED }],
    ['login', { name: 'login', collectionUid: collection.uid, seed: { ...REQUEST_SEED, method: 'POST' } }],
    ['profile', { name: 'profile', collectionUid: collection.uid, seed: REQUEST_SEED }],
  ] as const) {
    const res = await rpc<{ success: boolean; request?: { uid: string } }>(page, 'createLocalRequest', payload);
    expect(res.success).toBe(true);
    uids[name] = res.request!.uid;
  }

  // Open the API Requests sidebar and the collection row's `⋯` menu.
  await page.reload();
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root !== null && root.children.length > 0;
  });

  // Expected step order = the real tree's depth-first request order
  // (folders first, then root requests in cache order) minus the
  // request the picker will uncheck — the feature's contract is
  // "steps follow sidebar order", so assert against the actual tree.
  type SeedNode = { type: string; uid: string; name: string; children?: SeedNode[] };
  const treesRes = await rpc<{ collectionTrees: { uid: string; tree: SeedNode[] }[] }>(
    page,
    'getLocalRequestCollectionTrees',
  );
  const seededTree = treesRes.collectionTrees.find((c) => c.uid === collection.uid)!.tree;
  const flattenRequests = (nodes: SeedNode[]): { uid: string; name: string }[] =>
    nodes.flatMap((n) =>
      n.type === 'request' ? [{ uid: n.uid, name: n.name }] : n.type === 'folder' ? flattenRequests(n.children ?? []) : [],
    );
  const orderedRequests = flattenRequests(seededTree);
  expect(orderedRequests).toHaveLength(4);
  const expected = orderedRequests.filter((r) => r.uid !== uids.introspect);

  const requestsTab = page.locator('[data-tool-window="api-requests"]').first();
  if ((await requestsTab.getAttribute('aria-selected')) !== 'true') {
    await requestsTab.click();
  }
  const sectionHeader = page
    .getByRole('button', { name: /REQUESTS/ })
    .filter({ visible: true })
    .first();
  await sectionHeader.waitFor({ state: 'visible', timeout: 10000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') {
    await sectionHeader.click();
  }

  const collectionRow = page.locator(`[data-item-id="req-col-${collection.uid}"]`);
  await collectionRow.waitFor({ state: 'visible', timeout: 10000 });
  await collectionRow.hover();
  await collectionRow.locator('.anticon-ellipsis').click();
  await page.getByRole('menuitem', { name: 'Create Workflow…' }).click();

  // Picker: all four requests pre-checked, confirm shows the count.
  const modal = page.getByTestId('wf-from-requests-modal');
  await expect(modal).toBeVisible();
  for (const name of ['refresh', 'introspect', 'login', 'profile'] as const) {
    await expect(page.getByTestId(`wf-from-requests-node-${uids[name]}`)).toBeVisible();
  }
  const createButton = page.getByTestId('wf-from-requests-create');
  await expect(createButton).toHaveText('Create Workflow (4 steps)');

  // Uncheck `introspect` — click its row's checkbox, not the title.
  await page
    .locator('.ant-tree-treenode', { has: page.getByTestId(`wf-from-requests-node-${uids.introspect}`) })
    .locator('.ant-tree-checkbox')
    .click();
  await expect(createButton).toHaveText('Create Workflow (3 steps)');
  await createButton.click();
  await expect(modal).toBeHidden();

  // Draft editor: named after the collection, one step per selected
  // request in tree order, implicit sequential chain in the graph.
  const saveButton = page.getByRole('button', { name: 'Save' }).filter({ visible: true }).first();
  await saveButton.waitFor({ state: 'visible', timeout: 10000 });
  await expect(page.getByText('Auth flow', { exact: true }).first()).toBeVisible();

  await page.getByText('Preview', { exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByTestId('wf-graph-pane')).toBeVisible();
  for (const [i, req] of expected.entries()) {
    await expect(page.getByTestId(`wf-graph-node-step${i + 1}`)).toContainText(req.name);
  }
  await expect(page.getByTestId('wf-graph-node-step4')).toHaveCount(0);
  await expect(page.getByTestId('wf-graph-pane')).not.toContainText('introspect');
  await expect(page.getByTestId('wf-graph-edge-step1-step2')).toHaveCount(1);
  await expect(page.getByTestId('wf-graph-edge-step2-step3')).toHaveCount(1);

  // Save persists the seeded steps: selected uids, tree order.
  await saveButton.click();
  await expect
    .poll(async () => {
      const res = await rpc<{ workflows: { name: string; steps: { requestUid: string }[] }[] }>(
        page,
        'listLiveWorkflows',
      );
      const wf = res.workflows.find((w) => w.name === 'Auth flow');
      return wf?.steps.map((s) => s.requestUid) ?? null;
    })
    .toEqual(expected.map((r) => r.uid));

  await page.close();
});

test('no page errors across the suite', () => {
  expect(pageErrors).toEqual([]);
});
