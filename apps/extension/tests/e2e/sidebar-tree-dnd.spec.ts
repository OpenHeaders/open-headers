/**
 * Sidebar tree dnd e2e — the request tree's move gestures end to end:
 * a leaf reorders among its siblings, a leaf drops into a folder, a
 * folder moves across collections, a collection reorders, a Cmd-click
 * multi-selection moves together, and the order survives a reload.
 * Every drop is one move on the parent's ordered set — the rows'
 * document order is what the assertions read (`data-item-id`, the
 * tree's node-identity attribute); the toast confirms the count.
 *
 * Drags are real pointer sequences (dnd-kit's pointer sensor, 4px
 * activation): press on the source row, glide onto the target row's
 * band, release.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Locator, type Page, test } from '@playwright/test';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let page: Page;
let workbench: WorkbenchPage;

const ids = { colA: '', colB: '', folder: '', r1: '', r2: '', r3: '', r4: '' };
const row = (id: string): Locator => page.locator(`[data-item-id="${id}"]`);
const requestRow = (uid: string): Locator => row(`request-${uid}`);

/** Document order of the tree rows, as `data-item-id`s. */
async function treeOrder(): Promise<string[]> {
  return page.locator('[data-item-id]').evaluateAll((els) => els.map((el) => el.getAttribute('data-item-id') ?? ''));
}

async function expandIfCollapsed(id: string): Promise<void> {
  const target = row(id);
  await target.waitFor({ state: 'visible', timeout: 10000 });
  const caret = target.locator('.rules-sidebar-item-caret .anticon');
  const rotated = await caret.evaluate((el) => getComputedStyle(el).transform !== 'none').catch(() => false);
  if (!rotated) await target.click();
}

/** Drag `source` onto `target` at `band` (0 = top edge … 1 = bottom edge). */
async function drag(source: Locator, target: Locator, band: number): Promise<void> {
  const from = (await source.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 12, { steps: 4 });
  const to = (await target.boundingBox())!;
  await page.mouse.move(to.x + to.width / 2, to.y + to.height * band, { steps: 8 });
  await page.mouse.move(to.x + to.width / 2 + 1, to.y + to.height * band, { steps: 2 });
  await page.mouse.up();
}

async function expectMovedToast(count: number): Promise<void> {
  await expect(page.getByText(count === 1 ? '1 item moved' : `${count} items moved`)).toBeVisible({ timeout: 5000 });
}

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const extensionId = sw.url().split('/')[2]!;
  page = await context.newPage();
  workbench = await WorkbenchPage.open(page, extensionId);

  ids.colA = await workbench.seedRequestCollection('Alpha');
  ids.colB = await workbench.seedRequestCollection('Beta');
  const collections = await workbench.rpc<{ collections?: Array<{ uid: string; path: string }> }>(
    'getLocalRequestCollections',
  );
  const pathOf = (uid: string): string => collections.collections?.find((c) => c.uid === uid)?.path ?? '';
  const folder = await workbench.rpc<{ success: boolean; folder?: { uid: string; path: string } }>(
    'createLocalRequestFolder',
    { name: 'Nested', parentPath: pathOf(ids.colA) },
  );
  expect(folder.success).toBe(true);
  ids.folder = folder.folder!.uid;
  const seed = async (name: string, target: { collectionUid?: string; parentPath?: string }): Promise<string> => {
    const res = await workbench.rpc<{ success: boolean; request?: { uid: string }; error?: string }>(
      'createLocalRequest',
      { name, ...target, seed: { method: 'GET', url: 'https://api.openheaders.io/v1', headers: [], params: [] } },
    );
    expect(res.success, res.error).toBe(true);
    return res.request!.uid;
  };
  ids.r1 = await seed('r1', { collectionUid: ids.colA });
  ids.r2 = await seed('r2', { collectionUid: ids.colA });
  ids.r3 = await seed('r3', { collectionUid: ids.colA });
  ids.r4 = await seed('r4', { parentPath: folder.folder!.path });

  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseRightSidebar();
  await expandIfCollapsed(`req-col-${ids.colA}`);
  await expandIfCollapsed(`req-folder-${ids.folder}`);
});

test.afterAll(async () => {
  await context?.close();
});

test('a leaf dropped on the lower band of a sibling lands after it', async () => {
  await drag(requestRow(ids.r1), requestRow(ids.r3), 0.8);
  await expectMovedToast(1);
  await expect
    .poll(async () => {
      const order = await treeOrder();
      return [ids.r2, ids.r3, ids.r1].map((uid) => order.indexOf(`request-${uid}`));
    })
    .toEqual(expect.arrayContaining([expect.any(Number)]));
  const order = await treeOrder();
  const at = (uid: string) => order.indexOf(`request-${uid}`);
  expect(at(ids.r2) < at(ids.r3) && at(ids.r3) < at(ids.r1)).toBe(true);
});

test('a leaf dropped on a folder row lands inside it, after its items', async () => {
  await drag(requestRow(ids.r2), row(`req-folder-${ids.folder}`), 0.5);
  await expectMovedToast(1);
  await expect
    .poll(async () => {
      const order = await treeOrder();
      const folderAt = order.indexOf(`req-folder-${ids.folder}`);
      return order.slice(folderAt + 1, folderAt + 3);
    })
    .toEqual([`request-${ids.r4}`, `request-${ids.r2}`]);
});

test('a folder dropped on another collection moves there with its subtree', async () => {
  await drag(row(`req-folder-${ids.folder}`), row(`req-col-${ids.colB}`), 0.5);
  await expectMovedToast(1);
  await expandIfCollapsed(`req-col-${ids.colB}`);
  await expandIfCollapsed(`req-folder-${ids.folder}`);
  await expect
    .poll(async () => {
      const order = await treeOrder();
      const colBAt = order.indexOf(`req-col-${ids.colB}`);
      return order.slice(colBAt + 1, colBAt + 4);
    })
    .toEqual([`req-folder-${ids.folder}`, `request-${ids.r4}`, `request-${ids.r2}`]);
});

test('a collection dropped on the upper band of another reorders the roots', async () => {
  await drag(row(`req-col-${ids.colB}`), row(`req-col-${ids.colA}`), 0.2);
  await expectMovedToast(1);
  await expect
    .poll(async () => {
      const order = await treeOrder();
      return order.indexOf(`req-col-${ids.colB}`) < order.indexOf(`req-col-${ids.colA}`);
    })
    .toBe(true);
});

test('a dragged member of the multi-selection takes the selection along', async () => {
  await requestRow(ids.r3).click();
  await requestRow(ids.r1).click({ modifiers: ['Meta'] });
  await requestRow(ids.r3).click({ modifiers: ['Meta'] });
  await drag(requestRow(ids.r3), row(`req-folder-${ids.folder}`), 0.5);
  await expectMovedToast(2);
  await expect
    .poll(async () => {
      const order = await treeOrder();
      const folderAt = order.indexOf(`req-folder-${ids.folder}`);
      return order.slice(folderAt + 1, folderAt + 5);
    })
    .toEqual([`request-${ids.r4}`, `request-${ids.r2}`, `request-${ids.r3}`, `request-${ids.r1}`]);
});

test('the order survives a reload', async () => {
  const before = await treeOrder();
  await workbench.reload();
  await workbench.showRequestsView();
  await expandIfCollapsed(`req-col-${ids.colB}`);
  await expandIfCollapsed(`req-folder-${ids.folder}`);
  await expandIfCollapsed(`req-col-${ids.colA}`);
  await expect.poll(treeOrder).toEqual(before);
});
